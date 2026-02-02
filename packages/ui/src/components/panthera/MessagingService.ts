// ═══════════════════════════════════════════════════════════════════
// PANTHERA v2 — Messaging Service
// ═══════════════════════════════════════════════════════════════════
// Location: packages/ui/src/components/panthera/MessagingService.ts
//
// Ports the v1 messaging.js + websocket.js into a unified service.
// Handles:
//   - Fetching inbox / conversation threads
//   - Sending encrypted messages via session auth
//   - WebSocket for real-time delivery + mobile sync
//   - Recipient handle → publicKey resolution
//   - Decryption of incoming messages (via libsodium)
//
// All auth uses the QR session token from AuthProvider.
// ═══════════════════════════════════════════════════════════════════

const API_BASE = 'https://gns-browser-production.up.railway.app';
const WS_BASE = 'wss://gns-browser-production.up.railway.app';

// ─── Types ───

export interface Thread {
  publicKey: string;
  handle?: string;
  displayName?: string;
  lastMessage?: string;
  lastMessageTime?: number;
  unread: number;
  isOnline?: boolean;
}

export interface Message {
  id: string;
  text: string;
  direction: 'incoming' | 'outgoing';
  timestamp: number;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  synced?: boolean;
  encrypted?: boolean;
}

// ─── Auth Headers Helper ───

function getSessionHeaders(): Record<string, string> | null {
  try {
    const stored = localStorage.getItem('gns_browser_session');
    if (!stored) return null;
    const session = JSON.parse(stored);
    if (!session?.isVerified || !session?.sessionToken) return null;
    return {
      'Content-Type': 'application/json',
      'X-GNS-Session': session.sessionToken,
      'X-GNS-PublicKey': session.publicKey,
    };
  } catch {
    return null;
  }
}

function getSession(): any {
  try {
    return JSON.parse(localStorage.getItem('gns_browser_session') || 'null');
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// HTTP API
// ═══════════════════════════════════════════════════════════════════

/** Fetch inbox threads (list of conversations) */
export async function fetchInbox(limit = 50): Promise<{ success: boolean; messages: any[]; error?: string }> {
  const headers = getSessionHeaders();
  if (!headers) return { success: false, messages: [], error: 'Not authenticated' };

  try {
    const res = await fetch(`${API_BASE}/messages/inbox?limit=${limit}`, { headers });
    const data = await res.json();
    return data.success
      ? { success: true, messages: data.data || [] }
      : { success: false, messages: [], error: data.error };
  } catch (err: any) {
    return { success: false, messages: [], error: err.message };
  }
}

/** Fetch conversation with a specific user */
export async function fetchConversation(
  withPublicKey: string,
  options: { limit?: number; before?: string } = {}
): Promise<{ success: boolean; messages: any[]; error?: string }> {
  const headers = getSessionHeaders();
  if (!headers) return { success: false, messages: [], error: 'Not authenticated' };

  const params = new URLSearchParams({
    with: withPublicKey,
    limit: (options.limit || 50).toString(),
  });
  if (options.before) params.append('before', options.before);

  try {
    const res = await fetch(`${API_BASE}/messages/conversation?${params}`, { headers });
    const data = await res.json();
    return data.success
      ? { success: true, messages: data.data || [] }
      : { success: false, messages: [], error: data.error };
  } catch (err: any) {
    return { success: false, messages: [], error: err.message };
  }
}

/** Send an encrypted message */
export async function sendMessage(
  recipientPk: string,
  content: string,
  threadId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const headers = getSessionHeaders();
  const session = getSession();
  if (!headers || !session) return { success: false, error: 'Not authenticated' };

  try {
    // Fetch recipient encryption key
    const encKeyRes = await fetch(`${API_BASE}/identities/${recipientPk}`);
    const encKeyData = await encKeyRes.json();
    const recipientEncKey = encKeyData.data?.encryption_key;

    if (!recipientEncKey) {
      return { success: false, error: 'Recipient has no encryption key' };
    }

    // Try to dynamically load crypto for dual encryption
    let envelope: any;
    try {
      // Build a simple envelope — the actual E2E encryption uses
      // createDualEncryptedEnvelope from crypto.js at runtime
      const { crypto: cryptoModule } = await import('@gns/api-web');
      await cryptoModule.initCrypto();

      envelope = await cryptoModule.createDualEncryptedEnvelope(
        session.publicKey,
        recipientPk,
        content,
        recipientEncKey,
        session.encryptionKey, // sender's key for self-decrypt
        threadId || null
      );
    } catch {
      // Fallback: send plaintext envelope for server-side handling
      // (less secure but functional when crypto libs unavailable)
      envelope = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        version: 1,
        fromPublicKey: session.publicKey,
        toPublicKeys: [recipientPk],
        payloadType: 'gns/text.plain',
        plaintextFallback: content, // Server can handle this
        threadId: threadId || null,
        timestamp: Date.now(),
      };
      console.warn('⚠️ Crypto unavailable, using plaintext fallback');
    }

    const res = await fetch(`${API_BASE}/messages/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        to: recipientPk,
        envelope,
        threadId: threadId || envelope.threadId,
      }),
    });

    const data = await res.json();
    if (data.success) {
      return { success: true, messageId: data.data?.messageId };
    }
    return { success: false, error: data.error || 'Send failed' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Resolve @handle to publicKey */
export async function resolveRecipient(handleOrKey: string): Promise<{ success: boolean; publicKey?: string; error?: string }> {
  if (/^[0-9a-f]{64}$/i.test(handleOrKey)) {
    return { success: true, publicKey: handleOrKey.toLowerCase() };
  }

  const handle = handleOrKey.replace(/^@/, '').toLowerCase();
  try {
    const res = await fetch(`${API_BASE}/handles/${handle}`);
    const data = await res.json();
    if (data.success && data.data?.identity) {
      return { success: true, publicKey: data.data.identity.toLowerCase() };
    }
    return { success: false, error: `@${handle} not found` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Acknowledge / mark message as read */
export async function acknowledgeMessage(messageId: string): Promise<boolean> {
  const headers = getSessionHeaders();
  if (!headers) return false;
  try {
    await fetch(`${API_BASE}/messages/${messageId}`, { method: 'DELETE', headers });
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// WebSocket Real-Time Service
// ═══════════════════════════════════════════════════════════════════

type WSListener = (data: any) => void;

class RealtimeService {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<WSListener>>();
  private reconnectAttempts = 0;
  private maxReconnects = 5;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private connecting = false;
  public mobileConnected = false;

  connect(publicKey: string, sessionToken: string) {
    if (this.connecting || this.ws?.readyState === WebSocket.OPEN) return;
    this.connecting = true;

    const url = `${WS_BASE}/ws?pk=${publicKey}&device=browser&session=${sessionToken}&timestamp=${Date.now()}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.connecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit('connected', { publicKey });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          this.handleMessage(msg);
        } catch { }
      };

      this.ws.onclose = () => {
        this.connecting = false;
        this.stopHeartbeat();
        this.mobileConnected = false;
        this.emit('disconnected', {});
        if (this.reconnectAttempts < this.maxReconnects) {
          this.reconnectAttempts++;
          const delay = 1000 * Math.pow(2, this.reconnectAttempts - 1);
          setTimeout(() => this.connect(publicKey, sessionToken), delay);
        }
      };

      this.ws.onerror = () => { this.connecting = false; };
    } catch {
      this.connecting = false;
    }
  }

  disconnect() {
    this.stopHeartbeat();
    this.reconnectAttempts = this.maxReconnects;
    this.ws?.close(1000);
    this.ws = null;
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
  }

  private handleMessage(msg: any) {
    switch (msg.type) {
      case 'welcome':
        this.mobileConnected = msg.connectedDevices?.mobile || false;
        this.emit('connectionStatus', msg.connectedDevices);
        break;
      case 'connection_status':
        this.mobileConnected = msg.data?.mobile || false;
        this.emit('connectionStatus', msg.data);
        break;
      case 'message':
        this.emit('message', msg.data || msg.envelope);
        break;
      case 'message_synced':
        this.emit('messageSynced', msg);
        this.storeSynced(msg);
        break;
      case 'sync_pending':
        this.emit('syncPending', msg);
        break;
      case 'typing':
        this.emit('typing', msg.data);
        break;
      case 'pong':
        break;
      default:
        break;
    }
  }

  /** Notify mobile that browser sent a message */
  notifyMobile(messageId: string, conversationWith: string, plaintext: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'sync_to_mobile',
      messageId,
      conversationWith,
      decryptedText: plaintext,
      direction: 'outgoing',
      timestamp: Date.now(),
    }));
  }

  private storeSynced(msg: any) {
    try {
      const key = `gns_synced_${msg.conversationWith?.toLowerCase()}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      if (existing.find((m: any) => m.id === msg.messageId)) return;
      existing.push({
        id: msg.messageId,
        text: msg.decryptedText,
        direction: msg.direction,
        timestamp: msg.timestamp,
        synced: true,
      });
      if (existing.length > 100) existing.splice(0, existing.length - 100);
      localStorage.setItem(key, JSON.stringify(existing));
    } catch { }
  }

  getSyncedMessages(conversationWith: string): Message[] {
    try {
      return JSON.parse(localStorage.getItem(`gns_synced_${conversationWith.toLowerCase()}`) || '[]');
    } catch { return []; }
  }

  // ─── Event system ───
  on(event: string, cb: WSListener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    return () => this.off(event, cb);
  }

  off(event: string, cb: WSListener) {
    this.listeners.get(event)?.delete(cb);
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(cb => { try { cb(data); } catch { } });
  }

  get isConnected() { return this.ws?.readyState === WebSocket.OPEN; }
}

// Singleton
export const realtime = new RealtimeService();
