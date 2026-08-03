import { sql } from '@/lib/db';
import {
  ANNUAL_AMOUNT,
  FEE_TYPE_ANNUAL,
  FEE_TYPE_LIFETIME,
  LIFETIME_AMOUNT,
  annualAmountForYear,
  annualFeeNote,
  annualPeriod,
  currentCalendarYear,
  normalizeJoinYear,
  parsePaidYears,
  yearFromDateInput,
  yearsBeforeLifetime,
  yearsFromJoinToCurrent,
} from '@/lib/fees-calendar';

export {
  ANNUAL_AMOUNT,
  CURRENT_RATE_FROM_YEAR,
  FEE_PLANS,
  FEE_TYPE_ANNUAL,
  FEE_TYPE_LIFETIME,
  LEGACY_ANNUAL_AMOUNT,
  LIFETIME_AMOUNT,
  ORG_START_YEAR,
  REGISTRATION_AMOUNT,
  annualAmountForYear,
  annualFeeNote,
  annualPeriod,
  currentCalendarYear,
  formatFeeTypeLabel,
  normalizeFeeType,
  normalizeFeeYearLabel,
  normalizeJoinYear,
  parsePaidYears,
  resolveFeePlanOrThrow,
  sumAnnualAmounts,
  yearFromDateInput,
  yearsBeforeLifetime,
  yearsFromJoinToCurrent,
} from '@/lib/fees-calendar';

/**
 * Create/update fee rows for a member.
 * - Lifetime: AED 750 invoice + optional paid annual history for checked years from join→current
 *   (unchecked years are not billed — no further annual dues).
 * - Annual: one row per year from joinYear→current; checked = paid, unchecked = unpaid/due.
 */
export async function syncMemberFeeYears(options: {
  memberId: number;
  plan: 'annual' | 'lifetime';
  joinYear: number;
  paidYears?: number[];
  createdBy?: number | null;
  paymentStatusForLifetime?: 'paid' | 'unpaid';
  lifetimeStartDate?: string | null;
}): Promise<{ years: number[]; paidYears: number[]; lifetimeStartDate?: string }> {
  const {
    memberId,
    plan,
    joinYear,
    paidYears = [],
    createdBy = null,
    paymentStatusForLifetime = 'paid',
    lifetimeStartDate = null,
  } = options;

  if (plan === 'lifetime') {
    const lifeDate =
      lifetimeStartDate && /^\d{4}-\d{2}-\d{2}/.test(lifetimeStartDate)
        ? lifetimeStartDate.slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    const lifeYear = yearFromDateInput(lifeDate);
    const years = yearsBeforeLifetime(joinYear, lifeYear);
    const paidSet = new Set(parsePaidYears(paidYears).filter((y) => years.includes(y)));

    // Remove all unpaid annual dues (lifetime stops yearly billing)
    await sql`
      DELETE FROM member_memberships
      WHERE member_id = ${memberId}
        AND fee_type = ${FEE_TYPE_ANNUAL}
        AND payment_status <> 'paid'
    `;

    // Drop paid annual rows outside join→current or not marked paid in this sync
    const paidLabels = [...paidSet].map(String);
    if (paidLabels.length > 0) {
      await sql`
        DELETE FROM member_memberships
        WHERE member_id = ${memberId}
          AND fee_type = ${FEE_TYPE_ANNUAL}
          AND payment_status = 'paid'
          AND NOT (fee_year = ANY(${paidLabels}))
      `;
    } else {
      await sql`
        DELETE FROM member_memberships
        WHERE member_id = ${memberId}
          AND fee_type = ${FEE_TYPE_ANNUAL}
          AND payment_status = 'paid'
      `;
    }

    // Record paid annual history for each checked year
    for (const year of paidSet) {
      const period = annualPeriod(year);
      const amount = annualAmountForYear(year, joinYear);
      await sql`
        INSERT INTO member_memberships (
          member_id, fee_year, fee_type, plan, amount, currency, due_date, payment_status,
          start_date, end_date, paid_date, notes, created_by, updated_at
        )
        VALUES (
          ${memberId},
          ${period.fee_year},
          ${FEE_TYPE_ANNUAL},
          ${'annual'},
          ${amount},
          ${'AED'},
          ${period.due_date},
          ${'paid'},
          ${period.start_date},
          ${period.end_date},
          ${period.end_date},
          ${`${annualFeeNote(year, joinYear)}${normalizeJoinYear(joinYear) === year ? '' : ' (paid before lifetime)'}`},
          ${createdBy},
          NOW()
        )
        ON CONFLICT (member_id, fee_year)
        DO UPDATE SET
          fee_type = EXCLUDED.fee_type,
          plan = EXCLUDED.plan,
          amount = EXCLUDED.amount,
          payment_status = 'paid',
          paid_date = COALESCE(member_memberships.paid_date, EXCLUDED.paid_date),
          notes = EXCLUDED.notes,
          updated_at = NOW()
      `;
    }

    const today = lifeDate;
    const joinStart = annualPeriod(normalizeJoinYear(joinYear)).start_date;
    await sql`
      INSERT INTO member_memberships (
        member_id, fee_year, fee_type, plan, amount, currency, due_date, payment_status,
        start_date, end_date, paid_date, notes, created_by, updated_at
      )
      VALUES (
        ${memberId},
        ${'lifetime'},
        ${FEE_TYPE_LIFETIME},
        ${'lifetime'},
        ${LIFETIME_AMOUNT},
        ${'AED'},
        ${today},
        ${paymentStatusForLifetime},
        ${today},
        ${null},
        ${paymentStatusForLifetime === 'paid' ? today : null},
        ${`Lifetime membership from ${today} — no further annual dues`},
        ${createdBy},
        NOW()
      )
      ON CONFLICT (member_id, fee_year)
      DO UPDATE SET
        fee_type = EXCLUDED.fee_type,
        plan = EXCLUDED.plan,
        amount = EXCLUDED.amount,
        due_date = EXCLUDED.due_date,
        start_date = EXCLUDED.start_date,
        payment_status = EXCLUDED.payment_status,
        paid_date = EXCLUDED.paid_date,
        notes = EXCLUDED.notes,
        updated_at = NOW()
    `;

    await sql`
      UPDATE members
      SET membership_plan = 'lifetime',
          membership_payment_status = ${paymentStatusForLifetime},
          membership_start_date = ${today},
          membership_end_date = NULL,
        joined_date = ${joinStart},
        updated_at = NOW()
      WHERE id = ${memberId}
    `;

    return {
      years,
      paidYears: [...paidSet].sort((a, b) => a - b),
      lifetimeStartDate: today,
    };
  }

  // Annual: remove lifetime row if switching from lifetime
  await sql`
    DELETE FROM member_memberships
    WHERE member_id = ${memberId}
      AND fee_year = 'lifetime'
  `;

  const years = yearsFromJoinToCurrent(joinYear);
  const paidSet = new Set(parsePaidYears(paidYears).filter((y) => years.includes(y)));
  const yearLabels = years.map(String);

  // Drop annual rows outside join→current window (wrongly added old/future years)
  if (yearLabels.length > 0) {
    await sql`
      DELETE FROM member_memberships
      WHERE member_id = ${memberId}
        AND fee_type = ${FEE_TYPE_ANNUAL}
        AND NOT (fee_year = ANY(${yearLabels}))
    `;
  }

  for (const year of years) {
    const period = annualPeriod(year);
    const isPaid = paidSet.has(year);
    const paidDate = isPaid ? period.end_date : null;
    const amount = annualAmountForYear(year, joinYear);

    await sql`
      INSERT INTO member_memberships (
        member_id, fee_year, fee_type, plan, amount, currency, due_date, payment_status,
        start_date, end_date, paid_date, notes, created_by, updated_at
      )
      VALUES (
        ${memberId},
        ${period.fee_year},
        ${FEE_TYPE_ANNUAL},
        ${'annual'},
        ${amount},
        ${'AED'},
        ${period.due_date},
        ${isPaid ? 'paid' : 'unpaid'},
        ${period.start_date},
        ${period.end_date},
        ${paidDate},
        ${annualFeeNote(year, joinYear)},
        ${createdBy},
        NOW()
      )
      ON CONFLICT (member_id, fee_year)
      DO UPDATE SET
        fee_type = EXCLUDED.fee_type,
        plan = EXCLUDED.plan,
        amount = EXCLUDED.amount,
        currency = EXCLUDED.currency,
        due_date = EXCLUDED.due_date,
        payment_status = EXCLUDED.payment_status,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        paid_date = EXCLUDED.paid_date,
        notes = EXCLUDED.notes,
        updated_at = NOW()
    `;
  }

  const currentYear = currentCalendarYear();
  const currentPaid = paidSet.has(currentYear);
  const startDate = annualPeriod(normalizeJoinYear(joinYear)).start_date;
  const endDate = annualPeriod(currentYear).end_date;

  await sql`
    UPDATE members
    SET membership_plan = 'annual',
        membership_payment_status = ${currentPaid ? 'paid' : 'unpaid'},
        membership_start_date = ${startDate},
        membership_end_date = ${endDate},
        joined_date = ${startDate},
        updated_at = NOW()
      WHERE id = ${memberId}
    `;

  return { years, paidYears: [...paidSet].sort((a, b) => a - b) };
}

/**
 * Active if lifetime paid OR current calendar year annual fee is paid.
 * Inactive if annual member has unpaid current-year fee (or no current-year fee).
 */
export async function reconcileMemberStatusesByPayment(): Promise<void> {
  const year = String(currentCalendarYear());

  await sql`
    WITH paid_lifetime AS (
      SELECT DISTINCT member_id
      FROM member_memberships
      WHERE payment_status = 'paid'
        AND fee_type = ${FEE_TYPE_LIFETIME}
    ),
    current_year_paid AS (
      SELECT DISTINCT member_id
      FROM member_memberships
      WHERE payment_status = 'paid'
        AND fee_type = ${FEE_TYPE_ANNUAL}
        AND fee_year = ${year}
    ),
    has_fees AS (
      SELECT DISTINCT member_id FROM member_memberships
    ),
    member_flags AS (
      SELECT
        m.id AS member_id,
        CASE
          WHEN pl.member_id IS NOT NULL THEN 'active'
          WHEN m.membership_plan = 'lifetime' AND pl.member_id IS NULL THEN 'inactive'
          WHEN cyp.member_id IS NOT NULL THEN 'active'
          WHEN hf.member_id IS NOT NULL THEN 'inactive'
          ELSE NULL
        END AS next_status
      FROM members m
      LEFT JOIN paid_lifetime pl ON pl.member_id = m.id
      LEFT JOIN current_year_paid cyp ON cyp.member_id = m.id
      LEFT JOIN has_fees hf ON hf.member_id = m.id
      WHERE m.status IN ('active', 'inactive', 'pending')
    )
    UPDATE members m
    SET status = mf.next_status,
        updated_at = NOW()
    FROM member_flags mf
    WHERE m.id = mf.member_id
      AND mf.next_status IS NOT NULL
      AND m.status IS DISTINCT FROM mf.next_status
  `;
}

export async function backfillLegacyMembershipFees(memberId?: number): Promise<number> {
  const normalizedMemberId = typeof memberId === 'number' ? memberId : null;

  const inserted = await sql`
    WITH source_members AS (
      SELECT
        m.id AS member_id,
        COALESCE(m.membership_plan, 'annual') AS membership_plan,
        COALESCE(m.membership_payment_status, 'unpaid') AS membership_payment_status,
        COALESCE(m.membership_start_date, m.joined_date, m.created_at::date, CURRENT_DATE) AS baseline_date
      FROM members m
      WHERE (${normalizedMemberId}::int IS NULL OR m.id = ${normalizedMemberId})
        AND NOT EXISTS (
          SELECT 1
          FROM member_memberships f
          WHERE f.member_id = m.id
        )
    )
    INSERT INTO member_memberships (
      member_id,
      fee_type,
      fee_year,
      amount,
      currency,
      due_date,
      paid_date,
      payment_status,
      notes,
      plan,
      start_date,
      end_date
    )
    SELECT
      sm.member_id,
      CASE
        WHEN sm.membership_plan = 'lifetime' THEN ${FEE_TYPE_LIFETIME}
        ELSE ${FEE_TYPE_ANNUAL}
      END AS fee_type,
      CASE
        WHEN sm.membership_plan = 'lifetime'
          THEN 'lifetime'
        ELSE EXTRACT(YEAR FROM sm.baseline_date)::int::text
      END AS fee_year,
      CASE
        WHEN sm.membership_plan = 'lifetime' THEN ${LIFETIME_AMOUNT}::numeric
        ELSE ${ANNUAL_AMOUNT}::numeric
      END AS amount,
      'AED' AS currency,
      CASE
        WHEN sm.membership_plan = 'lifetime' THEN sm.baseline_date
        ELSE make_date(EXTRACT(YEAR FROM sm.baseline_date)::int, 1, 1)
      END AS due_date,
      CASE
        WHEN sm.membership_payment_status = 'paid' THEN sm.baseline_date
        ELSE NULL
      END AS paid_date,
      CASE
        WHEN sm.membership_payment_status = 'paid' THEN 'paid'
        ELSE 'unpaid'
      END AS payment_status,
      'Auto-migrated from member membership fields' AS notes,
      sm.membership_plan AS plan,
      CASE
        WHEN sm.membership_plan = 'lifetime' THEN sm.baseline_date
        ELSE make_date(EXTRACT(YEAR FROM sm.baseline_date)::int, 1, 1)
      END AS start_date,
      CASE
        WHEN sm.membership_plan = 'lifetime' THEN NULL
        ELSE make_date(EXTRACT(YEAR FROM sm.baseline_date)::int, 12, 31)
      END AS end_date
    FROM source_members sm
    RETURNING id
  `;

  return inserted.length;
}

/** Upgrade annual member → lifetime: record prior paid years + AED 750 invoice. */
export async function upgradeMemberToLifetime(options: {
  memberId: number;
  joinYear?: number;
  paidYears?: number[];
  lifetimeStartDate?: string | null;
  createdBy?: number | null;
  paymentStatusForLifetime?: 'paid' | 'unpaid';
}): Promise<{ feeId: number }> {
  const {
    memberId,
    createdBy = null,
    paidYears = [],
    lifetimeStartDate = null,
    paymentStatusForLifetime = 'unpaid',
  } = options;

  const members = await sql`
    SELECT joined_date, membership_start_date FROM members WHERE id = ${memberId}
  `;
  const joinYear = normalizeJoinYear(
    options.joinYear ?? members[0]?.joined_date ?? members[0]?.membership_start_date
  );

  // Preserve already-paid annual years if caller didn't pass paidYears
  let resolvedPaid = parsePaidYears(paidYears);
  if (resolvedPaid.length === 0) {
    const paidRows = await sql`
      SELECT fee_year FROM member_memberships
      WHERE member_id = ${memberId}
        AND fee_type = ${FEE_TYPE_ANNUAL}
        AND payment_status = 'paid'
    `;
    resolvedPaid = parsePaidYears(
      paidRows.map((r) => Number.parseInt(String(r.fee_year), 10))
    );
  }

  await syncMemberFeeYears({
    memberId,
    plan: 'lifetime',
    joinYear,
    paidYears: resolvedPaid,
    createdBy,
    paymentStatusForLifetime,
    lifetimeStartDate,
  });

  await sql`
    UPDATE member_memberships
    SET notes = ${'Lifetime upgrade invoice — 750. No further annual dues.'},
        updated_at = NOW()
    WHERE member_id = ${memberId}
      AND fee_year = 'lifetime'
  `;

  const fees = await sql`
    SELECT id FROM member_memberships
    WHERE member_id = ${memberId} AND fee_year = 'lifetime'
    LIMIT 1
  `;

  await reconcileMemberStatusesByPayment();

  return { feeId: Number(fees[0]?.id) };
}

/** Remove lifetime access and restore calendar-year annual billing. */
export async function revokeMemberLifetime(options: {
  memberId: number;
  createdBy?: number | null;
}): Promise<void> {
  const { memberId, createdBy = null } = options;

  const members = await sql`
    SELECT joined_date, membership_start_date FROM members WHERE id = ${memberId}
  `;
  if (members.length === 0) {
    throw new Error('Member not found');
  }

  const paidRows = await sql`
    SELECT fee_year FROM member_memberships
    WHERE member_id = ${memberId}
      AND fee_type = ${FEE_TYPE_ANNUAL}
      AND payment_status = 'paid'
  `;
  const paidYears = parsePaidYears(
    paidRows.map((r) => Number.parseInt(String(r.fee_year), 10))
  );

  const joinYear = normalizeJoinYear(
    members[0].joined_date ?? members[0].membership_start_date ?? currentCalendarYear()
  );

  await syncMemberFeeYears({
    memberId,
    plan: 'annual',
    joinYear,
    paidYears,
    createdBy,
  });

  await reconcileMemberStatusesByPayment();
}

