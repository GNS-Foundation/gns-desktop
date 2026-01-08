// ===========================================
// GNS MESSAGING SERVICE - E2E ENCRYPTED
// 
// Sends encrypted GNS messages via HTTP API
// Uses X25519 + ChaCha20-Poly1305 (matches Flutter)
// ===========================================

import { GNS_API_BASE } from './gnsApi';
import { getSession, getAuthHeaders } from './auth';
import { initCrypto, createDualEncryptedEnvelope, signMessage } from './crypto';

// Initialize crypto on module load
let cryptoReady = false;
initCrypto().then(() => {
  cryptoReady = true;
  console.log('✅ Messaging crypto ready (ChaCha20-Poly1305)');
}).catch(err => {
  console.error('❌ Crypto init failed:', err);
});

// ===========================================
// FETCH RECIPIENT ENCRYPTION KEY
// ===========================================

/**
 * Get recipient's X25519 encryption key from server
 */
async function getRecipientEncryptionKey(publicKey) {
  try {
    // Try identities endpoint first
    const response = await fetch(`${GNS_API_BASE}/identities/${publicKey}`);
    const data = await response.json();

    if (data.success && data.data?.encryption_key) {
      console.log('   Found encryption key via /identities');
      return data.data.encryption_key;
    }

    // Try records endpoint
    const recordRes = await fetch(`${GNS_API_BASE}/records/${publicKey}`);
    const recordData = await recordRes.json();

    if (recordData.success && recordData.data?.encryption_key) {
      console.log('   Found encryption key via /records');
      return recordData.data.encryption_key;
    }

    // Check record_json for encryption_key
    if (recordData.success && recordData.data?.record_json?.encryption_key) {
      console.log('   Found encryption key in record_json');
      return recordData.data.record_json.encryption_key;
    }

    console.warn('   ⚠️ No encryption key found for recipient');
    return null;
  } catch (error) {
    console.error('   Error fetching encryption key:', error);
    return null;
  }
}

// ===========================================
// SEND ENCRYPTED MESSAGE
// ===========================================

/**
 * Send an encrypted message to a recipient
 * Supports both QR session token auth (preferred) and signature-based auth (fallback)
 * 
 * @param {string} recipientIdentityKey - Recipient's Ed25519 public key (hex)
 * @param {string} content - Message content (plaintext - will be encrypted)
 * @param {string} recipientEncryptionKey - Optional: Recipient's X25519 key (hex) - will fetch if not provided
 * @param {string} threadId - Optional thread ID
 */
export async function sendMessage(recipientIdentityKey, content, recipientEncryptionKey = null, threadId = null) {
  try {
    // Ensure crypto is ready
    if (!cryptoReady) {
      await initCrypto();
      cryptoReady = true;
    }

    const toPk = recipientIdentityKey.toLowerCase();

    // Check for QR session FIRST (before getSession() check)
    const browserSession = JSON.parse(localStorage.getItem('gns_browser_session') || 'null');

    if (browserSession?.isVerified && browserSession?.sessionToken) {
      console.log('📤 Sending ENCRYPTED message via QR session token...');
      console.log('   To:', toPk.substring(0, 16) + '...');
      console.log('   From:', browserSession.publicKey.substring(0, 16) + '...');

      // 1. Fetch recipient's X25519 encryption key if not provided
      let encKey = recipientEncryptionKey;
      if (!encKey) {
        console.log('   Fetching recipient encryption key...');
        encKey = await getRecipientEncryptionKey(toPk);
      }

      if (!encKey) {
        console.error('   ❌ Cannot encrypt: recipient has no encryption key');
        return {
          success: false,
          error: 'Recipient does not have an encryption key. They may need to update their identity.',
        };
      }

      console.log('   Recipient X25519:', encKey.substring(0, 16) + '...');

      // 2. Create DUAL encrypted envelope (for recipient AND sender)
      console.log('   Encrypting message with dual encryption...');

      // Get sender's encryption key from session
      const senderEncKey = browserSession.encryptionKey;

      const envelope = await createDualEncryptedEnvelope(
        browserSession.publicKey,
        toPk,
        content,
        encKey,           // Recipient's X25519 key
        senderEncKey,     // Sender's X25519 key (for decrypting our own messages)
        threadId
      );

      console.log('   ✅ Envelope encrypted:', envelope.id);

      // 3. Send encrypted envelope via session-authenticated endpoint
      const response = await fetch(`${GNS_API_BASE}/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GNS-Session': browserSession.sessionToken,
          'X-GNS-PublicKey': browserSession.publicKey,
        },
        body: JSON.stringify({
          to: toPk,
          envelope: envelope,  // Send full encrypted envelope
          threadId: threadId,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log('   ✅ Encrypted message sent via session token!');

        // SYNC: Notify mobile/backend of browser-originated message
        import('./websocket').then(({ default: wsService }) => {
          wsService.notifyMessageSent(data.data?.messageId, toPk, content);
        });

        return {
          success: true,
          data: data.data,
          messageId: data.data?.messageId,
          threadId: data.data?.threadId,
          encrypted: true,
        };
      } else {
        console.error('   ❌ Session token auth failed:', response.status, data);
        return {
          success: false,
          error: data.error || 'Send failed'
        };
      }
    }

    // Fallback: Legacy signature-based authentication
    console.log('📤 Falling back to legacy auth...');

    const session = getSession();
    if (!session?.identityPublicKey) {
      return { success: false, error: 'Not authenticated. Please sign in or scan QR code with mobile app.' };
    }

    if (!session?.identityPrivateKey) {
      return { success: false, error: 'No private key available. Please pair with mobile app for QR authentication.' };
    }

    console.log('   To:', toPk.substring(0, 16) + '...');
    console.log('   From:', session.identityPublicKey.substring(0, 16) + '...');

    // Fetch recipient encryption key if not provided
    let encKey = recipientEncryptionKey;
    if (!encKey) {
      encKey = await getRecipientEncryptionKey(toPk);
    }

    if (!encKey) {
      return {
        success: false,
        error: 'Recipient does not have an encryption key.',
      };
    }

    // Create DUAL encrypted envelope
    const senderEncKey = session.encryptionKey;  // Get sender's key from session

    const envelope = await createDualEncryptedEnvelope(
      session.identityPublicKey,
      toPk,
      content,
      encKey,           // Recipient's X25519 key
      senderEncKey,     // Sender's X25519 key
      threadId
    );

    // Sign the envelope for legacy auth
    const signature = await signMessage(toPk, JSON.stringify(envelope), session.identityPrivateKey);
    envelope.signature = signature;
    console.log('   ✅ Envelope signed for legacy auth');

    // Send via legacy endpoint with full envelope
    const response = await fetch(`${GNS_API_BASE}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        envelope: envelope,
        recipients: [toPk],
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('   ✅ Encrypted message sent via legacy auth!');

      // SYNC: Notify mobile/backend of browser-originated message
      import('./websocket').then(({ default: wsService }) => {
        wsService.notifyMessageSent(data.data?.messageId, toPk, content);
      });

      return {
        success: true,
        data,
        messageId: data.data?.messageId,
        encrypted: true,
      };
    } else {
      console.error('   ❌ API error:', response.status, data);
      return {
        success: false,
        error: data.error || `API error ${response.status}`
      };
    }
  } catch (error) {
    console.error('   ❌ Send error:', error);
    return { success: false, error: error.message };
  }
}

// ===========================================
// FETCH MESSAGES (INBOX)
// ===========================================

/**
 * Fetch pending messages for the current user
 * Supports both QR session token auth and signature-based auth
 */
export async function fetchInbox(options = {}) {
  try {
    // Check for QR session FIRST
    const browserSession = JSON.parse(localStorage.getItem('gns_browser_session') || 'null');

    const { limit = 50, since } = options;
    const params = new URLSearchParams({ limit: limit.toString() });
    if (since) params.append('since', since.toString());

    let headers = { 'Content-Type': 'application/json' };

    if (browserSession?.isVerified && browserSession?.sessionToken) {
      // Use QR session token
      console.log('📥 Fetching inbox via session token...');
      headers['X-GNS-Session'] = browserSession.sessionToken;
      headers['X-GNS-PublicKey'] = browserSession.publicKey;
    } else {
      // Fallback to legacy auth
      const session = getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated', messages: [] };
      }
      console.log('📥 Fetching inbox via legacy auth...');
      headers = { ...headers, ...getAuthHeaders() };
    }

    const response = await fetch(`${GNS_API_BASE}/messages/inbox?${params}`, {
      headers,
    });

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        messages: data.data || [],
        total: data.total || 0,
      };
    } else {
      return { success: false, error: data.error, messages: [] };
    }
  } catch (error) {
    console.error('Fetch inbox error:', error);
    return { success: false, error: error.message, messages: [] };
  }
}

/**
 * Fetch conversation with a specific user
 * Supports both QR session token auth and signature-based auth
 */
export async function fetchConversation(withPublicKey, options = {}) {
  try {
    // Check for QR session FIRST
    const browserSession = JSON.parse(localStorage.getItem('gns_browser_session') || 'null');

    const { limit = 50, before } = options;
    const params = new URLSearchParams({
      with: withPublicKey,
      limit: limit.toString(),
    });
    if (before) params.append('before', before);

    let headers = { 'Content-Type': 'application/json' };

    if (browserSession?.isVerified && browserSession?.sessionToken) {
      // Use QR session token
      headers['X-GNS-Session'] = browserSession.sessionToken;
      headers['X-GNS-PublicKey'] = browserSession.publicKey;
    } else {
      // Fallback to legacy auth
      const session = getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated', messages: [] };
      }
      headers = { ...headers, ...getAuthHeaders() };
    }

    const response = await fetch(`${GNS_API_BASE}/messages/conversation?${params}`, {
      headers,
    });

    const data = await response.json();

    if (data.success) {
      return { success: true, messages: data.data || [] };
    } else {
      return { success: false, error: data.error, messages: [] };
    }
  } catch (error) {
    console.error('Fetch conversation error:', error);
    return { success: false, error: error.message, messages: [] };
  }
}

/**
 * Mark message as read/acknowledged
 */
export async function acknowledgeMessage(messageId) {
  try {
    const browserSession = JSON.parse(localStorage.getItem('gns_browser_session') || 'null');

    let headers = { 'Content-Type': 'application/json' };

    if (browserSession?.isVerified && browserSession?.sessionToken) {
      headers['X-GNS-Session'] = browserSession.sessionToken;
      headers['X-GNS-PublicKey'] = browserSession.publicKey;
    } else {
      headers = { ...headers, ...getAuthHeaders() };
    }

    const response = await fetch(`${GNS_API_BASE}/messages/${messageId}`, {
      method: 'DELETE',
      headers,
    });

    const data = await response.json();

    if (data.success) {
      // SYNC: Notify mobile that message was read on browser
      import('./websocket').then(({ default: wsService }) => {
        wsService.send({
          type: 'read_receipt',
          messageId,
          timestamp: Date.now()
        });
      });
    }

    return { success: data.success };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Resolve handle to public key
 */
export async function resolveRecipient(handleOrKey) {
  // If it's already a 64-char hex key, return it
  if (/^[0-9a-f]{64}$/i.test(handleOrKey)) {
    return { success: true, publicKey: handleOrKey.toLowerCase() };
  }

  // Remove @ prefix if present
  const handle = handleOrKey.replace(/^@/, '').toLowerCase();

  try {
    const response = await fetch(`${GNS_API_BASE}/handles/${handle}`);
    const data = await response.json();

    if (data.success && data.data?.identity) {
      return { success: true, publicKey: data.data.identity.toLowerCase() };
    } else {
      return { success: false, error: `Handle @${handle} not found` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  sendMessage,
  fetchInbox,
  fetchConversation,
  acknowledgeMessage,
  resolveRecipient,
};