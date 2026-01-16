import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Globe, Megaphone, Mail, MessageCircle, Video, Home, Sparkles } from 'lucide-react';
import { ApiProvider } from '@gns/ui';
import { webAdapter } from './lib/adapter';
import { EmailView } from './components/EmailView';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mobile UI import
import MobileApp from '../../mobile/src/MobileApp';
import { isMobilePlatform } from './lib/platformDetection';

import { getProfileByHandle, searchIdentities, SAMPLE_PROFILES, getSession, isAuthenticated, wsService, crypto } from '@gns/api-web';

// Context & Hooks
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useStudioState } from './hooks/useStudioState';

// Components
import { BrowserChrome, HomePage, ProfileView, SearchResultsView, NotFoundView, LoadingView } from './components/views';
import { MessagesView } from './components/messages';
import { StudioView } from './components/studio';
import { SignInModal, MessageModal, QRLoginModal } from './components/modals';

const queryClient = new QueryClient();

// Platform detection wrapper
const PlatformRouter = () => {
  const [isMobile, setIsMobile] = useState(isMobilePlatform());

  useEffect(() => {
    // Re-check on window resize
    const handleResize = () => setIsMobile(isMobilePlatform());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Render mobile UI if on mobile platform
  if (isMobile) {
    return <MobileApp />;
  }

  // Otherwise render desktop UI
  return <AppContent />;
};

const AppContent = () => {
  const { theme } = useTheme();
  const { authUser, signIn, signOut } = useAuth();

  // View state
  const [currentView, setCurrentView] = useState('home');
  const [addressBar, setAddressBar] = useState('');
  const [currentProfile, setCurrentProfile] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Auth state
  const [showSignIn, setShowSignIn] = useState(false);

  // Message state
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageRecipient, setMessageRecipient] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [incomingMessage, setIncomingMessage] = useState(null);

  // Inbox state
  const [inboxMessages, setInboxMessages] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // QR Login state
  const [showQRLogin, setShowQRLogin] = useState(false);

  // WebSocket state
  const [wsConnected, setWsConnected] = useState(false);

  // Custom Studio Hook
  const studioState = useStudioState();

  const shortcuts = [
    { icon: MessageCircle, label: 'chat', handle: 'gcrumbs', color: '#0EA5E9' },
    { icon: Megaphone, label: 'dix', color: '#8B5CF6' },
    { icon: Mail, label: 'email', color: '#EC4899' },
    { icon: MessageCircle, label: 'echo', color: '#10B981' },
    { icon: Video, label: 'video', color: '#F59E0B' },
    { icon: Home, label: 'home', color: '#6366F1' },
    // Studio tab - only shows when authenticated
    ...(authUser ? [{ icon: Sparkles, label: 'studio', color: '#06B6D4', isStudio: true }] : []),
  ];

  // Initialize WS when authUser changes (Handled by AuthContext persistence, but we need to connect WS)
  useEffect(() => {
    if (authUser) {
      const session = getSession();
      if (session) {
        wsService.connect(session.publicKey, session.sessionToken);
      }
    }

    // WebSocket listeners
    const unsubConnected = wsService.on('connected', () => setWsConnected(true));
    const unsubDisconnected = wsService.on('disconnected', () => setWsConnected(false));
    const unsubMessage = wsService.on('message', (data) => {
      console.log('📩 Incoming message:', data);
      let content = data.payload || data.content || data;
      if (typeof content === 'string') {
        try { content = JSON.parse(content); } catch (e) { }
      }
      const messageText = content.content || content.text || content.message || JSON.stringify(content);
      const fromHandle = data.from_handle || data.from_pk?.substring(0, 8) + '...';

      setIncomingMessage({
        from: fromHandle,
        fromPk: data.from_pk,
        text: messageText,
        timestamp: Date.now(),
      });

      setUnreadCount(prev => prev + 1);
      setTimeout(() => setIncomingMessage(null), 5000);

      if (currentView === 'messages') {
        loadInbox();
        if (selectedConversation && data.from_pk?.toLowerCase() === selectedConversation.publicKey?.toLowerCase()) {
          loadConversation(selectedConversation.publicKey, selectedConversation.handle);
        }
      }
    });

    const unsubMessageSynced = wsService.on('messageSynced', (data) => {
      console.log('📩 Message synced from mobile:', data.messageId);

      // Save decrypted text to localStorage so loadConversation can find it
      if (data.decryptedText && data.conversationWith) {
        try {
          const syncedKey = `gns_synced_${data.conversationWith.toLowerCase()}`;
          const syncedMessages = JSON.parse(localStorage.getItem(syncedKey) || '[]');

          // Avoid duplicates
          if (!syncedMessages.find(m => m.id === data.messageId)) {
            syncedMessages.push({
              id: data.messageId,
              text: data.decryptedText,
              timestamp: data.timestamp || Date.now(),
              direction: data.direction
            });
            localStorage.setItem(syncedKey, JSON.stringify(syncedMessages));
          }
        } catch (e) {
          console.error('Failed to save synced message:', e);
        }
      }

      if (selectedConversation && data.conversationWith?.toLowerCase() === selectedConversation.publicKey?.toLowerCase()) {
        loadConversation(selectedConversation.publicKey, selectedConversation.handle);
      }
      if (currentView === 'messages') {
        loadInbox();
      }
    });

    return () => {
      unsubConnected();
      unsubDisconnected();
      unsubMessage();
      unsubMessageSynced();
    };
  }, [currentView, selectedConversation, authUser /* loadInbox removed to avoid dependency cycle */]);

  const handleSignOut = () => {
    signOut(); // From AuthContext
    setInboxMessages([]);
    setUnreadCount(0);
    setWsConnected(false);
  };

  return (
    <div className={`h-screen flex flex-col ${theme.bg} ${theme.text}`}>
      <BrowserChrome
        currentView={currentView}
        addressBar={addressBar}
        currentProfile={currentProfile}
        isLoading={isLoading}
        unreadCount={unreadCount}
        wsConnected={wsConnected}
        goHome={goHome}
        fetchProfile={fetchProfile}
        handleSearch={handleSearch}
        openMessages={openMessages}
        setShowSignIn={setShowSignIn}
      />

      <div className="flex-1 overflow-auto">
        {isLoading && currentView !== 'home' && currentView !== 'messages' && currentView !== 'studio' && <LoadingView />}

        {!isLoading && currentView === 'home' && (
          <HomePage
            handleSearch={handleSearch}
            isLoading={isLoading}
            shortcuts={shortcuts}
            setCurrentView={setCurrentView}
            setAddressBar={setAddressBar}
          />
        )}

        {!isLoading && currentView === 'profile' && currentProfile && (
          <ProfileView
            profile={currentProfile}
            openMessageModal={openMessageModal}
            copyToClipboard={copyToClipboard}
            copiedKey={copiedKey}
            fetchProfile={fetchProfile}
          />
        )}

        {!isLoading && currentView === 'search-results' && (
          <SearchResultsView
            searchResults={searchResults}
            addressBar={addressBar}
            fetchProfile={fetchProfile}
            goHome={goHome}
          />
        )}

        {!isLoading && currentView === 'not-found' && (
          <NotFoundView addressBar={addressBar} error={error} goHome={goHome} />
        )}

        {currentView === 'messages' && (
          <MessagesView
            inboxMessages={inboxMessages}
            selectedConversation={selectedConversation}
            messages={conversationMessages}
            loadConversation={loadConversation}
            loadInbox={loadInbox}
            inboxLoading={inboxLoading}
            onSendReply={handleSendReply}
            setSelectedConversation={setSelectedConversation}
            fetchProfile={fetchProfile}
          />
        )}

        {currentView === 'email' && (
          <EmailView />
        )}

        {currentView === 'studio' && (
          <StudioView
            {...studioState}
          />
        )}
      </div>

      {showSignIn && (
        <SignInModal
          setShowSignIn={setShowSignIn}
          setShowQRLogin={setShowQRLogin}
        />
      )}

      {showMessageModal && (
        <MessageModal
          setShowMessageModal={setShowMessageModal}
          recipientName={messageRecipient?.handle}
          onSend={handleSendMessage}
          sendingMessage={sendingMessage}
        />
      )}

      {showQRLogin && (
        <QRLoginModal
          isOpen={showQRLogin}
          onClose={() => setShowQRLogin(false)}
          onSuccess={(session, syncedMessages) => {
            console.log('✅ QR Login Success callback triggered');
            signIn(session); // Use AuthContext
            setShowQRLogin(false);
            wsService.connect(session.publicKey, session.sessionToken);
          }}
          darkMode={theme.isDark}
        />
      )}
    </div>
  );

  // Helper functions (defined inside to access state/Auth)
  async function loadInbox() {
    if (!authUser) return;

    setInboxLoading(true);
    try {
      const { fetchInbox } = await import('@gns/api-web');
      const result = await fetchInbox({ limit: 50 });
      if (result.success) {
        // Grouping logic 
        const grouped = groupMessagesBySender(result.messages);
        setInboxMessages(prev => {
          const manualConversations = prev.filter(c =>
            !grouped.find(g => g.publicKey.toLowerCase() === c.publicKey.toLowerCase())
          );
          return [...grouped, ...manualConversations];
        });
        setUnreadCount(result.messages.filter(m => !m.read).length);
      }
    } catch (error) {
      console.error('Failed to load inbox:', error);
    }
    setInboxLoading(false);
  }

  function groupMessagesBySender(messages) {
    const conversations = {};
    const session = JSON.parse(localStorage.getItem('gns_browser_session') || '{}');
    const myPublicKey = session.publicKey?.toLowerCase();

    messages.forEach(msg => {
      if (typeof msg === 'string') { try { msg = JSON.parse(msg); } catch (e) { return; } }
      if (!msg) return;

      const fromPk = (msg.from_pk || msg.fromPublicKey || '').toLowerCase();
      const toPk = (msg.to_pk || msg.toPublicKeys?.[0] || '').toLowerCase();
      const isOutgoing = fromPk === myPublicKey;
      const otherParty = isOutgoing ? toPk : fromPk;

      if (!otherParty) return;

      if (!conversations[otherParty]) {
        conversations[otherParty] = {
          publicKey: otherParty,
          handle: isOutgoing ? (msg.to_handle || otherParty.substring(0, 8) + '...') : (msg.from_handle || msg.fromHandle || otherParty.substring(0, 8) + '...'),
          messages: [],
          lastMessage: null,
          unreadCount: 0,
        };
      }

      msg.isOutgoing = isOutgoing;
      conversations[otherParty].messages.push(msg);

      const msgTime = new Date(msg.created_at || msg.timestamp || 0);
      const lastTime = conversations[otherParty].lastMessage ? new Date(conversations[otherParty].lastMessage.created_at || conversations[otherParty].lastMessage.timestamp || 0) : new Date(0);

      if (msgTime > lastTime) {
        conversations[otherParty].lastMessage = msg;
      }

      if (!msg.read && !isOutgoing) {
        conversations[otherParty].unreadCount++;
      }
    });

    return Object.values(conversations).sort((a, b) => {
      const dateA = new Date(a.lastMessage?.created_at || a.lastMessage?.timestamp || 0);
      const dateB = new Date(b.lastMessage?.created_at || b.lastMessage?.timestamp || 0);
      return dateB - dateA;
    });
  }

  async function loadConversation(publicKey, handle) {
    setSelectedConversation({ publicKey, handle });

    try {
      const { fetchConversation } = await import('@gns/api-web');
      const result = await fetchConversation(publicKey, { limit: 50 });
      if (result.success) {
        const syncedKey = `gns_synced_${publicKey.toLowerCase()}`;
        const syncedMessages = JSON.parse(localStorage.getItem(syncedKey) || '[]');
        const session = JSON.parse(localStorage.getItem('gns_browser_session') || '{}');

        setConversationMessages(prev => {
          const session = JSON.parse(localStorage.getItem('gns_browser_session') || '{}');
          const serverMessages = result.messages.map(msg => {
            const isOutgoing = (msg.from_pk || msg.fromPublicKey || '').toLowerCase() === session.publicKey?.toLowerCase();

            if (syncedMessages.length > 0) {
              const msgTimestamp = new Date(msg.created_at).getTime();
              const syncedMatch = syncedMessages.find(s =>
                (msg.id && s.id && msg.id === s.id) ||
                Math.abs(msgTimestamp - s.timestamp) < 5000
              );
              if (syncedMatch?.text) {
                return { ...msg, isOutgoing, decryptedText: syncedMatch.text };
              }
            }

            if (isOutgoing) {
              const localMatch = prev.find(m =>
                m.decryptedText && m.isOutgoing &&
                (m.id === msg.id || (Math.abs(new Date(msg.created_at) - new Date(m.created_at)) < 5000))
              );
              if (localMatch?.decryptedText) {
                return { ...msg, isOutgoing, decryptedText: localMatch.decryptedText };
              }
            }
            return { ...msg, isOutgoing };
          });

          const offlineMessages = syncedMessages.filter(sm =>
            !serverMessages.find(rm => rm.id === sm.id || Math.abs(new Date(rm.created_at).getTime() - sm.timestamp) < 5000)
          ).map(sm => {
            const isMsgOutgoing = sm.direction !== 'incoming' && sm.direction !== 'inbound';
            return {
              id: sm.id,
              from_pk: isMsgOutgoing ? session.publicKey : publicKey,
              to_pk: isMsgOutgoing ? publicKey : session.publicKey,
              payload: JSON.stringify({ type: 'text', content: sm.text }),
              created_at: new Date(sm.timestamp).toISOString(),
              isOutgoing: isMsgOutgoing,
              decryptedText: sm.text,
              timestamp: sm.timestamp
            };
          });

          const localMessages = prev.filter(m =>
            m.decryptedText && m.isOutgoing && m.to_pk?.toLowerCase() === publicKey.toLowerCase() &&
            !serverMessages.find(rm => rm.id === m.id) &&
            !offlineMessages.find(om => om.id === m.id)
          );

          const combined = [...serverMessages, ...offlineMessages, ...localMessages];

          const lastSyncTime = parseInt(sessionStorage.getItem(`last_sync_${publicKey}`) || '0');
          if (Date.now() - lastSyncTime > 10000 && combined.length > 0 && combined.some(m => !m.decryptedText && !m.text)) {
            sessionStorage.setItem(`last_sync_${publicKey}`, Date.now().toString());
            wsService.requestSync(publicKey, 50);
          }

          combined.sort((a, b) => new Date(a.created_at || a.timestamp) - new Date(b.created_at || b.timestamp));
          return combined;
        });
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  }

  function openMessages() {
    if (!authUser) {
      setShowSignIn(true);
      return;
    }
    setCurrentView('messages');
    setSelectedConversation(null);
    loadInbox();
    setUnreadCount(0);
  }

  async function fetchProfile(handle) {
    const cleanHandle = handle.replace(/^@/, '').toLowerCase();
    setIsLoading(true);
    setError(null);
    try {
      const result = await getProfileByHandle(cleanHandle);
      if (result.success && result.data) {
        setCurrentProfile(result.data);
        setAddressBar(`@${cleanHandle}`);
        setCurrentView('profile');
      } else if (SAMPLE_PROFILES[cleanHandle]) {
        setCurrentProfile(SAMPLE_PROFILES[cleanHandle]);
        setAddressBar(`@${cleanHandle}`);
        setCurrentView('profile');
      } else {
        setAddressBar(`@${cleanHandle}`);
        setCurrentView('not-found');
        setError(result.error || 'Identity not found');
      }
    } catch (err) {
      setError('Network error');
      setCurrentView('not-found');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSearch(query) {
    if (!query.trim()) return;
    const cleanQuery = query.replace(/^@/, '').toLowerCase();
    setIsLoading(true);
    if (!cleanQuery.includes(' ')) {
      await fetchProfile(cleanQuery);
      return;
    }
    try {
      const result = await searchIdentities(cleanQuery);
      setSearchResults(result.data || []);
      setAddressBar(query);
      setCurrentView('search-results');
    } catch (err) {
      setSearchResults([]);
      setCurrentView('search-results');
    } finally {
      setIsLoading(false);
    }
  }

  function goHome() {
    setCurrentView('home');
    setAddressBar('');
    setCurrentProfile(null);
    setSearchResults([]);
    setSelectedConversation(null);
    setError(null);
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  function openMessageModal(profile) {
    if (!authUser) {
      setShowSignIn(true);
      return;
    }
    setMessageRecipient(profile);
    setShowMessageModal(true);
  }

  async function handleSendMessage(text) {
    // ... logic preserved from original (omitted for brevity in this tool call but assumed preserved)
    // Actually I need to include it if I overwrite. 
    // Since I'm using write_to_file, I must include EVERYTHING.
    // I will include the logic from the previous view_file.

    // ... re-pasting implementation ...
    if (!text.trim() || !messageRecipient) return;
    setSendingMessage(true);
    try {
      const { sendMessage } = await import('@gns/api-web');
      const result = await sendMessage(messageRecipient.publicKey, text, messageRecipient.encryptionKey);
      if (result.success) {
        setShowMessageModal(false);
        setCurrentView('messages');
        setSelectedConversation({
          publicKey: messageRecipient.publicKey,
          handle: messageRecipient.handle,
        });
        const newMessage = {
          id: Date.now(),
          from_pk: authUser.publicKey,
          to_pk: messageRecipient.publicKey,
          payload: JSON.stringify({ type: 'text', content: text }),
          created_at: new Date().toISOString(),
          isOutgoing: true,
          decryptedText: text,
        };
        setInboxMessages(prev => {
          const existing = prev.find(c => c.publicKey.toLowerCase() === messageRecipient.publicKey.toLowerCase());
          if (existing) return prev;
          return [{
            publicKey: messageRecipient.publicKey,
            handle: messageRecipient.handle,
            messages: [],
            lastMessage: newMessage,
            unreadCount: 0,
          }, ...prev];
        });
        setConversationMessages(prev => [...prev, newMessage]);

        try {
          const syncedKey = `gns_synced_${messageRecipient.publicKey.toLowerCase()}`;
          const syncedMessages = JSON.parse(localStorage.getItem(syncedKey) || '[]');
          syncedMessages.push({
            id: result.messageId || `msg_${Date.now()}`,
            text: text,
            timestamp: Date.now()
          });
          localStorage.setItem(syncedKey, JSON.stringify(syncedMessages));
        } catch (e) { console.error(e); }

        wsService.notifyMessageSent(
          result.messageId || `msg_${Date.now()}`,
          messageRecipient.publicKey,
          text
        );
        setTimeout(() => {
          loadConversation(messageRecipient.publicKey, messageRecipient.handle);
        }, 2000);
      } else {
        alert(`Failed to send: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
    setSendingMessage(false);
  }

  async function handleSendReply(text) {
    if (!text.trim() || !selectedConversation) return;

    try {
      const { sendMessage } = await import('@gns/api-web');
      const result = await sendMessage(selectedConversation.publicKey, text, null);

      if (result.success) {
        const newMessage = {
          id: result.messageId || `msg_${Date.now()}`,
          from_pk: authUser.publicKey,
          to_pk: selectedConversation.publicKey,
          payload: JSON.stringify({ type: 'text', content: text }),
          created_at: new Date().toISOString(),
          isOutgoing: true,
          decryptedText: text,
          timestamp: Date.now(),
          text: text,
          direction: 'outgoing',
        };

        setConversationMessages(prev => [...prev, newMessage]);

        try {
          const syncedKey = `gns_synced_${selectedConversation.publicKey.toLowerCase()}`;
          const syncedMessages = JSON.parse(localStorage.getItem(syncedKey) || '[]');
          syncedMessages.push({
            id: newMessage.id,
            text: text,
            timestamp: newMessage.timestamp
          });
          localStorage.setItem(syncedKey, JSON.stringify(syncedMessages));
        } catch (e) {
          console.error('Failed to save sync message', e);
        }

        wsService.notifyMessageSent(newMessage.id, selectedConversation.publicKey, text);

        setTimeout(() => {
          loadConversation(selectedConversation.publicKey, selectedConversation.handle);
        }, 2000);
      } else {
        alert(`Failed to send: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  }

};

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red', wordBreak: 'break-word', paddingTop: 100, backgroundColor: 'white', overflow: 'scroll', height: '100vh', zIndex: 9999, position: 'relative' }}>
          <h1>Something went wrong.</h1>
          <h3>{this.state.error && this.state.error.toString()}</h3>
          <pre style={{ fontSize: 10, whiteSpace: 'pre-wrap' }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <ApiProvider adapter={webAdapter}>
          <ErrorBoundary>
            <PlatformRouter />
          </ErrorBoundary>
        </ApiProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
