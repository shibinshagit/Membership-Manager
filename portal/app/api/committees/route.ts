import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { canManageAllMembers, getCurrentUser } from '@/lib/auth';
import { ensureCommitteeTables } from '@/lib/db/compat';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canManageAllMembers(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensureCommitteeTables();

    const committees = await sql`
      SELECT
        c.*,
        COUNT(cm.member_id)::int AS member_count
      FROM committees c
      LEFT JOIN committee_members cm ON cm.committee_id = c.id
      GROUP BY c.id
      ORDER BY c.name ASC
    `;

    const assignments = await sql`
      SELECT
        cm.committee_id,
        m.id AS member_id,
        m.member_id AS member_code,
        m.full_name,
        m.membership_type
      FROM committee_members cm
      INNER JOIN members m ON m.id = cm.member_id
      ORDER BY m.full_name ASC
    `;

    const memberMap = new Map<number, Array<Record<string, unknown>>>();
    for (const row of assignments as Array<Record<string, unknown>>) {
      const committeeId = Number(row.committee_id);
      const list = memberMap.get(committeeId) ?? [];
      list.push({
        id: row.member_id,
        member_id: row.member_code,
        full_name: row.full_name,
        membership_type: row.membership_type,
      });
      memberMap.set(committeeId, list);
    }

    const data = (committees as Array<Record<string, unknown>>).map((committee) => ({
      ...committee,
      members: memberMap.get(Number(committee.id)) ?? [],
    }));

    return NextResponse.json({ committees: data });
  } catch (error) {
    console.error('Get committees error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManageAllMembers(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensureCommitteeTables();
    const body = await request.json();
    const name = String(body.name || '').trim();
    const description = body.description ? String(body.description).trim() : null;
    const status = body.status === 'inactive' ? 'inactive' : 'active';
    const memberIds = Array.isArray(body.member_ids)
      ? body.member_ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
      : [];

    if (!name) {
      return NextResponse.json({ error: 'Committee name is required' }, { status: 400 });
    }

    const created = await sql`
      INSERT INTO committees (name, description, status, created_by)
      VALUES (${name}, ${description}, ${status}, ${user.id})
      RETURNING *
    `;
    const committee = created[0];

    for (const memberId of memberIds) {
      await sql`
        INSERT INTO committee_members (committee_id, member_id, assigned_by)
        VALUES (${committee.id}, ${memberId}, ${user.id})
        ON CONFLICT (committee_id, member_id) DO NOTHING
      `;
    }

    return NextResponse.json({ committee }, { status: 201 });
  } catch (error) {
    console.error('Create committee error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
