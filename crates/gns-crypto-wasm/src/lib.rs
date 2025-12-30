//! GNS Crypto WASM - WebAssembly bindings for browser use
//!
//! This crate compiles the gns-crypto-core to WebAssembly,
//! providing the same cryptographic operations for Panthera web app.

use wasm_bindgen::prelude::*;
use gns_crypto_core::{GnsIdentity, create_envelope, open_envelope, create_breadcrumb};
use serde::{Deserialize, Serialize};

/// Initialize panic hook for better error messages
#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

// ==================== Identity Operations ====================

/// Generate a new identity
/// Returns JSON: { public_key, encryption_key, private_key }
#[wasm_bindgen]
pub fn generate_identity() -> Result<JsValue, JsError> {
    let identity = GnsIdentity::generate();
    
    let result = IdentityKeys {
        public_key: identity.public_key_hex(),
        encryption_key: identity.encryption_key_hex(),
        private_key: identity.private_key_hex(),
    };
    
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsError::new(&e.to_string()))
}

/// Restore identity from private key hex
/// Returns JSON: { public_key, encryption_key }
#[wasm_bindgen]
pub fn restore_identity(private_key_hex: &str) -> Result<JsValue, JsError> {
    let identity = GnsIdentity::from_hex(private_key_hex)
        .map_err(|e| JsError::new(&format!("Invalid private key: {}", e)))?;
    
    let result = IdentityInfo {
        public_key: identity.public_key_hex(),
        encryption_key: identity.encryption_key_hex(),
    };
    
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsError::new(&e.to_string()))
}

// ==================== Signing Operations ====================

/// Sign a message
/// Returns signature as hex string
#[wasm_bindgen]
pub fn sign_message(private_key_hex: &str, message: &[u8]) -> Result<String, JsError> {
    let identity = GnsIdentity::from_hex(private_key_hex)
        .map_err(|e| JsError::new(&format!("Invalid private key: {}", e)))?;
    
    let signature = identity.sign_bytes(message);
    Ok(hex::encode(signature))
}

/// Verify a signature
/// Returns true if valid
#[wasm_bindgen]
pub fn verify_signature(
    public_key_hex: &str,
    message: &[u8],
    signature_hex: &str,
) -> Result<bool, JsError> {
    let result = gns_crypto_core::signing::verify_signature_hex(
        public_key_hex,
        message,
        signature_hex,
    ).map_err(|e| JsError::new(&format!("Verification error: {}", e)))?;
    
    Ok(result)
}

// ==================== Encryption Operations ====================

/// Encrypt data for a recipient
/// Returns JSON: { ephemeral_public_key, nonce, ciphertext } (all hex)
#[wasm_bindgen]
pub fn encrypt_for_recipient(
    plaintext: &[u8],
    recipient_encryption_key_hex: &str,
) -> Result<JsValue, JsError> {
    let recipient_key = hex::decode(recipient_encryption_key_hex)
        .map_err(|e| JsError::new(&format!("Invalid recipient key: {}", e)))?;
    
    if recipient_key.len() != 32 {
        return Err(JsError::new("Recipient key must be 32 bytes"));
    }
    
    let recipient_key_arr: [u8; 32] = recipient_key.try_into().unwrap();
    
    let encrypted = gns_crypto_core::encrypt_for_recipient(plaintext, &recipient_key_arr)
        .map_err(|e| JsError::new(&format!("Encryption failed: {}", e)))?;
    
    serde_wasm_bindgen::to_value(&encrypted)
        .map_err(|e| JsError::new(&e.to_string()))
}

/// Decrypt data sent to us
/// Returns plaintext bytes
#[wasm_bindgen]
pub fn decrypt_message(
    private_key_hex: &str,
    encrypted_json: &str,
) -> Result<Vec<u8>, JsError> {
    let identity = GnsIdentity::from_hex(private_key_hex)
        .map_err(|e| JsError::new(&format!("Invalid private key: {}", e)))?;
    
    let encrypted: gns_crypto_core::EncryptedPayload = serde_json::from_str(encrypted_json)
        .map_err(|e| JsError::new(&format!("Invalid encrypted payload: {}", e)))?;
    
    let plaintext = identity.decrypt(&encrypted)
        .map_err(|e| JsError::new(&format!("Decryption failed: {}", e)))?;
    
    Ok(plaintext)
}

// ==================== Envelope Operations ====================

/// Create a signed and encrypted envelope
/// Returns envelope as JSON string
#[wasm_bindgen]
pub fn create_signed_envelope(
    sender_private_key_hex: &str,
    recipient_public_key_hex: &str,
    recipient_encryption_key_hex: &str,
    payload_type: &str,
    payload: &[u8],
) -> Result<String, JsError> {
    let sender = GnsIdentity::from_hex(sender_private_key_hex)
        .map_err(|e| JsError::new(&format!("Invalid sender key: {}", e)))?;
    
    let envelope = create_envelope(
        &sender,
        recipient_public_key_hex,
        recipient_encryption_key_hex,
        payload_type,
        payload,
    ).map_err(|e| JsError::new(&format!("Envelope creation failed: {}", e)))?;
    
    envelope.to_json()
        .map_err(|e| JsError::new(&format!("Serialization failed: {}", e)))
}

/// Open (verify and decrypt) an envelope
/// Returns JSON: { from_public_key, payload_type, payload, signature_valid }
#[wasm_bindgen]
pub fn open_signed_envelope(
    recipient_private_key_hex: &str,
    envelope_json: &str,
) -> Result<JsValue, JsError> {
    let recipient = GnsIdentity::from_hex(recipient_private_key_hex)
        .map_err(|e| JsError::new(&format!("Invalid recipient key: {}", e)))?;
    
    let envelope = gns_crypto_core::GnsEnvelope::from_json(envelope_json)
        .map_err(|e| JsError::new(&format!("Invalid envelope: {}", e)))?;
    
    let opened = open_envelope(&recipient, &envelope)
        .map_err(|e| JsError::new(&format!("Failed to open envelope: {}", e)))?;
    
    let result = OpenedEnvelopeResult {
        from_public_key: opened.from_public_key,
        from_handle: opened.from_handle,
        payload_type: opened.payload_type,
        payload: opened.payload,
        signature_valid: opened.signature_valid,
        envelope_id: opened.envelope_id,
        timestamp: opened.timestamp,
    };
    
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsError::new(&e.to_string()))
}

// ==================== Breadcrumb Operations ====================

/// Create a signed breadcrumb
/// Returns breadcrumb as JSON string
#[wasm_bindgen]
pub fn create_signed_breadcrumb(
    private_key_hex: &str,
    latitude: f64,
    longitude: f64,
) -> Result<String, JsError> {
    let identity = GnsIdentity::from_hex(private_key_hex)
        .map_err(|e| JsError::new(&format!("Invalid private key: {}", e)))?;
    
    let breadcrumb = create_breadcrumb(&identity, latitude, longitude, None)
        .map_err(|e| JsError::new(&format!("Breadcrumb creation failed: {}", e)))?;
    
    breadcrumb.to_json()
        .map_err(|e| JsError::new(&format!("Serialization failed: {}", e)))
}

/// Verify a breadcrumb signature
#[wasm_bindgen]
pub fn verify_breadcrumb(breadcrumb_json: &str) -> Result<bool, JsError> {
    let breadcrumb = gns_crypto_core::Breadcrumb::from_json(breadcrumb_json)
        .map_err(|e| JsError::new(&format!("Invalid breadcrumb: {}", e)))?;
    
    breadcrumb.verify()
        .map_err(|e| JsError::new(&format!("Verification failed: {}", e)))
}

// ==================== Helper Types ====================

#[derive(Serialize)]
struct IdentityKeys {
    public_key: String,
    encryption_key: String,
    private_key: String,
}

#[derive(Serialize)]
struct IdentityInfo {
    public_key: String,
    encryption_key: String,
}

#[derive(Serialize)]
struct OpenedEnvelopeResult {
    from_public_key: String,
    from_handle: Option<String>,
    payload_type: String,
    #[serde(with = "serde_bytes")]
    payload: Vec<u8>,
    signature_valid: bool,
    envelope_id: String,
    timestamp: i64,
}

mod serde_bytes {
    use serde::{Serializer, Serialize};
    
    pub fn serialize<S>(bytes: &Vec<u8>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        // Serialize as array of numbers for JS compatibility
        bytes.serialize(serializer)
    }
}

// ==================== Tests ====================

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    #[wasm_bindgen_test]
    fn test_generate_identity() {
        let result = generate_identity().expect("Should generate identity");
        // Just verify it returns something
        assert!(!result.is_null());
    }

    #[wasm_bindgen_test]
    fn test_sign_verify_roundtrip() {
        let keys: IdentityKeys = serde_wasm_bindgen::from_value(
            generate_identity().expect("Should generate")
        ).expect("Should parse");
        
        let message = b"Test message";
        let signature = sign_message(&keys.private_key, message)
            .expect("Should sign");
        
        let valid = verify_signature(&keys.public_key, message, &signature)
            .expect("Should verify");
        
        assert!(valid);
    }
}
