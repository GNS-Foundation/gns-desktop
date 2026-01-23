/**
 * @file GNS E2E Encrypted Messaging
 * @description End-to-end encrypted messaging using X25519 key exchange and ChaCha20-Poly1305
 * @module @anthropic/tauri-plugin-gns-api/messaging
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  Message,
  SendMessageParams,
  Conversation,
  MessageQuery,
  DecryptedPayload,
} from './types';

/**
 * Send an encrypted message to another GNS identity.
 * 
 * Messages are encrypted using:
 * 1. Ephemeral X25519 keypair for forward secrecy
 * 2. X25519 Diffie-Hellman key exchange
 * 3. HKDF key derivation
 * 4. ChaCha20-Poly1305 AEAD encryption
 * 5. Ed25519 signature for authenticity
 * 
 * @example
 * ```typescript
 * // Send to @handle
 * const msg = await sendMessage({
 *   to: '@alice',
 *   payload: { type: 'text', content: 'Hello!' },
 * });
 * 
 * // Send to public key
 * const msg2 = await sendMessage({
 *   to: 'abc123...',
 *   payload: { type: 'text', content: 'Hello!', metadata: { urgent: true } },
 * });
 * ```
 * 
 * @param params - Message parameters
 * @returns The sent message
 */
export async function sendMessage(params: SendMessageParams): Promise<Message> {
  return invoke<Message>('plugin:gns|send_message', { params });
}

/**
 * Convenience function to send a text message.
 * 
 * @example
 * ```typescript
 * await sendTextMessage('@alice', 'Hello!');
 * ```
 * 
 * @param to - Recipient (@handle or public key)
 * @param content - Text content
 * @param replyTo - Optional message ID to reply to
 * @returns The sent message
 */
export async function sendTextMessage(
  to: string,
  content: string,
  replyTo?: string
): Promise<Message> {
  return sendMessage({
    to,
    payload: {
      type: 'text',
      content,
      replyTo,
    },
  });
}

/**
 * Get messages for the active identity.
 * 
 * @example
 * ```typescript
 * // Get all messages
 * const all = await getMessages();
 * 
 * // Get messages from specific peer
 * const fromAlice = await getMessages({ peerPk: 'abc123...' });
 * 
 * // Get unread messages only
 * const unread = await getMessages({ unreadOnly: true, limit: 50 });
 * ```
 * 
 * @param query - Optional query parameters
 * @returns Array of messages
 */
export async function getMessages(query?: MessageQuery): Promise<Message[]> {
  return invoke<Message[]>('plugin:gns|get_messages', { query: query ?? null });
}

/**
 * Get a single message by ID.
 * 
 * @example
 * ```typescript
 * const msg = await getMessage('uuid-here');
 * if (msg) {
 *   console.log(`From: ${msg.fromPk}`);
 * }
 * ```
 * 
 * @param messageId - Message UUID
 * @returns The message, or null if not found
 */
export async function getMessage(messageId: string): Promise<Message | null> {
  return invoke<Message | null>('plugin:gns|get_message', { messageId });
}

/**
 * Decrypt a message's payload.
 * 
 * Note: Requires the message's ephemeral key for decryption.
 * Messages sent by you are stored with decrypted cache.
 * 
 * @example
 * ```typescript
 * const payload = await decryptMessage('uuid-here');
 * console.log(`Type: ${payload.type}, Content: ${payload.content}`);
 * ```
 * 
 * @param messageId - Message UUID
 * @returns Decrypted payload
 */
export async function decryptMessage(messageId: string): Promise<DecryptedPayload> {
  return invoke<DecryptedPayload>('plugin:gns|decrypt_message', { messageId });
}

/**
 * Mark a message as read.
 * 
 * @example
 * ```typescript
 * await markAsRead('uuid-here');
 * ```
 * 
 * @param messageId - Message UUID
 */
export async function markAsRead(messageId: string): Promise<void> {
  return invoke<void>('plugin:gns|mark_as_read', { messageId });
}

/**
 * Mark multiple messages as read.
 * 
 * @example
 * ```typescript
 * await markMultipleAsRead(['uuid-1', 'uuid-2', 'uuid-3']);
 * ```
 * 
 * @param messageIds - Array of message UUIDs
 */
export async function markMultipleAsRead(messageIds: string[]): Promise<void> {
  await Promise.all(messageIds.map(id => markAsRead(id)));
}

/**
 * Delete a message locally.
 * 
 * Note: This only removes the message from local storage.
 * The recipient's copy is not affected.
 * 
 * @example
 * ```typescript
 * await deleteMessage('uuid-here');
 * ```
 * 
 * @param messageId - Message UUID
 */
export async function deleteMessage(messageId: string): Promise<void> {
  return invoke<void>('plugin:gns|delete_message', { messageId });
}

/**
 * Get all conversations for the active identity.
 * 
 * Conversations are grouped by peer and sorted by most recent activity.
 * 
 * @example
 * ```typescript
 * const conversations = await getConversations();
 * conversations.forEach(conv => {
 *   console.log(`${conv.peerHandle ?? conv.peerPk}: ${conv.unreadCount} unread`);
 * });
 * ```
 * 
 * @returns Array of conversations
 */
export async function getConversations(): Promise<Conversation[]> {
  return invoke<Conversation[]>('plugin:gns|get_conversations');
}

/**
 * Send a typing indicator to a peer.
 * 
 * @example
 * ```typescript
 * await sendTypingIndicator('@alice');
 * ```
 * 
 * @param to - Recipient (@handle or public key)
 */
export async function sendTypingIndicator(to: string): Promise<void> {
  await sendMessage({
    to,
    payload: {
      type: 'typing',
      content: '',
    },
  });
}

/**
 * Send a read receipt for a message.
 * 
 * @example
 * ```typescript
 * await sendReadReceipt('@alice', 'original-message-uuid');
 * ```
 * 
 * @param to - Recipient (@handle or public key)
 * @param messageId - ID of the message that was read
 */
export async function sendReadReceipt(to: string, messageId: string): Promise<void> {
  await sendMessage({
    to,
    payload: {
      type: 'readReceipt',
      content: messageId,
    },
  });
}

/**
 * Send a file message with URL and metadata.
 * 
 * Note: The file must be uploaded separately. This sends metadata only.
 * 
 * @example
 * ```typescript
 * await sendFileMessage('@alice', 'https://files.example.com/doc.pdf', {
 *   name: 'document.pdf',
 *   size: 1024000,
 *   mimeType: 'application/pdf',
 * });
 * ```
 * 
 * @param to - Recipient (@handle or public key)
 * @param url - URL to the file
 * @param metadata - File metadata
 */
export async function sendFileMessage(
  to: string,
  url: string,
  metadata: {
    name: string;
    size?: number;
    mimeType?: string;
  }
): Promise<Message> {
  return sendMessage({
    to,
    payload: {
      type: 'file',
      content: url,
      metadata,
    },
  });
}

/**
 * Send an image message.
 * 
 * @example
 * ```typescript
 * await sendImageMessage('@alice', 'https://images.example.com/photo.jpg', {
 *   width: 1920,
 *   height: 1080,
 *   alt: 'Sunset photo',
 * });
 * ```
 * 
 * @param to - Recipient (@handle or public key)
 * @param url - URL to the image
 * @param metadata - Image metadata
 */
export async function sendImageMessage(
  to: string,
  url: string,
  metadata?: {
    width?: number;
    height?: number;
    alt?: string;
    thumbnailUrl?: string;
  }
): Promise<Message> {
  return sendMessage({
    to,
    payload: {
      type: 'image',
      content: url,
      metadata,
    },
  });
}

/**
 * Send a location message.
 * 
 * @example
 * ```typescript
 * await sendLocationMessage('@alice', {
 *   lat: 37.7749,
 *   lng: -122.4194,
 *   name: 'San Francisco',
 * });
 * ```
 * 
 * @param to - Recipient (@handle or public key)
 * @param location - Location data
 */
export async function sendLocationMessage(
  to: string,
  location: {
    lat: number;
    lng: number;
    name?: string;
    address?: string;
  }
): Promise<Message> {
  return sendMessage({
    to,
    payload: {
      type: 'location',
      content: JSON.stringify(location),
      metadata: location,
    },
  });
}

/**
 * Fetch new messages from relay servers.
 * 
 * This is typically called automatically, but can be triggered manually.
 * 
 * @example
 * ```typescript
 * const newMessages = await fetchMessages();
 * console.log(`Received ${newMessages.length} new messages`);
 * ```
 * 
 * @param since - Only fetch messages after this timestamp
 * @returns Newly fetched messages
 */
export async function fetchMessages(since?: string): Promise<Message[]> {
  // This would need a dedicated command in the Rust backend
  // For now, just return messages from storage
  return getMessages(since ? { after: since } : undefined);
}
