/** Edge-safe runtime flags (no Node built-ins — used by proxy/middleware). */

export function isDesktopMode(): boolean {
  return (
    process.env.DESKTOP_MODE === '1' ||
    process.env.DESKTOP_MODE === 'true' ||
    process.env.STORAGE_DRIVER === 'local' ||
    process.env.DATABASE_DRIVER === 'pg' ||
    process.env.DATABASE_DRIVER === 'pglite'
  );
}

/** Cookies over http://localhost in the desktop shell must not require Secure. */
export function useSecureCookies(): boolean {
  if (isDesktopMode()) return false;
  return process.env.NODE_ENV === 'production';
}
