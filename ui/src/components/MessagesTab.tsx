/**
 * Messages Tab - Conversation list
 */

import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useThreads, ThreadPreview } from '../lib/tauri';
import { formatDistanceToNow } from 'date-fns';

export function MessagesTab() {
  const navigate = useNavigate();
  const { threads, loading, error } = useThreads();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 bg-slate-900/95 backdrop-blur-lg border-b border-slate-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Messages</h1>
          <button
            onClick={() => navigate('/messages/new')}
            className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="Search conversations..."
            className="input w-full pl-10"
          />
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="p-4">
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          </div>
        ) : threads.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-slate-800">
            {threads.map((thread) => (
              <ThreadItem
                key={thread.id}
                thread={thread}
                onClick={() => navigate(`/messages/${thread.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ThreadItem({
  thread,
  onClick,
}: {
  thread: ThreadPreview;
  onClick: () => void;
}) {
  const displayName = thread.participant_handle
    ? `@${thread.participant_handle}`
    : thread.participant_public_key.slice(0, 16) + '...';

  const timeAgo = formatDistanceToNow(new Date(thread.last_message_at), {
    addSuffix: true,
  });

  return (
    <button
      onClick={onClick}
      className="w-full p-4 flex items-center gap-3 hover:bg-slate-800/50 transition-colors text-left"
    >
      <div className="avatar">
        {thread.participant_handle?.[0]?.toUpperCase() || '?'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium truncate">{displayName}</h3>
          <span className="text-slate-500 text-xs flex-shrink-0">{timeAgo}</span>
        </div>
        {thread.last_message_preview && (
          <p className="text-slate-400 text-sm truncate">
            {thread.last_message_preview}
          </p>
        )}
      </div>

      {thread.unread_count > 0 && (
        <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
          <span className="text-xs font-medium">{thread.unread_count}</span>
        </div>
      )}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
        <span className="text-3xl">💬</span>
      </div>
      <h3 className="font-semibold mb-2">No messages yet</h3>
      <p className="text-slate-400 text-sm">
        Start a conversation by searching for a @handle or scanning a QR code
      </p>
    </div>
  );
}
