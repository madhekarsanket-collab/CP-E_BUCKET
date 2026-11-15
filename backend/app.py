import datetime
import logging
import os
from decimal import Decimal

from flask import Flask, jsonify, request, send_from_directory
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix

import admin
import auth
import catalog
import orders
from extensions import limiter
from validators import ApiError

FRONTEND_DIST = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')
MIN_SECRET_LENGTH = 32
CSRF_HEADER, CSRF_VALUE = 'X-Requested-With', 'ebucket-web'
# Secret keys that were published in earlier versions of this repo. Never accept them.
KNOWN_LEAKED_SECRETS = {'ebucket_super_secret_jwt_and_session_key_2026', 'ebucket_secret_2026'}

SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                                "img-src 'self' data: https:; font-src 'self'; connect-src 'self'; "
                                "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"),
}


class JsonProvider(DefaultJSONProvider):
    """Money goes out as numbers and dates as ISO strings (Flask's defaults are str and RFC 822)."""

    @staticmethod
    def default(value):
        if isinstance(value, Decimal):
            return float(value)
        if isinstance(value, (datetime.date, datetime.datetime)):
            return value.isoformat()
        return DefaultJSONProvider.default(value)


def _configure(app, config):
    app.config.update(SECRET_KEY=os.getenv('SECRET_KEY', ''), MAX_CONTENT_LENGTH=64 * 1024,
                      COOKIE_SECURE=os.getenv('COOKIE_SECURE', '').lower() in ('1', 'true', 'yes'))
    app.config.update(config or {})
    if len(app.config['SECRET_KEY']) < MIN_SECRET_LENGTH:
        raise RuntimeError(f'SECRET_KEY must be set to a random string of at least {MIN_SECRET_LENGTH} characters. '
                           'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(48))"')
    if app.config['SECRET_KEY'] in KNOWN_LEAKED_SECRETS:
        raise RuntimeError("SECRET_KEY is a value that was published in this project's git history. Generate a new one.")
    if os.getenv('TRUST_PROXY', '').lower() in ('1', 'true', 'yes'):
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)


def _register_guards(app):
    @app.before_request
    def require_csrf_header():
        """Cookie sessions need a CSRF guard. A custom header cannot be sent cross-site without a CORS
        preflight, which only our allowed origins pass. Bearer-token API clients are not cookie-based."""
        unsafe = request.method in ('POST', 'PUT', 'PATCH', 'DELETE')
        if unsafe and request.path.startswith('/api/')                 and not request.headers.get('Authorization', '').startswith('Bearer ')                 and request.headers.get(CSRF_HEADER) != CSRF_VALUE:
            raise ApiError('Blocked: missing anti-forgery header', 403)

    @app.after_request
    def add_security_headers(response):
        for name, value in SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        if request.is_secure or app.config['COOKIE_SECURE']:
            response.headers.setdefault('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
        if request.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store'
        return response


def _register_error_handlers(app):
    @app.errorhandler(ApiError)
    def handle_api_error(error):
        return jsonify({'error': error.message}), error.status

    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        message = 'Too many requests. Please wait a moment and try again.' if error.code == 429 else error.name
        return jsonify({'error': message}), error.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        app.logger.exception('Unhandled error on %s %s', request.method, request.path)
        return jsonify({'error': 'Something went wrong on our side. Please try again.'}), 500


def _register_frontend(app):
    @app.get('/', defaults={'path': ''})
    @app.get('/<path:path>')
    def serve_frontend(path):
        """Serve the built React app; unknown non-API paths fall back to index.html (client-side routes)."""
        if path.startswith('api/'):
            raise ApiError('Not found', 404)
        if not os.path.isdir(FRONTEND_DIST):
            raise ApiError('Frontend not built. Run `npm run build` in frontend/, or use `npm run dev`.', 404)
        if path and os.path.isfile(os.path.join(FRONTEND_DIST, path)):
            return send_from_directory(FRONTEND_DIST, path)
        return send_from_directory(FRONTEND_DIST, 'index.html')


def create_app(config=None):
    app = Flask(__name__, static_folder=None)
    app.json = JsonProvider(app)
    _configure(app, config)

    # Browsers normally call /api on their own origin (Vite proxy, Flask-served build, or a Vercel rewrite),
    # so CORS only matters for a separately hosted frontend. Empty by default; origins are an explicit list.
    origins = [o.strip() for o in os.getenv('CORS_ORIGINS', '').split(',') if o.strip()]
    CORS(app, origins=origins, supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization', CSRF_HEADER])
    limiter.init_app(app)
    for blueprint in (auth.bp, catalog.bp, orders.bp, admin.bp):
        app.register_blueprint(blueprint)

    @app.get('/api/health')
    @limiter.exempt
    def health():
        return jsonify({'status': 'healthy'})

    _register_guards(app)
    _register_error_handlers(app)
    _register_frontend(app)
    return app


def main():
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s: %(message)s')
    app = create_app()
    port = int(os.getenv('PORT', 5000))
    if os.getenv('FLASK_DEBUG', '').lower() in ('1', 'true', 'yes'):
        app.run(host='127.0.0.1', port=port, debug=True)
    else:
        from waitress import serve
        logging.info('E-Bucket API listening on http://0.0.0.0:%s', port)
        serve(app, host='0.0.0.0', port=port)


if __name__ == '__main__':
    main()
