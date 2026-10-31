# BYTE — Campus Food OS

A modular-monolith starter for the BYTE campus food-services platform.

## Current implementation
- React + TypeScript + Vite frontend.
- FastAPI + SQLAlchemy backend.
- PostgreSQL-ready database configuration (SQLite fallback for zero-friction local development).
- Admin-provisioned demo accounts, role-aware login, outlet/menu CRUD, outlet-scoped carts, sandbox checkout and order status progression.
- Original recovered Stitch screens retained under `reference/stitch/` for visual reference.

## Run locally

### Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```
API: http://localhost:8000 · Docs: http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend: http://localhost:5173

## Demo accounts
The seed command creates local-only demo accounts (change passwords before any shared deployment):
- Admin: `admin@example.com` / `ByteAdmin123!`
- Vendor — Dabba Lab: `vendor@example.com` / `ByteVendor123!`
- Vendor — Tiffin Express: `vendor.tiffin@example.com` / `ByteVendor123!`
- Vendor — Chai & Crumb: `vendor.chai@example.com` / `ByteVendor123!`
- Student: `student@example.com` / `ByteStudent123!`

Run `python -m app.seed` from `backend/` after installing dependencies.

## Important
Payments are sandbox-only. No real money is collected. The wallet/PPI structure requires institutional and payment-partner review before real-money functionality. Demo menu prices and records are synthetic.
