import { useState, useEffect } from 'react';
import { useApiEvents } from '../../hooks/useApiEvents';
import { useEmailApi } from '../../hooks/useApi';
import { Search, PenLine, Star } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { EmailThread } from '@gns/api-core';

interface EmailListProps {
    onSelectThread: (thread: EmailThread) => void;
    onCompose: () => void;
    selectedThreadId?: string;
    className?: string;
}

export function EmailList({ onSelectThread, onCompose, selectedThreadId, className }: EmailListProps) {
    const [threads, setThreads] = useState<EmailThread[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const emailApi = useEmailApi();

    const fetchThreads = async () => {
        try {
            setLoading(true);
            const data = await emailApi.getThreads();
            setThreads(data.threads);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch emails');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchThreads();
    }, [emailApi]);

    // Listen for new emails to refresh list
    useApiEvents('email:new', () => {
        fetchThreads();
    });

    // Filter threads
    const filteredThreads = threads.filter(t =>
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.snippet.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.participants.some(p => p.address.includes(searchQuery.toLowerCase()) || p.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className={clsx("flex flex-col h-full border-r border-border bg-background w-[350px] min-w-[300px]", className)}>
            {/* Header */}
            <div className="p-4 border-b border-border flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold tracking-tight">Inbox</h2>
                    <button
                        onClick={onCompose}
                        className="p-2 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-sm"
                        title="Compose"
                    >
                        <PenLine size={18} />
                    </button>
                </div>

                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search mail"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-muted/50 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {error && (
                    <div className="p-4 bg-red-500/10 text-red-500 text-sm border-b border-red-500/20">
                        Error: {error}
                    </div>
                )}
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2"></div>
                        <span className="text-sm">Loading...</span>
                    </div>
                ) : filteredThreads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-60 text-muted-foreground p-8 text-center">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                            <Search size={24} className="opacity-50" />
                        </div>
                        <p className="text-sm">No emails found</p>
                    </div>
                ) : (
                    <div>
                        {filteredThreads.map(thread => {
                            // Parse date
                            const date = new Date(thread.lastMessageAt || Date.now());
                            const dateStr = format(date, 'MMM d');
                            const isSelected = selectedThreadId === thread.id;

                            const sender = thread.participants.find(p => !p.address.includes('gcrumbs.com')) || thread.participants[0] || { name: 'Unknown', address: '??', isGns: false };
                            const senderName = sender.name || sender.address.split('@')[0];

                            return (
                                <div
                                    key={thread.id}
                                    onClick={() => onSelectThread(thread)}
                                    className={clsx(
                                        "relative p-4 cursor-pointer border-b border-border/40 hover:bg-muted/40 transition-colors group",
                                        isSelected ? "bg-accent/50 hover:bg-accent/60 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary" : "",
                                        thread.unreadCount > 0 ? "bg-background" : "bg-background/50 opacity-90"
                                    )}
                                >
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className={clsx(
                                            "text-sm truncate max-w-[70%]",
                                            thread.unreadCount > 0 ? "font-bold text-foreground" : "font-medium text-foreground/80"
                                        )}>
                                            {senderName}
                                        </span>
                                        <span className={clsx(
                                            "text-xs whitespace-nowrap",
                                            thread.unreadCount > 0 ? "text-primary font-medium" : "text-muted-foreground"
                                        )}>
                                            {dateStr}
                                        </span>
                                    </div>

                                    <div className={clsx(
                                        "text-sm truncate mb-1",
                                        thread.unreadCount > 0 ? "text-foreground font-semibold" : "text-muted-foreground"
                                    )}>
                                        {thread.subject || '(No subject)'}
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-muted-foreground line-clamp-1 flex-1 pr-2">
                                            {thread.snippet}
                                        </p>
                                        {thread.isStarred && (
                                            <Star size={12} className="text-yellow-500 fill-yellow-500 shrink-0" />
                                        )}
                                    </div>

                                    {thread.unreadCount > 0 && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-blue-500 rounded-full shadow-sm"></div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
