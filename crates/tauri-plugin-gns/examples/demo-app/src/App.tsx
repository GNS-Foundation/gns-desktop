/**
 * GNS Protocol Example Application
 * 
 * This example demonstrates basic usage of tauri-plugin-gns:
 * - Identity creation and management
 * - Trust score display
 * - Sending encrypted messages
 * - Handle resolution
 */

import { useEffect, useState, useCallback } from 'react';
import {
  gns,
  createIdentity,
  sendMessage,
  Identity,
  TrustScore,
  Conversation,
  GNS_CONSTANTS,
  TRUST_TIERS,
} from '@anthropic/tauri-plugin-gns-api';

// ============================================================================
// Types
// ============================================================================

interface AppState {
  identity: Identity | null;
  trustScore: TrustScore | null;
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// Components
// ============================================================================

/**
 * Trust score badge with tier color and emoji
 */
function TrustBadge({ score }: { score: TrustScore }) {
  const tierInfo = TRUST_TIERS.find(t => score.score >= t.min && score.score <= t.max);
  
  return (
    <div 
      className="trust-badge"
      style={{ backgroundColor: tierInfo?.color || '#9ca3af' }}
    >
      <span className="emoji">{tierInfo?.emoji}</span>
      <span className="score">{score.score}%</span>
      <span className="tier">{score.tier}</span>
    </div>
  );
}

/**
 * Identity card showing public key and handle
 */
function IdentityCard({ identity, trustScore }: { 
  identity: Identity; 
  trustScore: TrustScore | null;
}) {
  const shortKey = `${identity.publicKey.slice(0, 8)}...${identity.publicKey.slice(-8)}`;
  
  return (
    <div className="identity-card">
      <div className="identity-header">
        <h2>{identity.name}</h2>
        {identity.handle && <span className="handle">@{identity.handle}</span>}
      </div>
      
      <div className="identity-details">
        <div className="detail">
          <label>Public Key</label>
          <code title={identity.publicKey}>{shortKey}</code>
        </div>
        
        <div className="detail">
          <label>Breadcrumbs</label>
          <span>{identity.breadcrumbCount}</span>
        </div>
        
        {trustScore && (
          <div className="detail">
            <label>Trust</label>
            <TrustBadge score={trustScore} />
          </div>
        )}
      </div>
      
      <div className="identity-actions">
        <button onClick={() => navigator.clipboard.writeText(identity.publicKey)}>
          Copy Key
        </button>
        {!identity.handle && identity.breadcrumbCount >= GNS_CONSTANTS.MIN_BREADCRUMBS_FOR_HANDLE && (
          <button className="primary">Claim Handle</button>
        )}
      </div>
    </div>
  );
}

/**
 * Message composer
 */
function MessageComposer({ onSend }: { onSend: (to: string, content: string) => void }) {
  const [to, setTo] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim() || !content.trim()) return;
    
    setSending(true);
    try {
      await onSend(to.trim(), content.trim());
      setContent('');
    } finally {
      setSending(false);
    }
  };
  
  return (
    <form className="message-composer" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="@handle or public key"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        disabled={sending}
      />
      <textarea
        placeholder="Your message..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={sending}
        rows={3}
      />
      <button type="submit" disabled={sending || !to.trim() || !content.trim()}>
        {sending ? 'Sending...' : 'Send Encrypted Message'}
      </button>
    </form>
  );
}

/**
 * Conversation list
 */
function ConversationList({ conversations }: { conversations: Conversation[] }) {
  if (conversations.length === 0) {
    return (
      <div className="empty-state">
        <p>No conversations yet.</p>
        <p>Send a message to start chatting!</p>
      </div>
    );
  }
  
  return (
    <ul className="conversation-list">
      {conversations.map((conv) => (
        <li key={conv.peerPk} className="conversation-item">
          <div className="peer-info">
            <span className="peer-name">
              {conv.peerHandle ? `@${conv.peerHandle}` : conv.peerPk.slice(0, 12) + '...'}
            </span>
            {conv.unreadCount > 0 && (
              <span className="unread-badge">{conv.unreadCount}</span>
            )}
          </div>
          <div className="last-message">
            {conv.lastMessage?.decryptedCache?.content || '(encrypted)'}
          </div>
          <div className="timestamp">
            {new Date(conv.updatedAt).toLocaleString()}
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Breadcrumb collection status
 */
function TrajectoryStatus() {
  const [status, setStatus] = useState<{
    isActive: boolean;
    totalCount: number;
    pendingCount: number;
  } | null>(null);
  
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const s = await gns.trajectory.getStatus();
        setStatus(s);
      } catch (e) {
        console.error('Failed to fetch trajectory status:', e);
      }
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Update every 30s
    
    return () => clearInterval(interval);
  }, []);
  
  if (!status) return null;
  
  return (
    <div className="trajectory-status">
      <div className="status-indicator">
        <span className={`dot ${status.isActive ? 'active' : 'inactive'}`} />
        {status.isActive ? 'Collecting' : 'Paused'}
      </div>
      <div className="stats">
        <span>{status.totalCount} breadcrumbs</span>
        <span>{status.pendingCount} pending</span>
      </div>
      <div className="actions">
        {status.isActive ? (
          <button onClick={() => gns.trajectory.stop()}>Stop</button>
        ) : (
          <button onClick={() => gns.trajectory.start()}>Start</button>
        )}
        {status.pendingCount >= 10 && (
          <button onClick={() => gns.trajectory.publishEpoch()}>
            Publish Epoch
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main App
// ============================================================================

export default function App() {
  const [state, setState] = useState<AppState>({
    identity: null,
    trustScore: null,
    conversations: [],
    isLoading: true,
    error: null,
  });
  
  // Initialize on mount
  useEffect(() => {
    initializeGns();
  }, []);
  
  const initializeGns = async () => {
    try {
      // Check for existing identities
      const identities = await gns.identity.list();
      
      let identity: Identity;
      
      if (identities.length === 0) {
        // Create first identity
        identity = await createIdentity({
          name: 'My Identity',
          setAsDefault: true,
        });
      } else {
        // Load default identity
        const defaultId = identities.find(id => id.isDefault) || identities[0];
        identity = await gns.identity.load(defaultId.publicKey) as Identity;
      }
      
      // Fetch trust score
      const trustScore = await gns.trust.getScore();
      
      // Fetch conversations
      const conversations = await gns.messaging.getConversations();
      
      // Start trajectory collection (user can stop if desired)
      await gns.trajectory.start();
      
      setState({
        identity,
        trustScore,
        conversations,
        isLoading: false,
        error: null,
      });
    } catch (e) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: e instanceof Error ? e.message : 'Failed to initialize',
      }));
    }
  };
  
  const handleSendMessage = useCallback(async (to: string, content: string) => {
    try {
      await sendMessage({
        to,
        payload: { type: 'text', content },
      });
      
      // Refresh conversations
      const conversations = await gns.messaging.getConversations();
      setState(prev => ({ ...prev, conversations }));
    } catch (e) {
      console.error('Failed to send message:', e);
      throw e;
    }
  }, []);
  
  // Loading state
  if (state.isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p>Initializing GNS Protocol...</p>
      </div>
    );
  }
  
  // Error state
  if (state.error) {
    return (
      <div className="error">
        <h2>Error</h2>
        <p>{state.error}</p>
        <button onClick={initializeGns}>Retry</button>
      </div>
    );
  }
  
  // Main UI
  return (
    <div className="app">
      <header className="app-header">
        <h1>GNS Protocol Demo</h1>
        <TrajectoryStatus />
      </header>
      
      <main className="app-main">
        <section className="identity-section">
          <h2>Your Identity</h2>
          {state.identity && (
            <IdentityCard 
              identity={state.identity} 
              trustScore={state.trustScore} 
            />
          )}
        </section>
        
        <section className="messaging-section">
          <h2>Encrypted Messaging</h2>
          <MessageComposer onSend={handleSendMessage} />
          <ConversationList conversations={state.conversations} />
        </section>
      </main>
      
      <footer className="app-footer">
        <p>
          <strong>HUMANS PREVAIL</strong> 🌍 
          <a href="https://gns.earth">gns.earth</a>
        </p>
      </footer>
    </div>
  );
}

// ============================================================================
// Styles (inline for example simplicity)
// ============================================================================

const styles = `
.app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e5e7eb;
}

.identity-card {
  background: #f9fafb;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.identity-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
}

.identity-header h2 {
  margin: 0;
}

.handle {
  color: #6366f1;
  font-weight: 500;
}

.identity-details {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
}

.detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail label {
  color: #6b7280;
  font-size: 14px;
}

.trust-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 20px;
  color: white;
  font-size: 14px;
  font-weight: 500;
}

.message-composer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.message-composer input,
.message-composer textarea {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
}

.message-composer button {
  padding: 12px 24px;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
}

.message-composer button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.conversation-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.conversation-item {
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.trajectory-status {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 14px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot.active {
  background: #22c55e;
}

.dot.inactive {
  background: #9ca3af;
}

.loading, .error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}
