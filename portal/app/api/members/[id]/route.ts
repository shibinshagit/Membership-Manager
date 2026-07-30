import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, canManageAllMembers } from '@/lib/auth';
import { resolveMemberIdForUpdate } from '@/lib/members/resolve-member-id';
import { validateAdminMemberFields } from '@/lib/members/admin-member-validation';
import { parseWardNo } from '@/lib/members/ward-numbers';
import {
  currentCalendarYear,
  FEE_TYPE_ANNUAL,
  FEE_TYPE_LIFETIME,
  normalizeFeeYearLabel,
  normalizeJoinYear,
  parsePaidYears,
  reconcileMemberStatusesByPayment,
  syncMemberFeeYears,
  yearFromDateInput,
  yearsBeforeLifetime,
} from '@/lib/fees-policy';
import {
  ensureAssignedExecutiveMemberColumn,
  ensureExtendedMemberProfileColumns,
  ensureMemberMembershipsTable,
  hasAssignedExecutiveMemberColumn,
} from '@/lib/db/compat';

function currentFeeYear(): string {
  return String(currentCalendarYear());
}

function isoDateOnly(value: unknown): string | null {
  if (!value) return null;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function deriveJoinAndPaidYears(
  member: Record<string, unknown>,
  fees: Array<{
    fee_year?: string;
    fee_type?: string;
    payment_status?: string;
    start_date?: string | null;
    paid_date?: string | null;
  }>
) {
  const annualFees = fees.filter(
    (f) => f.fee_type === FEE_TYPE_ANNUAL || (f.fee_year && f.fee_year !== 'lifetime')
  );
  const paidYears = annualFees
    .filter((f) => f.payment_status === 'paid')
    .map((f) => Number.parseInt(normalizeFeeYearLabel(f.fee_year), 10))
    .filter((y) => Number.isFinite(y));
  const allYears = annualFees
    .map((f) => Number.parseInt(normalizeFeeYearLabel(f.fee_year), 10))
    .filter((y) => Number.isFinite(y));

  const isLifetime = member.membership_plan === 'lifetime';
  // For lifetime, membership_start_date is the lifetime start — join comes from joined_date.
  const fromDates = normalizeJoinYear(
    member.joined_date ?? (isLifetime ? null : member.membership_start_date) ?? currentCalendarYear()
  );
  let joinYear = allYears.length > 0 ? Math.min(...allYears, fromDates) : fromDates;

  const lifeFee = fees.find(
    (f) => f.fee_year === 'lifetime' || f.fee_type === FEE_TYPE_LIFETIME
  );
  const lifetimeStartedOn =
    isoDateOnly(lifeFee?.start_date) ||
    isoDateOnly(lifeFee?.paid_date) ||
    (isLifetime ? isoDateOnly(member.membership_start_date) : null);

  let resolvedPaid = [...new Set(paidYears)].sort((a, b) => a - b);
  if (lifetimeStartedOn) {
    const lifeYear = yearFromDateInput(lifetimeStartedOn);
    const allowed = new Set(yearsBeforeLifetime(joinYear, lifeYear));
    resolvedPaid = resolvedPaid.filter((y) => allowed.has(y));
  }

  return {
    join_year: joinYear,
    paid_years: resolvedPaid,
    lifetime_started_on: lifetimeStartedOn,
  };
}

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
    const hasExecutiveMemberColumn = await ensureAssignedExecutiveMemberColumn();
    const isAdmin = canManageAllMembers(user.role);

    const members = hasExecutiveMemberColumn
      ? isAdmin
        ? await sql`
            SELECT
              m.*,
              ex.full_name as executive_name,
              COALESCE(mm.plan, m.membership_plan) as membership_plan,
              COALESCE(mm.payment_status, m.membership_payment_status) as membership_payment_status,
              COALESCE(mm.fee_year, ${currentFeeYear()}) as membership_fee_year,
              COALESCE(mm.start_date, m.membership_start_date) as membership_start_date,
              COALESCE(mm.end_date, m.membership_end_date) as membership_end_date
            FROM members m
            LEFT JOIN members ex ON m.assigned_executive_member_id = ex.id
            LEFT JOIN LATERAL (
              SELECT plan, payment_status, fee_year, start_date, end_date
              FROM member_memberships
              WHERE member_id = m.id
              ORDER BY updated_at DESC, id DESC
              LIMIT 1
            ) mm ON true
            WHERE m.id = ${id}
          `
        : await sql`
            SELECT
              m.*,
              ex.full_name as executive_name,
              COALESCE(mm.plan, m.membership_plan) as membership_plan,
              COALESCE(mm.payment_status, m.membership_payment_status) as membership_payment_status,
              COALESCE(mm.fee_year, ${currentFeeYear()}) as membership_fee_year,
              COALESCE(mm.start_date, m.membership_start_date) as membership_start_date,
              COALESCE(mm.end_date, m.membership_end_date) as membership_end_date
            FROM members m
            LEFT JOIN members ex ON m.assigned_executive_member_id = ex.id
            LEFT JOIN LATERAL (
              SELECT plan, payment_status, fee_year, start_date, end_date
              FROM member_memberships
              WHERE member_id = m.id
              ORDER BY updated_at DESC, id DESC
              LIMIT 1
            ) mm ON true
            WHERE m.id = ${id} AND m.assigned_executive_id = ${user.id}
          `
      : isAdmin
      ? await sql`
          SELECT
            m.*,
            u.full_name as executive_name,
            COALESCE(mm.plan, m.membership_plan) as membership_plan,
            COALESCE(mm.payment_status, m.membership_payment_status) as membership_payment_status,
            COALESCE(mm.fee_year, ${currentFeeYear()}) as membership_fee_year,
            COALESCE(mm.start_date, m.membership_start_date) as membership_start_date,
            COALESCE(mm.end_date, m.membership_end_date) as membership_end_date
          FROM members m
          LEFT JOIN users u ON m.assigned_executive_id = u.id
          LEFT JOIN LATERAL (
            SELECT plan, payment_status, fee_year, start_date, end_date
            FROM member_memberships
            WHERE member_id = m.id
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
          ) mm ON true
          WHERE m.id = ${id}
        `
      : await sql`
          SELECT
            m.*,
            u.full_name as executive_name,
            COALESCE(mm.plan, m.membership_plan) as membership_plan,
            COALESCE(mm.payment_status, m.membership_payment_status) as membership_payment_status,
            COALESCE(mm.fee_year, ${currentFeeYear()}) as membership_fee_year,
            COALESCE(mm.start_date, m.membership_start_date) as membership_start_date,
            COALESCE(mm.end_date, m.membership_end_date) as membership_end_date
          FROM members m
          LEFT JOIN users u ON m.assigned_executive_id = u.id
          LEFT JOIN LATERAL (
            SELECT plan, payment_status, fee_year, start_date, end_date
            FROM member_memberships
            WHERE member_id = m.id
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
          ) mm ON true
          WHERE m.id = ${id} AND m.assigned_executive_id = ${user.id}
        `;

    if (members.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Get documents
    const documents = await sql`
      SELECT * FROM documents WHERE member_id = ${id} ORDER BY created_at DESC
    `;

    // Get fees
    const fees = await sql`
      SELECT * FROM member_memberships WHERE member_id = ${id} ORDER BY due_date DESC NULLS LAST, updated_at DESC
    `;

    const yearsMeta = deriveJoinAndPaidYears(members[0] as Record<string, unknown>, fees);

    return NextResponse.json({
      member: { ...members[0], ...yearsMeta },
      documents,
      fees,
      join_year: yearsMeta.join_year,
      paid_years: yearsMeta.paid_years,
      lifetime_started_on: yearsMeta.lifetime_started_on,
    });
  } catch (error) {
    console.error('Error fetching member:', error);
    return NextResponse.json({ error: 'Failed to fetch member' }, { status: 500 });
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
    await ensureExtendedMemberProfileColumns();
    await ensureMemberMembershipsTable();
    const hasExecutiveMemberColumn = await hasAssignedExecutiveMemberColumn();
    const body = await request.json();
    const {
      full_name,
      gender,
      blood_group,
      marital_status,
      email,
      phone,
      whatsapp_number,
      date_of_birth,
      nominee,
      ward_no: ward_no_input,
      emirates_id,
      passport_number,
      visa_status,
      profession,
      company_name,
      work_location,
      address,
      uae_building,
      uae_area,
      uae_city,
      home_country_address,
      home_state,
      home_district,
      home_local_body,
      home_local_area_ward,
      home_country_contact_number,
      spouse_name,
      children_count,
      children_details,
      family_residing_with,
      membership_type,
      membership_plan,
      membership_payment_status,
      membership_fee_year,
      join_year,
      paid_years,
      lifetime_start_date,
      membership_start_date,
      membership_end_date,
      status,
      notes,
      member_id: nextMemberId,
    } = body;

    // Check permission
    const isAdmin = canManageAllMembers(user.role);

    // Get current member
    const currentMember = isAdmin
      ? await sql`SELECT * FROM members WHERE id = ${id}`
      : await sql`SELECT * FROM members WHERE id = ${id} AND assigned_executive_id = ${user.id}`;

    if (currentMember.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const adminFieldErrors = validateAdminMemberFields({
      full_name: full_name || currentMember[0].full_name,
      phone: phone || currentMember[0].phone,
      whatsapp_number: whatsapp_number ?? currentMember[0].whatsapp_number,
      emirates_id: emirates_id ?? currentMember[0].emirates_id,
      passport_number: passport_number ?? currentMember[0].passport_number,
      visa_status: visa_status ?? currentMember[0].visa_status,
      nominee: nominee ?? currentMember[0].nominee,
      ward_no: ward_no_input ?? currentMember[0].ward_no,
    });
    if (Object.keys(adminFieldErrors).length > 0) {
      return NextResponse.json(
        { error: 'Please fill in all required member fields.', errors: adminFieldErrors },
        { status: 400 }
      );
    }

    let resolvedMemberCode = currentMember[0].member_id as string;
    if (
      isAdmin &&
      nextMemberId &&
      String(nextMemberId).trim() &&
      String(nextMemberId).trim() !== String(currentMember[0].member_id)
    ) {
      const memberIdResult = await resolveMemberIdForUpdate(Number(id), String(nextMemberId));
      if ('error' in memberIdResult) {
        return NextResponse.json(
          { error: memberIdResult.error, errors: { [memberIdResult.field]: memberIdResult.error } },
          { status: 409 }
        );
      }
      resolvedMemberCode = memberIdResult.memberId;
    }

    const normalizedChildrenCount =
      children_count === null || children_count === undefined || children_count === ''
        ? currentMember[0].children_count
        : Number(children_count);
    const resolvedPlan =
      membership_plan === 'lifetime' || membership_plan === 'annual'
        ? membership_plan
        : currentMember[0].membership_plan || 'annual';
    const hasYearSync =
      join_year !== undefined ||
      paid_years !== undefined ||
      membership_plan === 'lifetime' ||
      membership_plan === 'annual';
    const joinYear = normalizeJoinYear(
      join_year ?? currentMember[0].joined_date ?? currentMember[0].membership_start_date
    );
    const paidYears = parsePaidYears(
      paid_years ??
        (membership_payment_status === 'paid'
          ? [Number.parseInt(String(membership_fee_year || joinYear), 10) || joinYear]
          : [])
    );
    const resolvedPaymentStatus =
      resolvedPlan === 'lifetime'
        ? membership_payment_status === 'paid' || membership_payment_status === 'unpaid'
          ? membership_payment_status
          : currentMember[0].membership_payment_status || 'unpaid'
        : paidYears.includes(currentCalendarYear())
          ? 'paid'
          : 'unpaid';
    const lifetimeStart =
      typeof lifetime_start_date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(lifetime_start_date)
        ? lifetime_start_date.slice(0, 10)
        : null;
    const resolvedStartDate =
      resolvedPlan === 'lifetime'
        ? lifetimeStart ||
          membership_start_date ||
          currentMember[0].membership_start_date ||
          new Date().toISOString().slice(0, 10)
        : membership_start_date ||
          currentMember[0].membership_start_date ||
          `${joinYear}-01-01`;
    const resolvedEndDate =
      resolvedPlan === 'lifetime'
        ? null
        : membership_end_date || `${currentCalendarYear()}-12-31`;
    const ward_no =
      ward_no_input === undefined || ward_no_input === null || ward_no_input === ''
        ? currentMember[0].ward_no
        : parseWardNo(ward_no_input);

    const result = hasExecutiveMemberColumn
      ? await sql`
          UPDATE members SET
            member_id = ${resolvedMemberCode},
            full_name = ${full_name || currentMember[0].full_name},
            email = ${email ?? currentMember[0].email},
            phone = ${phone || currentMember[0].phone},
            whatsapp_number = ${whatsapp_number ?? currentMember[0].whatsapp_number},
            date_of_birth = ${date_of_birth ?? currentMember[0].date_of_birth},
            nominee = ${nominee ?? currentMember[0].nominee},
            ward_no = ${ward_no},
            emirates_id = ${emirates_id ?? currentMember[0].emirates_id},
            passport_number = ${passport_number ?? currentMember[0].passport_number},
            visa_status = ${visa_status ?? currentMember[0].visa_status},
            profession = ${profession ?? currentMember[0].profession},
            company_name = ${company_name ?? currentMember[0].company_name},
            work_location = ${work_location ?? currentMember[0].work_location},
            address = ${address ?? currentMember[0].address},
            uae_building = ${uae_building ?? currentMember[0].uae_building},
            uae_area = ${uae_area ?? currentMember[0].uae_area},
            uae_city = ${uae_city ?? currentMember[0].uae_city},
            gender = ${gender ?? currentMember[0].gender},
            blood_group = ${blood_group ?? currentMember[0].blood_group},
            marital_status = ${marital_status ?? currentMember[0].marital_status},
            home_country_address = ${home_country_address ?? currentMember[0].home_country_address},
            home_state = ${home_state ?? currentMember[0].home_state},
            home_district = ${home_district ?? currentMember[0].home_district},
            home_local_body = ${home_local_body ?? currentMember[0].home_local_body},
            home_local_area_ward = ${home_local_area_ward ?? currentMember[0].home_local_area_ward},
            home_country_contact_number = ${home_country_contact_number ?? currentMember[0].home_country_contact_number},
            spouse_name = ${spouse_name ?? currentMember[0].spouse_name},
            children_count = ${normalizedChildrenCount},
            children_details = ${children_details ?? currentMember[0].children_details},
            family_residing_with = ${family_residing_with ?? currentMember[0].family_residing_with},
            membership_type = ${membership_type ?? currentMember[0].membership_type},
            membership_plan = ${resolvedPlan},
            membership_payment_status = ${resolvedPaymentStatus},
            membership_start_date = ${resolvedStartDate},
            membership_end_date = ${resolvedEndDate},
            status = ${status ?? currentMember[0].status},
            assigned_executive_member_id = NULL,
            notes = ${notes ?? currentMember[0].notes},
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `
      : await sql`
          UPDATE members SET
            member_id = ${resolvedMemberCode},
            full_name = ${full_name || currentMember[0].full_name},
            email = ${email ?? currentMember[0].email},
            phone = ${phone || currentMember[0].phone},
            whatsapp_number = ${whatsapp_number ?? currentMember[0].whatsapp_number},
            date_of_birth = ${date_of_birth ?? currentMember[0].date_of_birth},
            nominee = ${nominee ?? currentMember[0].nominee},
            ward_no = ${ward_no},
            emirates_id = ${emirates_id ?? currentMember[0].emirates_id},
            passport_number = ${passport_number ?? currentMember[0].passport_number},
            visa_status = ${visa_status ?? currentMember[0].visa_status},
            profession = ${profession ?? currentMember[0].profession},
            company_name = ${company_name ?? currentMember[0].company_name},
            work_location = ${work_location ?? currentMember[0].work_location},
            address = ${address ?? currentMember[0].address},
            uae_building = ${uae_building ?? currentMember[0].uae_building},
            uae_area = ${uae_area ?? currentMember[0].uae_area},
            uae_city = ${uae_city ?? currentMember[0].uae_city},
            gender = ${gender ?? currentMember[0].gender},
            blood_group = ${blood_group ?? currentMember[0].blood_group},
            marital_status = ${marital_status ?? currentMember[0].marital_status},
            home_country_address = ${home_country_address ?? currentMember[0].home_country_address},
            home_state = ${home_state ?? currentMember[0].home_state},
            home_district = ${home_district ?? currentMember[0].home_district},
            home_local_body = ${home_local_body ?? currentMember[0].home_local_body},
            home_local_area_ward = ${home_local_area_ward ?? currentMember[0].home_local_area_ward},
            home_country_contact_number = ${home_country_contact_number ?? currentMember[0].home_country_contact_number},
            spouse_name = ${spouse_name ?? currentMember[0].spouse_name},
            children_count = ${normalizedChildrenCount},
            children_details = ${children_details ?? currentMember[0].children_details},
            family_residing_with = ${family_residing_with ?? currentMember[0].family_residing_with},
            membership_type = ${membership_type ?? currentMember[0].membership_type},
            membership_plan = ${resolvedPlan},
            membership_payment_status = ${resolvedPaymentStatus},
            membership_start_date = ${resolvedStartDate},
            membership_end_date = ${resolvedEndDate},
            status = ${status ?? currentMember[0].status},
            assigned_executive_id = NULL,
            notes = ${notes ?? currentMember[0].notes},
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `;

    if (hasYearSync) {
      await syncMemberFeeYears({
        memberId: Number(id),
        plan: resolvedPlan,
        joinYear,
        paidYears,
        createdBy: user.id,
        paymentStatusForLifetime: resolvedPaymentStatus,
        lifetimeStartDate: resolvedPlan === 'lifetime' ? resolvedStartDate : null,
      });
      await reconcileMemberStatusesByPayment();
    }

    // Log the update
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
      VALUES (${user.id}, 'update', 'member', ${id}, ${JSON.stringify(currentMember[0])}, ${JSON.stringify(result[0])})
    `;

    const refreshed = await sql`SELECT * FROM members WHERE id = ${id}`;
    const fees = await sql`
      SELECT * FROM member_memberships WHERE member_id = ${id} ORDER BY due_date DESC NULLS LAST, updated_at DESC
    `;
    const yearsMeta = deriveJoinAndPaidYears(
      (refreshed[0] || result[0]) as Record<string, unknown>,
      fees
    );

    return NextResponse.json({
      member: { ...(refreshed[0] || result[0]), ...yearsMeta },
      fees,
    });
  } catch (error) {
    console.error('Error updating member:', error);
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
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
    const member = await sql`SELECT * FROM members WHERE id = ${id}`;

    if (member.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    await sql`DELETE FROM members WHERE id = ${id}`;

    // Log deletion
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
      VALUES (${user.id}, 'delete', 'member', ${id}, ${JSON.stringify(member[0])})
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting member:', error);
    return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 });
  }
}
