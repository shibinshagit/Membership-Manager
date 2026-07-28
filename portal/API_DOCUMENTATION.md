# API Documentation

Base URL (local): `http://localhost:3000`

All dashboard APIs require an authenticated session cookie.

## Auth

- `POST /api/auth/login`
  - Body: `{ username, password }`
  - Returns session and user metadata
- `POST /api/auth/logout`
  - Clears session cookie
- `GET /api/auth/me`
  - Returns current authenticated user

## Setup

- `GET /api/setup`
  - Idempotent bootstrap for DB schema + default users

## Members

- `GET /api/members`
  - Query: `search`, `status`, `executive_id`, `page`, `limit`
- `POST /api/members`
  - Creates new member
- `GET /api/members/:id`
  - Returns member + related documents + fees
- `PUT /api/members/:id`
  - Updates member profile
- `DELETE /api/members/:id`
  - Deletes member (admin roles)

## Executive Assignment

- `GET /api/executives`
  - List assignable users
- `POST /api/executives`
  - Body: `{ member_ids: number[], executive_id: number | null }`
  - Enforces max 10 members per executive

## Documents

- `GET /api/documents`
  - Query: `member_id`, `type`
- `POST /api/documents`
  - Multipart: `file`, `member_id`, `document_type`, optional `expiry_date`
  - Max file size 5MB
- `DELETE /api/documents?id=:id`
  - Deletes document + underlying file
- `GET /api/documents/file?pathname=...`
  - Secure file retrieval/proxy endpoint

## Fees

- `GET /api/fees`
  - Query: `member_id`, `status` (comma-separated), `fee_year`
- `POST /api/fees`
  - Body: `{ member_id, fee_type, fee_year?, amount, currency?, due_date, notes? }`
- `GET /api/fees/:id`
  - Returns specific fee
- `PUT /api/fees/:id`
  - Update status/payment details (`unpaid|partial|paid|overdue`)
- `DELETE /api/fees/:id`
  - Delete fee (admin roles)

## Users

- `GET /api/users`
  - Role-restricted user listing
- `POST /api/users`
  - Create user with role rules
- `GET /api/users/:id`
  - User details + assigned members
- `PUT /api/users/:id`
  - Update profile/role/password/is_active
- `DELETE /api/users/:id`
  - Deletes user, unassigns members

## WhatsApp Logs

- `GET /api/whatsapp`
  - Query: `member_id`, `limit`
- `POST /api/whatsapp`
  - Body: `{ member_id, message_type, message_content?, fee_id?, delivery_status? }`
  - Writes send log and enforces member access scope

## Stats

- `GET /api/stats`
  - Returns dashboard counters and charts with role isolation
