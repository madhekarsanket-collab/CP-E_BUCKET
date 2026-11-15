import hmac
import os
from functools import wraps

from flask import Blueprint, current_app, g, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from db import IntegrityError, db
from extensions import ACCOUNT_LIMIT, AUTH_LIMIT, identity_key, limiter
from security import DUMMY_HASH, hash_password, needs_rehash, verify_password
from validators import ApiError, parse_admin_login, parse_login, parse_registration

bp = Blueprint('auth', __name__, url_prefix='/api/auth')

COOKIE_NAME = 'ebucket_session'
TOKEN_TTL_SECONDS = {'user': 7 * 24 * 3600, 'admin': 8 * 3600}


def _serializer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt='ebucket-auth-v1')


def issue_token(role, user_id=None):
    return _serializer().dumps({'role': role, 'uid': user_id})


def read_token(token, role):
    """Return the token payload if it is genuine, unexpired and for `role`; otherwise None."""
    try:
        payload = _serializer().loads(token, max_age=TOKEN_TTL_SECONDS[role])
    except (BadSignature, SignatureExpired):
        return None
    return payload if isinstance(payload, dict) and payload.get('role') == role else None


def _request_token():
    """The session token: an httpOnly cookie for the browser, or a Bearer header for API clients."""
    header = request.headers.get('Authorization', '')
    if header.startswith('Bearer '):
        return header[7:].strip()
    return request.cookies.get(COOKIE_NAME, '')


def authenticate(role):
    """Raise 401 unless the request carries a valid session for `role`. Sets g.user_id."""
    token = _request_token()
    payload = read_token(token, role) if token else None
    if payload is None:
        raise ApiError('Please sign in to continue', 401)
    g.user_id = payload.get('uid')


def require_auth(role):
    """Protect a route. For role 'user' the caller's id is available as g.user_id."""
    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            authenticate(role)
            return view(*args, **kwargs)
        return wrapper
    return decorator


def _session_response(body, role, user_id=None, status=200):
    """JSON reply that also starts the session. The token only ever travels in the httpOnly cookie."""
    response = jsonify(body)
    response.status_code = status
    response.set_cookie(COOKIE_NAME, issue_token(role, user_id), max_age=TOKEN_TTL_SECONDS[role],
                        httponly=True, secure=request.is_secure or current_app.config['COOKIE_SECURE'],
                        samesite='Lax', path='/api')
    return response


def _public_user(row):
    return {
        'user_id': row['USER_ID'], 'name': row['Name'], 'email': row['EMAIL'],
        'phone': row['PHONE_NO'], 'address': row['ADDRESS'],
        'dob': row['DOB'].isoformat() if row['DOB'] else None,
    }


@bp.post('/register')
@limiter.limit(AUTH_LIMIT)
def register():
    form = parse_registration(request.get_json(silent=True))
    try:
        with db() as cur:
            cur.execute(
                'INSERT INTO userr (Name, PASS, DOB, EMAIL, PHONE_NO, ADDRESS) VALUES (%s, %s, %s, %s, %s, %s)',
                (form['name'], hash_password(form['password']), form['dob'], form['email'],
                 form['phone'], form['address']),
            )
            user_id = cur.lastrowid
    except IntegrityError:
        raise ApiError('An account with this email already exists', 409)
    user = {'user_id': user_id, 'name': form['name'], 'email': form['email'], 'phone': form['phone'],
            'address': form['address'], 'dob': form['dob'].isoformat() if form['dob'] else None}
    return _session_response({'user': user}, 'user', user_id, 201)


@bp.post('/login')
@limiter.limit(AUTH_LIMIT)
@limiter.limit(ACCOUNT_LIMIT, key_func=identity_key)
def login():
    email, password = parse_login(request.get_json(silent=True))
    with db() as cur:
        cur.execute('SELECT USER_ID, Name, PASS, DOB, EMAIL, PHONE_NO, ADDRESS FROM userr WHERE EMAIL = %s', (email,))
        row = cur.fetchone()
        if row is None:
            verify_password(DUMMY_HASH, password)  # equalise timing with the real-user path
            raise ApiError('Invalid email or password', 401)
        if not verify_password(row['PASS'], password):
            raise ApiError('Invalid email or password', 401)
        if needs_rehash(row['PASS']):
            cur.execute('UPDATE userr SET PASS = %s WHERE USER_ID = %s', (hash_password(password), row['USER_ID']))
    return _session_response({'user': _public_user(row)}, 'user', row['USER_ID'])


@bp.post('/admin-login')
@limiter.limit(AUTH_LIMIT)
@limiter.limit(ACCOUNT_LIMIT, key_func=identity_key)
def admin_login():
    username, password = parse_admin_login(request.get_json(silent=True))
    admin_user = os.getenv('ADMIN_USERNAME', '').strip()
    admin_pass = os.getenv('ADMIN_PASSWORD', '')
    if not admin_user or not admin_pass:
        raise ApiError('Admin sign-in is not configured on this server', 503)
    user_ok = hmac.compare_digest(username.lower().encode(), admin_user.lower().encode())
    pass_ok = hmac.compare_digest(password.encode(), admin_pass.encode())
    if not (user_ok and pass_ok):
        raise ApiError('Invalid admin credentials', 401)
    return _session_response({'admin': {'username': admin_user, 'name': 'E-Bucket Admin'}}, 'admin')


@bp.get('/me')
def me():
    """Who is signed in? The cookie is httpOnly, so the page asks the server instead of reading it."""
    token = _request_token()
    payload = None
    if token:
        payload = read_token(token, 'user') or read_token(token, 'admin')
    if payload is None:
        return jsonify({'role': None})
    if payload['role'] == 'admin':
        return jsonify({'role': 'admin', 'admin': {'name': 'E-Bucket Admin'}})
    with db() as cur:
        cur.execute('SELECT USER_ID, Name, DOB, EMAIL, PHONE_NO, ADDRESS FROM userr WHERE USER_ID = %s', (payload['uid'],))
        row = cur.fetchone()
    return jsonify({'role': 'user', 'user': _public_user(row)} if row else {'role': None})


@bp.post('/logout')
def logout():
    response = jsonify({'message': 'Signed out'})
    response.delete_cookie(COOKIE_NAME, path='/api', samesite='Lax')
    return response
