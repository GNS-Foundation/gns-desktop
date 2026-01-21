
import { getSupabase, generateId } from './client';
import {
    DbGeoAuthSession
} from '../../types';
import {
    MerchantInput,
    WebhookSubscription,
    OAuthClient,
    WebhookEventFilter
} from '../../types/api.types';

// ===========================================
// GEOAUTH SESSIONS
// ===========================================
/**
 * Create GeoAuth session (called by merchant)
 */
export async function createGeoAuthSession(data: {
  auth_id: string;
  merchant_id: string;
  merchant_name?: string;
  payment_hash: string;
  amount?: string;
  currency?: string;
  expires_at: string;
}): Promise<DbGeoAuthSession> {
  const { data: result, error } = await getSupabase()
    .from('geoauth_sessions')
    .insert({
      auth_id: data.auth_id,
      merchant_id: data.merchant_id,
      merchant_name: data.merchant_name || null,
      payment_hash: data.payment_hash,
      amount: data.amount || null,
      currency: data.currency || null,
      status: 'pending',
      expires_at: data.expires_at,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating geoauth session:', error);
    throw error;
  }

  return result as DbGeoAuthSession;
}

/**
 * Get GeoAuth session
 */
export async function getGeoAuthSession(authId: string): Promise<DbGeoAuthSession | null> {
  const { data, error } = await getSupabase()
    .from('geoauth_sessions')
    .select('*')
    .eq('auth_id', authId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching geoauth session:', error);
    throw error;
  }

  return data as DbGeoAuthSession | null;
}

/**
 * Authorize GeoAuth session (called when user submits token)
 */
export async function authorizeGeoAuthSession(
  authId: string,
  data: {
    user_pk: string;
    envelope_json: any;
    h3_cell: string;
  }
): Promise<DbGeoAuthSession | null> {
  const { data: result, error } = await getSupabase()
    .from('geoauth_sessions')
    .update({
      status: 'authorized',
      user_pk: data.user_pk.toLowerCase(),
      envelope_json: data.envelope_json,
      h3_cell: data.h3_cell,
      authorized_at: new Date().toISOString(),
    })
    .eq('auth_id', authId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error authorizing geoauth session:', error);
    throw error;
  }

  return result as DbGeoAuthSession | null;
}

/**
 * Mark GeoAuth session as used
 */
export async function markGeoAuthUsed(authId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('geoauth_sessions')
    .update({ status: 'used' })
    .eq('auth_id', authId)
    .eq('status', 'authorized');

  if (error) {
    console.error('Error marking geoauth used:', error);
    throw error;
  }
}

/**
 * Get pending GeoAuth sessions for merchant
 */
export async function getMerchantGeoAuthSessions(
  merchantId: string,
  status: string = 'pending'
): Promise<DbGeoAuthSession[]> {
  const { data, error } = await getSupabase()
    .from('geoauth_sessions')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching merchant geoauth sessions:', error);
    throw error;
  }

  return data as DbGeoAuthSession[];
}

// ===========================================
// GEOAUTH MERCHANTS (for Chapter 8)
// ===========================================

/**
 * Get merchant by API key hash
 */
export async function getMerchantByApiKey(keyHash: string): Promise<any | null> {
  const { data, error } = await getSupabase()
    .from('geoauth_merchants')
    .select('*')
    .eq('api_key_hash', keyHash)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching merchant by API key:', error);
    throw error;
  }

  return data;
}

/**
 * Get merchant by ID
 */
export async function getMerchant(merchantId: string): Promise<any | null> {
  const { data, error } = await getSupabase()
    .from('geoauth_merchants')
    .select('*')
    .eq('merchant_id', merchantId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching merchant:', error);
    throw error;
  }

  return data;
}

/**
 * Expire a single GeoAuth session
 */
export async function expireGeoAuthSession(authId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('geoauth_sessions')
    .update({ status: 'expired' })
    .eq('auth_id', authId);

  if (error) {
    console.error('Error expiring geoauth session:', error);
    throw error;
  }
}

/**
 * Get all pending GeoAuth sessions (for user discovery)
 */
export async function getPendingGeoAuthSessions(): Promise<DbGeoAuthSession[]> {
  const { data, error } = await getSupabase()
    .from('geoauth_sessions')
    .select('*')
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching pending geoauth sessions:', error);
    throw error;
  }

  return data as DbGeoAuthSession[];
}
export async function expireGeoAuthSessions(): Promise<number> {
  const { data, error } = await getSupabase()
    .from('geoauth_sessions')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
    .select();

  if (error) {
    console.error('Error expiring geoauth sessions:', error);
    return 0;
  }

  return data?.length || 0;
}
export async function getOAuthClient(clientId: string): Promise<OAuthClient | null> {
  const { data, error } = await getSupabase()
    .from('oauth_clients')
    .select('*')
    .eq('client_id', clientId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching OAuth client:', error);
    throw error;
  }

  if (!data) return null;

  return {
    client_id: data.client_id,
    client_secret: data.client_secret,
    name: data.name,
    redirect_uris: data.redirect_uris,
    logo_uri: data.logo_uri,
    tos_uri: data.tos_uri,
    policy_uri: data.policy_uri,
    confidential: data.confidential,
    owner_pk: data.owner_pk,
    created_at: data.created_at,
  };
}

export async function createOAuthClient(client: OAuthClient): Promise<OAuthClient> {
  const { data, error } = await getSupabase()
    .from('oauth_clients')
    .insert({
      client_id: client.client_id,
      client_secret: client.client_secret,
      name: client.name,
      redirect_uris: client.redirect_uris,
      logo_uri: client.logo_uri,
      tos_uri: client.tos_uri,
      policy_uri: client.policy_uri,
      confidential: client.confidential,
      owner_pk: client.owner_pk.toLowerCase(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating OAuth client:', error);
    throw error;
  }

  return data as OAuthClient;
}

export async function getOAuthClientsByOwner(ownerPk: string): Promise<OAuthClient[]> {
  const { data, error } = await getSupabase()
    .from('oauth_clients')
    .select('*')
    .eq('owner_pk', ownerPk.toLowerCase())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching OAuth clients:', error);
    throw error;
  }

  return data || [];
}

// ===========================================
// WEBHOOK SUBSCRIPTIONS
// ===========================================

export async function getWebhookSubscriptions(
  ownerPk: string,
  eventType?: string
): Promise<WebhookSubscription[]> {
  let query = getSupabase()
    .from('webhook_subscriptions')
    .select('*')
    .eq('owner_pk', ownerPk.toLowerCase())
    .eq('active', true);

  if (eventType) {
    query = query.contains('events', [eventType]);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching webhooks:', error);
    throw error;
  }

  return (data || []).map(row => ({
    id: row.id,
    owner_pk: row.owner_pk,
    target_url: row.target_url,
    events: row.events,
    for_handle: row.for_handle,
    secret_hash: row.secret_hash,
    active: row.active,
    created_at: row.created_at,
    last_triggered_at: row.last_triggered_at,
    failure_count: row.failure_count,
  }));
}

export async function createWebhookSubscription(
  webhook: WebhookSubscription
): Promise<WebhookSubscription> {
  const { data, error } = await getSupabase()
    .from('webhook_subscriptions')
    .insert({
      id: webhook.id,
      owner_pk: webhook.owner_pk.toLowerCase(),
      target_url: webhook.target_url,
      events: webhook.events,
      for_handle: webhook.for_handle,
      secret_hash: webhook.secret_hash,
      active: webhook.active,
      failure_count: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating webhook:', error);
    throw error;
  }

  return data as WebhookSubscription;
}

export async function updateWebhookSubscription(
  webhookId: string,
  updates: Partial<WebhookSubscription>
): Promise<void> {
  const { error } = await getSupabase()
    .from('webhook_subscriptions')
    .update({
      target_url: updates.target_url,
      events: updates.events,
      active: updates.active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', webhookId);

  if (error) {
    console.error('Error updating webhook:', error);
    throw error;
  }
}

export async function deleteWebhookSubscription(webhookId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('webhook_subscriptions')
    .delete()
    .eq('id', webhookId);

  if (error) {
    console.error('Error deleting webhook:', error);
    throw error;
  }
}

export async function incrementWebhookFailure(webhookId: string): Promise<number> {
  const { data, error } = await getSupabase()
    .rpc('increment_webhook_failure', { p_webhook_id: webhookId });

  if (error) {
    console.error('Error incrementing webhook failure:', error);
    return 0;
  }

  return data || 0;
}

export async function logWebhookDelivery(delivery: {
  subscription_id: string;
  event_id: string;
  event_type?: string;
  status: 'pending' | 'delivered' | 'failed';
  response_code?: number;
  response_time_ms?: number;
  error?: string;
  attempt: number;
}): Promise<void> {
  const { error } = await getSupabase()
    .from('webhook_deliveries')
    .insert({
      subscription_id: delivery.subscription_id,
      event_id: delivery.event_id,
      event_type: delivery.event_type || 'unknown',
      status: delivery.status,
      response_code: delivery.response_code,
      response_time_ms: delivery.response_time_ms,
      error: delivery.error,
      attempt: delivery.attempt,
    });

  if (error) {
    console.error('Error logging webhook delivery:', error);
    // Don't throw - this is non-critical logging
  }
}

// ===========================================

// ===========================================
// GNS NODE - DATABASE ADDITIONS v2
// Sprint 6, 7, 8 Database Functions
// ===========================================
// 
// CORRECTED VERSION - Matches API file expectations
// 
// IMPORTANT: 
// 1. Remove existing logWebhookDelivery from your db.ts first (it's duplicated)
// 2. Then append this file
// ===========================================
export async function getMerchantByEmail(email: string) {
  const { data, error } = await getSupabase()
    .from('gns_merchants')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createMerchant(merchantData: MerchantInput) {
  const { data, error } = await getSupabase()
    .from('gns_merchants')
    .insert({
      merchant_id: merchantData.merchant_id,
      name: merchantData.name,
      display_name: merchantData.display_name,
      stellar_address: merchantData.stellar_address,
      category: merchantData.category || 'other',
      status: merchantData.status || 'pending',
      email: merchantData.email?.toLowerCase(),
      phone: merchantData.phone,
      website: merchantData.website,
      address: merchantData.address,
      h3_cell: merchantData.h3_cell,
      accepted_currencies: merchantData.accepted_currencies || ['GNS', 'USDC', 'EURC'],
      settlement_currency: merchantData.settlement_currency || 'USDC',
      instant_settlement: merchantData.instant_settlement ?? true,
      api_key_hash: merchantData.api_key_hash,
      logo_url: merchantData.logo_url,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function searchMerchants(options: string | {
  query?: string;
  category?: string;
  nearH3Cell?: string;
  limit?: number;
}) {
  const opts = typeof options === 'string' ? { query: options } : options;
  const limit = opts.limit || 20;

  let query = getSupabase()
    .from('gns_merchants')
    .select('*')
    .eq('status', 'active')
    .limit(limit);

  if (opts.query) {
    query = query.or(`business_name.ilike.%${opts.query}%,merchant_id.ilike.%${opts.query}%`);
  }
  if (opts.category) {
    query = query.eq('business_type', opts.category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getPopularMerchants(limit = 10) {
  const { data, error } = await getSupabase()
    .from('gns_merchants')
    .select('*')
    .eq('status', 'active')
    .order('transaction_count', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getMerchantTransactions(
  merchantId: string,
  options?: number | { limit?: number; offset?: number; status?: string }
) {
  const opts = typeof options === 'number' ? { limit: options } : (options || {});
  const limit = opts.limit || 50;
  const offset = opts.offset || 0;

  let query = getSupabase()
    .from('gns_settlements')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.status) {
    query = query.eq('status', opts.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
export async function getSettlementConfig(merchantId: string) {
  const { data, error } = await getSupabase()
    .from('gns_settlement_config')
    .select('*')
    .eq('merchant_id', merchantId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function upsertSettlementConfig(merchantId: string, config?: {
  frequency?: string;
  settlement_hour?: number;
  minimum_amount?: number;
  auto_settle?: boolean;
  preferred_currency?: string;
  settlement_address?: string;
}) {
  const { data, error } = await getSupabase()
    .from('gns_settlement_config')
    .upsert({
      merchant_id: merchantId,
      ...config,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'merchant_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPendingBatchSummary(merchantId: string, _currency?: string) {
  const { data, error } = await getSupabase()
    .from('gns_settlements')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('status', 'completed')
    .is('batch_id', null);

  if (error) throw error;
  return data || [];
}

export async function getPendingSettlementTransactions(merchantId: string, _currency?: string) {
  return getPendingBatchSummary(merchantId, _currency);
}

export async function createBatchSettlement(batchData: {
  merchant_id: string;
  merchant_name?: string;
  currency: string;
  total_gross: number;
  total_fees: number;
  total_net: number;
  transaction_count: number;
  transaction_ids: string[];
  period_start?: string;
  period_end?: string;
}) {
  const batchId = generateId('BATCH');
  const now = new Date().toISOString();

  const { data, error } = await getSupabase()
    .from('gns_batch_settlements')
    .insert({
      batch_id: batchId,
      merchant_id: batchData.merchant_id,
      merchant_name: batchData.merchant_name,
      currency: batchData.currency,
      total_gross: batchData.total_gross,
      total_fees: batchData.total_fees,
      total_net: batchData.total_net,
      transaction_count: batchData.transaction_count,
      transaction_ids: batchData.transaction_ids,
      period_start: batchData.period_start || now,
      period_end: batchData.period_end || now,
      status: 'pending',
      created_at: now,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function completeBatchSettlement(batchId: string, txHash: string) {
  const { data, error } = await getSupabase()
    .from('gns_batch_settlements')
    .update({
      status: 'completed',
      stellar_tx_hash: txHash,
      settled_at: new Date().toISOString(),
    })
    .eq('batch_id', batchId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getBatchSettlements(
  merchantId: string,
  options?: number | { status?: string; limit?: number; offset?: number }
) {
  const opts = typeof options === 'number' ? { limit: options } : (options || {});
  const limit = opts.limit || 20;
  const offset = opts.offset || 0;

  let query = getSupabase()
    .from('gns_batch_settlements')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.status) query = query.eq('status', opts.status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getBatchSettlement(batchId: string) {
  const { data, error } = await getSupabase()
    .from('gns_batch_settlements')
    .select('*')
    .eq('batch_id', batchId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}
export async function getWebhookEndpoints(merchantId: string) {
  const { data, error } = await getSupabase()
    .from('gns_webhook_endpoints')
    .select('*')
    .eq('merchant_id', merchantId);

  if (error) throw error;
  return data || [];
}

export async function createWebhookEndpoint(endpointData: {
  merchant_id: string;
  url: string;
  events: string[];
  secret: string;
  description?: string;
}) {
  const { data, error } = await getSupabase()
    .from('gns_webhook_endpoints')
    .insert({
      endpoint_id: generateId('WH'),
      merchant_id: endpointData.merchant_id,
      url: endpointData.url,
      events: endpointData.events,
      secret: endpointData.secret,
      is_active: true,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateWebhookEndpoint(endpointId: string, merchantIdOrUpdates: string | any, updates?: any) {
  // Handle both signatures: (id, updates) and (id, merchantId, updates)
  const actualUpdates = updates ?? merchantIdOrUpdates;
  const merchantId = updates ? merchantIdOrUpdates : undefined;

  let query = getSupabase()
    .from('gns_webhook_endpoints')
    .update({ ...actualUpdates, updated_at: new Date().toISOString() })
    .eq('endpoint_id', endpointId);

  if (merchantId) {
    query = query.eq('merchant_id', merchantId);
  }

  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function deleteWebhookEndpoint(endpointId: string, merchantId?: string) {
  let query = getSupabase()
    .from('gns_webhook_endpoints')
    .delete()
    .eq('endpoint_id', endpointId);

  if (merchantId) {
    query = query.eq('merchant_id', merchantId);
  }

  const { error } = await query;
  if (error) throw error;
}

export async function testWebhookEndpoint(endpointId: string, merchantId?: string) {
  // Get endpoint details
  let query = getSupabase()
    .from('gns_webhook_endpoints')
    .select('*')
    .eq('endpoint_id', endpointId);

  if (merchantId) {
    query = query.eq('merchant_id', merchantId);
  }

  const { data: endpoint, error } = await query.single();

  if (error || !endpoint) {
    return { success: false, error: 'Endpoint not found' };
  }

  // Send test webhook
  const startTime = Date.now();
  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-GNS-Webhook-Test': 'true' },
      body: JSON.stringify({ event: 'test', timestamp: new Date().toISOString() }),
    });
    return { success: response.ok, response_time_ms: Date.now() - startTime };
  } catch (e: any) {
    return { success: false, response_time_ms: Date.now() - startTime, error: e.message };
  }
}

export async function getWebhookEvents(
  merchantId: string,
  options?: number | WebhookEventFilter
) {
  const opts = typeof options === 'number' ? { limit: options } : (options || {});
  const limit = opts.limit || 50;
  const offset = opts.offset || 0;

  let query = getSupabase()
    .from('gns_webhook_events')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.type) query = query.eq('event_type', opts.type);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getWebhookDeliveries(
  eventId: string,
  _options?: { status?: string; limit?: number }
) {
  const { data, error } = await getSupabase()
    .from('gns_webhook_deliveries')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
