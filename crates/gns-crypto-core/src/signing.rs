//! Signing Module - Ed25519 signatures
//!
//! Provides standalone signing and verification functions
//! for use outside of the GnsIdentity context.

use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use crate::errors::CryptoError;

/// Sign a message with a raw private key
pub fn sign_message(private_key: &[u8; 32], message: &[u8]) -> [u8; 64] {
    let signing_key = SigningKey::from_bytes(private_key);
    signing_key.sign(message).to_bytes()
}

/// Verify a signature with a public key
pub fn verify_signature(
    public_key: &[u8; 32],
    message: &[u8],
    signature: &[u8; 64],
) -> Result<bool, CryptoError> {
    let verifying_key = VerifyingKey::from_bytes(public_key)?;
    let sig = Signature::from_bytes(signature);
    Ok(verifying_key.verify(message, &sig).is_ok())
}

/// Verify a signature with hex-encoded keys
pub fn verify_signature_hex(
    public_key_hex: &str,
    message: &[u8],
    signature_hex: &str,
) -> Result<bool, CryptoError> {
    let public_key_bytes = hex::decode(public_key_hex)?;
    let signature_bytes = hex::decode(signature_hex)?;

    if public_key_bytes.len() != 32 {
        return Err(CryptoError::InvalidKeyLength {
            expected: 32,
            got: public_key_bytes.len(),
        });
    }

    if signature_bytes.len() != 64 {
        return Err(CryptoError::InvalidKeyLength {
            expected: 64,
            got: signature_bytes.len(),
        });
    }

    let public_key: [u8; 32] = public_key_bytes.try_into().unwrap();
    let signature: [u8; 64] = signature_bytes.try_into().unwrap();

    verify_signature(&public_key, message, &signature)
}

/// Create a canonical message for signing
/// 
/// This ensures that the same logical message produces the same bytes
/// for signing across all platforms.
pub fn canonicalize_for_signing(data: &serde_json::Value) -> Vec<u8> {
    // Use a deterministic JSON serialization
    // Keys are sorted alphabetically, no whitespace
    canonical_json(data).into_bytes()
}

/// Produce canonical JSON (sorted keys, no whitespace)
fn canonical_json(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Object(map) => {
            let mut pairs: Vec<_> = map.iter().collect();
            pairs.sort_by(|a, b| a.0.cmp(b.0));
            
            let inner: Vec<String> = pairs
                .iter()
                .map(|(k, v)| format!("\"{}\":{}", k, canonical_json(v)))
                .collect();
            
            format!("{{{}}}", inner.join(","))
        }
        serde_json::Value::Array(arr) => {
            let inner: Vec<String> = arr.iter().map(canonical_json).collect();
            format!("[{}]", inner.join(","))
        }
        serde_json::Value::String(s) => format!("\"{}\"", escape_json_string(s)),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        serde_json::Value::Null => "null".to_string(),
    }
}

/// Escape special characters in JSON strings
fn escape_json_string(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '"' => result.push_str("\\\""),
            '\\' => result.push_str("\\\\"),
            '\n' => result.push_str("\\n"),
            '\r' => result.push_str("\\r"),
            '\t' => result.push_str("\\t"),
            c if c.is_control() => {
                result.push_str(&format!("\\u{:04x}", c as u32));
            }
            c => result.push(c),
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::identity::GnsIdentity;

    #[test]
    fn test_sign_verify_roundtrip() {
        let identity = GnsIdentity::generate();
        let private_key = hex::decode(identity.private_key_hex()).unwrap();
        let private_key: [u8; 32] = private_key.try_into().unwrap();

        let message = b"Test message to sign";
        let signature = sign_message(&private_key, message);

        let public_key = identity.public_key_bytes();
        let valid = verify_signature(&public_key, message, &signature).unwrap();

        assert!(valid);
    }

    #[test]
    fn test_canonical_json() {
        let json = serde_json::json!({
            "z": "last",
            "a": "first",
            "m": {
                "nested_z": 1,
                "nested_a": 2
            }
        });

        let canonical = canonical_json(&json);
        
        // Keys should be sorted
        assert_eq!(
            canonical,
            r#"{"a":"first","m":{"nested_a":2,"nested_z":1},"z":"last"}"#
        );
    }

    #[test]
    fn test_canonical_json_is_deterministic() {
        let json1 = serde_json::json!({"b": 1, "a": 2});
        let json2 = serde_json::json!({"a": 2, "b": 1});

        assert_eq!(canonical_json(&json1), canonical_json(&json2));
    }
}
