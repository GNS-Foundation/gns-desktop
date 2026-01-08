//! GNS Browser - Shared Library for Desktop and Mobile

use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

// Re-export modules
pub mod commands;
pub mod crypto;
pub mod location;
pub mod message_handler;
pub mod network;
pub mod stellar;
pub mod storage;
pub mod dix;

use crate::crypto::IdentityManager;
use crate::network::{ApiClient, RelayConnection};
use crate::stellar::StellarService;
use crate::storage::Database;
use crate::dix::DixService;

#[cfg(any(target_os = "ios", target_os = "android"))]
use crate::location::BreadcrumbCollector;

/// Application state shared across all commands
pub struct AppState {
    pub identity: Arc<Mutex<IdentityManager>>,
    pub database: Arc<Mutex<Database>>,
    pub api: Arc<ApiClient>,
    pub relay: Arc<Mutex<RelayConnection>>,
    pub stellar: Arc<Mutex<StellarService>>,
    pub dix: Arc<DixService>,
    #[cfg(any(target_os = "ios", target_os = "android"))]
    pub breadcrumb_collector: Arc<Mutex<BreadcrumbCollector>>,
}

/// Initialize application state
fn setup_app_state() -> Result<AppState, Box<dyn std::error::Error>> {
    let database = Arc::new(Mutex::new(Database::open()?));
    let identity = Arc::new(Mutex::new(IdentityManager::new()?));
    let api = Arc::new(ApiClient::new("https://gns-browser-production.up.railway.app")?);
    let relay = Arc::new(Mutex::new(RelayConnection::new("wss://gns-browser-production.up.railway.app")?));
    let stellar = Arc::new(Mutex::new(StellarService::mainnet()));

    let dix = Arc::new(DixService::new(identity.clone(), api.clone()));

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

/// Setup deep link handler
fn setup_deep_links(_app_handle: tauri::AppHandle) {
    #[cfg(any(target_os = "ios", target_os = "android"))]
    {
        tracing::info!("Deep link handler registered for mobile");
    }

    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    {
        tracing::info!("Deep link handler registered for desktop");
    }
}

// Mobile entry point
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    println!("🔥 [RUST] GNS Browser run() called");
    // Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "gns_browser=debug,tauri=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::error!("🔥 [RUST] Tracing initialized");
    tracing::info!("Starting GNS Browser...");

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init());

    // Add geolocation plugin for mobile platforms
    #[cfg(any(target_os = "ios", target_os = "android"))]
    let builder = builder.plugin(tauri_plugin_geolocation::init());

    builder
        .setup(|app| {
            tracing::error!("🔥 [RUST] Setup block entered");
            tracing::info!("Setting up application...");

            let state = setup_app_state()?;
            
            let public_key = {
                let identity = state.identity.try_lock().expect("Failed to lock identity");
                identity.public_key_hex()
            };
            
            if let Some(ref pk) = public_key {
                tracing::error!("🔥 [RUST] Public Key found: {}", pk);
            } else {
                tracing::error!("🔥 [RUST] NO PUBLIC KEY FOUND - Message handler will NOT start");
            }

            let encryption_key = {
                let identity = state.identity.try_lock().expect("Failed to lock identity");
                identity.encryption_key_hex()
            };

            if let Some(ref pk) = public_key {
                tracing::info!("Public key: {}", pk);
            }
            if let Some(ref ek) = encryption_key {
                tracing::info!("Encryption key: {}", ek);
            }

            let relay = state.relay.clone();
            
            // Clone Arc references for auto-start before moving state
            #[cfg(any(target_os = "ios", target_os = "android"))]
            let (db_clone, collector_clone) = {
                (state.database.clone(), state.breadcrumb_collector.clone())
            };

            let identity_for_handler = state.identity.clone();
            let database_for_handler = state.database.clone();

            app.manage(state);

            setup_deep_links(app.handle().clone());

            if let Some(pk) = public_key {
                let app_handle = app.handle().clone();
                
                tauri::async_runtime::spawn(async move {
                    // Create channel for incoming messages
                    let (incoming_tx, incoming_rx) = tokio::sync::mpsc::channel::<crate::network::IncomingMessage>(32);
                    
                    // Start message handler
                    crate::message_handler::start_message_handler(
                        app_handle,
                        identity_for_handler,
                        database_for_handler,
                        relay.clone(),
                        incoming_rx
                    );

                    // Create relay instance with channel attached
                    let relay_instance = {
                        let guard = relay.lock().await;
                        guard.clone_with_incoming_channel(incoming_tx)
                    };
                    
                    // Connect using the instance that has the channel
                    if let Err(e) = relay_instance.connect(&pk).await {
                        tracing::error!("Failed to connect to relay: {}", e);
                    } else {
                        tracing::info!("Connected to WebSocket relay");
                    }
                });
            }

            // Auto-start breadcrumb collection if it was previously enabled
            #[cfg(any(target_os = "ios", target_os = "android"))]
            {
                tauri::async_runtime::spawn(async move {
                    let db = db_clone.lock().await;
                    let should_collect = db.get_collection_enabled();
                    drop(db);
                    
                    if should_collect {
                        let mut collector = collector_clone.lock().await;
                        if let Err(e) = collector.start() {
                            tracing::error!("Failed to auto-start breadcrumb collection: {}", e);
                        } else {
                            tracing::info!("📍 Auto-started breadcrumb collection");
                        }
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
            commands::messaging::request_message_decryption,
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
