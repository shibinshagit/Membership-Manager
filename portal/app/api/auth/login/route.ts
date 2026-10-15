import { NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { sql } from '@/lib/db';
import { createSession, mapUserRow } from '@/lib/auth';
import { ensureUsersPermissionsSchema } from '@/lib/db/compat';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    await ensureUsersPermissionsSchema();

    const users = await sql`
      SELECT id, username, email, password_hash, full_name, role, phone, is_active, allowed_pages, writable_pages
      FROM users
      WHERE (username = ${username} OR email = ${username}) AND is_active = true
    `;

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const row = users[0] as Record<string, unknown> & { password_hash: string };
    const isValid = await compare(password, row.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = mapUserRow(row);
    await createSession(user);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
