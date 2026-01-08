import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEmailApi } from '../../hooks/useApi';
import { EmailMessage } from '@gns/api-core';
import {
    X,
    Send,
    Paperclip,
    Trash2,
    Lock,
    Globe,
    Loader2,
    Minus,
    Maximize2
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface EmailComposeProps {
    replyTo?: EmailMessage;
    replyAll?: boolean;
    forward?: EmailMessage;
    onClose: () => void;
    onSent: () => void;
}

export function EmailCompose({ replyTo, replyAll, forward, onClose, onSent }: EmailComposeProps) {
    const queryClient = useQueryClient();
    const emailApi = useEmailApi();
    const [isMinimized, setIsMinimized] = useState(false);
    const [showCc, setShowCc] = useState(false);
    const [showBcc, setShowBcc] = useState(false);

    // Form state
    const [to, setTo] = useState<string>('');
    const [cc, setCc] = useState<string>('');
    const [bcc, setBcc] = useState<string>('');
    const [subject, setSubject] = useState<string>('');
    const [body, setBody] = useState<string>('');
    const [attachments, setAttachments] = useState<File[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const bodyRef = useRef<HTMLTextAreaElement>(null);

    // Pre-fill from reply/forward
    useEffect(() => {
        if (replyTo) {
            // Reply
            setTo(replyTo.from.address);
            if (replyAll) {
                const ccAddresses = [
                    ...replyTo.to.map(t => t.address),
                    ...(replyTo.cc?.map(c => c.address) || [])
                ].filter(addr => addr !== replyTo.from.address);
                if (ccAddresses.length > 0) {
                    setShowCc(true);
                    setCc(ccAddresses.join(', '));
                }
            }
            setSubject(replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`);
            setBody(`\n\n---\nOn ${new Date(replyTo.createdAt).toLocaleString()}, ${replyTo.from.name || replyTo.from.address} wrote:\n\n${replyTo.body}`);
        } else if (forward) {
            // Forward
            setSubject(forward.subject.startsWith('Fwd:') ? forward.subject : `Fwd: ${forward.subject}`);
            setBody(`\n\n---\nForwarded message:\nFrom: ${forward.from.name || forward.from.address}\nDate: ${new Date(forward.createdAt).toLocaleString()}\nSubject: ${forward.subject}\n\n${forward.body}`);
        }
    }, [replyTo, replyAll, forward]);

    // Focus body on mount
    useEffect(() => {
        bodyRef.current?.focus();
    }, []);

    const sendMutation = useMutation({
        mutationFn: () => emailApi.send({
            to: to.split(',').map(s => s.trim()).filter(Boolean),
            cc: showCc ? cc.split(',').map(s => s.trim()).filter(Boolean) : undefined,
            bcc: showBcc ? bcc.split(',').map(s => s.trim()).filter(Boolean) : undefined,
            subject,
            body,
            replyToId: replyTo?.id,
            attachments,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['email-threads'] });
            onSent();
            onClose();
        },
    });

    const handleSend = () => {
        if (!to.trim()) {
            alert('Please enter a recipient');
            return;
        }
        sendMutation.mutate();
    };

    const handleAttach = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        setAttachments(prev => [...prev, ...files]);
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    // Check if recipient is internal GNS
    const isInternalEmail = to.includes('@gcrumbs.com') || !to.includes('@');

    if (isMinimized) {
        return (
            <div className="fixed bottom-0 right-4 w-72 bg-slate-800 rounded-t-xl border border-white/10 shadow-2xl">
                <div
                    className="flex items-center justify-between p-3 cursor-pointer"
                    onClick={() => setIsMinimized(false)}
                >
                    <span className="text-sm font-medium text-white truncate">
                        {subject || 'New Message'}
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}
                            className="p-1 hover:bg-white/10 rounded"
                        >
                            <Maximize2 className="w-4 h-4 text-slate-400" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            className="p-1 hover:bg-white/10 rounded"
                        >
                            <X className="w-4 h-4 text-slate-400" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="text-lg font-semibold text-white">
                        {replyTo ? 'Reply' : forward ? 'Forward' : 'New Message'}
                    </h3>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsMinimized(true)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <Minus className="w-4 h-4 text-slate-400" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X className="w-4 h-4 text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Form */}
                <div className="flex-1 overflow-y-auto">
                    {/* To */}
                    <div className="flex items-center border-b border-white/10">
                        <label className="px-4 py-3 text-sm text-slate-500 w-16">To</label>
                        <input
                            type="text"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            placeholder="recipient@example.com or @handle"
                            className="flex-1 bg-transparent px-2 py-3 text-white placeholder-slate-500 focus:outline-none"
                        />
                        <div className="flex items-center gap-1 pr-2">
                            {!showCc && (
                                <button
                                    onClick={() => setShowCc(true)}
                                    className="px-2 py-1 text-xs text-slate-400 hover:text-white"
                                >
                                    Cc
                                </button>
                            )}
                            {!showBcc && (
                                <button
                                    onClick={() => setShowBcc(true)}
                                    className="px-2 py-1 text-xs text-slate-400 hover:text-white"
                                >
                                    Bcc
                                </button>
                            )}
                            {isInternalEmail ? (
                                <span title="End-to-end encrypted"><Lock className="w-4 h-4 text-green-500" /></span>
                            ) : (
                                <span title="External email"><Globe className="w-4 h-4 text-slate-500" /></span>
                            )}
                        </div>
                    </div>

                    {/* Cc */}
                    {showCc && (
                        <div className="flex items-center border-b border-white/10">
                            <label className="px-4 py-3 text-sm text-slate-500 w-16">Cc</label>
                            <input
                                type="text"
                                value={cc}
                                onChange={(e) => setCc(e.target.value)}
                                placeholder="cc@example.com"
                                className="flex-1 bg-transparent px-2 py-3 text-white placeholder-slate-500 focus:outline-none"
                            />
                            <button
                                onClick={() => { setShowCc(false); setCc(''); }}
                                className="p-2 text-slate-500 hover:text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Bcc */}
                    {showBcc && (
                        <div className="flex items-center border-b border-white/10">
                            <label className="px-4 py-3 text-sm text-slate-500 w-16">Bcc</label>
                            <input
                                type="text"
                                value={bcc}
                                onChange={(e) => setBcc(e.target.value)}
                                placeholder="bcc@example.com"
                                className="flex-1 bg-transparent px-2 py-3 text-white placeholder-slate-500 focus:outline-none"
                            />
                            <button
                                onClick={() => { setShowBcc(false); setBcc(''); }}
                                className="p-2 text-slate-500 hover:text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Subject */}
                    <div className="flex items-center border-b border-white/10">
                        <label className="px-4 py-3 text-sm text-slate-500 w-16">Subject</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Subject"
                            className="flex-1 bg-transparent px-2 py-3 text-white placeholder-slate-500 focus:outline-none"
                        />
                    </div>

                    {/* Body */}
                    <textarea
                        ref={bodyRef}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Write your message..."
                        className="w-full min-h-[200px] p-4 bg-transparent text-white placeholder-slate-500 focus:outline-none resize-none"
                    />

                    {/* Attachments */}
                    {attachments.length > 0 && (
                        <div className="px-4 pb-4 space-y-2">
                            {attachments.map((file, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-2 p-2 bg-slate-800 rounded-lg"
                                >
                                    <Paperclip className="w-4 h-4 text-slate-500" />
                                    <span className="flex-1 text-sm text-slate-300 truncate">
                                        {file.name}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                        {(file.size / 1024).toFixed(1)} KB
                                    </span>
                                    <button
                                        onClick={() => removeAttachment(index)}
                                        className="p-1 hover:bg-white/10 rounded"
                                    >
                                        <X className="w-3 h-3 text-slate-400" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-white/10">
                    <div className="flex items-center gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <button
                            onClick={handleAttach}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            title="Attach files"
                        >
                            <Paperclip className="w-5 h-5 text-slate-400" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Discard"
                        >
                            <Trash2 className="w-5 h-5 text-red-400" />
                        </button>
                    </div>

                    <button
                        onClick={handleSend}
                        disabled={sendMutation.isPending || !to.trim()}
                        className={cn(
                            "flex items-center gap-2 px-6 py-2 rounded-full font-medium transition-all",
                            sendMutation.isPending || !to.trim()
                                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                                : "bg-indigo-600 hover:bg-indigo-500 text-white"
                        )}
                    >
                        {sendMutation.isPending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                Send
                            </>
                        )}
                    </button>
                </div>

                {/* Error */}
                {sendMutation.isError && (
                    <div className="px-4 pb-4">
                        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                            Failed to send: {(sendMutation.error as Error).message}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
