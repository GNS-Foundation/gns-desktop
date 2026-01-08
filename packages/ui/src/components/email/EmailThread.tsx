import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiEvents } from '../../hooks/useApiEvents';
import { useEmailApi } from '../../hooks/useApi';
import { EmailThread, EmailMessage } from '@gns/api-core';
import {
    ArrowLeft,
    Trash2,
    Loader2
} from 'lucide-react';
import { EmailMessageCard } from './EmailMessageCard';

interface EmailThreadViewProps {
    thread: EmailThread;
    onBack: () => void;
    onReply: (message: EmailMessage, replyAll?: boolean) => void;
    onForward: (message: EmailMessage) => void;
    onDelete: () => void;
}

export function EmailThreadView({ thread, onBack, onReply, onForward, onDelete }: EmailThreadViewProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const queryClient = useQueryClient();
    const emailApi = useEmailApi();

    // Track expanded state for each message
    const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});

    const { data, isLoading } = useQuery({
        queryKey: ['email-thread', thread.id],
        queryFn: () => emailApi.getThread(thread.id),
    });

    // Listen for new messages to refresh thread
    useApiEvents('email:new', () => {
        queryClient.invalidateQueries({ queryKey: ['email-thread', thread.id] });
    });

    const messages = data?.messages || [];

    // Mark as read when opened
    useEffect(() => {
        if (thread.unreadCount > 0) {
            emailApi.markRead(thread.id);
        }
    }, [thread.id, thread.unreadCount, emailApi]);

    // Initial expand logic: Expand last message by default, collapse others
    useEffect(() => {
        if (messages.length > 0) {
            const lastId = messages[messages.length - 1].id;
            setExpandedMessages(prev => ({
                ...prev,
                [lastId]: true
            }));
            // Scroll to bottom
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }, [messages.length]);

    const toggleExpand = (id: string) => {
        setExpandedMessages(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    return (
        <div className="flex flex-col h-full bg-background min-w-[500px]">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border bg-card/50">
                <button
                    onClick={onBack}
                    className="md:hidden p-2 hover:bg-muted rounded-full transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                </button>

                <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold tracking-tight truncate">
                        {thread.subject || '(No subject)'}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded-full bg-muted text-xs font-medium text-muted-foreground">
                            {thread.participants.length > 1 ? `${thread.participants.length} participants` : 'Private'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={onDelete}
                        className="p-2 hover:bg-red-500/10 rounded-full transition-colors group"
                        title="Delete Thread"
                    >
                        <Trash2 className="w-5 h-5 text-muted-foreground group-hover:text-red-500" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <>
                        {messages.map((message: EmailMessage) => (
                            <EmailMessageCard
                                key={message.id}
                                message={message}
                                isExpanded={!!expandedMessages[message.id]}
                                onToggleExpand={() => toggleExpand(message.id)}
                                onReply={() => onReply(message)}
                                onForward={() => onForward(message)}
                            />
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>
        </div>
    );
}
