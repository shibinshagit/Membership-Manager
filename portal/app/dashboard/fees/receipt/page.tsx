'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type MemberHit = { id: number; full_name: string; member_id: string };
type DueYear = { year: string; amount: number };

export default function MembershipReceiptPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemberHit[]>([]);
  const [member, setMember] = useState<MemberHit | null>(null);
  const [years, setYears] = useState<DueYear[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function searchMembers() {
    setError('');
    const res = await fetch(`/api/members?search=${encodeURIComponent(query)}&limit=8`);
    const data = await res.json();
    setResults((data.members || []).map((row: MemberHit) => ({
      id: row.id,
      full_name: row.full_name,
      member_id: row.member_id,
    })));
  }

  async function chooseMember(next: MemberHit) {
    setMember(next);
    setResults([]);
    setSelected([]);
    setError('');
    const res = await fetch(`/api/fees/receipt?member_id=${next.id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Could not load due years.');
      setYears([]);
      return;
    }
    setYears(data.years || []);
  }

  function toggleYear(year: string) {
    setSelected((current) =>
      current.includes(year) ? current.filter((item) => item !== year) : [...current, year]
    );
  }

  const total = years
    .filter((row) => selected.includes(row.year))
    .reduce((sum, row) => sum + row.amount, 0);

  async function submit() {
    if (!member) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/fees/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: member.id,
          years: selected,
          paid_date: paidDate,
          category: 'membership',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not create the receipt.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `MPA-Receipt-${member.member_id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      await chooseMember(member);
    } catch {
      setError('Could not create the receipt.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Membership receipt</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a member, tick the due membership years, and download one receipt for the same payment date.
          Three years at 50 each is 150.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border/80 bg-card p-4">
        <Label htmlFor="member-search">Member</Label>
        <div className="flex gap-2">
          <Input
            id="member-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or member ID"
          />
          <Button type="button" variant="secondary" onClick={searchMembers}>
            Search
          </Button>
        </div>
        {member ? (
          <p className="text-sm">
            Selected: <span className="font-medium">{member.full_name}</span> ({member.member_id})
          </p>
        ) : null}
        {results.length > 0 ? (
          <ul className="divide-y rounded-md border">
            {results.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => chooseMember(row)}
                >
                  {row.full_name} · {row.member_id}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="space-y-3 rounded-lg border border-border/80 bg-card p-4">
        <p className="text-sm font-medium">Category: Membership</p>
        <Label htmlFor="paid-date">Payment date</Label>
        <Input id="paid-date" type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} />
        <div className="space-y-2">
          {years.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unpaid membership years for this member.</p>
          ) : (
            years.map((row) => (
              <label key={row.year} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(row.year)}
                  onChange={() => toggleYear(row.year)}
                />
                {row.year} · {row.amount}
              </label>
            ))
          )}
        </div>
        <p className="text-sm">Total: {total}</p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="button" disabled={!member || selected.length === 0 || loading} onClick={submit}>
            {loading ? 'Creating…' : 'Create receipt'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/fees">Back to fees</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
