//! Breadcrumb Module - Cryptographic Location Proofs
//!
//! A breadcrumb is a signed attestation that the identity holder
//! was at a specific location at a specific time.
//!
//! ## Privacy Protection
//! - Locations are quantized to H3 hexagons (not exact coordinates)
//! - Resolution is configurable (default: ~1km cells)
//! - Only the hash is stored/transmitted, not raw coordinates
//!
//! ## Structure
//! ```text
//! ┌─────────────────────────────────────────┐
//! │ Breadcrumb                              │
//! │ ├── h3_index: H3 cell ID               │
//! │ ├── timestamp: Unix seconds             │
//! │ ├── public_key: Ed25519 pubkey          │
//! │ └── signature: Ed25519 signature        │
//! └─────────────────────────────────────────┘
//! ```

use crate::errors::CryptoError;
use crate::identity::GnsIdentity;
use crate::signing::verify_signature_hex;
use serde::{Deserialize, Serialize};

/// H3 resolution for breadcrumbs
/// Resolution 7 ≈ 5.16 km² average cell area (~1.2 km edge)
/// This provides good privacy while still proving trajectory
pub const DEFAULT_H3_RESOLUTION: u8 = 7;

/// A signed location proof
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Breadcrumb {
    /// H3 index (cell ID) as hex string
    pub h3_index: String,

    /// Unix timestamp in seconds
    pub timestamp: i64,

    /// Ed25519 public key of the signer (hex)
    pub public_key: String,

    /// Ed25519 signature over the breadcrumb data (hex)
    pub signature: String,

    /// H3 resolution used (for verification)
    pub resolution: u8,
}

/// Create a breadcrumb from coordinates
///
/// The coordinates are converted to an H3 index before signing,
/// so the exact location is never stored.
pub fn create_breadcrumb(
    identity: &GnsIdentity,
    latitude: f64,
    longitude: f64,
    resolution: Option<u8>,
) -> Result<Breadcrumb, CryptoError> {
    let resolution = resolution.unwrap_or(DEFAULT_H3_RESOLUTION);

    // Convert lat/lng to H3 index
    let h3_index = lat_lng_to_h3(latitude, longitude, resolution)?;
    let timestamp = chrono::Utc::now().timestamp();

    // Create signing payload
    let signing_data = format!(
        "gns-breadcrumb-v1:{}:{}:{}",
        h3_index,
        timestamp,
        identity.public_key_hex()
    );

    // Sign
    let signature = identity.sign_bytes(signing_data.as_bytes());

    Ok(Breadcrumb {
        h3_index,
        timestamp,
        public_key: identity.public_key_hex(),
        signature: hex::encode(signature),
        resolution,
    })
}

/// Create a breadcrumb from an H3 index directly (for testing or when H3 is pre-computed)
pub fn create_breadcrumb_from_h3(
    identity: &GnsIdentity,
    h3_index: &str,
    resolution: u8,
) -> Result<Breadcrumb, CryptoError> {
    let timestamp = chrono::Utc::now().timestamp();

    let signing_data = format!(
        "gns-breadcrumb-v1:{}:{}:{}",
        h3_index,
        timestamp,
        identity.public_key_hex()
    );

    let signature = identity.sign_bytes(signing_data.as_bytes());

    Ok(Breadcrumb {
        h3_index: h3_index.to_string(),
        timestamp,
        public_key: identity.public_key_hex(),
        signature: hex::encode(signature),
        resolution,
    })
}

/// Verify a breadcrumb's signature
pub fn verify_breadcrumb(breadcrumb: &Breadcrumb) -> Result<bool, CryptoError> {
    let signing_data = format!(
        "gns-breadcrumb-v1:{}:{}:{}",
        breadcrumb.h3_index, breadcrumb.timestamp, breadcrumb.public_key
    );

    verify_signature_hex(
        &breadcrumb.public_key,
        signing_data.as_bytes(),
        &breadcrumb.signature,
    )
}

/// Convert latitude/longitude to H3 index
///
/// This is a placeholder implementation. In production, use the h3o crate.
/// For WASM compatibility, we may need to use a JS H3 library.
fn lat_lng_to_h3(latitude: f64, longitude: f64, resolution: u8) -> Result<String, CryptoError> {
    // Validate inputs
    if !(-90.0..=90.0).contains(&latitude) {
        return Err(CryptoError::InvalidEnvelope(format!(
            "Invalid latitude: {}",
            latitude
        )));
    }
    if !(-180.0..=180.0).contains(&longitude) {
        return Err(CryptoError::InvalidEnvelope(format!(
            "Invalid longitude: {}",
            longitude
        )));
    }
    if resolution > 15 {
        return Err(CryptoError::InvalidEnvelope(format!(
            "Invalid H3 resolution: {}",
            resolution
        )));
    }

    // For now, create a deterministic pseudo-H3 index
    // In production, use h3o::LatLng::new(latitude, longitude)?.to_cell(Resolution::try_from(resolution)?)
    //
    // This placeholder creates a unique index based on quantized coordinates
    let lat_quantized = ((latitude + 90.0) * 1000.0) as u64;
    let lng_quantized = ((longitude + 180.0) * 1000.0) as u64;
    let index = (lat_quantized << 32) | lng_quantized | ((resolution as u64) << 60);

    Ok(format!("{:016x}", index))
}

/// Calculate approximate distance between two H3 cells
/// Returns distance in "grid steps" (not meters)
pub fn h3_grid_distance(h3_a: &str, h3_b: &str) -> Result<u32, CryptoError> {
    // Placeholder - in production use h3o::grid_distance
    // For now, just check if they're the same
    if h3_a == h3_b {
        Ok(0)
    } else {
        // Parse and calculate rough distance
        let a = u64::from_str_radix(h3_a, 16)
            .map_err(|_| CryptoError::InvalidEnvelope("Invalid H3 index".to_string()))?;
        let b = u64::from_str_radix(h3_b, 16)
            .map_err(|_| CryptoError::InvalidEnvelope("Invalid H3 index".to_string()))?;

        // Very rough approximation
        let diff = a.abs_diff(b);
        Ok((diff % 1000) as u32)
    }
}

impl Breadcrumb {
    /// Verify this breadcrumb's signature
    pub fn verify(&self) -> Result<bool, CryptoError> {
        verify_breadcrumb(self)
    }

    /// Get the age of this breadcrumb
    pub fn age_seconds(&self) -> i64 {
        chrono::Utc::now().timestamp() - self.timestamp
    }

    /// Check if this breadcrumb is recent (within given seconds)
    pub fn is_recent(&self, max_age_seconds: i64) -> bool {
        self.age_seconds() <= max_age_seconds
    }

    /// Serialize to JSON
    pub fn to_json(&self) -> Result<String, CryptoError> {
        serde_json::to_string(self).map_err(|e| CryptoError::SerializationError(e.to_string()))
    }

    /// Parse from JSON
    pub fn from_json(json: &str) -> Result<Self, CryptoError> {
        serde_json::from_str(json).map_err(|e| CryptoError::SerializationError(e.to_string()))
    }
}

/// Collection of breadcrumbs forming a trajectory
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trajectory {
    pub public_key: String,
    pub breadcrumbs: Vec<Breadcrumb>,
}

impl Trajectory {
    /// Create a new trajectory for an identity
    pub fn new(public_key: &str) -> Self {
        Self {
            public_key: public_key.to_string(),
            breadcrumbs: Vec::new(),
        }
    }

    /// Add a breadcrumb to the trajectory
    pub fn add(&mut self, breadcrumb: Breadcrumb) -> Result<(), CryptoError> {
        // Verify the breadcrumb is from the same identity
        if breadcrumb.public_key != self.public_key {
            return Err(CryptoError::InvalidEnvelope(
                "Breadcrumb public key doesn't match trajectory".to_string(),
            ));
        }

        // Verify signature
        if !breadcrumb.verify()? {
            return Err(CryptoError::SignatureVerificationFailed);
        }

        self.breadcrumbs.push(breadcrumb);

        // Keep sorted by timestamp
        self.breadcrumbs.sort_by_key(|b| b.timestamp);

        Ok(())
    }

    /// Get number of unique locations visited
    pub fn unique_locations(&self) -> usize {
        let mut unique: std::collections::HashSet<&str> = std::collections::HashSet::new();
        for b in &self.breadcrumbs {
            unique.insert(&b.h3_index);
        }
        unique.len()
    }

    /// Get the time span of the trajectory in seconds
    pub fn time_span_seconds(&self) -> Option<i64> {
        if self.breadcrumbs.len() < 2 {
            return None;
        }
        let first = self.breadcrumbs.first()?.timestamp;
        let last = self.breadcrumbs.last()?.timestamp;
        Some(last - first)
    }

    /// Check if trajectory meets minimum requirements for handle claim
    pub fn meets_claim_requirements(&self) -> bool {
        // Require at least 100 breadcrumbs
        if self.breadcrumbs.len() < 100 {
            return false;
        }

        // Require at least 10 unique locations
        if self.unique_locations() < 10 {
            return false;
        }

        // Require trajectory spanning at least 7 days
        match self.time_span_seconds() {
            Some(span) => span >= 7 * 24 * 60 * 60,
            None => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_and_verify_breadcrumb() {
        let identity = GnsIdentity::generate();

        let breadcrumb = create_breadcrumb(&identity, 40.7128, -74.0060, None)
            .expect("Breadcrumb creation should succeed");

        assert!(breadcrumb.verify().expect("Verification should succeed"));
        assert_eq!(breadcrumb.public_key, identity.public_key_hex());
    }

    #[test]
    fn test_tampered_breadcrumb_fails_verification() {
        let identity = GnsIdentity::generate();

        let mut breadcrumb = create_breadcrumb(&identity, 40.7128, -74.0060, None)
            .expect("Breadcrumb creation should succeed");

        // Tamper with timestamp
        breadcrumb.timestamp += 1;

        assert!(!breadcrumb.verify().expect("Verification should complete"));
    }

    #[test]
    fn test_breadcrumb_json_roundtrip() {
        let identity = GnsIdentity::generate();

        let breadcrumb = create_breadcrumb(&identity, 51.5074, -0.1278, None)
            .expect("Breadcrumb creation should succeed");

        let json = breadcrumb.to_json().expect("Serialization should succeed");
        let parsed = Breadcrumb::from_json(&json).expect("Parsing should succeed");

        assert_eq!(breadcrumb.h3_index, parsed.h3_index);
        assert_eq!(breadcrumb.signature, parsed.signature);
    }

    #[test]
    fn test_trajectory() {
        let identity = GnsIdentity::generate();
        let mut trajectory = Trajectory::new(&identity.public_key_hex());

        // Add some breadcrumbs
        for i in 0..5 {
            let lat = 40.0 + (i as f64 * 0.1);
            let lng = -74.0 + (i as f64 * 0.1);
            let breadcrumb = create_breadcrumb(&identity, lat, lng, None)
                .expect("Breadcrumb creation should succeed");
            trajectory.add(breadcrumb).expect("Adding should succeed");
        }

        assert_eq!(trajectory.breadcrumbs.len(), 5);
        assert!(trajectory.unique_locations() >= 1);
    }
}
