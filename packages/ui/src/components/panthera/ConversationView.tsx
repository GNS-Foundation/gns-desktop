// ═══════════════════════════════════════════════════════════════════
// PANTHERA v2 — Conversation View
// ═══════════════════════════════════════════════════════════════════
// Location: packages/ui/src/components/panthera/ConversationView.tsx
//
// Chat view for a single conversation. Shows:
//   - Message bubbles (incoming left, outgoing right)
//   - Compose area with send button
//   - Typing indicators
//   - Real-time delivery via WebSocket
//   - Auto-scroll to latest message
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, Send, Loader2, Lock, Shield,
  Smartphone, WifiOff, CheckCheck, Check,
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import {
  fetchConversation, sendMessage, resolveRecipient, realtime,
} from './MessagingService';
import type { Message } from './MessagingService';

interface ConversationViewProps {
  partnerPublicKey: string;
  partnerHandle?: string;
  onBack: () => void;
  darkMode?: boolean;
}

export default function ConversationView({
  partnerPublicKey,
  partnerHandle,
  onBack,
  darkMode = false,
}: ConversationViewProps) {
  const auth = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const myPk = auth.publicKey?.toLowerCase() || '';

  // ─── Load conversation ───
  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);

    // 1. Try API first
    const result = await fetchConversation(partnerPublicKey);

    if (result.success && result.messages.length > 0) {
      const mapped: Message[] = result.messages.map((msg: any) => {
        const fromPk = (msg.from_pk || msg.fromPublicKey || '').toLowerCase();
        return {
          id: msg.id || `msg_${msg.timestamp || Date.now()}`,
          text: msg.decryptedText || msg.text || msg.envelope?.plaintextFallback || '[Encrypted message]',
          direction: fromPk === myPk ? 'outgoing' : 'incoming',
          timestamp: msg.created_at ? new Date(msg.created_at).getTime() : msg.timestamp || Date.now(),
          status: msg.status || 'delivered',
          encrypted: !!msg.envelope?.encryptedPayload,
        };
      });

      // Sort chronologically
      mapped.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(mapped);
    } else {
      // 2. Fallback: check synced messages from localStorage
      const synced = realtime.getSyncedMessages(partnerPublicKey);
      if (synced.length > 0) {
        setMessages(synced.map((m: any) => ({
          id: m.id,
          text: m.text || '[Message]',
          direction: m.direction || 'incoming',
          timestamp: m.timestamp || Date.now(),
          status: 'delivered',
          synced: true,
        })));
      }
    }

    setLoading(false);
  }, [partnerPublicKey, myPk]);

  // ─── Initial load ───
  useEffect(() => { loadMessages(); }, [loadMessages]);

  // ─── Real-time messages ───
  useEffect(() => {
    const offMessage = realtime.on('message', (data: any) => {
      const fromPk = (data.from_pk || data.fromPublicKey || '').toLowerCase();
      if (fromPk === partnerPublicKey.toLowerCase() || 
          (data.toPublicKeys || []).some((pk: string) => pk.toLowerCase() === partnerPublicKey.toLowerCase())) {
        const newMsg: Message = {
          id: data.id || `rt_${Date.now()}`,
          text: data.decryptedText || data.text || '[Encrypted]',
          direction: fromPk === myPk ? 'outgoing' : 'incoming',
          timestamp: data.timestamp || Date.now(),
          status: 'delivered',
        };
        setMessages(prev => [...prev, newMsg]);
      }
    });

    const offSynced = realtime.on('messageSynced', (data: any) => {
      if (data.conversationWith?.toLowerCase() === partnerPublicKey.toLowerCase()) {
        const newMsg: Message = {
          id: data.messageId || `sync_${Date.now()}`,
          text: data.decryptedText || '[Message]',
          direction: data.direction || 'incoming',
          timestamp: data.timestamp || Date.now(),
          status: 'delivered',
          synced: true,
        };
        setMessages(prev => {
          if (prev.find(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
    });

    return () => { offMessage(); offSynced(); };
  }, [partnerPublicKey, myPk]);

  // ─── Auto-scroll ───
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Send message ───
  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);

    // Optimistic: add to UI immediately
    const optimisticMsg: Message = {
      id: `opt_${Date.now()}`,
      text,
      direction: 'outgoing',
      timestamp: Date.now(),
      status: 'sent',
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setDraft('');

    const result = await sendMessage(partnerPublicKey, text);

    if (result.success) {
      // Update optimistic message status
      setMessages(prev => prev.map(m =>
        m.id === optimisticMsg.id
          ? { ...m, id: result.messageId || m.id, status: 'delivered' as const }
          : m
      ));
      // Notify mobile
      realtime.notifyMobile(result.messageId || optimisticMsg.id, partnerPublicKey, text);
    } else {
      setMessages(prev => prev.map(m =>
        m.id === optimisticMsg.id ? { ...m, status: 'failed' as const } : m
      ));
      setError(result.error || 'Failed to send');
    }

    setSending(false);
    inputRef.current?.focus();
  }, [draft, sending, partnerPublicKey]);

  // ─── Keyboard shortcut ───
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Theme ───
  const bg = darkMode ? 'bg-gray-900' : 'bg-gray-50';
  const chromeBg = darkMode ? 'bg-gray-800' : 'bg-white';
  const text_color = darkMode ? 'text-white' : 'text-gray-900';
  const textSec = darkMode ? 'text-gray-400' : 'text-gray-500';
  const border = darkMode ? 'border-gray-700' : 'border-gray-200';

  return (
    <div className={`flex-1 flex flex-col ${bg}`}>
      {/* ─── Chat Header ─── */}
      <div className={`${chromeBg} border-b ${border} px-4 py-3 flex items-center gap-3 flex-shrink-0`}>
        <button onClick={onBack} className={`p-2 rounded-lg hover:bg-gray-100 ${textSec}`}>
          <ArrowLeft size={20} />
        </button>

        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white font-bold">
          {(partnerHandle || partnerPublicKey[0] || '?')[0].toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className={`font-semibold text-sm ${text_color}`}>
            {partnerHandle ? `@${partnerHandle}` : `${partnerPublicKey.substring(0, 16)}...`}
          </h2>
          <div className="flex items-center gap-1.5">
            <Lock size={10} className="text-green-500" />
            <span className="text-[11px] text-green-500">End-to-end encrypted</span>
          </div>
        </div>

        {!realtime.isConnected && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-50 text-yellow-600 text-xs">
            <WifiOff size={12} />
            Offline
          </div>
        )}
      </div>

      {/* ─── Messages ─── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="text-cyan-500 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-cyan-50 flex items-center justify-center mx-auto mb-4">
                <Shield size={32} className="text-cyan-400" />
              </div>
              <p className={`text-sm font-medium ${text_color} mb-1`}>
                Start of encrypted conversation
              </p>
              <p className={`text-xs ${textSec}`}>
                Messages are encrypted with ChaCha20-Poly1305
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Date separator + encryption notice */}
            <div className="flex items-center justify-center mb-6">
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs ${
                darkMode ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-400'
              }`}>
                <Lock size={10} />
                End-to-end encrypted
              </div>
            </div>

            {messages.map((msg, i) => {
              const isOut = msg.direction === 'outgoing';
              const showDate = i === 0 || !isSameDay(msg.timestamp, messages[i - 1].timestamp);

              return (
                <React.Fragment key={msg.id}>
                  {showDate && (
                    <div className="flex justify-center my-4">
                      <span className={`text-[11px] px-3 py-1 rounded-full ${
                        darkMode ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {formatDate(msg.timestamp)}
                      </span>
                    </div>
                  )}

                  <div className={`flex mb-2 ${isOut ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      isOut
                        ? 'bg-cyan-500 text-white rounded-br-md'
                        : darkMode
                          ? 'bg-gray-800 text-gray-200 rounded-bl-md'
                          : 'bg-white text-gray-900 rounded-bl-md shadow-sm border border-gray-100'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                      <div className={`flex items-center justify-end gap-1 mt-1 ${
                        isOut ? 'text-cyan-100' : textSec
                      }`}>
                        <span className="text-[10px]">{formatMsgTime(msg.timestamp)}</span>
                        {isOut && msg.status === 'delivered' && <CheckCheck size={12} />}
                        {isOut && msg.status === 'sent' && <Check size={12} />}
                        {isOut && msg.status === 'failed' && (
                          <span className="text-red-300 text-[10px]">Failed</span>
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* ─── Error bar ─── */}
      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-600 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* ─── Compose Area ─── */}
      <div className={`${chromeBg} border-t ${border} px-4 py-3 flex-shrink-0`}>
        <div className={`flex items-end gap-2 rounded-2xl border ${border} px-3 py-2 ${
          darkMode ? 'bg-gray-800' : 'bg-gray-50'
        }`}>
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className={`flex-1 bg-transparent outline-none text-sm resize-none max-h-32 ${text_color}`}
            style={{ minHeight: '24px' }}
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className={`p-2 rounded-xl transition-colors flex-shrink-0 ${
              draft.trim()
                ? 'bg-cyan-500 hover:bg-cyan-600 text-white'
                : darkMode
                  ? 'bg-gray-700 text-gray-500'
                  : 'bg-gray-200 text-gray-400'
            }`}
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───

function isSameDay(ts1: number, ts2: number): boolean {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function formatDate(ts: number): string {
  const now = new Date();
  const d = new Date(ts);
  if (isSameDay(ts, now.getTime())) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(ts, yesterday.getTime())) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMsgTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
