-- ===========================================
-- GNS NODE - SPRINT 6 MIGRATION
-- Refunds, Loyalty, and HCE Support Tables
-- 
-- File: migrations/003_sprint6_advanced_payments.sql
-- Run: Supabase Dashboard → SQL Editor → Paste & Run
-- ===========================================

-- ===========================================
-- REFUNDS TABLES
-- ===========================================

-- Refund requests table
CREATE TABLE IF NOT EXISTS gns_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id VARCHAR(20) UNIQUE NOT NULL,  -- REF-XXXXXXXX
  
  -- Original transaction reference
  settlement_id TEXT REFERENCES gns_settlements(settlement_id),
  original_transaction_hash VARCHAR(128),
  original_receipt_id VARCHAR(50),
  
  -- Parties
  merchant_id VARCHAR(50) NOT NULL REFERENCES gns_merchants(merchant_id),
  user_pk VARCHAR(128) NOT NULL,
  user_stellar_address VARCHAR(56),
  
  -- Amounts
  original_amount DECIMAL(20, 7) NOT NULL,
  refund_amount DECIMAL(20, 7) NOT NULL,
  currency VARCHAR(12) NOT NULL,
  
  -- Reason
  reason VARCHAR(50) NOT NULL,  -- customer_request, duplicate_payment, etc.
  reason_details TEXT,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, approved, processing, completed, rejected, failed, cancelled
  
  -- Refund execution
  refund_transaction_hash VARCHAR(128),
  
  -- Processing info
  processed_at TIMESTAMPTZ,
  processed_by VARCHAR(50),  -- merchant_id or admin
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for refunds
CREATE INDEX IF NOT EXISTS idx_refunds_merchant ON gns_refunds(merchant_id);
CREATE INDEX IF NOT EXISTS idx_refunds_user ON gns_refunds(user_pk);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON gns_refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_settlement ON gns_refunds(settlement_id);
CREATE INDEX IF NOT EXISTS idx_refunds_created ON gns_refunds(created_at DESC);

-- ===========================================
-- LOYALTY TABLES
-- ===========================================

-- User loyalty profiles
CREATE TABLE IF NOT EXISTS gns_loyalty_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_pk VARCHAR(128) UNIQUE NOT NULL,
  
  -- Points
  total_points INTEGER NOT NULL DEFAULT 0,
  available_points INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  
  -- Tier
  tier VARCHAR(20) NOT NULL DEFAULT 'bronze',  -- bronze, silver, gold, platinum, diamond
  tier_progress INTEGER NOT NULL DEFAULT 0,
  
  -- Stats
  total_transactions INTEGER NOT NULL DEFAULT 0,
  total_spent DECIMAL(20, 7) NOT NULL DEFAULT 0,
  
  -- Referral
  referred_by VARCHAR(128),
  referral_code VARCHAR(20),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Points transactions
CREATE TABLE IF NOT EXISTS gns_point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id VARCHAR(20) UNIQUE NOT NULL,  -- PT-XXXXXXXX
  user_pk VARCHAR(128) NOT NULL,
  
  -- Transaction details
  points INTEGER NOT NULL,  -- Positive for earn, negative for redeem
  type VARCHAR(20) NOT NULL,  -- earned, redeemed, expired, bonus, referral, adjustment
  description TEXT NOT NULL,
  
  -- References
  reference_id VARCHAR(50),  -- Settlement ID, redemption ID, etc.
  merchant_id VARCHAR(50),
  merchant_name VARCHAR(100),
  
  -- Balance
  balance_after INTEGER NOT NULL,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for points
CREATE INDEX IF NOT EXISTS idx_points_user ON gns_point_transactions(user_pk);
CREATE INDEX IF NOT EXISTS idx_points_type ON gns_point_transactions(type);
CREATE INDEX IF NOT EXISTS idx_points_created ON gns_point_transactions(created_at DESC);

-- Rewards catalog
CREATE TABLE IF NOT EXISTS gns_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id VARCHAR(20) UNIQUE NOT NULL,
  
  -- Details
  name VARCHAR(100) NOT NULL,
  description TEXT,
  image_url TEXT,
  
  -- Cost
  points_cost INTEGER NOT NULL,
  
  -- Type
  type VARCHAR(20) NOT NULL,  -- discount, free_item, cashback, upgrade, gns_tokens, experience
  discount_amount DECIMAL(10, 2),
  discount_percent DECIMAL(5, 2),
  
  -- Merchant (null = GNS global reward)
  merchant_id VARCHAR(50),
  merchant_name VARCHAR(100),
  
  -- Availability
  is_available BOOLEAN DEFAULT true,
  quantity_available INTEGER,  -- null = unlimited
  expires_at TIMESTAMPTZ,
  
  -- Categories
  categories TEXT[],
  terms JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for rewards
CREATE INDEX IF NOT EXISTS idx_rewards_merchant ON gns_rewards(merchant_id);
CREATE INDEX IF NOT EXISTS idx_rewards_available ON gns_rewards(is_available);
CREATE INDEX IF NOT EXISTS idx_rewards_points ON gns_rewards(points_cost);

-- Redeemed rewards
CREATE TABLE IF NOT EXISTS gns_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  redemption_id VARCHAR(20) UNIQUE NOT NULL,  -- RDM-XXXXXXXX
  
  -- Reward reference
  reward_id VARCHAR(20) NOT NULL,
  reward_name VARCHAR(100) NOT NULL,
  
  -- User
  user_pk VARCHAR(128) NOT NULL,
  
  -- Details
  points_spent INTEGER NOT NULL,
  coupon_code VARCHAR(20),
  
  -- Status
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  
  -- Expiration
  expires_at TIMESTAMPTZ,
  
  -- Merchant
  merchant_id VARCHAR(50),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for redemptions
CREATE INDEX IF NOT EXISTS idx_redemptions_user ON gns_redemptions(user_pk);
CREATE INDEX IF NOT EXISTS idx_redemptions_reward ON gns_redemptions(reward_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_used ON gns_redemptions(is_used);

-- Achievements
CREATE TABLE IF NOT EXISTS gns_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id VARCHAR(50) UNIQUE NOT NULL,
  
  -- Details
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  icon_url TEXT,
  category VARCHAR(50) NOT NULL,  -- spending, frequency, milestone, special
  
  -- Reward
  points_awarded INTEGER NOT NULL DEFAULT 0,
  
  -- Unlock criteria
  criteria_type VARCHAR(50) NOT NULL,  -- transaction_count, total_spent, first_payment, etc.
  criteria_target DECIMAL(20, 2),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User achievements (unlocked)
CREATE TABLE IF NOT EXISTS gns_user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_pk VARCHAR(128) NOT NULL,
  achievement_id VARCHAR(50) NOT NULL,
  
  -- Progress
  progress DECIMAL(20, 2) DEFAULT 0,
  is_unlocked BOOLEAN DEFAULT false,
  unlocked_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_pk, achievement_id)
);

-- Indexes for user achievements
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON gns_user_achievements(user_pk);
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked ON gns_user_achievements(is_unlocked);

-- Merchant loyalty programs
CREATE TABLE IF NOT EXISTS gns_loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id VARCHAR(20) UNIQUE NOT NULL,
  
  -- Merchant
  merchant_id VARCHAR(50) NOT NULL REFERENCES gns_merchants(merchant_id),
  merchant_name VARCHAR(100) NOT NULL,
  
  -- Program details
  program_name VARCHAR(100) NOT NULL,
  description TEXT,
  logo_url TEXT,
  
  -- Points earning
  points_per_dollar DECIMAL(5, 2) NOT NULL DEFAULT 1.0,
  bonus_multiplier DECIMAL(3, 2) DEFAULT 1.0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Program enrollments
CREATE TABLE IF NOT EXISTS gns_program_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_pk VARCHAR(128) NOT NULL,
  program_id VARCHAR(20) NOT NULL,
  merchant_id VARCHAR(50) NOT NULL,
  
  -- Stats
  points_earned INTEGER DEFAULT 0,
  transactions_count INTEGER DEFAULT 0,
  
  -- Timestamps
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ,
  
  UNIQUE(user_pk, program_id)
);

-- ===========================================
-- HCE (HOST CARD EMULATION) TABLES
-- ===========================================

-- HCE payment sessions
CREATE TABLE IF NOT EXISTS gns_hce_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(50) UNIQUE NOT NULL,
  
  -- User
  user_pk VARCHAR(128) NOT NULL,
  user_stellar_address VARCHAR(56),
  
  -- Terminal
  terminal_id VARCHAR(50),
  merchant_id VARCHAR(50),
  
  -- Request
  amount DECIMAL(20, 7),
  currency VARCHAR(12),
  order_id VARCHAR(100),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'initiated',  -- initiated, processing, completed, failed, cancelled
  
  -- Result
  transaction_hash VARCHAR(128),
  auth_code VARCHAR(10),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Expiration (HCE sessions are short-lived)
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '2 minutes')
);

-- Indexes for HCE
CREATE INDEX IF NOT EXISTS idx_hce_user ON gns_hce_sessions(user_pk);
CREATE INDEX IF NOT EXISTS idx_hce_status ON gns_hce_sessions(status);
CREATE INDEX IF NOT EXISTS idx_hce_expires ON gns_hce_sessions(expires_at);

-- Trusted merchants (for auto-approve in HCE)
CREATE TABLE IF NOT EXISTS gns_trusted_merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_pk VARCHAR(128) NOT NULL,
  merchant_id VARCHAR(50) NOT NULL,
  
  -- Settings
  auto_approve BOOLEAN DEFAULT false,
  max_auto_amount DECIMAL(20, 7),  -- Max amount for auto-approve
  
  -- Stats
  transaction_count INTEGER DEFAULT 0,
  total_spent DECIMAL(20, 7) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_transaction TIMESTAMPTZ,
  
  UNIQUE(user_pk, merchant_id)
);

-- ===========================================
-- VIEWS
-- ===========================================

-- Refund summary view
CREATE OR REPLACE VIEW refund_summary AS
SELECT 
  merchant_id,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
  SUM(refund_amount) FILTER (WHERE status = 'completed') as total_refunded,
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at))/3600) FILTER (WHERE status = 'completed') as avg_processing_hours
FROM gns_refunds
GROUP BY merchant_id;

-- User loyalty summary view
CREATE OR REPLACE VIEW user_loyalty_summary AS
SELECT 
  p.user_pk,
  p.tier,
  p.available_points,
  p.lifetime_points,
  p.total_transactions,
  p.total_spent,
  COUNT(DISTINCT e.program_id) as enrolled_programs,
  COUNT(DISTINCT ua.achievement_id) FILTER (WHERE ua.is_unlocked) as achievements_unlocked
FROM gns_loyalty_profiles p
LEFT JOIN gns_program_enrollments e ON p.user_pk = e.user_pk
LEFT JOIN gns_user_achievements ua ON p.user_pk = ua.user_pk
GROUP BY p.user_pk, p.tier, p.available_points, p.lifetime_points, p.total_transactions, p.total_spent;

-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Award points to user
CREATE OR REPLACE FUNCTION award_points(
  p_user_pk VARCHAR(128),
  p_points INTEGER,
  p_type VARCHAR(20),
  p_description TEXT,
  p_reference_id VARCHAR(50) DEFAULT NULL,
  p_merchant_id VARCHAR(50) DEFAULT NULL
) RETURNS TABLE(new_balance INTEGER, transaction_id VARCHAR(20)) AS $$
DECLARE
  v_profile gns_loyalty_profiles%ROWTYPE;
  v_tx_id VARCHAR(20);
  v_new_balance INTEGER;
BEGIN
  -- Get or create profile
  SELECT * INTO v_profile FROM gns_loyalty_profiles WHERE user_pk = p_user_pk;
  
  IF NOT FOUND THEN
    INSERT INTO gns_loyalty_profiles (user_pk) VALUES (p_user_pk)
    RETURNING * INTO v_profile;
  END IF;
  
  -- Calculate new balance
  v_new_balance := v_profile.available_points + p_points;
  
  -- Generate transaction ID
  v_tx_id := 'PT-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8));
  
  -- Create transaction
  INSERT INTO gns_point_transactions (
    transaction_id, user_pk, points, type, description,
    reference_id, merchant_id, balance_after
  ) VALUES (
    v_tx_id, p_user_pk, p_points, p_type, p_description,
    p_reference_id, p_merchant_id, v_new_balance
  );
  
  -- Update profile
  UPDATE gns_loyalty_profiles SET
    available_points = v_new_balance,
    total_points = total_points + GREATEST(p_points, 0),
    lifetime_points = CASE WHEN p_type IN ('earned', 'bonus', 'referral') 
                      THEN lifetime_points + p_points 
                      ELSE lifetime_points END,
    updated_at = NOW()
  WHERE user_pk = p_user_pk;
  
  RETURN QUERY SELECT v_new_balance, v_tx_id;
END;
$$ LANGUAGE plpgsql;

-- Check and update user tier
CREATE OR REPLACE FUNCTION update_user_tier(p_user_pk VARCHAR(128)) RETURNS VARCHAR(20) AS $$
DECLARE
  v_lifetime_points INTEGER;
  v_new_tier VARCHAR(20);
BEGIN
  SELECT lifetime_points INTO v_lifetime_points 
  FROM gns_loyalty_profiles 
  WHERE user_pk = p_user_pk;
  
  -- Determine tier based on lifetime points
  v_new_tier := CASE
    WHEN v_lifetime_points >= 50000 THEN 'diamond'
    WHEN v_lifetime_points >= 15000 THEN 'platinum'
    WHEN v_lifetime_points >= 5000 THEN 'gold'
    WHEN v_lifetime_points >= 1000 THEN 'silver'
    ELSE 'bronze'
  END;
  
  -- Update tier
  UPDATE gns_loyalty_profiles 
  SET tier = v_new_tier, updated_at = NOW()
  WHERE user_pk = p_user_pk;
  
  RETURN v_new_tier;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

-- Enable RLS
ALTER TABLE gns_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_loyalty_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_program_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_hce_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_trusted_merchants ENABLE ROW LEVEL SECURITY;

-- Service role policies (backend access)
CREATE POLICY "Service full access to refunds"
  ON gns_refunds FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service full access to loyalty_profiles"
  ON gns_loyalty_profiles FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service full access to point_transactions"
  ON gns_point_transactions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service full access to redemptions"
  ON gns_redemptions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service full access to user_achievements"
  ON gns_user_achievements FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service full access to program_enrollments"
  ON gns_program_enrollments FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service full access to hce_sessions"
  ON gns_hce_sessions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service full access to trusted_merchants"
  ON gns_trusted_merchants FOR ALL
  USING (auth.role() = 'service_role');

-- ===========================================
-- SEED DATA: DEFAULT ACHIEVEMENTS
-- ===========================================

INSERT INTO gns_achievements (achievement_id, name, description, icon_url, category, points_awarded, criteria_type, criteria_target)
VALUES
  ('first_payment', 'First Steps', 'Make your first GNS payment', '🎉', 'milestone', 50, 'transaction_count', 1),
  ('ten_payments', 'Getting Started', 'Complete 10 payments', '🔟', 'frequency', 100, 'transaction_count', 10),
  ('fifty_payments', 'Regular User', 'Complete 50 payments', '⭐', 'frequency', 250, 'transaction_count', 50),
  ('hundred_payments', 'Power User', 'Complete 100 payments', '💪', 'frequency', 500, 'transaction_count', 100),
  ('spent_100', 'Big Spender', 'Spend $100 total', '💵', 'spending', 100, 'total_spent', 100),
  ('spent_500', 'Serious Shopper', 'Spend $500 total', '💰', 'spending', 250, 'total_spent', 500),
  ('spent_1000', 'VIP Spender', 'Spend $1,000 total', '🏆', 'spending', 500, 'total_spent', 1000),
  ('first_hce', 'Tap Master', 'Make your first tap-to-pay payment', '📱', 'special', 75, 'hce_count', 1),
  ('referral_1', 'Friend Finder', 'Refer your first friend', '🤝', 'special', 100, 'referral_count', 1),
  ('referral_5', 'Ambassador', 'Refer 5 friends', '🌟', 'special', 300, 'referral_count', 5)
ON CONFLICT (achievement_id) DO NOTHING;

-- ===========================================
-- SEED DATA: SAMPLE REWARDS
-- ===========================================

INSERT INTO gns_rewards (reward_id, name, description, points_cost, type, discount_percent, is_available, categories)
VALUES
  ('RWD-DISCOUNT5', '5% Off Next Purchase', 'Get 5% off your next GNS payment', 100, 'discount', 5.0, true, ARRAY['discount']),
  ('RWD-DISCOUNT10', '10% Off Next Purchase', 'Get 10% off your next GNS payment', 200, 'discount', 10.0, true, ARRAY['discount']),
  ('RWD-CASHBACK5', '$5 Cashback', 'Receive $5 in GNS tokens', 500, 'cashback', NULL, true, ARRAY['cashback']),
  ('RWD-CASHBACK10', '$10 Cashback', 'Receive $10 in GNS tokens', 900, 'cashback', NULL, true, ARRAY['cashback']),
  ('RWD-GNS50', '50 GNS Tokens', 'Receive 50 GNS tokens', 400, 'gns_tokens', NULL, true, ARRAY['tokens']),
  ('RWD-GNS100', '100 GNS Tokens', 'Receive 100 GNS tokens', 750, 'gns_tokens', NULL, true, ARRAY['tokens'])
ON CONFLICT (reward_id) DO NOTHING;

-- ===========================================
-- DONE
-- ===========================================

-- Verify tables created
DO $$
BEGIN
  RAISE NOTICE '✅ Sprint 6 migration complete!';
  RAISE NOTICE '   Tables: gns_refunds, gns_loyalty_profiles, gns_point_transactions';
  RAISE NOTICE '   Tables: gns_rewards, gns_redemptions, gns_achievements';
  RAISE NOTICE '   Tables: gns_user_achievements, gns_loyalty_programs';
  RAISE NOTICE '   Tables: gns_program_enrollments, gns_hce_sessions, gns_trusted_merchants';
  RAISE NOTICE '   Views: refund_summary, user_loyalty_summary';
  RAISE NOTICE '   Functions: award_points(), update_user_tier()';
END $$;
