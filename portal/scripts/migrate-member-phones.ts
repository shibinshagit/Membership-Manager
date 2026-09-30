/**
 * One-time data migration: normalize member phone fields to E.164 digits.
 *
 * Run once from portal/:
 *   npx tsx scripts/migrate-member-phones.ts
 *
 * Safe to re-run; skips rows already in canonical form.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import {
  normalizePhoneToE164,
} from '../lib/members/normalize-phone';

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function canonicalize(row: {
  phone: string | null;
  whatsapp_number: string | null;
  home_country_contact_number: string | null;
}) {
  return {
    phone: normalizePhoneToE164(row.phone, 'AE'),
    whatsapp_number: normalizePhoneToE164(row.whatsapp_number, 'AE'),
    home_country_contact_number: normalizePhoneToE164(
      row.home_country_contact_number,
      'IN'
    ),
  };
}

async function main() {
  loadEnvLocal();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is missing (.env.local)');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  const rows = await sql`
    SELECT id, phone, whatsapp_number, home_country_contact_number
    FROM members
    ORDER BY id
  `;

  let updated = 0;
  let unchanged = 0;
  const samples: string[] = [];

  for (const row of rows) {
    const curPhone = row.phone ? String(row.phone) : null;
    const curWa = row.whatsapp_number ? String(row.whatsapp_number) : null;
    const curHome = row.home_country_contact_number
      ? String(row.home_country_contact_number)
      : null;

    const next = canonicalize({
      phone: curPhone,
      whatsapp_number: curWa,
      home_country_contact_number: curHome,
    });

    const phoneToSave = next.phone || curPhone;
    if (!phoneToSave) {
      unchanged += 1;
      continue;
    }

    if (
      phoneToSave === curPhone &&
      next.whatsapp_number === curWa &&
      next.home_country_contact_number === curHome
    ) {
      unchanged += 1;
      continue;
    }

    await sql`
      UPDATE members
      SET
        phone = ${phoneToSave},
        whatsapp_number = ${next.whatsapp_number},
        home_country_contact_number = ${next.home_country_contact_number},
        updated_at = NOW()
      WHERE id = ${row.id}
    `;
    updated += 1;
    if (samples.length < 8) {
      samples.push(
        `id=${row.id}: ${JSON.stringify(curPhone)} → ${JSON.stringify(phoneToSave)}`
      );
    }
  }

  // Verify: any remaining non-digit / missing country prefix?
  const leftover = await sql`
    SELECT COUNT(*)::int AS count
    FROM members
    WHERE
      (phone IS NOT NULL AND phone !~ '^[0-9]{10,15}$')
      OR (whatsapp_number IS NOT NULL AND whatsapp_number !~ '^[0-9]{10,15}$')
      OR (
        home_country_contact_number IS NOT NULL
        AND home_country_contact_number !~ '^[0-9]{10,15}$'
      )
      OR (phone IS NOT NULL AND phone !~ '^(971|91)')
  `;

  console.log(`Total members: ${rows.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Already OK: ${unchanged}`);
  console.log(`Still non-canonical after run: ${leftover[0]?.count ?? '?'}`);
  if (samples.length) {
    console.log('Samples:');
    for (const s of samples) console.log(' ', s);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
