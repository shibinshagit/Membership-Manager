import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, canManageAllMembers } from '@/lib/auth';
import { ensureAccountsTables } from '@/lib/db/compat';

function normalizeCategory(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManageAllMembers(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureAccountsTables();
    const body = await request.json();
    const from = normalizeCategory(body.from);
    const to = normalizeCategory(body.to);
    const scope =
      body.scope === 'expense' || body.scope === 'petty_cash' || body.scope === 'both'
        ? body.scope
        : 'both';

    if (!from || !to) {
      return NextResponse.json(
        { error: 'Both current and new category names are required.' },
        { status: 400 }
      );
    }

    if (from.toLowerCase() === to.toLowerCase()) {
      return NextResponse.json({ message: 'No changes.', updated: 0, from, to });
    }

    let expenseUpdated = 0;
    let pettyUpdated = 0;

    if (scope === 'expense' || scope === 'both') {
      const expenseDup = await sql`
        SELECT 1
        FROM expense_entries
        WHERE lower(category) = lower(${to})
        LIMIT 1
      `;
      if (expenseDup.length > 0) {
        return NextResponse.json(
          { error: 'That category already exists.' },
          { status: 409 }
        );
      }

      const expenseResult = await sql`
        UPDATE expense_entries
        SET category = ${to}, updated_at = NOW()
        WHERE lower(category) = lower(${from})
        RETURNING id
      `;
      expenseUpdated = expenseResult.length;
    }

    if (scope === 'petty_cash' || scope === 'both') {
      const pettyDup = await sql`
        SELECT 1
        FROM petty_cash_entries
        WHERE category IS NOT NULL
          AND lower(category) = lower(${to})
        LIMIT 1
      `;
      if (pettyDup.length > 0) {
        return NextResponse.json(
          { error: 'That category already exists.' },
          { status: 409 }
        );
      }

      const pettyResult = await sql`
        UPDATE petty_cash_entries
        SET category = ${to}, updated_at = NOW()
        WHERE category IS NOT NULL
          AND lower(category) = lower(${from})
        RETURNING id
      `;
      pettyUpdated = pettyResult.length;
    }

    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (
        ${user.id},
        'rename',
        'account_category',
        NULL,
        ${JSON.stringify({
          scope,
          from,
          to,
          expense_updated: expenseUpdated,
          petty_updated: pettyUpdated,
        })}
      )
    `;

    return NextResponse.json({
      message: 'Category renamed.',
      from,
      to,
      updated: expenseUpdated + pettyUpdated,
      expense_updated: expenseUpdated,
      petty_updated: pettyUpdated,
    });
  } catch (error) {
    console.error('Rename category error:', error);
    return NextResponse.json({ error: 'Failed to rename category' }, { status: 500 });
  }
}
