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
                let identity = futures::executor::block_on(state.identity.lock());
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
                let (tx, mut rx) = tokio::sync::mpsc::channel(100);
                
                // Configure relay with incoming channel
                {
                    let mut relay_guard = futures::executor::block_on(state.relay.lock());
                    *relay_guard = relay_guard.clone_with_incoming_channel(tx);
                }

                // Spawn task to handle incoming messages
                let app_handle = app.handle().clone();
                let state_clone = state.clone(); // Clone AppState, which is Arc-wrapped
                
                tauri::async_runtime::spawn(async move {
                    while let Some(msg) = rx.recv().await {
                        match msg {
                            crate::network::IncomingMessage::Envelope(envelope) => {
                                tracing::info!("📩 Received envelope {} from {}", envelope.id, &envelope.from_public_key[..8]);
                                
                                // Process envelope (verify, decrypt, save)
                                let result = process_incoming_envelope(&state_clone, &envelope).await;
                                
                                match result {
                                    Ok(saved_msg) => {
                                        tracing::info!("✅ Message processed and saved: {}", saved_msg.id);
                                        // Emit event to frontend
                                        if let Err(e) = app_handle.emit("new_message", &saved_msg) {
                                            tracing::error!("❌ Failed to emit new_message event: {}", e);
                                        } else {
                                            tracing::info!("📡 Emitted new_message event for {}", saved_msg.id);
                                        }
                                    }
                                    Err(e) => {
                                        tracing::error!("❌ Failed to process envelope {}: {}", envelope.id, e);
                                    }
                                }
                            }
                            msg => {
                                tracing::debug!("Received other message type: {:?}", msg);
                            }
                        }
                    }
                });

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
            // Handle commands
            commands::commands_handle::create_identity_with_handle,
            commands::commands_handle::check_handle_available,
            commands::commands_handle::claim_handle,
            commands::messaging::resolve_handle,
            // Messaging commands
            commands::messaging::send_message,
            commands::messaging::get_threads,
            commands::messaging::get_messages,
            commands::messaging::mark_thread_read,
            commands::messaging::delete_thread,
            // Breadcrumb commands
            commands::breadcrumbs::get_breadcrumb_count,
            commands::breadcrumbs::get_breadcrumb_status,
            commands::breadcrumbs::set_collection_enabled,
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
        ])
        .run(tauri::generate_context!())
        .expect("Error while running GNS Browser");
}

/// Initialize application state
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

/// Process incoming envelope
async fn process_incoming_envelope(
    state: &AppState,
    envelope: &gns_crypto_core::GnsEnvelope,
) -> Result<commands::messaging::Message, String> {
    // 1. Get our identity
    let identity_mgr = state.identity.lock().await;
    let identity = identity_mgr
        .get_identity()
        .ok_or("No identity configured")?;

    // 2. Open envelope (verify signature + decrypt)
    let opened = gns_crypto_core::open_envelope(&identity, envelope)
        .map_err(|e| format!("Failed to open envelope: {}", e))?;

    // 3. Parse payload
    let payload: serde_json::Value = serde_json::from_slice(&opened.payload)
        .unwrap_or_else(|_| serde_json::json!({"text": String::from_utf8_lossy(&opened.payload).to_string()}));

    // 4. Determine thread ID (same logic as send_message)
    let thread_id = envelope.thread_id.clone().unwrap_or_else(|| {
        format!("direct_{}", &envelope.from_public_key[..32.min(envelope.from_public_key.len())])
    });

    // 5. Save to database
    let mut db = state.database.lock().await;
    
    // ✅ CRITICAL: Pass from_handle to save_received_message
    db.save_received_message(
        &envelope.id,
        &thread_id,
        &envelope.from_public_key,
        envelope.from_handle.as_deref(), // Pass the handle!
        &envelope.payload_type,
        &payload,
        envelope.timestamp,
        opened.signature_valid,
        envelope.reply_to_id.clone(),
    ).map_err(|e| format!("Database error: {}", e))?;

    Ok(commands::messaging::Message {
        id: envelope.id.clone(),
        thread_id,
        from_public_key: envelope.from_public_key.clone(),
        from_handle: envelope.from_handle.clone(),
        payload_type: envelope.payload_type.clone(),
        payload,
        timestamp: envelope.timestamp,
        is_outgoing: false,
        status: "received".to_string(),
        reply_to_id: envelope.reply_to_id.clone(),
        is_starred: false,
        forwarded_from_id: None, // Forwarding info not yet in standard envelope metadata
        reactions: vec![],
    })
}
