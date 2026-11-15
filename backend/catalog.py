from flask import Blueprint, jsonify, request

from db import db
from validators import (COURIERS, MAX_QTY_PER_ITEM, PAYMENT_METHODS, ApiError, like_pattern,
                        parse_product_query)

bp = Blueprint('catalog', __name__, url_prefix='/api')

PRODUCT_COLUMNS = """
    p.PRODUCT_ID AS product_id, p.NAME AS name, p.PRICE AS price, p.STOCK AS stock,
    p.DETAILS AS details, p.CATEGORY_ID AS category_id, c.NAME AS category_name, p.IMAGE_URL AS image_url
"""
PRODUCT_FROM = 'FROM product p LEFT JOIN category c ON c.CATEGORY_ID = p.CATEGORY_ID'


def customer_view(product):
    """What shoppers may see: a stock tier and a per-order cap, never the exact stock count."""
    stock = product.pop('stock')
    if stock > 10:
        label, tier = 'In stock', 'high'
    elif stock >= 4:
        label, tier = f'Only {stock} left', 'medium'
    elif stock >= 1:
        label, tier = f'Only {stock} left', 'low'
    else:
        label, tier = 'Out of stock', 'out'
    return {**product, 'stock_display': label, 'stock_tier': tier, 'in_stock': stock > 0,
            'max_qty': min(stock, MAX_QTY_PER_ITEM)}


@bp.get('/meta')
def meta():
    return jsonify({'couriers': COURIERS, 'payment_methods': PAYMENT_METHODS,
                    'max_qty_per_item': MAX_QTY_PER_ITEM})


@bp.get('/categories')
def categories():
    with db() as cur:
        cur.execute('SELECT CATEGORY_ID AS category_id, NAME AS name FROM category ORDER BY CATEGORY_ID')
        return jsonify(cur.fetchall())


@bp.get('/products')
def products():
    q = parse_product_query(request.args)
    where, params = [], []
    if q['category_id']:
        where.append('p.CATEGORY_ID = %s')
        params.append(q['category_id'])
    if q['search']:
        where.append('(p.NAME LIKE %s OR p.DETAILS LIKE %s)')
        params += [like_pattern(q['search'])] * 2
    if q['min_price'] is not None:
        where.append('p.PRICE >= %s')
        params.append(q['min_price'])
    if q['max_price'] is not None:
        where.append('p.PRICE <= %s')
        params.append(q['max_price'])
    clause = ('WHERE ' + ' AND '.join(where)) if where else ''
    with db() as cur:
        cur.execute(f'SELECT COUNT(*) AS total {PRODUCT_FROM} {clause}', params)
        total = cur.fetchone()['total']
        # q['sort'] comes from the PRODUCT_SORTS allow-list, never from the client string.
        cur.execute(f'SELECT {PRODUCT_COLUMNS} {PRODUCT_FROM} {clause} ORDER BY {q["sort"]} LIMIT %s OFFSET %s',
                    params + [q['limit'], q['offset']])
        items = [customer_view(row) for row in cur.fetchall()]
    return jsonify({'items': items, 'total': total})


@bp.get('/products/<int:product_id>')
def product_detail(product_id):
    with db() as cur:
        cur.execute(f'SELECT {PRODUCT_COLUMNS} {PRODUCT_FROM} WHERE p.PRODUCT_ID = %s', (product_id,))
        row = cur.fetchone()
    if row is None:
        raise ApiError('Product not found', 404)
    return jsonify(customer_view(row))
