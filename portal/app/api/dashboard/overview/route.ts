import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOverviewStats } from '@/lib/dashboard/overview-stats';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await getOverviewStats(user);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Overview stats error:', error);
    return NextResponse.json({ error: 'Failed to load overview' }, { status: 500 });
  }
}
