
import { getSupabase, generateId } from './client';
import {
    DbRecord, DbAlias, DbEpoch, SyncState,
    GnsRecord, PoTProof, EpochHeader, DbBreadcrumb
} from '../../types';

// ===========================================
// RECORDS
// ===========================================
export async function getRecord(pkRoot: string): Promise<DbRecord | null> {
  const { data, error } = await getSupabase()
    .from('records')
    .select('*')
    .eq('pk_root', pkRoot.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    console.error('Error fetching record:', error);
    throw error;
  }

  return data as DbRecord | null;
}

/**
 * Get identity info (public_key, encryption_key, handle) for messaging
 * This is used by the echo bot and messaging services to encrypt messages
 */
export async function getIdentity(pkRoot: string): Promise<{
  public_key: string;
  encryption_key: string;
  handle?: string;
} | null> {
  const { data, error } = await getSupabase()
    .from('records')
    .select('pk_root, encryption_key, handle')
    .eq('pk_root', pkRoot.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching identity:', error);
    throw error;
  }

  if (!data) return null;

  return {
    public_key: data.pk_root,
    encryption_key: data.encryption_key,
    handle: data.handle || undefined,
  };
}

export async function upsertRecord(
  pkRoot: string,
  recordJson: GnsRecord,
  signature: string
): Promise<DbRecord> {
  const { data, error } = await getSupabase()
    .from('records')
    .upsert({
      pk_root: pkRoot.toLowerCase(),
      record_json: recordJson,
      signature: signature,
      version: recordJson.version || 1,
      handle: recordJson.handle?.toLowerCase() || null,
      encryption_key: recordJson.encryption_key || null,  // ✅ CRITICAL FIX!
      trust_score: recordJson.trust_score,
      breadcrumb_count: recordJson.breadcrumb_count,
    }, {
      onConflict: 'pk_root',
    })
    .select()
    .single();

  console.log(`[db.upsertRecord] Upsert result for ${pkRoot.substring(0, 16)}...`);
  if (error) console.error(`[db.upsertRecord] Error:`, error);
  if (data) console.log(`[db.upsertRecord] Success. Encryption key: ${data.encryption_key}`);

  if (error) {
    console.error('Error upserting record:', error);
    throw error;
  }

  return data as DbRecord;
}

export async function getRecordsSince(since: string, limit = 100): Promise<DbRecord[]> {
  const { data, error } = await getSupabase()
    .from('records')
    .select('*')
    .gt('updated_at', since)
    .order('updated_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching records since:', error);
    throw error;
  }

  return data as DbRecord[];
}

export async function deleteRecord(pkRoot: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('records')
    .delete()
    .eq('pk_root', pkRoot.toLowerCase());

  if (error) {
    console.error('Error deleting record:', error);
    throw error;
  }

  return true;
}

// ===========================================
// ALIASES
// ===========================================

export async function getAlias(handle: string): Promise<DbAlias | null> {
  const { data, error } = await getSupabase()
    .from('aliases')
    .select('*')
    .eq('handle', handle.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching alias:', error);
    throw error;
  }

  return data as DbAlias | null;
}

export async function getAliasByPk(pkRoot: string): Promise<DbAlias | null> {
  const { data, error } = await getSupabase()
    .from('aliases')
    .select('*')
    .eq('pk_root', pkRoot.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching alias by pk:', error);
    throw error;
  }

  return data as DbAlias | null;
}

export async function createAlias(
  handle: string,
  pkRoot: string,
  potProof: PoTProof,
  signature: string
): Promise<DbAlias> {
  const { data, error } = await getSupabase()
    .from('aliases')
    .insert({
      handle: handle.toLowerCase(),
      pk_root: pkRoot.toLowerCase(),
      pot_proof: potProof,
      signature: signature,
      verified: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating alias:', error);
    throw error;
  }

  // Update the record's handle field
  await getSupabase()
    .from('records')
    .update({ handle: handle.toLowerCase() })
    .eq('pk_root', pkRoot.toLowerCase());

  return data as DbAlias;
}

export async function isHandleAvailable(handle: string): Promise<boolean> {
  // Check aliases table
  const alias = await getAlias(handle);
  if (alias) return false;

  // Check reserved handles table
  const { data, error } = await getSupabase()
    .from('reserved_handles')
    .select('handle')
    .eq('handle', handle.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking reserved handles:', error);
    throw error;
  }

  return !data;
}

export async function getAliasesSince(since: string, limit = 100): Promise<DbAlias[]> {
  const { data, error } = await getSupabase()
    .from('aliases')
    .select('*')
    .gt('created_at', since)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching aliases since:', error);
    throw error;
  }

  return data as DbAlias[];
}

// ===========================================
// ALIAS LOOKUP (for echo_bot & messaging)
// ===========================================

/**
 * Get alias by handle (alias for getAlias)
 */
export async function getAliasByHandle(handle: string): Promise<DbAlias | null> {
  return getAlias(handle);
}

/**
 * Create a system alias (for reserved handles like @echo, @support)
 * These don't require PoT proof
 */
export async function createSystemAlias(
  handle: string,
  pkRoot: string
): Promise<DbAlias> {
  const { data, error } = await getSupabase()
    .from('aliases')
    .upsert({
      handle: handle.toLowerCase(),
      pk_root: pkRoot.toLowerCase(),
      pot_proof: {
        // System handles have special proof
        breadcrumb_count: 999999,
        trust_score: 100,
        first_breadcrumb_at: '2025-01-01T00:00:00Z',
        system_handle: true,
      },
      signature: 'system',
      verified: true,
      is_system: true, // Add this column to your schema
    }, {
      onConflict: 'handle',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating system alias:', error);
    throw error;
  }

  return data as DbAlias;
}

/**
 * Get all system handles
 */
export async function getSystemAliases(): Promise<DbAlias[]> {
  const { data, error } = await getSupabase()
    .from('aliases')
    .select('*')
    .eq('is_system', true);

  if (error) {
    console.error('Error fetching system aliases:', error);
    throw error;
  }

  return data as DbAlias[] || [];
}

// ===========================================
// HANDLE RESOLUTION (for messaging)
// ===========================================

/**
 * Resolve handle to public key
 * Returns null if handle not found
 */
export async function resolveHandleToPublicKey(handle: string): Promise<string | null> {
  // Normalize handle (remove @ if present)
  const normalizedHandle = handle.toLowerCase().replace(/^@/, '');

  // Look up in aliases
  const alias = await getAlias(normalizedHandle);

  if (alias) {
    return alias.pk_root;
  }

  return null;
}

/**
 * Resolve public key to handle
 * Returns null if no handle claimed
 */
export async function resolvePublicKeyToHandle(pkRoot: string): Promise<string | null> {
  const alias = await getAliasByPk(pkRoot.toLowerCase());

  if (alias) {
    return `@${alias.handle}`;
  }

  return null;
}

// ===========================================
// HANDLE RESERVATIONS
// ===========================================

export async function reserveHandle(
  handle: string,
  pkRoot: string
): Promise<{ reserved: boolean; expires_at?: string; error?: string }> {
  // Check if available
  const available = await isHandleAvailable(handle);
  if (!available) {
    return { reserved: false, error: 'Handle not available' };
  }

  // Check if pk already has a reservation
  const { data: existing } = await getSupabase()
    .from('reserved_handles')
    .select('*')
    .eq('pk_root', pkRoot.toLowerCase())
    .single();

  if (existing) {
    // Delete old reservation
    await getSupabase()
      .from('reserved_handles')
      .delete()
      .eq('pk_root', pkRoot.toLowerCase());
  }

  // Create reservation
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await getSupabase()
    .from('reserved_handles')
    .insert({
      handle: handle.toLowerCase(),
      pk_root: pkRoot.toLowerCase(),
      expires_at: expiresAt,
    });

  if (error) {
    console.error('Error reserving handle:', error);
    return { reserved: false, error: error.message };
  }

  return { reserved: true, expires_at: expiresAt };
}

export async function getReservation(handle: string): Promise<{
  handle: string;
  pk_root: string;
  expires_at: string;
} | null> {
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from('reserved_handles')
    .select('*')
    .eq('handle', handle.toLowerCase())
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching reservation:', error);
    throw error;
  }

  return data;
}

// ===========================================
// EPOCHS
// ===========================================

export async function getEpochs(pkRoot: string): Promise<DbEpoch[]> {
  const { data, error } = await getSupabase()
    .from('epochs')
    .select('*')
    .eq('pk_root', pkRoot.toLowerCase())
    .order('epoch_index', { ascending: true });

  if (error) {
    console.error('Error fetching epochs:', error);
    throw error;
  }

  return data as DbEpoch[];
}

export async function getEpoch(pkRoot: string, epochIndex: number): Promise<DbEpoch | null> {
  const { data, error } = await getSupabase()
    .from('epochs')
    .select('*')
    .eq('pk_root', pkRoot.toLowerCase())
    .eq('epoch_index', epochIndex)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching epoch:', error);
    throw error;
  }

  return data as DbEpoch | null;
}

export async function createEpoch(
  pkRoot: string,
  epoch: EpochHeader,
  signature: string
): Promise<DbEpoch> {
  const { data, error } = await getSupabase()
    .from('epochs')
    .insert({
      pk_root: pkRoot.toLowerCase(),
      epoch_index: epoch.epoch_index,
      merkle_root: epoch.merkle_root,
      start_time: epoch.start_time,
      end_time: epoch.end_time,
      block_count: epoch.block_count,
      prev_epoch_hash: epoch.prev_epoch_hash || null,
      signature: signature,
      epoch_hash: epoch.epoch_hash,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating epoch:', error);
    throw error;
  }

  return data as DbEpoch;
}

export async function getEpochsSince(since: string, limit = 100): Promise<DbEpoch[]> {
  const { data, error } = await getSupabase()
    .from('epochs')
    .select('*')
    .gt('published_at', since)
    .order('published_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching epochs since:', error);
    throw error;
  }

  return data as DbEpoch[];
}

export async function getSyncState(peerId: string): Promise<SyncState | null> {
  const { data, error } = await getSupabase()
    .from('sync_state')
    .select('*')
    .eq('peer_id', peerId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching sync state:', error);
    throw error;
  }

  return data as SyncState | null;
}

export async function upsertSyncState(state: Partial<SyncState> & { peer_id: string; peer_url: string }): Promise<void> {
  const { error } = await getSupabase()
    .from('sync_state')
    .upsert(state, { onConflict: 'peer_id' });

  if (error) {
    console.error('Error upserting sync state:', error);
    throw error;
  }
}

export async function getAllPeers(): Promise<SyncState[]> {
  const { data, error } = await getSupabase()
    .from('sync_state')
    .select('*')
    .eq('status', 'active');

  if (error) {
    console.error('Error fetching peers:', error);
    throw error;
  }

  return data as SyncState[];
}

// ===========================================
// HEALTH CHECK
// ===========================================

export async function healthCheck(): Promise<boolean> {
  try {
    const { error } = await getSupabase()
      .from('records')
      .select('pk_root')
      .limit(1);

    return !error;
  } catch {
    return false;
  }
}
/**
 * Get all records (for migration)
 * Returns all records in the database
 */
export async function getAllRecords(): Promise<DbRecord[]> {
  const { data, error } = await getSupabase()
    .from('records')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching all records:', error);
    throw error;
  }

  return data as DbRecord[];
}

/**
 * Update encryption_key for a record (for migration)
 * Updates the encryption_key field to use proper RFC 7748 derived key
 */
export async function updateEncryptionKey(
  pkRoot: string,
  encryptionKey: string
): Promise<void> {
  const { error } = await getSupabase()
    .from('records')
    .update({
      encryption_key: encryptionKey,
      updated_at: new Date().toISOString(),
    })
    .eq('pk_root', pkRoot.toLowerCase());

  if (error) {
    console.error('Error updating encryption key:', error);
    throw error;
  }
}

/**
 * Backup all encryption keys before migration
 * Creates a backup table with old encryption keys
 */
export async function backupEncryptionKeys(): Promise<void> {
  const { error } = await getSupabase().rpc('backup_encryption_keys');

  if (error) {
    console.error('Error backing up encryption keys:', error);
    throw error;
  }
}
/**
 * Create a new organization registration
 */
export async function createOrgRegistration(data: {
  id: string;
  namespace: string;
  organization_name: string;
  email: string;
  website: string;
  domain: string;
  description: string | null;
  tier: string;
  verification_code: string;
}) {
  const { data: result, error } = await getSupabase()
    .from('org_registrations')
    .insert({
      id: data.id,
      namespace: data.namespace,
      organization_name: data.organization_name,
      email: data.email,
      website: data.website,
      domain: data.domain,
      description: data.description,
      tier: data.tier,
      verification_code: data.verification_code,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

/**
 * Get organization registration by ID
 */
export async function getOrgRegistration(id: string) {
  const { data, error } = await getSupabase()
    .from('org_registrations')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Get organization registration by namespace
 */
export async function getOrgRegistrationByNamespace(namespace: string) {
  const { data, error } = await getSupabase()
    .from('org_registrations')
    .select('*')
    .eq('namespace', namespace)
    .in('status', ['pending', 'verified'])
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Get organization registration by domain
 */
export async function getOrgRegistrationByDomain(domain: string) {
  const { data, error } = await getSupabase()
    .from('org_registrations')
    .select('*')
    .eq('domain', domain)
    .in('status', ['pending', 'verified'])
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Update organization registration status
 */
export async function updateOrgRegistrationStatus(
  id: string,
  status: 'verified' | 'rejected',
  rejectionReason?: string
) {
  const updateData: Record<string, any> = {
    status,
  };

  if (status === 'verified') {
    updateData.verified_at = new Date().toISOString();
  }

  if (status === 'rejected') {
    updateData.rejected_at = new Date().toISOString();
    updateData.rejection_reason = rejectionReason;
  }

  const { data, error } = await getSupabase()
    .from('org_registrations')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Set public key for verified organization
 */
export async function setOrgPublicKey(id: string, publicKey: string) {
  const { data, error } = await getSupabase()
    .from('org_registrations')
    .update({ public_key: publicKey })
    .eq('id', id)
    .eq('status', 'verified')
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all pending registrations (for admin)
 */
export async function getPendingOrgRegistrations() {
  const { data, error } = await getSupabase()
    .from('org_registrations')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ===========================================
// BROWSER SESSIONS
// ===========================================

export interface BrowserSessionInput {
  sessionToken: string;
  publicKey: string;
  handle?: string;
  browserInfo: string;
  deviceInfo?: any;
  createdAt: Date;
  expiresAt: Date;
}

export interface BrowserSession {
  id: number;
  sessionToken: string;
  publicKey: string;
  handle?: string;
  browserInfo: string;
  deviceInfo?: any;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date;
  isActive: boolean;
  revokedAt?: Date;
}

/**
 * Create a new browser session
 */
export async function createBrowserSession(input: BrowserSessionInput): Promise<BrowserSession> {
  const { data, error } = await getSupabase()
    .from('browser_sessions')
    .insert({
      session_token: input.sessionToken,
      public_key: input.publicKey.toLowerCase(),
      handle: input.handle?.toLowerCase() || null,
      browser_info: input.browserInfo,
      device_info: input.deviceInfo || null,
      created_at: input.createdAt.toISOString(),
      expires_at: input.expiresAt.toISOString(),
      last_used_at: new Date().toISOString(),
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating browser session:', error);
    throw error;
  }

  return mapBrowserSession(data);
}

/**
 * Get all active browser sessions for a user
 */
export async function getBrowserSessions(publicKey: string): Promise<BrowserSession[]> {
  const { data, error } = await getSupabase()
    .from('browser_sessions')
    .select('*')
    .eq('public_key', publicKey.toLowerCase())
    .eq('is_active', true)
    .order('last_used_at', { ascending: false });

  if (error) {
    console.error('Error fetching browser sessions:', error);
    throw error;
  }

  return (data || []).map(mapBrowserSession);
}

/**
 * Update session last used timestamp
 */
export async function updateBrowserSessionLastUsed(sessionToken: string): Promise<void> {
  const { error } = await getSupabase()
    .from('browser_sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('session_token', sessionToken);

  if (error) {
    console.error('Error updating browser session:', error);
  }
}

/**
 * Revoke a browser session
 */
export async function revokeBrowserSession(sessionToken: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('browser_sessions')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq('session_token', sessionToken);

  if (error) {
    console.error('Error revoking browser session:', error);
    return false;
  }

  return true;
}

/**
 * Revoke all browser sessions for a user
 */
export async function revokeAllBrowserSessions(publicKey: string): Promise<number> {
  const { data, error } = await getSupabase()
    .from('browser_sessions')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq('public_key', publicKey.toLowerCase())
    .eq('is_active', true)
    .select();

  if (error) {
    console.error('Error revoking all browser sessions:', error);
    throw error;
  }

  return data?.length || 0;
}

/**
 * Clean up expired sessions (run periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const { data, error } = await getSupabase()
    .from('browser_sessions')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .lt('expires_at', new Date().toISOString())
    .eq('is_active', true)
    .select();

  if (error) {
    console.error('Error cleaning up sessions:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Map database row to BrowserSession type
 */
function mapBrowserSession(row: any): BrowserSession {
  return {
    id: row.id,
    sessionToken: row.session_token,
    publicKey: row.public_key,
    handle: row.handle || undefined,
    browserInfo: row.browser_info,
    deviceInfo: row.device_info || undefined,
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
    lastUsedAt: new Date(row.last_used_at),
    isActive: row.is_active,
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : undefined,
  };
}

/**
 * Get alias by identity public key
 */
export async function getAliasByIdentity(publicKey: string): Promise<{ handle: string } | null> {
  const { data, error } = await getSupabase()
    .from('aliases')
    .select('handle')
    .eq('pk_root', publicKey.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching alias:', error);
    return null;
  }

  return data;
}


// ===========================================
// WEB API HELPERS (for World Browser)
// ===========================================

/**
 * Search aliases by handle prefix
 */
export async function searchAliases(query: string, limit = 20): Promise<DbAlias[]> {
  const { data, error } = await getSupabase()
    .from('aliases')
    .select('*')
    .ilike('handle', `${query}%`)
    .limit(limit);

  if (error) {
    console.error('Error searching aliases:', error);
    throw error;
  }

  return data as DbAlias[];
}

/**
 * Get top identities by trust score
 */
export async function getTopIdentities(limit = 10): Promise<DbRecord[]> {
  const { data, error } = await getSupabase()
    .from('records')
    .select('*')
    .order('trust_score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error getting top identities:', error);
    throw error;
  }

  return data as DbRecord[];
}
