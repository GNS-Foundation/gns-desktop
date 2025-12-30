//! Error types for GNS crypto operations

use thiserror::Error;

#[derive(Error, Debug)]
pub enum CryptoError {
    #[error("Invalid key length: expected {expected}, got {got}")]
    InvalidKeyLength { expected: usize, got: usize },

    #[error("Invalid key format: {0}")]
    InvalidKeyFormat(String),

    #[error("Invalid signature")]
    InvalidSignature,

    #[error("Signature verification failed")]
    SignatureVerificationFailed,

    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),

    #[error("Decryption failed: {0}")]
    DecryptionFailed(String),

    #[error("Invalid nonce length")]
    InvalidNonceLength,

    #[error("Key derivation failed: {0}")]
    KeyDerivationFailed(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Invalid envelope: {0}")]
    InvalidEnvelope(String),

    #[error("Hex decode error: {0}")]
    HexDecodeError(String),

    #[error("Base64 decode error: {0}")]
    Base64DecodeError(String),
}

impl From<hex::FromHexError> for CryptoError {
    fn from(e: hex::FromHexError) -> Self {
        CryptoError::HexDecodeError(e.to_string())
    }
}

impl From<base64::DecodeError> for CryptoError {
    fn from(e: base64::DecodeError) -> Self {
        CryptoError::Base64DecodeError(e.to_string())
    }
}

impl From<serde_json::Error> for CryptoError {
    fn from(e: serde_json::Error) -> Self {
        CryptoError::SerializationError(e.to_string())
    }
}

impl From<ed25519_dalek::SignatureError> for CryptoError {
    fn from(_: ed25519_dalek::SignatureError) -> Self {
        CryptoError::InvalidSignature
    }
}
