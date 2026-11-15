"""Test setup. Integration tests need a MySQL server; they use a throwaway database named e_bucket_test.

    TEST_DB_HOST / TEST_DB_PORT / TEST_DB_USER / TEST_DB_PASSWORD   (defaults: localhost, 3306, root, empty)
"""
import os

# Must happen before the app modules import db.py.
os.environ.update(
    DB_HOST=os.getenv('TEST_DB_HOST', 'localhost'),
    DB_PORT=os.getenv('TEST_DB_PORT', '3306'),
    DB_USER=os.getenv('TEST_DB_USER', 'root'),
    DB_PASSWORD=os.getenv('TEST_DB_PASSWORD', ''),
    DB_NAME='e_bucket_test',
    SECRET_KEY='test-secret-key-that-is-at-least-32-characters-long',
    ADMIN_USERNAME='admin',
    ADMIN_PASSWORD='correct horse battery staple',
)

import mysql.connector  # noqa: E402
import pytest  # noqa: E402

import db  # noqa: E402
import init_db  # noqa: E402
from app import create_app  # noqa: E402

DEMO_EMAIL, DEMO_PASSWORD = 'demo@ebucket.in', 'Demo@1234'


def _reset_database():
    conn = mysql.connector.connect(**db.connection_settings(include_database=False))
    cursor = conn.cursor()
    cursor.execute('DROP DATABASE IF EXISTS `e_bucket_test`')
    init_db.run(cursor, 'schema.sql')
    init_db.run(cursor, 'seed.sql')
    conn.commit()
    cursor.close()
    conn.close()
    db.reset_pool()


@pytest.fixture()
def client():
    try:
        _reset_database()
    except mysql.connector.Error as error:
        pytest.skip(f'MySQL is not reachable for integration tests: {error}')
    app = create_app({'TESTING': True, 'RATELIMIT_ENABLED': False})
    test_client = app.test_client()
    test_client.environ_base['HTTP_X_REQUESTED_WITH'] = 'ebucket-web'  # what the real frontend always sends
    return test_client


def bearer_from_session(client):
    """Move the httpOnly session cookie into a Bearer header so one client can act as several users."""
    cookie = client.get_cookie('ebucket_session', path='/api')
    assert cookie is not None, 'login did not set the session cookie'
    client.delete_cookie('ebucket_session', path='/api')
    return {'Authorization': f'Bearer {cookie.value}'}


def sign_in(client, email=DEMO_EMAIL, password=DEMO_PASSWORD):
    response = client.post('/api/auth/login', json={'email': email, 'password': password})
    assert response.status_code == 200, response.get_json()
    return bearer_from_session(client)


@pytest.fixture()
def user_headers(client):
    return sign_in(client)


@pytest.fixture()
def admin_headers(client):
    response = client.post('/api/auth/admin-login',
                           json={'username': 'admin', 'password': 'correct horse battery staple'})
    assert response.status_code == 200
    return bearer_from_session(client)


def stock_of(product_id):
    with db.db() as cur:
        cur.execute('SELECT STOCK FROM product WHERE PRODUCT_ID = %s', (product_id,))
        return cur.fetchone()['STOCK']
