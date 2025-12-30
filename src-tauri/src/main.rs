//! GNS Browser - Tauri Application Entry Point
//!
//! This is the main entry point for the GNS Browser application.
//! It initializes the Tauri runtime, sets up state management,
//! and registers all IPC command handlers.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod crypto;
mod location;
mod network;
mod storage;

use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::crypto::IdentityManager;
use crate::location::BreadcrumbCollector;
use crate::network::{ApiClient, RelayConnection};
use crate::storage::Database;

/// Application state shared across all commands
pub struct AppState {
    /// Identity manager (keychain access)
    pub identity: Arc<Mutex<IdentityManager>>,

    /// Local database
    pub database: Arc<Mutex<Database>>,

    /// API client for GNS backend
    pub api: Arc<ApiClient>,

    /// WebSocket relay connection
    pub relay: Arc<Mutex<RelayConnection>>,

    /// Breadcrumb collector (mobile only)
    #[cfg(any(target_os = "ios", target_os = "android"))]
    pub breadcrumb_collector: Arc<Mutex<BreadcrumbCollector>>,
}

fn main() {
    // Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "gns_browser=debug,tauri=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting GNS Browser...");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            tracing::info!("Setting up application...");

            // Initialize state
            let state = setup_app_state()?;
            app.manage(state);

            // Setup deep link handler
            setup_deep_links(app.handle().clone());

            tracing::info!("Application setup complete");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Identity commands
            commands::identity::get_public_key,
            commands::identity::get_encryption_key,
            commands::identity::get_current_handle,
            commands::identity::has_identity,
            commands::identity::generate_identity,
            commands::identity::import_identity,
            commands::identity::export_identity_backup,
            // Messaging commands
            commands::messaging::send_message,
            commands::messaging::get_threads,
            commands::messaging::get_messages,
            commands::messaging::mark_thread_read,
            commands::messaging::delete_thread,
            // Handle commands
            commands::handles::resolve_handle,
            commands::handles::claim_handle,
            commands::handles::check_handle_available,
            // Breadcrumb commands
            commands::breadcrumbs::get_breadcrumb_count,
            commands::breadcrumbs::get_breadcrumb_status,
            commands::breadcrumbs::set_collection_enabled,
            // Network commands
            commands::network::get_connection_status,
            commands::network::reconnect,
            // Utility commands
            commands::utils::get_app_version,
            commands::utils::open_external_url,
            commands::utils::get_offline_status,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running GNS Browser");
}

/// Initialize application state
fn setup_app_state() -> Result<AppState, Box<dyn std::error::Error>> {
    // Open database
    let database = Database::open()?;

    // Initialize identity manager
    let identity = IdentityManager::new()?;

    // Initialize API client
    let api = ApiClient::new("https://api.gcrumbs.com")?;

    // Initialize relay connection
    let relay = RelayConnection::new("wss://relay.gcrumbs.com")?;

    // Initialize breadcrumb collector (mobile only)
    #[cfg(any(target_os = "ios", target_os = "android"))]
    let breadcrumb_collector = BreadcrumbCollector::new();

    Ok(AppState {
        identity: Arc::new(Mutex::new(identity)),
        database: Arc::new(Mutex::new(database)),
        api: Arc::new(api),
        relay: Arc::new(Mutex::new(relay)),
        #[cfg(any(target_os = "ios", target_os = "android"))]
        breadcrumb_collector: Arc::new(Mutex::new(breadcrumb_collector)),
    })
}

/// Setup deep link handler for gns:// URLs
fn setup_deep_links(app_handle: tauri::AppHandle) {
    // Listen for deep links
    #[cfg(any(target_os = "ios", target_os = "android"))]
    {
        // Mobile deep link handling
        tracing::info!("Deep link handler registered for mobile");
    }

    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    {
        // Desktop deep link handling would go here
        tracing::info!("Deep link handler registered for desktop");
    }
}

/// Handle incoming deep links
#[allow(dead_code)]
fn handle_deep_link(app_handle: &tauri::AppHandle, url: &str) {
    tracing::info!("Received deep link: {}", url);

    // Parse the URL
    if let Some(handle) = url.strip_prefix("gns://") {
        // Navigate to handle
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.emit("navigate", handle);
        }
    } else if let Some(handle) = url.strip_prefix("gns-migrate:") {
        // Migration token
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.emit("migration_token", handle);
        }
    }
}
