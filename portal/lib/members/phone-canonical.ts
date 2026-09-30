import {
  formatPhoneDisplay,
  normalizePhoneToE164,
  type PhoneDefaultCountry,
} from '@/lib/members/normalize-phone';

export function canonicalizeMemberPhones(input: {
  phone?: string | null;
  whatsapp_number?: string | null;
  home_country_contact_number?: string | null;
}): {
  phone: string | null;
  whatsapp_number: string | null;
  home_country_contact_number: string | null;
} {
  return {
    phone: normalizePhoneToE164(input.phone, 'AE'),
    whatsapp_number: normalizePhoneToE164(input.whatsapp_number, 'AE'),
    home_country_contact_number: normalizePhoneToE164(
      input.home_country_contact_number,
      'IN'
    ),
  };
}

export function displayMemberPhone(
  raw: string | null | undefined,
  defaultCountry: PhoneDefaultCountry = 'AE'
): string {
  if (!raw) return '';
  const canonical = normalizePhoneToE164(raw, defaultCountry);
  return formatPhoneDisplay(canonical || raw);
}
