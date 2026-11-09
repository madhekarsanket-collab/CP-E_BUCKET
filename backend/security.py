import hashlib
import os
import base64

def hash_new_password(password: str) -> str:
    """
    Creates a salted PBKDF2 hash encoded in URL-safe base64, formatted to strictly fit
    within VARCHAR(50):
      'p2$' (3 chars) + salt (8 chars) + '$' (1 char) + digest (32 chars) = 44 chars total.
    """
    salt_bytes = os.urandom(6)
    salt_str = base64.b64encode(salt_bytes).decode('ascii').rstrip('=')[:8]
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt_str.encode('utf-8'), 10000)
    hash_str = base64.b64encode(digest).decode('ascii')[:32]
    return f"p2${salt_str}${hash_str}"

def verify_password(stored_password: str, provided_password: str) -> bool:
    """
    Verifies passwords for both:
    1. Legacy accounts (stored prior to hashing upgrade)
    2. Salted PBKDF2 passwords created by new registrations or login upgrade
    """
    if not stored_password:
        return False
    if stored_password.startswith("p2$"):
        parts = stored_password.split("$")
        if len(parts) == 3:
            salt_str = parts[1]
            stored_hash = parts[2]
            computed_digest = hashlib.pbkdf2_hmac('sha256', provided_password.encode('utf-8'), salt_str.encode('utf-8'), 10000)
            computed_hash = base64.b64encode(computed_digest).decode('ascii')[:32]
            return stored_hash == computed_hash
    # Backward compatibility with existing preloaded plaintext passwords
    return stored_password == provided_password

