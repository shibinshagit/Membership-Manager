import { sql } from '@/lib/db';

export function generateMemberId(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `MEM-${dateStr}-${randomNum}`;
}

export async function resolveMemberId(
  customId?: string | null
): Promise<{ memberId: string } | { error: string; field: string }> {
  const trimmed = customId?.trim() || '';

  if (!trimmed) {
    return { memberId: generateMemberId() };
  }

  if (trimmed.length < 2 || trimmed.length > 50) {
    return {
      error: 'Membership ID must be between 2 and 50 characters.',
      field: 'member_id',
    };
  }

  const existing = await sql`
    SELECT id FROM members WHERE UPPER(TRIM(member_id)) = UPPER(TRIM(${trimmed}))
    LIMIT 1
  `;

  if (existing.length > 0) {
    return {
      error: 'This membership ID is already registered. Please use a different ID or contact the administrator.',
      field: 'member_id',
    };
  }

  return { memberId: trimmed };
}

export async function resolveMemberIdForUpdate(
  memberDbId: number,
  customId: string
): Promise<{ memberId: string } | { error: string; field: string }> {
  const trimmed = customId.trim();

  if (trimmed.length < 2 || trimmed.length > 50) {
    return {
      error: 'Membership ID must be between 2 and 50 characters.',
      field: 'member_id',
    };
  }

  const existing = await sql`
    SELECT id FROM members
    WHERE UPPER(TRIM(member_id)) = UPPER(TRIM(${trimmed}))
      AND id != ${memberDbId}
    LIMIT 1
  `;

  if (existing.length > 0) {
    return {
      error: 'This membership ID is already used by another member.',
      field: 'member_id',
    };
  }

  return { memberId: trimmed };
}
