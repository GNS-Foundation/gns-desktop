import React, { useRef } from 'react';
import { Message } from '../../lib/tauri';
import { CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

interface MessageBubbleProps {
    message: Message;
    isMe: boolean;
    isSelected: boolean;
    selectionMode: boolean;
    onLongPress: (message: Message, position: { x: number; y: number }) => void;
    onSelect: (message: Message) => void;
}

export function MessageBubble({
    message,
    isMe,
    isSelected,
    selectionMode,
    onLongPress,
    onSelect,
}: MessageBubbleProps) {
    const bubbleRef = useRef<HTMLDivElement>(null);
    const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const text = typeof message.payload === 'object' && message.payload && (message.payload as any).text
        ? (message.payload as any).text
        : String(message.payload || '');

    const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
        // If in selection mode, just select
        if (selectionMode) {
            return;
        }

        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        pressTimer.current = setTimeout(() => {
            // Trigger long press
            if (navigator.vibrate) navigator.vibrate(50);
            onLongPress(message, { x: clientX, y: clientY });
        }, 500);
    };

    const handleTouchEnd = () => {
        if (pressTimer.current) {
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
        }
    };

    const handleTouchMove = () => {
        if (pressTimer.current) {
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
        }
    };

    return (
        <div
            className={clsx(
                "flex mb-6 relative transition-colors", // Increased mb-4 to mb-6 for reaction space
                isMe ? "justify-end" : "justify-start",
                isSelected && "bg-blue-900/20 -mx-4 px-4 py-2"
            )}
            onClick={() => {
                if (selectionMode) {
                    onSelect(message);
                }
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onMouseDown={handleTouchStart}
            onMouseUp={handleTouchEnd}
            onMouseLeave={handleTouchEnd}
            ref={bubbleRef}
        >
            {selectionMode && (
                <div className={clsx(
                    "flex items-center justify-center mr-3",
                    isMe ? "order-last ml-3 mr-0" : ""
                )}>
                    {isSelected ? (
                        <CheckCircle className="w-6 h-6 text-blue-500 fill-blue-500/20" />
                    ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-slate-600" />
                    )}
                </div>
            )}

            <div
                className={clsx(
                    "max-w-[80%] rounded-2xl px-4 py-2 shadow-sm transition-transform duration-200",
                    isMe
                        ? "bg-blue-600 text-white rounded-br-none"
                        : "bg-slate-800 text-slate-200 rounded-bl-none",
                    message.status === 'sending' && "opacity-70",
                    message.status === 'failed' && "border-2 border-red-500/50",
                    // Add subtle scale effect on active press could be done with active:scale-95
                    "active:scale-[0.98]"
                )}
            >
                {/* Reply Quote */}
                {message.reply_to && (
                    <div className={clsx(
                        "mb-2 rounded-lg p-2 text-sm border-l-4 cursor-pointer",
                        isMe
                            ? "bg-blue-700/50 border-blue-300"
                            : "bg-slate-900/30 border-purple-400"
                    )}>
                        <div className={clsx(
                            "font-medium text-xs mb-0.5",
                            isMe ? "text-blue-200" : "text-purple-300"
                        )}>
                            {message.reply_to.is_outgoing ? 'You' : (message.reply_to.from_handle || 'Unknown')}
                        </div>
                        <div className="opacity-80 truncate">
                            {typeof message.reply_to.payload === 'object' && message.reply_to.payload && (message.reply_to.payload as any).text
                                ? (message.reply_to.payload as any).text
                                : String(message.reply_to.payload || '')}
                        </div>
                    </div>
                )}

                <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                    {text}
                </p>
                <div className={clsx(
                    "text-[10px] mt-1 flex items-center gap-1",
                    isMe ? "text-blue-200 justify-start" : "text-slate-400 justify-end"
                )}>
                    <span>{format(new Date(message.timestamp), 'h:mm a')}</span>
                    {message.status === 'sending' && <span>• sending...</span>}
                    {message.status === 'failed' && <span className="text-red-300">• failed</span>}
                </div>

                {/* Reactions */}
                {message.reactions && message.reactions.length > 0 && (
                    <div className={clsx(
                        "absolute -bottom-3 flex flex-wrap gap-1 z-10",
                        isMe ? "right-0" : "left-0"
                    )}>
                        {Array.from(new Set(message.reactions.map(r => r.emoji))).map((emoji) => {
                            const count = message.reactions.filter(r => r.emoji === emoji).length;
                            return (
                                <div key={emoji} className={clsx(
                                    "flex items-center gap-1 rounded-full px-2 py-1 text-xs shadow-md border-2 border-slate-950",
                                    "bg-slate-800 text-slate-200"
                                )}>
                                    <span>{emoji}</span>
                                    {count > 1 && <span className="text-[10px] font-bold">{count}</span>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
