import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, canManageAllMembers } from '@/lib/auth';
import { ensureAccountsTables } from '@/lib/db/compat';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !canManageAllMembers(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const entryId = Number.parseInt(id, 10);
  if (Number.isNaN(entryId)) {
    return NextResponse.json({ error: 'Invalid petty cash entry ID' }, { status: 400 });
  }

  try {
    await ensureAccountsTables();
    const existing = await sql`SELECT * FROM petty_cash_entries WHERE id = ${entryId}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Petty cash entry not found' }, { status: 404 });
    }

    await sql`DELETE FROM petty_cash_entries WHERE id = ${entryId}`;

    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
      VALUES (${user.id}, 'delete', 'petty_cash', ${entryId}, ${JSON.stringify(existing[0])})
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete petty cash error:', error);
    return NextResponse.json({ error: 'Failed to delete petty cash entry' }, { status: 500 });
  }
}
