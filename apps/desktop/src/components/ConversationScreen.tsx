/**
 * Conversation Screen - Chat view
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Send, Trash2, X } from 'lucide-react';
import { getMessages, sendMessage, getThread, deleteThread, deleteMessage, addReaction, Message as MessageType, ThreadPreview } from '../lib/tauri';
import { MessageBubble } from './messaging/MessageBubble';
import { MessageContextMenu } from './messaging/MessageContextMenu';
import { ReplyPreview } from './messaging/ReplyPreview';

interface LocationState {
  recipientPublicKey?: string;
  recipientHandle?: string;
  recipientEncryptionKey?: string;
}

export function ConversationScreen() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [messages, setMessages] = useState<MessageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [threadDetails, setThreadDetails] = useState<ThreadPreview | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    message: MessageType;
    position: { x: number; y: number };
  } | null>(null);
  const [replyingTo, setReplyingTo] = useState<MessageType | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get recipient info from navigation state OR fetched thread details
  const recipientPublicKey = state?.recipientPublicKey || threadDetails?.participant_public_key;
  const recipientHandle = state?.recipientHandle || threadDetails?.participant_handle;

  useEffect(() => {
    if (threadId) {
      loadMessages();
      loadThreadDetails();
    }
  }, [threadId]);

  const loadThreadDetails = async () => {
    if (!threadId) return;
    try {
      const details = await getThread(threadId);
      setThreadDetails(details);
    } catch (e) {
      console.error('Failed to load thread details:', e);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Listen for incoming messages
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');

        const unlistenNewMsg = await listen<MessageType>('new_message', (event) => {
          console.log('New message received:', event.payload);

          // Only add if it belongs to this thread
          if (event.payload.thread_id === threadId) {
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some(m => m.id === event.payload.id)) return prev;
              return [...prev, event.payload];
            });
          }
        });

        const unlistenSynced = await listen<any>('message_synced', (event) => {
          console.log('Message synced from browser:', event.payload);
          // Payload: { id, to_pk, text, timestamp, is_outgoing }
          // We need to match this to the current thread.
          // If current thread is with `to_pk`, then yes.
          // OR if threadId matches (but payload doesn't have threadId, save_browser_sent_message calculated it).
          // We can check if `recipientPublicKey` matches `to_pk`.

          if (event.payload.to_pk === recipientPublicKey) {
            const newMessage: MessageType = {
              id: event.payload.id,
              thread_id: threadId || '',
              from_public_key: 'me', // It's from us
              payload_type: 'text/plain',
              payload: { text: event.payload.text },
              timestamp: event.payload.timestamp,
              is_outgoing: true,
              status: 'sent', // Synced means it was sent
              reply_to_id: undefined, // Browser sync might not include this yet
              reactions: []
            };

            setMessages((prev) => {
              if (prev.some(m => m.id === newMessage.id)) return prev;
              return [...prev, newMessage];
            });
          }
        });

        unlisten = () => {
          unlistenNewMsg();
          unlistenSynced();
        };

      } catch (e) {
        console.error('Failed to setup event listener:', e);
      }
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [threadId, recipientPublicKey]);

  const loadMessages = async () => {
    if (!threadId) return;
    try {
      setLoading(true);
      const msgs = await getMessages({ threadId });
      setMessages(msgs.reverse());
    } catch (e) {
      console.error('Failed to load messages:', e);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;

    // Must have either handle or public key
    if (!recipientHandle && !recipientPublicKey) {
      console.error('No recipient info available');
      return;
    }

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      // Optimistic update
      const optimisticMessage: MessageType = {
        id: `temp-${Date.now()}`,
        thread_id: threadId || '',
        from_public_key: 'self',
        payload_type: 'text/plain',
        payload: { text },
        timestamp: Date.now(),
        is_outgoing: true,
        status: 'sending',
        reply_to_id: replyingTo?.id, // Add reply_to_id to optimistic message
        reactions: [],
      };
      setMessages((prev) => [...prev, optimisticMessage]);

      // Send with correct recipient info
      await sendMessage({
        recipientHandle: recipientHandle,
        recipientPublicKey: recipientPublicKey,
        payloadType: 'text/plain',
        payload: { text },
        threadId,
        replyToId: replyingTo?.id, // Add replyToId here
      });

      setReplyingTo(null); // Clear replyingTo state after sending

      // Update status
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticMessage.id ? { ...m, status: 'sent' } : m
        )
      );
    } catch (e) {
      console.error('Failed to send message:', e);
      alert(`Failed to send: ${e}`);
      setMessages((prev) =>
        prev.map((m) =>
          m.id.startsWith('temp-') ? { ...m, status: 'failed' } : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedMessages);
    if (newSelected.has(id)) {
      newSelected.delete(id);
      if (newSelected.size === 0) {
        setSelectionMode(false);
      }
    } else {
      newSelected.add(id);
    }
    setSelectedMessages(newSelected);
  };

  const deleteSelected = async () => {
    if (!confirm(`Delete ${selectedMessages.size} messages?`)) return;

    try {
      await Promise.all(Array.from(selectedMessages).map(id => deleteMessage(id)));
      setSelectionMode(false);
      setSelectedMessages(new Set());
      loadMessages(); // Refresh list
    } catch (e) {
      alert('Failed to delete messages: ' + e);
    }
  };

  const displayName = recipientHandle
    ? `@${recipientHandle}`
    : recipientPublicKey?.slice(0, 12) + '...' || 'Unknown';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 bg-surface/95 backdrop-blur-lg border-b border-border p-4 z-20">
        {selectionMode ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedMessages(new Set());
                }}
                className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <span className="font-semibold">{selectedMessages.size} Selected</span>
            </div>
            <button
              onClick={deleteSelected}
              className="p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/messages')}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 min-w-0">
              <h1 className="font-semibold truncate">{displayName}</h1>
              {recipientPublicKey && (
                <p className="text-slate-500 text-xs truncate">
                  {recipientPublicKey.slice(0, 16)}...
                </p>
              )}
            </div>

            <button
              onClick={async () => {
                if (confirm('Delete this conversation?')) {
                  try {
                    if (threadId) {
                      await deleteThread(threadId);
                      navigate('/messages');
                    }
                  } catch (e) {
                    alert('Failed to delete: ' + e);
                  }
                }
              }}
              className="p-2 rounded-lg hover:bg-slate-800 hover:text-red-500 transition-colors"
              title="Delete conversation"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p>No messages yet</p>
            <p className="text-sm mt-1">Send a message to start the conversation</p>
          </div>
        ) : (
          messages.map((msg) => {
            // Populate reply_to if it exists
            const replyToMsg = msg.reply_to_id
              ? messages.find(m => m.id === msg.reply_to_id)
              : undefined;

            return (
              <MessageBubble
                key={msg.id}
                message={{ ...msg, reply_to: replyToMsg }}
                isMe={msg.is_outgoing}
                isSelected={selectedMessages.has(msg.id)}
                selectionMode={selectionMode}
                onSelect={(m) => toggleSelection(m.id)}
                onLongPress={(m, pos) => {
                  // Vibrate
                  if (navigator.vibrate) navigator.vibrate(50);
                  setContextMenu({ message: m, position: pos });
                }}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <MessageContextMenu
          message={contextMenu.message}
          position={contextMenu.position}
          isOutgoing={contextMenu.message.is_outgoing}
          onClose={() => setContextMenu(null)}
          onReply={(m) => {
            setReplyingTo(m);
            setContextMenu(null);
          }}
          onForward={(m) => console.log('Forward', m)}
          onCopy={(text) => {
            navigator.clipboard.writeText(text);
            setContextMenu(null);
          }}
          onInfo={(m) => console.log('Info', m)}
          onStar={(m) => console.log('Star', m)}
          onDelete={async (m) => {
            if (confirm('Delete this message?')) {
              await deleteMessage(m.id);
              loadMessages();
            }
          }}
          onReact={async (m, emoji) => {
            if (recipientPublicKey) {
              setMessages(prev => prev.map(msg => {
                if (msg.id === m.id) {
                  return {
                    ...msg,
                    reactions: [...(msg.reactions || []), { emoji, from_public_key: 'me' }] // 'me' is placeholder, backend uses real key
                  };
                }
                return msg;
              }));

              await addReaction({
                messageId: m.id,
                emoji,
                recipientPublicKey: recipientPublicKey,
                recipientHandle: recipientHandle || undefined
              });

              // Reload to get consistent state
              loadMessages();
            }
          }}
        />
      )}

      {/* Input */}
      <div className="sticky bottom-0 bg-surface/95 backdrop-blur-lg border-t border-border">
        {replyingTo && (
          <ReplyPreview
            message={replyingTo}
            onClose={() => setReplyingTo(null)}
          />
        )}
        <div className="p-4 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="input flex-1"
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
            className="p-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}


