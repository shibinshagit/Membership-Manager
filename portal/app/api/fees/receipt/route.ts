import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, userHasAdminRead, userHasAdminWrite } from '@/lib/auth';
import { ensureMemberMembershipsTable } from '@/lib/db/compat';
import { ANNUAL_AMOUNT, FEE_TYPE_ANNUAL } from '@/lib/fees-calendar';
import { reconcileMemberStatusesByPayment } from '@/lib/fees-policy';
import { buildMembershipInvoicePdf } from '@/lib/fees/invoice-pdf';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !userHasAdminRead(user, 'fees')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const memberId = Number.parseInt(new URL(request.url).searchParams.get('member_id') || '', 10);
  if (!Number.isFinite(memberId)) {
    return NextResponse.json({ error: 'Choose a member.' }, { status: 400 });
  }

  await ensureMemberMembershipsTable();
  const rows = await sql`
    SELECT fee_year, amount, payment_status
    FROM member_memberships
    WHERE member_id = ${memberId}
      AND fee_type = ${FEE_TYPE_ANNUAL}
      AND fee_year ~ '^[0-9]{4}$'
      AND COALESCE(payment_status, 'unpaid') <> 'paid'
    ORDER BY fee_year::int
  `;

  return NextResponse.json({
    years: rows.map((row) => ({
      year: String(row.fee_year),
      amount: Number(row.amount || ANNUAL_AMOUNT),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !userHasAdminWrite(user, 'fees')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const memberId = Number(body.member_id);
  const years = Array.isArray(body.years)
    ? [...new Set(body.years.map((year: unknown) => String(year)).filter((year: string) => /^\d{4}$/.test(year)))]
    : [];
  const paidDate = String(body.paid_date || '').slice(0, 10);

  if (!Number.isFinite(memberId) || years.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) {
    return NextResponse.json(
      { error: 'Select a member, at least one due year, and the payment date.' },
      { status: 400 }
    );
  }

  await ensureMemberMembershipsTable();
  const members = await sql`
    SELECT id, member_id, full_name, phone, whatsapp_number, email, address, home_country_address
    FROM members
    WHERE id = ${memberId}
  `;
  if (members.length === 0) {
    return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
  }

  const updated = await sql`
    UPDATE member_memberships
    SET payment_status = 'paid',
        paid_date = ${paidDate}::date,
        updated_at = NOW()
    WHERE member_id = ${memberId}
      AND fee_type = ${FEE_TYPE_ANNUAL}
      AND fee_year = ANY(${years})
      AND COALESCE(payment_status, 'unpaid') <> 'paid'
    RETURNING id, fee_year, amount
  `;

  if (updated.length === 0) {
    return NextResponse.json({ error: 'Those years are not unpaid membership dues.' }, { status: 400 });
  }

  await reconcileMemberStatusesByPayment();

  const total = updated.reduce((sum, row) => sum + Number(row.amount || ANNUAL_AMOUNT), 0);
  const yearList = updated.map((row) => String(row.fee_year)).sort().join(', ');
  const member = members[0];
  const pdfBytes = await buildMembershipInvoicePdf({
    documentType: 'receipt',
    fee: {
      id: Number(updated[0].id),
      fee_type: FEE_TYPE_ANNUAL,
      fee_year: null,
      amount: total,
      currency: 'AED',
      due_date: null,
      paid_date: paidDate,
      payment_status: 'paid',
      notes: `Membership years: ${yearList}. ${updated.length} x ${ANNUAL_AMOUNT} on ${paidDate}.`,
    },
    member: {
      member_id: String(member.member_id),
      full_name: String(member.full_name),
      phone: member.phone ? String(member.phone) : null,
      whatsapp_number: member.whatsapp_number ? String(member.whatsapp_number) : null,
      email: member.email ? String(member.email) : null,
      address: member.address ? String(member.address) : null,
      home_country_address: member.home_country_address ? String(member.home_country_address) : null,
    },
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="MPA-Receipt-${member.member_id}-${yearList.replace(/,\s/g, '-')}.pdf"`,
    },
  });
}
