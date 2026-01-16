import React from 'react';
import './MessageBubble.css';

export function MessageBubble({ message, isOutgoing }) {
    const { content, timestamp } = message;

    const formatTime = (ts) => {
        if (!ts) return '';
        const date = new Date(ts);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className={`message-bubble-container ${isOutgoing ? 'outgoing' : 'incoming'}`}>
            <div className={`message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`}>
                <div className="message-content">{content}</div>
                <div className="message-time">{formatTime(timestamp)}</div>
            </div>
        </div>
    );
}
