'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { AppPageKey } from '@/lib/auth/permissions';
import type { UserRole } from '@/lib/auth';

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole | string;
  phone?: string | null;
  is_active?: boolean;
  allowed_pages?: AppPageKey[] | null;
  writable_pages?: AppPageKey[] | null;
};

type PermissionsContextValue = {
  user: AuthUser;
  canWrite: boolean;
  canManageUsers: boolean;
  pages: AppPageKey[];
  writablePages: AppPageKey[];
  canAccessPage: (key: AppPageKey) => boolean;
  canWritePage: (key: AppPageKey) => boolean;
};

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({
  user,
  canWrite,
  canManageUsers,
  pages,
  writablePages,
  children,
}: {
  user: AuthUser;
  canWrite: boolean;
  canManageUsers: boolean;
  pages: AppPageKey[];
  writablePages: AppPageKey[];
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({
      user,
      canWrite,
      canManageUsers,
      pages,
      writablePages,
      canAccessPage: (key: AppPageKey) => pages.includes(key),
      canWritePage: (key: AppPageKey) => writablePages.includes(key),
    }),
    [user, canWrite, canManageUsers, pages, writablePages]
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    throw new Error('usePermissions must be used within PermissionsProvider');
  }
  return ctx;
}

export function usePermissionsOptional() {
  return useContext(PermissionsContext);
}
