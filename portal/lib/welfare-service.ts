import { sql } from '@/lib/db';
import {
  FEE_TYPE_WELFARE,
  buildWelfareSummary,
  inferWelfarePaymentMode,
  isWelfareFeeRow,
  welfareFeeNote,
  welfareFeeYearForAction,
  welfarePaymentAmountForAction,
  type WelfarePaymentAction,
  type WelfareFeeRow,
} from '@/lib/welfare-policy';

export async function getMemberWelfareFees(memberId: number): Promise<WelfareFeeRow[]> {
  const rows = await sql`
    SELECT id, fee_year, fee_type, amount, payment_status, paid_date
    FROM member_memberships
    WHERE member_id = ${memberId}
      AND (fee_type = ${FEE_TYPE_WELFARE} OR fee_year LIKE 'welfare%')
    ORDER BY created_at ASC, id ASC
  `;
  return rows as WelfareFeeRow[];
}

export async function syncWelfareMemberStatus(memberId: number): Promise<void> {
  const members = await sql`
    SELECT joined_date, is_welfare_member, welfare_payment_mode, welfare_joined_date
    FROM members
    WHERE id = ${memberId}
  `;
  if (members.length === 0) return;

  const member = members[0];
  const welfareFees = await getMemberWelfareFees(memberId);
  const paymentMode =
    welfareFees.length > 0
      ? inferWelfarePaymentMode(welfareFees, member.welfare_payment_mode)
      : null;
  const summary = buildWelfareSummary({
    joinedDate: member.joined_date,
    welfareFees,
    isWelfareMember: member.is_welfare_member,
    welfarePaymentMode: paymentMode,
    welfareJoinedDate: member.welfare_joined_date,
  });

  const shouldBeWelfare = summary.eligible && summary.payment_complete;
  const today = new Date().toISOString().slice(0, 10);

  await sql`
    UPDATE members
    SET
      welfare_payment_mode = ${paymentMode},
      is_welfare_member = ${shouldBeWelfare},
      welfare_joined_date = CASE
        WHEN ${shouldBeWelfare}::boolean IS TRUE AND welfare_joined_date IS NULL THEN ${today}::date
        WHEN ${shouldBeWelfare}::boolean IS FALSE THEN NULL
        ELSE welfare_joined_date
      END,
      updated_at = NOW()
    WHERE id = ${memberId}
  `;
}

export async function createWelfarePayment(options: {
  memberId: number;
  action: WelfarePaymentAction;
  createdBy?: number | null;
  paymentStatus?: 'paid' | 'unpaid';
}): Promise<{ feeId: number; amount: number; feeYear: string }> {
  const { memberId, action, createdBy = null, paymentStatus = 'unpaid' } = options;

  const members = await sql`
    SELECT id, joined_date, is_welfare_member, welfare_payment_mode
    FROM members
    WHERE id = ${memberId}
  `;
  if (members.length === 0) {
    throw new Error('Member not found.');
  }
  if (members[0].is_welfare_member) {
    throw new Error('Member is already a welfare member.');
  }

  const welfareFees = await getMemberWelfareFees(memberId);
  const paymentMode =
    action === 'lump'
      ? 'lump'
      : inferWelfarePaymentMode(welfareFees, members[0].welfare_payment_mode) || 'installment';

  if (action === 'lump' && paymentMode === 'installment') {
    throw new Error(
      'Cannot start a one-time welfare payment after installment payments have begun. Use settle remaining instead.'
    );
  }
  if (action === 'installment' && paymentMode === 'lump') {
    throw new Error('Member is already on the one-time welfare plan.');
  }

  const amount = welfarePaymentAmountForAction(action, welfareFees, paymentMode);
  if (amount <= 0) {
    throw new Error('No welfare payment is due.');
  }

  const feeYear = welfareFeeYearForAction(action, welfareFees);
  const today = new Date().toISOString().slice(0, 10);
  const note = welfareFeeNote(action, feeYear);

  const inserted = await sql`
    INSERT INTO member_memberships (
      member_id, fee_year, fee_type, plan, amount, currency, due_date,
      payment_status, notes, created_by, start_date, paid_date
    )
    VALUES (
      ${memberId},
      ${feeYear},
      ${FEE_TYPE_WELFARE},
      'welfare',
      ${amount},
      'AED',
      ${today},
      ${paymentStatus},
      ${note},
      ${createdBy},
      ${today},
      ${paymentStatus === 'paid' ? today : null}
    )
    RETURNING id
  `;

  await syncWelfareMemberStatus(memberId);

  return {
    feeId: Number(inserted[0].id),
    amount,
    feeYear,
  };
}

export async function getWelfareSummaryForMember(memberId: number) {
  await syncWelfareMemberStatus(memberId);

  const members = await sql`
    SELECT joined_date, is_welfare_member, welfare_payment_mode, welfare_joined_date
    FROM members
    WHERE id = ${memberId}
  `;
  if (members.length === 0) {
    throw new Error('Member not found.');
  }

  const welfareFees = await getMemberWelfareFees(memberId);
  return buildWelfareSummary({
    joinedDate: members[0].joined_date,
    welfareFees,
    isWelfareMember: members[0].is_welfare_member,
    welfarePaymentMode: members[0].welfare_payment_mode,
    welfareJoinedDate: members[0].welfare_joined_date,
  });
}

export function filterWelfareFees<T extends WelfareFeeRow>(fees: T[]): T[] {
  return fees.filter(isWelfareFeeRow);
}
