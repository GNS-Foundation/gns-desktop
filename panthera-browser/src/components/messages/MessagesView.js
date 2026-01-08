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
    fetchProfile,
    messages = [] // ✅ Accept messages prop with default empty array
}) => {
    const { theme } = useTheme();
    const { authUser } = useAuth();
    const replyRef = useRef(null);

    // Use passed messages prop OR fallback (legacy)
    const messagesToList = messages.length > 0 ? messages : (selectedConversation?.messages || []);

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
                    <div className="overflow-y-auto h-[calc(100vh-140px)]">
                        {inboxMessages.map(conversation => {
                            const isSelected = selectedConversation?.publicKey === conversation.publicKey;
                            // ... (rest of list rendering)
                            return (
                                <div
                                    key={conversation.publicKey}
                                    onClick={() => setSelectedConversation(conversation)}
                                    className={`p-4 border-b ${theme.border} cursor-pointer hover:${theme.bgTertiary} ${isSelected ? theme.bgTertiary : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-medium">
                                            {conversation.handle?.[0]?.toUpperCase() || <User size={20} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <h3 className={`font-semibold ${theme.text} truncate`}>{conversation.handle || 'Unknown'}</h3>
                                                <span className={`text-xs ${theme.textSecondary}`}>
                                                    {formatTime(conversation.lastMessage?.created_at || conversation.lastMessage?.timestamp)}
                                                </span>
                                            </div>
                                            <p className={`text-sm ${theme.textSecondary} truncate`}>
                                                {parseMessageContent(conversation.lastMessage)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Conversation View */}
            <div className={`flex-1 flex flex-col h-[calc(100vh-64px)] ${!selectedConversation ? 'hidden md:flex' : ''}`}>
                {selectedConversation ? (
                    <>
                        {/* Header */}
                        <div className={`p-4 border-b ${theme.border} flex items-center gap-3 ${theme.bgSecondary}`}>
                            <button
                                onClick={() => setSelectedConversation(null)}
                                className="md:hidden p-2 -ml-2 hover:bg-white/5 rounded-full"
                            >
                                <ChevronLeft size={20} className={theme.text} />
                            </button>
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-medium cursor-pointer"
                                onClick={() => fetchProfile(selectedConversation.handle)}>
                                {selectedConversation.handle?.[0]?.toUpperCase() || <User size={20} />}
                            </div>
                            <div className="flex-1">
                                <h3 className={`font-bold ${theme.text} cursor-pointer hover:underline`}
                                    onClick={() => fetchProfile(selectedConversation.handle)}>
                                    {selectedConversation.handle}
                                </h3>
                                <p className={`text-xs ${theme.textSecondary} font-mono`}>
                                    {selectedConversation.publicKey?.substring(0, 16)}...
                                </p>
                            </div>
                        </div>

                        {/* Messages List */}
                        <div className={`flex-1 overflow-auto p-4 space-y-4 ${theme.bg}`}>
                            {messagesToList.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className={theme.textSecondary}>No messages yet. Start the conversation!</p>
                                </div>
                            ) : (
                                messagesToList.map((msg, i) => {
                                    const isOutgoing = msg.isOutgoing;
                                    const content = parseMessageContent(msg);

                                    return (
                                        <div key={msg.id || i} className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] rounded-2xl p-3 ${isOutgoing
                                                    ? 'bg-blue-600 text-white rounded-br-none'
                                                    : `${theme.bgTertiary} ${theme.text} rounded-bl-none`
                                                }`}>
                                                <p className="whitespace-pre-wrap break-words">{content}</p>
                                                <p className={`text-[10px] mt-1 ${isOutgoing ? 'text-blue-200' : theme.textSecondary}`}>
                                                    {formatTime(msg.created_at || msg.timestamp)}
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
