import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';
import { useSecureCookies } from '@/lib/runtime-flags';

export type UserRole =
  | 'super_admin'
  | 'president'
  | 'secretary'
  | 'central_committee'
  | 'executive'
  | 'member';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
}

export interface SessionPayload {
  userId: number;
  username: string;
  role: UserRole;
  expiresAt: Date;
}

const secretKey = process.env.AUTH_SECRET || 'dev-membership-secret-change-me';
const encodedKey = new TextEncoder().encode(secretKey);

export async function createSession(user: User) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const session = await new SignJWT({
    userId: user.id,
    username: user.username,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(encodedKey);

  const cookieStore = await cookies();
  cookieStore.set('session', session, {
    httpOnly: true,
    secure: useSecureCookies(),
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  });

  return session;
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;

  if (!session) return null;

  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    });

    return {
      userId: payload.userId as number,
      username: payload.username as string,
      role: payload.role as UserRole,
      expiresAt: new Date(payload.exp! * 1000),
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;

  try {
    const users = await sql`
      SELECT id, username, email, full_name, role, phone, is_active
      FROM users
      WHERE id = ${session.userId} AND is_active = true
    `;

    if (users.length === 0) return null;
    return users[0] as User;
  } catch {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}

// Permission helpers
export function canManageUsers(role: UserRole): boolean {
  return role === 'super_admin' || role === 'president';
}

export function canManageAllMembers(role: UserRole): boolean {
  return role === 'super_admin' || role === 'president' || role === 'secretary';
}

export function canAssignExecutives(role: UserRole): boolean {
  return role === 'super_admin' || role === 'president' || role === 'secretary';
}

export function canViewAuditLogs(role: UserRole): boolean {
  return role === 'super_admin' || role === 'president';
}
