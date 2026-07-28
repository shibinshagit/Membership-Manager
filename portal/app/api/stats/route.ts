import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const isAdmin =
      session.role === 'super_admin' ||
      session.role === 'president' ||
      session.role === 'secretary'

    // Get total members count
    const totalMembersResult = await sql`
      SELECT COUNT(*) as count
      FROM members
      WHERE (${isAdmin} OR assigned_executive_id = ${session.userId})
    `
    const totalMembers = parseInt(totalMembersResult[0].count)

    // Get active members count
    const activeMembersResult = await sql`
      SELECT COUNT(*) as count
      FROM members
      WHERE status = 'active'
        AND (${isAdmin} OR assigned_executive_id = ${session.userId})
    `
    const activeMembers = parseInt(activeMembersResult[0].count)

    // Get pending fees
    const pendingFeesResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM member_memberships f
      JOIN members m ON m.id = f.member_id
      WHERE f.payment_status = 'unpaid'
        AND (${isAdmin} OR m.assigned_executive_id = ${session.userId})
    `
    const pendingFees = parseFloat(pendingFeesResult[0].total)

    // Get collected fees (this year)
    const collectedFeesResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM member_memberships f
      JOIN members m ON m.id = f.member_id
      WHERE f.payment_status = 'paid'
        AND f.paid_date >= DATE_TRUNC('year', CURRENT_DATE)
        AND (${isAdmin} OR m.assigned_executive_id = ${session.userId})
    `
    const collectedFees = parseFloat(collectedFeesResult[0].total)

    // Get overdue fees count
    const overdueFeesResult = await sql`
      SELECT COUNT(*) as count
      FROM member_memberships f
      JOIN members m ON m.id = f.member_id
      WHERE f.payment_status = 'unpaid'
        AND f.due_date < CURRENT_DATE
        AND (${isAdmin} OR m.assigned_executive_id = ${session.userId})
    `
    const overdueCount = parseInt(overdueFeesResult[0].count)

    // Get documents expiring soon (within 30 days)
    const expiringDocsResult = await sql`
      SELECT COUNT(*) as count
      FROM documents d
      JOIN members m ON m.id = d.member_id
      WHERE d.expiry_date IS NOT NULL
        AND d.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
        AND d.expiry_date >= CURRENT_DATE
        AND (${isAdmin} OR m.assigned_executive_id = ${session.userId})
    `
    const expiringDocs = parseInt(expiringDocsResult[0].count)

    // Get recent members (last 30 days)
    const recentMembersResult = await sql`
      SELECT COUNT(*) as count FROM members 
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND (${isAdmin} OR assigned_executive_id = ${session.userId})
    `
    const recentMembers = parseInt(recentMembersResult[0].count)

    // Get members by status for chart
    const membersByStatus = await sql`
      SELECT status, COUNT(*) as count 
      FROM members 
      WHERE (${isAdmin} OR assigned_executive_id = ${session.userId})
      GROUP BY status
    `

    // Get fees by month (last 6 months)
    const feesByMonth = await sql`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', due_date), 'Mon') as month,
        SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END) as paid,
        SUM(CASE WHEN payment_status = 'unpaid' THEN amount ELSE 0 END) as pending
      FROM member_memberships f
      JOIN members m ON m.id = f.member_id
      WHERE due_date >= CURRENT_DATE - INTERVAL '6 months'
        AND (${isAdmin} OR m.assigned_executive_id = ${session.userId})
      GROUP BY DATE_TRUNC('month', due_date)
      ORDER BY DATE_TRUNC('month', due_date)
    `

    // Get executives with member counts
    const executiveStats = await sql`
      SELECT u.id, u.full_name, COUNT(m.id) as member_count
      FROM users u
      LEFT JOIN members m ON m.assigned_executive_id = u.id
      WHERE u.role = 'executive'
        AND (${isAdmin} OR u.id = ${session.userId})
      GROUP BY u.id, u.full_name
      ORDER BY member_count DESC
      LIMIT 5
    `

    return NextResponse.json({
      totalMembers,
      activeMembers,
      pendingFees,
      collectedFees,
      overdueCount,
      expiringDocs,
      recentMembers,
      membersByStatus,
      feesByMonth,
      executiveStats,
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
