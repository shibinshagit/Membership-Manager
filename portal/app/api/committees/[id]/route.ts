import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { canManageAllMembers, getCurrentUser } from '@/lib/auth';
import { ensureCommitteeTables } from '@/lib/db/compat';

function parseCommitteeId(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManageAllMembers(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const committeeId = parseCommitteeId(id);
  if (!committeeId) {
    return NextResponse.json({ error: 'Invalid committee id' }, { status: 400 });
  }

  try {
    await ensureCommitteeTables();
    const body = await request.json();
    const name = String(body.name || '').trim();
    const description = body.description ? String(body.description).trim() : null;
    const status = body.status === 'inactive' ? 'inactive' : 'active';
    const memberIds = Array.isArray(body.member_ids)
      ? body.member_ids.map((item: unknown) => Number(item)).filter((item: number) => Number.isInteger(item) && item > 0)
      : [];

    if (!name) {
      return NextResponse.json({ error: 'Committee name is required' }, { status: 400 });
    }

    const updatedRows = await sql`
      UPDATE committees
      SET name = ${name},
          description = ${description},
          status = ${status},
          updated_at = NOW()
      WHERE id = ${committeeId}
      RETURNING *
    `;

    if (updatedRows.length === 0) {
      return NextResponse.json({ error: 'Committee not found' }, { status: 404 });
    }

    await sql`DELETE FROM committee_members WHERE committee_id = ${committeeId}`;
    for (const memberId of memberIds) {
      await sql`
        INSERT INTO committee_members (committee_id, member_id, assigned_by)
        VALUES (${committeeId}, ${memberId}, ${user.id})
        ON CONFLICT (committee_id, member_id) DO NOTHING
      `;
    }

    return NextResponse.json({ committee: updatedRows[0] });
  } catch (error) {
    console.error('Update committee error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManageAllMembers(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const committeeId = parseCommitteeId(id);
  if (!committeeId) {
    return NextResponse.json({ error: 'Invalid committee id' }, { status: 400 });
  }

  try {
    await ensureCommitteeTables();
    const deleted = await sql`
      DELETE FROM committees
      WHERE id = ${committeeId}
      RETURNING id
    `;

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Committee not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete committee error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
