import { getSql } from '@/lib/db';

const META_KEY = 'db_dump_imported';

export async function ensureAppMetaTable(): Promise<void> {
  const sql = getSql();
  await sql.query(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}

export async function getDumpImportStatus(): Promise<{
  imported: boolean;
  importedAt: string | null;
}> {
  await ensureAppMetaTable();
  const sql = getSql();
  const rows = await sql`
    SELECT value, updated_at FROM app_meta WHERE key = ${META_KEY} LIMIT 1
  `;
  if (rows.length === 0 || !rows[0].value) {
    return { imported: false, importedAt: null };
  }
  return {
    imported: rows[0].value === '1' || rows[0].value === 'true',
    importedAt: rows[0].updated_at ? new Date(rows[0].updated_at).toISOString() : null,
  };
}

export async function markDumpImported(): Promise<void> {
  await ensureAppMetaTable();
  const sql = getSql();
  await sql`
    INSERT INTO app_meta (key, value, updated_at)
    VALUES (${META_KEY}, '1', NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = '1', updated_at = NOW()
  `;
}

export async function clearDumpImportedFlag(): Promise<void> {
  await ensureAppMetaTable();
  const sql = getSql();
  await sql`DELETE FROM app_meta WHERE key = ${META_KEY}`;
}
