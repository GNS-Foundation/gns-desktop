// ===========================================
// GNS BROWSER - EMAIL LIST COMPONENT
// ===========================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EmailApi } from '../../lib/email';
import { useTauriEvent } from '../../lib/tauri';
import { EmailThread } from '../../types/email';
import {
  Mail,
  Star,
  Paperclip,
  Trash2,
  RefreshCw,
  PenSquare,
  Inbox,
  Lock,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../../lib/utils';

interface EmailListProps {
  onSelectThread: (thread: EmailThread) => void;
  onCompose: () => void;
  selectedThreadId?: string;
}

export function EmailList({ onSelectThread, onCompose, selectedThreadId }: EmailListProps) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'starred'>('all');
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['email-threads', filter],
    queryFn: () => EmailApi.getThreads({ limit: 50, filter }),
    refetchInterval: 60000, // Poll every minute
  });

  // Listener for new messages
  useTauriEvent('new_message', () => {
    console.log('[EmailList] New message received, refining...');
    queryClient.invalidateQueries({ queryKey: ['email-threads'] });
  });

  const toggleStarMutation = useMutation({
    mutationFn: (threadId: string) => EmailApi.toggleStar(threadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
    },
  });

  const deleteThreadMutation = useMutation({
    mutationFn: (threadId: string) => EmailApi.deleteThread(threadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
    },
  });

  const threads = data?.threads || [];
  const stats = data?.stats;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-surface/50">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-text-primary">Email</h2>
          {stats && stats.unreadCount > 0 && (
            <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">
              {stats.unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn("w-4 h-4 text-text-muted", isLoading && "animate-spin")} />
          </button>
          <button
            onClick={onCompose}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors"
          >
            <PenSquare className="w-4 h-4" />
            Compose
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 p-2 border-b border-border bg-surface/30">
        {(['all', 'unread', 'starred'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize",
              filter === f
                ? "bg-indigo-600 text-white"
                : "text-text-muted hover:bg-surface-light"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && !threads.length ? (
          <div className="flex flex-col items-center justify-center h-64 text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            Loading emails...
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <Inbox className="w-12 h-12 mb-3 opacity-50" />
            <p>No emails yet</p>
            <p className="text-sm mt-1">Your email address is @handle@gcrumbs.com</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {threads.map((thread) => (
              <EmailThreadRow
                key={thread.id}
                thread={thread}
                isSelected={thread.id === selectedThreadId}
                onSelect={() => onSelectThread(thread)}
                onToggleStar={(e) => {
                  e.stopPropagation();
                  toggleStarMutation.mutate(thread.id);
                }}
                onDelete={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this conversation?')) {
                    deleteThreadMutation.mutate(thread.id);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================
// EMAIL THREAD ROW
// ===========================================

interface EmailThreadRowProps {
  thread: EmailThread;
  isSelected: boolean;
  onSelect: () => void;
  onToggleStar: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

function EmailThreadRow({ thread, isSelected, onSelect, onToggleStar, onDelete }: EmailThreadRowProps) {
  const timeAgo = formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true });
  const isUnread = thread.unreadCount > 0;

  // Get participant display names
  const participantNames = thread.participants
    .map(p => p.name || p.handle || p.address.split('@')[0])
    .join(', ');

  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 p-4 cursor-pointer transition-colors group",
        isSelected ? "bg-indigo-900/30" : "hover:bg-surface-light/50",
        isUnread && "bg-surface/50"
      )}
    >
      {/* Star */}
      <button
        onClick={onToggleStar}
        className="p-1 -m-1 hover:bg-surface-light/50 rounded transition-colors"
      >
        <Star
          className={cn(
            "w-4 h-4",
            thread.isStarred ? "fill-yellow-500 text-yellow-500" : "text-slate-500"
          )}
        />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Sender & Time */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className={cn(
            "truncate text-sm",
            isUnread ? "font-semibold text-text-primary" : "text-text-secondary"
          )}>
            {participantNames}
          </span>
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {timeAgo}
          </span>
        </div>

        {/* Subject */}
        <div className={cn(
          "text-sm truncate mb-1",
          isUnread ? "font-medium text-text-primary" : "text-text-muted"
        )}>
          {thread.subject || '(No subject)'}
        </div>

        {/* Snippet */}
        <div className="text-xs text-text-muted truncate">
          {thread.snippet}
        </div>

        {/* Indicators */}
        <div className="flex items-center gap-2 mt-2">
          {thread.hasAttachments && (
            <Paperclip className="w-3 h-3 text-slate-500" />
          )}
          {thread.messageCount > 1 && (
            <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
              {thread.messageCount}
            </span>
          )}
          {/* Show lock icon for encrypted (internal GNS) emails */}
          {thread.participants.some(p => p.isGns) && (
            <span title="End-to-end encrypted"><Lock className="w-3 h-3 text-green-500" /></span>
          )}
        </div>
      </div>

      {/* Delete button (visible on hover) */}
      <button
        onClick={onDelete}
        className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all"
      >
        <Trash2 className="w-4 h-4 text-red-400" />
      </button>
    </div>
  );
}
