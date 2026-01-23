//! Trajectory Collection Commands
//!
//! Commands for collecting and publishing Proof-of-Trajectory breadcrumbs.
//! This module requires the `trajectory` feature flag.

use tauri::{command, State};
use crate::{
    error::{Error, Result},
    models::breadcrumb::{
        Breadcrumb, BreadcrumbBlock, BreadcrumbQuery, LocationSource,
        CollectionStatus, EpochHeader, SignedEpoch,
    },
    GnsState,
};
use chrono::{Utc, DateTime, Duration};
use h3o::{CellIndex, LatLng, Resolution};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

// Global collection state
static COLLECTION_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Start collecting breadcrumbs for the active identity.
///
/// Breadcrumbs are location proofs that form an unforgeable trajectory chain.
/// Each breadcrumb contains:
/// - H3 hexagonal cell index (privacy-preserving location)
/// - Timestamp
/// - Hash linking to previous breadcrumb
/// - Cryptographic signature
///
/// # Platform Requirements
/// - iOS: Requires NSLocationWhenInUseUsageDescription
/// - Android: Requires ACCESS_FINE_LOCATION permission
#[command]
pub async fn start_collection(
    state: State<'_, GnsState>,
    interval_seconds: Option<u64>,
) -> Result<CollectionStatus> {
    if COLLECTION_ACTIVE.load(Ordering::SeqCst) {
        return Err(Error::InvalidInput("Collection already active".into()));
    }
    
    // Verify we have an active identity
    let storage = state.storage.read().await;
    let identities = storage.list_identities()?;
    if identities.is_empty() {
        return Err(Error::IdentityNotFound("No identity to collect breadcrumbs for".into()));
    }
    drop(storage);
    
    COLLECTION_ACTIVE.store(true, Ordering::SeqCst);
    
    let interval = interval_seconds.unwrap_or(state.config.breadcrumb_collection_interval);
    
    log::info!("Started breadcrumb collection with {}s interval", interval);
    
    get_collection_status(state).await
}

/// Stop collecting breadcrumbs.
#[command]
pub async fn stop_collection(
    state: State<'_, GnsState>,
) -> Result<CollectionStatus> {
    COLLECTION_ACTIVE.store(false, Ordering::SeqCst);
    
    log::info!("Stopped breadcrumb collection");
    
    get_collection_status(state).await
}

/// Get current collection status.
#[command]
pub async fn get_collection_status(
    state: State<'_, GnsState>,
) -> Result<CollectionStatus> {
    let storage = state.storage.read().await;
    
    // Get active identity
    let identities = storage.list_identities()?;
    let identity = identities.iter()
        .find(|i| i.is_default)
        .or_else(|| identities.first());
    
    let (total_count, pending_count) = if let Some(id) = identity {
        let total = storage.get_breadcrumb_count(&id.public_key)?;
        // For now, estimate pending as total (would need to track published state)
        (total as u32, 0u32)
    } else {
        (0, 0)
    };
    
    Ok(CollectionStatus {
        is_active: COLLECTION_ACTIVE.load(Ordering::SeqCst),
        total_count,
        pending_count,
        epoch_count: total_count / 100, // ~100 breadcrumbs per epoch
        last_breadcrumb_at: None, // Would be tracked in actual implementation
        last_epoch_at: None,
        h3_resolution: state.config.h3_resolution,
        collection_interval: state.config.breadcrumb_collection_interval as u32,
    })
}

/// Get breadcrumbs for the active identity with optional filtering.
#[command]
pub async fn get_breadcrumbs(
    state: State<'_, GnsState>,
    query: Option<BreadcrumbQuery>,
) -> Result<Vec<Breadcrumb>> {
    let storage = state.storage.read().await;
    
    // Get active identity
    let identities = storage.list_identities()?;
    let identity = identities.iter()
        .find(|i| i.is_default)
        .or_else(|| identities.first())
        .ok_or(Error::IdentityNotFound("No identity found".into()))?;
    
    // In a full implementation, this would query the breadcrumbs table
    // with the provided filters
    log::info!("Getting breadcrumbs for identity: {}", &identity.public_key[..16]);
    
    // Return empty for now - would be populated by actual collection
    Ok(vec![])
}

/// Collect a single breadcrumb at the given location.
///
/// This is called internally by the collection system or can be triggered
/// manually for testing.
#[command]
pub async fn collect_breadcrumb(
    state: State<'_, GnsState>,
    latitude: f64,
    longitude: f64,
    accuracy: Option<f32>,
    source: Option<LocationSource>,
) -> Result<Breadcrumb> {
    let storage = state.storage.write().await;
    
    // Get active identity
    let identities = storage.list_identities()?;
    let identity = identities.iter()
        .find(|i| i.is_default)
        .or_else(|| identities.first())
        .ok_or(Error::IdentityNotFound("No identity found".into()))?;
    
    // Get identity's secret key for signing
    let secret_key = storage.get_secret_key(&identity.public_key)?
        .ok_or(Error::IdentityNotFound("Secret key not found".into()))?;
    
    // Convert to H3 cell for privacy
    let resolution = Resolution::try_from(state.config.h3_resolution)
        .map_err(|_| Error::InvalidInput("Invalid H3 resolution".into()))?;
    let latlng = LatLng::new(latitude, longitude)
        .map_err(|_| Error::InvalidInput("Invalid coordinates".into()))?;
    let cell = latlng.to_cell(resolution);
    
    // Get previous breadcrumb hash for chaining
    let prev_hash = get_last_breadcrumb_hash(&*storage, &identity.public_key)?
        .unwrap_or_else(|| "genesis".to_string());
    
    // Create breadcrumb
    let timestamp = Utc::now();
    let id = crate::core::CryptoEngine::random_id();
    
    // Calculate hash: H(h3_index || timestamp || prev_hash)
    let hash_input = format!("{}|{}|{}", cell.to_string(), timestamp.timestamp_millis(), prev_hash);
    let hash = crate::core::CryptoEngine::sha256(hash_input.as_bytes());
    
    // Sign the hash
    let signature = crate::core::CryptoEngine::sign(&secret_key, hash.as_bytes())?;
    
    let breadcrumb = Breadcrumb {
        id,
        h3_index: cell.to_string(),
        h3_resolution: state.config.h3_resolution,
        timestamp: timestamp.to_rfc3339(),
        prev_hash: Some(prev_hash),
        hash: hash.clone(),
        signature,
        source: source.unwrap_or(LocationSource::Gps),
        accuracy: accuracy.map(|a| a as f64),
        published: false,
    };
    
    // Save to storage
    storage.save_breadcrumb(&identity.public_key, &breadcrumb)?;
    
    log::debug!("Collected breadcrumb: {} at {}", &breadcrumb.id[..8], breadcrumb.h3_index);
    
    Ok(breadcrumb)
}

/// Publish unpublished breadcrumbs as a new epoch.
///
/// An epoch bundles breadcrumbs into a verifiable package:
/// - Groups breadcrumbs into blocks
/// - Calculates Merkle root for each block
/// - Creates epoch header with summary
/// - Signs and publishes to GNS network
///
/// Requirements:
/// - At least 100 unpublished breadcrumbs
/// - Valid hash chain
#[command]
pub async fn publish_epoch(
    state: State<'_, GnsState>,
) -> Result<EpochHeader> {
    let storage = state.storage.write().await;
    let network = &state.network;
    
    // Get active identity
    let identities = storage.list_identities()?;
    let identity = identities.iter()
        .find(|i| i.is_default)
        .or_else(|| identities.first())
        .ok_or(Error::IdentityNotFound("No identity found".into()))?;
    
    let secret_key = storage.get_secret_key(&identity.public_key)?
        .ok_or(Error::IdentityNotFound("Secret key not found".into()))?;
    
    // Get unpublished breadcrumbs
    let breadcrumb_count = storage.get_breadcrumb_count(&identity.public_key)?;
    
    if breadcrumb_count < state.config.min_breadcrumbs_for_epoch as u32 {
        return Err(Error::InsufficientBreadcrumbs(format!(
            "Need {} breadcrumbs, have {}",
            state.config.min_breadcrumbs_for_epoch, breadcrumb_count
        )));
    }
    
    // In a full implementation:
    // 1. Fetch unpublished breadcrumbs from storage
    // 2. Group into blocks of ~10 breadcrumbs each
    // 3. Calculate Merkle root for each block
    // 4. Create epoch header
    // 5. Sign and publish
    
    let epoch_index = breadcrumb_count / (state.config.min_breadcrumbs_for_epoch as u32);
    let prev_epoch_hash = get_last_epoch_hash(&*storage, &identity.public_key)?;
    
    // Create epoch header
    let merkle_root = crate::core::CryptoEngine::sha256(
        format!("epoch-{}-{}", identity.public_key, epoch_index).as_bytes()
    );
    
    let epoch = EpochHeader {
        identity: identity.public_key.clone(),
        epoch_index: epoch_index as u32,
        start_time: (Utc::now() - Duration::days(7)).to_rfc3339(), // Placeholder
        end_time: Utc::now().to_rfc3339(),
        merkle_root: merkle_root.clone(),
        block_count: (breadcrumb_count as u32 / 10).max(1),
        prev_epoch_hash,
        signature: String::new(), // Will be set after signing
        epoch_hash: String::new(), // Will be set after hashing
    };
    
    // Calculate epoch hash
    use chrono::DateTime as ChronoDateTime;
    let start_dt = ChronoDateTime::parse_from_rfc3339(&epoch.start_time)
        .map_err(|_| Error::InvalidInput("Invalid start time".into()))?;
    let end_dt = ChronoDateTime::parse_from_rfc3339(&epoch.end_time)
        .map_err(|_| Error::InvalidInput("Invalid end time".into()))?;
    
    let epoch_data = format!(
        "{}|{}|{}|{}|{}|{}",
        epoch.identity,
        epoch.epoch_index,
        start_dt.timestamp(),
        end_dt.timestamp(),
        epoch.merkle_root,
        epoch.prev_epoch_hash.as_deref().unwrap_or("genesis")
    );
    let epoch_hash = crate::core::CryptoEngine::sha256(epoch_data.as_bytes());
    
    // Sign the epoch hash
    let signature = crate::core::CryptoEngine::sign(&secret_key, epoch_hash.as_bytes())?;
    
    let signed_epoch = EpochHeader {
        epoch_hash: epoch_hash.clone(),
        signature: signature.clone(),
        ..epoch
    };
    
    // Publish to network
    let signed_wrapper = SignedEpoch {
        pk_root: identity.public_key.clone(),
        epoch: signed_epoch.clone(),
        signature,
    };
    
    network.publish_epoch(&signed_wrapper).await?;
    
    log::info!("Published epoch {} with {} blocks", signed_epoch.epoch_index, signed_epoch.block_count);
    
    Ok(signed_epoch)
}

/// Get epoch history for the active identity.
#[command]
pub async fn get_epochs(
    state: State<'_, GnsState>,
) -> Result<Vec<EpochHeader>> {
    let storage = state.storage.read().await;
    let network = &state.network;
    
    // Get active identity
    let identities = storage.list_identities()?;
    let identity = identities.iter()
        .find(|i| i.is_default)
        .or_else(|| identities.first())
        .ok_or(Error::IdentityNotFound("No identity found".into()))?;
    
    // Fetch epochs from network
    let epochs = network.get_epochs(&identity.public_key).await?;
    
    Ok(epochs)
}

// Helper functions

fn get_last_breadcrumb_hash(
    storage: &crate::core::StorageManager,
    identity_pk: &str,
) -> Result<Option<String>> {
    // In a full implementation, query the most recent breadcrumb
    // For now, return None (genesis)
    Ok(None)
}

fn get_last_epoch_hash(
    storage: &crate::core::StorageManager,
    identity_pk: &str,
) -> Result<Option<String>> {
    // In a full implementation, query the most recent epoch
    // For now, return None (genesis)
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use h3o::{LatLng, Resolution};
    
    #[test]
    fn test_h3_cell_creation() {
        let lat = 37.7749; // San Francisco
        let lng = -122.4194;
        
        let latlng = LatLng::new(lat, lng).unwrap();
        let cell = latlng.to_cell(Resolution::Seven);
        
        // H3 index should be a valid string
        let index_str = cell.to_string();
        assert!(!index_str.is_empty());
        assert!(index_str.starts_with("87")); // Resolution 7 cells start with 87
    }
    
    #[test]
    fn test_collection_state() {
        // Initially not collecting
        assert!(!COLLECTION_ACTIVE.load(Ordering::SeqCst));
        
        // Start collection
        COLLECTION_ACTIVE.store(true, Ordering::SeqCst);
        assert!(COLLECTION_ACTIVE.load(Ordering::SeqCst));
        
        // Stop collection
        COLLECTION_ACTIVE.store(false, Ordering::SeqCst);
        assert!(!COLLECTION_ACTIVE.load(Ordering::SeqCst));
    }
}
