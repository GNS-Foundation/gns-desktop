-- ===========================================
-- GNS MERCHANT SETTLEMENT - DATABASE SCHEMA
-- Sprint 5: Merchant Settlement Loop
-- ===========================================
-- 
-- Run this migration to set up merchant payment tables:
--   psql -f sprint5_merchant_migration.sql
-- 
-- Tables:
--   - gns_merchants: Registered merchants
--   - gns_settlements: Payment settlements
--   - gns_receipts: Digital receipts
--   - gns_payment_completions: Client-reported completions
-- ===========================================

-- ===========================================
-- MERCHANTS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS gns_merchants (
  merchant_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT,
  stellar_address TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'terminated')),
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  website TEXT,
  address TEXT,
  h3_cell TEXT,  -- H3 hexagonal cell for location
  accepted_currencies TEXT[] DEFAULT ARRAY['GNS', 'USDC', 'EURC'],
  settlement_currency TEXT DEFAULT 'USDC',
  instant_settlement BOOLEAN DEFAULT true,
  fee_percent DECIMAL(5,4) DEFAULT 0.0010,  -- 0.1% default fee
  api_key_hash TEXT NOT NULL,  -- SHA256 hash of API key
  signing_public_key TEXT,  -- Ed25519 public key for terminal signing
  logo_url TEXT,
  metadata JSONB DEFAULT '{}',
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for merchants
CREATE INDEX IF NOT EXISTS idx_merchants_email ON gns_merchants(email);
CREATE INDEX IF NOT EXISTS idx_merchants_status ON gns_merchants(status);
CREATE INDEX IF NOT EXISTS idx_merchants_category ON gns_merchants(category);
CREATE INDEX IF NOT EXISTS idx_merchants_h3_cell ON gns_merchants(h3_cell);
CREATE INDEX IF NOT EXISTS idx_merchants_api_key_hash ON gns_merchants(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_merchants_stellar_address ON gns_merchants(stellar_address);

-- Updated_at trigger for merchants
CREATE OR REPLACE FUNCTION update_merchant_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_merchant_timestamp ON gns_merchants;
CREATE TRIGGER trigger_update_merchant_timestamp
  BEFORE UPDATE ON gns_merchants
  FOR EACH ROW
  EXECUTE FUNCTION update_merchant_timestamp();

-- ===========================================
-- SETTLEMENTS TABLE
-- Records all payment settlements
-- ===========================================

CREATE TABLE IF NOT EXISTS gns_settlements (
  settlement_id TEXT PRIMARY KEY,
  request_id TEXT UNIQUE NOT NULL,  -- From NFC payment request
  merchant_id TEXT NOT NULL REFERENCES gns_merchants(merchant_id),
  user_pk TEXT NOT NULL,  -- GNS public key of payer
  from_stellar_address TEXT NOT NULL,
  to_stellar_address TEXT NOT NULL,
  amount TEXT NOT NULL,  -- Store as string to preserve precision
  asset_code TEXT NOT NULL,  -- GNS, USDC, EURC, XLM
  memo TEXT,
  order_id TEXT,
  h3_cell TEXT,  -- User's H3 cell at time of payment
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  stellar_tx_hash TEXT,  -- Stellar transaction hash
  error_message TEXT,
  fee_amount TEXT,  -- Calculated fee
  fee_percent DECIMAL(5,4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for settlements
CREATE INDEX IF NOT EXISTS idx_settlements_merchant ON gns_settlements(merchant_id);
CREATE INDEX IF NOT EXISTS idx_settlements_user ON gns_settlements(user_pk);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON gns_settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlements_request ON gns_settlements(request_id);
CREATE INDEX IF NOT EXISTS idx_settlements_tx_hash ON gns_settlements(stellar_tx_hash);
CREATE INDEX IF NOT EXISTS idx_settlements_created ON gns_settlements(created_at);
CREATE INDEX IF NOT EXISTS idx_settlements_asset ON gns_settlements(asset_code);

-- Updated_at trigger for settlements
DROP TRIGGER IF EXISTS trigger_update_settlement_timestamp ON gns_settlements;
CREATE TRIGGER trigger_update_settlement_timestamp
  BEFORE UPDATE ON gns_settlements
  FOR EACH ROW
  EXECUTE FUNCTION update_merchant_timestamp();

-- ===========================================
-- RECEIPTS TABLE
-- Digital receipt storage
-- ===========================================

CREATE TABLE IF NOT EXISTS gns_receipts (
  id SERIAL PRIMARY KEY,
  receipt_id TEXT UNIQUE NOT NULL,
  transaction_hash TEXT NOT NULL,
  settlement_id TEXT REFERENCES gns_settlements(settlement_id),
  merchant_id TEXT REFERENCES gns_merchants(merchant_id),
  merchant_name TEXT,
  user_pk TEXT NOT NULL,
  user_handle TEXT,
  amount TEXT NOT NULL,
  currency TEXT NOT NULL,
  order_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
  refund_tx_hash TEXT,
  refunded_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for receipts
CREATE INDEX IF NOT EXISTS idx_receipts_user ON gns_receipts(user_pk);
CREATE INDEX IF NOT EXISTS idx_receipts_merchant ON gns_receipts(merchant_id);
CREATE INDEX IF NOT EXISTS idx_receipts_tx_hash ON gns_receipts(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_receipts_timestamp ON gns_receipts(timestamp);
CREATE INDEX IF NOT EXISTS idx_receipts_settlement ON gns_receipts(settlement_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON gns_receipts(status);

-- Updated_at trigger for receipts
DROP TRIGGER IF EXISTS trigger_update_receipt_timestamp ON gns_receipts;
CREATE TRIGGER trigger_update_receipt_timestamp
  BEFORE UPDATE ON gns_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_merchant_timestamp();

-- ===========================================
-- PAYMENT COMPLETIONS TABLE
-- Client-reported payment completions
-- ===========================================

CREATE TABLE IF NOT EXISTS gns_payment_completions (
  id SERIAL PRIMARY KEY,
  request_id TEXT,
  merchant_id TEXT REFERENCES gns_merchants(merchant_id),
  user_pk TEXT NOT NULL,
  transaction_hash TEXT,
  amount TEXT,
  currency TEXT,
  order_id TEXT,
  h3_cell TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for payment completions
CREATE INDEX IF NOT EXISTS idx_completions_merchant ON gns_payment_completions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_completions_user ON gns_payment_completions(user_pk);
CREATE INDEX IF NOT EXISTS idx_completions_request ON gns_payment_completions(request_id);
CREATE INDEX IF NOT EXISTS idx_completions_tx_hash ON gns_payment_completions(transaction_hash);

-- ===========================================
-- MERCHANT DAILY SUMMARIES VIEW
-- ===========================================

CREATE OR REPLACE VIEW merchant_daily_summaries AS
SELECT 
  merchant_id,
  DATE(completed_at) as settlement_date,
  asset_code,
  COUNT(*) as transaction_count,
  SUM(CAST(amount AS DECIMAL)) as total_amount,
  SUM(CAST(fee_amount AS DECIMAL)) as total_fees,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_count,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
FROM gns_settlements
WHERE completed_at IS NOT NULL
GROUP BY merchant_id, DATE(completed_at), asset_code
ORDER BY settlement_date DESC;

-- ===========================================
-- USER SPENDING SUMMARIES VIEW
-- ===========================================

CREATE OR REPLACE VIEW user_spending_summaries AS
SELECT 
  user_pk,
  DATE_TRUNC('month', timestamp) as month,
  currency,
  COUNT(*) as transaction_count,
  SUM(CAST(amount AS DECIMAL)) as total_spent,
  COUNT(DISTINCT merchant_id) as unique_merchants
FROM gns_receipts
WHERE status = 'confirmed'
GROUP BY user_pk, DATE_TRUNC('month', timestamp), currency
ORDER BY month DESC;

-- ===========================================
-- HELPER FUNCTIONS
-- ===========================================

-- Function to get merchant transaction stats
CREATE OR REPLACE FUNCTION get_merchant_stats(p_merchant_id TEXT)
RETURNS TABLE (
  total_transactions BIGINT,
  total_volume DECIMAL,
  total_fees DECIMAL,
  avg_transaction DECIMAL,
  today_transactions BIGINT,
  today_volume DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_transactions,
    COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total_volume,
    COALESCE(SUM(CAST(fee_amount AS DECIMAL)), 0) as total_fees,
    COALESCE(AVG(CAST(amount AS DECIMAL)), 0) as avg_transaction,
    COUNT(CASE WHEN DATE(completed_at) = CURRENT_DATE THEN 1 END)::BIGINT as today_transactions,
    COALESCE(SUM(CASE WHEN DATE(completed_at) = CURRENT_DATE THEN CAST(amount AS DECIMAL) END), 0) as today_volume
  FROM gns_settlements
  WHERE merchant_id = p_merchant_id
    AND status = 'completed';
END;
$$ LANGUAGE plpgsql;

-- Function to get user receipt stats
CREATE OR REPLACE FUNCTION get_user_receipt_stats(p_user_pk TEXT)
RETURNS TABLE (
  total_receipts BIGINT,
  total_by_currency JSONB,
  top_merchants JSONB,
  avg_transaction DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_receipts,
    jsonb_object_agg(currency, currency_total) as total_by_currency,
    (
      SELECT jsonb_agg(jsonb_build_object('merchant_name', merchant_name, 'count', cnt))
      FROM (
        SELECT merchant_name, COUNT(*) as cnt
        FROM gns_receipts
        WHERE user_pk = p_user_pk AND status = 'confirmed'
        GROUP BY merchant_name
        ORDER BY cnt DESC
        LIMIT 5
      ) top
    ) as top_merchants,
    COALESCE(AVG(CAST(amount AS DECIMAL)), 0) as avg_transaction
  FROM (
    SELECT 
      currency,
      SUM(CAST(amount AS DECIMAL)) as currency_total
    FROM gns_receipts
    WHERE user_pk = p_user_pk AND status = 'confirmed'
    GROUP BY currency
  ) currency_sums;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- ROW LEVEL SECURITY (RLS)
-- ===========================================

-- Enable RLS on receipts (users can only see their own)
ALTER TABLE gns_receipts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own receipts
CREATE POLICY receipts_user_select ON gns_receipts
  FOR SELECT
  USING (true);  -- Would be: USING (user_pk = current_setting('app.user_pk'))

-- Policy: Users can insert their own receipts
CREATE POLICY receipts_user_insert ON gns_receipts
  FOR INSERT
  WITH CHECK (true);  -- Would be: WITH CHECK (user_pk = current_setting('app.user_pk'))

-- ===========================================
-- SAMPLE DATA (for testing)
-- ===========================================

-- Sample merchant (uncomment to use)
/*
INSERT INTO gns_merchants (
  merchant_id,
  name,
  display_name,
  stellar_address,
  category,
  status,
  email,
  accepted_currencies,
  api_key_hash
) VALUES (
  'M001TEST',
  'GNS Test Merchant',
  'Test Cafe',
  'GBVZTFST4PIPV5C3APDIVULNZYZENQSLGDSOKOVQI77GSMT6WVYGF5GL',
  'restaurant',
  'active',
  'test@gnsmerchant.example',
  ARRAY['GNS', 'USDC', 'EURC'],
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'  -- SHA256 of empty string
);
*/

-- ===========================================
-- GRANTS
-- ===========================================

-- Grant permissions to application role
-- GRANT SELECT, INSERT, UPDATE ON gns_merchants TO gns_app;
-- GRANT SELECT, INSERT, UPDATE ON gns_settlements TO gns_app;
-- GRANT SELECT, INSERT, UPDATE ON gns_receipts TO gns_app;
-- GRANT SELECT, INSERT ON gns_payment_completions TO gns_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gns_app;

-- ===========================================
-- MIGRATION NOTES
-- ===========================================

/*
Sprint 5: Merchant Settlement Loop

This migration creates the database schema for:
1. Merchant registration and management
2. Payment settlement tracking
3. Digital receipt storage
4. Payment completion records

Key Features:
- Full merchant lifecycle (pending → active → suspended)
- Instant settlement tracking with Stellar tx hashes
- Receipt generation with QR verification
- Daily summaries for merchant dashboard
- User spending analytics

Fee Structure:
- GNS payments: 0.1% fee
- USDC/EURC payments: 2.5% fee (to cover on/off ramp costs)
- XLM payments: 0.1% fee

Settlement Flow:
1. User taps NFC terminal
2. Terminal generates payment request
3. User approves in GNS app
4. Backend executes Stellar transaction
5. Merchant receives funds instantly
6. Receipt generated and stored

To run:
  psql -d your_database -f sprint5_merchant_migration.sql

For Supabase:
  Use the SQL editor in the Supabase dashboard
*/
