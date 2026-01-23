//! Integration Tests: Storage Operations Flow
//!
//! Tests the complete storage pipeline:
//! - Identity CRUD operations
//! - Message storage and retrieval
//! - Handle cache operations
//! - Database migrations

use tauri_plugin_gns::core::{CryptoEngine, StorageManager};
use tauri_plugin_gns::models::{Identity, Message, MessageType};
use chrono::Utc;
use tempfile::TempDir;

/// Helper to create a test storage manager
fn create_test_storage() -> (StorageManager, TempDir) {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let db_path = temp_dir.path().join("test_gns.db");
    let storage = StorageManager::new(&db_path, false)
        .expect("Failed to create storage manager");
    (storage, temp_dir)
}

/// Test: Identity creation and retrieval
#[test]
fn test_identity_crud_operations() {
    let (storage, _temp_dir) = create_test_storage();
    let crypto = CryptoEngine::new().expect("Failed to create CryptoEngine");

    // Generate a keypair
    let (secret_key, public_key) = crypto
        .generate_identity_keypair()
        .expect("Failed to generate keypair");

    // Create identity
    let identity = Identity {
        id: crypto.random_id(),
        name: "Test User".to_string(),
        public_key: public_key.clone(),
        handle: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        is_default: true,
        breadcrumb_count: 0,
        trust_score: 0.0,
        last_breadcrumb_at: None,
    };

    // Save identity
    storage
        .save_identity(&identity, &secret_key)
        .expect("Failed to save identity");

    // Retrieve identity
    let retrieved = storage
        .get_identity(&public_key)
        .expect("Failed to get identity")
        .expect("Identity not found");

    assert_eq!(retrieved.name, "Test User");
    assert_eq!(retrieved.public_key, public_key);
    assert!(retrieved.is_default);

    // List identities
    let identities = storage
        .list_identities()
        .expect("Failed to list identities");
    assert_eq!(identities.len(), 1);

    // Get secret key
    let retrieved_secret = storage
        .get_secret_key(&public_key)
        .expect("Failed to get secret key")
        .expect("Secret key not found");
    assert_eq!(retrieved_secret, secret_key);

    // Delete identity
    storage
        .delete_identity(&public_key)
        .expect("Failed to delete identity");

    let deleted = storage.get_identity(&public_key).expect("Query failed");
    assert!(deleted.is_none(), "Identity should be deleted");
}

/// Test: Multiple identities with default selection
#[test]
fn test_multiple_identities_default() {
    let (storage, _temp_dir) = create_test_storage();
    let crypto = CryptoEngine::new().expect("Failed to create CryptoEngine");

    // Create first identity (default)
    let (secret1, public1) = crypto.generate_identity_keypair().expect("Keypair 1 failed");
    let identity1 = Identity {
        id: crypto.random_id(),
        name: "Identity 1".to_string(),
        public_key: public1.clone(),
        handle: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        is_default: true,
        breadcrumb_count: 0,
        trust_score: 0.0,
        last_breadcrumb_at: None,
    };
    storage.save_identity(&identity1, &secret1).expect("Save 1 failed");

    // Create second identity (not default)
    let (secret2, public2) = crypto.generate_identity_keypair().expect("Keypair 2 failed");
    let identity2 = Identity {
        id: crypto.random_id(),
        name: "Identity 2".to_string(),
        public_key: public2.clone(),
        handle: Some("alice".to_string()),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        is_default: false,
        breadcrumb_count: 50,
        trust_score: 25.0,
        last_breadcrumb_at: Some(Utc::now()),
    };
    storage.save_identity(&identity2, &secret2).expect("Save 2 failed");

    // List should return both
    let identities = storage.list_identities().expect("List failed");
    assert_eq!(identities.len(), 2);

    // Find default
    let default = identities.iter().find(|i| i.is_default);
    assert!(default.is_some(), "Should have a default identity");
    assert_eq!(default.unwrap().name, "Identity 1");

    // Set new default
    storage.set_default_identity(&public2).expect("Set default failed");

    let identities = storage.list_identities().expect("List failed");
    let new_default = identities.iter().find(|i| i.is_default);
    assert_eq!(new_default.unwrap().name, "Identity 2");
}

/// Test: Identity with handle
#[test]
fn test_identity_with_handle() {
    let (storage, _temp_dir) = create_test_storage();
    let crypto = CryptoEngine::new().expect("Failed to create CryptoEngine");

    let (secret, public_key) = crypto.generate_identity_keypair().expect("Keypair failed");

    // Create identity without handle
    let mut identity = Identity {
        id: crypto.random_id(),
        name: "Handle Test".to_string(),
        public_key: public_key.clone(),
        handle: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        is_default: true,
        breadcrumb_count: 100,
        trust_score: 30.0,
        last_breadcrumb_at: Some(Utc::now()),
    };
    storage.save_identity(&identity, &secret).expect("Save failed");

    // Update with handle
    identity.handle = Some("testuser".to_string());
    identity.updated_at = Utc::now();
    storage.update_identity(&identity).expect("Update failed");

    // Retrieve and verify
    let retrieved = storage.get_identity(&public_key).expect("Get failed").unwrap();
    assert_eq!(retrieved.handle, Some("testuser".to_string()));
}

/// Test: Message storage and retrieval
#[test]
fn test_message_storage() {
    let (storage, _temp_dir) = create_test_storage();
    let crypto = CryptoEngine::new().expect("Failed to create CryptoEngine");

    // Create sender identity
    let (sender_secret, sender_public) = crypto.generate_identity_keypair().expect("Sender keypair failed");
    let sender = Identity {
        id: crypto.random_id(),
        name: "Sender".to_string(),
        public_key: sender_public.clone(),
        handle: Some("sender".to_string()),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        is_default: true,
        breadcrumb_count: 0,
        trust_score: 0.0,
        last_breadcrumb_at: None,
    };
    storage.save_identity(&sender, &sender_secret).expect("Save sender failed");

    let recipient_public = "recipient_public_key_hex_placeholder_32bytes_here";

    // Create and save message
    let message = Message {
        id: crypto.random_id(),
        from_pk: sender_public.clone(),
        to_pk: recipient_public.to_string(),
        encrypted_payload: vec![1, 2, 3, 4, 5],
        message_type: MessageType::Text,
        timestamp: Utc::now(),
        read: false,
        delivered: false,
        signature: "test_signature".to_string(),
        relay_id: None,
        decrypted_cache: None,
    };

    storage.save_message(&message).expect("Save message failed");

    // Retrieve messages
    let messages = storage
        .get_messages(&sender_public, Some(10), None)
        .expect("Get messages failed");
    assert_eq!(messages.len(), 1);
    assert_eq!(messages[0].id, message.id);

    // Mark as read
    storage.mark_message_read(&message.id).expect("Mark read failed");

    let updated = storage.get_message(&message.id).expect("Get message failed").unwrap();
    assert!(updated.read, "Message should be marked as read");

    // Delete message
    storage.delete_message(&message.id).expect("Delete failed");
    let deleted = storage.get_message(&message.id).expect("Get after delete");
    assert!(deleted.is_none(), "Message should be deleted");
}

/// Test: Handle cache operations
#[test]
fn test_handle_cache() {
    let (storage, _temp_dir) = create_test_storage();

    let handle = "testhandle";
    let public_key = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    // Cache a handle resolution
    storage
        .cache_handle(handle, public_key, 3600)
        .expect("Cache handle failed");

    // Retrieve from cache
    let cached = storage
        .get_cached_handle(handle)
        .expect("Get cached handle failed");
    assert!(cached.is_some(), "Handle should be in cache");
    assert_eq!(cached.unwrap(), public_key);

    // Clear cache
    storage.clear_handle_cache().expect("Clear cache failed");

    let after_clear = storage.get_cached_handle(handle).expect("Get after clear");
    assert!(after_clear.is_none(), "Cache should be cleared");
}

/// Test: Breadcrumb count tracking
#[test]
fn test_breadcrumb_count() {
    let (storage, _temp_dir) = create_test_storage();
    let crypto = CryptoEngine::new().expect("Failed to create CryptoEngine");

    let (secret, public_key) = crypto.generate_identity_keypair().expect("Keypair failed");
    let identity = Identity {
        id: crypto.random_id(),
        name: "Breadcrumb Test".to_string(),
        public_key: public_key.clone(),
        handle: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        is_default: true,
        breadcrumb_count: 0,
        trust_score: 0.0,
        last_breadcrumb_at: None,
    };
    storage.save_identity(&identity, &secret).expect("Save failed");

    // Get initial count
    let count = storage.get_breadcrumb_count(&public_key).expect("Count failed");
    assert_eq!(count, 0);

    // Increment count
    storage.increment_breadcrumb_count(&public_key, 10).expect("Increment failed");

    let new_count = storage.get_breadcrumb_count(&public_key).expect("New count failed");
    assert_eq!(new_count, 10);

    // Increment again
    storage.increment_breadcrumb_count(&public_key, 5).expect("Increment 2 failed");
    let final_count = storage.get_breadcrumb_count(&public_key).expect("Final count failed");
    assert_eq!(final_count, 15);
}

/// Test: Trust score update
#[test]
fn test_trust_score_update() {
    let (storage, _temp_dir) = create_test_storage();
    let crypto = CryptoEngine::new().expect("Failed to create CryptoEngine");

    let (secret, public_key) = crypto.generate_identity_keypair().expect("Keypair failed");
    let identity = Identity {
        id: crypto.random_id(),
        name: "Trust Test".to_string(),
        public_key: public_key.clone(),
        handle: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        is_default: true,
        breadcrumb_count: 100,
        trust_score: 0.0,
        last_breadcrumb_at: None,
    };
    storage.save_identity(&identity, &secret).expect("Save failed");

    // Update trust score
    storage.update_trust_score(&public_key, 45.5).expect("Update trust failed");

    let retrieved = storage.get_identity(&public_key).expect("Get failed").unwrap();
    assert!((retrieved.trust_score - 45.5).abs() < 0.01, "Trust score should be updated");
}

/// Test: Database handles concurrent access (basic)
#[test]
fn test_concurrent_reads() {
    use std::thread;

    let (storage, temp_dir) = create_test_storage();
    let crypto = CryptoEngine::new().expect("Failed to create CryptoEngine");

    // Create an identity
    let (secret, public_key) = crypto.generate_identity_keypair().expect("Keypair failed");
    let identity = Identity {
        id: crypto.random_id(),
        name: "Concurrent Test".to_string(),
        public_key: public_key.clone(),
        handle: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        is_default: true,
        breadcrumb_count: 0,
        trust_score: 0.0,
        last_breadcrumb_at: None,
    };
    storage.save_identity(&identity, &secret).expect("Save failed");

    // Spawn multiple reader threads
    let db_path = temp_dir.path().join("test_gns.db");
    let handles: Vec<_> = (0..5)
        .map(|_| {
            let pk = public_key.clone();
            let path = db_path.clone();
            thread::spawn(move || {
                let storage = StorageManager::new(&path, false).expect("Open storage failed");
                let result = storage.get_identity(&pk).expect("Get failed");
                assert!(result.is_some(), "Identity should exist");
            })
        })
        .collect();

    for handle in handles {
        handle.join().expect("Thread panicked");
    }
}

/// Test: Empty database queries don't error
#[test]
fn test_empty_database_queries() {
    let (storage, _temp_dir) = create_test_storage();

    // Query non-existent identity
    let result = storage.get_identity("nonexistent").expect("Query should not error");
    assert!(result.is_none());

    // List empty identities
    let identities = storage.list_identities().expect("List should not error");
    assert!(identities.is_empty());

    // Get non-existent message
    let message = storage.get_message("nonexistent").expect("Query should not error");
    assert!(message.is_none());

    // Get cached handle that doesn't exist
    let cached = storage.get_cached_handle("nonexistent").expect("Query should not error");
    assert!(cached.is_none());
}

/// Test: Database file is created at correct path
#[test]
fn test_database_file_creation() {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let db_path = temp_dir.path().join("subdir").join("nested").join("gns.db");

    // Should create parent directories
    let storage = StorageManager::new(&db_path, false);
    assert!(storage.is_ok(), "Storage creation should succeed");
    assert!(db_path.exists(), "Database file should exist");
}
