import { NextResponse } from 'next/server';
import { compare, hash } from 'bcryptjs';
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

async function loadUser(id: string) {
  const rows = await sql`
    SELECT id, username, email, full_name, role, phone, is_active,
      allowed_pages, writable_pages, created_at, password_hash
    FROM users
    WHERE id = ${id}
  `;
  return rows[0] as Record<string, unknown> | undefined;
}

function resolveWritable(
  role: string,
  allowedPages: AppPageKey[],
  body: Record<string, unknown>,
  existingWritable: AppPageKey[] | null
): AppPageKey[] {
  if (role === 'super_admin') return [...ALL_WRITABLE_PAGE_KEYS];
  if (role === 'viewer' || role === 'welfare') return [];
  const allowedSet = new Set(allowedPages);
  const source =
    body.writable_pages !== undefined
      ? parseWritablePages(body.writable_pages)
      : existingWritable;
  return (source || []).filter((k) => allowedSet.has(k));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const isSelf = Number(id) === currentUser.id;
  if (!isSelf && !canManageUsers(currentUser.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureUsersPermissionsSchema();
    const row = await loadUser(id);
    if (!row) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const { password_hash: _, ...safe } = row;
    return NextResponse.json({ user: mapUserRow(safe) });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

async function updateUser(request: Request, params: Promise<{ id: string }>) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const isSelf = Number(id) === currentUser.id;
  const isAdmin = canManageUsers(currentUser.role);

  if (!isSelf && !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureUsersPermissionsSchema();
    const body = await request.json();
    const existing = await loadUser(id);
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (existing.role === 'super_admin' && !isAdmin && !isSelf) {
      return NextResponse.json({ error: 'Cannot modify super admin' }, { status: 403 });
    }

    if (isSelf && !isAdmin) {
      const email =
        body.email != null ? String(body.email).trim().toLowerCase() : String(existing.email);
      const full_name =
        body.full_name != null ? String(body.full_name).trim() : String(existing.full_name);

      let passwordHash = String(existing.password_hash);
      if (body.new_password || body.password) {
        const nextPassword = String(body.new_password || body.password);
        if (nextPassword.length < 6) {
          return NextResponse.json(
            { error: 'Password must be at least 6 characters' },
            { status: 400 }
          );
        }
        if (body.current_password) {
          const ok = await compare(String(body.current_password), passwordHash);
          if (!ok) {
            return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
          }
        }
        passwordHash = await hash(nextPassword, 12);
      }

      const result = await sql`
        UPDATE users SET
          email = ${email},
          full_name = ${full_name},
          password_hash = ${passwordHash},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, username, email, full_name, role, phone, is_active,
          allowed_pages, writable_pages, created_at
      `;
      return NextResponse.json({ user: mapUserRow(result[0] as Record<string, unknown>) });
    }

    const email =
      body.email != null ? String(body.email).trim().toLowerCase() : String(existing.email);
    const full_name =
      body.full_name != null ? String(body.full_name).trim() : String(existing.full_name);
    const phone =
      body.phone !== undefined
        ? body.phone
          ? String(body.phone).trim()
          : null
        : (existing.phone as string | null);
    const is_active =
      body.is_active !== undefined ? Boolean(body.is_active) : Boolean(existing.is_active);

    let role = String(existing.role);
    if (body.role != null) {
      role = String(body.role);
      if (
        !MANAGEABLE_ROLES.includes(role as ManageableRole) &&
        role !== existing.role
      ) {
        if (
          ![
            'super_admin',
            'editor',
            'viewer',
            'president',
            'secretary',
            'central_committee',
            'executive',
            'member',
          ].includes(role)
        ) {
          return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }
      }
    }

    let allowedPages: AppPageKey[] =
      parseAllowedPages(existing.allowed_pages) || [...ALL_APP_PAGE_KEYS];
    if (body.allowed_pages !== undefined) {
      const parsed = parseAllowedPages(body.allowed_pages);
      if (!parsed || parsed.length === 0) {
        return NextResponse.json(
          { error: 'Select at least one page the user can access' },
          { status: 400 }
        );
      }
      allowedPages = parsed;
    }
    if (role === 'super_admin') {
      allowedPages = [...ALL_APP_PAGE_KEYS];
    }
    if (role === 'welfare') {
      allowedPages = ['members'];
    }

    const writablePages = resolveWritable(
      role,
      allowedPages,
      body,
      parseWritablePages(existing.writable_pages)
    );

    let passwordHash: string | null = null;
    if (body.password || body.new_password) {
      const nextPassword = String(body.password || body.new_password);
      if (nextPassword.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters' },
          { status: 400 }
        );
      }
      passwordHash = await hash(nextPassword, 12);
    }

    const allowedJson = JSON.stringify(allowedPages);
    const writableJson = JSON.stringify(writablePages);

    const result = passwordHash
      ? await sql`
          UPDATE users SET
            email = ${email},
            full_name = ${full_name},
            role = ${role},
            phone = ${phone},
            is_active = ${is_active},
            allowed_pages = ${allowedJson}::jsonb,
            writable_pages = ${writableJson}::jsonb,
            password_hash = ${passwordHash},
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING id, username, email, full_name, role, phone, is_active,
            allowed_pages, writable_pages, created_at
        `
      : await sql`
          UPDATE users SET
            email = ${email},
            full_name = ${full_name},
            role = ${role},
            phone = ${phone},
            is_active = ${is_active},
            allowed_pages = ${allowedJson}::jsonb,
            writable_pages = ${writableJson}::jsonb,
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING id, username, email, full_name, role, phone, is_active,
            allowed_pages, writable_pages, created_at
        `;

    const updated = mapUserRow(result[0] as Record<string, unknown>);

    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES (
        ${currentUser.id},
        'update',
        'user',
        ${id},
        ${JSON.stringify({ ...existing, password_hash: '[REDACTED]' })},
        ${JSON.stringify({ ...updated, password: passwordHash ? '[CHANGED]' : '[UNCHANGED]' })}
      )
    `;

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return updateUser(request, params);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return updateUser(request, params);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !canManageUsers(currentUser.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await ensureUsersPermissionsSchema();
    const existing = await loadUser(id);
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (existing.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot delete super admin' }, { status: 403 });
    }

    if (Number(id) === currentUser.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 403 });
    }

    await sql`UPDATE members SET assigned_executive_id = NULL WHERE assigned_executive_id = ${id}`;
    await sql`DELETE FROM users WHERE id = ${id}`;

    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
      VALUES (
        ${currentUser.id},
        'delete',
        'user',
        ${id},
        ${JSON.stringify({ ...existing, password_hash: '[REDACTED]' })}
      )
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
