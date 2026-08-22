import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, canManageAllMembers } from '@/lib/auth';
import { ensureMemberMembershipsTable, ensureWelfareColumns } from '@/lib/db/compat';
import {
  createWelfarePayment,
  getWelfareSummaryForMember,
  syncWelfareMemberStatus,
} from '@/lib/welfare-service';
import type { WelfarePaymentAction } from '@/lib/welfare-policy';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const memberId = Number.parseInt(id, 10);
  if (Number.isNaN(memberId)) {
    return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 });
  }

  try {
    await ensureMemberMembershipsTable();
    await ensureWelfareColumns();

    const isAdmin = canManageAllMembers(user.role);
    const member = isAdmin
      ? await sql`SELECT id FROM members WHERE id = ${memberId}`
      : await sql`
          SELECT id FROM members
          WHERE id = ${memberId} AND assigned_executive_id = ${user.id}
        `;

    if (member.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const summary = await getWelfareSummaryForMember(memberId);
    return NextResponse.json({ welfare: summary });
  } catch (error) {
    console.error('Welfare summary error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch welfare summary' },
      { status: 500 }
    );
  }
}

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
    await ensureWelfareColumns();

    const body = await request.json();
    const action = body.action as 'record_payment' | 'sync';
    if (action === 'sync') {
      await syncWelfareMemberStatus(memberId);
      const summary = await getWelfareSummaryForMember(memberId);
      return NextResponse.json({ message: 'Welfare status updated.', welfare: summary });
    }

    if (action !== 'record_payment') {
      return NextResponse.json(
        { error: 'Invalid action. Use record_payment or sync.' },
        { status: 400 }
      );
    }

    const paymentType = body.payment_type as WelfarePaymentAction;
    if (!['installment', 'lump', 'settlement'].includes(paymentType)) {
      return NextResponse.json(
        { error: 'Invalid payment_type. Use installment, one_time, or settlement.' },
        { status: 400 }
      );
    }

    const paymentStatus = body.payment_status === 'paid' ? 'paid' : 'unpaid';
    const result = await createWelfarePayment({
      memberId,
      action: paymentType,
      createdBy: user.id,
      paymentStatus,
    });

    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (
        ${user.id},
        'welfare_payment',
        'member',
        ${memberId},
        ${JSON.stringify({ fee_id: result.feeId, amount: result.amount, fee_year: result.feeYear })}
      )
    `;

    const summary = await getWelfareSummaryForMember(memberId);
    const fees = await sql`
      SELECT * FROM member_memberships
      WHERE member_id = ${memberId}
      ORDER BY due_date DESC NULLS LAST, updated_at DESC
    `;
    const member = await sql`SELECT * FROM members WHERE id = ${memberId}`;

    const paymentLabel =
      paymentType === 'lump'
        ? 'one time'
        : paymentType === 'settlement'
          ? 'settlement'
          : 'installment';

    return NextResponse.json({
      message: `Welfare ${paymentLabel} invoice created (AED ${result.amount}).`,
      fee_id: result.feeId,
      welfare: summary,
      member: member[0],
      fees,
    });
  } catch (error) {
    console.error('Welfare payment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to record welfare payment' },
      { status: 500 }
    );
  }
}
