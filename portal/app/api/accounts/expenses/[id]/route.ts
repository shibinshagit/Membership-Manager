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
  const expenseId = Number.parseInt(id, 10);
  if (Number.isNaN(expenseId)) {
    return NextResponse.json({ error: 'Invalid expense ID' }, { status: 400 });
  }

  try {
    await ensureAccountsTables();
    const existing = await sql`SELECT * FROM expense_entries WHERE id = ${expenseId}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    await sql`DELETE FROM expense_entries WHERE id = ${expenseId}`;

    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
      VALUES (${user.id}, 'delete', 'expense', ${expenseId}, ${JSON.stringify(existing[0])})
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete expense error:', error);
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
