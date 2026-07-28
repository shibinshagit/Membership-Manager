import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { PageHeader, StatCard } from '@/components/dashboard/page-header';
import {
  UsersRound,
  BadgeCheck,
  CircleDollarSign,
  CircleAlert,
  FolderOpen,
  Clock3,
} from 'lucide-react';
import Link from 'next/link';
import {
  DataList,
  DataListEmpty,
  DataListRow,
  EntityAvatar,
  StatusBadge,
  memberStatusTone,
} from '@/components/dashboard/data-list';
import { IconTile } from '@/components/icons/icon-tile';

async function getStats(userId: number, role: string) {
  const isAdmin = role === 'super_admin' || role === 'admin';

  const memberQuery = isAdmin
    ? sql`SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'active') as active,
            COUNT(*) FILTER (WHERE status = 'inactive') as inactive,
            COUNT(*) FILTER (WHERE status = 'expired') as expired
          FROM members`
    : sql`SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'active') as active,
            COUNT(*) FILTER (WHERE status = 'inactive') as inactive,
            COUNT(*) FILTER (WHERE status = 'expired') as expired
          FROM members 
          WHERE assigned_executive_id = ${userId}`;

  const memberStats = await memberQuery;

  const feeQuery = isAdmin
    ? sql`SELECT 
            COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN amount ELSE 0 END), 0) as pending_amount,
            COALESCE(SUM(CASE WHEN payment_status = 'unpaid' AND due_date < CURRENT_DATE THEN amount ELSE 0 END), 0) as overdue_amount,
            COUNT(*) FILTER (WHERE payment_status = 'unpaid' AND due_date < CURRENT_DATE) as overdue_count,
            COUNT(*) FILTER (WHERE payment_status = 'unpaid') as pending_count
          FROM member_memberships`
    : sql`SELECT 
            COALESCE(SUM(CASE WHEN f.payment_status = 'unpaid' THEN f.amount ELSE 0 END), 0) as pending_amount,
            COALESCE(SUM(CASE WHEN f.payment_status = 'unpaid' AND f.due_date < CURRENT_DATE THEN f.amount ELSE 0 END), 0) as overdue_amount,
            COUNT(*) FILTER (WHERE f.payment_status = 'unpaid' AND f.due_date < CURRENT_DATE) as overdue_count,
            COUNT(*) FILTER (WHERE f.payment_status = 'unpaid') as pending_count
          FROM member_memberships f
          JOIN members m ON f.member_id = m.id
          WHERE m.assigned_executive_id = ${userId}`;

  const feeStats = await feeQuery;

  const docQuery = isAdmin
    ? sql`SELECT COUNT(*) as total FROM documents`
    : sql`SELECT COUNT(*) as total FROM documents d
          JOIN members m ON d.member_id = m.id
          WHERE m.assigned_executive_id = ${userId}`;

  const docStats = await docQuery;

  const recentQuery = isAdmin
    ? sql`SELECT id, member_id, full_name, status, created_at 
          FROM members 
          ORDER BY created_at DESC 
          LIMIT 5`
    : sql`SELECT id, member_id, full_name, status, created_at 
          FROM members 
          WHERE assigned_executive_id = ${userId}
          ORDER BY created_at DESC 
          LIMIT 5`;

  const recentMembers = await recentQuery;

  return {
    members: memberStats[0] || { total: 0, active: 0, inactive: 0, expired: 0 },
    fees: feeStats[0] || { pending_amount: 0, overdue_amount: 0, overdue_count: 0, pending_count: 0 },
    documents: docStats[0] || { total: 0 },
    recentMembers,
  };
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const stats = await getStats(user.id, user.role);

  const statCards = [
    {
      title: 'Total Members',
      value: stats.members.total,
      description: `${stats.members.active} active`,
      icon: UsersRound,
      href: '/dashboard/members',
      tone: 'default' as const,
    },
    {
      title: 'Active Members',
      value: stats.members.active,
      description: `${stats.members.expired} expired`,
      icon: BadgeCheck,
      href: '/dashboard/members?status=active',
      tone: 'success' as const,
    },
    {
      title: 'Pending Fees',
      value: `AED ${Number(stats.fees.pending_amount).toLocaleString()}`,
      description: `${stats.fees.pending_count} pending payments`,
      icon: CircleDollarSign,
      href: '/dashboard/fees?status=unpaid',
      tone: 'warning' as const,
    },
    {
      title: 'Overdue Payments',
      value: stats.fees.overdue_count,
      description: `AED ${Number(stats.fees.overdue_amount).toLocaleString()} overdue`,
      icon: CircleAlert,
      href: '/dashboard/fees?status=overdue',
      tone: 'danger' as const,
    },
    {
      title: 'Documents',
      value: stats.documents.total,
      description: 'Total uploaded',
      icon: FolderOpen,
      href: '/dashboard/documents',
      tone: 'default' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user.full_name}. Here’s your membership overview.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <IconTile icon={Clock3} size="sm" />
            Recent Members
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Latest member registrations</p>
        </div>
        <DataList>
          {stats.recentMembers.length === 0 ? (
            <DataListEmpty icon={UsersRound} title="No members yet" />
          ) : (
            stats.recentMembers.map((member) => (
              <Link
                key={member.id}
                href={`/dashboard/members/${member.id}`}
                className="block focus-visible:outline-none"
              >
                <DataListRow className="grid-cols-[minmax(0,1fr)_auto]">
                  <div className="flex min-w-0 items-center gap-3">
                    <EntityAvatar name={String(member.full_name)} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{member.full_name}</p>
                      <p className="truncate text-sm text-muted-foreground">{member.member_id}</p>
                    </div>
                  </div>
                  <StatusBadge tone={memberStatusTone(String(member.status))}>
                    {member.status}
                  </StatusBadge>
                </DataListRow>
              </Link>
            ))
          )}
        </DataList>
      </div>
    </div>
  );
}
