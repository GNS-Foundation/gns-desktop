import React from 'react';
import './ThreadCard.css';

export function ThreadCard({ thread, onTap }) {
    const { handle, lastMessage, unreadCount, timestamp } = thread;

    const initial = (handle || 'U').charAt(0).toUpperCase();
    const displayHandle = handle ? `@${handle}` : 'Unknown';
    const hasUnread = unreadCount > 0;

    const formatTime = (ts) => {
        if (!ts) return '';
        const date = new Date(ts);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'now';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        return date.toLocaleDateString();
    };

    return (
        <div className={`thread-card ${hasUnread ? 'unread' : ''}`} onClick={onTap}>
            <div className="thread-avatar">
                {initial}
                {hasUnread && <div className="unread-dot"></div>}
            </div>

            <div className="thread-info">
                <div className="thread-header">
                    <span className={`thread-handle ${hasUnread ? 'bold' : ''}`}>
                        {displayHandle}
                    </span>
                    <span className="thread-time">{formatTime(timestamp)}</span>
                </div>

                <div className="thread-preview">
                    <span className={`preview-text ${hasUnread ? 'bold' : ''}`}>
                        {lastMessage || 'No messages'}
                    </span>
                    {unreadCount > 1 && (
                        <span className="unread-badge">{unreadCount}</span>
                    )}
                </div>
            </div>
        </div>
    );
}
