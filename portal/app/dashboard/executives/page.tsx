'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UsersRound } from 'lucide-react';
import { PageHeader, StatCard } from '@/components/dashboard/page-header';
import {
  DataList,
  DataListCard,
  DataListEmpty,
  DataListHead,
  DataListLoading,
  DataListRow,
  DataListScroll,
  EntityAvatar,
  StatusBadge,
  memberStatusTone,
  EXEC_LIST_COLS,
} from '@/components/dashboard/data-list';
import { IconTile } from '@/components/icons/icon-tile';
import {
  CENTRAL_COMMITTEE_ROLES,
  DEFAULT_CENTRAL_COMMITTEE_ROLE,
  isCentralCommitteeRole,
} from '@/lib/members/central-committee-roles';

interface ExecutiveMember {
  id: number;
  member_id: string;
  full_name: string;
  role: string;
  status?: string;
  member_count?: number;
}

function ExecutivesContent() {
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role');
  const roleFilter = isCentralCommitteeRole(roleParam)
    ? roleParam
    : DEFAULT_CENTRAL_COMMITTEE_ROLE;

  const [executives, setExecutives] = useState<ExecutiveMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberHits, setMemberHits] = useState<Array<{ id: number; full_name: string; member_id: string }>>([]);
  const [memberId, setMemberId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [termMessage, setTermMessage] = useState('');

  const fetchExecutives = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/executives?role=${encodeURIComponent(roleFilter)}`);
      const data = await res.json();
      setExecutives(data.executives || []);
    } catch (error) {
      console.error('Error fetching executive members:', error);
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    fetchExecutives();
  }, [fetchExecutives]);

  const formatRole = (role: string) => {
    return role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const activeRole =
    CENTRAL_COMMITTEE_ROLES.find((tab) => tab.value === roleFilter) ||
    CENTRAL_COMMITTEE_ROLES[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central Committee"
        description="Browse committee roles and assigned members"
        actions={
          <p className="inline-flex items-center gap-2 rounded-lg border border-border/80 bg-card px-3 py-2 text-sm text-muted-foreground">
            <IconTile icon={activeRole.icon} size="sm" />
            <span>
              Role: <span className="font-medium text-foreground">{activeRole.label}</span>
            </span>
          </p>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard title="Listed Members" value={executives.length} icon={UsersRound} />
        <StatCard
          title="Active in List"
          value={executives.filter((e) => (e.status || '').toLowerCase() === 'active').length}
          icon={UsersRound}
          tone="success"
        />
      </div>

      <form
        className="space-y-3 rounded-lg border border-border/80 bg-card p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setTermMessage('');
          const res = await fetch('/api/role-terms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              member_id: memberId,
              role: roleFilter,
              start_date: startDate,
              end_date: endDate,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            setTermMessage(data.error || 'Could not save the role dates.');
            return;
          }
          setTermMessage('Role dates saved. Their member role stays Member. This role shows while the dates include today.');
          setMemberId(null);
          setMemberQuery('');
          fetchExecutives();
        }}
      >
        <p className="text-sm font-medium">Assign {activeRole.label} for a period</p>
        <p className="text-xs text-muted-foreground">
          Everyone stays a member by default. Adding from and to dates gives them this role for that period, including the current year when today falls inside it.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={memberQuery}
            onChange={(event) => setMemberQuery(event.target.value)}
            placeholder="Search member"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              const res = await fetch(`/api/members?search=${encodeURIComponent(memberQuery)}&limit=8`);
              const data = await res.json();
              setMemberHits(data.members || []);
            }}
          >
            Search
          </Button>
        </div>
        {memberHits.length > 0 ? (
          <ul className="divide-y rounded-md border">
            {memberHits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setMemberId(hit.id);
                    setMemberQuery(`${hit.full_name} (${hit.member_id})`);
                    setMemberHits([]);
                  }}
                >
                  {hit.full_name} · {hit.member_id}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="role-from">From</Label>
            <Input id="role-from" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="role-to">To</Label>
            <Input id="role-to" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
          </div>
        </div>
        {termMessage ? <p className="text-sm text-muted-foreground">{termMessage}</p> : null}
        <Button type="submit" disabled={!memberId}>Save role dates</Button>
      </form>

      <DataList>
        {loading ? (
          <DataListLoading />
        ) : executives.length === 0 ? (
          <DataListEmpty
            icon={UsersRound}
            title="No members found"
            description={
              roleFilter === 'patrions'
                ? 'Open a member, choose Edit, and set Member Role to Patron.'
                : 'Try a different role from the sidebar.'
            }
          />
        ) : (
          <>
            <div className="md:hidden">
              {executives.map((executive) => (
                <DataListCard key={executive.id}>
                  <div className="flex min-w-0 items-start gap-3">
                    <EntityAvatar name={executive.full_name} />
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <Link
                        href={`/dashboard/members/${executive.id}`}
                        className="block truncate font-medium hover:underline"
                      >
                        {executive.full_name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {executive.member_id} · {formatRole(executive.role)}
                      </p>
                    </div>
                    <StatusBadge
                      tone={memberStatusTone((executive.status || 'active').toLowerCase())}
                    >
                      {(executive.status || 'active') === 'active' ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </div>
                  <Button size="sm" variant="outline" asChild className="w-full">
                    <Link href={`/dashboard/members/${executive.id}`}>View</Link>
                  </Button>
                </DataListCard>
              ))}
            </div>

            <DataListScroll className="hidden md:block" minWidth="44rem">
              <DataListHead
                className={EXEC_LIST_COLS}
                columns={[
                  { key: 'name', label: 'Member' },
                  { key: 'id', label: 'Member ID' },
                  { key: 'role', label: 'Role' },
                  { key: 'status', label: 'Status' },
                  { key: 'actions', label: 'Action', className: 'text-right' },
                ]}
              />
              {executives.map((executive) => (
                <DataListRow key={executive.id} className={EXEC_LIST_COLS}>
                  <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                    <EntityAvatar name={executive.full_name} />
                    <Link
                      href={`/dashboard/members/${executive.id}`}
                      className="block min-w-0 truncate font-medium hover:underline"
                    >
                      {executive.full_name}
                    </Link>
                  </div>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {executive.member_id}
                  </span>
                  <div>
                    <StatusBadge tone="info">{formatRole(executive.role)}</StatusBadge>
                  </div>
                  <div>
                    <StatusBadge
                      tone={memberStatusTone((executive.status || 'active').toLowerCase())}
                    >
                      {(executive.status || 'active') === 'active' ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </div>
                  <div className="flex justify-end !overflow-visible">
                    <Button size="sm" variant="outline" className="shrink-0" asChild>
                      <Link href={`/dashboard/members/${executive.id}`}>View</Link>
                    </Button>
                  </div>
                </DataListRow>
              ))}
            </DataListScroll>
          </>
        )}
      </DataList>
    </div>
  );
}

export default function ExecutivesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <ExecutivesContent />
    </Suspense>
  );
}
