import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { DashboardSidebar } from '@/components/dashboard/sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen flex bg-muted/30">
      <Suspense fallback={<div className="hidden w-[17.5rem] shrink-0 lg:block" />}>
        <DashboardSidebar />
      </Suspense>
      <main className="flex-1 min-w-0 lg:pl-0 pt-14 lg:pt-0">
        <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
