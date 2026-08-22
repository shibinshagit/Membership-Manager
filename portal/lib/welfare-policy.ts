/** Welfare membership rules and payment helpers. */

export const FEE_TYPE_WELFARE = 'welfare_contribution';
export const WELFARE_REQUIRED_YEARS = 5;
export const WELFARE_INSTALLMENT_AMOUNT = 350;
export const WELFARE_INSTALLMENT_COUNT = 5;
export const WELFARE_INSTALLMENT_TOTAL =
  WELFARE_INSTALLMENT_AMOUNT * WELFARE_INSTALLMENT_COUNT;
export const WELFARE_LUMP_AMOUNT = 1500;

export type WelfarePaymentMode = 'lump' | 'installment';
export type WelfarePaymentAction = 'installment' | 'lump' | 'settlement';

export type WelfareFeeRow = {
  id?: number;
  fee_year?: string | null;
  fee_type?: string | null;
  amount?: number | string | null;
  payment_status?: string | null;
  paid_date?: string | Date | null;
};

export type WelfareSummary = {
  is_welfare_member: boolean;
  welfare_payment_mode: WelfarePaymentMode | null;
  welfare_joined_date: string | null;
  eligible: boolean;
  eligibility_date: string | null;
  years_completed: number;
  years_until_eligible: number;
  payment_mode: WelfarePaymentMode | null;
  target_amount: number;
  paid_amount: number;
  invoiced_amount: number;
  unpaid_invoiced_amount: number;
  remaining_amount: number;
  installments_paid: number;
  installments_invoiced: number;
  installments_remaining: number;
  has_unpaid_invoice: boolean;
  can_add_installment: boolean;
  can_pay_lump: boolean;
  can_settle_remaining: boolean;
  payment_complete: boolean;
  waiting_for_eligibility: boolean;
};

function isoDateOnly(value: unknown): string | null {
  if (!value) return null;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function welfareEligibilityDate(joinedDate: string | Date | null | undefined): Date | null {
  const base = isoDateOnly(joinedDate);
  if (!base) return null;
  const d = new Date(`${base}T00:00:00`);
  d.setFullYear(d.getFullYear() + WELFARE_REQUIRED_YEARS);
  return d;
}

export function isWelfareEligible(joinedDate: string | Date | null | undefined): boolean {
  const eligibility = welfareEligibilityDate(joinedDate);
  if (!eligibility) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today >= eligibility;
}

export function membershipYearsCompleted(joinedDate: string | Date | null | undefined): number {
  const base = isoDateOnly(joinedDate);
  if (!base) return 0;
  const joined = new Date(`${base}T00:00:00`);
  const today = new Date();
  let years = today.getFullYear() - joined.getFullYear();
  const anniversary = new Date(joined);
  anniversary.setFullYear(today.getFullYear());
  if (today < anniversary) years -= 1;
  return Math.max(0, years);
}

export function yearsUntilWelfareEligible(joinedDate: string | Date | null | undefined): number {
  return Math.max(0, WELFARE_REQUIRED_YEARS - membershipYearsCompleted(joinedDate));
}

export function isWelfareFeeRow(fee: WelfareFeeRow): boolean {
  return fee.fee_type === FEE_TYPE_WELFARE || String(fee.fee_year || '').startsWith('welfare');
}

function paidWelfareAmount(fees: WelfareFeeRow[]): number {
  return fees
    .filter((f) => isWelfareFeeRow(f) && f.payment_status === 'paid')
    .reduce((sum, f) => sum + Number(f.amount ?? 0), 0);
}

function invoicedWelfareAmount(fees: WelfareFeeRow[]): number {
  return fees
    .filter(isWelfareFeeRow)
    .reduce((sum, f) => sum + Number(f.amount ?? 0), 0);
}

function unpaidInvoicedWelfareAmount(fees: WelfareFeeRow[]): number {
  return fees
    .filter((f) => isWelfareFeeRow(f) && f.payment_status !== 'paid')
    .reduce((sum, f) => sum + Number(f.amount ?? 0), 0);
}

function isInstallmentFeeYear(feeYear: string | null | undefined): boolean {
  return /^welfare_i\d+$/i.test(String(feeYear || ''));
}

function installmentFeeCount(fees: WelfareFeeRow[]): number {
  return fees.filter((f) => isWelfareFeeRow(f) && isInstallmentFeeYear(f.fee_year)).length;
}

function paidInstallmentFeeCount(fees: WelfareFeeRow[]): number {
  return fees.filter(
    (f) => isWelfareFeeRow(f) && isInstallmentFeeYear(f.fee_year) && f.payment_status === 'paid'
  ).length;
}

function hasLumpFee(fees: WelfareFeeRow[]): boolean {
  return fees.some(
    (f) => isWelfareFeeRow(f) && String(f.fee_year || '').toLowerCase() === 'welfare_lump'
  );
}

export function inferWelfarePaymentMode(
  fees: WelfareFeeRow[],
  storedMode?: string | null
): WelfarePaymentMode | null {
  if (storedMode === 'lump' || storedMode === 'installment') return storedMode;
  if (hasLumpFee(fees)) return 'lump';
  if (installmentFeeCount(fees) > 0) return 'installment';
  const paid = paidWelfareAmount(fees);
  if (paid >= WELFARE_LUMP_AMOUNT && paid < WELFARE_INSTALLMENT_TOTAL) return 'lump';
  if (paid > 0) return 'installment';
  return null;
}

export function welfareTargetAmount(mode: WelfarePaymentMode | null): number {
  return mode === 'lump' ? WELFARE_LUMP_AMOUNT : WELFARE_INSTALLMENT_TOTAL;
}

export function buildWelfareSummary(options: {
  joinedDate: string | Date | null | undefined;
  welfareFees: WelfareFeeRow[];
  isWelfareMember?: boolean | null;
  welfarePaymentMode?: string | null;
  welfareJoinedDate?: string | Date | null;
}): WelfareSummary {
  const welfareFees = options.welfareFees.filter(isWelfareFeeRow);
  const eligible = isWelfareEligible(options.joinedDate);
  const eligibility = welfareEligibilityDate(options.joinedDate);
  const paymentMode = inferWelfarePaymentMode(welfareFees, options.welfarePaymentMode);
  const targetAmount = paymentMode ? welfareTargetAmount(paymentMode) : WELFARE_LUMP_AMOUNT;
  const paidAmount = paidWelfareAmount(welfareFees);
  const invoicedAmount = invoicedWelfareAmount(welfareFees);
  const unpaidInvoicedAmount = unpaidInvoicedWelfareAmount(welfareFees);
  const remainingAmount = Math.max(0, targetAmount - paidAmount);
  const paymentComplete = paymentMode !== null && paidAmount >= targetAmount;
  const installmentsInvoiced = installmentFeeCount(welfareFees);
  const installmentsPaid = paidInstallmentFeeCount(welfareFees);
  const installmentsRemaining = Math.max(0, WELFARE_INSTALLMENT_COUNT - installmentsInvoiced);
  const hasUnpaidInvoice = unpaidInvoicedAmount > 0;
  const canPayLump =
    paymentMode === null && paidAmount === 0 && invoicedAmount === 0;
  const canAddInstallment =
    !paymentComplete &&
    paymentMode !== 'lump' &&
    paidAmount < WELFARE_INSTALLMENT_TOTAL &&
    installmentsInvoiced < WELFARE_INSTALLMENT_COUNT &&
    !hasUnpaidInvoice;
  const canSettleRemaining =
    !paymentComplete &&
    paymentMode === 'installment' &&
    paidAmount > 0 &&
    paidAmount < WELFARE_INSTALLMENT_TOTAL &&
    remainingAmount > 0 &&
    !hasUnpaidInvoice;

  const computedWelfareMember = Boolean(options.isWelfareMember) || (eligible && paymentComplete);

  return {
    is_welfare_member: computedWelfareMember,
    welfare_payment_mode: paymentMode,
    welfare_joined_date: isoDateOnly(options.welfareJoinedDate),
    eligible,
    eligibility_date: eligibility ? isoDateOnly(eligibility) : null,
    years_completed: membershipYearsCompleted(options.joinedDate),
    years_until_eligible: yearsUntilWelfareEligible(options.joinedDate),
    payment_mode: paymentMode,
    target_amount: targetAmount,
    paid_amount: paidAmount,
    invoiced_amount: invoicedAmount,
    unpaid_invoiced_amount: unpaidInvoicedAmount,
    remaining_amount: remainingAmount,
    installments_paid: installmentsPaid,
    installments_invoiced: installmentsInvoiced,
    installments_remaining: installmentsRemaining,
    has_unpaid_invoice: hasUnpaidInvoice,
    can_add_installment: canAddInstallment,
    can_pay_lump: canPayLump,
    can_settle_remaining: canSettleRemaining,
    payment_complete: paymentComplete,
    waiting_for_eligibility: paymentComplete && !eligible,
  };
}

export function nextWelfareInstallmentFeeYear(fees: WelfareFeeRow[]): string {
  const used = new Set(
    fees
      .map((f) => String(f.fee_year || '').toLowerCase())
      .filter((y) => /^welfare_i\d+$/.test(y))
  );
  for (let i = 1; i <= WELFARE_INSTALLMENT_COUNT; i++) {
    const key = `welfare_i${String(i).padStart(2, '0')}`;
    if (!used.has(key)) return key;
  }
  throw new Error('All welfare installment slots are already used.');
}

export function welfarePaymentAmountForAction(
  action: WelfarePaymentAction,
  fees: WelfareFeeRow[],
  mode: WelfarePaymentMode | null
): number {
  const summary = buildWelfareSummary({
    joinedDate: null,
    welfareFees: fees,
    welfarePaymentMode: mode,
  });

  if (action === 'lump') return WELFARE_LUMP_AMOUNT;
  if (action === 'installment') return WELFARE_INSTALLMENT_AMOUNT;
  if (action === 'settlement') {
    if (summary.payment_mode !== 'installment') {
      throw new Error('Settlement is only available on the installment plan.');
    }
    return summary.remaining_amount;
  }
  throw new Error('Invalid welfare payment action.');
}

export function welfareFeeYearForAction(
  action: WelfarePaymentAction,
  fees: WelfareFeeRow[]
): string {
  if (action === 'lump') return 'welfare_lump';
  if (action === 'installment') return nextWelfareInstallmentFeeYear(fees);
  if (action === 'settlement') {
    const hasSettlement = fees.some(
      (f) => String(f.fee_year || '').toLowerCase() === 'welfare_settle'
    );
    if (hasSettlement) {
      throw new Error('A welfare settlement invoice already exists.');
    }
    return 'welfare_settle';
  }
  throw new Error('Invalid welfare payment action.');
}

export function welfareFeeNote(action: WelfarePaymentAction, feeYear: string): string {
  if (action === 'lump') return 'Welfare membership — one time (AED 1500)';
  if (action === 'settlement') return 'Welfare membership — remaining balance settlement';
  const match = feeYear.match(/^welfare_i(\d+)$/i);
  const slot = match ? Number.parseInt(match[1], 10) : null;
  return slot
    ? `Welfare membership — installment ${slot} of ${WELFARE_INSTALLMENT_COUNT} (AED 350)`
    : 'Welfare membership — installment (AED 350)';
}
