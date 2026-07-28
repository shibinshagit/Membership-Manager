export type MemberIdentityCardData = {
  memberId: string;
  fullName: string;
  phone: string;
  permanentAddress?: string | null;
  bloodGroup?: string | null;
  wardNo?: number | null;
  nominee?: string | null;
  membershipPlan?: string | null;
  membershipStartDate?: string | null;
  membershipEndDate?: string | null;
  status: string;
  photoUrl?: string | null;
};

export function formatIdentityCardDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getIdentityCardPhotoUrl(
  documents: Array<{ document_type: string; file_path: string; file_name: string; mime_type?: string }>
): string | null {
  const isImageDoc = (doc: { file_name: string; mime_type?: string }) =>
    doc.mime_type?.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|bmp)$/i.test(doc.file_name);

  const photoDoc = documents.find((doc) => doc.document_type === 'photo' && isImageDoc(doc));

  if (!photoDoc) return null;

  return `/api/documents/file?pathname=${encodeURIComponent(photoDoc.file_path)}`;
}

async function waitForImages(element: HTMLElement) {
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );
}

export async function renderIdentityCardPng(element: HTMLElement): Promise<string> {
  const { toPng } = await import('html-to-image');

  await waitForImages(element);

  return toPng(element, {
    pixelRatio: 3,
    cacheBust: false,
    fetchRequestInit: {
      credentials: 'include',
    },
  });
}

export async function downloadIdentityCardPng(element: HTMLElement, filename: string) {
  const dataUrl = await renderIdentityCardPng(element);

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

/** Digits only, with country code when possible. */
export function normalizeWhatsAppPhone(raw: string): string {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('00')) digits = digits.slice(2);

  // Already has a country code (UAE / India / etc.)
  if (digits.startsWith('971') || digits.startsWith('91')) {
    return digits;
  }

  // UAE mobile without country code (5xxxxxxxx / 05xxxxxxxx)
  if (digits.length === 9 && digits.startsWith('5')) {
    return `971${digits}`;
  }
  if (digits.length === 10 && digits.startsWith('05')) {
    return `971${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith('5')) {
    return `971${digits}`;
  }

  // India mobile without country code
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`;
  }

  return digits;
}

export function buildIdentityCardWhatsAppMessage(data: {
  fullName: string;
  memberId: string;
}): string {
  return [
    `Dear ${data.fullName},`,
    '',
    'Your MPA membership identity card is ready.',
    `Membership ID: ${data.memberId}`,
    '',
    'Please find your identity card',
    'Thank you.',
  ].join('\n');
}

/**
 * Share identity card to WhatsApp.
 * Downloads the PNG first, then opens wa.me with a prefilled message.
 */
export async function shareIdentityCardToWhatsApp(options: {
  element: HTMLElement;
  phone: string;
  fullName: string;
  memberId: string;
}): Promise<'opened'> {
  const { element, phone, fullName, memberId } = options;
  const filename = `${memberId}-identity-card.png`;
  const message = buildIdentityCardWhatsAppMessage({ fullName, memberId });
  const waPhone = normalizeWhatsAppPhone(phone);

  if (!waPhone) {
    throw new Error('No valid WhatsApp number on this member profile.');
  }

  const dataUrl = await renderIdentityCardPng(element);
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();

  // Brief pause so the download starts before WhatsApp opens.
  await new Promise((resolve) => window.setTimeout(resolve, 400));

  const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
  const anchor = document.createElement('a');
  anchor.href = waUrl;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  return 'opened';
}
