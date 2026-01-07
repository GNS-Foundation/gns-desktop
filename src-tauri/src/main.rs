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
mod stellar;
mod storage;
mod dix;
mod message_handler; // Added

use std::sync::Arc;
use tauri::{Emitter, Manager};
use tokio::sync::Mutex;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::crypto::IdentityManager;
use crate::dix::DixService;
#[cfg(any(target_os = "ios", target_os = "android"))]
use crate::location::BreadcrumbCollector;
use crate::network::{ApiClient, RelayConnection};
use crate::stellar::StellarService;
use crate::storage::Database;

/// Application state shared across all commands
#[derive(Clone)]
pub struct AppState {
    /// Identity manager (keychain access)
    pub identity: Arc<Mutex<IdentityManager>>,

    /// Local database
    pub database: Arc<Mutex<Database>>,

    /// API client for GNS backend
    pub api: Arc<ApiClient>,

    /// WebSocket relay connection
    pub relay: Arc<Mutex<RelayConnection>>,

    /// Stellar network service
    pub stellar: Arc<Mutex<StellarService>>,

    /// Dix service
    pub dix: Arc<DixService>,

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
            
            // Get public key for WebSocket auth (if identity exists)
            let public_key = {
                let identity = state.identity.try_lock().expect("Failed to lock identity");
                identity.public_key_hex()
            };
            
            // Clone relay for the async connect task
            let relay = state.relay.clone();
            
            app.manage(state.clone());

            // Setup deep link handler
            setup_deep_links(app.handle().clone());

            // Connect to WebSocket relay if we have an identity
            if let Some(pk) = public_key {
                // Create channel for incoming messages
                let (tx, rx) = tokio::sync::mpsc::channel(100);
                
                // Configure relay with incoming channel
                {
                    let mut relay_guard = state.relay.try_lock().expect("Failed to lock relay");
                    *relay_guard = relay_guard.clone_with_incoming_channel(tx);
                }

                // Spawn message handler
                let app_handle = app.handle().clone();
                let identity = state.identity.clone();
                let database = state.database.clone();
                
                message_handler::start_message_handler(
                    app_handle,
                    identity,
                    database,
                    rx
                );

                // Connect to relay
                let relay_clone = state.relay.clone();
                tauri::async_runtime::spawn(async move {
                    let relay_guard = relay_clone.lock().await;
                    if let Err(e) = relay_guard.connect(&pk).await {
                        tracing::error!("Failed to connect to relay: {}", e);
                    } else {
                        tracing::info!("Connected to WebSocket relay");
                    }
                });
            }

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
            commands::identity::delete_identity,
            commands::identity::sign_string,
            // Handle commands
            commands::commands_handle::create_identity_with_handle,
            commands::commands_handle::check_handle_available,
            commands::commands_handle::claim_handle,
            commands::commands_handle::publish_identity,
            // Messaging commands
            commands::messaging::send_message,
            commands::messaging::get_threads,
            commands::messaging::get_thread,
            commands::messaging::get_messages,
            commands::messaging::mark_thread_read,
            commands::messaging::delete_thread,
            commands::messaging::delete_message,
            commands::messaging::add_reaction,
            commands::messaging::save_sent_email_message,
            commands::messaging::resolve_handle,
            // Breadcrumb commands
            commands::breadcrumbs::get_breadcrumb_count,
            commands::breadcrumbs::get_breadcrumb_status,
            commands::breadcrumbs::set_collection_enabled,
            commands::breadcrumbs::drop_breadcrumb,
            commands::breadcrumbs::list_breadcrumbs,
            commands::breadcrumbs::restore_breadcrumbs,
            // Network commands
            commands::network::get_connection_status,
            commands::network::reconnect,
            // Stellar/GNS Token commands
            commands::stellar::get_stellar_address,
            commands::stellar::get_stellar_explorer_url,
            commands::stellar::get_stellar_balances,
            commands::stellar::claim_gns_tokens,
            commands::stellar::create_gns_trustline,
            commands::stellar::send_gns,
            commands::stellar::fund_testnet_account,
            commands::stellar::get_payment_history,
            // Utility commands
            commands::utils::get_app_version,
            commands::utils::open_external_url,
            commands::utils::get_offline_status,
            // Dix commands
            commands::dix::create_post,
            commands::dix::get_timeline,
            commands::dix::like_post,
            commands::dix::repost_post,
            commands::dix::get_post,
            commands::dix::get_posts_by_user,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running GNS Browser");
}

/// Initialize application state
fn setup_app_state() -> Result<AppState, Box<dyn std::error::Error>> {
    // Open database
    let database = Arc::new(Mutex::new(Database::open()?));

    // Initialize identity manager
    let identity = Arc::new(Mutex::new(IdentityManager::new()?));

    // Initialize API client
    let api = Arc::new(ApiClient::new("https://gns-browser-production.up.railway.app")?);

    // Initialize relay connection
    let relay = Arc::new(Mutex::new(RelayConnection::new("wss://gns-browser-production.up.railway.app")?));

    // Initialize Stellar service
    let stellar = Arc::new(Mutex::new(StellarService::mainnet()));

    // Initialize Dix service
    let dix = Arc::new(DixService::new(identity.clone(), api.clone()));

    // Initialize breadcrumb collector (mobile only)
    #[cfg(any(target_os = "ios", target_os = "android"))]
    let breadcrumb_collector = Arc::new(Mutex::new(BreadcrumbCollector::new()));

    Ok(AppState {
        identity,
        database,
        api,
        relay,
        stellar,
        dix,
        #[cfg(any(target_os = "ios", target_os = "android"))]
        breadcrumb_collector,
    })
}

/// Setup deep link handler for gns:// URLs
fn setup_deep_links(_app_handle: tauri::AppHandle) {
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

/// Handle incoming deep links (Unused in main but kept for reference)
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
