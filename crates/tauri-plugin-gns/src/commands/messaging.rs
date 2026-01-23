//! Messaging Commands
//!
//! Tauri commands for encrypted E2E messaging.

use crate::core::CryptoEngine;
use crate::error::{Error, Result};
use crate::models::*;
use crate::GnsState;
use tauri::{command, State};

/// Send an encrypted message
#[command]
pub async fn send_message(state: State<'_, GnsState>, params: SendMessageParams) -> Result<Message> {
    let my_pk = state
        .get_active_identity()
        .await
        .ok_or_else(|| Error::IdentityNotFound("No active identity".to_string()))?;

    // Resolve recipient
    let recipient = if params.to.starts_with('@') {
        // Resolve handle
        state.network.resolve_handle(&params.to).await?
    } else {
        // Direct public key
        ResolvedHandle {
            handle: String::new(),
            public_key: params.to.clone(),
            encryption_key: None,
            trust_score: 0.0,
            breadcrumb_count: 0,
            from_cache: false,
            resolved_at: chrono::Utc::now().to_rfc3339(),
        }
    };

    // Get our encryption keys
    let storage = state.storage.read().await;
    let (our_enc_secret, _) = storage
        .get_encryption_keys(&my_pk)?
        .ok_or_else(|| Error::IdentityNotFound(my_pk.clone()))?;
    let our_secret = storage
        .get_secret_key(&my_pk)?
        .ok_or_else(|| Error::IdentityNotFound(my_pk.clone()))?;
    drop(storage);

    // Get recipient's encryption key
    let their_enc_public = recipient.encryption_key.ok_or_else(|| {
        Error::Network("Recipient has no encryption key".to_string())
    })?;

    // Generate ephemeral keypair for this message
    let (ephemeral_secret, ephemeral_public) = CryptoEngine::generate_ephemeral_keypair();

    // Derive shared secret using ephemeral key
    let shared_secret = CryptoEngine::key_exchange(&ephemeral_secret, &their_enc_public)?;
    let message_key = CryptoEngine::derive_message_key(&shared_secret, b"gns-message")?;

    // Create payload
    let payload = DecryptedPayload {
        message_type: params.message_type,
        content: params.content,
        metadata: params.metadata,
        reply_to: params.reply_to,
    };
    let payload_json = serde_json::to_string(&payload)?;

    // Encrypt
    let (nonce, ciphertext) = CryptoEngine::encrypt(&message_key, payload_json.as_bytes())?;

    // Create message ID
    let message_id = CryptoEngine::random_id();
    let timestamp = chrono::Utc::now().to_rfc3339();

    // Create envelope
    let envelope = GnsEnvelope {
        version: 1,
        from_pk: my_pk.clone(),
        to_pk: recipient.public_key.clone(),
        encrypted_payload: format!("{}:{}", nonce, ciphertext),
        ephemeral_key: ephemeral_public,
        signature: String::new(), // Will be set below
        message_id: message_id.clone(),
        timestamp: timestamp.clone(),
    };

    // Sign the envelope
    let envelope_data = serde_json::to_string(&serde_json::json!({
        "from_pk": envelope.from_pk,
        "to_pk": envelope.to_pk,
        "encrypted_payload": envelope.encrypted_payload,
        "ephemeral_key": envelope.ephemeral_key,
        "message_id": envelope.message_id,
        "timestamp": envelope.timestamp,
    }))?;
    let signature = CryptoEngine::sign(&our_secret, envelope_data.as_bytes())?;

    let signed_envelope = GnsEnvelope {
        signature,
        ..envelope
    };

    // Send via relay
    state.network.send_message(&signed_envelope).await?;

    // Store locally
    let message = Message {
        id: message_id,
        from_pk: my_pk,
        to_pk: recipient.public_key,
        payload: signed_envelope.encrypted_payload,
        ephemeral_key: Some(signed_envelope.ephemeral_key),
        signature: signed_envelope.signature,
        created_at: timestamp,
        received_at: None,
        is_read: true,
        decrypted: Some(payload),
    };

    let storage = state.storage.write().await;
    storage.save_message(&message)?;

    Ok(message)
}

/// Get messages for the current identity
#[command]
pub async fn get_messages(
    state: State<'_, GnsState>,
    query: Option<MessageQuery>,
) -> Result<Vec<Message>> {
    let my_pk = state
        .get_active_identity()
        .await
        .ok_or_else(|| Error::IdentityNotFound("No active identity".to_string()))?;

    let query = query.unwrap_or_default();
    let storage = state.storage.read().await;
    storage.get_messages(&my_pk, &query)
}

/// Get a single message by ID
#[command]
pub async fn get_message(state: State<'_, GnsState>, message_id: String) -> Result<Option<Message>> {
    let my_pk = state
        .get_active_identity()
        .await
        .ok_or_else(|| Error::IdentityNotFound("No active identity".to_string()))?;

    let storage = state.storage.read().await;
    let messages = storage.get_messages(
        &my_pk,
        &MessageQuery {
            limit: 1,
            ..Default::default()
        },
    )?;

    Ok(messages.into_iter().find(|m| m.id == message_id))
}

/// Decrypt a message
#[command]
pub async fn decrypt_message(
    state: State<'_, GnsState>,
    message_id: String,
) -> Result<DecryptedPayload> {
    let my_pk = state
        .get_active_identity()
        .await
        .ok_or_else(|| Error::IdentityNotFound("No active identity".to_string()))?;

    let storage = state.storage.read().await;
    let messages = storage.get_messages(
        &my_pk,
        &MessageQuery {
            limit: 1000,
            ..Default::default()
        },
    )?;

    let message = messages
        .into_iter()
        .find(|m| m.id == message_id)
        .ok_or_else(|| Error::InvalidInput("Message not found".to_string()))?;

    // Already decrypted?
    if let Some(decrypted) = message.decrypted {
        return Ok(decrypted);
    }

    // Get ephemeral key (required for decryption)
    let ephemeral_key = message.ephemeral_key
        .ok_or_else(|| Error::DecryptionFailed("Missing ephemeral key".to_string()))?;

    // Get our encryption keys
    let (our_enc_secret, _) = storage
        .get_encryption_keys(&my_pk)?
        .ok_or_else(|| Error::IdentityNotFound(my_pk.clone()))?;

    // Parse the payload (format: nonce:ciphertext)
    let parts: Vec<&str> = message.payload.split(':').collect();
    if parts.len() != 2 {
        return Err(Error::DecryptionFailed("Invalid payload format".to_string()));
    }

    let nonce = parts[0];
    let ciphertext = parts[1];

    // Perform X25519 key exchange with the ephemeral key
    let shared_secret = CryptoEngine::key_exchange(&our_enc_secret, &ephemeral_key)?;
    let message_key = CryptoEngine::derive_message_key(&shared_secret, b"gns-message")?;

    // Decrypt the ciphertext
    let plaintext = CryptoEngine::decrypt(&message_key, nonce, ciphertext)?;
    
    // Parse the decrypted payload
    let decrypted: DecryptedPayload = serde_json::from_slice(&plaintext)
        .map_err(|e| Error::DecryptionFailed(format!("Invalid payload JSON: {}", e)))?;

    // Update the stored message with decrypted content
    drop(storage);
    let storage = state.storage.write().await;
    storage.update_message_decrypted(&message_id, &decrypted)?;

    Ok(decrypted)
}

/// Mark a message as read
#[command]
pub async fn mark_as_read(state: State<'_, GnsState>, message_id: String) -> Result<()> {
    let storage = state.storage.write().await;
    storage.mark_message_read(&message_id)
}

/// Delete a message
///
/// Permanently removes a message from local storage.
#[command]
pub async fn delete_message(state: State<'_, GnsState>, message_id: String) -> Result<()> {
    let storage = state.storage.write().await;
    let deleted = storage.delete_message(&message_id)?;
    
    if !deleted {
        log::warn!("Message {} not found for deletion", message_id);
    }
    
    Ok(())
}

/// Get conversation list
#[command]
pub async fn get_conversations(state: State<'_, GnsState>) -> Result<Vec<Conversation>> {
    let my_pk = state
        .get_active_identity()
        .await
        .ok_or_else(|| Error::IdentityNotFound("No active identity".to_string()))?;

    let storage = state.storage.read().await;
    let messages = storage.get_messages(
        &my_pk,
        &MessageQuery {
            limit: 1000,
            ..Default::default()
        },
    )?;

    // Group by peer
    let mut conversations: std::collections::HashMap<String, Conversation> =
        std::collections::HashMap::new();

    for msg in messages {
        let peer_pk = msg.peer_pk(&my_pk).to_string();

        let conv = conversations.entry(peer_pk.clone()).or_insert(Conversation {
            peer_pk: peer_pk.clone(),
            peer_handle: None,
            last_message: None,
            last_message_at: None,
            unread_count: 0,
            total_count: 0,
        });

        conv.total_count += 1;
        if !msg.is_read && msg.is_incoming(&my_pk) {
            conv.unread_count += 1;
        }

        if conv.last_message_at.is_none() || msg.created_at > conv.last_message_at.clone().unwrap_or_default() {
            conv.last_message_at = Some(msg.created_at.clone());
            conv.last_message = msg.decrypted.map(|d| d.content);
        }
    }

    Ok(conversations.into_values().collect())
}
