//! Encryption Module - X25519 ECDH + ChaCha20-Poly1305
//!
//! Implements the GNS envelope encryption scheme:
//! 1. Generate ephemeral X25519 keypair
//! 2. Perform ECDH with recipient's X25519 public key
//! 3. Derive symmetric key using HKDF-SHA256
//! 4. Encrypt with ChaCha20-Poly1305 AEAD

use chacha20poly1305::{
    aead::{Aead, KeyInit},
    ChaCha20Poly1305, Nonce,
};
use hkdf::Hkdf;
use rand::RngCore;
use rand::rngs::OsRng;
use sha2::Sha256;
use serde::{Deserialize, Serialize};
use x25519_dalek::{EphemeralSecret, PublicKey as X25519PublicKey, StaticSecret};
use zeroize::Zeroize;

use crate::errors::CryptoError;

/// Encrypted payload structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedPayload {
    /// Ephemeral X25519 public key (32 bytes)
    #[serde(with = "hex_bytes")]
    pub ephemeral_public_key: Vec<u8>,

    /// Nonce for ChaCha20-Poly1305 (12 bytes)
    #[serde(with = "hex_bytes")]
    pub nonce: Vec<u8>,

    /// Encrypted data + authentication tag
    #[serde(with = "hex_bytes")]
    pub ciphertext: Vec<u8>,
}

/// Encrypt data for a recipient
///
/// Uses ephemeral ECDH to establish a shared secret, then encrypts
/// with ChaCha20-Poly1305.
pub fn encrypt_for_recipient(
    plaintext: &[u8],
    recipient_x25519_public: &[u8; 32],
) -> Result<EncryptedPayload, CryptoError> {
    // Generate ephemeral keypair
    let ephemeral_secret = EphemeralSecret::random_from_rng(OsRng);
    let ephemeral_public = X25519PublicKey::from(&ephemeral_secret);

    // Perform ECDH
    let recipient_public = X25519PublicKey::from(*recipient_x25519_public);
    let shared_secret = ephemeral_secret.diffie_hellman(&recipient_public);

    // Derive symmetric key using HKDF
    let mut symmetric_key = derive_symmetric_key(
        shared_secret.as_bytes(),
        ephemeral_public.as_bytes(),
        recipient_x25519_public,
    )?;

    // Generate random nonce
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Encrypt with ChaCha20-Poly1305
    let cipher = ChaCha20Poly1305::new_from_slice(&symmetric_key)
        .map_err(|e| CryptoError::EncryptionFailed(e.to_string()))?;

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| CryptoError::EncryptionFailed(e.to_string()))?;

    // Zeroize symmetric key
    symmetric_key.zeroize();

    Ok(EncryptedPayload {
        ephemeral_public_key: ephemeral_public.as_bytes().to_vec(),
        nonce: nonce_bytes.to_vec(),
        ciphertext,
    })
}

/// Decrypt data sent to us
pub fn decrypt_from_sender(
    our_x25519_secret: &[u8; 32],
    encrypted: &EncryptedPayload,
) -> Result<Vec<u8>, CryptoError> {
    // Validate lengths
    if encrypted.ephemeral_public_key.len() != 32 {
        return Err(CryptoError::InvalidKeyLength {
            expected: 32,
            got: encrypted.ephemeral_public_key.len(),
        });
    }
    if encrypted.nonce.len() != 12 {
        return Err(CryptoError::InvalidNonceLength);
    }

    // Parse ephemeral public key
    let ephemeral_public_bytes: [u8; 32] = encrypted
        .ephemeral_public_key
        .clone()
        .try_into()
        .unwrap();
    let ephemeral_public = X25519PublicKey::from(ephemeral_public_bytes);

    // Perform ECDH with our static secret
    let our_secret = StaticSecret::from(*our_x25519_secret);
    let our_public = X25519PublicKey::from(&our_secret);
    let shared_secret = our_secret.diffie_hellman(&ephemeral_public);

    // Derive symmetric key using HKDF (same as encryption)
    let mut symmetric_key = derive_symmetric_key(
        shared_secret.as_bytes(),
        &ephemeral_public_bytes,
        our_public.as_bytes(),
    )?;

    // Parse nonce
    let nonce_bytes: [u8; 12] = encrypted.nonce.clone().try_into().unwrap();
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Decrypt with ChaCha20-Poly1305
    let cipher = ChaCha20Poly1305::new_from_slice(&symmetric_key)
        .map_err(|e| CryptoError::DecryptionFailed(e.to_string()))?;

    let plaintext = cipher
        .decrypt(nonce, encrypted.ciphertext.as_ref())
        .map_err(|_| CryptoError::DecryptionFailed("Authentication failed".to_string()))?;

    // Zeroize symmetric key
    symmetric_key.zeroize();

    Ok(plaintext)
}

/// Derive symmetric key from shared secret using HKDF-SHA256
fn derive_symmetric_key(
    shared_secret: &[u8],
    ephemeral_public: &[u8],
    recipient_public: &[u8],
) -> Result<[u8; 32], CryptoError> {
    // Create info string for domain separation
    // Include both public keys to bind the key to this specific exchange
    let mut info = Vec::with_capacity(64 + 17);
    info.extend_from_slice(b"gns-envelope-v1:");
    info.extend_from_slice(ephemeral_public);
    info.extend_from_slice(recipient_public);

    let hkdf = Hkdf::<Sha256>::new(None, shared_secret);
    let mut key = [0u8; 32];
    hkdf.expand(&info, &mut key)
        .map_err(|e| CryptoError::KeyDerivationFailed(e.to_string()))?;

    Ok(key)
}

/// Hex serialization helper for serde
mod hex_bytes {
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(bytes: &Vec<u8>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&hex::encode(bytes))
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<u8>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        hex::decode(&s).map_err(serde::de::Error::custom)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::identity::GnsIdentity;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let sender = GnsIdentity::generate();
        let recipient = GnsIdentity::generate();

        let plaintext = b"Hello, this is a secret message!";

        let encrypted = encrypt_for_recipient(
            plaintext,
            &recipient.encryption_public_key_bytes(),
        )
        .expect("Encryption should succeed");

        let decrypted = decrypt_from_sender(
            recipient.x25519_secret(),
            &encrypted,
        )
        .expect("Decryption should succeed");

        assert_eq!(plaintext.as_slice(), decrypted.as_slice());
    }

    #[test]
    fn test_wrong_recipient_cannot_decrypt() {
        let sender = GnsIdentity::generate();
        let recipient = GnsIdentity::generate();
        let wrong_recipient = GnsIdentity::generate();

        let plaintext = b"Secret message";

        let encrypted = encrypt_for_recipient(
            plaintext,
            &recipient.encryption_public_key_bytes(),
        )
        .expect("Encryption should succeed");

        // Wrong recipient should fail to decrypt
        let result = decrypt_from_sender(
            wrong_recipient.x25519_secret(),
            &encrypted,
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_tampered_ciphertext_fails() {
        let recipient = GnsIdentity::generate();
        let plaintext = b"Secret message";

        let mut encrypted = encrypt_for_recipient(
            plaintext,
            &recipient.encryption_public_key_bytes(),
        )
        .expect("Encryption should succeed");

        // Tamper with ciphertext
        if let Some(byte) = encrypted.ciphertext.get_mut(0) {
            *byte ^= 0xFF;
        }

        let result = decrypt_from_sender(
            recipient.x25519_secret(),
            &encrypted,
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_encrypted_payload_serialization() {
        let recipient = GnsIdentity::generate();
        let plaintext = b"Test message";

        let encrypted = encrypt_for_recipient(
            plaintext,
            &recipient.encryption_public_key_bytes(),
        )
        .expect("Encryption should succeed");

        // Serialize to JSON
        let json = serde_json::to_string(&encrypted).expect("Serialization should succeed");

        // Deserialize back
        let deserialized: EncryptedPayload =
            serde_json::from_str(&json).expect("Deserialization should succeed");

        // Decrypt should still work
        let decrypted = decrypt_from_sender(
            recipient.x25519_secret(),
            &deserialized,
        )
        .expect("Decryption should succeed");

        assert_eq!(plaintext.as_slice(), decrypted.as_slice());
    }
}
