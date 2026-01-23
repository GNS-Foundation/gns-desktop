//! Message Models
//!
//! Data structures for encrypted E2E messaging.

use serde::{Deserialize, Serialize};

/// An encrypted GNS message
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    /// Unique message ID (UUID)
    pub id: String,

    /// Sender's public key
    pub from_pk: String,

    /// Recipient's public key
    pub to_pk: String,

    /// Encrypted payload (nonce:ciphertext, base64)
    pub payload: String,

    /// Ephemeral X25519 public key used for this message's encryption
    #[serde(default)]
    pub ephemeral_key: Option<String>,

    /// Ed25519 signature over the payload
    pub signature: String,

    /// When the message was created
    pub created_at: String,

    /// When the message was received locally
    pub received_at: Option<String>,

    /// Whether the message has been read
    pub is_read: bool,

    /// Decrypted content (only after decryption)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub decrypted: Option<DecryptedPayload>,
}

/// Decrypted message payload
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecryptedPayload {
    /// Message type (text, image, file, etc.)
    pub message_type: MessageType,

    /// The actual content
    pub content: String,

    /// Optional metadata (filename, dimensions, etc.)
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,

    /// Reply to message ID (if this is a reply)
    #[serde(default)]
    pub reply_to: Option<String>,
}

/// Message types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MessageType {
    /// Plain text message
    Text,
    /// Image (base64 encoded)
    Image,
    /// File attachment
    File,
    /// Payment request (IDUP)
    Payment,
    /// Location share
    Location,
    /// System/protocol message
    System,
    /// Read receipt
    ReadReceipt,
    /// Typing indicator
    Typing,
    /// Custom type
    Custom(String),
}

/// Parameters for sending a message
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendMessageParams {
    /// Recipient (@handle or public key)
    pub to: String,

    /// Message type
    pub message_type: MessageType,

    /// Message content
    pub content: String,

    /// Optional metadata
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,

    /// Reply to message ID
    #[serde(default)]
    pub reply_to: Option<String>,
}

/// A conversation thread
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Conversation {
    /// The other party's public key
    pub peer_pk: String,

    /// The other party's handle (if known)
    pub peer_handle: Option<String>,

    /// Most recent message preview
    pub last_message: Option<String>,

    /// Timestamp of last message
    pub last_message_at: Option<String>,

    /// Number of unread messages
    pub unread_count: u32,

    /// Total message count
    pub total_count: u32,
}

/// Message query parameters
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MessageQuery {
    /// Filter by peer public key
    #[serde(default)]
    pub peer_pk: Option<String>,

    /// Only unread messages
    #[serde(default)]
    pub unread_only: bool,

    /// Limit results
    #[serde(default = "default_limit")]
    pub limit: u32,

    /// Offset for pagination
    #[serde(default)]
    pub offset: u32,

    /// Messages after this timestamp
    #[serde(default)]
    pub after: Option<String>,

    /// Messages before this timestamp
    #[serde(default)]
    pub before: Option<String>,
}

fn default_limit() -> u32 {
    50
}

/// GNS Message Envelope (wire format)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GnsEnvelope {
    /// Protocol version
    pub version: u32,

    /// Sender public key
    pub from_pk: String,

    /// Recipient public key
    pub to_pk: String,

    /// Encrypted payload (ChaCha20-Poly1305, base64)
    pub encrypted_payload: String,

    /// Ephemeral X25519 public key for this message
    pub ephemeral_key: String,

    /// Ed25519 signature over the entire envelope
    pub signature: String,

    /// Message ID
    pub message_id: String,

    /// Timestamp
    pub timestamp: String,
}

impl Message {
    /// Check if message is incoming (we are the recipient)
    pub fn is_incoming(&self, my_pk: &str) -> bool {
        self.to_pk.eq_ignore_ascii_case(my_pk)
    }

    /// Check if message is outgoing (we are the sender)
    pub fn is_outgoing(&self, my_pk: &str) -> bool {
        self.from_pk.eq_ignore_ascii_case(my_pk)
    }

    /// Get the peer's public key (the other party)
    pub fn peer_pk(&self, my_pk: &str) -> &str {
        if self.is_incoming(my_pk) {
            &self.from_pk
        } else {
            &self.to_pk
        }
    }
}

impl Default for MessageType {
    fn default() -> Self {
        MessageType::Text
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_message_direction() {
        let my_pk = "abc123";
        let peer_pk = "def456";

        let incoming = Message {
            id: "1".to_string(),
            from_pk: peer_pk.to_string(),
            to_pk: my_pk.to_string(),
            payload: "".to_string(),
            signature: "".to_string(),
            created_at: "".to_string(),
            received_at: None,
            is_read: false,
            decrypted: None,
        };

        assert!(incoming.is_incoming(my_pk));
        assert!(!incoming.is_outgoing(my_pk));
        assert_eq!(incoming.peer_pk(my_pk), peer_pk);
    }
}
