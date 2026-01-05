import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useThreads, ThreadPreview, deleteThread } from '../lib/tauri';
import { SwipeableItem } from './SwipeableItem';
import { formatDistanceToNow } from 'date-fns';

export function MessagesTab() {
  console.log('MessagesTab: Mounting');
  return (
    <MessagesErrorBoundary>
      <MessagesTabContent />
    </MessagesErrorBoundary>
  );
}

function MessagesTabContent() {
  console.log('MessagesTabContent: Rendering');
  const navigate = useNavigate();
  const { threads, loading, error, refresh } = useThreads();
  console.log('MessagesTabContent: State', { threads, loading, error });

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
                onDelete={async () => {
                  try {
                    await deleteThread(thread.id);
                    refresh();
                  } catch (e) {
                    alert('Failed to delete thread: ' + e);
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

function ThreadItem({
  thread,
  onClick,
  onDelete,
}: {
  thread: ThreadPreview;
  onClick: () => void;
  onDelete: () => void;
}) {
  const displayName = thread.participant_handle
    ? `@${thread.participant_handle}`
    : (thread.participant_public_key ? thread.participant_public_key.slice(0, 16) + '...' : 'Unknown');

  return (
    <SwipeableItem
      onDelete={() => {
        if (confirm('Delete this conversation?')) {
          onDelete();
        }
      }}
      deleteIcon={<Trash2 className="w-6 h-6" />}
      className="border-b border-slate-800 last:border-0"
    >
      <div className="w-full flex items-center hover:bg-slate-800/50 transition-colors group bg-slate-900">
        <button
          onClick={onClick}
          className="flex-1 p-4 flex items-center gap-3 text-left min-w-0"
        >
          <div className="avatar">
            {thread.participant_handle?.[0]?.toUpperCase() || '?'}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium truncate">{displayName}</h3>
              <span className="text-slate-500 text-xs flex-shrink-0">
                {(() => {
                  try {
                    return formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true });
                  } catch (e) {
                    return 'unknown time';
                  }
                })()}
              </span>
            </div>
            {thread.last_message_preview && (
              <p className="text-slate-400 text-sm truncate">
                {thread.last_message_preview}
              </p>
            )}
          </div>

          {thread.unread_count > 0 && (
            <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center ml-2">
              <span className="text-xs font-medium">{thread.unread_count}</span>
            </div>
          )}
        </button>

        {/* Desktop Hover Delete Button (Optional, keeping for accessibility) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm('Delete this conversation?')) {
              onDelete();
            }
          }}
          className="p-4 text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all hidden sm:block"
          title="Delete conversation"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </SwipeableItem>
  );
}

class MessagesErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-red-500 bg-red-900/10 rounded-lg m-4 border border-red-500/20">
          <h2 className="font-bold mb-2">Something went wrong in MessagesTab.</h2>
          <p className="font-mono text-xs break-all">{this.state.error}</p>
        </div>
      );
    }
    return this.props.children;
  }
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
