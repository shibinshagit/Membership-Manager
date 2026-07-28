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

  if (hasStaleSessionCookie) {
    return clearSessionCookie(NextResponse.next());
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*', '/login'],
};
