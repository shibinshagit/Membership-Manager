import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser, canManageAllMembers } from '@/lib/auth';
import { buildMembershipInvoicePdf } from '@/lib/fees/invoice-pdf';
import { ensureMemberMembershipsTable } from '@/lib/db/compat';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const feeId = Number.parseInt(id, 10);
  if (Number.isNaN(feeId)) {
    return NextResponse.json({ error: 'Invalid fee ID' }, { status: 400 });
  }

  try {
    await ensureMemberMembershipsTable();
    const isAdmin = canManageAllMembers(user.role);

    const rows = isAdmin
      ? await sql`
          SELECT
            f.*,
            m.member_id as member_code,
            m.full_name as member_name,
            m.phone as member_phone,
            m.whatsapp_number as member_whatsapp,
            m.email as member_email,
            m.address as member_address,
            m.home_country_address as member_home_address
          FROM member_memberships f
          JOIN members m ON m.id = f.member_id
          WHERE f.id = ${feeId}
        `
      : await sql`
          SELECT
            f.*,
            m.member_id as member_code,
            m.full_name as member_name,
            m.phone as member_phone,
            m.whatsapp_number as member_whatsapp,
            m.email as member_email,
            m.address as member_address,
            m.home_country_address as member_home_address
          FROM member_memberships f
          JOIN members m ON m.id = f.member_id
          WHERE f.id = ${feeId} AND m.assigned_executive_id = ${user.id}
        `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Fee not found' }, { status: 404 });
    }

    const row = rows[0];
    const pdfBytes = await buildMembershipInvoicePdf({
      fee: {
        id: Number(row.id),
        fee_type: String(row.fee_type),
        fee_year: row.fee_year ? String(row.fee_year) : null,
        amount: row.amount as number | string,
        currency: String(row.currency || 'AED'),
        due_date: row.due_date as string | Date | null,
        paid_date: row.paid_date as string | Date | null,
        payment_status: String(row.payment_status),
        payment_method: row.payment_method ? String(row.payment_method) : null,
        transaction_reference: row.transaction_reference
          ? String(row.transaction_reference)
          : null,
        notes: row.notes ? String(row.notes) : null,
      },
      member: {
        member_id: String(row.member_code),
        full_name: String(row.member_name),
        phone: row.member_phone ? String(row.member_phone) : null,
        whatsapp_number: row.member_whatsapp ? String(row.member_whatsapp) : null,
        email: row.member_email ? String(row.member_email) : null,
        address: row.member_address ? String(row.member_address) : null,
        home_country_address: row.member_home_address
          ? String(row.member_home_address)
          : null,
      },
    });

    const filename = `MPA-Invoice-${row.member_code}-${row.id}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Invoice PDF error:', error);
    return NextResponse.json({ error: 'Failed to generate invoice PDF' }, { status: 500 });
  }
}
