'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { APP_PAGES, pageKeyFromPath } from '@/lib/auth/permissions';
import { usePermissions } from '@/components/auth/permissions-provider';

/** Redirect away from pages the user is not allowed to open. */
export function PageAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { pages, canAccessPage } = usePermissions();

  useEffect(() => {
    const key = pageKeyFromPath(pathname);
    if (!key) return;
    if (!canAccessPage(key)) {
      const fallbackKey = pages[0];
      const fallback = APP_PAGES.find((p) => p.key === fallbackKey);
      router.replace(fallback?.href || '/dashboard');
    }
  }, [pathname, pages, canAccessPage, router]);

  const key = pageKeyFromPath(pathname);
  if (key && !canAccessPage(key)) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  return <>{children}</>;
}
