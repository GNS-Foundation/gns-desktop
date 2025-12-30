//! GNS Crypto Core - The Single Source of Truth
//!
//! This crate provides all cryptographic operations for the GNS ecosystem.
//! It is compiled to:
//! - Native code for Tauri (iOS, Android, macOS, Windows, Linux)
//! - WebAssembly for Panthera browser
//!
//! ## Key Principles
//! - One implementation, all platforms
//! - Use only audited, production-ready libraries
//! - Secure memory handling with zeroize
//! - No custom cryptography

pub mod breadcrumb;
pub mod encryption;
pub mod envelope;
pub mod errors;
pub mod identity;
pub mod signing;

pub use breadcrumb::{create_breadcrumb, Breadcrumb};
pub use encryption::{decrypt_from_sender, encrypt_for_recipient, EncryptedPayload};
pub use envelope::{create_envelope, create_envelope_with_metadata, open_envelope, GnsEnvelope};
pub use errors::CryptoError;
pub use identity::GnsIdentity;
pub use signing::{sign_message, verify_signature};

/// Re-export commonly used types
pub mod prelude {
    pub use crate::breadcrumb::Breadcrumb;
    pub use crate::envelope::GnsEnvelope;
    pub use crate::errors::CryptoError;
    pub use crate::identity::GnsIdentity;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_full_message_flow() {
        // Generate two identities
        let alice = GnsIdentity::generate();
        let bob = GnsIdentity::generate();

        // Alice sends message to Bob
        let message = b"Hello Bob!";

        // Encrypt for Bob
        let encrypted = alice
            .encrypt_for(message, &bob.encryption_public_key_bytes())
            .expect("Encryption should succeed");

        // Bob decrypts
        let decrypted = bob.decrypt(&encrypted).expect("Decryption should succeed");

        assert_eq!(message.as_slice(), decrypted.as_slice());
    }

    #[test]
    fn test_signature_roundtrip() {
        let identity = GnsIdentity::generate();
        let message = b"Sign this message";

        let signature = identity.sign(message);

        assert!(identity.verify(message, &signature));
        assert!(!identity.verify(b"Wrong message", &signature));
    }

    #[test]
    fn test_envelope_creation_and_opening() {
        let sender = GnsIdentity::generate();
        let recipient = GnsIdentity::generate();

        let payload = serde_json::json!({
            "type": "text/plain",
            "text": "Hello from envelope!"
        });

        let envelope = create_envelope(
            &sender,
            &recipient.public_key_hex(),
            &recipient.encryption_key_hex(),
            "text/plain",
            &serde_json::to_vec(&payload).unwrap(),
        )
        .expect("Envelope creation should succeed");

        let opened = open_envelope(&recipient, &envelope).expect("Envelope opening should succeed");

        assert!(opened.signature_valid);
        assert_eq!(opened.from_public_key, sender.public_key_hex());
    }
}
