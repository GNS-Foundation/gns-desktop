import { useState } from 'react';
import { sendMessage, getMessages, getConversations } from 'tauri-plugin-gns-api';

/**
 * Hook for messaging functionality
 */
export function useMessaging() {
    const [sending, setSending] = useState(false);

    async function send(to, content) {
        try {
            setSending(true);
            const result = await sendMessage({
                to,
                messageType: 'text',
                content,
            });
            return result;
        } finally {
            setSending(false);
        }
    }

    return {
        send,
        sending,
        getMessages,
        getConversations,
    };
}
