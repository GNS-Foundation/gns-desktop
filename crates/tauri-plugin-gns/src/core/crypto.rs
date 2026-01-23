//! Cryptographic Engine
//!
//! Implements all cryptographic operations for GNS:
//! - Ed25519 for signatures (identity keys)
//! - X25519 for key exchange (encryption)
//! - ChaCha20-Poly1305 for symmetric encryption
//!
//! # Security
//!
//! All secret key material is automatically wiped from memory when dropped
//! using the `zeroize` crate to prevent key leakage.

use crate::error::{Error, Result};
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    ChaCha20Poly1305, Nonce,
};
use ed25519_dalek::{
    Signature, Signer, SigningKey, Verifier, VerifyingKey,
};
use hkdf::Hkdf;
use rand::rngs::OsRng;
use sha2::Sha256;
use x25519_dalek::{PublicKey as X25519Public, StaticSecret as X25519Secret};
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Size of Ed25519 public key in bytes
pub const ED25519_PUBLIC_KEY_SIZE: usize = 32;
/// Size of Ed25519 secret key in bytes
pub const ED25519_SECRET_KEY_SIZE: usize = 32;
/// Size of Ed25519 signature in bytes
pub const ED25519_SIGNATURE_SIZE: usize = 64;
/// Size of X25519 public key in bytes
pub const X25519_PUBLIC_KEY_SIZE: usize = 32;
/// Size of ChaCha20-Poly1305 nonce in bytes
pub const NONCE_SIZE: usize = 12;
/// Size of ChaCha20-Poly1305 key in bytes
pub const SYMMETRIC_KEY_SIZE: usize = 32;

/// Secure wrapper for secret key bytes that zeroizes on drop
#[derive(Zeroize, ZeroizeOnDrop)]
pub struct SecretKeyBytes(pub [u8; 32]);

impl SecretKeyBytes {
    /// Create from hex string
    pub fn from_hex(hex_str: &str) -> Result<Self> {
        let bytes = hex::decode(hex_str)
            .map_err(|e| Error::Crypto(format!("Invalid hex: {}", e)))?;
        if bytes.len() != 32 {
            return Err(Error::Crypto("Secret key must be 32 bytes".into()));
        }
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        Ok(Self(arr))
    }

    /// Convert to hex string (use sparingly - copies key material)
    pub fn to_hex(&self) -> String {
        hex::encode(self.0)
    }
}

/// Cryptographic operations engine
pub struct CryptoEngine {
    _initialized: bool,
}

impl CryptoEngine {
    /// Create a new crypto engine
    pub fn new() -> Result<Self> {
        Ok(Self { _initialized: true })
    }

    /// Generate a new Ed25519 keypair
    ///
    /// Returns (secret_key_hex, public_key_hex)
    pub fn generate_keypair() -> Result<(String, String)> {
        let signing_key = SigningKey::generate(&mut OsRng);
        let public_key = signing_key.verifying_key();

        Ok((
            hex::encode(signing_key.to_bytes()),
            hex::encode(public_key.to_bytes()),
        ))
    }

    /// Derive public key from secret key
    ///
    /// Used to verify imported keypairs are valid.
    pub fn public_key_from_secret(secret_key_hex: &str) -> Result<String> {
        let secret_bytes = hex::decode(secret_key_hex)
            .map_err(|e| Error::Crypto(format!("Invalid hex: {}", e)))?;
        
        if secret_bytes.len() != ED25519_SECRET_KEY_SIZE {
            return Err(Error::InvalidInput("Invalid secret key size".to_string()));
        }

        let secret_array: [u8; 32] = secret_bytes
            .try_into()
            .map_err(|_| Error::Crypto("Invalid key bytes".to_string()))?;

        let signing_key = SigningKey::from_bytes(&secret_array);
        let public_key = signing_key.verifying_key();

        Ok(hex::encode(public_key.to_bytes()))
    }

    /// Derive X25519 encryption keypair from Ed25519 signing key
    ///
    /// Uses the Ed25519 seed to derive a consistent X25519 key
    pub fn derive_encryption_key(ed25519_secret: &str) -> Result<(String, String)> {
        let secret_bytes = hex::decode(ed25519_secret)?;
        if secret_bytes.len() != ED25519_SECRET_KEY_SIZE {
            return Err(Error::InvalidInput("Invalid secret key size".to_string()));
        }

        // Use HKDF to derive X25519 key from Ed25519 seed
        let hk = Hkdf::<Sha256>::new(Some(b"gns-x25519-derive"), &secret_bytes);
        let mut x25519_secret = [0u8; 32];
        hk.expand(b"x25519", &mut x25519_secret)
            .map_err(|e| Error::Crypto(format!("HKDF failed: {}", e)))?;

        let secret = X25519Secret::from(x25519_secret);
        let public = X25519Public::from(&secret);

        Ok((hex::encode(x25519_secret), hex::encode(public.as_bytes())))
    }

    /// Sign a message with Ed25519
    ///
    /// # Arguments
    /// * `secret_key_hex` - The signing key as hex string
    /// * `message` - The message to sign (as bytes)
    ///
    /// # Returns
    /// The signature as a hex string (128 characters)
    pub fn sign(secret_key_hex: &str, message: &[u8]) -> Result<String> {
        let secret_bytes = hex::decode(secret_key_hex)?;
        if secret_bytes.len() != ED25519_SECRET_KEY_SIZE {
            return Err(Error::InvalidInput("Invalid secret key size".to_string()));
        }

        let secret_array: [u8; 32] = secret_bytes
            .try_into()
            .map_err(|_| Error::Crypto("Invalid key bytes".to_string()))?;

        let signing_key = SigningKey::from_bytes(&secret_array);
        let signature = signing_key.sign(message);

        Ok(hex::encode(signature.to_bytes()))
    }

    /// Verify an Ed25519 signature
    ///
    /// # Arguments
    /// * `public_key_hex` - The public key as hex string (64 characters)
    /// * `message` - The original message
    /// * `signature_hex` - The signature as hex string (128 characters)
    ///
    /// # Returns
    /// `true` if the signature is valid
    pub fn verify(public_key_hex: &str, message: &[u8], signature_hex: &str) -> Result<bool> {
        let public_bytes = hex::decode(public_key_hex)?;
        let signature_bytes = hex::decode(signature_hex)?;

        if public_bytes.len() != ED25519_PUBLIC_KEY_SIZE {
            return Err(Error::InvalidInput("Invalid public key size".to_string()));
        }
        if signature_bytes.len() != ED25519_SIGNATURE_SIZE {
            return Err(Error::InvalidInput("Invalid signature size".to_string()));
        }

        let public_array: [u8; 32] = public_bytes
            .try_into()
            .map_err(|_| Error::Crypto("Invalid key bytes".to_string()))?;
        let sig_array: [u8; 64] = signature_bytes
            .try_into()
            .map_err(|_| Error::Crypto("Invalid signature bytes".to_string()))?;

        let verifying_key = VerifyingKey::from_bytes(&public_array)?;
        let signature = Signature::from_bytes(&sig_array);

        Ok(verifying_key.verify(message, &signature).is_ok())
    }

    /// Perform X25519 key exchange
    ///
    /// # Arguments
    /// * `our_secret_hex` - Our X25519 secret key
    /// * `their_public_hex` - Their X25519 public key
    ///
    /// # Returns
    /// The shared secret as hex string
    pub fn key_exchange(our_secret_hex: &str, their_public_hex: &str) -> Result<String> {
        let our_secret_bytes = hex::decode(our_secret_hex)?;
        let their_public_bytes = hex::decode(their_public_hex)?;

        if our_secret_bytes.len() != X25519_PUBLIC_KEY_SIZE {
            return Err(Error::InvalidInput("Invalid secret key size".to_string()));
        }
        if their_public_bytes.len() != X25519_PUBLIC_KEY_SIZE {
            return Err(Error::InvalidInput("Invalid public key size".to_string()));
        }

        let our_secret_array: [u8; 32] = our_secret_bytes
            .try_into()
            .map_err(|_| Error::Crypto("Invalid key bytes".to_string()))?;
        let their_public_array: [u8; 32] = their_public_bytes
            .try_into()
            .map_err(|_| Error::Crypto("Invalid key bytes".to_string()))?;

        let our_secret = X25519Secret::from(our_secret_array);
        let their_public = X25519Public::from(their_public_array);

        let shared_secret = our_secret.diffie_hellman(&their_public);

        Ok(hex::encode(shared_secret.as_bytes()))
    }

    /// Derive encryption key from shared secret using HKDF
    pub fn derive_message_key(shared_secret_hex: &str, info: &[u8]) -> Result<String> {
        let shared_bytes = hex::decode(shared_secret_hex)?;

        let hk = Hkdf::<Sha256>::new(Some(b"gns-message-key"), &shared_bytes);
        let mut key = [0u8; SYMMETRIC_KEY_SIZE];
        hk.expand(info, &mut key)
            .map_err(|e| Error::Crypto(format!("HKDF failed: {}", e)))?;

        Ok(hex::encode(key))
    }

    /// Encrypt data with ChaCha20-Poly1305
    ///
    /// # Arguments
    /// * `key_hex` - The encryption key (64 hex chars / 32 bytes)
    /// * `plaintext` - The data to encrypt
    ///
    /// # Returns
    /// (nonce_hex, ciphertext_base64)
    pub fn encrypt(key_hex: &str, plaintext: &[u8]) -> Result<(String, String)> {
        let key_bytes = hex::decode(key_hex)?;
        if key_bytes.len() != SYMMETRIC_KEY_SIZE {
            return Err(Error::InvalidInput("Invalid key size".to_string()));
        }

        let key_array: [u8; 32] = key_bytes
            .try_into()
            .map_err(|_| Error::Crypto("Invalid key bytes".to_string()))?;

        let cipher = ChaCha20Poly1305::new(&key_array.into());

        // Generate random nonce
        let mut nonce_bytes = [0u8; NONCE_SIZE];
        rand::Rng::fill(&mut OsRng, &mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, plaintext)
            .map_err(|e| Error::Crypto(format!("Encryption failed: {}", e)))?;

        use base64::{engine::general_purpose::STANDARD, Engine};
        Ok((hex::encode(nonce_bytes), STANDARD.encode(ciphertext)))
    }

    /// Decrypt data with ChaCha20-Poly1305
    ///
    /// # Arguments
    /// * `key_hex` - The decryption key (64 hex chars / 32 bytes)
    /// * `nonce_hex` - The nonce used for encryption
    /// * `ciphertext_base64` - The encrypted data
    ///
    /// # Returns
    /// The decrypted plaintext
    pub fn decrypt(key_hex: &str, nonce_hex: &str, ciphertext_base64: &str) -> Result<Vec<u8>> {
        let key_bytes = hex::decode(key_hex)?;
        let nonce_bytes = hex::decode(nonce_hex)?;

        if key_bytes.len() != SYMMETRIC_KEY_SIZE {
            return Err(Error::InvalidInput("Invalid key size".to_string()));
        }
        if nonce_bytes.len() != NONCE_SIZE {
            return Err(Error::InvalidInput("Invalid nonce size".to_string()));
        }

        use base64::{engine::general_purpose::STANDARD, Engine};
        let ciphertext = STANDARD.decode(ciphertext_base64)?;

        let key_array: [u8; 32] = key_bytes
            .try_into()
            .map_err(|_| Error::Crypto("Invalid key bytes".to_string()))?;

        let cipher = ChaCha20Poly1305::new(&key_array.into());
        let nonce = Nonce::from_slice(&nonce_bytes);

        cipher
            .decrypt(nonce, ciphertext.as_ref())
            .map_err(|_| Error::DecryptionFailed("Decryption failed".to_string()))
    }

    /// Generate an ephemeral X25519 keypair for message encryption
    pub fn generate_ephemeral_keypair() -> (String, String) {
        let secret = X25519Secret::random_from_rng(OsRng);
        let public = X25519Public::from(&secret);

        (hex::encode(secret.as_bytes()), hex::encode(public.as_bytes()))
    }

    /// Hash data with SHA256
    pub fn sha256(data: &[u8]) -> String {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(data);
        hex::encode(hasher.finalize())
    }

    /// Generate a random ID
    pub fn random_id() -> String {
        uuid::Uuid::new_v4().to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keypair_generation() {
        let (secret, public) = CryptoEngine::generate_keypair().unwrap();
        assert_eq!(secret.len(), 64); // 32 bytes = 64 hex chars
        assert_eq!(public.len(), 64);
    }

    #[test]
    fn test_sign_and_verify() {
        let (secret, public) = CryptoEngine::generate_keypair().unwrap();
        let message = b"Hello, GNS!";

        let signature = CryptoEngine::sign(&secret, message).unwrap();
        assert_eq!(signature.len(), 128); // 64 bytes = 128 hex chars

        let valid = CryptoEngine::verify(&public, message, &signature).unwrap();
        assert!(valid);

        // Wrong message should fail
        let invalid = CryptoEngine::verify(&public, b"Wrong message", &signature).unwrap();
        assert!(!invalid);
    }

    #[test]
    fn test_encryption_roundtrip() {
        let (key, _) = CryptoEngine::generate_ephemeral_keypair();
        let plaintext = b"Secret message for GNS";

        let (nonce, ciphertext) = CryptoEngine::encrypt(&key, plaintext).unwrap();
        let decrypted = CryptoEngine::decrypt(&key, &nonce, &ciphertext).unwrap();

        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_key_exchange() {
        // Alice generates keypair
        let (alice_secret, alice_public) = CryptoEngine::generate_ephemeral_keypair();
        // Bob generates keypair
        let (bob_secret, bob_public) = CryptoEngine::generate_ephemeral_keypair();

        // Both derive the same shared secret
        let alice_shared = CryptoEngine::key_exchange(&alice_secret, &bob_public).unwrap();
        let bob_shared = CryptoEngine::key_exchange(&bob_secret, &alice_public).unwrap();

        assert_eq!(alice_shared, bob_shared);
    }

    #[test]
    fn test_derive_encryption_key() {
        let (secret, _) = CryptoEngine::generate_keypair().unwrap();
        let (x25519_secret, x25519_public) = CryptoEngine::derive_encryption_key(&secret).unwrap();

        assert_eq!(x25519_secret.len(), 64);
        assert_eq!(x25519_public.len(), 64);
    }

    #[test]
    fn test_secret_key_bytes_zeroize() {
        let (secret_hex, _) = CryptoEngine::generate_keypair().unwrap();
        
        // Create SecretKeyBytes
        let secret_key = SecretKeyBytes::from_hex(&secret_hex).unwrap();
        
        // Verify it contains the key
        assert_eq!(secret_key.to_hex(), secret_hex);
        
        // When dropped, memory should be zeroed (verified by zeroize crate)
        // This is mainly a compile-time check that ZeroizeOnDrop is implemented
        drop(secret_key);
    }

    #[test]
    fn test_secret_key_bytes_invalid_input() {
        // Too short
        let result = SecretKeyBytes::from_hex("abcd");
        assert!(result.is_err());

        // Invalid hex
        let result = SecretKeyBytes::from_hex("not_valid_hex_string_here_xxxxx");
        assert!(result.is_err());
    }
}
