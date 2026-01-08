import React from 'react';
import { Message } from '../../lib/tauri';
import { Reply, Forward, Copy, Info, Star, Trash2, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

interface MessageContextMenuProps {
    message: Message;
    position: { x: number; y: number };
    isOutgoing: boolean;
    onClose: () => void;
    onReply: (message: Message) => void;
    onForward: (message: Message) => void;
    onCopy: (text: string) => void;
    onInfo: (message: Message) => void;
    onStar: (message: Message) => void;
    onDelete: (message: Message) => void;
    onReact: (message: Message, emoji: string) => void;
}

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export function MessageContextMenu({
    message,
    position,
    isOutgoing,
    onClose,
    onReply,
    onForward,
    onCopy,
    onInfo,
    onStar,
    onDelete,
    onReact,
}: MessageContextMenuProps) {
    // Calculate top position: if too close to bottom, show above
    const menuHeight = 400; // Approximate height
    const showAbove = position.y > window.innerHeight - menuHeight;

    const menuStyle = {
        top: showAbove
            ? Math.max(16, position.y - menuHeight)
            : Math.min(position.y, window.innerHeight - menuHeight),
        left: isOutgoing
            ? Math.max(16, Math.min(position.x - 250, window.innerWidth - 270))
            : Math.max(16, Math.min(position.x, window.innerWidth - 270)),
    };

    const text = typeof message.payload === 'object' && message.payload && (message.payload as any).text
        ? (message.payload as any).text
        : String(message.payload || '');

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-start justify-center" style={{ touchAction: 'none' }}>
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                />

                {/* Menu Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="absolute w-[250px] flex flex-col gap-2 origin-top"
                    style={menuStyle}
                >
                    {/* Reaction Bar */}
                    <div className="bg-slate-800 rounded-full p-3 flex items-center justify-between shadow-xl border border-slate-700">
                        {REACTIONS.map((emoji) => (
                            <motion.button
                                key={emoji}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => {
                                    onReact(message, emoji);
                                    onClose();
                                }}
                                className="w-10 h-10 flex items-center justify-center text-2xl hover:bg-slate-700 rounded-full transition-colors active:scale-90"
                            >
                                {emoji}
                            </motion.button>
                        ))}
                        <button className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-700 rounded-full transition-colors">
                            <MoreHorizontal className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Action List */}
                    <div className="bg-slate-800 rounded-xl overflow-hidden shadow-xl border border-slate-700 flex flex-col">
                        <MenuItem icon={<Reply className="w-5 h-5" />} label="Reply" onClick={() => { onReply(message); onClose(); }} />
                        <MenuItem icon={<Forward className="w-5 h-5" />} label="Forward" onClick={() => { onForward(message); onClose(); }} />
                        <MenuItem icon={<Copy className="w-5 h-5" />} label="Copy" onClick={() => { onCopy(text); onClose(); }} />
                        <MenuItem icon={<Star className="w-5 h-5" />} label="Star" onClick={() => { onStar(message); onClose(); }} />
                        <MenuItem icon={<Info className="w-5 h-5" />} label="Info" onClick={() => { onInfo(message); onClose(); }} />
                        <div className="h-px bg-slate-700 my-1" />
                        <MenuItem
                            icon={<Trash2 className="w-5 h-5" />}
                            label="Delete"
                            onClick={() => { onDelete(message); onClose(); }}
                            variant="danger"
                        />
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

function MenuItem({
    icon,
    label,
    onClick,
    variant = 'default'
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'danger';
}) {
    return (
        <button
            onClick={onClick}
            className={clsx(
                "flex items-center gap-3 px-5 py-4 text-base font-medium transition-colors active:bg-slate-700/50 text-left",
                variant === 'danger' ? "text-red-400 hover:bg-red-900/20" : "text-slate-200 hover:bg-slate-700"
            )}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}
