'use client';

import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
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
  yearsFromJoinToCurrent,
} from '@/lib/fees-calendar';

type Props = {
  joinYear: number;
  paidYears: number[];
  onJoinYearChange: (year: number) => void;
  onPaidYearsChange: (years: number[]) => void;
  disabled?: boolean;
};

export function MembershipYearsPicker({
  joinYear,
  paidYears,
  onJoinYearChange,
  onPaidYearsChange,
  disabled,
}: Props) {
  const now = currentCalendarYear();
  const yearOptions: number[] = [];
  for (let y = now; y >= ORG_START_YEAR; y--) yearOptions.push(y);

  const years = yearsFromJoinToCurrent(joinYear);
  const paidSet = new Set(paidYears);

  const toggleYear = (year: number, checked: boolean) => {
    const next = new Set(paidSet);
    if (checked) next.add(year);
    else next.delete(year);
    onPaidYearsChange([...next].sort((a, b) => a - b));
  };

  const selectAll = () => onPaidYearsChange([...years]);
  const clearAll = () => onPaidYearsChange([]);

  const unpaid = years.filter((y) => !paidSet.has(y));

  return (
    <div className="space-y-4">
      <div className="space-y-2 max-w-xs">
        <Label>Joined year</Label>
        <Select
          value={String(joinYear)}
          disabled={disabled}
          onValueChange={(v) => {
            const nextJoin = Number(v);
            onJoinYearChange(nextJoin);
            const allowed = new Set(yearsFromJoinToCurrent(nextJoin));
            onPaidYearsChange(paidYears.filter((y) => allowed.has(y)));
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
          Organization started {ORG_START_YEAR}. Annual fee is AED 50 per calendar year (expires 31
          Dec of that year).
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Years paid (tick each year that was collected)</Label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={selectAll}>
              Mark all paid
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={clearAll}>
              Clear
            </Button>
          </div>
        </div>

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

        {unpaid.length > 0 ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Due / unpaid: {unpaid.join(', ')} (AED {unpaid.length * 50})
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
