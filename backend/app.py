import os
import hmac
import datetime
from decimal import Decimal
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

from db import get_db_connection
from security import hash_new_password, verify_password

load_dotenv()

app = Flask(__name__, static_folder="../frontend", static_url_path="")
CORS(app)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'ebucket_secret_2026')

def get_next_id(cursor, table_name, id_column):
    """Safely calculates the next INT primary key."""
    cursor.execute(f"SELECT COALESCE(MAX(`{id_column}`), 0) + 1 FROM `{table_name}`")
    return cursor.fetchone()[0]

def serialize_row(col_names, row):
    if not row:
        return None
    d = {}
    for col, val in zip(col_names, row):
        if isinstance(val, (datetime.date, datetime.datetime)):
            d[col] = val.isoformat()
        elif isinstance(val, Decimal):
            d[col] = float(val)
        else:
            d[col] = val
    return d

def format_customer_product(prod_dict):
    """
    Applies customer-side stock visibility rules:
    - > 10: 'In Stock' (exact stock hidden from customer)
    - 4 to 10: 'Only X left!'
    - 1 to 3: 'Only X left!'
    - 0: 'Out of Stock'
    Exact stock is still passed as internal integer for frontend cart limits and checkout validation,
    while presentation fields provide the required text and colour code.
    """
    stock = prod_dict.get('stock', 0)
    p = dict(prod_dict)
    if stock > 10:
        p['stock_display'] = 'In Stock'
        p['stock_tier'] = 'high'  # Green
        p['in_stock'] = True
    elif stock >= 4:
        p['stock_display'] = f"Only {stock} left!"
        p['stock_tier'] = 'medium'  # Yellow/Orange
        p['in_stock'] = True
    elif stock >= 1:
        p['stock_display'] = f"Only {stock} left!"
        p['stock_tier'] = 'low'  # Red
        p['in_stock'] = True
    else:
        p['stock_display'] = 'Out of Stock'
        p['stock_tier'] = 'out'  # Red
        p['in_stock'] = False
    return p

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "service": "E-Bucket Flask API"}), 200

# ----------------- AUTHENTICATION -----------------
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '').strip()
    dob = data.get('dob') or '2000-01-01'
    phone = data.get('phone', 0)
    address = data.get('address', '').strip() or 'Default Address'

    if not name or not email or not password:
        return jsonify({"error": "Name, email, and password are required"}), 400

    try:
        phone_int = int(phone) if str(phone).isdigit() else 9999999999
    except Exception:
        phone_int = 9999999999

    hashed_pw = hash_new_password(password)

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT USER_ID FROM userr WHERE EMAIL = %s", (email,))
        if cursor.fetchone():
            return jsonify({"error": "User with this email already exists"}), 409

        user_id = get_next_id(cursor, 'userr', 'USER_ID')
        cursor.execute(
            """
            INSERT INTO userr (USER_ID, Name, PASS, DOB, EMAIL, PHONE_NO, ADDRESS)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (user_id, name, hashed_pw, dob, email, phone_int, address)
        )
        conn.commit()
        return jsonify({
            "message": "Registration successful",
            "user": {
                "user_id": user_id,
                "name": name,
                "email": email,
                "phone": phone_int,
                "address": address
            }
        }), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip()
    password = data.get('password', '').strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT USER_ID, Name, PASS, DOB, EMAIL, PHONE_NO, ADDRESS FROM userr WHERE EMAIL = %s",
            (email,)
        )
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Invalid email or password"}), 401

        user_id, name, stored_pw, dob, email_db, phone, address = row
        if not verify_password(stored_pw, password):
            return jsonify({"error": "Invalid email or password"}), 401

        # Upgrade-on-Login: If legacy plaintext password, upgrade to salted PBKDF2 hash
        if not stored_pw.startswith("p2$"):
            try:
                new_hash = hash_new_password(password)
                cursor.execute(
                    "UPDATE userr SET PASS = %s WHERE USER_ID = %s",
                    (new_hash, user_id)
                )
                conn.commit()
            except Exception as update_err:
                conn.rollback()
                print(f"Warning: Failed to upgrade password for USER_ID={user_id}: {update_err}")

        return jsonify({
            "message": "Login successful",
            "user": {
                "user_id": user_id,
                "name": name,
                "email": email_db,
                "dob": dob.isoformat() if dob else None,
                "phone": phone,
                "address": address
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/auth/admin-login', methods=['POST'])
def admin_login():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    admin_user = os.getenv('ADMIN_USERNAME', '').strip()
    admin_pass = os.getenv('ADMIN_PASSWORD', '').strip()

    if not admin_user or not admin_pass:
        return jsonify({"error": "Admin credentials not configured"}), 500

    if not username or not password:
        return jsonify({"error": "Invalid admin credentials"}), 401

    # Constant-time comparison to prevent timing side-channels
    user_match = hmac.compare_digest(username.lower(), admin_user.lower())
    pass_match = hmac.compare_digest(password, admin_pass)

    if user_match and pass_match:
        return jsonify({
            "message": "Admin authenticated successfully",
            "admin": {"username": admin_user, "role": "ADMIN", "name": "E-Bucket Admin"}
        }), 200

    return jsonify({"error": "Invalid admin credentials"}), 401

# ----------------- CATEGORIES & PRODUCTS -----------------
@app.route('/api/categories', methods=['GET'])
def get_categories():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT CATEGORY_ID, NAME FROM category ORDER BY CATEGORY_ID ASC")
        rows = cursor.fetchall()
        categories = [{"category_id": r[0], "name": r[1]} for r in rows]
        return jsonify(categories), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/products', methods=['GET'])
def get_products():
    category_id = request.args.get('category_id')
    search = request.args.get('search', '').strip()

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        query = """
            SELECT p.PRODUCT_ID, p.NAME, p.PRICE, p.STOCK, p.DETAILS, p.CATEGORY_ID, c.NAME as CATEGORY_NAME
            FROM product p
            LEFT JOIN category c ON p.CATEGORY_ID = c.CATEGORY_ID
            WHERE 1=1
        """
        params = []
        if category_id:
            query += " AND p.CATEGORY_ID = %s"
            params.append(category_id)
        if search:
            query += " AND (p.NAME LIKE %s OR p.DETAILS LIKE %s)"
            params.extend([f"%{search}%", f"%{search}%"])

        query += " ORDER BY p.PRODUCT_ID ASC"
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        cols = ['product_id', 'name', 'price', 'stock', 'details', 'category_id', 'category_name']
        products = [format_customer_product(serialize_row(cols, r)) for r in rows]
        return jsonify(products), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product_detail(product_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT p.PRODUCT_ID, p.NAME, p.PRICE, p.STOCK, p.DETAILS, p.CATEGORY_ID, c.NAME as CATEGORY_NAME
            FROM product p
            LEFT JOIN category c ON p.CATEGORY_ID = c.CATEGORY_ID
            WHERE p.PRODUCT_ID = %s
        """, (product_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Product not found"}), 404
        cols = ['product_id', 'name', 'price', 'stock', 'details', 'category_id', 'category_name']
        return jsonify(format_customer_product(serialize_row(cols, row))), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

# ----------------- CHECKOUT & ORDERS -----------------
@app.route('/api/checkout', methods=['POST'])
def checkout():
    """
    Checkout with MySQL Transactions:
    1. Validate customer & stock availability.
    2. Insert record into ORDERS.
    3. Insert records into ORDER_ITEM (Stock is automatically reduced by MySQL trigger).
    4. Insert record into PAYMENT.
    5. Insert record into DELIVERY.
    6. Roll back entirely if any error occurs.
    """
    data = request.get_json() or {}
    user_id = data.get('user_id')
    items = data.get('items', [])
    payment_method = data.get('payment_method', 'UPI')
    shipment_name = data.get('shipment_name', 'BlueDart Express')

    if not user_id or not items:
        return jsonify({"error": "User ID and cart items are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Verify user exists
        cursor.execute("SELECT USER_ID FROM userr WHERE USER_ID = %s", (user_id,))
        if not cursor.fetchone():
            return jsonify({"error": "User not found"}), 404

        # Validate stock for all items
        total_calculated = Decimal('0.00')
        validated_items = []
        for item in items:
            pid = item.get('product_id')
            qty = int(item.get('quantity', 1))
            if qty <= 0:
                return jsonify({"error": f"Invalid quantity {qty} for product {pid}"}), 400

            cursor.execute("SELECT PRODUCT_ID, NAME, PRICE, STOCK FROM product WHERE PRODUCT_ID = %s", (pid,))
            prod = cursor.fetchone()
            if not prod:
                return jsonify({"error": f"Product ID {pid} not found"}), 404

            p_id, p_name, p_price, p_stock = prod
            if p_stock < qty:
                return jsonify({
                    "error": f"Insufficient stock for '{p_name}'. Available: {p_stock}, Requested: {qty}"
                }), 400

            subtotal = Decimal(str(p_price)) * Decimal(str(qty))
            total_calculated += subtotal
            validated_items.append({
                "product_id": p_id,
                "quantity": qty,
                "subtotal": subtotal
            })

        # 1. Insert into ORDERS
        order_id = get_next_id(cursor, 'orders', 'ORDER_ID')
        order_date = datetime.date.today()
        order_status = 'Pending'
        cursor.execute(
            """
            INSERT INTO orders (ORDER_ID, ORDER_DATE, STATUS, TOTAL, USER_ID)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (order_id, order_date, order_status, total_calculated, user_id)
        )

        # 2. Insert into ORDER_ITEM
        # Note: MySQL AFTER INSERT trigger 'reduce_stock_after_insert' automatically deducts stock!
        for v_item in validated_items:
            order_item_id = get_next_id(cursor, 'order_item', 'ORDER_ITEM_ID')
            cursor.execute(
                """
                INSERT INTO order_item (ORDER_ITEM_ID, QUANTITY, SUBTOTAL, ORDER_ID, PRODUCT_ID)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (order_item_id, v_item['quantity'], v_item['subtotal'], order_id, v_item['product_id'])
            )

        # 3. Insert into PAYMENT
        receipt_no = get_next_id(cursor, 'payment', 'RECEIPT_NO')
        payment_date = datetime.date.today()
        # Initial status for simulated payment
        payment_status = 'Success'
        cursor.execute(
            """
            INSERT INTO payment (RECEIPT_NO, METHOD, STATUS, PAYMENT_DATE, ORDER_ID)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (receipt_no, payment_method, payment_status, payment_date, order_id)
        )

        # 4. Insert into DELIVERY
        shipment_id = get_next_id(cursor, 'delivery', 'SHIPMENT_ID')
        delivery_date = datetime.date.today() + datetime.timedelta(days=4)
        cursor.execute(
            """
            INSERT INTO delivery (SHIPMENT_ID, DELIVERY_DATE, SHIPMENT_NAME, ORDER_ID)
            VALUES (%s, %s, %s, %s)
            """,
            (shipment_id, delivery_date, shipment_name, order_id)
        )

        # Trigger sync_order_status_after_update fires if payment is updated,
        # but let's ensure order reflects 'Paid' since simulated payment was successful:
        cursor.execute("UPDATE orders SET STATUS = 'Paid' WHERE ORDER_ID = %s", (order_id,))

        conn.commit()

        return jsonify({
            "message": "Order placed successfully!",
            "order": {
                "order_id": order_id,
                "order_date": order_date.isoformat(),
                "total": float(total_calculated),
                "status": "Paid",
                "receipt_no": receipt_no,
                "payment_method": payment_method,
                "shipment_id": shipment_id,
                "shipment_name": shipment_name,
                "estimated_delivery": delivery_date.isoformat()
            }
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Checkout failed: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

# ----------------- ORDER HISTORY -----------------
@app.route('/api/orders/user/<int:user_id>', methods=['GET'])
def get_user_orders(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT o.ORDER_ID, o.ORDER_DATE, o.STATUS, o.TOTAL,
                   p.RECEIPT_NO, p.METHOD, p.STATUS as PAYMENT_STATUS,
                   d.SHIPMENT_ID, d.DELIVERY_DATE, d.SHIPMENT_NAME
            FROM orders o
            LEFT JOIN payment p ON o.ORDER_ID = p.ORDER_ID
            LEFT JOIN delivery d ON o.ORDER_ID = d.ORDER_ID
            WHERE o.USER_ID = %s
            ORDER BY o.ORDER_ID DESC
        """, (user_id,))
        rows = cursor.fetchall()
        orders = []
        for r in rows:
            order_id = r[0]
            # Fetch items
            cursor.execute("""
                SELECT oi.ORDER_ITEM_ID, oi.QUANTITY, oi.SUBTOTAL, pr.NAME, pr.PRICE
                FROM order_item oi
                JOIN product pr ON oi.PRODUCT_ID = pr.PRODUCT_ID
                WHERE oi.ORDER_ID = %s
            """, (order_id,))
            item_rows = cursor.fetchall()
            items = [{
                "order_item_id": ir[0],
                "quantity": ir[1],
                "subtotal": float(ir[2]) if ir[2] else 0.0,
                "product_name": ir[3],
                "price": float(ir[4]) if ir[4] else 0.0
            } for ir in item_rows]

            orders.append({
                "order_id": r[0],
                "order_date": r[1].isoformat() if r[1] else None,
                "status": r[2],
                "total": float(r[3]) if r[3] else 0.0,
                "receipt_no": r[4],
                "payment_method": r[5],
                "payment_status": r[6],
                "shipment_id": r[7],
                "delivery_date": r[8].isoformat() if r[8] else None,
                "shipment_name": r[9],
                "items": items
            })
        return jsonify(orders), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

# ----------------- ADMIN DASHBOARD APIS -----------------
@app.route('/api/admin/metrics', methods=['GET'])
def admin_metrics():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT COUNT(*) FROM userr")
        total_customers = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM product")
        total_products = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*), COALESCE(SUM(TOTAL), 0) FROM orders")
        orders_row = cursor.fetchone()
        total_orders = orders_row[0]
        total_revenue = float(orders_row[1])

        return jsonify({
            "total_customers": total_customers,
            "total_products": total_products,
            "total_orders": total_orders,
            "total_revenue": total_revenue
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/customers', methods=['GET'])
def admin_customers():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT USER_ID, Name, DOB, EMAIL, PHONE_NO, ADDRESS FROM userr ORDER BY USER_ID DESC")
        rows = cursor.fetchall()
        cols = ['user_id', 'name', 'dob', 'email', 'phone', 'address']
        return jsonify([serialize_row(cols, r) for r in rows]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/orders', methods=['GET'])
def admin_orders():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT o.ORDER_ID, o.ORDER_DATE, o.STATUS, o.TOTAL, o.USER_ID, u.Name as USER_NAME,
                   p.RECEIPT_NO, p.METHOD as PAYMENT_METHOD, p.STATUS as PAYMENT_STATUS,
                   d.SHIPMENT_ID, d.SHIPMENT_NAME, d.DELIVERY_DATE
            FROM orders o
            LEFT JOIN userr u ON o.USER_ID = u.USER_ID
            LEFT JOIN payment p ON o.ORDER_ID = p.ORDER_ID
            LEFT JOIN delivery d ON o.ORDER_ID = d.ORDER_ID
            ORDER BY o.ORDER_ID DESC
        """)
        rows = cursor.fetchall()
        cols = ['order_id', 'order_date', 'status', 'total', 'user_id', 'user_name',
                'receipt_no', 'payment_method', 'payment_status', 'shipment_id', 'shipment_name', 'delivery_date']
        return jsonify([serialize_row(cols, r) for r in rows]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/orders/<int:order_id>/status', methods=['PATCH'])
def update_order_status(order_id):
    data = request.get_json() or {}
    new_status = data.get('status')
    if not new_status:
        return jsonify({"error": "Status required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE orders SET STATUS = %s WHERE ORDER_ID = %s", (new_status, order_id))
        conn.commit()
        return jsonify({"message": f"Order #{order_id} status updated to {new_status}"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/products', methods=['GET'])
def admin_get_products():
    """Admin endpoint returning exact raw stock numbers for every product."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT p.PRODUCT_ID, p.NAME, p.PRICE, p.STOCK, p.DETAILS, p.CATEGORY_ID, c.NAME as CATEGORY_NAME
            FROM product p
            LEFT JOIN category c ON p.CATEGORY_ID = c.CATEGORY_ID
            ORDER BY p.PRODUCT_ID ASC
        """)
        rows = cursor.fetchall()
        cols = ['product_id', 'name', 'price', 'stock', 'details', 'category_id', 'category_name']
        return jsonify([serialize_row(cols, r) for r in rows]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/products', methods=['POST'])
def admin_add_product():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    price = data.get('price')
    stock = data.get('stock', 0)
    details = data.get('details', '').strip()
    category_id = data.get('category_id')

    if not name or price is None or not category_id:
        return jsonify({"error": "Name, price and category_id are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        pid = get_next_id(cursor, 'product', 'PRODUCT_ID')
        cursor.execute(
            """
            INSERT INTO product (PRODUCT_ID, NAME, PRICE, STOCK, DETAILS, CATEGORY_ID)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (pid, name, price, stock, details, category_id)
        )
        conn.commit()
        return jsonify({"message": "Product created successfully", "product_id": pid}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/products/<int:product_id>', methods=['PUT'])
def admin_update_product(product_id):
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    price = data.get('price')
    stock = data.get('stock')
    details = data.get('details', '').strip()
    category_id = data.get('category_id')

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            UPDATE product
            SET NAME = %s, PRICE = %s, STOCK = %s, DETAILS = %s, CATEGORY_ID = %s
            WHERE PRODUCT_ID = %s
            """,
            (name, price, stock, details, category_id, product_id)
        )
        conn.commit()
        return jsonify({"message": f"Product #{product_id} updated successfully"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/admin/products/<int:product_id>', methods=['DELETE'])
def admin_delete_product(product_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check if product is in order_item to provide clean error if foreign key prevents deletion
        cursor.execute("SELECT COUNT(*) FROM order_item WHERE PRODUCT_ID = %s", (product_id,))
        count = cursor.fetchone()[0]
        if count > 0:
            return jsonify({
                "error": f"Cannot delete Product #{product_id}: it is referenced in {count} order item(s). Consider updating stock to 0 instead."
            }), 409

        cursor.execute("DELETE FROM product WHERE PRODUCT_ID = %s", (product_id,))
        conn.commit()
        return jsonify({"message": f"Product #{product_id} deleted successfully"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

# ----------------- SERVE FRONTEND SPA -----------------
@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    print(f"Starting E-Bucket Flask Backend on http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)

