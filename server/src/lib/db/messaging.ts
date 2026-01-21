
import { getSupabase } from './client';
import {
    DbMessage, DbBreadcrumb
} from '../../types';

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
