//! Breadcrumb Models
//!
//! Breadcrumbs are the foundation of Proof-of-Trajectory.
//! They are cryptographically signed location proofs that
//! accumulate over time to prove humanity.

use serde::{Deserialize, Serialize};

/// A single breadcrumb (location proof)
///
/// Breadcrumbs are collected on the device and periodically
/// published in epochs. Raw GPS is never stored - only H3 cells.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Breadcrumb {
    /// Unique breadcrumb ID
    pub id: String,

    /// H3 hexagonal cell index (privacy-preserving location)
    pub h3_index: String,

    /// H3 resolution used (determines precision)
    pub h3_resolution: u8,

    /// Timestamp when collected
    pub timestamp: String,

    /// Hash of previous breadcrumb (chain integrity)
    pub prev_hash: Option<String>,

    /// This breadcrumb's hash
    pub hash: String,

    /// Ed25519 signature
    pub signature: String,

    /// Source of location (gps, wifi, cell, manual)
    pub source: LocationSource,

    /// Horizontal accuracy in meters (if available)
    pub accuracy: Option<f64>,

    /// Whether this breadcrumb has been published in an epoch
    pub published: bool,
}

/// Location source types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LocationSource {
    /// GPS/GNSS
    Gps,
    /// WiFi positioning
    Wifi,
    /// Cell tower triangulation
    Cell,
    /// Network/IP geolocation
    Network,
    /// Manually set
    Manual,
    /// Fused (multiple sources)
    Fused,
}

/// A breadcrumb block (batch of breadcrumbs)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BreadcrumbBlock {
    /// Block index
    pub index: u32,

    /// Breadcrumbs in this block
    pub breadcrumbs: Vec<Breadcrumb>,

    /// Block merkle root
    pub merkle_root: String,

    /// Hash of previous block
    pub prev_block_hash: Option<String>,

    /// This block's hash
    pub block_hash: String,

    /// Block timestamp
    pub created_at: String,
}

/// An epoch header (published trajectory proof)
///
/// Epochs are periodic publications of trajectory proofs.
/// They contain merkle roots of breadcrumb blocks, allowing
/// verification without revealing raw locations.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EpochHeader {
    /// The identity that published this epoch
    pub identity: String,

    /// Epoch index (sequential)
    pub epoch_index: u32,

    /// Start timestamp of epoch
    pub start_time: String,

    /// End timestamp of epoch
    pub end_time: String,

    /// Merkle root of all blocks in this epoch
    pub merkle_root: String,

    /// Number of blocks in this epoch
    pub block_count: u32,

    /// Hash of previous epoch (chain)
    pub prev_epoch_hash: Option<String>,

    /// Ed25519 signature over epoch
    pub signature: String,

    /// This epoch's hash
    pub epoch_hash: String,
}

/// Signed epoch for network publication
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedEpoch {
    /// Public key that signed
    pub pk_root: String,

    /// The epoch header
    pub epoch: EpochHeader,

    /// Signature over the epoch
    pub signature: String,
}

/// Breadcrumb collection status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionStatus {
    /// Whether collection is currently active
    pub is_active: bool,

    /// Total breadcrumbs collected (all time)
    pub total_count: u32,

    /// Breadcrumbs in current unpublished batch
    pub pending_count: u32,

    /// Number of published epochs
    pub epoch_count: u32,

    /// Most recent breadcrumb timestamp
    pub last_breadcrumb_at: Option<String>,

    /// Most recent epoch timestamp
    pub last_epoch_at: Option<String>,

    /// Current H3 resolution setting
    pub h3_resolution: u8,

    /// Collection interval in seconds
    pub collection_interval: u32,
}

/// Breadcrumb query parameters
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BreadcrumbQuery {
    /// Only unpublished breadcrumbs
    #[serde(default)]
    pub unpublished_only: bool,

    /// Limit results
    #[serde(default = "default_limit")]
    pub limit: u32,

    /// Offset for pagination
    #[serde(default)]
    pub offset: u32,

    /// After timestamp
    #[serde(default)]
    pub after: Option<String>,

    /// Before timestamp
    #[serde(default)]
    pub before: Option<String>,
}

fn default_limit() -> u32 {
    100
}

impl Breadcrumb {
    /// Calculate the hash for this breadcrumb
    pub fn calculate_hash(&self) -> String {
        use sha2::{Sha256, Digest};
        
        let mut hasher = Sha256::new();
        hasher.update(&self.h3_index);
        hasher.update(&self.timestamp);
        if let Some(ref prev) = self.prev_hash {
            hasher.update(prev);
        }
        hex::encode(hasher.finalize())
    }

    /// Verify the breadcrumb's hash
    pub fn verify_hash(&self) -> bool {
        self.hash == self.calculate_hash()
    }
}

impl BreadcrumbBlock {
    /// Calculate merkle root of breadcrumbs
    pub fn calculate_merkle_root(breadcrumbs: &[Breadcrumb]) -> String {
        use sha2::{Sha256, Digest};
        
        if breadcrumbs.is_empty() {
            return "0".repeat(64);
        }

        let mut hashes: Vec<String> = breadcrumbs.iter().map(|b| b.hash.clone()).collect();

        while hashes.len() > 1 {
            let mut new_hashes = Vec::new();
            for chunk in hashes.chunks(2) {
                let mut hasher = Sha256::new();
                hasher.update(&chunk[0]);
                if chunk.len() > 1 {
                    hasher.update(&chunk[1]);
                }
                new_hashes.push(hex::encode(hasher.finalize()));
            }
            hashes = new_hashes;
        }

        hashes.pop().unwrap_or_else(|| "0".repeat(64))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_breadcrumb_hash() {
        let mut breadcrumb = Breadcrumb {
            id: "1".to_string(),
            h3_index: "8a2a1072b59ffff".to_string(),
            h3_resolution: 10,
            timestamp: "2025-01-01T00:00:00Z".to_string(),
            prev_hash: None,
            hash: String::new(),
            signature: String::new(),
            source: LocationSource::Gps,
            accuracy: Some(5.0),
            published: false,
        };

        breadcrumb.hash = breadcrumb.calculate_hash();
        assert!(breadcrumb.verify_hash());
    }

    #[test]
    fn test_merkle_root() {
        let breadcrumbs: Vec<Breadcrumb> = (0..4)
            .map(|i| Breadcrumb {
                id: i.to_string(),
                h3_index: format!("h3_{}", i),
                h3_resolution: 10,
                timestamp: "2025-01-01T00:00:00Z".to_string(),
                prev_hash: None,
                hash: format!("{:064x}", i),
                signature: String::new(),
                source: LocationSource::Gps,
                accuracy: None,
                published: false,
            })
            .collect();

        let root = BreadcrumbBlock::calculate_merkle_root(&breadcrumbs);
        assert_eq!(root.len(), 64);
    }
}
