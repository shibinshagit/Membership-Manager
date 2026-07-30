import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, canManageAllMembers } from '@/lib/auth';
import {
  annualPeriod,
  normalizeJoinYear,
  parsePaidYears,
  reconcileMemberStatusesByPayment,
  syncMemberFeeYears,
} from '@/lib/fees-policy';
import { checkMemberDuplicates } from '@/lib/members/check-duplicates';
import { resolveMemberId } from '@/lib/members/resolve-member-id';
import { validateAdminMemberFields } from '@/lib/members/admin-member-validation';
import { parseWardNo } from '@/lib/members/ward-numbers';
import {
  ensureAssignedExecutiveMemberColumn,
  ensureExtendedMemberProfileColumns,
  ensureMemberMembershipsTable,
  hasAssignedExecutiveMemberColumn,
} from '@/lib/db/compat';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const executiveId = searchParams.get('executive_id');
  const search = searchParams.get('search');
  const visaStatus = searchParams.get('visa_status');
  const maritalStatus = searchParams.get('marital_status');
  const gender = searchParams.get('gender');
  const locality = searchParams.get('locality');
  const exportFormat = searchParams.get('export');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  try {
    await ensureExtendedMemberProfileColumns();
    const hasExecutiveMemberColumn = await ensureAssignedExecutiveMemberColumn();
    const isAdmin = canManageAllMembers(user.role);
    const searchPattern = search ? `%${search}%` : null;
    const localityPattern = locality ? `%${locality}%` : null;
    const normalizedStatus = status && status !== 'all' ? status : null;
    const normalizedVisaStatus = visaStatus && visaStatus !== 'all' ? visaStatus : null;
    const normalizedMaritalStatus =
      maritalStatus && maritalStatus !== 'all' ? maritalStatus : null;
    const normalizedGender = gender && gender !== 'all' ? gender : null;
    const executiveIdInt = executiveId ? Number.parseInt(executiveId, 10) : null;

    // Get total count
    const countResult = hasExecutiveMemberColumn
      ? await sql`
          SELECT COUNT(*) as count 
          FROM members m 
          WHERE (${isAdmin} OR m.assigned_executive_id = ${user.id})
            AND (${normalizedStatus}::text IS NULL OR m.status = ${normalizedStatus})
            AND (${normalizedVisaStatus}::text IS NULL OR m.visa_status = ${normalizedVisaStatus})
            AND (${normalizedMaritalStatus}::text IS NULL OR m.marital_status = ${normalizedMaritalStatus})
            AND (${normalizedGender}::text IS NULL OR m.gender = ${normalizedGender})
            AND (${executiveIdInt}::int IS NULL OR m.assigned_executive_member_id = ${executiveIdInt})
            AND (
              ${searchPattern}::text IS NULL OR
              m.full_name ILIKE ${searchPattern} OR
              m.member_id ILIKE ${searchPattern} OR
              m.email ILIKE ${searchPattern} OR
              m.phone ILIKE ${searchPattern} OR
              m.visa_status ILIKE ${searchPattern} OR
              m.marital_status ILIKE ${searchPattern}
            )
            AND (
              ${localityPattern}::text IS NULL OR
              m.uae_area ILIKE ${localityPattern} OR
              m.uae_city ILIKE ${localityPattern} OR
              m.home_district ILIKE ${localityPattern} OR
              m.home_local_body ILIKE ${localityPattern} OR
              m.home_local_area_ward ILIKE ${localityPattern}
            )
        `
      : await sql`
          SELECT COUNT(*) as count 
          FROM members m 
          WHERE (${isAdmin} OR m.assigned_executive_id = ${user.id})
            AND (${normalizedStatus}::text IS NULL OR m.status = ${normalizedStatus})
            AND (${normalizedVisaStatus}::text IS NULL OR m.visa_status = ${normalizedVisaStatus})
            AND (${normalizedMaritalStatus}::text IS NULL OR m.marital_status = ${normalizedMaritalStatus})
            AND (${normalizedGender}::text IS NULL OR m.gender = ${normalizedGender})
            AND (${executiveIdInt}::int IS NULL OR m.assigned_executive_id = ${executiveIdInt})
            AND (
              ${searchPattern}::text IS NULL OR
              m.full_name ILIKE ${searchPattern} OR
              m.member_id ILIKE ${searchPattern} OR
              m.email ILIKE ${searchPattern} OR
              m.phone ILIKE ${searchPattern} OR
              m.visa_status ILIKE ${searchPattern} OR
              m.marital_status ILIKE ${searchPattern}
            )
            AND (
              ${localityPattern}::text IS NULL OR
              m.uae_area ILIKE ${localityPattern} OR
              m.uae_city ILIKE ${localityPattern} OR
              m.home_district ILIKE ${localityPattern} OR
              m.home_local_body ILIKE ${localityPattern} OR
              m.home_local_area_ward ILIKE ${localityPattern}
            )
        `;

    // Get members with executive info
    const members =
      exportFormat === 'csv'
        ? hasExecutiveMemberColumn
          ? await sql`
              SELECT 
                m.*,
                ex.full_name as executive_name
              FROM members m
              LEFT JOIN members ex ON m.assigned_executive_member_id = ex.id
              WHERE (${isAdmin} OR m.assigned_executive_id = ${user.id})
                AND (${normalizedStatus}::text IS NULL OR m.status = ${normalizedStatus})
                AND (${normalizedVisaStatus}::text IS NULL OR m.visa_status = ${normalizedVisaStatus})
                AND (${normalizedMaritalStatus}::text IS NULL OR m.marital_status = ${normalizedMaritalStatus})
                AND (${normalizedGender}::text IS NULL OR m.gender = ${normalizedGender})
                AND (${executiveIdInt}::int IS NULL OR m.assigned_executive_member_id = ${executiveIdInt})
                AND (
                  ${searchPattern}::text IS NULL OR
                  m.full_name ILIKE ${searchPattern} OR
                  m.member_id ILIKE ${searchPattern} OR
                  m.email ILIKE ${searchPattern} OR
                  m.phone ILIKE ${searchPattern} OR
                  m.visa_status ILIKE ${searchPattern} OR
                  m.marital_status ILIKE ${searchPattern}
                )
                AND (
                  ${localityPattern}::text IS NULL OR
                  m.uae_area ILIKE ${localityPattern} OR
                  m.uae_city ILIKE ${localityPattern} OR
                  m.home_district ILIKE ${localityPattern} OR
                  m.home_local_body ILIKE ${localityPattern} OR
                  m.home_local_area_ward ILIKE ${localityPattern}
                )
              ORDER BY m.created_at DESC
            `
          : await sql`
              SELECT 
                m.*,
                u.full_name as executive_name
              FROM members m
              LEFT JOIN users u ON m.assigned_executive_id = u.id
              WHERE (${isAdmin} OR m.assigned_executive_id = ${user.id})
                AND (${normalizedStatus}::text IS NULL OR m.status = ${normalizedStatus})
                AND (${normalizedVisaStatus}::text IS NULL OR m.visa_status = ${normalizedVisaStatus})
                AND (${normalizedMaritalStatus}::text IS NULL OR m.marital_status = ${normalizedMaritalStatus})
                AND (${normalizedGender}::text IS NULL OR m.gender = ${normalizedGender})
                AND (${executiveIdInt}::int IS NULL OR m.assigned_executive_id = ${executiveIdInt})
                AND (
                  ${searchPattern}::text IS NULL OR
                  m.full_name ILIKE ${searchPattern} OR
                  m.member_id ILIKE ${searchPattern} OR
                  m.email ILIKE ${searchPattern} OR
                  m.phone ILIKE ${searchPattern} OR
                  m.visa_status ILIKE ${searchPattern} OR
                  m.marital_status ILIKE ${searchPattern}
                )
                AND (
                  ${localityPattern}::text IS NULL OR
                  m.uae_area ILIKE ${localityPattern} OR
                  m.uae_city ILIKE ${localityPattern} OR
                  m.home_district ILIKE ${localityPattern} OR
                  m.home_local_body ILIKE ${localityPattern} OR
                  m.home_local_area_ward ILIKE ${localityPattern}
                )
              ORDER BY m.created_at DESC
            `
        : hasExecutiveMemberColumn
        ? await sql`
            SELECT 
              m.*,
              ex.full_name as executive_name
            FROM members m
            LEFT JOIN members ex ON m.assigned_executive_member_id = ex.id
            WHERE (${isAdmin} OR m.assigned_executive_id = ${user.id})
              AND (${normalizedStatus}::text IS NULL OR m.status = ${normalizedStatus})
              AND (${normalizedVisaStatus}::text IS NULL OR m.visa_status = ${normalizedVisaStatus})
              AND (${normalizedMaritalStatus}::text IS NULL OR m.marital_status = ${normalizedMaritalStatus})
              AND (${normalizedGender}::text IS NULL OR m.gender = ${normalizedGender})
              AND (${executiveIdInt}::int IS NULL OR m.assigned_executive_member_id = ${executiveIdInt})
              AND (
                ${searchPattern}::text IS NULL OR
                m.full_name ILIKE ${searchPattern} OR
                m.member_id ILIKE ${searchPattern} OR
                m.email ILIKE ${searchPattern} OR
                m.phone ILIKE ${searchPattern} OR
                m.visa_status ILIKE ${searchPattern} OR
                m.marital_status ILIKE ${searchPattern}
              )
              AND (
                ${localityPattern}::text IS NULL OR
                m.uae_area ILIKE ${localityPattern} OR
                m.uae_city ILIKE ${localityPattern} OR
                m.home_district ILIKE ${localityPattern} OR
                m.home_local_body ILIKE ${localityPattern} OR
                m.home_local_area_ward ILIKE ${localityPattern}
              )
            ORDER BY m.created_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `
        : await sql`
            SELECT 
              m.*,
              u.full_name as executive_name
            FROM members m
            LEFT JOIN users u ON m.assigned_executive_id = u.id
            WHERE (${isAdmin} OR m.assigned_executive_id = ${user.id})
              AND (${normalizedStatus}::text IS NULL OR m.status = ${normalizedStatus})
              AND (${normalizedVisaStatus}::text IS NULL OR m.visa_status = ${normalizedVisaStatus})
              AND (${normalizedMaritalStatus}::text IS NULL OR m.marital_status = ${normalizedMaritalStatus})
              AND (${normalizedGender}::text IS NULL OR m.gender = ${normalizedGender})
              AND (${executiveIdInt}::int IS NULL OR m.assigned_executive_id = ${executiveIdInt})
              AND (
                ${searchPattern}::text IS NULL OR
                m.full_name ILIKE ${searchPattern} OR
                m.member_id ILIKE ${searchPattern} OR
                m.email ILIKE ${searchPattern} OR
                m.phone ILIKE ${searchPattern} OR
                m.visa_status ILIKE ${searchPattern} OR
                m.marital_status ILIKE ${searchPattern}
              )
              AND (
                ${localityPattern}::text IS NULL OR
                m.uae_area ILIKE ${localityPattern} OR
                m.uae_city ILIKE ${localityPattern} OR
                m.home_district ILIKE ${localityPattern} OR
                m.home_local_body ILIKE ${localityPattern} OR
                m.home_local_area_ward ILIKE ${localityPattern}
              )
            ORDER BY m.created_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `;

    if (exportFormat === 'csv') {
      const header = [
        'Member ID',
        'Full Name',
        'Phone',
        'Email',
        'Status',
        'Role',
        'Visa Status',
        'Marital Status',
        'UAE Area',
        'UAE City',
        'Home District',
        'Local Body',
        'Local Area/Ward',
        'Executive',
      ];
      const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const rows = members.map((member) =>
        [
          member.member_id,
          member.full_name,
          member.phone,
          member.email,
          member.status,
          member.membership_type,
          member.visa_status,
          member.marital_status,
          member.uae_area,
          member.uae_city,
          member.home_district,
          member.home_local_body,
          member.home_local_area_ward,
          member.executive_name,
        ]
          .map(escapeCsv)
          .join(',')
      );
      const csv = [header.join(','), ...rows].join('\n');
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="members-export.csv"',
        },
      });
    }

    return NextResponse.json({
      members,
      pagination: {
        total: parseInt(countResult[0].count),
        page,
        limit,
        totalPages: Math.ceil(parseInt(countResult[0].count) / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching members:', error);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureExtendedMemberProfileColumns();
    await ensureMemberMembershipsTable();
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
      full_name_arabic,
      emergency_contact,
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
      joined_date,
      membership_type,
      membership_plan,
      membership_payment_status,
      membership_fee_year,
      join_year,
      paid_years,
      status,
      membership_start_date,
      membership_end_date,
      notes,
      member_id: customMemberId,
    } = body;

    const resolvedPlan =
      membership_plan === 'lifetime' || membership_plan === 'annual'
        ? membership_plan
        : 'annual';
    const joinYear = normalizeJoinYear(
      join_year ?? membership_start_date ?? joined_date,
      new Date().getFullYear()
    );
    const paidYears = parsePaidYears(paid_years);
    // Backward compat: single payment_status + fee year → paid years list
    const legacyPaid =
      membership_payment_status === 'paid'
        ? paidYears.length > 0
          ? paidYears
          : [Number.parseInt(String(membership_fee_year || joinYear), 10) || joinYear]
        : paidYears;
    const resolvedPaymentStatus =
      resolvedPlan === 'lifetime'
        ? membership_payment_status === 'unpaid'
          ? 'unpaid'
          : 'paid'
        : legacyPaid.includes(new Date().getFullYear())
          ? 'paid'
          : 'unpaid';
    const period = annualPeriod(joinYear);
    const lifetimeStartFromBody =
      typeof body.lifetime_start_date === 'string' &&
      /^\d{4}-\d{2}-\d{2}/.test(body.lifetime_start_date)
        ? body.lifetime_start_date.slice(0, 10)
        : null;
    const resolvedStartDate =
      resolvedPlan === 'lifetime'
        ? lifetimeStartFromBody || membership_start_date || new Date().toISOString().slice(0, 10)
        : period.start_date;
    const resolvedEndDate =
      resolvedPlan === 'lifetime' ? null : annualPeriod(new Date().getFullYear()).end_date;

    if (!full_name || !phone) {
      return NextResponse.json(
        { error: 'Full name, phone, and membership details are required' },
        { status: 400 }
      );
    }

    const adminFieldErrors = validateAdminMemberFields({
      full_name,
      phone,
      whatsapp_number,
      emirates_id,
      passport_number,
      visa_status,
      nominee,
      ward_no: ward_no_input,
    });
    if (Object.keys(adminFieldErrors).length > 0) {
      return NextResponse.json(
        { error: 'Please fill in all required member fields.', errors: adminFieldErrors },
        { status: 400 }
      );
    }

    const duplicateCheck = await checkMemberDuplicates(
      email?.trim() || null,
      phone.trim(),
      whatsapp_number?.trim() || phone.trim()
    );
    if (duplicateCheck.duplicate) {
      return NextResponse.json(
        {
          error: 'A member with this email or phone number already exists.',
          errors: duplicateCheck.errors,
        },
        { status: 409 }
      );
    }

    // Resolve member ID (custom or auto-generated)
    const memberIdResult = await resolveMemberId(customMemberId || null);
    if ('error' in memberIdResult) {
      return NextResponse.json(
        {
          error: memberIdResult.error,
          errors: { [memberIdResult.field]: memberIdResult.error },
        },
        { status: 409 }
      );
    }
    const memberId = memberIdResult.memberId;
    const ward_no = parseWardNo(ward_no_input);

    const hasExecutiveMemberColumn = await hasAssignedExecutiveMemberColumn();
    const normalizedChildrenCount =
      children_count === null || children_count === undefined || children_count === ''
        ? null
        : Number(children_count);

    const result = hasExecutiveMemberColumn
      ? await sql`
          INSERT INTO members (
            member_id, full_name, email, phone, whatsapp_number, date_of_birth,
            nominee, ward_no, emirates_id, passport_number, visa_status, profession, company_name, work_location,
            address, uae_building, uae_area, uae_city, full_name_arabic,
            gender, blood_group, marital_status, emergency_contact,
            home_country_address, home_state, home_district, home_local_body, home_local_area_ward,
            home_country_contact_number, spouse_name, children_count, children_details, family_residing_with,
            joined_date, membership_type, membership_plan, membership_payment_status,
            membership_start_date, membership_end_date, status, assigned_executive_member_id, notes
          ) VALUES (
            ${memberId}, ${full_name}, ${email || null}, ${phone}, 
            ${whatsapp_number || null}, ${date_of_birth || null},
            ${nominee || null}, ${ward_no}, ${emirates_id || null}, ${passport_number || null}, ${visa_status || null},
            ${profession || null}, ${company_name || null}, ${work_location || null},
            ${address || null}, ${uae_building || null}, ${uae_area || null}, ${uae_city || null}, ${full_name_arabic || null},
            ${gender || null}, ${blood_group || null}, ${marital_status || null}, ${emergency_contact || null},
            ${home_country_address || null}, ${home_state || null}, ${home_district || null}, ${home_local_body || null}, ${home_local_area_ward || null},
            ${home_country_contact_number || null}, ${spouse_name || null}, ${normalizedChildrenCount}, ${children_details || null}, ${family_residing_with ?? null},
            ${joined_date || new Date().toISOString().slice(0, 10)}, ${membership_type || 'member'}, ${resolvedPlan}, ${resolvedPaymentStatus},
            ${resolvedStartDate}, ${resolvedEndDate}, ${status || 'pending'},
            ${null}, ${notes || null}
          )
          RETURNING *
        `
      : await sql`
          INSERT INTO members (
            member_id, full_name, email, phone, whatsapp_number, date_of_birth,
            nominee, ward_no, emirates_id, passport_number, visa_status, profession, company_name, work_location,
            address, uae_building, uae_area, uae_city, full_name_arabic,
            gender, blood_group, marital_status, emergency_contact,
            home_country_address, home_state, home_district, home_local_body, home_local_area_ward,
            home_country_contact_number, spouse_name, children_count, children_details, family_residing_with,
            joined_date, membership_type, membership_plan, membership_payment_status,
            membership_start_date, membership_end_date, status, assigned_executive_id, notes
          ) VALUES (
            ${memberId}, ${full_name}, ${email || null}, ${phone}, 
            ${whatsapp_number || null}, ${date_of_birth || null},
            ${nominee || null}, ${ward_no}, ${emirates_id || null}, ${passport_number || null}, ${visa_status || null},
            ${profession || null}, ${company_name || null}, ${work_location || null},
            ${address || null}, ${uae_building || null}, ${uae_area || null}, ${uae_city || null}, ${full_name_arabic || null},
            ${gender || null}, ${blood_group || null}, ${marital_status || null}, ${emergency_contact || null},
            ${home_country_address || null}, ${home_state || null}, ${home_district || null}, ${home_local_body || null}, ${home_local_area_ward || null},
            ${home_country_contact_number || null}, ${spouse_name || null}, ${normalizedChildrenCount}, ${children_details || null}, ${family_residing_with ?? null},
            ${joined_date || new Date().toISOString().slice(0, 10)}, ${membership_type || 'member'}, ${resolvedPlan}, ${resolvedPaymentStatus},
            ${resolvedStartDate}, ${resolvedEndDate}, ${status || 'pending'},
            ${null}, ${notes || null}
          )
          RETURNING *
        `;

    await syncMemberFeeYears({
      memberId: result[0].id,
      plan: resolvedPlan,
      joinYear,
      paidYears: legacyPaid,
      createdBy: user.id,
      paymentStatusForLifetime: resolvedPaymentStatus,
      lifetimeStartDate: resolvedPlan === 'lifetime' ? resolvedStartDate : null,
    });
    await reconcileMemberStatusesByPayment();

    // Log the action
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (${user.id}, 'create', 'member', ${result[0].id}, ${JSON.stringify(result[0])})
    `;

    return NextResponse.json({ member: result[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating member:', error);
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 });
  }
}
