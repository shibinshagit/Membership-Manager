'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  ChevronDown,
  Download,
  Link2,
  Check,
  X,
  Copy,
  CheckCheck,
  Search,
  ListFilter,
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
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MembershipYearsPicker } from '@/components/members/membership-years-picker';
import { WelfareBadge } from '@/components/members/welfare-badge';
import { WhatsAppGroupBadge } from '@/components/members/whatsapp-group-badge';
import { currentCalendarYear, ORG_START_YEAR } from '@/lib/fees-calendar';
import { normalizeWhatsAppPhone } from '@/lib/members/normalize-phone';
import { displayMemberPhone } from '@/lib/members/phone-canonical';

interface Member {
  id: number;
  member_id: string;
  full_name: string;
  email: string | null;
  phone: string;
  whatsapp_number?: string | null;
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
  due?: number | string;
  pending_years?: string | null;
  paid_up_to?: string | null;
  is_welfare_member?: boolean | null;
  added_to_whatsapp_group?: boolean | null;
}

const ASSOCIATION_SIGNATURE =
  'Regards,\nMadikai Pravasi Association\nReg. No: KSR/124/2026\nMadikai, Kasaragod\nKerala, India';

function memberDueAmount(member: Member): number {
  return Number(member.due ?? 0);
}

function memberWhatsAppPhone(member: Member): string | null {
  const phone = normalizeWhatsAppPhone(member.whatsapp_number || member.phone || '');
  return phone || null;
}

function formatPendingYears(member: Member): string {
  const raw = member.pending_years?.trim();
  return raw || '—';
}

function formatPaidUpTo(member: Member): string {
  if (member.membership_plan === 'lifetime') return 'Lifetime Membership';
  const raw = member.paid_up_to?.trim();
  if (raw) return raw;
  return 'Up to date';
}

function generateMemberWhatsAppLink(
  member: Member
): { href: string; kind: 'due' | 'clear' } | null {
  const phone = memberWhatsAppPhone(member);
  if (!phone) return null;

  const due = memberDueAmount(member);
  const memberId = member.member_id;

  if (due > 0) {
    const message = encodeURIComponent(
      `Dear ${member.full_name},\n\nGreetings from the Madikai Pravasi Association!\n\nThis is a friendly reminder that your membership payment is still outstanding.\n\nAmount Due: ${due.toLocaleString()}\nPending Years: ${formatPendingYears(member)}\nMember ID: ${memberId}\n\nKindly make the payment at your earliest convenience to keep your membership active and in good standing.\n\nPlease note that members with pending membership dues will not be eligible to receive any benefits, assistance, welfare schemes, or member-exclusive programs offered by the organization until their membership is renewed and all dues are cleared.\n\nPlease use your Member ID (${memberId}) for all future correspondence, payment references, membership-related inquiries, and event registrations.\n\nWe appreciate your prompt attention to this matter and look forward to your continued participation as an active member.\n\nThank you for your cooperation.\n\n${ASSOCIATION_SIGNATURE}`
    );
    return { href: `https://wa.me/${phone}?text=${message}`, kind: 'due' };
  }

  const message = encodeURIComponent(
    `Dear ${member.full_name},\n\nGreetings from the Madikai Pravasi Association!\n\nFirst, a heartfelt thank you for clearing your membership dues. Your membership account is now fully active and in good standing, ensuring your continued eligibility for all association benefits, activities, and upcoming community programs.\n\nYour Member ID: ${memberId}\nPaid Up to: ${formatPaidUpTo(member)}\n\nPlease use this Member ID for all future correspondence, membership-related inquiries, event registrations, and official transactions with the association.\n\nWe truly appreciate your cooperation, continuous support, and active participation in our community. Together, we continue to strengthen the bond among Madikai natives across the globe.\n\nThank you for being a valued member of our association.\n\n${ASSOCIATION_SIGNATURE}`
  );
  return { href: `https://wa.me/${phone}?text=${message}`, kind: 'clear' };
}

function MemberWhatsAppButton({
  whatsApp,
  onClick,
}: {
  whatsApp: { href: string; kind: 'due' | 'clear' };
  onClick?: (e: React.MouseEvent) => void;
}) {
  const isClear = whatsApp.kind === 'clear';
  return (
    <a
      href={whatsApp.href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={cn(
        'relative inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
        isClear
          ? 'border-success/50 bg-success/15 hover:bg-success/25'
          : 'border-destructive/40 bg-destructive/5 hover:bg-destructive/10'
      )}
      title={
        isClear
          ? 'No dues — send thank you on WhatsApp'
          : 'Has dues — send payment reminder on WhatsApp'
      }
      aria-label={
        isClear
          ? 'Send no-dues thank you on WhatsApp'
          : 'Send due reminder on WhatsApp'
      }
    >
      <WhatsAppIcon
        className={cn('h-4 w-4', isClear ? 'text-success' : 'text-[#25D366]')}
      />
      {isClear ? (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-success text-white ring-2 ring-card">
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </span>
      ) : null}
    </a>
  );
}

function MemberWhatsAppGroupToggle({
  added,
  disabled,
  onToggle,
}: {
  added: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        'relative inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors disabled:opacity-50',
        added
          ? 'border-success/50 bg-success/15 hover:bg-success/25'
          : 'border-border bg-card hover:bg-muted'
      )}
      title={added ? 'In WhatsApp group — click to unmark' : 'Not in WhatsApp group — click to mark as added'}
      aria-label={added ? 'Unmark from WhatsApp group' : 'Mark as added to WhatsApp group'}
    >
      <AppIcon icon={UsersRound} className={cn('h-4 w-4', added ? 'text-success' : 'text-muted-foreground')} />
      {added ? (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-success text-white ring-2 ring-card">
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </span>
      ) : null}
    </button>
  );
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
  const [gender, setGender] = useState('all');
  const [membershipPlanFilter, setMembershipPlanFilter] = useState('all');
  const [joinYearFilter, setJoinYearFilter] = useState('all');
  const [noPaymentsOnly, setNoPaymentsOnly] = useState(false);
  const [welfareOnly, setWelfareOnly] = useState(false);
  const [whatsappGroupFilter, setWhatsappGroupFilter] = useState('all');
  const [dueAmountFilter, setDueAmountFilter] = useState('all');
  const [locality, setLocality] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [waGroupLoadingId, setWaGroupLoadingId] = useState<number | null>(null);
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
  const [approveLifetimeStartDate, setApproveLifetimeStartDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  const limit = 20;
  const joinYearOptions = useMemo(() => {
    const years: number[] = [];
    const now = currentCalendarYear();
    for (let y = now; y >= ORG_START_YEAR; y--) years.push(y);
    return years;
  }, []);

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
    setApproveLifetimeStartDate(new Date().toISOString().slice(0, 10));
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
          paid_years: approvePaidYears,
          lifetime_start_date: approvePlan === 'lifetime' ? approveLifetimeStartDate : undefined,
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
      if (gender && gender !== 'all') params.set('gender', gender);
      if (membershipPlanFilter && membershipPlanFilter !== 'all') {
        params.set('membership_plan', membershipPlanFilter);
      }
      if (joinYearFilter && joinYearFilter !== 'all') params.set('join_year', joinYearFilter);
      if (noPaymentsOnly) params.set('no_payments', '1');
      if (welfareOnly) params.set('welfare', '1');
      if (whatsappGroupFilter === 'added' || whatsappGroupFilter === 'not_added') {
        params.set('whatsapp_group', whatsappGroupFilter);
      }
      if (
        dueAmountFilter === '50' ||
        dueAmountFilter === '100' ||
        dueAmountFilter === '150' ||
        dueAmountFilter === '200' ||
        dueAmountFilter === 'gt250'
      ) {
        params.set('due_amount', dueAmountFilter);
      }
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
  }, [search, status, visaStatus, maritalStatus, gender, membershipPlanFilter, joinYearFilter, noPaymentsOnly, welfareOnly, whatsappGroupFilter, dueAmountFilter, locality, page, reloadToken]);

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

  const handleBulkWhatsAppGroup = async (added: boolean) => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (
      !confirm(
        added
          ? `Mark ${count} selected member${count === 1 ? '' : 's'} as added to the WhatsApp group?`
          : `Mark ${count} selected member${count === 1 ? '' : 's'} as not in the WhatsApp group?`
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
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          added_to_whatsapp_group: added,
        }),
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

  const handleToggleWhatsAppGroup = async (member: Member) => {
    const next = !Boolean(member.added_to_whatsapp_group);
    setWaGroupLoadingId(member.id);
    setBulkMessage(null);
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ added_to_whatsapp_group: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setBulkMessage(data.error || 'Failed to update WhatsApp group mark.');
        return;
      }
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id ? { ...m, added_to_whatsapp_group: next } : m
        )
      );
    } catch {
      setBulkMessage('Network error. Please try again.');
    } finally {
      setWaGroupLoadingId(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (status !== 'all') {
      chips.push({
        key: 'status',
        label: `Status: ${STATUS_OPTIONS.find((o) => o.value === status)?.label || status}`,
        clear: () => setStatus('all'),
      });
    }
    if (dueAmountFilter === '50') {
      chips.push({ key: 'due', label: 'Due AED 50', clear: () => setDueAmountFilter('all') });
    } else if (dueAmountFilter === '100') {
      chips.push({ key: 'due', label: 'Due AED 100', clear: () => setDueAmountFilter('all') });
    } else if (dueAmountFilter === '150') {
      chips.push({ key: 'due', label: 'Due AED 150', clear: () => setDueAmountFilter('all') });
    } else if (dueAmountFilter === '200') {
      chips.push({ key: 'due', label: 'Due AED 200', clear: () => setDueAmountFilter('all') });
    } else if (dueAmountFilter === 'gt250') {
      chips.push({
        key: 'due',
        label: 'Due more than AED 250',
        clear: () => setDueAmountFilter('all'),
      });
    }
    if (visaStatus !== 'all') {
      chips.push({
        key: 'visa',
        label: `Visa: ${visaStatus}`,
        clear: () => setVisaStatus('all'),
      });
    }
    if (maritalStatus !== 'all') {
      chips.push({
        key: 'marital',
        label: `Marital: ${maritalStatus}`,
        clear: () => setMaritalStatus('all'),
      });
    }
    if (gender !== 'all') {
      chips.push({
        key: 'gender',
        label: `Gender: ${gender}`,
        clear: () => setGender('all'),
      });
    }
    if (membershipPlanFilter !== 'all') {
      chips.push({
        key: 'plan',
        label: `Plan: ${membershipPlanFilter === 'lifetime' ? 'Lifetime' : 'Annual'}`,
        clear: () => setMembershipPlanFilter('all'),
      });
    }
    if (joinYearFilter !== 'all') {
      chips.push({
        key: 'join',
        label: `Join year: ${joinYearFilter}`,
        clear: () => setJoinYearFilter('all'),
      });
    }
    if (noPaymentsOnly) {
      chips.push({
        key: 'no_payments',
        label: 'No payments ever',
        clear: () => setNoPaymentsOnly(false),
      });
    }
    if (welfareOnly) {
      chips.push({
        key: 'welfare',
        label: 'Welfare members',
        clear: () => setWelfareOnly(false),
      });
    }
    if (whatsappGroupFilter === 'added') {
      chips.push({
        key: 'wa',
        label: 'In WA group',
        clear: () => setWhatsappGroupFilter('all'),
      });
    } else if (whatsappGroupFilter === 'not_added') {
      chips.push({
        key: 'wa',
        label: 'Not in WA group',
        clear: () => setWhatsappGroupFilter('all'),
      });
    }
    if (locality.trim()) {
      chips.push({
        key: 'locality',
        label: `Locality: ${locality.trim()}`,
        clear: () => setLocality(''),
      });
    }
    return chips;
  }, [
    status,
    dueAmountFilter,
    visaStatus,
    maritalStatus,
    gender,
    membershipPlanFilter,
    joinYearFilter,
    noPaymentsOnly,
    welfareOnly,
    whatsappGroupFilter,
    locality,
  ]);

  const moreFiltersCount = useMemo(
    () =>
      activeFilterChips.filter(
        (chip) => chip.key !== 'status' && chip.key !== 'due'
      ).length,
    [activeFilterChips]
  );

  const clearAllFilters = () => {
    setStatus('all');
    setVisaStatus('all');
    setMaritalStatus('all');
    setGender('all');
    setMembershipPlanFilter('all');
    setJoinYearFilter('all');
    setNoPaymentsOnly(false);
    setWelfareOnly(false);
    setWhatsappGroupFilter('all');
    setDueAmountFilter('all');
    setLocality('');
    setPage(1);
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status && status !== 'all') params.set('status', status);
    if (visaStatus && visaStatus !== 'all') params.set('visa_status', visaStatus);
    if (maritalStatus && maritalStatus !== 'all') params.set('marital_status', maritalStatus);
    if (gender && gender !== 'all') params.set('gender', gender);
    if (membershipPlanFilter && membershipPlanFilter !== 'all') {
      params.set('membership_plan', membershipPlanFilter);
    }
    if (joinYearFilter && joinYearFilter !== 'all') params.set('join_year', joinYearFilter);
    if (noPaymentsOnly) params.set('no_payments', '1');
    if (welfareOnly) params.set('welfare', '1');
    if (whatsappGroupFilter === 'added' || whatsappGroupFilter === 'not_added') {
      params.set('whatsapp_group', whatsappGroupFilter);
    }
    if (
      dueAmountFilter === '50' ||
      dueAmountFilter === '100' ||
      dueAmountFilter === '150' ||
      dueAmountFilter === '200' ||
      dueAmountFilter === 'gt250'
    ) {
      params.set('due_amount', dueAmountFilter);
    }
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
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[9.5rem]">
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
                value={dueAmountFilter}
                onValueChange={(v) => {
                  setDueAmountFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[11rem]">
                  <SelectValue placeholder="Due amount" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Due</SelectItem>
                  <SelectItem value="50">Due AED 50</SelectItem>
                  <SelectItem value="100">Due AED 100</SelectItem>
                  <SelectItem value="150">Due AED 150</SelectItem>
                  <SelectItem value="200">Due AED 200</SelectItem>
                  <SelectItem value="gt250">Due more than AED 250</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant={filtersOpen || moreFiltersCount > 0 ? 'secondary' : 'outline'}
                onClick={() => setFiltersOpen((open) => !open)}
                className="w-full sm:w-auto"
              >
                <AppIcon icon={ListFilter} className="h-4 w-4" />
                Filters
                {moreFiltersCount > 0 ? (
                  <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                    {moreFiltersCount}
                  </span>
                ) : null}
                <AppIcon
                  icon={ChevronDown}
                  className={cn(
                    'h-4 w-4 transition-transform',
                    filtersOpen && 'rotate-180'
                  )}
                />
              </Button>
              <Button type="button" variant="outline" onClick={handleExportCsv} className="w-full sm:w-auto">
                <AppIcon icon={Download} className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>

          {activeFilterChips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => {
                    chip.clear();
                    setPage(1);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {chip.label}
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              ))}
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Clear all
              </button>
            </div>
          ) : null}

          {filtersOpen ? (
            <div className="space-y-4 rounded-lg border border-border/70 bg-muted/20 p-3 sm:p-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Plan</Label>
                  <Select
                    value={membershipPlanFilter}
                    onValueChange={(v) => {
                      setMembershipPlanFilter(v);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Plans</SelectItem>
                      <SelectItem value="annual">Annual / Yearly</SelectItem>
                      <SelectItem value="lifetime">Lifetime</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Join year</Label>
                  <Select
                    value={joinYearFilter}
                    onValueChange={(v) => {
                      setJoinYearFilter(v);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Join year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Join Years</SelectItem>
                      {joinYearOptions.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">WhatsApp group</Label>
                  <Select
                    value={whatsappGroupFilter}
                    onValueChange={(v) => {
                      setWhatsappGroupFilter(v);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="WhatsApp group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All WA group</SelectItem>
                      <SelectItem value="not_added">Not in WA group</SelectItem>
                      <SelectItem value="added">In WA group</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Visa status</Label>
                  <Select
                    value={visaStatus}
                    onValueChange={(v) => {
                      setVisaStatus(v);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full">
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
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Marital status</Label>
                  <Select
                    value={maritalStatus}
                    onValueChange={(v) => {
                      setMaritalStatus(v);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full">
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
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Gender</Label>
                  <Select
                    value={gender}
                    onValueChange={(v) => {
                      setGender(v);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Gender</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2 xl:col-span-1">
                  <Label className="text-xs text-muted-foreground">Locality</Label>
                  <Input
                    placeholder="Area, city, district, ward..."
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:flex-wrap">
                <div className="flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-3">
                  <Switch
                    id="no-payments-toggle"
                    checked={noPaymentsOnly}
                    onCheckedChange={(checked) => {
                      setNoPaymentsOnly(checked === true);
                      setPage(1);
                    }}
                  />
                  <Label
                    htmlFor="no-payments-toggle"
                    className="cursor-pointer whitespace-nowrap text-sm font-normal"
                  >
                    No payments ever
                  </Label>
                </div>
                <div className="flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-3">
                  <Switch
                    id="welfare-only-toggle"
                    checked={welfareOnly}
                    onCheckedChange={(checked) => {
                      setWelfareOnly(checked === true);
                      setPage(1);
                    }}
                  />
                  <Label
                    htmlFor="welfare-only-toggle"
                    className="cursor-pointer whitespace-nowrap text-sm font-normal"
                  >
                    Welfare members
                  </Label>
                </div>
                <div className="flex flex-wrap gap-2 sm:ml-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={clearAllFilters}
                    disabled={activeFilterChips.length === 0}
                  >
                    Clear filters
                  </Button>
                  <Button type="submit" variant="secondary" onClick={() => setFiltersOpen(false)}>
                    Done
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
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
            <Button
              variant="outline"
              onClick={() => handleBulkWhatsAppGroup(true)}
              disabled={bulkLoading}
            >
              Mark in WA group
            </Button>
            <Button
              variant="outline"
              onClick={() => handleBulkWhatsAppGroup(false)}
              disabled={bulkLoading}
            >
              Unmark WA group
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
                const due = memberDueAmount(member);
                const whatsApp = generateMemberWhatsAppLink(member);
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
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">{member.full_name}</p>
                          {member.is_welfare_member ? <WelfareBadge /> : null}
                          {member.added_to_whatsapp_group ? <WhatsAppGroupBadge /> : null}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {member.member_id}
                          {member.phone ? ` · ${displayMemberPhone(member.phone)}` : ''}
                        </p>
                        <p
                          className={cn(
                            'mt-1 text-xs font-medium',
                            due > 0 ? 'text-destructive' : 'text-muted-foreground'
                          )}
                        >
                          Due: AED {due.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <StatusBadge tone={memberStatusTone(member.status)}>
                          {member.status}
                        </StatusBadge>
                        <div className="flex items-center gap-1">
                          <MemberWhatsAppGroupToggle
                            added={Boolean(member.added_to_whatsapp_group)}
                            disabled={waGroupLoadingId === member.id}
                            onToggle={() => handleToggleWhatsAppGroup(member)}
                          />
                          {whatsApp ? (
                            <MemberWhatsAppButton
                              whatsApp={whatsApp}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : null}
                        </div>
                      </div>
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

            <DataListScroll className="hidden md:block" minWidth="58rem">
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
                  { key: 'due', label: 'Due' },
                  { key: 'actions', label: 'Actions', className: 'text-right' },
                ]}
              />
              {members.map((member) => {
                const isSelected = selectedIds.has(member.id);
                const due = memberDueAmount(member);
                const whatsApp = generateMemberWhatsAppLink(member);
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
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">{member.full_name}</p>
                          {member.is_welfare_member ? <WelfareBadge /> : null}
                          {member.added_to_whatsapp_group ? <WhatsAppGroupBadge /> : null}
                        </div>
                        {member.email ? (
                          <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                        ) : null}
                      </div>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {displayMemberPhone(member.phone)}
                    </p>
                    <div>
                      <StatusBadge tone={memberStatusTone(member.status)}>
                        {member.status}
                      </StatusBadge>
                    </div>
                    <p className="truncate capitalize text-sm text-muted-foreground">
                      {member.membership_type.replace(/_/g, ' ')}
                    </p>
                    <p
                      className={cn(
                        'truncate text-sm font-medium tabular-nums',
                        due > 0 ? 'text-destructive' : 'text-muted-foreground'
                      )}
                    >
                      AED {due.toLocaleString()}
                    </p>
                    <div
                      className="flex justify-end gap-1 !overflow-visible"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <MemberWhatsAppGroupToggle
                        added={Boolean(member.added_to_whatsapp_group)}
                        disabled={waGroupLoadingId === member.id}
                        onToggle={() => handleToggleWhatsAppGroup(member)}
                      />
                      {whatsApp ? <MemberWhatsAppButton whatsApp={whatsApp} /> : null}
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
                      ) : !whatsApp ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : null}
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
              Set join year and mark which calendar years were already paid. For lifetime, set when
              lifetime started — only years before that date can be marked paid annually. A 750
              lifetime invoice is created with no further annual dues.
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
                  <SelectItem value="annual">Yearly (join 100; to 2019: 25; from 2020: 50)</SelectItem>
                  <SelectItem value="lifetime">Lifetime (750)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <MembershipYearsPicker
              joinYear={approveJoinYear}
              paidYears={approvePaidYears}
              onJoinYearChange={setApproveJoinYear}
              onPaidYearsChange={setApprovePaidYears}
              mode={approvePlan}
              lifetimeStartDate={approveLifetimeStartDate}
              onLifetimeStartDateChange={setApproveLifetimeStartDate}
            />
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
