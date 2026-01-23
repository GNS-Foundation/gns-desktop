//! Identity Models
//!
//! Data structures for GNS identity management.

use serde::{Deserialize, Serialize};

/// A GNS Identity
///
/// Represents a sovereign digital identity based on an Ed25519 keypair.
/// The public key IS the identity - no registration required.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Identity {
    /// The Ed25519 public key (64 hex characters)
    pub public_key: String,

    /// Human-readable name for this identity (local only)
    pub name: String,

    /// Optional @handle if claimed
    pub handle: Option<String>,

    /// X25519 encryption public key (derived from Ed25519)
    pub encryption_key: String,

    /// When this identity was created
    pub created_at: String,

    /// Whether this is the default/active identity
    pub is_default: bool,

    /// Trust score (0-100)
    pub trust_score: f64,

    /// Number of breadcrumbs collected
    pub breadcrumb_count: u32,
}

/// Parameters for creating a new identity
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateIdentityParams {
    /// Human-readable name for this identity
    pub name: String,

    /// Optional passphrase for key encryption (recommended)
    #[serde(default)]
    pub passphrase: Option<String>,

    /// Import from existing seed phrase (BIP39)
    #[serde(default)]
    pub seed_phrase: Option<String>,

    /// Set as default identity after creation
    #[serde(default = "default_true")]
    pub set_as_default: bool,
}

fn default_true() -> bool {
    true
}

/// Exported identity (for backup/transfer)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportedIdentity {
    /// Version of the export format
    pub version: u32,

    /// The identity public key
    pub public_key: String,

    /// Encrypted private key (if passphrase provided)
    pub encrypted_key: Option<String>,

    /// Human-readable name
    pub name: String,

    /// Handle if claimed
    pub handle: Option<String>,

    /// Export timestamp
    pub exported_at: String,

    /// Salt for key derivation (if encrypted)
    pub salt: Option<String>,
}

/// Identity import parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportIdentityParams {
    /// The exported identity data
    pub export_data: String,

    /// Passphrase to decrypt (if encrypted)
    pub passphrase: Option<String>,

    /// New name for the imported identity (optional)
    pub new_name: Option<String>,
}

/// Summary of an identity (for listing)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentitySummary {
    /// Public key (64 hex chars)
    pub public_key: String,

    /// Display name
    pub name: String,

    /// Handle if claimed
    pub handle: Option<String>,

    /// Whether this is the default
    pub is_default: bool,

    /// Trust score
    pub trust_score: f64,

    /// Breadcrumb count
    pub breadcrumb_count: u32,
}

/// Signature result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignatureResult {
    /// The signature (128 hex characters, Ed25519)
    pub signature: String,

    /// The public key that signed
    pub public_key: String,

    /// The message that was signed (hex encoded)
    pub message: String,
}

/// Verification result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyResult {
    /// Whether the signature is valid
    pub valid: bool,

    /// The public key that was verified against
    pub public_key: String,
}

impl Identity {
    /// Get a short display version of the public key
    pub fn short_key(&self) -> String {
        if self.public_key.len() >= 12 {
            format!("{}...{}", &self.public_key[..6], &self.public_key[self.public_key.len()-6..])
        } else {
            self.public_key.clone()
        }
    }

    /// Get the display name (handle if available, otherwise name)
    pub fn display_name(&self) -> String {
        self.handle.clone().map(|h| format!("@{}", h)).unwrap_or_else(|| self.name.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_short_key() {
        let identity = Identity {
            public_key: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890".to_string(),
            name: "Test".to_string(),
            handle: None,
            encryption_key: "test".to_string(),
            created_at: "2025-01-01T00:00:00Z".to_string(),
            is_default: true,
            trust_score: 50.0,
            breadcrumb_count: 100,
        };

        assert_eq!(identity.short_key(), "abcdef...567890");
    }

    #[test]
    fn test_display_name() {
        let mut identity = Identity {
            public_key: "abc123".to_string(),
            name: "Alice".to_string(),
            handle: None,
            encryption_key: "test".to_string(),
            created_at: "2025-01-01T00:00:00Z".to_string(),
            is_default: true,
            trust_score: 50.0,
            breadcrumb_count: 100,
        };

        assert_eq!(identity.display_name(), "Alice");

        identity.handle = Some("alice".to_string());
        assert_eq!(identity.display_name(), "@alice");
    }
}
