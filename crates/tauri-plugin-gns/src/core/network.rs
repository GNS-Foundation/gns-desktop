//! Network Client
//!
//! HTTP client for communicating with GNS relay servers.

use crate::error::{Error, Result};
use crate::models::*;
use reqwest::Client;
use std::time::Duration;

/// Network client for GNS relay communication
pub struct NetworkClient {
    client: Client,
    relay_urls: Vec<String>,
    timeout: Duration,
}

impl NetworkClient {
    /// Create a new network client
    pub fn new(relay_urls: &[String]) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| Error::Network(format!("Failed to create HTTP client: {}", e)))?;

        Ok(Self {
            client,
            relay_urls: relay_urls.to_vec(),
            timeout: Duration::from_secs(30),
        })
    }

    /// Set request timeout
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    /// Get the primary relay URL
    fn primary_relay(&self) -> Result<&str> {
        self.relay_urls
            .first()
            .map(|s| s.as_str())
            .ok_or_else(|| Error::Config("No relay URLs configured".to_string()))
    }

    // ==================== Identity Resolution ====================

    /// Resolve a handle to an identity
    pub async fn resolve_handle(&self, handle: &str) -> Result<ResolvedHandle> {
        let relay = self.primary_relay()?;
        let url = format!("{}/api/handles/{}", relay, handle.trim_start_matches('@'));

        let response = self
            .client
            .get(&url)
            .timeout(self.timeout)
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;
            
            if let Some(identity) = data.get("data").and_then(|d| d.get("identity")) {
                return Ok(ResolvedHandle {
                    handle: handle.trim_start_matches('@').to_string(),
                    public_key: identity
                        .get("identity")
                        .and_then(|v| v.as_str())
                        .unwrap_or_default()
                        .to_string(),
                    encryption_key: identity
                        .get("encryption_key")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    trust_score: identity
                        .get("trust_score")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(0.0),
                    breadcrumb_count: identity
                        .get("breadcrumb_count")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0) as u32,
                    from_cache: false,
                    resolved_at: chrono::Utc::now().to_rfc3339(),
                });
            }
        }

        Err(Error::HandleNotFound(format!("Handle @{} not found", handle)))
    }

    /// Get a GNS record by public key
    pub async fn get_record(&self, public_key: &str) -> Result<GnsRecord> {
        let relay = self.primary_relay()?;
        let url = format!("{}/api/identities/{}", relay, public_key);

        let response = self
            .client
            .get(&url)
            .timeout(self.timeout)
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;
            
            if let Some(record) = data.get("data") {
                let record: GnsRecord = serde_json::from_value(record.clone())?;
                return Ok(record);
            }
        }

        Err(Error::IdentityNotFound(format!(
            "Identity {} not found",
            public_key
        )))
    }

    /// Check if a handle is available
    pub async fn is_handle_available(&self, handle: &str) -> Result<bool> {
        match self.resolve_handle(handle).await {
            Ok(_) => Ok(false), // Handle exists
            Err(Error::HandleNotFound(_)) => Ok(true), // Handle available
            Err(e) => Err(e), // Other error
        }
    }

    // ==================== Handle Operations ====================

    /// Claim a handle
    pub async fn claim_handle(&self, claim: &HandleClaim) -> Result<()> {
        let relay = self.primary_relay()?;
        let url = format!("{}/api/handles/claim", relay);

        let response = self
            .client
            .post(&url)
            .json(claim)
            .timeout(self.timeout)
            .send()
            .await?;

        if response.status().is_success() {
            Ok(())
        } else {
            let error: serde_json::Value = response.json().await.unwrap_or_default();
            Err(Error::Network(
                error
                    .get("error")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Handle claim failed")
                    .to_string(),
            ))
        }
    }

    /// Release a handle
    pub async fn release_handle(&self, handle: &str, identity: &str, signature: &str) -> Result<()> {
        let relay = self.primary_relay()?;
        let url = format!("{}/api/handles/{}/release", relay, handle);

        let response = self
            .client
            .post(&url)
            .json(&serde_json::json!({
                "identity": identity,
                "signature": signature,
            }))
            .timeout(self.timeout)
            .send()
            .await?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(Error::Network("Failed to release handle".to_string()))
        }
    }

    // ==================== Messaging ====================

    /// Send a message via relay
    pub async fn send_message(&self, envelope: &GnsEnvelope) -> Result<()> {
        let relay = self.primary_relay()?;
        let url = format!("{}/api/messages", relay);

        let response = self
            .client
            .post(&url)
            .json(envelope)
            .timeout(self.timeout)
            .send()
            .await?;

        if response.status().is_success() {
            Ok(())
        } else {
            let error: serde_json::Value = response.json().await.unwrap_or_default();
            Err(Error::Network(
                error
                    .get("error")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Failed to send message")
                    .to_string(),
            ))
        }
    }

    /// Fetch messages for an identity
    pub async fn fetch_messages(&self, identity: &str, since: Option<&str>) -> Result<Vec<GnsEnvelope>> {
        let relay = self.primary_relay()?;
        let mut url = format!("{}/api/messages?to={}", relay, identity);
        
        if let Some(since) = since {
            url.push_str(&format!("&since={}", since));
        }

        let response = self
            .client
            .get(&url)
            .header("X-GNS-PublicKey", identity)
            .timeout(self.timeout)
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;
            
            if let Some(messages) = data.get("data").and_then(|d| d.as_array()) {
                let envelopes: Vec<GnsEnvelope> = messages
                    .iter()
                    .filter_map(|m| serde_json::from_value(m.clone()).ok())
                    .collect();
                return Ok(envelopes);
            }
        }

        Ok(vec![])
    }

    // ==================== Record Operations ====================

    /// Update a GNS record
    pub async fn update_record(&self, signed_record: &SignedRecord) -> Result<()> {
        let relay = self.primary_relay()?;
        let url = format!("{}/api/identities", relay);

        let response = self
            .client
            .post(&url)
            .json(signed_record)
            .timeout(self.timeout)
            .send()
            .await?;

        if response.status().is_success() {
            Ok(())
        } else {
            let error: serde_json::Value = response.json().await.unwrap_or_default();
            Err(Error::Network(
                error
                    .get("error")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Failed to update record")
                    .to_string(),
            ))
        }
    }

    // ==================== Epoch Operations ====================

    /// Publish an epoch
    pub async fn publish_epoch(&self, signed_epoch: &SignedEpoch) -> Result<()> {
        let relay = self.primary_relay()?;
        let url = format!("{}/api/epochs", relay);

        let response = self
            .client
            .post(&url)
            .json(signed_epoch)
            .timeout(self.timeout)
            .send()
            .await?;

        if response.status().is_success() {
            Ok(())
        } else {
            let error: serde_json::Value = response.json().await.unwrap_or_default();
            Err(Error::Network(
                error
                    .get("error")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Failed to publish epoch")
                    .to_string(),
            ))
        }
    }

    /// Get epochs for an identity
    pub async fn get_epochs(&self, identity: &str) -> Result<Vec<EpochHeader>> {
        let relay = self.primary_relay()?;
        let url = format!("{}/api/epochs?identity={}", relay, identity);

        let response = self
            .client
            .get(&url)
            .timeout(self.timeout)
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;
            
            if let Some(epochs) = data.get("data").and_then(|d| d.as_array()) {
                let headers: Vec<EpochHeader> = epochs
                    .iter()
                    .filter_map(|e| serde_json::from_value(e.clone()).ok())
                    .collect();
                return Ok(headers);
            }
        }

        Ok(vec![])
    }

    // ==================== Health Check ====================

    /// Check if the relay is healthy
    pub async fn health_check(&self) -> Result<bool> {
        let relay = self.primary_relay()?;
        let url = format!("{}/health", relay);

        match self.client.get(&url).timeout(Duration::from_secs(5)).send().await {
            Ok(response) => Ok(response.status().is_success()),
            Err(_) => Ok(false),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_client() {
        let client = NetworkClient::new(&["https://example.com".to_string()]).unwrap();
        assert_eq!(client.relay_urls.len(), 1);
    }

    #[test]
    fn test_primary_relay() {
        let client = NetworkClient::new(&["https://relay1.com".to_string()]).unwrap();
        assert_eq!(client.primary_relay().unwrap(), "https://relay1.com");
    }

    #[test]
    fn test_no_relay_error() {
        let client = NetworkClient::new(&[]).unwrap();
        assert!(client.primary_relay().is_err());
    }
}
