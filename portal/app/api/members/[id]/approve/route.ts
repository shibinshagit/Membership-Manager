import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, canManageAllMembers } from '@/lib/auth';
import {
  normalizeJoinYear,
  parsePaidYears,
  reconcileMemberStatusesByPayment,
  syncMemberFeeYears,
} from '@/lib/fees-policy';
import { ensureMemberMembershipsTable } from '@/lib/db/compat';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !canManageAllMembers(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const memberId = Number.parseInt(id, 10);
  if (Number.isNaN(memberId)) {
    return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 });
  }

  try {
    await ensureMemberMembershipsTable();
    const body = await request.json();
    const action = body.action as 'approve' | 'reject';

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'Invalid action. Use approve or reject.' }, { status: 400 });
    }

    const existing = await sql`SELECT * FROM members WHERE id = ${memberId}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const member = existing[0];

    if (action === 'reject') {
      const rejectNote = body.notes
        ? `Application rejected: ${body.notes}`
        : 'Application rejected';

      const result = await sql`
        UPDATE members
        SET status = 'inactive',
            notes = CASE
              WHEN notes IS NULL OR notes = '' THEN ${rejectNote}
              ELSE notes || E'\n' || ${rejectNote}
            END,
            updated_at = NOW()
        WHERE id = ${memberId}
        RETURNING *
      `;

      await sql`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
        VALUES (${user.id}, 'reject', 'member', ${memberId}, ${JSON.stringify({ status: 'inactive' })})
      `;

      return NextResponse.json({
        message: 'Application rejected.',
        member: result[0],
      });
    }

    const plan =
      body.plan === 'lifetime' || body.plan === 'annual'
        ? body.plan
        : member.membership_plan === 'lifetime'
          ? 'lifetime'
          : 'annual';
    const joinYear = normalizeJoinYear(
      body.join_year ?? member.membership_start_date ?? member.joined_date,
      new Date().getFullYear()
    );
    const paidYears = parsePaidYears(body.paid_years);

    const result = await sql`
      UPDATE members
      SET status = 'active',
          membership_plan = ${plan},
          notes = CASE
            WHEN notes IS NULL OR notes = '' THEN ${'Approved by admin'}
            ELSE notes || E'\n' || ${'Approved by admin'}
          END,
          updated_at = NOW()
      WHERE id = ${memberId}
      RETURNING *
    `;

    const lifetimeStartDate =
      typeof body.lifetime_start_date === 'string' &&
      /^\d{4}-\d{2}-\d{2}/.test(body.lifetime_start_date)
        ? body.lifetime_start_date.slice(0, 10)
        : null;

    await syncMemberFeeYears({
      memberId,
      plan,
      joinYear,
      paidYears,
      createdBy: user.id,
      paymentStatusForLifetime: 'unpaid',
      lifetimeStartDate,
    });
    await reconcileMemberStatusesByPayment();

    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (
        ${user.id},
        'approve',
        'member',
        ${memberId},
        ${JSON.stringify({ status: 'active', join_year: joinYear, paid_years: paidYears, plan })}
      )
    `;

    const refreshed = await sql`SELECT * FROM members WHERE id = ${memberId}`;

    return NextResponse.json({
      message: 'Member approved and activated.',
      member: refreshed[0] || result[0],
    });
  } catch (error) {
    console.error('Approval error:', error);
    return NextResponse.json({ error: 'Failed to process application' }, { status: 500 });
  }
}
