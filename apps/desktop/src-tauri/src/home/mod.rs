//! Home Service - GNS Home Hub Integration
//! 
//! Handles discovery and communication with GNS Home Hubs (IoT Gateways).

use crate::crypto::{IdentityManager};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use mdns_sd::{ServiceDaemon, ServiceEvent};

// ===========================================
// MODELS
// ===========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HubInfo {
    pub name: String,
    #[serde(rename = "publicKey")]
    pub public_key: String,
    pub owner: Option<String>,
    #[serde(rename = "deviceCount")]
    pub device_count: usize,
    pub version: String,
    // Added for discovery context
    #[serde(default)]
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HomeDevice {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub device_type: String,
    pub brand: String,
    pub protocol: String,
    pub capabilities: Vec<String>,
    pub status: DeviceStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceStatus {
    pub online: bool,
    #[serde(rename = "lastSeen")]
    pub last_seen: String,
    pub state: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResult {
    pub success: bool,
    pub data: Option<serde_json::Value>,
    pub error: Option<String>,
}

// ===========================================
// SERVICE
// ===========================================

pub struct HomeService {
    identity: Arc<Mutex<IdentityManager>>,
}

impl HomeService {
    pub fn new(identity: Arc<Mutex<IdentityManager>>) -> Self {
        Self { identity }
    }

    /// Discover GNS Home Hubs on the local network via mDNS
    pub async fn discover_hubs(&self, timeout_ms: u64) -> Result<Vec<HubInfo>, String> {
        let mdns = ServiceDaemon::new().map_err(|e| format!("Failed to create mDNS daemon: {}", e))?;
        let service_type = "_gns-home._tcp.local.";
        let receiver = mdns.browse(service_type).map_err(|e| format!("Failed to browse: {}", e))?;

        let mut hubs = Vec::new();
        let end_time = std::time::Instant::now() + std::time::Duration::from_millis(timeout_ms);

        while std::time::Instant::now() < end_time {
            // Non-blocking try_recv or similar? 
            // The receiver is blocking but we can use recv_timeout if implemented, 
            // or just simple loop with sleep and check.
            // mdns-sd receiver is a channel.
            
            // For now, we'll collect for `timeout_ms` duration.
            match receiver.recv_timeout(std::time::Duration::from_millis(100)) {
                Ok(event) => {
                    match event {
                        ServiceEvent::ServiceResolved(info) => {
                            let ip = info.get_addresses().iter().next();
                            let port = info.get_port();
                            
                            if let (Some(ip), Some(port)) = (ip, &port) {
                                let url = format!("http://{}:{}", ip, port);
                                
                                // Try to fetch hub info from the discovered URL
                                if let Ok(hub_info) = self.fetch_hub_info(&url).await {
                                     let mut final_info = hub_info;
                                     final_info.url = Some(url);
                                     hubs.push(final_info);
                                }
                            }
                        },
                        _ => {}
                    }
                },
                Err(_) => {
                    // Timeout on recv, continue loop
                }
            }
        }
        
        Ok(hubs)
    }

    /// Fetch Info from a Hub URL
    pub async fn fetch_hub_info(&self, base_url: &str) -> Result<HubInfo, String> {
        let url = format!("{}/api/hub", base_url);
        let client = reqwest::Client::new();
        
        let res = client.get(&url)
            .timeout(std::time::Duration::from_secs(2))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let wrapper: ApiResponse<HubInfo> = res.json().await.map_err(|e| e.to_string())?;
        
        if !wrapper.success {
            return Err("Failed to get hub info".into());
        }
        
        Ok(wrapper.data.ok_or("No data returned")?)
    }
    
    /// Get Devices
    pub async fn get_devices(&self, base_url: &str) -> Result<Vec<HomeDevice>, String> {
        let identity = self.identity.lock().await;
        let public_key = identity.public_key_hex().ok_or("No identity")?;
        drop(identity);

        let url = format!("{}/api/devices", base_url);
        let client = reqwest::Client::new();
        
        let res = client.get(&url)
            .header("X-GNS-PublicKey", public_key)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let wrapper: ApiResponse<Vec<HomeDevice>> = res.json().await.map_err(|e| e.to_string())?;
        
        if !wrapper.success {
             return Err("Failed to get devices".into());
        }
        
        Ok(wrapper.data.ok_or("No data returned")?)
    }

    /// Execute Command
    pub async fn execute_command(&self, base_url: &str, device_id: &str, action: &str, value: Option<serde_json::Value>) -> Result<CommandResult, String> {
        let identity = self.identity.lock().await;
        let public_key = identity.public_key_hex().ok_or("No identity")?;
        // In real impl, we should sign the command here too
        drop(identity);

        let url = format!("{}/api/command", base_url);
        let client = reqwest::Client::new();
        
        let payload = serde_json::json!({
            "device": device_id,
            "action": action,
            "value": value
        });

        let res = client.post(&url)
            .header("X-GNS-PublicKey", public_key)
            .json(&payload)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let wrapper: ApiResponse<serde_json::Value> = res.json().await.map_err(|e| e.to_string())?;
        
        // The endpoint returns success: true/false in the wrapper wrapper?
        // Wait, HomeService.dart says:
        /*
          final json = jsonDecode(response.body);
          final result = CommandResult.fromJson(json);
        */
        // CommandResult has success, data, error.
        
        Ok(CommandResult {
            success: wrapper.success,
            data: wrapper.data,
            error: wrapper.error,
        })
    }
}

// Helper wrapper for standardize API responses
#[derive(Deserialize)]
struct ApiResponse<T> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}
