import { NextResponse } from 'next/server';
import { getCurrentUser, canManageAllMembers } from '@/lib/auth';
import {
  normalizeJoinYear,
  parsePaidYears,
  reconcileMemberStatusesByPayment,
  syncMemberFeeYears,
} from '@/lib/fees-policy';
import { ensureMemberMembershipsTable } from '@/lib/db/compat';
import { sql } from '@/lib/db';

/** Sync calendar-year fee checkboxes for a member (annual) or lifetime row. */
export async function PUT(
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
    const existing = await sql`SELECT * FROM members WHERE id = ${memberId}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const body = await request.json();
    const plan =
      body.plan === 'lifetime' || body.plan === 'annual'
        ? body.plan
        : existing[0].membership_plan === 'lifetime'
          ? 'lifetime'
          : 'annual';
    const joinYear = normalizeJoinYear(body.join_year ?? existing[0].joined_date);
    const paidYears = parsePaidYears(body.paid_years);

    const lifetimeStartDate =
      typeof body.lifetime_start_date === 'string' &&
      /^\d{4}-\d{2}-\d{2}/.test(body.lifetime_start_date)
        ? body.lifetime_start_date.slice(0, 10)
        : null;

    const sync = await syncMemberFeeYears({
      memberId,
      plan,
      joinYear,
      paidYears,
      createdBy: user.id,
      paymentStatusForLifetime: body.lifetime_payment_status === 'unpaid' ? 'unpaid' : 'paid',
      lifetimeStartDate,
    });

    await reconcileMemberStatusesByPayment();

    const fees = await sql`
      SELECT * FROM member_memberships
      WHERE member_id = ${memberId}
      ORDER BY
        CASE WHEN fee_year = 'lifetime' THEN 0 ELSE 1 END,
        fee_year DESC
    `;
    const member = await sql`SELECT * FROM members WHERE id = ${memberId}`;

    return NextResponse.json({
      success: true,
      sync,
      member: member[0],
      fees,
    });
  } catch (error) {
    console.error('Fee sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync fees' },
      { status: 500 }
    );
  }
}
