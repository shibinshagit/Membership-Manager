import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, canManageAllMembers } from '@/lib/auth';
import { deleteDocumentBlob } from '@/lib/documents/blob-store';
import { storeMemberDocument } from '@/lib/documents/store-document';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get('member_id');
  const documentType = searchParams.get('type');

  try {
    const isAdmin = canManageAllMembers(user.role);

    const memberIdInt = memberId ? Number.parseInt(memberId, 10) : null;
    const normalizedType = documentType && documentType !== 'all' ? documentType : null;

    const documents = await sql`
      SELECT 
        d.*,
        m.full_name as member_name,
        m.member_id as member_code,
        u.full_name as uploaded_by_name
      FROM documents d
      JOIN members m ON d.member_id = m.id
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE (${isAdmin} OR m.assigned_executive_id = ${user.id})
        AND (${memberIdInt}::int IS NULL OR d.member_id = ${memberIdInt})
        AND (${normalizedType}::text IS NULL OR d.document_type = ${normalizedType})
      ORDER BY d.created_at DESC
    `;

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const memberId = formData.get('member_id') as string;
    const documentType = formData.get('document_type') as string;
    const expiryDate = formData.get('expiry_date') as string | null;

    if (!file || !memberId || !documentType) {
      return NextResponse.json(
        { error: 'File, member ID, and document type are required' },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File exceeds 5MB limit' }, { status: 400 });
    }

    // Verify member exists and user has access
    const isAdmin = canManageAllMembers(user.role);
    const member = isAdmin
      ? await sql`SELECT id FROM members WHERE id = ${memberId}`
      : await sql`SELECT id FROM members WHERE id = ${memberId} AND assigned_executive_id = ${user.id}`;

    if (member.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Upload to Vercel Blob
    const document = await storeMemberDocument(
      Number(memberId),
      documentType,
      file,
      user.id,
      expiryDate || null
    );

    // Log the action
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES (${user.id}, 'upload', 'document', ${document.id}, ${JSON.stringify({ member_id: memberId, document_type: documentType, file_name: file.name })})
    `;

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('id');

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // Get document
    const document = await sql`SELECT * FROM documents WHERE id = ${documentId}`;

    if (document.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    try {
      await deleteDocumentBlob(document[0].file_path);
    } catch (e) {
      console.error('Error deleting file:', e);
    }

    // Delete from database
    await sql`DELETE FROM documents WHERE id = ${documentId}`;

    // Log deletion
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
      VALUES (${user.id}, 'delete', 'document', ${documentId}, ${JSON.stringify(document[0])})
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
