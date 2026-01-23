//! GNS Error Types
//!
//! Comprehensive error handling for all GNS operations.

use serde::{Deserialize, Serialize};
use std::fmt;

/// Result type alias for GNS operations.
pub type Result<T> = std::result::Result<T, Error>;

/// GNS Error Types
///
/// All errors that can occur during GNS operations are represented here.
/// These errors are serializable for transmission across the Tauri IPC boundary.
#[derive(Debug, Clone, Serialize, Deserialize, thiserror::Error)]
#[serde(tag = "type", content = "message")]
pub enum Error {
    /// Cryptographic operation failed
    #[error("Cryptographic error: {0}")]
    Crypto(String),

    /// Storage/database operation failed
    #[error("Storage error: {0}")]
    Storage(String),

    /// Network operation failed
    #[error("Network error: {0}")]
    Network(String),

    /// Identity not found
    #[error("Identity not found: {0}")]
    IdentityNotFound(String),

    /// Handle not found or not registered
    #[error("Handle not found: {0}")]
    HandleNotFound(String),

    /// Handle already claimed by another identity
    #[error("Handle unavailable: {0}")]
    HandleUnavailable(String),

    /// Invalid handle format
    #[error("Invalid handle format: {0}")]
    InvalidHandle(String),

    /// Message decryption failed
    #[error("Decryption failed: {0}")]
    DecryptionFailed(String),

    /// Signature verification failed
    #[error("Invalid signature: {0}")]
    InvalidSignature(String),

    /// Trust score too low for operation
    #[error("Insufficient trust: {0}")]
    InsufficientTrust(String),

    /// Not enough breadcrumbs for operation
    #[error("Insufficient breadcrumbs: {0}")]
    InsufficientBreadcrumbs(String),

    /// Configuration error
    #[error("Configuration error: {0}")]
    Config(String),

    /// Serialization/deserialization error
    #[error("Serialization error: {0}")]
    Serialization(String),

    /// Permission denied
    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    /// Invalid input parameter
    #[error("Invalid input: {0}")]
    InvalidInput(String),

    /// Operation timed out
    #[error("Operation timed out: {0}")]
    Timeout(String),

    /// Internal error (unexpected condition)
    #[error("Internal error: {0}")]
    Internal(String),

    /// Feature not available on this platform
    #[error("Feature not available: {0}")]
    NotAvailable(String),

    /// Rate limit exceeded
    #[error("Rate limit exceeded: {0}")]
    RateLimited(String),
}

impl Error {
    /// Create a crypto error with context
    pub fn crypto(msg: impl Into<String>) -> Self {
        Error::Crypto(msg.into())
    }

    /// Create a storage error with context
    pub fn storage(msg: impl Into<String>) -> Self {
        Error::Storage(msg.into())
    }

    /// Create a network error with context
    pub fn network(msg: impl Into<String>) -> Self {
        Error::Network(msg.into())
    }

    /// Check if this error is recoverable
    pub fn is_recoverable(&self) -> bool {
        matches!(
            self,
            Error::Network(_) | Error::Timeout(_) | Error::RateLimited(_)
        )
    }

    /// Get the error code for this error type
    pub fn code(&self) -> &'static str {
        match self {
            Error::Crypto(_) => "GNS_CRYPTO",
            Error::Storage(_) => "GNS_STORAGE",
            Error::Network(_) => "GNS_NETWORK",
            Error::IdentityNotFound(_) => "GNS_IDENTITY_NOT_FOUND",
            Error::HandleNotFound(_) => "GNS_HANDLE_NOT_FOUND",
            Error::HandleUnavailable(_) => "GNS_HANDLE_UNAVAILABLE",
            Error::InvalidHandle(_) => "GNS_INVALID_HANDLE",
            Error::DecryptionFailed(_) => "GNS_DECRYPTION_FAILED",
            Error::InvalidSignature(_) => "GNS_INVALID_SIGNATURE",
            Error::InsufficientTrust(_) => "GNS_INSUFFICIENT_TRUST",
            Error::InsufficientBreadcrumbs(_) => "GNS_INSUFFICIENT_BREADCRUMBS",
            Error::Config(_) => "GNS_CONFIG",
            Error::Serialization(_) => "GNS_SERIALIZATION",
            Error::PermissionDenied(_) => "GNS_PERMISSION_DENIED",
            Error::InvalidInput(_) => "GNS_INVALID_INPUT",
            Error::Timeout(_) => "GNS_TIMEOUT",
            Error::Internal(_) => "GNS_INTERNAL",
            Error::NotAvailable(_) => "GNS_NOT_AVAILABLE",
            Error::RateLimited(_) => "GNS_RATE_LIMITED",
        }
    }
}

// Convert from various error types

impl From<std::io::Error> for Error {
    fn from(e: std::io::Error) -> Self {
        Error::Storage(e.to_string())
    }
}

impl From<serde_json::Error> for Error {
    fn from(e: serde_json::Error) -> Self {
        Error::Serialization(e.to_string())
    }
}

impl From<rusqlite::Error> for Error {
    fn from(e: rusqlite::Error) -> Self {
        Error::Storage(e.to_string())
    }
}

impl From<reqwest::Error> for Error {
    fn from(e: reqwest::Error) -> Self {
        if e.is_timeout() {
            Error::Timeout(e.to_string())
        } else if e.is_connect() {
            Error::Network(format!("Connection failed: {}", e))
        } else {
            Error::Network(e.to_string())
        }
    }
}

impl From<ed25519_dalek::SignatureError> for Error {
    fn from(e: ed25519_dalek::SignatureError) -> Self {
        Error::InvalidSignature(e.to_string())
    }
}

impl From<hex::FromHexError> for Error {
    fn from(e: hex::FromHexError) -> Self {
        Error::InvalidInput(format!("Invalid hex encoding: {}", e))
    }
}

impl From<base64::DecodeError> for Error {
    fn from(e: base64::DecodeError) -> Self {
        Error::InvalidInput(format!("Invalid base64 encoding: {}", e))
    }
}

// Tauri automatically converts Error to InvokeError via the Serialize trait
// No explicit implementation needed

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_codes() {
        assert_eq!(Error::Crypto("test".into()).code(), "GNS_CRYPTO");
        assert_eq!(Error::Network("test".into()).code(), "GNS_NETWORK");
    }

    #[test]
    fn test_recoverable_errors() {
        assert!(Error::Network("timeout".into()).is_recoverable());
        assert!(Error::Timeout("slow".into()).is_recoverable());
        assert!(!Error::Crypto("bad key".into()).is_recoverable());
    }

    #[test]
    fn test_error_serialization() {
        let error = Error::HandleNotFound("@alice".into());
        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("HandleNotFound"));
        assert!(json.contains("@alice"));
    }
}
