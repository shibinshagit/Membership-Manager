import { sql } from '@/lib/db';
import { ensureExtendedMemberProfileColumns, ensureRoleTermsTable } from '@/lib/db/compat';
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
  display_name: string | null;
  membership_type: string;
  photo_url: string | null;
};

export async function getLeadershipRoster(): Promise<LeadershipPerson[]> {
  await ensureExtendedMemberProfileColumns();
  await ensureRoleTermsTable();
  const rows = await sql`
    SELECT
      m.id,
      m.full_name,
      m.display_name,
      COALESCE(term.role, m.membership_type) AS membership_type,
      (
        SELECT d.file_path
        FROM documents d
        WHERE d.member_id = m.id
          AND d.document_type = 'photo'
        ORDER BY d.created_at DESC
        LIMIT 1
      ) as photo_path
    FROM members m
    LEFT JOIN LATERAL (
      SELECT t.role
      FROM member_role_terms t
      WHERE t.member_id = m.id
        AND t.start_date <= CURRENT_DATE
        AND t.end_date >= CURRENT_DATE
      ORDER BY t.start_date DESC
      LIMIT 1
    ) term ON true
    WHERE COALESCE(term.role, m.membership_type) IN (
      'president',
      'secretary',
      'treasurer',
      'vice_president',
      'joint_secretary',
      'joint_treasurer',
      'patrions',
      'central_committee'
    )
    ORDER BY m.full_name ASC
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    full_name: String(row.full_name),
    display_name: row.display_name ? String(row.display_name) : null,
    membership_type: String(row.membership_type),
    photo_url: row.photo_path
      ? `/api/documents/file?pathname=${encodeURIComponent(String(row.photo_path))}`
      : null,
  }));
}

export type BirthdayPerson = {
  id: number;
  full_name: string;
  display_name: string | null;
  photo_url: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  next_birthday: string;
  days_until: number;
};

export async function getUpcomingBirthdays(withinDays = 30): Promise<BirthdayPerson[]> {
  await ensureExtendedMemberProfileColumns();
  const rows = await sql`
    WITH upcoming AS (
      SELECT
        m.id,
        m.full_name,
        m.display_name,
        m.phone,
        m.whatsapp_number,
        m.date_of_birth
      FROM members m
      WHERE m.date_of_birth IS NOT NULL
        AND (
          (
            to_char(CURRENT_DATE, 'MMDD') <= to_char((CURRENT_DATE + (${withinDays}::int * INTERVAL '1 day'))::date, 'MMDD')
            AND to_char(m.date_of_birth, 'MMDD') >= to_char(CURRENT_DATE, 'MMDD')
            AND to_char(m.date_of_birth, 'MMDD') <= to_char((CURRENT_DATE + (${withinDays}::int * INTERVAL '1 day'))::date, 'MMDD')
          )
          OR (
            to_char(CURRENT_DATE, 'MMDD') > to_char((CURRENT_DATE + (${withinDays}::int * INTERVAL '1 day'))::date, 'MMDD')
            AND (
              to_char(m.date_of_birth, 'MMDD') >= to_char(CURRENT_DATE, 'MMDD')
              OR to_char(m.date_of_birth, 'MMDD') <= to_char((CURRENT_DATE + (${withinDays}::int * INTERVAL '1 day'))::date, 'MMDD')
            )
          )
        )
    )
    SELECT
      u.id,
      u.full_name,
      u.display_name,
      u.phone,
      u.whatsapp_number,
      to_char(u.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
      photo.file_path AS photo_path
    FROM upcoming u
    LEFT JOIN LATERAL (
      SELECT d.file_path
      FROM documents d
      WHERE d.member_id = u.id
        AND d.document_type = 'photo'
      ORDER BY d.created_at DESC
      LIMIT 1
    ) photo ON true
    ORDER BY to_char(u.date_of_birth, 'MMDD') ASC, u.full_name ASC
  `;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return rows
    .flatMap((row) => {
      const match = String(row.date_of_birth).match(/(\d{4})-(\d{2})-(\d{2})/);
      if (!match) return [];
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      const next = new Date(today.getFullYear(), month, day);
      if (next < today) next.setFullYear(today.getFullYear() + 1);
      const daysUntil = Math.round((next.getTime() - today.getTime()) / 86400000);
      if (daysUntil > withinDays) return [];
      const iso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
      return [{
        id: Number(row.id),
        full_name: String(row.full_name),
        display_name: row.display_name ? String(row.display_name) : null,
        phone: row.phone ? String(row.phone) : null,
        whatsapp_number: row.whatsapp_number ? String(row.whatsapp_number) : null,
        photo_url: row.photo_path
          ? `/api/documents/file?pathname=${encodeURIComponent(String(row.photo_path))}`
          : null,
        next_birthday: iso,
        days_until: daysUntil,
      }];
    })
    .sort((a, b) => a.days_until - b.days_until || a.full_name.localeCompare(b.full_name));
}
