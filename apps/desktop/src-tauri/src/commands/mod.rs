//! IPC Command Handlers
//!
//! This module contains all Tauri commands that are exposed to the WebView.
//! Commands are organized by functionality:
//! - identity: Key management and identity operations
//! - commands_handle: Handle resolution and claiming
//! - messaging: Sending and receiving messages
//! - breadcrumbs: Location proof collection
//! - network: Connection management
//! - stellar: Stellar/GNS token operations
//! - utils: Miscellaneous utilities

pub mod identity;
pub mod commands_handle;
pub mod messaging;
pub mod breadcrumbs;
pub mod network;
pub mod stellar;
pub mod handles;
pub mod utils;
pub mod dix;
pub mod home;
pub mod profile;
