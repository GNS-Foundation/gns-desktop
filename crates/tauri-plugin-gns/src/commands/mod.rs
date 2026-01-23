//! Tauri Commands
//!
//! All commands exposed to the frontend via Tauri IPC.
//!
//! Commands are organized into modules by functionality:
//!
//! - **identity**: Key generation, signing, verification
//! - **messaging**: E2E encrypted messaging
//! - **resolver**: Handle resolution and registration
//! - **trust**: Trust score calculation and verification
//! - **trajectory**: Breadcrumb collection and epoch publishing (feature-gated)

pub mod identity;
pub mod messaging;
pub mod resolver;
pub mod trust;

#[cfg(feature = "trajectory")]
pub mod trajectory;
