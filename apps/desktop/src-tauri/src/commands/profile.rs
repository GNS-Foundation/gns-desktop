//! Profile Commands
//!
//! Commands for managing the user's profile data (name, bio, avatar, etc.)

use crate::AppState;
use crate::storage::Profile;
use tauri::State;

/// Profile data structure for IPC
#[derive(serde::Serialize, serde::Deserialize)]
pub struct ProfileData {
    pub display_name: Option<String>,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    pub links: Vec<ProfileLink>,
    pub location_public: bool,
    pub location_resolution: i32,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ProfileLink {
    pub type_: String,
    pub url: String,
    pub icon: String,
}

/// Get the current user's profile
#[tauri::command]
pub async fn get_profile(state: State<'_, AppState>) -> Result<Option<ProfileData>, String> {
    let identity = state.identity.lock().await;
    let public_key = identity.public_key_hex().ok_or("No identity found")?;
    drop(identity); // Release lock

    let db = state.database.lock().await;
    let valid_profile = db.get_profile(&public_key).map_err(|e| e.to_string())?;

    if let Some(p) = valid_profile {
        // Parse links JSON
        let links: Vec<ProfileLink> = if let Some(json) = p.links {
            serde_json::from_str(&json).unwrap_or_default()
        } else {
            Vec::new()
        };

        Ok(Some(ProfileData {
            display_name: p.display_name,
            bio: p.bio,
            avatar_url: p.avatar_url,
            links,
            location_public: p.location_public,
            location_resolution: p.location_resolution,
        }))
    } else {
        Ok(None)
    }
}

/// Update the current user's profile
#[tauri::command]
pub async fn update_profile(
    profile_data: ProfileData,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let identity = state.identity.lock().await;
    let public_key = identity.public_key_hex().ok_or("No identity found")?;
    drop(identity);

    // Serialize links
    let links_json = serde_json::to_string(&profile_data.links).map_err(|e| e.to_string())?;

    let profile = Profile {
        public_key: public_key.clone(),
        display_name: profile_data.display_name,
        bio: profile_data.bio,
        avatar_url: profile_data.avatar_url,
        links: Some(links_json),
        location_public: profile_data.location_public,
        location_resolution: profile_data.location_resolution,
        updated_at: chrono::Utc::now().timestamp(),
    };

    let mut db = state.database.lock().await;
    db.upsert_profile(&profile).map_err(|e| e.to_string())?;

    Ok(())
}
