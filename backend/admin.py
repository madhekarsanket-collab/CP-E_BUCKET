from flask import Blueprint, jsonify, request

from auth import authenticate
from catalog import PRODUCT_COLUMNS, PRODUCT_FROM
from db import IntegrityError, db
from validators import ApiError, parse_product, parse_status

bp = Blueprint('admin', __name__, url_prefix='/api/admin')

LIST_LIMIT = 200


@bp.before_request
def _admin_only():
    """Every route in this blueprint needs a valid admin token (CORS preflights carry none)."""
    if request.method != 'OPTIONS':
        authenticate('admin')


@bp.get('/metrics')
def metrics():
    with db() as cur:
        cur.execute('SELECT COUNT(*) AS n FROM userr')
        customers = cur.fetchone()['n']
        cur.execute('SELECT COUNT(*) AS n FROM product')
        products = cur.fetchone()['n']
        # Revenue = money actually received: a successful payment on an order that was not cancelled.
        cur.execute("SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN o.STATUS <> 'Cancelled' AND EXISTS ("
                    "SELECT 1 FROM payment p WHERE p.ORDER_ID = o.ORDER_ID AND p.STATUS = 'Success') "
                    'THEN o.TOTAL END), 0) AS revenue FROM orders o')
        orders = cur.fetchone()
        cur.execute('SELECT COUNT(*) AS n FROM product WHERE STOCK <= 5')
        low_stock = cur.fetchone()['n']
    return jsonify({'total_customers': customers, 'total_products': products, 'total_orders': orders['n'],
                    'total_revenue': orders['revenue'], 'low_stock_products': low_stock})


@bp.get('/customers')
def customers():
    with db() as cur:
        cur.execute('SELECT USER_ID AS user_id, Name AS name, DOB AS dob, EMAIL AS email, PHONE_NO AS phone, '
                    'ADDRESS AS address FROM userr ORDER BY USER_ID DESC LIMIT %s', (LIST_LIMIT,))
        return jsonify(cur.fetchall())


@bp.get('/orders')
def orders():
    with db() as cur:
        cur.execute("""
            SELECT o.ORDER_ID AS order_id, o.ORDER_DATE AS order_date, o.STATUS AS status, o.TOTAL AS total,
                   o.USER_ID AS user_id, u.Name AS user_name, p.RECEIPT_NO AS receipt_no,
                   p.METHOD AS payment_method, p.STATUS AS payment_status,
                   d.SHIPMENT_ID AS shipment_id, d.SHIPMENT_NAME AS shipment_name, d.DELIVERY_DATE AS delivery_date
            FROM orders o
            LEFT JOIN userr u ON u.USER_ID = o.USER_ID
            LEFT JOIN payment p ON p.ORDER_ID = o.ORDER_ID
            LEFT JOIN delivery d ON d.ORDER_ID = o.ORDER_ID
            ORDER BY o.ORDER_ID DESC LIMIT %s
        """, (LIST_LIMIT,))
        return jsonify(cur.fetchall())


@bp.patch('/orders/<int:order_id>/status')
def update_order_status(order_id):
    status = parse_status(request.get_json(silent=True))
    with db() as cur:
        cur.execute('SELECT STATUS FROM orders WHERE ORDER_ID = %s FOR UPDATE', (order_id,))
        row = cur.fetchone()
        if row is None:
            raise ApiError('Order not found', 404)
        if row['STATUS'] == 'Cancelled' and status != 'Cancelled':
            # Cancelling returned the stock to the shelf; reviving the order would oversell it.
            raise ApiError('A cancelled order cannot be reopened', 409)
        cur.execute('UPDATE orders SET STATUS = %s WHERE ORDER_ID = %s', (status, order_id))
        if status == 'Delivered':
            # Cash on delivery is collected at the door. The payment trigger leaves Delivered alone.
            cur.execute("UPDATE payment SET STATUS = 'Success' WHERE ORDER_ID = %s AND STATUS = 'Pending'", (order_id,))
    return jsonify({'message': f'Order #{order_id} is now {status}'})


@bp.get('/products')
def list_products():
    """Unlike the public endpoint, this returns exact stock counts."""
    with db() as cur:
        cur.execute(f'SELECT {PRODUCT_COLUMNS} {PRODUCT_FROM} ORDER BY p.PRODUCT_ID')
        return jsonify(cur.fetchall())


def _save_product(cur, product, product_id=None):
    cur.execute('SELECT 1 FROM category WHERE CATEGORY_ID = %s', (product['category_id'],))
    if cur.fetchone() is None:
        raise ApiError('That category does not exist')
    values = (product['name'], product['price'], product['stock'], product['details'], product['category_id'],
              product['image_url'])
    if product_id is None:
        cur.execute('INSERT INTO product (NAME, PRICE, STOCK, DETAILS, CATEGORY_ID, IMAGE_URL) '
                    'VALUES (%s, %s, %s, %s, %s, %s)', values)
        return cur.lastrowid
    cur.execute('SELECT 1 FROM product WHERE PRODUCT_ID = %s', (product_id,))
    if cur.fetchone() is None:
        raise ApiError('Product not found', 404)
    cur.execute('UPDATE product SET NAME = %s, PRICE = %s, STOCK = %s, DETAILS = %s, CATEGORY_ID = %s, '
                'IMAGE_URL = %s WHERE PRODUCT_ID = %s', values + (product_id,))
    return product_id


@bp.post('/products')
def add_product():
    product = parse_product(request.get_json(silent=True))
    with db() as cur:
        product_id = _save_product(cur, product)
    return jsonify({'message': 'Product created', 'product_id': product_id}), 201


@bp.put('/products/<int:product_id>')
def update_product(product_id):
    product = parse_product(request.get_json(silent=True))
    with db() as cur:
        _save_product(cur, product, product_id)
    return jsonify({'message': f'Product #{product_id} updated'})


@bp.delete('/products/<int:product_id>')
def delete_product(product_id):
    try:
        with db() as cur:
            cur.execute('DELETE FROM product WHERE PRODUCT_ID = %s', (product_id,))
            if cur.rowcount == 0:
                raise ApiError('Product not found', 404)
    except IntegrityError:
        raise ApiError('This product appears in past orders, so it cannot be deleted. Set its stock to 0 instead.', 409)
    return jsonify({'message': f'Product #{product_id} deleted'})
