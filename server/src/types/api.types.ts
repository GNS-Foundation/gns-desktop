// ===========================================
// GNS API TYPES - Generated from OpenAPI Spec
// ===========================================

// ===========================================
// CORE TYPES
// ===========================================

export type PublicKey = string; // 64-char hex
export type Handle = string;   // @username format
export type Signature = string; // 128-char hex

export type VerificationLevel = 'none' | 'basic' | 'standard' | 'advanced' | 'maximum';

// ===========================================
// API RESPONSE TYPES
// ===========================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

// ===========================================
// IDENTITY TYPES
// ===========================================

export interface Identity {
  public_key: PublicKey;
  handle?: Handle;
  gns_id?: string;
  trust_score: number;
  breadcrumb_count: number;
  encryption_key?: string;
  created_at: string;
  facets?: string[];
}

export interface IdentityResolution {
  resolved: boolean;
  public_key: PublicKey;
  handle?: Handle;
  encryption_key?: string;
  trust_score?: number;
  breadcrumb_count?: number;
  gsite_url?: string;
  facets?: Record<string, boolean>;
}

// ===========================================
// PROOF OF HUMANITY TYPES
// ===========================================

export interface ProofOfHumanity {
  verified: boolean;
  public_key: PublicKey;
  handle?: Handle;
  trust_score: number;
  breadcrumb_count: number;
  trajectory_days?: number;
  proof_hash?: string;
  verified_since?: string;
  verification_level: VerificationLevel;
  chain_valid: boolean;
  last_activity?: string;
}

export interface VerificationChallenge {
  challenge_id: string;
  challenge: string;
  expires_at: string;
  required_h3_cells?: string[];
}

export interface CreateChallengeRequest {
  public_key: PublicKey;
  require_fresh_breadcrumb?: boolean;
  allowed_h3_cells?: string[];
  expires_in?: number;
}

export interface SubmitChallengeRequest {
  public_key: PublicKey;
  signature: Signature;
  fresh_breadcrumb?: {
    h3_cell: string;
    timestamp: string;
    signature: Signature;
  };
}

// ===========================================
// OAUTH / OIDC TYPES
// ===========================================

export interface OAuthClient {
  client_id: string;
  client_secret?: string;
  name: string;
  redirect_uris: string[];
  logo_uri?: string;
  tos_uri?: string;
  policy_uri?: string;
  confidential: boolean;
  owner_pk: PublicKey;
  created_at: string;
}

export interface OAuthSession {
  id: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  nonce?: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  public_key?: PublicKey;
  handle?: Handle;
  created_at: string;
  expires_at: string;
}

export interface AuthorizationCode {
  code: string;
  client_id: string;
  public_key: PublicKey;
  handle?: Handle;
  scope: string;
  redirect_uri: string;
  code_challenge?: string;
  nonce?: string;
  created_at: number;
  expires_at: number;
}

export interface RefreshToken {
  token: string;
  public_key: PublicKey;
  client_id: string;
  scope: string;
  created_at: number;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
}

export interface OIDCUserInfo {
  sub: string;
  handle?: string;
  preferred_username?: string;
  trust_score?: number;
  verified?: boolean;
  breadcrumb_count?: number;
  updated_at?: number;
}

export interface OIDCDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  code_challenge_methods_supported: string[];
}

// ===========================================
// WEBHOOK TYPES
// ===========================================

export type WebhookEventType =
  | 'handle.claimed'
  | 'handle.transferred'
  | 'message.received'
  | 'message.read'
  | 'payment.received'
  | 'payment.sent'
  | 'payment.request.created'
  | 'payment.request.completed'
  | 'payment.request.expired'
  | 'trust.threshold.reached'
  | 'facet.activated'
  | 'facet.deactivated'
  | 'gsite.updated'
  | 'org.member.added'
  | 'org.member.removed';

export interface WebhookSubscription {
  id: string;
  owner_pk: PublicKey;
  target_url: string;
  events: WebhookEventType[];
  for_handle?: Handle;
  secret_hash: string; // Store hashed, not plaintext
  active: boolean;
  created_at: string;
  last_triggered_at?: string;
  failure_count: number;
}

export interface WebhookEvent {
  id: string;
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface WebhookDelivery {
  id: string;
  subscription_id: string;
  event_id: string;
  status: 'pending' | 'delivered' | 'failed';
  response_code?: number;
  response_time_ms?: number;
  error?: string;
  attempt: number;
  created_at: string;
}

export interface CreateWebhookRequest {
  target_url: string;
  events: WebhookEventType[];
  for_handle?: Handle;
  secret: string;
}

// ===========================================
// PAYMENT TYPES
// ===========================================

export type PaymentStatus = 'pending' | 'completed' | 'expired' | 'cancelled' | 'failed';
export type PaymentCurrency = 'GNS' | 'XLM' | 'USDC' | 'EUR' | 'BTC';

export interface PaymentRequest {
  to: PublicKey | Handle;
  amount: string;
  currency: PaymentCurrency;
  memo?: string;
  reference_id?: string;
  callback_url?: string;
  expires_in?: number;
}

export interface PaymentResponse {
  payment_id: string;
  status: PaymentStatus;
  from_pk?: PublicKey;
  from_handle?: Handle;
  to_pk: PublicKey;
  to_handle?: Handle;
  amount: string;
  currency: PaymentCurrency;
  memo?: string;
  reference_id?: string;
  qr_url: string;
  deep_link: string;
  web_url: string;
  stellar_tx_hash?: string;
  created_at: string;
  expires_at: string;
  completed_at?: string;
}

export interface DbPaymentRequest {
  id: string;
  payment_id: string;
  creator_pk: string;
  from_pk?: string;
  to_pk?: string;
  to_handle?: string;
  amount: string;
  currency: string;
  status: string;
  metadata?: any;
  memo?: string;
  reference_id?: string;
  callback_url?: string;
  stellar_tx_hash?: string;
  created_at: string;
  updated_at?: string;
  expires_at: string;
  completed_at?: string;
}

export interface Balance {
  asset_code: string;
  asset_issuer?: string;
  balance: string;
  is_native: boolean;
}

// ===========================================
// ORGANIZATION TYPES
// ===========================================

export type OrgType = 'company' | 'foundation' | 'government' | 'community';

export interface Organization {
  namespace: string;
  name: string;
  owner_pk: PublicKey;
  org_type: OrgType;
  verified: boolean;
  domain?: string;
  member_count: number;
  created_at: string;
}

export interface OrgMember {
  public_key: PublicKey;
  handle?: Handle;
  role?: string;
  department?: string;
  authorized_at: string;
  authorized_by: PublicKey;
}

// ===========================================
// EXPRESS REQUEST EXTENSIONS
// ===========================================

import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  gnsPublicKey?: string;
  gnsHandle?: string;
  gnsSession?: {
    publicKey: string;
    handle?: string;
    scope?: string;
  };
}

// ===========================================
// PAYMENT & MERCHANT EXTENDED TYPES
// ===========================================

export interface RedemptionInput {
  redemption_id?: string;
  reward_id: string;
  reward_name: string;
  user_pk: string;
  points_spent: number;
  merchant_id?: string;
  expires_at?: string;
  coupon_code?: string;
}

export interface MerchantInput {
  merchant_id: string;
  owner_pk?: string;
  name: string;
  display_name?: string;
  stellar_address: string;
  category?: string;
  status?: string;
  email: string;
  phone?: string;
  website?: string;
  address?: string;
  h3_cell?: string;
  accepted_currencies?: string[];
  settlement_currency?: string;
  instant_settlement?: boolean;
  api_key_hash?: string;
  logo_url?: string;
}

export interface SettlementInput {
  settlement_id: string;
  merchant_id: string;
  user_pk: string;
  amount: string;
  currency?: string;
  asset_code: string;
  request_id: string;
  h3_cell?: string;
  from_stellar_address: string;
  to_stellar_address: string;
  memo?: string;
  order_id?: string;
  status?: string;
}

export interface SettlementCompletionInput {
  settlement_id: string;
  stellar_tx_hash: string;
  completed_at: string;
  merchant_id?: string;
  request_id?: string;
}

export interface ReceiptInput {
  receipt_id: string;
  settlement_id?: string;
  merchant_id: string;
  merchant_name: string;
  user_pk: string;
  amount: string;
  currency: string;
  order_id?: string;
  stellar_tx_hash?: string;
  transaction_hash?: string;
  items?: any[];
  status?: string;
  timestamp?: string;
  metadata?: any;
}

export interface RefundInput {
  refund_id: string;
  settlement_id: string;
  original_receipt_id?: string;
  original_transaction_hash?: string;
  merchant_id: string;
  user_pk: string;
  original_amount: string;
  refund_amount: string;
  currency: string;
  reason: string;
  reason_details?: string | null;
  status: string;
}

export interface SubscriptionInput {
  user_pk: string;
  plan_id: string;
  plan_name?: string;
  merchant_id?: string;
  merchant_name?: string;
  amount: number;
  currency: string;
  billing_cycle: string;
  next_billing_date: string;
  payment_method?: string;
  trial_days?: number;
}

export interface PaymentCompletionInput {
  request_id: string;
  merchant_id: string;
  user_pk: string;
  transaction_hash: string;
  amount: string;
  currency: string;
  order_id?: string;
  completed_at: string;
}

export interface LoyaltyProfileInput {
  user_pk: string;
  total_points?: number;
  available_points?: number;
  lifetime_points?: number;
  tier?: string;
  tier_progress?: number;
  total_transactions?: number;
  total_spent?: number;
}

export interface PointTransactionInput {
  transaction_id: string;
  user_pk: string;
  points: number;
  type: string;
  description: string;
  reference_id?: string;
  merchant_id?: string;
  merchant_name?: string;
  balance_after: number;
}

export interface WebhookEventFilter {
  status?: string;
  limit?: number;
  eventId?: string;
  event_id?: string;
  event_type?: string;
  type?: string;
  offset?: number;
}

export interface PaymentLinkInput {
  merchant_id?: string;
  owner_pk?: string;
  type?: string;
  amount?: number;
  currency: string;
  description?: string;
  is_reusable?: boolean;
  expires_at?: string | null;
  short_code?: string;
  fixed_amount?: number;
  min_amount?: number;
  max_amount?: number;
  title?: string;
  max_payments?: number;
  collect_email?: boolean;
  collect_phone?: boolean;
  metadata?: any;
}

export interface LinkPaymentInput {
  link_id: string;
  payer_pk?: string;
  payer_public_key?: string;
  payer_email?: string;
  amount: number;
  currency: string;
  stellar_tx_hash?: string;
  payer_phone?: string;
}

export interface InvoiceInput {
  merchant_id?: string;
  owner_pk?: string;
  customer_pk?: string;
  customer_public_key?: string;
  customer_email?: string;
  customer_handle?: string;
  customer_name?: string;
  amount: number;
  currency: string;
  due_date?: string;
  items?: any[];
  line_items?: any[];
  subtotal?: number;
  total_discount?: number;
  total_tax?: number;
  total?: number;
  notes?: string;
  terms?: string;
  due_days?: number;
}

export interface QrCodeInput {
  user_pk?: string;
  owner_pk?: string;
  merchant_id?: string;
  type: string;
  reference?: string;
  amount?: number;
  currency?: string;
  data: any;
  memo?: string;
  default_memo?: string;
  expires_at?: string;
  single_use?: boolean;
}
