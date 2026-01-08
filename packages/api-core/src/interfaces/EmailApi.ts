import { EmailThread, EmailMessage, EmailComposeData, EmailFolder } from '../types/email';

export interface EmailApi {
    /**
     * Get email threads
     */
    getThreads(options?: {
        folder?: EmailFolder;
        limit?: number;
        offset?: number;
        filter?: 'all' | 'unread' | 'starred';
    }): Promise<{ threads: EmailThread[]; stats: { unreadCount: number } }>;

    /**
     * Get single thread with all messages
     */
    getThread(threadId: string): Promise<{
        thread: EmailThread;
        messages: EmailMessage[]
    }>;

    /**
     * Send email
     */
    send(data: EmailComposeData): Promise<{ messageId: string }>;

    /**
     * Mark thread as read
     */
    markRead(threadId: string): Promise<void>;

    /**
     * Toggle star on thread
     */
    toggleStar(threadId: string): Promise<{ isStarred: boolean }>;

    /**
     * Delete thread
     */
    deleteThread(threadId: string): Promise<void>;

    /**
     * Get user's email address
     */
    getMyAddress(): Promise<{ address: string; handle: string }>;

    /**
     * Request decryption of messages (for web/desktop client from mobile)
     */
    requestDecryption?(messageIds: string[], conversationWith: string): Promise<void>;
}
