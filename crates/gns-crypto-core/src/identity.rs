//! GNS Identity - Ed25519 signing + X25519 encryption
//!
//! A GNS identity consists of:
//! - Ed25519 signing keypair (for signatures)
//! - X25519 encryption keypair (derived from Ed25519 for encryption)
//!
//! The X25519 key is derived from the Ed25519 key using standard
//! Ed25519-to-X25519 conversion, ensuring a single seed controls both.

use ed25519_dalek::{SigningKey, VerifyingKey, Signature, Signer, Verifier};
use x25519_dalek::{StaticSecret as X25519Secret, PublicKey as X25519PublicKey};
use zeroize::{Zeroize, ZeroizeOnDrop};
use rand::rngs::OsRng;
use sha2::{Sha512, Digest};

use crate::encryption::EncryptedPayload;
use crate::errors::CryptoError;

/// GNS Identity - the core cryptographic identity
///
/// Contains Ed25519 signing key and derived X25519 encryption key.
/// Implements ZeroizeOnDrop to securely clear memory when dropped.
#[derive(ZeroizeOnDrop)]
pub struct GnsIdentity {
    /// Ed25519 signing key (also contains public key)
    #[zeroize(skip)] // SigningKey handles its own zeroization
    signing_key: SigningKey,
    
    /// X25519 secret for encryption (derived from Ed25519)
    x25519_secret: [u8; 32],
    
    /// Cached X25519 public key
    #[zeroize(skip)]
    x25519_public: X25519PublicKey,
}

impl GnsIdentity {
    /// Generate a new random identity
    pub fn generate() -> Self {
        let signing_key = SigningKey::generate(&mut OsRng);
        Self::from_signing_key(signing_key)
    }

    /// Create identity from raw Ed25519 private key bytes (32 bytes)
    pub fn from_bytes(private_key: &[u8; 32]) -> Result<Self, CryptoError> {
        let signing_key = SigningKey::from_bytes(private_key);
        Ok(Self::from_signing_key(signing_key))
    }

    /// Create identity from hex-encoded private key
    pub fn from_hex(private_key_hex: &str) -> Result<Self, CryptoError> {
        let bytes = hex::decode(private_key_hex)?;
        if bytes.len() != 32 {
            return Err(CryptoError::InvalidKeyLength {
                expected: 32,
                got: bytes.len(),
            });
        }
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        Self::from_bytes(&arr)
    }

    /// Internal: create from SigningKey
    fn from_signing_key(signing_key: SigningKey) -> Self {
        // Derive X25519 secret from Ed25519 secret
        // This follows the standard Ed25519-to-X25519 conversion
        let x25519_secret = ed25519_to_x25519_secret(signing_key.as_bytes());
        let x25519_public = X25519PublicKey::from(&X25519Secret::from(x25519_secret));

        Self {
            signing_key,
            x25519_secret,
            x25519_public,
        }
    }

    // ==================== PUBLIC KEY ACCESSORS ====================

    /// Get Ed25519 public key as bytes
    pub fn public_key_bytes(&self) -> [u8; 32] {
        self.signing_key.verifying_key().to_bytes()
    }

    /// Get Ed25519 public key as hex string
    pub fn public_key_hex(&self) -> String {
        hex::encode(self.public_key_bytes())
    }

    /// Get X25519 encryption public key as bytes
    pub fn encryption_public_key_bytes(&self) -> [u8; 32] {
        *self.x25519_public.as_bytes()
    }

    /// Get X25519 encryption public key as hex string
    pub fn encryption_key_hex(&self) -> String {
        hex::encode(self.encryption_public_key_bytes())
    }

    /// Get Ed25519 private key as hex (USE WITH CAUTION!)
    pub fn private_key_hex(&self) -> String {
        hex::encode(self.signing_key.as_bytes())
    }

    // ==================== SIGNING ====================

    /// Sign a message with Ed25519
    pub fn sign(&self, message: &[u8]) -> Signature {
        self.signing_key.sign(message)
    }

    /// Sign and return bytes
    pub fn sign_bytes(&self, message: &[u8]) -> [u8; 64] {
        self.sign(message).to_bytes()
    }

    /// Verify a signature (using own public key)
    pub fn verify(&self, message: &[u8], signature: &Signature) -> bool {
        self.signing_key.verifying_key().verify(message, signature).is_ok()
    }

    /// Verify signature from bytes
    pub fn verify_bytes(&self, message: &[u8], signature_bytes: &[u8; 64]) -> bool {
        match Signature::from_bytes(signature_bytes) {
            Ok(sig) => self.verify(message, &sig),
            Err(_) => false,
        }
    }

    // ==================== ENCRYPTION ====================

    /// Encrypt a message for a recipient's X25519 public key
    pub fn encrypt_for(
        &self,
        plaintext: &[u8],
        recipient_x25519_public: &[u8; 32],
    ) -> Result<EncryptedPayload, CryptoError> {
        crate::encryption::encrypt_for_recipient(plaintext, recipient_x25519_public)
    }

    /// Decrypt a message sent to us
    pub fn decrypt(&self, encrypted: &EncryptedPayload) -> Result<Vec<u8>, CryptoError> {
        crate::encryption::decrypt_from_sender(
            &self.x25519_secret,
            encrypted,
        )
    }

    /// Get X25519 secret for internal use (encryption operations)
    pub(crate) fn x25519_secret(&self) -> &[u8; 32] {
        &self.x25519_secret
    }
}

/// Verify a signature with an external public key
pub fn verify_with_public_key(
    public_key_hex: &str,
    message: &[u8],
    signature_bytes: &[u8],
) -> Result<bool, CryptoError> {
    let public_key_bytes = hex::decode(public_key_hex)?;
    if public_key_bytes.len() != 32 {
        return Err(CryptoError::InvalidKeyLength {
            expected: 32,
            got: public_key_bytes.len(),
        });
    }

    let public_key_arr: [u8; 32] = public_key_bytes.try_into().unwrap();
    let verifying_key = VerifyingKey::from_bytes(&public_key_arr)?;

    if signature_bytes.len() != 64 {
        return Err(CryptoError::InvalidKeyLength {
            expected: 64,
            got: signature_bytes.len(),
        });
    }
    let sig_arr: [u8; 64] = signature_bytes.try_into().unwrap();
    let signature = Signature::from_bytes(&sig_arr);

    Ok(verifying_key.verify(message, &signature).is_ok())
}

/// Convert Ed25519 private key to X25519 private key
///
/// This follows the standard conversion:
/// 1. Hash Ed25519 secret with SHA-512
/// 2. Take first 32 bytes
/// 3. Apply X25519 clamping
fn ed25519_to_x25519_secret(ed25519_secret: &[u8; 32]) -> [u8; 32] {
    let mut hasher = Sha512::new();
    hasher.update(ed25519_secret);
    let hash = hasher.finalize();

    let mut x25519_secret = [0u8; 32];
    x25519_secret.copy_from_slice(&hash[..32]);

    // X25519 clamping
    x25519_secret[0] &= 248;
    x25519_secret[31] &= 127;
    x25519_secret[31] |= 64;

    x25519_secret
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identity_generation() {
        let identity = GnsIdentity::generate();
        
        // Check key lengths
        assert_eq!(identity.public_key_hex().len(), 64); // 32 bytes = 64 hex chars
        assert_eq!(identity.encryption_key_hex().len(), 64);
    }

    #[test]
    fn test_identity_restore_from_hex() {
        let original = GnsIdentity::generate();
        let private_hex = original.private_key_hex();
        
        let restored = GnsIdentity::from_hex(&private_hex).unwrap();
        
        assert_eq!(original.public_key_hex(), restored.public_key_hex());
        assert_eq!(original.encryption_key_hex(), restored.encryption_key_hex());
    }

    #[test]
    fn test_signing() {
        let identity = GnsIdentity::generate();
        let message = b"Test message";

        let signature = identity.sign(message);
        
        assert!(identity.verify(message, &signature));
        assert!(!identity.verify(b"Different message", &signature));
    }

    #[test]
    fn test_verify_with_external_public_key() {
        let identity = GnsIdentity::generate();
        let message = b"Test message";
        
        let signature = identity.sign_bytes(message);
        
        let valid = verify_with_public_key(
            &identity.public_key_hex(),
            message,
            &signature,
        ).unwrap();
        
        assert!(valid);
    }

    #[test]
    fn test_x25519_derivation_is_deterministic() {
        let identity1 = GnsIdentity::from_hex(
            "0000000000000000000000000000000000000000000000000000000000000001"
        ).unwrap();
        
        let identity2 = GnsIdentity::from_hex(
            "0000000000000000000000000000000000000000000000000000000000000001"
        ).unwrap();
        
        assert_eq!(identity1.encryption_key_hex(), identity2.encryption_key_hex());
    }
}
