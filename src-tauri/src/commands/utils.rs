//! Utility Commands
//!
//! Miscellaneous utility commands.

use tauri::State;
use crate::AppState;

/// Get app version information
#[tauri::command]
pub async fn get_app_version() -> Result<AppVersion, String> {
    Ok(AppVersion {
        version: env!("CARGO_PKG_VERSION").to_string(),
        build_date: option_env!("BUILD_DATE").unwrap_or("unknown").to_string(),
        git_hash: option_env!("GIT_HASH").unwrap_or("unknown").to_string(),
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    })
}

/// Open a URL in the system browser
#[tauri::command]
pub async fn open_external_url(url: String) -> Result<(), String> {
    // Validate URL
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Only HTTP/HTTPS URLs can be opened externally".to_string());
    }
    
    open::that(&url).map_err(|e| format!("Failed to open URL: {}", e))
}

/// Get offline status for the offline UI page
#[tauri::command]
pub async fn get_offline_status(state: State<'_, AppState>) -> Result<OfflineStatus, String> {
    let db = state.database.lock().await;
    let relay = state.relay.lock().await;
    
    let breadcrumb_count = db.count_breadcrumbs().unwrap_or(0);
    let pending_messages = db.count_pending_messages().unwrap_or(0);
    let last_sync = db.get_last_sync_time();
    
    let is_online = relay.is_connected();
    
    Ok(OfflineStatus {
        is_online,
        breadcrumb_count,
        pending_messages,
        last_sync: last_sync.map(|t| {
            chrono::DateTime::from_timestamp(t, 0)
                .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
                .unwrap_or_else(|| "Unknown".to_string())
        }),
    })
}

// ==================== Types ====================

#[derive(serde::Serialize)]
pub struct AppVersion {
    pub version: String,
    pub build_date: String,
    pub git_hash: String,
    pub platform: String,
    pub arch: String,
}

#[derive(serde::Serialize)]
pub struct OfflineStatus {
    pub is_online: bool,
    pub breadcrumb_count: u32,
    pub pending_messages: u32,
    pub last_sync: Option<String>,
}
