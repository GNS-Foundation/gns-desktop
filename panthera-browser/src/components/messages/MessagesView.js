import React, { useRef } from 'react';
import { Loader2, Inbox, ChevronLeft, User, Send, MessageCircle } from 'lucide-react';
import { formatTime, parseMessageContent } from '../../utils/messageUtils';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const MessagesView = ({
    inboxMessages,
    selectedConversation,
    loadConversation,
    loadInbox,
    inboxLoading,
    onSendReply, // Renamed from handleSendReply to onSendReply (expects text)
    setSelectedConversation,
    fetchProfile
}) => {
    const { theme } = useTheme();
    const { authUser } = useAuth();
    const replyRef = useRef(null);

    const handleSend = () => {
        if (replyRef.current && replyRef.current.value.trim()) {
            onSendReply(replyRef.current.value);
            replyRef.current.value = ''; // Clear locally
        }
    };

    return (
        <div className={`min-h-full ${theme.bg} flex`}>
            {/* Thread List */}
            <div className={`w-full md:w-80 ${theme.bgSecondary} border-r ${theme.border} ${selectedConversation ? 'hidden md:block' : ''}`}>
                <div className={`p-4 border-b ${theme.border}`}>
                    <h2 className={`text-xl font-bold ${theme.text}`}>Messages</h2>
                    <p className={`${theme.textSecondary} text-sm`}>
                        {inboxMessages.length} conversation{inboxMessages.length !== 1 ? 's' : ''}
                    </p>
                </div>

                {inboxLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={32} className="text-cyan-500 animate-spin" />
                    </div>
                ) : inboxMessages.length === 0 ? (
                    <div className="text-center py-12 px-4">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Inbox size={32} className="text-gray-400" />
                        </div>
                        <h3 className={`${theme.text} font-semibold mb-2`}>No messages yet</h3>
                        <p className={`${theme.textSecondary} text-sm`}>
                            Messages you receive will appear here
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {inboxMessages.map((conv) => (
                            <button
                                key={conv.publicKey}
                                onClick={() => loadConversation(conv.publicKey, conv.handle)}
                                className={`w-full p-4 text-left ${theme.hover} transition-colors ${selectedConversation?.publicKey === conv.publicKey ? 'bg-cyan-50' : ''
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                                        {conv.handle[0]?.toUpperCase() || '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className={`font-semibold ${theme.text} truncate`}>
                                                @{conv.handle}
                                            </span>
                                            <span className={`text-xs ${theme.textMuted}`}>
                                                {formatTime(conv.lastMessage?.created_at)}
                                            </span>
                                        </div>
                                        <p className={`${theme.textSecondary} text-sm truncate`}>
                                            {parseMessageContent(conv.lastMessage)}
                                        </p>
                                        {conv.unreadCount > 0 && (
                                            <span className="inline-block mt-1 px-2 py-0.5 bg-cyan-500 text-white text-xs rounded-full">
                                                {conv.unreadCount} new
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Conversation View */}
            <div className={`flex-1 flex flex-col ${!selectedConversation ? 'hidden md:flex' : ''}`}>
                {selectedConversation ? (
                    <>
                        {/* Conversation Header */}
                        <div className={`p-4 border-b ${theme.border} ${theme.bgSecondary} flex items-center gap-3`}>
                            <button
                                onClick={() => setSelectedConversation(null)}
                                className={`md:hidden p-2 ${theme.hover} rounded`}
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white font-bold">
                                {selectedConversation.handle[0]?.toUpperCase() || '?'}
                            </div>
                            <div className="flex-1">
                                <h3 className={`font-semibold ${theme.text}`}>@{selectedConversation.handle}</h3>
                                <p className={`text-xs ${theme.textMuted} font-mono`}>
                                    {selectedConversation.publicKey.substring(0, 16)}...
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    // Try to view profile
                                    fetchProfile(selectedConversation.handle);
                                }}
                                className={`p-2 ${theme.hover} rounded ${theme.textSecondary}`}
                                title="View Profile"
                            >
                                <User size={18} />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className={`flex-1 overflow-auto p-4 space-y-4 ${theme.bg}`}>
                            {selectedConversation.messages?.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className={theme.textSecondary}>No messages in this conversation</p>
                                </div>
                            ) : (
                                selectedConversation.messages?.map((msg, i) => {
                                    const isOutgoing = msg.isOutgoing || msg.from_pk === authUser?.publicKey;
                                    return (
                                        <div key={msg.id || i} className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${isOutgoing
                                                ? 'bg-cyan-500 text-white rounded-br-md'
                                                : `${theme.bgSecondary} ${theme.text} rounded-bl-md border ${theme.border}`
                                                }`}>
                                                <p className="break-words">{parseMessageContent(msg)}</p>
                                                <p className={`text-xs mt-1 ${isOutgoing ? 'text-cyan-100' : theme.textMuted}`}>
                                                    {formatTime(msg.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Reply Input */}
                        <div className={`p-4 border-t ${theme.border} ${theme.bgSecondary}`}>
                            <div className="flex items-end gap-3">
                                <textarea
                                    ref={replyRef}
                                    placeholder="Type a message..."
                                    rows={1}
                                    className={`flex-1 p-3 ${theme.bgTertiary} ${theme.text} rounded-xl border ${theme.border} focus:border-cyan-500 outline-none resize-none placeholder-gray-400`}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                />
                                <button
                                    onClick={handleSend}
                                    className="p-3 bg-cyan-500 hover:bg-cyan-600 rounded-xl text-white"
                                >
                                    <Send size={20} />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <MessageCircle size={40} className="text-gray-400" />
                            </div>
                            <h3 className={`${theme.text} text-xl font-semibold mb-2`}>Select a conversation</h3>
                            <p className={theme.textSecondary}>Choose a conversation from the list to start messaging</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessagesView;
