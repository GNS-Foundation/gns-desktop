//! Network Commands
//!
//! Commands for managing network connectivity.

use crate::AppState;
use tauri::State;

/// Get current connection status
#[tauri::command]
pub async fn get_connection_status(state: State<'_, AppState>) -> Result<ConnectionStatus, String> {
    let relay = state.relay.lock().await;

    Ok(ConnectionStatus {
        relay_connected: relay.is_connected().await,
        relay_url: relay.url().to_string(),
        last_message_at: relay.last_message_time().await,
        reconnect_attempts: relay.reconnect_attempts().await,
    })
}

/// Force reconnect to relay
#[tauri::command]
pub async fn reconnect(state: State<'_, AppState>) -> Result<(), String> {
    let identity = state.identity.lock().await;
    let public_key = identity.public_key_hex().ok_or("No identity configured")?;
    drop(identity);
    
    let relay = state.relay.lock().await;
    relay.reconnect(&public_key).await.map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
pub struct ConnectionStatus {
    pub relay_connected: bool,
    pub relay_url: String,
    pub last_message_at: Option<i64>,
    pub reconnect_attempts: u32,
}
