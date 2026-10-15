import { sql } from '@/lib/db';
import type { User } from '@/lib/auth';
import { userHasAdminRead } from '@/lib/auth';

export type OverviewStats = {
  members: { total: number; active: number; expired: number };
  fees: {
    pending_amount: number;
    overdue_amount: number;
    overdue_count: number;
    pending_count: number;
  };
  documents: { total: number };
};

export async function getOverviewStats(user: User): Promise<OverviewStats> {
  const isAdmin = userHasAdminRead(user, 'members');

  const memberStats = isAdmin
    ? await sql`
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'active')::int as active,
          COUNT(*) FILTER (WHERE status = 'expired')::int as expired
        FROM members
      `
    : await sql`
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'active')::int as active,
          COUNT(*) FILTER (WHERE status = 'expired')::int as expired
        FROM members
        WHERE assigned_executive_id = ${user.id}
      `;

  const feeStats = isAdmin
    ? await sql`
        SELECT
          COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN amount ELSE 0 END), 0)::float as pending_amount,
          COALESCE(SUM(CASE WHEN payment_status = 'unpaid' AND due_date < CURRENT_DATE THEN amount ELSE 0 END), 0)::float as overdue_amount,
          COUNT(*) FILTER (WHERE payment_status = 'unpaid' AND due_date < CURRENT_DATE)::int as overdue_count,
          COUNT(*) FILTER (WHERE payment_status = 'unpaid')::int as pending_count
        FROM member_memberships
      `
    : await sql`
        SELECT
          COALESCE(SUM(CASE WHEN f.payment_status = 'unpaid' THEN f.amount ELSE 0 END), 0)::float as pending_amount,
          COALESCE(SUM(CASE WHEN f.payment_status = 'unpaid' AND f.due_date < CURRENT_DATE THEN f.amount ELSE 0 END), 0)::float as overdue_amount,
          COUNT(*) FILTER (WHERE f.payment_status = 'unpaid' AND f.due_date < CURRENT_DATE)::int as overdue_count,
          COUNT(*) FILTER (WHERE f.payment_status = 'unpaid')::int as pending_count
        FROM member_memberships f
        JOIN members m ON f.member_id = m.id
        WHERE m.assigned_executive_id = ${user.id}
      `;

  const docStats = isAdmin
    ? await sql`SELECT COUNT(*)::int as total FROM documents`
    : await sql`
        SELECT COUNT(*)::int as total
        FROM documents d
        JOIN members m ON d.member_id = m.id
        WHERE m.assigned_executive_id = ${user.id}
      `;

  return {
    members: {
      total: Number(memberStats[0]?.total ?? 0),
      active: Number(memberStats[0]?.active ?? 0),
      expired: Number(memberStats[0]?.expired ?? 0),
    },
    fees: {
      pending_amount: Number(feeStats[0]?.pending_amount ?? 0),
      overdue_amount: Number(feeStats[0]?.overdue_amount ?? 0),
      overdue_count: Number(feeStats[0]?.overdue_count ?? 0),
      pending_count: Number(feeStats[0]?.pending_count ?? 0),
    },
    documents: { total: Number(docStats[0]?.total ?? 0) },
  };
}

export type LeadershipPerson = {
  id: number;
  full_name: string;
  membership_type: string;
  photo_url: string | null;
};

export async function getLeadershipRoster(): Promise<LeadershipPerson[]> {
  const rows = await sql`
    SELECT
      m.id,
      m.full_name,
      m.membership_type,
      (
        SELECT d.file_path
        FROM documents d
        WHERE d.member_id = m.id
          AND d.document_type = 'photo'
        ORDER BY d.created_at DESC
        LIMIT 1
      ) as photo_path
    FROM members m
    WHERE m.membership_type IN (
      'president',
      'secretary',
      'treasurer',
      'vice_president',
      'joint_secretary',
      'joint_treasurer',
      'patrions'
    )
    ORDER BY m.full_name ASC
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    full_name: String(row.full_name),
    membership_type: String(row.membership_type),
    photo_url: row.photo_path
      ? `/api/documents/file?pathname=${encodeURIComponent(String(row.photo_path))}`
      : null,
  }));
}
