-- ===========================================
-- GNS SPRINT 8 - PAYMENT HUB TABLES (FIXED)
-- Run in Supabase SQL Editor
-- ===========================================

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS gns_link_payments CASCADE;
DROP TABLE IF EXISTS gns_payment_links CASCADE;
DROP TABLE IF EXISTS gns_invoices CASCADE;
DROP TABLE IF EXISTS gns_qr_codes CASCADE;

-- 1. Payment Links table
CREATE TABLE gns_payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(16) UNIQUE NOT NULL,
  owner_pk VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amount DECIMAL(18, 8) NOT NULL,
  currency VARCHAR(8) DEFAULT 'EUR',
  type VARCHAR(16) DEFAULT 'one_time',
  status VARCHAR(16) DEFAULT 'active',
  payment_count INTEGER DEFAULT 0,
  total_received DECIMAL(18, 8) DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Link payments (when someone pays via a link)
CREATE TABLE gns_link_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES gns_payment_links(id) ON DELETE CASCADE,
  payer_pk VARCHAR(64) NOT NULL,
  amount DECIMAL(18, 8) NOT NULL,
  currency VARCHAR(8) NOT NULL,
  transaction_id VARCHAR(128),
  status VARCHAR(16) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Invoices table
CREATE TABLE gns_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(32) UNIQUE NOT NULL,
  owner_pk VARCHAR(64) NOT NULL,
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_handle VARCHAR(64),
  customer_pk VARCHAR(64),
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(18, 8) NOT NULL DEFAULT 0,
  tax DECIMAL(18, 8) DEFAULT 0,
  total DECIMAL(18, 8) NOT NULL DEFAULT 0,
  currency VARCHAR(8) DEFAULT 'EUR',
  status VARCHAR(16) DEFAULT 'draft',
  due_date DATE,
  notes TEXT,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  transaction_id VARCHAR(128),
  payment_method VARCHAR(32),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. QR Codes table
CREATE TABLE gns_qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(24) UNIQUE NOT NULL,
  owner_pk VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  amount DECIMAL(18, 8),
  currency VARCHAR(8) DEFAULT 'EUR',
  type VARCHAR(16) DEFAULT 'fixed',
  qr_data TEXT NOT NULL,
  status VARCHAR(16) DEFAULT 'active',
  scan_count INTEGER DEFAULT 0,
  last_scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create indexes
CREATE INDEX idx_payment_links_owner ON gns_payment_links(owner_pk);
CREATE INDEX idx_payment_links_code ON gns_payment_links(code);
CREATE INDEX idx_invoices_owner ON gns_invoices(owner_pk);
CREATE INDEX idx_qr_codes_owner ON gns_qr_codes(owner_pk);

-- 6. Verify tables created
SELECT 'Tables created:' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('gns_payment_links', 'gns_link_payments', 'gns_invoices', 'gns_qr_codes')
ORDER BY table_name;
