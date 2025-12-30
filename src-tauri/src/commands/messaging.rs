//! Messaging Commands
//!
//! Commands for sending and receiving encrypted messages.

use crate::AppState;
// TODO: Add envelope function when implemented
// use gns_crypto_core::GnsIdentity;
use tauri::State;

/// Send an encrypted message
#[tauri::command]
pub async fn send_message(
    recipient_handle: Option<String>,
    recipient_public_key: Option<String>,
    payload_type: String,
    payload: serde_json::Value,
    thread_id: Option<String>,
    reply_to_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<SendResult, String> {
    // Get our identity
    let identity_mgr = state.identity.lock().await;
    let identity = identity_mgr
        .get_identity()
        .ok_or("No identity configured")?;

    let my_handle = identity_mgr.cached_handle();

    // Resolve recipient
    let (recipient_pk, recipient_enc_key) = if let Some(handle) = recipient_handle {
        // Resolve handle to keys
        let info = state
            .api
            .resolve_handle(&handle)
            .await
            .map_err(|e| format!("Failed to resolve handle: {}", e))?
            .ok_or("Handle not found")?;

        (info.public_key, info.encryption_key)
    } else if let Some(pk) = recipient_public_key {
        // Fetch encryption key for public key
        let info = state
            .api
            .get_identity(&pk)
            .await
            .map_err(|e| format!("Failed to get identity: {}", e))?
            .ok_or("Identity not found")?;

        (pk, info.encryption_key)
    } else {
        return Err("Must provide either recipient_handle or recipient_public_key".to_string());
    };

    // Serialize payload
    let payload_bytes =
        serde_json::to_vec(&payload).map_err(|e| format!("Failed to serialize payload: {}", e))?;

    // Create envelope
    let envelope = create_envelope_with_metadata(
        &identity,
        my_handle.as_deref(),
        &recipient_pk,
        &recipient_enc_key,
        &payload_type,
        &payload_bytes,
        thread_id.as_deref(),
        reply_to_id.as_deref(),
    )
    .map_err(|e| format!("Failed to create envelope: {}", e))?;

    // Send via relay
    let relay = state.relay.lock().await;
    relay
        .send_envelope(&envelope)
        .await
        .map_err(|e| format!("Failed to send: {}", e))?;

    // Store locally
    let mut db = state.database.lock().await;
    db.save_sent_message(&envelope, &payload_bytes)
        .map_err(|e| format!("Failed to save locally: {}", e))?;

    Ok(SendResult {
        message_id: envelope.id.clone(),
        thread_id: envelope.thread_id.clone(),
    })
}

/// Get all conversation threads
#[tauri::command]
pub async fn get_threads(
    include_archived: Option<bool>,
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<ThreadPreview>, String> {
    let db = state.database.lock().await;
    let threads = db
        .get_threads(include_archived.unwrap_or(false), limit.unwrap_or(50))
        .map_err(|e| e.to_string())?;

    Ok(threads)
}

/// Get messages in a thread
#[tauri::command]
pub async fn get_messages(
    thread_id: String,
    limit: Option<u32>,
    before_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<Message>, String> {
    let db = state.database.lock().await;
    let messages = db
        .get_messages(&thread_id, limit.unwrap_or(50), before_id.as_deref())
        .map_err(|e| e.to_string())?;

    Ok(messages)
}

/// Mark a thread as read
#[tauri::command]
pub async fn mark_thread_read(thread_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut db = state.database.lock().await;
    db.mark_thread_read(&thread_id).map_err(|e| e.to_string())
}

/// Delete a thread
#[tauri::command]
pub async fn delete_thread(thread_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut db = state.database.lock().await;
    db.delete_thread(&thread_id).map_err(|e| e.to_string())
}

// ==================== Types ====================

#[derive(serde::Serialize)]
pub struct SendResult {
    pub message_id: String,
    pub thread_id: Option<String>,
}

#[derive(serde::Serialize)]
pub struct ThreadPreview {
    pub id: String,
    pub participant_public_key: String,
    pub participant_handle: Option<String>,
    pub last_message_preview: Option<String>,
    pub last_message_at: i64,
    pub unread_count: u32,
    pub is_pinned: bool,
    pub is_muted: bool,
}

#[derive(serde::Serialize)]
pub struct Message {
    pub id: String,
    pub thread_id: String,
    pub from_public_key: String,
    pub from_handle: Option<String>,
    pub payload_type: String,
    pub payload: serde_json::Value,
    pub timestamp: i64,
    pub is_outgoing: bool,
    pub status: String,
}
