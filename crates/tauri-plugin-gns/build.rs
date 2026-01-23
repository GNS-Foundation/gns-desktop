// GNS Protocol Plugin - Build Script
// Generates permission schema files for the Tauri capability system

const COMMANDS: &[&str] = &[
    // Identity commands
    "create_identity",
    "load_identity",
    "get_identity",
    "list_identities",
    "delete_identity",
    "export_identity",
    "import_identity",
    "get_public_key",
    "sign_message",
    "verify_signature",
    "set_default_identity",
    // Messaging commands
    "send_message",
    "get_messages",
    "get_message",
    "decrypt_message",
    "mark_as_read",
    "delete_message",
    "get_conversations",
    // Resolution commands
    "resolve_handle",
    "resolve_identity",
    "is_handle_available",
    "claim_handle",
    "release_handle",
    "get_record",
    "update_record",
    // Trust commands
    "get_trust_score",
    "get_trust_details",
    "verify_identity",
    // Trajectory commands (feature-gated)
    "start_collection",
    "stop_collection",
    "get_breadcrumbs",
    "get_breadcrumb_count",
    "publish_epoch",
    "get_epochs",
    "add_breadcrumb",
    "verify_chain",
    "get_trajectory_stats",
    "export_trajectory",
    "import_trajectory",
    "get_collection_status",
];

fn main() {
    // Use Tauri's build script helper if available
    // Use Tauri's build script helper
    tauri_plugin::Builder::new(COMMANDS)
        .global_api_script_path("./guest-js/dist/index.js")
        .build();

    // Always generate schema for permissions
    println!("cargo:rerun-if-changed=permissions/");
    println!("cargo:rerun-if-changed=build.rs");
    
    // Output information about enabled features
    #[cfg(feature = "trajectory")]
    println!("cargo:rustc-cfg=has_trajectory");
    
    #[cfg(feature = "biometric")]
    println!("cargo:rustc-cfg=has_biometric");
    
    #[cfg(feature = "payments")]
    println!("cargo:rustc-cfg=has_payments");
    
    #[cfg(feature = "dix")]
    println!("cargo:rustc-cfg=has_dix");
}
