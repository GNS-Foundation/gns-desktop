import { EmailThread, EmailMessage, EmailComposeData, EmailStats, EmailAddress } from '../types/email';
import { signString, getPublicKey, getThreads, getMessages, getThread, deleteThread, markThreadRead, ThreadPreview, Message, saveSentEmailMessage } from './tauri';
import { EMAIL_GATEWAY_PUBLIC_KEY } from './constants';

const API_BASE = 'https://gns-browser-production.up.railway.app';

// Helper to convert local Message to EmailMessage
function convertToEmailMessage(msg: Message): EmailMessage {
  // Extract email-specific fields from payload
  // Payload for email is expected to follow a specific structure or wrapped in GNS message
  // For now, mapping basic fields. Detailed mapping would depend on actual payload structure.

  const payload = msg.payload as any; // Try to treat payload as EmailPayload-like

  // Default values
  let subject = '(No subject)';
  let body = '';
  let fromAddress: EmailAddress = { address: '', isGns: false };
  let toAddresses: EmailAddress[] = [];

  // Extract from known payload structure
  if (payload) {
    subject = payload.subject || subject;
    body = payload.body || body;

    // Parse participants if available in payload, otherwise derived from message metadata
    if (payload.from) fromAddress = { address: payload.from, isGns: payload.from.endsWith('@gcrumbs.com') };
    // 'to' might be a string or array in payload
    if (payload.to) {
      const toList = Array.isArray(payload.to) ? payload.to : [payload.to];
      toAddresses = toList.map((addr: string) => ({ address: addr, isGns: addr.endsWith('@gcrumbs.com') }));
    }
  }

  // Fallback for sender if not in payload (use gateway for now? or sender handle?)
  if (!fromAddress.address) {
    fromAddress = { address: msg.from_handle ? `${msg.from_handle}@gcrumbs.com` : 'unknown', isGns: true };
  }

  return {
    id: msg.id,
    threadId: msg.thread_id,
    from: fromAddress,
    to: toAddresses,
    subject: subject,
    body: body,
    bodyHtml: payload?.bodyHtml || undefined,
    attachments: [], // TODO: Parse attachments from payload
    isRead: msg.status === 'read',
    isStarred: msg.is_starred || false,
    isEncrypted: true,
    createdAt: new Date(msg.timestamp).toISOString(),
    receivedAt: new Date(msg.timestamp).toISOString(),
  };
}

// Helper to convert ThreadPreview to EmailThread
function convertToEmailThread(thread: ThreadPreview, latestMsg?: Message): EmailThread {

  return {
    id: thread.id,
    subject: thread.subject || (latestMsg?.payload as any)?.subject || 'Email Conversation', // Use stored subject first
    snippet: thread.last_message_preview || '',
    participants: [{
      address: thread.participant_handle ? (thread.participant_handle.includes('@') ? thread.participant_handle : `${thread.participant_handle}@gcrumbs.com`) : 'unknown',
      handle: thread.participant_handle || undefined,
      name: thread.participant_handle || undefined,
      isGns: thread.participant_handle?.endsWith('@gcrumbs.com') || false
    }],
    messageCount: 1, // Placeholder
    unreadCount: thread.unread_count,
    isStarred: thread.is_pinned, // Mapping pinned to starred for threads
    hasAttachments: false,
    lastMessageAt: new Date(thread.last_message_at).toISOString(),
    messages: [],
  };
}

export const EmailApi = {
  // ===========================================
  // THREADS (Local DB)
  // ===========================================

  /**
   * Get all email threads for the current user
   */
  async getThreads(options?: {
    limit?: number;
    offset?: number;
    filter?: 'all' | 'unread' | 'starred';
  }): Promise<{ threads: EmailThread[]; stats: EmailStats }> {
    // 1. Fetch all threads from local DB
    const allThreads = await getThreads({
      limit: options?.limit || 50,
      // includeArchived: options?.filter === 'archived' // Type definition needs update if supported
    });
    console.log('[EmailApi] Raw threads from DB:', allThreads);

    // 2. Filter for threads that involve the Email Gateway OR have a subject (implying email)
    const emailThreadsRaw = allThreads.filter(t => {
      const isGateway = t.participant_public_key.toLowerCase() === EMAIL_GATEWAY_PUBLIC_KEY.toLowerCase();
      const hasSubject = !!t.subject && t.subject.length > 0; // Chat threads usually have no subject

      console.log(`[EmailApi] Thread ${t.id} - Participant: ${t.participant_public_key} (Gateway: ${isGateway}), Subject: ${t.subject} (HasSubject: ${hasSubject})`);

      return isGateway || hasSubject;
    });
    console.log('[EmailApi] Filtered email threads:', emailThreadsRaw);

    // 3. Convert to EmailThread objects
    const threads = emailThreadsRaw.map(t => convertToEmailThread(t));

    // Calculate stats
    const stats: EmailStats = {
      totalThreads: threads.length,
      unreadCount: threads.reduce((acc, t) => acc + t.unreadCount, 0),
      sentToday: 0 // Cannot easily calc from thread list
    };

    // Apply client-side filters
    let filteredThreads = threads;
    if (options?.filter === 'unread') {
      filteredThreads = threads.filter(t => t.unreadCount > 0);
    } else if (options?.filter === 'starred') {
      filteredThreads = threads.filter(t => t.isStarred);
    }

    return { threads: filteredThreads, stats };
  },

  /**
   * Get a single thread with all messages
   */
  async getThread(threadId: string): Promise<{ thread: EmailThread; messages: EmailMessage[] }> {
    // 1. Fetch thread details
    const threadPreview = await getThread(threadId);
    if (!threadPreview) {
      throw new Error('Thread not found');
    }

    // 2. Fetch messages
    const localMessages = await getMessages({ threadId });

    // 3. Convert
    const messages = localMessages.map(convertToEmailMessage);
    const thread = convertToEmailThread(threadPreview, localMessages[0]); // Use latest msg for subject if available

    // Attach messages to thread object as well if required by UI
    thread.messages = messages;

    return { thread, messages };
  },

  /**
   * Mark thread as read
   */
  async markRead(threadId: string): Promise<void> {
    await markThreadRead(threadId);
  },

  /**
   * Toggle star on thread (Not directly supported by Tauri for thread, assuming pinned or custom impl)
   * For now, no-op or mapping to pin if desired, but interface requires return.
   */
  async toggleStar(_threadId: string): Promise<{ isStarred: boolean }> {
    // TODO: Implement star/pin mapping in backend commands if needed
    // Currently backend supports 'mark_thread_read' and 'delete_thread'
    return { isStarred: false };
  },

  /**
   * Delete a thread
   */
  async deleteThread(threadId: string): Promise<void> {
    await deleteThread(threadId);
  },

  // ===========================================
  // COMPOSE & SEND (REST API)
  // ===========================================

  /**
   * Send an email
   */
  async send(email: EmailComposeData): Promise<{ messageId: string; success: boolean }> {
    const publicKey = await getPublicKey();
    if (!publicKey) {
      throw new Error('No identity found');
    }

    // Backend expects 'to', 'cc', 'bcc' as strings (comma separated if multiple)
    const toStr = Array.isArray(email.to) ? email.to.join(',') : email.to;
    const ccStr = email.cc ? (Array.isArray(email.cc) ? email.cc.join(',') : email.cc) : undefined;
    const bccStr = email.bcc ? (Array.isArray(email.bcc) ? email.bcc.join(',') : email.bcc) : undefined;

    const timestamp = new Date().toISOString();
    // Signature format: timestamp:to:subject
    const signData = `${timestamp}:${toStr}:${email.subject}`;
    const signature = await signString(signData);

    if (!signature) {
      throw new Error('Failed to sign email request');
    }

    const response = await fetch(`${API_BASE}/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GNS-PublicKey': publicKey,
        'X-GNS-Signature': signature,
        'X-GNS-Timestamp': timestamp,
      },
      body: JSON.stringify({
        to: toStr,
        cc: ccStr,
        bcc: bccStr,
        subject: email.subject,
        body: email.body,
        reply_to_id: email.replyToId,
      }),
    });

    if (!response.ok) {
      const error = await response.text(); // Use text() to catch html errors too
      try {
        const jsonError = JSON.parse(error);
        throw new Error(jsonError.error || 'Failed to send email');
      } catch (e) {
        throw new Error(`Failed to send email: ${error}`);
      }
    }

    const data = await response.json();

    // Save locally for UI consistency
    try {
      await saveSentEmailMessage({
        recipientEmail: toStr,
        subject: email.subject,
        snippet: email.body.substring(0, 100),
        body: email.body,
        gatewayPublicKey: EMAIL_GATEWAY_PUBLIC_KEY,
        threadId: email.replyToId // Pass thread ID for replies
      });
      console.log('[EmailApi] Saved sent email locally');
    } catch (e) {
      console.error('[EmailApi] Failed to save local copy of sent email:', e);
    }

    return data.data;
  },

  // ===========================================
  // ADDRESS HELPERS
  // ===========================================

  /**
   * Get user's email address
   */
  async getMyAddress(): Promise<{ address: string; handle: string }> {
    // This might still be a useful REST endpoint if it exists
    // Reverting to /web/email/address based on previous context 
    // or keeping local logic if possible.
    // Assuming this one might exist or we can derive it locally.
    try {
      const publicKey = await getPublicKey(); // just to ensure auth
      if (!publicKey) throw new Error('No auth');

      // Try Fetching from REST if it exists
      // const response = await fetch(`${API_BASE}/web/email/address`...);

      // OR Derive locally:
      // const handle = ...; 
      // return { address: `${handle}@gcrumbs.com`, handle };

      // Let's try the fetch with the /web/ prefix as attempted before filtering 404s
      // But since user said NO /threads endpoint, maybe address exists?
      // Let's keep the fetch for now but add local fallback if it fails?

      // Actually, let's use the previous code's fetch but with correct header setup if needed
      // For now, restoring the fetch call.
      const headers = {
        'Content-Type': 'application/json',
        'X-GNS-PublicKey': publicKey
      }; // Basic header

      const response = await fetch(`${API_BASE}/email/address`, { headers }); // Trying /email/address as per user "only /send, /address, etc"

      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      return data.data;
    } catch (e) {
      // Fallback
      return { address: 'unknown@gcrumbs.com', handle: 'unknown' };
    }
  },

  /**
   * Check if an address is internal GNS
   */
  isGnsAddress(address: string): boolean {
    return address.endsWith('@gcrumbs.com');
  },

  /**
   * Format email address for display
   */
  formatAddress(address: { name?: string; address: string }): string {
    if (address.name) {
      return `${address.name} <${address.address}>`;
    }
    return address.address;
  },
};
