//! Identity Commands
//!
//! Tauri commands for identity management.

use crate::core::CryptoEngine;
use crate::error::{Error, Result};
use crate::models::*;
use crate::GnsState;
use tauri::{command, State};

// Encryption imports for export/import
use argon2::{Argon2, PasswordHasher, password_hash::SaltString};
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    ChaCha20Poly1305, Nonce,
};
use rand::rngs::OsRng;

/// Derive encryption key from passphrase using Argon2
fn derive_key_from_passphrase(passphrase: &str, salt: &[u8]) -> Result<[u8; 32]> {
    use argon2::{Algorithm, Params, Version};
    
    let argon2 = Argon2::new(
        Algorithm::Argon2id,
        Version::V0x13,
        Params::new(65536, 3, 1, Some(32)).map_err(|e| Error::Crypto(e.to_string()))?,
    );
    
    let mut key = [0u8; 32];
    argon2.hash_password_into(passphrase.as_bytes(), salt, &mut key)
        .map_err(|e| Error::Crypto(format!("Key derivation failed: {}", e)))?;
    
    Ok(key)
}

/// Encrypt secret key with passphrase
fn encrypt_secret_key(secret_key: &str, passphrase: &str) -> Result<(String, String)> {
    // Generate random salt (16 bytes)
    let mut salt = [0u8; 16];
    rand::RngCore::fill_bytes(&mut OsRng, &mut salt);
    
    // Derive encryption key from passphrase
    let key = derive_key_from_passphrase(passphrase, &salt)?;
    
    // Generate random nonce (12 bytes)
    let mut nonce_bytes = [0u8; 12];
    rand::RngCore::fill_bytes(&mut OsRng, &mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // Encrypt
    let cipher = ChaCha20Poly1305::new_from_slice(&key)
        .map_err(|e| Error::Crypto(format!("Cipher init failed: {}", e)))?;
    
    let ciphertext = cipher.encrypt(nonce, secret_key.as_bytes())
        .map_err(|e| Error::Crypto(format!("Encryption failed: {}", e)))?;
    
    // Combine nonce + ciphertext for storage
    let mut encrypted = nonce_bytes.to_vec();
    encrypted.extend(ciphertext);
    
    Ok((hex::encode(encrypted), hex::encode(salt)))
}

/// Decrypt secret key with passphrase
fn decrypt_secret_key(encrypted_hex: &str, salt_hex: &str, passphrase: &str) -> Result<String> {
    let encrypted = hex::decode(encrypted_hex)
        .map_err(|e| Error::Crypto(format!("Invalid encrypted key: {}", e)))?;
    let salt = hex::decode(salt_hex)
        .map_err(|e| Error::Crypto(format!("Invalid salt: {}", e)))?;
    
    if encrypted.len() < 12 {
        return Err(Error::Crypto("Encrypted data too short".into()));
    }
    
    // Extract nonce and ciphertext
    let nonce = Nonce::from_slice(&encrypted[..12]);
    let ciphertext = &encrypted[12..];
    
    // Derive key
    let key = derive_key_from_passphrase(passphrase, &salt)?;
    
    // Decrypt
    let cipher = ChaCha20Poly1305::new_from_slice(&key)
        .map_err(|e| Error::Crypto(format!("Cipher init failed: {}", e)))?;
    
    let plaintext = cipher.decrypt(nonce, ciphertext)
        .map_err(|_| Error::Crypto("Decryption failed - wrong passphrase?".into()))?;
    
    String::from_utf8(plaintext)
        .map_err(|e| Error::Crypto(format!("Invalid decrypted key: {}", e)))
}

/// Create a new GNS identity
///
/// Generates an Ed25519 keypair and derives the X25519 encryption key.
#[command]
pub async fn create_identity(
    state: State<'_, GnsState>,
    params: CreateIdentityParams,
) -> Result<Identity> {
    // Generate Ed25519 keypair
    let (secret_key, public_key) = CryptoEngine::generate_keypair()?;

    // Derive X25519 encryption key
    let (enc_secret, enc_public) = CryptoEngine::derive_encryption_key(&secret_key)?;

    // Save to storage
    let storage = state.storage.write().await;
    storage.save_identity(&public_key, &secret_key, &enc_secret, &enc_public, &params.name)?;

    // Set as default if requested
    if params.set_as_default {
        log::info!("🔧 Setting new identity as default");
        storage.set_default_identity(&public_key)?;
        state.set_active_identity(Some(public_key.clone())).await;
    }

    drop(storage);

    log::info!("✅ COMMAND: Created new identity '{}' (pk: {}...)", params.name, &public_key[..8]);

    Ok(Identity {
        public_key,
        name: params.name,
        handle: None,
        encryption_key: enc_public,
        created_at: chrono::Utc::now().to_rfc3339(),
        is_default: params.set_as_default,
        trust_score: 0.0,
        breadcrumb_count: 0,
    })
}

/// Load an identity (set as active)
#[command]
pub async fn load_identity(state: State<'_, GnsState>, public_key: String) -> Result<Identity> {
    let storage = state.storage.read().await;

    let identity = storage
        .get_identity(&public_key)?
        .ok_or_else(|| Error::IdentityNotFound(public_key.clone()))?;

    drop(storage);

    state.set_active_identity(Some(public_key.clone())).await;

    log::info!("✅ COMMAND: Loaded identity (pk: {}...)", &public_key[..8]);

    Ok(identity)
}

/// Get an identity by public key
#[command]
pub async fn get_identity(
    state: State<'_, GnsState>,
    public_key: Option<String>,
) -> Result<Option<Identity>> {
    let pk = match public_key {
        Some(pk) => pk,
        None => match state.get_active_identity().await {
            Some(pk) => pk,
            None => return Ok(None),
        },
    };

    let storage = state.storage.read().await;
    storage.get_identity(&pk)
}

/// List all identities
#[command]
pub async fn list_identities(state: State<'_, GnsState>) -> Result<Vec<IdentitySummary>> {
    let storage = state.storage.read().await;
    storage.list_identities()
}

/// Delete an identity
#[command]
pub async fn delete_identity(state: State<'_, GnsState>, public_key: String) -> Result<()> {
    let storage = state.storage.write().await;
    storage.delete_identity(&public_key)?;

    // Clear active identity if it was the deleted one
    if state.get_active_identity().await == Some(public_key) {
        state.set_active_identity(None).await;
    }

    Ok(())
}

/// Export an identity for backup
///
/// If a passphrase is provided, the secret key is encrypted using
/// Argon2 key derivation + ChaCha20-Poly1305 encryption.
#[command]
pub async fn export_identity(
    state: State<'_, GnsState>,
    public_key: String,
    passphrase: Option<String>,
) -> Result<ExportedIdentity> {
    let storage = state.storage.read().await;

    let identity = storage
        .get_identity(&public_key)?
        .ok_or_else(|| Error::IdentityNotFound(public_key.clone()))?;

    let secret_key = storage
        .get_secret_key(&public_key)?
        .ok_or_else(|| Error::IdentityNotFound(public_key.clone()))?;

    let (encrypted_key, salt) = if let Some(ref pass) = passphrase {
        // SECURITY: Encrypt secret key with passphrase using Argon2 + ChaCha20-Poly1305
        let (encrypted, salt) = encrypt_secret_key(&secret_key, pass)?;
        (Some(encrypted), Some(salt))
    } else {
        // WARNING: Exporting without passphrase stores secret key in plain text!
        // This should only be used for testing or when the export file itself is encrypted.
        log::warn!("Exporting identity without passphrase - secret key NOT encrypted!");
        (Some(secret_key), None)
    };

    Ok(ExportedIdentity {
        version: 1,
        public_key,
        encrypted_key,
        name: identity.name,
        handle: identity.handle,
        exported_at: chrono::Utc::now().to_rfc3339(),
        salt,
    })
}

/// Import an identity from backup
///
/// If the export was encrypted with a passphrase, the same passphrase must be
/// provided to decrypt the secret key.
#[command]
pub async fn import_identity(
    state: State<'_, GnsState>,
    params: ImportIdentityParams,
) -> Result<Identity> {
    let export: ExportedIdentity = serde_json::from_str(&params.export_data)?;

    let encrypted_key = export
        .encrypted_key
        .ok_or_else(|| Error::InvalidInput("No secret key in export".to_string()))?;

    // Decrypt the secret key if it was encrypted
    let secret_key = if let Some(ref salt) = export.salt {
        // Export was encrypted - need passphrase
        let passphrase = params.passphrase
            .ok_or_else(|| Error::InvalidInput("Passphrase required for encrypted export".to_string()))?;
        
        decrypt_secret_key(&encrypted_key, salt, &passphrase)?
    } else {
        // Export was not encrypted - use key directly
        encrypted_key
    };

    // SECURITY: Verify the secret key produces the expected public key
    let derived_public = CryptoEngine::public_key_from_secret(&secret_key)?;
    if derived_public != export.public_key {
        return Err(Error::Crypto(
            "Secret key does not match public key - import may be corrupted".into()
        ));
    }

    // Derive encryption key
    let (enc_secret, enc_public) = CryptoEngine::derive_encryption_key(&secret_key)?;

    let name = params.new_name.unwrap_or(export.name);

    let storage = state.storage.write().await;
    storage.save_identity(&export.public_key, &secret_key, &enc_secret, &enc_public, &name)?;

    Ok(Identity {
        public_key: export.public_key,
        name,
        handle: export.handle,
        encryption_key: enc_public,
        created_at: chrono::Utc::now().to_rfc3339(),
        is_default: false,
        trust_score: 0.0,
        breadcrumb_count: 0,
    })
}

/// Get the public key of the current identity
#[command]
pub async fn get_public_key(state: State<'_, GnsState>) -> Result<Option<String>> {
    Ok(state.get_active_identity().await)
}

/// Sign a message with the current identity
#[command]
pub async fn sign_message(
    state: State<'_, GnsState>,
    message: String,
    public_key: Option<String>,
) -> Result<SignatureResult> {
    let pk = public_key
        .or(state.get_active_identity().await)
        .ok_or_else(|| Error::IdentityNotFound("No active identity".to_string()))?;

    let storage = state.storage.read().await;

    let secret_key = storage
        .get_secret_key(&pk)?
        .ok_or_else(|| Error::IdentityNotFound(pk.clone()))?;

    let message_bytes = hex::decode(&message).unwrap_or_else(|_| message.as_bytes().to_vec());
    let signature = CryptoEngine::sign(&secret_key, &message_bytes)?;

    Ok(SignatureResult {
        signature,
        public_key: pk,
        message: hex::encode(&message_bytes),
    })
}

/// Verify a signature
#[command]
pub async fn verify_signature(
    public_key: String,
    message: String,
    signature: String,
) -> Result<VerifyResult> {
    let message_bytes = hex::decode(&message).unwrap_or_else(|_| message.as_bytes().to_vec());
    let valid = CryptoEngine::verify(&public_key, &message_bytes, &signature)?;

    Ok(VerifyResult { valid, public_key })
}

/// Set the default identity
#[command]
pub async fn set_default_identity(state: State<'_, GnsState>, public_key: String) -> Result<()> {
    let storage = state.storage.write().await;
    storage.set_default_identity(&public_key)?;
    state.set_active_identity(Some(public_key)).await;
    Ok(())
}
