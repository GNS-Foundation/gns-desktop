import React, { useState } from 'react';
import { useMessaging } from '../hooks/useMessaging';
import { SegmentedControl } from '../components/SegmentedControl';
import { ThreadCard } from '../components/ThreadCard';
import { MessageBubble } from '../components/MessageBubble';
import { MessageInput } from '../components/MessageInput';
import './MessagesTab.css';

export function MessagesTab() {
    const [activeTab, setActiveTab] = useState('direct'); // 'direct', 'global', 'email'
    const [selectedThread, setSelectedThread] = useState(null);
    const { send, sending, getConversations } = useMessaging();

    // Mock data - will be replaced with real data from hooks
    const mockThreads = [
        { id: 1, handle: 'alice', lastMessage: 'Hey, how are you?', unreadCount: 2, timestamp: Date.now() - 3600000 },
        { id: 2, handle: 'bob', lastMessage: 'Thanks for the info!', unreadCount: 0, timestamp: Date.now() - 86400000 },
        { id: 3, handle: 'charlie', lastMessage: 'See you tomorrow', unreadCount: 1, timestamp: Date.now() - 7200000 },
    ];

    const mockMessages = [
        { id: 1, content: 'Hey there!', timestamp: Date.now() - 3600000, isOutgoing: false },
        { id: 2, content: 'Hi! How are you?', timestamp: Date.now() - 3500000, isOutgoing: true },
        { id: 3, content: 'Doing great, thanks!', timestamp: Date.now() - 3400000, isOutgoing: false },
        { id: 4, content: 'That\'s awesome!', timestamp: Date.now() - 3300000, isOutgoing: true },
    ];

    const tabs = [
        { id: 'direct', label: 'Direct', icon: '💬', badge: 3 },
        { id: 'global', label: 'Global', icon: '🌍', badge: 0 },
        { id: 'email', label: 'Email', icon: '📧', badge: 0 },
    ];

    const handleThreadTap = (thread) => {
        setSelectedThread(thread);
    };

    const handleBackToList = () => {
        setSelectedThread(null);
    };

    const handleSendMessage = async (text) => {
        if (!selectedThread) return;

        try {
            // TODO: Replace with actual send API
            await send(selectedThread.handle, text);
            console.log('Sent message:', text, 'to:', selectedThread.handle);
        } catch (error) {
            alert(`Failed to send: ${error.message}`);
        }
    };

    const renderThreadList = () => {
        if (mockThreads.length === 0) {
            return (
                <div className="empty-state">
                    <div className="empty-icon">💬</div>
                    <h2>No conversations</h2>
                    <p>Start messaging to see your conversations here</p>
                </div>
            );
        }

        return (
            <div className="thread-list">
                {mockThreads.map((thread) => (
                    <ThreadCard
                        key={thread.id}
                        thread={thread}
                        onTap={() => handleThreadTap(thread)}
                    />
                ))}
            </div>
        );
    };

    const renderConversationView = () => {
        return (
            <div className="conversation-view">
                <div className="conversation-header">
                    <button className="back-btn" onClick={handleBackToList}>
                        ‹
                    </button>
                    <span className="conversation-title">
                        @{selectedThread.handle}
                    </span>
                    <div className="header-spacer"></div>
                </div>

                <div className="messages-list">
                    {mockMessages.map((msg) => (
                        <MessageBubble
                            key={msg.id}
                            message={msg}
                            isOutgoing={msg.isOutgoing}
                        />
                    ))}
                </div>

                <MessageInput
                    onSend={handleSendMessage}
                    disabled={sending}
                />
            </div>
        );
    };

    const renderGlobalTab = () => {
        return (
            <div className="empty-state">
                <div className="empty-icon">🌍</div>
                <h2>Global DIX Timeline</h2>
                <p>Public posts will appear here</p>
            </div>
        );
    };

    const renderEmailTab = () => {
        return (
            <div className="empty-state">
                <div className="empty-icon">📧</div>
                <h2>Email Gateway</h2>
                <p>Email messages will appear here</p>
            </div>
        );
    };

    return (
        <div className="messages-tab">
            <header className="messages-header">
                <h1>MESSAGES</h1>
            </header>

            {!selectedThread && (
                <SegmentedControl
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
            )}

            <div className="messages-content">
                {selectedThread ? (
                    renderConversationView()
                ) : (
                    <>
                        {activeTab === 'direct' && renderThreadList()}
                        {activeTab === 'global' && renderGlobalTab()}
                        {activeTab === 'email' && renderEmailTab()}
                    </>
                )}
            </div>
        </div>
    );
}
