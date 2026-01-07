// ===========================================
// GNS BROWSER - EMAIL THREAD VIEW
// ===========================================

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmailApi } from '../../lib/email';
import { EmailThread, EmailMessage } from '../../types/email';
import {
  ArrowLeft,
  Reply,
  ReplyAll,
  Forward,
  Trash2,
  Lock,
  Paperclip,
  Download,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';

interface EmailThreadViewProps {
  thread: EmailThread;
  onBack: () => void;
  onReply: (message: EmailMessage, replyAll?: boolean) => void;
  onForward: (message: EmailMessage) => void;
  onDelete: () => void;
}

export function EmailThreadView({ thread, onBack, onReply, onForward, onDelete }: EmailThreadViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['email-thread', thread.id],
    queryFn: () => EmailApi.getThread(thread.id),
  });

  // Mark as read when opened
  useEffect(() => {
    if (thread.unreadCount > 0) {
      EmailApi.markRead(thread.id);
    }
  }, [thread.id]);

  // Scroll to bottom when messages load
  useEffect(() => {
    if (data?.messages) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [data?.messages]);

  const messages = data?.messages || [];

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-surface/50">
        <button
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>

        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-white truncate">
            {thread.subject || '(No subject)'}
          </h2>
          <p className="text-sm text-slate-400 truncate">
            {thread.participants.map(p => p.name || p.address).join(', ')}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => messages.length > 0 && onReply(messages[messages.length - 1])}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            title="Reply"
          >
            <Reply className="w-5 h-5 text-slate-400" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-red-500/20 rounded-full transition-colors"
            title="Delete"
          >
            <Trash2 className="w-5 h-5 text-red-400" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {messages.map((message, index) => (
              <EmailMessageCard
                key={message.id}
                message={message}
                isLast={index === messages.length - 1}
                onReply={() => onReply(message)}
                onReplyAll={() => onReply(message, true)}
                onForward={() => onForward(message)}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Quick Reply */}
      <div className="p-4 border-t border-border bg-surface/30">
        <button
          onClick={() => messages.length > 0 && onReply(messages[messages.length - 1])}
          className="w-full p-3 text-left text-slate-500 bg-slate-800/50 rounded-lg border border-white/10 hover:bg-slate-800 hover:text-slate-400 transition-colors"
        >
          Click to reply...
        </button>
      </div>
    </div>
  );
}

// ===========================================
// EMAIL MESSAGE CARD
// ===========================================

interface EmailMessageCardProps {
  message: EmailMessage;
  isLast: boolean;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
}

function EmailMessageCard({ message, isLast, onReply, onReplyAll, onForward }: EmailMessageCardProps) {
  const [isExpanded, setIsExpanded] = useState(isLast);

  const formattedDate = format(new Date(message.createdAt), 'MMM d, yyyy h:mm a');
  const fromDisplay = message.from.name || message.from.address;

  return (
    <div className={cn(
      "rounded-xl border transition-colors",
      message.isEncrypted
        ? "border-green-500/30 bg-green-950/20"
        : "border-border bg-surface/50"
    )}>
      {/* Header - Always visible */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Avatar */}
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0",
          message.isEncrypted
            ? "bg-gradient-to-br from-green-500 to-emerald-600"
            : "bg-gradient-to-br from-indigo-500 to-purple-600"
        )}>
          {fromDisplay.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">{fromDisplay}</span>
            {message.isEncrypted && (
              <span title="Encrypted"><Lock className="w-3 h-3 text-green-500" /></span>
            )}
          </div>
          <div className="text-sm text-slate-500">
            To: {message.to.map(t => t.name || t.address).join(', ')}
          </div>
          {!isExpanded && (
            <div className="text-sm text-slate-400 mt-1 truncate">
              {message.body.substring(0, 100)}...
            </div>
          )}
        </div>

        {/* Time & Expand */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>{formattedDate}</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </div>

      {/* Body - Expanded */}
      {isExpanded && (
        <div className="px-4 pb-4">
          {/* Body */}
          <div className="pl-13 ml-10">
            {message.bodyHtml ? (
              <div
                className="prose prose-invert prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
              />
            ) : (
              <div className="whitespace-pre-wrap text-slate-300 text-sm">
                {message.body}
              </div>
            )}
          </div>

          {/* Attachments */}
          {message.attachments.length > 0 && (
            <div className="ml-10 mt-4 space-y-2">
              <div className="text-xs text-slate-500 font-medium">
                {message.attachments.length} attachment{message.attachments.length > 1 ? 's' : ''}
              </div>
              {message.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg border border-white/10"
                >
                  <Paperclip className="w-4 h-4 text-slate-500" />
                  <span className="flex-1 text-sm text-slate-300 truncate">
                    {attachment.filename}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatFileSize(attachment.size)}
                  </span>
                  {attachment.url && (
                    <a
                      href={attachment.url}
                      download={attachment.filename}
                      className="p-1 hover:bg-white/10 rounded"
                    >
                      <Download className="w-4 h-4 text-indigo-400" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="ml-10 mt-4 flex items-center gap-2">
            <button
              onClick={onReply}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Reply className="w-4 h-4" />
              Reply
            </button>
            <button
              onClick={onReplyAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ReplyAll className="w-4 h-4" />
              Reply All
            </button>
            <button
              onClick={onForward}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Forward className="w-4 h-4" />
              Forward
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================
// HELPERS
// ===========================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
