// Database schema definitions
export const schema = `
-- Users table (Super Admin, Admin, Executive)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'president', 'secretary', 'central_committee', 'executive', 'member')),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Members table
CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  member_id VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  full_name_arabic VARCHAR(255),
  gender VARCHAR(20),
  blood_group VARCHAR(10),
  marital_status VARCHAR(20),
  email VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  whatsapp_number VARCHAR(20),
  date_of_birth DATE,
  nationality VARCHAR(100),
  nominee VARCHAR(255),
  ward_no INTEGER CHECK (ward_no IS NULL OR (ward_no >= 1 AND ward_no <= 16)),
  emirates_id VARCHAR(50),
  passport_number VARCHAR(50),
  visa_status VARCHAR(50),
  profession VARCHAR(255),
  company_name VARCHAR(255),
  work_location VARCHAR(255),
  address TEXT,
  uae_building VARCHAR(255),
  uae_area VARCHAR(255),
  uae_city VARCHAR(255),
  emergency_contact VARCHAR(255),
  home_country_address TEXT,
  home_state VARCHAR(100),
  home_district VARCHAR(100),
  home_local_body VARCHAR(255),
  home_local_area_ward VARCHAR(255),
  home_country_contact_number VARCHAR(20),
  spouse_name VARCHAR(255),
  children_count INTEGER,
  children_details TEXT,
  family_residing_with BOOLEAN,
  joined_date DATE DEFAULT CURRENT_DATE,
  membership_type VARCHAR(50) DEFAULT 'standard',
  membership_plan VARCHAR(20) DEFAULT 'annual',
  membership_payment_status VARCHAR(20) DEFAULT 'unpaid',
  membership_start_date DATE NOT NULL,
  membership_end_date DATE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'pending', 'suspended', 'expired')),
  assigned_executive_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_executive_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Membership tracking table (yearly/lifetime cycles and payment state)
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
);

-- Committees table
CREATE TABLE IF NOT EXISTS committees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) UNIQUE NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Committee member assignments
CREATE TABLE IF NOT EXISTS committee_members (
  id SERIAL PRIMARY KEY,
  committee_id INTEGER NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(committee_id, member_id)
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('emirates_id', 'passport', 'photo', 'other')),
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  expiry_date DATE,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp logs table
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  fee_id INTEGER REFERENCES member_memberships(id) ON DELETE SET NULL,
  message_type VARCHAR(50) NOT NULL,
  message_content TEXT,
  external_message_id VARCHAR(255),
  delivery_status VARCHAR(50) DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'read', 'failed')),
  sent_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- App-level flags (e.g. one-time DB dump import)
CREATE TABLE IF NOT EXISTS app_meta (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_assigned_executive ON members(assigned_executive_id);
CREATE INDEX IF NOT EXISTS idx_members_assigned_executive_member ON members(assigned_executive_member_id);
CREATE INDEX IF NOT EXISTS idx_members_member_id ON members(member_id);
CREATE INDEX IF NOT EXISTS idx_member_memberships_member_id ON member_memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_member_memberships_fee_year ON member_memberships(fee_year);
CREATE INDEX IF NOT EXISTS idx_member_memberships_payment_status ON member_memberships(payment_status);
CREATE INDEX IF NOT EXISTS idx_committees_status ON committees(status);
CREATE INDEX IF NOT EXISTS idx_committee_members_committee ON committee_members(committee_id);
CREATE INDEX IF NOT EXISTS idx_committee_members_member ON committee_members(member_id);
CREATE INDEX IF NOT EXISTS idx_documents_member_id ON documents(member_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_member_id ON whatsapp_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Alter statements for existing installations
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE members ADD COLUMN IF NOT EXISTS full_name_arabic VARCHAR(255);
ALTER TABLE members ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE members ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10);
ALTER TABLE members ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20);
ALTER TABLE members ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(255);
ALTER TABLE members ADD COLUMN IF NOT EXISTS visa_status VARCHAR(50);
ALTER TABLE members ADD COLUMN IF NOT EXISTS profession VARCHAR(255);
ALTER TABLE members ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
ALTER TABLE members ADD COLUMN IF NOT EXISTS work_location VARCHAR(255);
ALTER TABLE members ADD COLUMN IF NOT EXISTS uae_building VARCHAR(255);
ALTER TABLE members ADD COLUMN IF NOT EXISTS uae_area VARCHAR(255);
ALTER TABLE members ADD COLUMN IF NOT EXISTS uae_city VARCHAR(255);
ALTER TABLE members ADD COLUMN IF NOT EXISTS home_country_address TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS home_state VARCHAR(100);
ALTER TABLE members ADD COLUMN IF NOT EXISTS home_district VARCHAR(100);
ALTER TABLE members ADD COLUMN IF NOT EXISTS home_local_body VARCHAR(255);
ALTER TABLE members ADD COLUMN IF NOT EXISTS home_local_area_ward VARCHAR(255);
ALTER TABLE members ADD COLUMN IF NOT EXISTS home_country_contact_number VARCHAR(20);
ALTER TABLE members ADD COLUMN IF NOT EXISTS spouse_name VARCHAR(255);
ALTER TABLE members ADD COLUMN IF NOT EXISTS children_count INTEGER;
ALTER TABLE members ADD COLUMN IF NOT EXISTS children_details TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS family_residing_with BOOLEAN;
ALTER TABLE members ADD COLUMN IF NOT EXISTS nominee VARCHAR(255);
ALTER TABLE members ADD COLUMN IF NOT EXISTS ward_no INTEGER;
ALTER TABLE members ADD COLUMN IF NOT EXISTS joined_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS membership_plan VARCHAR(20) DEFAULT 'annual';
ALTER TABLE members ADD COLUMN IF NOT EXISTS membership_payment_status VARCHAR(20) DEFAULT 'unpaid';
ALTER TABLE members ADD COLUMN IF NOT EXISTS assigned_executive_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL;
ALTER TABLE member_memberships ADD COLUMN IF NOT EXISTS fee_type VARCHAR(50);
ALTER TABLE member_memberships ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'AED';
ALTER TABLE member_memberships ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE member_memberships ADD COLUMN IF NOT EXISTS partial_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE member_memberships ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE member_memberships ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(100);
ALTER TABLE member_memberships ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE member_memberships ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS external_message_id VARCHAR(255);
ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(50) DEFAULT 'sent';
`;
