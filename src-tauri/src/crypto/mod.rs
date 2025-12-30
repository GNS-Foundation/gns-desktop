//! Crypto Module - Identity Management
//!
//! Wraps the gns-crypto-core crate and provides keychain integration.

use gns_crypto_core::GnsIdentity;
use keyring::Entry;
// use std::sync::Arc;

const SERVICE_NAME: &str = "com.gcrumbs.browser";
const IDENTITY_KEY: &str = "identity_private_key";
const HANDLE_KEY: &str = "cached_handle";

/// Identity manager with keychain integration
pub struct IdentityManager {
    /// Cached identity (loaded from keychain)
    identity: Option<GnsIdentity>,

    /// Cached handle
    cached_handle: Option<String>,
}

impl IdentityManager {
    /// Create a new identity manager
    pub fn new() -> Result<Self, IdentityError> {
        let mut manager = Self {
            identity: None,
            cached_handle: None,
        };

        // Try to load existing identity from keychain
        if let Ok(private_key) = manager.load_from_keychain() {
            if let Ok(identity) = GnsIdentity::from_hex(&private_key) {
                manager.identity = Some(identity);
            }
        }

        // Load cached handle
        manager.cached_handle = manager.load_cached_handle().ok();

        Ok(manager)
    }

    /// Check if an identity exists
    pub fn has_identity(&self) -> bool {
        self.identity.is_some()
    }

    /// Get the identity
    pub fn get_identity(&self) -> Option<&GnsIdentity> {
        self.identity.as_ref()
    }

    /// Get public key hex
    pub fn public_key_hex(&self) -> Option<String> {
        self.identity.as_ref().map(|i| i.public_key_hex())
    }

    /// Get encryption key hex
    pub fn encryption_key_hex(&self) -> Option<String> {
        self.identity.as_ref().map(|i| i.encryption_key_hex())
    }

    /// Get private key hex (USE WITH CAUTION!)
    pub fn private_key_hex(&self) -> Option<String> {
        self.identity.as_ref().map(|i| i.private_key_hex())
    }

    /// Get cached handle
    pub fn cached_handle(&self) -> Option<String> {
        self.cached_handle.clone()
    }

    /// Set cached handle
    pub fn set_cached_handle(&mut self, handle: Option<String>) {
        self.cached_handle = handle.clone();

        if let Some(h) = handle {
            let _ = self.save_cached_handle(&h);
        } else {
            let _ = self.clear_cached_handle();
        }
    }

    /// Generate a new identity
    pub fn generate_new(&mut self) -> Result<(), IdentityError> {
        let identity = GnsIdentity::generate();
        let private_key_hex = identity.private_key_hex();

        // Save to keychain
        self.save_to_keychain(&private_key_hex)?;

        self.identity = Some(identity);
        self.cached_handle = None;

        Ok(())
    }

    /// Import identity from hex private key
    pub fn import_from_hex(&mut self, private_key_hex: &str) -> Result<(), IdentityError> {
        let identity = GnsIdentity::from_hex(private_key_hex)
            .map_err(|e| IdentityError::InvalidKey(e.to_string()))?;

        // Save to keychain
        self.save_to_keychain(private_key_hex)?;

        self.identity = Some(identity);
        self.cached_handle = None;

        Ok(())
    }

    // ==================== Keychain Operations ====================

    fn load_from_keychain(&self) -> Result<String, IdentityError> {
        let entry = Entry::new(SERVICE_NAME, IDENTITY_KEY)
            .map_err(|e| IdentityError::KeychainError(e.to_string()))?;

        entry
            .get_password()
            .map_err(|e| IdentityError::KeychainError(e.to_string()))
    }

    fn save_to_keychain(&self, private_key_hex: &str) -> Result<(), IdentityError> {
        let entry = Entry::new(SERVICE_NAME, IDENTITY_KEY)
            .map_err(|e| IdentityError::KeychainError(e.to_string()))?;

        entry
            .set_password(private_key_hex)
            .map_err(|e| IdentityError::KeychainError(e.to_string()))
    }

    fn load_cached_handle(&self) -> Result<String, IdentityError> {
        let entry = Entry::new(SERVICE_NAME, HANDLE_KEY)
            .map_err(|e| IdentityError::KeychainError(e.to_string()))?;

        entry
            .get_password()
            .map_err(|e| IdentityError::KeychainError(e.to_string()))
    }

    fn save_cached_handle(&self, handle: &str) -> Result<(), IdentityError> {
        let entry = Entry::new(SERVICE_NAME, HANDLE_KEY)
            .map_err(|e| IdentityError::KeychainError(e.to_string()))?;

        entry
            .set_password(handle)
            .map_err(|e| IdentityError::KeychainError(e.to_string()))
    }

    fn clear_cached_handle(&self) -> Result<(), IdentityError> {
        let entry = Entry::new(SERVICE_NAME, HANDLE_KEY)
            .map_err(|e| IdentityError::KeychainError(e.to_string()))?;

        entry
            .delete_password()
            .map_err(|e| IdentityError::KeychainError(e.to_string()))
    }
}

/// Identity manager errors
#[derive(Debug, thiserror::Error)]
pub enum IdentityError {
    #[error("Keychain error: {0}")]
    KeychainError(String),

    #[error("Invalid key: {0}")]
    InvalidKey(String),

    #[error("No identity configured")]
    NoIdentity,
}
