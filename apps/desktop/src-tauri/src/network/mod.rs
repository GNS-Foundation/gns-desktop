//! Network Module - API Client and WebSocket Relay
//!
//! Handles all network communication with the GNS backend.
//! 
//! Updated: Added handle reservation, claiming, and record publishing

use gns_crypto_core::{Breadcrumb, GnsEnvelope};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::{connect_async, tungstenite::Message};

// ==================== API Client ====================

pub struct ApiClient {
    client: Client,
    base_url: String,
}

impl ApiClient {
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

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    pub fn client(&self) -> &Client {
        &self.client
    }

    // ==================== Identity/Handle Resolution ====================

    pub async fn resolve_handle(&self, handle: &str) -> Result<Option<IdentityInfo>, NetworkError> {
        let clean_handle = handle.trim_start_matches('@').to_lowercase();
        let url = format!("{}/handles/{}", self.base_url, clean_handle);

        let response = self.client.get(&url).send().await
            .map_err(|e| NetworkError::RequestError(e.to_string()))?;

        if response.status() == 404 {
            return Ok(None);
        }

        if !response.status().is_success() {
            return Err(NetworkError::ApiError(format!("API returned status: {}", response.status())));
        }

        let data: serde_json::Value = response.json().await
            .map_err(|e| NetworkError::ParseError(e.to_string()))?;

        Ok(Some(IdentityInfo {
            public_key: data["data"]["public_key"].as_str().unwrap_or_default().to_string(),
            encryption_key: data["data"]["encryption_key"].as_str().unwrap_or_default().to_string(),
            handle: data["data"]["handle"].as_str().map(|s| s.to_string()),
            avatar_url: data["data"]["avatar_url"].as_str().map(|s| s.to_string()),
            display_name: data["data"]["display_name"].as_str().map(|s| s.to_string()),
            is_verified: data["data"]["is_verified"].as_bool().unwrap_or(false),
        }))
    }

    pub async fn get_handle_for_key(&self, public_key: &str) -> Result<Option<String>, NetworkError> {
        let url = format!("{}/identities/{}", self.base_url, public_key);

        let response = self.client.get(&url).send().await
            .map_err(|e| NetworkError::RequestError(e.to_string()))?;

        if response.status() == 404 {
            return Ok(None);
        }

        if !response.status().is_success() {
            return Err(NetworkError::ApiError(format!("API returned status: {}", response.status())));
        }

        let data: serde_json::Value = response.json().await
            .map_err(|e| NetworkError::ParseError(e.to_string()))?;

        Ok(data["data"]["handle"].as_str().map(|s| s.to_string()))
    }

    pub async fn get_identity(&self, public_key: &str) -> Result<Option<IdentityInfo>, NetworkError> {
        let url = format!("{}/identities/{}", self.base_url, public_key);

        let response = self.client.get(&url).send().await
            .map_err(|e| NetworkError::RequestError(e.to_string()))?;

        if response.status() == 404 {
            return Ok(None);
        }

        if !response.status().is_success() {
            return Err(NetworkError::ApiError(format!("API returned status: {}", response.status())));
        }

        let data: serde_json::Value = response.json().await
            .map_err(|e| NetworkError::ParseError(e.to_string()))?;

        Ok(Some(IdentityInfo {
            public_key: data["data"]["public_key"].as_str().unwrap_or(public_key).to_string(),
            encryption_key: data["data"]["encryption_key"].as_str().unwrap_or_default().to_string(),
            handle: data["data"]["handle"].as_str().map(|s| s.to_string()),
            avatar_url: data["data"]["avatar_url"].as_str().map(|s| s.to_string()),
            display_name: data["data"]["display_name"].as_str().map(|s| s.to_string()),
            is_verified: data["data"]["is_verified"].as_bool().unwrap_or(false),
        }))
    }

    // ==================== Handle Availability & Reservation ====================

    /// Check if a handle is available
    /// GET /aliases?check={handle}
    pub async fn check_handle_available(&self, handle: &str) -> Result<HandleCheckResult, NetworkError> {
        let clean_handle = handle.trim_start_matches('@').to_lowercase();
        let url = format!("{}/aliases?check={}", self.base_url, clean_handle);

        tracing::debug!("Checking handle availability: {}", clean_handle);

        let response = self.client.get(&url).send().await
            .map_err(|e| NetworkError::RequestError(e.to_string()))?;

        let data: serde_json::Value = response.json().await
            .map_err(|e| NetworkError::ParseError(e.to_string()))?;

        // Handle both old format (data.available) and new format (available)
        let available = data["data"]["available"].as_bool()
            .or_else(|| data["available"].as_bool())
            .unwrap_or(false);
        
        let reason = if !available {
            data["data"]["reason"].as_str()
                .or_else(|| data["reason"].as_str())
                .map(|s| s.to_string())
        } else {
            None
        };

        Ok(HandleCheckResult {
            handle: clean_handle,
            available,
            reason,
        })
    }

    /// Reserve a handle (before collecting breadcrumbs)
    /// POST /aliases/{handle}/reserve
    pub async fn reserve_handle(
        &self,
        handle: &str,
        public_key: &str,
        encryption_key: &str,
        signature: &str,
        timestamp: &str,
    ) -> Result<HandleReservationResult, NetworkError> {
        let clean_handle = handle.trim_start_matches('@').to_lowercase();
        let url = format!("{}/aliases/{}/reserve", self.base_url, clean_handle);

        tracing::info!("Reserving handle @{} for {}...", clean_handle, &public_key[..16]);

        let request_body = json!({
            "identity": public_key,
            "encryption_key": encryption_key,
            "signature": signature,
            "timestamp": timestamp,
        });

        let response = self.client.post(&url)
            .json(&request_body)
            .send()
            .await
            .map_err(|e| NetworkError::RequestError(e.to_string()))?;

        let status = response.status();
        let data: serde_json::Value = response.json().await
            .map_err(|e| NetworkError::ParseError(e.to_string()))?;

        if status.is_success() && data["success"].as_bool().unwrap_or(false) {
            tracing::info!("✅ Handle @{} reserved successfully!", clean_handle);
            Ok(HandleReservationResult {
                success: true,
                handle: clean_handle.clone(),
                network_reserved: true,
                expires_at: data["data"]["expires_at"].as_str().map(|s| s.to_string()),
                message: Some(format!("@{} reserved! Collect 100 breadcrumbs to claim.", clean_handle)),
                error: None,
            })
        } else {
            let error_msg = data["error"].as_str()
                .or_else(|| data["message"].as_str())
                .unwrap_or("Unknown error")
                .to_string();

            tracing::warn!("❌ Handle reservation failed: {}", error_msg);
            Ok(HandleReservationResult {
                success: false,
                handle: clean_handle,
                network_reserved: false,
                expires_at: None,
                message: None,
                error: Some(error_msg),
            })
        }
    }

    // ==================== Handle Claiming ====================

    /// Claim a reserved handle (after collecting 100 breadcrumbs)
    /// PUT /aliases/{handle}
    pub async fn claim_handle_with_proof(
        &self,
        handle: &str,
        public_key: &str,
        proof: &ClaimProof,
        signature: &str,
    ) -> Result<HandleClaimResult, NetworkError> {
        let clean_handle = handle.trim_start_matches('@').to_lowercase();
        let url = format!("{}/aliases/{}", self.base_url, clean_handle);

        tracing::info!("Claiming handle @{} with {} breadcrumbs", clean_handle, proof.breadcrumb_count);

        let request_body = json!({
            "handle": clean_handle,
            "identity": public_key,
            "proof": {
                "breadcrumb_count": proof.breadcrumb_count,
                "first_breadcrumb_at": proof.first_breadcrumb_at,
                "trust_score": proof.trust_score,
            },
            "claimed_at": chrono::Utc::now().to_rfc3339(),
            "signature": signature,
        });

        let response = self.client.put(&url)
            .json(&request_body)
            .send()
            .await
            .map_err(|e| NetworkError::RequestError(e.to_string()))?;

        let status = response.status();
        let data: serde_json::Value = response.json().await
            .map_err(|e| NetworkError::ParseError(e.to_string()))?;

        if status.is_success() && data["success"].as_bool().unwrap_or(false) {
            tracing::info!("🎉 Handle @{} claimed successfully!", clean_handle);
            Ok(HandleClaimResult {
                success: true,
                handle: Some(clean_handle.clone()),
                message: Some(format!("🎉 @{} is now permanently yours!", clean_handle)),
                error: None,
            })
        } else {
            let error_msg = data["error"].as_str()
                .or_else(|| data["message"].as_str())
                .unwrap_or("Unknown error")
                .to_string();

            tracing::warn!("❌ Handle claim failed: {}", error_msg);
            Ok(HandleClaimResult {
                success: false,
                handle: None,
                message: None,
                error: Some(error_msg),
            })
        }
    }

    /// Legacy claim_handle (kept for compatibility)
    pub async fn claim_handle(
        &self,
        handle: &str,
        public_key: &str,
        encryption_key: &str,
        signature: &str,
        breadcrumbs: Vec<Breadcrumb>,
    ) -> Result<ClaimResponse, NetworkError> {
        let clean_handle = handle.trim_start_matches('@').to_lowercase();
        let url = format!("{}/aliases/{}/claim", self.base_url, clean_handle);

        let request = ClaimRequest {
            handle: clean_handle,
            public_key: public_key.to_string(),
            encryption_key: encryption_key.to_string(),
            signature: signature.to_string(),
            breadcrumbs,
        };

        let response = self.client.post(&url).json(&request).send().await
            .map_err(|e| NetworkError::RequestError(e.to_string()))?;

        let data: ClaimResponse = response.json().await
            .map_err(|e| NetworkError::ParseError(e.to_string()))?;

        Ok(data)
    }

    // ==================== Record Publishing ====================

    /// Publish identity record to network
    /// PUT /records/{public_key}
    pub async fn publish_record(
        &self,
        public_key: &str,
        encryption_key: &str,
        handle: Option<&str>,
        trust_score: f64,
        breadcrumb_count: u32,
        signature: &str,
    ) -> Result<bool, NetworkError> {
        // Legacy method - constructs its own JSON and timestamp
        // This is problematic for signature verification if the caller signed a different timestamp
        // Kept for backward compatibility but should be avoided
        
        let url = format!("{}/records/{}", self.base_url, public_key);
        let now = chrono::Utc::now().to_rfc3339();

        let mut record_json = json!({
            "identity": public_key,
            "encryption_key": encryption_key,
            "trust_score": trust_score,
            "breadcrumb_count": breadcrumb_count,
            "version": 1,
            "created_at": now,
            "updated_at": now,
            "modules": [],
            "endpoints": [],
            "epoch_roots": [],
        });

        if let Some(h) = handle {
            record_json["handle"] = serde_json::Value::String(h.to_string());
        }

        let request_body = json!({
            "record_json": record_json,
            "signature": signature,
        });

        let response = self.client.put(&url)
            .json(&request_body)
            .send()
            .await
            .map_err(|e| NetworkError::RequestError(e.to_string()))?;

        let status = response.status();
        let data: serde_json::Value = response.json().await
            .map_err(|e| NetworkError::ParseError(e.to_string()))?;

        if status.is_success() && data["success"].as_bool().unwrap_or(false) {
            tracing::info!("✅ Record published successfully!");
            Ok(true)
        } else {
            let error_msg = data["error"].as_str().unwrap_or("Unknown error");
            tracing::warn!("❌ Record publish failed: {}", error_msg);
            Ok(false)
        }
    }

    /// Publish a pre-signed record (Caller constructs JSON and signs it)
    /// PUT /records/{public_key}
    pub async fn publish_signed_record(
        &self,
        public_key: &str,
        record_json: &serde_json::Value,
        signature: &str,
    ) -> Result<(), NetworkError> {
        let url = format!("{}/records/{}", self.base_url, public_key);

        tracing::info!("Publishing signed record for {}...", &public_key[..16]);

        let request_body = json!({
            "record_json": record_json,
            "signature": signature,
        });

        let response = self.client.put(&url)
            .json(&request_body)
            .send()
            .await
            .map_err(|e| NetworkError::RequestError(e.to_string()))?;

        let status = response.status();
        let data: serde_json::Value = response.json().await
            .map_err(|e| NetworkError::ParseError(e.to_string()))?;

        if status.is_success() && data["success"].as_bool().unwrap_or(false) {
            tracing::info!("✅ Record published successfully!");
            Ok(())
        } else {
            let error_msg = data["error"].as_str().unwrap_or("Unknown error");
            let detailed_msg = data["message"].as_str().unwrap_or(error_msg);
            tracing::warn!("❌ Record publish failed: {}", detailed_msg);
            Err(NetworkError::ApiError(detailed_msg.to_string()))
        }
    }

    // ==================== Breadcrumb Sync ====================

    /// Upload breadcrumb to server
    /// POST /breadcrumbs
    pub async fn upload_breadcrumb(
        &self,
        pk_root: &str,
        payload: &str,
        signature: &str,
    ) -> Result<bool, NetworkError> {
        let url = format!("{}/breadcrumbs", self.base_url);

        let request_body = json!({
            "pk_root": pk_root,
            "payload": payload,
            "signature": signature,
        });

        let response = self.client.post(&url)
            .json(&request_body)
            .send()
            .await
            .map_err(|e| NetworkError::RequestError(e.to_string()))?;

        if response.status().is_success() {
            Ok(true)
        } else {
            let error_text = response.text().await.unwrap_or_default();
            tracing::warn!("Failed to upload breadcrumb: {}", error_text);
            Ok(false)
        }
    }

    /// Fetch encrypted breadcrumbs from server
    /// GET /breadcrumbs/{pk}
    pub async fn fetch_breadcrumbs(&self, pk_root: &str) -> Result<Vec<serde_json::Value>, NetworkError> {
        let url = format!("{}/breadcrumbs/{}", self.base_url, pk_root);

        let response = self.client.get(&url).send().await
            .map_err(|e| NetworkError::RequestError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(NetworkError::ApiError(format!("API returned status: {}", response.status())));
        }

        let data: serde_json::Value = response.json().await
            .map_err(|e| NetworkError::ParseError(e.to_string()))?;

        let breadcrumbs = data["data"].as_array()
            .map(|arr| arr.clone())
            .unwrap_or_default();

        Ok(breadcrumbs)
    }

    // ==================== Messaging ====================

    pub async fn send_envelope(&self, envelope: &GnsEnvelope) -> Result<(), NetworkError> {
        let url = format!("{}/messages", self.base_url);

        let response = self.client.post(&url).json(envelope).send().await
            .map_err(|e| NetworkError::RequestError(e.to_string()))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(NetworkError::ApiError(format!("Failed to send envelope: {}", error_text)));
        }

        Ok(())
    }

    pub async fn fetch_pending_messages(&self, public_key: &str) -> Result<Vec<GnsEnvelope>, NetworkError> {
        let url = format!("{}/messages/pending/{}", self.base_url, public_key);

        let response = self.client.get(&url).send().await
            .map_err(|e| NetworkError::RequestError(e.to_string()))?;

        if !response.status().is_success() {
            return Ok(Vec::new());
        }

        let data: serde_json::Value = response.json().await
            .map_err(|e| NetworkError::ParseError(e.to_string()))?;

        let envelopes: Vec<GnsEnvelope> = serde_json::from_value(data["messages"].clone()).unwrap_or_default();

        Ok(envelopes)
    }
}

// ==================== WebSocket Relay ====================

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
}

/// Incoming WebSocket message types
#[derive(Debug, Clone)]
pub enum IncomingMessage {
    /// An encrypted envelope
    Envelope(GnsEnvelope),
    /// Connection status update
    ConnectionStatus { mobile: bool, browsers: u32 },
    /// Welcome message
    Welcome { public_key: String },
    /// Message synced from browser
    MessageSentFromBrowser {
        message_id: String,
        to_pk: String,
        plaintext: String,
        timestamp: i64,
    },
    /// Message synced from Browser/Mobile (Decrypted Payload)
    MessageSynced {
        message_id: String,
        conversation_with: String,
        decrypted_text: String,
        direction: String,
        timestamp: i64,
        from_handle: Option<String>,
    },
    /// Read receipt
    ReadReceipt {
        message_id: String,
        timestamp: i64,
    },
    RequestSync {
        conversation_with: String,
        limit: u32,
    },
    /// Unknown message type
    Unknown(String),
}

pub struct RelayConnection {
    url: String,
    state: Arc<RwLock<ConnectionState>>,
    last_message_time: Arc<RwLock<Option<i64>>>,
    reconnect_attempts: Arc<RwLock<u32>>,
    sender: Arc<RwLock<Option<mpsc::Sender<String>>>>,
    /// Channel for incoming messages
    incoming_tx: Option<mpsc::Sender<IncomingMessage>>,
}

impl RelayConnection {
    pub fn new(url: &str) -> Result<Self, NetworkError> {
        let ws_url = if url.starts_with("https://") {
            url.replace("https://", "wss://") + "/ws"
        } else if url.starts_with("wss://") && !url.ends_with("/ws") {
            url.to_string() + "/ws"
        } else if url.starts_with("http://") {
            url.replace("http://", "ws://") + "/ws"
        } else {
            url.to_string()
        };

        Ok(Self {
            url: ws_url,
            state: Arc::new(RwLock::new(ConnectionState::Disconnected)),
            last_message_time: Arc::new(RwLock::new(None)),
            reconnect_attempts: Arc::new(RwLock::new(0)),
            sender: Arc::new(RwLock::new(None)),
            incoming_tx: None,
        })
    }

    pub fn with_incoming_channel(mut self, tx: mpsc::Sender<IncomingMessage>) -> Self {
        self.incoming_tx = Some(tx);
        self
    }

    pub fn clone_with_incoming_channel(&self, tx: mpsc::Sender<IncomingMessage>) -> Self {
        Self {
            url: self.url.clone(),
            state: self.state.clone(),
            last_message_time: self.last_message_time.clone(),
            reconnect_attempts: self.reconnect_attempts.clone(),
            sender: self.sender.clone(),
            incoming_tx: Some(tx),
        }
    }

    pub fn url(&self) -> &str {
        &self.url
    }

    pub async fn is_connected(&self) -> bool {
        *self.state.read().await == ConnectionState::Connected
    }

    pub async fn get_state(&self) -> ConnectionState {
        *self.state.read().await
    }

    pub async fn last_message_time(&self) -> Option<i64> {
        *self.last_message_time.read().await
    }

    pub async fn reconnect_attempts(&self) -> u32 {
        *self.reconnect_attempts.read().await
    }

    pub async fn connect(&self, public_key: &str) -> Result<(), NetworkError> {
        *self.state.write().await = ConnectionState::Connecting;
        tracing::info!("Connecting to relay: {}", self.url);

        #[cfg(any(target_os = "ios", target_os = "android"))]
        let device_type = "mobile";
        #[cfg(not(any(target_os = "ios", target_os = "android")))]
        let device_type = "desktop";

        let url_with_auth = format!("{}?pk={}&device={}", self.url, public_key, device_type);

        let (ws_stream, _) = connect_async(&url_with_auth).await.map_err(|e| {
            tracing::error!("WebSocket connection failed: {}", e);
            NetworkError::ConnectionError(e.to_string())
        })?;

        tracing::info!("WebSocket connected to {}", self.url);

        let (mut write, mut read) = ws_stream.split();
        let (tx, mut rx) = mpsc::channel::<String>(100);
        *self.sender.write().await = Some(tx);
        *self.state.write().await = ConnectionState::Connected;
        *self.reconnect_attempts.write().await = 0;

        let state = self.state.clone();
        let last_message_time = self.last_message_time.clone();
        let incoming_tx = self.incoming_tx.clone();

        let read_state = state.clone();
        tokio::spawn(async move {
            while let Some(msg) = read.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        tracing::debug!("Received WebSocket message: {}", text);
                        *last_message_time.write().await = Some(chrono::Utc::now().timestamp());
                        
                        // Parse the incoming message
                        if let Some(ref tx) = incoming_tx {
                            let parsed = parse_incoming_message(&text);
                            if let Err(e) = tx.send(parsed).await {
                                tracing::error!("Failed to send incoming message to channel: {}", e);
                            }
                        }
                    }
                    Ok(Message::Ping(_)) => {
                        tracing::trace!("Received ping");
                    }
                    Ok(Message::Close(_)) => {
                        tracing::info!("WebSocket closed by server");
                        *read_state.write().await = ConnectionState::Disconnected;
                        break;
                    }
                    Err(e) => {
                        tracing::error!("WebSocket error: {}", e);
                        *read_state.write().await = ConnectionState::Disconnected;
                        break;
                    }
                    _ => {}
                }
            }
        });

        let write_state = state.clone();
        tokio::spawn(async move {
            while let Some(msg) = rx.recv().await {
                if write.send(Message::Text(msg)).await.is_err() {
                    tracing::error!("Failed to send WebSocket message");
                    *write_state.write().await = ConnectionState::Disconnected;
                    break;
                }
            }
        });

        Ok(())
    }

    pub async fn disconnect(&self) -> Result<(), NetworkError> {
        tracing::info!("Disconnecting from relay");
        *self.state.write().await = ConnectionState::Disconnected;
        *self.sender.write().await = None;
        Ok(())
    }

    pub async fn reconnect(&self, public_key: &str) -> Result<(), NetworkError> {
        *self.reconnect_attempts.write().await += 1;
        *self.state.write().await = ConnectionState::Reconnecting;
        self.disconnect().await?;
        
        let attempts = *self.reconnect_attempts.read().await;
        let delay = std::cmp::min(1000 * 2u64.pow(attempts), 30000);
        tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
        
        self.connect(public_key).await
    }

    pub async fn send_envelope(&self, envelope: &GnsEnvelope) -> Result<(), NetworkError> {
        let sender = self.sender.read().await;
        if let Some(tx) = sender.as_ref() {
            // Wrap envelope in message format (matches Flutter/server expectation)
            let wrapped = serde_json::json!({
                "type": "message",
                "envelope": envelope
            });
            let json = serde_json::to_string(&wrapped)
                .map_err(|e| NetworkError::ParseError(e.to_string()))?;
            
            // Debug: log what we're sending
            tracing::debug!("Sending WebSocket message: {}", &json[..json.len().min(500)]);
            
            tx.send(json).await.map_err(|_| NetworkError::NotConnected)?;
            Ok(())
        } else {
            Err(NetworkError::NotConnected)
        }
    }

    pub async fn send_raw(&self, message: &str) -> Result<(), NetworkError> {
        let sender = self.sender.read().await;
        if let Some(tx) = sender.as_ref() {
            tx.send(message.to_string()).await.map_err(|_| NetworkError::NotConnected)?;
            Ok(())
        } else {
            Err(NetworkError::NotConnected)
        }
    }

    pub async fn send_decryption_request(&self, message_ids: Vec<String>, conversation_with: &str) -> Result<(), NetworkError> {
        let payload = json!({
            "type": "request_decryption",
            "messageIds": message_ids,
            "conversationWith": conversation_with
        });
        
        self.send_raw(&payload.to_string()).await
    }

    pub async fn send_sync_request(&self, conversation_with: &str, limit: u32) -> Result<(), NetworkError> {
        let payload = json!({
            "type": "request_sync",
            "conversationWith": conversation_with,
            "limit": limit
        });
        
        self.send_raw(&payload.to_string()).await
    }
}

/// Parse incoming WebSocket message into typed enum
fn parse_incoming_message(text: &str) -> IncomingMessage {
    // Truncate log for privacy/size
    let log_len = std::cmp::min(text.len(), 300);
    println!("🔥 [RUST] WebSocket received: {}", &text[..log_len]);
    
    // Try to parse as JSON
    let json: serde_json::Value = match serde_json::from_str(text) {
        Ok(v) => v,
        Err(_) => return IncomingMessage::Unknown(text.to_string()),
    };

    // Check message type
    let msg_type = json["type"].as_str().unwrap_or("");

    match msg_type {
        "welcome" => {
            let public_key = json["publicKey"].as_str().unwrap_or_default().to_string();
            IncomingMessage::Welcome { public_key }
        }
        "connection_status" => {
            let mobile = json["data"]["mobile"].as_bool().unwrap_or(false);
            let browsers = json["data"]["browsers"].as_u64().unwrap_or(0) as u32;
            IncomingMessage::ConnectionStatus { mobile, browsers }
        }
        "message_sent_from_browser" => {
            IncomingMessage::MessageSentFromBrowser {
                message_id: json["messageId"].as_str().unwrap_or_default().to_string(),
                to_pk: json["to_pk"].as_str().unwrap_or_default().to_string(),
                plaintext: json["plaintext"].as_str().unwrap_or_default().to_string(),
                timestamp: json["timestamp"].as_i64().unwrap_or_else(|| chrono::Utc::now().timestamp_millis()),
            }
        }
        "message_synced" => {
            IncomingMessage::MessageSynced {
                message_id: json["messageId"].as_str().unwrap_or_default().to_string(),
                conversation_with: json["conversationWith"].as_str().unwrap_or_default().to_string(),
                decrypted_text: json["decryptedText"].as_str().unwrap_or_default().to_string(),
                direction: json["direction"].as_str().unwrap_or("incoming").to_string(),
                timestamp: json["timestamp"].as_i64().unwrap_or_else(|| chrono::Utc::now().timestamp_millis()),
                from_handle: json["fromHandle"].as_str().map(|s| s.to_string()),
            }
        }
        "read_receipt" => {
            IncomingMessage::ReadReceipt {
                message_id: json["messageId"].as_str().unwrap_or_default().to_string(),
                timestamp: json["timestamp"].as_i64().unwrap_or_else(|| chrono::Utc::now().timestamp_millis()),
            }
        }
        "request_sync" => {
            IncomingMessage::RequestSync {
                conversation_with: json["conversationWith"].as_str().unwrap_or_default().to_string(),
                limit: json["limit"].as_u64().unwrap_or(50) as u32,
            }
        }
        "envelope" | "message" => {
            // Try to parse the envelope from data field or root
            let envelope_json = if json["data"].is_object() {
                &json["data"]
            } else if json["envelope"].is_object() {
                &json["envelope"]
            } else {
                &json
            };
            
            match serde_json::from_value::<GnsEnvelope>(envelope_json.clone()) {
                Ok(envelope) => IncomingMessage::Envelope(envelope),
                Err(e) => {
                    tracing::warn!("Failed to parse envelope: {}", e);
                    IncomingMessage::Unknown(text.to_string())
                }
            }
        }
        _ => {
            // Maybe it's a raw envelope without type field
            if json["encrypted_payload"].is_object() && json["from_public_key"].is_string() {
                match serde_json::from_value::<GnsEnvelope>(json) {
                    Ok(envelope) => IncomingMessage::Envelope(envelope),
                    Err(_) => IncomingMessage::Unknown(text.to_string()),
                }
            } else {
                IncomingMessage::Unknown(text.to_string())
            }
        }
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

/// Result of checking handle availability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandleCheckResult {
    pub handle: String,
    pub available: bool,
    pub reason: Option<String>,
}

/// Result of reserving a handle
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandleReservationResult {
    pub success: bool,
    pub handle: String,
    pub network_reserved: bool,
    pub expires_at: Option<String>,
    pub message: Option<String>,
    pub error: Option<String>,
}

/// Result of claiming a handle
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandleClaimResult {
    pub success: bool,
    pub handle: Option<String>,
    pub message: Option<String>,
    pub error: Option<String>,
}

/// Proof for claiming a handle (Proof of Trajectory)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimProof {
    pub breadcrumb_count: u32,
    pub first_breadcrumb_at: String,
    pub trust_score: f64,
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
    #[error("Connection error: {0}")]
    ConnectionError(String),
    #[error("Not connected to relay")]
    NotConnected,
}
