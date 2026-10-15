import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import {
  getCurrentUser,
  userAllowedPages,
  userWritablePages,
  userCanWrite,
  canManageUsers,
} from '@/lib/auth';
import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { MainShell } from '@/components/dashboard/main-shell';
import { PermissionsProvider } from '@/components/auth/permissions-provider';
import { PageAccessGuard } from '@/components/auth/page-access-guard';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const pages = userAllowedPages(user);
  const writablePages = userWritablePages(user);

  return (
    <PermissionsProvider
      user={user}
      canWrite={userCanWrite(user)}
      canManageUsers={canManageUsers(user.role)}
      pages={pages}
      writablePages={writablePages}
    >
      <div className="flex h-svh overflow-hidden">
        <Suspense fallback={<div className="hidden w-[17.5rem] shrink-0 lg:block" />}>
          <DashboardSidebar />
        </Suspense>
        <MainShell>
          <PageAccessGuard>{children}</PageAccessGuard>
        </MainShell>
      </div>
    </PermissionsProvider>
  );
}
