//! GNS Record Models
//!
//! The GNS Record is the identity manifest - a signed document that
//! describes an identity's capabilities, endpoints, and trust level.

use serde::{Deserialize, Serialize};

/// A GNS Record (Identity Manifest)
///
/// This is the core data structure that represents a GNS identity
/// on the network. It's signed by the identity's Ed25519 key.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GnsRecord {
    /// Record format version
    pub version: u32,

    /// The identity's public key (64 hex chars)
    pub identity: String,

    /// Claimed @handle (if any)
    pub handle: Option<String>,

    /// X25519 encryption public key
    pub encryption_key: Option<String>,

    /// Enabled modules (facets)
    pub modules: Vec<GnsModule>,

    /// Communication endpoints
    pub endpoints: Vec<GnsEndpoint>,

    /// Published epoch merkle roots
    pub epoch_roots: Vec<String>,

    /// Trust score (0-100)
    pub trust_score: f64,

    /// Total breadcrumb count
    pub breadcrumb_count: u32,

    /// Record creation timestamp
    pub created_at: String,

    /// Last update timestamp
    pub updated_at: String,
}

/// A GNS Module (Facet)
///
/// Modules extend identity functionality. Protocol facets are
/// built-in, while organization facets are registered namespaces.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GnsModule {
    /// Module ID (e.g., "profile", "payment", "microsoft@")
    pub id: String,

    /// Schema URL for validation
    pub schema: String,

    /// Human-readable name
    pub name: Option<String>,

    /// Description
    pub description: Option<String>,

    /// URL to module data
    pub data_url: Option<String>,

    /// Whether module data is public
    pub is_public: bool,

    /// Module-specific configuration
    pub config: Option<serde_json::Value>,
}

/// A GNS Endpoint
///
/// Endpoints describe how to reach an identity for messaging.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GnsEndpoint {
    /// Endpoint type
    pub endpoint_type: EndpointType,

    /// Protocol to use
    pub protocol: Protocol,

    /// Address (hostname, IP, or onion address)
    pub address: String,

    /// Port number (optional)
    pub port: Option<u16>,

    /// Priority (lower = preferred)
    pub priority: i32,

    /// Whether this endpoint is currently active
    pub is_active: bool,
}

/// Endpoint types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum EndpointType {
    /// Direct peer-to-peer connection
    Direct,
    /// Via a relay server
    Relay,
    /// Via Tor onion service
    Onion,
}

/// Communication protocols
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Protocol {
    /// QUIC (preferred for mobile)
    Quic,
    /// WebSocket Secure
    Wss,
    /// HTTPS REST
    Https,
}

/// A signed GNS record for network transmission
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedRecord {
    /// The public key that signed this record
    pub pk_root: String,

    /// The record data
    pub record_json: GnsRecord,

    /// Ed25519 signature over record_json
    pub signature: String,
}

/// Handle claim request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HandleClaim {
    /// The handle to claim (without @)
    pub handle: String,

    /// The claiming identity's public key
    pub identity: String,

    /// Proof-of-Trajectory proof
    pub proof: PotProof,

    /// Signature over the claim
    pub signature: String,
}

/// Proof-of-Trajectory proof for handle claims
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PotProof {
    /// Total breadcrumb count (must be >= 100)
    pub breadcrumb_count: u32,

    /// Trust score (must be >= 20)
    pub trust_score: f64,

    /// Timestamp of first breadcrumb
    pub first_breadcrumb_at: String,

    /// Most recent epoch merkle root
    pub latest_epoch_root: Option<String>,
}

/// Handle resolution result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedHandle {
    /// The handle that was resolved
    pub handle: String,

    /// The identity's public key
    pub public_key: String,

    /// The identity's encryption key
    pub encryption_key: Option<String>,

    /// Trust score
    pub trust_score: f64,

    /// Breadcrumb count
    pub breadcrumb_count: u32,

    /// Whether this result came from cache
    pub from_cache: bool,

    /// When the resolution was performed
    pub resolved_at: String,
}

/// Reserved handles that cannot be claimed
pub const RESERVED_HANDLES: &[&str] = &[
    "admin", "root", "system", "gns", "gcrumbs", "support",
    "help", "info", "contact", "null", "undefined", "localhost",
    "api", "www", "mail", "smtp", "ftp", "ssh",
];

impl GnsRecord {
    /// Validate the record structure
    pub fn validate(&self) -> Result<(), String> {
        // Check identity format (64 hex chars)
        if self.identity.len() != 64 || !self.identity.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err("Invalid identity format".to_string());
        }

        // Check handle format if present
        if let Some(ref handle) = self.handle {
            if handle.len() < 3 || handle.len() > 20 {
                return Err("Handle must be 3-20 characters".to_string());
            }
            if !handle.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_') {
                return Err("Handle must be lowercase alphanumeric with underscores".to_string());
            }
            if RESERVED_HANDLES.contains(&handle.as_str()) {
                return Err("Handle is reserved".to_string());
            }
        }

        // Check trust score range
        if self.trust_score < 0.0 || self.trust_score > 100.0 {
            return Err("Trust score must be 0-100".to_string());
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_record_validation() {
        let mut record = GnsRecord {
            version: 1,
            identity: "a".repeat(64),
            handle: Some("alice".to_string()),
            encryption_key: None,
            modules: vec![],
            endpoints: vec![],
            epoch_roots: vec![],
            trust_score: 50.0,
            breadcrumb_count: 100,
            created_at: "2025-01-01T00:00:00Z".to_string(),
            updated_at: "2025-01-01T00:00:00Z".to_string(),
        };

        assert!(record.validate().is_ok());

        // Invalid handle
        record.handle = Some("ab".to_string());
        assert!(record.validate().is_err());

        // Reserved handle
        record.handle = Some("admin".to_string());
        assert!(record.validate().is_err());
    }
}
