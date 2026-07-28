import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { hash } from 'bcryptjs';
import { getSql } from '@/lib/db';
import { schema } from '@/lib/db/schema';
import {
  embeddedDataDir,
  useEmbeddedDatabase,
  useLocalDocumentStorage,
  useLocalPostgres,
} from '@/lib/runtime';
import { applyPgDumpToPGlite } from '@/lib/settings/apply-pg-dump';
import {
  clearDumpImportedFlag,
  getDumpImportStatus,
  markDumpImported,
} from '@/lib/settings/app-meta';

function storageRoot(): string {
  if (process.env.LOCAL_STORAGE_DIR) return process.env.LOCAL_STORAGE_DIR;
  return path.join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'uploads');
}

export function getStorageLocations() {
  if (useEmbeddedDatabase()) {
    return {
      mode: 'desktop',
      documentsOnDisk: true,
      documentsPath: storageRoot(),
      databaseHost: 'embedded (no Postgres install)',
      databaseName: embeddedDataDir(),
      note:
        'No PostgreSQL install needed. Records live in the embedded database folder; document files live in the uploads folder.',
    };
  }

  const databaseUrl = process.env.DATABASE_URL || '';
  let dbHost = '';
  let dbName = '';
  try {
    const u = new URL(databaseUrl);
    dbHost = u.hostname + (u.port ? `:${u.port}` : '');
    dbName = u.pathname.replace(/^\//, '') || '';
  } catch {
    dbHost = '(unconfigured)';
  }

  return {
    mode: process.env.DESKTOP_MODE === '1' ? 'desktop' : 'hosted',
    documentsOnDisk: useLocalDocumentStorage(),
    documentsPath: useLocalDocumentStorage() ? storageRoot() : 'Vercel Blob (cloud)',
    databaseHost: dbHost,
    databaseName: dbName,
    note:
      'Members, fees, users, and document metadata live in the database. Document files live on disk (desktop) or Vercel Blob (hosted).',
  };
}

async function resetPublicSchema(): Promise<void> {
  const sql = getSql();
  await sql.query('DROP SCHEMA IF EXISTS public CASCADE');
  await sql.query('CREATE SCHEMA public');
  try {
    await sql.query('GRANT ALL ON SCHEMA public TO PUBLIC');
  } catch {
    // ignore on engines that don't support GRANT the same way
  }
}

export async function restoreSqlDump(file: File): Promise<void> {
  const status = await getDumpImportStatus();
  if (status.imported) {
    throw new Error('A database dump was already imported. Delete data first to import again.');
  }

  const raw = Buffer.from(await file.arrayBuffer()).toString('utf8');

  if (useEmbeddedDatabase()) {
    await resetPublicSchema();
    const { getEmbeddedDb } = await import('@/lib/db');
    const db = await getEmbeddedDb();
    await applyPgDumpToPGlite(db, raw);
    await markDumpImported();
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }

  const { spawnSync } = await import('node:child_process');
  const { mkdtemp, rm, writeFile } = await import('node:fs/promises');
  const os = await import('node:os');
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'mmp-dump-'));
  const dumpPath = path.join(tmpDir, 'restore.sql');
  try {
    const sanitized = raw
      .split(/\r?\n/)
      .filter((line) => !line.startsWith('\\restrict') && !line.startsWith('\\unrestrict'))
      .join('\n');
    await writeFile(dumpPath, sanitized, 'utf8');
    await resetPublicSchema();

    const psqlCandidates = [
      process.env.PSQL_PATH,
      'psql',
      '/opt/homebrew/opt/libpq/bin/psql',
    ].filter(Boolean) as string[];

    let restored = false;
    for (const bin of psqlCandidates) {
      const probe = spawnSync(bin, ['--version'], { encoding: 'utf8' });
      if (probe.status !== 0) continue;
      const result = spawnSync(
        bin,
        [process.env.DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-f', dumpPath],
        { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
      );
      if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || 'psql restore failed');
      }
      restored = true;
      break;
    }

    if (!restored) {
      throw new Error(
        'psql was not found. Install PostgreSQL client tools, or use desktop embedded mode.'
      );
    }

    await markDumpImported();
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

export async function clearAllAppData(options?: {
  preserveAdminPassword?: string;
}): Promise<void> {
  const sql = getSql();

  await resetPublicSchema();

  const statements = schema
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await sql.query(statement);
  }

  await clearDumpImportedFlag();

  const password =
    options?.preserveAdminPassword ||
    process.env.ADMIN_INITIAL_PASSWORD ||
    'Admin@12345';
  const passwordHash = await hash(password, 12);
  await sql`
    INSERT INTO users (username, email, password_hash, full_name, role, is_active)
    VALUES ('admin', 'admin@membership.local', ${passwordHash}, 'Super Administrator', 'super_admin', true)
  `;

  if (useLocalDocumentStorage()) {
    const root = storageRoot();
    if (existsSync(root)) {
      rmSync(root, { recursive: true, force: true });
    }
    mkdirSync(root, { recursive: true });
  }
}

export { useLocalPostgres };
