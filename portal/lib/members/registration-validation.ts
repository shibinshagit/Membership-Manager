import { validateDocumentFile, validatePhotoFile } from '@/lib/documents/validate-document-file';
import { validateWardNo } from '@/lib/members/ward-numbers';

export type RegistrationFieldErrors = Record<string, string>;

function requireText(
  errors: RegistrationFieldErrors,
  key: string,
  value: string | null | undefined,
  label: string
) {
  if (!value?.trim()) {
    errors[key] = `${label} is required.`;
  }
}

function requirePhoneLike(
  errors: RegistrationFieldErrors,
  key: string,
  value: string | null | undefined,
  label: string
) {
  const trimmed = value?.trim() || '';
  if (!trimmed) {
    errors[key] = `${label} is required.`;
    return;
  }
  if (trimmed.replace(/\D/g, '').length < 7) {
    errors[key] = `Please enter a valid ${label.toLowerCase()}.`;
  }
}

export function validateRegistrationFields(input: {
  full_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  blood_group?: string | null;
  marital_status?: string | null;
  phone?: string | null;
  whatsapp_number?: string | null;
  email?: string | null;
  uae_building?: string | null;
  uae_area?: string | null;
  uae_city?: string | null;
  address?: string | null;
  emirates_id?: string | null;
  passport_number?: string | null;
  visa_status?: string | null;
  profession?: string | null;
  company_name?: string | null;
  work_location?: string | null;
  home_country_address?: string | null;
  home_state?: string | null;
  home_district?: string | null;
  home_local_body?: string | null;
  home_local_area_ward?: string | null;
  home_country_contact_number?: string | null;
  family_residing_with?: string | null;
  membership_plan?: string | null;
  member_id?: string | null;
  nominee?: string | null;
  ward_no?: unknown;
  emirates_id_file?: File | null;
  passport_file?: File | null;
  photo_file?: File | null;
  requireDocuments?: boolean;
}): RegistrationFieldErrors {
  const errors: RegistrationFieldErrors = {};

  const fullName = input.full_name?.trim() || '';
  if (!fullName) {
    errors.full_name = 'Full name is required.';
  } else if (fullName.length < 2) {
    errors.full_name = 'Please enter your full name as shown on your passport.';
  }

  requireText(errors, 'date_of_birth', input.date_of_birth, 'Date of birth');
  if (input.date_of_birth?.trim()) {
    const dob = new Date(input.date_of_birth);
    if (Number.isNaN(dob.getTime())) {
      errors.date_of_birth = 'Please enter a valid date of birth.';
    } else if (dob > new Date()) {
      errors.date_of_birth = 'Date of birth cannot be in the future.';
    }
  }

  requireText(errors, 'gender', input.gender, 'Gender');
  requireText(errors, 'blood_group', input.blood_group, 'Blood group');
  requireText(errors, 'marital_status', input.marital_status, 'Marital status');
  requireText(errors, 'nominee', input.nominee, 'Nominee');

  requirePhoneLike(errors, 'phone', input.phone, 'Phone number');
  requirePhoneLike(errors, 'whatsapp_number', input.whatsapp_number, 'WhatsApp number');

  const email = input.email?.trim() || '';
  if (!email) {
    errors.email = 'Email address is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Please enter a valid email address.';
  }

  // UAE building, full address, company, work location, state, and district are optional.
  requireText(errors, 'uae_area', input.uae_area, 'Area');
  requireText(errors, 'uae_city', input.uae_city, 'Emirate / city');

  requireText(errors, 'emirates_id', input.emirates_id, 'Emirates ID');
  requireText(errors, 'passport_number', input.passport_number, 'Passport number');
  requireText(errors, 'visa_status', input.visa_status, 'Visa status');

  requireText(errors, 'profession', input.profession, 'Profession');

  requireText(errors, 'home_country_address', input.home_country_address, 'Permanent address');
  requireText(errors, 'home_local_body', input.home_local_body, 'Panchayath / municipality');
  requireText(errors, 'home_local_area_ward', input.home_local_area_ward, 'Locality');
  requirePhoneLike(
    errors,
    'home_country_contact_number',
    input.home_country_contact_number,
    'Home country contact number'
  );

  const familyResiding = input.family_residing_with?.trim();
  if (familyResiding !== 'true' && familyResiding !== 'false') {
    errors.family_residing_with = 'Please select whether family is residing with you.';
  }

  const wardError = validateWardNo(input.ward_no);
  if (wardError) {
    errors.ward_no = wardError;
  }

  const plan = input.membership_plan;
  if (plan !== 'annual' && plan !== 'lifetime') {
    errors.membership_plan = 'Please select a membership plan.';
  }

  const memberId = input.member_id?.trim();
  if (memberId && (memberId.length < 2 || memberId.length > 50)) {
    errors.member_id = 'Membership ID must be between 2 and 50 characters.';
  }

  if (input.requireDocuments !== false) {
    const emiratesFileError = validateDocumentFile(input.emirates_id_file ?? null, 'Emirates ID');
    if (emiratesFileError) errors.emirates_id_file = emiratesFileError;

    const passportFileError = validateDocumentFile(input.passport_file ?? null, 'Passport');
    if (passportFileError) errors.passport_file = passportFileError;

    const photoFileError = validatePhotoFile(input.photo_file ?? null, 'Member photo');
    if (photoFileError) errors.photo_file = photoFileError;
  }

  return errors;
}

export const REGISTRATION_FIELD_SECTIONS: Record<string, string> = {
  member_id: 'personal',
  full_name: 'personal',
  date_of_birth: 'personal',
  gender: 'personal',
  blood_group: 'personal',
  marital_status: 'personal',
  nominee: 'personal',
  phone: 'contact',
  whatsapp_number: 'contact',
  email: 'contact',
  uae_building: 'contact',
  uae_area: 'contact',
  uae_city: 'contact',
  address: 'contact',
  emirates_id: 'identity',
  passport_number: 'identity',
  visa_status: 'identity',
  profession: 'identity',
  company_name: 'identity',
  work_location: 'identity',
  emirates_id_file: 'identity',
  passport_file: 'identity',
  photo_file: 'identity',
  home_country_address: 'family',
  home_state: 'family',
  home_district: 'family',
  home_local_body: 'family',
  home_local_area_ward: 'family',
  home_country_contact_number: 'family',
  family_residing_with: 'family',
  ward_no: 'family',
  membership_plan: 'plan',
};

export const REGISTRATION_FIELD_LABELS: Record<string, string> = {
  member_id: 'Membership ID',
  full_name: 'Full name',
  date_of_birth: 'Date of birth',
  gender: 'Gender',
  blood_group: 'Blood group',
  marital_status: 'Marital status',
  nominee: 'Nominee',
  phone: 'Phone number',
  whatsapp_number: 'WhatsApp number',
  email: 'Email address',
  uae_building: 'Building / villa number',
  uae_area: 'Area',
  uae_city: 'Emirate / city',
  address: 'Full address',
  emirates_id: 'Emirates ID',
  passport_number: 'Passport number',
  visa_status: 'Visa status',
  profession: 'Profession',
  company_name: 'Company name',
  work_location: 'Work location',
  emirates_id_file: 'Emirates ID photo',
  passport_file: 'Passport photo',
  photo_file: 'Member photo',
  home_country_address: 'Permanent address',
  home_state: 'State',
  home_district: 'District',
  home_local_body: 'Panchayath / municipality',
  home_local_area_ward: 'Locality',
  home_country_contact_number: 'Home country contact',
  family_residing_with: 'Family residing with you',
  ward_no: 'Ward number',
  membership_plan: 'Membership plan',
};
