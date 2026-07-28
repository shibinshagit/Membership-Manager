import { createReadStream, existsSync } from 'node:fs';
import { mkdir, writeFile, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { del as vercelDel, get as vercelGet, put as vercelPut } from '@vercel/blob';
import { useLocalDocumentStorage } from '@/lib/runtime';

function storageRoot(): string {
  if (process.env.LOCAL_STORAGE_DIR) {
    return process.env.LOCAL_STORAGE_DIR;
  }
  // Keep path statically scoped under ./data so Next file tracing stays narrow.
  return path.join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'uploads');
}

function absolutePath(pathname: string): string {
  const normalized = pathname.replace(/^[/\\]+/, '').replace(/\.\./g, '');
  return path.join(storageRoot(), normalized);
}

export async function putDocumentBlob(
  pathname: string,
  file: File
): Promise<{ pathname: string; url: string }> {
  if (!useLocalDocumentStorage()) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN is required for document storage');
    }
    const blob = await vercelPut(pathname, file, { access: 'private' });
    return { pathname: blob.pathname, url: blob.url };
  }

  const dest = absolutePath(pathname);
  await mkdir(path.dirname(dest), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(dest, buffer);
  return { pathname, url: `local://${pathname}` };
}

export async function getDocumentBlob(
  pathname: string,
  options?: { ifNoneMatch?: string }
): Promise<{
  statusCode: number;
  stream: ReadableStream | null;
  blob: { contentType?: string | null; etag?: string | null };
} | null> {
  if (!useLocalDocumentStorage()) {
    const result = await vercelGet(pathname, {
      access: 'private',
      ifNoneMatch: options?.ifNoneMatch,
    });
    if (!result) return null;
    return {
      statusCode: result.statusCode,
      stream: result.stream ?? null,
      blob: {
        contentType: result.blob.contentType,
        etag: result.blob.etag ? String(result.blob.etag) : null,
      },
    };
  }

  const dest = absolutePath(pathname);
  if (!existsSync(dest)) return null;

  const info = await stat(dest);
  const etag = `"${info.size}-${info.mtimeMs}"`;
  if (options?.ifNoneMatch && options.ifNoneMatch === etag) {
    return {
      statusCode: 304,
      stream: null,
      blob: { contentType: null, etag },
    };
  }

  const nodeStream = createReadStream(dest);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;
  const ext = path.extname(dest).toLowerCase();
  const contentType =
    ext === '.pdf'
      ? 'application/pdf'
      : ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : ext === '.webp'
            ? 'image/webp'
            : 'application/octet-stream';

  return {
    statusCode: 200,
    stream: webStream,
    blob: { contentType, etag },
  };
}

export async function deleteDocumentBlob(pathname: string): Promise<void> {
  if (!useLocalDocumentStorage()) {
    await vercelDel(pathname);
    return;
  }

  const dest = absolutePath(pathname);
  if (existsSync(dest)) {
    await unlink(dest);
  }
}
