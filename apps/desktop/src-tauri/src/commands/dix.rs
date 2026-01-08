use crate::AppState;
use crate::dix::{DixPost, DixPostData, DixUserData, DixMedia};
use tauri::State;

#[tauri::command]
pub async fn create_post(
    state: State<'_, AppState>,
    text: String,
    media: Vec<DixMedia>,
    reply_to_id: Option<String>,
) -> Result<DixPost, String> {
    state.dix.create_post(text, media, reply_to_id).await
}

#[tauri::command]
pub async fn get_timeline(
    state: State<'_, AppState>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<Vec<DixPost>, String> {
    state.dix.get_timeline(limit.unwrap_or(20), offset.unwrap_or(0)).await
}

#[tauri::command]
pub async fn like_post(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let (pk, sig) = {
        let identity = state.identity.lock().await;
        // Using public_key_hex() as established in file reading
        let pk = identity.public_key_hex().ok_or("No identity")?;
        let sig = identity.sign_string(&id).ok_or("Failed to sign")?;
        (pk, sig)
    };
    state.dix.like_post(&id, &pk, &sig).await
}

#[tauri::command]
pub async fn repost_post(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let (pk, sig) = {
        let identity = state.identity.lock().await;
        // Using public_key_hex() as established in file reading
        let pk = identity.public_key_hex().ok_or("No identity")?;
        let sig = identity.sign_string(&id).ok_or("Failed to sign")?;
        (pk, sig)
    };
    state.dix.repost_post(&id, &pk, &sig).await
}

#[tauri::command]
pub async fn get_post(
    state: State<'_, AppState>,
    id: String,
) -> Result<DixPostData, String> {
    state.dix.get_post(&id).await
}

#[tauri::command]
pub async fn get_posts_by_user(
    state: State<'_, AppState>,
    public_key: String,
) -> Result<DixUserData, String> {
    state.dix.get_posts_by_user(&public_key).await
}
