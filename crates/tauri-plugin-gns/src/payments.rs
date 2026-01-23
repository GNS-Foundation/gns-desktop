//! Payments Module (Stellar Integration)
//!
//! This module provides Stellar blockchain integration for GNS identities.
//! Since GNS uses Ed25519 keys (same as Stellar), your GNS identity key
//! IS your Stellar wallet key - no separate account needed!
//!
//! # Key Insight
//!
//! Both GNS and Stellar use Ed25519 cryptography:
//! - GNS public key: `ed25519_hex_string` (64 chars)
//! - Stellar address: `G...` (56 chars, StrKey encoded)
//!
//! The same keypair works for both systems.
//!
//! # Feature Flag
//!
//! This module requires the `payments` feature:
//! ```toml
//! tauri-plugin-gns = { version = "0.1", features = ["payments"] }
//! ```

#![cfg(feature = "payments")]

use crate::error::{Error, Result};

/// Convert a GNS public key (hex) to a Stellar address (G...)
///
/// # Example
///
/// ```rust
/// use tauri_plugin_gns::payments::gns_to_stellar_address;
///
/// let gns_pk = "3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29";
/// let stellar_addr = gns_to_stellar_address(gns_pk)?;
/// assert!(stellar_addr.starts_with("G"));
/// ```
pub fn gns_to_stellar_address(gns_public_key: &str) -> Result<String> {
    // Decode hex to bytes
    let pk_bytes = hex::decode(gns_public_key)
        .map_err(|e| Error::Crypto(format!("Invalid hex public key: {}", e)))?;

    if pk_bytes.len() != 32 {
        return Err(Error::Crypto(format!(
            "Public key must be 32 bytes, got {}",
            pk_bytes.len()
        )));
    }

    // Convert to fixed-size array
    let pk_array: [u8; 32] = pk_bytes
        .try_into()
        .map_err(|_| Error::Crypto("Failed to convert to 32-byte array".into()))?;

    // Encode as Stellar address using stellar-strkey
    let stellar_address = stellar_strkey::ed25519::PublicKey(pk_array).to_string();

    Ok(stellar_address)
}

/// Convert a Stellar address (G...) to a GNS public key (hex)
///
/// # Example
///
/// ```rust
/// use tauri_plugin_gns::payments::stellar_to_gns_address;
///
/// let stellar_addr = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
/// let gns_pk = stellar_to_gns_address(stellar_addr)?;
/// assert_eq!(gns_pk.len(), 64); // 32 bytes in hex
/// ```
pub fn stellar_to_gns_address(stellar_address: &str) -> Result<String> {
    // Parse Stellar address
    let pk: stellar_strkey::ed25519::PublicKey = stellar_address
        .parse()
        .map_err(|e| Error::Crypto(format!("Invalid Stellar address: {:?}", e)))?;

    // Convert to hex
    Ok(hex::encode(pk.0))
}

/// Verify that a GNS identity can sign Stellar transactions
///
/// This validates the key format is compatible.
pub fn verify_stellar_compatibility(gns_public_key: &str) -> Result<bool> {
    // Try to convert - if it works, keys are compatible
    let stellar_addr = gns_to_stellar_address(gns_public_key)?;
    let roundtrip = stellar_to_gns_address(&stellar_addr)?;

    Ok(roundtrip == gns_public_key)
}

/// Get the Stellar network passphrase for signing
pub fn get_network_passphrase(testnet: bool) -> &'static str {
    if testnet {
        "Test SDF Network ; September 2015"
    } else {
        "Public Global Stellar Network ; September 2015"
    }
}

/// Calculate Stellar transaction hash for signing
///
/// The hash is: SHA256(network_passphrase + "envelopeType" + transaction_xdr)
///
/// # Note
///
/// For full transaction building and signing, use the `stellar-sdk` crate
/// or implement XDR encoding. This module provides the key compatibility layer.
pub fn calculate_tx_hash(network_passphrase: &str, envelope_type: &[u8], tx_xdr: &[u8]) -> String {
    use sha2::{Digest, Sha256};

    let mut hasher = Sha256::new();
    hasher.update(Sha256::digest(network_passphrase.as_bytes()));
    hasher.update(envelope_type);
    hasher.update(tx_xdr);

    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gns_to_stellar_roundtrip() {
        // Known test vector
        let gns_pk = "3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29";

        let stellar_addr = gns_to_stellar_address(gns_pk).unwrap();
        assert!(stellar_addr.starts_with("G"), "Stellar address should start with G");
        assert_eq!(stellar_addr.len(), 56, "Stellar address should be 56 chars");

        let roundtrip = stellar_to_gns_address(&stellar_addr).unwrap();
        assert_eq!(roundtrip, gns_pk, "Roundtrip should preserve key");
    }

    #[test]
    fn test_stellar_compatibility_check() {
        let gns_pk = "3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29";
        assert!(verify_stellar_compatibility(gns_pk).unwrap());
    }

    #[test]
    fn test_invalid_hex_fails() {
        let result = gns_to_stellar_address("not_valid_hex");
        assert!(result.is_err());
    }

    #[test]
    fn test_wrong_length_fails() {
        let result = gns_to_stellar_address("3b6a27bc"); // Too short
        assert!(result.is_err());
    }

    #[test]
    fn test_network_passphrases() {
        assert!(get_network_passphrase(false).contains("Public"));
        assert!(get_network_passphrase(true).contains("Test"));
    }
}
