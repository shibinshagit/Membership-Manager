# Membership Portal — Desktop (offline EXE)

Windows-installable desktop build for people who do not want cloud hosting.

- Same Membership Portal UI in Electron
- **Embedded database (PGlite)** — **no PostgreSQL install**
- Documents on **local disk** (not Vercel Blob)
- Lives in this `desktop/` folder at the repo root

The hosted web app in `portal/` still uses Vercel / Neon / Blob when `DESKTOP_MODE` is off.

## What end users need

Just the app installer. **No PostgreSQL. No Docker. No cloud account.**

| Piece | Automatic? | Where |
|--------|------------|--------|
| App UI + local server | Yes | Installed app |
| Database | Yes (embedded) | App user-data `db/` |
| Tables + admin | Yes on first launch | Embedded DB |
| Document files | Local disk | App user-data `uploads/` |

### macOS paths
- DB: `~/Library/Application Support/membership-portal-desktop/db/`
- Files: `~/Library/Application Support/membership-portal-desktop/uploads/`

### Windows paths
- DB: `%APPDATA%\membership-portal-desktop\db\`
- Files: `%APPDATA%\membership-portal-desktop\uploads\`

### After install
1. Open the app → login `admin` / `Admin@12345`
2. **Settings → Data import** → upload `db-backup-*.sql` once (optional)
3. Copy blob backup `documents/` into the uploads folder

## Build the Windows installer (EXE)

```bash
cd desktop
npm install
npm run dist:win
```

Output: `desktop/release/MembershipPortal-Setup-1.0.0.exe`

## Run on Mac (dev)

```bash
cd desktop
npm install
npm run prepare:portal
env -u ELECTRON_RUN_AS_NODE npm run dev
```

## Architecture

```
desktop/
  electron/main.js     # starts Next standalone + BrowserWindow
  app/                 # generated Next standalone server
  resources/           # install notes + default env
  release/             # EXE output
portal/                # shared Next.js app (Neon hosted OR PGlite desktop)
```
