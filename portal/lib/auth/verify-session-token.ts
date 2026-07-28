import { jwtVerify } from 'jose';
import type { UserRole } from '@/lib/auth';

const secretKey = process.env.AUTH_SECRET || 'dev-membership-secret-change-me';
const encodedKey = new TextEncoder().encode(secretKey);

export type VerifiedSession = {
  userId: number;
  username: string;
  role: UserRole;
};

export async function verifySessionToken(
  token: string | undefined | null
): Promise<VerifiedSession | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ['HS256'],
    });

    return {
      userId: payload.userId as number,
      username: payload.username as string,
      role: payload.role as UserRole,
    };
  } catch {
    return null;
  }
}

export function isPublicPath(pathname: string, searchParams: URLSearchParams): boolean {
  if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
    return true;
  }

  if (pathname.startsWith('/api/auth/login') || pathname.startsWith('/api/register')) {
    return true;
  }

  if (pathname.startsWith('/api/setup')) {
    if (
      process.env.DESKTOP_MODE === '1' ||
      process.env.DESKTOP_MODE === 'true' ||
      process.env.NODE_ENV !== 'production'
    ) {
      return true;
    }

    const setupSecret = process.env.SETUP_SECRET;
    return Boolean(setupSecret && searchParams.get('secret') === setupSecret);
  }

  return false;
}
