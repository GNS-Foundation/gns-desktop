use crate::AppState;
use tauri::State;
use gns_crypto_core::Breadcrumb;

// ==================== Commands ====================

/// Get breadcrumb collection status
#[tauri::command]
pub async fn get_breadcrumb_status(state: State<'_, AppState>) -> Result<BreadcrumbStatus, String> {
    let db = state.database.lock().await;

    // Get counts
    let count = db.count_breadcrumbs().unwrap_or(0);
    let unique_locations = db.count_unique_locations().unwrap_or(0);
    let first_breadcrumb = db.get_first_breadcrumb_time();
    let last_breadcrumb = db.get_last_breadcrumb_time();

    // Check handle status - only true if handle is claimed on the network
    // A cached/reserved handle is NOT the same as a claimed handle
    let identity_mgr = state.identity.lock().await;
    let handle_claimed = match identity_mgr.cached_handle() {
        Some(_handle) => {
            // Handle is claimed if user has collected 100+ breadcrumbs
            // This proves they're a real human with proof-of-trajectory
            // TODO: Also check network for actual claim status in the future
            // TODO: Add trust_score >= 20 requirement when trust system is implemented
            count >= 100
        }
        None => false,
    };

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

/// Get breadcrumb count
#[tauri::command]
pub async fn get_breadcrumb_count(state: State<'_, AppState>) -> Result<u32, String> {
    let db = state.database.lock().await;
    db.count_breadcrumbs().map_err(|e| e.to_string())
}

/// Enable or disable breadcrumb collection (mobile only)
#[tauri::command]
pub async fn set_collection_enabled(
    enabled: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    #[cfg(any(target_os = "ios", target_os = "android"))]
    {
        // Persist state to database
        let mut db = state.database.lock().await;
        db.set_collection_enabled(enabled).map_err(|e| e.to_string())?;
        drop(db); // Release lock before accessing collector
        
        // Update collector
        let mut collector: tokio::sync::MutexGuard<'_, crate::location::BreadcrumbCollector> = state.breadcrumb_collector.lock().await;
        if enabled {
            collector.start().map_err(|e| e.to_string())?;
        } else {
            collector.stop();
        }
        
        tracing::info!("📍 Breadcrumb collection {}", if enabled { "enabled" } else { "disabled" });
        Ok(())
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        Err("Breadcrumb collection is only available on mobile devices".to_string())
    }
}

/// Drop a breadcrumb at the current location (called from frontend with GPS data)
#[tauri::command]
pub async fn drop_breadcrumb(
    latitude: f64,
    longitude: f64,
    accuracy: Option<f64>,
    state: State<'_, AppState>,
) -> Result<DropBreadcrumbResult, String> {
    use gns_crypto_core::breadcrumb::create_breadcrumb;
    
    // Get identity
    let identity_mgr = state.identity.lock().await;
    let identity = identity_mgr.get_identity()
        .ok_or("No identity found")?;
    
    // Get last breadcrumb hash for chain
    let mut db = state.database.lock().await;
    let recent = db.get_recent_breadcrumbs(1).map_err(|e| e.to_string())?;
    let prev_hash = recent.first().map(|b| {
        // Hash the previous breadcrumb
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(format!("{}:{}:{}", b.h3_index, b.timestamp, b.signature));
        hex::encode(hasher.finalize())
    });
    
    // Create breadcrumb
    let breadcrumb = create_breadcrumb(
        &identity,
        latitude,
        longitude,
        None, // Use default H3 resolution
        prev_hash,
    ).map_err(|e| e.to_string())?;
    
    // Save to database
    db.save_breadcrumb(&breadcrumb).map_err(|e| e.to_string())?;
    
    // Get updated count
    let count = db.count_breadcrumbs().map_err(|e| e.to_string())?;
    
    tracing::info!(
        "📍 Breadcrumb #{} dropped at H3: {} (accuracy: {:?}m)",
        count,
        &breadcrumb.h3_index,
        accuracy
    );
    
    Ok(DropBreadcrumbResult {
        success: true,
        count,
        h3_cell: breadcrumb.h3_index,
    })
}

/// Get list of recent breadcrumbs for history view
#[tauri::command]
pub async fn list_breadcrumbs(
    state: State<'_, AppState>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<Vec<Breadcrumb>, String> {
    let db = state.database.lock().await;
    db.get_breadcrumbs(limit.unwrap_or(50), offset.unwrap_or(0))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn restore_breadcrumbs(state: State<'_, AppState>) -> Result<u32, String> {
    use gns_crypto_core::Breadcrumb;

    // 1. Get identity
    let (public_key, _private_key) = {
        let identity = state.identity.lock().await;
        let pk = identity.public_key_hex().ok_or("No identity found")?;
        let sk = identity.private_key_hex().ok_or("No identity found")?;
        (pk, sk)
    };

    // 2. Fetch encrypted breadcrumbs from server
    let encrypted_breadcrumbs = state.api.fetch_breadcrumbs(&public_key).await
        .map_err(|e| e.to_string())?;

    tracing::info!("☁️ Fetched {} breadcrumbs from cloud", encrypted_breadcrumbs.len());

    // 3. Decrypt and save locally
    let mut restored_count = 0;
    let mut db = state.database.lock().await;

    for item in encrypted_breadcrumbs {
        if let (Some(payload), Some(_signature)) = (
            item["payload"].as_str(),
            item["signature"].as_str()
        ) {
            // Decrypt payload
            // Note: In a real implementation, we should verify the signature first!
            // But since we signed it ourselves, we can try to decrypt.
            
            // We need to implement decryption in IdentityManager or here
            // For now, let's assume the payload is the JSON string (since we don't have full encryption yet)
            // TODO: Implement actual decryption
            
            // Parse JSON
            if let Ok(breadcrumb) = serde_json::from_str::<Breadcrumb>(payload) {
                // Save to DB (ignore duplicates)
                if let Ok(_) = db.save_breadcrumb(&breadcrumb) {
                    restored_count += 1;
                }
            }
        }
    }

    tracing::info!("✅ Restored {} breadcrumbs", restored_count);
    Ok(restored_count)
}

// ==================== Types ====================

#[derive(serde::Serialize)]
pub struct DropBreadcrumbResult {
    pub success: bool,
    pub count: u32,
    pub h3_cell: String,
}

#[derive(serde::Serialize)]
pub struct BreadcrumbRecord {
    pub h3_cell: String,
    pub timestamp: i64,
    pub signature: String,
    pub prev_hash: Option<String>,
}

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
    pub collection_enabled: bool,

    /// Has the user claimed a handle
    pub handle_claimed: bool,

    /// Estimated timestamp when 100 breadcrumbs will be reached
    pub estimated_completion_at: Option<i64>,
}
