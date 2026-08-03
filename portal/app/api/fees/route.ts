import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, canManageAllMembers } from '@/lib/auth';
import {
  annualPeriod,
  reconcileMemberStatusesByPayment,
  resolveFeePlanOrThrow,
} from '@/lib/fees-policy';
import { ensureMemberMembershipsTable } from '@/lib/db/compat';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get('member_id');
  const status = searchParams.get('status');
  const feeYear = searchParams.get('fee_year');

  try {
    await ensureMemberMembershipsTable();
    const isAdmin = canManageAllMembers(user.role);

    const memberIdInt = memberId ? Number.parseInt(memberId, 10) : null;
    const statusList =
      status && status !== 'all'
        ? status.split(',').map((s) => s.trim()).filter(Boolean)
        : null;
    const normalizedFeeYear = feeYear && feeYear !== 'all' ? feeYear : null;

    await reconcileMemberStatusesByPayment();

    const fees = await sql`
      SELECT 
        f.*,
        f.payment_status as status,
        m.full_name as member_name,
        m.member_id as member_code,
        m.phone as member_phone,
        m.whatsapp_number as member_whatsapp
      FROM member_memberships f
      JOIN members m ON f.member_id = m.id
      WHERE (${isAdmin} OR m.assigned_executive_id = ${user.id})
        AND (${memberIdInt}::int IS NULL OR f.member_id = ${memberIdInt})
        AND (${normalizedFeeYear}::text IS NULL OR f.fee_year = ${normalizedFeeYear})
        AND (
          ${statusList}::text[] IS NULL OR
          f.payment_status = ANY(${statusList})
        )
      ORDER BY f.due_date DESC
    `;

    // Get summary stats
    const stats = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN f.payment_status = 'unpaid' THEN f.amount ELSE 0 END), 0) as pending_total,
        COALESCE(SUM(CASE WHEN f.payment_status = 'unpaid' AND f.due_date < CURRENT_DATE THEN f.amount ELSE 0 END), 0) as overdue_total,
        COALESCE(SUM(CASE WHEN f.payment_status = 'paid' THEN f.amount ELSE 0 END), 0) as paid_total,
        COUNT(*) FILTER (WHERE f.payment_status = 'unpaid') as pending_count,
        COUNT(*) FILTER (WHERE f.payment_status = 'unpaid' AND f.due_date < CURRENT_DATE) as overdue_count,
        COUNT(*) FILTER (WHERE f.payment_status = 'paid') as paid_count
      FROM member_memberships f
      JOIN members m ON f.member_id = m.id
      WHERE (${isAdmin} OR m.assigned_executive_id = ${user.id})
        AND (${normalizedFeeYear}::text IS NULL OR f.fee_year = ${normalizedFeeYear})
    `;

    return NextResponse.json({ fees, stats: stats[0] });
  } catch (error) {
    console.error('Error fetching fees:', error);
    return NextResponse.json({ error: 'Failed to fetch fees' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureMemberMembershipsTable();
    const body = await request.json();
    const {
      member_id,
      fee_type,
      due_date,
      fee_year,
      notes,
    } = body;

    if (!member_id || !fee_type || !due_date) {
      return NextResponse.json(
        { error: 'Member ID, fee type, and due date are required' },
        { status: 400 }
      );
    }

    // Verify member exists
    const isAdmin = canManageAllMembers(user.role);
    const member = isAdmin
      ? await sql`SELECT id, joined_date FROM members WHERE id = ${member_id}`
      : await sql`SELECT id, joined_date FROM members WHERE id = ${member_id} AND assigned_executive_id = ${user.id}`;

    if (member.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Determine initial status (paid/unpaid only)
    const paymentStatus = 'unpaid';
    const yearFromDue = new Date(due_date).getFullYear();
    const resolvedPlan = resolveFeePlanOrThrow(
      fee_type,
      fee_year || (fee_type?.includes('lifetime') ? 'lifetime' : String(yearFromDue)),
      member[0].joined_date
    );
    const period =
      resolvedPlan.fee_type === 'lifetime_membership'
        ? null
        : annualPeriod(Number.parseInt(resolvedPlan.fee_year, 10) || yearFromDue);

    const result = await sql`
      INSERT INTO member_memberships (
        member_id, fee_type, fee_year, plan, amount, currency, due_date, payment_status, notes, created_by, start_date, end_date
      )
      VALUES (
        ${member_id},
        ${resolvedPlan.fee_type},
        ${resolvedPlan.fee_year},
        ${resolvedPlan.fee_type === 'lifetime_membership' ? 'lifetime' : 'annual'},
        ${resolvedPlan.amount},
        ${resolvedPlan.currency},
        ${period?.due_date || due_date},
        ${paymentStatus},
        ${notes || null},
        ${user.id},
        ${period?.start_date || due_date},
        ${period?.end_date || null}
      )
      ON CONFLICT (member_id, fee_year)
      DO UPDATE SET
        fee_type = EXCLUDED.fee_type,
        plan = EXCLUDED.plan,
        amount = EXCLUDED.amount,
        due_date = EXCLUDED.due_date,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        notes = COALESCE(EXCLUDED.notes, member_memberships.notes),
        updated_at = NOW()
      RETURNING *
    `;

    await reconcileMemberStatusesByPayment();

    // Log the action
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (${user.id}, 'create', 'fee', ${result[0].id}, ${JSON.stringify(result[0])})
    `;

    return NextResponse.json({ fee: result[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating fee:', error);
    return NextResponse.json({ error: 'Failed to create fee' }, { status: 500 });
  }
}
