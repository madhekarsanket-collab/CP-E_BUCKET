# E-Bucket — Multi-Category E-Commerce Marketplace

An end-to-end full-stack e-commerce marketplace built for college Database Management Systems (DBMS) evaluation. The platform showcases a complete shopping workflow connecting directly to a 7-table MySQL schema with active database triggers and safe transactional operations.

---

## 🛠️ Technology Stack
- **Frontend**: React 18 Standalone (In-browser Babel transpilation, Axios, Bootstrap 5, custom Cyber/Dark Navy styling)
- **Backend**: Python Flask REST API
- **Database**: MySQL Server 8.0 (Database name: `e_bucket`)
- **Database Connector**: `mysql-connector-python`
- **Security**: Salted PBKDF2 password hashing with Upgrade-on-Login support, atomic transactions, parameterized queries.

---

## 📁 Repository Structure
```
CP_E_BUCKET/
├── backend/
│   ├── .env.example       # Template for environment variables
│   ├── app.py             # Flask REST API + Static SPA server
│   ├── db.py              # MySQL connection factory (mysql-connector-python)
│   ├── security.py        # Salted PBKDF2 password hashing & verification
│   └── inspect_db.py      # Diagnostic schema inspection tool
├── frontend/
│   ├── index.html         # Single-page application entry point
│   ├── app.js             # React components (Shop, Detail, Cart, Checkout, Admin, Auth)
│   └── style.css          # Dark Navy/Cyan responsive styling
├── database/
│   └── schema.sql         # Clean DDL reference for the 7 MySQL tables & triggers
├── .gitignore             # Strict exclusion list for secrets and backups
└── README.md              # Project documentation and setup guide
```

---

## 🗄️ Database Architecture & Triggers
The project runs on 7 relational tables:
1. `userr`: User profiles and authentication.
2. `category`: Product categories.
3. `product`: Product inventory with live stock and pricing.
4. `orders`: Order headers.
5. `order_item`: Order line items.
6. `payment`: Payment records and methods.
7. `delivery`: Courier shipment tracking.

### Triggers Enforced in MySQL:
- `reduce_stock_after_insert`: Automatically deducts inventory upon item insert.
- `restore_stock_after_delete`: Automatically replenishes stock if order items are cancelled.
- `sync_order_status_after_update`: Sets order status to `'Paid'` when payment is marked `'Success'`.

---

## 🚀 Local Setup Instructions

### 1. Prerequisites
- Python 3.10+
- MySQL Server 8.0+

### 2. Configure Environment Variables
Copy `backend/.env.example` to `backend/.env`:
```bash
cp backend/.env.example backend/.env
```
Open `backend/.env` and supply your local MySQL password and desired admin credentials:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=e_bucket

SECRET_KEY=your_random_secret_key_here

ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_admin_password
```

### 3. Install Python Dependencies
```bash
pip install flask flask-cors mysql-connector-python python-dotenv
```

### 4. Run the Application
In your terminal, navigate to the project root and execute:
```bash
python backend/app.py
```
Open your browser and navigate to:
```
http://localhost:5000
```

---

## 🌟 Features Overview

### Customer Experience
- **Browse Multi-Category Catalog**: Electronics, Musical Instruments, Fitness, Gaming, Wearables, etc.
- **Search & Category Filters**: Real-time filtering.
- **Dynamic Stock Visibility**:
  - `> 10 units`: Displays "In Stock" (exact quantity hidden from customers).
  - `4 to 10 units`: Displays "Only X left!" (Yellow/Orange).
  - `1 to 3 units`: Displays "Only X left!" (Red).
  - `0 units`: Displays "Out of Stock" (Red badge & Add to Cart disabled).
- **Shopping Cart**: Client-side cart with real-time stock limits.
- **Atomic Checkout**: MySQL transaction writing to `orders`, `order_item`, `payment`, and `delivery`.
- **Receipt & Order History**: Real-time receipt tracking and order status.
- **Secure Authentication**: Salted PBKDF2 hashing fitting within `VARCHAR(50)`, supporting automatic upgrade on login.

### Admin Dashboard
- **Business Metrics**: Real-time counters for customers, products, orders, and total revenue.
- **Product Management**: Add, edit, or delete catalog items with exact integer stock counts.
- **Order Management**: Inspect orders, delivery logistics, and update order statuses.
- **Customer Directory**: View customer profiles directly from the `userr` table.
