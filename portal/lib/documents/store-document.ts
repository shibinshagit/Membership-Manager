import { sql } from '@/lib/db';
import { putDocumentBlob } from '@/lib/documents/blob-store';
import { storedFileName } from '@/lib/documents/sanitize-file-name';

export async function storeMemberDocument(
  memberDbId: number,
  documentType: string,
  file: File,
  uploadedBy: number | null = null,
  expiryDate: string | null = null
) {
  const storedName = storedFileName(file.name);
  const blob = await putDocumentBlob(
    `documents/${memberDbId}/${documentType}/${storedName}`,
    file
  );

  const result = await sql`
    INSERT INTO documents (member_id, document_type, file_name, file_path, file_size, mime_type, expiry_date, uploaded_by)
    VALUES (${memberDbId}, ${documentType}, ${file.name}, ${blob.pathname}, ${file.size}, ${file.type || 'application/octet-stream'}, ${expiryDate}, ${uploadedBy})
    RETURNING *
  `;

  return result[0];
}
