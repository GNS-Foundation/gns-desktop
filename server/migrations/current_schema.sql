-- ============================================================================
-- GNS Protocol — Production Database Schema
-- Snapshot: 2026-02-06
-- Source: Supabase PostgreSQL (db.nsthmevgpkskmgmubdju.supabase.co)
-- ============================================================================
-- 
-- TABLE CATEGORIES:
--   🔑 CORE IDENTITY    — aliases, records, identities, breadcrumbs, epochs
--   💬 MESSAGING         — messages, presence, typing_status, browser_sessions
--   📱 SOCIAL (DIX)      — dix_posts, dix_likes, dix_reposts
--   🌐 SITES & THEMES   — gsites, gsite_themes, themes, theme_purchases, theme_ratings
--   💰 PAYMENTS          — payments, payment_intents, payment_requests, payment_acks,
--                          gns_settlements, gns_receipts, gns_refunds, etc.
--   🏪 MERCHANT          — gns_merchants, geoauth_merchants, geoauth_sessions, gns_hce_sessions
--   🏢 ORGANIZATIONS     — organizations, org_registrations, namespaces, namespace_*
--   🔐 AUTH & SECURITY   — oauth_clients, oauth_sessions, verification_challenges,
--                          fraud_events, velocity_checks
--   🎮 GAMIFICATION      — gns_achievements, gns_user_achievements, gns_rewards,
--                          gns_loyalty_*, gns_point_transactions, gns_redemptions
--   💳 BILLING           — gns_subscriptions, gns_subscription_plans, gns_subscription_invoices,
--                          gns_invoices, gns_invoice_templates, gns_payment_links
--   📊 FINANCIAL TOOLS   — gns_budgets, gns_savings_goals, gns_savings_contributions,
--                          gns_transaction_categories, gns_currency_preferences, gns_exchange_rates
--   🔔 NOTIFICATIONS     — gns_notifications, gns_notification_preferences, gns_devices
--   🔗 WEBHOOKS          — gns_webhook_endpoints, gns_webhook_events, gns_webhook_deliveries
--   📈 VIEWS/SUMMARIES   — v_identities, v_pending_messages, active_subscriptions_summary,
--                          merchant_daily_summaries, refund_summary, user_spending_*
--   📧 EMAIL             — domain_mappings
--   ⭐ STELLAR           — stellar_funding_requests, gns_assets, fiat_wallets
--   🔄 SYNC              — sync_state
--   📎 MEDIA             — media
--
-- DEPRECATED (moved to 'deprecated' schema):
--   posts, post_likes, post_reposts, webhook_deliveries, webhook_subscriptions
--
-- ============================================================================


-- ============================================================================
-- 🔑 CORE IDENTITY
-- ============================================================================

CREATE TABLE aliases (
    handle text NOT NULL,
    pk_root text NOT NULL,
    pot_proof jsonb NOT NULL,
    signature text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified boolean NOT NULL,
    is_system boolean
);

CREATE TABLE records (
    pk_root text NOT NULL,
    record_json jsonb NOT NULL,
    signature text NOT NULL,
    version integer NOT NULL,
    handle text,
    trust_score numeric,
    breadcrumb_count integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    encryption_key text
);

CREATE TABLE identities (
    public_key text NOT NULL,
    handle text,
    created_at timestamp without time zone,
    trust_score numeric,
    breadcrumb_count integer,
    unique_cells_visited integer,
    last_breadcrumb_at timestamp without time zone,
    stellar_address text NOT NULL,
    namespace_type text,
    organization_id text,
    metadata jsonb
);

CREATE TABLE breadcrumbs (
    id uuid NOT NULL,
    public_key text,
    h3_cell text NOT NULL,
    h3_resolution integer NOT NULL,
    timestamp bigint NOT NULL,
    previous_hash text,
    block_hash text NOT NULL,
    signature text NOT NULL,
    breadcrumb_type text,
    payment_id uuid,
    metadata jsonb,
    created_at timestamp without time zone
);

CREATE TABLE epochs (
    id integer NOT NULL,
    pk_root text NOT NULL,
    epoch_index integer NOT NULL,
    merkle_root text NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    block_count integer NOT NULL,
    prev_epoch_hash text,
    signature text NOT NULL,
    epoch_hash text NOT NULL,
    published_at timestamp with time zone NOT NULL
);

CREATE TABLE reserved_handles (
    handle text NOT NULL,
    pk_root text NOT NULL,
    reserved_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL
);

CREATE TABLE verification_challenges (
    id uuid NOT NULL,
    challenge_id text NOT NULL,
    public_key text NOT NULL,
    challenge text NOT NULL,
    require_fresh_breadcrumb boolean,
    allowed_h3_cells _text,
    status text,
    created_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL
);


-- ============================================================================
-- 💬 MESSAGING
-- ============================================================================

CREATE TABLE messages (
    id uuid NOT NULL,
    from_pk text NOT NULL,
    to_pk text NOT NULL,
    payload text NOT NULL,
    signature text NOT NULL,
    relay_id text,
    created_at timestamp with time zone NOT NULL,
    delivered_at timestamp with time zone,
    expires_at timestamp with time zone,
    envelope jsonb,
    thread_id text,
    status text,
    fetched_at timestamp with time zone,
    sender_encrypted_payload text,
    sender_ephemeral_public_key text,
    sender_nonce text,
    encrypted_payload text,
    ephemeral_public_key text,
    nonce text
);

CREATE TABLE presence (
    public_key text NOT NULL,
    status text,
    last_seen timestamp with time zone,
    device_info jsonb
);

CREATE TABLE typing_status (
    thread_id text NOT NULL,
    public_key text NOT NULL,
    is_typing boolean,
    updated_at timestamp with time zone
);

CREATE TABLE browser_sessions (
    id integer NOT NULL,
    session_token character varying(64) NOT NULL,
    public_key character varying(64) NOT NULL,
    handle character varying(32),
    browser_info text NOT NULL,
    device_info jsonb,
    created_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    last_used_at timestamp with time zone,
    is_active boolean,
    revoked_at timestamp with time zone
);


-- ============================================================================
-- 📱 SOCIAL (DIX)
-- ============================================================================

CREATE TABLE dix_posts (
    id uuid NOT NULL,
    facet_id text NOT NULL,
    author_public_key text NOT NULL,
    author_handle text,
    content text NOT NULL,
    media jsonb,
    location_name text,
    location_h3 text,
    visibility text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    edited_at timestamp with time zone,
    is_deleted boolean NOT NULL,
    reply_to_post_id uuid,
    thread_root_id uuid,
    thread_depth integer NOT NULL,
    tags _text,
    mentions _text,
    signature text NOT NULL,
    view_count integer NOT NULL,
    like_count integer NOT NULL,
    reply_count integer NOT NULL,
    repost_count integer NOT NULL
);

CREATE TABLE dix_likes (
    post_id uuid NOT NULL,
    user_public_key text NOT NULL,
    created_at timestamp with time zone NOT NULL
);

CREATE TABLE dix_reposts (
    id uuid NOT NULL,
    original_post_id uuid NOT NULL,
    reposter_public_key text NOT NULL,
    reposter_handle text,
    comment text,
    created_at timestamp with time zone NOT NULL
);


-- ============================================================================
-- 🌐 SITES & THEMES
-- ============================================================================

CREATE TABLE gsites (
    id uuid NOT NULL,
    pk_root text NOT NULL,
    handle text,
    gsite_json jsonb NOT NULL,
    version integer,
    signature text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE gsite_themes (
    identifier text NOT NULL,
    theme_id text NOT NULL,
    overrides jsonb,
    applied_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE themes (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    version text NOT NULL,
    author text,
    author_pk text,
    signature text,
    entity_types _text NOT NULL,
    categories _text,
    license text NOT NULL,
    price_amount numeric,
    price_currency text,
    tokens jsonb NOT NULL,
    components jsonb,
    layout jsonb,
    dark_mode jsonb,
    thumbnail_url text,
    screenshots _text,
    is_default boolean,
    is_published boolean,
    install_count integer,
    rating_avg numeric,
    rating_count integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE theme_purchases (
    id uuid NOT NULL,
    theme_id text NOT NULL,
    buyer_pk text NOT NULL,
    buyer_handle text,
    price_paid numeric NOT NULL,
    currency text NOT NULL,
    transaction_hash text,
    purchased_at timestamp with time zone
);

CREATE TABLE theme_ratings (
    id uuid NOT NULL,
    theme_id text NOT NULL,
    rater_pk text NOT NULL,
    rater_handle text,
    rating integer NOT NULL,
    review text,
    created_at timestamp with time zone
);


-- ============================================================================
-- 💰 PAYMENTS
-- ============================================================================

CREATE TABLE payments (
    id uuid NOT NULL,
    payer_public_key text,
    payer_handle text,
    payee_public_key text,
    payee_handle text,
    amount numeric NOT NULL,
    currency text NOT NULL,
    payment_method text,
    stellar_tx_hash text,
    stripe_payment_id text,
    status text,
    payer_breadcrumb_id uuid,
    payee_breadcrumb_id uuid,
    h3_cell text NOT NULL,
    protocol_fee numeric,
    error_message text,
    created_at timestamp without time zone,
    completed_at timestamp without time zone,
    metadata jsonb
);

CREATE TABLE payment_intents (
    id uuid NOT NULL,
    payment_id text NOT NULL,
    from_pk text NOT NULL,
    to_pk text NOT NULL,
    envelope_json jsonb NOT NULL,
    payload_type text NOT NULL,
    currency text,
    route_type text,
    status text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    delivered_at timestamp with time zone,
    acked_at timestamp with time zone,
    expires_at timestamp with time zone
);

CREATE TABLE payment_requests (
    id uuid NOT NULL,
    payment_id text NOT NULL,
    creator_pk text NOT NULL,
    to_pk text NOT NULL,
    to_handle text,
    amount text NOT NULL,
    currency text,
    memo text,
    reference_id text,
    callback_url text,
    status text,
    stellar_tx_hash text,
    payer_pk text,
    created_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone
);

CREATE TABLE payment_acks (
    id uuid NOT NULL,
    payment_id text NOT NULL,
    from_pk text NOT NULL,
    status text NOT NULL,
    reason text,
    envelope_json jsonb,
    created_at timestamp with time zone NOT NULL
);

CREATE TABLE gns_settlements (
    settlement_id text NOT NULL,
    request_id text NOT NULL,
    merchant_id text NOT NULL,
    user_pk text NOT NULL,
    from_stellar_address text NOT NULL,
    to_stellar_address text NOT NULL,
    amount text NOT NULL,
    asset_code text NOT NULL,
    memo text,
    order_id text,
    h3_cell text,
    status text,
    stellar_tx_hash text,
    error_message text,
    fee_amount text,
    fee_percent numeric,
    created_at timestamp with time zone,
    completed_at timestamp with time zone,
    updated_at timestamp with time zone,
    batch_id character varying(20)
);

CREATE TABLE gns_receipts (
    id integer NOT NULL,
    receipt_id text NOT NULL,
    transaction_hash text NOT NULL,
    settlement_id text,
    merchant_id text,
    merchant_name text,
    user_pk text NOT NULL,
    user_handle text,
    amount text NOT NULL,
    currency text NOT NULL,
    order_id text,
    timestamp timestamp with time zone NOT NULL,
    status text,
    refund_tx_hash text,
    refunded_at timestamp with time zone,
    metadata jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE gns_refunds (
    id uuid NOT NULL,
    refund_id character varying(20) NOT NULL,
    settlement_id text,
    original_transaction_hash character varying(128),
    original_receipt_id character varying(50),
    merchant_id character varying(50) NOT NULL,
    user_pk character varying(128) NOT NULL,
    user_stellar_address character varying(56),
    original_amount numeric NOT NULL,
    refund_amount numeric NOT NULL,
    currency character varying(12) NOT NULL,
    reason character varying(50) NOT NULL,
    reason_details text,
    status character varying(20) NOT NULL,
    refund_transaction_hash character varying(128),
    processed_at timestamp with time zone,
    processed_by character varying(50),
    rejection_reason text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE gns_payment_completions (
    id integer NOT NULL,
    request_id text,
    merchant_id text,
    user_pk text NOT NULL,
    transaction_hash text,
    amount text,
    currency text,
    order_id text,
    h3_cell text,
    completed_at timestamp with time zone,
    created_at timestamp with time zone
);

CREATE TABLE gns_batch_settlements (
    id uuid NOT NULL,
    batch_id character varying(20) NOT NULL,
    merchant_id character varying(50) NOT NULL,
    merchant_name character varying(100),
    currency character varying(12) NOT NULL,
    total_gross numeric NOT NULL,
    total_fees numeric NOT NULL,
    total_net numeric NOT NULL,
    transaction_count integer NOT NULL,
    transaction_ids _text,
    status character varying(20) NOT NULL,
    stellar_tx_hash character varying(128),
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    created_at timestamp with time zone,
    settled_at timestamp with time zone,
    failure_reason text
);

CREATE TABLE gns_settlement_config (
    id uuid NOT NULL,
    merchant_id character varying(50) NOT NULL,
    frequency character varying(20) NOT NULL,
    settlement_hour integer,
    settlement_day_of_week integer,
    minimum_amount numeric,
    auto_settle boolean,
    preferred_currency character varying(12),
    settlement_address character varying(56),
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE gns_payment_links (
    link_id character varying(50) NOT NULL,
    owner_pk character varying(64) NOT NULL,
    title character varying(255),
    description text,
    amount numeric NOT NULL,
    currency character varying(8),
    type character varying(16),
    status character varying(16),
    payment_count integer,
    total_received numeric,
    expires_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    merchant_id character varying(64),
    is_reusable boolean,
    link_code character varying(20),
    max_uses integer,
    use_count integer,
    metadata jsonb,
    view_count integer
);

CREATE TABLE gns_link_payments (
    id uuid NOT NULL,
    link_id character varying(50) NOT NULL,
    payer_pk character varying(64) NOT NULL,
    amount numeric NOT NULL,
    currency character varying(8) NOT NULL,
    transaction_id character varying(128),
    status character varying(16),
    created_at timestamp with time zone
);

CREATE TABLE gns_qr_codes (
    qr_id uuid NOT NULL,
    code character varying(24),
    owner_pk character varying(64) NOT NULL,
    name character varying(255),
    description text,
    amount numeric,
    currency character varying(8),
    type character varying(16),
    data text NOT NULL,
    status character varying(16),
    scan_count integer,
    last_scanned_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    is_active boolean,
    merchant_id character varying(64),
    metadata jsonb,
    user_pk character varying(64),
    default_memo character varying(200),
    memo character varying(200)
);


-- ============================================================================
-- 🏪 MERCHANT
-- ============================================================================

CREATE TABLE gns_merchants (
    merchant_id text NOT NULL,
    name text NOT NULL,
    display_name text,
    stellar_address text NOT NULL,
    category text,
    status text,
    email text NOT NULL,
    phone text,
    website text,
    address text,
    h3_cell text,
    accepted_currencies _text,
    settlement_currency text,
    instant_settlement boolean,
    fee_percent numeric,
    api_key_hash text NOT NULL,
    signing_public_key text,
    logo_url text,
    metadata jsonb,
    verified_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE gns_trusted_merchants (
    id uuid NOT NULL,
    user_pk character varying(128) NOT NULL,
    merchant_id character varying(50) NOT NULL,
    auto_approve boolean,
    max_auto_amount numeric,
    transaction_count integer,
    total_spent numeric,
    created_at timestamp with time zone,
    last_transaction timestamp with time zone
);

CREATE TABLE geoauth_merchants (
    id uuid NOT NULL,
    merchant_id text NOT NULL,
    name text NOT NULL,
    website text,
    logo_url text,
    verified boolean,
    verified_at timestamp with time zone,
    api_key_hash text,
    webhook_url text,
    allowed_currencies _text,
    max_auth_amount numeric,
    require_h3_match boolean,
    max_distance_meters integer,
    status text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE geoauth_sessions (
    id uuid NOT NULL,
    auth_id text NOT NULL,
    merchant_id text NOT NULL,
    merchant_name text,
    payment_hash text NOT NULL,
    amount text,
    currency text,
    status text NOT NULL,
    user_pk text,
    envelope_json jsonb,
    h3_cell text,
    created_at timestamp with time zone NOT NULL,
    authorized_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL
);

CREATE TABLE gns_hce_sessions (
    id uuid NOT NULL,
    session_id character varying(50) NOT NULL,
    user_pk character varying(128) NOT NULL,
    user_stellar_address character varying(56),
    terminal_id character varying(50),
    merchant_id character varying(50),
    amount numeric,
    currency character varying(12),
    order_id character varying(100),
    status character varying(20) NOT NULL,
    transaction_hash character varying(128),
    auth_code character varying(10),
    error_message text,
    created_at timestamp with time zone,
    completed_at timestamp with time zone,
    expires_at timestamp with time zone
);


-- ============================================================================
-- 🏢 ORGANIZATIONS & NAMESPACES
-- ============================================================================

CREATE TABLE organizations (
    org_id text NOT NULL,
    namespace text NOT NULL,
    owner_public_key text,
    tier text,
    annual_fee numeric,
    gns_staked bigint,
    created_at timestamp without time zone,
    expires_at timestamp without time zone,
    stripe_customer_id text,
    auto_convert_to_fiat boolean,
    payout_bank_account text,
    payout_frequency text,
    metadata jsonb
);

CREATE TABLE org_registrations (
    id text NOT NULL,
    namespace text NOT NULL,
    organization_name text NOT NULL,
    email text NOT NULL,
    website text NOT NULL,
    domain text NOT NULL,
    description text,
    tier text NOT NULL,
    verification_code text NOT NULL,
    status text NOT NULL,
    public_key text,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    rejected_at timestamp with time zone,
    rejection_reason text,
    verified boolean,
    admin_pk text,
    updated_at timestamp with time zone
);

CREATE TABLE namespaces (
    namespace text NOT NULL,
    admin_pk text NOT NULL,
    created_at timestamp with time zone,
    organization_name character varying(200),
    domain character varying(255),
    tier character varying(20),
    member_count integer,
    member_limit integer,
    verified boolean,
    settings jsonb
);

CREATE TABLE namespace_registrations (
    id uuid NOT NULL,
    namespace text NOT NULL,
    organization_name text NOT NULL,
    website text,
    domain text NOT NULL,
    email text NOT NULL,
    description text,
    tier text NOT NULL,
    verification_code text NOT NULL,
    verified boolean,
    verified_at timestamp with time zone,
    admin_pk text,
    status text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    payment_id text,
    paid_until timestamp with time zone
);

CREATE TABLE namespace_members (
    id uuid NOT NULL,
    namespace text NOT NULL,
    handle text NOT NULL,
    member_pk text NOT NULL,
    role text,
    department text,
    status text,
    invited_by text,
    invited_at timestamp with time zone,
    joined_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    username character varying(50),
    public_key character varying(64),
    title character varying(100),
    avatar_url text,
    display_name character varying(100),
    invitation_id uuid,
    suspended_at timestamp with time zone
);

CREATE TABLE namespace_invitations (
    id uuid NOT NULL,
    namespace text NOT NULL,
    email character varying(255) NOT NULL,
    suggested_username character varying(50),
    role character varying(20),
    title character varying(100),
    department character varying(100),
    custom_message text,
    token character varying(64) NOT NULL,
    invited_by character varying(64) NOT NULL,
    invited_by_name character varying(100),
    status character varying(20),
    created_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    revoked_at timestamp with time zone,
    accepted_pk character varying(64),
    accepted_username character varying(50),
    email_sent_at timestamp with time zone,
    resend_count integer
);

CREATE TABLE namespace_audit_log (
    id uuid NOT NULL,
    namespace text NOT NULL,
    action character varying(50) NOT NULL,
    category character varying(20) NOT NULL,
    actor_pk character varying(64) NOT NULL,
    actor_handle character varying(80),
    actor_name character varying(100),
    target_pk character varying(64),
    target_handle character varying(80),
    target_name character varying(100),
    details jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone
);


-- ============================================================================
-- 🔐 AUTH & SECURITY
-- ============================================================================

CREATE TABLE oauth_clients (
    id uuid NOT NULL,
    client_id text NOT NULL,
    client_secret text,
    name text NOT NULL,
    redirect_uris _text NOT NULL,
    logo_uri text,
    confidential boolean,
    owner_pk text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE oauth_sessions (
    id uuid NOT NULL,
    session_id text NOT NULL,
    client_id text NOT NULL,
    redirect_uri text NOT NULL,
    scope text,
    state text,
    code_challenge text,
    code_challenge_method text,
    nonce text,
    status text,
    public_key text,
    handle text,
    authorization_code text,
    created_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL
);

CREATE TABLE fraud_events (
    id uuid NOT NULL,
    public_key text,
    event_type text NOT NULL,
    severity text,
    payment_id uuid,
    details jsonb,
    action_taken text,
    created_at timestamp without time zone
);

CREATE TABLE velocity_checks (
    id uuid NOT NULL,
    public_key text,
    breadcrumb_id uuid,
    previous_breadcrumb_id uuid,
    distance_km numeric,
    time_elapsed_seconds integer,
    speed_kmh numeric,
    valid boolean,
    rejection_reason text,
    created_at timestamp without time zone
);


-- ============================================================================
-- 🎮 GAMIFICATION & LOYALTY
-- ============================================================================

CREATE TABLE gns_achievements (
    id uuid NOT NULL,
    achievement_id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text NOT NULL,
    icon_url text,
    category character varying(50) NOT NULL,
    points_awarded integer NOT NULL,
    criteria_type character varying(50) NOT NULL,
    criteria_target numeric,
    is_active boolean,
    created_at timestamp with time zone
);

CREATE TABLE gns_user_achievements (
    id uuid NOT NULL,
    user_pk character varying(128) NOT NULL,
    achievement_id character varying(50) NOT NULL,
    progress numeric,
    is_unlocked boolean,
    unlocked_at timestamp with time zone,
    created_at timestamp with time zone
);

CREATE TABLE gns_rewards (
    id uuid NOT NULL,
    reward_id character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    image_url text,
    points_cost integer NOT NULL,
    type character varying(20) NOT NULL,
    discount_amount numeric,
    discount_percent numeric,
    merchant_id character varying(50),
    merchant_name character varying(100),
    is_available boolean,
    quantity_available integer,
    expires_at timestamp with time zone,
    categories _text,
    terms jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE gns_redemptions (
    id uuid NOT NULL,
    redemption_id character varying(20) NOT NULL,
    reward_id character varying(20) NOT NULL,
    reward_name character varying(100) NOT NULL,
    user_pk character varying(128) NOT NULL,
    points_spent integer NOT NULL,
    coupon_code character varying(20),
    is_used boolean,
    used_at timestamp with time zone,
    expires_at timestamp with time zone,
    merchant_id character varying(50),
    created_at timestamp with time zone
);

CREATE TABLE gns_loyalty_programs (
    id uuid NOT NULL,
    program_id character varying(20) NOT NULL,
    merchant_id character varying(50) NOT NULL,
    merchant_name character varying(100) NOT NULL,
    program_name character varying(100) NOT NULL,
    description text,
    logo_url text,
    points_per_dollar numeric NOT NULL,
    bonus_multiplier numeric,
    is_active boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE gns_loyalty_profiles (
    id uuid NOT NULL,
    user_pk character varying(128) NOT NULL,
    total_points integer NOT NULL,
    available_points integer NOT NULL,
    lifetime_points integer NOT NULL,
    tier character varying(20) NOT NULL,
    tier_progress integer NOT NULL,
    total_transactions integer NOT NULL,
    total_spent numeric NOT NULL,
    referred_by character varying(128),
    referral_code character varying(20),
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE gns_program_enrollments (
    id uuid NOT NULL,
    user_pk character varying(128) NOT NULL,
    program_id character varying(20) NOT NULL,
    merchant_id character varying(50) NOT NULL,
    points_earned integer,
    transactions_count integer,
    enrolled_at timestamp with time zone,
    last_activity timestamp with time zone
);

CREATE TABLE gns_point_transactions (
    id uuid NOT NULL,
    transaction_id character varying(20) NOT NULL,
    user_pk character varying(128) NOT NULL,
    points integer NOT NULL,
    type character varying(20) NOT NULL,
    description text NOT NULL,
    reference_id character varying(50),
    merchant_id character varying(50),
    merchant_name character varying(100),
    balance_after integer NOT NULL,
    created_at timestamp with time zone
);


-- ============================================================================
-- 💳 BILLING & INVOICING
-- ============================================================================

CREATE TABLE gns_invoices (
    invoice_id uuid NOT NULL,
    invoice_number character varying(32) NOT NULL,
    owner_pk character varying(64) NOT NULL,
    customer_name character varying(255),
    customer_email character varying(255),
    customer_handle character varying(64),
    customer_pk character varying(64),
    items jsonb NOT NULL,
    subtotal numeric NOT NULL,
    tax numeric,
    total numeric NOT NULL,
    currency character varying(8),
    status character varying(16),
    due_date date,
    notes text,
    sent_at timestamp with time zone,
    viewed_at timestamp with time zone,
    paid_at timestamp with time zone,
    transaction_id character varying(128),
    payment_method character varying(32),
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    merchant_id character varying(64),
    amount numeric
);

CREATE TABLE gns_invoice_templates (
    id uuid NOT NULL,
    template_id character varying(20) NOT NULL,
    merchant_id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    logo_url text,
    primary_color character varying(10),
    header_text text,
    footer_text text,
    terms text,
    is_default boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE gns_subscription_plans (
    id uuid NOT NULL,
    plan_id character varying(20) NOT NULL,
    merchant_id character varying(50) NOT NULL,
    merchant_name character varying(100) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    price numeric NOT NULL,
    currency character varying(12) NOT NULL,
    billing_cycle character varying(20) NOT NULL,
    trial_days integer,
    features _text,
    is_active boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE gns_subscriptions (
    id uuid NOT NULL,
    subscription_id character varying(20) NOT NULL,
    plan_id character varying(20) NOT NULL,
    user_id character varying(128) NOT NULL,
    merchant_id character varying(50) NOT NULL,
    merchant_name character varying(100) NOT NULL,
    plan_name character varying(100) NOT NULL,
    amount numeric NOT NULL,
    currency character varying(12) NOT NULL,
    billing_cycle character varying(20) NOT NULL,
    status character varying(20) NOT NULL,
    payment_method character varying(20),
    start_date timestamp with time zone NOT NULL,
    trial_end_date timestamp with time zone,
    current_period_start timestamp with time zone NOT NULL,
    current_period_end timestamp with time zone NOT NULL,
    next_billing_date timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancel_at_period_end boolean,
    paused_at timestamp with time zone,
    failed_payment_attempts integer,
    last_payment_date timestamp with time zone,
    last_payment_id character varying(50),
    auto_renew boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE gns_subscription_invoices (
    id uuid NOT NULL,
    invoice_id character varying(20) NOT NULL,
    subscription_id character varying(20) NOT NULL,
    amount numeric NOT NULL,
    currency character varying(12) NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    status character varying(20) NOT NULL,
    payment_id character varying(50),
    paid_at timestamp with time zone,
    failure_reason text,
    created_at timestamp with time zone
);


-- ============================================================================
-- 📊 FINANCIAL TOOLS
-- ============================================================================

CREATE TABLE gns_budgets (
    id uuid NOT NULL,
    budget_id character varying(20) NOT NULL,
    user_pk character varying(128) NOT NULL,
    name character varying(100) NOT NULL,
    amount numeric NOT NULL,
    period character varying(20) NOT NULL,
    category character varying(50),
    merchant_id character varying(50),
    alert_enabled boolean,
    alert_threshold numeric,
    period_start date,
    period_end date,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE gns_savings_goals (
    id uuid NOT NULL,
    goal_id character varying(20) NOT NULL,
    user_pk character varying(128) NOT NULL,
    name character varying(100) NOT NULL,
    target_amount numeric NOT NULL,
    current_amount numeric,
    target_date date,
    image_url text,
    is_completed boolean,
    completed_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE gns_savings_contributions (
    id uuid NOT NULL,
    goal_id character varying(20) NOT NULL,
    user_pk character varying(128) NOT NULL,
    amount numeric NOT NULL,
    balance_after numeric NOT NULL,
    created_at timestamp with time zone
);

CREATE TABLE gns_transaction_categories (
    id uuid NOT NULL,
    settlement_id text NOT NULL,
    user_pk character varying(128) NOT NULL,
    category character varying(50) NOT NULL,
    confidence numeric,
    is_manual boolean,
    created_at timestamp with time zone
);

CREATE TABLE gns_currency_preferences (
    id uuid NOT NULL,
    user_pk character varying(128) NOT NULL,
    default_currency character varying(12),
    display_currency character varying(12),
    favorite_assets _text,
    show_small_balances boolean,
    small_balance_threshold numeric,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE gns_exchange_rates (
    id uuid NOT NULL,
    from_asset character varying(12) NOT NULL,
    to_asset character varying(12) NOT NULL,
    rate numeric NOT NULL,
    source character varying(50),
    timestamp timestamp with time zone
);

CREATE TABLE gns_assets (
    id uuid NOT NULL,
    asset_id character varying(100) NOT NULL,
    code character varying(12) NOT NULL,
    issuer character varying(56),
    type character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    symbol character varying(10) NOT NULL,
    decimals integer,
    icon_url text,
    is_verified boolean,
    anchor_domain character varying(100),
    description text,
    is_active boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


-- ============================================================================
-- ⭐ STELLAR
-- ============================================================================

CREATE TABLE stellar_funding_requests (
    id uuid NOT NULL,
    gns_public_key text NOT NULL,
    stellar_public_key text NOT NULL,
    handle text,
    amount_xlm numeric NOT NULL,
    reason text NOT NULL,
    status text NOT NULL,
    stellar_tx_hash text,
    error_message text,
    created_at timestamp with time zone NOT NULL,
    processed_at timestamp with time zone
);

CREATE TABLE fiat_wallets (
    id uuid NOT NULL,
    public_key text,
    provider text,
    provider_wallet_id text,
    currency text NOT NULL,
    balance numeric,
    bank_account_id text,
    plaid_access_token text,
    auto_convert boolean,
    created_at timestamp without time zone,
    last_synced_at timestamp without time zone
);


-- ============================================================================
-- 🔔 NOTIFICATIONS & DEVICES
-- ============================================================================

CREATE TABLE gns_notifications (
    id uuid NOT NULL,
    notification_id character varying(20) NOT NULL,
    user_pk character varying(128) NOT NULL,
    type character varying(50) NOT NULL,
    title character varying(200) NOT NULL,
    body text NOT NULL,
    data jsonb,
    priority character varying(10),
    channel character varying(20) NOT NULL,
    image_url text,
    action_url text,
    is_read boolean,
    read_at timestamp with time zone,
    created_at timestamp with time zone
);

CREATE TABLE gns_notification_preferences (
    id uuid NOT NULL,
    user_pk character varying(128) NOT NULL,
    payment_received boolean,
    payment_sent boolean,
    payment_failed boolean,
    payment_request boolean,
    refund_updates boolean,
    points_earned boolean,
    tier_upgrade boolean,
    reward_available boolean,
    achievement_unlocked boolean,
    subscription_reminders boolean,
    security_alerts boolean,
    system_updates boolean,
    marketing_messages boolean,
    quiet_hours_enabled boolean,
    quiet_hours_start integer,
    quiet_hours_end integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE gns_devices (
    id uuid NOT NULL,
    user_pk character varying(128) NOT NULL,
    device_id character varying(100) NOT NULL,
    push_token text NOT NULL,
    platform character varying(20) NOT NULL,
    device_name character varying(100),
    is_active boolean,
    registered_at timestamp with time zone,
    last_active timestamp with time zone
);


-- ============================================================================
-- 🔗 WEBHOOKS
-- ============================================================================

CREATE TABLE gns_webhook_endpoints (
    id uuid NOT NULL,
    endpoint_id character varying(20) NOT NULL,
    merchant_id character varying(50) NOT NULL,
    url text NOT NULL,
    description text,
    events _text NOT NULL,
    secret character varying(100) NOT NULL,
    is_active boolean,
    success_count integer,
    failure_count integer,
    last_delivery_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

CREATE TABLE gns_webhook_events (
    id uuid NOT NULL,
    event_id character varying(20) NOT NULL,
    merchant_id character varying(50) NOT NULL,
    type character varying(50) NOT NULL,
    data jsonb NOT NULL,
    related_id character varying(50),
    created_at timestamp with time zone
);

CREATE TABLE gns_webhook_deliveries (
    id uuid NOT NULL,
    delivery_id character varying(20) NOT NULL,
    endpoint_id character varying(20) NOT NULL,
    event_id character varying(20) NOT NULL,
    status character varying(20) NOT NULL,
    http_status integer,
    response_body text,
    duration_ms integer,
    error_message text,
    attempt_number integer,
    next_retry_at timestamp with time zone,
    attempted_at timestamp with time zone
);


-- ============================================================================
-- 📧 EMAIL
-- ============================================================================

CREATE TABLE domain_mappings (
    id uuid NOT NULL,
    namespace text NOT NULL,
    domain character varying(255) NOT NULL,
    status character varying(20),
    mx_verified boolean,
    spf_verified boolean,
    dkim_verified boolean,
    dmarc_verified boolean,
    gns_verified boolean,
    dkim_selector character varying(50),
    dkim_public_key text,
    inbound_enabled boolean,
    outbound_enabled boolean,
    catch_all_enabled boolean,
    catch_all_target character varying(50),
    verified_at timestamp with time zone,
    last_check_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


-- ============================================================================
-- 🔄 SYNC
-- ============================================================================

CREATE TABLE sync_state (
    peer_id text NOT NULL,
    peer_url text NOT NULL,
    last_sync_at timestamp with time zone,
    last_records_at timestamp with time zone,
    last_aliases_at timestamp with time zone,
    last_epochs_at timestamp with time zone,
    status text NOT NULL,
    error_count integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


-- ============================================================================
-- 📎 MEDIA
-- ============================================================================

CREATE TABLE media (
    id uuid NOT NULL,
    owner_pk text NOT NULL,
    owner_handle text,
    filename text NOT NULL,
    mime_type text NOT NULL,
    size_bytes integer NOT NULL,
    width integer,
    height integer,
    storage_url text NOT NULL,
    storage_key text NOT NULL,
    usage_type text,
    entity_id text,
    alt_text text,
    caption text,
    uploaded_at timestamp with time zone
);


-- ============================================================================
-- 📈 VIEWS & SUMMARIES (read-only, auto-generated)
-- ============================================================================

CREATE TABLE v_identities (
    pk_root text,
    handle text,
    trust_score numeric,
    breadcrumb_count integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    epoch_count bigint
);

CREATE TABLE v_pending_messages (
    to_pk text,
    pending_count bigint,
    oldest_message timestamp with time zone,
    newest_message timestamp with time zone
);

CREATE TABLE active_subscriptions_summary (
    user_id character varying(128),
    active_count bigint,
    monthly_total numeric,
    next_payment timestamp with time zone
);

CREATE TABLE merchant_daily_summaries (
    merchant_id text,
    settlement_date date,
    asset_code text,
    transaction_count bigint,
    total_amount numeric,
    total_fees numeric,
    successful_count bigint,
    failed_count bigint
);

CREATE TABLE refund_summary (
    merchant_id character varying(50),
    pending_count bigint,
    completed_count bigint,
    rejected_count bigint,
    total_refunded numeric,
    avg_processing_hours numeric
);

CREATE TABLE user_loyalty_summary (
    user_pk character varying(128),
    tier character varying(20),
    available_points integer,
    lifetime_points integer,
    total_transactions integer,
    total_spent numeric,
    enrolled_programs bigint,
    achievements_unlocked bigint
);

CREATE TABLE user_spending_summaries (
    user_pk text,
    month timestamp with time zone,
    currency text,
    transaction_count bigint,
    total_spent numeric,
    unique_merchants bigint
);

CREATE TABLE user_spending_summary (
    user_pk text,
    month timestamp with time zone,
    total_spent numeric,
    transaction_count bigint,
    average_transaction numeric
);


-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
