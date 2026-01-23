//! GNS Protocol Demo Application
//!
//! This example demonstrates the complete integration of tauri-plugin-gns
//! with a Tauri 2.0 application.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_gns::GnsBuilder;

fn main() {
    // Initialize logging for development
    #[cfg(debug_assertions)]
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp_millis()
        .init();

    tauri::Builder::default()
        // Initialize the GNS plugin with default configuration
        .plugin(GnsBuilder::new().build())
        // You can also configure the plugin programmatically:
        // .plugin(
        //     GnsBuilder::new()
        //         .relay_url("https://api.gns.earth")
        //         .h3_resolution(7)
        //         .breadcrumb_interval(300)
        //         .min_breadcrumbs_for_handle(100)
        //         .min_breadcrumbs_for_epoch(100)
        //         .build()
        // )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
