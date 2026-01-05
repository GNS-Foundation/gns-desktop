import { Message } from '../../lib/tauri';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface ReplyPreviewProps {
    message: Message;
    onClose: () => void;
}

export function ReplyPreview({ message, onClose }: ReplyPreviewProps) {
    const isMe = message.is_outgoing;
    const text = typeof message.payload === 'object' && message.payload && (message.payload as any).text
        ? (message.payload as any).text
        : String(message.payload || '');

    return (
        <div className="flex items-center gap-2 p-2 bg-slate-800/50 border-t border-slate-700 backdrop-blur-sm">
            <div className={clsx(
                "w-1 self-stretch rounded-full",
                isMe ? "bg-blue-500" : "bg-purple-500"
            )} />

            <div className="flex-1 min-w-0">
                <div className={clsx(
                    "text-xs font-medium mb-0.5",
                    isMe ? "text-blue-400" : "text-purple-400"
                )}>
                    {isMe ? 'You' : (message.from_handle || 'Unknown')}
                </div>
                <div className="text-sm text-slate-300 truncate">
                    {text}
                </div>
            </div>

            <button
                onClick={onClose}
                className="p-1 hover:bg-slate-700 rounded-full transition-colors"
            >
                <X className="w-4 h-4 text-slate-400" />
            </button>
        </div>
    );
}
