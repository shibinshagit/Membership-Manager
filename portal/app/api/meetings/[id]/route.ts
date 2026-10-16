import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, userHasAdminRead, userHasAdminWrite } from '@/lib/auth';
import { ensureMeetingsTables } from '@/lib/db/compat';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !userHasAdminRead(user, 'committee')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  await ensureMeetingsTables();
  const meetings = await sql`
    SELECT id, title, meeting_date::text AS meeting_date, template
    FROM meetings
    WHERE id = ${id}
  `;
  if (meetings.length === 0) {
    return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
  }

  const attendees = await sql`
    SELECT
      a.member_id,
      a.present,
      m.full_name,
      m.member_id AS member_code,
      m.membership_type
    FROM meeting_attendance a
    JOIN members m ON m.id = a.member_id
    WHERE a.meeting_id = ${id}
    ORDER BY m.full_name
  `;

  return NextResponse.json({ meeting: meetings[0], attendees });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !userHasAdminWrite(user, 'committee')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const presentIds = new Set(
    Array.isArray(body.present_member_ids)
      ? body.present_member_ids.map((value: unknown) => Number(value)).filter(Number.isFinite)
      : []
  );

  await ensureMeetingsTables();
  const rows = await sql`
    SELECT member_id FROM meeting_attendance WHERE meeting_id = ${id}
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
  }

  for (const row of rows) {
    const memberId = Number(row.member_id);
    await sql`
      UPDATE meeting_attendance
      SET present = ${presentIds.has(memberId)}
      WHERE meeting_id = ${id} AND member_id = ${memberId}
    `;
  }

  return NextResponse.json({ ok: true });
}
