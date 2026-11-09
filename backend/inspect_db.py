import os
import sys
from dotenv import load_dotenv

# Load .env file
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

db_host = os.getenv('DB_HOST', 'localhost')
db_port = int(os.getenv('DB_PORT', 3306))
db_user = os.getenv('DB_USER', 'root')
db_password = os.getenv('DB_PASSWORD', '')
db_name = os.getenv('DB_NAME', 'e_bucket')

print("Connecting to MySQL server using configuration from .env...")

try:
    import mysql.connector
    cnx = mysql.connector.connect(
        host=db_host,
        port=db_port,
        user=db_user,
        password=db_password,
        database=db_name
    )
    cursor = cnx.cursor()
    print("SUCCESS: Connected to database:", db_name)
    
    # 1. SHOW TABLES
    cursor.execute("SHOW TABLES;")
    tables = [t[0] for t in cursor.fetchall()]
    print("\nTables found in database:")
    for t in tables:
        print(" -", t)
        
    # 2. DESCRIBE TABLES
    for t in tables:
        print(f"\n--- Structure for table: {t} ---")
        cursor.execute(f"DESCRIBE `{t}`;")
        for col in cursor.fetchall():
            print(f"   {col[0]}: {col[1]} | Null: {col[2]} | Key: {col[3]} | Default: {col[4]} | Extra: {col[5]}")

    # 3. SHOW TRIGGERS
    print("\n--- Triggers in database ---")
    cursor.execute("SHOW TRIGGERS;")
    triggers = cursor.fetchall()
    if triggers:
        for tr in triggers:
            print(f" Trigger: {tr[0]} | Event: {tr[1]} | Table: {tr[2]} | Timing: {tr[4]}")
    else:
        print(" No triggers found.")

    cursor.close()
    cnx.close()
    print("\nDatabase inspection finished safely without altering data.")
except Exception as e:
    # Sanitize exception message to prevent leaking sensitive connection parameters or passwords
    err_msg = str(e)
    if db_password and db_password in err_msg:
        err_msg = err_msg.replace(db_password, "******")
    print(f"\nCONNECTION_FAILED: Unable to connect to MySQL database. ({err_msg})")
    sys.exit(1)

