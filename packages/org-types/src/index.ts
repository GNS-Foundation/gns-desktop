// ============================================
// @gns/org-types - GNS Organization Identity System
// ============================================
// Shared TypeScript types for namespace registration,
// member management, domain mapping, and billing
// ============================================

// ============================================
// NAMESPACE TYPES
// ============================================

export type NamespaceTier = 'starter' | 'team' | 'business' | 'enterprise';
export type NamespaceStatus = 'pending' | 'verified' | 'paid' | 'active' | 'suspended' | 'expired';

export interface Namespace {
  id: string;
  namespace: string;
  organizationName: string;
  adminPk: string;
  tier: NamespaceTier;
  memberLimit: number;
  memberCount: number;
  verified: boolean;
  domain?: string;
  settings: NamespaceSettings;
  metadata: NamespaceMetadata;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface NamespaceSettings {
  allowSelfRegistration: boolean;
  requireDomainEmail: boolean;
  allowedEmailDomains: string[];
  defaultRole: 'member' | 'admin';
  requireApproval: boolean;
  logoUrl?: string;
  primaryColor?: string;
}

export interface NamespaceMetadata {
  registeredBy: string;
  registrationIp?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export interface NamespaceRegistration {
  id: string;
  namespace: string;
  organizationName: string;
  domain: string;
  website?: string;
  email: string;
  description?: string;
  tier: NamespaceTier;
  verificationCode: string;
  verified: boolean;
  verifiedAt?: string;
  status: NamespaceStatus;
  adminPk?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TierInfo {
  id: NamespaceTier;
  name: string;
  price: number;
  memberLimit: number;
  features: string[];
  recommended?: boolean;
}

export const TIER_INFO: Record<NamespaceTier, TierInfo> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 49,
    memberLimit: 10,
    features: ['Up to 10 members', 'Professional email', 'E2E encryption', 'Basic support'],
  },
  team: {
    id: 'team',
    name: 'Team',
    price: 149,
    memberLimit: 50,
    features: ['Up to 50 members', 'Professional email', 'E2E encryption', 'Audit log', 'Priority support'],
    recommended: true,
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 299,
    memberLimit: 200,
    features: ['Up to 200 members', 'Professional email', 'E2E encryption', 'Audit log', 'API access', 'Premium support'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 0,
    memberLimit: 100000,
    features: ['Unlimited members', 'Self-hosted option', 'SLA', 'Dedicated support'],
  },
};

export const RESERVED_NAMESPACES = new Set([
  'gns', 'gcrumbs', 'globecrumbs', 'admin', 'support', 'help',
  'root', 'system', 'api', 'www', 'mail', 'email', 'ftp',
  'test', 'demo', 'staging', 'dev', 'prod', 'official',
  'security', 'abuse', 'postmaster', 'webmaster', 'noreply',
]);

export const PROTECTED_NAMESPACES = new Set([
  'google', 'facebook', 'meta', 'apple', 'microsoft', 'amazon',
  'twitter', 'x', 'instagram', 'tiktok', 'youtube', 'linkedin',
  'netflix', 'spotify', 'uber', 'airbnb', 'stripe', 'anthropic',
]);

export interface NamespaceCheckResult {
  available: boolean;
  namespace: string;
  reason?: string;
  protected?: boolean;
  requiresTier?: NamespaceTier;
}

export interface RegisterNamespaceRequest {
  namespace: string;
  organizationName: string;
  domain: string;
  website?: string;
  email: string;
  description?: string;
  tier: NamespaceTier;
}

export interface RegisterNamespaceResponse {
  registrationId: string;
  namespace: string;
  domain: string;
  verificationCode: string;
  dnsInstructions: DnsInstructions;
}

export interface ActivateNamespaceRequest {
  namespace: string;
  adminPk: string;
  email: string;
  signature?: string;
  timestamp?: string;
}

export interface ActivateNamespaceResponse {
  namespace: string;
  organizationName: string;
  tier: NamespaceTier;
  memberLimit: number;
  adminHandle: string;
  adminEmail: string;
}

// ============================================
// MEMBER TYPES
// ============================================

export type MemberRole = 'owner' | 'admin' | 'member';
export type MemberStatus = 'active' | 'suspended' | 'invited';

export interface Member {
  id: string;
  namespace: string;
  username: string;
  publicKey: string;
  handle: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  displayName?: string;
  title?: string;
  department?: string;
  avatarUrl?: string;
  invitedBy?: string;
  joinedAt: string;
  updatedAt: string;
}

export interface MemberListItem {
  username: string;
  handle: string;
  email: string;
  publicKey: string;
  role: MemberRole;
  status: MemberStatus;
  displayName?: string;
  title?: string;
  avatarUrl?: string;
  joinedAt: string;
}

export interface MemberListResponse {
  members: MemberListItem[];
  memberCount: number;
  memberLimit: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface CreateMemberRequest {
  email: string;
  suggestedUsername?: string;
  role?: MemberRole;
  title?: string;
  department?: string;
  sendInvite?: boolean;
}

export interface UpdateMemberRequest {
  role?: MemberRole;
  status?: MemberStatus;
  title?: string;
  department?: string;
  displayName?: string;
}

export interface RemoveMemberRequest {
  reason?: string;
  revokeImmediately?: boolean;
  notifyMember?: boolean;
}

export interface ResolvedIdentity {
  publicKey: string;
  handle: string;
  email: string;
  type: 'individual' | 'org_member';
  namespace?: string;
  organization?: {
    name: string;
    domain: string;
    verified: boolean;
  };
  profile?: {
    displayName?: string;
    avatarUrl?: string;
    title?: string;
  };
}

export interface MemberSearchOptions {
  query?: string;
  role?: MemberRole;
  status?: MemberStatus;
  department?: string;
  sortBy?: 'username' | 'joinedAt' | 'displayName' | 'role';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  cursor?: string;
}

export const ROLE_PERMISSIONS: Record<MemberRole, Record<string, boolean>> = {
  owner: {
    canInviteMembers: true,
    canRemoveMembers: true,
    canChangeRoles: true,
    canManageSettings: true,
    canManageBilling: true,
    canManageDomain: true,
    canViewAuditLog: true,
    canDeleteNamespace: true,
    canTransferOwnership: true,
  },
  admin: {
    canInviteMembers: true,
    canRemoveMembers: true,
    canChangeRoles: true,
    canManageSettings: true,
    canManageBilling: false,
    canManageDomain: false,
    canViewAuditLog: true,
    canDeleteNamespace: false,
    canTransferOwnership: false,
  },
  member: {
    canInviteMembers: false,
    canRemoveMembers: false,
    canChangeRoles: false,
    canManageSettings: false,
    canManageBilling: false,
    canManageDomain: false,
    canViewAuditLog: false,
    canDeleteNamespace: false,
    canTransferOwnership: false,
  },
};

// ============================================
// INVITATION TYPES
// ============================================

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Invitation {
  id: string;
  namespace: string;
  email: string;
  suggestedUsername?: string;
  role: MemberRole;
  token: string;
  invitedBy: string;
  invitedByName?: string;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  acceptedPk?: string;
  acceptedUsername?: string;
}

export interface InvitationListItem {
  id: string;
  email: string;
  suggestedUsername?: string;
  role: MemberRole;
  status: InvitationStatus;
  invitedByName?: string;
  createdAt: string;
  expiresAt: string;
}

export interface InvitationListResponse {
  invitations: InvitationListItem[];
  total: number;
  pending: number;
}

export interface CreateInvitationRequest {
  email: string;
  suggestedUsername?: string;
  role?: MemberRole;
  title?: string;
  department?: string;
  message?: string;
  expiresInDays?: number;
}

export interface CreateInvitationResponse {
  invitationId: string;
  email: string;
  inviteUrl: string;
  expiresAt: string;
}

export interface InvitationDetails {
  namespace: string;
  organizationName: string;
  organizationLogo?: string;
  suggestedUsername?: string;
  role: MemberRole;
  invitedByName?: string;
  expiresAt: string;
  isExpired: boolean;
  isRevoked: boolean;
}

export interface AcceptInvitationRequest {
  token: string;
  username: string;
  publicKey: string;
  signature: string;
  timestamp: string;
  displayName?: string;
}

export interface AcceptInvitationResponse {
  success: boolean;
  handle: string;
  email: string;
  namespace: string;
  organizationName: string;
  role: MemberRole;
}

export interface BulkInviteRequest {
  emails: string[];
  role?: MemberRole;
  message?: string;
}

export interface BulkInviteResponse {
  total: number;
  sent: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}

export function validateUsername(username: string): string[] {
  const errors: string[] = [];
  if (!username) return ['Username is required'];
  if (username.length < 3) errors.push('Username must be at least 3 characters');
  if (username.length > 30) errors.push('Username cannot exceed 30 characters');
  if (!/^[a-z0-9][a-z0-9_-]*[a-z0-9]$|^[a-z0-9]$/.test(username)) {
    errors.push('Username must start/end with letter/number');
  }
  const reserved = ['admin', 'root', 'system', 'support', 'help'];
  if (reserved.includes(username.toLowerCase())) errors.push('Username reserved');
  return errors;
}

export function suggestUsernames(email: string): string[] {
  const local = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  if (local.length < 3) return [];
  return [local, `${local}1`, `${local}${new Date().getFullYear() % 100}`].slice(0, 3);
}

// ============================================
// DOMAIN TYPES
// ============================================

export type DomainVerificationStatus = 'pending' | 'verified' | 'failed' | 'expired';
export type DnsRecordType = 'MX' | 'TXT' | 'CNAME';

export interface DomainMapping {
  id: string;
  namespace: string;
  domain: string;
  status: DomainVerificationStatus;
  mxVerified: boolean;
  spfVerified: boolean;
  dkimVerified: boolean;
  dmarcVerified: boolean;
  dkimSelector: string;
  dkimPublicKey?: string;
  verifiedAt?: string;
  lastCheckAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DnsRecord {
  type: DnsRecordType;
  host: string;
  name: string;
  value: string;
  priority?: number;
  ttl: number;
  verified: boolean;
  error?: string;
}

export interface DnsInstructions {
  verification: DnsRecord;
  mx: DnsRecord;
  spf: DnsRecord;
  dkim: DnsRecord;
  dmarc: DnsRecord;
}

export interface DomainDnsConfig {
  domain: string;
  records: DnsInstructions;
  allVerified: boolean;
  emailReady: boolean;
}

export interface DomainStatusResponse {
  domain: string;
  namespace: string;
  status: DomainVerificationStatus;
  config: DomainDnsConfig;
  lastCheckAt?: string;
}

export interface VerifyDomainResponse {
  success: boolean;
  domain: string;
  status: DomainVerificationStatus;
  records: Record<string, { verified: boolean; error?: string }>;
  allVerified: boolean;
  emailReady: boolean;
}

export interface EmailRoutingConfig {
  domain: string;
  namespace: string;
  inboundEnabled: boolean;
  outboundEnabled: boolean;
  catchAllEnabled: boolean;
  catchAllTarget?: string;
}

export function generateDnsInstructions(domain: string, verificationCode: string, dkimPublicKey?: string): DnsInstructions {
  return {
    verification: {
      type: 'TXT',
      host: `_gns.${domain}`,
      name: '_gns',
      value: `gns-verify=${verificationCode}`,
      ttl: 3600,
      verified: false,
    },
    mx: {
      type: 'MX',
      host: domain,
      name: '@',
      value: 'mx.gcrumbs.com',
      priority: 10,
      ttl: 3600,
      verified: false,
    },
    spf: {
      type: 'TXT',
      host: domain,
      name: '@',
      value: 'v=spf1 include:_spf.gcrumbs.com ~all',
      ttl: 3600,
      verified: false,
    },
    dkim: {
      type: 'TXT',
      host: `gns._domainkey.${domain}`,
      name: 'gns._domainkey',
      value: dkimPublicKey ? `v=DKIM1; k=rsa; p=${dkimPublicKey}` : 'PENDING',
      ttl: 3600,
      verified: false,
    },
    dmarc: {
      type: 'TXT',
      host: `_dmarc.${domain}`,
      name: '_dmarc',
      value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@gcrumbs.com',
      ttl: 3600,
      verified: false,
    },
  };
}

// ============================================
// BILLING TYPES
// ============================================

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'unpaid' | 'trialing';

export interface Subscription {
  id: string;
  namespace: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  tier: NamespaceTier;
  status: SubscriptionStatus;
  pricePerYear: number;
  currency: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
}

export interface Invoice {
  id: string;
  stripeInvoiceId: string;
  namespace: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void';
  periodStart: string;
  periodEnd: string;
  invoicePdf?: string;
  createdAt: string;
}

export interface BillingOverview {
  subscription: Subscription | null;
  currentPlan: { tier: NamespaceTier; name: string; price: number; memberLimit: number };
  usage: { membersUsed: number; membersLimit: number; percentUsed: number };
  upcomingInvoice?: { amountDue: number; currency: string; dueDate: string };
}

export interface CreateCheckoutRequest {
  namespace: string;
  tier: NamespaceTier;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutResponse {
  checkoutUrl: string;
  sessionId: string;
}

export interface ChangeTierRequest {
  namespace: string;
  newTier: NamespaceTier;
}

export interface ChangeTierResponse {
  success: boolean;
  previousTier: NamespaceTier;
  newTier: NamespaceTier;
  effectiveDate: string;
  newMemberLimit: number;
}

export function formatPrice(cents: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

export function calculateSavings(tier: NamespaceTier, memberCount: number) {
  const googlePerUserPerYear = 72;
  const gnsPricing: Record<NamespaceTier, number> = { starter: 49, team: 149, business: 299, enterprise: 999 };
  const googleCost = memberCount * googlePerUserPerYear;
  const gnsCost = gnsPricing[tier];
  return { googleCost, gnsCost, savings: googleCost - gnsCost, percentSaved: Math.round(((googleCost - gnsCost) / googleCost) * 100) };
}

// ============================================
// AUDIT TYPES
// ============================================

export type AuditCategory = 'namespace' | 'member' | 'invitation' | 'domain' | 'billing' | 'settings' | 'security';

export type AuditAction =
  | 'namespace.created' | 'namespace.activated' | 'namespace.suspended'
  | 'member.invited' | 'member.joined' | 'member.updated' | 'member.role_changed' | 'member.removed'
  | 'invitation.created' | 'invitation.accepted' | 'invitation.revoked'
  | 'domain.added' | 'domain.verified' | 'domain.removed'
  | 'billing.subscription_created' | 'billing.tier_upgraded' | 'billing.payment_succeeded'
  | 'settings.updated' | 'security.owner_transferred';

export interface AuditEntry {
  id: string;
  namespace: string;
  action: AuditAction;
  category: AuditCategory;
  actorPk: string;
  actorHandle?: string;
  actorName?: string;
  targetPk?: string;
  targetHandle?: string;
  targetName?: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export interface AuditLogResponse {
  entries: AuditEntry[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface AuditLogFilters {
  category?: AuditCategory;
  action?: AuditAction;
  actorPk?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  cursor?: string;
}

// ============================================
// COMMON TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export function parseHandle(handle: string): { namespace?: string; username: string } {
  if (handle.startsWith('@')) handle = handle.slice(1);
  if (handle.includes('@')) {
    const [namespace, username] = handle.split('@');
    return { namespace, username };
  }
  return { username: handle };
}

export function formatHandle(namespace: string | undefined, username: string): string {
  return namespace ? `${namespace}@${username}` : `@${username}`;
}

export function handleToEmail(handle: string, domain: string): string {
  const { namespace, username } = parseHandle(handle);
  return namespace ? `${username}@${domain}` : `${username}@gcrumbs.com`;
}

export function emailToHandle(email: string, namespace: string): string {
  const [username] = email.split('@');
  return `${namespace}@${username}`;
}
