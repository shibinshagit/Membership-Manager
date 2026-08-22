import { NextResponse } from 'next/server';
import { getCurrentUser, canManageAllMembers } from '@/lib/auth';
import { ensureAccountsTables } from '@/lib/db/compat';
import { getAccountsSummary } from '@/lib/accounts-service';
import { currentCalendarYear, ORG_START_YEAR } from '@/lib/fees-calendar';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManageAllMembers(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsedYear = Number.parseInt(searchParams.get('year') || String(currentCalendarYear()), 10);
  const year = Number.isFinite(parsedYear)
    ? Math.min(currentCalendarYear(), Math.max(ORG_START_YEAR, parsedYear))
    : currentCalendarYear();

  try {
    await ensureAccountsTables();
    const data = await getAccountsSummary(year);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Accounts summary error:', error);
    return NextResponse.json({ error: 'Failed to load accounts' }, { status: 500 });
  }
}
