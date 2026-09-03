import { sql } from '@/lib/db';

let hasAssignedExecutiveMemberColumnCache: boolean | null = null;
let extendedMemberProfileColumnsEnsured = false;
let memberMembershipsTableEnsured = false;
let committeeTablesEnsured = false;
let visaDocumentTypeEnsured = false;
let welfareColumnsEnsured = false;
let whatsappGroupColumnEnsured = false;

export async function hasAssignedExecutiveMemberColumn(): Promise<boolean> {
  if (hasAssignedExecutiveMemberColumnCache !== null) {
    return hasAssignedExecutiveMemberColumnCache;
  }

  const result = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'members'
        AND column_name = 'assigned_executive_member_id'
    ) AS exists
  `;

  hasAssignedExecutiveMemberColumnCache = Boolean(result[0]?.exists);
  return hasAssignedExecutiveMemberColumnCache;
}

export async function ensureAssignedExecutiveMemberColumn(): Promise<boolean> {
  const exists = await hasAssignedExecutiveMemberColumn();
  if (exists) return true;

  await sql`
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS assigned_executive_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_members_assigned_executive_member
    ON members(assigned_executive_member_id)
  `;

  hasAssignedExecutiveMemberColumnCache = true;
  return true;
}

export async function ensureExtendedMemberProfileColumns(): Promise<void> {
  if (extendedMemberProfileColumnsEnsured) return;

  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS gender VARCHAR(20)`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10)`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20)`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS visa_status VARCHAR(50)`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS profession VARCHAR(255)`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS company_name VARCHAR(255)`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS work_location VARCHAR(255)`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS uae_building VARCHAR(255)`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS uae_area VARCHAR(255)`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS uae_city VARCHAR(255)`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS home_country_address TEXT`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS home_state VARCHAR(100)`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS home_district VARCHAR(100)`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS home_local_body VARCHAR(255)`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS home_local_area_ward VARCHAR(255)`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS home_country_contact_number VARCHAR(20)`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS spouse_name VARCHAR(255)`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS children_count INTEGER`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS children_details TEXT`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS family_residing_with BOOLEAN`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS nominee VARCHAR(255)`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS ward_no INTEGER`;
  await sql`ALTER TABLE members DROP CONSTRAINT IF EXISTS members_ward_no_check`;
  await sql`
    ALTER TABLE members ADD CONSTRAINT members_ward_no_check
    CHECK (ward_no IS NULL OR ward_no = 0 OR (ward_no >= 1 AND ward_no <= 16))
  `;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS membership_plan VARCHAR(20) DEFAULT 'annual'`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS membership_payment_status VARCHAR(20) DEFAULT 'unpaid'`;
  extendedMemberProfileColumnsEnsured = true;
}

export async function ensureMemberMembershipsTable(): Promise<void> {
  if (memberMembershipsTableEnsured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS member_memberships (
      id SERIAL PRIMARY KEY,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      fee_year VARCHAR(20) NOT NULL,
      fee_type VARCHAR(50) NOT NULL CHECK (fee_type IN ('annual_membership', 'lifetime_membership')),
      plan VARCHAR(20) NOT NULL CHECK (plan IN ('annual', 'lifetime')),
      amount DECIMAL(10, 2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'AED',
      due_date DATE,
      payment_status VARCHAR(20) NOT NULL CHECK (payment_status IN ('paid', 'unpaid')),
      partial_amount DECIMAL(10, 2) DEFAULT 0,
      payment_method VARCHAR(50),
      transaction_reference VARCHAR(100),
      notes TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      start_date DATE,
      end_date DATE,
      paid_date DATE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(member_id, fee_year)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_member_memberships_member_id
    ON member_memberships(member_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_member_memberships_fee_year
    ON member_memberships(fee_year)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_member_memberships_payment_status
    ON member_memberships(payment_status)
  `;
  await sql`ALTER TABLE member_memberships ADD COLUMN IF NOT EXISTS fee_type VARCHAR(50)`;
  await sql`ALTER TABLE member_memberships ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'AED'`;
  await sql`ALTER TABLE member_memberships ADD COLUMN IF NOT EXISTS due_date DATE`;
  await sql`ALTER TABLE member_memberships ADD COLUMN IF NOT EXISTS partial_amount DECIMAL(10, 2) DEFAULT 0`;
  await sql`ALTER TABLE member_memberships ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50)`;
  await sql`ALTER TABLE member_memberships ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(100)`;
  await sql`ALTER TABLE member_memberships ADD COLUMN IF NOT EXISTS notes TEXT`;
  await sql`ALTER TABLE member_memberships ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL`;
  await sql`
    UPDATE member_memberships
    SET fee_type = CASE WHEN plan = 'lifetime' THEN 'lifetime_membership' ELSE 'annual_membership' END
    WHERE fee_type IS NULL
  `;
  memberMembershipsTableEnsured = true;
  await ensureWelfareColumns();
}

export async function ensureCommitteeTables(): Promise<void> {
  if (committeeTablesEnsured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS committees (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) UNIQUE NOT NULL,
      description TEXT,
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS committee_members (
      id SERIAL PRIMARY KEY,
      committee_id INTEGER NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(committee_id, member_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_committees_status ON committees(status)`;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_committee_members_committee
    ON committee_members(committee_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_committee_members_member
    ON committee_members(member_id)
  `;
  committeeTablesEnsured = true;
}

export async function ensureVisaDocumentType(): Promise<void> {
  if (visaDocumentTypeEnsured) return;

  await sql`
    ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_document_type_check
  `;
  await sql`
    ALTER TABLE documents ADD CONSTRAINT documents_document_type_check
    CHECK (document_type IN ('emirates_id', 'passport', 'visa', 'photo', 'other'))
  `;

  visaDocumentTypeEnsured = true;
}

export async function ensureWelfareColumns(): Promise<void> {
  if (welfareColumnsEnsured) return;

  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS is_welfare_member BOOLEAN DEFAULT false`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS welfare_payment_mode VARCHAR(20)`;
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS welfare_joined_date DATE`;

  await sql`
    ALTER TABLE member_memberships DROP CONSTRAINT IF EXISTS member_memberships_fee_type_check
  `;
  await sql`
    ALTER TABLE member_memberships ADD CONSTRAINT member_memberships_fee_type_check
    CHECK (fee_type IN ('annual_membership', 'lifetime_membership', 'welfare_contribution'))
  `;
  await sql`
    ALTER TABLE member_memberships DROP CONSTRAINT IF EXISTS member_memberships_plan_check
  `;
  await sql`
    ALTER TABLE member_memberships ADD CONSTRAINT member_memberships_plan_check
    CHECK (plan IN ('annual', 'lifetime', 'welfare'))
  `;

  welfareColumnsEnsured = true;
}

export async function ensureWhatsAppGroupColumn(): Promise<void> {
  if (whatsappGroupColumnEnsured) return;

  await sql`
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS added_to_whatsapp_group BOOLEAN DEFAULT false
  `;
  await sql`
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS whatsapp_group_added_at TIMESTAMP WITH TIME ZONE
  `;

  whatsappGroupColumnEnsured = true;
}

let accountsTablesEnsured = false;

export async function ensureAccountsTables(): Promise<void> {
  if (accountsTablesEnsured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS expense_entries (
      id SERIAL PRIMARY KEY,
      entry_year INTEGER NOT NULL,
      entry_date DATE NOT NULL,
      category VARCHAR(100) NOT NULL,
      description TEXT,
      amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
      currency VARCHAR(10) DEFAULT 'AED',
      payment_method VARCHAR(50),
      reference VARCHAR(100),
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS petty_cash_entries (
      id SERIAL PRIMARY KEY,
      entry_year INTEGER NOT NULL,
      entry_date DATE NOT NULL,
      entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('income', 'expense')),
      category VARCHAR(100),
      description TEXT,
      amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
      currency VARCHAR(10) DEFAULT 'AED',
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_expense_entries_year ON expense_entries(entry_year)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_expense_entries_date ON expense_entries(entry_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_petty_cash_entries_year ON petty_cash_entries(entry_year)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_petty_cash_entries_date ON petty_cash_entries(entry_date)`;

  accountsTablesEnsured = true;
}
