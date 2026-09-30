import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, canManageAllMembers } from '@/lib/auth';
import { ensureAccountsTables } from '@/lib/db/compat';
import { normalizeEntryYear } from '@/lib/accounts-service';
import { currentCalendarYear } from '@/lib/fees-calendar';

export async function PUT(
  request: Request,
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

    const body = await request.json();
    const entryDate = String(body.entry_date || existing[0].entry_date).slice(0, 10);
    const category = String(body.category ?? existing[0].category).trim();
    const description =
      body.description === undefined
        ? existing[0].description
        : body.description
          ? String(body.description).trim()
          : null;
    const amount =
      body.amount === undefined ? Number(existing[0].amount) : Number(body.amount);
    const paymentMethod =
      body.payment_method === undefined
        ? existing[0].payment_method
        : body.payment_method
          ? String(body.payment_method).trim()
          : null;
    const reference =
      body.reference === undefined
        ? existing[0].reference
        : body.reference
          ? String(body.reference).trim()
          : null;
    const entryYear = normalizeEntryYear(entryDate, currentCalendarYear());

    if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
      return NextResponse.json({ error: 'Valid entry date is required.' }, { status: 400 });
    }
    if (!category) {
      return NextResponse.json({ error: 'Category is required.' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero.' }, { status: 400 });
    }

    const updated = await sql`
      UPDATE expense_entries
      SET
        entry_year = ${entryYear},
        entry_date = ${entryDate},
        category = ${category},
        description = ${description},
        amount = ${amount},
        payment_method = ${paymentMethod},
        reference = ${reference},
        updated_at = NOW()
      WHERE id = ${expenseId}
      RETURNING *
    `;

    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES (
        ${user.id},
        'update',
        'expense',
        ${expenseId},
        ${JSON.stringify(existing[0])},
        ${JSON.stringify(updated[0])}
      )
    `;

    return NextResponse.json({ expense: updated[0] });
  } catch (error) {
    console.error('Update expense error:', error);
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}

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
