"""Request validation. Everything from the client is untrusted: parse here, then use the result."""
import datetime
import re
from decimal import Decimal, InvalidOperation

MAX_QTY_PER_ITEM = 10
MAX_LINES_PER_ORDER = 50
MAX_PRICE = Decimal('9999999.99')
MAX_STOCK = 1_000_000
PRODUCT_SORTS = {
    'newest': 'p.PRODUCT_ID DESC',
    'price_asc': 'p.PRICE ASC, p.PRODUCT_ID ASC',
    'price_desc': 'p.PRICE DESC, p.PRODUCT_ID ASC',
    'name': 'p.NAME ASC, p.PRODUCT_ID ASC',
}
ORDER_STATUSES = ('Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled')
PAYMENT_METHODS = ('UPI', 'Credit/Debit Card', 'Net Banking', 'Cash on Delivery')
COURIERS = ('BlueDart Express', 'Delhivery Surface', 'DTDC Priority', 'India Post EMS')

# A photo is either one of our own files under /products/ or an https link. Never javascript:, data: or http:.
_IMAGE_RE = re.compile(r'^(/products/[A-Za-z0-9._-]+|https://[^\s"<>]+)$')
_EMAIL_RE = re.compile(r'^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$')
_PHONE_RE = re.compile(r'^[6-9]\d{9}$')


class ApiError(Exception):
    """An error whose message is safe to show to the client."""

    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def json_object(data):
    if not isinstance(data, dict):
        raise ApiError('Request body must be a JSON object')
    return data


def _text(data, key, label, max_len, min_len=1):
    value = data.get(key)
    if not isinstance(value, str):
        raise ApiError(f'{label} is required')
    value = value.strip()
    if len(value) < min_len:
        raise ApiError(f'{label} must be at least {min_len} characters' if min_len > 1 else f'{label} is required')
    if len(value) > max_len:
        raise ApiError(f'{label} must be at most {max_len} characters')
    return value


def _int(value, label, low, high):
    if isinstance(value, bool) or not isinstance(value, (int, str)):
        raise ApiError(f'{label} must be a whole number')
    try:
        number = int(value)
    except ValueError:
        raise ApiError(f'{label} must be a whole number')
    if not low <= number <= high:
        raise ApiError(f'{label} must be between {low} and {high}')
    return number


def _price(value):
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise ApiError('Price must be a number')
    try:
        price = Decimal(str(value)).quantize(Decimal('0.01'))
    except InvalidOperation:
        raise ApiError('Price must be a number')
    if not Decimal('0.01') <= price <= MAX_PRICE:
        raise ApiError('Price must be greater than 0 and at most 9,999,999.99')
    return price


def parse_email(data):
    email = _text(data, 'email', 'Email', 100).lower()
    if not _EMAIL_RE.match(email):
        raise ApiError('Enter a valid email address')
    return email


def parse_registration(data):
    data = json_object(data)
    phone = str(data.get('phone', '')).strip()
    if not _PHONE_RE.match(phone):
        raise ApiError('Enter a valid 10-digit Indian mobile number')
    dob = data.get('dob')
    try:
        dob = datetime.date.fromisoformat(dob) if dob else None
    except (TypeError, ValueError):
        raise ApiError('Date of birth must be a valid date')
    if dob and not datetime.date(1900, 1, 1) <= dob <= datetime.date.today():
        raise ApiError('Date of birth must be a valid date in the past')
    return {
        'name': _text(data, 'name', 'Name', 100, 2),
        'email': parse_email(data),
        'password': _text_exact(data, 'password', 'Password', 8, 128),
        'phone': int(phone),
        'dob': dob,
        'address': _text(data, 'address', 'Address', 255, 5),
    }


def _text_exact(data, key, label, min_len, max_len):
    """Like _text but keeps surrounding spaces (passwords may contain them)."""
    value = data.get(key)
    if not isinstance(value, str):
        raise ApiError(f'{label} is required')
    if not min_len <= len(value) <= max_len:
        raise ApiError(f'{label} must be {min_len} to {max_len} characters')
    return value


def parse_login(data):
    data = json_object(data)
    password = data.get('password')
    if not isinstance(password, str) or not password or len(password) > 128:
        raise ApiError('Email and password are required')
    return parse_email(data), password


def parse_admin_login(data):
    data = json_object(data)
    username, password = data.get('username'), data.get('password')
    if not isinstance(username, str) or not isinstance(password, str) or not username or not password:
        raise ApiError('Username and password are required')
    return username.strip(), password


def parse_product(data):
    data = json_object(data)
    details = data.get('details') or ''
    if not isinstance(details, str) or len(details.strip()) > 200:
        raise ApiError('Details must be at most 200 characters')
    return {
        'name': _text(data, 'name', 'Product name', 100),
        'price': _price(data.get('price')),
        'stock': _int(data.get('stock'), 'Stock', 0, MAX_STOCK),
        'details': details.strip(),
        'category_id': _int(data.get('category_id'), 'Category', 1, 2**31 - 1),
        'image_url': parse_image_url(data.get('image_url')),
    }


def parse_image_url(value):
    if value is None or value == '':
        return None
    if not isinstance(value, str) or len(value) > 255 or not _IMAGE_RE.match(value.strip()):
        raise ApiError('Image must be a /products/ file or an https link (up to 255 characters)')
    return value.strip()


def parse_status(data):
    status = json_object(data).get('status')
    if status not in ORDER_STATUSES:
        raise ApiError('Status must be one of: ' + ', '.join(ORDER_STATUSES))
    return status


def parse_checkout(data):
    """Return ({product_id: quantity}, payment_method, courier). Repeated products are merged."""
    data = json_object(data)
    raw_items = data.get('items')
    if not isinstance(raw_items, list) or not raw_items:
        raise ApiError('Your cart is empty')
    if len(raw_items) > MAX_LINES_PER_ORDER:
        raise ApiError(f'An order can have at most {MAX_LINES_PER_ORDER} different products')
    items = {}
    for raw in raw_items:
        if not isinstance(raw, dict):
            raise ApiError('Invalid cart item')
        product_id = _int(raw.get('product_id'), 'Product', 1, 2**31 - 1)
        quantity = _int(raw.get('quantity'), 'Quantity', 1, MAX_QTY_PER_ITEM)
        items[product_id] = items.get(product_id, 0) + quantity
    if any(qty > MAX_QTY_PER_ITEM for qty in items.values()):
        raise ApiError(f'You can order at most {MAX_QTY_PER_ITEM} of one product at a time')
    method = data.get('payment_method', PAYMENT_METHODS[0])
    courier = data.get('shipment_name', COURIERS[0])
    if method not in PAYMENT_METHODS:
        raise ApiError('Choose a valid payment method')
    if courier not in COURIERS:
        raise ApiError('Choose a valid courier')
    return items, method, courier


def parse_product_query(args):
    """Validated filters for GET /api/products."""
    category = args.get('category_id')
    sort = args.get('sort', 'newest')
    if sort not in PRODUCT_SORTS:
        raise ApiError('Unknown sort order')
    return {
        'category_id': _int(category, 'Category', 1, 2**31 - 1) if category else None,
        'search': args.get('search', '').strip()[:100],
        'min_price': _price(args['min_price']) if args.get('min_price') else None,
        'max_price': _price(args['max_price']) if args.get('max_price') else None,
        'sort': PRODUCT_SORTS[sort],
        'limit': _int(args.get('limit', 24), 'Limit', 1, 100),
        'offset': _int(args.get('offset', 0), 'Offset', 0, 1_000_000),
    }


def like_pattern(text):
    """Escape LIKE wildcards so a search for '50%' does not match everything."""
    escaped = text.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
    return f'%{escaped}%'
