import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { checkMemberDuplicates } from '@/lib/members/check-duplicates';
import { resolveMemberId } from '@/lib/members/resolve-member-id';
import { validateRegistrationFields } from '@/lib/members/registration-validation';
import { parseWardNo } from '@/lib/members/ward-numbers';
import { storeMemberDocument } from '@/lib/documents/store-document';
import {
  ensureAssignedExecutiveMemberColumn,
  ensureExtendedMemberProfileColumns,
  hasAssignedExecutiveMemberColumn,
} from '@/lib/db/compat';

export const runtime = 'nodejs';
/** Allow slow mobile uploads + blob storage (Vercel). */
export const maxDuration = 60;

function parseOptionalBoolean(value: FormDataEntryValue | null): boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function getString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getFile(value: FormDataEntryValue | null): File | null {
  return value instanceof File && value.size > 0 ? value : null;
}

export async function POST(request: Request) {
  try {
    await ensureExtendedMemberProfileColumns();

    const formData = await request.formData();

    const full_name = getString(formData.get('full_name'));
    const phone = getString(formData.get('phone'));
    const whatsapp_number = getString(formData.get('whatsapp_number'));
    const email = getString(formData.get('email'));
    const emirates_id = getString(formData.get('emirates_id'));
    const passport_number = getString(formData.get('passport_number'));
    const visa_status = getString(formData.get('visa_status'));
    const nominee = getString(formData.get('nominee'));
    const ward_no = parseWardNo(formData.get('ward_no'));
    const membership_plan = getString(formData.get('membership_plan')) || 'annual';
    const member_id_input = getString(formData.get('member_id'));

    const emirates_id_file = getFile(formData.get('emirates_id_file'));
    const passport_file = getFile(formData.get('passport_file'));
    const photo_file = getFile(formData.get('photo_file'));

    const validationErrors = validateRegistrationFields({
      full_name,
      date_of_birth: getString(formData.get('date_of_birth')),
      gender: getString(formData.get('gender')),
      blood_group: getString(formData.get('blood_group')),
      marital_status: getString(formData.get('marital_status')),
      phone,
      whatsapp_number,
      email,
      uae_building: getString(formData.get('uae_building')),
      uae_area: getString(formData.get('uae_area')),
      uae_city: getString(formData.get('uae_city')),
      address: getString(formData.get('address')),
      emirates_id,
      passport_number,
      visa_status,
      profession: getString(formData.get('profession')),
      company_name: getString(formData.get('company_name')),
      work_location: getString(formData.get('work_location')),
      home_country_address: getString(formData.get('home_country_address')),
      home_state: getString(formData.get('home_state')),
      home_district: getString(formData.get('home_district')),
      home_local_body: getString(formData.get('home_local_body')),
      home_local_area_ward: getString(formData.get('home_local_area_ward')),
      home_country_contact_number: getString(formData.get('home_country_contact_number')),
      family_residing_with: getString(formData.get('family_residing_with')),
      nominee,
      ward_no,
      membership_plan,
      member_id: member_id_input,
      emirates_id_file,
      passport_file,
      photo_file,
    });

    if (Object.keys(validationErrors).length > 0) {
      return NextResponse.json(
        {
          error: 'Please fix the errors below.',
          errors: validationErrors,
        },
        { status: 400 }
      );
    }

    const trimmedEmail = email;
    const duplicateCheck = await checkMemberDuplicates(trimmedEmail, phone, whatsapp_number);
    if (duplicateCheck.duplicate) {
      return NextResponse.json(
        {
          error: 'A registration with this contact information already exists.',
          errors: duplicateCheck.errors,
        },
        { status: 409 }
      );
    }

    const memberIdResult = await resolveMemberId(member_id_input || null);
    if ('error' in memberIdResult) {
      return NextResponse.json(
        {
          error: memberIdResult.error,
          errors: { [memberIdResult.field]: memberIdResult.error },
        },
        { status: 409 }
      );
    }

    const resolvedPlan = membership_plan === 'lifetime' ? 'lifetime' : 'annual';
    const today = new Date().toISOString().slice(0, 10);
    const memberId = memberIdResult.memberId;

    const gender = getString(formData.get('gender')) || null;
    const blood_group = getString(formData.get('blood_group')) || null;
    const marital_status = getString(formData.get('marital_status')) || null;
    const date_of_birth = getString(formData.get('date_of_birth')) || null;
    const profession = getString(formData.get('profession')) || null;
    const company_name = getString(formData.get('company_name')) || null;
    const work_location = getString(formData.get('work_location')) || null;
    const address = getString(formData.get('address')) || null;
    const uae_building = getString(formData.get('uae_building')) || null;
    const uae_area = getString(formData.get('uae_area')) || null;
    const uae_city = getString(formData.get('uae_city')) || null;
    const home_country_address = getString(formData.get('home_country_address')) || null;
    const home_state = getString(formData.get('home_state')) || null;
    const home_district = getString(formData.get('home_district')) || null;
    const home_local_body = getString(formData.get('home_local_body')) || null;
    const home_local_area_ward = getString(formData.get('home_local_area_ward')) || null;
    const home_country_contact_number = getString(formData.get('home_country_contact_number')) || null;
    const spouse_name = getString(formData.get('spouse_name')) || null;
    const children_details = getString(formData.get('children_details')) || null;
    const children_count_raw = formData.get('children_count');
    const normalizedChildrenCount =
      children_count_raw === null || children_count_raw === ''
        ? null
        : Number(children_count_raw);
    const family_residing_with = parseOptionalBoolean(formData.get('family_residing_with'));

    const hasExecutiveMemberColumn = await hasAssignedExecutiveMemberColumn();

    const result = hasExecutiveMemberColumn
      ? await sql`
          INSERT INTO members (
            member_id, full_name, email, phone, whatsapp_number, date_of_birth,
            nominee, ward_no, emirates_id, passport_number, visa_status, profession, company_name, work_location,
            address, uae_building, uae_area, uae_city,
            gender, blood_group, marital_status,
            home_country_address, home_state, home_district, home_local_body, home_local_area_ward,
            home_country_contact_number, spouse_name, children_count, children_details, family_residing_with,
            joined_date, membership_type, membership_plan, membership_payment_status,
            membership_start_date, membership_end_date, status, assigned_executive_member_id, notes
          ) VALUES (
            ${memberId}, ${full_name}, ${trimmedEmail}, ${phone},
            ${whatsapp_number}, ${date_of_birth || null},
            ${nominee}, ${ward_no}, ${emirates_id}, ${passport_number}, ${visa_status},
            ${profession || null}, ${company_name || null}, ${work_location || null},
            ${address || null}, ${uae_building || null}, ${uae_area || null}, ${uae_city || null},
            ${gender}, ${blood_group}, ${marital_status},
            ${home_country_address || null}, ${home_state || null}, ${home_district || null}, ${home_local_body || null}, ${home_local_area_ward || null},
            ${home_country_contact_number || null}, ${spouse_name || null}, ${normalizedChildrenCount}, ${children_details || null}, ${family_residing_with ?? null},
            ${today}, 'member', ${resolvedPlan}, 'unpaid',
            ${today}, ${null}, 'pending',
            ${null}, ${'Self-registration — pending approval'}
          )
          RETURNING id, member_id, full_name, status
        `
      : await sql`
          INSERT INTO members (
            member_id, full_name, email, phone, whatsapp_number, date_of_birth,
            nominee, ward_no, emirates_id, passport_number, visa_status, profession, company_name, work_location,
            address, uae_building, uae_area, uae_city,
            gender, blood_group, marital_status,
            home_country_address, home_state, home_district, home_local_body, home_local_area_ward,
            home_country_contact_number, spouse_name, children_count, children_details, family_residing_with,
            joined_date, membership_type, membership_plan, membership_payment_status,
            membership_start_date, membership_end_date, status, assigned_executive_id, notes
          ) VALUES (
            ${memberId}, ${full_name}, ${trimmedEmail}, ${phone},
            ${whatsapp_number}, ${date_of_birth || null},
            ${nominee}, ${ward_no}, ${emirates_id}, ${passport_number}, ${visa_status},
            ${profession || null}, ${company_name || null}, ${work_location || null},
            ${address || null}, ${uae_building || null}, ${uae_area || null}, ${uae_city || null},
            ${gender}, ${blood_group}, ${marital_status},
            ${home_country_address || null}, ${home_state || null}, ${home_district || null}, ${home_local_body || null}, ${home_local_area_ward || null},
            ${home_country_contact_number || null}, ${spouse_name || null}, ${normalizedChildrenCount}, ${children_details || null}, ${family_residing_with ?? null},
            ${today}, 'member', ${resolvedPlan}, 'unpaid',
            ${today}, ${null}, 'pending',
            ${null}, ${'Self-registration — pending approval'}
          )
          RETURNING id, member_id, full_name, status
        `;

    await ensureAssignedExecutiveMemberColumn();

    const memberDbId = result[0].id as number;

    try {
      await Promise.all([
        storeMemberDocument(memberDbId, 'emirates_id', emirates_id_file!),
        storeMemberDocument(memberDbId, 'passport', passport_file!),
        storeMemberDocument(memberDbId, 'photo', photo_file!),
      ]);
    } catch (uploadError) {
      console.error('Registration document upload error:', uploadError);
      return NextResponse.json(
        {
          error:
            'Your details were saved, but document upload failed. Please try again with smaller JPG/PNG photos (under 2MB each), or contact the administrator with your name and phone number.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        message: 'Your application has been submitted successfully. It is pending review by the committee.',
        member: result[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    const message =
      error instanceof Error && /BLOB_READ_WRITE_TOKEN/i.test(error.message)
        ? 'Document storage is not configured. Please contact the administrator.'
        : 'Something went wrong. Please try again later.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
