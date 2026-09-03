import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, canManageAllMembers } from '@/lib/auth';
import { ensureWhatsAppGroupColumn } from '@/lib/db/compat';

const ALLOWED_STATUSES = new Set(['active', 'inactive', 'pending', 'suspended', 'expired']);

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManageAllMembers(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureWhatsAppGroupColumn();
    const body = await request.json();
    const ids = Array.isArray(body.ids)
      ? body.ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
      : [];
    const hasStatus = typeof body.status === 'string' && body.status.trim() !== '';
    const status = hasStatus ? String(body.status).trim() : null;
    const hasWhatsAppGroup =
      typeof body.added_to_whatsapp_group === 'boolean' ||
      body.added_to_whatsapp_group === 0 ||
      body.added_to_whatsapp_group === 1 ||
      body.added_to_whatsapp_group === 'true' ||
      body.added_to_whatsapp_group === 'false';
    const addedToWhatsAppGroup = hasWhatsAppGroup
      ? body.added_to_whatsapp_group === true ||
        body.added_to_whatsapp_group === 1 ||
        body.added_to_whatsapp_group === 'true'
      : null;

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Select at least one member.' }, { status: 400 });
    }

    if (!hasStatus && !hasWhatsAppGroup) {
      return NextResponse.json(
        { error: 'Provide a status and/or WhatsApp group mark to update.' },
        { status: 400 }
      );
    }

    if (hasStatus && status && !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Use active, inactive, pending, suspended, or expired.' },
        { status: 400 }
      );
    }

    let result;
    if (hasStatus && hasWhatsAppGroup) {
      result = await sql`
        UPDATE members
        SET
          status = ${status},
          added_to_whatsapp_group = ${addedToWhatsAppGroup},
          whatsapp_group_added_at = CASE
            WHEN ${addedToWhatsAppGroup} THEN COALESCE(whatsapp_group_added_at, NOW())
            ELSE NULL
          END,
          updated_at = NOW()
        WHERE id = ANY(${ids})
        RETURNING id
      `;
    } else if (hasWhatsAppGroup) {
      result = await sql`
        UPDATE members
        SET
          added_to_whatsapp_group = ${addedToWhatsAppGroup},
          whatsapp_group_added_at = CASE
            WHEN ${addedToWhatsAppGroup} THEN COALESCE(whatsapp_group_added_at, NOW())
            ELSE NULL
          END,
          updated_at = NOW()
        WHERE id = ANY(${ids})
        RETURNING id
      `;
    } else {
      result = await sql`
        UPDATE members
        SET status = ${status}, updated_at = NOW()
        WHERE id = ANY(${ids})
        RETURNING id
      `;
    }

    const messageParts: string[] = [];
    if (hasStatus) {
      messageParts.push(`status → ${status}`);
    }
    if (hasWhatsAppGroup) {
      messageParts.push(
        addedToWhatsAppGroup ? 'marked in WhatsApp group' : 'marked not in WhatsApp group'
      );
    }

    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (
        ${user.id},
        'bulk_update',
        'member',
        NULL,
        ${JSON.stringify({
          ids,
          status,
          added_to_whatsapp_group: addedToWhatsAppGroup,
          updated: result.length,
        })}
      )
    `;

    return NextResponse.json({
      message: `Updated ${result.length} member${result.length === 1 ? '' : 's'}: ${messageParts.join(', ')}.`,
      updated: result.length,
    });
  } catch (error) {
    console.error('Bulk member update error:', error);
    return NextResponse.json({ error: 'Failed to update members' }, { status: 500 });
  }
}
