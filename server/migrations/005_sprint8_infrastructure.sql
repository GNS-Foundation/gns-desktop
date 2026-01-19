-- ===========================================
-- GNS NODE - SPRINT 8 MIGRATION
-- Multi-Currency, Webhooks, Payment Links, Invoices, QR Codes
-- 
-- File: migrations/005_sprint8_infrastructure.sql
-- Run: Supabase Dashboard → SQL Editor → Paste & Run
-- ===========================================

-- ===========================================
-- ASSET REGISTRY
-- ===========================================

-- Supported Stellar assets
CREATE TABLE IF NOT EXISTS gns_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id VARCHAR(100) UNIQUE NOT NULL,  -- CODE:ISSUER or just CODE for native
  
  code VARCHAR(12) NOT NULL,
  issuer VARCHAR(56),  -- NULL for native XLM
  
  -- Metadata
  type VARCHAR(20) NOT NULL DEFAULT 'token',  -- native, stablecoin, token, anchor
  name VARCHAR(100) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  decimals INTEGER DEFAULT 7,
  
  -- Display
  icon_url TEXT,
  
  -- Verification
  is_verified BOOLEAN DEFAULT false,
  anchor_domain VARCHAR(100),
  description TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User currency preferences
CREATE TABLE IF NOT EXISTS gns_currency_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_pk VARCHAR(128) UNIQUE NOT NULL,
  
  default_currency VARCHAR(12) DEFAULT 'USDC',
  display_currency VARCHAR(12) DEFAULT 'USD',
  favorite_assets TEXT[] DEFAULT ARRAY['USDC', 'XLM', 'GNS'],
  
  show_small_balances BOOLEAN DEFAULT true,
  small_balance_threshold DECIMAL(20, 7) DEFAULT 0.01,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exchange rates cache
CREATE TABLE IF NOT EXISTS gns_exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  from_asset VARCHAR(12) NOT NULL,
  to_asset VARCHAR(12) NOT NULL,
  rate DECIMAL(30, 15) NOT NULL,
  
  source VARCHAR(50),  -- coingecko, stellar_dex, etc.
  
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(from_asset, to_asset)
);

-- ===========================================
-- WEBHOOKS
-- ===========================================

-- Webhook endpoints
CREATE TABLE IF NOT EXISTS gns_webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id VARCHAR(20) UNIQUE NOT NULL,
  
  merchant_id VARCHAR(50) NOT NULL REFERENCES gns_merchants(merchant_id),
  
  url TEXT NOT NULL,
  description TEXT,
  
  -- Events to subscribe to
  events TEXT[] NOT NULL,
  
  -- Authentication
  secret VARCHAR(100) NOT NULL,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Stats
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  last_delivery_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook events
CREATE TABLE IF NOT EXISTS gns_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(20) UNIQUE NOT NULL,
  
  merchant_id VARCHAR(50) NOT NULL,
  
  type VARCHAR(50) NOT NULL,  -- paymentReceived, refundApproved, etc.
  data JSONB NOT NULL,
  
  related_id VARCHAR(50),  -- payment_id, subscription_id, etc.
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook delivery attempts
CREATE TABLE IF NOT EXISTS gns_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id VARCHAR(20) UNIQUE NOT NULL,
  
  endpoint_id VARCHAR(20) NOT NULL REFERENCES gns_webhook_endpoints(endpoint_id),
  event_id VARCHAR(20) NOT NULL REFERENCES gns_webhook_events(event_id),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, delivered, failed, retrying
  
  -- Response
  http_status INTEGER,
  response_body TEXT,
  duration_ms INTEGER,
  error_message TEXT,
  
  -- Retry tracking
  attempt_number INTEGER DEFAULT 1,
  next_retry_at TIMESTAMPTZ,
  
  -- Timestamps
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for webhooks
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_merchant ON gns_webhook_endpoints(merchant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_merchant ON gns_webhook_events(merchant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON gns_webhook_events(type);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON gns_webhook_deliveries(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON gns_webhook_deliveries(status);

-- ===========================================
-- PAYMENT LINKS
-- ===========================================

-- Payment links
CREATE TABLE IF NOT EXISTS gns_payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id VARCHAR(20) UNIQUE NOT NULL,
  short_code VARCHAR(20) UNIQUE NOT NULL,
  
  merchant_id VARCHAR(50) NOT NULL REFERENCES gns_merchants(merchant_id),
  merchant_name VARCHAR(100),
  
  -- Type
  type VARCHAR(20) NOT NULL DEFAULT 'oneTime',  -- oneTime, reusable, subscription
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, inactive, expired, completed
  
  -- Amount configuration
  fixed_amount DECIMAL(20, 7),
  min_amount DECIMAL(20, 7),
  max_amount DECIMAL(20, 7),
  currency VARCHAR(12) NOT NULL DEFAULT 'USDC',
  allow_custom_amount BOOLEAN DEFAULT false,
  
  -- Display
  title VARCHAR(200),
  description TEXT,
  image_url TEXT,
  success_message TEXT,
  redirect_url TEXT,
  
  -- Settings
  expires_at TIMESTAMPTZ,
  max_payments INTEGER,
  collect_email BOOLEAN DEFAULT false,
  collect_phone BOOLEAN DEFAULT false,
  collect_address BOOLEAN DEFAULT false,
  
  metadata JSONB,
  
  -- Stats
  view_count INTEGER DEFAULT 0,
  payment_count INTEGER DEFAULT 0,
  total_collected DECIMAL(20, 7) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_payment_at TIMESTAMPTZ
);

-- Link payments
CREATE TABLE IF NOT EXISTS gns_link_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id VARCHAR(20) UNIQUE NOT NULL,
  
  link_id VARCHAR(20) NOT NULL REFERENCES gns_payment_links(link_id),
  
  payer_public_key VARCHAR(128) NOT NULL,
  payer_handle VARCHAR(50),
  
  amount DECIMAL(20, 7) NOT NULL,
  currency VARCHAR(12) NOT NULL,
  
  payer_email VARCHAR(255),
  payer_phone VARCHAR(50),
  
  stellar_tx_hash VARCHAR(128),
  
  paid_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for payment links
CREATE INDEX IF NOT EXISTS idx_payment_links_merchant ON gns_payment_links(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_code ON gns_payment_links(short_code);
CREATE INDEX IF NOT EXISTS idx_payment_links_status ON gns_payment_links(status);
CREATE INDEX IF NOT EXISTS idx_link_payments_link ON gns_link_payments(link_id);

-- ===========================================
-- INVOICES
-- ===========================================

-- Invoices
CREATE TABLE IF NOT EXISTS gns_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id VARCHAR(20) UNIQUE NOT NULL,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  
  merchant_id VARCHAR(50) NOT NULL REFERENCES gns_merchants(merchant_id),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft, sent, viewed, paid, overdue, cancelled
  
  -- Customer
  customer_public_key VARCHAR(128),
  customer_handle VARCHAR(50),
  customer_name VARCHAR(200),
  customer_email VARCHAR(255),
  customer_address TEXT,
  
  -- Merchant info (cached)
  merchant_name VARCHAR(200) NOT NULL,
  merchant_email VARCHAR(255),
  merchant_address TEXT,
  merchant_logo TEXT,
  
  -- Line items (stored as JSONB)
  line_items JSONB NOT NULL,
  
  -- Amounts
  subtotal DECIMAL(20, 7) NOT NULL,
  total_discount DECIMAL(20, 7) DEFAULT 0,
  total_tax DECIMAL(20, 7) DEFAULT 0,
  total DECIMAL(20, 7) NOT NULL,
  currency VARCHAR(12) NOT NULL DEFAULT 'USDC',
  
  -- Dates
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  
  -- Payment
  payment_link_id VARCHAR(20),
  payment_id VARCHAR(50),
  stellar_tx_hash VARCHAR(128),
  
  -- Customization
  notes TEXT,
  terms TEXT,
  footer TEXT,
  template_id VARCHAR(20),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice templates
CREATE TABLE IF NOT EXISTS gns_invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id VARCHAR(20) UNIQUE NOT NULL,
  
  merchant_id VARCHAR(50) NOT NULL REFERENCES gns_merchants(merchant_id),
  
  name VARCHAR(100) NOT NULL,
  logo_url TEXT,
  primary_color VARCHAR(10) DEFAULT '#4F46E5',
  header_text TEXT,
  footer_text TEXT,
  terms TEXT,
  
  is_default BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for invoices
CREATE INDEX IF NOT EXISTS idx_invoices_merchant ON gns_invoices(merchant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON gns_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON gns_invoices(customer_public_key);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON gns_invoices(due_date);

-- ===========================================
-- QR CODES
-- ===========================================

-- QR codes
CREATE TABLE IF NOT EXISTS gns_qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_id VARCHAR(20) UNIQUE NOT NULL,
  
  -- Owner (user or merchant)
  user_pk VARCHAR(128),
  merchant_id VARCHAR(50),
  
  -- Type
  type VARCHAR(30) NOT NULL DEFAULT 'dynamicPayment',  -- staticMerchant, dynamicPayment, paymentLink, p2pRequest, invoice
  
  -- QR data
  data TEXT NOT NULL,  -- The actual QR content
  
  -- Optional details
  recipient_pk VARCHAR(128),
  recipient_handle VARCHAR(50),
  amount DECIMAL(20, 7),
  currency VARCHAR(12),
  memo TEXT,
  reference VARCHAR(100),
  
  -- Settings
  expires_at TIMESTAMPTZ,
  single_use INTEGER,  -- Max uses
  use_count INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Indexes for QR codes
CREATE INDEX IF NOT EXISTS idx_qr_user ON gns_qr_codes(user_pk);
CREATE INDEX IF NOT EXISTS idx_qr_merchant ON gns_qr_codes(merchant_id);
CREATE INDEX IF NOT EXISTS idx_qr_active ON gns_qr_codes(is_active);

-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Generate endpoint ID
CREATE OR REPLACE FUNCTION generate_endpoint_id() RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN 'WH-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

-- Generate event ID
CREATE OR REPLACE FUNCTION generate_event_id() RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN 'EVT-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

-- Generate delivery ID
CREATE OR REPLACE FUNCTION generate_delivery_id() RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN 'DLV-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

-- Generate link ID
CREATE OR REPLACE FUNCTION generate_link_id() RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN 'LNK-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

-- Generate link payment ID
CREATE OR REPLACE FUNCTION generate_link_payment_id() RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN 'LPAY-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

-- Generate invoice ID
CREATE OR REPLACE FUNCTION generate_invoice_id() RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN 'INV-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

-- Generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number(p_merchant_id VARCHAR(50)) RETURNS VARCHAR(50) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM gns_invoices
  WHERE merchant_id = p_merchant_id;
  
  RETURN 'INV-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Generate QR ID
CREATE OR REPLACE FUNCTION generate_qr_id() RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN 'QR-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

-- Generate template ID
CREATE OR REPLACE FUNCTION generate_template_id() RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN 'TPL-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

-- Enable RLS
ALTER TABLE gns_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_currency_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_link_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_invoice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_qr_codes ENABLE ROW LEVEL SECURITY;

-- Service role policies
CREATE POLICY "Service full access to assets" ON gns_assets 
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service full access to currency_preferences" ON gns_currency_preferences 
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service full access to exchange_rates" ON gns_exchange_rates 
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service full access to webhook_endpoints" ON gns_webhook_endpoints 
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service full access to webhook_events" ON gns_webhook_events 
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service full access to webhook_deliveries" ON gns_webhook_deliveries 
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service full access to payment_links" ON gns_payment_links 
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service full access to link_payments" ON gns_link_payments 
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service full access to invoices" ON gns_invoices 
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service full access to invoice_templates" ON gns_invoice_templates 
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service full access to qr_codes" ON gns_qr_codes 
  FOR ALL USING (auth.role() = 'service_role');

-- Public read for assets and rates
CREATE POLICY "Public read assets" ON gns_assets 
  FOR SELECT USING (is_active = true);
CREATE POLICY "Public read exchange_rates" ON gns_exchange_rates 
  FOR SELECT USING (true);

-- ===========================================
-- SEED DATA: SUPPORTED ASSETS
-- ===========================================

INSERT INTO gns_assets (asset_id, code, issuer, type, name, symbol, decimals, is_verified, description)
VALUES 
  ('XLM', 'XLM', NULL, 'native', 'Stellar Lumens', '✨', 7, true, 'Native Stellar network asset'),
  ('USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', 'USDC', 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', 'stablecoin', 'USD Coin', '$', 7, true, 'Circle USD stablecoin on Stellar'),
  ('EURC:GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2', 'EURC', 'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2', 'stablecoin', 'Euro Coin', '€', 7, true, 'Circle Euro stablecoin on Stellar'),
  ('GNS:GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA', 'GNS', 'GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA', 'token', 'GNS Token', '🌐', 7, true, 'GNS Protocol utility token')
ON CONFLICT (asset_id) DO NOTHING;

-- Seed exchange rates (example values)
INSERT INTO gns_exchange_rates (from_asset, to_asset, rate, source)
VALUES 
  ('XLM', 'USD', 0.12, 'seed'),
  ('USDC', 'USD', 1.0, 'seed'),
  ('EURC', 'USD', 1.08, 'seed'),
  ('GNS', 'USD', 0.05, 'seed'),
  ('USD', 'XLM', 8.33, 'seed'),
  ('USD', 'USDC', 1.0, 'seed'),
  ('USD', 'EURC', 0.93, 'seed'),
  ('USD', 'GNS', 20.0, 'seed')
ON CONFLICT (from_asset, to_asset) DO UPDATE SET rate = EXCLUDED.rate, timestamp = NOW();

-- ===========================================
-- DONE
-- ===========================================

DO $$
BEGIN
  RAISE NOTICE '✅ Sprint 8 migration complete!';
  RAISE NOTICE '   Tables: gns_assets, gns_currency_preferences, gns_exchange_rates';
  RAISE NOTICE '   Tables: gns_webhook_endpoints, gns_webhook_events, gns_webhook_deliveries';
  RAISE NOTICE '   Tables: gns_payment_links, gns_link_payments';
  RAISE NOTICE '   Tables: gns_invoices, gns_invoice_templates';
  RAISE NOTICE '   Tables: gns_qr_codes';
  RAISE NOTICE '   Functions: generate_*_id(), generate_invoice_number()';
  RAISE NOTICE '   Seed data: 4 assets, 8 exchange rates';
END $$;
