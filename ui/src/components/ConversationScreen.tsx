/**
 * Conversation Screen - Chat view
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, MoreVertical } from 'lucide-react';
import { getMessages, sendMessage, Message as MessageType } from '../lib/tauri';
import { format } from 'date-fns';
import clsx from 'clsx';

export function ConversationScreen() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (threadId) {
      loadMessages();
    }
  }, [threadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    if (!threadId) return;
    try {
      setLoading(true);
      const msgs = await getMessages({ threadId });
      setMessages(msgs.reverse()); // Reverse to show oldest first
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
    if (!inputText.trim() || !threadId || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      // Optimistic update
      const optimisticMessage: MessageType = {
        id: `temp-${Date.now()}`,
        thread_id: threadId,
        from_public_key: 'self',
        payload_type: 'text/plain',
        payload: { text },
        timestamp: Date.now(),
        is_outgoing: true,
        status: 'sending',
      };
      setMessages((prev) => [...prev, optimisticMessage]);

      await sendMessage({
        recipientPublicKey: threadId, // In a real app, this would be the participant's key
        payloadType: 'text/plain',
        payload: { text },
        threadId,
      });

      // Update status
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticMessage.id ? { ...m, status: 'sent' } : m
        )
      );
    } catch (e) {
      console.error('Failed to send message:', e);
      // Mark as failed
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

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 bg-slate-900/95 backdrop-blur-lg border-b border-slate-800 p-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/messages')}
          className="p-2 -ml-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 flex-1">
          <div className="avatar">?</div>
          <div>
            <h1 className="font-medium">Conversation</h1>
            <p className="text-slate-400 text-xs">
              {threadId?.slice(0, 16)}...
            </p>
          </div>
        </div>

        <button className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
          <MoreVertical className="w-5 h-5" />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-500">No messages yet</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-4">
        <div className="flex items-end gap-3">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            rows={1}
            className="input flex-1 resize-none min-h-[44px] max-h-32"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
            className={clsx(
              'p-3 rounded-full transition-colors',
              inputText.trim()
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-slate-800 text-slate-500'
            )}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: MessageType }) {
  const text =
    typeof message.payload === 'object' && message.payload !== null
      ? (message.payload as { text?: string }).text || ''
      : String(message.payload);

  const time = format(new Date(message.timestamp), 'HH:mm');

  return (
    <div
      className={clsx(
        'flex',
        message.is_outgoing ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={clsx(
          'message-bubble',
          message.is_outgoing
            ? 'message-bubble-outgoing'
            : 'message-bubble-incoming'
        )}
      >
        <p className="whitespace-pre-wrap break-words">{text}</p>
        <div
          className={clsx(
            'flex items-center gap-1 mt-1',
            message.is_outgoing ? 'justify-end' : 'justify-start'
          )}
        >
          <span className="text-xs opacity-70">{time}</span>
          {message.is_outgoing && message.status === 'sending' && (
            <span className="text-xs opacity-50">⏳</span>
          )}
          {message.is_outgoing && message.status === 'sent' && (
            <span className="text-xs opacity-70">✓</span>
          )}
          {message.is_outgoing && message.status === 'failed' && (
            <span className="text-xs text-red-400">✗</span>
          )}
        </div>
      </div>
    </div>
  );
}
