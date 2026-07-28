# Admin Setup Guide

## 1) Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL database

## 2) Environment Variables

Create `.env.local` in the project root:

```env
DATABASE_URL=postgresql://username:password@host:5432/database
AUTH_SECRET=replace-with-strong-random-secret
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
ADMIN_INITIAL_PASSWORD=choose-a-strong-password-for-first-admin
```

Documents are stored in Vercel Blob (private). `BLOB_READ_WRITE_TOKEN` is required for uploads.

`ADMIN_INITIAL_PASSWORD` is only read when `/api/setup` creates the first super admin account. Store it in your environment or secrets manager — never commit it to git.

## 3) Installation and Start

1. `pnpm install`
2. `pnpm dev`
3. Open `http://localhost:3000/api/setup`

The setup endpoint creates tables and seeds default accounts.

## 4) First Admin Account

If no super admin exists yet, set `ADMIN_INITIAL_PASSWORD` in `.env.local`, then open `/api/setup`. The setup endpoint creates the `admin` user using that env value only — passwords are never stored in source code or returned by the API.

Change the admin password after first login from **Settings**.

## 5) Role Matrix

- `super_admin`: full access
- `president`: full operational access
- `secretary`: member/fee/report operations
- `central_committee`: committee-level view workflows
- `executive`: only assigned members (up to 10)
- `member`: self-service scope

## 6) Production Checklist

- Use a strong `AUTH_SECRET`
- Enable SSL/TLS (reverse proxy or managed cert)
- Configure daily DB backup job (cron + pg_dump or managed backups)
- Restrict DB/network access to app hosts
- Rotate credentials and API tokens regularly
