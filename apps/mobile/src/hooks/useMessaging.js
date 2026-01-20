import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useMessaging() {
    const [threads, setThreads] = useState([]);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);

    const getThreads = useCallback(async (limit = 50) => {
        try {
            setLoading(true);
            const res = await invoke('get_threads', { limit });
            setThreads(res);
            setError(null);
            return res;
        } catch (e) {
            console.error('Failed to get threads:', e);
            setError(e.toString());
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const getMessages = useCallback(async (threadId, limit = 50) => {
        try {
            setLoading(true);
            const res = await invoke('get_messages', { threadId, limit });
            // Sort by timestamp asc for chat view
            res.sort((a, b) => a.timestamp - b.timestamp);
            setMessages(res);
            setError(null);
            return res;
        } catch (e) {
            console.error('Failed to get messages:', e);
            setError(e.toString());
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const sendMessage = async (recipientHandle, text, threadId = null) => {
        try {
            setSending(true);
            const payload = { text, type: "text/plain" }; // Standardize payload
            // Backend expects: recipient_handle, recipient_public_key, payload_type, payload...

            const res = await invoke('send_message', {
                recipientHandle: recipientHandle.startsWith('@') ? recipientHandle : `@${recipientHandle}`,
                recipientPublicKey: null, // Let backend resolve handle
                payloadType: 'gns/chat',
                payload: payload,
                threadId: threadId,
                replyToId: null
            });

            // Optimistic update or refresh
            if (threadId) {
                await getMessages(threadId);
            } else {
                await getThreads();
            }

            return res;
        } catch (e) {
            console.error('Failed to send message:', e);
            throw e;
        } finally {
            setSending(false);
        }
    };

    const markRead = async (threadId) => {
        try {
            await invoke('mark_thread_read', { threadId });
            // Update local state
            setThreads(prev => prev.map(t =>
                t.id === threadId ? { ...t, unread_count: 0 } : t
            ));
        } catch (e) {
            console.error('Failed to mark read:', e);
        }
    };

    return {
        threads,
        messages,
        loading,
        sending,
        error,
        getThreads,
        getMessages,
        sendMessage,
        markRead
    };
}
