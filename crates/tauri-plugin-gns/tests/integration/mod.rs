//! Integration Tests Module
//!
//! This module contains end-to-end integration tests for the GNS plugin.
//!
//! Test categories:
//! - `crypto_flow`: Cryptographic operations (signing, encryption, key exchange)
//! - `storage_flow`: Database operations (identity CRUD, messages, caching)
//! - `messaging_flow`: End-to-end encrypted messaging (Alice → Bob)
//! - `trajectory_flow`: Proof-of-Trajectory system (breadcrumbs, epochs)
//!
//! Run tests:
//! ```bash
//! cargo test --test integration
//! ```

mod crypto_flow;
mod storage_flow;
mod messaging_flow;

// Feature-gated test modules
#[cfg(feature = "trajectory")]
mod trajectory_flow;
