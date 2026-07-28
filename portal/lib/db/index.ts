import { mkdirSync } from 'node:fs';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { Pool, type QueryResultRow } from 'pg';
import {
  embeddedDataDir,
  useEmbeddedDatabase,
  useLocalPostgres,
} from '@/lib/runtime';

type SqlClient = NeonQueryFunction<false, false> & {
  query: (text: string, params?: unknown[]) => Promise<QueryResultRow[]>;
};

let sqlClient: SqlClient | null = null;
let pgPool: Pool | null = null;
let pglitePromise: Promise<import('@electric-sql/pglite').PGlite> | null = null;

function buildTaggedText(strings: TemplateStringsArray, values: unknown[]) {
  let text = '';
  const params: unknown[] = [];
  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) {
      params.push(values[i]);
      text += `$${params.length}`;
    }
  }
  return { text, params };
}

async function getPGlite() {
  if (!pglitePromise) {
    const dataDir = embeddedDataDir();
    mkdirSync(dataDir, { recursive: true });
    pglitePromise = import('@electric-sql/pglite').then(({ PGlite }) =>
      PGlite.create(dataDir)
    );
  }
  return pglitePromise;
}

/** Shared embedded DB handle (desktop). */
export async function getEmbeddedDb() {
  return getPGlite();
}

function createPGliteSqlClient(): SqlClient {
  const runTagged = async (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<QueryResultRow[]> => {
    const db = await getPGlite();
    const { text, params } = buildTaggedText(strings, values);
    const result = await db.query(text, params);
    return result.rows as QueryResultRow[];
  };

  return Object.assign(runTagged, {
    query: async (text: string, params?: unknown[]) => {
      const db = await getPGlite();
      const result = await db.query(text, params);
      return result.rows as QueryResultRow[];
    },
  }) as SqlClient;
}

function createPgSqlClient(databaseUrl: string): SqlClient {
  pgPool = new Pool({ connectionString: databaseUrl });

  const runTagged = async (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<QueryResultRow[]> => {
    const { text, params } = buildTaggedText(strings, values);
    const result = await pgPool!.query(text, params);
    return result.rows;
  };

  return Object.assign(runTagged, {
    query: async (text: string, params?: unknown[]) => {
      const result = await pgPool!.query(text, params);
      return result.rows;
    },
  }) as SqlClient;
}

function createNeonSqlClient(databaseUrl: string): SqlClient {
  const neonSql = neon(databaseUrl);
  return neonSql as unknown as SqlClient;
}

export function getSql(): SqlClient {
  if (!sqlClient) {
    if (useEmbeddedDatabase()) {
      sqlClient = createPGliteSqlClient();
    } else if (useLocalPostgres()) {
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required when DATABASE_DRIVER=pg');
      }
      sqlClient = createPgSqlClient(process.env.DATABASE_URL);
    } else {
      if (!process.env.DATABASE_URL) {
        throw new Error(
          'DATABASE_URL environment variable is not set. Please add it in the Vars section of settings.'
        );
      }
      sqlClient = createNeonSqlClient(process.env.DATABASE_URL);
    }
  }
  return sqlClient;
}

/** Used by dump import to run multi-statement SQL on the embedded engine. */
export async function execRawSql(sqlText: string): Promise<void> {
  if (useEmbeddedDatabase()) {
    const db = await getPGlite();
    await db.exec(sqlText);
    return;
  }
  const client = getSql();
  await client.query(sqlText);
}

const sqlBase = ((queryText: TemplateStringsArray, ...values: unknown[]) => {
  return getSql()(queryText, ...values);
}) as SqlClient;

export const sql = new Proxy(sqlBase, {
  apply: (_target, _thisArg, args) => {
    const [queryText, ...values] = args;
    return getSql()(queryText as TemplateStringsArray, ...values);
  },
  get: (_target, prop) => {
    const client = getSql() as unknown as Record<string | symbol, unknown>;
    return client[prop];
  },
}) as SqlClient;

export async function query<T>(
  queryText: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  try {
    const result = await sql(queryText, ...values);
    return result as T[];
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}
