import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { sql } from '@/lib/db';
import { getCurrentUser, canManageUsers, mapUserRow } from '@/lib/auth';
import { ensureUsersPermissionsSchema } from '@/lib/db/compat';
import {
  ALL_APP_PAGE_KEYS,
  ALL_WRITABLE_PAGE_KEYS,
  MANAGEABLE_ROLES,
  parseAllowedPages,
  parseWritablePages,
  type AppPageKey,
  type ManageableRole,
} from '@/lib/auth/permissions';

function normalizeUsername(email: string, fullName: string): string {
  const fromEmail = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, '') || '';
  if (fromEmail.length >= 3) return fromEmail.slice(0, 80);
  const fromName = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
  return (fromName || 'user').slice(0, 80);
}

async function uniqueUsername(base: string): Promise<string> {
  let candidate = base;
  let n = 0;
  while (true) {
    const existing = await sql`SELECT id FROM users WHERE username = ${candidate} LIMIT 1`;
    if (existing.length === 0) return candidate;
    n += 1;
    candidate = `${base.slice(0, 70)}${n}`;
  }
}

function resolvePagePermissions(role: ManageableRole, body: Record<string, unknown>) {
  let allowedPages: AppPageKey[] = ALL_APP_PAGE_KEYS;
  if (body.allowed_pages !== undefined) {
    const parsed = parseAllowedPages(body.allowed_pages);
    if (!parsed || parsed.length === 0) {
      return { error: 'Select at least one page the user can access' as const };
    }
    allowedPages = parsed;
  }

  let writablePages: AppPageKey[] = [];
  if (role === 'welfare') {
    allowedPages = ['members'];
    writablePages = [];
  } else if (role === 'super_admin') {
    allowedPages = [...ALL_APP_PAGE_KEYS];
    writablePages = [...ALL_WRITABLE_PAGE_KEYS];
  } else if (role === 'viewer') {
    writablePages = [];
  } else {
    // editor
    const allowedSet = new Set(allowedPages);
    const parsed =
      body.writable_pages !== undefined
        ? parseWritablePages(body.writable_pages)
        : [...ALL_WRITABLE_PAGE_KEYS];
    writablePages = (parsed || []).filter((k) => allowedSet.has(k));
  }

  return { allowedPages, writablePages };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canManageUsers(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureUsersPermissionsSchema();
    const users = await sql`
      SELECT
        id, username, email, full_name, role, phone, is_active,
        allowed_pages, writable_pages, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `;

    return NextResponse.json({
      users: users.map((row) => mapUserRow(row as Record<string, unknown>)),
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManageUsers(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureUsersPermissionsSchema();
    const body = await request.json();
    const full_name = String(body.full_name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = String(body.role || '') as ManageableRole;
    const phone = body.phone ? String(body.phone).trim() : null;

    if (!full_name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'Name, email, password, and role are required' },
        { status: 400 }
      );
    }

    if (!MANAGEABLE_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'Role must be super_admin, editor, viewer, or welfare' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const pages = resolvePagePermissions(role, body);
    if ('error' in pages) {
      return NextResponse.json({ error: pages.error }, { status: 400 });
    }

    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }

    const username = await uniqueUsername(
      body.username ? String(body.username).trim() : normalizeUsername(email, full_name)
    );
    const passwordHash = await hash(password, 12);
    const allowedJson = JSON.stringify(pages.allowedPages);
    const writableJson = JSON.stringify(pages.writablePages);

    const result = await sql`
      INSERT INTO users (
        username, email, password_hash, full_name, role, phone, allowed_pages, writable_pages
      )
      VALUES (
        ${username},
        ${email},
        ${passwordHash},
        ${full_name},
        ${role},
        ${phone},
        ${allowedJson}::jsonb,
        ${writableJson}::jsonb
      )
      RETURNING id, username, email, full_name, role, phone, is_active,
        allowed_pages, writable_pages, created_at
    `;

    const created = mapUserRow(result[0] as Record<string, unknown>);

    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (
        ${user.id},
        'create',
        'user',
        ${created.id},
        ${JSON.stringify({ ...created, password: '[REDACTED]' })}
      )
    `;

    return NextResponse.json({ user: created }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
