import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMessaging } from '../hooks/useMessaging';
import { SegmentedControl } from '../components/SegmentedControl';
import { ThreadCard } from '../components/ThreadCard';
import { DixTimelineScreen } from './DixTimelineScreen';
import './MessagesTab.css';

export function MessagesTab() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('direct'); // 'direct', 'global', 'email'
    const { threads, loading, getThreads } = useMessaging();

    useEffect(() => {
        if (activeTab === 'direct') {
            getThreads();
        }
    }, [activeTab, getThreads]);

    const tabs = [
        { id: 'direct', label: 'Direct', icon: '💬', badge: 0 },
        { id: 'global', label: 'Global', icon: '🌍', badge: 0 },
        { id: 'email', label: 'Email', icon: '📧', badge: 0 },
    ];

    const renderThreadList = () => {
        if (loading && threads.length === 0) return <div className="loading">Loading...</div>;

        if (threads.length === 0) {
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
                {threads.map((thread) => (
                    <ThreadCard
                        key={thread.id}
                        thread={{
                            ...thread,
                            handle: thread.participant_handle || 'Unknown',
                            lastMessage: thread.last_message_preview,
                            timestamp: thread.last_message_at
                        }}
                        onTap={() => navigate(`/chat/${thread.id}`)}
                    />
                ))}
            </div>
        );
    };

    const renderEmailTab = () => {
        return (
            <div className="empty-state">
                <div className="empty-icon">📧</div>
                <h2>Email Gateway</h2>
                <p>Email messages will be integrated here.</p>
            </div>
        );
    };

    return (
        <div className="messages-tab">
            <header className="messages-header">
                <h1>MESSAGES</h1>
            </header>

            <SegmentedControl
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
            />

            <div className="messages-content">
                {activeTab === 'direct' && renderThreadList()}
                {activeTab === 'global' && <DixTimelineScreen />}
                {activeTab === 'email' && renderEmailTab()}
            </div>
        </div>
    );
}
