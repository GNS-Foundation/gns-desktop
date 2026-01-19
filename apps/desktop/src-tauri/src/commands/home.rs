use crate::AppState;
use crate::home::{HubInfo, HomeDevice, CommandResult};
use tauri::State;

#[tauri::command]
pub async fn discover_hubs(
    state: State<'_, AppState>,
    timeout_ms: u64
) -> Result<Vec<HubInfo>, String> {
    state.home.discover_hubs(timeout_ms).await
}

#[tauri::command]
pub async fn get_devices(
    state: State<'_, AppState>,
    hub_url: String
) -> Result<Vec<HomeDevice>, String> {
    state.home.get_devices(&hub_url).await
}

#[tauri::command]
pub async fn execute_command(
    state: State<'_, AppState>,
    hub_url: String,
    device_id: String,
    action: String,
    value: Option<serde_json::Value>
) -> Result<CommandResult, String> {
    state.home.execute_command(&hub_url, &device_id, &action, value).await
}
