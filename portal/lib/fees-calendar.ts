/** Client-safe calendar-year fee helpers (no Node/DB imports). */

export const ORG_START_YEAR = 2013;
export const FEE_TYPE_ANNUAL = 'annual_membership';
export const FEE_TYPE_LIFETIME = 'lifetime_membership';
export const FEE_TYPE_WELFARE = 'welfare_contribution';

/** Joining / registration year fee (replaces annual for that year). */
export const REGISTRATION_AMOUNT = 100;
/** Calendar years before CURRENT_RATE_FROM_YEAR (excl. join year). */
export const LEGACY_ANNUAL_AMOUNT = 25;
/** First year of the current annual rate. */
export const CURRENT_RATE_FROM_YEAR = 2020;
/** Annual fee from CURRENT_RATE_FROM_YEAR onward (excl. join year). */
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

/**
 * Fee for a calendar year.
 * - Join / registration year → 100
 * - Years before 2020 → 25
 * - 2020 onward → 50
 */
export function annualAmountForYear(year: number, joinYear?: number | null): number {
  const y = Number.parseInt(String(year), 10);
  if (!Number.isFinite(y)) return ANNUAL_AMOUNT;
  if (joinYear != null && joinYear !== undefined) {
    const join = normalizeJoinYear(joinYear);
    if (y === join) return REGISTRATION_AMOUNT;
  }
  if (y < CURRENT_RATE_FROM_YEAR) return LEGACY_ANNUAL_AMOUNT;
  return ANNUAL_AMOUNT;
}

export function annualFeeNote(year: number, joinYear?: number | null): string {
  const y = Number.parseInt(String(year), 10);
  const amount = annualAmountForYear(y, joinYear);
  if (joinYear != null && normalizeJoinYear(joinYear) === y) {
    return `Registration fee ${y}`;
  }
  if (y < CURRENT_RATE_FROM_YEAR) {
    return `Annual membership ${y} (legacy rate ${amount}, expires 31 Dec ${y})`;
  }
  return `Annual membership ${y} (expires 31 Dec ${y})`;
}

/** UI / invoice label for a fee row. */
export function formatFeeTypeLabel(options: {
  feeType?: string | null;
  feeYear?: string | null;
  amount?: number | string | null;
  joinYear?: number | null;
}): string {
  const feeType = options.feeType || '';
  const feeYear = options.feeYear || '';
  if (feeType === FEE_TYPE_LIFETIME || feeYear === 'lifetime') {
    return 'Lifetime Membership';
  }
  if (feeType === FEE_TYPE_WELFARE || String(feeYear || '').startsWith('welfare')) {
    if (feeYear === 'welfare_lump') return 'Welfare Membership (One Time)';
    if (feeYear === 'welfare_settle') return 'Welfare Membership (Settlement)';
    const inst = String(feeYear || '').match(/^welfare_i(\d+)$/i);
    if (inst) return `Welfare Installment ${Number.parseInt(inst[1], 10)}`;
    return 'Welfare Membership';
  }

  const yearLabel = normalizeFeeYearLabel(feeYear);
  const yearNum = Number.parseInt(yearLabel, 10);
  const amountNum =
    options.amount === null || options.amount === undefined || options.amount === ''
      ? NaN
      : Number(options.amount);

  const isRegistration =
    (Number.isFinite(amountNum) && amountNum === REGISTRATION_AMOUNT) ||
    (options.joinYear != null &&
      Number.isFinite(yearNum) &&
      normalizeJoinYear(options.joinYear) === yearNum);

  if (isRegistration && Number.isFinite(yearNum)) {
    return `Registration fee ${yearNum}`;
  }

  if (feeType === FEE_TYPE_ANNUAL || feeYear) {
    return Number.isFinite(yearNum)
      ? `Annual Membership ${yearNum}`
      : 'Annual Membership';
  }

  return feeType
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function sumAnnualAmounts(years: number[], joinYear?: number | null): number {
  return years.reduce((sum, y) => sum + annualAmountForYear(y, joinYear), 0);
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

/**
 * Years that can have annual fees before lifetime starts.
 * Inclusive from join year through the year before lifetime start.
 * Empty if lifetime started in the join year (or earlier).
 */
export function yearsBeforeLifetime(joinYear: number, lifetimeStartYear: number): number[] {
  const start = normalizeJoinYear(joinYear);
  const lifeYear = Number.parseInt(String(lifetimeStartYear), 10);
  if (!Number.isFinite(lifeYear)) return yearsFromJoinToCurrent(joinYear);
  const end = Math.min(currentCalendarYear(), lifeYear - 1);
  if (end < start) return [];
  const years: number[] = [];
  for (let y = start; y <= end; y++) years.push(y);
  return years;
}

export function yearFromDateInput(input: unknown, fallback?: number): number {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}/.test(input)) {
    return normalizeJoinYear(input.slice(0, 4), fallback);
  }
  return normalizeJoinYear(input, fallback);
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
  feeYearInput?: string | null,
  joinYear?: number | null
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

  const yearNum = Number.parseInt(feeYear, 10);
  const amount =
    feeType === FEE_TYPE_LIFETIME
      ? LIFETIME_AMOUNT
      : annualAmountForYear(Number.isFinite(yearNum) ? yearNum : currentCalendarYear(), joinYear);

  return {
    fee_type: feeType,
    amount,
    currency: 'AED',
    fee_year: feeYear,
    plan: feeType === FEE_TYPE_LIFETIME ? 'lifetime' : 'annual',
  };
}
