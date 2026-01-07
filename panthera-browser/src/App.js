import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Globe, Megaphone, Mail, MessageCircle, Video, Home, User, ArrowLeft, ArrowRight, RotateCw, Star, Menu, X, Building, MapPin, Package, Moon, Sun, Download, Loader2, ExternalLink, Copy, Check, Send, LogOut, Wifi, WifiOff, Inbox, ChevronLeft, Shield, Smartphone, RefreshCw, AlertTriangle, Sparkles, Plus, Trash2, GripVertical, Image, Link2, List, Type, Calendar, DollarSign, Eye, Save, ChevronDown, ChevronUp, Edit2, Camera, AtSign, Bell, Lock, Palette, Layout } from 'lucide-react';
import { getProfileByHandle, searchIdentities } from './gnsApi';
import { getSession, signIn, signOut, isAuthenticated } from './auth';
import { fetchInbox, fetchConversation } from './messaging';
import { tryDecryptMessage } from './crypto';
import crypto from './crypto';
import wsService from './websocket';
import { QRCodeSVG } from 'qrcode.react';

// Realistic Panther Logo (Golden Eyes)
const PantherLogo = ({ size = 64, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
    <defs>
      <linearGradient id="furGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#2d2d2d" />
        <stop offset="50%" stopColor="#1a1a1a" />
        <stop offset="100%" stopColor="#0d0d0d" />
      </linearGradient>
      <linearGradient id="eyeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFD700" />
        <stop offset="50%" stopColor="#FFA500" />
        <stop offset="100%" stopColor="#FF8C00" />
      </linearGradient>
      <radialGradient id="eyeShine" cx="30%" cy="30%" r="50%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
    </defs>
    <path d="M100 25 C 45 25, 20 70, 25 110 C 28 140, 45 170, 100 180 C 155 170, 172 140, 175 110 C 180 70, 155 25, 100 25 Z" fill="url(#furGradient)" />
    <path d="M35 55 C 25 25, 45 10, 60 35 C 55 45, 45 50, 35 55 Z" fill="#1a1a1a" />
    <path d="M40 50 C 35 35, 48 25, 55 40 C 52 45, 45 48, 40 50 Z" fill="#2a2a2a" />
    <path d="M165 55 C 175 25, 155 10, 140 35 C 145 45, 155 50, 165 55 Z" fill="#1a1a1a" />
    <path d="M160 50 C 165 35, 152 25, 145 40 C 148 45, 155 48, 160 50 Z" fill="#2a2a2a" />
    <path d="M45 75 C 55 68, 70 70, 80 78" stroke="#0d0d0d" strokeWidth="4" fill="none" strokeLinecap="round" />
    <path d="M155 75 C 145 68, 130 70, 120 78" stroke="#0d0d0d" strokeWidth="4" fill="none" strokeLinecap="round" />
    <ellipse cx="65" cy="95" rx="22" ry="18" fill="#0d0d0d" />
    <ellipse cx="135" cy="95" rx="22" ry="18" fill="#0d0d0d" />
    <ellipse cx="65" cy="95" rx="16" ry="14" fill="url(#eyeGradient)" />
    <ellipse cx="65" cy="95" rx="7" ry="12" fill="#0d0d0d" />
    <ellipse cx="62" cy="92" rx="4" ry="3" fill="url(#eyeShine)" />
    <ellipse cx="135" cy="95" rx="16" ry="14" fill="url(#eyeGradient)" />
    <ellipse cx="135" cy="95" rx="7" ry="12" fill="#0d0d0d" />
    <ellipse cx="132" cy="92" rx="4" ry="3" fill="url(#eyeShine)" />
    <path d="M100 85 L100 115" stroke="#151515" strokeWidth="3" fill="none" />
    <path d="M85 125 C 85 115, 90 110, 100 110 C 110 110, 115 115, 115 125 C 115 132, 108 138, 100 138 C 92 138, 85 132, 85 125 Z" fill="#1a1a1a" />
    <ellipse cx="100" cy="125" rx="10" ry="7" fill="#2d2d2d" />
    <ellipse cx="93" cy="127" rx="4" ry="3" fill="#0d0d0d" />
    <ellipse cx="107" cy="127" rx="4" ry="3" fill="#0d0d0d" />
    <path d="M70 135 C 75 145, 85 155, 100 158 C 115 155, 125 145, 130 135" fill="none" stroke="#252525" strokeWidth="2" />
    <path d="M100 138 L100 148" stroke="#151515" strokeWidth="2" />
    <path d="M100 148 C 90 155, 85 152, 82 148" stroke="#151515" strokeWidth="2" fill="none" />
    <path d="M100 148 C 110 155, 115 152, 118 148" stroke="#151515" strokeWidth="2" fill="none" />
    <circle cx="60" cy="135" r="2" fill="#252525" />
    <circle cx="55" cy="142" r="2" fill="#252525" />
    <circle cx="52" cy="128" r="2" fill="#252525" />
    <circle cx="140" cy="135" r="2" fill="#252525" />
    <circle cx="145" cy="142" r="2" fill="#252525" />
    <circle cx="148" cy="128" r="2" fill="#252525" />
  </svg>
);

// Sample profiles (fallback)
const SAMPLE_PROFILES = {
  'gcrumbs': { handle: 'gcrumbs', name: 'Globe Crumbs', tagline: 'Identity through Presence', type: 'organization', avatar: '🌐', bio: 'The Identity Web.', stats: { trustScore: '100%', breadcrumbs: '∞', verified: true }, links: ['gcrumbs.com'], color: '#0EA5E9' },
  'echo': { handle: 'echo', name: 'Echo Bot', tagline: 'GNS Test Bot', type: 'bot', avatar: '🤖', bio: 'I echo your messages back!', stats: { trustScore: '100%', breadcrumbs: '∞', verified: true }, links: [], color: '#10B981' }
};

// QR Login Modal Component
const QRLoginModal = ({ isOpen, onClose, onSuccess, darkMode }) => {
  const [status, setStatus] = useState('loading');
  const [sessionData, setSessionData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(300);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  const modalTheme = {
    bg: darkMode ? 'bg-gray-800' : 'bg-white',
    text: darkMode ? 'text-white' : 'text-gray-900',
    textMuted: darkMode ? 'text-gray-400' : 'text-gray-600',
    border: darkMode ? 'border-gray-700' : 'border-gray-200',
  };

  useEffect(() => {
    if (!isOpen) return;

    const requestSession = async () => {
      try {
        setStatus('loading');
        setError(null);

        const browserInfo = `${navigator.userAgent.split(' ').slice(-2).join(' ')}`;

        // Generate browser's X25519 encryption keypair
        console.log('🔐 Generating browser encryption keys...');
        const browserKeys = await crypto.generateX25519Keypair();

        // Store temporarily in sessionStorage
        sessionStorage.setItem('gns_browser_encryption_public_key', browserKeys.publicKey);
        sessionStorage.setItem('gns_browser_encryption_private_key', browserKeys.privateKey);

        console.log('   ✅ Browser encryption keys generated');
        console.log('   🔑 Public key:', browserKeys.publicKey.substring(0, 16) + '...');

        const response = await fetch('https://gns-browser-production.up.railway.app/auth/sessions/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            browserInfo,
            browserEncryptionPublicKey: browserKeys.publicKey,  // Include in QR
          }),
        });

        const data = await response.json();

        if (data.success) {
          setSessionData(data.data);
          setTimeLeft(data.data.expiresIn || 300);
          setStatus('ready');
          startPolling(data.data.sessionId);
          startTimer();
        } else {
          setError(data.error || 'Failed to create session');
          setStatus('error');
        }
      } catch (err) {
        console.error('QR session error:', err);
        setError(err.message);
        setStatus('error');
      }
    };

    requestSession();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen]);

  const startPolling = (sessionId) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const response = await fetch(`https://gns-browser-production.up.railway.app/auth/sessions/${sessionId}`);
        const data = await response.json();

        if (!response.ok) {
          if (response.status === 410) {
            setStatus('expired');
            clearInterval(pollRef.current);
          }
          return;
        }

        if (data.data?.status === 'approved') {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setStatus('approved');

          setTimeout(() => {
            // Get browser's encryption keys from sessionStorage
            const browserEncryptionPrivateKey = sessionStorage.getItem('gns_browser_encryption_private_key');
            const browserEncryptionPublicKey = sessionStorage.getItem('gns_browser_encryption_public_key');

            const session = {
              publicKey: data.data.publicKey,
              handle: data.data.handle,

              // Mobile's encryption key for dual encryption
              encryptionKey: data.data.encryptionKey,

              // Browser's encryption keys
              encryptionPrivateKey: browserEncryptionPrivateKey,
              encryptionPublicKey: browserEncryptionPublicKey,

              sessionToken: data.data.sessionToken,
              isVerified: true,
              pairedAt: Date.now(),
            };

            // Clear sessionStorage keys (now in localStorage)
            sessionStorage.removeItem('gns_browser_encryption_private_key');
            sessionStorage.removeItem('gns_browser_encryption_public_key');

            console.log('✅ QR login complete!');
            console.log('   Mobile encryption key:', session.encryptionKey?.substring(0, 16) + '...');
            console.log('   Browser encryption keys stored:', !!browserEncryptionPrivateKey);

            localStorage.setItem('gns_browser_session', JSON.stringify(session));

            // NEW: Store synced messages if provided
            if (data.data.messageSync) {
              localStorage.setItem('gns_message_sync', JSON.stringify(data.data.messageSync));
            }

            onSuccess(session, data.data.messageSync);  // Pass messageSync to handler
          }, 1500);

        } else if (data.data?.status === 'rejected') {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setStatus('rejected');
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 2000);
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setStatus('expired');
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRetry = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus('loading');
    setSessionData(null);
    setTimeLeft(300);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className={`${modalTheme.bg} rounded-3xl p-8 max-w-md w-full shadow-2xl`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center">
              <Shield className="text-cyan-600" size={24} />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${modalTheme.text}`}>Secure Sign In</h2>
              <p className={`${modalTheme.textMuted} text-sm`}>Scan with GNS Mobile App</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 hover:bg-gray-100 rounded-lg ${modalTheme.textMuted}`}>
            <X size={20} />
          </button>
        </div>

        <div className="text-center">
          {status === 'loading' && (
            <div className="py-12">
              <Loader2 size={48} className="text-cyan-500 animate-spin mx-auto mb-4" />
              <p className={modalTheme.textMuted}>Generating secure session...</p>
            </div>
          )}

          {status === 'ready' && sessionData && (
            <>
              <div className={`bg-white p-4 rounded-2xl inline-block mb-6 border-4 ${modalTheme.border}`}>
                <QRCodeSVG value={sessionData.qrData} size={200} level="M" bgColor="#ffffff" fgColor="#000000" />
              </div>
              <div className={`flex items-center justify-center gap-2 mb-4 ${modalTheme.textMuted}`}>
                <Smartphone size={20} />
                <span>Open GNS App → Scan QR Code</span>
              </div>
              <div className={`text-sm ${timeLeft < 60 ? 'text-red-500' : modalTheme.textMuted}`}>
                Expires in {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>
              <div className="mt-6 flex items-center justify-center gap-2 text-cyan-500">
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
                <span className="text-sm">Waiting for approval...</span>
              </div>
            </>
          )}

          {status === 'approved' && (
            <div className="py-12">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={48} className="text-green-600" />
              </div>
              <h3 className={`text-xl font-semibold ${modalTheme.text} mb-2`}>Approved!</h3>
              <p className={modalTheme.textMuted}>Signing you in securely...</p>
            </div>
          )}

          {status === 'rejected' && (
            <div className="py-12">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <X size={48} className="text-red-600" />
              </div>
              <h3 className={`text-xl font-semibold ${modalTheme.text} mb-2`}>Rejected</h3>
              <p className={`${modalTheme.textMuted} mb-6`}>Sign-in was rejected on mobile.</p>
              <button onClick={handleRetry} className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-full text-white font-medium flex items-center gap-2 mx-auto">
                <RefreshCw size={18} /> Try Again
              </button>
            </div>
          )}

          {(status === 'expired' || status === 'error') && (
            <div className="py-12">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={48} className="text-yellow-600" />
              </div>
              <h3 className={`text-xl font-semibold ${modalTheme.text} mb-2`}>{status === 'expired' ? 'Session Expired' : 'Error'}</h3>
              <p className={`${modalTheme.textMuted} mb-6`}>{error || 'Please try again.'}</p>
              <button onClick={handleRetry} className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-full text-white font-medium flex items-center gap-2 mx-auto">
                <RefreshCw size={18} /> Try Again
              </button>
            </div>
          )}
        </div>

        {status === 'ready' && (
          <div className={`mt-6 p-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-xl`}>
            <div className="flex items-start gap-3">
              <Shield size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
              <div className={`text-sm ${modalTheme.textMuted}`}>
                <strong className={modalTheme.text}>Secure Pairing</strong>
                <p className="mt-1">Your private keys never leave your mobile device.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


export default function App() {
  // View state
  const [currentView, setCurrentView] = useState('home');
  const [addressBar, setAddressBar] = useState('');
  const [currentProfile, setCurrentProfile] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Auth state
  const [showSignIn, setShowSignIn] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [signInHandle, setSignInHandle] = useState('');
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState('');

  // Message state
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageRecipient, setMessageRecipient] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [incomingMessage, setIncomingMessage] = useState(null);

  // ✅ NEW: Inbox state
  const [inboxMessages, setInboxMessages] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // QR Login state
  const [showQRLogin, setShowQRLogin] = useState(false);

  // WebSocket state
  const [wsConnected, setWsConnected] = useState(false);

  // Studio state
  const [studioTool, setStudioTool] = useState(null); // null, 'gsite', 'profile', 'facets', 'settings'
  const [gsiteData, setGsiteData] = useState({
    blocks: [],
    style: { mood: 'cool', accent: 'blue', density: 'balanced' },
    title: '',
    published: false,
  });
  const [profileData, setProfileData] = useState({
    displayName: '',
    bio: '',
    avatar: null,
    location: '',
    website: '',
  });
  const [facets, setFacets] = useState([]);
  const [settingsData, setSettingsData] = useState({
    notifications: true,
    privateMode: false,
    theme: 'system',
  });

  // Refs for performance (avoid re-renders on typing)
  const messageRef = useRef(null);
  const replyRef = useRef(null);

  // Theme
  const theme = {
    bg: darkMode ? 'bg-gray-900' : 'bg-gray-50',
    bgSecondary: darkMode ? 'bg-gray-800' : 'bg-white',
    bgTertiary: darkMode ? 'bg-gray-700' : 'bg-gray-100',
    text: darkMode ? 'text-white' : 'text-gray-900',
    textSecondary: darkMode ? 'text-gray-400' : 'text-gray-600',
    textMuted: darkMode ? 'text-gray-500' : 'text-gray-400',
    border: darkMode ? 'border-gray-700' : 'border-gray-200',
    hover: darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100',
  };

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

  // Initialize auth state
  useEffect(() => {
    const session = getSession();
    if (session && isAuthenticated()) {
      console.log('✅ Session restored from localStorage');
      console.log('   User:', session.publicKey?.substring(0, 16) + '...');  // ✅ FIX: use publicKey not identityPublicKey
      console.log('   Handle:', session.handle);
      console.log('   Session token:', session.sessionToken ? 'present' : 'missing');
      setAuthUser({
        handle: session.handle || session.publicKey?.substring(0, 8) || 'user',  // ✅ FIX: use handle from session
        publicKey: session.publicKey,  // ✅ FIX: use publicKey directly
      });
      // Connect WebSocket if authenticated
      wsService.connect(session.publicKey, session.sessionToken);  // ✅ FIX: use sessionToken not token
    } else {
      console.log('⚠️ No valid session found - user needs to login');
      console.log('   Session exists:', !!session);
      console.log('   Is authenticated:', isAuthenticated());
    }

    // WebSocket listeners
    const unsubConnected = wsService.on('connected', () => setWsConnected(true));
    const unsubDisconnected = wsService.on('disconnected', () => setWsConnected(false));
    const unsubMessage = wsService.on('message', (data) => {
      console.log('📩 Incoming message:', data);
      // Parse payload if it's a string
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

      // Update unread count
      setUnreadCount(prev => prev + 1);

      // Auto-hide after 5 seconds
      setTimeout(() => setIncomingMessage(null), 5000);

      // Refresh inbox if on messages view
      if (currentView === 'messages') {
        loadInbox();

        // ✅ FIX: If we have an active conversation with this sender, reload it
        if (selectedConversation && data.from_pk?.toLowerCase() === selectedConversation.publicKey?.toLowerCase()) {
          console.log('🔄 Reloading active conversation with', selectedConversation.handle);
          loadConversation(selectedConversation.publicKey, selectedConversation.handle);
        }
      }
    });

    // ✅ NEW: Listen for messages synced from mobile
    const unsubMessageSynced = wsService.on('messageSynced', (data) => {
      console.log('📩 Message synced from mobile:', data.messageId);
      console.log('   conversationWith:', data.conversationWith);
      console.log('   selectedConversation:', selectedConversation?.publicKey);
      console.log('   Match:', data.conversationWith?.toLowerCase() === selectedConversation?.publicKey?.toLowerCase());

      // If we have an active conversation with this sender, reload it
      if (selectedConversation && data.conversationWith?.toLowerCase() === selectedConversation.publicKey?.toLowerCase()) {
        console.log('🔄 Reloading active conversation - new message from mobile');
        loadConversation(selectedConversation.publicKey, selectedConversation.handle);
      } else {
        console.log('⚠️ Not reloading - no matching conversation');
        console.log('   Selected:', selectedConversation?.publicKey);
        console.log('   Message with:', data.conversationWith);
      }

      // Also refresh inbox to update conversation list
      if (currentView === 'messages') {
        loadInbox();
      }
    });

    return () => {
      unsubConnected();
      unsubDisconnected();
      unsubMessage();
      unsubMessageSynced();  // ✅ NEW: Cleanup
    };
  }, [currentView]);

  // ✅ NEW: Load inbox messages
  const loadInbox = useCallback(async () => {
    if (!authUser) return;

    setInboxLoading(true);
    try {
      const result = await fetchInbox({ limit: 50 });
      if (result.success) {
        // Group messages by sender
        const grouped = groupMessagesBySender(result.messages);

        // ✅ FIX: Merge with existing inbox to preserve manually-added conversations
        setInboxMessages(prev => {
          // Find conversations that were manually added but don't have server messages yet
          const manualConversations = prev.filter(c =>
            !grouped.find(g => g.publicKey.toLowerCase() === c.publicKey.toLowerCase())
          );

          // Combine server conversations with manual ones
          return [...grouped, ...manualConversations];
        });

        setUnreadCount(result.messages.filter(m => !m.read).length);
      }
    } catch (error) {
      console.error('Failed to load inbox:', error);
    }
    setInboxLoading(false);
  }, [authUser]);

  // ✅ NEW: Group messages by sender into conversations
  const groupMessagesBySender = (messages) => {
    const conversations = {};
    const session = JSON.parse(localStorage.getItem('gns_browser_session') || '{}');
    const myPublicKey = session.publicKey?.toLowerCase();

    messages.forEach(msg => {
      if (typeof msg === 'string') {
        try { msg = JSON.parse(msg); } catch (e) { return; }
      }
      if (!msg) return;

      // ✅ FIX: Get the OTHER party's key (not ours)
      const fromPk = (msg.from_pk || msg.fromPublicKey || '').toLowerCase();
      const toPk = (msg.to_pk || msg.toPublicKeys?.[0] || '').toLowerCase();

      // Determine who the "other party" is
      const isOutgoing = fromPk === myPublicKey;
      const otherParty = isOutgoing ? toPk : fromPk;

      if (!otherParty) {
        console.warn('Message missing other party:', msg);
        return;
      }

      if (!conversations[otherParty]) {
        conversations[otherParty] = {
          publicKey: otherParty,
          handle: isOutgoing
            ? (msg.to_handle || otherParty.substring(0, 8) + '...')
            : (msg.from_handle || msg.fromHandle || otherParty.substring(0, 8) + '...'),
          messages: [],
          lastMessage: null,
          unreadCount: 0,
        };
      }

      // ✅ Mark message as outgoing for display
      msg.isOutgoing = isOutgoing;
      conversations[otherParty].messages.push(msg);

      const msgTime = new Date(msg.created_at || msg.timestamp || 0);
      const lastTime = conversations[otherParty].lastMessage
        ? new Date(conversations[otherParty].lastMessage.created_at || conversations[otherParty].lastMessage.timestamp || 0)
        : new Date(0);

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
  };

  // ✅ NEW: Load conversation with specific user
  const loadConversation = async (publicKey, handle) => {
    setSelectedConversation({ publicKey, handle });

    // NEW: Check for synced messages first (from QR pairing)
    const syncData = localStorage.getItem('gns_message_sync');
    if (syncData) {
      try {
        const messageSync = JSON.parse(syncData);
        const syncedConv = messageSync.conversations?.find(
          c => c.withPublicKey.toLowerCase() === publicKey.toLowerCase()
        );

        if (syncedConv?.messages?.length > 0) {
          console.log(`📨 Found ${syncedConv.messages.length} synced messages in localStorage`);
          // ❌ REMOVED: Don't return early - we need to fetch from server too!
          // This allows us to get new messages sent from mobile
          // return;
        }
      } catch (e) {
        console.warn('Failed to parse synced messages:', e);
      }
    }

    // ✅ Don't clear existing messages - preserve locally added ones
    // setConversationMessages([]);  // REMOVED

    try {
      const result = await fetchConversation(publicKey, { limit: 50 });
      if (result.success) {
        // ✅ NEW: Load synced messages from WebSocket (stored separately)
        const syncedKey = `gns_synced_${publicKey.toLowerCase()}`;
        const syncedMessages = JSON.parse(localStorage.getItem(syncedKey) || '[]');
        console.log(`📨 Found ${syncedMessages.length} WebSocket-synced messages for this conversation`);

        // Create a map of synced messages by ID for quick lookup
        const syncedMap = new Map(syncedMessages.map(m => [m.id, m.text]));

        // ✅ Merge server messages with any locally-added messages that have decryptedText
        setConversationMessages(prev => {
          const session = JSON.parse(localStorage.getItem('gns_browser_session') || '{}');

          // Process server messages and try to match with local messages
          const serverMessages = result.messages.map(msg => {
            const isOutgoing = (msg.from_pk || msg.fromPublicKey || '').toLowerCase() === session.publicKey?.toLowerCase();

            // ✅ NEW: Match synced messages by timestamp (IDs don't match between WS and server)
            if (isOutgoing && syncedMessages.length > 0) {
              const msgTimestamp = new Date(msg.created_at).getTime();
              console.log(`🔍 Checking outgoing message at ${new Date(msgTimestamp).toISOString()}`);
              console.log(`   Available synced messages: ${syncedMessages.length}`);

              // Find synced message within 5 seconds of this message
              const syncedMatch = syncedMessages.find(s => {
                const syncTimestamp = s.timestamp;
                const diff = Math.abs(msgTimestamp - syncTimestamp);
                console.log(`   Comparing with synced at ${new Date(syncTimestamp).toISOString()} diff=${diff}ms`);
                return diff < 5000;  // 5 second window
              });

              if (syncedMatch?.text) {
                console.log(`✅ Matched synced message: "${syncedMatch.text.substring(0, 30)}..."`);
                return {
                  ...msg,
                  isOutgoing,
                  decryptedText: syncedMatch.text,  // ✅ Use synced plaintext!
                };
              } else {
                console.log(`⚠️ No match found within 5 seconds`);
              }
            }

            // ✅ FIX: If this is an outgoing message, try to find matching local message with decryptedText
            if (isOutgoing) {
              const localMatch = prev.find(m =>
                m.decryptedText &&
                m.isOutgoing &&
                (m.id === msg.id ||
                  (Math.abs(new Date(msg.created_at) - new Date(m.created_at)) < 5000 &&
                    (msg.from_pk || msg.fromPublicKey || '').toLowerCase() === m.from_pk?.toLowerCase()))
              );

              // If we have a local match with decryptedText, preserve it
              if (localMatch?.decryptedText) {
                return {
                  ...msg,
                  isOutgoing,
                  decryptedText: localMatch.decryptedText,  // ✅ Preserve plaintext from local message
                };
              }
            }

            return {
              ...msg,
              isOutgoing,
            };
          });

          // Keep local messages that aren't in server response yet
          // ✅ CRITICAL: Only keep messages for THIS conversation (check to_pk)
          const localMessages = prev.filter(m =>
            m.decryptedText &&
            m.isOutgoing &&
            m.to_pk?.toLowerCase() === publicKey.toLowerCase() &&  // ✅ FIX: Must be for THIS conversation!
            !result.messages.find(rm =>
              rm.id === m.id ||
              (Math.abs(new Date(rm.created_at) - new Date(m.created_at)) < 5000 &&
                (rm.from_pk || rm.fromPublicKey || '').toLowerCase() === m.from_pk?.toLowerCase())
            )
          );

          // Combine and sort by timestamp
          const combined = [...serverMessages, ...localMessages];
          combined.sort((a, b) => new Date(a.created_at || a.timestamp) - new Date(b.created_at || b.timestamp));

          return combined;
        });
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  // ✅ Decrypt encrypted messages when conversation loads
  useEffect(() => {
    const decryptMessages = async () => {
      if (!conversationMessages.length) return;

      const session = JSON.parse(localStorage.getItem('gns_browser_session') || '{}');
      if (!session.encryptionPrivateKey) return;

      let updated = false;
      const decrypted = await Promise.all(
        conversationMessages.map(async (msg) => {
          // Skip if already has plaintext content
          if (msg.decryptedText) return msg;

          // ✅ Check if encrypted - look for BOTH recipient and sender encryption fields
          const hasRecipientEncryption = (msg.encryptedPayload && msg.ephemeralPublicKey && msg.nonce) ||
            (msg.envelope?.encryptedPayload && msg.envelope?.ephemeralPublicKey && msg.envelope?.nonce);

          const hasSenderEncryption = (msg.senderEncryptedPayload && msg.senderEphemeralPublicKey && msg.senderNonce) ||
            (msg.envelope?.senderEncryptedPayload && msg.envelope?.senderEphemeralPublicKey && msg.envelope?.senderNonce);

          if (!hasRecipientEncryption && !hasSenderEncryption) {
            return msg;  // Not encrypted
          }

          // ✅ Browser should only decrypt OUTGOING messages (sender copies)
          // Incoming messages are encrypted for mobile only
          if (msg.isOutgoing === false) {
            return msg;  // Skip incoming messages
          }

          // ✅ Try to decrypt sender copy of outgoing message
          const text = await tryDecryptMessage(msg);
          if (text) {
            updated = true;
            return { ...msg, decryptedText: text };
          }
          return msg;
        })
      );

      if (updated) {
        setConversationMessages(decrypted);
      }
    };

    decryptMessages();
  }, [conversationMessages.map(m => m.id + m.created_at).join(',')]); // ✅ Trigger on actual message changes


  // ✅ NEW: Open messages view
  const openMessages = () => {
    if (!authUser) {
      setShowSignIn(true);
      return;
    }
    setCurrentView('messages');
    setSelectedConversation(null);
    loadInbox();
    setUnreadCount(0);
  };

  // Fetch profile
  const fetchProfile = useCallback(async (handle) => {
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
      if (SAMPLE_PROFILES[cleanHandle]) {
        setCurrentProfile(SAMPLE_PROFILES[cleanHandle]);
        setAddressBar(`@${cleanHandle}`);
        setCurrentView('profile');
      } else {
        setError('Network error');
        setCurrentView('not-found');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Search
  const handleSearch = useCallback(async (query) => {
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
  }, [fetchProfile]);

  const goHome = () => {
    setCurrentView('home');
    setAddressBar('');
    setCurrentProfile(null);
    setSearchResults([]);
    setSelectedConversation(null);
    setError(null);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Sign in handler - generates real cryptographic identity
  const handleSignIn = async () => {
    setSignInLoading(true);
    setSignInError('');

    const result = await signIn();

    if (result.success) {
      const session = result.session;
      setAuthUser({
        handle: signInHandle.trim() || session.identityPublicKey.substring(0, 8),
        publicKey: session.identityPublicKey,
      });
      setShowSignIn(false);
      setSignInHandle('');
      // Connect WebSocket with real identity
      wsService.connect(session.identityPublicKey, session.token);
      console.log('✅ Signed in with real Ed25519 identity');
    } else {
      setSignInError(result.error || 'Sign in failed');
    }
    setSignInLoading(false);
  };

  // Sign out handler
  const handleSignOut = () => {
    signOut();
    wsService.disconnect();
    setAuthUser(null);
    setWsConnected(false);
    setInboxMessages([]);
    setUnreadCount(0);
  };

  // Open message modal
  const openMessageModal = (profile) => {
    if (!authUser) {
      setShowSignIn(true);
      return;
    }
    setMessageRecipient(profile);
    setMessageSent(false);
    setShowMessageModal(true);
  };

  // Send message handler - REAL ENCRYPTED MESSAGING
  const handleSendMessage = async () => {
    const text = messageRef.current?.value || '';
    if (!text.trim() || !messageRecipient) return;
    setSendingMessage(true);

    try {
      // Import real messaging
      const { sendMessage } = await import('./messaging');

      // Send encrypted message via HTTP API
      const result = await sendMessage(
        messageRecipient.publicKey,
        text,
        messageRecipient.encryptionKey // May be null, will be fetched
      );

      if (result.success) {
        console.log('✅ Encrypted message delivered!');

        // ✅ Close modal and open conversation
        setShowMessageModal(false);
        setCurrentView('messages');

        // Set selected conversation
        setSelectedConversation({
          publicKey: messageRecipient.publicKey,
          handle: messageRecipient.handle,
        });

        // ✅ Add to inbox list so it appears in left column
        setInboxMessages(prev => {
          // Check if conversation already exists
          const existing = prev.find(c => c.publicKey.toLowerCase() === messageRecipient.publicKey.toLowerCase());
          if (existing) return prev;

          // Add new conversation
          return [{
            publicKey: messageRecipient.publicKey,
            handle: messageRecipient.handle,
            messages: [],
            lastMessage: {
              payload: JSON.stringify({ type: 'text', content: text }),
              created_at: new Date().toISOString(),
              isOutgoing: true,
            },
            unreadCount: 0,
          }, ...prev];
        });

        // Add sent message to conversation immediately with plaintext
        setConversationMessages(prev => [...prev, {
          id: Date.now(),
          from_pk: authUser.publicKey,
          to_pk: messageRecipient.publicKey,
          payload: JSON.stringify({ type: 'text', content: text }),
          created_at: new Date().toISOString(),
          isOutgoing: true,
          decryptedText: text,  // ✅ Store plaintext for display
        }]);

        // ✅ PHASE C: Notify mobile to store this message
        wsService.notifyMessageSent(
          result.messageId || `msg_${Date.now()}`,
          messageRecipient.publicKey,
          text  // Send plaintext to mobile
        );

        // Load full conversation after a delay (to get echo response)
        setTimeout(() => {
          loadConversation(messageRecipient.publicKey, messageRecipient.handle);
        }, 2000);


      } else {
        console.error('❌ Message failed:', result.error);
        alert(`Failed to send: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Send error:', error);
      alert(`Error: ${error.message}`);
    }

    setSendingMessage(false);
  };

  // ✅ NEW: Send reply in conversation
  const handleSendReply = async () => {
    const text = replyRef.current?.value || '';
    if (!text.trim() || !selectedConversation) return;

    try {
      const { sendMessage } = await import('./messaging');
      const result = await sendMessage(selectedConversation.publicKey, text, null); // null = auto-fetch encryption key

      if (result.success) {
        replyRef.current.value = '';

        // Create message object
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

        // Add to conversation immediately with decryptedText
        setConversationMessages(prev => [...prev, newMessage]);

        // ✅ NEW: Save to localStorage so it persists across refreshes
        try {
          const syncData = localStorage.getItem('gns_message_sync');
          const messageSync = syncData ? JSON.parse(syncData) : { conversations: [] };

          // Find or create conversation
          let conv = messageSync.conversations?.find(
            c => c.withPublicKey.toLowerCase() === selectedConversation.publicKey.toLowerCase()
          );

          if (!conv) {
            conv = {
              withPublicKey: selectedConversation.publicKey,
              withHandle: selectedConversation.handle,
              messages: [],
            };
            messageSync.conversations = messageSync.conversations || [];
            messageSync.conversations.push(conv);
          }

          // Add message to conversation
          conv.messages = conv.messages || [];
          conv.messages.push(newMessage);

          // Save back to localStorage
          localStorage.setItem('gns_message_sync', JSON.stringify(messageSync));
          console.log('✅ Message saved to localStorage');
        } catch (e) {
          console.error('Failed to save message to localStorage:', e);
        }

        // ✅ PHASE C: Notify mobile to store this message
        wsService.notifyMessageSent(
          newMessage.id,
          selectedConversation.publicKey,
          text  // Send plaintext to mobile
        );

        // ✅ Reload conversation after delay to get Echo response
        setTimeout(() => {
          loadConversation(selectedConversation.publicKey, selectedConversation.handle);
        }, 2000);


      } else {
        alert(`Failed to send: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
    return date.toLocaleDateString();
  };

  // Parse message content
  // Parse message content - handles both encrypted and plaintext
  const parseMessageContent = (msg) => {
    if (!msg) return 'Unable to parse message';

    try {
      // ✅ NEW: Check for synced message (already plaintext from mobile)
      if (msg._synced || msg.text) {
        return msg.text || msg.decryptedText;
      }

      // ✅ Check for pre-decrypted text first
      if (msg.decryptedText) {
        console.log(`✅ Using decryptedText: "${msg.decryptedText.substring(0, 30)}..."`);
        return msg.decryptedText;
      } else if (msg.isOutgoing) {
        console.log(`⚠️ Outgoing message has NO decryptedText, id=${msg.id?.substring(0, 16)}`);
      }

      // Check if it's an encrypted envelope (not yet decrypted) - check BOTH locations
      const hasEncryption = (msg.encryptedPayload && msg.ephemeralPublicKey && msg.nonce) ||
        (msg.envelope?.encryptedPayload && msg.envelope?.ephemeralPublicKey && msg.envelope?.nonce);

      if (hasEncryption) {
        const session = JSON.parse(localStorage.getItem('gns_browser_session') || '{}');

        // ✅ For outgoing encrypted messages
        const isOutgoing = msg.isOutgoing || msg.from_pk?.toLowerCase() === session.publicKey?.toLowerCase();
        if (isOutgoing) {
          // Check if this message has sender encryption fields (new dual encryption)
          const hasSenderFields = (msg.senderEncryptedPayload && msg.senderEphemeralPublicKey && msg.senderNonce) ||
            (msg.envelope?.senderEncryptedPayload && msg.envelope?.senderEphemeralPublicKey && msg.envelope?.senderNonce);

          if (!hasSenderFields) {
            // Old message without dual encryption - can't decrypt
            return '📤 Message sent (old format)';
          }

          if (!session.encryptionPrivateKey) {
            return '🔐 [Encrypted - re-pair to decrypt]';
          }
          // Has sender fields - let decryption useEffect handle it
          return '🔓 [Decrypting...]';
        }

        if (!session.encryptionPrivateKey) {
          return '🔐 [Encrypted - re-pair to decrypt]';
        }
        return '🔓 [Decrypting...]';
      }

      // Try envelope content field (plaintext from server)
      if (msg.content?.text) {
        return msg.content.text;
      }

      // Check if envelope has nested content
      if (msg.envelope?.content?.text) {
        return msg.envelope.content.text;
      }

      // Try payload parsing
      const payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
      return payload?.content || payload?.text || payload?.message || JSON.stringify(payload);
    } catch {
      return msg.payload || msg.content || 'Unable to parse message';
    }
  };

  // Browser Chrome
  const BrowserChrome = () => (
    <div className={`${theme.bgSecondary} border-b ${theme.border} px-3 py-2`}>
      <div className="flex items-center mb-2">
        <div className={`flex items-center ${theme.bgTertiary} rounded-t-lg px-4 py-2 text-sm ${theme.text}`}>
          <PantherLogo size={18} className="mr-2" />
          <span className="max-w-40 truncate font-medium">
            {currentView === 'home' ? 'New Tab' : currentView === 'messages' ? 'Messages' : addressBar || 'Panthera'}
          </span>
          <button className={`ml-3 ${theme.hover} rounded p-0.5 ${theme.textSecondary}`}><X size={14} /></button>
        </div>
        <button className={`ml-2 ${theme.textMuted} p-1 text-lg`}>+</button>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => currentView !== 'home' && goHome()} className={`p-2 ${theme.hover} rounded ${theme.textSecondary}`}><ArrowLeft size={18} /></button>
        <button className={`p-2 ${theme.hover} rounded ${theme.textSecondary}`}><ArrowRight size={18} /></button>
        <button onClick={() => currentProfile && fetchProfile(currentProfile.handle)} className={`p-2 ${theme.hover} rounded ${theme.textSecondary}`}>
          <RotateCw size={18} className={isLoading ? 'animate-spin' : ''} />
        </button>
        <button onClick={goHome} className={`p-2 ${theme.hover} rounded ${theme.textSecondary}`}><Home size={18} /></button>

        <form onSubmit={(e) => { e.preventDefault(); const val = e.target.elements.addressInput.value; if (val.trim()) handleSearch(val); }} className="flex-1">
          <div className={`flex items-center ${theme.bgTertiary} rounded-full px-4 py-2 border ${theme.border} focus-within:border-cyan-500`}>
            <span className="text-cyan-500 font-semibold mr-1">@</span>
            <input name="addressInput" type="text" defaultValue={addressBar} placeholder="Search @handles..." className={`bg-transparent flex-1 ${theme.text} text-sm outline-none placeholder-gray-400`} />
            {isLoading ? <Loader2 size={16} className="text-cyan-500 animate-spin" /> : <Search size={16} className={theme.textMuted} />}
          </div>
        </form>

        <button className={`p-2 ${theme.hover} rounded ${theme.textSecondary}`}><Star size={18} /></button>
        <button onClick={() => setDarkMode(!darkMode)} className={`p-2 ${theme.hover} rounded ${theme.textSecondary}`}>
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* ✅ NEW: Messages button */}
        <button
          onClick={openMessages}
          className={`p-2 ${theme.hover} rounded relative ${currentView === 'messages' ? 'text-cyan-500' : theme.textSecondary}`}
          title="Messages"
        >
          <Inbox size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Connection status */}
        <div className={`p-2 ${theme.textSecondary}`} title={wsConnected ? 'Connected' : 'Disconnected'}>
          {wsConnected ? <Wifi size={18} className="text-green-500" /> : <WifiOff size={18} className="text-gray-400" />}
        </div>

        {/* Auth button */}
        {authUser ? (
          <div className="flex items-center gap-2">
            <button onClick={() => fetchProfile(authUser.handle)} className="flex items-center gap-2 px-3 py-2 bg-cyan-500/20 rounded-full text-cyan-500 text-sm font-medium hover:bg-cyan-500/30">
              <span className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center text-white text-xs">
                {authUser.displayName?.[0] || authUser.handle?.[0]?.toUpperCase()}
              </span>
              <span>@{authUser.handle}</span>
            </button>
            <button onClick={handleSignOut} className={`p-2 ${theme.hover} rounded ${theme.textSecondary}`} title="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <button onClick={() => setShowSignIn(true)} className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-full text-white text-sm font-medium">
            <User size={16} /><span>Sign in</span>
          </button>
        )}

        <button className={`p-2 ${theme.hover} rounded ${theme.textSecondary}`}><Menu size={18} /></button>
      </div>
    </div>
  );

  // Home Page
  const HomePage = () => (
    <div className={`min-h-full ${theme.bg} flex flex-col items-center justify-center px-4 py-12`}>
      <PantherLogo size={140} className="mb-6" />
      <h1 className={`text-5xl font-bold ${theme.text} mb-2 tracking-tight`}>PANTHERA</h1>
      <p className={`${theme.textSecondary} text-lg mb-12`}>Browse the Identity Web</p>

      <form onSubmit={(e) => { e.preventDefault(); const val = e.target.elements.homeSearch.value; if (val) handleSearch(val); }} className="w-full max-w-2xl mb-12">
        <div className={`flex items-center ${theme.bgSecondary} border-2 ${theme.border} rounded-full px-6 py-4 hover:border-cyan-400 focus-within:border-cyan-500 focus-within:shadow-lg focus-within:shadow-cyan-500/20`}>
          <span className="text-cyan-500 text-2xl font-semibold mr-2">@</span>
          <input name="homeSearch" type="text" placeholder="Search handles..." className={`bg-transparent flex-1 ${theme.text} text-xl outline-none placeholder-gray-400`} />
          <button type="submit" className={`p-2 ${theme.hover} rounded-full`} disabled={isLoading}>
            {isLoading ? <Loader2 size={24} className="text-cyan-500 animate-spin" /> : <Search size={24} className="text-cyan-500" />}
          </button>
        </div>
      </form>

      <div className="flex gap-6 md:gap-8 mb-16 flex-wrap justify-center">
        {shortcuts.map((s) => (
          <button key={s.label} onClick={() => s.isStudio ? setCurrentView('studio') : handleSearch(s.label)} className="flex flex-col items-center gap-3 group" disabled={isLoading}>
            <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl ${theme.bgSecondary} border ${theme.border} flex items-center justify-center group-hover:scale-110 group-hover:shadow-lg transition-all`} style={{ boxShadow: `0 4px 20px ${s.color}20` }}>
              <s.icon size={26} style={{ color: s.color }} />
            </div>
            <span className={`${theme.textSecondary} text-sm font-medium group-hover:text-cyan-500`}>{s.label}@</span>
          </button>
        ))}
      </div>

      <div className={`${theme.bgSecondary} border ${theme.border} rounded-2xl p-8 max-w-lg text-center shadow-sm`}>
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center">
            <Download size={24} className="text-cyan-600" />
          </div>
        </div>
        <h3 className={`${theme.text} text-xl font-semibold mb-2`}>Get your @handle</h3>
        <p className={`${theme.textSecondary} mb-6`}>Download GNS Browser for iOS/Android to create your identity through Proof-of-Trajectory</p>
        <div className="flex gap-4 justify-center flex-wrap">
          <button className={`px-5 py-3 ${theme.bgTertiary} ${theme.hover} rounded-xl ${theme.text} font-medium`}> App Store</button>
          <button className={`px-5 py-3 ${theme.bgTertiary} ${theme.hover} rounded-xl ${theme.text} font-medium`}>🤖 Play Store</button>
        </div>
      </div>

      <div className={`mt-12 ${theme.textMuted} text-sm`}>Powered by GNS Protocol • Patent Pending #63/948,788</div>
    </div>
  );

  // Profile View
  const ProfileView = ({ profile }) => {
    const typeIcons = { person: User, organization: Building, landmark: MapPin, bot: Package };
    const TypeIcon = typeIcons[profile.type] || User;

    const renderAvatar = () => {
      if (profile.avatarUrl && profile.avatarUrl.startsWith('http')) {
        return <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover rounded-3xl" />;
      }
      return <span className="text-6xl">{profile.avatar || '👤'}</span>;
    };

    return (
      <div className={`min-h-full ${theme.bg}`}>
        <div className="h-48 relative" style={{ background: `linear-gradient(135deg, ${profile.color || '#0EA5E9'}40 0%, ${profile.color || '#0EA5E9'}10 100%)` }} />

        <div className="max-w-2xl mx-auto px-6 -mt-20 relative pb-12">
          <div className={`w-36 h-36 rounded-3xl ${theme.bgSecondary} border-4 ${darkMode ? 'border-gray-900' : 'border-gray-50'} shadow-xl flex items-center justify-center overflow-hidden mb-4`}>
            {renderAvatar()}
          </div>

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-3xl font-bold ${theme.text}`}>{profile.name}</h1>
                {profile.stats?.verified && <span className="text-cyan-500 text-xl">✓</span>}
              </div>
              <p className="text-cyan-500 text-lg font-medium">@{profile.handle}</p>
              <p className={`${theme.textSecondary} mt-1 flex items-center gap-2`}>
                <TypeIcon size={16} />{profile.tagline || profile.type}
              </p>
            </div>
            <button
              onClick={() => openMessageModal(profile)}
              className="px-6 py-3 rounded-full text-white font-medium shadow-lg self-start flex items-center gap-2 hover:shadow-xl transition-shadow"
              style={{ backgroundColor: profile.color || '#0EA5E9' }}
            >
              <MessageCircle size={18} />
              Message
            </button>
          </div>

          {profile.bio && <p className={`${theme.text} text-lg leading-relaxed mb-6`}>{profile.bio}</p>}

          <div className={`flex gap-6 md:gap-8 mb-6 pb-6 border-b ${theme.border} flex-wrap`}>
            {profile.stats?.trustScore && (
              <div><span className={`${theme.text} font-bold text-lg`}>{profile.stats.trustScore}</span><span className={`${theme.textSecondary} ml-2`}>Trust Score</span></div>
            )}
            {profile.stats?.breadcrumbs && (
              <div><span className={`${theme.text} font-bold text-lg`}>{profile.stats.breadcrumbs}</span><span className={`${theme.textSecondary} ml-2`}>Breadcrumbs</span></div>
            )}
          </div>

          {profile.publicKey && (
            <div className={`mb-6 p-4 ${theme.bgTertiary} rounded-xl`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`${theme.textSecondary} text-sm font-medium`}>Public Key</span>
                <button onClick={() => copyToClipboard(profile.publicKey)} className={`flex items-center gap-1 text-sm ${theme.textSecondary} hover:text-cyan-500`}>
                  {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                  {copiedKey ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <code className={`${theme.text} text-xs font-mono break-all`}>{profile.publicKey}</code>
            </div>
          )}

          {profile.links && profile.links.length > 0 && (
            <div className="flex gap-4 flex-wrap mb-6">
              {profile.links.map((link, i) => (
                link.startsWith('@') ? (
                  <button key={i} onClick={() => fetchProfile(link)} className="text-cyan-500 hover:underline font-medium">{link}</button>
                ) : (
                  <a key={i} href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:underline font-medium flex items-center gap-1">
                    <ExternalLink size={14} />{link.replace(/^https?:\/\//, '')}
                  </a>
                )
              ))}
            </div>
          )}

          <div className={`mt-8 p-6 ${theme.bgSecondary} rounded-2xl border ${theme.border}`}>
            <h3 className={`${theme.textSecondary} text-sm font-semibold mb-4 uppercase tracking-wide`}>Facets</h3>
            <div className="flex gap-3 flex-wrap">
              {['work', 'friends', 'public'].map((f) => (
                <button key={f} className={`px-5 py-3 ${theme.bgTertiary} ${theme.hover} rounded-xl ${theme.text} font-medium`}>{f}@{profile.handle}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ✅ NEW: Messages View
  const MessagesView = () => (
    <div className={`min-h-full ${theme.bg} flex`}>
      {/* Thread List */}
      <div className={`w-full md:w-80 ${theme.bgSecondary} border-r ${theme.border} ${selectedConversation ? 'hidden md:block' : ''}`}>
        <div className={`p-4 border-b ${theme.border}`}>
          <h2 className={`text-xl font-bold ${theme.text}`}>Messages</h2>
          <p className={`${theme.textSecondary} text-sm`}>
            {inboxMessages.length} conversation{inboxMessages.length !== 1 ? 's' : ''}
          </p>
        </div>

        {inboxLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="text-cyan-500 animate-spin" />
          </div>
        ) : inboxMessages.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Inbox size={32} className="text-gray-400" />
            </div>
            <h3 className={`${theme.text} font-semibold mb-2`}>No messages yet</h3>
            <p className={`${theme.textSecondary} text-sm`}>
              Messages you receive will appear here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {inboxMessages.map((conv) => (
              <button
                key={conv.publicKey}
                onClick={() => loadConversation(conv.publicKey, conv.handle)}
                className={`w-full p-4 text-left ${theme.hover} transition-colors ${selectedConversation?.publicKey === conv.publicKey ? 'bg-cyan-50' : ''
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                    {conv.handle[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold ${theme.text} truncate`}>
                        @{conv.handle}
                      </span>
                      <span className={`text-xs ${theme.textMuted}`}>
                        {formatTime(conv.lastMessage?.created_at)}
                      </span>
                    </div>
                    <p className={`${theme.textSecondary} text-sm truncate`}>
                      {parseMessageContent(conv.lastMessage)}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-cyan-500 text-white text-xs rounded-full">
                        {conv.unreadCount} new
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Conversation View */}
      <div className={`flex-1 flex flex-col ${!selectedConversation ? 'hidden md:flex' : ''}`}>
        {selectedConversation ? (
          <>
            {/* Conversation Header */}
            <div className={`p-4 border-b ${theme.border} ${theme.bgSecondary} flex items-center gap-3`}>
              <button
                onClick={() => setSelectedConversation(null)}
                className={`md:hidden p-2 ${theme.hover} rounded`}
              >
                <ChevronLeft size={20} />
              </button>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white font-bold">
                {selectedConversation.handle[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1">
                <h3 className={`font-semibold ${theme.text}`}>@{selectedConversation.handle}</h3>
                <p className={`text-xs ${theme.textMuted} font-mono`}>
                  {selectedConversation.publicKey.substring(0, 16)}...
                </p>
              </div>
              <button
                onClick={() => {
                  // Try to view profile
                  fetchProfile(selectedConversation.handle);
                }}
                className={`p-2 ${theme.hover} rounded ${theme.textSecondary}`}
                title="View Profile"
              >
                <User size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className={`flex-1 overflow-auto p-4 space-y-4 ${theme.bg}`}>
              {conversationMessages.length === 0 ? (
                <div className="text-center py-12">
                  <p className={theme.textSecondary}>No messages in this conversation</p>
                </div>
              ) : (
                conversationMessages.map((msg, i) => {
                  const isOutgoing = msg.isOutgoing || msg.from_pk === authUser?.publicKey;
                  return (
                    <div key={msg.id || i} className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${isOutgoing
                        ? 'bg-cyan-500 text-white rounded-br-md'
                        : `${theme.bgSecondary} ${theme.text} rounded-bl-md border ${theme.border}`
                        }`}>
                        <p className="break-words">{parseMessageContent(msg)}</p>
                        <p className={`text-xs mt-1 ${isOutgoing ? 'text-cyan-100' : theme.textMuted}`}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply Input */}
            <div className={`p-4 border-t ${theme.border} ${theme.bgSecondary}`}>
              <div className="flex items-end gap-3">
                <textarea
                  ref={replyRef}
                  placeholder="Type a message..."
                  rows={1}
                  className={`flex-1 p-3 ${theme.bgTertiary} ${theme.text} rounded-xl border ${theme.border} focus:border-cyan-500 outline-none resize-none placeholder-gray-400`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                />
                <button
                  onClick={handleSendReply}
                  className="p-3 bg-cyan-500 hover:bg-cyan-600 rounded-xl text-white"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle size={40} className="text-gray-400" />
              </div>
              <h3 className={`${theme.text} text-xl font-semibold mb-2`}>Select a conversation</h3>
              <p className={theme.textSecondary}>Choose a conversation from the list to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Search Results
  const SearchResultsView = () => (
    <div className={`min-h-full ${theme.bg} px-4 py-8`}>
      <div className="max-w-2xl mx-auto">
        <h2 className={`text-xl ${theme.text} font-semibold mb-6`}>
          {searchResults.length > 0 ? `Results for "${addressBar}"` : `No results for "${addressBar}"`}
        </h2>
        {searchResults.length > 0 ? (
          <div className="space-y-4">
            {searchResults.map((r, i) => (
              <button key={i} onClick={() => fetchProfile(r.handle)} className={`w-full p-4 ${theme.bgSecondary} border ${theme.border} rounded-xl flex items-center gap-4 ${theme.hover} text-left`}>
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-2xl">{r.avatar || '👤'}</div>
                <div><div className={`${theme.text} font-semibold`}>{r.name}</div><div className="text-cyan-500">@{r.handle}</div></div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <p className={theme.textSecondary}>No identities found</p>
            <button onClick={goHome} className="mt-6 px-6 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-full text-white font-medium">Back to Search</button>
          </div>
        )}
      </div>
    </div>
  );

  // Not Found
  const NotFoundView = () => (
    <div className={`min-h-full ${theme.bg} flex flex-col items-center justify-center px-4`}>
      <div className="text-7xl mb-6">🔍</div>
      <h2 className={`text-2xl ${theme.text} font-semibold mb-2`}>No identity found for "{addressBar}"</h2>
      <p className={`${theme.textSecondary} mb-8`}>{error || "This @handle hasn't been claimed yet"}</p>
      <button onClick={goHome} className="px-8 py-3 bg-cyan-500 hover:bg-cyan-600 rounded-full text-white font-medium shadow-lg">Back to Search</button>
    </div>
  );

  // Loading
  const LoadingView = () => (
    <div className={`min-h-full ${theme.bg} flex flex-col items-center justify-center`}>
      <Loader2 size={48} className="text-cyan-500 animate-spin mb-4" />
      <p className={theme.textSecondary}>Loading identity...</p>
    </div>
  );



  // Studio View - Creative Space
  const StudioView = () => {
    // If a tool is selected, show that tool's view
    if (studioTool === 'gsite') return <GSiteEditorView />;
    if (studioTool === 'profile') return <ProfileEditorView />;
    if (studioTool === 'facets') return <FacetsManagerView />;
    if (studioTool === 'settings') return <SettingsView />;

    // Otherwise show the dashboard
    return (
      <div className={`min-h-full ${theme.bg} py-8 px-4`}>
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h1 className={`text-2xl font-bold ${theme.text}`}>
                  studio@{authUser?.handle || 'you'}
                </h1>
                <p className={`text-sm ${theme.textSecondary}`}>
                  Your Creative Space
                </p>
              </div>
            </div>
          </div>

          {/* Pro Upgrade Banner */}
          <div className={`mb-8 p-4 rounded-xl bg-gradient-to-r ${darkMode ? 'from-amber-900/30 to-orange-900/30 border-amber-700' : 'from-amber-50 to-orange-50 border-amber-200'} border`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Star className="text-amber-500" size={24} />
                <div>
                  <p className={`font-medium ${theme.text}`}>Upgrade to Pro</p>
                  <p className={`text-sm ${theme.textSecondary}`}>Get analytics, custom domains, and more</p>
                </div>
              </div>
              <button className="px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-medium rounded-lg hover:from-amber-500 hover:to-orange-600 transition-colors">
                Upgrade
              </button>
            </div>
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* GSite Builder */}
            <button
              onClick={() => setStudioTool('gsite')}
              className={`text-left p-6 rounded-2xl ${theme.bgSecondary} border ${theme.border} hover:border-cyan-500 hover:shadow-xl transition-all group`}
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Globe size={28} className="text-white" />
              </div>
              <h3 className={`text-lg font-semibold ${theme.text} mb-1`}>GSite Builder</h3>
              <p className={`text-sm ${theme.textSecondary}`}>Create your professional page with blocks</p>
            </button>

            {/* Edit Profile */}
            <button
              onClick={() => setStudioTool('profile')}
              className={`text-left p-6 rounded-2xl ${theme.bgSecondary} border ${theme.border} hover:border-purple-500 hover:shadow-xl transition-all group`}
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <User size={28} className="text-white" />
              </div>
              <h3 className={`text-lg font-semibold ${theme.text} mb-1`}>Edit Profile</h3>
              <p className={`text-sm ${theme.textSecondary}`}>Photo, bio, display name, and more</p>
            </button>

            {/* Facets Manager */}
            <button
              onClick={() => setStudioTool('facets')}
              className={`text-left p-6 rounded-2xl ${theme.bgSecondary} border ${theme.border} hover:border-green-500 hover:shadow-xl transition-all group`}
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Package size={28} className="text-white" />
              </div>
              <h3 className={`text-lg font-semibold ${theme.text} mb-1`}>Facets Manager</h3>
              <p className={`text-sm ${theme.textSecondary}`}>Create work@, friends@, pro@ identities</p>
            </button>

            {/* Analytics (Pro) */}
            <button className={`text-left p-6 rounded-2xl ${theme.bgSecondary} border ${theme.border} opacity-60 cursor-not-allowed relative`}>
              <div className="absolute top-4 right-4 flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full text-xs font-bold text-white">
                <Star size={12} fill="white" />
                PRO
              </div>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mb-4">
                <Building size={28} className="text-white" />
              </div>
              <h3 className={`text-lg font-semibold ${theme.text} mb-1`}>Analytics</h3>
              <p className={`text-sm ${theme.textSecondary}`}>Views, clicks, visitors, and trends</p>
            </button>

            {/* Custom Domains (Pro) */}
            <button className={`text-left p-6 rounded-2xl ${theme.bgSecondary} border ${theme.border} opacity-60 cursor-not-allowed relative`}>
              <div className="absolute top-4 right-4 flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full text-xs font-bold text-white">
                <Star size={12} fill="white" />
                PRO
              </div>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center mb-4">
                <ExternalLink size={28} className="text-white" />
              </div>
              <h3 className={`text-lg font-semibold ${theme.text} mb-1`}>Custom Domains</h3>
              <p className={`text-sm ${theme.textSecondary}`}>Connect yourname.com to your GSite</p>
            </button>

            {/* Settings */}
            <button
              onClick={() => setStudioTool('settings')}
              className={`text-left p-6 rounded-2xl ${theme.bgSecondary} border ${theme.border} hover:border-gray-400 hover:shadow-xl transition-all group`}
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gray-500 to-slate-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Menu size={28} className="text-white" />
              </div>
              <h3 className={`text-lg font-semibold ${theme.text} mb-1`}>Settings</h3>
              <p className={`text-sm ${theme.textSecondary}`}>Privacy, security, and preferences</p>
            </button>
          </div>

          {/* Create GSite CTA */}
          <div className={`mt-8 rounded-xl border ${theme.border} ${theme.bgSecondary} p-6`}>
            <div className="text-center py-8">
              <Globe size={48} className={`mx-auto ${theme.textMuted} mb-4`} />
              <p className={theme.textSecondary}>Create your GSite to start building your professional presence</p>
              <button
                onClick={() => setStudioTool('gsite')}
                className="mt-4 px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:from-cyan-400 hover:to-blue-400 transition-colors"
              >
                Create GSite
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // 1. GSITE EDITOR VIEW
  // ==========================================
  const GSiteEditorView = () => {
    const [selectedBlock, setSelectedBlock] = useState(null);
    const [showBlockPicker, setShowBlockPicker] = useState(false);
    const [previewMode, setPreviewMode] = useState('desktop');
    const [hasChanges, setHasChanges] = useState(false);

    const blockTypes = [
      { type: 'text', icon: Type, label: 'Text', description: 'Heading, paragraph, or quote', color: 'blue' },
      { type: 'media', icon: Image, label: 'Media', description: 'Image, gallery, or video', color: 'purple' },
      { type: 'link', icon: Link2, label: 'Link', description: 'Smart link with preview', color: 'cyan' },
      { type: 'list', icon: List, label: 'List', description: 'Skills, services, features', color: 'green' },
    ];

    const addBlock = (type) => {
      const newBlock = {
        id: `block_${Date.now()}`,
        type,
        content: type === 'text' ? '' : type === 'list' ? [] : null,
        variant: type === 'text' ? 'paragraph' : 'default',
      };
      setGsiteData(prev => ({
        ...prev,
        blocks: [...prev.blocks, newBlock],
      }));
      setSelectedBlock(newBlock.id);
      setShowBlockPicker(false);
      setHasChanges(true);
    };

    const updateBlock = (blockId, updates) => {
      setGsiteData(prev => ({
        ...prev,
        blocks: prev.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b),
      }));
      setHasChanges(true);
    };

    const deleteBlock = (blockId) => {
      setGsiteData(prev => ({
        ...prev,
        blocks: prev.blocks.filter(b => b.id !== blockId),
      }));
      if (selectedBlock === blockId) setSelectedBlock(null);
      setHasChanges(true);
    };

    const moveBlock = (index, direction) => {
      setGsiteData(prev => {
        const newBlocks = [...prev.blocks];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= newBlocks.length) return prev;
        [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
        return { ...prev, blocks: newBlocks };
      });
      setHasChanges(true);
    };

    const handleSave = () => {
      localStorage.setItem(`gsite_${authUser?.handle}`, JSON.stringify(gsiteData));
      setHasChanges(false);
      alert('GSite saved to draft!');
    };

    const handlePublish = () => {
      // TODO: Mobile signing flow
      alert('Publishing requires mobile app approval. Coming soon!');
    };

    // Block Picker Modal
    const BlockPickerModal = () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowBlockPicker(false)} />
        <div className={`relative w-full max-w-md rounded-2xl shadow-2xl ${theme.bgSecondary} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${theme.text}`}>Add Block</h3>
            <button onClick={() => setShowBlockPicker(false)} className={`p-2 rounded-lg ${theme.hover}`}>
              <X size={20} className={theme.textSecondary} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {blockTypes.map(block => (
              <button
                key={block.type}
                onClick={() => addBlock(block.type)}
                className={`p-4 rounded-xl border ${theme.border} ${theme.hover} text-left transition-all hover:shadow-md`}
              >
                <block.icon size={24} className="text-cyan-500 mb-2" />
                <h4 className={`font-medium ${theme.text}`}>{block.label}</h4>
                <p className={`text-xs ${theme.textSecondary}`}>{block.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );

    // Render a block
    const renderBlock = (block, index) => {
      const isSelected = selectedBlock === block.id;

      return (
        <div
          key={block.id}
          onClick={() => setSelectedBlock(block.id)}
          className={`group relative p-4 rounded-xl transition-all ${isSelected
              ? 'ring-2 ring-cyan-500 ring-offset-2'
              : `${theme.hover} hover:ring-2 hover:ring-gray-300`
            } ${darkMode ? 'ring-offset-gray-900' : 'ring-offset-white'}`}
        >
          {/* Block Controls */}
          <div className={`absolute -right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
            <button
              onClick={(e) => { e.stopPropagation(); moveBlock(index, 'up'); }}
              disabled={index === 0}
              className={`p-1.5 rounded-lg ${theme.bgSecondary} border ${theme.border} shadow-sm disabled:opacity-30`}
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); moveBlock(index, 'down'); }}
              disabled={index === gsiteData.blocks.length - 1}
              className={`p-1.5 rounded-lg ${theme.bgSecondary} border ${theme.border} shadow-sm disabled:opacity-30`}
            >
              <ChevronDown size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
              className={`p-1.5 rounded-lg ${theme.bgSecondary} border ${theme.border} shadow-sm hover:bg-red-100 hover:border-red-300 hover:text-red-500`}
            >
              <Trash2 size={14} />
            </button>
          </div>

          {/* Block Content */}
          {block.type === 'text' && (
            <textarea
              value={block.content || ''}
              onChange={(e) => updateBlock(block.id, { content: e.target.value })}
              placeholder={block.variant === 'heading' ? 'Enter heading...' : 'Write your content...'}
              className={`w-full bg-transparent resize-none focus:outline-none ${block.variant === 'heading'
                  ? `text-2xl font-bold ${theme.text}`
                  : `${theme.text}`
                }`}
              rows={block.variant === 'heading' ? 1 : 3}
            />
          )}

          {block.type === 'media' && (
            <div className={`border-2 border-dashed ${theme.border} rounded-xl p-8 text-center`}>
              <Image size={32} className={`mx-auto ${theme.textMuted} mb-2`} />
              <p className={theme.textSecondary}>Click to upload image</p>
            </div>
          )}

          {block.type === 'link' && (
            <input
              type="url"
              value={block.content || ''}
              onChange={(e) => updateBlock(block.id, { content: e.target.value })}
              placeholder="Paste a URL..."
              className={`w-full p-3 rounded-lg border ${theme.border} bg-transparent ${theme.text} focus:outline-none focus:border-cyan-500`}
            />
          )}

          {block.type === 'list' && (
            <div className="space-y-2">
              {(block.content || []).map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-cyan-500">•</span>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const newItems = [...(block.content || [])];
                      newItems[i] = e.target.value;
                      updateBlock(block.id, { content: newItems });
                    }}
                    className={`flex-1 bg-transparent ${theme.text} focus:outline-none`}
                    placeholder="List item..."
                  />
                </div>
              ))}
              <button
                onClick={() => updateBlock(block.id, { content: [...(block.content || []), ''] })}
                className={`text-sm ${theme.textSecondary} hover:text-cyan-500 flex items-center gap-1`}
              >
                <Plus size={14} /> Add item
              </button>
            </div>
          )}
        </div>
      );
    };

    return (
      <div className={`min-h-full ${theme.bg}`}>
        {/* Header */}
        <header className={`sticky top-0 z-40 ${theme.bgSecondary} border-b ${theme.border}`}>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <button onClick={() => setStudioTool(null)} className={`p-2 ${theme.hover} rounded-lg`}>
                <ArrowLeft size={20} className={theme.textSecondary} />
              </button>
              <div>
                <h1 className={`font-semibold ${theme.text}`}>GSite Builder</h1>
                <p className={`text-xs ${theme.textSecondary}`}>
                  {hasChanges ? 'Unsaved changes' : gsiteData.published ? 'Published' : 'Draft'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={!hasChanges}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${hasChanges ? `${theme.bgTertiary} ${theme.hover}` : 'opacity-50 cursor-not-allowed'
                  } ${theme.text}`}
              >
                <Save size={18} />
                <span className="text-sm hidden sm:inline">Save</span>
              </button>
              <button
                onClick={handlePublish}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-400 hover:to-blue-400"
              >
                <Eye size={18} />
                <span className="text-sm font-medium">Publish</span>
              </button>
            </div>
          </div>
        </header>

        {/* Editor */}
        <div className="max-w-3xl mx-auto p-4 md:p-8">
          <div className={`rounded-2xl ${theme.bgSecondary} border ${theme.border} shadow-sm overflow-hidden`}>
            <div className="p-6 md:p-8 space-y-4">
              {/* Title */}
              <input
                type="text"
                value={gsiteData.title}
                onChange={(e) => { setGsiteData(prev => ({ ...prev, title: e.target.value })); setHasChanges(true); }}
                placeholder="Your GSite title..."
                className={`w-full text-2xl font-bold bg-transparent ${theme.text} focus:outline-none`}
              />

              {/* Blocks */}
              {gsiteData.blocks.length === 0 ? (
                <div className="text-center py-12">
                  <Globe size={48} className={`mx-auto ${theme.textMuted} mb-4`} />
                  <h3 className={`text-lg font-medium ${theme.text} mb-2`}>Start building your GSite</h3>
                  <p className={`${theme.textSecondary} mb-6`}>Add blocks to create your professional page</p>
                  <button
                    onClick={() => setShowBlockPicker(true)}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl"
                  >
                    Add Your First Block
                  </button>
                </div>
              ) : (
                <>
                  {gsiteData.blocks.map((block, index) => renderBlock(block, index))}
                  <button
                    onClick={() => setShowBlockPicker(true)}
                    className={`w-full py-6 border-2 border-dashed ${theme.border} rounded-xl hover:border-cyan-500 hover:bg-cyan-50/10 transition-colors group`}
                  >
                    <Plus size={24} className={`mx-auto ${theme.textMuted} group-hover:text-cyan-500`} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {showBlockPicker && <BlockPickerModal />}
      </div>
    );
  };

  // ==========================================
  // 2. PROFILE EDITOR VIEW
  // ==========================================
  const ProfileEditorView = () => {
    const [localProfile, setLocalProfile] = useState({
      displayName: authUser?.handle || '',
      bio: '',
      avatar: null,
      location: '',
      website: '',
    });
    const [hasChanges, setHasChanges] = useState(false);

    const updateField = (field, value) => {
      setLocalProfile(prev => ({ ...prev, [field]: value }));
      setHasChanges(true);
    };

    const handleSave = () => {
      setProfileData(localProfile);
      localStorage.setItem(`profile_${authUser?.handle}`, JSON.stringify(localProfile));
      setHasChanges(false);
      alert('Profile saved!');
    };

    return (
      <div className={`min-h-full ${theme.bg}`}>
        {/* Header */}
        <header className={`sticky top-0 z-40 ${theme.bgSecondary} border-b ${theme.border}`}>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <button onClick={() => setStudioTool(null)} className={`p-2 ${theme.hover} rounded-lg`}>
                <ArrowLeft size={20} className={theme.textSecondary} />
              </button>
              <div>
                <h1 className={`font-semibold ${theme.text}`}>Edit Profile</h1>
                <p className={`text-xs ${theme.textSecondary}`}>@{authUser?.handle}</p>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={`px-4 py-2 rounded-lg font-medium ${hasChanges
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : `${theme.bgTertiary} ${theme.textMuted} cursor-not-allowed`
                }`}
            >
              Save Changes
            </button>
          </div>
        </header>

        {/* Editor */}
        <div className="max-w-2xl mx-auto p-4 md:p-8">
          {/* Avatar Section */}
          <div className={`${theme.bgSecondary} border ${theme.border} rounded-2xl p-6 mb-6`}>
            <h3 className={`font-semibold ${theme.text} mb-4`}>Profile Photo</h3>
            <div className="flex items-center gap-6">
              <div className={`w-24 h-24 rounded-full ${theme.bgTertiary} border-2 ${theme.border} flex items-center justify-center overflow-hidden`}>
                {localProfile.avatar ? (
                  <img src={localProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={40} className={theme.textMuted} />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium flex items-center gap-2">
                  <Camera size={18} />
                  Upload Photo
                </button>
                <p className={`text-xs ${theme.textSecondary}`}>JPG, PNG. Max 5MB</p>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className={`${theme.bgSecondary} border ${theme.border} rounded-2xl p-6 mb-6`}>
            <h3 className={`font-semibold ${theme.text} mb-4`}>Basic Information</h3>
            <div className="space-y-4">
              <div>
                <label className={`text-sm font-medium ${theme.textSecondary} block mb-2`}>Display Name</label>
                <input
                  type="text"
                  value={localProfile.displayName}
                  onChange={(e) => updateField('displayName', e.target.value)}
                  placeholder="Your name"
                  className={`w-full px-4 py-3 rounded-xl border ${theme.border} bg-transparent ${theme.text} focus:outline-none focus:border-purple-500`}
                />
              </div>
              <div>
                <label className={`text-sm font-medium ${theme.textSecondary} block mb-2`}>Bio</label>
                <textarea
                  value={localProfile.bio}
                  onChange={(e) => updateField('bio', e.target.value)}
                  placeholder="Tell the world about yourself..."
                  rows={3}
                  className={`w-full px-4 py-3 rounded-xl border ${theme.border} bg-transparent ${theme.text} focus:outline-none focus:border-purple-500 resize-none`}
                />
                <p className={`text-xs ${theme.textSecondary} mt-1`}>{localProfile.bio.length}/160 characters</p>
              </div>
              <div>
                <label className={`text-sm font-medium ${theme.textSecondary} block mb-2`}>Location</label>
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${theme.border}`}>
                  <MapPin size={18} className={theme.textMuted} />
                  <input
                    type="text"
                    value={localProfile.location}
                    onChange={(e) => updateField('location', e.target.value)}
                    placeholder="City, Country"
                    className={`flex-1 bg-transparent ${theme.text} focus:outline-none`}
                  />
                </div>
              </div>
              <div>
                <label className={`text-sm font-medium ${theme.textSecondary} block mb-2`}>Website</label>
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${theme.border}`}>
                  <Globe size={18} className={theme.textMuted} />
                  <input
                    type="url"
                    value={localProfile.website}
                    onChange={(e) => updateField('website', e.target.value)}
                    placeholder="https://yourwebsite.com"
                    className={`flex-1 bg-transparent ${theme.text} focus:outline-none`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* GNS Handle (Read-only) */}
          <div className={`${theme.bgSecondary} border ${theme.border} rounded-2xl p-6`}>
            <h3 className={`font-semibold ${theme.text} mb-4`}>GNS Identity</h3>
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${theme.bgTertiary}`}>
              <AtSign size={18} className="text-cyan-500" />
              <span className={`font-medium ${theme.text}`}>{authUser?.handle}</span>
              <span className={`text-xs px-2 py-1 rounded-full bg-green-100 text-green-600`}>Verified</span>
            </div>
            <p className={`text-xs ${theme.textSecondary} mt-2`}>Your @handle is permanent and cryptographically linked to your identity</p>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // 3. FACETS MANAGER VIEW
  // ==========================================
  const FacetsManagerView = () => {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newFacetName, setNewFacetName] = useState('');
    const [localFacets, setLocalFacets] = useState([
      { id: 'public', name: 'public', description: 'Default public facet', isDefault: true, contacts: 0 },
    ]);

    const createFacet = () => {
      if (!newFacetName.trim()) return;
      const newFacet = {
        id: `facet_${Date.now()}`,
        name: newFacetName.toLowerCase().replace(/\s+/g, '_'),
        description: '',
        isDefault: false,
        contacts: 0,
      };
      setLocalFacets(prev => [...prev, newFacet]);
      setNewFacetName('');
      setShowCreateModal(false);
    };

    const deleteFacet = (id) => {
      if (localFacets.find(f => f.id === id)?.isDefault) {
        alert('Cannot delete default facet');
        return;
      }
      setLocalFacets(prev => prev.filter(f => f.id !== id));
    };

    return (
      <div className={`min-h-full ${theme.bg}`}>
        {/* Header */}
        <header className={`sticky top-0 z-40 ${theme.bgSecondary} border-b ${theme.border}`}>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <button onClick={() => setStudioTool(null)} className={`p-2 ${theme.hover} rounded-lg`}>
                <ArrowLeft size={20} className={theme.textSecondary} />
              </button>
              <div>
                <h1 className={`font-semibold ${theme.text}`}>Facets Manager</h1>
                <p className={`text-xs ${theme.textSecondary}`}>Manage your identity facets</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium flex items-center gap-2"
            >
              <Plus size={18} />
              New Facet
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="max-w-2xl mx-auto p-4 md:p-8">
          {/* Explanation */}
          <div className={`${theme.bgSecondary} border ${theme.border} rounded-2xl p-6 mb-6`}>
            <h3 className={`font-semibold ${theme.text} mb-2`}>What are Facets?</h3>
            <p className={`${theme.textSecondary} text-sm`}>
              Facets let you share different aspects of your identity with different people.
              Create a <span className="text-green-500 font-medium">work@</span> facet for professional contacts,
              a <span className="text-purple-500 font-medium">friends@</span> facet for personal connections,
              or a <span className="text-cyan-500 font-medium">pro@</span> facet for your premium content.
            </p>
          </div>

          {/* Facets List */}
          <div className="space-y-4">
            {localFacets.map(facet => (
              <div key={facet.id} className={`${theme.bgSecondary} border ${theme.border} rounded-2xl p-6`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${facet.isDefault ? 'bg-cyan-500' : 'bg-green-500'} flex items-center justify-center`}>
                      <Package size={24} className="text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold ${theme.text}`}>{facet.name}@{authUser?.handle}</h3>
                        {facet.isDefault && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-600">Default</span>
                        )}
                      </div>
                      <p className={`text-sm ${theme.textSecondary}`}>{facet.contacts} contacts</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className={`p-2 ${theme.hover} rounded-lg`}>
                      <Edit2 size={18} className={theme.textSecondary} />
                    </button>
                    {!facet.isDefault && (
                      <button
                        onClick={() => deleteFacet(facet.id)}
                        className={`p-2 ${theme.hover} rounded-lg hover:text-red-500`}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
            <div className={`relative w-full max-w-md rounded-2xl shadow-2xl ${theme.bgSecondary} p-6`}>
              <h3 className={`text-lg font-semibold ${theme.text} mb-4`}>Create New Facet</h3>
              <div className="mb-4">
                <label className={`text-sm ${theme.textSecondary} block mb-2`}>Facet Name</label>
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${theme.border}`}>
                  <input
                    type="text"
                    value={newFacetName}
                    onChange={(e) => setNewFacetName(e.target.value)}
                    placeholder="work, friends, pro..."
                    className={`flex-1 bg-transparent ${theme.text} focus:outline-none`}
                  />
                  <span className={theme.textSecondary}>@{authUser?.handle}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className={`flex-1 px-4 py-2 ${theme.bgTertiary} ${theme.hover} rounded-lg ${theme.text}`}
                >
                  Cancel
                </button>
                <button
                  onClick={createFacet}
                  disabled={!newFacetName.trim()}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // 4. SETTINGS VIEW
  // ==========================================
  const SettingsView = () => {
    const [localSettings, setLocalSettings] = useState({
      notifications: true,
      privateMode: false,
      theme: darkMode ? 'dark' : 'light',
      language: 'en',
    });

    const updateSetting = (key, value) => {
      setLocalSettings(prev => ({ ...prev, [key]: value }));
      if (key === 'theme') {
        setDarkMode(value === 'dark');
      }
    };

    const SettingToggle = ({ label, description, checked, onChange }) => (
      <div className={`flex items-center justify-between py-4 border-b ${theme.border} last:border-0`}>
        <div>
          <h4 className={`font-medium ${theme.text}`}>{label}</h4>
          <p className={`text-sm ${theme.textSecondary}`}>{description}</p>
        </div>
        <button
          onClick={() => onChange(!checked)}
          className={`w-12 h-7 rounded-full transition-colors ${checked ? 'bg-cyan-500' : theme.bgTertiary}`}
        >
          <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
    );

    return (
      <div className={`min-h-full ${theme.bg}`}>
        {/* Header */}
        <header className={`sticky top-0 z-40 ${theme.bgSecondary} border-b ${theme.border}`}>
          <div className="flex items-center gap-4 px-4 py-3">
            <button onClick={() => setStudioTool(null)} className={`p-2 ${theme.hover} rounded-lg`}>
              <ArrowLeft size={20} className={theme.textSecondary} />
            </button>
            <div>
              <h1 className={`font-semibold ${theme.text}`}>Settings</h1>
              <p className={`text-xs ${theme.textSecondary}`}>Privacy, security, and preferences</p>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="max-w-2xl mx-auto p-4 md:p-8">
          {/* Appearance */}
          <div className={`${theme.bgSecondary} border ${theme.border} rounded-2xl p-6 mb-6`}>
            <div className="flex items-center gap-3 mb-4">
              <Palette size={20} className="text-purple-500" />
              <h3 className={`font-semibold ${theme.text}`}>Appearance</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className={`text-sm ${theme.textSecondary} block mb-2`}>Theme</label>
                <div className="flex gap-2">
                  {['light', 'dark', 'system'].map(t => (
                    <button
                      key={t}
                      onClick={() => updateSetting('theme', t)}
                      className={`px-4 py-2 rounded-lg capitalize ${localSettings.theme === t
                          ? 'bg-cyan-500 text-white'
                          : `${theme.bgTertiary} ${theme.text}`
                        }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className={`${theme.bgSecondary} border ${theme.border} rounded-2xl p-6 mb-6`}>
            <div className="flex items-center gap-3 mb-4">
              <Bell size={20} className="text-orange-500" />
              <h3 className={`font-semibold ${theme.text}`}>Notifications</h3>
            </div>
            <SettingToggle
              label="Push Notifications"
              description="Receive notifications for messages and updates"
              checked={localSettings.notifications}
              onChange={(v) => updateSetting('notifications', v)}
            />
          </div>

          {/* Privacy */}
          <div className={`${theme.bgSecondary} border ${theme.border} rounded-2xl p-6 mb-6`}>
            <div className="flex items-center gap-3 mb-4">
              <Lock size={20} className="text-green-500" />
              <h3 className={`font-semibold ${theme.text}`}>Privacy</h3>
            </div>
            <SettingToggle
              label="Private Mode"
              description="Hide your profile from public search"
              checked={localSettings.privateMode}
              onChange={(v) => updateSetting('privateMode', v)}
            />
          </div>

          {/* Security */}
          <div className={`${theme.bgSecondary} border ${theme.border} rounded-2xl p-6 mb-6`}>
            <div className="flex items-center gap-3 mb-4">
              <Shield size={20} className="text-cyan-500" />
              <h3 className={`font-semibold ${theme.text}`}>Security</h3>
            </div>
            <div className="space-y-4">
              <div className={`flex items-center justify-between py-3`}>
                <div>
                  <h4 className={`font-medium ${theme.text}`}>Connected Devices</h4>
                  <p className={`text-sm ${theme.textSecondary}`}>Manage devices with access to your identity</p>
                </div>
                <button className={`px-4 py-2 ${theme.bgTertiary} ${theme.hover} rounded-lg ${theme.text}`}>
                  Manage
                </button>
              </div>
              <div className={`flex items-center justify-between py-3 border-t ${theme.border}`}>
                <div>
                  <h4 className={`font-medium ${theme.text}`}>Export Identity</h4>
                  <p className={`text-sm ${theme.textSecondary}`}>Download your GNS identity backup</p>
                </div>
                <button className={`px-4 py-2 ${theme.bgTertiary} ${theme.hover} rounded-lg ${theme.text}`}>
                  Export
                </button>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className={`border border-red-200 dark:border-red-800 rounded-2xl p-6`}>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={20} className="text-red-500" />
              <h3 className={`font-semibold text-red-500`}>Danger Zone</h3>
            </div>
            <div className={`flex items-center justify-between`}>
              <div>
                <h4 className={`font-medium ${theme.text}`}>Sign Out Everywhere</h4>
                <p className={`text-sm ${theme.textSecondary}`}>End all active sessions on all devices</p>
              </div>
              <button className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg">
                Sign Out All
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Sign In Modal
  const SignInModal = () => (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowSignIn(false)}>
      <div className={`${theme.bgSecondary} rounded-3xl p-8 max-w-sm w-full shadow-2xl relative border ${theme.border}`} onClick={e => e.stopPropagation()}>
        <button onClick={() => setShowSignIn(false)} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full">
          <X size={20} className={theme.textMuted} />
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-cyan-100 dark:bg-cyan-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <User size={32} className="text-cyan-600 dark:text-cyan-400" />
          </div>
          <h2 className={`text-2xl font-bold ${theme.text}`}>Welcome Back</h2>
          <p className={theme.textSecondary}>Sign in to access your digital identity</p>
        </div>

        {/* Use the new QRLoginModal instead of manual handle entry */}
        <button
          onClick={() => {
            setShowSignIn(false);
            setShowQRLogin(true);
          }}
          className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:from-cyan-400 hover:to-blue-400 transition-all flex items-center justify-center gap-2 mb-4"
        >
          <Smartphone size={20} />
          Sign in with Mobile App
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className={`w-full border-t ${theme.border}`}></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className={`px-2 ${theme.bgSecondary} ${theme.textMuted}`}>Or continue as guest</span>
          </div>
        </div>

        <button
          onClick={() => setShowSignIn(false)}
          className={`w-full py-3 border ${theme.border} ${theme.text} font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all`}
        >
          Continue Browsing
        </button>
      </div>
    </div>
  );

  // Message Modal
  const MessageModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`${theme.bgSecondary} rounded-2xl w-full max-w-md p-6 shadow-2xl`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-bold ${theme.text}`}>Send Message</h3>
          <button onClick={() => setShowMessageModal(false)}>
            <X className={theme.text} />
          </button>
        </div>
        <div className="mb-4">
          <p className={`text-sm ${theme.textMuted} mb-2`}>To: <span className="font-semibold text-cyan-500">@{messageRecipient}</span></p>
          <textarea
            ref={messageRef}
            className={`w-full h-32 p-3 rounded-lg ${theme.bg} ${theme.text} border ${theme.border} resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500`}
            placeholder="Type your message..."
          ></textarea>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={() => setShowMessageModal(false)} className={`px-4 py-2 rounded-lg ${theme.textSecondary} hover:bg-gray-100`}>
            Cancel
          </button>
          <button
            onClick={() => handleSendMessage(messageRecipient, messageRef.current.value)}
            disabled={sendingMessage}
            className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-medium hover:from-cyan-400 hover:to-blue-400 flex items-center gap-2"
          >
            {sendingMessage ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            Send
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`h-screen flex flex-col ${theme.bg} ${theme.text}`}>
      <BrowserChrome />
      <div className="flex-1 overflow-auto">
        {isLoading && currentView !== 'home' && currentView !== 'messages' && currentView !== 'studio' && <LoadingView />}
        {!isLoading && currentView === 'home' && <HomePage />}
        {!isLoading && currentView === 'profile' && currentProfile && <ProfileView profile={currentProfile} />}
        {!isLoading && currentView === 'search-results' && <SearchResultsView />}
        {!isLoading && currentView === 'not-found' && <NotFoundView />}
        {currentView === 'messages' && <MessagesView />}
        {currentView === 'studio' && <StudioView />}
      </div>
      {showSignIn && <SignInModal />}
      {showMessageModal && <MessageModal />}
      {showQRLogin && (
        <QRLoginModal
          isOpen={showQRLogin}
          onClose={() => setShowQRLogin(false)}
          onSuccess={(session, syncedMessages) => {
            console.log('🎉 Login successful!', session.handle);
            setAuthUser(session);
            setShowQRLogin(false);

            // Initial WS connection
            wsService.connect(session.publicKey, session.sessionToken);

            // Handle synced messages if provided
            if (syncedMessages && syncedMessages.conversations) {
              console.log(`📦 Processing ${syncedMessages.conversations.length} synced conversations`);
              // We could merge them into state here or just let the localStorage logic handle it on next load
              // For now, let's force an inbox refresh
              setTimeout(() => loadInbox(), 500);
            }
          }}
          darkMode={darkMode}
        />
      )}

      {/* Incoming Message Toast */}
      {incomingMessage && (
        <div className="fixed top-20 right-4 max-w-sm w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-4 border-l-4 border-cyan-500 animate-slide-in pointer-events-auto z-50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          onClick={() => {
            // Open conversation
            setIncomingMessage(null);
            openMessages();
            loadConversation(incomingMessage.fromPk, incomingMessage.from);
          }}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center flex-shrink-0">
              <MessageCircle size={20} className="text-cyan-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-gray-900 dark:text-white truncate">@{incomingMessage.from}</h4>
                <span className="text-xs text-gray-400">now</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mt-1">
                {incomingMessage.text}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
