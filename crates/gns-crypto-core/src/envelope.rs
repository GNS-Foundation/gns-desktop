//! GNS Envelope - Signed and Encrypted Message Container
//!
//! The envelope is the atomic unit of communication in GNS.
//! It contains:
//! - Sender identification (Ed25519 public key)
//! - Recipient(s) identification
//! - Encrypted payload
//! - Ed25519 signature over the envelope
//!
//! ## Envelope Structure
//! ```text
//! ┌─────────────────────────────────────────┐
//! │ Header (signed)                         │
//! │ ├── id: UUID                            │
//! │ ├── from_public_key: Ed25519 pubkey     │
//! │ ├── from_handle: Optional @handle       │
//! │ ├── to_public_keys: [Ed25519 pubkeys]   │
//! │ ├── payload_type: MIME type             │
//! │ ├── timestamp: Unix ms                  │
//! │ └── thread_id: Optional conversation ID │
//! ├─────────────────────────────────────────┤
//! │ Encrypted Payload                       │
//! │ ├── ephemeral_public_key: X25519        │
//! │ ├── nonce: 12 bytes                     │
//! │ └── ciphertext: ChaCha20-Poly1305       │
//! ├─────────────────────────────────────────┤
//! │ Signature: Ed25519 over header          │
//! └─────────────────────────────────────────┘
//! ```

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::encryption::{encrypt_for_recipient, decrypt_from_sender, EncryptedPayload};
use crate::errors::CryptoError;
use crate::identity::GnsIdentity;
use crate::signing::{canonicalize_for_signing, verify_signature_hex};

/// GNS Envelope - the message container
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GnsEnvelope {
    /// Unique envelope ID
    pub id: String,

    /// Sender's Ed25519 public key (hex)
    pub from_public_key: String,

    /// Sender's @handle (optional, for display)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_handle: Option<String>,

    /// Recipient Ed25519 public keys (hex)
    pub to_public_keys: Vec<String>,

    /// Payload MIME type (e.g., "text/plain", "application/json")
    pub payload_type: String,

    /// Unix timestamp in milliseconds
    pub timestamp: i64,

    /// Thread/conversation ID (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thread_id: Option<String>,

    /// Reply-to message ID (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply_to_id: Option<String>,

    /// Encrypted payload
    pub encrypted_payload: EncryptedPayload,

    /// Ed25519 signature over the envelope header (hex)
    pub signature: String,
}

/// Result of opening an envelope
#[derive(Debug)]
pub struct OpenedEnvelope {
    /// Sender's public key
    pub from_public_key: String,
    
    /// Sender's handle
    pub from_handle: Option<String>,
    
    /// Payload type
    pub payload_type: String,
    
    /// Decrypted payload bytes
    pub payload: Vec<u8>,
    
    /// Was the signature valid?
    pub signature_valid: bool,
    
    /// Original envelope ID
    pub envelope_id: String,
    
    /// Timestamp
    pub timestamp: i64,
    
    /// Thread ID
    pub thread_id: Option<String>,
    
    /// Reply-to ID
    pub reply_to_id: Option<String>,
}

/// Create a signed and encrypted envelope
pub fn create_envelope(
    sender: &GnsIdentity,
    recipient_public_key_hex: &str,
    recipient_encryption_key_hex: &str,
    payload_type: &str,
    payload: &[u8],
) -> Result<GnsEnvelope, CryptoError> {
    // Parse recipient encryption key
    let recipient_enc_key_bytes = hex::decode(recipient_encryption_key_hex)?;
    if recipient_enc_key_bytes.len() != 32 {
        return Err(CryptoError::InvalidKeyLength {
            expected: 32,
            got: recipient_enc_key_bytes.len(),
        });
    }
    let recipient_enc_key: [u8; 32] = recipient_enc_key_bytes.try_into().unwrap();

    // Encrypt payload
    let encrypted_payload = encrypt_for_recipient(payload, &recipient_enc_key)?;

    // Generate envelope ID
    let envelope_id = Uuid::new_v4().to_string();
    let timestamp = chrono::Utc::now().timestamp_millis();

    // Create header for signing (without signature)
    let header = EnvelopeHeader {
        id: envelope_id.clone(),
        from_public_key: sender.public_key_hex(),
        to_public_keys: vec![recipient_public_key_hex.to_string()],
        payload_type: payload_type.to_string(),
        timestamp,
        encrypted_payload_hash: blake3::hash(&serde_json::to_vec(&encrypted_payload)?).to_hex().to_string(),
    };

    // Sign the header
    let header_bytes = canonicalize_for_signing(&serde_json::to_value(&header)?);
    let signature = sender.sign_bytes(&header_bytes);
    let signature_hex = hex::encode(signature);

    Ok(GnsEnvelope {
        id: envelope_id,
        from_public_key: sender.public_key_hex(),
        from_handle: None, // Caller can set this
        to_public_keys: vec![recipient_public_key_hex.to_string()],
        payload_type: payload_type.to_string(),
        timestamp,
        thread_id: None,
        reply_to_id: None,
        encrypted_payload,
        signature: signature_hex,
    })
}

/// Create envelope with additional metadata
pub fn create_envelope_with_metadata(
    sender: &GnsIdentity,
    sender_handle: Option<&str>,
    recipient_public_key_hex: &str,
    recipient_encryption_key_hex: &str,
    payload_type: &str,
    payload: &[u8],
    thread_id: Option<&str>,
    reply_to_id: Option<&str>,
) -> Result<GnsEnvelope, CryptoError> {
    let mut envelope = create_envelope(
        sender,
        recipient_public_key_hex,
        recipient_encryption_key_hex,
        payload_type,
        payload,
    )?;

    envelope.from_handle = sender_handle.map(String::from);
    envelope.thread_id = thread_id.map(String::from);
    envelope.reply_to_id = reply_to_id.map(String::from);

    // Re-sign with the new metadata
    let header = EnvelopeHeader {
        id: envelope.id.clone(),
        from_public_key: envelope.from_public_key.clone(),
        to_public_keys: envelope.to_public_keys.clone(),
        payload_type: envelope.payload_type.clone(),
        timestamp: envelope.timestamp,
        encrypted_payload_hash: blake3::hash(&serde_json::to_vec(&envelope.encrypted_payload)?).to_hex().to_string(),
    };

    let header_bytes = canonicalize_for_signing(&serde_json::to_value(&header)?);
    let signature = sender.sign_bytes(&header_bytes);
    envelope.signature = hex::encode(signature);

    Ok(envelope)
}

/// Open (verify and decrypt) an envelope
pub fn open_envelope(
    recipient: &GnsIdentity,
    envelope: &GnsEnvelope,
) -> Result<OpenedEnvelope, CryptoError> {
    // Verify signature
    let header = EnvelopeHeader {
        id: envelope.id.clone(),
        from_public_key: envelope.from_public_key.clone(),
        to_public_keys: envelope.to_public_keys.clone(),
        payload_type: envelope.payload_type.clone(),
        timestamp: envelope.timestamp,
        encrypted_payload_hash: blake3::hash(&serde_json::to_vec(&envelope.encrypted_payload)?).to_hex().to_string(),
    };

    let header_bytes = canonicalize_for_signing(&serde_json::to_value(&header)?);
    let signature_valid = verify_signature_hex(
        &envelope.from_public_key,
        &header_bytes,
        &envelope.signature,
    )?;

    // Decrypt payload
    let payload = decrypt_from_sender(
        recipient.x25519_secret(),
        &envelope.encrypted_payload,
    )?;

    Ok(OpenedEnvelope {
        from_public_key: envelope.from_public_key.clone(),
        from_handle: envelope.from_handle.clone(),
        payload_type: envelope.payload_type.clone(),
        payload,
        signature_valid,
        envelope_id: envelope.id.clone(),
        timestamp: envelope.timestamp,
        thread_id: envelope.thread_id.clone(),
        reply_to_id: envelope.reply_to_id.clone(),
    })
}

/// Header structure for signing (excludes actual encrypted content)
#[derive(Debug, Serialize)]
struct EnvelopeHeader {
    id: String,
    from_public_key: String,
    to_public_keys: Vec<String>,
    payload_type: String,
    timestamp: i64,
    encrypted_payload_hash: String,
}

impl GnsEnvelope {
    /// Check if this envelope is for a specific recipient
    pub fn is_for(&self, public_key_hex: &str) -> bool {
        self.to_public_keys
            .iter()
            .any(|k| k.eq_ignore_ascii_case(public_key_hex))
    }

    /// Get the envelope as JSON string
    pub fn to_json(&self) -> Result<String, CryptoError> {
        serde_json::to_string(self).map_err(|e| CryptoError::SerializationError(e.to_string()))
    }

    /// Parse envelope from JSON string
    pub fn from_json(json: &str) -> Result<Self, CryptoError> {
        serde_json::from_str(json).map_err(|e| CryptoError::SerializationError(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_and_open_envelope() {
        let sender = GnsIdentity::generate();
        let recipient = GnsIdentity::generate();

        let payload = b"Hello, this is a test message!";

        let envelope = create_envelope(
            &sender,
            &recipient.public_key_hex(),
            &recipient.encryption_key_hex(),
            "text/plain",
            payload,
        )
        .expect("Envelope creation should succeed");

        let opened = open_envelope(&recipient, &envelope)
            .expect("Envelope opening should succeed");

        assert!(opened.signature_valid);
        assert_eq!(opened.from_public_key, sender.public_key_hex());
        assert_eq!(opened.payload, payload);
        assert_eq!(opened.payload_type, "text/plain");
    }

    #[test]
    fn test_envelope_with_metadata() {
        let sender = GnsIdentity::generate();
        let recipient = GnsIdentity::generate();

        let envelope = create_envelope_with_metadata(
            &sender,
            Some("alice"),
            &recipient.public_key_hex(),
            &recipient.encryption_key_hex(),
            "text/plain",
            b"Hello Bob!",
            Some("thread-123"),
            Some("msg-456"),
        )
        .expect("Envelope creation should succeed");

        assert_eq!(envelope.from_handle, Some("alice".to_string()));
        assert_eq!(envelope.thread_id, Some("thread-123".to_string()));
        assert_eq!(envelope.reply_to_id, Some("msg-456".to_string()));

        let opened = open_envelope(&recipient, &envelope).expect("Opening should succeed");
        assert!(opened.signature_valid);
    }

    #[test]
    fn test_envelope_json_roundtrip() {
        let sender = GnsIdentity::generate();
        let recipient = GnsIdentity::generate();

        let envelope = create_envelope(
            &sender,
            &recipient.public_key_hex(),
            &recipient.encryption_key_hex(),
            "text/plain",
            b"Test",
        )
        .expect("Envelope creation should succeed");

        let json = envelope.to_json().expect("Serialization should succeed");
        let parsed = GnsEnvelope::from_json(&json).expect("Parsing should succeed");

        assert_eq!(envelope.id, parsed.id);
        assert_eq!(envelope.signature, parsed.signature);
    }

    #[test]
    fn test_tampered_envelope_fails_signature() {
        let sender = GnsIdentity::generate();
        let recipient = GnsIdentity::generate();

        let mut envelope = create_envelope(
            &sender,
            &recipient.public_key_hex(),
            &recipient.encryption_key_hex(),
            "text/plain",
            b"Original message",
        )
        .expect("Envelope creation should succeed");

        // Tamper with timestamp
        envelope.timestamp += 1000;

        let opened = open_envelope(&recipient, &envelope)
            .expect("Opening should succeed (decryption still works)");

        // But signature should be invalid
        assert!(!opened.signature_valid);
    }

    #[test]
    fn test_wrong_recipient_cannot_open() {
        let sender = GnsIdentity::generate();
        let recipient = GnsIdentity::generate();
        let wrong_recipient = GnsIdentity::generate();

        let envelope = create_envelope(
            &sender,
            &recipient.public_key_hex(),
            &recipient.encryption_key_hex(),
            "text/plain",
            b"Secret message",
        )
        .expect("Envelope creation should succeed");

        let result = open_envelope(&wrong_recipient, &envelope);
        assert!(result.is_err());
    }
}
