-- Prisma baseline migration for Membership Management Portal.
-- Use app/api/setup for idempotent setup in runtime environments.

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

CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  member_id VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  full_name_arabic VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  whatsapp_number VARCHAR(20),
  date_of_birth DATE,
  nationality VARCHAR(100),
  emirates_id VARCHAR(50),
  passport_number VARCHAR(50),
  address TEXT,
  emergency_contact VARCHAR(255),
  joined_date DATE DEFAULT CURRENT_DATE,
  membership_type VARCHAR(50) DEFAULT 'standard',
  membership_start_date DATE NOT NULL,
  membership_end_date DATE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'pending', 'suspended', 'expired')),
  assigned_executive_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS fees (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  fee_type VARCHAR(100) NOT NULL,
  fee_year VARCHAR(20),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'AED',
  due_date DATE NOT NULL,
  paid_date DATE,
  payment_status VARCHAR(50) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'overdue', 'cancelled')),
  partial_amount DECIMAL(10, 2) DEFAULT 0,
  payment_method VARCHAR(50),
  transaction_reference VARCHAR(100),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  fee_id INTEGER REFERENCES fees(id) ON DELETE SET NULL,
  message_type VARCHAR(50) NOT NULL,
  message_content TEXT,
  external_message_id VARCHAR(255),
  delivery_status VARCHAR(50) DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'read', 'failed')),
  sent_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
