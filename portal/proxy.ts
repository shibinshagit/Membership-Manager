import { NextResponse, type NextRequest } from 'next/server';
import { isPublicPath, verifySessionToken } from '@/lib/auth/verify-session-token';
import { useSecureCookies } from '@/lib/runtime-flags';

function clearSessionCookie(response: NextResponse) {
  response.cookies.set('session', '', {
    httpOnly: true,
    secure: useSecureCookies(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = isPublicPath(pathname, request.nextUrl.searchParams);
  const rawSession = request.cookies.get('session')?.value;
  const session = await verifySessionToken(rawSession);
  const hasValidSession = session !== null;
  const hasStaleSessionCookie = Boolean(rawSession) && !hasValidSession;

  const needsAuth =
    pathname.startsWith('/dashboard') || pathname.startsWith('/api/');

  if (!isPublic && needsAuth && !hasValidSession) {
    if (pathname.startsWith('/api/')) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      return hasStaleSessionCookie ? clearSessionCookie(response) : response;
    }

    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    return hasStaleSessionCookie ? clearSessionCookie(response) : response;
  }

  if (pathname.startsWith('/login') && hasValidSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Viewers are read-only: block mutating API calls (self profile update still allowed).
  if (
    hasValidSession &&
    session.role === 'viewer' &&
    pathname.startsWith('/api/') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
  ) {
    const isLogout = pathname === '/api/auth/logout';
    const isSelfUserUpdate =
      (request.method === 'PUT' || request.method === 'PATCH') &&
      pathname.startsWith('/api/users/') &&
      pathname === `/api/users/${session.userId}`;

    if (!isLogout && !isSelfUserUpdate) {
      return NextResponse.json(
        { error: 'View-only account. Editing is not allowed.' },
        { status: 403 }
      );
    }
  }

  if (hasStaleSessionCookie) {
    return clearSessionCookie(NextResponse.next());
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*', '/login'],
};
