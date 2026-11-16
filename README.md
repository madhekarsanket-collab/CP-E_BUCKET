# E-Bucket

A multi-category e-commerce marketplace: browse and search 8 categories, add to a cart, check out, track orders, and manage the shop from an admin dashboard. Built for a college DBMS course, then hardened for real use.

**Stack:** React 18 + Vite (frontend) · Python Flask (API) · MySQL 8 (7 tables, 4 triggers) · pytest + Vitest

## What you get

**Shoppers:** search, category and price filters, sorting, "show more" paging, product pages with photos, a persistent cart, checkout with courier and payment choice, order history with a delivery progress bar, dark mode.
**Admin:** revenue and stock metrics, product create/edit/delete (with photo), order status changes, customer list.
**Database:** `userr`, `category`, `product`, `orders`, `order_item`, `payment`, `delivery`, with triggers that reduce stock on purchase, restore it on cancellation or delete, and mark an order Paid when its payment succeeds.

Payments are **simulated** (the demo gateway always approves, Cash on Delivery stays pending until delivery). No card details are ever collected.

## Run it locally

You need Python 3.10+, Node 20+ and MySQL 8.0.16+.

```bash
# 1. Backend
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env          # then edit it (see below)
python backend/init_db.py --seed              # creates the e_bucket database + demo data
python backend/app.py                         # API on http://localhost:5000

# 2. Frontend (second terminal)
cd frontend
npm install
npm run dev                                   # http://localhost:5173, proxies /api to the backend
```

In `backend/.env` set `DB_PASSWORD`, a `SECRET_KEY` (`python -c "import secrets; print(secrets.token_urlsafe(48))"`) and an `ADMIN_PASSWORD`. The server refuses to start without a strong `SECRET_KEY`.

**Demo logins** (after `--seed`): customer `demo@ebucket.in` / `Demo@1234`. Admin: the `ADMIN_USERNAME` / `ADMIN_PASSWORD` you put in `.env`. Seeding creates known accounts, so never seed a production database.

**Single-process mode:** `cd frontend && npm run build`, then `python backend/app.py` serves the built site and the API together on one origin.

### Upgrading the original database

If you already have a database from the first version of this project, keep your data and upgrade it in place:

```bash
python backend/init_db.py --migrate
```

It switches ids to auto-increment, widens the password column, adds the unique email and stock/price constraints, adds product photos and installs the new triggers. Existing plaintext or weakly hashed passwords keep working and are upgraded to scrypt the first time each user signs in.

## Tests

```bash
cd backend && pip install -r requirements-dev.txt
TEST_DB_HOST=localhost TEST_DB_PASSWORD=... python -m pytest --cov=.   # uses a throwaway e_bucket_test database
cd ../frontend && npm test
```

The backend suite (65 tests, about 88% coverage) covers auth, validation, authorization between users, checkout rollback, a two-buyers-one-unit race, cancellation, and CSRF.

## Security notes

- Passwords: salted scrypt. Login timing does not reveal which emails exist. Auth endpoints are rate limited.
- Sessions: signed token in an **httpOnly, SameSite** cookie, so page scripts cannot read it. Every write also needs an `X-Requested-With` header (CSRF defence). Customer and admin sessions are separate roles.
- Customers can only read their own orders; the server never trusts client prices, ids or stock.
- Checkout is one transaction with row locks: no overselling, and stock can never go negative (a `CHECK` constraint backs it up).
- Every query is parameterised. Search wildcards are escaped. Sort order comes from an allow-list.
- Errors shown to users are generic; details go to the server log only.
- Strict Content-Security-Policy and standard security headers on all responses.
- `backend/.env` is git-ignored. **The secret key that older versions of this repo put in `.env.example` is public: if you ever used it, rotate it.**

## Deploying (Vercel site + your own MySQL through an ngrok tunnel)

The website runs on Vercel. Its `/api` calls are forwarded to the shop server on your PC through an ngrok tunnel, so the live site reads and writes your own MySQL. **Only the shop's API goes through the tunnel; MySQL itself is never exposed.** The browser only ever talks to the Vercel address, which keeps the cookie sessions safe.

```
browser -> Vercel (static site + /api rewrite) -> ngrok tunnel -> Flask on your PC -> MySQL
```

1. Fill in `backend/.env` (database login, `SECRET_KEY`, `ADMIN_PASSWORD`, `TRUST_PROXY=true`, `PROXY_HOPS=2`) and create the tables: `python backend/init_db.py --seed`.
2. Install ngrok, sign in once (`ngrok config add-authtoken ...`) and claim your free static domain in the ngrok dashboard.
3. Put that domain in `frontend/vercel.json` (the `/api` rewrite), then from `frontend/` run `vercel deploy --prod`.
4. Whenever you want the live site up, run `start-live.bat` and leave it open. The site needs your PC on, the shop server running and ngrok running. If any is off, the pages load but shop data does not.

The 1-hop alternative (hosted MySQL, Vercel runs the API as a serverless function) is described by `vercel.json` and `api/index.py` at the repo root: set the `DB_*` variables in Vercel and run `python backend/init_db.py --seed` against the hosted database. Do not run with `FLASK_DEBUG=true`.

For a single server instead, build the frontend and run `python backend/app.py` behind HTTPS.

## Project layout

```
backend/    Flask API (app, auth, catalog, orders, admin, validators, db, security) + tests/
frontend/   React app: src/pages, src/components, src/context, src/lib, src/styles; public/products = photos
database/   schema.sql · seed.sql (demo data) · migrate_v1_to_v2.sql · e_bucket_full.sql (everything in one file: open it in Workbench and run)
```

## Photo credits

Product photos are from Wikimedia Commons under CC0, CC BY or CC BY-SA licences. See [frontend/public/products/CREDITS.md](frontend/public/products/CREDITS.md) for each photo's author and licence. They are illustrative stand-ins and some show other brands' products: replace them with your own photos before a real launch.
