'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Loader2,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader, StatCard } from '@/components/dashboard/page-header';
import {
  DataList,
  DataListEmpty,
  DataListLoading,
  DataListRow,
  DataListScroll,
  StatusBadge,
} from '@/components/dashboard/data-list';
import { AppIcon } from '@/components/icons/app-icon';
import { currentCalendarYear, ORG_START_YEAR } from '@/lib/fees-calendar';
import type {
  AccountsSummary,
  ExpenseRow,
  MembershipIncomeRow,
  PettyCashRow,
} from '@/lib/accounts-service';

const EXPENSE_CATEGORIES = [
  'Event',
  'Rent',
  'Utilities',
  'Office supplies',
  'Travel',
  'Charity',
  'Miscellaneous',
];

const PETTY_CASH_CATEGORIES = [
  'Top-up',
  'Charity',
  'Refreshments',
  'Stationery',
  'Transport',
  'Miscellaneous',
];

const INCOME_COLS =
  'grid-cols-[minmax(10rem,1.2fr)_minmax(8rem,1fr)_5.5rem_6rem_5rem]';
const EXPENSE_COLS =
  'grid-cols-[minmax(8rem,1fr)_minmax(10rem,1.2fr)_6rem_5rem_4rem]';
const PETTY_COLS =
  'grid-cols-[5.5rem_minmax(8rem,1fr)_minmax(10rem,1.2fr)_6rem_4rem]';

export default function AccountsPage() {
  const [year, setYear] = useState(currentCalendarYear());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<AccountsSummary | null>(null);
  const [membershipIncome, setMembershipIncome] = useState<MembershipIncomeRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [pettyCash, setPettyCash] = useState<PettyCashRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [pettyDialogOpen, setPettyDialogOpen] = useState(false);
  const [pettyType, setPettyType] = useState<'income' | 'expense'>('expense');

  const [expenseForm, setExpenseForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    category: 'Miscellaneous',
    description: '',
    amount: '',
    payment_method: '',
    reference: '',
  });

  const [pettyForm, setPettyForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    category: 'Miscellaneous',
    description: '',
    amount: '',
  });

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/accounts?year=${year}`);
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Failed to load accounts');
        return;
      }
      setSummary(data.summary);
      setMembershipIncome(data.membership_income || []);
      setExpenses(data.expenses || []);
      setPettyCash(data.petty_cash || []);
    } catch {
      setMessage('Network error loading accounts.');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const openPettyDialog = (type: 'income' | 'expense') => {
    setPettyType(type);
    setPettyForm({
      entry_date: new Date().toISOString().slice(0, 10),
      category: type === 'income' ? 'Top-up' : 'Miscellaneous',
      description: '',
      amount: '',
    });
    setPettyDialogOpen(true);
  };

  const handleAddExpense = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/accounts/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...expenseForm,
          amount: Number(expenseForm.amount),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Failed to add expense');
        return;
      }
      setExpenseDialogOpen(false);
      setExpenseForm({
        entry_date: new Date().toISOString().slice(0, 10),
        category: 'Miscellaneous',
        description: '',
        amount: '',
        payment_method: '',
        reference: '',
      });
      await loadAccounts();
    } finally {
      setSaving(false);
    }
  };

  const handleAddPettyCash = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/accounts/petty-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...pettyForm,
          entry_type: pettyType,
          amount: Number(pettyForm.amount),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Failed to add petty cash entry');
        return;
      }
      setPettyDialogOpen(false);
      await loadAccounts();
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (id: number) => {
    if (!confirm('Delete this expense entry?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/expenses/${id}`, { method: 'DELETE' });
      if (res.ok) await loadAccounts();
    } finally {
      setSaving(false);
    }
  };

  const deletePettyCash = async (id: number) => {
    if (!confirm('Delete this petty cash entry?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/petty-cash/${id}`, { method: 'DELETE' });
      if (res.ok) await loadAccounts();
    } finally {
      setSaving(false);
    }
  };

  const canGoNext = year < currentCalendarYear();
  const canGoPrev = year > ORG_START_YEAR;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Track membership income, expenses, and petty cash by calendar year."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={!canGoPrev}
              onClick={() => setYear((y) => y - 1)}
              aria-label="Previous year"
            >
              <AppIcon icon={ChevronLeft} className="h-4 w-4" />
            </Button>
            <span className="min-w-[4.5rem] text-center text-sm font-semibold tabular-nums">
              {year}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={!canGoNext}
              onClick={() => setYear((y) => y + 1)}
              aria-label="Next year"
            >
              <AppIcon icon={ChevronRight} className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {message ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {message}
        </p>
      ) : null}

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Income"
            value={`AED ${summary.total_income.toLocaleString()}`}
            description={`Membership AED ${summary.membership_income_total.toLocaleString()} · Petty cash in AED ${summary.petty_cash_income_total.toLocaleString()}`}
            icon={TrendingUp}
          />
          <StatCard
            title="Total Expenses"
            value={`AED ${summary.total_expenses.toLocaleString()}`}
            description={`General AED ${summary.expense_total.toLocaleString()} · Petty cash out AED ${summary.petty_cash_expense_total.toLocaleString()}`}
            icon={TrendingDown}
          />
          <StatCard
            title="Net Balance"
            value={`AED ${summary.net_balance.toLocaleString()}`}
            description="Income minus all expenses"
            icon={CircleDollarSign}
          />
          <StatCard
            title="Petty Cash Net"
            value={`AED ${summary.petty_cash_net.toLocaleString()}`}
            description="Petty cash in minus petty cash out"
            icon={Wallet}
          />
        </div>
      ) : null}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="income">Income ({membershipIncome.length})</TabsTrigger>
          <TabsTrigger value="expenses">Expenses ({expenses.length})</TabsTrigger>
          <TabsTrigger value="petty">Petty Cash ({pettyCash.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Income breakdown
              </h3>
              {summary?.income_breakdown.length ? (
                <ul className="space-y-2">
                  {summary.income_breakdown.map((row) => (
                    <li
                      key={row.fee_type}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span>
                        {row.label}{' '}
                        <span className="text-muted-foreground">({row.count})</span>
                      </span>
                      <span className="font-medium tabular-nums">
                        AED {row.total.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No income recorded for {year}.</p>
              )}
            </div>
            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Quick actions
              </h3>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button variant="outline" onClick={() => setExpenseDialogOpen(true)}>
                  <AppIcon icon={Plus} className="h-4 w-4" />
                  Add expense
                </Button>
                <Button variant="outline" onClick={() => openPettyDialog('income')}>
                  <AppIcon icon={ArrowDownLeft} className="h-4 w-4" />
                  Petty cash income
                </Button>
                <Button variant="outline" onClick={() => openPettyDialog('expense')}>
                  <AppIcon icon={ArrowUpRight} className="h-4 w-4" />
                  Petty cash expense
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="income">
          <DataList>
            {loading ? (
              <DataListLoading />
            ) : membershipIncome.length === 0 ? (
              <DataListEmpty
                icon={TrendingUp}
                title="No membership income"
                description={`No paid membership fees found for ${year}.`}
              />
            ) : (
              <DataListScroll minWidth="44rem">
                <div className={`grid ${INCOME_COLS} gap-3 border-b border-border/80 bg-muted/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground`}>
                  <span>Member</span>
                  <span>Type</span>
                  <span>Date</span>
                  <span className="text-right">Amount</span>
                  <span />
                </div>
                {membershipIncome.map((row) => (
                  <DataListRow key={row.id} className={INCOME_COLS}>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.member_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.member_code}</p>
                    </div>
                    <p className="truncate text-sm">{row.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {row.paid_date ? format(new Date(row.paid_date), 'dd MMM yyyy') : '—'}
                    </p>
                    <p className="text-right font-medium tabular-nums">
                      {row.currency} {row.amount.toLocaleString()}
                    </p>
                    <div className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/fees`}>View</Link>
                      </Button>
                    </div>
                  </DataListRow>
                ))}
              </DataListScroll>
            )}
          </DataList>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setExpenseDialogOpen(true)}>
              <AppIcon icon={Plus} className="h-4 w-4" />
              Add expense
            </Button>
          </div>
          <DataList>
            {loading ? (
              <DataListLoading />
            ) : expenses.length === 0 ? (
              <DataListEmpty
                icon={TrendingDown}
                title="No expenses"
                description={`Add general expenses for ${year}.`}
                action={
                  <Button onClick={() => setExpenseDialogOpen(true)}>
                    <AppIcon icon={Plus} className="h-4 w-4" />
                    Add expense
                  </Button>
                }
              />
            ) : (
              <DataListScroll minWidth="40rem">
                <div className={`grid ${EXPENSE_COLS} gap-3 border-b border-border/80 bg-muted/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground`}>
                  <span>Date</span>
                  <span>Category / Description</span>
                  <span className="text-right">Amount</span>
                  <span />
                  <span />
                </div>
                {expenses.map((row) => (
                  <DataListRow key={row.id} className={EXPENSE_COLS}>
                    <p className="text-sm">
                      {format(new Date(row.entry_date), 'dd MMM yyyy')}
                    </p>
                    <div className="min-w-0">
                      <p className="font-medium">{row.category}</p>
                      {row.description ? (
                        <p className="truncate text-xs text-muted-foreground">{row.description}</p>
                      ) : null}
                    </div>
                    <p className="text-right font-medium tabular-nums text-destructive">
                      {row.currency} {Number(row.amount).toLocaleString()}
                    </p>
                    <span />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={saving}
                      onClick={() => deleteExpense(row.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </DataListRow>
                ))}
              </DataListScroll>
            )}
          </DataList>
        </TabsContent>

        <TabsContent value="petty" className="space-y-3">
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => openPettyDialog('income')}>
              <AppIcon icon={ArrowDownLeft} className="h-4 w-4" />
              Petty cash income
            </Button>
            <Button variant="outline" onClick={() => openPettyDialog('expense')}>
              <AppIcon icon={ArrowUpRight} className="h-4 w-4" />
              Petty cash expense
            </Button>
          </div>
          <DataList>
            {loading ? (
              <DataListLoading />
            ) : pettyCash.length === 0 ? (
              <DataListEmpty
                icon={Wallet}
                title="No petty cash entries"
                description={`Record petty cash income or expenses for ${year}.`}
              />
            ) : (
              <DataListScroll minWidth="40rem">
                <div className={`grid ${PETTY_COLS} gap-3 border-b border-border/80 bg-muted/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground`}>
                  <span>Type</span>
                  <span>Date</span>
                  <span>Category / Description</span>
                  <span className="text-right">Amount</span>
                  <span />
                </div>
                {pettyCash.map((row) => (
                  <DataListRow key={row.id} className={PETTY_COLS}>
                    <StatusBadge tone={row.entry_type === 'income' ? 'success' : 'danger'}>
                      {row.entry_type}
                    </StatusBadge>
                    <p className="text-sm">
                      {format(new Date(row.entry_date), 'dd MMM yyyy')}
                    </p>
                    <div className="min-w-0">
                      <p className="font-medium">{row.category || '—'}</p>
                      {row.description ? (
                        <p className="truncate text-xs text-muted-foreground">{row.description}</p>
                      ) : null}
                    </div>
                    <p
                      className={`text-right font-medium tabular-nums ${
                        row.entry_type === 'income' ? 'text-success' : 'text-destructive'
                      }`}
                    >
                      {row.entry_type === 'income' ? '+' : '−'}
                      {row.currency} {Number(row.amount).toLocaleString()}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={saving}
                      onClick={() => deletePettyCash(row.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </DataListRow>
                ))}
              </DataListScroll>
            )}
          </DataList>
        </TabsContent>
      </Tabs>

      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add expense</DialogTitle>
            <DialogDescription>Record a general expense for {year}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="expense_date">Date</Label>
              <Input
                id="expense_date"
                type="date"
                value={expenseForm.entry_date}
                onChange={(e) => setExpenseForm({ ...expenseForm, entry_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={expenseForm.category}
                onValueChange={(v) => setExpenseForm({ ...expenseForm, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense_amount">Amount (AED)</Label>
              <Input
                id="expense_amount"
                type="number"
                min="0"
                step="0.01"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense_desc">Description</Label>
              <Textarea
                id="expense_desc"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="expense_method">Payment method</Label>
                <Input
                  id="expense_method"
                  value={expenseForm.payment_method}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, payment_method: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense_ref">Reference</Label>
                <Input
                  id="expense_ref"
                  value={expenseForm.reference}
                  onChange={(e) => setExpenseForm({ ...expenseForm, reference: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddExpense} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pettyDialogOpen} onOpenChange={setPettyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Petty cash {pettyType === 'income' ? 'income' : 'expense'}
            </DialogTitle>
            <DialogDescription>
              Record money {pettyType === 'income' ? 'added to' : 'spent from'} petty cash for{' '}
              {year}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="petty_date">Date</Label>
              <Input
                id="petty_date"
                type="date"
                value={pettyForm.entry_date}
                onChange={(e) => setPettyForm({ ...pettyForm, entry_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={pettyForm.category}
                onValueChange={(v) => setPettyForm({ ...pettyForm, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PETTY_CASH_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="petty_amount">Amount (AED)</Label>
              <Input
                id="petty_amount"
                type="number"
                min="0"
                step="0.01"
                value={pettyForm.amount}
                onChange={(e) => setPettyForm({ ...pettyForm, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="petty_desc">Description</Label>
              <Textarea
                id="petty_desc"
                value={pettyForm.description}
                onChange={(e) => setPettyForm({ ...pettyForm, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPettyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPettyCash} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
