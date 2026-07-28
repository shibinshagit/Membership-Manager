import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { normalizeFeeYearLabel } from '@/lib/fees-calendar';

export type InvoiceFeeRow = {
  id: number;
  fee_type: string;
  fee_year: string | null;
  amount: number | string;
  currency: string;
  due_date: string | Date | null;
  paid_date: string | Date | null;
  payment_status: string;
  payment_method?: string | null;
  transaction_reference?: string | null;
  notes?: string | null;
};

export type InvoiceMemberRow = {
  member_id: string;
  full_name: string;
  phone?: string | null;
  whatsapp_number?: string | null;
  email?: string | null;
  address?: string | null;
  home_country_address?: string | null;
};

const TEAL = rgb(15 / 255, 118 / 255, 110 / 255);
const SLATE = rgb(15 / 255, 23 / 255, 42 / 255);
const MUTED = rgb(100 / 255, 116 / 255, 139 / 255);
const LIGHT = rgb(248 / 255, 250 / 255, 252 / 255);
const BORDER = rgb(226 / 255, 232 / 255, 240 / 255);
const WHITE = rgb(1, 1, 1);

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function money(amount: number | string): string {
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  // Show whole amounts as 50 / 750 with no currency code
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function descriptionForFee(fee: InvoiceFeeRow): string {
  if (fee.fee_type === 'lifetime_membership' || fee.fee_year === 'lifetime') {
    return 'Lifetime Membership (one-time)';
  }
  const year = normalizeFeeYearLabel(fee.fee_year);
  return `Annual Membership Fee — Calendar Year ${year}`;
}

function statusLabel(status: string): string {
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : '—';
}

async function loadLogoBytes(): Promise<Uint8Array | null> {
  const candidates = [
    path.join(process.cwd(), 'public', 'mpa-logo.png'),
    path.join(process.cwd(), 'portal', 'public', 'mpa-logo.png'),
    path.join(process.cwd(), '..', 'public', 'mpa-logo.png'),
  ];

  for (const logoPath of candidates) {
    try {
      const buf = await readFile(logoPath);
      return new Uint8Array(buf);
    } catch {
      // try next path
    }
  }
  return null;
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

async function embedLogo(pdf: PDFDocument, bytes: Uint8Array) {
  // File is named .png but the asset is often a JPEG — detect by magic bytes.
  if (isJpeg(bytes)) return pdf.embedJpg(bytes);
  if (isPng(bytes)) return pdf.embedPng(bytes);
  try {
    return await pdf.embedJpg(bytes);
  } catch {
    return pdf.embedPng(bytes);
  }
}

export async function buildMembershipInvoicePdf(options: {
  fee: InvoiceFeeRow;
  member: InvoiceMemberRow;
}): Promise<Uint8Array> {
  const { fee, member } = options;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  const width = page.getWidth();
  const height = page.getHeight();
  let y = height - margin;

  // Header band
  page.drawRectangle({
    x: 0,
    y: height - 110,
    width,
    height: 110,
    color: TEAL,
  });

  const logoBytes = await loadLogoBytes();
  if (logoBytes) {
    try {
      const logo = await embedLogo(pdf, logoBytes);
      const logoSize = 56;
      page.drawRectangle({
        x: margin - 4,
        y: height - 88,
        width: logoSize + 8,
        height: logoSize + 8,
        color: WHITE,
      });
      page.drawImage(logo, {
        x: margin,
        y: height - 84,
        width: logoSize,
        height: logoSize,
      });
    } catch (error) {
      console.error('Invoice logo embed failed:', error);
    }
  } else {
    console.error('Invoice logo file not found (mpa-logo.png)');
  }

  page.drawText('Madikai Pravasi Association', {
    x: margin + 72,
    y: height - 48,
    size: 16,
    font: fontBold,
    color: WHITE,
  });
  page.drawText('Madikai-Kerala', {
    x: margin + 72,
    y: height - 68,
    size: 11,
    font,
    color: rgb(0.9, 0.96, 0.95),
  });
  page.drawText('India', {
    x: margin + 72,
    y: height - 84,
    size: 9,
    font,
    color: rgb(0.85, 0.93, 0.92),
  });

  const invoiceNo = `INV-${member.member_id}-${fee.id}`;
  page.drawText(invoiceNo, {
    x: width - margin - fontBold.widthOfTextAtSize(invoiceNo, 12),
    y: height - 48,
    size: 12,
    font: fontBold,
    color: WHITE,
  });
  page.drawText(formatDate(new Date()), {
    x: width - margin - font.widthOfTextAtSize(formatDate(new Date()), 10),
    y: height - 66,
    size: 10,
    font,
    color: rgb(0.9, 0.96, 0.95),
  });

  y = height - 140;

  // Bill to + invoice meta
  page.drawText('BILL TO', {
    x: margin,
    y,
    size: 9,
    font: fontBold,
    color: MUTED,
  });
  y -= 16;
  page.drawText(member.full_name, {
    x: margin,
    y,
    size: 13,
    font: fontBold,
    color: SLATE,
  });
  y -= 14;
  page.drawText(`Membership ID: ${member.member_id}`, {
    x: margin,
    y,
    size: 10,
    font,
    color: SLATE,
  });
  y -= 13;
  if (member.phone) {
    page.drawText(`Phone: ${member.phone}`, {
      x: margin,
      y,
      size: 10,
      font,
      color: MUTED,
    });
    y -= 13;
  }
  if (member.email) {
    page.drawText(`Email: ${member.email}`, {
      x: margin,
      y,
      size: 10,
      font,
      color: MUTED,
    });
    y -= 13;
  }

  const metaX = width / 2 + 20;
  let metaY = height - 140;
  const isLifetime =
    fee.fee_type === 'lifetime_membership' || fee.fee_year === 'lifetime';
  const dueDateLabel = isLifetime ? 'Life time access' : formatDate(fee.due_date);
  const meta = [
    ['Status', statusLabel(fee.payment_status)],
    ['Due date', dueDateLabel],
    ['Paid date', formatDate(fee.paid_date)],
  ];
  for (const [label, value] of meta) {
    page.drawText(label, {
      x: metaX,
      y: metaY,
      size: 9,
      font: fontBold,
      color: MUTED,
    });
    page.drawText(String(value), {
      x: metaX + 80,
      y: metaY,
      size: 10,
      font,
      color: SLATE,
    });
    metaY -= 16;
  }

  y = Math.min(y, metaY) - 24;

  // Line items table header
  page.drawRectangle({
    x: margin,
    y: y - 8,
    width: width - margin * 2,
    height: 28,
    color: LIGHT,
    borderColor: BORDER,
    borderWidth: 1,
  });
  page.drawText('Description', {
    x: margin + 12,
    y: y + 2,
    size: 10,
    font: fontBold,
    color: SLATE,
  });
  page.drawText('Amount', {
    x: width - margin - 90,
    y: y + 2,
    size: 10,
    font: fontBold,
    color: SLATE,
  });

  y -= 40;
  const desc = descriptionForFee(fee);
  page.drawText(desc, {
    x: margin + 12,
    y,
    size: 11,
    font,
    color: SLATE,
  });
  const amountText = money(fee.amount);
  page.drawText(amountText, {
    x: width - margin - fontBold.widthOfTextAtSize(amountText, 11) - 12,
    y,
    size: 11,
    font: fontBold,
    color: SLATE,
  });

  y -= 18;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: BORDER,
  });

  y -= 36;
  page.drawRectangle({
    x: width - margin - 200,
    y: y - 12,
    width: 200,
    height: 44,
    color: TEAL,
  });
  page.drawText('TOTAL DUE', {
    x: width - margin - 188,
    y: y + 12,
    size: 9,
    font: fontBold,
    color: rgb(0.85, 0.95, 0.93),
  });
  page.drawText(amountText, {
    x: width - margin - 188,
    y: y - 4,
    size: 16,
    font: fontBold,
    color: WHITE,
  });

  if (fee.transaction_reference) {
    y -= 70;
    page.drawText(`Reference: ${fee.transaction_reference}`, {
      x: margin,
      y,
      size: 10,
      font,
      color: MUTED,
    });
  }

  // Footer
  page.drawLine({
    start: { x: margin, y: 72 },
    end: { x: width - margin, y: 72 },
    thickness: 1,
    color: BORDER,
  });
  page.drawText('Thank you for supporting Madikai Pravasi Association (MPA).', {
    x: margin,
    y: 52,
    size: 9,
    font,
    color: MUTED,
  });
  page.drawText('This is a computer-generated membership invoice.', {
    x: margin,
    y: 38,
    size: 8,
    font,
    color: MUTED,
  });

  return pdf.save();
}
