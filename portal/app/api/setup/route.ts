import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { getSql } from '@/lib/db';
import { schema } from '@/lib/db/schema';
import { isDesktopMode } from '@/lib/runtime';

function isSetupAllowed(request: Request): boolean {
  if (isDesktopMode() || process.env.NODE_ENV !== 'production') {
    return true;
  }

  const setupSecret = process.env.SETUP_SECRET;
  if (!setupSecret) {
    return false;
  }

  const url = new URL(request.url);
  return url.searchParams.get('secret') === setupSecret;
}

export async function GET(request: Request) {
  if (!isSetupAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!process.env.DATABASE_URL && !isDesktopMode()) {
    return NextResponse.json(
      { error: 'DATABASE_URL not configured' },
      { status: 500 }
    );
  }

  try {
    const sql = getSql();

    // Run schema creation statement-by-statement (works for Neon HTTP and local pg).
    const statements = schema
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await sql.query(statement);
    }

    // Check if super admin exists
    const existingAdmin = await sql`
      SELECT id FROM users WHERE role = 'super_admin' LIMIT 1
    `;

    if (existingAdmin.length === 0) {
      const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
      if (!initialPassword) {
        return NextResponse.json(
          {
            success: false,
            error:
              'No super admin exists. Set ADMIN_INITIAL_PASSWORD in your environment, then run setup again.',
          },
          { status: 400 }
        );
      }

      const passwordHash = await hash(initialPassword, 12);
      await sql`
        INSERT INTO users (username, email, password_hash, full_name, role, is_active)
        VALUES ('admin', 'admin@membership.local', ${passwordHash}, 'Super Administrator', 'super_admin', true)
      `;
    }

    // Keep the system in single-login mode: only admin stays active.
    await sql`
      UPDATE users
      SET is_active = CASE WHEN username = 'admin' THEN true ELSE false END
    `;

    // Executive assignment is disabled: clear legacy assignments on all existing records.
    await sql`
      UPDATE members
      SET assigned_executive_id = NULL,
          assigned_executive_member_id = NULL
      WHERE assigned_executive_id IS NOT NULL
         OR assigned_executive_member_id IS NOT NULL
    `;

    // Backfill membership tracking table from existing member profile values.
    await sql`
      INSERT INTO member_memberships (
        member_id, fee_year, fee_type, plan, amount, currency, due_date, payment_status, start_date, end_date, paid_date, notes
      )
      SELECT
        m.id,
        CASE
          WHEN COALESCE(m.membership_plan, 'annual') = 'lifetime' THEN 'lifetime'
          ELSE CONCAT(
            EXTRACT(YEAR FROM COALESCE(m.membership_start_date, CURRENT_DATE))::int,
            '-',
            EXTRACT(YEAR FROM COALESCE(m.membership_start_date, CURRENT_DATE))::int + 1
          )
        END AS fee_year,
        CASE
          WHEN COALESCE(m.membership_plan, 'annual') = 'lifetime' THEN 'lifetime_membership'
          ELSE 'annual_membership'
        END AS fee_type,
        COALESCE(m.membership_plan, 'annual') AS plan,
        CASE
          WHEN COALESCE(m.membership_plan, 'annual') = 'lifetime' THEN 750
          ELSE 50
        END AS amount,
        'AED' AS currency,
        COALESCE(m.membership_start_date, m.joined_date, m.created_at::date, CURRENT_DATE) AS due_date,
        COALESCE(m.membership_payment_status, 'unpaid') AS payment_status,
        m.membership_start_date,
        m.membership_end_date,
        CASE
          WHEN COALESCE(m.membership_payment_status, 'unpaid') = 'paid' THEN CURRENT_DATE
          ELSE NULL
        END AS paid_date,
        'Auto-migrated from member membership fields' AS notes
      FROM members m
      ON CONFLICT (member_id, fee_year) DO NOTHING
    `;

    // Backfill missing fee rows from legacy member-level membership fields.
    // This is idempotent and only inserts members without any fee history.
    await sql`
      WITH source_members AS (
        SELECT
          m.id AS member_id,
          COALESCE(m.membership_plan, 'annual') AS membership_plan,
          COALESCE(m.membership_payment_status, 'unpaid') AS membership_payment_status,
          COALESCE(m.membership_start_date, m.joined_date, m.created_at::date, CURRENT_DATE) AS baseline_date
        FROM members m
        WHERE NOT EXISTS (
          SELECT 1
          FROM member_memberships f
          WHERE f.member_id = m.id
        )
      )
      INSERT INTO member_memberships (
        member_id,
        fee_type,
        fee_year,
        plan,
        amount,
        currency,
        due_date,
        paid_date,
        payment_status,
        notes,
        start_date,
        end_date
      )
      SELECT
        sm.member_id,
        CASE
          WHEN sm.membership_plan = 'lifetime' THEN 'lifetime_membership'
          ELSE 'annual_membership'
        END AS fee_type,
        CASE
          WHEN sm.membership_plan = 'lifetime'
            THEN 'lifetime'
          ELSE CONCAT(EXTRACT(YEAR FROM sm.baseline_date)::int, '-', (EXTRACT(YEAR FROM sm.baseline_date)::int + 1))
        END AS fee_year,
        sm.membership_plan AS plan,
        CASE
          WHEN sm.membership_plan = 'lifetime' THEN 750
          ELSE 50
        END AS amount,
        'AED' AS currency,
        sm.baseline_date AS due_date,
        CASE
          WHEN sm.membership_payment_status = 'paid' THEN sm.baseline_date
          ELSE NULL
        END AS paid_date,
        CASE
          WHEN sm.membership_payment_status = 'paid' THEN 'paid'
          ELSE 'unpaid'
        END AS payment_status,
        'Auto-migrated from member membership fields' AS notes,
        sm.baseline_date AS start_date,
        CASE
          WHEN sm.membership_plan = 'lifetime' THEN NULL
          ELSE (sm.baseline_date + INTERVAL '1 year')::date
        END AS end_date
      FROM source_members sm
      ON CONFLICT (member_id, fee_year) DO NOTHING
    `;

    // Membership status policy:
    // - Paid annual fee in last 2 years OR paid lifetime fee => active
    // - Otherwise (with fee history) => inactive
    await sql`
      WITH paid_lifetime AS (
        SELECT DISTINCT member_id
        FROM member_memberships
        WHERE payment_status = 'paid' AND fee_type = 'lifetime_membership'
      ),
      paid_recent AS (
        SELECT DISTINCT member_id
        FROM member_memberships
        WHERE payment_status = 'paid'
          AND COALESCE(paid_date, updated_at, created_at) >= (CURRENT_DATE - INTERVAL '2 years')
      ),
      stale_due AS (
        SELECT member_id
        FROM member_memberships
        GROUP BY member_id
        HAVING MAX(due_date) <= (CURRENT_DATE - INTERVAL '2 years')
      ),
      member_flags AS (
        SELECT
          m.id AS member_id,
          CASE
            WHEN pl.member_id IS NOT NULL OR pr.member_id IS NOT NULL THEN 'active'
            WHEN sd.member_id IS NOT NULL THEN 'inactive'
            ELSE NULL
          END AS next_status
        FROM members m
        LEFT JOIN paid_lifetime pl ON pl.member_id = m.id
        LEFT JOIN paid_recent pr ON pr.member_id = m.id
        LEFT JOIN stale_due sd ON sd.member_id = m.id
        WHERE EXISTS (SELECT 1 FROM member_memberships f WHERE f.member_id = m.id)
      )
      UPDATE members m
      SET status = mf.next_status,
          updated_at = NOW()
      FROM member_flags mf
      WHERE m.id = mf.member_id
        AND mf.next_status IS NOT NULL
        AND m.status IN ('active', 'inactive', 'pending')
        AND m.status IS DISTINCT FROM mf.next_status
    `;

    // Remove legacy fees table now that member_memberships is source of truth.
    await sql`ALTER TABLE whatsapp_logs DROP CONSTRAINT IF EXISTS whatsapp_logs_fee_id_fkey`;
    await sql`
      ALTER TABLE whatsapp_logs
      ADD CONSTRAINT whatsapp_logs_fee_id_fkey
      FOREIGN KEY (fee_id) REFERENCES member_memberships(id) ON DELETE SET NULL
    `;
    await sql`DROP TABLE IF EXISTS fees`;

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
    });
  } catch (error) {
    console.error('Database setup error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize database', details: String(error) },
      { status: 500 }
    );
  }
}
