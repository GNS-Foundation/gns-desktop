//! Breadcrumb Commands
//!
//! Commands for managing location-based proof-of-trajectory.

use crate::AppState;
use tauri::State;

/// Get the current breadcrumb count
#[tauri::command]
pub async fn get_breadcrumb_count(state: State<'_, AppState>) -> Result<u32, String> {
    let db = state.database.lock().await;
    db.count_breadcrumbs().map_err(|e| e.to_string())
}

/// Get detailed breadcrumb collection status
#[tauri::command]
pub async fn get_breadcrumb_status(state: State<'_, AppState>) -> Result<BreadcrumbStatus, String> {
    let db = state.database.lock().await;

    let count = db.count_breadcrumbs().unwrap_or(0);
    let unique_locations = db.count_unique_locations().unwrap_or(0);
    let first_breadcrumb = db.get_first_breadcrumb_time();
    let last_breadcrumb = db.get_last_breadcrumb_time();

    // Check handle status
    let identity_mgr = state.identity.lock().await;
    let handle_claimed = identity_mgr.cached_handle().is_some();

    // Determine collection strategy
    #[cfg(any(target_os = "ios", target_os = "android"))]
    let (strategy, collection_enabled) = {
        let collector = state.breadcrumb_collector.lock().await;
        (
            collector.current_strategy().to_string(),
            collector.is_enabled(),
        )
    };

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    let (strategy, collection_enabled) = ("desktop".to_string(), false);

    // Calculate progress to 100
    let progress_percent = ((count as f32 / 100.0) * 100.0).min(100.0);

    // Estimate time to 100 breadcrumbs
    let estimated_completion = if count < 100 && count > 0 {
        if let (Some(first), Some(last)) = (first_breadcrumb, last_breadcrumb) {
            let elapsed = last - first;
            if elapsed > 0 && count > 1 {
                let rate = elapsed as f64 / (count - 1) as f64;
                let remaining = (100 - count) as f64 * rate;
                Some(chrono::Utc::now().timestamp() + remaining as i64)
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };

    Ok(BreadcrumbStatus {
        count,
        target: if handle_claimed { None } else { Some(100) },
        progress_percent,
        unique_locations,
        first_breadcrumb_at: first_breadcrumb,
        last_breadcrumb_at: last_breadcrumb,
        collection_strategy: strategy,
        collection_enabled,
        handle_claimed,
        estimated_completion_at: estimated_completion,
    })
}

/// Enable or disable breadcrumb collection (mobile only)
#[tauri::command]
pub async fn set_collection_enabled(
    _enabled: bool,
    #[allow(unused_variables)] state: State<'_, AppState>,
) -> Result<(), String> {
    #[cfg(any(target_os = "ios", target_os = "android"))]
    {
        let mut collector = state.breadcrumb_collector.lock().await;
        if enabled {
            collector.start().map_err(|e| e.to_string())?;
        } else {
            collector.stop();
        }
        Ok(())
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        Err("Breadcrumb collection is only available on mobile devices".to_string())
    }
}

// ==================== Types ====================

#[derive(serde::Serialize)]
pub struct BreadcrumbStatus {
    /// Total breadcrumb count
    pub count: u32,

    /// Target count (100 for handle claim, None if already claimed)
    pub target: Option<u32>,

    /// Progress percentage (0-100)
    pub progress_percent: f32,

    /// Number of unique H3 cells visited
    pub unique_locations: u32,

    /// Timestamp of first breadcrumb
    pub first_breadcrumb_at: Option<i64>,

    /// Timestamp of last breadcrumb
    pub last_breadcrumb_at: Option<i64>,

    /// Current collection strategy
    pub collection_strategy: String,

    /// Is collection currently enabled
    pub collection__enabled: bool,

    /// Has the user claimed a handle
    pub handle_claimed: bool,

    /// Estimated timestamp when 100 breadcrumbs will be reached
    pub estimated_completion_at: Option<i64>,
}
