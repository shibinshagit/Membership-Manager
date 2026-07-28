const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
const SKIP_UNDER_BYTES = 900 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });
}

/**
 * Shrink large phone photos before upload so registration succeeds on slow networks.
 * PDFs and non-images are returned unchanged. If compression fails (e.g. HEIC on some
 * browsers), the original file is returned.
 */
export async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return file;
  }

  if (file.size <= SKIP_UNDER_BYTES) {
    return file;
  }

  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
    });

    if (!blob || blob.size >= file.size) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

export async function compressFormDataImages(
  formData: FormData,
  keys: string[]
): Promise<FormData> {
  const next = new FormData();

  for (const [key, value] of formData.entries()) {
    if (keys.includes(key) && value instanceof File && value.size > 0) {
      next.set(key, await compressImageFile(value));
    } else {
      next.append(key, value);
    }
  }

  return next;
}
