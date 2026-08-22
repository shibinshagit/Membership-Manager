import { sql } from '@/lib/db';
import { formatFeeTypeLabel } from '@/lib/fees-calendar';

export type MembershipIncomeRow = {
  id: number;
  fee_type: string;
  fee_year: string | null;
  amount: number;
  currency: string;
  paid_date: string | null;
  payment_method: string | null;
  member_name: string;
  member_code: string;
  label: string;
};

export type ExpenseRow = {
  id: number;
  entry_year: number;
  entry_date: string;
  category: string;
  description: string | null;
  amount: number;
  currency: string;
  payment_method: string | null;
  reference: string | null;
  created_at: string;
};

export type PettyCashRow = {
  id: number;
  entry_year: number;
  entry_date: string;
  entry_type: 'income' | 'expense';
  category: string | null;
  description: string | null;
  amount: number;
  currency: string;
  created_at: string;
};

export type IncomeBreakdown = {
  fee_type: string;
  label: string;
  count: number;
  total: number;
};

export type AccountsSummary = {
  year: number;
  membership_income_total: number;
  membership_income_count: number;
  income_breakdown: IncomeBreakdown[];
  expense_total: number;
  expense_count: number;
  petty_cash_income_total: number;
  petty_cash_expense_total: number;
  petty_cash_net: number;
  total_income: number;
  total_expenses: number;
  net_balance: number;
};

function yearFromRow(date: unknown): number | null {
  if (!date) return null;
  const s = String(date);
  if (/^\d{4}/.test(s)) return Number.parseInt(s.slice(0, 4), 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

export async function getMembershipIncome(year: number): Promise<MembershipIncomeRow[]> {
  const rows = await sql`
    SELECT
      mm.id,
      mm.fee_type,
      mm.fee_year,
      mm.amount,
      mm.currency,
      mm.paid_date,
      mm.payment_method,
      m.full_name AS member_name,
      m.member_id AS member_code
    FROM member_memberships mm
    JOIN members m ON m.id = mm.member_id
    WHERE mm.payment_status = 'paid'
      AND EXTRACT(YEAR FROM COALESCE(mm.paid_date, mm.due_date, mm.created_at::date))::int = ${year}
    ORDER BY COALESCE(mm.paid_date, mm.due_date, mm.created_at::date) DESC, mm.id DESC
  `;

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    fee_type: String(row.fee_type || ''),
    fee_year: row.fee_year ? String(row.fee_year) : null,
    amount: Number(row.amount ?? 0),
    currency: String(row.currency || 'AED'),
    paid_date: row.paid_date ? String(row.paid_date).slice(0, 10) : null,
    payment_method: row.payment_method ? String(row.payment_method) : null,
    member_name: String(row.member_name || ''),
    member_code: String(row.member_code || ''),
    label: formatFeeTypeLabel({
      feeType: String(row.fee_type || ''),
      feeYear: row.fee_year ? String(row.fee_year) : null,
      amount: row.amount,
    }),
  }));
}

export async function getExpenses(year: number): Promise<ExpenseRow[]> {
  const rows = await sql`
    SELECT id, entry_year, entry_date, category, description, amount, currency,
           payment_method, reference, created_at
    FROM expense_entries
    WHERE entry_year = ${year}
    ORDER BY entry_date DESC, id DESC
  `;
  return rows as ExpenseRow[];
}

export async function getPettyCashEntries(year: number): Promise<PettyCashRow[]> {
  const rows = await sql`
    SELECT id, entry_year, entry_date, entry_type, category, description, amount, currency, created_at
    FROM petty_cash_entries
    WHERE entry_year = ${year}
    ORDER BY entry_date DESC, id DESC
  `;
  return rows as PettyCashRow[];
}

export function buildIncomeBreakdown(rows: MembershipIncomeRow[]): IncomeBreakdown[] {
  const map = new Map<string, IncomeBreakdown>();
  for (const row of rows) {
    const key = row.fee_type || 'other';
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.total += row.amount;
    } else {
      map.set(key, {
        fee_type: key,
        label:
          key === 'welfare_contribution'
            ? 'Welfare contributions'
            : formatFeeTypeLabel({ feeType: key }),
        count: 1,
        total: row.amount,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export async function getAccountsSummary(year: number): Promise<{
  summary: AccountsSummary;
  membership_income: MembershipIncomeRow[];
  expenses: ExpenseRow[];
  petty_cash: PettyCashRow[];
}> {
  const [membership_income, expenses, petty_cash] = await Promise.all([
    getMembershipIncome(year),
    getExpenses(year),
    getPettyCashEntries(year),
  ]);

  const membership_income_total = membership_income.reduce((s, r) => s + r.amount, 0);
  const expense_total = expenses.reduce((s, r) => s + r.amount, 0);
  const petty_cash_income_total = petty_cash
    .filter((r) => r.entry_type === 'income')
    .reduce((s, r) => s + r.amount, 0);
  const petty_cash_expense_total = petty_cash
    .filter((r) => r.entry_type === 'expense')
    .reduce((s, r) => s + r.amount, 0);
  const petty_cash_net = petty_cash_income_total - petty_cash_expense_total;
  const total_income = membership_income_total + petty_cash_income_total;
  const total_expenses = expense_total + petty_cash_expense_total;
  const net_balance = total_income - total_expenses;

  const income_breakdown = buildIncomeBreakdown(membership_income);
  if (petty_cash_income_total > 0) {
    income_breakdown.push({
      fee_type: 'petty_cash_income',
      label: 'Petty cash income',
      count: petty_cash.filter((r) => r.entry_type === 'income').length,
      total: petty_cash_income_total,
    });
  }

  return {
    summary: {
      year,
      membership_income_total,
      membership_income_count: membership_income.length,
      income_breakdown,
      expense_total,
      expense_count: expenses.length,
      petty_cash_income_total,
      petty_cash_expense_total,
      petty_cash_net,
      total_income,
      total_expenses,
      net_balance,
    },
    membership_income,
    expenses,
    petty_cash,
  };
}

export function normalizeEntryYear(entryDate: string, fallbackYear: number): number {
  return yearFromRow(entryDate) ?? fallbackYear;
}
