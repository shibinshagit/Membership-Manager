import { validateWardNo } from '@/lib/members/ward-numbers';

export function validateAdminMemberFields(input: {
  full_name?: string | null;
  phone?: string | null;
  whatsapp_number?: string | null;
  emirates_id?: string | null;
  passport_number?: string | null;
  visa_status?: string | null;
  nominee?: string | null;
  ward_no?: unknown;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.full_name?.trim()) {
    errors.full_name = 'Full name is required.';
  }

  if (!input.phone?.trim()) {
    errors.phone = 'Phone number is required.';
  }

  if (!input.whatsapp_number?.trim()) {
    errors.whatsapp_number = 'WhatsApp number is required.';
  }

  if (!input.emirates_id?.trim()) {
    errors.emirates_id = 'Emirates ID is required.';
  }

  if (!input.passport_number?.trim()) {
    errors.passport_number = 'Passport number is required.';
  }

  if (!input.visa_status?.trim()) {
    errors.visa_status = 'Visa status is required.';
  }

  if (!input.nominee?.trim()) {
    errors.nominee = 'Nominee is required.';
  }

  const wardError = validateWardNo(input.ward_no);
  if (wardError) {
    errors.ward_no = wardError;
  }

  return errors;
}
