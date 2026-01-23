//! # Tauri Plugin GNS
//!
//! **Decentralized Identity for Tauri Applications**
//!
//! The GNS (Geospatial Naming System) plugin provides sovereign digital identity
//! for Tauri applications using Proof-of-Trajectory instead of centralized authorities.
//!
//! ## Core Principle
//!
//! > **Identity = Public Key**
//! >
//! > Your Ed25519 keypair IS your identity. No registrars. No corporations.
//! > Trust is earned through provable presence in the physical world.
//!
//! ## Features
//!
//! - **Identity Management**: Create, store, and manage Ed25519 keypairs
//! - **E2E Encryption**: X25519 key exchange with ChaCha20-Poly1305
//! - **Handle Resolution**: Resolve human-readable @handles to public keys
//! - **Trust Scoring**: Proof-of-Trajectory based identity verification
//! - **Secure Storage**: Encrypted SQLite with optional biometric protection
//!
//! ## Quick Start
//!
//! ```rust,no_run
//! fn main() {
//!     tauri::Builder::default()
//!         .plugin(tauri_plugin_gns::init())
//!         .run(tauri::generate_context!())
//!         .expect("error while running tauri application");
//! }
//! ```
//!
//! ## JavaScript/TypeScript API
//!
//! ```typescript
//! import { createIdentity, sendMessage, resolveHandle } from '@gns-protocol/tauri-plugin-gns-api';
//!
//! // Create a sovereign identity
//! const identity = await createIdentity({ name: 'Alice' });
//! console.log(`My identity: ${identity.publicKey}`);
//!
//! // Send an encrypted message
//! await sendMessage('@bob', { type: 'text', content: 'Hello from GNS!' });
//!
//! // Resolve a handle to a public key
//! const bob = await resolveHandle('@bob');
//! console.log(`Bob's trust score: ${bob.trustScore}%`);
//! ```
//!
//! ## The GNS Philosophy
//!
//! Traditional identity systems have fundamental flaws:
//!
//! | System | Problem |
//! |--------|---------|
//! | DNS | Pay rent forever to registrars |
//! | Phone Numbers | Carriers can revoke, SIM swap attacks |
//! | Social Logins | Corporations own your identity |
//! | Biometrics | Unchangeable if compromised |
//!
//! GNS solves this with **Proof-of-Trajectory**: your movement through the physical
//! world creates an unfakeable behavioral signature. Only humans with real bodies
//! can accumulate breadcrumbs across diverse locations over time.
//!
//! ## Security Model
//!
//! - **Ed25519** for digital signatures (same as Stellar, Tor, Signal)
//! - **X25519** for key exchange (derived from Ed25519)
//! - **ChaCha20-Poly1305** for symmetric encryption
//! - **HKDF-SHA256** for key derivation
//! - **H3** hexagonal cells for location privacy (no raw GPS)
//!
//! ## Patent Pending
//!
//! Proof-of-Trajectory methodology: US Provisional #63/948,788

#![doc(html_logo_url = "https://gns.earth/logo.png")]
#![doc(html_favicon_url = "https://gns.earth/favicon.ico")]
#![cfg_attr(docsrs, feature(doc_cfg))]

use std::path::Path;
use std::sync::Arc;

use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Runtime,
};
use tokio::sync::RwLock;

pub mod commands;
pub mod config;
pub mod core;
pub mod error;
pub mod models;

// Feature-gated modules
#[cfg(feature = "payments")]
#[cfg_attr(docsrs, doc(cfg(feature = "payments")))]
pub mod payments;

pub use config::GnsConfig;
pub use error::{Error, Result};
pub use models::*;

use core::{CryptoEngine, NetworkClient, StorageManager};

// Re-export commonly used types
pub use commands::identity::{
    create_identity, delete_identity, export_identity, get_identity, get_public_key,
    import_identity, list_identities, load_identity, set_default_identity, sign_message,
    verify_signature,
};
pub use commands::messaging::{
    decrypt_message, delete_message, get_conversations, get_message, get_messages, mark_as_read,
    send_message,
};
pub use commands::resolver::{
    claim_handle, get_record, is_handle_available, release_handle, resolve_handle,
    resolve_identity, update_record,
};
pub use commands::trust::{get_trust_details, get_trust_score, verify_identity};

// Trajectory commands (feature-gated)
#[cfg(feature = "trajectory")]
#[cfg_attr(docsrs, doc(cfg(feature = "trajectory")))]
pub use commands::trajectory::{
    collect_breadcrumb, get_breadcrumbs, get_collection_status, get_epochs, publish_epoch,
    start_collection, stop_collection,
};

/// GNS Plugin State
///
/// This struct holds all the runtime state for the GNS plugin,
/// including cryptographic engines, storage, and network clients.
///
/// # Thread Safety
///
/// All components are wrapped in `Arc` and use interior mutability
/// where needed, making the state safe to share across threads.
pub struct GnsState {
    /// Cryptographic operations engine (Ed25519, X25519, ChaCha20)
    pub crypto: CryptoEngine,

    /// Local encrypted SQLite storage
    pub storage: Arc<RwLock<StorageManager>>,

    /// Network client for relay communication
    pub network: Arc<NetworkClient>,

    /// Plugin configuration
    pub config: GnsConfig,

    /// Current active identity (public key hex)
    pub active_identity: Arc<RwLock<Option<String>>>,
}

impl GnsState {
    /// Create new GNS state with the given app data directory.
    ///
    /// # Arguments
    ///
    /// * `app_dir` - The application data directory for storing databases
    /// * `config` - Plugin configuration options
    ///
    /// # Returns
    ///
    /// A new `GnsState` instance or an error if initialization fails.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - Cryptographic initialization fails
    /// - Database cannot be created
    /// - Network client cannot be initialized
    pub fn new(app_dir: &Path, config: GnsConfig) -> Result<Self> {
        // Initialize cryptographic engine
        let crypto = CryptoEngine::new()?;

        // Initialize storage
        let db_path = app_dir.join("gns.db");
        let storage = StorageManager::new(&db_path, config.encrypt_storage)?;

        // Initialize network client
        let network = NetworkClient::new(&config.relay_urls)?;

        log::info!(
            "GNS state initialized: db={}, relays={}",
            db_path.display(),
            config.relay_urls.len()
        );

        Ok(Self {
            crypto,
            storage: Arc::new(RwLock::new(storage)),
            network: Arc::new(network),
            config,
            active_identity: Arc::new(RwLock::new(None)),
        })
    }

    /// Get the currently active identity's public key.
    pub async fn get_active_identity(&self) -> Option<String> {
        self.active_identity.read().await.clone()
    }

    /// Set the active identity by public key.
    pub async fn set_active_identity(&self, public_key: Option<String>) {
        *self.active_identity.write().await = public_key;
    }
}

/// Initialize the GNS plugin with default configuration.
///
/// This is the simplest way to add GNS identity to your Tauri application.
///
/// # Example
///
/// ```rust,no_run
/// fn main() {
///     tauri::Builder::default()
///         .plugin(tauri_plugin_gns::init())
///         .run(tauri::generate_context!())
///         .expect("error while running tauri application");
/// }
/// ```
///
/// # Configuration
///
/// For custom configuration, use the [`GnsBuilder`] instead.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::<R, ()>::new("gns")
        .invoke_handler(tauri::generate_handler![
            // Identity commands
            commands::identity::create_identity,
            commands::identity::load_identity,
            commands::identity::get_identity,
            commands::identity::list_identities,
            commands::identity::delete_identity,
            commands::identity::export_identity,
            commands::identity::import_identity,
            commands::identity::get_public_key,
            commands::identity::sign_message,
            commands::identity::verify_signature,
            commands::identity::set_default_identity,
            // Messaging commands
            commands::messaging::send_message,
            commands::messaging::get_messages,
            commands::messaging::get_message,
            commands::messaging::decrypt_message,
            commands::messaging::mark_as_read,
            commands::messaging::delete_message,
            commands::messaging::get_conversations,
            // Resolver commands
            commands::resolver::resolve_handle,
            commands::resolver::resolve_identity,
            commands::resolver::claim_handle,
            commands::resolver::release_handle,
            commands::resolver::get_record,
            commands::resolver::update_record,
            commands::resolver::is_handle_available,
            // Trust commands
            commands::trust::get_trust_score,
            commands::trust::get_trust_details,
            commands::trust::verify_identity,
            // Trajectory commands (if feature enabled)
            #[cfg(feature = "trajectory")]
            commands::trajectory::start_collection,
            #[cfg(feature = "trajectory")]
            commands::trajectory::stop_collection,
            #[cfg(feature = "trajectory")]
            commands::trajectory::get_collection_status,
            #[cfg(feature = "trajectory")]
            commands::trajectory::get_breadcrumbs,
            #[cfg(feature = "trajectory")]
            commands::trajectory::collect_breadcrumb,
            #[cfg(feature = "trajectory")]
            commands::trajectory::publish_epoch,
            #[cfg(feature = "trajectory")]
            commands::trajectory::get_epochs,
        ])
        .setup(|app, _api| {
            // Load configuration from tauri.conf.json or use defaults
            let config = app
                .config()
                .plugins
                .0
                .get("gns")
                .and_then(|v| serde_json::from_value::<GnsConfig>(v.clone()).ok())
                .unwrap_or_default();

            // Get app data directory
            let app_dir = app.path().app_data_dir().map_err(|e| {
                log::error!("Failed to get app data dir: {}", e);
                Error::Storage(format!("Failed to get app data dir: {}", e))
            })?;

            // Create directory if it doesn't exist
            std::fs::create_dir_all(&app_dir).map_err(|e| {
                Error::Storage(format!("Failed to create app data dir: {}", e))
            })?;

            // Initialize state
            let state = GnsState::new(&app_dir, config)?;

            // Register state with Tauri
            app.manage(state);

            log::info!("🌍 GNS Plugin initialized successfully");
            log::info!("   Identity = Public Key. Trust through Trajectory.");

            Ok(())
        })
        .build()
}

/// Builder for custom GNS plugin configuration.
///
/// Use this when you need to customize relay URLs, storage encryption,
/// or other plugin settings.
///
/// # Example
///
/// ```rust,no_run
/// fn main() {
///     tauri::Builder::default()
///         .plugin(
///             tauri_plugin_gns::GnsBuilder::new()
///                 .relay_url("https://relay.gns.earth")
///                 .encrypt_storage(true)
///                 .message_limit(100)
///                 .build()
///         )
///         .run(tauri::generate_context!())
///         .expect("error while running tauri application");
/// }
/// ```
pub struct GnsBuilder {
    config: GnsConfig,
}

impl GnsBuilder {
    /// Create a new builder with default configuration.
    pub fn new() -> Self {
        Self {
            config: GnsConfig::default(),
        }
    }

    /// Set a single relay URL.
    ///
    /// The relay URL is where messages are routed between identities.
    pub fn relay_url(mut self, url: impl Into<String>) -> Self {
        self.config.relay_urls = vec![url.into()];
        self
    }

    /// Set multiple relay URLs for redundancy.
    ///
    /// Multiple relays provide failover if one becomes unavailable.
    pub fn relay_urls(mut self, urls: Vec<String>) -> Self {
        self.config.relay_urls = urls;
        self
    }

    /// Enable or disable storage encryption.
    ///
    /// When enabled, the SQLite database is encrypted with a key
    /// derived from the device's secure enclave.
    pub fn encrypt_storage(mut self, enabled: bool) -> Self {
        self.config.encrypt_storage = enabled;
        self
    }

    /// Set the maximum number of messages to fetch per request.
    pub fn message_limit(mut self, limit: u32) -> Self {
        self.config.message_limit = limit;
        self
    }

    /// Set the cache time-to-live in seconds.
    ///
    /// Cached handle resolutions expire after this duration.
    pub fn cache_ttl(mut self, seconds: u64) -> Self {
        self.config.cache_ttl_seconds = seconds;
        self
    }

    /// Set the network timeout in seconds.
    pub fn network_timeout(mut self, seconds: u64) -> Self {
        self.config.network_timeout_seconds = seconds;
        self
    }

    /// Build the plugin with the configured options.
    ///
    /// # Returns
    ///
    /// A `TauriPlugin` that can be registered with `tauri::Builder::plugin()`.
    pub fn build<R: Runtime>(self) -> TauriPlugin<R> {
        let config = self.config;

        Builder::<R, ()>::new("gns")
            .invoke_handler(tauri::generate_handler![
                // Identity commands
                commands::identity::create_identity,
                commands::identity::load_identity,
                commands::identity::get_identity,
                commands::identity::list_identities,
                commands::identity::delete_identity,
                commands::identity::export_identity,
                commands::identity::import_identity,
                commands::identity::get_public_key,
                commands::identity::sign_message,
                commands::identity::verify_signature,
                commands::identity::set_default_identity,
                // Messaging commands
                commands::messaging::send_message,
                commands::messaging::get_messages,
                commands::messaging::get_message,
                commands::messaging::decrypt_message,
                commands::messaging::mark_as_read,
                commands::messaging::delete_message,
                commands::messaging::get_conversations,
                // Resolver commands
                commands::resolver::resolve_handle,
                commands::resolver::resolve_identity,
                commands::resolver::claim_handle,
                commands::resolver::release_handle,
                commands::resolver::get_record,
                commands::resolver::update_record,
                commands::resolver::is_handle_available,
                // Trust commands
                commands::trust::get_trust_score,
                commands::trust::get_trust_details,
                commands::trust::verify_identity,
                // Trajectory commands (feature-gated)
                #[cfg(feature = "trajectory")]
                commands::trajectory::start_collection,
                #[cfg(feature = "trajectory")]
                commands::trajectory::stop_collection,
                #[cfg(feature = "trajectory")]
                commands::trajectory::get_collection_status,
                #[cfg(feature = "trajectory")]
                commands::trajectory::get_breadcrumbs,
                #[cfg(feature = "trajectory")]
                commands::trajectory::collect_breadcrumb,
                #[cfg(feature = "trajectory")]
                commands::trajectory::publish_epoch,
                #[cfg(feature = "trajectory")]
                commands::trajectory::get_epochs,
            ])
            .setup(move |app, _api| {
                let app_dir = app.path().app_data_dir().map_err(|e| {
                    Error::Storage(format!("Failed to get app data dir: {}", e))
                })?;

                std::fs::create_dir_all(&app_dir).map_err(|e| {
                    Error::Storage(format!("Failed to create app data dir: {}", e))
                })?;

                let state = GnsState::new(&app_dir, config.clone())?;
                app.manage(state);

                log::info!("🌍 GNS Plugin initialized with custom config");

                Ok(())
            })
            .build()
    }
}

impl Default for GnsBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builder_default() {
        let builder = GnsBuilder::new();
        assert!(!builder.config.relay_urls.is_empty());
        assert!(!builder.config.encrypt_storage);
    }

    #[test]
    fn test_builder_custom_relay() {
        let builder = GnsBuilder::new().relay_url("https://custom.relay.com");
        assert_eq!(builder.config.relay_urls, vec!["https://custom.relay.com"]);
    }

    #[test]
    fn test_builder_multiple_relays() {
        let builder = GnsBuilder::new().relay_urls(vec![
            "https://relay1.gns.earth".to_string(),
            "https://relay2.gns.earth".to_string(),
        ]);
        assert_eq!(builder.config.relay_urls.len(), 2);
    }

    #[test]
    fn test_builder_encryption() {
        let builder = GnsBuilder::new().encrypt_storage(true);
        assert!(builder.config.encrypt_storage);
    }
}
