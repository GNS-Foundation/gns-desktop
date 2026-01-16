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
                .unwrap_or_else(|_| "gns_browser=debug,tauri=info,tauri_plugin_gns=debug".into()),
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
        .plugin(tauri_plugin_dialog::init())
        // Initialize the GNS plugin
        .plugin(tauri_plugin_gns::init());

    // Add geolocation plugin for mobile platforms
    #[cfg(any(target_os = "ios", target_os = "android"))]
    let builder = builder.plugin(tauri_plugin_geolocation::init());

    builder
        .setup(|app| {
            tracing::error!("🔥 [RUST] Setup block entered");
            tracing::info!("Setting up application...");

            let state = setup_app_state()?;
            
            // ... (keep existing setup logic for app-specific state like Stellar)
            
            let public_key = {
                let identity = state.identity.try_lock().expect("Failed to lock identity");
                identity.public_key_hex()
            };
            
            if let Some(ref pk) = public_key {
                tracing::info!("Public Key found: {}", pk);
            }

            // Bind app state for remaining custom commands
            app.manage(state);

            setup_deep_links(app.handle().clone());

            tracing::info!("Application setup complete");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Network commands (App specific)
            commands::network::get_connection_status,
            commands::network::reconnect,
            // Stellar/GNS Token commands (App specific)
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
            // Dix commands (App specific extension)
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
