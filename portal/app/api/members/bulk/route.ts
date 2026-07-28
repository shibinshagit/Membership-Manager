import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, canManageAllMembers } from '@/lib/auth';

const ALLOWED_STATUSES = new Set(['active', 'inactive', 'pending', 'suspended', 'expired']);

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManageAllMembers(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const ids = Array.isArray(body.ids)
      ? body.ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
      : [];
    const status = typeof body.status === 'string' ? body.status.trim() : '';

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Select at least one member.' }, { status: 400 });
    }

    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Use active, inactive, pending, suspended, or expired.' },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE members
      SET status = ${status}, updated_at = NOW()
      WHERE id = ANY(${ids})
      RETURNING id
    `;

    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (
        ${user.id},
        'bulk_update',
        'member',
        NULL,
        ${JSON.stringify({ ids, status, updated: result.length })}
      )
    `;

    return NextResponse.json({
      message: `Updated ${result.length} member${result.length === 1 ? '' : 's'} to ${status}.`,
      updated: result.length,
    });
  } catch (error) {
    console.error('Bulk member update error:', error);
    return NextResponse.json({ error: 'Failed to update members' }, { status: 500 });
  }
}
