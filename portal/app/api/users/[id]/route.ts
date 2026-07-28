import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, canManageUsers } from '@/lib/auth';
import { hash } from 'bcryptjs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !canManageUsers(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const users = await sql`
      SELECT 
        u.id, u.username, u.email, u.full_name, u.role, u.phone, u.is_active, u.created_at,
        COUNT(m.id) as member_count
      FROM users u
      LEFT JOIN members m ON m.assigned_executive_id = u.id
      WHERE u.id = ${id}
      GROUP BY u.id
    `;

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get assigned members if executive
    const members = await sql`
      SELECT id, member_id, full_name, status, phone
      FROM members
      WHERE assigned_executive_id = ${id}
      ORDER BY full_name
    `;

    return NextResponse.json({ user: users[0], members });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !canManageUsers(currentUser.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { email, full_name, role, phone, is_active, password } = body;

    // Get current user data
    const existingUser = await sql`SELECT * FROM users WHERE id = ${id}`;

    if (existingUser.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent modifying super admin by non-super admins
    if (existingUser[0].role === 'super_admin' && currentUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Cannot modify super admin' }, { status: 403 });
    }

    // Only super admins can assign president role
    if (role === 'president' && currentUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can assign president role' }, { status: 403 });
    }

    // Build update query
    let result;
    if (password) {
      const passwordHash = await hash(password, 12);
      result = await sql`
        UPDATE users SET
          email = ${email || existingUser[0].email},
          full_name = ${full_name || existingUser[0].full_name},
          role = ${role || existingUser[0].role},
          phone = ${phone ?? existingUser[0].phone},
          is_active = ${is_active ?? existingUser[0].is_active},
          password_hash = ${passwordHash},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, username, email, full_name, role, phone, is_active, created_at
      `;
    } else {
      result = await sql`
        UPDATE users SET
          email = ${email || existingUser[0].email},
          full_name = ${full_name || existingUser[0].full_name},
          role = ${role || existingUser[0].role},
          phone = ${phone ?? existingUser[0].phone},
          is_active = ${is_active ?? existingUser[0].is_active},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, username, email, full_name, role, phone, is_active, created_at
      `;
    }

    // Log the update
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES (${currentUser.id}, 'update', 'user', ${id}, 
        ${JSON.stringify({ ...existingUser[0], password_hash: '[REDACTED]' })},
        ${JSON.stringify({ ...result[0], password: password ? '[CHANGED]' : '[UNCHANGED]' })})
    `;

    return NextResponse.json({ user: result[0] });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !canManageUsers(currentUser.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existingUser = await sql`SELECT * FROM users WHERE id = ${id}`;

    if (existingUser.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Cannot delete super admin
    if (existingUser[0].role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot delete super admin' }, { status: 403 });
    }

    // Cannot delete yourself
    if (parseInt(id) === currentUser.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 403 });
    }

    // Unassign members first
    await sql`UPDATE members SET assigned_executive_id = NULL WHERE assigned_executive_id = ${id}`;

    await sql`DELETE FROM users WHERE id = ${id}`;

    // Log deletion
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
      VALUES (${currentUser.id}, 'delete', 'user', ${id}, ${JSON.stringify({ ...existingUser[0], password_hash: '[REDACTED]' })})
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
