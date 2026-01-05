//! Message Handler - Processes incoming envelopes
//!
//! Receives envelopes from WebSocket, decrypts them, stores in DB, and emits UI events.

use crate::crypto::IdentityManager;
use crate::network::IncomingMessage;
use crate::storage::Database;
use gns_crypto_core::{open_envelope, GnsEnvelope};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex};

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
    mut incoming_rx: mpsc::Receiver<IncomingMessage>,
) {
    tauri::async_runtime::spawn(async move {
        tracing::info!("Message handler started");

        while let Some(msg) = incoming_rx.recv().await {
            match msg {
                IncomingMessage::Envelope(envelope) => {
                    handle_envelope(&app_handle, &identity, &database, envelope).await;
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
    envelope: GnsEnvelope,
) {
    println!("🔥 [RUST] handle_envelope called: {}", envelope.id);
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
    let thread_id = opened.thread_id.clone().unwrap_or_else(|| {
        // Create a deterministic thread ID from participants
        let my_pk = gns_identity.public_key_hex();
        let other_pk = &opened.from_public_key;
        let mut keys = vec![my_pk.as_str(), other_pk.as_str()];
        keys.sort();
        format!("direct_{}", &keys.join("_")[..32])
    });

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
}
