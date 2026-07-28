/** Strip to digits only for comparison. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Normalize UAE numbers: 0501234567 and +971501234567 become 971501234567 */
export function normalizePhoneForComparison(phone: string): string {
  let digits = normalizePhone(phone);
  if (digits.startsWith('0') && digits.length >= 9) {
    digits = '971' + digits.slice(1);
  }
  return digits;
}
