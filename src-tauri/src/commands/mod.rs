//! IPC Command Handlers
//!
//! This module contains all Tauri commands that are exposed to the WebView.
//! Commands are organized by functionality:
//! - identity: Key management and identity operations
//! - messaging: Sending and receiving messages
//! - handles: Handle resolution and claiming
//! - breadcrumbs: Location proof collection
//! - network: Connection management
//! - utils: Miscellaneous utilities

pub mod identity;
pub mod messaging;
pub mod handles;
pub mod breadcrumbs;
pub mod network;
pub mod utils;
