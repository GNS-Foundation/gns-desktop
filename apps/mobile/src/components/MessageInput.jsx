import React, { useState } from 'react';
import './MessageInput.css';

export function MessageInput({ onSend, disabled = false }) {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!text.trim() || sending || disabled) return;

        try {
            setSending(true);
            await onSend(text.trim());
            setText('');
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setSending(false);
        }
    };

    return (
        <form className="message-input" onSubmit={handleSubmit}>
            <input
                type="text"
                className="message-text-input"
                placeholder="Type a message..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={sending || disabled}
            />
            <button
                type="submit"
                className="message-send-btn"
                disabled={!text.trim() || sending || disabled}
            >
                {sending ? '⏳' : '📤'}
            </button>
        </form>
    );
}
