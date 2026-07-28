/** Client-safe calendar-year fee helpers (no Node/DB imports). */

export const ORG_START_YEAR = 2013;
export const FEE_TYPE_ANNUAL = 'annual_membership';
export const FEE_TYPE_LIFETIME = 'lifetime_membership';
export const ANNUAL_AMOUNT = 50;
export const LIFETIME_AMOUNT = 750;

export const FEE_PLANS = {
  [FEE_TYPE_ANNUAL]: {
    label: 'Annual Membership (calendar year)',
    amount: ANNUAL_AMOUNT,
    feeYearMode: 'required' as const,
  },
  [FEE_TYPE_LIFETIME]: {
    label: 'Lifetime Membership',
    amount: LIFETIME_AMOUNT,
    feeYearMode: 'lifetime' as const,
  },
};

const FEE_TYPE_ALIASES: Record<string, keyof typeof FEE_PLANS> = {
  annual_membership: FEE_TYPE_ANNUAL,
  'annual membership': FEE_TYPE_ANNUAL,
  'annual membership fee': FEE_TYPE_ANNUAL,
  'membership fee': FEE_TYPE_ANNUAL,
  'annual fee': FEE_TYPE_ANNUAL,
  annual: FEE_TYPE_ANNUAL,
  lifetime_membership: FEE_TYPE_LIFETIME,
  'lifetime membership': FEE_TYPE_LIFETIME,
  lifetime: FEE_TYPE_LIFETIME,
};

export function currentCalendarYear(): number {
  return new Date().getFullYear();
}

export function normalizeJoinYear(input: unknown, fallback?: number): number {
  const year = Number.parseInt(String(input ?? ''), 10);
  const fb = fallback ?? currentCalendarYear();
  if (!Number.isFinite(year)) return fb;
  return Math.min(currentCalendarYear(), Math.max(ORG_START_YEAR, year));
}

/** Inclusive list of calendar years from join year through the current year. */
export function yearsFromJoinToCurrent(joinYear: number): number[] {
  const start = normalizeJoinYear(joinYear);
  const end = currentCalendarYear();
  const years: number[] = [];
  for (let y = start; y <= end; y++) years.push(y);
  return years;
}

export function annualPeriod(year: number) {
  const y = normalizeJoinYear(year);
  return {
    fee_year: String(y),
    start_date: `${y}-01-01`,
    end_date: `${y}-12-31`,
    due_date: `${y}-01-01`,
  };
}

export function parsePaidYears(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  const years = input
    .map((v) => Number.parseInt(String(v), 10))
    .filter((y) => Number.isFinite(y) && y >= ORG_START_YEAR && y <= currentCalendarYear());
  return [...new Set(years)].sort((a, b) => a - b);
}

/** Accept "2026" or legacy "2026-2027" → prefer start year for annual. */
export function normalizeFeeYearLabel(feeYear: string | null | undefined): string {
  if (!feeYear) return String(currentCalendarYear());
  if (feeYear === 'lifetime') return 'lifetime';
  const match = feeYear.match(/^(\d{4})(?:-(\d{4}))?$/);
  if (!match) return feeYear;
  return match[1];
}

export function normalizeFeeType(input: string | null | undefined): keyof typeof FEE_PLANS | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase().replace(/\s+/g, ' ');
  return FEE_TYPE_ALIASES[normalized] ?? null;
}

export function resolveFeePlanOrThrow(
  feeTypeInput: string | null | undefined,
  feeYearInput?: string | null
) {
  const feeType = normalizeFeeType(feeTypeInput);
  if (!feeType) {
    throw new Error('Invalid fee type. Allowed values: annual_membership, lifetime_membership');
  }

  const plan = FEE_PLANS[feeType];
  const feeYear =
    plan.feeYearMode === 'lifetime'
      ? 'lifetime'
      : normalizeFeeYearLabel(feeYearInput || String(currentCalendarYear()));

  return {
    fee_type: feeType,
    amount: plan.amount,
    currency: 'AED',
    fee_year: feeYear,
    plan: feeType === FEE_TYPE_LIFETIME ? 'lifetime' : 'annual',
  };
}
