/** App pages that can be granted / revoked per user. */
export const APP_PAGES = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { key: 'members', label: 'Members', href: '/dashboard/members' },
  { key: 'documents', label: 'Documents', href: '/dashboard/documents' },
  { key: 'fees', label: 'Fees & Payments', href: '/dashboard/fees' },
  { key: 'accounts', label: 'Accounts', href: '/dashboard/accounts' },
  { key: 'executives', label: 'Central Committee', href: '/dashboard/executives' },
  { key: 'committee', label: 'Committee', href: '/dashboard/committee' },
  { key: 'settings', label: 'Settings', href: '/dashboard/settings' },
] as const;

export type AppPageKey = (typeof APP_PAGES)[number]['key'];

export const ALL_APP_PAGE_KEYS: AppPageKey[] = APP_PAGES.map((p) => p.key);

/** Pages where add/edit can be granted (dashboard/settings are view-only toggles). */
export const WRITABLE_APP_PAGES = APP_PAGES.filter(
  (p) => p.key !== 'dashboard' && p.key !== 'settings'
);

export const ALL_WRITABLE_PAGE_KEYS: AppPageKey[] = WRITABLE_APP_PAGES.map((p) => p.key);

export const MANAGEABLE_ROLES = ['super_admin', 'editor', 'viewer'] as const;
export type ManageableRole = (typeof MANAGEABLE_ROLES)[number];

export function parseAllowedPages(raw: unknown): AppPageKey[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const keys = new Set(ALL_APP_PAGE_KEYS);
    return raw.filter((k): k is AppPageKey => typeof k === 'string' && keys.has(k as AppPageKey));
  }
  if (typeof raw === 'string') {
    try {
      return parseAllowedPages(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  return null;
}

export function parseWritablePages(raw: unknown): AppPageKey[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const keys = new Set(ALL_WRITABLE_PAGE_KEYS);
    return raw.filter((k): k is AppPageKey => typeof k === 'string' && keys.has(k as AppPageKey));
  }
  if (typeof raw === 'string') {
    try {
      return parseWritablePages(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  return null;
}

export function effectiveAllowedPages(
  role: string,
  allowedPages: AppPageKey[] | null | undefined
): AppPageKey[] {
  if (role === 'super_admin') return [...ALL_APP_PAGE_KEYS];
  if (allowedPages && allowedPages.length > 0) return allowedPages;
  if (role === 'viewer' || role === 'editor') return [...ALL_APP_PAGE_KEYS];
  return [...ALL_APP_PAGE_KEYS];
}

/** Pages where this user may add/edit. Always a subset of allowed pages for editors. */
export function effectiveWritablePages(
  role: string,
  allowedPages: AppPageKey[] | null | undefined,
  writablePages: AppPageKey[] | null | undefined
): AppPageKey[] {
  if (role === 'super_admin') return [...ALL_WRITABLE_PAGE_KEYS];
  if (role === 'viewer') return [];
  if (role === 'president' || role === 'secretary') return [...ALL_WRITABLE_PAGE_KEYS];

  if (role === 'editor') {
    const allowed = new Set(effectiveAllowedPages(role, allowedPages));
    const writable =
      writablePages && writablePages.length > 0
        ? writablePages
        : [...ALL_WRITABLE_PAGE_KEYS];
    return writable.filter((k) => allowed.has(k) && ALL_WRITABLE_PAGE_KEYS.includes(k));
  }

  return [];
}

export function canAccessPage(
  role: string,
  allowedPages: AppPageKey[] | null | undefined,
  pageKey: AppPageKey
): boolean {
  return effectiveAllowedPages(role, allowedPages).includes(pageKey);
}

export function pageKeyFromPath(pathname: string): AppPageKey | null {
  if (pathname === '/dashboard' || pathname === '/dashboard/') return 'dashboard';
  if (pathname.startsWith('/dashboard/members')) return 'members';
  if (pathname.startsWith('/dashboard/documents')) return 'documents';
  if (pathname.startsWith('/dashboard/fees')) return 'fees';
  if (pathname.startsWith('/dashboard/accounts')) return 'accounts';
  if (pathname.startsWith('/dashboard/executives')) return 'executives';
  if (pathname.startsWith('/dashboard/committee')) return 'committee';
  if (pathname.startsWith('/dashboard/settings')) return 'settings';
  return null;
}

export function navHrefToPageKey(href: string): AppPageKey | null {
  return pageKeyFromPath(href.split('?')[0]);
}

/** Any write capability at all (not view-only). */
export function canWriteData(role: string): boolean {
  return role !== 'viewer';
}

export function canManagePortalUsers(role: string): boolean {
  return role === 'super_admin';
}

export function isFullAdminRole(role: string): boolean {
  return role === 'super_admin' || role === 'president' || role === 'secretary';
}
