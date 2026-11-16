"""Create (or upgrade) the e_bucket database.

    python backend/init_db.py            create tables and triggers (safe to re-run)
    python backend/init_db.py --seed     also load demo data (empty database only)
    python backend/init_db.py --fix-ids  reset id counters (no gaps for the next new rows)
    python backend/init_db.py --migrate  upgrade a database made from the original schema, then re-run schema.sql
"""
import argparse
import os
import sys

import mysql.connector

from db import connection_settings

DATABASE_DIR = os.path.join(os.path.dirname(__file__), '..', 'database')


def statements(filename):
    """Split a .sql file into statements. Files here avoid DELIMITER and ';' inside strings.

    The files say `e_bucket`; DB_NAME swaps in another name (the tests use e_bucket_test).
    """
    with open(os.path.join(DATABASE_DIR, filename), encoding='utf-8') as handle:
        lines = [line for line in handle.read().splitlines() if not line.lstrip().startswith('--')]
    text = '\n'.join(lines).replace('`e_bucket`', '`%s`' % os.getenv('DB_NAME', 'e_bucket'))
    return [part.strip() for part in text.split(';') if part.strip()]


def run(cursor, filename):
    for statement in statements(filename):
        cursor.execute(statement)
    print(f'ran {filename}')


PREFLIGHT_CHECKS = [
    ('two accounts share an email address', 'SELECT EMAIL FROM userr GROUP BY EMAIL HAVING COUNT(*) > 1'),
    ('two categories share a name', 'SELECT NAME FROM category GROUP BY NAME HAVING COUNT(*) > 1'),
    ('a product has a price of 0 or less', 'SELECT PRODUCT_ID FROM product WHERE PRICE IS NULL OR PRICE <= 0'),
    ('a product has negative stock', 'SELECT PRODUCT_ID FROM product WHERE STOCK < 0'),
    ('an order has more than one payment', 'SELECT ORDER_ID FROM payment GROUP BY ORDER_ID HAVING COUNT(*) > 1'),
    ('an order has more than one delivery', 'SELECT ORDER_ID FROM delivery GROUP BY ORDER_ID HAVING COUNT(*) > 1'),
    ('an order line has a quantity of 0 or less', 'SELECT ORDER_ITEM_ID FROM order_item WHERE QUANTITY IS NULL OR QUANTITY <= 0'),
]


def preflight(cursor):
    """Refuse to start a migration that would fail half-way (DDL cannot be rolled back)."""
    cursor.execute('USE `%s`' % os.getenv('DB_NAME', 'e_bucket'))
    problems = []
    for message, query in PREFLIGHT_CHECKS:
        cursor.execute(query)
        rows = cursor.fetchall()
        if rows:
            problems.append(f'{message}: {[row[0] for row in rows[:5]]}')
    if problems:
        sys.exit('Fix this data first, then run --migrate again. Nothing was changed.\n  ' + '\n  '.join(problems))


ID_COLUMNS = {'userr': 'USER_ID', 'category': 'CATEGORY_ID', 'product': 'PRODUCT_ID', 'orders': 'ORDER_ID',
              'order_item': 'ORDER_ITEM_ID', 'payment': 'RECEIPT_NO', 'delivery': 'SHIPMENT_ID'}


def fix_ids(cursor):
    """Point every auto-increment counter at MAX(id)+1, closing gaps left by deleted test rows.

    MySQL never reuses a deleted id, so after deleting rows the next new row would skip numbers.
    This does not renumber existing rows.
    """
    cursor.execute('USE `%s`' % os.getenv('DB_NAME', 'e_bucket'))
    for table, column in ID_COLUMNS.items():
        cursor.execute(f'SELECT COALESCE(MAX(`{column}`), 0) + 1 FROM `{table}`')
        cursor.execute(f'ALTER TABLE `{table}` AUTO_INCREMENT = {int(cursor.fetchone()[0])}')
    print('auto-increment counters reset to the next free id')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--seed', action='store_true', help='load demo data into an empty database')
    parser.add_argument('--fix-ids', action='store_true', help='reset id counters so new rows continue without gaps')
    parser.add_argument('--migrate', action='store_true', help='upgrade a v1 database in place')
    args = parser.parse_args()

    conn = mysql.connector.connect(**connection_settings(include_database=False))
    cursor = conn.cursor()
    try:
        if args.migrate:
            preflight(cursor)
            run(cursor, 'migrate_v1_to_v2.sql')
        run(cursor, 'schema.sql')
        if args.seed:
            cursor.execute('SELECT COUNT(*) FROM product')
            if cursor.fetchone()[0]:
                sys.exit('Refusing to seed: the product table already has rows.')
            run(cursor, 'seed.sql')
        if args.fix_ids:
            fix_ids(cursor)
        conn.commit()
    finally:
        cursor.close()
        conn.close()
    print('Database ready.')


if __name__ == '__main__':
    main()
