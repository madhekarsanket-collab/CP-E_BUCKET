from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# In-memory counters: fine for one server process. Use a Redis storage_uri if you run several.
limiter = Limiter(key_func=get_remote_address, default_limits=['300 per minute'])

AUTH_LIMIT = '10 per minute'
ACCOUNT_LIMIT = '5 per minute'


def identity_key():
    """Rate-limit key: the account being attacked, so many IPs cannot share one guessing budget."""
    from flask import request
    body = request.get_json(silent=True)
    name = (body.get('email') or body.get('username') or '') if isinstance(body, dict) else ''
    return f'identity:{str(name).strip().lower()[:100]}'
