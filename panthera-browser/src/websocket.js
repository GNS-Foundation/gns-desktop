// ===========================================
// Panthera WebSocket Service (Phase C)
// Real-time messaging + Mobile Sync
// ===========================================

const GNS_WS_BASE = process.env.REACT_APP_GNS_WS_URL || 'wss://gns-browser-production.up.railway.app';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.publicKey = null;
    this.sessionToken = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.heartbeatInterval = null;
    this.isConnecting = false;

    // Phase C: Mobile sync state
    this.mobileConnected = false;
    this.connectedDevices = { mobile: false, browsers: 0 };
  }

  /**
   * Connect to WebSocket server
   * Phase C: Now includes device=browser parameter
   */
  connect(publicKey, sessionToken) {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      console.log('WebSocket already connected or connecting');
      return;
    }

    this.isConnecting = true;
    this.publicKey = publicKey;
    this.sessionToken = sessionToken;

    const timestamp = Date.now();
    // Phase C: Add device=browser parameter for device routing
    const wsUrl = `${GNS_WS_BASE}/ws?pk=${publicKey}&device=browser&session=${sessionToken || ''}&timestamp=${timestamp}`;

    console.log('Connecting to WebSocket...');

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit('connected', { publicKey });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.isConnecting = false;
        this.stopHeartbeat();
        this.mobileConnected = false;
        this.emit('disconnected', { code: event.code, reason: event.reason });

        // Attempt reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.emit('error', { error });
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.isConnecting = false;
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'User disconnected');
      this.ws = null;
    }
    this.publicKey = null;
    this.sessionToken = null;
    this.mobileConnected = false;
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (this.publicKey) {
        this.connect(this.publicKey, this.sessionToken);
      }
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', timestamp: Date.now() });
      }
    }, 25000);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Handle incoming message
   * Phase C: Added sync message types
   */
  handleMessage(message) {
    switch (message.type) {
      // Legacy welcome
      case 'connected':
        console.log('WebSocket welcome received (legacy)');
        break;

      // Phase C: New welcome with device info
      case 'welcome':
        console.log('WebSocket welcome received');
        if (message.connectedDevices) {
          this.connectedDevices = message.connectedDevices;
          this.mobileConnected = message.connectedDevices.mobile || false;
          console.log(`   📱 Mobile connected: ${this.mobileConnected}`);
          this.emit('connectionStatus', this.connectedDevices);
        }
        break;

      case 'pong':
        // Heartbeat response
        break;

      // Phase C: Connection status update
      case 'connection_status':
        this.connectedDevices = message.data || message;
        this.mobileConnected = this.connectedDevices.mobile || false;
        console.log(`📱 Mobile ${this.mobileConnected ? 'connected' : 'disconnected'}`);
        this.emit('connectionStatus', this.connectedDevices);
        break;

      // Phase C: Message synced FROM mobile (already decrypted!)
      case 'message_synced':
        console.log('📩 Message synced from mobile:', message.messageId);
        this.emit('messageSynced', {
          messageId: message.messageId,
          conversationWith: message.conversationWith,
          text: message.decryptedText,  // Already decrypted by mobile!
          direction: message.direction,
          timestamp: message.timestamp,
          fromHandle: message.fromHandle,
        });
        // Store for persistence
        this._storeSyncedMessage(message);
        break;

      // Phase C: Sync pending (mobile offline)
      case 'sync_pending':
        console.log('⏳ Sync pending - mobile offline');
        this.emit('syncPending', {
          messageId: message.messageId,
          reason: message.reason,
        });
        break;

      // Existing message handling
      case 'message':
        this.emit('message', message.data || message.envelope);
        break;

      case 'typing':
        this.emit('typing', message.data);
        break;

      case 'presence':
        this.emit('presence', message.data);
        break;

      case 'notification':
        this.emit('notification', message.data);
        break;

      default:
        console.log('Unknown message type:', message.type);
        this.emit('unknown', message);
    }
  }

  /**
   * Send message through WebSocket
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    console.warn('WebSocket not connected');
    return false;
  }

  /**
   * Send a chat message
   */
  sendMessage(toPublicKey, content, threadId = null) {
    const envelope = {
      type: 'direct',
      toPublicKeys: [toPublicKey],
      fromPublicKey: this.publicKey,
      content: {
        type: 'text',
        text: content,
      },
      threadId: threadId || `thread_${Date.now()}`,
      timestamp: Date.now(),
    };

    return this.send({
      type: 'message',
      envelope,
    });
  }

  /**
   * Send typing indicator
   */
  sendTyping(toPublicKey, isTyping = true) {
    return this.send({
      type: 'typing',
      data: {
        toPublicKey,
        isTyping,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Update presence status
   */
  updatePresence(status = 'online') {
    return this.send({
      type: 'presence',
      data: {
        status,
        timestamp: Date.now(),
      },
    });
  }

  // ===========================================
  // PHASE C: SYNC METHODS
  // ===========================================

  /**
   * Notify mobile that browser sent a message
   * Mobile will store the plaintext and sync to other devices
   */
  notifyMessageSent(messageId, conversationWith, plaintext) {
    if (!this.isConnected()) {
      console.warn('⚠️ Cannot notify: not connected');
      return false;
    }

    this.send({
      type: 'message_sent_from_browser',
      to: [this.publicKey],
      messageId,
      to_pk: conversationWith,
      plaintext: plaintext,
      direction: 'outgoing',
      timestamp: Date.now(),
    });

    console.log('📤 Notified mobile of sent message');
    return true;
  }

  /**
   * Request sync from mobile for a conversation
   */
  requestSync(conversationWith = null, limit = 50) {
    if (!this.isConnected()) {
      console.warn('⚠️ Cannot request sync: not connected');
      return false;
    }

    this.send({
      type: 'request_sync',
      to: [this.publicKey], // Route to my other devices (Mobile)
      conversationWith,
      limit,
    });

    console.log('🔄 Requested sync from mobile');
    return true;
  }

  /**
   * Check if mobile is connected
   */
  isMobileConnected() {
    return this.mobileConnected;
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return this.connectedDevices;
  }

  /**
   * Store synced message in localStorage for persistence
   */
  _storeSyncedMessage(message) {
    try {
      const key = `gns_synced_${message.conversationWith?.toLowerCase()}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');

      // Check if message already exists
      if (existing.find(m => m.id === message.messageId)) {
        return;
      }

      existing.push({
        id: message.messageId,
        text: message.decryptedText,
        direction: message.direction,
        timestamp: message.timestamp,
        synced: true,
      });

      // Keep only last 100 messages per conversation
      if (existing.length > 100) {
        existing.splice(0, existing.length - 100);
      }

      localStorage.setItem(key, JSON.stringify(existing));
    } catch (e) {
      console.warn('Failed to store synced message:', e);
    }
  }

  /**
   * Get synced messages for a conversation
   */
  getSyncedMessages(conversationWith) {
    try {
      const key = `gns_synced_${conversationWith?.toLowerCase()}`;
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {
      return [];
    }
  }

  // ===========================================
  // EVENT SYSTEM
  // ===========================================

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
const wsService = new WebSocketService();

export default wsService;
