import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, userHasAdminRead, userHasAdminWrite } from '@/lib/auth';
import { ensureRoleTermsTable } from '@/lib/db/compat';
import { isCentralCommitteeRole } from '@/lib/members/central-committee-roles';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !userHasAdminRead(user, 'executives')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const memberId = Number.parseInt(new URL(request.url).searchParams.get('member_id') || '', 10);
  await ensureRoleTermsTable();
  const rows = Number.isFinite(memberId)
    ? await sql`
        SELECT id, member_id, role, start_date::text AS start_date, end_date::text AS end_date
        FROM member_role_terms
        WHERE member_id = ${memberId}
        ORDER BY start_date DESC
      `
    : await sql`
        SELECT
          t.id,
          t.member_id,
          t.role,
          t.start_date::text AS start_date,
          t.end_date::text AS end_date,
          m.full_name,
          m.member_id AS member_code
        FROM member_role_terms t
        JOIN members m ON m.id = t.member_id
        ORDER BY t.start_date DESC
        LIMIT 50
      `;

  return NextResponse.json({ terms: rows });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !userHasAdminWrite(user, 'executives')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const memberId = Number(body.member_id);
  const role = String(body.role || '');
  const startDate = String(body.start_date || '').slice(0, 10);
  const endDate = String(body.end_date || '').slice(0, 10);

  if (!Number.isFinite(memberId) || !isCentralCommitteeRole(role)) {
    return NextResponse.json({ error: 'Choose a member and a committee role.' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate) {
    return NextResponse.json({ error: 'Enter a from date and a to date.' }, { status: 400 });
  }

  await ensureRoleTermsTable();
  const inserted = await sql`
    INSERT INTO member_role_terms (member_id, role, start_date, end_date)
    VALUES (${memberId}, ${role}, ${startDate}::date, ${endDate}::date)
    RETURNING id, member_id, role, start_date::text AS start_date, end_date::text AS end_date
  `;

  return NextResponse.json({ term: inserted[0] }, { status: 201 });
}
