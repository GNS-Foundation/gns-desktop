//! Message Handler - Processes incoming envelopes
//!
//! Receives envelopes from WebSocket, decrypts them, stores in DB, and emits UI events.

use crate::crypto::IdentityManager;
use crate::network::{IncomingMessage, RelayConnection};
use crate::storage::Database;
use gns_crypto_core::{open_envelope, GnsEnvelope};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex};
use sha2::Digest;

/// Incoming message payload for UI
#[derive(Debug, Clone, serde::Serialize)]
pub struct IncomingMessageEvent {
    pub id: String,
    pub thread_id: Option<String>,
    pub from_public_key: String,
    pub from_handle: Option<String>,
    pub payload_type: String,
    pub payload: serde_json::Value,
    pub timestamp: i64,
    pub signature_valid: bool,
}

/// Start the message handler task
pub fn start_message_handler(
    app_handle: AppHandle,
    identity: Arc<Mutex<IdentityManager>>,
    database: Arc<Mutex<Database>>,
    relay: Arc<Mutex<RelayConnection>>,
    mut incoming_rx: mpsc::Receiver<IncomingMessage>,
) {
    tauri::async_runtime::spawn(async move {
        tracing::info!("Message handler started");

        while let Some(msg) = incoming_rx.recv().await {
            match msg {
                IncomingMessage::Envelope(envelope) => {
                    handle_envelope(&app_handle, &identity, &database, &relay, envelope).await;
                }
                IncomingMessage::Welcome { public_key } => {
                    tracing::info!("Welcome received for {}", &public_key[..16]);
                }
                IncomingMessage::ConnectionStatus { mobile, browsers } => {
                    tracing::debug!("Connection status: mobile={}, browsers={}", mobile, browsers);
                    // Emit connection status to UI
                    let _ = app_handle.emit("connection_status", serde_json::json!({
                        "mobile": mobile,
                        "browsers": browsers,
                    }));
                }
                IncomingMessage::MessageSentFromBrowser { message_id, to_pk, plaintext, timestamp } => {
                    tracing::info!("Syncing browser message: {}", &message_id);
                    
                    let identity_guard = identity.lock().await;
                    if let Some(gns_id) = identity_guard.get_identity() {
                         let my_pk = gns_id.public_key_hex();
                         let mut db = database.lock().await;
                         if let Err(e) = db.save_browser_sent_message(&message_id, &to_pk, &plaintext, timestamp, &my_pk) {
                             tracing::error!("Failed to save browser message: {}", e);
                         } else {
                            // Emit to UI
                            let _ = app_handle.emit("message_synced", serde_json::json!({
                                "id": message_id,
                                "to_pk": to_pk,
                                "text": plaintext,
                                "timestamp": timestamp,
                                "is_outgoing": true
                            }));
                         }
                    }
                }
                IncomingMessage::ReadReceipt { message_id, timestamp: _ } => {
                    let mut db = database.lock().await;
                    if let Err(e) = db.mark_message_read(&message_id) {
                        tracing::error!("Failed to mark message read: {}", e);
                    } else {
                        let _ = app_handle.emit("message_read", serde_json::json!({ "id": message_id }));
                    }
                }
                IncomingMessage::Unknown(text) => {
                    tracing::trace!("Unknown message type: {}", &text[..text.len().min(100)]);
                }
            }
        }

        tracing::warn!("Message handler stopped");
    });
}

/// Handle an incoming envelope
async fn handle_envelope(
    app_handle: &AppHandle,
    identity: &Arc<Mutex<IdentityManager>>,
    database: &Arc<Mutex<Database>>,
    relay: &Arc<Mutex<RelayConnection>>,
    envelope: GnsEnvelope,
) {
    println!("🔥 [RUST] handle_envelope called: {}", envelope.id);
    println!("🔥 [RUST] Envelope Sender: {}", envelope.from_public_key);
    tracing::info!("Processing envelope {} from {}", envelope.id, &envelope.from_public_key[..16]);

    // Get our identity for decryption
    let identity_guard = identity.lock().await;
    let gns_identity = match identity_guard.get_identity() {
        Some(id) => id,
        None => {
            tracing::error!("No identity available for decryption");
            return;
        }
    };

    // Verify and decrypt the envelope
    let opened = match open_envelope(gns_identity, &envelope) {
        Ok(o) => o,
        Err(e) => {
            tracing::error!("Failed to open envelope: {}", e);
            return;
        }
    };

    if !opened.signature_valid {
        tracing::warn!("Envelope {} has invalid signature!", envelope.id);
        // Still process it but mark as unverified
    }

    // Parse the payload
    let payload: serde_json::Value = match serde_json::from_slice(&opened.payload) {
        Ok(p) => p,
        Err(e) => {
            // If not JSON, treat as plain text
            tracing::debug!("Payload is not JSON, treating as text: {}", e);
            serde_json::json!({
                "text": String::from_utf8_lossy(&opened.payload).to_string()
            })
        }
    };

    tracing::info!(
        "Decrypted message from {}: {:?}",
        opened.from_handle.as_deref().unwrap_or(&opened.from_public_key[..16]),
        &payload
    );

    // Generate thread ID if not present
    // Generate thread ID logic
    // Generate thread ID
    // CRITICAL: For emails, we MUST use Subject Hashing to group inbound/outbound correctly.
    // We intentionally ignore `opened.thread_id` from the server because the server groups by participants,
    // whereas we want to group by Subject (like Gmail).
    let thread_id = if opened.payload_type == "email" || opened.payload_type == "gns/email" {
        // Email -> Group by Subject Hash
        let subject = payload.get("subject").and_then(|s| s.as_str()).unwrap_or("");
        
        let s = normalize_subject(subject);
        println!("🔥 [RUST] Subject Hashing. Original: '{}', Normalized: '{}'", subject, s);
        if s.is_empty() {
             opened.thread_id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string())
        } else {
             let mut hasher = sha2::Sha256::new();
             hasher.update(s.as_bytes());
             let result = hasher.finalize();
             let hash = hex::encode(result);
             println!("🔥 [RUST] Generated Thread Hash: {}", hash);
             hash
        }
    } else if let Some(tid) = opened.thread_id.clone() {
        // Explicit thread ID provided (Chat/Direct)
        tid
    } else {
        // Direct message / Chat -> Deterministic based on participants
        let my_pk = gns_identity.public_key_hex();
        let other_pk = &opened.from_public_key;
        let mut keys = vec![my_pk.as_str(), other_pk.as_str()];
        keys.sort();
        format!("direct_{}", &keys.join("_")[..32])
    };

    println!("🔥 [RUST] Decrypted Message: Type={}", opened.payload_type);
    println!("🔥 [RUST] Thread ID: {}", thread_id);
    println!("🔥 [RUST] Sender Handle: {:?}", opened.from_handle);

    // Store in database
    {
        let mut db = database.lock().await;
        if let Err(e) = db.save_received_message(
            &envelope.id,
            &thread_id,
            &opened.from_public_key,
            opened.from_handle.as_deref(),
            &opened.payload_type,
            &payload,
            opened.timestamp,
            opened.signature_valid,
            None,
        ) {
            tracing::error!("Failed to save message to database: {}", e);
        }
    }

    // Create event for UI
    let event = IncomingMessageEvent {
        id: envelope.id.clone(),
        thread_id: Some(thread_id),
        from_public_key: opened.from_public_key,
        from_handle: opened.from_handle,
        payload_type: opened.payload_type,
        payload,
        timestamp: opened.timestamp,
        signature_valid: opened.signature_valid,
    };

    // Emit to UI
    if let Err(e) = app_handle.emit("new_message", &event) {
        tracing::error!("Failed to emit new_message event: {}", e);
    }

    tracing::info!("Message {} processed and emitted to UI", envelope.id);

    // Sync to Browser (Phase 1.5)
    // Forward decrypted content to any connected browsers
    {
        let relay_guard = relay.lock().await;
        // Construct sync event
        let sync_event = serde_json::json!({
            "type": "message_synced",
            "messageId": envelope.id,
            "conversationWith": event.from_public_key,
            "decryptedText": event.payload.get("text").and_then(|t| t.as_str()).unwrap_or(""),
            "direction": "incoming",
            "timestamp": event.timestamp,
            "fromHandle": event.from_handle
        });

        // Send raw JSON
        if let Err(e) = relay_guard.send_raw(&sync_event.to_string()).await {
             tracing::debug!("Failed to sync message to browser (likely no browsers connected): {}", e);
        } else {
             tracing::info!("Synced message {} to browser(s)", envelope.id);
        }
    }
}

/// Normalize subject for threading (remove Re:, Fwd:, etc)
pub fn normalize_subject(subject: &str) -> String {
    let mut s = subject.trim().to_lowercase();
    
    // Loop until no more prefixes found
    loop {
        let original_len = s.len();
        
        // Remove prefixes
        if s.starts_with("re:") {
            s = s[3..].trim_start().to_string();
        } else if s.starts_with("fwd:") {
            s = s[4..].trim_start().to_string();
        } else if s.starts_with("fw:") {
            s = s[3..].trim_start().to_string();
        }
        
        // If length didn't change, we are done
        if s.len() == original_len {
            break;
        }
    }
    
    s
}
