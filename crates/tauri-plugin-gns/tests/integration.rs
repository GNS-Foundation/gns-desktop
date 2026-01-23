//! Integration Test Runner
//!
//! This file serves as the entry point for all integration tests.
//!
//! Run all tests:
//! ```bash
//! cargo test --test integration
//! ```
//!
//! Run specific test module:
//! ```bash
//! cargo test --test integration crypto_flow
//! cargo test --test integration storage_flow
//! ```
//!
//! Run with features:
//! ```bash
//! cargo test --test integration --features trajectory
//! ```

mod integration;

// Re-export test modules so they're discoverable
pub use integration::*;
