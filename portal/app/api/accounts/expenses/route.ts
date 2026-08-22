import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, canManageAllMembers } from '@/lib/auth';
import { ensureAccountsTables } from '@/lib/db/compat';
import { normalizeEntryYear } from '@/lib/accounts-service';
import { currentCalendarYear } from '@/lib/fees-calendar';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManageAllMembers(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureAccountsTables();
    const body = await request.json();
    const entryDate = String(body.entry_date || '').slice(0, 10);
    const category = String(body.category || '').trim();
    const description = body.description ? String(body.description).trim() : null;
    const amount = Number(body.amount);
    const paymentMethod = body.payment_method ? String(body.payment_method).trim() : null;
    const reference = body.reference ? String(body.reference).trim() : null;
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

    const inserted = await sql`
      INSERT INTO expense_entries (
        entry_year, entry_date, category, description, amount, currency,
        payment_method, reference, created_by
      )
      VALUES (
        ${entryYear},
        ${entryDate},
        ${category},
        ${description},
        ${amount},
        'AED',
        ${paymentMethod},
        ${reference},
        ${user.id}
      )
      RETURNING *
    `;

    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (${user.id}, 'create', 'expense', ${inserted[0].id}, ${JSON.stringify(inserted[0])})
    `;

    return NextResponse.json({ expense: inserted[0] });
  } catch (error) {
    console.error('Create expense error:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}
