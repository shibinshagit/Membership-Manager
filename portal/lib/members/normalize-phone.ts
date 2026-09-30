/**
 * Canonical phone storage: E.164 digits only (no +, no spaces).
 * Examples: 971501234567 (UAE), 919876543210 (India).
 *
 * Display: use formatPhoneDisplay() → +971 50 123 4567
 */

export type PhoneDefaultCountry = 'AE' | 'IN';

const UAE_CODE = '971';
const INDIA_CODE = '91';

/** Strip to digits only. */
export function digitsOnly(phone: string | null | undefined): string {
  return String(phone || '').replace(/\D/g, '');
}

/**
 * Normalize to canonical E.164 digits (no +).
 * - UAE mobile fields (phone / WhatsApp): defaultCountry 'AE'
 * - Kerala / home contact: defaultCountry 'IN'
 */
export function normalizePhoneToE164(
  raw: string | null | undefined,
  defaultCountry: PhoneDefaultCountry = 'AE'
): string | null {
  let digits = digitsOnly(raw);
  if (!digits) return null;

  // International 00-prefix → drop
  if (digits.startsWith('00')) digits = digits.slice(2);

  // Leading 0 before a full international number (e.g. 0971… / 091…)
  if (digits.startsWith(`0${UAE_CODE}`) && digits.length >= 12) {
    digits = digits.slice(1);
  } else if (digits.startsWith(`0${INDIA_CODE}`) && digits.length >= 13) {
    digits = digits.slice(1);
  }

  // Already has UAE / India country code
  if (digits.startsWith(UAE_CODE) && digits.length >= 11) {
    return digits;
  }
  if (digits.startsWith(INDIA_CODE) && digits.length >= 12) {
    return digits;
  }

  // UAE local forms: 05xxxxxxxx, 5xxxxxxxx, 050xxxxxxx
  if (digits.length === 10 && digits.startsWith('05')) {
    return `${UAE_CODE}${digits.slice(1)}`;
  }
  if (digits.length === 9 && digits.startsWith('5')) {
    return `${UAE_CODE}${digits}`;
  }
  if (digits.length === 10 && digits.startsWith('5')) {
    // Rare: 5xxxxxxxxx (10 digits starting with 5)
    return `${UAE_CODE}${digits}`;
  }
  if (digits.startsWith('0') && digits.length >= 9 && defaultCountry === 'AE') {
    return `${UAE_CODE}${digits.slice(1)}`;
  }

  // India local: 10-digit mobile starting 6–9
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `${INDIA_CODE}${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 11 && defaultCountry === 'IN') {
    return `${INDIA_CODE}${digits.slice(1)}`;
  }

  // Apply default country when still looks local
  if (defaultCountry === 'AE' && !digits.startsWith(UAE_CODE) && digits.length <= 10) {
    const local = digits.startsWith('0') ? digits.slice(1) : digits;
    if (local.length >= 8) return `${UAE_CODE}${local}`;
  }
  if (defaultCountry === 'IN' && !digits.startsWith(INDIA_CODE) && digits.length <= 11) {
    const local = digits.startsWith('0') ? digits.slice(1) : digits;
    if (local.length >= 8) return `${INDIA_CODE}${local}`;
  }

  return digits;
}

/** Alias used by WhatsApp / wa.me builders (UAE default). */
export function normalizeWhatsAppPhone(raw: string | null | undefined): string {
  return normalizePhoneToE164(raw, 'AE') || '';
}

/** Comparison key for duplicates (same as canonical E.164). */
export function normalizePhoneForComparison(phone: string): string {
  return normalizePhoneToE164(phone, 'AE') || digitsOnly(phone);
}

/** @deprecated Prefer digitsOnly / normalizePhoneToE164 */
export function normalizePhone(phone: string): string {
  return digitsOnly(phone);
}

/**
 * Human-readable display from canonical or raw input.
 * 971501234567 → +971 50 123 4567
 * 919876543210 → +91 98765 43210
 */
export function formatPhoneDisplay(raw: string | null | undefined): string {
  const canonical = normalizePhoneToE164(raw, 'AE') || digitsOnly(raw);
  if (!canonical) return '';

  if (canonical.startsWith(UAE_CODE) && canonical.length >= 11) {
    const rest = canonical.slice(3); // drop 971
    // Mobile: 5x xxx xxxx → +971 5x xxx xxxx
    if (rest.length === 9) {
      return `+971 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`;
    }
    return `+971 ${rest}`;
  }

  if (canonical.startsWith(INDIA_CODE) && canonical.length >= 12) {
    const rest = canonical.slice(2);
    if (rest.length === 10) {
      return `+91 ${rest.slice(0, 5)} ${rest.slice(5)}`;
    }
    return `+91 ${rest}`;
  }

  return `+${canonical}`;
}

/** True when normalized number has enough digits to be useful. */
export function isValidNormalizedPhone(
  raw: string | null | undefined,
  defaultCountry: PhoneDefaultCountry = 'AE'
): boolean {
  const n = normalizePhoneToE164(raw, defaultCountry);
  if (!n) return false;
  if (n.startsWith(UAE_CODE)) return n.length === 12; // 971 + 9
  if (n.startsWith(INDIA_CODE)) return n.length === 12; // 91 + 10
  return n.length >= 10 && n.length <= 15;
}

/** Normalize a form field on blur: keep typed value if invalid, else show display format. */
export function normalizePhoneInputValue(
  raw: string,
  defaultCountry: PhoneDefaultCountry = 'AE'
): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const canonical = normalizePhoneToE164(trimmed, defaultCountry);
  if (!canonical || !isValidNormalizedPhone(trimmed, defaultCountry)) return trimmed;
  return formatPhoneDisplay(canonical);
}
