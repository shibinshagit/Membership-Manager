'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  UsersRound,
  ChevronLeft,
  ChevronRight,
  Download,
  Link2,
  Check,
  X,
  Copy,
  CheckCheck,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader, FilterBar } from '@/components/dashboard/page-header';
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
  MEMBER_LIST_COLS,
} from '@/components/dashboard/data-list';
import { AppIcon } from '@/components/icons/app-icon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MembershipYearsPicker } from '@/components/members/membership-years-picker';
import { currentCalendarYear } from '@/lib/fees-calendar';

interface Member {
  id: number;
  member_id: string;
  full_name: string;
  email: string | null;
  phone: string;
  status: string;
  membership_type: string;
  membership_plan?: string | null;
  membership_start_date: string;
  membership_end_date: string | null;
  visa_status?: string | null;
  marital_status?: string | null;
  uae_city?: string | null;
  uae_area?: string | null;
  home_district?: string | null;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'expired', label: 'Expired' },
] as const;

export default function MembersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [visaStatus, setVisaStatus] = useState('all');
  const [maritalStatus, setMaritalStatus] = useState('all');
  const [locality, setLocality] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [registrationUrl, setRegistrationUrl] = useState('/register');
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('active');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [approveMember, setApproveMember] = useState<Member | null>(null);
  const [approveJoinYear, setApproveJoinYear] = useState(currentCalendarYear());
  const [approvePaidYears, setApprovePaidYears] = useState<number[]>([]);
  const [approvePlan, setApprovePlan] = useState<'annual' | 'lifetime'>('annual');

  const limit = 20;

  useEffect(() => {
    if (searchParams.get('status')) {
      router.replace('/dashboard/members', { scroll: false });
    }
  }, [router, searchParams]);

  useEffect(() => {
    setRegistrationUrl(`${window.location.origin}/register`);
  }, []);

  const copyRegistrationLink = async () => {
    try {
      await navigator.clipboard.writeText(registrationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback ignored
    }
  };

  const openApproveDialog = (member: Member, e: React.MouseEvent) => {
    e.stopPropagation();
    const startYear = member.membership_start_date
      ? new Date(member.membership_start_date).getFullYear()
      : currentCalendarYear();
    setApproveMember(member);
    setApproveJoinYear(
      Number.isFinite(startYear) ? Math.min(currentCalendarYear(), Math.max(2013, startYear)) : currentCalendarYear()
    );
    setApprovePaidYears([]);
    setApprovePlan(member.membership_plan === 'lifetime' ? 'lifetime' : 'annual');
  };

  const handleApprove = async () => {
    if (!approveMember) return;
    setActionLoading(approveMember.id);
    try {
      const res = await fetch(`/api/members/${approveMember.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          plan: approvePlan,
          join_year: approveJoinYear,
          paid_years: approvePlan === 'annual' ? approvePaidYears : [],
        }),
      });
      if (res.ok) {
        setApproveMember(null);
        setReloadToken((t) => t + 1);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (memberId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Reject this application? The member will be marked as inactive.')) return;
    setActionLoading(memberId);
    try {
      const res = await fetch(`/api/members/${memberId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });
      if (res.ok) {
        setReloadToken((t) => t + 1);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const showPendingMembers = () => {
    if (status === 'pending') {
      setReloadToken((t) => t + 1);
      return;
    }
    setStatus('pending');
    setPage(1);
  };

  const showAllMembers = () => {
    setStatus('all');
    setPage(1);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadMembers() {
      setLoading(true);
      setSelectedIds(new Set());
      setBulkMessage(null);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (status && status !== 'all') params.set('status', status);
      if (visaStatus && visaStatus !== 'all') params.set('visa_status', visaStatus);
      if (maritalStatus && maritalStatus !== 'all') params.set('marital_status', maritalStatus);
      if (locality) params.set('locality', locality);
      params.set('page', page.toString());

      try {
        const res = await fetch(`/api/members?${params}`);
        const data = await res.json();
        if (cancelled) return;
        setMembers(data.members || []);
        setTotal(data.pagination?.total ?? 0);
        setTotalPages(data.pagination?.totalPages ?? 0);
      } catch (error) {
        if (!cancelled) console.error('Error fetching members:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMembers();
    return () => {
      cancelled = true;
    };
  }, [search, status, visaStatus, maritalStatus, locality, page, reloadToken]);

  const pageIds = useMemo(() => members.map((m) => m.id), [members]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id)) && !allPageSelected;

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        pageIds.forEach((id) => next.add(id));
      } else {
        pageIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const toggleSelectOne = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (
      !confirm(
        `Update ${count} selected member${count === 1 ? '' : 's'} to “${bulkStatus}”?`
      )
    ) {
      return;
    }

    setBulkLoading(true);
    setBulkMessage(null);
    try {
      const res = await fetch('/api/members/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), status: bulkStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkMessage(data.error || 'Bulk update failed.');
        return;
      }
      setBulkMessage(data.message || 'Members updated.');
      setSelectedIds(new Set());
      setReloadToken((t) => t + 1);
    } catch {
      setBulkMessage('Network error. Please try again.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status && status !== 'all') params.set('status', status);
    if (visaStatus && visaStatus !== 'all') params.set('visa_status', visaStatus);
    if (maritalStatus && maritalStatus !== 'all') params.set('marital_status', maritalStatus);
    if (locality) params.set('locality', locality);
    params.set('export', 'csv');
    window.location.href = `/api/members?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        description="Manage your membership database"
        actions={
          <>
            {status === 'pending' ? (
              <Button variant="outline" onClick={showAllMembers}>
                Show All Members
              </Button>
            ) : (
              <Button variant="outline" onClick={showPendingMembers}>
                Review Pending
              </Button>
            )}
            <Button asChild>
              <Link href="/dashboard/members/new">
                <AppIcon icon={Plus} className="h-4 w-4" />
                Add Member
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-card px-3 py-2 shadow-sm">
        <AppIcon icon={Link2} className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground sm:text-sm">
          {registrationUrl}
        </p>
        <Button variant="outline" size="sm" onClick={copyRegistrationLink} className="shrink-0">
          <AppIcon icon={copied ? CheckCheck : Copy} className="h-3.5 w-3.5" />
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <FilterBar>
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <AppIcon
                icon={Search}
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search by name, ID, email, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Input
              placeholder="Locality"
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              className="w-full sm:w-48"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={visaStatus}
              onValueChange={(v) => {
                setVisaStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Visa status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Visa Status</SelectItem>
                <SelectItem value="employment">Employment</SelectItem>
                <SelectItem value="residence">Residence</SelectItem>
                <SelectItem value="investor">Investor</SelectItem>
                <SelectItem value="dependent">Dependent</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={maritalStatus}
              onValueChange={(v) => {
                setMaritalStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Marital status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Marital Status</SelectItem>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="married">Married</SelectItem>
                <SelectItem value="widowed">Widowed</SelectItem>
                <SelectItem value="divorced">Divorced</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <Button type="submit" variant="secondary">
                <AppIcon icon={Search} className="h-4 w-4" />
                Search
              </Button>
              <Button type="button" variant="outline" onClick={handleExportCsv}>
                <AppIcon icon={Download} className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </form>
      </FilterBar>

      {selectedIds.size > 0 && (
        <div className="sticky top-16 z-20 flex flex-col gap-3 rounded-lg border border-primary/20 bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between lg:top-4">
          <p className="text-sm font-medium">
            {selectedIds.size} selected
            <button
              type="button"
              className="ml-3 text-sm font-normal text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </button>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="New status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    Set {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleBulkUpdate} disabled={bulkLoading}>
              {bulkLoading ? 'Updating…' : 'Update Status'}
            </Button>
          </div>
        </div>
      )}

      {bulkMessage && (
        <p
          className={cn(
            'rounded-lg border px-3 py-2 text-sm',
            bulkMessage.toLowerCase().includes('fail') || bulkMessage.toLowerCase().includes('error')
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-success/30 bg-success/10 text-success'
          )}
        >
          {bulkMessage}
        </p>
      )}

      <DataList>
        {loading ? (
          <DataListLoading />
        ) : members.length === 0 ? (
          <DataListEmpty
            icon={UsersRound}
            title="No members found"
            description={
              search ||
              status !== 'all' ||
              visaStatus !== 'all' ||
              maritalStatus !== 'all' ||
              locality
                ? 'Try adjusting your search or filters'
                : 'Get started by adding your first member'
            }
            action={
              !search &&
              status === 'all' &&
              visaStatus === 'all' &&
              maritalStatus === 'all' &&
              !locality ? (
                <Button asChild>
                  <Link href="/dashboard/members/new">
                    <AppIcon icon={Plus} className="h-4 w-4" />
                    Add Member
                  </Link>
                </Button>
              ) : status === 'pending' ? (
                <Button variant="outline" onClick={showAllMembers}>
                  Show All Members
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="border-b border-border/80 bg-muted/40 px-4 py-2.5 md:hidden">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={
                    allPageSelected ? true : somePageSelected ? 'indeterminate' : false
                  }
                  onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                  aria-label="Select all on this page"
                />
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Select all
                </span>
              </div>
            </div>

            <div className="md:hidden">
              {members.map((member) => {
                const isSelected = selectedIds.has(member.id);
                return (
                  <DataListCard
                    key={member.id}
                    selected={isSelected}
                    onClick={() => router.push(`/dashboard/members/${member.id}`)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="pt-1"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            toggleSelectOne(member.id, checked === true)
                          }
                          aria-label={`Select ${member.full_name}`}
                        />
                      </div>
                      <EntityAvatar name={member.full_name} className="h-9 w-9 text-xs" />
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="truncate font-medium">{member.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {member.member_id}
                          {member.phone ? ` · ${member.phone}` : ''}
                        </p>
                      </div>
                      <StatusBadge tone={memberStatusTone(member.status)}>
                        {member.status}
                      </StatusBadge>
                    </div>
                    {member.status === 'pending' ? (
                      <div
                        className="flex gap-1 pl-8"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="icon-sm"
                          variant="outline"
                          className="text-success hover:bg-success/10 hover:text-success"
                          disabled={actionLoading === member.id}
                          onClick={(e) => openApproveDialog(member, e)}
                          title="Approve"
                        >
                          <AppIcon icon={Check} className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="outline"
                          className="text-destructive hover:bg-destructive/10"
                          disabled={actionLoading === member.id}
                          onClick={(e) => handleReject(member.id, e)}
                          title="Reject"
                        >
                          <AppIcon icon={X} className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : null}
                  </DataListCard>
                );
              })}
            </div>

            <DataListScroll className="hidden md:block" minWidth="52rem">
              <DataListHead
                className={MEMBER_LIST_COLS}
                columns={[
                  {
                    key: 'check',
                    label: (
                      <Checkbox
                        checked={
                          allPageSelected ? true : somePageSelected ? 'indeterminate' : false
                        }
                        onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                        aria-label="Select all on this page"
                      />
                    ),
                    className: 'flex items-center normal-case tracking-normal',
                  },
                  { key: 'id', label: 'Member ID' },
                  { key: 'name', label: 'Name' },
                  { key: 'phone', label: 'Phone' },
                  { key: 'status', label: 'Status' },
                  { key: 'role', label: 'Role' },
                  { key: 'actions', label: 'Actions', className: 'text-right' },
                ]}
              />
              {members.map((member) => {
                const isSelected = selectedIds.has(member.id);
                return (
                  <DataListRow
                    key={member.id}
                    selected={isSelected}
                    onClick={() => router.push(`/dashboard/members/${member.id}`)}
                    className={MEMBER_LIST_COLS}
                  >
                    <div
                      className="flex items-center !overflow-visible"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          toggleSelectOne(member.id, checked === true)
                        }
                        aria-label={`Select ${member.full_name}`}
                      />
                    </div>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {member.member_id}
                    </span>
                    <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                      <EntityAvatar name={member.full_name} className="h-9 w-9 text-xs" />
                      <div className="min-w-0 overflow-hidden">
                        <p className="truncate font-medium">{member.full_name}</p>
                        {member.email ? (
                          <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                        ) : null}
                      </div>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{member.phone}</p>
                    <div>
                      <StatusBadge tone={memberStatusTone(member.status)}>
                        {member.status}
                      </StatusBadge>
                    </div>
                    <p className="truncate capitalize text-sm text-muted-foreground">
                      {member.membership_type.replace(/_/g, ' ')}
                    </p>
                    <div
                      className="flex justify-end !overflow-visible"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      {member.status === 'pending' ? (
                        <div className="flex gap-1">
                          <Button
                            size="icon-sm"
                            variant="outline"
                            className="shrink-0 text-success hover:bg-success/10 hover:text-success"
                            disabled={actionLoading === member.id}
                            onClick={(e) => openApproveDialog(member, e)}
                            title="Approve"
                          >
                            <AppIcon icon={Check} className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="outline"
                            className="shrink-0 text-destructive hover:bg-destructive/10"
                            disabled={actionLoading === member.id}
                            onClick={(e) => handleReject(member.id, e)}
                            title="Reject"
                          >
                            <AppIcon icon={X} className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </DataListRow>
                );
              })}
            </DataListScroll>

            {totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-border/80 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-center text-sm text-muted-foreground sm:text-left">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}{' '}
                  members
                </p>
                <div className="flex items-center justify-center gap-2 sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <AppIcon icon={ChevronLeft} className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <AppIcon icon={ChevronRight} className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DataList>

      <Dialog open={!!approveMember} onOpenChange={(open) => !open && setApproveMember(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Approve {approveMember?.full_name}</DialogTitle>
            <DialogDescription>
              Set join year and mark which calendar years are already paid. Unchecked years stay due
              (WhatsApp invoice from Fees). Lifetime members skip annual billing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Plan</p>
              <Select
                value={approvePlan}
                onValueChange={(v: 'annual' | 'lifetime') => setApprovePlan(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Yearly (AED 50 / calendar year)</SelectItem>
                  <SelectItem value="lifetime">Lifetime (AED 750)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {approvePlan === 'annual' ? (
              <MembershipYearsPicker
                joinYear={approveJoinYear}
                paidYears={approvePaidYears}
                onJoinYearChange={setApproveJoinYear}
                onPaidYearsChange={setApprovePaidYears}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Lifetime members have no annual dues after approval.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveMember(null)}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={actionLoading === approveMember?.id}>
              {actionLoading === approveMember?.id ? 'Approving…' : 'Approve & activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
