import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';
import { useSecureCookies } from '@/lib/runtime-flags';
import { ensureUsersPermissionsSchema } from '@/lib/db/compat';
import {
  canManagePortalUsers,
  canWriteData,
  effectiveAllowedPages,
  effectiveWritablePages,
  isFullAdminRole,
  parseAllowedPages,
  parseWritablePages,
  type AppPageKey,
} from '@/lib/auth/permissions';

export type UserRole =
  | 'super_admin'
  | 'editor'
  | 'viewer'
  | 'president'
  | 'secretary'
  | 'central_committee'
  | 'executive'
  | 'member'
  | 'welfare';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
  allowed_pages: AppPageKey[] | null;
  writable_pages: AppPageKey[] | null;
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
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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

function mapUserRow(row: Record<string, unknown>): User {
  return {
    id: Number(row.id),
    username: String(row.username),
    email: String(row.email),
    full_name: String(row.full_name),
    role: row.role as UserRole,
    phone: row.phone == null ? null : String(row.phone),
    is_active: Boolean(row.is_active),
    allowed_pages: parseAllowedPages(row.allowed_pages),
    writable_pages: parseWritablePages(row.writable_pages),
  };
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;

  try {
    await ensureUsersPermissionsSchema();
    const users = await sql`
      SELECT id, username, email, full_name, role, phone, is_active, allowed_pages, writable_pages
      FROM users
      WHERE id = ${session.userId} AND is_active = true
    `;

    if (users.length === 0) return null;
    return mapUserRow(users[0] as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}

export function canManageUsers(role: UserRole): boolean {
  return canManagePortalUsers(role);
}

/** Legacy full admins (not editors — use userHasAdminWrite for page-scoped edits). */
export function canManageAllMembers(role: UserRole): boolean {
  return isFullAdminRole(role);
}

export function canAssignExecutives(role: UserRole): boolean {
  return canManageAllMembers(role);
}

export function canViewAuditLogs(role: UserRole): boolean {
  return role === 'super_admin' || role === 'president';
}

export function userCanWrite(user: Pick<User, 'role' | 'allowed_pages' | 'writable_pages'>): boolean {
  if (!canWriteData(user.role)) return false;
  if (user.role === 'editor') {
    return effectiveWritablePages(user.role, user.allowed_pages, user.writable_pages).length > 0;
  }
  return true;
}

export function userAllowedPages(user: Pick<User, 'role' | 'allowed_pages'>): AppPageKey[] {
  return effectiveAllowedPages(user.role, user.allowed_pages);
}

export function userWritablePages(
  user: Pick<User, 'role' | 'allowed_pages' | 'writable_pages'>
): AppPageKey[] {
  return effectiveWritablePages(user.role, user.allowed_pages, user.writable_pages);
}

export function userCanWritePage(
  user: Pick<User, 'role' | 'allowed_pages' | 'writable_pages'>,
  page: AppPageKey
): boolean {
  return userWritablePages(user).includes(page);
}

/** Admin-wide read scope for a page (see all records, not only assigned). */
export function userHasAdminRead(
  user: Pick<User, 'role' | 'allowed_pages'>,
  page: AppPageKey
): boolean {
  if (isFullAdminRole(user.role)) return true;
  if (user.role === 'editor' || user.role === 'viewer') {
    return effectiveAllowedPages(user.role, user.allowed_pages).includes(page);
  }
  return false;
}

/** Admin write on a specific page (add / edit / delete). */
export function userHasAdminWrite(
  user: Pick<User, 'role' | 'allowed_pages' | 'writable_pages'>,
  page: AppPageKey
): boolean {
  if (isFullAdminRole(user.role)) return true;
  if (user.role === 'editor') return userCanWritePage(user, page);
  return false;
}

/** Read access for privileged pages (accounts, committee, central committee). */
export function canReadPrivilegedPage(
  user: Pick<User, 'role' | 'allowed_pages'>,
  page: AppPageKey
): boolean {
  return userHasAdminRead(user, page);
}

export { mapUserRow };
