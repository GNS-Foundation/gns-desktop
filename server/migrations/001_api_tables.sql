-- ===========================================
-- GNS API DATABASE MIGRATIONS (FIXED)
-- Run these in Supabase SQL Editor
-- ===========================================
-- 
-- This migration adds tables for:
-- 1. OAuth 2.0 clients
-- 2. OAuth sessions
-- 3. Webhook subscriptions
-- 4. Webhook deliveries
-- 5. Payment requests
-- 6. Verification challenges
-- 7. gSites storage
--
-- NOTE: Foreign key constraints removed for compatibility
-- ===========================================

-- ===========================================
-- OAUTH CLIENTS
-- ===========================================

CREATE TABLE IF NOT EXISTS oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT UNIQUE NOT NULL,
  client_secret TEXT, -- Hashed, only for confidential clients
  name TEXT NOT NULL,
  redirect_uris TEXT[] NOT NULL,
  logo_uri TEXT,
  tos_uri TEXT,
  policy_uri TEXT,
  confidential BOOLEAN DEFAULT FALSE,
  owner_pk TEXT NOT NULL, -- Public key of the owner
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_clients_owner ON oauth_clients(owner_pk);

-- ===========================================
-- OAUTH SESSIONS (for QR-based auth)
-- ===========================================

CREATE TABLE IF NOT EXISTS oauth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'openid identity:read',
  state TEXT,
  code_challenge TEXT,
  code_challenge_method TEXT,
  nonce TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  public_key TEXT, -- Set when approved
  handle TEXT,     -- Set when approved
  authorization_code TEXT, -- Generated on approval
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_sessions_session_id ON oauth_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_status ON oauth_sessions(status) WHERE status = 'pending';

-- ===========================================
-- WEBHOOK SUBSCRIPTIONS
-- ===========================================

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_pk TEXT NOT NULL, -- Public key of the owner
  target_url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  for_handle TEXT, -- Optional: scope to specific handle
  secret_hash TEXT NOT NULL, -- SHA256 hash of the secret
  active BOOLEAN DEFAULT TRUE,
  failure_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_owner ON webhook_subscriptions(owner_pk);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhook_subscriptions(active) WHERE active = TRUE;

-- ===========================================
-- WEBHOOK DELIVERIES (for delivery history)
-- ===========================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  attempt_count INTEGER DEFAULT 1,
  response_code INTEGER,
  response_time_ms INTEGER,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_subscription ON webhook_deliveries(subscription_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON webhook_deliveries(created_at);

-- Cleanup old deliveries (keep last 100 per subscription)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_deliveries() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM webhook_deliveries
  WHERE subscription_id = NEW.subscription_id
    AND id NOT IN (
      SELECT id FROM webhook_deliveries
      WHERE subscription_id = NEW.subscription_id
      ORDER BY created_at DESC
      LIMIT 100
    );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_webhook_deliveries ON webhook_deliveries;
CREATE TRIGGER trigger_cleanup_webhook_deliveries
  AFTER INSERT ON webhook_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_old_webhook_deliveries();

-- ===========================================
-- PAYMENT REQUESTS
-- ===========================================

CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT UNIQUE NOT NULL,
  creator_pk TEXT NOT NULL, -- Who created the request
  to_pk TEXT NOT NULL,      -- Who receives payment
  to_handle TEXT,           -- Optional handle
  amount TEXT NOT NULL,     -- Decimal string
  currency TEXT NOT NULL DEFAULT 'GNS' CHECK (currency IN ('GNS', 'XLM', 'USDC', 'EUR', 'BTC')),
  memo TEXT,
  reference_id TEXT,        -- Merchant's internal ID
  callback_url TEXT,        -- HTTPS URL for completion callback
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'cancelled', 'failed')),
  stellar_tx_hash TEXT,     -- Set when payment completes
  payer_pk TEXT,            -- Who paid (set on completion)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_payment_id ON payment_requests(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_to_pk ON payment_requests(to_pk);
CREATE INDEX IF NOT EXISTS idx_payment_requests_creator ON payment_requests(creator_pk);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_payment_requests_reference ON payment_requests(reference_id) WHERE reference_id IS NOT NULL;

-- Auto-expire payment requests
CREATE OR REPLACE FUNCTION expire_old_payment_requests() RETURNS TRIGGER AS $$
BEGIN
  UPDATE payment_requests 
  SET status = 'expired' 
  WHERE status = 'pending' AND expires_at < NOW();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- VERIFICATION CHALLENGES
-- ===========================================

CREATE TABLE IF NOT EXISTS verification_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  challenge TEXT NOT NULL, -- The challenge string to sign
  require_fresh_breadcrumb BOOLEAN DEFAULT FALSE,
  allowed_h3_cells TEXT[], -- Optional geofencing
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verification_challenges_id ON verification_challenges(challenge_id);
CREATE INDEX IF NOT EXISTS idx_verification_challenges_pk ON verification_challenges(public_key);

-- ===========================================
-- GSITES (Identity Profile Pages)
-- ===========================================

CREATE TABLE IF NOT EXISTS gsites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pk_root TEXT UNIQUE NOT NULL,
  handle TEXT,
  gsite_json JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  signature TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gsites_pk ON gsites(pk_root);
CREATE INDEX IF NOT EXISTS idx_gsites_handle ON gsites(handle) WHERE handle IS NOT NULL;

-- ===========================================
-- PERIODIC CLEANUP FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION gns_periodic_cleanup() RETURNS void AS $$
BEGIN
  -- Expire old OAuth sessions
  UPDATE oauth_sessions 
  SET status = 'expired' 
  WHERE status = 'pending' AND expires_at < NOW();
  
  -- Expire old payment requests
  UPDATE payment_requests 
  SET status = 'expired' 
  WHERE status = 'pending' AND expires_at < NOW();
  
  -- Expire old verification challenges
  UPDATE verification_challenges 
  SET status = 'expired' 
  WHERE status = 'pending' AND expires_at < NOW();
  
  -- Delete very old expired challenges (older than 1 hour)
  DELETE FROM verification_challenges 
  WHERE status = 'expired' AND expires_at < NOW() - INTERVAL '1 hour';
  
  -- Delete old webhook deliveries (older than 30 days)
  DELETE FROM webhook_deliveries 
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- ROW LEVEL SECURITY (RLS)
-- ===========================================

-- Enable RLS on all tables
ALTER TABLE oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE gsites ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for backend)
CREATE POLICY "Service role full access" ON oauth_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON oauth_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON webhook_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON webhook_deliveries FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON payment_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON verification_challenges FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON gsites FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===========================================
-- HELPER FUNCTIONS
-- ===========================================

-- Get OAuth client by client_id
CREATE OR REPLACE FUNCTION get_oauth_client(p_client_id TEXT)
RETURNS TABLE(
  client_id TEXT,
  client_secret TEXT,
  name TEXT,
  redirect_uris TEXT[],
  confidential BOOLEAN,
  owner_pk TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oc.client_id,
    oc.client_secret,
    oc.name,
    oc.redirect_uris,
    oc.confidential,
    oc.owner_pk
  FROM oauth_clients oc
  WHERE oc.client_id = p_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get webhook subscriptions for an event
CREATE OR REPLACE FUNCTION get_webhook_subscriptions_for_event(
  p_owner_pk TEXT,
  p_event_type TEXT
)
RETURNS TABLE(
  id UUID,
  target_url TEXT,
  events TEXT[],
  secret_hash TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ws.id,
    ws.target_url,
    ws.events,
    ws.secret_hash
  FROM webhook_subscriptions ws
  WHERE ws.owner_pk = p_owner_pk
    AND ws.active = TRUE
    AND p_event_type = ANY(ws.events);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- GRANT PERMISSIONS
-- ===========================================

GRANT ALL ON oauth_clients TO service_role;
GRANT ALL ON oauth_sessions TO service_role;
GRANT ALL ON webhook_subscriptions TO service_role;
GRANT ALL ON webhook_deliveries TO service_role;
GRANT ALL ON payment_requests TO service_role;
GRANT ALL ON verification_challenges TO service_role;
GRANT ALL ON gsites TO service_role;

-- ===========================================
-- DONE!
-- ===========================================
-- 
-- To run periodic cleanup, call:
-- SELECT gns_periodic_cleanup();
--
-- Or set up pg_cron to run every 5 minutes:
-- SELECT cron.schedule('gns-cleanup', '*/5 * * * *', 'SELECT gns_periodic_cleanup()');
-- ===========================================
