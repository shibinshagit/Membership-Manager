'use client';

import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ORG_START_YEAR,
  currentCalendarYear,
  yearFromDateInput,
  yearsBeforeLifetime,
  yearsFromJoinToCurrent,
} from '@/lib/fees-calendar';

type Props = {
  joinYear: number;
  paidYears: number[];
  onJoinYearChange: (year: number) => void;
  onPaidYearsChange: (years: number[]) => void;
  disabled?: boolean;
  /** Annual: unchecked years stay due. Lifetime: tick years paid before lifetime. */
  mode?: 'annual' | 'lifetime';
  /** ISO date when lifetime started / will start (YYYY-MM-DD). */
  lifetimeStartDate?: string;
  onLifetimeStartDateChange?: (date: string) => void;
  /** When true, lifetime start date is shown read-only (existing lifetime member). */
  lifetimeStartReadOnly?: boolean;
};

export function MembershipYearsPicker({
  joinYear,
  paidYears,
  onJoinYearChange,
  onPaidYearsChange,
  disabled,
  mode = 'annual',
  lifetimeStartDate,
  onLifetimeStartDateChange,
  lifetimeStartReadOnly,
}: Props) {
  const now = currentCalendarYear();
  const yearOptions: number[] = [];
  for (let y = now; y >= ORG_START_YEAR; y--) yearOptions.push(y);

  const isLifetime = mode === 'lifetime';
  const lifetimeStartYear = isLifetime
    ? yearFromDateInput(lifetimeStartDate, now)
    : now;

  const years = isLifetime
    ? yearsBeforeLifetime(joinYear, lifetimeStartYear)
    : yearsFromJoinToCurrent(joinYear);
  const paidSet = new Set(paidYears);

  const filterPaidToAllowed = (nextJoin: number, nextLifeYear: number, current: number[]) => {
    const allowed = new Set(
      isLifetime ? yearsBeforeLifetime(nextJoin, nextLifeYear) : yearsFromJoinToCurrent(nextJoin)
    );
    return current.filter((y) => allowed.has(y));
  };

  const toggleYear = (year: number, checked: boolean) => {
    const next = new Set(paidSet);
    if (checked) next.add(year);
    else next.delete(year);
    onPaidYearsChange([...next].sort((a, b) => a - b));
  };

  const selectAll = () => onPaidYearsChange([...years]);
  const clearAll = () => onPaidYearsChange([]);

  const unpaid = years.filter((y) => !paidSet.has(y));

  const formatDisplayDate = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 max-w-xs">
          <Label>Joined year</Label>
          <Select
            value={String(joinYear)}
            disabled={disabled}
            onValueChange={(v) => {
              const nextJoin = Number(v);
              onJoinYearChange(nextJoin);
              onPaidYearsChange(filterPaidToAllowed(nextJoin, lifetimeStartYear, paidYears));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Organization started {ORG_START_YEAR}. Annual fee is 50 per calendar year.
          </p>
        </div>

        {isLifetime && (
          <div className="space-y-2 max-w-xs">
            <Label>Lifetime started</Label>
            {lifetimeStartReadOnly || !onLifetimeStartDateChange ? (
              <p className="text-sm font-medium h-10 flex items-center">
                {formatDisplayDate(lifetimeStartDate)}
              </p>
            ) : (
              <Input
                type="date"
                value={lifetimeStartDate || `${now}-01-01`}
                disabled={disabled}
                max={`${now}-12-31`}
                onChange={(e) => {
                  const next = e.target.value;
                  onLifetimeStartDateChange(next);
                  const nextLifeYear = yearFromDateInput(next, now);
                  onPaidYearsChange(filterPaidToAllowed(joinYear, nextLifeYear, paidYears));
                }}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Only years before this date (from join year) can be marked as paid annually.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>
            {isLifetime
              ? years.length > 0
                ? `Years paid before lifetime (${joinYear}–${lifetimeStartYear - 1})`
                : 'Years paid before lifetime'
              : 'Years paid (tick each year that was collected)'}
          </Label>
          {years.length > 0 && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={selectAll}
              >
                Mark all paid
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={clearAll}>
                Clear
              </Button>
            </div>
          )}
        </div>

        {years.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border p-3">
            {isLifetime
              ? joinYear >= lifetimeStartYear
                ? `Joined in ${joinYear} and lifetime started in ${lifetimeStartYear} — no prior annual years to record.`
                : 'No annual years to record before lifetime.'
              : 'No years available.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 rounded-lg border p-3">
            {years.map((year) => {
              const id = `fee-year-${year}`;
              const checked = paidSet.has(year);
              return (
                <label
                  key={year}
                  htmlFor={id}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer ${
                    checked ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-muted/30'
                  }`}
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(v) => toggleYear(year, v === true)}
                  />
                  <span>{year}</span>
                </label>
              );
            })}
          </div>
        )}

        {isLifetime ? (
          years.length > 0 && unpaid.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Not marked paid before lifetime: {unpaid.join(', ')} (no annual invoice).
            </p>
          ) : years.length > 0 ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              All prior years from joining marked paid before lifetime.
            </p>
          ) : null
        ) : unpaid.length > 0 ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Due / unpaid: {unpaid.join(', ')} ({unpaid.length * 50})
          </p>
        ) : (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            Up to date — no annual dues outstanding.
          </p>
        )}
      </div>
    </div>
  );
}
