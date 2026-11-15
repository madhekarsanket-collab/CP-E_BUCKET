import datetime
from decimal import Decimal

from flask import Blueprint, g, jsonify, request

from auth import require_auth
from db import db
from extensions import limiter
from validators import ApiError, parse_checkout

bp = Blueprint('orders', __name__, url_prefix='/api')

DELIVERY_DAYS = 4
CASH_ON_DELIVERY = 'Cash on Delivery'


@bp.post('/checkout')
@require_auth('user')
@limiter.limit('20 per minute')
def checkout():
    """Place an order as the signed-in user in ONE transaction.

    Product rows are locked (FOR UPDATE, in id order so two checkouts cannot deadlock), prices come
    from the database, never the client, and any failure rolls everything back.
    """
    items, method, courier = parse_checkout(request.get_json(silent=True))
    today = datetime.date.today()
    delivery_date = today + datetime.timedelta(days=DELIVERY_DAYS)
    ids = sorted(items)

    with db() as cur:
        marks = ', '.join(['%s'] * len(ids))
        cur.execute(f'SELECT PRODUCT_ID, NAME, PRICE, STOCK FROM product WHERE PRODUCT_ID IN ({marks}) '
                    'ORDER BY PRODUCT_ID FOR UPDATE', ids)
        products = {row['PRODUCT_ID']: row for row in cur.fetchall()}

        lines, total = [], Decimal('0.00')
        for product_id in ids:
            product = products.get(product_id)
            if product is None:
                raise ApiError('A product in your cart is no longer available', 404)
            if product['STOCK'] < items[product_id]:
                left = product['STOCK']
                raise ApiError(f"Not enough stock for '{product['NAME']}'. "
                               + (f'Only {left} left.' if left else 'It is out of stock.'), 409)
            subtotal = product['PRICE'] * items[product_id]
            total += subtotal
            lines.append((items[product_id], subtotal, product_id))

        cur.execute('INSERT INTO orders (ORDER_DATE, STATUS, TOTAL, USER_ID) VALUES (%s, %s, %s, %s)',
                    (today, 'Pending', total, g.user_id))
        order_id = cur.lastrowid
        # Each insert fires the reduce_stock_after_insert trigger.
        cur.executemany('INSERT INTO order_item (QUANTITY, SUBTOTAL, ORDER_ID, PRODUCT_ID) VALUES (%s, %s, %s, %s)',
                        [(qty, sub, order_id, pid) for qty, sub, pid in lines])
        cur.execute('INSERT INTO payment (METHOD, STATUS, PAYMENT_DATE, ORDER_ID) VALUES (%s, %s, %s, %s)',
                    (method, 'Pending', today, order_id))
        receipt_no = cur.lastrowid
        if method != CASH_ON_DELIVERY:
            # Demo payment gateway: it always approves. The sync_order_status_after_update trigger
            # then moves the order from Pending to Paid.
            cur.execute("UPDATE payment SET STATUS = 'Success' WHERE RECEIPT_NO = %s", (receipt_no,))
        cur.execute('INSERT INTO delivery (DELIVERY_DATE, SHIPMENT_NAME, ORDER_ID) VALUES (%s, %s, %s)',
                    (delivery_date, courier, order_id))
        shipment_id = cur.lastrowid
        cur.execute('SELECT STATUS FROM orders WHERE ORDER_ID = %s', (order_id,))
        status = cur.fetchone()['STATUS']

    return jsonify({'message': 'Order placed', 'order': {
        'order_id': order_id, 'order_date': today, 'total': total, 'status': status,
        'receipt_no': receipt_no, 'payment_method': method, 'shipment_id': shipment_id,
        'shipment_name': courier, 'estimated_delivery': delivery_date}}), 201


@bp.get('/orders')
@require_auth('user')
def my_orders():
    """The signed-in user's orders, newest first (two queries total, not one per order)."""
    with db() as cur:
        cur.execute("""
            SELECT o.ORDER_ID AS order_id, o.ORDER_DATE AS order_date, o.STATUS AS status, o.TOTAL AS total,
                   p.RECEIPT_NO AS receipt_no, p.METHOD AS payment_method, p.STATUS AS payment_status,
                   d.SHIPMENT_ID AS shipment_id, d.DELIVERY_DATE AS delivery_date, d.SHIPMENT_NAME AS shipment_name
            FROM orders o
            LEFT JOIN payment p ON p.ORDER_ID = o.ORDER_ID
            LEFT JOIN delivery d ON d.ORDER_ID = o.ORDER_ID
            WHERE o.USER_ID = %s ORDER BY o.ORDER_ID DESC LIMIT 100
        """, (g.user_id,))
        orders = cur.fetchall()
        by_id = {order['order_id']: {**order, 'items': []} for order in orders}
        if by_id:
            marks = ', '.join(['%s'] * len(by_id))
            cur.execute(f"""
                SELECT oi.ORDER_ID AS order_id, oi.ORDER_ITEM_ID AS order_item_id, oi.QUANTITY AS quantity,
                       oi.SUBTOTAL AS subtotal, pr.NAME AS product_name, oi.SUBTOTAL / oi.QUANTITY AS price
                FROM order_item oi JOIN product pr ON pr.PRODUCT_ID = oi.PRODUCT_ID
                WHERE oi.ORDER_ID IN ({marks}) ORDER BY oi.ORDER_ITEM_ID
            """, list(by_id))
            for item in cur.fetchall():
                by_id[item['order_id']]['items'].append(item)
    return jsonify(list(by_id.values()))
