//! Integration Tests: Trajectory Collection Flow
//!
//! These tests only run when the `trajectory` feature is enabled:
//! ```bash
//! cargo test --test integration --features trajectory
//! ```
//!
//! Tests the Proof-of-Trajectory system:
//! - Breadcrumb collection
//! - H3 cell quantization
//! - Chain integrity (hash linking)
//! - Epoch publishing

#![cfg(feature = "trajectory")]

use tauri_plugin_gns::core::{CryptoEngine, StorageManager};
use tauri_plugin_gns::models::breadcrumb::{Breadcrumb, BreadcrumbSource, EpochHeader};
use chrono::Utc;
use h3o::{LatLng, Resolution};
use tempfile::TempDir;

/// Helper to create a test storage manager
fn create_test_storage() -> (StorageManager, TempDir) {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let db_path = temp_dir.path().join("test_trajectory.db");
    let storage = StorageManager::new(&db_path, false)
        .expect("Failed to create storage manager");
    (storage, temp_dir)
}

/// Test: H3 cell creation from coordinates
#[test]
fn test_h3_cell_creation() {
    // San Francisco coordinates
    let lat = 37.7749;
    let lng = -122.4194;

    let latlng = LatLng::new(lat, lng).expect("Invalid coordinates");

    // Test different resolutions
    let resolutions = vec![
        (Resolution::Five, "85"),   // ~252 km²
        (Resolution::Seven, "87"),  // ~5.1 km²
        (Resolution::Nine, "89"),   // ~0.1 km²
    ];

    for (resolution, expected_prefix) in resolutions {
        let cell = latlng.to_cell(resolution);
        let index_str = cell.to_string();

        assert!(
            index_str.starts_with(expected_prefix),
            "Resolution {:?} should produce index starting with {}, got {}",
            resolution,
            expected_prefix,
            index_str
        );
    }
}

/// Test: Same location produces same H3 cell
#[test]
fn test_h3_cell_consistency() {
    let lat = 40.7128;
    let lng = -74.0060;

    let latlng1 = LatLng::new(lat, lng).unwrap();
    let latlng2 = LatLng::new(lat, lng).unwrap();

    let cell1 = latlng1.to_cell(Resolution::Seven);
    let cell2 = latlng2.to_cell(Resolution::Seven);

    assert_eq!(
        cell1.to_string(),
        cell2.to_string(),
        "Same coordinates should produce same H3 cell"
    );
}

/// Test: Nearby locations may share cells at low resolution
#[test]
fn test_h3_resolution_privacy() {
    // Two nearby points in Manhattan (~100m apart)
    let point1 = LatLng::new(40.7589, -73.9851).unwrap(); // Times Square
    let point2 = LatLng::new(40.7580, -73.9855).unwrap(); // Nearby

    // At low resolution (high privacy), they should share a cell
    let cell1_low = point1.to_cell(Resolution::Five);
    let cell2_low = point2.to_cell(Resolution::Five);
    assert_eq!(
        cell1_low.to_string(),
        cell2_low.to_string(),
        "Nearby points should share cell at low resolution (high privacy)"
    );

    // At high resolution (low privacy), they may differ
    let cell1_high = point1.to_cell(Resolution::Nine);
    let cell2_high = point2.to_cell(Resolution::Nine);
    // Note: They might still be same cell, just testing that resolution affects this
    println!(
        "High res cells: {} vs {}",
        cell1_high.to_string(),
        cell2_high.to_string()
    );
}

/// Test: Breadcrumb chain integrity
#[test]
fn test_breadcrumb_chain() {
    let crypto = CryptoEngine::new().expect("Failed to create CryptoEngine");
    let (secret_key, public_key) = crypto.generate_identity_keypair().expect("Keypair failed");

    let mut breadcrumbs: Vec<Breadcrumb> = Vec::new();
    let mut prev_hash = "genesis".to_string();

    // Generate chain of breadcrumbs
    let locations = vec![
        (40.7128, -74.0060),  // New York
        (40.7580, -73.9855),  // Times Square
        (40.7484, -73.9857),  // Empire State
    ];

    for (i, (lat, lng)) in locations.iter().enumerate() {
        let latlng = LatLng::new(*lat, *lng).expect("Invalid coords");
        let cell = latlng.to_cell(Resolution::Seven);
        let timestamp = Utc::now();

        // Calculate hash: H(h3_index || timestamp || prev_hash)
        let hash_input = format!(
            "{}|{}|{}",
            cell.to_string(),
            timestamp.timestamp_millis(),
            prev_hash
        );
        let hash = crypto.sha256(hash_input.as_bytes());

        // Sign the hash
        let signature = crypto.sign(&secret_key, hash.as_bytes()).expect("Sign failed");

        let breadcrumb = Breadcrumb {
            id: crypto.random_id(),
            h3_index: cell.to_string(),
            h3_resolution: 7,
            timestamp,
            prev_hash: prev_hash.clone(),
            hash: hash.clone(),
            signature,
            source: BreadcrumbSource::Gps,
            accuracy: Some(10.0),
            published: false,
        };

        prev_hash = hash;
        breadcrumbs.push(breadcrumb);
    }

    // Verify chain integrity
    for (i, breadcrumb) in breadcrumbs.iter().enumerate() {
        if i == 0 {
            assert_eq!(breadcrumb.prev_hash, "genesis", "First breadcrumb should link to genesis");
        } else {
            assert_eq!(
                breadcrumb.prev_hash,
                breadcrumbs[i - 1].hash,
                "Breadcrumb {} should link to breadcrumb {}",
                i,
                i - 1
            );
        }

        // Verify signature
        let is_valid = crypto
            .verify(&public_key, breadcrumb.hash.as_bytes(), &breadcrumb.signature)
            .expect("Verify failed");
        assert!(is_valid, "Breadcrumb {} signature should be valid", i);
    }
}

/// Test: Breadcrumb storage persistence
#[test]
fn test_breadcrumb_storage() {
    let (storage, _temp_dir) = create_test_storage();
    let crypto = CryptoEngine::new().expect("Failed to create CryptoEngine");

    // Create identity
    let (secret_key, public_key) = crypto.generate_identity_keypair().expect("Keypair failed");
    let identity = tauri_plugin_gns::models::Identity {
        id: crypto.random_id(),
        name: "Trajectory Test".to_string(),
        public_key: public_key.clone(),
        handle: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        is_default: true,
        breadcrumb_count: 0,
        trust_score: 0.0,
        last_breadcrumb_at: None,
    };
    storage.save_identity(&identity, &secret_key).expect("Save identity failed");

    // Create breadcrumb
    let latlng = LatLng::new(51.5074, -0.1278).expect("Invalid coords"); // London
    let cell = latlng.to_cell(Resolution::Seven);
    let timestamp = Utc::now();
    let hash_input = format!("{}|{}|genesis", cell.to_string(), timestamp.timestamp_millis());
    let hash = crypto.sha256(hash_input.as_bytes());
    let signature = crypto.sign(&secret_key, hash.as_bytes()).expect("Sign failed");

    let breadcrumb = Breadcrumb {
        id: crypto.random_id(),
        h3_index: cell.to_string(),
        h3_resolution: 7,
        timestamp,
        prev_hash: "genesis".to_string(),
        hash: hash.clone(),
        signature,
        source: BreadcrumbSource::Gps,
        accuracy: Some(5.0),
        published: false,
    };

    // Save breadcrumb
    storage
        .save_breadcrumb(&public_key, &breadcrumb)
        .expect("Save breadcrumb failed");

    // Verify count updated
    let count = storage.get_breadcrumb_count(&public_key).expect("Get count failed");
    assert_eq!(count, 1, "Breadcrumb count should be 1");

    // Save more breadcrumbs
    for i in 0..9 {
        let bc = Breadcrumb {
            id: crypto.random_id(),
            h3_index: format!("87283082{}", i),
            h3_resolution: 7,
            timestamp: Utc::now(),
            prev_hash: hash.clone(),
            hash: crypto.sha256(format!("test{}", i).as_bytes()),
            signature: crypto.sign(&secret_key, b"test").expect("Sign"),
            source: BreadcrumbSource::Gps,
            accuracy: Some(10.0),
            published: false,
        };
        storage.save_breadcrumb(&public_key, &bc).expect("Save bc failed");
    }

    let final_count = storage.get_breadcrumb_count(&public_key).expect("Final count");
    assert_eq!(final_count, 10, "Should have 10 breadcrumbs");
}

/// Test: Geographic diversity calculation
#[test]
fn test_geographic_diversity() {
    // Simulate visiting different cities
    let cities = vec![
        (40.7128, -74.0060),   // New York
        (34.0522, -118.2437), // Los Angeles
        (41.8781, -87.6298),  // Chicago
        (51.5074, -0.1278),   // London
        (35.6762, 139.6503),  // Tokyo
    ];

    let mut unique_cells: std::collections::HashSet<String> = std::collections::HashSet::new();

    for (lat, lng) in cities {
        let latlng = LatLng::new(lat, lng).expect("Invalid coords");
        let cell = latlng.to_cell(Resolution::Five); // Country-level
        unique_cells.insert(cell.to_string());
    }

    // All cities should produce different H3 cells at resolution 5
    assert_eq!(
        unique_cells.len(),
        5,
        "5 different cities should produce 5 different H3 cells"
    );
}

/// Test: Epoch header creation
#[test]
fn test_epoch_header_creation() {
    let crypto = CryptoEngine::new().expect("Failed to create CryptoEngine");
    let (secret_key, public_key) = crypto.generate_identity_keypair().expect("Keypair failed");

    let start_time = Utc::now() - chrono::Duration::days(7);
    let end_time = Utc::now();

    // Calculate Merkle root (simplified)
    let merkle_root = crypto.sha256(format!("epoch-{}-0", public_key).as_bytes());

    let epoch = EpochHeader {
        identity: public_key.clone(),
        epoch_index: 0,
        start_time,
        end_time,
        merkle_root: merkle_root.clone(),
        block_count: 10,
        prev_epoch_hash: None,
        signature: String::new(),
        epoch_hash: String::new(),
    };

    // Calculate epoch hash
    let epoch_data = format!(
        "{}|{}|{}|{}|{}|{}",
        epoch.identity,
        epoch.epoch_index,
        epoch.start_time.timestamp(),
        epoch.end_time.timestamp(),
        epoch.merkle_root,
        "genesis"
    );
    let epoch_hash = crypto.sha256(epoch_data.as_bytes());

    // Sign epoch
    let signature = crypto.sign(&secret_key, epoch_hash.as_bytes()).expect("Sign failed");

    let signed_epoch = EpochHeader {
        epoch_hash: epoch_hash.clone(),
        signature: signature.clone(),
        ..epoch
    };

    // Verify epoch signature
    let is_valid = crypto
        .verify(&public_key, epoch_hash.as_bytes(), &signature)
        .expect("Verify failed");
    assert!(is_valid, "Epoch signature should be valid");

    assert!(!signed_epoch.epoch_hash.is_empty());
    assert!(!signed_epoch.signature.is_empty());
}

/// Test: Minimum breadcrumbs for epoch
#[test]
fn test_epoch_requirements() {
    // Default requirement is 100 breadcrumbs per epoch
    const MIN_BREADCRUMBS: usize = 100;
    const BREADCRUMBS_PER_BLOCK: usize = 10;

    let breadcrumb_count = 250;
    let can_publish = breadcrumb_count >= MIN_BREADCRUMBS;
    let epoch_count = breadcrumb_count / MIN_BREADCRUMBS;
    let block_count = (breadcrumb_count / BREADCRUMBS_PER_BLOCK).min(MIN_BREADCRUMBS / BREADCRUMBS_PER_BLOCK);

    assert!(can_publish, "Should be able to publish with {} breadcrumbs", breadcrumb_count);
    assert_eq!(epoch_count, 2, "Should have 2 complete epochs");
    assert_eq!(block_count, 10, "Each epoch should have 10 blocks");
}
