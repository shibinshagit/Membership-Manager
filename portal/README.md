# Membership Portal (tenant app)

Web-based membership management system: members, executives, documents, fees, identity cards.

## Tech stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- PostgreSQL via Neon (hosted) or embedded PGlite (desktop)
- JWT session cookie auth
- Vercel Blob (hosted) or local disk (desktop)

## Quick start (hosted / cloud)

```bash
cd portal
cp .env.example .env.local
npm install   # or pnpm install
npm run dev
```

Open `http://localhost:3050` (run `/api/setup` once to initialize).

Env vars: see `.env.example`.

## Run web + desktop together (shared `portal/` source)

```bash
# Terminal 1 — hosted/web mode (Neon + Blob from .env.local)
cd portal && npm run dev
# → http://localhost:3050

# Terminal 2 — desktop mode (PGlite + local files) against the same codebase
cd desktop && env -u ELECTRON_RUN_AS_NODE npm run dev
# → Electron window on http://127.0.0.1:3051
```

Code changes in `portal/` hot-reload for **both**. Desktop packaging (`desktop/app`) is only needed for EXE builds via `npm run prepare:portal`.

## Offline desktop (Windows EXE)

See [`../desktop/README.md`](../desktop/README.md).

## Docs

- `ADMIN_SETUP.md`
- `USER_MANUAL.md`
- `API_DOCUMENTATION.md`
