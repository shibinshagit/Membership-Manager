import { type NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, canManageAllMembers } from '@/lib/auth';
import { getDocumentBlob } from '@/lib/documents/blob-store';

function contentDispositionInline(fileName: string): string {
  const asciiFallback = String(fileName)
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(String(fileName));
  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pathname = request.nextUrl.searchParams.get('pathname');

    if (!pathname) {
      return NextResponse.json({ error: 'Missing pathname' }, { status: 400 });
    }

    // Verify user has access to this document
    const document = await sql`
      SELECT d.*, m.assigned_executive_id
      FROM documents d
      JOIN members m ON d.member_id = m.id
      WHERE d.file_path = ${pathname}
    `;

    if (document.length === 0) {
      return new NextResponse('Not found', { status: 404 });
    }

    const isAdmin = canManageAllMembers(user.role);
    if (!isAdmin && document[0].assigned_executive_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const result = await getDocumentBlob(pathname, {
      ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
    });

    if (!result) {
      return new NextResponse('Not found', { status: 404 });
    }

    if (result.statusCode === 304) {
      const etag = result.blob.etag ? String(result.blob.etag) : undefined;
      return new NextResponse(null, {
        status: 304,
        headers: {
          ...(etag ? { ETag: etag } : {}),
          'Cache-Control': 'private, no-cache',
        },
      });
    }

    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType || 'application/octet-stream',
        ...(result.blob.etag ? { ETag: String(result.blob.etag) } : {}),
        'Cache-Control': 'private, no-cache',
        'Content-Disposition': contentDispositionInline(String(document[0].file_name)),
      },
    });
  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}
