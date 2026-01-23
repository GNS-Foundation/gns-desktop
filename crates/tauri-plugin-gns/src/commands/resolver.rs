//! Resolver Commands
//!
//! Tauri commands for handle resolution and GNS record management.

use crate::core::CryptoEngine;
use crate::error::{Error, Result};
use crate::models::*;
use crate::GnsState;
use tauri::{command, State};

/// Resolve a handle to identity information
#[command]
pub async fn resolve_handle(state: State<'_, GnsState>, handle: String) -> Result<ResolvedHandle> {
    let handle = handle.trim_start_matches('@').to_lowercase();

    // Check cache first
    let storage = state.storage.read().await;
    if let Some(cached) = storage.get_cached_handle(&handle, state.config.cache_ttl_seconds)? {
        return Ok(cached);
    }
    drop(storage);

    // Fetch from network
    let resolved = state.network.resolve_handle(&handle).await?;

    // Cache the result
    let storage = state.storage.write().await;
    storage.cache_handle(&handle, &resolved)?;

    Ok(resolved)
}

/// Resolve identity by public key
#[command]
pub async fn resolve_identity(state: State<'_, GnsState>, public_key: String) -> Result<GnsRecord> {
    state.network.get_record(&public_key).await
}

/// Claim a handle for the current identity
#[command]
pub async fn claim_handle(state: State<'_, GnsState>, handle: String) -> Result<()> {
    let handle = handle.trim_start_matches('@').to_lowercase();

    // Validate handle format
    if handle.len() < 3 || handle.len() > 20 {
        return Err(Error::InvalidHandle(
            "Handle must be 3-20 characters".to_string(),
        ));
    }

    if !handle
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
    {
        return Err(Error::InvalidHandle(
            "Handle must be lowercase alphanumeric with underscores".to_string(),
        ));
    }

    if RESERVED_HANDLES.contains(&handle.as_str()) {
        return Err(Error::HandleUnavailable("Handle is reserved".to_string()));
    }

    let my_pk = state
        .get_active_identity()
        .await
        .ok_or_else(|| Error::IdentityNotFound("No active identity".to_string()))?;

    // Check if available
    if !state.network.is_handle_available(&handle).await? {
        return Err(Error::HandleUnavailable(format!(
            "Handle @{} is already claimed",
            handle
        )));
    }

    // Get identity data
    let storage = state.storage.read().await;
    let identity = storage
        .get_identity(&my_pk)?
        .ok_or_else(|| Error::IdentityNotFound(my_pk.clone()))?;
    let secret_key = storage
        .get_secret_key(&my_pk)?
        .ok_or_else(|| Error::IdentityNotFound(my_pk.clone()))?;
    drop(storage);

    // Check trust requirements
    if identity.breadcrumb_count < state.config.min_breadcrumbs_for_handle {
        return Err(Error::InsufficientBreadcrumbs(format!(
            "Need {} breadcrumbs, have {}",
            state.config.min_breadcrumbs_for_handle, identity.breadcrumb_count
        )));
    }

    if identity.trust_score < state.config.min_trust_score_for_handle {
        return Err(Error::InsufficientTrust(format!(
            "Need {}% trust, have {}%",
            state.config.min_trust_score_for_handle, identity.trust_score
        )));
    }

    // Create proof
    let proof = PotProof {
        breadcrumb_count: identity.breadcrumb_count,
        trust_score: identity.trust_score,
        first_breadcrumb_at: identity.created_at.clone(),
        latest_epoch_root: None,
    };

    // Create claim
    let claim_data = serde_json::to_string(&serde_json::json!({
        "handle": handle,
        "identity": my_pk,
        "proof": proof,
    }))?;
    let signature = CryptoEngine::sign(&secret_key, claim_data.as_bytes())?;

    let claim = HandleClaim {
        handle: handle.clone(),
        identity: my_pk.clone(),
        proof,
        signature,
    };

    // Submit claim
    state.network.claim_handle(&claim).await?;

    log::info!("Claimed handle @{} for {}", handle, &my_pk[..12]);

    Ok(())
}

/// Release a claimed handle
#[command]
pub async fn release_handle(state: State<'_, GnsState>, handle: String) -> Result<()> {
    let handle = handle.trim_start_matches('@').to_lowercase();

    let my_pk = state
        .get_active_identity()
        .await
        .ok_or_else(|| Error::IdentityNotFound("No active identity".to_string()))?;

    let storage = state.storage.read().await;
    let secret_key = storage
        .get_secret_key(&my_pk)?
        .ok_or_else(|| Error::IdentityNotFound(my_pk.clone()))?;
    drop(storage);

    // Sign release request
    let release_data = serde_json::to_string(&serde_json::json!({
        "handle": handle,
        "identity": my_pk,
        "action": "release",
    }))?;
    let signature = CryptoEngine::sign(&secret_key, release_data.as_bytes())?;

    state
        .network
        .release_handle(&handle, &my_pk, &signature)
        .await?;

    log::info!("Released handle @{}", handle);

    Ok(())
}

/// Get the full GNS record for an identity
#[command]
pub async fn get_record(state: State<'_, GnsState>, public_key: String) -> Result<GnsRecord> {
    state.network.get_record(&public_key).await
}

/// Update the GNS record for the current identity
#[command]
pub async fn update_record(state: State<'_, GnsState>, record: GnsRecord) -> Result<()> {
    let my_pk = state
        .get_active_identity()
        .await
        .ok_or_else(|| Error::IdentityNotFound("No active identity".to_string()))?;

    // Verify record belongs to us
    if record.identity != my_pk {
        return Err(Error::PermissionDenied(
            "Cannot update another identity's record".to_string(),
        ));
    }

    // Validate record
    record.validate().map_err(|e| Error::InvalidInput(e))?;

    // Get secret key for signing
    let storage = state.storage.read().await;
    let secret_key = storage
        .get_secret_key(&my_pk)?
        .ok_or_else(|| Error::IdentityNotFound(my_pk.clone()))?;
    drop(storage);

    // Sign the record
    let record_json = serde_json::to_string(&record)?;
    let signature = CryptoEngine::sign(&secret_key, record_json.as_bytes())?;

    let signed_record = SignedRecord {
        pk_root: my_pk,
        record_json: record,
        signature,
    };

    state.network.update_record(&signed_record).await?;

    Ok(())
}

/// Check if a handle is available
#[command]
pub async fn is_handle_available(state: State<'_, GnsState>, handle: String) -> Result<bool> {
    let handle = handle.trim_start_matches('@').to_lowercase();

    // Check reserved handles
    if RESERVED_HANDLES.contains(&handle.as_str()) {
        return Ok(false);
    }

    // Check network
    state.network.is_handle_available(&handle).await
}
