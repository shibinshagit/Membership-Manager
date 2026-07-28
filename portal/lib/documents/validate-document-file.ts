const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf'];
const ALLOWED_PHOTO_MIME_PREFIXES = ['image/'];

export function validateDocumentFile(file: File | null, label: string): string | null {
  if (!file || file.size === 0) {
    return `${label} upload is required.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `${label} must be under 5MB.`;
  }
  const allowed = ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix));
  if (file.type && !allowed) {
    return `${label} must be a photo (JPG, PNG) or PDF.`;
  }
  return null;
}

export function validatePhotoFile(file: File | null, label: string): string | null {
  if (!file || file.size === 0) {
    return `${label} upload is required.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `${label} must be under 5MB.`;
  }
  const allowed = ALLOWED_PHOTO_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix));
  if (file.type && !allowed) {
    return `${label} must be a photo (JPG or PNG).`;
  }
  return null;
}
