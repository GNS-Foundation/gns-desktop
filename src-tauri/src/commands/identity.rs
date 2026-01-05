//! Identity Commands
//!
//! Commands for managing the user's cryptographic identity.

use crate::AppState;
use gns_crypto_core::GnsIdentity;
use tauri::State;

/// Get the user's Ed25519 public key (hex)
#[tauri::command]
pub async fn get_public_key(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let identity = state.identity.lock().await;
    Ok(identity.public_key_hex())
}

/// Get the user's X25519 encryption key (hex)
#[tauri::command]
pub async fn get_encryption_key(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let identity = state.identity.lock().await;
    Ok(identity.encryption_key_hex())
}

/// Get the user's current claimed @handle (if any)
#[tauri::command]
pub async fn get_current_handle(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let identity = state.identity.lock().await;

    // First check local cache
    if let Some(handle) = identity.cached_handle() {
        return Ok(Some(handle));
    }

    // If not cached, fetch from API
    if let Some(public_key) = identity.public_key_hex() {
        let api = &state.api;
        match api.get_handle_for_key(&public_key).await {
            Ok(handle) => Ok(handle),
            Err(e) => {
                tracing::warn!("Failed to fetch handle: {}", e);
                Ok(None)
            }
        }
    } else {
        Ok(None)
    }
}

/// Check if the user has an identity
#[tauri::command]
pub async fn has_identity(state: State<'_, AppState>) -> Result<bool, String> {
    let identity = state.identity.lock().await;
    Ok(identity.has_identity())
}

/// Generate a new identity
#[tauri::command]
pub async fn generate_identity(state: State<'_, AppState>) -> Result<IdentityInfo, String> {
    let mut identity = state.identity.lock().await;

    if identity.has_identity() {
        return Err(
            "Identity already exists. Export backup before generating new identity.".to_string(),
        );
    }

    identity.generate_new().map_err(|e| e.to_string())?;

    Ok(IdentityInfo {
        public_key: identity.public_key_hex().unwrap_or_default(),
        encryption_key: identity.encryption_key_hex().unwrap_or_default(),
    })
}

/// Import an identity from private key hex
#[tauri::command]
pub async fn import_identity(
    private_key_hex: String,
    state: State<'_, AppState>,
) -> Result<IdentityInfo, String> {
    let mut identity = state.identity.lock().await;

    // Validate the private key first
    let test_identity = GnsIdentity::from_hex(&private_key_hex)
        .map_err(|e| format!("Invalid private key: {}", e))?;

    // Import into keychain
    identity
        .import_from_hex(&private_key_hex)
        .map_err(|e| e.to_string())?;

    Ok(IdentityInfo {
        public_key: test_identity.public_key_hex(),
        encryption_key: test_identity.encryption_key_hex(),
    })
}

/// Export identity backup (for migration)
/// ⚠️ This returns the private key - handle with extreme care!
#[tauri::command]
pub async fn export_identity_backup(state: State<'_, AppState>) -> Result<IdentityBackup, String> {
    let identity = state.identity.lock().await;

    let private_key = identity.private_key_hex().ok_or("No identity to export")?;

    let public_key = identity.public_key_hex().ok_or("No identity to export")?;

    let encryption_key = identity
        .encryption_key_hex()
        .ok_or("No identity to export")?;

    // Get breadcrumb count
    let db = state.database.lock().await;
    let breadcrumb_count = db.count_breadcrumbs().unwrap_or(0);

    Ok(IdentityBackup {
        version: 1,
        private_key,
        public_key,
        encryption_key,
        breadcrumb_count,
        created_at: chrono::Utc::now().timestamp(),
    })
}

/// Delete identity from Keychain and clear all local data
/// ⚠️ This is destructive and cannot be undone!
#[tauri::command]
pub async fn delete_identity(state: State<'_, AppState>) -> Result<(), String> {
    tracing::warn!("🗑️ delete_identity called - clearing Keychain and local data");
    
    // 1. Clear the identity from IdentityManager (clears Keychain)
    {
        let mut identity = state.identity.lock().await;
        identity.clear().map_err(|e| format!("Failed to clear identity: {}", e))?;
    }
    
    // 2. Clear the database
    {
        let mut db = state.database.lock().await;
        db.clear_all().map_err(|e| format!("Failed to clear database: {}", e))?;
    }
    
    // 3. Disconnect from relay
    {
        let relay = state.relay.lock().await;
        let _ = relay.disconnect().await;
    }
    
    tracing::info!("✅ Identity deleted successfully");
    Ok(())
}

/// Identity information (safe to expose)
#[derive(serde::Serialize)]
pub struct IdentityInfo {
    pub public_key: String,
    pub encryption_key: String,
}

/// Identity backup (contains private key!)
#[derive(serde::Serialize)]
pub struct IdentityBackup {
    pub version: u32,
    pub private_key: String,
    pub public_key: String,
    pub encryption_key: String,
    pub breadcrumb_count: u32,
    pub created_at: i64,
}
