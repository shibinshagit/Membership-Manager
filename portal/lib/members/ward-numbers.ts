/** Numeric wards 1–16, plus 0 for "Other". */
export const WARD_OTHER_VALUE = 0;

export const WARD_NUMBER_OPTIONS = Array.from({ length: 16 }, (_, index) => index + 1);

export const WARD_SELECT_OPTIONS: Array<{ value: number; label: string }> = [
  ...WARD_NUMBER_OPTIONS.map((ward) => ({ value: ward, label: `Ward ${ward}` })),
  { value: WARD_OTHER_VALUE, label: 'Other' },
];

export function formatWardNoLabel(wardNo: number | null | undefined): string {
  if (wardNo === null || wardNo === undefined) return '—';
  if (wardNo === WARD_OTHER_VALUE) return 'Other';
  return `Ward ${wardNo}`;
}

export function parseWardNo(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'string' && value.trim().toLowerCase() === 'other') {
    return WARD_OTHER_VALUE;
  }

  const wardNo = Number(value);
  if (!Number.isInteger(wardNo)) {
    return null;
  }

  if (wardNo === WARD_OTHER_VALUE) {
    return WARD_OTHER_VALUE;
  }

  if (wardNo < 1 || wardNo > 16) {
    return null;
  }

  return wardNo;
}

export function validateWardNo(value: unknown): string | null {
  if (parseWardNo(value) === null) {
    return 'Ward number is required. Please select 1–16 or Other.';
  }

  return null;
}
