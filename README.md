# RevCloud — People Analytics & Strategy Platform

An end-to-end platform that turns raw HR data into a diagnosis of workforce
health and an early warning on the risks building inside it: marketing site,
JWT authentication with role-based access control, a pandas ETL pipeline,
live-updating analytics dashboards, and a trained attrition model that explains
its own scores.

Built against the RevCloud *Product & Implementation Brief v2.0*.

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **Next.js 16** (App Router, TypeScript, Tailwind v4) | React 19, Turbopack |
| Backend | **Python / FastAPI** | Deployed as a Vercel Python serverless function |
| Auth | **JWT** | bcrypt hashes, httpOnly cookies, access + refresh, idle auto-logout |
| Database | **PostgreSQL** | SQLAlchemy 2.0 async + asyncpg |
| ETL | **Python + pandas** | Extract → transform → score → load → aggregate → notify |
| Real-time | **Server-Sent Events** | See [why not Socket.io](#why-sse-and-not-socketio) |
| Charts | **Recharts** | Plus a CSS-grid heatmap |
| ML | **scikit-learn offline → JSON at runtime** | Keeps scipy/sklearn out of the deployed bundle |
| Hosting | **Vercel** | One repo, one deploy, one URL |

---

## Quick start

Prerequisites: Node 20+, Python 3.11+, Docker (for the local database).

```bash
# 1. Frontend dependencies
npm install

# 2. Python environment
python -m venv .venv
.venv\Scripts\activate            # Windows
# source .venv/bin/activate       # macOS / Linux
pip install -r requirements-dev.txt

# 3. Configuration
cp .env.example .env.local
#   then set JWT_SECRET:  python -c "import secrets;print(secrets.token_urlsafe(48))"

# 4. Database + schema + demo users + the starter dataset
npm run db:up
python -m scripts.bootstrap_db --reset

# 5. Train the attrition model (writes backend/ml/model.json)
python -m scripts.train_model

# 6. Run both servers
npm run dev
```

Open **http://localhost:3000**.

> Use `localhost`, not `127.0.0.1`. Next 16 blocks cross-origin requests to
> dev-only resources; the two hostnames are different origins, and hitting the
> wrong one leaves the page server-rendered but never hydrated. `next.config.ts`
> allows both, but `localhost` is the path of least resistance.

### Demo accounts

| Role | Email | Password | Sees |
|---|---|---|---|
| Admin / HR Leader | `admin@revcloud.io` | `Admin123!` | Everything, plus ingestion and user management |
| Manager | `manager@revcloud.io` | `Manager123!` | Research & Development only |
| Viewer | `viewer@revcloud.io` | `Viewer123!` | Company-wide dashboards, read-only |

Signing in as the manager and then the admin is the fastest way to see the
access scoping actually bite.

---

## What is in it

### Public site (`/`)
Hero, the four metric families, a three-step "how it works", testimonials,
a demo-request form that writes to the database, and Privacy / Terms / Contact
pages. Headline stats are read live from the API.

### Authentication
Registration, login, password reset, and session refresh. Access tokens live
15 minutes and are renewed silently while you work; refresh tokens live 7 days.
Both are httpOnly, so JavaScript cannot read them. Sessions end automatically
after 30 minutes of inactivity, with a warning first.

Self-registration always produces a **viewer** — elevation is an admin action,
so signing up can never widen access to employee data on its own.

### Role-based access control
Enforced in the query layer, not the interface. A manager's department comes
from their token and is applied to every query before any request parameter is
considered, so scope cannot be widened by editing a URL. Asking for another
department silently returns your own; requesting an out-of-scope employee
returns 404 rather than 403, so the endpoint cannot be used to probe for who
exists.

### Dashboards
* **Overview** — headcount, attrition rate, average satisfaction and income;
  gender donut; attrition by department; attrition by age group × gender;
  attrition trend. Click a department bar to filter the whole page.
* **Talent & Retention** — tenure vs income scatter, job-role treemap,
  department × tenure heatmap, pay equity, and the ranked high-risk table.
  CSV export (server-side, RBAC-scoped) and PDF export (client-side).
* **Employees** — searchable directory and full profiles with engagement
  meters, tenure history, and per-person risk drivers.
* **Admin** — CSV ingestion, user management, annual-revenue setting, audit
  log, and the demo-request inbox.

Filters live in the URL, so a filtered view is shareable and Back works.

---

## Design decisions

### Why SSE and not Socket.io

The brief offered either. The traffic here is strictly one-directional — the
server says "the data changed" and dashboards refetch — so a bidirectional
socket buys nothing. SSE is plain HTTP, needs no separate socket server or
sticky sessions on Vercel, and `EventSource` reconnects on its own.

Change detection watches an integer in a single-row table rather than using
Postgres `LISTEN/NOTIFY`: NOTIFY needs a connection held open for the
listener's lifetime, which neither a serverless function nor a transaction-mode
pooler will give you. The stream closes itself at ~50s to stay inside Vercel's
60s function ceiling; the browser reconnects immediately.

### Why the model is trained offline

`scripts/train_model.py` fits a logistic regression with scikit-learn and
exports coefficients, standardisation parameters and one-hot levels to
`backend/ml/model.json` (10 KB). At runtime `backend/ml/score.py` reads that
file and scores with numpy alone.

This is not premature optimisation. The measured runtime bundle is **~180 MB
against Vercel's 250 MB limit**; scikit-learn drags in scipy and would add
roughly 130 MB, blowing the cap. Shipping coefficients avoids that entirely.

A linear model is also a deliberate choice over gradient boosting: the product
shows *why* someone is flagged, and for a linear model "contribution =
coefficient × standardised value" is exactly true rather than a post-hoc
approximation.

**Model quality** — 5-fold cross-validated ROC-AUC **0.826 ± 0.023**
(held-out 0.809, PR-AUC 0.559, Brier 0.148) on 1,470 rows with 44 features.
Strongest signals: overtime, frequent business travel, being single, and the
Sales Representative / Laboratory Technician roles. Leakage was excluded
deliberately — the target, anything derived from it, and the engagement index
(a perfect linear combination of its five components).

### Metrics the dataset cannot support

The brief asks for Time-to-Hire, Cost-per-Hire, Offer Acceptance Rate and
Absenteeism. **The IBM HR extract contains no requisition, applicant,
attendance or finance data**, so none of them can be computed honestly.

Rather than inventing plausible numbers, the platform declares them
unavailable and names the feed each one needs. The **Data Coverage** panel on
the Overview reports 12 metrics available and 5 needing a feed. Revenue per
Employee is treated as *unlockable*: it turns on the moment an admin enters an
annual revenue figure in Admin → Settings.

Two further honesty notes, surfaced in the UI wherever they appear:

* **Hire and exit dates are derived.** The source has no calendar dates, only
  `YearsAtCompany`. Dates are reconstructed deterministically against a fixed
  2023-12-31 reference so the trend chart exists and re-ingesting the same file
  is idempotent. Good for shape and seasonality, not for exact monthly counts.
* **eNPS is a proxy.** There is no recommend-to-a-friend question; promoters
  and detractors are inferred from the engagement index.

The gender pay gap is reported as measured. In this dataset women earn ~4.8%
*more* than men on average, and the UI says so rather than forcing the number
into an expected direction.

---

## Architecture

```
├── src/                     Next.js App Router
│   ├── app/
│   │   ├── page.tsx             landing
│   │   ├── (auth)/              login, register, forgot/reset password
│   │   ├── (legal)/             privacy, terms, contact
│   │   └── dashboard/           overview, talent-retention, employees, admin
│   ├── components/          UI, charts, dashboard widgets
│   ├── lib/                 API client, auth context, formatting, chart theme
│   └── proxy.ts             route guard (Next 16 renamed middleware → proxy)
│
├── api/index.py             Vercel Python entrypoint → backend.main:app
├── backend/
│   ├── main.py              FastAPI app factory
│   ├── models.py            SQLAlchemy schema
│   ├── deps.py              auth dependencies, DataScope (RBAC), audit
│   ├── analytics.py         filter semantics + aggregate queries
│   ├── metric_catalog.py    what this dataset can and cannot support
│   ├── etl/                 transform + pipeline
│   ├── ml/                  runtime scorer + model.json
│   └── routers/             auth, public, analytics, employees, exports, events, admin
│
└── scripts/
    ├── bootstrap_db.py      schema + demo users + starter ingest
    ├── train_model.py       offline trainer
    ├── smoke_test.py        62 API checks
    └── verify_ui.mjs        52 browser checks (Playwright)
```

### Database

`users`, `password_reset_tokens`, `employees`, `kpi_snapshots`, `audit_logs`,
`demo_requests`, `ingest_runs`, `realtime_state`, `app_settings`.

`kpi_snapshots` holds metrics pre-aggregated at ingest time. The unfiltered
company view reads from it instead of scanning `employees`; any filter or
manager scope falls through to a live aggregate.

### ETL

Upload → validate columns → coerce types → repair missing values (median fill,
reporting every repair) → drop the three constant columns → derive age group,
tenure band, income band, engagement index, eNPS category, early-attrition flag
and synthesized dates → score attrition risk → replace `employees` → recompute
`kpi_snapshots` → bump the realtime counter. The whole run is one transaction,
so a failure leaves the previous dataset intact.

---

## Verification

```bash
npm run verify:api    # 62 API checks — RBAC, filters, exports, session lifecycle
npm run verify:ui     # 52 browser checks — charts, drill-down, SSE, dark mode
npm run verify        # both
```

Both suites run against a live server. The browser suite drives real Chromium,
fails on any console error, and covers things curl cannot: that charts actually
paint, that clicking a bar filters the dashboard, that a manager never sees
another department's data on screen, and that an admin's upload reaches a
second user's open dashboard over SSE without a reload.

The API suite includes the escalation attempts specifically — a manager asking
for `?department=Sales`, and a manager fetching a Sales employee by ID.

---

## Deploying to Vercel

1. **Push to GitHub.**

   ```bash
   git add -A
   git commit -m "RevCloud People Analytics platform"
   git remote add origin git@github.com:<you>/<repo>.git
   git push -u origin main
   ```

2. **Import the repo in Vercel.** The Next.js preset is detected
   automatically; `vercel.json` configures the Python function.

3. **Set environment variables** (Project → Settings → Environment Variables):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | your Postgres URL — the app rewrites `postgres://` and `sslmode=` to what asyncpg needs |
   | `JWT_SECRET` | `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
   | `ENVIRONMENT` | `production` — this is what marks cookies `Secure` |
   | `APP_BASE_URL` | `https://<your-app>.vercel.app` |
   | `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | for the first bootstrap |

4. **Deploy**, then create the schema against the production database by
   pointing `DATABASE_URL` at it locally and running:

   ```bash
   python -m scripts.bootstrap_db
   ```

5. **Check `/api/py/health`** — it reports database connectivity and whether
   the model artefact loaded.

### Things to know about this deployment shape

* `next.config.ts` rewrites `/api/py/*` onto the single function at
  `api/index.py`. In development the same paths proxy to a local uvicorn, so
  the browser always sees one origin and cookies stay first-party.
* SSE streams end every ~50s by design; `EventSource` reconnects. On a plan
  with a longer function ceiling, raise `STREAM_LIFETIME_SECONDS` in
  `backend/routers/events.py`.
* Use a pooled connection string. The engine uses `NullPool` with
  `statement_cache_size=0`, which is what transaction-mode poolers require.
* `requirements-dev.txt` (scikit-learn, uvicorn, Playwright helpers) is never
  deployed — only `requirements.txt` is.

---

## Security notes

* bcrypt password hashing; failed logins for unknown emails run a real bcrypt
  round so response time does not reveal which addresses are registered.
* `/forgot-password` always returns the same response, so it cannot be used to
  enumerate accounts. Reset tokens are stored only as SHA-256 hashes.
* A `token_version` counter on each user is carried in both tokens and checked
  on every request, so logout, a password reset, or an admin changing someone's
  role revokes their live sessions immediately rather than at token expiry.
* Every dashboard read is audited; opening an individual employee profile is
  audited per record.
* The route guard in `proxy.ts` is an *optimistic* check on a non-secret hint
  cookie. It decides what to render, never what is authorised — the API
  authenticates and scopes every request independently.

## Known limitations

* Email delivery defaults to `console`: reset links are written to the server
  log. Set `PASSWORD_RESET_DELIVERY=smtp` plus the `SMTP_*` variables for real
  mail.
* No Google SSO or MFA — the brief lists both as optional/future.
* The attrition model is trained on 1,470 rows of public sample data. Retrain
  on real data before drawing any conclusion from a score.
* `npm run lint` reports 10 warnings, all the React Compiler's
  `set-state-in-effect` rule firing on standard fetch-with-loading-flag
  effects. The rationale for downgrading it from error is documented inline in
  `eslint.config.mjs`.
