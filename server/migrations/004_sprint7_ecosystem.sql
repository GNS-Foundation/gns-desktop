-- ===========================================
-- GNS NODE - SPRINT 7 MIGRATION
-- Batch Settlements, Notifications, Analytics, Subscriptions
-- 
-- File: migrations/004_sprint7_ecosystem.sql
-- Run: Supabase Dashboard → SQL Editor → Paste & Run
-- ===========================================

-- ===========================================
-- BATCH SETTLEMENT TABLES
-- ===========================================

-- Settlement configuration per merchant
CREATE TABLE IF NOT EXISTS gns_settlement_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id VARCHAR(50) UNIQUE NOT NULL REFERENCES gns_merchants(merchant_id),
  
  -- Schedule
  frequency VARCHAR(20) NOT NULL DEFAULT 'daily',  -- realtime, hourly, daily, weekly, manual
  settlement_hour INTEGER DEFAULT 0,  -- 0-23 for daily
  settlement_day_of_week INTEGER DEFAULT 0,  -- 0-6 for weekly (0=Sunday)
  
  -- Thresholds
  minimum_amount DECIMAL(20, 7) DEFAULT 10.0,
  auto_settle BOOLEAN DEFAULT true,
  
  -- Destination
  preferred_currency VARCHAR(12) DEFAULT 'USDC',
  settlement_address VARCHAR(56),  -- Stellar address
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Batch settlements
CREATE TABLE IF NOT EXISTS gns_batch_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id VARCHAR(20) UNIQUE NOT NULL,  -- BATCH-XXXXXXXX
  
  -- Merchant
  merchant_id VARCHAR(50) NOT NULL REFERENCES gns_merchants(merchant_id),
  merchant_name VARCHAR(100),
  
  -- Amounts
  currency VARCHAR(12) NOT NULL,
  total_gross DECIMAL(20, 7) NOT NULL,
  total_fees DECIMAL(20, 7) NOT NULL DEFAULT 0,
  total_net DECIMAL(20, 7) NOT NULL,
  
  -- Transactions
  transaction_count INTEGER NOT NULL DEFAULT 0,
  transaction_ids TEXT[],  -- Array of settlement_ids
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed
  
  -- Settlement execution
  stellar_tx_hash VARCHAR(128),
  
  -- Period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  failure_reason TEXT
);

-- Indexes for batch settlements
CREATE INDEX IF NOT EXISTS idx_batch_merchant ON gns_batch_settlements(merchant_id);
CREATE INDEX IF NOT EXISTS idx_batch_status ON gns_batch_settlements(status);
CREATE INDEX IF NOT EXISTS idx_batch_created ON gns_batch_settlements(created_at DESC);

-- ===========================================
-- NOTIFICATION TABLES
-- ===========================================

-- Device registrations for push notifications
CREATE TABLE IF NOT EXISTS gns_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_pk VARCHAR(128) NOT NULL,
  device_id VARCHAR(100) NOT NULL,
  
  -- Push token
  push_token TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL,  -- android, ios, web
  device_name VARCHAR(100),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_pk, device_id)
);

-- Indexes for devices
CREATE INDEX IF NOT EXISTS idx_devices_user ON gns_devices(user_pk);
CREATE INDEX IF NOT EXISTS idx_devices_active ON gns_devices(is_active);

-- Notification preferences
CREATE TABLE IF NOT EXISTS gns_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_pk VARCHAR(128) UNIQUE NOT NULL,
  
  -- Payment notifications
  payment_received BOOLEAN DEFAULT true,
  payment_sent BOOLEAN DEFAULT true,
  payment_failed BOOLEAN DEFAULT true,
  payment_request BOOLEAN DEFAULT true,
  
  -- Refund notifications
  refund_updates BOOLEAN DEFAULT true,
  
  -- Loyalty notifications
  points_earned BOOLEAN DEFAULT true,
  tier_upgrade BOOLEAN DEFAULT true,
  reward_available BOOLEAN DEFAULT true,
  achievement_unlocked BOOLEAN DEFAULT true,
  
  -- Subscription notifications
  subscription_reminders BOOLEAN DEFAULT true,
  
  -- Security
  security_alerts BOOLEAN DEFAULT true,
  
  -- System
  system_updates BOOLEAN DEFAULT true,
  marketing_messages BOOLEAN DEFAULT false,
  
  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start INTEGER DEFAULT 22,  -- 10 PM
  quiet_hours_end INTEGER DEFAULT 8,      -- 8 AM
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification history
CREATE TABLE IF NOT EXISTS gns_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id VARCHAR(20) UNIQUE NOT NULL,
  user_pk VARCHAR(128) NOT NULL,
  
  -- Content
  type VARCHAR(50) NOT NULL,  -- paymentReceived, refundApproved, tierUpgrade, etc.
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  
  -- Metadata
  priority VARCHAR(10) DEFAULT 'normal',  -- low, normal, high, urgent
  channel VARCHAR(20) NOT NULL DEFAULT 'system',  -- payments, refunds, loyalty, etc.
  
  -- Display
  image_url TEXT,
  action_url TEXT,
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON gns_notifications(user_pk);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON gns_notifications(user_pk, is_read) WHERE NOT is_read;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON gns_notifications(created_at DESC);

-- ===========================================
-- ANALYTICS TABLES
-- ===========================================

-- User budgets
CREATE TABLE IF NOT EXISTS gns_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id VARCHAR(20) UNIQUE NOT NULL,
  user_pk VARCHAR(128) NOT NULL,
  
  -- Budget details
  name VARCHAR(100) NOT NULL,
  amount DECIMAL(20, 7) NOT NULL,
  period VARCHAR(20) NOT NULL,  -- weekly, monthly, quarterly, yearly
  
  -- Filters (optional)
  category VARCHAR(50),
  merchant_id VARCHAR(50),
  
  -- Alerts
  alert_enabled BOOLEAN DEFAULT true,
  alert_threshold DECIMAL(3, 2) DEFAULT 0.8,  -- 80%
  
  -- Calculated period
  period_start DATE,
  period_end DATE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for budgets
CREATE INDEX IF NOT EXISTS idx_budgets_user ON gns_budgets(user_pk);

-- Savings goals
CREATE TABLE IF NOT EXISTS gns_savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id VARCHAR(20) UNIQUE NOT NULL,
  user_pk VARCHAR(128) NOT NULL,
  
  -- Goal details
  name VARCHAR(100) NOT NULL,
  target_amount DECIMAL(20, 7) NOT NULL,
  current_amount DECIMAL(20, 7) DEFAULT 0,
  
  -- Timeline
  target_date DATE,
  
  -- Display
  image_url TEXT,
  
  -- Status
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for savings goals
CREATE INDEX IF NOT EXISTS idx_savings_user ON gns_savings_goals(user_pk);

-- Savings contributions
CREATE TABLE IF NOT EXISTS gns_savings_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id VARCHAR(20) NOT NULL REFERENCES gns_savings_goals(goal_id),
  user_pk VARCHAR(128) NOT NULL,
  
  amount DECIMAL(20, 7) NOT NULL,
  balance_after DECIMAL(20, 7) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transaction categories (for analytics)
CREATE TABLE IF NOT EXISTS gns_transaction_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id TEXT NOT NULL,
  user_pk VARCHAR(128) NOT NULL,
  
  category VARCHAR(50) NOT NULL,  -- food, shopping, entertainment, etc.
  confidence DECIMAL(3, 2) DEFAULT 1.0,  -- How confident the categorization is
  is_manual BOOLEAN DEFAULT false,  -- User-assigned vs auto
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for transaction categories
CREATE INDEX IF NOT EXISTS idx_txcat_settlement ON gns_transaction_categories(settlement_id);
CREATE INDEX IF NOT EXISTS idx_txcat_user ON gns_transaction_categories(user_pk);
CREATE INDEX IF NOT EXISTS idx_txcat_category ON gns_transaction_categories(category);

-- ===========================================
-- SUBSCRIPTION TABLES
-- ===========================================

-- Subscription plans (merchant-defined)
CREATE TABLE IF NOT EXISTS gns_subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id VARCHAR(20) UNIQUE NOT NULL,
  
  -- Merchant
  merchant_id VARCHAR(50) NOT NULL REFERENCES gns_merchants(merchant_id),
  merchant_name VARCHAR(100) NOT NULL,
  
  -- Plan details
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Pricing
  price DECIMAL(20, 7) NOT NULL,
  currency VARCHAR(12) NOT NULL DEFAULT 'USDC',
  billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',  -- daily, weekly, monthly, etc.
  
  -- Trial
  trial_days INTEGER DEFAULT 0,
  
  -- Features
  features TEXT[],
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for subscription plans
CREATE INDEX IF NOT EXISTS idx_plans_merchant ON gns_subscription_plans(merchant_id);
CREATE INDEX IF NOT EXISTS idx_plans_active ON gns_subscription_plans(is_active);

-- User subscriptions
CREATE TABLE IF NOT EXISTS gns_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id VARCHAR(20) UNIQUE NOT NULL,
  
  -- References
  plan_id VARCHAR(20) NOT NULL REFERENCES gns_subscription_plans(plan_id),
  user_id VARCHAR(128) NOT NULL,  -- user_pk
  merchant_id VARCHAR(50) NOT NULL,
  
  -- Cached plan info
  merchant_name VARCHAR(100) NOT NULL,
  plan_name VARCHAR(100) NOT NULL,
  amount DECIMAL(20, 7) NOT NULL,
  currency VARCHAR(12) NOT NULL,
  billing_cycle VARCHAR(20) NOT NULL,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, paused, cancelled, expired, pastDue, trialing
  
  -- Payment
  payment_method VARCHAR(20) DEFAULT 'gnsWallet',  -- gnsWallet, stellarDirect, linkedCard
  
  -- Timeline
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_end_date TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  next_billing_date TIMESTAMPTZ,
  
  -- Cancellation
  cancelled_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  
  -- Pause
  paused_at TIMESTAMPTZ,
  
  -- Payment tracking
  failed_payment_attempts INTEGER DEFAULT 0,
  last_payment_date TIMESTAMPTZ,
  last_payment_id VARCHAR(50),
  
  -- Settings
  auto_renew BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for subscriptions
CREATE INDEX IF NOT EXISTS idx_subs_user ON gns_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subs_merchant ON gns_subscriptions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_subs_status ON gns_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subs_next_billing ON gns_subscriptions(next_billing_date);

-- Subscription invoices
CREATE TABLE IF NOT EXISTS gns_subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id VARCHAR(20) UNIQUE NOT NULL,
  subscription_id VARCHAR(20) NOT NULL REFERENCES gns_subscriptions(subscription_id),
  
  -- Amount
  amount DECIMAL(20, 7) NOT NULL,
  currency VARCHAR(12) NOT NULL,
  
  -- Period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, paid, failed, refunded
  
  -- Payment
  payment_id VARCHAR(50),
  paid_at TIMESTAMPTZ,
  failure_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for invoices
CREATE INDEX IF NOT EXISTS idx_invoices_sub ON gns_subscription_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON gns_subscription_invoices(status);

-- ===========================================
-- VIEWS
-- ===========================================

-- Pending batch summary
CREATE OR REPLACE VIEW pending_batch_summary AS
SELECT 
  s.merchant_id,
  s.currency,
  COUNT(*) as transaction_count,
  SUM(s.amount) as total_gross,
  SUM(s.fee_amount) as total_fees,
  SUM(s.amount - s.fee_amount) as total_net,
  MIN(s.created_at) as oldest_transaction,
  MAX(s.created_at) as newest_transaction
FROM gns_settlements s
WHERE s.status = 'confirmed'
  AND s.batch_id IS NULL
GROUP BY s.merchant_id, s.currency;

-- User spending summary
CREATE OR REPLACE VIEW user_spending_summary AS
SELECT 
  s.user_pk,
  DATE_TRUNC('month', s.created_at) as month,
  SUM(s.amount) as total_spent,
  COUNT(*) as transaction_count,
  AVG(s.amount) as average_transaction
FROM gns_settlements s
WHERE s.status IN ('confirmed', 'settled')
GROUP BY s.user_pk, DATE_TRUNC('month', s.created_at);

-- Active subscriptions summary
CREATE OR REPLACE VIEW active_subscriptions_summary AS
SELECT 
  user_id,
  COUNT(*) as active_count,
  SUM(amount) as monthly_total,
  MIN(next_billing_date) as next_payment
FROM gns_subscriptions
WHERE status = 'active'
GROUP BY user_id;

-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Generate batch ID
CREATE OR REPLACE FUNCTION generate_batch_id() RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN 'BATCH-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

-- Generate notification ID
CREATE OR REPLACE FUNCTION generate_notification_id() RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN 'NTF-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

-- Generate budget ID
CREATE OR REPLACE FUNCTION generate_budget_id() RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN 'BDG-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

-- Generate goal ID
CREATE OR REPLACE FUNCTION generate_goal_id() RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN 'GOAL-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

-- Generate plan ID
CREATE OR REPLACE FUNCTION generate_plan_id() RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN 'PLAN-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

-- Generate subscription ID
CREATE OR REPLACE FUNCTION generate_subscription_id() RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN 'SUB-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

-- Generate invoice ID
CREATE OR REPLACE FUNCTION generate_invoice_id() RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN 'INV-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

-- Calculate next billing date
CREATE OR REPLACE FUNCTION calculate_next_billing_date(
  current_date TIMESTAMPTZ,
  billing_cycle VARCHAR(20)
) RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN CASE billing_cycle
    WHEN 'daily' THEN current_date + INTERVAL '1 day'
    WHEN 'weekly' THEN current_date + INTERVAL '1 week'
    WHEN 'biweekly' THEN current_date + INTERVAL '2 weeks'
    WHEN 'monthly' THEN current_date + INTERVAL '1 month'
    WHEN 'quarterly' THEN current_date + INTERVAL '3 months'
    WHEN 'semiannually' THEN current_date + INTERVAL '6 months'
    WHEN 'annually' THEN current_date + INTERVAL '1 year'
    ELSE current_date + INTERVAL '1 month'
  END;
END;
$$ LANGUAGE plpgsql;

-- Send notification (helper function)
CREATE OR REPLACE FUNCTION send_notification(
  p_user_pk VARCHAR(128),
  p_type VARCHAR(50),
  p_title VARCHAR(200),
  p_body TEXT,
  p_channel VARCHAR(20) DEFAULT 'system',
  p_priority VARCHAR(10) DEFAULT 'normal',
  p_data JSONB DEFAULT NULL
) RETURNS VARCHAR(20) AS $$
DECLARE
  v_notification_id VARCHAR(20);
BEGIN
  v_notification_id := generate_notification_id();
  
  INSERT INTO gns_notifications (
    notification_id, user_pk, type, title, body, channel, priority, data
  ) VALUES (
    v_notification_id, p_user_pk, p_type, p_title, p_body, p_channel, p_priority, p_data
  );
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

-- Enable RLS
ALTER TABLE gns_settlement_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_batch_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_savings_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gns_subscription_invoices ENABLE ROW LEVEL SECURITY;

-- Service role policies
CREATE POLICY "Service full access to settlement_config"
  ON gns_settlement_config FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service full access to batch_settlements"
  ON gns_batch_settlements FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service full access to devices"
  ON gns_devices FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service full access to notification_preferences"
  ON gns_notification_preferences FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service full access to notifications"
  ON gns_notifications FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service full access to budgets"
  ON gns_budgets FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service full access to savings_goals"
  ON gns_savings_goals FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service full access to savings_contributions"
  ON gns_savings_contributions FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service full access to transaction_categories"
  ON gns_transaction_categories FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service full access to subscription_plans"
  ON gns_subscription_plans FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service full access to subscriptions"
  ON gns_subscriptions FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service full access to subscription_invoices"
  ON gns_subscription_invoices FOR ALL USING (auth.role() = 'service_role');

-- Public read for subscription plans
CREATE POLICY "Public read subscription_plans"
  ON gns_subscription_plans FOR SELECT USING (is_active = true);

-- ===========================================
-- SEED DATA: SAMPLE SUBSCRIPTION PLANS
-- ===========================================

-- Note: These are example plans. Real merchants would create their own.
INSERT INTO gns_subscription_plans (
  plan_id, merchant_id, merchant_name, name, description, 
  price, currency, billing_cycle, trial_days, features, is_active
)
SELECT 
  'PLAN-GNSPREM',
  m.merchant_id,
  m.business_name,
  'GNS Premium',
  'Premium features for GNS payments',
  9.99,
  'USDC',
  'monthly',
  14,
  ARRAY['Priority support', 'Reduced fees', 'Advanced analytics', 'Custom themes'],
  true
FROM gns_merchants m
WHERE m.merchant_id = 'gns_official'
ON CONFLICT (plan_id) DO NOTHING;

-- ===========================================
-- ADD COLUMN TO SETTLEMENTS FOR BATCH TRACKING
-- ===========================================

-- Add batch_id to settlements if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gns_settlements' AND column_name = 'batch_id'
  ) THEN
    ALTER TABLE gns_settlements ADD COLUMN batch_id VARCHAR(20);
    CREATE INDEX IF NOT EXISTS idx_settlements_batch ON gns_settlements(batch_id);
  END IF;
END $$;

-- ===========================================
-- DONE
-- ===========================================

DO $$
BEGIN
  RAISE NOTICE '✅ Sprint 7 migration complete!';
  RAISE NOTICE '   Tables: gns_settlement_config, gns_batch_settlements';
  RAISE NOTICE '   Tables: gns_devices, gns_notification_preferences, gns_notifications';
  RAISE NOTICE '   Tables: gns_budgets, gns_savings_goals, gns_savings_contributions';
  RAISE NOTICE '   Tables: gns_transaction_categories';
  RAISE NOTICE '   Tables: gns_subscription_plans, gns_subscriptions, gns_subscription_invoices';
  RAISE NOTICE '   Views: pending_batch_summary, user_spending_summary, active_subscriptions_summary';
  RAISE NOTICE '   Functions: generate_*_id(), calculate_next_billing_date(), send_notification()';
END $$;
