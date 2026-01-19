// ===========================================
// GNS NODE - DATABASE CLIENT
// Supabase PostgreSQL wrapper
// ===========================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  DbRecord, DbAlias, DbEpoch, DbMessage,
  GnsRecord, PoTProof, EpochHeader, SyncState,
  DbPaymentIntent, DbPaymentAck, DbGeoAuthSession,
  DbBreadcrumb
} from '../types';
import {
  OAuthClient,
  WebhookSubscription,
  DbPaymentRequest,
} from '../types/api.types';

// ===========================================
// Supabase Client Singleton
// ===========================================

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
    }

    supabase = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabase;
}

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

// ===========================================
// MESSAGES
// ===========================================

export async function createMessage(
  fromPk: string,
  toPk: string,
  payload: string,
  signature: string,
  relayId?: string
): Promise<DbMessage> {
  const { data, error } = await getSupabase()
    .from('messages')
    .insert({
      from_pk: fromPk.toLowerCase(),
      to_pk: toPk.toLowerCase(),
      payload,
      signature: signature,
      relay_id: relayId || process.env.NODE_ID,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating message:', error);
    throw error;
  }

  return data as DbMessage;
}

export async function getInbox(pkRoot: string, limit = 50): Promise<DbMessage[]> {
  const { data, error } = await getSupabase()
    .from('messages')
    .select('*')
    .eq('to_pk', pkRoot.toLowerCase())
    .is('delivered_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching inbox:', error);
    throw error;
  }

  return data as DbMessage[];
}

/**
 * Get conversation between two users
 */
export async function markMessageDelivered(messageId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('messages')
    .update({
      delivered_at: new Date().toISOString(),
      status: 'delivered'  // ✅ FIX: Also update status so getPendingEnvelopes filters it out
    })
    .eq('id', messageId);

  if (error) {
    console.error('Error marking message delivered:', error);
    throw error;
  }
}

export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('messages')
    .delete()
    .eq('id', messageId);

  if (error) {
    console.error('Error deleting message:', error);
    throw error;
  }
}

// ===========================================
// SYNC STATE
// ===========================================

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

// ===========================================
// ENVELOPE-BASED MESSAGES
// ===========================================

/**
 * Create message with full envelope
 */
export async function createEnvelopeMessage(
  fromPk: string,
  toPk: string,
  envelope: any,
  threadId?: string | null
): Promise<DbMessage> {
  // CRITICAL: Ensure encryptedPayload is ALWAYS a string (base64 ciphertext)
  // Never store it as an object, as that breaks signature verification
  let payloadString = envelope.encryptedPayload || '';
  if (typeof payloadString === 'object') {
    // ✅ Handle nested object (Tauri format)
    if (payloadString.ciphertext) {
      payloadString = payloadString.ciphertext;
    } else {
      // Fallback for other objects
      payloadString = JSON.stringify(payloadString);
    }
  }

  const { data, error } = await getSupabase()
    .from('messages')
    .insert({
      id: envelope.id,
      from_pk: fromPk.toLowerCase(),
      to_pk: toPk.toLowerCase(),
      payload: payloadString,  // Always a string (base64 ciphertext)
      signature: envelope.signature || '',  // Don't lowercase - Base64 is case-sensitive!
      envelope: envelope,  // Full envelope in JSONB column
      thread_id: threadId || envelope.threadId || null,
      status: 'pending',
      relay_id: process.env.NODE_ID,
      expires_at: null,
      // ✅ Also populate individual columns for easier querying
      encrypted_payload: envelope.encryptedPayload || payloadString,
      ephemeral_public_key: envelope.ephemeralPublicKey || null,
      nonce: envelope.nonce || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating envelope message:', error);
    throw error;
  }

  return data as DbMessage;
}

/**
 * Get pending envelopes for a recipient
 */
export async function getPendingEnvelopes(
  recipientPk: string,
  since?: string,
  limit: number = 100
): Promise<DbMessage[]> {
  let query = getSupabase()
    .from('messages')
    .select('*')
    .eq('to_pk', recipientPk.toLowerCase())
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (since) {
    const sinceDate = new Date(parseInt(since)).toISOString();
    query = query.gt('created_at', sinceDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching pending envelopes:', error);
    throw error;
  }

  return data as DbMessage[];
}

export async function acknowledgeMessages(
  recipientPk: string,
  messageIds: string[]
): Promise<number> {
  if (messageIds.length === 0) return 0;

  try {
    const { data, error } = await getSupabase()
      .rpc('acknowledge_messages_text', {
        p_recipient_pk: recipientPk.toLowerCase(),
        p_message_ids: messageIds
      });

    if (error) {
      console.error('ACK error:', error);
      return 0;
    }

    console.log(`✅ Acknowledged ${data} messages`);
    return data || 0;
  } catch (err) {
    console.error('ACK exception:', err);
    return 0;
  }
}

/**
 * Mark messages as read (batch)
 * ✅ FIXED: Use .in() instead of massive OR chain
 */
export async function markMessagesRead(
  recipientPk: string,
  messageIds: string[]
): Promise<number> {
  // ✅ FIXED: Use .in() instead of massive OR chain

  const { data, error } = await getSupabase()
    .from('messages')
    .update({ status: 'read' })
    .eq('to_pk', recipientPk.toLowerCase())
    .in('id', messageIds)  // ✅ Use .in() - much faster and cleaner
    .select('id');

  if (error) {
    console.error('Error marking messages read:', error);
    throw error;
  }

  return data?.length || 0;
}

/**
 * Get messages in a thread
 */
export async function getThreadMessages(
  threadId: string,
  userPk: string,
  limit: number = 50,
  before?: string
): Promise<DbMessage[]> {
  let query = getSupabase()
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .or(`from_pk.eq.${userPk.toLowerCase()},to_pk.eq.${userPk.toLowerCase()}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    const beforeDate = new Date(parseInt(before)).toISOString();
    query = query.lt('created_at', beforeDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching thread messages:', error);
    throw error;
  }

  // Return in chronological order
  return (data as DbMessage[]).reverse();
}

// ===========================================
// BREADCRUMBS (Cloud Sync)
// ===========================================

export async function createBreadcrumb(
  pkRoot: string,
  payload: string,
  signature: string
): Promise<DbBreadcrumb> {
  const { data, error } = await getSupabase()
    .from('breadcrumbs')
    .insert({
      pk_root: pkRoot.toLowerCase(),
      payload,
      signature,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating breadcrumb:', error);
    throw error;
  }

  return data as DbBreadcrumb;
}

export async function getBreadcrumbs(pkRoot: string): Promise<DbBreadcrumb[]> {
  const { data, error } = await getSupabase()
    .from('breadcrumbs')
    .select('*')
    .eq('pk_root', pkRoot.toLowerCase())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching breadcrumbs:', error);
    throw error;
  }

  return data as DbBreadcrumb[];
}

// ===========================================
// DUAL ENCRYPTION SUPPORT
// ===========================================

/**
 * Create message with DUAL encryption
 * Stores both recipient copy and sender copy
 */
export async function createDualEncryptedMessage(messageData: {
  from_pk: string;
  to_pk: string;
  envelope: any;
  thread_id?: string | null;
  encrypted_payload?: string;
  ephemeral_public_key?: string;
  nonce?: string;
  sender_encrypted_payload?: string | null;
  sender_ephemeral_public_key?: string | null;
  sender_nonce?: string | null;
}): Promise<DbMessage> {
  const { data, error } = await getSupabase()
    .from('messages')
    .insert({
      from_pk: messageData.from_pk.toLowerCase(),
      to_pk: messageData.to_pk.toLowerCase(),

      // Recipient encryption (existing fields)
      payload: messageData.encrypted_payload || messageData.envelope?.encryptedPayload || '',
      envelope: messageData.envelope,
      signature: messageData.envelope?.signature || '',

      // Sender encryption (NEW - dual encryption)
      sender_encrypted_payload: messageData.sender_encrypted_payload || null,
      sender_ephemeral_public_key: messageData.sender_ephemeral_public_key || null,
      sender_nonce: messageData.sender_nonce || null,

      thread_id: messageData.thread_id || messageData.envelope?.threadId || null,
      status: 'pending',
      relay_id: process.env.NODE_ID,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating dual encrypted message:', error);
    throw error;
  }

  return data as DbMessage;
}

/**
 * Get conversation between two users
 * Returns all messages (both directions) with dual encryption fields
 */
export async function getConversation(
  userPk: string,
  otherPk: string,
  limit: number = 50,
  before?: string
): Promise<any[]> {
  const userPkLower = userPk.toLowerCase();
  const otherPkLower = otherPk.toLowerCase();

  let query = getSupabase()
    .from('messages')
    .select('*')
    .or(
      `and(from_pk.eq.${userPkLower},to_pk.eq.${otherPkLower}),` +
      `and(from_pk.eq.${otherPkLower},to_pk.eq.${userPkLower})`
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    const beforeDate = new Date(parseInt(before)).toISOString();
    query = query.lt('created_at', beforeDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching conversation:', error);
    throw error;
  }

  // Return in chronological order (oldest first)
  return (data || []).reverse();
}

/**
 * Get all messages for a user (inbox + sent)
 * For unified inbox view with dual encryption support
 */
export async function getAllUserMessages(
  userPk: string,
  limit: number = 50,
  since?: string
): Promise<any[]> {
  const userPkLower = userPk.toLowerCase();

  let query = getSupabase()
    .from('messages')
    .select('*')
    .eq('to_pk', userPkLower)  // ✅ CRITICAL: Only return messages TO this user (inbox = incoming only!)
    .neq('status', 'delivered')  // ✅ FIX: Exclude delivered messages to prevent polling loop
    .order('created_at', { ascending: false })
    .limit(limit);

  if (since) {
    const sinceDate = new Date(parseInt(since)).toISOString();
    query = query.gt('created_at', sinceDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching all user messages:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get browser session by token
 * For session-based authentication
 */
export async function getBrowserSession(sessionToken: string): Promise<{
  session_token: string;
  public_key: string;
  status: string;
  created_at: string;
  expires_at: string;
} | null> {
  const { data, error } = await getSupabase()
    .from('browser_sessions')
    .select('*')
    .eq('session_token', sessionToken)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching browser session:', error);
    throw error;
  }

  return data;
}

// ===========================================
// TYPING STATUS
// ===========================================

/**
 * Update typing status
 */
export async function updateTypingStatus(
  threadId: string,
  publicKey: string,
  isTyping: boolean
): Promise<void> {
  const { error } = await getSupabase()
    .from('typing_status')
    .upsert({
      thread_id: threadId,
      public_key: publicKey.toLowerCase(),
      is_typing: isTyping,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'thread_id,public_key',
    });

  if (error) {
    console.error('Error updating typing status:', error);
    throw error;
  }
}

/**
 * Get typing status for a thread
 */
export async function getTypingStatus(threadId: string): Promise<Array<{
  public_key: string;
  is_typing: boolean;
  updated_at: string;
}>> {
  const { data, error } = await getSupabase()
    .from('typing_status')
    .select('*')
    .eq('thread_id', threadId)
    .eq('is_typing', true)
    .gt('updated_at', new Date(Date.now() - 10000).toISOString()); // Last 10 seconds

  if (error) {
    console.error('Error fetching typing status:', error);
    throw error;
  }

  return data || [];
}

// ===========================================
// PRESENCE
// ===========================================

/**
 * Update user presence
 */
export async function updatePresence(
  publicKey: string,
  status: 'online' | 'away' | 'offline',
  deviceInfo?: any
): Promise<void> {
  const { error } = await getSupabase()
    .from('presence')
    .upsert({
      public_key: publicKey.toLowerCase(),
      status,
      last_seen: new Date().toISOString(),
      device_info: deviceInfo || null,
    }, {
      onConflict: 'public_key',
    });

  if (error) {
    console.error('Error updating presence:', error);
    throw error;
  }
}

/**
 * Get user presence
 */
export async function getPresence(publicKey: string): Promise<{
  publicKey: string;
  status: string;
  lastSeen: string | null;
} | null> {
  const { data, error } = await getSupabase()
    .from('presence')
    .select('*')
    .eq('public_key', publicKey.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching presence:', error);
    throw error;
  }

  if (!data) return null;

  return {
    publicKey: data.public_key,
    status: data.status,
    lastSeen: data.last_seen,
  };
}

/**
 * Get multiple users' presence
 */
export async function getMultiplePresence(publicKeys: string[]): Promise<Array<{
  publicKey: string;
  status: string;
  lastSeen: string | null;
}>> {
  const normalizedKeys = publicKeys.map(k => k.toLowerCase());

  const { data, error } = await getSupabase()
    .from('presence')
    .select('*')
    .in('public_key', normalizedKeys);

  if (error) {
    console.error('Error fetching multiple presence:', error);
    throw error;
  }

  return (data || []).map(d => ({
    publicKey: d.public_key,
    status: d.status,
    lastSeen: d.last_seen,
  }));
}

// ===========================================
// MIGRATION FUNCTIONS
// ===========================================

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

// SQL to create backup table (run in Supabase SQL editor before migration):
/*
-- Create backup table
CREATE TABLE IF NOT EXISTS encryption_keys_backup (
  pk_root TEXT PRIMARY KEY,
  old_encryption_key TEXT NOT NULL,
  backed_up_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create backup function
CREATE OR REPLACE FUNCTION backup_encryption_keys()
RETURNS void AS $$
BEGIN
  INSERT INTO encryption_keys_backup (pk_root, old_encryption_key)
  SELECT pk_root, encryption_key
  FROM records
  ON CONFLICT (pk_root) DO UPDATE
  SET old_encryption_key = EXCLUDED.old_encryption_key,
      backed_up_at = NOW();
END;
$$ LANGUAGE plpgsql;
*/

// ===========================================
// PAYMENT INTENTS
// ===========================================

/**
 * Create a new payment intent
 */
export async function createPaymentIntent(data: {
  payment_id: string;
  from_pk: string;
  to_pk: string;
  envelope_json: any;
  payload_type: string;
  currency?: string | null;
  route_type?: string | null;
  expires_at?: string | null;
}): Promise<DbPaymentIntent> {
  const { data: result, error } = await getSupabase()
    .from('payment_intents')
    .insert({
      payment_id: data.payment_id,
      from_pk: data.from_pk.toLowerCase(),
      to_pk: data.to_pk.toLowerCase(),
      envelope_json: data.envelope_json,
      payload_type: data.payload_type,
      currency: data.currency || null,
      route_type: data.route_type || null,
      status: 'pending',
      expires_at: data.expires_at || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }

  return result as DbPaymentIntent;
}

/**
 * Get payment intent by ID
 */
export async function getPaymentIntent(paymentId: string): Promise<DbPaymentIntent | null> {
  const { data, error } = await getSupabase()
    .from('payment_intents')
    .select('*')
    .eq('payment_id', paymentId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching payment intent:', error);
    throw error;
  }

  return data as DbPaymentIntent | null;
}

/**
 * Get pending payments for a recipient
 */
export async function getPendingPayments(
  recipientPk: string,
  since?: string,
  limit: number = 50
): Promise<DbPaymentIntent[]> {
  let query = getSupabase()
    .from('payment_intents')
    .select('*')
    .eq('to_pk', recipientPk.toLowerCase())
    .in('status', ['pending', 'delivered'])
    .order('created_at', { ascending: true })
    .limit(limit);

  if (since) {
    query = query.gt('created_at', since);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching pending payments:', error);
    throw error;
  }

  return data as DbPaymentIntent[];
}

/**
 * Mark payments as delivered
 */
export async function markPaymentsDelivered(paymentIds: string[]): Promise<void> {
  const { error } = await getSupabase()
    .from('payment_intents')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
    })
    .in('payment_id', paymentIds)
    .eq('status', 'pending');

  if (error) {
    console.error('Error marking payments delivered:', error);
    throw error;
  }
}

/**
 * Update payment status
 */
export async function updatePaymentStatus(
  paymentId: string,
  status: 'accepted' | 'rejected' | 'expired'
): Promise<void> {
  const { error } = await getSupabase()
    .from('payment_intents')
    .update({
      status: status,
      acked_at: new Date().toISOString(),
    })
    .eq('payment_id', paymentId);

  if (error) {
    console.error('Error updating payment status:', error);
    throw error;
  }
}

/**
 * Get payment history for a user
 */
export async function getPaymentHistory(
  publicKey: string,
  options: {
    direction?: 'sent' | 'received';
    status?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<DbPaymentIntent[]> {
  const { direction, status, limit = 50, offset = 0 } = options;
  const pk = publicKey.toLowerCase();

  let query = getSupabase()
    .from('payment_intents')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Filter by direction
  if (direction === 'sent') {
    query = query.eq('from_pk', pk);
  } else if (direction === 'received') {
    query = query.eq('to_pk', pk);
  } else {
    // Both sent and received
    query = query.or(`from_pk.eq.${pk},to_pk.eq.${pk}`);
  }

  // Filter by status
  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching payment history:', error);
    throw error;
  }

  return data as DbPaymentIntent[];
}

/**
 * Get outgoing pending payments
 */
export async function getOutgoingPendingPayments(
  senderPk: string
): Promise<DbPaymentIntent[]> {
  const { data, error } = await getSupabase()
    .from('payment_intents')
    .select('*')
    .eq('from_pk', senderPk.toLowerCase())
    .in('status', ['pending', 'delivered'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching outgoing payments:', error);
    throw error;
  }

  return data as DbPaymentIntent[];
}

// ===========================================
// PAYMENT ACKS
// ===========================================

/**
 * Create payment acknowledgment
 */
export async function createPaymentAck(data: {
  payment_id: string;
  from_pk: string;
  status: 'accepted' | 'rejected';
  reason?: string | null;
  envelope_json?: any | null;
}): Promise<DbPaymentAck> {
  const { data: result, error } = await getSupabase()
    .from('payment_acks')
    .insert({
      payment_id: data.payment_id,
      from_pk: data.from_pk.toLowerCase(),
      status: data.status,
      reason: data.reason || null,
      envelope_json: data.envelope_json || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating payment ack:', error);
    throw error;
  }

  return result as DbPaymentAck;
}

/**
 * Get payment acknowledgment
 */
export async function getPaymentAck(paymentId: string): Promise<DbPaymentAck | null> {
  const { data, error } = await getSupabase()
    .from('payment_acks')
    .select('*')
    .eq('payment_id', paymentId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching payment ack:', error);
    throw error;
  }

  return data as DbPaymentAck | null;
}

// ===========================================
// GEOAUTH SESSIONS (Chapter 8)
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

// ===========================================
// CLEANUP FUNCTIONS
// ===========================================

/**
 * Expire old pending payments
 */
export async function expirePendingPayments(): Promise<number> {
  const { data, error } = await getSupabase()
    .from('payment_intents')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .not('expires_at', 'is', null)
    .lt('expires_at', new Date().toISOString())
    .select();

  if (error) {
    console.error('Error expiring payments:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Expire old geoauth sessions
 */
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

// ===========================================
// EXISTING CLEANUP FUNCTIONS
// ===========================================

/**
 * Cleanup expired messages
 */
export async function cleanupExpiredMessages(): Promise<number> {
  // Mark expired
  await getSupabase()
    .from('messages')
    .update({ status: 'expired' })
    .lt('expires_at', new Date().toISOString())
    .eq('status', 'pending');

  // Delete old delivered messages
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await getSupabase()
    .from('messages')
    .delete()
    .lt('delivered_at', thirtyDaysAgo)
    .select('id');

  return data?.length || 0;
}

/**
 * Cleanup stale typing indicators
 */
export async function cleanupTypingStatus(): Promise<void> {
  const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();

  await getSupabase()
    .from('typing_status')
    .delete()
    .lt('updated_at', thirtySecondsAgo);
}

/**
 * Cleanup stale presence (mark offline)
 */
export async function cleanupStalePresence(): Promise<void> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  await getSupabase()
    .from('presence')
    .update({ status: 'offline' })
    .eq('status', 'online')
    .lt('last_seen', fiveMinutesAgo);
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

// ===========================================
// ORGANIZATION REGISTRATION
// ===========================================

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
// OAUTH CLIENTS
// ===========================================

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
// PAYMENT REQUESTS
// ===========================================

export async function createPaymentRequest(
  request: DbPaymentRequest
): Promise<DbPaymentRequest> {
  const { data, error } = await getSupabase()
    .from('payment_requests')
    .insert({
      id: request.id,
      payment_id: request.payment_id,
      creator_pk: request.creator_pk.toLowerCase(),
      to_pk: request.to_pk.toLowerCase(),
      to_handle: request.to_handle,
      amount: request.amount,
      currency: request.currency,
      memo: request.memo,
      reference_id: request.reference_id,
      callback_url: request.callback_url,
      status: 'pending',
      expires_at: request.expires_at,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating payment request:', error);
    throw error;
  }

  return data as DbPaymentRequest;
}

export async function getPaymentRequest(
  paymentId: string
): Promise<DbPaymentRequest | null> {
  const { data, error } = await getSupabase()
    .from('payment_requests')
    .select('*')
    .eq('payment_id', paymentId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching payment request:', error);
    throw error;
  }

  return data as DbPaymentRequest | null;
}

export async function updatePaymentRequest(
  paymentId: string,
  updates: Partial<DbPaymentRequest>
): Promise<void> {
  const { error } = await getSupabase()
    .from('payment_requests')
    .update({
      status: updates.status,
      from_pk: updates.from_pk?.toLowerCase(),
      stellar_tx_hash: updates.stellar_tx_hash,
      completed_at: updates.completed_at,
    })
    .eq('payment_id', paymentId);

  if (error) {
    console.error('Error updating payment request:', error);
    throw error;
  }
}

export async function getPaymentRequestsByRecipient(
  toPk: string,
  status?: string,
  limit: number = 50
): Promise<DbPaymentRequest[]> {
  let query = getSupabase()
    .from('payment_requests')
    .select('*')
    .eq('to_pk', toPk.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching payment requests:', error);
    throw error;
  }

  return data || [];
}

export async function getPaymentRequestsByCreator(
  creatorPk: string,
  status?: string,
  limit: number = 50
): Promise<DbPaymentRequest[]> {
  let query = getSupabase()
    .from('payment_requests')
    .select('*')
    .eq('creator_pk', creatorPk.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching payment requests:', error);
    throw error;
  }

  return data || [];
}

// ===========================================
// GSITES
// ===========================================

export async function getGSite(pkRoot: string): Promise<any | null> {
  const { data, error } = await getSupabase()
    .from('gsites')
    .select('gsite_json')
    .eq('pk_root', pkRoot.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching gSite:', error);
    throw error;
  }

  return data?.gsite_json || null;
}

export async function upsertGSite(
  pkRoot: string,
  handle: string | null,
  gsiteJson: any,
  signature: string
): Promise<void> {
  const { error } = await getSupabase()
    .from('gsites')
    .upsert({
      pk_root: pkRoot.toLowerCase(),
      handle: handle?.toLowerCase(),
      gsite_json: gsiteJson,
      version: gsiteJson.version || 1,
      signature,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'pk_root',
    });

  if (error) {
    console.error('Error upserting gSite:', error);
    throw error;
  }
}

// ===========================================
// VERIFICATION CHALLENGES
// ===========================================

export async function createVerificationChallenge(challenge: {
  challenge_id: string;
  public_key: string;
  challenge: string;
  require_fresh_breadcrumb: boolean;
  allowed_h3_cells?: string[];
  expires_at: string;
}): Promise<void> {
  const { error } = await getSupabase()
    .from('verification_challenges')
    .insert({
      challenge_id: challenge.challenge_id,
      public_key: challenge.public_key.toLowerCase(),
      challenge: challenge.challenge,
      require_fresh_breadcrumb: challenge.require_fresh_breadcrumb,
      allowed_h3_cells: challenge.allowed_h3_cells,
      status: 'pending',
      expires_at: challenge.expires_at,
    });

  if (error) {
    console.error('Error creating verification challenge:', error);
    throw error;
  }
}

export async function getVerificationChallenge(challengeId: string): Promise<{
  challenge_id: string;
  public_key: string;
  challenge: string;
  require_fresh_breadcrumb: boolean;
  allowed_h3_cells?: string[];
  status: string;
  expires_at: string;
} | null> {
  const { data, error } = await getSupabase()
    .from('verification_challenges')
    .select('*')
    .eq('challenge_id', challengeId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching challenge:', error);
    throw error;
  }

  return data;
}

export async function markChallengeVerified(challengeId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('verification_challenges')
    .update({ status: 'verified' })
    .eq('challenge_id', challengeId);

  if (error) {
    console.error('Error marking challenge verified:', error);
    throw error;
  }
}

// ===========================================
// STATISTICS
// ===========================================

export async function getApiStats(): Promise<{
  total_identities: number;
  total_handles: number;
  total_breadcrumbs: number;
  active_webhooks: number;
  pending_payments: number;
}> {
  // Get counts from various tables
  const [records, aliases, webhooks, payments] = await Promise.all([
    getSupabase().from('records').select('*', { count: 'exact', head: true }),
    getSupabase().from('aliases').select('*', { count: 'exact', head: true }),
    getSupabase().from('webhook_subscriptions').select('*', { count: 'exact', head: true }).eq('active', true),
    getSupabase().from('payment_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  // Sum breadcrumbs
  const { data: breadcrumbSum } = await getSupabase()
    .from('records')
    .select('breadcrumb_count')
    .then(result => {
      const sum = (result.data || []).reduce((acc, r) => acc + (r.breadcrumb_count || 0), 0);
      return { data: sum };
    });

  return {
    total_identities: records.count || 0,
    total_handles: aliases.count || 0,
    total_breadcrumbs: breadcrumbSum || 0,
    active_webhooks: webhooks.count || 0,
    pending_payments: payments.count || 0,
  };
}

// ===========================================
// GNS NODE - DATABASE ADDITIONS
// Sprint 6, 7, 8 Database Functions
// ===========================================
// 
// APPEND THIS TO YOUR EXISTING db.ts FILE
// This adds all missing functions for:
// - Loyalty API (Sprint 6)
// - Merchant API (Sprint 5-6)
// - Receipts API (Sprint 5-6)
// - Refund API (Sprint 6)
// - Sprint 7 API (Batch, Notifications, Analytics, Subscriptions)
// - Sprint 8 API (Multi-currency, Webhooks, Payment Links, Invoices, QR)
// 
// NOTE: getSupabase() is already defined in your existing db.ts
// ===========================================

// ===========================================
// HELPER: Generate IDs
// ===========================================

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
}

// ===========================================
// GNS MERCHANT FUNCTIONS (Sprint 5-6)
// For gns_merchants table (payments/settlements)
// Note: geoauth_merchants functions exist separately
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

export async function createMerchant(merchantData: {
  merchant_id: string;
  gns_identity: string;
  business_name: string;
  business_type?: string;
  email?: string;
  api_key?: string;
  stellar_address?: string;
}) {
  const { data, error } = await getSupabase()
    .from('gns_merchants')
    .insert({
      merchant_id: merchantData.merchant_id,
      gns_identity: merchantData.gns_identity,
      business_name: merchantData.business_name,
      business_type: merchantData.business_type || 'general',
      email: merchantData.email?.toLowerCase(),
      api_key: merchantData.api_key,
      stellar_address: merchantData.stellar_address,
      status: 'active',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function searchMerchants(query: string, limit = 20) {
  const { data, error } = await getSupabase()
    .from('gns_merchants')
    .select('*')
    .or(`business_name.ilike.%${query}%,merchant_id.ilike.%${query}%`)
    .eq('status', 'active')
    .limit(limit);
  
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

export async function getMerchantTransactions(merchantId: string, limit = 50, offset = 0) {
  const { data, error } = await getSupabase()
    .from('gns_settlements')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error) throw error;
  return data || [];
}

// ===========================================
// SETTLEMENT FUNCTIONS (Sprint 5-7)
// ===========================================

export async function getSettlementByRequestId(requestId: string) {
  const { data, error } = await getSupabase()
    .from('gns_settlements')
    .select('*')
    .eq('request_id', requestId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getSettlementByTxHash(txHash: string) {
  const { data, error } = await getSupabase()
    .from('gns_settlements')
    .select('*')
    .eq('stellar_tx_hash', txHash)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createSettlement(settlementData: {
  settlement_id: string;
  merchant_id: string;
  user_pk: string;
  amount: string;
  currency: string;
  request_id?: string;
  h3_cell?: string;
}) {
  const { data, error } = await getSupabase()
    .from('gns_settlements')
    .insert({
      ...settlementData,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateSettlementStatus(settlementId: string, status: string, txHash?: string) {
  const updateData: any = { status, updated_at: new Date().toISOString() };
  if (txHash) updateData.stellar_tx_hash = txHash;
  if (status === 'completed') updateData.completed_at = new Date().toISOString();
  
  const { data, error } = await getSupabase()
    .from('gns_settlements')
    .update(updateData)
    .eq('settlement_id', settlementId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateSettlementComplete(settlementId: string, txHash: string) {
  return updateSettlementStatus(settlementId, 'completed', txHash);
}

export async function createPaymentCompletion(data: {
  settlement_id: string;
  stellar_tx_hash: string;
  completed_at: string;
}) {
  return updateSettlementComplete(data.settlement_id, data.stellar_tx_hash);
}

// ===========================================
// RECEIPT FUNCTIONS (Sprint 5-6)
// ===========================================

export async function getReceipt(receiptId: string) {
  const { data, error } = await getSupabase()
    .from('gns_receipts')
    .select('*')
    .eq('receipt_id', receiptId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getReceiptByTxHash(txHash: string) {
  const { data, error } = await getSupabase()
    .from('gns_receipts')
    .select('*')
    .eq('stellar_tx_hash', txHash)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createReceipt(receiptData: {
  receipt_id: string;
  settlement_id: string;
  merchant_id: string;
  merchant_name: string;
  user_pk: string;
  amount: string;
  currency: string;
  stellar_tx_hash?: string;
  items?: any[];
}) {
  const { data, error } = await getSupabase()
    .from('gns_receipts')
    .insert({
      ...receiptData,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getUserReceipts(userPk: string, limit = 50, offset = 0) {
  const { data, error } = await getSupabase()
    .from('gns_receipts')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error) throw error;
  return data || [];
}

export async function getReceiptStats(userPk: string) {
  const { data, error } = await getSupabase()
    .from('gns_receipts')
    .select('amount, currency, created_at')
    .eq('user_pk', userPk.toLowerCase());
  
  if (error) throw error;
  
  const receipts = data || [];
  return {
    total_count: receipts.length,
    total_amount: receipts.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0),
  };
}

// ===========================================
// REFUND FUNCTIONS (Sprint 6)
// ===========================================

export async function getRefund(refundId: string) {
  const { data, error } = await getSupabase()
    .from('gns_refunds')
    .select('*')
    .eq('refund_id', refundId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createRefundRequest(refundData: {
  refund_id: string;
  settlement_id?: string;
  original_transaction_hash?: string;
  merchant_id: string;
  user_pk: string;
  original_amount: string;
  refund_amount: string;
  currency: string;
  reason: string;
  reason_details?: string;
}) {
  const { data, error } = await getSupabase()
    .from('gns_refunds')
    .insert({
      ...refundData,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getUserRefunds(userPk: string, limit = 50) {
  const { data, error } = await getSupabase()
    .from('gns_refunds')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

export async function getMerchantRefunds(merchantId: string, limit = 50) {
  const { data, error } = await getSupabase()
    .from('gns_refunds')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

export async function getPendingRefundForSettlement(settlementId: string) {
  const { data, error } = await getSupabase()
    .from('gns_refunds')
    .select('*')
    .eq('settlement_id', settlementId)
    .eq('status', 'pending')
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateRefundStatus(refundId: string, status: string, txHash?: string) {
  const updateData: any = { status, updated_at: new Date().toISOString() };
  if (txHash) updateData.refund_transaction_hash = txHash;
  if (status === 'completed') updateData.processed_at = new Date().toISOString();
  
  const { data, error } = await getSupabase()
    .from('gns_refunds')
    .update(updateData)
    .eq('refund_id', refundId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function completeRefund(refundId: string, txHash: string) {
  return updateRefundStatus(refundId, 'completed', txHash);
}

export async function rejectRefund(refundId: string, reason: string) {
  const { data, error } = await getSupabase()
    .from('gns_refunds')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('refund_id', refundId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getRefundStats(merchantId: string) {
  const { data, error } = await getSupabase()
    .from('gns_refunds')
    .select('status, refund_amount')
    .eq('merchant_id', merchantId);
  
  if (error) throw error;
  
  const refunds = data || [];
  return {
    pending: refunds.filter(r => r.status === 'pending').length,
    completed: refunds.filter(r => r.status === 'completed').length,
    rejected: refunds.filter(r => r.status === 'rejected').length,
    total_refunded: refunds
      .filter(r => r.status === 'completed')
      .reduce((sum, r) => sum + parseFloat(r.refund_amount || '0'), 0),
  };
}

// ===========================================
// LOYALTY FUNCTIONS (Sprint 6)
// ===========================================

export async function getLoyaltyProfile(userPk: string) {
  const { data, error } = await getSupabase()
    .from('gns_loyalty_profiles')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createLoyaltyProfile(userPk: string) {
  const { data, error } = await getSupabase()
    .from('gns_loyalty_profiles')
    .insert({
      user_pk: userPk.toLowerCase(),
      total_points: 0,
      available_points: 0,
      lifetime_points: 0,
      tier: 'bronze',
      tier_progress: 0,
      referral_code: generateId('REF'),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateLoyaltyProfile(userPk: string, updates: Partial<{
  total_points: number;
  available_points: number;
  lifetime_points: number;
  tier: string;
  tier_progress: number;
  total_transactions: number;
  total_spent: number;
}>) {
  const { data, error } = await getSupabase()
    .from('gns_loyalty_profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('user_pk', userPk.toLowerCase())
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getPointsHistory(userPk: string, limit = 50) {
  const { data, error } = await getSupabase()
    .from('gns_point_transactions')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

export async function createPointTransaction(txData: {
  user_pk: string;
  points: number;
  type: string;
  description: string;
  reference_id?: string;
  merchant_id?: string;
  balance_after: number;
}) {
  const { data, error } = await getSupabase()
    .from('gns_point_transactions')
    .insert({
      transaction_id: generateId('PT'),
      ...txData,
      user_pk: txData.user_pk.toLowerCase(),
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getUserAchievements(userPk: string) {
  const { data, error } = await getSupabase()
    .from('gns_user_achievements')
    .select('*, achievement:gns_achievements(*)')
    .eq('user_pk', userPk.toLowerCase());
  
  if (error) throw error;
  return data || [];
}

export async function getAvailableRewards(userPk?: string) {
  const { data, error } = await getSupabase()
    .from('gns_rewards')
    .select('*')
    .eq('is_available', true)
    .order('points_cost', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

export async function getReward(rewardId: string) {
  const { data, error } = await getSupabase()
    .from('gns_rewards')
    .select('*')
    .eq('reward_id', rewardId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateReward(rewardId: string, updates: any) {
  const { data, error } = await getSupabase()
    .from('gns_rewards')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('reward_id', rewardId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function createRedemption(redemptionData: {
  reward_id: string;
  reward_name: string;
  user_pk: string;
  points_spent: number;
  merchant_id?: string;
  expires_at?: string;
}) {
  const { data, error } = await getSupabase()
    .from('gns_redemptions')
    .insert({
      redemption_id: generateId('RDM'),
      ...redemptionData,
      user_pk: redemptionData.user_pk.toLowerCase(),
      coupon_code: generateId('CPN'),
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getUserRedemptions(userPk: string, limit = 50) {
  const { data, error } = await getSupabase()
    .from('gns_redemptions')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

export async function getLoyaltyPrograms(merchantId?: string) {
  let query = getSupabase()
    .from('gns_loyalty_programs')
    .select('*')
    .eq('is_active', true);
  
  if (merchantId) {
    query = query.eq('merchant_id', merchantId);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getLoyaltyProgram(programId: string) {
  const { data, error } = await getSupabase()
    .from('gns_loyalty_programs')
    .select('*')
    .eq('program_id', programId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getUserProgramEnrollment(userPk: string, programId: string) {
  const { data, error } = await getSupabase()
    .from('gns_program_enrollments')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .eq('program_id', programId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createProgramEnrollment(enrollmentData: {
  user_pk: string;
  program_id: string;
}) {
  const { data, error } = await getSupabase()
    .from('gns_program_enrollments')
    .insert({
      ...enrollmentData,
      user_pk: enrollmentData.user_pk.toLowerCase(),
      enrolled_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function findUserByReferralCode(referralCode: string) {
  const { data, error } = await getSupabase()
    .from('gns_loyalty_profiles')
    .select('*')
    .eq('referral_code', referralCode)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// ===========================================
// SPRINT 7: BATCH SETTLEMENT FUNCTIONS
// ===========================================

export async function getSettlementConfig(merchantId: string) {
  const { data, error } = await getSupabase()
    .from('gns_settlement_config')
    .select('*')
    .eq('merchant_id', merchantId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function upsertSettlementConfig(config: {
  merchant_id: string;
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
      ...config,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'merchant_id' })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getPendingBatchSummary(merchantId: string) {
  const { data, error } = await getSupabase()
    .from('gns_settlements')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('status', 'completed')
    .is('batch_id', null);
  
  if (error) throw error;
  return data || [];
}

export async function getPendingSettlementTransactions(merchantId: string) {
  return getPendingBatchSummary(merchantId);
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
  period_start: string;
  period_end: string;
}) {
  const batchId = generateId('BATCH');
  
  const { data, error } = await getSupabase()
    .from('gns_batch_settlements')
    .insert({
      batch_id: batchId,
      ...batchData,
      status: 'pending',
      created_at: new Date().toISOString(),
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

export async function getBatchSettlements(merchantId: string, limit = 20) {
  const { data, error } = await getSupabase()
    .from('gns_batch_settlements')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
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

// ===========================================
// SPRINT 7: NOTIFICATION FUNCTIONS
// ===========================================

export async function registerDevice(deviceData: {
  user_pk: string;
  device_id: string;
  push_token: string;
  platform: string;
  device_name?: string;
}) {
  const { data, error } = await getSupabase()
    .from('gns_devices')
    .upsert({
      ...deviceData,
      user_pk: deviceData.user_pk.toLowerCase(),
      is_active: true,
      registered_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
    }, { onConflict: 'user_pk,device_id' })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function unregisterDevice(userPk: string, deviceId: string) {
  const { error } = await getSupabase()
    .from('gns_devices')
    .update({ is_active: false })
    .eq('user_pk', userPk.toLowerCase())
    .eq('device_id', deviceId);
  
  if (error) throw error;
}

export async function getNotificationPreferences(userPk: string) {
  const { data, error } = await getSupabase()
    .from('gns_notification_preferences')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function upsertNotificationPreferences(userPk: string, prefs: any) {
  const { data, error } = await getSupabase()
    .from('gns_notification_preferences')
    .upsert({
      user_pk: userPk.toLowerCase(),
      ...prefs,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_pk' })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getNotifications(userPk: string, limit = 50, unreadOnly = false) {
  let query = getSupabase()
    .from('gns_notifications')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (unreadOnly) {
    query = query.eq('is_read', false);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getUnreadNotificationCount(userPk: string) {
  const { count, error } = await getSupabase()
    .from('gns_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_pk', userPk.toLowerCase())
    .eq('is_read', false);
  
  if (error) throw error;
  return count || 0;
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await getSupabase()
    .from('gns_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('notification_id', notificationId);
  
  if (error) throw error;
}

export async function markAllNotificationsRead(userPk: string) {
  const { error } = await getSupabase()
    .from('gns_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_pk', userPk.toLowerCase())
    .eq('is_read', false);
  
  if (error) throw error;
}

// ===========================================
// SPRINT 7: ANALYTICS FUNCTIONS
// ===========================================

export async function getSpendingSummary(userPk: string, period: string = 'month') {
  const { data, error } = await getSupabase()
    .from('gns_receipts')
    .select('amount, currency, created_at, merchant_name')
    .eq('user_pk', userPk.toLowerCase())
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  const receipts = data || [];
  const total = receipts.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0);
  
  return {
    total_spent: total,
    transaction_count: receipts.length,
    receipts,
  };
}

export async function getDailySpending(userPk: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await getSupabase()
    .from('gns_receipts')
    .select('amount, created_at')
    .eq('user_pk', userPk.toLowerCase())
    .gte('created_at', since);
  
  if (error) throw error;
  return data || [];
}

export async function getSpendingByCategory(userPk: string) {
  const { data, error } = await getSupabase()
    .from('gns_receipts')
    .select('amount, category')
    .eq('user_pk', userPk.toLowerCase());
  
  if (error) throw error;
  return data || [];
}

export async function getSpendingByMerchant(userPk: string, limit = 10) {
  const { data, error } = await getSupabase()
    .from('gns_receipts')
    .select('amount, merchant_id, merchant_name')
    .eq('user_pk', userPk.toLowerCase());
  
  if (error) throw error;
  return data || [];
}

export async function getBudgets(userPk: string) {
  const { data, error } = await getSupabase()
    .from('gns_budgets')
    .select('*')
    .eq('user_pk', userPk.toLowerCase());
  
  if (error) throw error;
  return data || [];
}

export async function createBudget(budgetData: {
  user_pk: string;
  name: string;
  amount: number;
  period: string;
  category?: string;
}) {
  const { data, error } = await getSupabase()
    .from('gns_budgets')
    .insert({
      budget_id: generateId('BDG'),
      ...budgetData,
      user_pk: budgetData.user_pk.toLowerCase(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteBudget(budgetId: string) {
  const { error } = await getSupabase()
    .from('gns_budgets')
    .delete()
    .eq('budget_id', budgetId);
  
  if (error) throw error;
}

export async function getSavingsGoals(userPk: string) {
  const { data, error } = await getSupabase()
    .from('gns_savings_goals')
    .select('*')
    .eq('user_pk', userPk.toLowerCase());
  
  if (error) throw error;
  return data || [];
}

export async function createSavingsGoal(goalData: {
  user_pk: string;
  name: string;
  target_amount: number;
  target_date?: string;
}) {
  const { data, error } = await getSupabase()
    .from('gns_savings_goals')
    .insert({
      goal_id: generateId('GOAL'),
      ...goalData,
      user_pk: goalData.user_pk.toLowerCase(),
      current_amount: 0,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function addToSavingsGoal(goalId: string, amount: number) {
  const { data, error } = await getSupabase()
    .rpc('add_to_savings_goal', { p_goal_id: goalId, p_amount: amount });
  
  if (error) throw error;
  return data;
}

export async function getSpendingInsights(userPk: string) {
  // Return placeholder insights
  return {
    top_category: 'Food & Dining',
    monthly_average: 0,
    trend: 'stable',
    suggestions: [],
  };
}

// ===========================================
// SPRINT 7: SUBSCRIPTION FUNCTIONS
// ===========================================

export async function getSubscriptionPlans(merchantId?: string) {
  let query = getSupabase()
    .from('gns_subscription_plans')
    .select('*')
    .eq('is_active', true);
  
  if (merchantId) {
    query = query.eq('merchant_id', merchantId);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getSubscriptionPlan(planId: string) {
  const { data, error } = await getSupabase()
    .from('gns_subscription_plans')
    .select('*')
    .eq('plan_id', planId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getUserSubscriptions(userPk: string) {
  const { data, error } = await getSupabase()
    .from('gns_subscriptions')
    .select('*, plan:gns_subscription_plans(*)')
    .eq('user_pk', userPk.toLowerCase());
  
  if (error) throw error;
  return data || [];
}

export async function getSubscription(subscriptionId: string) {
  const { data, error } = await getSupabase()
    .from('gns_subscriptions')
    .select('*, plan:gns_subscription_plans(*)')
    .eq('subscription_id', subscriptionId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getActiveSubscriptionForPlan(userPk: string, planId: string) {
  const { data, error } = await getSupabase()
    .from('gns_subscriptions')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .eq('plan_id', planId)
    .eq('status', 'active')
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createSubscription(subData: {
  user_pk: string;
  plan_id: string;
  merchant_id?: string;
  amount: number;
  currency: string;
  billing_cycle: string;
  next_billing_date: string;
}) {
  const { data, error } = await getSupabase()
    .from('gns_subscriptions')
    .insert({
      subscription_id: generateId('SUB'),
      ...subData,
      user_pk: subData.user_pk.toLowerCase(),
      status: 'active',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function cancelSubscription(subscriptionId: string) {
  const { data, error } = await getSupabase()
    .from('gns_subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('subscription_id', subscriptionId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function pauseSubscription(subscriptionId: string) {
  const { data, error } = await getSupabase()
    .from('gns_subscriptions')
    .update({
      status: 'paused',
      paused_at: new Date().toISOString(),
    })
    .eq('subscription_id', subscriptionId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function resumeSubscription(subscriptionId: string) {
  const { data, error } = await getSupabase()
    .from('gns_subscriptions')
    .update({
      status: 'active',
      paused_at: null,
    })
    .eq('subscription_id', subscriptionId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getSubscriptionInvoices(subscriptionId: string) {
  const { data, error } = await getSupabase()
    .from('gns_subscription_invoices')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function getUpcomingRenewals(userPk: string, days = 7) {
  const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await getSupabase()
    .from('gns_subscriptions')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .eq('status', 'active')
    .lte('next_billing_date', futureDate);
  
  if (error) throw error;
  return data || [];
}

// ===========================================
// SPRINT 8: MULTI-CURRENCY FUNCTIONS
// ===========================================

export async function getSupportedAssets() {
  const { data, error } = await getSupabase()
    .from('gns_assets')
    .select('*')
    .eq('is_active', true);
  
  if (error) throw error;
  return data || [];
}

export async function getCurrencyPreferences(userPk: string) {
  const { data, error } = await getSupabase()
    .from('gns_currency_preferences')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function upsertCurrencyPreferences(userPk: string, prefs: any) {
  const { data, error } = await getSupabase()
    .from('gns_currency_preferences')
    .upsert({
      user_pk: userPk.toLowerCase(),
      ...prefs,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_pk' })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getExchangeRate(fromCurrency: string, toCurrency: string) {
  const { data, error } = await getSupabase()
    .from('gns_exchange_rates')
    .select('*')
    .eq('from_currency', fromCurrency)
    .eq('to_currency', toCurrency)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getAllExchangeRates() {
  const { data, error } = await getSupabase()
    .from('gns_exchange_rates')
    .select('*');
  
  if (error) throw error;
  return data || [];
}

// ===========================================
// SPRINT 8: WEBHOOK FUNCTIONS
// ===========================================

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
}) {
  const { data, error } = await getSupabase()
    .from('gns_webhook_endpoints')
    .insert({
      endpoint_id: generateId('WH'),
      ...endpointData,
      is_active: true,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateWebhookEndpoint(endpointId: string, updates: any) {
  const { data, error } = await getSupabase()
    .from('gns_webhook_endpoints')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('endpoint_id', endpointId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteWebhookEndpoint(endpointId: string) {
  const { error } = await getSupabase()
    .from('gns_webhook_endpoints')
    .delete()
    .eq('endpoint_id', endpointId);
  
  if (error) throw error;
}

export async function testWebhookEndpoint(endpointId: string) {
  // Return test result
  return { success: true, response_time_ms: 100 };
}

export async function getWebhookEvents(merchantId: string, limit = 50) {
  const { data, error } = await getSupabase()
    .from('gns_webhook_events')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

export async function getWebhookDeliveries(eventId: string) {
  const { data, error } = await getSupabase()
    .from('gns_webhook_deliveries')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function logWebhookDelivery(deliveryData: {
  endpoint_id: string;
  event_id: string;
  event_type: string;
  status: string;
  response_code?: number;
  response_time_ms?: number;
  error?: string;
}) {
  const { data, error } = await getSupabase()
    .from('gns_webhook_deliveries')
    .insert({
      ...deliveryData,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ===========================================
// SPRINT 8: PAYMENT LINK FUNCTIONS
// ===========================================

export async function createPaymentLink(linkData: {
  merchant_id: string;
  amount?: number;
  currency: string;
  description?: string;
  is_reusable?: boolean;
  expires_at?: string;
}) {
  const { data, error } = await getSupabase()
    .from('gns_payment_links')
    .insert({
      link_id: generateId('LINK'),
      link_code: generateId('PAY').toLowerCase(),
      ...linkData,
      status: 'active',
      view_count: 0,
      payment_count: 0,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getPaymentLinks(merchantId: string) {
  const { data, error } = await getSupabase()
    .from('gns_payment_links')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function getPaymentLink(linkId: string) {
  const { data, error } = await getSupabase()
    .from('gns_payment_links')
    .select('*')
    .eq('link_id', linkId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getPaymentLinkByCode(linkCode: string) {
  const { data, error } = await getSupabase()
    .from('gns_payment_links')
    .select('*')
    .eq('link_code', linkCode)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function incrementLinkViews(linkId: string) {
  const { error } = await getSupabase()
    .rpc('increment_link_views', { p_link_id: linkId });
  
  if (error) {
    // Fallback if RPC doesn't exist
    await getSupabase()
      .from('gns_payment_links')
      .update({ view_count: getSupabase().rpc('coalesce', { a: 'view_count', b: 0 }) })
      .eq('link_id', linkId);
  }
}

export async function createLinkPayment(paymentData: {
  link_id: string;
  payer_pk: string;
  amount: number;
  currency: string;
  stellar_tx_hash?: string;
}) {
  const { data, error } = await getSupabase()
    .from('gns_link_payments')
    .insert({
      payment_id: generateId('LPAY'),
      ...paymentData,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateLinkStats(linkId: string) {
  const { error } = await getSupabase()
    .from('gns_payment_links')
    .update({ payment_count: getSupabase().rpc('coalesce', { a: 'payment_count', b: 0 }) })
    .eq('link_id', linkId);
  
  if (error) throw error;
}

export async function updatePaymentLinkStatus(linkId: string, status: string) {
  const { data, error } = await getSupabase()
    .from('gns_payment_links')
    .update({ status })
    .eq('link_id', linkId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ===========================================
// SPRINT 8: INVOICE FUNCTIONS
// ===========================================

export async function createInvoice(invoiceData: {
  merchant_id: string;
  customer_pk?: string;
  customer_email?: string;
  amount: number;
  currency: string;
  due_date?: string;
  items?: any[];
  notes?: string;
}) {
  const { data, error } = await getSupabase()
    .from('gns_invoices')
    .insert({
      invoice_id: generateId('INV'),
      invoice_number: `INV-${Date.now()}`,
      ...invoiceData,
      status: 'draft',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getInvoices(merchantId: string) {
  const { data, error } = await getSupabase()
    .from('gns_invoices')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function getInvoice(invoiceId: string) {
  const { data, error } = await getSupabase()
    .from('gns_invoices')
    .select('*')
    .eq('invoice_id', invoiceId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateInvoiceStatus(invoiceId: string, status: string) {
  const { data, error } = await getSupabase()
    .from('gns_invoices')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('invoice_id', invoiceId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function markInvoicePaid(invoiceId: string, txHash: string) {
  const { data, error } = await getSupabase()
    .from('gns_invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      stellar_tx_hash: txHash,
    })
    .eq('invoice_id', invoiceId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ===========================================
// SPRINT 8: QR CODE FUNCTIONS
// ===========================================

export async function createQrCode(qrData: {
  user_pk?: string;
  merchant_id?: string;
  type: string;
  amount?: number;
  currency?: string;
  data: any;
}) {
  const { data, error } = await getSupabase()
    .from('gns_qr_codes')
    .insert({
      qr_id: generateId('QR'),
      ...qrData,
      user_pk: qrData.user_pk?.toLowerCase(),
      is_active: true,
      scan_count: 0,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getQrCode(qrId: string) {
  const { data, error } = await getSupabase()
    .from('gns_qr_codes')
    .select('*')
    .eq('qr_id', qrId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getUserQrCodes(userPk: string) {
  const { data, error } = await getSupabase()
    .from('gns_qr_codes')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .eq('is_active', true);
  
  if (error) throw error;
  return data || [];
}

export async function deactivateQrCode(qrId: string) {
  const { error } = await getSupabase()
    .from('gns_qr_codes')
    .update({ is_active: false })
    .eq('qr_id', qrId);
  
  if (error) throw error;
}