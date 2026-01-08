import { format } from 'date-fns';
import { Reply, Forward, Download } from 'lucide-react';
import clsx from 'clsx';
import { EmailMessage } from '@gns/api-core';

interface EmailMessageCardProps {
    message: EmailMessage;
    isExpanded?: boolean;
    onToggleExpand: () => void;
    onReply: () => void;
    onForward: () => void;
}

export function EmailMessageCard({
    message,
    isExpanded = true,
    onToggleExpand,
    onReply,
    onForward
}: EmailMessageCardProps) {
    // Format date: "Jan 8, 10:30 AM" or "10:30 AM" if today
    // For now simple format
    const dateStr = message.receivedAt
        ? format(new Date(message.receivedAt), 'MMM d, h:mm a')
        : 'Unknown date';

    return (
        <div
            className="border border-border rounded-lg bg-card overflow-hidden transition-all duration-200"
        >
            {/* Header - Click to toggle */}
            <div
                onClick={onToggleExpand}
                className={clsx(
                    "flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/50",
                    !isExpanded && "bg-muted/30"
                )}
            >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                    {message.from.name?.[0] || message.from.address[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-2">
                            <span className="font-semibold text-sm">
                                {message.from.name || message.from.address.split('@')[0]}
                            </span>
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                &lt;{message.from.address}&gt;
                            </span>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                            {dateStr}
                        </span>
                    </div>

                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                        to {message.to.map(t => t.name || t.address.split('@')[0]).join(', ')}
                    </div>

                    {/* Snippet if collapsed */}
                    {!isExpanded && (
                        <div className="text-sm text-foreground/70 truncate mt-2">
                            {message.body.substring(0, 100).replace(/\n/g, ' ')}
                        </div>
                    )}
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="px-4 pb-4">
                    {/* Body */}
                    <div className="mt-4 text-sm whitespace-pre-wrap leading-relaxed border-t border-border/50 pt-4 text-foreground/90">
                        {message.body}
                    </div>

                    {/* Attachments (if any) */}
                    {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-4 pt-4 flex flex-wrap gap-2 border-t border-border/50">
                            {message.attachments.map(att => (
                                <div key={att.id} className="flex items-center gap-2 p-2 border border-border rounded-md bg-muted/20 hover:bg-muted text-xs cursor-pointer group">
                                    <div className="w-8 h-8 rounded bg-background flex items-center justify-center text-muted-foreground">
                                        File
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-medium truncate max-w-[150px]">{att.filename}</span>
                                        <span className="text-[10px] text-muted-foreground">{(att.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                    <Download size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Actions Footer */}
                    <div className="flex gap-2 mt-6 pt-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); onReply(); }}
                            className="flex items-center gap-2 px-4 py-2 rounded-full border border-border hover:bg-muted text-sm font-medium transition-colors"
                        >
                            <Reply size={16} />
                            Reply
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onForward(); }}
                            className="flex items-center gap-2 px-4 py-2 rounded-full border border-border hover:bg-muted text-sm font-medium transition-colors"
                        >
                            <Forward size={16} />
                            Forward
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
