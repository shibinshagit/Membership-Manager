export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
}

export function storedFileName(originalName: string): string {
  const safe = sanitizeFileName(originalName);
  return `${Date.now()}-${safe || 'upload'}`;
}
