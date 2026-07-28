import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDumpImportStatus } from '@/lib/settings/app-meta';
import {
  clearAllAppData,
  getStorageLocations,
  restoreSqlDump,
} from '@/lib/settings/data-import';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function requireSuperAdmin(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  return Boolean(user && user.role === 'super_admin');
}

export async function GET() {
  const user = await getCurrentUser();
  if (!requireSuperAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const status = await getDumpImportStatus();
  return NextResponse.json({
    ...status,
    storage: getStorageLocations(),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!requireSuperAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('dump') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'SQL dump file is required' }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith('.sql')) {
      return NextResponse.json({ error: 'Upload a .sql database dump' }, { status: 400 });
    }

    // ~100MB limit for local restore
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'Dump file exceeds 100MB limit' }, { status: 400 });
    }

    await restoreSqlDump(file);
    const status = await getDumpImportStatus();
    return NextResponse.json({
      success: true,
      message: 'Database dump imported successfully',
      ...status,
      storage: getStorageLocations(),
    });
  } catch (error) {
    console.error('Dump import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import dump' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!requireSuperAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await clearAllAppData();
    const status = await getDumpImportStatus();
    return NextResponse.json({
      success: true,
      message:
        'All data deleted. Admin reset to default password from config (or Admin@12345). You can import a dump again.',
      ...status,
      storage: getStorageLocations(),
    });
  } catch (error) {
    console.error('Clear data error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete data' },
      { status: 500 }
    );
  }
}
