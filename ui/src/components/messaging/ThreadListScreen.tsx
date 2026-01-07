// ===========================================
// GNS BROWSER - THREAD LIST SCREEN
// Direct Messages List (Filters out email threads)
// ===========================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThreads, deleteThread } from '../../lib/tauri';
import { EMAIL_GATEWAY_PUBLIC_KEY } from '../../lib/constants';
import {
    MessageSquare,
    Trash2,
    Loader2,
    Plus
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../../lib/utils';

export function ThreadListScreen() {
    const navigate = useNavigate();
    const { threads, loading, error, refresh } = useThreads();
    const [filter] = useState<'all' | 'unread' | 'archived'>('all');

    // Filter out email threads
    const directThreads = threads.filter(thread => {
        // Check if any participant is the email gateway
        // In actual implementation, we'd check participant keys against gateway key
        // For now, assuming thread.participant_public_key is the "other" person
        return thread.participant_public_key.toLowerCase() !== EMAIL_GATEWAY_PUBLIC_KEY.toLowerCase();
    });

    // Apply UI filters if needed
    const displayThreads = directThreads.filter(t => {
        if (filter === 'unread') return t.unread_count > 0;
        // if (filter === 'archived') return t.is_archived; // If we had archived status
        return true;
    });

    const handleStartNew = () => {
        navigate('/messages/new');
    };

    const handleOpenThread = (threadId: string) => {
        navigate(`/messages/${threadId}`);
    };

    const handleDeleteThread = async (e: React.MouseEvent, threadId: string) => {
        e.stopPropagation();
        if (confirm('Delete this conversation?')) {
            await deleteThread(threadId);
            refresh();
        }
    };

    if (loading && !threads.length) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p>Loading conversations...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-red-400">
                <p>Error loading messages</p>
                <button onClick={() => refresh()} className="mt-2 text-blue-400 hover:underline">Retry</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-950">
            {/* Header / Actions */}
            <div className="p-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Messages</h2>
                <button
                    onClick={handleStartNew}
                    className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-colors"
                    title="New Message"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            {/* Thread List */}
            <div className="flex-1 overflow-y-auto">
                {displayThreads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                        <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
                        <p>No messages yet</p>
                        <button
                            onClick={handleStartNew}
                            className="mt-4 text-blue-400 text-sm hover:underline"
                        >
                            Start a new conversation
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {displayThreads.map((thread) => (
                            <div
                                key={thread.id}
                                onClick={() => handleOpenThread(thread.id)}
                                className={cn(
                                    "group flex items-center gap-3 p-4 hover:bg-surface/50 cursor-pointer transition-colors",
                                    thread.unread_count > 0 && "bg-surface/30"
                                )}
                            >
                                {/* Avatar */}
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-lg font-bold text-blue-400">
                                        {(thread.participant_handle || 'U')[0].toUpperCase()}
                                    </div>
                                    {thread.unread_count > 0 && (
                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-xs text-white font-bold border-2 border-slate-950">
                                            {thread.unread_count}
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={cn(
                                            "font-medium truncate",
                                            thread.unread_count > 0 ? "text-white" : "text-slate-300"
                                        )}>
                                            {thread.participant_handle
                                                ? `@${thread.participant_handle}`
                                                : `${thread.participant_public_key.slice(0, 8)}...`
                                            }
                                        </span>
                                        <span className="text-xs text-slate-500 whitespace-nowrap ml-2">
                                            {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })}
                                        </span>
                                    </div>

                                    <p className={cn(
                                        "text-sm truncate",
                                        thread.unread_count > 0 ? "text-slate-300" : "text-slate-500"
                                    )}>
                                        {/* Prefix for sent messages if we could detect it */}
                                        {thread.last_message_preview || 'No messages'}
                                    </p>
                                </div>

                                {/* Hover Actions */}
                                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                    <button
                                        onClick={(e) => handleDeleteThread(e, thread.id)}
                                        className="p-2 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
