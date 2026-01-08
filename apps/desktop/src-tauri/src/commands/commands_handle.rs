//! Tauri Commands for Handle Operations
//!
//! These commands are exposed to the frontend (React/Vue/Svelte)
//! for the welcome flow and handle management.

use tauri::State;
use serde::Serialize;

use crate::AppState;
use crate::commands::handles::{validate_handle, HandleStatus, ClaimRequirements, canonical_json};
use crate::network::{ApiClient, ClaimProof, HandleCheckResult, HandleReservationResult, HandleClaimResult};

// ==================== Constants ====================

const GNS_API_URL: &str = "https://gns-browser-production.up.railway.app";

// ==================== Response Types ====================

#[derive(Debug, Clone, Serialize)]
pub struct CommandResult<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> CommandResult<T> {
    pub fn ok(data: T) -> Self {
        Self { success: true, data: Some(data), error: None }
    }
    
    pub fn err(error: impl ToString) -> Self {
        Self { success: false, data: None, error: Some(error.to_string()) }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct IdentityWithHandle {
    pub public_key: String,
    pub encryption_key: String,
    pub gns_id: String,
    pub handle_status: HandleStatus,
}

#[derive(Debug, Clone, Serialize)]
pub struct CreateIdentityResult {
    pub public_key: String,
    pub encryption_key: String,
    pub gns_id: String,
    pub handle: String,
    pub network_reserved: bool,
    pub message: String,
}

// ==================== Tauri Commands ====================

/// Validate a handle format (client-side only, no network)
#[tauri::command]
pub fn validate_handle_format(handle: String) -> CommandResult<String> {
    match validate_handle(&handle) {
        Ok(clean) => CommandResult::ok(clean),
        Err(e) => CommandResult::err(e),
    }
}

/// Check if a handle is available on the network
#[tauri::command]
pub async fn check_handle_available(handle: String) -> CommandResult<HandleCheckResult> {
    // First validate locally
    let clean_handle = match validate_handle(&handle) {
        Ok(h) => h,
        Err(e) => return CommandResult::err(e),
    };
    
    // Then check network
    let api = match ApiClient::new(GNS_API_URL) {
        Ok(a) => a,
        Err(e) => return CommandResult::err(e),
    };
    
    match api.check_handle_available(&clean_handle).await {
        Ok(result) => CommandResult::ok(result),
        Err(e) => CommandResult::err(e),
    }
}

/// Create a new identity and reserve a handle atomically
/// This is the main entry point for new users
#[tauri::command]
pub async fn create_identity_with_handle(
    handle: String,
    state: State<'_, AppState>,
) -> Result<CommandResult<CreateIdentityResult>, String> {
    // 1. Validate handle format
    let clean_handle = match validate_handle(&handle) {
        Ok(h) => h,
        Err(e) => return Ok(CommandResult::err(e)),
    };
    
    // 2. Check if identity already exists
    {
        let identity = state.identity.lock().await;
        if identity.has_identity() {
            return Ok(CommandResult::err("Identity already exists. Use reserve_handle instead."));
        }
    }
    
    // 3. Create API client and check handle availability
    let api = match ApiClient::new(GNS_API_URL) {
        Ok(a) => a,
        Err(e) => return Ok(CommandResult::err(e)),
    };
    
    let check_result = match api.check_handle_available(&clean_handle).await {
        Ok(r) => r,
        Err(e) => return Ok(CommandResult::err(e)),
    };
    
    if !check_result.available {
        return Ok(CommandResult::err(format!(
            "@{} is not available: {}",
            clean_handle,
            check_result.reason.unwrap_or_else(|| "already taken".to_string())
        )));
    }
    
    // 4. Generate new identity
    let mut identity = state.identity.lock().await;
    if let Err(e) = identity.generate_new() {
        return Ok(CommandResult::err(format!("Failed to generate identity: {}", e)));
    }
    
    let public_key = identity.public_key_hex().unwrap_or_default();
    let encryption_key = identity.encryption_key_hex().unwrap_or_default();
    let gns_id = format!("gns_{}", &public_key[..16]);
    
    tracing::info!("🔑 New identity generated: {}", gns_id);
    tracing::info!("   Ed25519: {}...", &public_key[..16]);
    tracing::info!("   X25519:  {}...", &encryption_key[..16]);
    
    // 5. Sign reservation request
    let timestamp = chrono::Utc::now().to_rfc3339();
    let message = format!("reserve:{}:{}", clean_handle, timestamp);
    
    let signature = match identity.get_identity() {
        Some(id) => hex::encode(id.sign_bytes(message.as_bytes())),
        None => return Ok(CommandResult::err("Identity not found after generation")),
    };
    
    // 6. Reserve handle on network
    let reserve_result = api.reserve_handle(
        &clean_handle, 
        &public_key, 
        &encryption_key,
        &signature,
        &timestamp,
    ).await;
    
    let (network_reserved, error_msg) = match reserve_result {
        Ok(r) => (r.success && r.network_reserved, r.error),
        Err(e) => (false, Some(e.to_string())),
    };
    
    // 7. Store reserved handle locally (even if network failed)
    identity.set_cached_handle(Some(clean_handle.clone()));
    
    // 8. Publish initial record to network (so others can find our encryption key)
    if network_reserved {
        let now = chrono::Utc::now().to_rfc3339();
        
        let mut record_json = serde_json::json!({
            "identity": public_key,
            "encryption_key": encryption_key,
            "trust_score": 0.0,
            "breadcrumb_count": 0,
            "version": 1,
            "created_at": now,
            "updated_at": now,
            "modules": [],
            "endpoints": [],
            "epoch_roots": [],
        });
        
        record_json["handle"] = serde_json::Value::String(clean_handle.clone());
        
        let record_signature = {
            let id = identity.get_identity().unwrap();
            let data_to_sign = canonical_json(&record_json);
            hex::encode(id.sign_bytes(data_to_sign.as_bytes()))
        };
        
        if let Err(e) = api.publish_signed_record(
            &public_key,
            &record_json,
            &record_signature,
        ).await {
            tracing::warn!("Failed to publish initial record: {}", e);
        } else {
            tracing::info!("✅ Initial record published with encryption_key");
        }
    }
    
    let message = if network_reserved {
        format!("@{} reserved on GNS Network! Collect 100 breadcrumbs to claim.", clean_handle)
    } else {
        format!(
            "@{} reserved locally. Network sync pending{}",
            clean_handle,
            error_msg.map(|e| format!(": {}", e)).unwrap_or_default()
        )
    };
    
    Ok(CommandResult::ok(CreateIdentityResult {
        public_key,
        encryption_key,
        gns_id,
        handle: clean_handle,
        network_reserved,
        message,
    }))
}

/// Get current identity info including handle status
#[tauri::command]
pub async fn get_identity_info(
    state: State<'_, AppState>,
) -> Result<CommandResult<IdentityWithHandle>, String> {
    let identity = state.identity.lock().await;
    
    if !identity.has_identity() {
        return Ok(CommandResult::err("No identity found"));
    }
    
    let public_key = identity.public_key_hex().unwrap_or_default();
    let encryption_key = identity.encryption_key_hex().unwrap_or_default();
    let gns_id = format!("gns_{}", &public_key[..16]);
    
    // Get handle status from cached handle
    // TODO: Load actual status from persistent storage
    let handle_status = match identity.cached_handle() {
        Some(h) => HandleStatus::Reserved {
            handle: h,
            reserved_at: chrono::Utc::now().to_rfc3339(), // Should be loaded from storage
            network_reserved: true, // Should be loaded from storage
        },
        None => HandleStatus::None,
    };
    
    Ok(CommandResult::ok(IdentityWithHandle {
        public_key,
        encryption_key,
        gns_id,
        handle_status,
    }))
}

/// Reserve a handle for an existing identity
#[tauri::command]
pub async fn reserve_handle(
    handle: String,
    state: State<'_, AppState>,
) -> Result<CommandResult<HandleReservationResult>, String> {
    // Validate handle
    let clean_handle = match validate_handle(&handle) {
        Ok(h) => h,
        Err(e) => return Ok(CommandResult::err(e)),
    };
    
    // Check identity exists and get keys
    let identity = state.identity.lock().await;
    if !identity.has_identity() {
        return Ok(CommandResult::err("No identity found. Create identity first."));
    }
    
    let public_key = identity.public_key_hex().unwrap_or_default();
    let encryption_key = identity.encryption_key_hex().unwrap_or_default();
    
    // Sign reservation
    let timestamp = chrono::Utc::now().to_rfc3339();
    let message = format!("reserve:{}:{}", clean_handle, timestamp);
    
    let signature = match identity.get_identity() {
        Some(id) => hex::encode(id.sign_bytes(message.as_bytes())),
        None => return Ok(CommandResult::err("Identity not found")),
    };
    
    drop(identity); // Release lock before network call
    
    // Call API
    let api = match ApiClient::new(GNS_API_URL) {
        Ok(a) => a,
        Err(e) => return Ok(CommandResult::err(e)),
    };
    
    match api.reserve_handle(&clean_handle, &public_key, &encryption_key, &signature, &timestamp).await {
        Ok(result) => {
            // Store handle if successful
            if result.success {
                let mut identity = state.identity.lock().await;
                identity.set_cached_handle(Some(clean_handle));
            }
            Ok(CommandResult::ok(result))
        }
        Err(e) => Ok(CommandResult::err(e)),
    }
}

/// Claim a reserved handle (requires 100 breadcrumbs)
#[tauri::command]
pub async fn claim_handle(
    handle: String,
    state: State<'_, AppState>,
) -> Result<CommandResult<HandleClaimResult>, String> {
    // 1. Verify handle matches reserved handle
    let identity = state.identity.lock().await;
    if !identity.has_identity() {
        return Ok(CommandResult::err("No identity found"));
    }
    
    let cached_handle = match identity.cached_handle() {
        Some(h) => h,
        None => return Ok(CommandResult::err("No handle reserved")),
    };
    
    // Normalize handles for comparison
    if handle.trim_start_matches('@').to_lowercase() != cached_handle.trim_start_matches('@').to_lowercase() {
        return Ok(CommandResult::err("Handle does not match reserved handle"));
    }
    
    let public_key = identity.public_key_hex().unwrap_or_default();
    drop(identity); // Release lock

    // 2. Fetch proof details from database
    let db = state.database.lock().await;
    let breadcrumb_count = db.count_breadcrumbs().map_err(|e| e.to_string())?;
    let first_breadcrumb_at = db.get_first_breadcrumb_time()
        .map(|t| chrono::DateTime::from_timestamp(t, 0)
            .map(|dt| dt.to_rfc3339())
            .unwrap_or_default())
        .unwrap_or_default();
    
    // TODO: Implement trust score calculation based on breadcrumb analysis
    let trust_score = 0.0; 
    
    drop(db); // Release lock

    // 3. Check requirements
    let requirements = ClaimRequirements::new(breadcrumb_count, trust_score);
    
    if !requirements.is_met() {
        return Ok(CommandResult::ok(HandleClaimResult {
            success: false,
            handle: None,
            message: Some("Requirements not met".to_string()),
            error: Some(format!(
                "Need {} breadcrumbs (have {}) and {:.0} trust (have {:.1})",
                requirements.breadcrumbs_required,
                requirements.breadcrumbs_current,
                requirements.trust_required,
                requirements.trust_current
            )),
        }));
    }
    
    // 4. Create claim proof
    let proof = ClaimProof {
        breadcrumb_count,
        first_breadcrumb_at: first_breadcrumb_at.clone(),
        trust_score,
    };
    
    // 5. Create canonical JSON for signing (must match server)
    let claim_data = serde_json::json!({
        "handle": cached_handle,
        "identity": public_key,
        "proof": {
            "breadcrumb_count": breadcrumb_count,
            "first_breadcrumb_at": first_breadcrumb_at,
            "trust_score": trust_score,
        }
    });
    let data_to_sign = canonical_json(&claim_data);
    
    let identity = state.identity.lock().await;
    let signature = match identity.get_identity() {
        Some(id) => hex::encode(id.sign_bytes(data_to_sign.as_bytes())),
        None => return Ok(CommandResult::err("Identity not found")),
    };
    drop(identity); // Release lock before network call
    
    // 6. Call API
    let api = match ApiClient::new(GNS_API_URL) {
        Ok(a) => a,
        Err(e) => return Ok(CommandResult::err(e)),
    };
    
    match api.claim_handle_with_proof(&cached_handle, &public_key, &proof, &signature).await {
        Ok(result) => {
            // Update cached handle status if successful
            if result.success {
                // TODO: Update storage to mark handle as claimed
                tracing::info!("🎉 Handle @{} claimed successfully!", cached_handle);

                // Re-acquire lock to sign the record
                let identity = state.identity.lock().await;
                let encryption_key = identity.encryption_key_hex().unwrap_or_default();
                let now = chrono::Utc::now().to_rfc3339();
                
                let mut record_json = serde_json::json!({
                    "identity": public_key,
                    "encryption_key": encryption_key,
                    "trust_score": trust_score,
                    "breadcrumb_count": breadcrumb_count,
                    "version": 1,
                    "created_at": now,
                    "updated_at": now,
                    "modules": [],
                    "endpoints": [],
                    "epoch_roots": [],
                });
                
                record_json["handle"] = serde_json::Value::String(cached_handle.clone());
                
                let record_signature = match identity.get_identity() {
                    Some(id) => {
                        let data_to_sign = canonical_json(&record_json);
                        hex::encode(id.sign_bytes(data_to_sign.as_bytes()))
                    },
                    None => String::new(),
                };
                drop(identity); // Release lock again

                if !record_signature.is_empty() {
                    if let Err(e) = api.publish_signed_record(
                        &public_key,
                        &record_json,
                        &record_signature,
                    ).await {
                        tracing::warn!("Failed to publish record after claim: {}", e);
                    } else {
                        tracing::info!("✅ Identity record published with encryption key");
                    }
                }
            }
            Ok(CommandResult::ok(result))
        }
        Err(e) => Ok(CommandResult::err(e)),
    }
}

/// Manually publish identity record to network
#[tauri::command]
pub async fn publish_identity(
    state: State<'_, AppState>,
) -> Result<CommandResult<bool>, String> {
    // 1. Get identity
    let identity = state.identity.lock().await;
    if !identity.has_identity() {
        return Ok(CommandResult::err("No identity found"));
    }
    
    let public_key = identity.public_key_hex().unwrap_or_default();
    let encryption_key = identity.encryption_key_hex().unwrap_or_default();
    let handle = identity.cached_handle();
    
    drop(identity); // Release lock

    // 2. Get stats from DB
    let db = state.database.lock().await;
    let breadcrumb_count = db.count_breadcrumbs().unwrap_or(0);
    // TODO: Implement trust score
    let trust_score = 0.0;
    drop(db);

    // 3. Construct record JSON (must match server schema)
    // Use strict RFC3339 with milliseconds and Z suffix for Zod compatibility
    let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    
    let mut record_json = serde_json::json!({
        "identity": public_key,
        "encryption_key": encryption_key,
        "trust_score": trust_score,
        "breadcrumb_count": breadcrumb_count,
        "version": 1,
        "created_at": now,
        "updated_at": now,
        "modules": [],
        "endpoints": [],
        "epoch_roots": [],
    });
    
    if let Some(h) = handle {
        record_json["handle"] = serde_json::Value::String(h);
    }

    // 4. Sign Canonical JSON
    let data_to_sign = canonical_json(&record_json);
    
    let identity = state.identity.lock().await;
    let signature = match identity.get_identity() {
        Some(id) => hex::encode(id.sign_bytes(data_to_sign.as_bytes())),
        None => return Ok(CommandResult::err("Identity not found")),
    };
    drop(identity);

    // 5. Publish
    let api = match ApiClient::new(GNS_API_URL) {
        Ok(a) => a,
        Err(e) => return Ok(CommandResult::err(e)),
    };

    match api.publish_signed_record(
        &public_key,
        &record_json,
        &signature,
    ).await {
        Ok(_) => {
            tracing::info!("✅ Identity record published manually");
            Ok(CommandResult::ok(true))
        }
        Err(e) => Ok(CommandResult::err(e.to_string())),
    }
}

