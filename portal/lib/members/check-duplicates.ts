import { sql } from '@/lib/db';
import { normalizePhone, normalizePhoneForComparison } from './normalize-phone';

export interface DuplicateCheckResult {
  duplicate: boolean;
  errors: Record<string, string>;
}

function phoneVariants(phone: string): string[] {
  const normalized = normalizePhoneForComparison(phone);
  const digits = normalizePhone(phone);
  const variants = new Set([normalized, digits]);
  if (normalized.startsWith('971') && normalized.length > 3) {
    variants.add('0' + normalized.slice(3));
    variants.add(normalized.slice(3));
  }
  if (digits.startsWith('0') && digits.length >= 9) {
    variants.add('971' + digits.slice(1));
  }
  return [...variants].filter((v) => v.length >= 7);
}

async function findPhoneDuplicate(variants: string[]): Promise<boolean> {
  if (variants.length === 0) return false;
  const match = await sql`
    SELECT id FROM members
    WHERE REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') = ANY(${variants})
       OR REGEXP_REPLACE(COALESCE(whatsapp_number, ''), '[^0-9]', '', 'g') = ANY(${variants})
    LIMIT 1
  `;
  return match.length > 0;
}

export async function checkMemberDuplicates(
  email: string | null | undefined,
  phone: string,
  whatsappNumber?: string | null
): Promise<DuplicateCheckResult> {
  const errors: Record<string, string> = {};
  const trimmedEmail = email?.trim().toLowerCase() || null;

  if (trimmedEmail) {
    const emailMatch = await sql`
      SELECT id FROM members
      WHERE email IS NOT NULL AND LOWER(TRIM(email)) = ${trimmedEmail}
      LIMIT 1
    `;
    if (emailMatch.length > 0) {
      errors.email =
        'This email is already registered. If you are already a member, please contact the administrator.';
    }
  }

  const phoneVariantsList = phoneVariants(phone);
  if (await findPhoneDuplicate(phoneVariantsList)) {
    errors.phone =
      'This phone number is already registered. If you are already a member, please contact the administrator.';
  } else if (whatsappNumber) {
    const waVariants = phoneVariants(whatsappNumber);
    const waOnly = waVariants.filter((v) => !phoneVariantsList.includes(v));
    if (waOnly.length > 0 && (await findPhoneDuplicate(waOnly))) {
      errors.whatsapp_number = 'This WhatsApp number is already registered.';
    }
  }

  return {
    duplicate: Object.keys(errors).length > 0,
    errors,
  };
}

export async function checkMemberDuplicatesForUpdate(
  memberId: number,
  email: string | null | undefined,
  phone: string,
  whatsappNumber?: string | null
): Promise<DuplicateCheckResult> {
  const trimmedEmail = email?.trim().toLowerCase() || null;

  if (trimmedEmail) {
    const emailMatch = await sql`
      SELECT id FROM members
      WHERE email IS NOT NULL AND LOWER(TRIM(email)) = ${trimmedEmail} AND id != ${memberId}
      LIMIT 1
    `;
    if (emailMatch.length > 0) {
      return {
        duplicate: true,
        errors: {
          email: 'This email is already registered to another member.',
        },
      };
    }
  }

  const phoneVariantsList = phoneVariants(phone);
  const phoneMatch = await sql`
    SELECT id FROM members
    WHERE id != ${memberId}
      AND (
        REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') = ANY(${phoneVariantsList})
        OR REGEXP_REPLACE(COALESCE(whatsapp_number, ''), '[^0-9]', '', 'g') = ANY(${phoneVariantsList})
      )
    LIMIT 1
  `;
  if (phoneMatch.length > 0) {
    return {
      duplicate: true,
      errors: {
        phone: 'This phone number is already registered to another member.',
      },
    };
  }

  if (whatsappNumber) {
    const waVariants = phoneVariants(whatsappNumber);
    const waMatch = await sql`
      SELECT id FROM members
      WHERE id != ${memberId}
        AND (
          REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') = ANY(${waVariants})
          OR REGEXP_REPLACE(COALESCE(whatsapp_number, ''), '[^0-9]', '', 'g') = ANY(${waVariants})
        )
      LIMIT 1
    `;
    if (waMatch.length > 0) {
      return {
        duplicate: true,
        errors: {
          whatsapp_number: 'This WhatsApp number is already registered to another member.',
        },
      };
    }
  }

  return { duplicate: false, errors: {} };
}
