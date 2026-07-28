import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, canManageAllMembers } from '@/lib/auth';
import {
  revokeMemberLifetime,
  upgradeMemberToLifetime,
} from '@/lib/fees-policy';
import { ensureMemberMembershipsTable } from '@/lib/db/compat';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !canManageAllMembers(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const memberId = Number.parseInt(id, 10);
  if (Number.isNaN(memberId)) {
    return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 });
  }

  try {
    await ensureMemberMembershipsTable();
    const body = await request.json();
    const action = body.action as 'upgrade' | 'revoke';

    if (action !== 'upgrade' && action !== 'revoke') {
      return NextResponse.json(
        { error: 'Invalid action. Use upgrade or revoke.' },
        { status: 400 }
      );
    }

    const existing = await sql`SELECT * FROM members WHERE id = ${memberId}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (action === 'upgrade') {
      if (existing[0].membership_plan === 'lifetime') {
        return NextResponse.json(
          { error: 'Member already has lifetime membership.' },
          { status: 400 }
        );
      }

      const { feeId } = await upgradeMemberToLifetime({
        memberId,
        createdBy: user.id,
      });

      await sql`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
        VALUES (
          ${user.id},
          'lifetime_upgrade',
          'member',
          ${memberId},
          ${JSON.stringify({ fee_id: feeId, amount: 750 })}
        )
      `;

      const member = await sql`SELECT * FROM members WHERE id = ${memberId}`;
      const fees = await sql`
        SELECT * FROM member_memberships
        WHERE member_id = ${memberId}
        ORDER BY due_date DESC NULLS LAST, updated_at DESC
      `;

      return NextResponse.json({
        message: 'Upgraded to lifetime. AED 750 invoice created.',
        fee_id: feeId,
        member: member[0],
        fees,
      });
    }

    if (existing[0].membership_plan !== 'lifetime') {
      return NextResponse.json(
        { error: 'Member is not on lifetime membership.' },
        { status: 400 }
      );
    }

    await revokeMemberLifetime({ memberId, createdBy: user.id });

    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (
        ${user.id},
        'lifetime_revoke',
        'member',
        ${memberId},
        ${JSON.stringify({ plan: 'annual' })}
      )
    `;

    const member = await sql`SELECT * FROM members WHERE id = ${memberId}`;
    const fees = await sql`
      SELECT * FROM member_memberships
      WHERE member_id = ${memberId}
      ORDER BY due_date DESC NULLS LAST, updated_at DESC
    `;

    return NextResponse.json({
      message: 'Lifetime access removed. Annual calendar-year fees restored.',
      member: member[0],
      fees,
    });
  } catch (error) {
    console.error('Lifetime membership error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update lifetime membership' },
      { status: 500 }
    );
  }
}
