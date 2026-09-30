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

    const body = await request.json();
    const entryDate = String(body.entry_date || existing[0].entry_date).slice(0, 10);
    const entryType =
      body.entry_type === 'income' || body.entry_type === 'expense'
        ? body.entry_type
        : existing[0].entry_type;
    const category =
      body.category === undefined
        ? existing[0].category
        : body.category
          ? String(body.category).trim()
          : null;
    const description =
      body.description === undefined
        ? existing[0].description
        : body.description
          ? String(body.description).trim()
          : null;
    const amount =
      body.amount === undefined ? Number(existing[0].amount) : Number(body.amount);
    const entryYear = normalizeEntryYear(entryDate, currentCalendarYear());

    if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
      return NextResponse.json({ error: 'Valid entry date is required.' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero.' }, { status: 400 });
    }

    const updated = await sql`
      UPDATE petty_cash_entries
      SET
        entry_year = ${entryYear},
        entry_date = ${entryDate},
        entry_type = ${entryType},
        category = ${category},
        description = ${description},
        amount = ${amount},
        updated_at = NOW()
      WHERE id = ${entryId}
      RETURNING *
    `;

    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES (
        ${user.id},
        'update',
        'petty_cash',
        ${entryId},
        ${JSON.stringify(existing[0])},
        ${JSON.stringify(updated[0])}
      )
    `;

    return NextResponse.json({ entry: updated[0] });
  } catch (error) {
    console.error('Update petty cash error:', error);
    return NextResponse.json({ error: 'Failed to update petty cash entry' }, { status: 500 });
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
