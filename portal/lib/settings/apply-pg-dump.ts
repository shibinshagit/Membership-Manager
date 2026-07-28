/**
 * Apply a pg_dump SQL file to an embedded PGlite database.
 * COPY ... FROM stdin blocks are inserted with bound parameters (safe for JSON).
 */
export async function applyPgDumpToPGlite(
  db: {
    exec: (sql: string) => Promise<unknown>;
    query: (sql: string, params?: unknown[]) => Promise<unknown>;
  },
  sqlText: string
): Promise<void> {
  const lines = sqlText.split(/\r?\n/);
  let i = 0;
  let ddlBuffer = '';

  const flushDdl = async () => {
    const sql = ddlBuffer.trim();
    ddlBuffer = '';
    if (!sql) return;
    // Skip empty / comment-only
    const withoutComments = sql
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n')
      .trim();
    if (!withoutComments) return;
    await db.exec(sql.endsWith(';') ? sql : `${sql};`);
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('\\restrict') || line.startsWith('\\unrestrict')) {
      i++;
      continue;
    }
    if (line.startsWith('\\') && !line.startsWith('\\.')) {
      i++;
      continue;
    }

    const copyMatch = line.match(
      /^COPY\s+([^\s(]+)\s*\(([^)]+)\)\s+FROM\s+stdin\s*;?\s*$/i
    );

    if (!copyMatch) {
      ddlBuffer += `${line}\n`;
      if (line.trim().endsWith(';')) {
        await flushDdl();
      }
      i++;
      continue;
    }

    await flushDdl();

    const table = copyMatch[1];
    const columns = copyMatch[2].split(',').map((c) => c.trim());
    const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
    const insertSql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    i++;

    while (i < lines.length && lines[i] !== '\\.') {
      const raw = lines[i];
      i++;
      if (!raw.length) continue;
      const values = raw.split('\t').map(parseCopyField);
      await db.query(insertSql, values);
    }
    if (i < lines.length && lines[i] === '\\.') i++;
  }

  await flushDdl();
  await db.exec('SET search_path TO public;');
}

function parseCopyField(value: string): unknown {
  if (value === '\\N') return null;

  const decoded = unescapeCopyText(value);

  if (decoded === 't') return true;
  if (decoded === 'f') return false;
  if (/^-?\d+$/.test(decoded)) return Number(decoded);
  if (/^-?\d+\.\d+$/.test(decoded)) return Number(decoded);

  if (
    (decoded.startsWith('{') && decoded.endsWith('}')) ||
    (decoded.startsWith('[') && decoded.endsWith(']'))
  ) {
    try {
      return JSON.parse(decoded);
    } catch {
      return decoded;
    }
  }

  return decoded;
}

/** Decode PostgreSQL COPY text-format backslash escapes. */
function unescapeCopyText(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    if (value[i] !== '\\' || i === value.length - 1) {
      out += value[i];
      continue;
    }
    const next = value[++i];
    switch (next) {
      case 'n':
        out += '\n';
        break;
      case 't':
        out += '\t';
        break;
      case 'r':
        out += '\r';
        break;
      case 'b':
        out += '\b';
        break;
      case 'f':
        out += '\f';
        break;
      case 'v':
        out += '\v';
        break;
      case '\\':
        out += '\\';
        break;
      default:
        out += next;
        break;
    }
  }
  return out;
}
