
// messageUtils.js
// Utility functions for formatting dates and parsing message content

// Format timestamp
export const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
    return date.toLocaleDateString();
};

// Parse message content - handles both encrypted and plaintext
export const parseMessageContent = (msg) => {
    if (!msg) return 'Unable to parse message';

    try {
        // ✅ NEW: Check for synced message (already plaintext from mobile)
        if (msg._synced || msg.text) {
            return msg.text || msg.decryptedText;
        }

        // ✅ Check for pre-decrypted text first
        if (msg.decryptedText) {
            return msg.decryptedText;
        } else if (msg.isOutgoing) {
            // console.log(`⚠️ Outgoing message has NO decryptedText, id=${msg.id?.substring(0, 16)}`);
        }

        // Check if it's an encrypted envelope (not yet decrypted) - check BOTH locations
        const hasEncryption = (msg.encryptedPayload && msg.ephemeralPublicKey && msg.nonce) ||
            (msg.envelope?.encryptedPayload && msg.envelope?.ephemeralPublicKey && msg.envelope?.nonce);

        if (hasEncryption) {
            const session = JSON.parse(localStorage.getItem('gns_browser_session') || '{}');

            // ✅ For outgoing encrypted messages
            const isOutgoing = msg.isOutgoing || msg.from_pk?.toLowerCase() === session.publicKey?.toLowerCase();
            if (isOutgoing) {
                // Check if this message has sender encryption fields (new dual encryption)
                const hasSenderFields = (msg.senderEncryptedPayload && msg.senderEphemeralPublicKey && msg.senderNonce) ||
                    (msg.envelope?.senderEncryptedPayload && msg.envelope?.senderEphemeralPublicKey && msg.envelope?.senderNonce);

                if (!hasSenderFields) {
                    // Old message without dual encryption - can't decrypt
                    return '📤 Message sent (old format)';
                }

                if (!session.encryptionPrivateKey) {
                    return '🔐 [Encrypted - re-pair to decrypt]';
                }
                // Has sender fields - let decryption useEffect handle it
                return '🔓 [Decrypting...]';
            }

            if (!session.encryptionPrivateKey) {
                return '🔐 [Encrypted - re-pair to decrypt]';
            }
            return '🔓 [Decrypting...]';
        }

        // Try envelope content field (plaintext from server)
        if (msg.content?.text) {
            return msg.content.text;
        }

        // Check if envelope has nested content
        if (msg.envelope?.content?.text) {
            return msg.envelope.content.text;
        }

        // Try payload parsing
        const payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
        return payload?.content || payload?.text || payload?.message || JSON.stringify(payload);
    } catch {
        return msg.payload || msg.content || 'Unable to parse message';
    }
};
