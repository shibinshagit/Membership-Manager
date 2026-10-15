import { NextResponse } from 'next/server';
import {
  getCurrentUser,
  userAllowedPages,
  userWritablePages,
  userCanWrite,
  canManageUsers,
} from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({
    user,
    permissions: {
      canWrite: userCanWrite(user),
      canManageUsers: canManageUsers(user.role),
      pages: userAllowedPages(user),
      writablePages: userWritablePages(user),
    },
  });
}
