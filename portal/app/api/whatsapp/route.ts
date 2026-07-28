import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { canManageAllMembers, getSession } from '@/lib/auth'

// GET - Get WhatsApp logs
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const memberId = searchParams.get('member_id')
  const limit = parseInt(searchParams.get('limit') || '50')

  try {
    const isAdmin = canManageAllMembers(session.role)
    let logs
    if (memberId) {
      logs = await sql`
        SELECT wl.*, m.full_name as member_name, m.phone as member_phone,
               u.full_name as sent_by_name
        FROM whatsapp_logs wl
        JOIN members m ON wl.member_id = m.id
        LEFT JOIN users u ON wl.sent_by = u.id
        WHERE wl.member_id = ${memberId}
          AND (${isAdmin} OR m.assigned_executive_id = ${session.userId})
        ORDER BY wl.sent_at DESC
        LIMIT ${limit}
      `
    } else {
      logs = await sql`
        SELECT wl.*, m.full_name as member_name, m.phone as member_phone,
               u.full_name as sent_by_name
        FROM whatsapp_logs wl
        JOIN members m ON wl.member_id = m.id
        LEFT JOIN users u ON wl.sent_by = u.id
        WHERE (${isAdmin} OR m.assigned_executive_id = ${session.userId})
        ORDER BY wl.sent_at DESC
        LIMIT ${limit}
      `
    }

    return NextResponse.json(logs)
  } catch (error) {
    console.error('Error fetching WhatsApp logs:', error)
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}

// POST - Log a WhatsApp message sent
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { member_id, message_type, message_content, fee_id, delivery_status } = await request.json()

    if (!member_id || !message_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const isAdmin = canManageAllMembers(session.role)
    const member = await sql`
      SELECT id
      FROM members
      WHERE id = ${member_id}
        AND (${isAdmin} OR assigned_executive_id = ${session.userId})
    `
    if (member.length === 0) {
      return NextResponse.json({ error: 'Member not found or not accessible' }, { status: 404 })
    }

    const result = await sql`
      INSERT INTO whatsapp_logs (member_id, message_type, message_content, fee_id, sent_by, delivery_status)
      VALUES (${member_id}, ${message_type}, ${message_content || null}, ${fee_id || null}, ${session.userId}, ${delivery_status || 'sent'})
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Error logging WhatsApp message:', error)
    return NextResponse.json({ error: 'Failed to log message' }, { status: 500 })
  }
}
