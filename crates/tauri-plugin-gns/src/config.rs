//! GNS Plugin Configuration
//!
//! Configuration options for the GNS plugin, loadable from
//! `tauri.conf.json` or set programmatically via [`GnsBuilder`].

use serde::{Deserialize, Serialize};

/// GNS Plugin Configuration
///
/// This struct defines all configurable options for the GNS plugin.
///
/// # Configuration in tauri.conf.json
///
/// ```json
/// {
///   "plugins": {
///     "gns": {
///       "relayUrls": ["https://relay.gns.earth"],
///       "encryptStorage": true,
///       "messageLimit": 50,
///       "cacheTtlSeconds": 300
///     }
///   }
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GnsConfig {
    /// URLs of GNS relay servers for message routing.
    ///
    /// Default: `["https://gns-node-production.up.railway.app"]`
    #[serde(default = "default_relay_urls")]
    pub relay_urls: Vec<String>,

    /// Whether to encrypt the local SQLite database.
    ///
    /// When enabled, uses platform-specific secure storage
    /// (Keychain on iOS/macOS, Keystore on Android).
    ///
    /// Default: `false`
    #[serde(default)]
    pub encrypt_storage: bool,

    /// Maximum number of messages to fetch per request.
    ///
    /// Default: `50`
    #[serde(default = "default_message_limit")]
    pub message_limit: u32,

    /// Cache time-to-live in seconds for handle resolutions.
    ///
    /// Default: `300` (5 minutes)
    #[serde(default = "default_cache_ttl")]
    pub cache_ttl_seconds: u64,

    /// Network request timeout in seconds.
    ///
    /// Default: `30`
    #[serde(default = "default_network_timeout")]
    pub network_timeout_seconds: u64,

    /// Minimum trust score required to claim a handle.
    ///
    /// Default: `20.0`
    #[serde(default = "default_min_trust_score")]
    pub min_trust_score_for_handle: f64,

    /// Minimum breadcrumb count required to claim a handle.
    ///
    /// Default: `100`
    #[serde(default = "default_min_breadcrumbs")]
    pub min_breadcrumbs_for_handle: u32,

    /// H3 resolution for location quantization (privacy level).
    ///
    /// Higher values = more precise locations (less privacy).
    /// - Resolution 5: ~252 km² (country-level)
    /// - Resolution 7: ~5.1 km² (city-level)
    /// - Resolution 9: ~0.1 km² (neighborhood-level)
    ///
    /// Default: `7`
    #[serde(default = "default_h3_resolution")]
    pub h3_resolution: u8,

    /// Enable debug logging for GNS operations.
    ///
    /// Default: `false`
    #[serde(default)]
    pub debug: bool,

    // ========================================================================
    // Trajectory Feature Configuration
    // ========================================================================

    /// Breadcrumb collection interval in seconds.
    ///
    /// How often to collect location breadcrumbs when trajectory is enabled.
    ///
    /// Default: `300` (5 minutes)
    #[cfg(feature = "trajectory")]
    #[cfg_attr(docsrs, doc(cfg(feature = "trajectory")))]
    #[serde(default = "default_breadcrumb_interval")]
    pub breadcrumb_collection_interval: u64,

    /// Minimum breadcrumbs required to publish an epoch.
    ///
    /// Default: `100`
    #[cfg(feature = "trajectory")]
    #[cfg_attr(docsrs, doc(cfg(feature = "trajectory")))]
    #[serde(default = "default_min_breadcrumbs_for_epoch")]
    pub min_breadcrumbs_for_epoch: usize,
}

fn default_relay_urls() -> Vec<String> {
    vec!["https://gns-node-production.up.railway.app".to_string()]
}

fn default_message_limit() -> u32 {
    50
}

fn default_cache_ttl() -> u64 {
    300 // 5 minutes
}

fn default_network_timeout() -> u64 {
    30
}

fn default_min_trust_score() -> f64 {
    20.0
}

fn default_min_breadcrumbs() -> u32 {
    100
}

fn default_h3_resolution() -> u8 {
    7 // City-level precision
}

#[cfg(feature = "trajectory")]
fn default_breadcrumb_interval() -> u64 {
    300 // 5 minutes
}

#[cfg(feature = "trajectory")]
fn default_min_breadcrumbs_for_epoch() -> usize {
    100
}

impl Default for GnsConfig {
    fn default() -> Self {
        Self {
            relay_urls: default_relay_urls(),
            encrypt_storage: false,
            message_limit: default_message_limit(),
            cache_ttl_seconds: default_cache_ttl(),
            network_timeout_seconds: default_network_timeout(),
            min_trust_score_for_handle: default_min_trust_score(),
            min_breadcrumbs_for_handle: default_min_breadcrumbs(),
            h3_resolution: default_h3_resolution(),
            debug: false,
            #[cfg(feature = "trajectory")]
            breadcrumb_collection_interval: default_breadcrumb_interval(),
            #[cfg(feature = "trajectory")]
            min_breadcrumbs_for_epoch: default_min_breadcrumbs_for_epoch(),
        }
    }
}

impl GnsConfig {
    /// Create a configuration for development/testing.
    ///
    /// Uses local relay and enables debug logging.
    pub fn development() -> Self {
        Self {
            relay_urls: vec!["http://localhost:3000".to_string()],
            debug: true,
            min_trust_score_for_handle: 0.0,
            min_breadcrumbs_for_handle: 0,
            ..Default::default()
        }
    }

    /// Create a configuration for production.
    ///
    /// Uses official relays with storage encryption enabled.
    pub fn production() -> Self {
        Self {
            relay_urls: vec![
                "https://gns-node-production.up.railway.app".to_string(),
                "https://relay2.gns.earth".to_string(),
            ],
            encrypt_storage: true,
            ..Default::default()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = GnsConfig::default();
        assert!(!config.relay_urls.is_empty());
        assert!(!config.encrypt_storage);
        assert_eq!(config.message_limit, 50);
    }

    #[test]
    fn test_development_config() {
        let config = GnsConfig::development();
        assert!(config.debug);
        assert_eq!(config.min_breadcrumbs_for_handle, 0);
    }

    #[test]
    fn test_production_config() {
        let config = GnsConfig::production();
        assert!(config.encrypt_storage);
        assert!(config.relay_urls.len() >= 2);
    }

    #[test]
    fn test_json_deserialization() {
        let json = r#"{
            "relayUrls": ["https://custom.relay.com"],
            "encryptStorage": true,
            "messageLimit": 100
        }"#;

        let config: GnsConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.relay_urls, vec!["https://custom.relay.com"]);
        assert!(config.encrypt_storage);
        assert_eq!(config.message_limit, 100);
    }
}
