# Hola Prime Admin Platform

Full-stack prop firm management platform — admin panel, trader portal, and API.

## Structure

```
holaprime-admin/
├── api/          Node.js 22 + TypeScript + Fastify  (port 3001)
├── admin/        React 18 admin panel               (port 5173)
├── app/          React 18 trader portal             (port 5174)
├── deploy/       GCP Cloud Build + Terraform
├── docker-compose.yml
└── .env.example
```

## Quick Start (Local Dev)

### Prerequisites
- Node.js 22+  →  https://nodejs.org
- Docker Desktop  →  https://www.docker.com/products/docker-desktop

### Step 1 — Environment
```bash
# Windows CMD:
copy .env.example .env
notepad .env

# Mac/Linux/PowerShell:
cp .env.example .env
```
The only required changes for local dev are `JWT_SECRET` and `JWT_REFRESH_SECRET`.

### Step 2 — Start database and Redis
```bash
docker compose up -d postgres
```
Wait ~10 seconds, then verify: `docker compose ps`

> **No Redis required** — background jobs run via pg-boss, which uses the same Postgres database.

### Step 3 — API
```bash
cd api
npm install
npm run migrate
npm run dev
```
API runs at http://localhost:3001  
Health check: http://localhost:3001/health

### Step 4 — Admin panel (new terminal)
```bash
cd admin
npm install
npm run dev
```
Admin panel: http://localhost:5173

### Step 5 — Trader portal (new terminal, optional)
```bash
cd app
npm install
npm run dev
```
Trader portal: http://localhost:5174

### Default admin login
```
Email:    admin@holaprimemarkets.com
Password: Admin@HolaPrime1
```
**Change this immediately** — see "Reset admin password" below.

---

## Reset Admin Password

```bash
# 1. Generate a bcrypt hash for your new password:
cd api
node -e "const b=require('bcryptjs'); b.hash('YourNewPassword!', 12).then(console.log)"

# 2. Connect to the database:
docker compose exec postgres psql -U holaprime -d holaprime

# 3. Update the hash (paste your hash):
UPDATE admin_users
SET password_hash = '$2b$12$YOUR_HASH_HERE'
WHERE email = 'admin@holaprimemarkets.com';
\q
```

---

## API Modules

| Phase | Module | Prefix |
|-------|--------|--------|
| 1 | Auth | `/api/v1/auth` |
| 1 | Users | `/api/v1/users` |
| 1 | KYC | `/api/v1/kyc` |
| 1 | Challenges | `/api/v1/challenges` |
| 1 | Payments | `/api/v1/payments` |
| 1 | Risk | `/api/v1/risk` |
| 1 | Dashboard | `/api/v1/dashboard` |
| 2 | CRM | `/api/v1/crm` |
| 2 | Attribution | `/api/v1/attribution` |
| 2 | Affiliates | `/api/v1/affiliates` |
| 2 | WhatsApp | `/api/v1/whatsapp` |
| 2 | Campaigns | `/api/v1/campaigns` |
| 2 | Retention | `/api/v1/retention` |
| 3 | Settings | `/api/v1/settings` |
| 3 | Webhooks | `/api/v1/webhooks` |
| 3 | Reports | `/api/v1/reports` |
| 3 | Tournaments | `/api/v1/tournaments` |
| 3 | Trader Portal | `/api/v1/trader` |

---

## Database Migrations

Migrations run automatically on `npm run migrate`. Each file in
`api/src/db/migrations/` is applied exactly once and tracked in a
`schema_migrations` table.

| File | Contents |
|------|----------|
| `001_initial.sql` | Core schema — users, accounts, payments, risk, affiliates |
| `002_phase2.sql` | CRM, attribution, WhatsApp, campaigns, retention |
| `003_phase3.sql` | Settings, webhooks, reports, tournaments, notifications, support |

---

## Deploy to GCP

```bash
# 1. Install gcloud and authenticate
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 2. Apply infrastructure (Postgres, Redis, GCS, Secret Manager)
cd deploy/gcp
terraform init && terraform apply

# 3. Push secrets
gcloud secrets versions add holaprime-db-url     --data-file=- <<< "postgresql://..."
gcloud secrets versions add holaprime-redis-url  --data-file=- <<< "redis://..."
gcloud secrets versions add holaprime-jwt-secret --data-file=- <<< "your_secret"
gcloud secrets versions add holaprime-jwt-refresh --data-file=- <<< "your_refresh"

# 4. Deploy
gcloud builds submit --config deploy/gcp/cloudbuild.yaml
```

---

## Trading Platforms

Fill in the relevant block in `.env`. The adapter is selected automatically
based on the `platform` field on each `challenge_product`.

All platforms implement the same `IPlatformAdapter` interface:
`healthCheck · createAccount · getAccount · getBalance · getTradeHistory
· getOpenTrades · changePassword · setTradingEnabled · setLeverage
· adjustBalance · deleteAccount`

---

## Common Issues

**`Error: Missing required env var: DATABASE_URL`**
→ Copy `.env` into the `api/` folder: `copy .env api\.env`

**`docker compose` validation error**
→ Make sure you downloaded the latest zip — the first release had a broken docker-compose.yml

**Login fails with invalid credentials**
→ Run the "Reset Admin Password" steps above to regenerate the hash

**Port conflict (5432 or 6379 already in use)**
→ Edit `docker-compose.yml`, change left-side port e.g. `"5433:5432"`, then update `DATABASE_URL` in `.env`
