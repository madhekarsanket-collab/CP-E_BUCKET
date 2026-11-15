import os
from contextlib import contextmanager

import mysql.connector
from dotenv import load_dotenv
from mysql.connector import pooling

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

_pool = None


def connection_settings(include_database=True):
    settings = {
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': int(os.getenv('DB_PORT', 3306)),
        'user': os.getenv('DB_USER', 'root'),
        'password': os.getenv('DB_PASSWORD', ''),
    }
    if include_database:
        settings['database'] = os.getenv('DB_NAME', 'e_bucket')
    return settings


def _get_pool():
    global _pool
    if _pool is None:
        _pool = pooling.MySQLConnectionPool(
            pool_name='ebucket',
            pool_size=int(os.getenv('DB_POOL_SIZE', 5)),
            autocommit=False,
            **connection_settings(),
        )
    return _pool


@contextmanager
def db():
    """Yield a dict cursor inside one transaction: commit on success, roll back on any error."""
    conn = _get_pool().get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def reset_pool():
    """Drop the cached pool (used by tests after switching DB settings)."""
    global _pool
    _pool = None


IntegrityError = mysql.connector.errors.IntegrityError
