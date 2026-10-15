'use client';

import type { AppPageKey } from '@/lib/auth/permissions';
import { usePermissionsOptional } from '@/components/auth/permissions-provider';

/** Hide children for view-only users, or when they lack write on a specific page. */
export function WriteOnly({
  page,
  children,
}: {
  page?: AppPageKey;
  children: React.ReactNode;
}) {
  const permissions = usePermissionsOptional();
  if (!permissions) return <>{children}</>;
  if (!permissions.canWrite) return null;
  if (page && !permissions.canWritePage(page)) return null;
  return <>{children}</>;
}
