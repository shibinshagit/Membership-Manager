import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, canManageAllMembers } from '@/lib/auth';
import {
  reconcileMemberStatusesByPayment,
  resolveFeePlanOrThrow,
} from '@/lib/fees-policy';
import { ensureMemberMembershipsTable } from '@/lib/db/compat';
import { FEE_TYPE_WELFARE } from '@/lib/welfare-policy';
import { getWelfareSummaryForMember, syncWelfareMemberStatus } from '@/lib/welfare-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await ensureMemberMembershipsTable();
    const isAdmin = canManageAllMembers(user.role);

    const fee = isAdmin
      ? await sql`
          SELECT f.*, m.full_name as member_name, m.member_id as member_code
          FROM member_memberships f
          JOIN members m ON f.member_id = m.id
          WHERE f.id = ${id}
        `
      : await sql`
          SELECT f.*, m.full_name as member_name, m.member_id as member_code
          FROM member_memberships f
          JOIN members m ON f.member_id = m.id
          WHERE f.id = ${id} AND m.assigned_executive_id = ${user.id}
        `;

    if (fee.length === 0) {
      return NextResponse.json({ error: 'Fee not found' }, { status: 404 });
    }

    return NextResponse.json({ fee: fee[0] });
  } catch (error) {
    console.error('Error fetching fee:', error);
    return NextResponse.json({ error: 'Failed to fetch fee' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await ensureMemberMembershipsTable();
    const isAdmin = canManageAllMembers(user.role);

    const body = await request.json();
    const {
      fee_type,
      amount,
      due_date,
      paid_date,
      payment_status,
      payment_method,
      transaction_reference,
      notes,
    } = body;

    // Get current fee (respect data isolation for executives)
    const currentFee = isAdmin
      ? await sql`SELECT f.* FROM member_memberships f WHERE f.id = ${id}`
      : await sql`
          SELECT f.*
          FROM member_memberships f
          JOIN members m ON m.id = f.member_id
          WHERE f.id = ${id} AND m.assigned_executive_id = ${user.id}
        `;

    if (currentFee.length === 0) {
      return NextResponse.json({ error: 'Fee not found' }, { status: 404 });
    }

    const memberRows = await sql`
      SELECT joined_date FROM members WHERE id = ${currentFee[0].member_id}
    `;

    const nextStatus =
      payment_status === 'paid' || payment_status === 'unpaid'
        ? payment_status
        : currentFee[0].payment_status;
    const isWelfareFee =
      (fee_type ?? currentFee[0].fee_type) === FEE_TYPE_WELFARE ||
      String(currentFee[0].fee_year || '').startsWith('welfare');

    const resolvedPlan = isWelfareFee
      ? {
          fee_type: FEE_TYPE_WELFARE,
          fee_year: currentFee[0].fee_year,
          currency: 'AED',
          amount: Number(amount ?? currentFee[0].amount),
        }
      : resolveFeePlanOrThrow(
          fee_type ?? currentFee[0].fee_type,
          currentFee[0].fee_year,
          memberRows[0]?.joined_date
        );
    const nextAmount =
      amount !== undefined && amount !== null && amount !== ''
        ? Number(amount)
        : resolvedPlan.amount;
    const nextPartialAmount = nextStatus === 'partial'
      ? Number(amount ?? currentFee[0].partial_amount ?? 0)
      : currentFee[0].partial_amount;

    const result = await sql`
      UPDATE member_memberships SET
        fee_type = ${resolvedPlan.fee_type},
        fee_year = ${resolvedPlan.fee_year},
        plan = ${
          resolvedPlan.fee_type === 'lifetime_membership'
            ? 'lifetime'
            : resolvedPlan.fee_type === FEE_TYPE_WELFARE
              ? 'welfare'
              : 'annual'
        },
        amount = ${nextAmount},
        currency = ${resolvedPlan.currency},
        due_date = ${due_date ?? currentFee[0].due_date},
        paid_date = ${paid_date !== undefined ? paid_date : currentFee[0].paid_date},
        payment_status = ${nextStatus},
        partial_amount = ${nextPartialAmount},
        payment_method = ${payment_method ?? currentFee[0].payment_method},
        transaction_reference = ${transaction_reference ?? currentFee[0].transaction_reference},
        notes = ${notes ?? currentFee[0].notes},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    await reconcileMemberStatusesByPayment();
    const memberId = Number(currentFee[0].member_id);
    if (isWelfareFee) {
      await syncWelfareMemberStatus(memberId);
    }

    const welfare = isWelfareFee ? await getWelfareSummaryForMember(memberId) : undefined;

    // Log the update
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES (${user.id}, 'update', 'fee', ${id}, ${JSON.stringify(currentFee[0])}, ${JSON.stringify(result[0])})
    `;

    return NextResponse.json({ fee: result[0], welfare });
  } catch (error) {
    console.error('Error updating fee:', error);
    return NextResponse.json({ error: 'Failed to update fee' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !canManageAllMembers(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await ensureMemberMembershipsTable();
    const fee = await sql`SELECT * FROM member_memberships WHERE id = ${id}`;

    if (fee.length === 0) {
      return NextResponse.json({ error: 'Fee not found' }, { status: 404 });
    }

    await sql`DELETE FROM member_memberships WHERE id = ${id}`;
    await reconcileMemberStatusesByPayment();

    const isWelfareFee =
      fee[0].fee_type === FEE_TYPE_WELFARE || String(fee[0].fee_year || '').startsWith('welfare');
    if (isWelfareFee) {
      await syncWelfareMemberStatus(Number(fee[0].member_id));
    }

    // Log deletion
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
      VALUES (${user.id}, 'delete', 'fee', ${id}, ${JSON.stringify(fee[0])})
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting fee:', error);
    return NextResponse.json({ error: 'Failed to delete fee' }, { status: 500 });
  }
}
