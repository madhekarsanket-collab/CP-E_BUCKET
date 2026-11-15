import threading

import auth
import db
from tests.conftest import DEMO_EMAIL, DEMO_PASSWORD, bearer_from_session, sign_in, stock_of

NEW_USER = {'name': 'Kabir Shah', 'email': 'kabir@example.com', 'password': 'a-strong-pass',
            'phone': '9811122233', 'dob': '1997-02-03', 'address': '9 Hill Road, Mumbai'}


def checkout(client, headers, items, **extra):
    return client.post('/api/checkout', json={'items': items, **extra}, headers=headers)


# ---------- plumbing ----------
def test_health_and_security_headers(client):
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.headers['X-Content-Type-Options'] == 'nosniff'
    assert response.headers['X-Frame-Options'] == 'DENY'
    assert "script-src 'self'" in response.headers['Content-Security-Policy']


def test_unknown_api_route_is_json_404(client):
    response = client.get('/api/nope')
    assert response.status_code == 404 and 'error' in response.get_json()


def test_unexpected_errors_do_not_leak_details(client, monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError('password=hunter2 host=10.0.0.5')
    monkeypatch.setattr('catalog.db', boom)
    response = client.get('/api/categories')
    assert response.status_code == 500
    assert 'hunter2' not in response.get_data(as_text=True)


# ---------- catalogue ----------
def test_products_hide_exact_stock_but_show_tiers(client):
    body = client.get('/api/products?limit=100').get_json()
    assert body['total'] == 32 and len(body['items']) == 32
    assert all('stock' not in item for item in body['items'])
    by_name = {item['name']: item for item in body['items']}
    assert by_name['Foam Roller 45 cm']['stock_tier'] == 'out' and not by_name['Foam Roller 45 cm']['in_stock']
    assert by_name['Aroma Diffuser with LED Light']['stock_display'] == 'Only 2 left'
    assert by_name['Aroma Diffuser with LED Light']['max_qty'] == 2
    assert by_name['10000 mAh Power Bank']['stock_tier'] == 'high' and by_name['10000 mAh Power Bank']['max_qty'] == 10


def test_product_search_sort_filter_and_pagination(client):
    cheapest = client.get('/api/products?sort=price_asc&limit=3').get_json()
    assert [p['price'] for p in cheapest['items']] == sorted(p['price'] for p in cheapest['items'])
    assert cheapest['total'] == 32 and len(cheapest['items']) == 3
    guitar = client.get('/api/products?search=guitar').get_json()
    assert guitar['total'] == 1
    assert client.get('/api/products?category_id=2').get_json()['total'] == 5
    assert client.get('/api/products?min_price=5000&max_price=8000').get_json()['total'] > 0
    assert client.get('/api/products?search=%25').get_json()['total'] == 0  # '%' is literal, not a wildcard
    assert client.get('/api/products?limit=100000').status_code == 400
    assert client.get('/api/products/9999').status_code == 404


# ---------- auth ----------
def test_register_then_login(client):
    created = client.post('/api/auth/register', json=NEW_USER)
    assert created.status_code == 201 and 'token' not in created.get_json()
    assert 'PASS' not in created.get_data(as_text=True)
    assert 'ebucket_session' in created.headers['Set-Cookie']
    assert bearer_from_session(client)
    with db.db() as cur:
        cur.execute('SELECT PASS FROM userr WHERE EMAIL = %s', (NEW_USER['email'],))
        assert cur.fetchone()['PASS'].startswith('scrypt:')
    assert sign_in(client, NEW_USER['email'], NEW_USER['password'])


def test_register_rejects_duplicates_and_weak_input(client):
    assert client.post('/api/auth/register', json=NEW_USER).status_code == 201
    assert client.post('/api/auth/register', json={**NEW_USER, 'email': 'KABIR@example.com'}).status_code == 409
    assert client.post('/api/auth/register', json={**NEW_USER, 'email': 'b@example.com', 'password': '123'}).status_code == 400
    assert client.post('/api/auth/register', json={**NEW_USER, 'email': 'c@example.com', 'phone': '123'}).status_code == 400
    assert client.post('/api/auth/register', data='not json', content_type='text/plain').status_code == 400


def test_login_failures_share_one_message(client):
    wrong_password = client.post('/api/auth/login', json={'email': DEMO_EMAIL, 'password': 'nope-nope'})
    unknown_user = client.post('/api/auth/login', json={'email': 'ghost@example.com', 'password': DEMO_PASSWORD})
    assert wrong_password.status_code == unknown_user.status_code == 401
    assert wrong_password.get_json() == unknown_user.get_json()


def test_legacy_plaintext_password_is_upgraded_on_login(client):
    with db.db() as cur:
        cur.execute("INSERT INTO userr (Name, PASS, EMAIL, PHONE_NO) VALUES ('Old User', 'plain-old-pass', 'old@example.com', 9000000000)")
    assert sign_in(client, 'old@example.com', 'plain-old-pass')
    with db.db() as cur:
        cur.execute("SELECT PASS FROM userr WHERE EMAIL = 'old@example.com'")
        assert cur.fetchone()['PASS'].startswith('scrypt:')
    assert sign_in(client, 'old@example.com', 'plain-old-pass')


def test_tampered_and_expired_tokens_are_rejected(client, user_headers, monkeypatch):
    assert client.get('/api/orders', headers=user_headers).status_code == 200
    bad = {'Authorization': user_headers['Authorization'][:-3] + 'abc'}
    assert client.get('/api/orders', headers=bad).status_code == 401
    monkeypatch.setitem(auth.TOKEN_TTL_SECONDS, 'user', -1)
    assert client.get('/api/orders', headers=user_headers).status_code == 401


def test_admin_login_checks_credentials(client):
    assert client.post('/api/auth/admin-login', json={'username': 'admin', 'password': 'wrong'}).status_code == 401
    assert client.post('/api/auth/admin-login', json={'username': 'admin'}).status_code == 400


# ---------- checkout ----------
def test_checkout_requires_sign_in(client):
    assert checkout(client, {}, [{'product_id': 1, 'quantity': 1}]).status_code == 401


def test_checkout_upi_pays_order_and_reduces_stock(client, user_headers):
    before = stock_of(1)
    response = checkout(client, user_headers, [{'product_id': 1, 'quantity': 2}], payment_method='UPI')
    order = response.get_json()['order']
    assert response.status_code == 201
    assert order['status'] == 'Paid' and order['total'] == 15998.0
    assert stock_of(1) == before - 2


def test_checkout_cash_on_delivery_stays_pending(client, user_headers):
    order = checkout(client, user_headers, [{'product_id': 2, 'quantity': 1}],
                     payment_method='Cash on Delivery').get_json()['order']
    assert order['status'] == 'Pending'


def test_checkout_merges_duplicate_lines_and_ignores_client_prices(client, user_headers):
    items = [{'product_id': 3, 'quantity': 1, 'price': 1}, {'product_id': 3, 'quantity': 2, 'price': 1}]
    order = checkout(client, user_headers, items).get_json()['order']
    assert order['total'] == 3 * 1299.0


def test_checkout_rolls_back_everything_when_one_item_lacks_stock(client, user_headers):
    before = (stock_of(1), stock_of(26))
    response = checkout(client, user_headers, [{'product_id': 1, 'quantity': 1}, {'product_id': 26, 'quantity': 5}])
    assert response.status_code == 409 and 'Aroma Diffuser' in response.get_json()['error']
    assert (stock_of(1), stock_of(26)) == before
    with db.db() as cur:
        cur.execute('SELECT COUNT(*) AS n FROM orders')
        assert cur.fetchone()['n'] == 8


def test_checkout_rejects_out_of_stock_unknown_and_oversized(client, user_headers):
    assert checkout(client, user_headers, [{'product_id': 15, 'quantity': 1}]).status_code == 409
    assert checkout(client, user_headers, [{'product_id': 9999, 'quantity': 1}]).status_code == 404
    assert checkout(client, user_headers, [{'product_id': 3, 'quantity': 11}]).status_code == 400
    assert checkout(client, user_headers, [{'product_id': 3, 'quantity': -1}]).status_code == 400


def test_two_buyers_racing_for_the_last_unit_get_one_order(client):
    with db.db() as cur:
        cur.execute('UPDATE product SET STOCK = 1 WHERE PRODUCT_ID = 3')
    headers = [sign_in(client), sign_in(client, 'aarav@example.com')]
    codes = []

    def buy(header):
        codes.append(checkout(client, header, [{'product_id': 3, 'quantity': 1}]).status_code)

    threads = [threading.Thread(target=buy, args=(h,)) for h in headers]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert sorted(codes) == [201, 409]
    assert stock_of(3) == 0


# ---------- orders ----------
def test_users_only_see_their_own_orders(client, user_headers):
    mine = client.get('/api/orders', headers=user_headers).get_json()
    assert {o['order_id'] for o in mine} == {5, 6}
    assert all(item['price'] > 0 for o in mine for item in o['items'])
    other = client.get('/api/orders', headers=sign_in(client, 'aarav@example.com')).get_json()
    assert {o['order_id'] for o in other} == {1, 8}
    assert client.get('/api/orders').status_code == 401


# ---------- admin ----------
def test_admin_routes_reject_missing_and_customer_tokens(client, user_headers):
    for path in ('/api/admin/metrics', '/api/admin/orders', '/api/admin/customers', '/api/admin/products'):
        assert client.get(path).status_code == 401
        assert client.get(path, headers=user_headers).status_code == 401
    assert client.post('/api/admin/products', json={}, headers=user_headers).status_code == 401


def test_admin_metrics_exclude_cancelled_and_unpaid_orders(client, admin_headers):
    metrics = client.get('/api/admin/metrics', headers=admin_headers).get_json()
    assert metrics['total_orders'] == 8 and metrics['total_customers'] == 5
    assert metrics['total_revenue'] == 10498 + 4647 + 8999 + 4999 + 6499 + 5398


def test_admin_sees_exact_stock(client, admin_headers):
    products = client.get('/api/admin/products', headers=admin_headers).get_json()
    assert len(products) == 32 and all('stock' in p for p in products)
    assert next(p for p in products if p['product_id'] == 3)['stock'] == 120


def test_cancelling_an_order_restores_stock_and_cannot_be_undone(client, user_headers, admin_headers):
    order_id = checkout(client, user_headers, [{'product_id': 1, 'quantity': 3}]).get_json()['order']['order_id']
    after_purchase = stock_of(1)
    cancel = client.patch(f'/api/admin/orders/{order_id}/status', json={'status': 'Cancelled'}, headers=admin_headers)
    assert cancel.status_code == 200 and stock_of(1) == after_purchase + 3
    reopen = client.patch(f'/api/admin/orders/{order_id}/status', json={'status': 'Paid'}, headers=admin_headers)
    assert reopen.status_code == 409
    client.patch(f'/api/admin/orders/{order_id}/status', json={'status': 'Cancelled'}, headers=admin_headers)
    assert stock_of(1) == after_purchase + 3  # cancelling twice must not add stock twice


def test_delivered_cod_order_collects_payment_without_reverting_status(client, user_headers, admin_headers):
    order_id = checkout(client, user_headers, [{'product_id': 2, 'quantity': 1}],
                        payment_method='Cash on Delivery').get_json()['order']['order_id']
    client.patch(f'/api/admin/orders/{order_id}/status', json={'status': 'Delivered'}, headers=admin_headers)
    row = next(o for o in client.get('/api/admin/orders', headers=admin_headers).get_json() if o['order_id'] == order_id)
    assert row['status'] == 'Delivered' and row['payment_status'] == 'Success'


def test_order_status_validation(client, admin_headers):
    assert client.patch('/api/admin/orders/1/status', json={'status': 'Teleported'}, headers=admin_headers).status_code == 400
    assert client.patch('/api/admin/orders/999/status', json={'status': 'Paid'}, headers=admin_headers).status_code == 404


def test_admin_product_crud_and_validation(client, admin_headers):
    new = {'name': 'Desk Lamp', 'price': 899.5, 'stock': 12, 'details': 'Warm LED lamp', 'category_id': 6}
    created = client.post('/api/admin/products', json=new, headers=admin_headers)
    product_id = created.get_json()['product_id']
    assert created.status_code == 201
    assert client.put(f'/api/admin/products/{product_id}', json={**new, 'stock': 3}, headers=admin_headers).status_code == 200
    assert stock_of(product_id) == 3
    assert client.put('/api/admin/products/9999', json=new, headers=admin_headers).status_code == 404
    for bad in ({**new, 'price': -1}, {**new, 'stock': -4}, {**new, 'name': ''}, {**new, 'category_id': 999}, {**new, 'price': 'abc'}):
        assert client.post('/api/admin/products', json=bad, headers=admin_headers).status_code == 400
    assert client.delete(f'/api/admin/products/{product_id}', headers=admin_headers).status_code == 200
    assert client.delete(f'/api/admin/products/{product_id}', headers=admin_headers).status_code == 404


def test_product_in_past_orders_cannot_be_deleted(client, admin_headers):
    response = client.delete('/api/admin/products/1', headers=admin_headers)
    assert response.status_code == 409 and 'past orders' in response.get_json()['error']


# ---------- cookie session + CSRF ----------
def test_session_cookie_is_httponly_and_me_endpoint_reports_it(client):
    login = client.post('/api/auth/login', json={'email': DEMO_EMAIL, 'password': DEMO_PASSWORD})
    cookie = login.headers['Set-Cookie']
    assert 'HttpOnly' in cookie and 'SameSite=Lax' in cookie and 'Path=/api' in cookie
    assert 'token' not in login.get_json()
    me = client.get('/api/auth/me').get_json()
    assert me['role'] == 'user' and me['user']['email'] == DEMO_EMAIL
    assert client.get('/api/orders').status_code == 200  # the cookie alone authenticates the browser
    client.post('/api/auth/logout')
    assert client.get('/api/auth/me').get_json() == {'role': None}
    assert client.get('/api/orders').status_code == 401


def test_admin_cookie_session(client):
    client.post('/api/auth/admin-login', json={'username': 'admin', 'password': 'correct horse battery staple'})
    assert client.get('/api/auth/me').get_json()['role'] == 'admin'
    assert client.get('/api/admin/metrics').status_code == 200
    assert client.get('/api/orders').status_code == 401  # an admin session is not a customer session


def test_state_changing_requests_without_the_anti_forgery_header_are_blocked(client):
    forged = client.application.test_client()  # like a cross-site form post: no custom header
    response = forged.post('/api/auth/login', json={'email': DEMO_EMAIL, 'password': DEMO_PASSWORD})
    assert response.status_code == 403
    client.post('/api/auth/login', json={'email': DEMO_EMAIL, 'password': DEMO_PASSWORD})
    cookie = client.get_cookie('ebucket_session', path='/api').value
    forged.set_cookie('ebucket_session', cookie, path='/api')
    blocked = forged.post('/api/checkout', json={'items': [{'product_id': 3, 'quantity': 1}]})
    assert blocked.status_code == 403
    assert forged.get('/api/orders').status_code == 200  # reads are safe methods


# ---------- product images ----------
def test_products_expose_image_urls_and_the_skipping_rope_has_none(client):
    items = client.get('/api/products?limit=100').get_json()['items']
    by_name = {item['name']: item for item in items}
    assert by_name['Acoustic Guitar (Dreadnought)']['image_url'] == '/products/6.jpg'
    assert by_name['Smart Skipping Rope']['image_url'] is None


def test_admin_can_set_an_image_but_only_safe_urls(client, admin_headers):
    base = {'name': 'Desk Lamp', 'price': 899, 'stock': 5, 'details': 'Lamp', 'category_id': 6}
    ok = client.post('/api/admin/products', json={**base, 'image_url': 'https://example.com/lamp.jpg'}, headers=admin_headers)
    assert ok.status_code == 201
    shown = client.get(f"/api/products/{ok.get_json()['product_id']}").get_json()
    assert shown['image_url'] == 'https://example.com/lamp.jpg'
    for bad in ('javascript:alert(1)', 'http://example.com/a.jpg', 'data:image/png;base64,AAAA', '//evil.com/a.jpg', '/etc/passwd', 'x' * 300):
        response = client.post('/api/admin/products', json={**base, 'image_url': bad}, headers=admin_headers)
        assert response.status_code == 400, bad


# ---------- startup safety ----------
def test_server_refuses_to_start_with_a_leaked_or_weak_secret(monkeypatch):
    import pytest
    from app import create_app
    with pytest.raises(RuntimeError):
        create_app({'SECRET_KEY': 'ebucket_super_secret_jwt_and_session_key_2026'})
    with pytest.raises(RuntimeError):
        create_app({'SECRET_KEY': 'too-short'})


def test_revenue_counts_cash_on_delivery_only_after_it_is_collected(client, user_headers, admin_headers):
    base = client.get('/api/admin/metrics', headers=admin_headers).get_json()['total_revenue']
    order_id = checkout(client, user_headers, [{'product_id': 2, 'quantity': 1}],
                        payment_method='Cash on Delivery').get_json()['order']['order_id']
    client.patch(f'/api/admin/orders/{order_id}/status', json={'status': 'Shipped'}, headers=admin_headers)
    assert client.get('/api/admin/metrics', headers=admin_headers).get_json()['total_revenue'] == base
    client.patch(f'/api/admin/orders/{order_id}/status', json={'status': 'Delivered'}, headers=admin_headers)
    assert client.get('/api/admin/metrics', headers=admin_headers).get_json()['total_revenue'] == base + 2499


def test_state_changing_request_with_a_fake_authorization_header_still_needs_the_csrf_header(client):
    forged = client.application.test_client()
    response = forged.post('/api/auth/login', json={'email': DEMO_EMAIL, 'password': DEMO_PASSWORD},
                           headers={'Authorization': 'Basic abc'})
    assert response.status_code == 403
