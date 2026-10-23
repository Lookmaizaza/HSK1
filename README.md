# 语 ปากจีน (Yupakjeen) — HSK Pronunciation Learning App

SvelteKit learner app for HSK 1–3 pronunciation practice, with an ONNX speech
engine, xAPI telemetry, a PDPA-aware research pipeline, and a full admin
dashboard.

## Stack

- **Frontend:** SvelteKit 2 + Svelte 5 (runes), Tailwind CSS 4
- **Database:** Turso/libSQL (remote) with local `file:data/hsk.db` fallback;
  optional Neon PostgreSQL mirror
- **Speech:** `onnxruntime-web` tone/GOP analysis in the browser — raw audio is
  never uploaded or stored
- **Backend (optional):** FastAPI + asyncpg telemetry microservice in `backend/`

## Local development

Requirements: Node.js 20+ and npm.

```sh
npm install
cp .env.example .env      # fill what you need; everything is optional locally
npm run dev               # http://localhost:5173
```

Useful commands:

```sh
npm run check             # svelte-check (types + Svelte warnings)
npm run build             # production build (adapter-node on Windows/self-host)
node build                # run the built server
npm run preview           # preview the build
npm run db:inspect        # inspect local SQLite data
npm run db:create-admin -- admin   # seed or rotate an admin in the target DB
npm run export:eval       # export evaluation data for analysis
```

The database schema is created and migrated automatically at first access. In
development the app writes to `data/hsk.db` unless `TURSO_DATABASE_URL` is set.

## Admin dashboard

Admin access is granted by username through `ADMIN_USERNAMES`. The account
itself must be seeded directly in the database: public sign-up refuses any
username listed in `ADMIN_USERNAMES`, so an admin name cannot be claimed by a
visitor.

1. Set `ADMIN_USERNAMES=admin` in `.env`, or in the Vercel project settings.
2. Seed (or rotate) the account against the same database the app uses:

   ```sh
   npm run db:create-admin -- admin
   ```

   The script reads `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` from the
   environment or `.env`, refuses to overwrite an existing account unless you
   pass `--update-password`, and prints a generated password once. Set
   `ADMIN_PASSWORD` to choose your own (minimum 12 characters). For the local
   SQLite file, point `TURSO_DATABASE_URL` at `file:data/hsk.db`.
3. Open `/admin` and sign in.

The admin dashboard includes overview KPIs, per-learner drilldown, stage
management with override editing, practice-mode analytics, audit logs, and
PDPA research exports (anonymized CSV / JSON xAPI). The header search box opens
the matching tab for learners or stages.

Admin usernames default to **none** — `/admin` stays locked until explicitly
configured. Login attempts are rate limited (5 failures / 10 minutes per IP and
username).

## Privacy / PDPA

- Consent is checked server-side; the consent modal is only shown when the DB
  has no consent record for the learner.
- Research telemetry (`score-ingest`, `stage-event`) is persisted only for
  logged-in learners with `pdpa_research_telemetry` consent. Anonymous payloads
  are accepted but not written to the research tables.
- Research exports pseudonymize user IDs with `RESEARCH_EXPORT_SALT`.
- No audio blobs are uploaded to the server; only scores/features are sent.
- API responses include `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, and `Cross-Origin-Opener-Policy`.
- Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` outside dev.

## Deploy

**Vercel:** import the repository with the project root set to the folder that
contains `package.json`. The build automatically selects
`@sveltejs/adapter-vercel` when `VERCEL` is present. `.vercelignore` keeps
`.env`, `data/`, local SQLite files, `backend/`, `docs/`, and `scripts/` out of
the upload.

Set these in **Project → Settings → Environment Variables** for Production and
Preview:

| Variable | Required | Purpose |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | Yes | Remote libSQL URL — serverless has no writable disk |
| `TURSO_AUTH_TOKEN` | Yes | Turso token with read/write access |
| `ADMIN_USERNAMES` | Yes for `/admin` | Comma-separated admin usernames; blank locks the dashboard |
| `RESEARCH_EXPORT_SALT` | Yes | Long random salt for pseudonymized PDPA exports |
| `OPENROUTER_API_KEY` | Optional | Server key for Gemini; without it users must paste their own key |
| `THAILLM_API_KEY` | Optional | Server key for Pathumma (the default model) |
| `DATABASE_URL` | Optional | Neon mirror used by telemetry/backend tooling |

Seed the admin **after** setting the production database variables, from a
machine that has them in its environment (never commit them):

```sh
npm run db:create-admin -- admin
```

Redeploy after changing variables so every serverless instance picks up the new
`ADMIN_USERNAMES`. Local development should keep `TURSO_*` blank so it cannot
write to production `data/hsk.db` by accident.

> **Secrets:** never commit `.env`, database tokens, or `data/*.db`. Rotate any
> credential that has been pasted into a chat, ticket, or log.
>
> **Rate limits:** login and AI limits are in-memory per serverless instance.
> They slow abuse but are not a globally shared quota — use Turso/Upstash if you
> need hard cross-instance limits.

**Node / self-hosted:**

```sh
npm run build
node build
```

Set `ORIGIN` (e.g. `https://your-domain.com`) and, for production data, the
`TURSO_*` variables. Do not run with blank `TURSO_*` on a read-only filesystem —
the local fallback needs a writable `data/` directory.

**FastAPI backend (optional):**

```sh
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Configure `DATABASE_URL` (Neon) and `CORS_ORIGINS` (comma-separated origins,
never `*` with credentials). Tables are created automatically on startup; a
reference schema lives in `backend/schema.sql`.

## Project layout

```
src/
  routes/            pages + API endpoints (learner app, auth, /admin)
  lib/
    components/      shared UI, consent modal, assessment prompt
    server/          db, rate limiting, server-only helpers
    data/            lessons, scenarios, quest stage definitions
  hooks.server.ts    auth session, impersonation, security headers
backend/             FastAPI telemetry microservice
scripts/
  database/          DB inspection and research export utilities
  data/              vocabulary/data preparation
  training/          AISHELL-3 tone-model training
  tests/             ad-hoc verification scripts
docs/
  reference/         HSK vocabulary PDFs, architecture deck
  drafts/            planning and design drafts
  research/          benchmark notes
static/              public assets (audio, ONNX models)
data/                local SQLite database (gitignored)
```

## License / attribution

Vocabulary data follows the New HSK 1–3 lists. Audio and model assets are used
for educational purposes; check their original licenses before redistribution.
