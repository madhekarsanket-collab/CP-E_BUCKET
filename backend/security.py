import base64
import hashlib
import hmac

from werkzeug.security import check_password_hash, generate_password_hash

# Hash of a throwaway string, checked when an email is unknown so login timing does not reveal
# which emails are registered.
DUMMY_HASH = generate_password_hash('ebucket-timing-equaliser')


def hash_password(password: str) -> str:
    """Salted scrypt hash (werkzeug). The column is VARCHAR(255)."""
    return generate_password_hash(password)


def verify_password(stored: str, provided: str) -> bool:
    if not stored:
        return False
    if stored.startswith(('scrypt:', 'pbkdf2:')):
        return check_password_hash(stored, provided)
    if stored.startswith('p2$'):
        # Legacy truncated PBKDF2 format from the first version of this project.
        parts = stored.split('$')
        if len(parts) != 3:
            return False
        digest = hashlib.pbkdf2_hmac('sha256', provided.encode(), parts[1].encode(), 10000)
        return hmac.compare_digest(parts[2], base64.b64encode(digest).decode('ascii')[:32])
    # Legacy plaintext rows from the original demo database; upgraded to scrypt on first login.
    return hmac.compare_digest(stored.encode(), provided.encode())


def needs_rehash(stored: str) -> bool:
    return not stored.startswith('scrypt:')
