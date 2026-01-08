//! Messaging Commands
//!
//! Commands for sending and receiving encrypted messages.

use crate::AppState;
// TODO: Add envelope function when implemented
// use gns_crypto_core::GnsIdentity;
use tauri::State;
use gns_crypto_core::create_envelope_with_metadata;
use sha2::Digest;

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
    let (recipient_pk, recipient_enc_key) = if let Some(handle) = &recipient_handle {
        // Resolve handle to keys
        let info = state
            .api
            .resolve_handle(handle)
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

    // Phase 1.5: Sync to connected Browsers (Real-time)
    // We must tell our other devices (browsers) that we sent this message,
    // otherwise they will see an encrypted envelope from the server and have no way to decrypt it.
    let text_content = payload.get("text").and_then(|t| t.as_str()).unwrap_or("");
    if !text_content.is_empty() {
        let sync_event = serde_json::json!({
            "type": "message_synced",
            "to": [identity.public_key_hex()],
            "messageId": envelope.id,
            "conversationWith": recipient_pk,
            "decryptedText": text_content,
            "direction": "outgoing",
            "timestamp": envelope.timestamp,
        });
        
        if let Err(e) = relay.send_raw(&sync_event.to_string()).await {
             // Non-fatal, just log
             println!("Failed to sync sent message to browser: {}", e);
        }
    }

    // Store locally
    let mut db = state.database.lock().await;
    // Sanitize handle (remove leading @ if present) to avoid duplication
    let clean_handle = recipient_handle.as_deref().map(|h| h.trim_start_matches('@'));
    
    db.save_sent_message(&envelope, &payload_bytes, clean_handle, reply_to_id)
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

/// Get a single thread
#[tauri::command]
pub async fn get_thread(
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Option<ThreadPreview>, String> {
    let db = state.database.lock().await;
    db.get_thread(&thread_id).map_err(|e| e.to_string())
}

/// Get messages in a thread
#[tauri::command]
pub async fn get_messages(
    thread_id: String,
    limit: Option<u32>,
    _before_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<Message>, String> {
    let db = state.database.lock().await;
    let messages = db
        .get_messages(&thread_id, limit.unwrap_or(50))
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

/// Delete a message
#[tauri::command]
pub async fn delete_message(message_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut db = state.database.lock().await;
    db.delete_message(&message_id).map_err(|e| e.to_string())
}

/// Add a reaction to a message
#[tauri::command]
pub async fn add_reaction(
    message_id: String,
    emoji: String,
    recipient_public_key: String,
    _recipient_handle: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Get our identity
    let identity_mgr = state.identity.lock().await;
    let identity = identity_mgr
        .get_identity()
        .ok_or("No identity configured")?;
    let my_handle = identity_mgr.cached_handle();

    // Resolve recipient encryption key
    let info = state
        .api
        .get_identity(&recipient_public_key)
        .await
        .map_err(|e| format!("Failed to get identity: {}", e))?
        .ok_or("Identity not found")?;
    let recipient_enc_key = info.encryption_key;

    // Create payload
    let payload = serde_json::json!({
        "target_message_id": message_id,
        "emoji": emoji
    });
    let payload_bytes = serde_json::to_vec(&payload).map_err(|e| e.to_string())?;

    // Create envelope
    let envelope = create_envelope_with_metadata(
        &identity,
        my_handle.as_deref(),
        &recipient_public_key,
        &recipient_enc_key,
        "reaction",
        &payload_bytes,
        None,
        None,
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
    db.save_reaction(&message_id, &identity.public_key_hex(), &emoji, envelope.timestamp)
        .map_err(|e| format!("Failed to save reaction: {}", e))?;

    Ok(())
}

/// Save a sent email message locally
/// This mimics sending a GNS message but for emails sent via REST
#[tauri::command]
pub async fn save_sent_email_message(
    recipient_email: String,
    subject: String,
    snippet: String,
    body: String,
    gateway_public_key: String,
    thread_id: Option<String>,
    message_id: Option<String>, // Added parameter
    state: State<'_, AppState>,
) -> Result<SendResult, String> {
    // Get our identity
    let identity_mgr = state.identity.lock().await;
    let identity = identity_mgr
        .get_identity()
        .ok_or("No identity configured")?;
    let my_handle = identity_mgr.cached_handle();

    // Create payload
    let payload = serde_json::json!({
        "subject": subject,
        "body": body, // Full body for message view
        "snippet": snippet, // Preview
        "to": [recipient_email], // Simplified 
        "is_email": true
    });
    let payload_bytes = serde_json::to_vec(&payload).map_err(|e| e.to_string())?;

    // Determine thread ID
    // If provided (reply), use it.
    // If not (new email), generate ID based on Subject Hash to group same-subject emails
    let final_thread_id = if let Some(tid) = thread_id {
        tid
    } else {
        // Use shared normalization logic for consistency
        let s = crate::message_handler::normalize_subject(&subject);
        
        // Check if subject is effectively empty, fallback to random
        if s.is_empty() {
            uuid::Uuid::new_v4().to_string()
        } else {
            // Generate SHA256 hash
            let mut hasher = sha2::Sha256::new();
            hasher.update(s.as_bytes());
            let result = hasher.finalize();
            hex::encode(result)
        }
    };

    // Create envelope targeting the Email Gateway
    // If message_id is provided (from backend), use it??
    // create_envelope_with_metadata generates a new ID internally usually.
    // We might need to manually override the ID or construct it differently if we want to match Server ID.
    // But create_envelope functions usually enforce random ID.
    // Wait, if we save to DB, we can map it?
    // Actually, create_envelope usually returns an Envelope struct. We can overwrite the ID field before saving!
    
    let mut envelope = create_envelope_with_metadata(
        &identity,
        my_handle.as_deref(),
        &gateway_public_key,
        "0000000000000000000000000000000000000000000000000000000000000000",
        "email",
        &payload_bytes,
        Some(&final_thread_id),
        None,
    )
    .map_err(|e| format!("Failed to create envelope: {}", e))?;

    // Store locally
    let mut db = state.database.lock().await;
    // We pass recipient_email as the handle so the thread shows the email address instead of Gateway Key
    db.save_sent_message(
        &envelope, 
        &payload_bytes, 
        Some(&recipient_email), 
        None
    ).map_err(|e| format!("Failed to save locally: {}", e))?;

    // Phase 1.5: Sync to connected Mobile/Browsers (Real-time)
    // We must tell our other devices that we sent this email.
    let sync_event = serde_json::json!({
        "type": "message_synced",
        "to": [identity.public_key_hex()],
        "messageId": envelope.id,
        "conversationWith": gateway_public_key, // Emails are technically with Gateway
        "decryptedText": snippet, // Use snippet or body? Body might be huge. Mobile expects text.
        "direction": "outgoing",
        "timestamp": envelope.timestamp,
        "payload": payload, // Send full payload for Email reconstruction
    });
    
    let relay = state.relay.lock().await;
    if let Err(e) = relay.send_raw(&sync_event.to_string()).await {
            // Non-fatal, just log
            println!("Failed to sync sent email to devices: {}", e);
    }

    Ok(SendResult {
        message_id: envelope.id.clone(),
        thread_id: Some(final_thread_id),
    })
}

/// Resolve a handle to identity info
#[tauri::command]
pub async fn resolve_handle(
    handle: String,
    state: State<'_, AppState>,
) -> Result<Option<HandleInfo>, String> {
    let info = state
        .api
        .resolve_handle(&handle)
        .await
        .map_err(|e| format!("Failed to resolve handle: {}", e))?;

    Ok(info.map(|i| HandleInfo {
        public_key: i.public_key,
        encryption_key: i.encryption_key,
        // Ensure handle is clean (no @ prefix) so UI doesn't double it
        handle: i.handle.map(|h| h.trim_start_matches('@').to_string()),
        display_name: i.display_name,
        avatar_url: i.avatar_url,
        is_verified: i.is_verified,
    }))
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
    pub subject: Option<String>,
}

#[derive(serde::Serialize, Clone)]
pub struct Reaction {
    pub emoji: String,
    pub from_public_key: String,
}

#[derive(serde::Serialize, Clone)]
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
    pub reply_to_id: Option<String>,
    pub is_starred: bool,
    pub forwarded_from_id: Option<String>,
    pub reactions: Vec<Reaction>,
}

#[derive(serde::Serialize)]
pub struct HandleInfo {
    pub public_key: String,
    pub encryption_key: String,
    pub handle: Option<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub is_verified: bool,
}
