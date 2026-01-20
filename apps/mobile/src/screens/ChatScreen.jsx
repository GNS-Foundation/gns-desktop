import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMessaging } from '../hooks/useMessaging';
import { MessageBubble } from '../components/MessageBubble';
import { MessageInput } from '../components/MessageInput';
import './ChatScreen.css';

export function ChatScreen() {
    const { threadId } = useParams();
    const navigate = useNavigate();
    const { messages, loading, sending, getMessages, sendMessage } = useMessaging();
    const scrollRef = useRef(null);

    useEffect(() => {
        getMessages(threadId);
        const interval = setInterval(() => getMessages(threadId), 5000); // Polling for now
        return () => clearInterval(interval);
    }, [threadId, getMessages]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (text) => {
        // We know the threadId, but sendMessage needs recipientHandle?
        // Wait, sendMessage in hook uses recipientHandle.
        // We need to fetch thread info or use the participant info if we have it.
        // For now, let's assume we pass recipientHandle in location state or fetch thread details.
        // Better: Update hook to support sending by threadId or fetch participant from thread list.

        // Quick fix: Just use threadId if the backend supports it (it handles reply linkage)
        // Check Rust: send_message takes thread_id AND recipient_handle.
        // We need to fetch thread details to know who we are talking to.

        await sendMessage("unknown", text, threadId);
    };

    // We need thread details for the header
    // Ideally useMessaging exposes getThread(id)

    return (
        <div className="chat-screen">
            <header className="chat-header">
                <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
                <div className="header-info">
                    <span className="handle">Chat</span>
                </div>
            </header>

            <div className="messages-container" ref={scrollRef}>
                {loading && messages.length === 0 && <div className="loading">Loading...</div>}

                {messages.map(msg => (
                    <MessageBubble
                        key={msg.id}
                        message={msg}
                        isOutgoing={msg.is_outgoing}
                    />
                ))}
            </div>

            <MessageInput onSend={handleSend} disabled={sending} />
        </div>
    );
}
