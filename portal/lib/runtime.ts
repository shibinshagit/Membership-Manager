import path from 'node:path';
import { isDesktopMode } from '@/lib/runtime-flags';

export { isDesktopMode, useSecureCookies } from '@/lib/runtime-flags';

/** Embedded PGlite (no Postgres install). Default for desktop. */
export function useEmbeddedDatabase(): boolean {
  if (process.env.DATABASE_DRIVER === 'pglite') return true;
  if (process.env.DATABASE_DRIVER === 'pg') return false;
  if (process.env.DATABASE_DRIVER === 'neon') return false;
  return isDesktopMode();
}

/** Prefer TCP `pg` driver (optional advanced local Postgres). */
export function useLocalPostgres(): boolean {
  return process.env.DATABASE_DRIVER === 'pg';
}

/** Store documents on local disk instead of Vercel Blob. */
export function useLocalDocumentStorage(): boolean {
  if (process.env.STORAGE_DRIVER === 'local') return true;
  if (process.env.STORAGE_DRIVER === 'blob') return false;
  return isDesktopMode();
}

export function embeddedDataDir(): string {
  if (process.env.PGLITE_DATA_DIR) return process.env.PGLITE_DATA_DIR;
  return path.join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'pglite');
}
