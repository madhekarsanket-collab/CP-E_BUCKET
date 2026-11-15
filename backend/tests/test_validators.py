import pytest

from security import DUMMY_HASH, hash_password, needs_rehash, verify_password
from validators import (ApiError, like_pattern, parse_checkout, parse_product, parse_product_query,
                        parse_registration, parse_status)

VALID_REGISTRATION = {'name': 'Asha Rao', 'email': 'ASHA@Example.com', 'password': 'longenough1',
                      'phone': '9123456789', 'dob': '1998-05-04', 'address': '5 Park Street, Kolkata'}


def test_registration_normalises_email_and_phone():
    form = parse_registration(VALID_REGISTRATION)
    assert form['email'] == 'asha@example.com'
    assert form['phone'] == 9123456789


@pytest.mark.parametrize('field,value', [
    ('password', 'short'), ('phone', '12345'), ('phone', '5123456789'), ('email', 'not-an-email'),
    ('name', 'A'), ('address', 'x'), ('dob', '2999-01-01'), ('dob', 'yesterday'),
])
def test_registration_rejects_bad_fields(field, value):
    with pytest.raises(ApiError):
        parse_registration({**VALID_REGISTRATION, field: value})


def test_registration_rejects_non_object_body():
    with pytest.raises(ApiError):
        parse_registration(['not', 'an', 'object'])


def test_checkout_merges_repeated_products():
    items, method, courier = parse_checkout({'items': [{'product_id': 3, 'quantity': 2},
                                                       {'product_id': 3, 'quantity': 3}]})
    assert items == {3: 5}
    assert method == 'UPI' and courier == 'BlueDart Express'


@pytest.mark.parametrize('payload', [
    {'items': []}, {'items': 'x'}, {'items': [{'product_id': 1, 'quantity': 0}]},
    {'items': [{'product_id': 1, 'quantity': 11}]}, {'items': [{'product_id': 1, 'quantity': -2}]},
    {'items': [{'product_id': True, 'quantity': 1}]}, {'items': [{'product_id': 1, 'quantity': 1.5}]},
    {'items': [{'product_id': 1, 'quantity': 6}, {'product_id': 1, 'quantity': 6}]},
    {'items': [{'product_id': 1, 'quantity': 1}], 'payment_method': 'Bitcoin'},
    {'items': [{'product_id': 1, 'quantity': 1}], 'shipment_name': 'Pigeon Post'},
])
def test_checkout_rejects_bad_payloads(payload):
    with pytest.raises(ApiError):
        parse_checkout(payload)


@pytest.mark.parametrize('price', [0, -5, 'abc', None, True, 10**9])
def test_product_rejects_bad_price(price):
    with pytest.raises(ApiError):
        parse_product({'name': 'X', 'price': price, 'stock': 1, 'category_id': 1})


def test_product_accepts_string_numbers_and_rounds_price():
    product = parse_product({'name': ' Lamp ', 'price': '199.999', 'stock': '4', 'category_id': 2})
    assert str(product['price']) == '200.00'
    assert product['name'] == 'Lamp' and product['stock'] == 4


def test_status_must_be_allowed():
    assert parse_status({'status': 'Shipped'}) == 'Shipped'
    with pytest.raises(ApiError):
        parse_status({'status': 'Teleported'})


def test_product_query_defaults_and_limits():
    query = parse_product_query({})
    assert query['limit'] == 24 and query['offset'] == 0
    with pytest.raises(ApiError):
        parse_product_query({'limit': '1000'})
    with pytest.raises(ApiError):
        parse_product_query({'sort': 'price; DROP TABLE product'})


def test_like_pattern_escapes_wildcards():
    assert like_pattern('50%_off') == '%50\\%\\_off%'


def test_password_hash_roundtrip_and_salting():
    first, second = hash_password('s3cret-pass'), hash_password('s3cret-pass')
    assert first != second
    assert verify_password(first, 's3cret-pass') and not verify_password(first, 'wrong')
    assert not needs_rehash(first)


def test_legacy_password_formats_still_verify_and_need_rehash():
    assert verify_password('plain123', 'plain123') and needs_rehash('plain123')
    assert not verify_password('plain123', 'other')
    assert not verify_password('', 'anything')
    assert not verify_password(DUMMY_HASH, 'wrong')
