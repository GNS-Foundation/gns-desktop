// ============================================
// @gns/org-api - GNS Organization API Client
// ============================================
// Complete API client for organization identity management
// ============================================

import type {
  Namespace,
  NamespaceCheckResult,
  RegisterNamespaceRequest,
  RegisterNamespaceResponse,
  ActivateNamespaceRequest,
  ActivateNamespaceResponse,
  NamespaceSettings,
  Member,
  MemberListResponse,
  MemberSearchOptions,
  UpdateMemberRequest,
  ResolvedIdentity,
  Invitation,
  InvitationListResponse,
  InvitationDetails,
  CreateInvitationRequest,
  CreateInvitationResponse,
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  BulkInviteRequest,
  BulkInviteResponse,
  DomainStatusResponse,
  VerifyDomainResponse,
  DomainDnsConfig,
  EmailRoutingConfig,
  BillingOverview,
  Subscription,
  Invoice,
  CreateCheckoutRequest,
  CreateCheckoutResponse,
  ChangeTierRequest,
  ChangeTierResponse,
  NamespaceTier,
  AuditLogResponse,
  AuditLogFilters,
  ApiResponse,
} from '@gns/org-types';

// Re-export all types
export * from '@gns/org-types';

// ============================================
// API CLIENT CONFIG
// ============================================

export interface OrgApiConfig {
  baseUrl: string;
  publicKey?: string;
  signRequest?: (payload: string) => Promise<string>;
  onError?: (error: Error) => void;
}

// ============================================
// BASE API CLIENT
// ============================================

class ApiClient {
  constructor(private config: OrgApiConfig) {
    this.config.baseUrl = config.baseUrl.replace(/\/$/, '');
  }

  async get<T>(path: string, auth = false): Promise<T> {
    return this.request<T>('GET', path, undefined, auth);
  }

  async post<T>(path: string, body?: unknown, auth = true): Promise<T> {
    return this.request<T>('POST', path, body, auth);
  }

  async patch<T>(path: string, body?: unknown, auth = true): Promise<T> {
    return this.request<T>('PATCH', path, body, auth);
  }

  async delete<T>(path: string, body?: unknown, auth = true): Promise<T> {
    return this.request<T>('DELETE', path, body, auth);
  }

  private async request<T>(method: string, path: string, body?: unknown, auth = false): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const bodyStr = body ? JSON.stringify(body) : undefined;

    if (auth && this.config.publicKey && this.config.signRequest) {
      const timestamp = new Date().toISOString();
      const signPayload = [method, path, timestamp, bodyStr || ''].join('\n');
      headers['X-GNS-PublicKey'] = this.config.publicKey;
      headers['X-GNS-Timestamp'] = timestamp;
      headers['X-GNS-Signature'] = await this.config.signRequest(signPayload);
    }

    const response = await fetch(url, { method, headers, body: bodyStr });
    const data = await response.json() as ApiResponse<T>;

    if (!response.ok || !data.success) {
      const error = new Error(data.error || `Request failed: ${response.status}`);
      this.config.onError?.(error);
      throw error;
    }

    return data.data as T;
  }

  setCredentials(publicKey: string, signRequest: (payload: string) => Promise<string>) {
    this.config.publicKey = publicKey;
    this.config.signRequest = signRequest;
  }

  clearCredentials() {
    this.config.publicKey = undefined;
    this.config.signRequest = undefined;
  }
}

// ============================================
// NAMESPACES API
// ============================================

class NamespacesApi {
  constructor(private client: ApiClient) {}

  async check(namespace: string): Promise<NamespaceCheckResult> {
    return this.client.get(`/org/check/${encodeURIComponent(namespace)}`, false);
  }

  async register(request: RegisterNamespaceRequest): Promise<RegisterNamespaceResponse> {
    return this.client.post('/org/register', {
      namespace: request.namespace,
      organization_name: request.organizationName,
      domain: request.domain,
      website: request.website,
      email: request.email,
      description: request.description,
      tier: request.tier,
    }, false);
  }

  async verifyDns(registrationId: string): Promise<{ verified: boolean; records: Record<string, { found: boolean; error?: string }> }> {
    return this.client.post('/org/verify', { registration_id: registrationId }, false);
  }

  async activate(request: ActivateNamespaceRequest): Promise<ActivateNamespaceResponse> {
    return this.client.post(`/org/${encodeURIComponent(request.namespace)}/activate`, {
      admin_pk: request.adminPk,
      email: request.email,
    });
  }

  async get(namespace: string): Promise<Namespace> {
    return this.client.get(`/org/${encodeURIComponent(namespace)}`, true);
  }

  async getStatus(registrationId: string): Promise<{ status: string; namespace: string; verified: boolean }> {
    return this.client.get(`/org/status/${registrationId}`, false);
  }

  async updateSettings(namespace: string, settings: Partial<NamespaceSettings>): Promise<NamespaceSettings> {
    return this.client.patch(`/org/${encodeURIComponent(namespace)}/settings`, settings);
  }

  async listMine(): Promise<Namespace[]> {
    return this.client.get('/org/mine', true);
  }
}

// ============================================
// MEMBERS API
// ============================================

class MembersApi {
  constructor(private client: ApiClient) {}

  async list(namespace: string, options: MemberSearchOptions = {}): Promise<MemberListResponse> {
    const params = new URLSearchParams();
    if (options.query) params.set('q', options.query);
    if (options.role) params.set('role', options.role);
    if (options.status) params.set('status', options.status);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    const qs = params.toString();
    return this.client.get(`/org/${encodeURIComponent(namespace)}/members${qs ? `?${qs}` : ''}`, true);
  }

  async get(namespace: string, username: string): Promise<Member> {
    return this.client.get(`/org/${encodeURIComponent(namespace)}/members/${encodeURIComponent(username)}`, true);
  }

  async update(namespace: string, username: string, updates: UpdateMemberRequest): Promise<Member> {
    return this.client.patch(`/org/${encodeURIComponent(namespace)}/members/${encodeURIComponent(username)}`, updates);
  }

  async remove(namespace: string, username: string): Promise<void> {
    return this.client.delete(`/org/${encodeURIComponent(namespace)}/members/${encodeURIComponent(username)}`);
  }

  async transferOwnership(namespace: string, newOwnerUsername: string): Promise<void> {
    return this.client.post(`/org/${encodeURIComponent(namespace)}/transfer-ownership`, { newOwnerUsername });
  }

  async resolve(identifier: string): Promise<ResolvedIdentity | null> {
    try {
      return await this.client.get(`/resolve/${encodeURIComponent(identifier)}`, false);
    } catch {
      return null;
    }
  }
}

// ============================================
// INVITATIONS API
// ============================================

class InvitationsApi {
  constructor(private client: ApiClient) {}

  async list(namespace: string): Promise<InvitationListResponse> {
    return this.client.get(`/org/${encodeURIComponent(namespace)}/invitations`, true);
  }

  async create(namespace: string, request: CreateInvitationRequest): Promise<CreateInvitationResponse> {
    return this.client.post(`/org/${encodeURIComponent(namespace)}/invite`, request);
  }

  async bulkInvite(namespace: string, request: BulkInviteRequest): Promise<BulkInviteResponse> {
    return this.client.post(`/org/${encodeURIComponent(namespace)}/invite/bulk`, request);
  }

  async getByToken(token: string): Promise<InvitationDetails | null> {
    try {
      return await this.client.get(`/org/invite/${encodeURIComponent(token)}`, false);
    } catch {
      return null;
    }
  }

  async accept(request: AcceptInvitationRequest): Promise<AcceptInvitationResponse> {
    return this.client.post(`/org/invite/${encodeURIComponent(request.token)}/accept`, request, false);
  }

  async revoke(namespace: string, invitationId: string): Promise<void> {
    return this.client.delete(`/org/${encodeURIComponent(namespace)}/invitations/${invitationId}`);
  }

  async resend(namespace: string, invitationId: string): Promise<void> {
    return this.client.post(`/org/${encodeURIComponent(namespace)}/invitations/${invitationId}/resend`, {});
  }

  async checkUsername(namespace: string, username: string): Promise<{ available: boolean; errors: string[] }> {
    return this.client.get(`/org/${encodeURIComponent(namespace)}/check-username/${encodeURIComponent(username)}`, false);
  }
}

// ============================================
// DOMAINS API
// ============================================

class DomainsApi {
  constructor(private client: ApiClient) {}

  async getStatus(namespace: string): Promise<DomainStatusResponse> {
    return this.client.get(`/org/${encodeURIComponent(namespace)}/domain`, true);
  }

  async verify(namespace: string): Promise<VerifyDomainResponse> {
    return this.client.post(`/org/${encodeURIComponent(namespace)}/domain/verify`, {});
  }

  async getDnsConfig(namespace: string): Promise<DomainDnsConfig> {
    return this.client.get(`/org/${encodeURIComponent(namespace)}/domain/dns-config`, true);
  }

  async getEmailRouting(namespace: string): Promise<EmailRoutingConfig> {
    return this.client.get(`/org/${encodeURIComponent(namespace)}/domain/email-routing`, true);
  }

  async updateEmailRouting(namespace: string, config: Partial<EmailRoutingConfig>): Promise<EmailRoutingConfig> {
    return this.client.patch(`/org/${encodeURIComponent(namespace)}/domain/email-routing`, config);
  }

  async enableCatchAll(namespace: string, targetUsername: string): Promise<void> {
    return this.client.post(`/org/${encodeURIComponent(namespace)}/domain/catch-all`, { targetUsername, enabled: true });
  }
}

// ============================================
// BILLING API
// ============================================

class BillingApi {
  constructor(private client: ApiClient) {}

  async getOverview(namespace: string): Promise<BillingOverview> {
    return this.client.get(`/org/${encodeURIComponent(namespace)}/billing`, true);
  }

  async getSubscription(namespace: string): Promise<Subscription | null> {
    try {
      return await this.client.get(`/org/${encodeURIComponent(namespace)}/billing/subscription`, true);
    } catch {
      return null;
    }
  }

  async listInvoices(namespace: string): Promise<{ invoices: Invoice[]; hasMore: boolean }> {
    return this.client.get(`/org/${encodeURIComponent(namespace)}/billing/invoices`, true);
  }

  async createCheckout(request: CreateCheckoutRequest): Promise<CreateCheckoutResponse> {
    return this.client.post(`/org/${encodeURIComponent(request.namespace)}/billing/checkout`, request);
  }

  async createPortal(namespace: string, returnUrl: string): Promise<{ portalUrl: string }> {
    return this.client.post(`/org/${encodeURIComponent(namespace)}/billing/portal`, { returnUrl });
  }

  async changeTier(request: ChangeTierRequest): Promise<ChangeTierResponse> {
    return this.client.post(`/org/${encodeURIComponent(request.namespace)}/billing/change-tier`, request);
  }

  async cancel(namespace: string): Promise<void> {
    return this.client.post(`/org/${encodeURIComponent(namespace)}/billing/cancel`, {});
  }

  async getPricing(): Promise<Record<NamespaceTier, { name: string; price: number; memberLimit: number; features: string[] }>> {
    return this.client.get('/org/pricing', false);
  }
}

// ============================================
// AUDIT API
// ============================================

class AuditApi {
  constructor(private client: ApiClient) {}

  async getLog(namespace: string, filters: AuditLogFilters = {}): Promise<AuditLogResponse> {
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.action) params.set('action', filters.action);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.cursor) params.set('cursor', filters.cursor);
    const qs = params.toString();
    return this.client.get(`/org/${encodeURIComponent(namespace)}/audit${qs ? `?${qs}` : ''}`, true);
  }
}

// ============================================
// MAIN API CLASS
// ============================================

export class GnsOrgApi {
  private client: ApiClient;
  
  public readonly namespaces: NamespacesApi;
  public readonly members: MembersApi;
  public readonly invitations: InvitationsApi;
  public readonly domains: DomainsApi;
  public readonly billing: BillingApi;
  public readonly audit: AuditApi;

  constructor(config: OrgApiConfig) {
    this.client = new ApiClient(config);
    this.namespaces = new NamespacesApi(this.client);
    this.members = new MembersApi(this.client);
    this.invitations = new InvitationsApi(this.client);
    this.domains = new DomainsApi(this.client);
    this.billing = new BillingApi(this.client);
    this.audit = new AuditApi(this.client);
  }

  setCredentials(publicKey: string, signRequest: (payload: string) => Promise<string>) {
    this.client.setCredentials(publicKey, signRequest);
  }

  clearCredentials() {
    this.client.clearCredentials();
  }

  async resolve(identifier: string) {
    return this.members.resolve(identifier);
  }
}

export function createOrgApi(config: OrgApiConfig): GnsOrgApi {
  return new GnsOrgApi(config);
}

export const PRODUCTION_API_URL = 'https://gns-browser-production.up.railway.app';
export const STAGING_API_URL = 'https://gns-browser-staging.up.railway.app';
