//! Handle Commands
//!
//! Commands for resolving and claiming @handles.

use tauri::State;
use crate::AppState;

/// Resolve a handle to identity information
#[tauri::command]
pub async fn resolve_handle(
    handle: String,
    state: State<'_, AppState>,
) -> Result<Option<HandleInfo>, String> {
    let clean_handle = handle.trim_start_matches('@').to_lowercase();
    
    let info = state.api.resolve_handle(&clean_handle).await
        .map_err(|e| format!("Failed to resolve handle: {}", e))?;
    
    Ok(info.map(|i| HandleInfo {
        handle: clean_handle,
        public_key: i.public_key,
        encryption_key: i.encryption_key,
        avatar_url: i.avatar_url,
        display_name: i.display_name,
        is_verified: i.is_verified,
    }))
}

/// Check if a handle is available for claiming
#[tauri::command]
pub async fn check_handle_available(
    handle: String,
    state: State<'_, AppState>,
) -> Result<HandleAvailability, String> {
    let clean_handle = handle.trim_start_matches('@').to_lowercase();
    
    // Validate format
    if !is_valid_handle_format(&clean_handle) {
        return Ok(HandleAvailability {
            handle: clean_handle,
            available: false,
            reason: Some("Invalid format. Use 3-20 characters, letters, numbers, and underscores only.".to_string()),
        });
    }
    
    // Check if already taken
    let existing = state.api.resolve_handle(&clean_handle).await
        .map_err(|e| format!("Failed to check handle: {}", e))?;
    
    if existing.is_some() {
        return Ok(HandleAvailability {
            handle: clean_handle,
            available: false,
            reason: Some("This handle is already claimed.".to_string()),
        });
    }
    
    // Check reserved handles
    if is_reserved_handle(&clean_handle) {
        return Ok(HandleAvailability {
            handle: clean_handle,
            available: false,
            reason: Some("This handle is reserved.".to_string()),
        });
    }
    
    Ok(HandleAvailability {
        handle: clean_handle,
        available: true,
        reason: None,
    })
}

/// Claim a handle (requires 100+ breadcrumbs)
#[tauri::command]
pub async fn claim_handle(
    handle: String,
    state: State<'_, AppState>,
) -> Result<ClaimResult, String> {
    let clean_handle = handle.trim_start_matches('@').to_lowercase();
    
    // Check availability first
    let availability = check_handle_available(clean_handle.clone(), state.clone()).await?;
    if !availability.available {
        return Err(availability.reason.unwrap_or("Handle not available".to_string()));
    }
    
    // Check breadcrumb count
    let db = state.database.lock().await;
    let breadcrumb_count = db.count_breadcrumbs().unwrap_or(0);
    
    if breadcrumb_count < 100 {
        return Err(format!(
            "Need 100 breadcrumbs to claim a handle. You have {}.",
            breadcrumb_count
        ));
    }
    
    // Get identity
    let identity_mgr = state.identity.lock().await;
    let identity = identity_mgr.get_identity()
        .ok_or("No identity configured")?;
    
    // Create claim signature
    let claim_data = format!(
        "gns-claim-v1:{}:{}:{}",
        clean_handle,
        identity.public_key_hex(),
        chrono::Utc::now().timestamp()
    );
    let signature = identity.sign_bytes(claim_data.as_bytes());
    
    // Get breadcrumbs for submission
    let breadcrumbs = db.get_recent_breadcrumbs(100)
        .map_err(|e| format!("Failed to get breadcrumbs: {}", e))?;
    
    drop(db); // Release lock before API call
    
    // Submit claim to API
    let result = state.api.claim_handle(
        &clean_handle,
        &identity.public_key_hex(),
        &identity.encryption_key_hex(),
        &hex::encode(signature),
        &breadcrumbs,
    ).await.map_err(|e| format!("Claim failed: {}", e))?;
    
    // Cache the claimed handle
    drop(identity_mgr);
    let mut identity_mgr = state.identity.lock().await;
    identity_mgr.set_cached_handle(Some(clean_handle.clone()));
    
    Ok(ClaimResult {
        success: true,
        handle: clean_handle,
        transaction_id: result.transaction_id,
    })
}

// ==================== Helpers ====================

fn is_valid_handle_format(handle: &str) -> bool {
    if handle.len() < 3 || handle.len() > 20 {
        return false;
    }
    
    handle.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
}

fn is_reserved_handle(handle: &str) -> bool {
    const RESERVED: &[&str] = &[
        "admin", "root", "system", "support", "help", "gns", "globe", "crumbs",
        "official", "verified", "bot", "echo", "news", "alerts", "security",
    ];
    
    RESERVED.contains(&handle)
}

// ==================== Types ====================

#[derive(serde::Serialize)]
pub struct HandleInfo {
    pub handle: String,
    pub public_key: String,
    pub encryption_key: String,
    pub avatar_url: Option<String>,
    pub display_name: Option<String>,
    pub is_verified: bool,
}

#[derive(serde::Serialize)]
pub struct HandleAvailability {
    pub handle: String,
    pub available: bool,
    pub reason: Option<String>,
}

#[derive(serde::Serialize)]
pub struct ClaimResult {
    pub success: bool,
    pub handle: String,
    pub transaction_id: Option<String>,
}
