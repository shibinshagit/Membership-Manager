import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, userHasAdminRead, userHasAdminWrite } from '@/lib/auth';
import { ensureMeetingsTables, ensureRoleTermsTable } from '@/lib/db/compat';

const CENTRAL_ROLES = [
  'president',
  'secretary',
  'treasurer',
  'vice_president',
  'joint_secretary',
  'joint_treasurer',
  'central_committee',
];

async function rosterForTemplate(template: string) {
  await ensureRoleTermsTable();
  const roles = template === 'executive' ? ['executive'] : CENTRAL_ROLES;
  return sql`
    SELECT m.id, m.full_name, m.member_id, COALESCE(term.role, m.membership_type) AS role
    FROM members m
    LEFT JOIN LATERAL (
      SELECT t.role
      FROM member_role_terms t
      WHERE t.member_id = m.id
        AND t.start_date <= CURRENT_DATE
        AND t.end_date >= CURRENT_DATE
      ORDER BY t.start_date DESC
      LIMIT 1
    ) term ON true
    WHERE LOWER(COALESCE(m.status, 'active')) = 'active'
      AND COALESCE(term.role, m.membership_type) = ANY(${roles})
    ORDER BY m.full_name
  `;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !userHasAdminRead(user, 'committee')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await ensureMeetingsTables();
  const meetings = await sql`
    SELECT
      id,
      title,
      meeting_date::text AS meeting_date,
      template,
      created_at
    FROM meetings
    ORDER BY meeting_date DESC, id DESC
    LIMIT 50
  `;
  return NextResponse.json({ meetings });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !userHasAdminWrite(user, 'committee')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const title = String(body.title || '').trim();
  const meetingDate = String(body.meeting_date || '').slice(0, 10);
  const template = body.template === 'executive' ? 'executive' : 'central';

  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) {
    return NextResponse.json({ error: 'Enter a title and a meeting date.' }, { status: 400 });
  }

  await ensureMeetingsTables();
  const created = await sql`
    INSERT INTO meetings (title, meeting_date, template)
    VALUES (${title}, ${meetingDate}::date, ${template})
    RETURNING id, title, meeting_date::text AS meeting_date, template
  `;
  const meeting = created[0];
  const people = await rosterForTemplate(template);

  for (const person of people) {
    await sql`
      INSERT INTO meeting_attendance (meeting_id, member_id, present)
      VALUES (${meeting.id}, ${person.id}, false)
      ON CONFLICT (meeting_id, member_id) DO NOTHING
    `;
  }

  return NextResponse.json({ meeting, attendees: people }, { status: 201 });
}
