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
    const entryType = body.entry_type === 'expense' ? 'expense' : 'income';
    const entryDate = String(body.entry_date || '').slice(0, 10);
    const category = body.category ? String(body.category).trim() : null;
    const description = body.description ? String(body.description).trim() : null;
    const amount = Number(body.amount);
    const entryYear = normalizeEntryYear(entryDate, currentCalendarYear());

    if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
      return NextResponse.json({ error: 'Valid entry date is required.' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero.' }, { status: 400 });
    }

    const inserted = await sql`
      INSERT INTO petty_cash_entries (
        entry_year, entry_date, entry_type, category, description, amount, currency, created_by
      )
      VALUES (
        ${entryYear},
        ${entryDate},
        ${entryType},
        ${category},
        ${description},
        ${amount},
        'AED',
        ${user.id}
      )
      RETURNING *
    `;

    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (${user.id}, 'create', 'petty_cash', ${inserted[0].id}, ${JSON.stringify(inserted[0])})
    `;

    return NextResponse.json({ entry: inserted[0] });
  } catch (error) {
    console.error('Create petty cash error:', error);
    return NextResponse.json({ error: 'Failed to create petty cash entry' }, { status: 500 });
  }
}
