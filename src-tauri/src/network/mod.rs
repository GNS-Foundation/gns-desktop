//! Network Module - API Client and WebSocket Relay
//!
//! Handles all network communication with the GNS backend.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use gns_crypto_core::{GnsEnvelope, Breadcrumb};

// ==================== API Client ====================

/// GNS API Client
pub struct ApiClient {
    client: Client,
    base_url: String,
}

impl ApiClient {
    /// Create a new API client
    pub fn new(base_url: &str) -> Result<Self, NetworkError> {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| NetworkError::ClientError(e.to_string()))?;
        
        Ok(Self {
            client,
            base_url: base_url.to_string(),
        })
    }
    
    /// Resolve a handle to identity info
    pub async fn resolve_handle(&self, handle: &str) -> Result<Option<IdentityInfo>, NetworkError> {
        let url = format!("{}/handles/{}", self.base_url, handle);
        
        let response = self.client.get(&url)
            .send()
            .await
            .map_err(|e| NetworkError::RequestError(e.to_string()))?;
        
        if response.status() == 404 {
            return Ok(None);
        }
        
        if !response.status().is_success() {
            return Err(NetworkError::ApiError(format!(
                "API returned status: {}",
                response.status()
            )));
        }
        
        let info: IdentityInfo = response.json().await
            .map_err(|e| NetworkError::ParseError(e.to_string()))?;
        
        Ok(Some(info))
    }
    
    /// Get identity info by public key
    pub async fn get_identity(&self, public_key: &str) -> Result<Option<IdentityInfo>, NetworkError> {
        let url = format!("{}/identities/{}", self.base_url, public_key);
        
        let response = self.client.get(&url)
            .send()
            .await
            .map_err(|e| NetworkError::RequestError(e.to_string()))?;
        
        if response.status() == 404 {
            return Ok(None);
        }
        
        if !response.status().is_success() {
            return Err(NetworkError::ApiError(format!(
                "API returned status: {}",
                response.status()
            )));
        }
        
        let info: IdentityInfo = response.json().await
            .map_err(|e| NetworkError::ParseError(e.to_string()))?;
        
        Ok(Some(info))
    }
    
    /// Get handle for a public key
    pub async fn get_handle_for_key(&self, public_key: &str) -> Result<Option<String>, NetworkError> {
        let info = self.get_identity(public_key).await?;
        Ok(info.and_then(|i| i.handle))
    }
    
    /// Claim a handle
    pub async fn claim_handle(
        &self,
        handle: &str,
        public_key: &str,
        encryption_key: &str,
        signature: &str,
        breadcrumbs: &[Breadcrumb],
    ) -> Result<ClaimResponse, NetworkError> {
        let url = format!("{}/handles/claim", self.base_url);
        
        let request = ClaimRequest {
            handle: handle.to_string(),
            public_key: public_key.to_string(),
            encryption_key: encryption_key.to_string(),
            signature: signature.to_string(),
            breadcrumbs: breadcrumbs.to_vec(),
        };
        
        let response = self.client.post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| NetworkError::RequestError(e.to_string()))?;
        
        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(NetworkError::ApiError(error_text));
        }
        
        let result: ClaimResponse = response.json().await
            .map_err(|e| NetworkError::ParseError(e.to_string()))?;
        
        Ok(result)
    }
}

// ==================== WebSocket Relay ====================

/// WebSocket relay connection
pub struct RelayConnection {
    url: String,
    connected: bool,
    last_message_time: Option<i64>,
    reconnect_attempts: u32,
}

impl RelayConnection {
    /// Create a new relay connection
    pub fn new(url: &str) -> Result<Self, NetworkError> {
        Ok(Self {
            url: url.to_string(),
            connected: false,
            last_message_time: None,
            reconnect_attempts: 0,
        })
    }
    
    /// Get the relay URL
    pub fn url(&self) -> &str {
        &self.url
    }
    
    /// Check if connected
    pub fn is_connected(&self) -> bool {
        self.connected
    }
    
    /// Get last message time
    pub fn last_message_time(&self) -> Option<i64> {
        self.last_message_time
    }
    
    /// Get reconnect attempts
    pub fn reconnect_attempts(&self) -> u32 {
        self.reconnect_attempts
    }
    
    /// Connect to the relay
    pub async fn connect(&mut self) -> Result<(), NetworkError> {
        // TODO: Implement WebSocket connection with tokio-tungstenite
        tracing::info!("Connecting to relay: {}", self.url);
        self.connected = true;
        self.reconnect_attempts = 0;
        Ok(())
    }
    
    /// Disconnect from the relay
    pub async fn disconnect(&mut self) -> Result<(), NetworkError> {
        tracing::info!("Disconnecting from relay");
        self.connected = false;
        Ok(())
    }
    
    /// Reconnect to the relay
    pub async fn reconnect(&mut self) -> Result<(), NetworkError> {
        self.reconnect_attempts += 1;
        self.disconnect().await?;
        self.connect().await
    }
    
    /// Send an envelope via the relay
    pub async fn send_envelope(&self, envelope: &GnsEnvelope) -> Result<(), NetworkError> {
        if !self.connected {
            return Err(NetworkError::NotConnected);
        }
        
        // TODO: Implement actual WebSocket send
        tracing::debug!("Sending envelope: {}", envelope.id);
        Ok(())
    }
}

// ==================== Types ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentityInfo {
    pub public_key: String,
    pub encryption_key: String,
    pub handle: Option<String>,
    pub avatar_url: Option<String>,
    pub display_name: Option<String>,
    pub is_verified: bool,
}

#[derive(Debug, Serialize)]
struct ClaimRequest {
    handle: String,
    public_key: String,
    encryption_key: String,
    signature: String,
    breadcrumbs: Vec<Breadcrumb>,
}

#[derive(Debug, Deserialize)]
pub struct ClaimResponse {
    pub success: bool,
    pub transaction_id: Option<String>,
    pub error: Option<String>,
}

// ==================== Errors ====================

#[derive(Debug, thiserror::Error)]
pub enum NetworkError {
    #[error("Client error: {0}")]
    ClientError(String),
    
    #[error("Request error: {0}")]
    RequestError(String),
    
    #[error("API error: {0}")]
    ApiError(String),
    
    #[error("Parse error: {0}")]
    ParseError(String),
    
    #[error("Not connected to relay")]
    NotConnected,
    
    #[error("WebSocket error: {0}")]
    WebSocketError(String),
}
