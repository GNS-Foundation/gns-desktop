//! Stellar Backend Client
//!
//! Handles communication with the Railway Express backend for secure
//! Stellar transaction building and signing.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use crate::crypto::IdentityManager;

// ==================== REQUEST TYPES ====================

#[derive(Debug, Serialize)]
pub struct ClaimGnsRequest {
    pub public_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub balance_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signed_xdr: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SendGnsRequest {
    pub public_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recipient_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recipient_public_key: Option<String>,
    pub amount: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memo: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signed_xdr: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateTrustlineRequest {
    pub public_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signed_xdr: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SubmitTransactionRequest {
    pub xdr: String,
}

#[derive(Debug, Serialize)]
pub struct FundTestnetRequest {
    pub public_key: String,
}

#[derive(Debug, Serialize)]
pub struct ConvertKeyRequest {
    pub public_key: String,
}

// ==================== RESPONSE TYPES ====================

#[derive(Debug, Deserialize)]
pub struct BackendTransactionResponse {
    pub success: bool,
    pub hash: Option<String>,
    pub error: Option<String>,
    pub ledger: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct BalancesResponse {
    pub success: bool,
    pub data: Option<BalancesData>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BalancesData {
    pub stellar_address: String,
    pub exists: bool,
    pub xlm: String,
    pub gns: String,
    #[serde(rename = "hasTrustline")]
    pub has_trustline: bool,
    #[serde(rename = "claimableGns")]
    pub claimable_gns: Vec<ClaimableBalanceData>,
}

#[derive(Debug, Deserialize)]
pub struct ClaimableBalanceData {
    pub id: String,
    pub amount: String,
    pub asset: String,
    pub sponsor: Option<String>,
}

// ==================== STELLAR BACKEND CLIENT ====================

pub struct StellarBackendClient {
    client: Client,
    base_url: String,
}

impl StellarBackendClient {
    pub fn new(base_url: Option<&str>) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url
                .unwrap_or("https://gns-stellar-backend-production.up.railway.app/stellar")
                .to_string(),
        }
    }

    /// Sign a request body and create signature header value
    fn sign_request_body(body: &impl Serialize, sign_fn: &impl Fn(&str) -> Result<String, String>) -> Result<(String, i64), String> {
        let timestamp = chrono::Utc::now().timestamp_millis();
        
        // Create the payload that will be signed (body + timestamp)
        let mut body_value = serde_json::to_value(body)
            .map_err(|e| format!("Serialize error: {}", e))?;
        
        if let Some(obj) = body_value.as_object_mut() {
            obj.insert("timestamp".to_string(), serde_json::json!(timestamp));
        }
        
        let payload = serde_json::to_string(&body_value)
            .map_err(|e| format!("Serialize error: {}", e))?;
        
        let signature = sign_fn(&payload)?;
        
        Ok((signature, timestamp))
    }

    /// Get balances for a GNS public key
    pub async fn get_balances(&self, public_key_hex: &str) -> Result<BalancesData, String> {
        let response = self.client
            .get(&format!("{}/balances-by-gns/{}", self.base_url, public_key_hex))
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;
        
        let result: BalancesResponse = response.json()
            .await
            .map_err(|e| format!("Parse error: {}", e))?;
        
        if result.success {
            result.data.ok_or_else(|| "No data in response".to_string())
        } else {
            Err(result.error.unwrap_or_else(|| "Unknown error".to_string()))
        }
    }

    /// Claim GNS tokens via backend
    pub async fn claim_gns(
        &self,
        public_key_hex: &str,
        network: Option<&str>,
        signed_xdr: Option<&str>,
        sign_fn: impl Fn(&str) -> Result<String, String>,
        balance_ids: Option<Vec<String>>,
    ) -> Result<BackendTransactionResponse, String> {
        let request = ClaimGnsRequest {
            public_key: public_key_hex.to_string(),
            balance_ids,
            signed_xdr: signed_xdr.map(|s| s.to_string()),
            network: network.map(|s| s.to_string()),
        };
        
        let (signature, timestamp) = Self::sign_request_body(&request, &sign_fn)?;
        
        let response = self.client
            .post(&format!("{}/claim-gns", self.base_url))
            .header("Content-Type", "application/json")
            .header("X-GNS-Signature", signature)
            .header("X-GNS-Timestamp", timestamp.to_string())
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;
        
        response.json::<BackendTransactionResponse>()
            .await
            .map_err(|e| format!("Parse error: {}", e))
    }

    /// Send GNS tokens via backend
    pub async fn send_gns(
        &self,
        recipient_stellar_address: Option<&str>,
        recipient_public_key: Option<&str>,
        amount: f64,
        memo: Option<&str>,
        public_key_hex: &str,
        network: Option<&str>,
        signed_xdr: Option<&str>,
        sign_fn: impl Fn(&str) -> Result<String, String>,
    ) -> Result<BackendTransactionResponse, String> {
        let request = SendGnsRequest {
            public_key: public_key_hex.to_string(),
            recipient_address: recipient_stellar_address.map(|s| s.to_string()),
            recipient_public_key: recipient_public_key.map(|s| s.to_string()),
            amount: format!("{:.7}", amount),
            memo: memo.map(|s| s.to_string()),
            signed_xdr: signed_xdr.map(|s| s.to_string()),
            network: network.map(|s| s.to_string()),
        };
        
        let (signature, timestamp) = Self::sign_request_body(&request, &sign_fn)?;
        
        let response = self.client
            .post(&format!("{}/send-gns", self.base_url))
            .header("Content-Type", "application/json")
            .header("X-GNS-Signature", signature)
            .header("X-GNS-Timestamp", timestamp.to_string())
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;
        
        response.json::<BackendTransactionResponse>()
            .await
            .map_err(|e| format!("Parse error: {}", e))
    }

    /// Create GNS trustline via backend
    pub async fn create_trustline(
        &self,
        public_key_hex: &str,
        network: Option<&str>,
        signed_xdr: Option<&str>,
        sign_fn: impl Fn(&str) -> Result<String, String>,
    ) -> Result<BackendTransactionResponse, String> {
        let request = CreateTrustlineRequest {
            public_key: public_key_hex.to_string(),
            signed_xdr: signed_xdr.map(|s| s.to_string()),
            network: network.map(|s| s.to_string()),
        };
        
        let (signature, timestamp) = Self::sign_request_body(&request, &sign_fn)?;
        
        let response = self.client
            .post(&format!("{}/create-trustline", self.base_url))
            .header("Content-Type", "application/json")
            .header("X-GNS-Signature", signature)
            .header("X-GNS-Timestamp", timestamp.to_string())
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;
        
        response.json::<BackendTransactionResponse>()
            .await
            .map_err(|e| format!("Parse error: {}", e))
    }

    /// Fund account via Friendbot (testnet only)
    pub async fn fund_testnet(&self, public_key_hex: &str) -> Result<BackendTransactionResponse, String> {
        let request = FundTestnetRequest {
            public_key: public_key_hex.to_string(),
        };
        
        let response = self.client
            .post(&format!("{}/fund-testnet", self.base_url))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;
        
        response.json::<BackendTransactionResponse>()
            .await
            .map_err(|e| format!("Parse error: {}", e))
    }

    /// Submit a signed transaction XDR
    pub async fn submit_transaction(&self, xdr: &str) -> Result<BackendTransactionResponse, String> {
        let request = SubmitTransactionRequest {
            xdr: xdr.to_string(),
        };
        
        let response = self.client
            .post(&format!("{}/submit", self.base_url))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;
        
        response.json::<BackendTransactionResponse>()
            .await
            .map_err(|e| format!("Parse error: {}", e))
    }
}

// ==================== SIGNING HELPER ====================

/// Sign a message using the identity's Ed25519 private key
pub fn sign_message(identity: &IdentityManager, message: &str) -> Result<String, String> {
    let private_key = identity.get_identity()
        .ok_or("No identity found")?;
    
    let signature = private_key.sign(message.as_bytes());
    Ok(hex::encode(signature.to_bytes()))
}
