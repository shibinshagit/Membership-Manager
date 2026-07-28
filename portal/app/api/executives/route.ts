import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, canManageAllMembers } from '@/lib/auth';
import { ensureAssignedExecutiveMemberColumn } from '@/lib/db/compat';

// Get role-based member list for assignment/list pages
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManageAllMembers(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get('role') || 'executive';
    const allowedRoles = [
      'executive',
      'central_committee_group',
      'patrions',
      'central_committee',
      'secretary',
      'joint_secretary',
      'president',
      'vice_president',
      'treasurer',
      'joint_treasurer',
    ];
    const targetRole = allowedRoles.includes(roleParam) ? roleParam : 'executive';
    const hasExecutiveMemberColumn = await ensureAssignedExecutiveMemberColumn();
    const executives =
      targetRole === 'executive'
        ? hasExecutiveMemberColumn
          ? await sql`
              SELECT
                e.id,
                e.full_name,
                e.member_id,
                e.membership_type as role,
                e.status,
                COUNT(m.id)::int as member_count
              FROM members e
              LEFT JOIN members m ON m.assigned_executive_member_id = e.id
              WHERE e.membership_type <> 'member'
              GROUP BY e.id
              ORDER BY e.full_name
            `
          : await sql`
              SELECT
                e.id,
                e.full_name,
                e.member_id,
                e.membership_type as role,
                e.status,
                0::int as member_count
              FROM members e
              WHERE e.membership_type <> 'member'
              ORDER BY e.full_name
            `
        : targetRole === 'central_committee_group'
        ? hasExecutiveMemberColumn
          ? await sql`
              SELECT
                e.id,
                e.full_name,
                e.member_id,
                e.membership_type as role,
                e.status,
                COUNT(m.id)::int as member_count
              FROM members e
              LEFT JOIN members m ON m.assigned_executive_member_id = e.id
              WHERE e.membership_type IN ('executive', 'central_committee')
              GROUP BY e.id
              ORDER BY e.full_name
            `
          : await sql`
              SELECT
                e.id,
                e.full_name,
                e.member_id,
                e.membership_type as role,
                e.status,
                0::int as member_count
              FROM members e
              WHERE e.membership_type IN ('executive', 'central_committee')
              ORDER BY e.full_name
            `
        : targetRole === 'patrions'
        ? hasExecutiveMemberColumn
          ? await sql`
              SELECT
                e.id,
                e.full_name,
                e.member_id,
                e.membership_type as role,
                e.status,
                COUNT(m.id)::int as member_count
              FROM members e
              LEFT JOIN members m ON m.assigned_executive_member_id = e.id
              WHERE e.membership_type NOT IN ('executive', 'central_committee', 'member')
              GROUP BY e.id
              ORDER BY e.full_name
            `
          : await sql`
              SELECT
                e.id,
                e.full_name,
                e.member_id,
                e.membership_type as role,
                e.status,
                0::int as member_count
              FROM members e
              WHERE e.membership_type NOT IN ('executive', 'central_committee', 'member')
              ORDER BY e.full_name
            `
        : hasExecutiveMemberColumn
        ? await sql`
            SELECT
              e.id,
              e.full_name,
              e.member_id,
              e.membership_type as role,
              e.status,
              COUNT(m.id)::int as member_count
            FROM members e
            LEFT JOIN members m ON m.assigned_executive_member_id = e.id
            WHERE e.membership_type = ${targetRole}
            GROUP BY e.id
            ORDER BY e.full_name
          `
        : await sql`
            SELECT
              e.id,
              e.full_name,
              e.member_id,
              e.membership_type as role,
              e.status,
              0::int as member_count
            FROM members e
            WHERE e.membership_type = ${targetRole}
            ORDER BY e.full_name
          `;

    return NextResponse.json({ executives, role: targetRole });
  } catch (error) {
    console.error('Error fetching executives:', error);
    return NextResponse.json({ error: 'Failed to fetch executives' }, { status: 500 });
  }
}

// Bulk assign members to executive
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (${user.id}, 'assignment_disabled', 'members', NULL, ${JSON.stringify(body)})
    `;

    return NextResponse.json(
      { error: 'Executive assignment is disabled for this system' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error assigning members:', error);
    return NextResponse.json({ error: 'Failed to assign members' }, { status: 500 });
  }
}
