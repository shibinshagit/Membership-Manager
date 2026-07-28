import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, canManageUsers } from '@/lib/auth';
import { hash } from 'bcryptjs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canManageUsers(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all users for privileged roles
    const users = await sql`
      SELECT 
        u.id, u.username, u.email, u.full_name, u.role, u.phone, u.is_active, u.created_at,
        COUNT(m.id) as member_count
      FROM users u
      LEFT JOIN members m ON m.assigned_executive_id = u.id
      WHERE u.role != 'super_admin' OR ${user.role === 'super_admin'}
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `;

    return NextResponse.json({ users });
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
    const body = await request.json();
    const { username, email, password, full_name, role, phone } = body;

    if (!username || !email || !password || !full_name || !role) {
      return NextResponse.json(
        { error: 'Username, email, password, full name, and role are required' },
        { status: 400 }
      );
    }

    // Only super_admin can create presidents.
    if (role === 'president' && user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super admins can create president users' },
        { status: 403 }
      );
    }

    // Super admin can only be created via setup
    if (role === 'super_admin') {
      return NextResponse.json(
        { error: 'Cannot create super admin users' },
        { status: 403 }
      );
    }

    // Check if username or email exists
    const existing = await sql`
      SELECT id FROM users WHERE username = ${username} OR email = ${email}
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Username or email already exists' },
        { status: 400 }
      );
    }

    const passwordHash = await hash(password, 12);

    const result = await sql`
      INSERT INTO users (username, email, password_hash, full_name, role, phone)
      VALUES (${username}, ${email}, ${passwordHash}, ${full_name}, ${role}, ${phone || null})
      RETURNING id, username, email, full_name, role, phone, is_active, created_at
    `;

    // Log the action
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (${user.id}, 'create', 'user', ${result[0].id}, ${JSON.stringify({ ...result[0], password: '[REDACTED]' })})
    `;

    return NextResponse.json({ user: result[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
