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
  creator_pk: PublicKey;
  to_pk: PublicKey;
  to_handle?: string;
  amount: string;
  currency: string;
  memo?: string;
  reference_id?: string;
  callback_url?: string;
  status: PaymentStatus;
  from_pk?: string;
  stellar_tx_hash?: string;
  created_at: string;
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
