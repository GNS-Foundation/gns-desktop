// ═══════════════════════════════════════════════════════════════════
// PANTHERA v2 — Thread List View
// ═══════════════════════════════════════════════════════════════════
// Location: packages/ui/src/components/panthera/ThreadListView.tsx
//
// Shows list of conversations (threads). Each thread shows:
//   - Contact handle / display name
//   - Last message preview
//   - Timestamp
//   - Unread count
//   - Online status indicator
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle, Search, PenSquare, Loader2,
  Wifi, WifiOff, Smartphone, RefreshCw,
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import { fetchInbox, realtime } from './MessagingService';
import type { Thread } from './MessagingService';

interface ThreadListViewProps {
  onSelectThread: (publicKey: string, handle?: string) => void;
  onNewMessage: () => void;
  darkMode?: boolean;
}

export default function ThreadListView({ onSelectThread, onNewMessage, darkMode = false }: ThreadListViewProps) {
  const auth = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [mobileOnline, setMobileOnline] = useState(false);

  // ─── Load inbox ───
  const loadInbox = useCallback(async () => {
    if (!auth.isAuthenticated) return;
    setLoading(true);

    const result = await fetchInbox(50);

    if (result.success && result.messages.length > 0) {
      // Group messages into threads by conversation partner
      const threadMap = new Map<string, Thread>();

      for (const msg of result.messages) {
        const myPk = auth.publicKey?.toLowerCase();
        const fromPk = (msg.from_pk || msg.fromPublicKey || '').toLowerCase();
        const toPk = (msg.to_pk || msg.toPublicKeys?.[0] || '').toLowerCase();
        const partnerPk = fromPk === myPk ? toPk : fromPk;

        if (!partnerPk) continue;

        const existing = threadMap.get(partnerPk);
        const msgTime = msg.created_at ? new Date(msg.created_at).getTime() : msg.timestamp || 0;

        // Extract preview text
        let preview = msg.decryptedText || msg.text || msg.envelope?.plaintextFallback || '[Encrypted]';
        if (preview.length > 60) preview = preview.substring(0, 60) + '...';

        if (!existing || msgTime > (existing.lastMessageTime || 0)) {
          threadMap.set(partnerPk, {
            publicKey: partnerPk,
            handle: msg.fromHandle || msg.toHandle || msg.handle,
            displayName: msg.fromDisplayName || msg.toDisplayName,
            lastMessage: preview,
            lastMessageTime: msgTime,
            unread: (existing?.unread || 0) + (fromPk !== myPk ? 1 : 0),
          });
        }
      }

      // Sort by most recent
      const sorted = Array.from(threadMap.values())
        .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

      setThreads(sorted);
    } else {
      // Check synced messages from localStorage
      const syncedThreads: Thread[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('gns_synced_')) {
          const pk = key.replace('gns_synced_', '');
          const messages = JSON.parse(localStorage.getItem(key) || '[]');
          if (messages.length > 0) {
            const last = messages[messages.length - 1];
            syncedThreads.push({
              publicKey: pk,
              lastMessage: last.text?.substring(0, 60) || '[Message]',
              lastMessageTime: last.timestamp,
              unread: 0,
            });
          }
        }
      }
      if (syncedThreads.length > 0) {
        setThreads(syncedThreads.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0)));
      }
    }

    setLoading(false);
  }, [auth.isAuthenticated, auth.publicKey]);

  // ─── Connect WebSocket ───
  useEffect(() => {
    if (!auth.isAuthenticated || !auth.session?.sessionToken || !auth.publicKey) return;

    realtime.connect(auth.publicKey, auth.session.sessionToken);

    const offConnected = realtime.on('connected', () => setWsConnected(true));
    const offDisconnected = realtime.on('disconnected', () => setWsConnected(false));
    const offStatus = realtime.on('connectionStatus', (status: any) => {
      setMobileOnline(status?.mobile || false);
    });
    const offMessage = realtime.on('message', () => loadInbox());
    const offSynced = realtime.on('messageSynced', () => loadInbox());

    return () => {
      offConnected();
      offDisconnected();
      offStatus();
      offMessage();
      offSynced();
    };
  }, [auth.isAuthenticated, auth.session, auth.publicKey, loadInbox]);

  // ─── Initial load ───
  useEffect(() => { loadInbox(); }, [loadInbox]);

  // ─── Filter ───
  const filtered = threads.filter(t => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (t.handle?.toLowerCase().includes(q)) ||
           (t.displayName?.toLowerCase().includes(q)) ||
           (t.publicKey.includes(q));
  });

  // ─── Theme ───
  const bg = darkMode ? 'bg-gray-900' : 'bg-white';
  const text = darkMode ? 'text-white' : 'text-gray-900';
  const textSec = darkMode ? 'text-gray-400' : 'text-gray-500';
  const border = darkMode ? 'border-gray-800' : 'border-gray-100';
  const hoverBg = darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50';

  if (!auth.isAuthenticated) {
    return (
      <div className={`flex-1 flex items-center justify-center ${bg}`}>
        <div className="text-center px-8">
          <MessageCircle size={48} className="text-gray-300 mx-auto mb-4" />
          <h2 className={`text-lg font-semibold ${text} mb-2`}>Sign in to message</h2>
          <p className={textSec}>Use the Sign In button to pair with your GNS mobile app.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col ${bg}`}>
      {/* ─── Header ─── */}
      <div className={`px-6 py-4 border-b ${border} flex-shrink-0`}>
        <div className="flex items-center justify-between mb-3">
          <h1 className={`text-xl font-bold ${text}`}>Messages</h1>
          <div className="flex items-center gap-2">
            {/* Connection status */}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
              wsConnected ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
            }`}>
              {wsConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {wsConnected ? 'Live' : 'Offline'}
            </div>
            {mobileOnline && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-cyan-50 text-cyan-600">
                <Smartphone size={12} />
                Mobile
              </div>
            )}
            <button
              onClick={loadInbox}
              className={`p-2 rounded-lg ${hoverBg} ${textSec}`}
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={onNewMessage}
              className="p-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white"
            >
              <PenSquare size={16} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
          darkMode ? 'bg-gray-800' : 'bg-gray-100'
        }`}>
          <Search size={16} className={textSec} />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search conversations..."
            className={`flex-1 bg-transparent outline-none text-sm ${text}`}
          />
        </div>
      </div>

      {/* ─── Thread List ─── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="text-cyan-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <MessageCircle size={40} className="text-gray-300 mx-auto mb-3" />
              <p className={`text-sm ${textSec}`}>
                {searchFilter ? 'No matching conversations' : 'No messages yet'}
              </p>
              <button
                onClick={onNewMessage}
                className="mt-3 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-xl text-white text-sm font-medium"
              >
                Start a conversation
              </button>
            </div>
          </div>
        ) : (
          filtered.map((thread) => (
            <button
              key={thread.publicKey}
              onClick={() => onSelectThread(thread.publicKey, thread.handle)}
              className={`w-full flex items-center gap-3 px-6 py-4 border-b ${border} ${hoverBg} transition-colors text-left`}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white font-bold text-lg">
                  {(thread.handle || thread.publicKey[0] || '?')[0].toUpperCase()}
                </div>
                {thread.isOnline && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`font-semibold text-sm truncate ${text}`}>
                    {thread.handle ? `@${thread.handle}` : `${thread.publicKey.substring(0, 12)}...`}
                  </span>
                  {thread.lastMessageTime && (
                    <span className={`text-xs flex-shrink-0 ml-2 ${textSec}`}>
                      {formatTime(thread.lastMessageTime)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className={`text-sm truncate ${textSec}`}>
                    {thread.lastMessage || 'No messages'}
                  </span>
                  {thread.unread > 0 && (
                    <span className="flex-shrink-0 ml-2 w-5 h-5 rounded-full bg-cyan-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {thread.unread > 9 ? '9+' : thread.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Time formatter ───

function formatTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
