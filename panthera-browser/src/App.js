import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Globe, Megaphone, Mail, MessageCircle, Video, Home, Sparkles } from 'lucide-react';

import { getProfileByHandle, searchIdentities, SAMPLE_PROFILES } from './gnsApi';
import { getSession, isAuthenticated } from './auth';
import wsService from './websocket';
import crypto from './crypto';

// Context & Hooks
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useStudioState } from './hooks/useStudioState';

// Components
import { BrowserChrome, HomePage, ProfileView, SearchResultsView, NotFoundView, LoadingView } from './components/views';
import { MessagesView } from './components/messages';
import { StudioView } from './components/studio';
import { SignInModal, MessageModal, QRLoginModal } from './components/modals';

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
    { icon: Globe, label: 'gcrumbs', color: '#0EA5E9' },
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
  }, [currentView, selectedConversation, authUser, loadInbox]); // loadInbox dependency requires useCallback above, or we move this logic.

  // Re-define loadInbox to be stable or move outside if possible. 
  // Ideally loadInbox should also rely on authUser. 
  // IMPORTANT: The definition of loadInbox needs to be cleaner.

  // FIX: Provide dependencies for loadInbox in the useCallback

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
            loadConversation={loadConversation}
            loadInbox={loadInbox}
            inboxLoading={inboxLoading}
            onSendReply={handleSendReply}
            setSelectedConversation={setSelectedConversation}
            fetchProfile={fetchProfile}
          />
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
      const { fetchInbox } = await import('./messaging');
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
      const { fetchConversation } = await import('./messaging');
      const result = await fetchConversation(publicKey, { limit: 50 });
      if (result.success) {
        const syncedKey = `gns_synced_${publicKey.toLowerCase()}`;
        const syncedMessages = JSON.parse(localStorage.getItem(syncedKey) || '[]');

        setConversationMessages(prev => {
          const session = JSON.parse(localStorage.getItem('gns_browser_session') || '{}');
          const serverMessages = result.messages.map(msg => {
            const isOutgoing = (msg.from_pk || msg.fromPublicKey || '').toLowerCase() === session.publicKey?.toLowerCase();

            if (isOutgoing && syncedMessages.length > 0) {
              const msgTimestamp = new Date(msg.created_at).getTime();
              const syncedMatch = syncedMessages.find(s => Math.abs(msgTimestamp - s.timestamp) < 5000);
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

          const localMessages = prev.filter(m =>
            m.decryptedText && m.isOutgoing && m.to_pk?.toLowerCase() === publicKey.toLowerCase() &&
            !result.messages.find(rm => rm.id === m.id)
          );

          const combined = [...serverMessages, ...localMessages];
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
    if (!text.trim() || !messageRecipient) return;
    setSendingMessage(true);
    try {
      const { sendMessage } = await import('./messaging');
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
      const { sendMessage } = await import('./messaging');
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

        // Save to localStorage sync
        try {
          const syncData = localStorage.getItem('gns_message_sync');
          const messageSync = syncData ? JSON.parse(syncData) : { conversations: [] };
          let conv = messageSync.conversations?.find(c => c.withPublicKey.toLowerCase() === selectedConversation.publicKey.toLowerCase());
          if (!conv) {
            conv = { withPublicKey: selectedConversation.publicKey, withHandle: selectedConversation.handle, messages: [] };
            messageSync.conversations = messageSync.conversations || [];
            messageSync.conversations.push(conv);
          }
          conv.messages = conv.messages || [];
          conv.messages.push(newMessage);
          localStorage.setItem('gns_message_sync', JSON.stringify(messageSync));
        } catch (e) { }

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

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
