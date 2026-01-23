//! Integration Tests: Cryptographic Operations Flow
//!
//! Tests the complete cryptographic pipeline:
//! - Key generation (Ed25519)
//! - Key derivation (Ed25519 → X25519)
//! - Signing and verification
//! - Encryption/decryption roundtrip
//! - Message envelope creation and parsing

use tauri_plugin_gns::core::CryptoEngine;

/// Test: Complete Ed25519 key generation and signing flow
#[test]
fn test_ed25519_keypair_and_signing() {
    let crypto = CryptoEngine::new().expect("Failed to create CryptoEngine");

    // Generate keypair
    let (secret_key, public_key) = crypto
        .generate_identity_keypair()
        .expect("Failed to generate keypair");

    // Keys should be valid hex strings
    assert!(!secret_key.is_empty(), "Secret key should not be empty");
    assert!(!public_key.is_empty(), "Public key should not be empty");
    assert_eq!(secret_key.len(), 128, "Secret key should be 64 bytes (128 hex chars)");
    assert_eq!(public_key.len(), 64, "Public key should be 32 bytes (64 hex chars)");

    // Sign a message
    let message = b"Hello, GNS Protocol!";
    let signature = crypto
        .sign(&secret_key, message)
        .expect("Failed to sign message");

    // Signature should be valid hex
    assert!(!signature.is_empty(), "Signature should not be empty");
    assert_eq!(signature.len(), 128, "Signature should be 64 bytes (128 hex chars)");

    // Verify the signature
    let is_valid = crypto
        .verify(&public_key, message, &signature)
        .expect("Failed to verify signature");
    assert!(is_valid, "Signature should be valid");

    // Verify should fail with wrong message
    let wrong_message = b"Wrong message";
    let is_valid_wrong = crypto
        .verify(&public_key, wrong_message, &signature)
        .expect("Failed to verify signature");
    assert!(!is_valid_wrong, "Signature should be invalid for wrong message");
}

/// Test: X25519 key exchange produces shared secrets
#[test]
fn test_x25519_key_exchange() {
    // Simulate Alice and Bob performing key exchange
    let (alice_secret, alice_public) = CryptoEngine::generate_ephemeral_keypair();
    let (bob_secret, bob_public) = CryptoEngine::generate_ephemeral_keypair();

    // Both should derive the same shared secret
    let alice_shared = CryptoEngine::key_exchange(&alice_secret, &bob_public)
        .expect("Alice key exchange failed");
    let bob_shared = CryptoEngine::key_exchange(&bob_secret, &alice_public)
        .expect("Bob key exchange failed");

    assert_eq!(
        alice_shared, bob_shared,
        "Shared secrets should match for Alice and Bob"
    );
    assert_eq!(alice_shared.len(), 64, "Shared secret should be 32 bytes (64 hex chars)");
}

/// Test: Full encryption/decryption roundtrip
#[test]
fn test_encryption_decryption_roundtrip() {
    let crypto = CryptoEngine::new().expect("Failed to create CryptoEngine");

    // Generate sender and recipient keypairs
    let (sender_secret, sender_public) = crypto
        .generate_identity_keypair()
        .expect("Failed to generate sender keypair");
    let (recipient_secret, recipient_public) = crypto
        .generate_identity_keypair()
        .expect("Failed to generate recipient keypair");

    // Original plaintext
    let plaintext = b"This is a secret message that only the recipient should read!";

    // Encrypt
    let encrypted = crypto
        .encrypt(plaintext, &recipient_public)
        .expect("Encryption failed");

    // Encrypted data should be different from plaintext
    assert_ne!(
        encrypted, plaintext,
        "Encrypted data should not equal plaintext"
    );
    assert!(
        encrypted.len() > plaintext.len(),
        "Encrypted data should include overhead (nonce + tag)"
    );

    // Decrypt
    let decrypted = crypto
        .decrypt(&encrypted, &recipient_secret, &sender_public)
        .expect("Decryption failed");

    assert_eq!(
        decrypted, plaintext,
        "Decrypted data should match original plaintext"
    );
}

/// Test: Encryption with different keys fails decryption
#[test]
fn test_encryption_wrong_key_fails() {
    let crypto = CryptoEngine::new().expect("Failed to create CryptoEngine");

    // Generate two different recipients
    let (_, recipient1_public) = crypto
        .generate_identity_keypair()
        .expect("Failed to generate recipient1 keypair");
    let (recipient2_secret, _) = crypto
        .generate_identity_keypair()
        .expect("Failed to generate recipient2 keypair");
    let (_, sender_public) = crypto
        .generate_identity_keypair()
        .expect("Failed to generate sender keypair");

    // Encrypt for recipient1
    let plaintext = b"Secret message for recipient 1";
    let encrypted = crypto
        .encrypt(plaintext, &recipient1_public)
        .expect("Encryption failed");

    // Try to decrypt with recipient2's key (should fail)
    let result = crypto.decrypt(&encrypted, &recipient2_secret, &sender_public);
    assert!(
        result.is_err(),
        "Decryption with wrong key should fail"
    );
}

/// Test: SHA-256 hashing is consistent
#[test]
fn test_sha256_consistency() {
    let crypto = CryptoEngine::new().expect("Failed to create CryptoEngine");

    let data = b"Test data for hashing";
    let hash1 = crypto.sha256(data);
    let hash2 = crypto.sha256(data);

    assert_eq!(hash1, hash2, "Same data should produce same hash");
    assert_eq!(hash1.len(), 64, "SHA-256 hash should be 32 bytes (64 hex chars)");

    // Different data should produce different hash
    let different_data = b"Different test data";
    let hash3 = crypto.sha256(different_data);
    assert_ne!(hash1, hash3, "Different data should produce different hash");
}

/// Test: Random ID generation produces unique values
#[test]
fn test_random_id_uniqueness() {
    let crypto = CryptoEngine::new().expect("Failed to create CryptoEngine");

    let mut ids = std::collections::HashSet::new();
    for _ in 0..100 {
        let id = crypto.random_id();
        assert!(!ids.contains(&id), "Random ID should be unique");
        ids.insert(id);
    }
    assert_eq!(ids.len(), 100, "All 100 IDs should be unique");
}

/// Test: Multiple message encryption maintains forward secrecy
#[test]
fn test_forward_secrecy_ephemeral_keys() {
    // Each encryption should use different ephemeral keys
    let (_, recipient_public) = CryptoEngine::generate_ephemeral_keypair();

    let crypto = CryptoEngine::new().expect("Failed to create CryptoEngine");
    let plaintext = b"Same message";

    // Encrypt the same message twice
    let encrypted1 = crypto.encrypt(plaintext, &recipient_public).expect("Encrypt 1 failed");
    let encrypted2 = crypto.encrypt(plaintext, &recipient_public).expect("Encrypt 2 failed");

    // Ciphertexts should be different (different ephemeral keys/nonces)
    assert_ne!(
        encrypted1, encrypted2,
        "Same plaintext should produce different ciphertexts (forward secrecy)"
    );
}

/// Test: Large message encryption
#[test]
fn test_large_message_encryption() {
    let crypto = CryptoEngine::new().expect("Failed to create CryptoEngine");

    let (secret_key, public_key) = crypto
        .generate_identity_keypair()
        .expect("Failed to generate keypair");
    let (_, sender_public) = crypto
        .generate_identity_keypair()
        .expect("Failed to generate sender keypair");

    // Create a 1MB message
    let large_message: Vec<u8> = (0..1_000_000).map(|i| (i % 256) as u8).collect();

    let encrypted = crypto
        .encrypt(&large_message, &public_key)
        .expect("Large message encryption failed");

    let decrypted = crypto
        .decrypt(&encrypted, &secret_key, &sender_public)
        .expect("Large message decryption failed");

    assert_eq!(
        decrypted, large_message,
        "Large message should roundtrip correctly"
    );
}

/// Test: Ed25519 to X25519 key derivation consistency
#[test]
fn test_key_derivation_ed25519_to_x25519() {
    let crypto = CryptoEngine::new().expect("Failed to create CryptoEngine");

    let (ed_secret, ed_public) = crypto
        .generate_identity_keypair()
        .expect("Failed to generate Ed25519 keypair");

    // Derive X25519 keys from Ed25519 (via HKDF)
    let x_secret1 = crypto.derive_x25519_secret(&ed_secret).expect("Derivation 1 failed");
    let x_secret2 = crypto.derive_x25519_secret(&ed_secret).expect("Derivation 2 failed");

    // Derivation should be deterministic
    assert_eq!(
        x_secret1, x_secret2,
        "Key derivation should be deterministic"
    );
}

#[cfg(test)]
mod benchmarks {
    use super::*;
    use std::time::Instant;

    /// Benchmark: Key generation performance
    #[test]
    fn bench_key_generation() {
        let crypto = CryptoEngine::new().expect("Failed to create CryptoEngine");

        let iterations = 100;
        let start = Instant::now();

        for _ in 0..iterations {
            let _ = crypto.generate_identity_keypair().expect("Keypair generation failed");
        }

        let elapsed = start.elapsed();
        let per_op = elapsed / iterations;

        println!(
            "Key generation: {} iterations in {:?} ({:?}/op)",
            iterations, elapsed, per_op
        );

        // Should complete 100 key generations in under 1 second
        assert!(
            elapsed.as_secs() < 1,
            "Key generation too slow: {:?} for {} iterations",
            elapsed,
            iterations
        );
    }

    /// Benchmark: Signing performance
    #[test]
    fn bench_signing() {
        let crypto = CryptoEngine::new().expect("Failed to create CryptoEngine");
        let (secret_key, _) = crypto.generate_identity_keypair().expect("Keypair failed");
        let message = b"Test message for signing benchmark";

        let iterations = 1000;
        let start = Instant::now();

        for _ in 0..iterations {
            let _ = crypto.sign(&secret_key, message).expect("Signing failed");
        }

        let elapsed = start.elapsed();
        let per_op = elapsed / iterations;

        println!(
            "Signing: {} iterations in {:?} ({:?}/op)",
            iterations, elapsed, per_op
        );

        // Should complete 1000 signatures in under 1 second
        assert!(
            elapsed.as_secs() < 1,
            "Signing too slow: {:?} for {} iterations",
            elapsed,
            iterations
        );
    }

    /// Benchmark: Encryption performance
    #[test]
    fn bench_encryption() {
        let crypto = CryptoEngine::new().expect("Failed to create CryptoEngine");
        let (_, public_key) = crypto.generate_identity_keypair().expect("Keypair failed");
        let message = b"Test message for encryption benchmark - not too long but realistic";

        let iterations = 1000;
        let start = Instant::now();

        for _ in 0..iterations {
            let _ = crypto.encrypt(message, &public_key).expect("Encryption failed");
        }

        let elapsed = start.elapsed();
        let per_op = elapsed / iterations;

        println!(
            "Encryption: {} iterations in {:?} ({:?}/op)",
            iterations, elapsed, per_op
        );

        // Should complete 1000 encryptions in under 2 seconds
        assert!(
            elapsed.as_secs() < 2,
            "Encryption too slow: {:?} for {} iterations",
            elapsed,
            iterations
        );
    }
}
