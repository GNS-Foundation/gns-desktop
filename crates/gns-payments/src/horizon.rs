// ============================================================================
// GNS-PAYMENTS - Horizon API Client
// ============================================================================
// HTTP client for Stellar's Horizon API.
// Handles account queries, balances, transactions, and claimable balances.
// ============================================================================

use crate::config::StellarConfig;
use crate::error::PaymentError;
use crate::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::{debug, warn};

// ============================================================================
// DATA TYPES
// ============================================================================

/// Account balance information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Balance {
    /// Asset type: "native" for XLM, "credit_alphanum4" or "credit_alphanum12" for tokens
    pub asset_type: String,
    
    /// Asset code (empty for native XLM)
    #[serde(default)]
    pub asset_code: String,
    
    /// Asset issuer (empty for native XLM)
    #[serde(default)]
    pub asset_issuer: String,
    
    /// Balance amount as string (Stellar uses string for precision)
    pub balance: String,
    
    /// Trustline limit (for non-native assets)
    #[serde(default)]
    pub limit: Option<String>,
    
    /// Buying liabilities
    #[serde(default)]
    pub buying_liabilities: Option<String>,
    
    /// Selling liabilities
    #[serde(default)]
    pub selling_liabilities: Option<String>,
}

impl Balance {
    /// Check if this is native XLM
    pub fn is_native(&self) -> bool {
        self.asset_type == "native"
    }
    
    /// Get balance as f64
    pub fn amount(&self) -> f64 {
        self.balance.parse().unwrap_or(0.0)
    }
    
    /// Check if this matches a specific asset
    pub fn matches_asset(&self, code: &str, issuer: &str) -> bool {
        self.asset_code == code && self.asset_issuer == issuer
    }
}

/// Stellar account information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountInfo {
    /// Account public key (G... address)
    pub id: String,
    
    /// Current sequence number
    pub sequence: String,
    
    /// Account balances
    pub balances: Vec<Balance>,
    
    /// Number of subentries (affects minimum balance)
    pub subentry_count: u32,
    
    /// Account thresholds
    #[serde(default)]
    pub thresholds: AccountThresholds,
    
    /// Account flags
    #[serde(default)]
    pub flags: AccountFlags,
    
    /// Home domain (optional)
    #[serde(default)]
    pub home_domain: Option<String>,
    
    /// Inflation destination (optional)
    #[serde(default)]
    pub inflation_destination: Option<String>,
}

impl AccountInfo {
    /// Get XLM balance
    pub fn xlm_balance(&self) -> f64 {
        self.balances
            .iter()
            .find(|b| b.is_native())
            .map(|b| b.amount())
            .unwrap_or(0.0)
    }
    
    /// Get balance for a specific asset
    pub fn asset_balance(&self, code: &str, issuer: &str) -> Option<f64> {
        self.balances
            .iter()
            .find(|b| b.matches_asset(code, issuer))
            .map(|b| b.amount())
    }
    
    /// Check if account has trustline for asset
    pub fn has_trustline(&self, code: &str, issuer: &str) -> bool {
        self.balances.iter().any(|b| b.matches_asset(code, issuer))
    }
    
    /// Calculate minimum balance (2 XLM base + 0.5 per subentry)
    pub fn minimum_balance(&self) -> f64 {
        2.0 + (self.subentry_count as f64 * 0.5)
    }
    
    /// Get available XLM (balance - minimum - liabilities)
    pub fn available_xlm(&self) -> f64 {
        let balance = self.xlm_balance();
        let min = self.minimum_balance();
        
        let liabilities: f64 = self.balances
            .iter()
            .find(|b| b.is_native())
            .and_then(|b| b.selling_liabilities.as_ref())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0.0);
        
        (balance - min - liabilities).max(0.0)
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AccountThresholds {
    pub low_threshold: u8,
    pub med_threshold: u8,
    pub high_threshold: u8,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AccountFlags {
    pub auth_required: bool,
    pub auth_revocable: bool,
    pub auth_immutable: bool,
    pub auth_clawback_enabled: bool,
}

/// Claimable balance information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimableBalance {
    /// Balance ID (used to claim)
    pub id: String,
    
    /// Asset type
    pub asset: String,
    
    /// Amount
    pub amount: String,
    
    /// Sponsor account
    pub sponsor: String,
    
    /// Last modified ledger
    pub last_modified_ledger: u64,
    
    /// Claimants
    pub claimants: Vec<Claimant>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claimant {
    pub destination: String,
    pub predicate: serde_json::Value,
}

/// Transaction submission result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionResponse {
    pub hash: String,
    pub ledger: u64,
    pub envelope_xdr: String,
    pub result_xdr: String,
    pub result_meta_xdr: String,
    pub fee_charged: String,
    pub successful: bool,
}

/// Horizon error response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HorizonErrorResponse {
    #[serde(rename = "type")]
    pub error_type: Option<String>,
    pub title: Option<String>,
    pub status: Option<u16>,
    pub detail: Option<String>,
    pub extras: Option<HorizonErrorExtras>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HorizonErrorExtras {
    pub envelope_xdr: Option<String>,
    pub result_codes: Option<ResultCodes>,
    pub result_xdr: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResultCodes {
    pub transaction: Option<String>,
    pub operations: Option<Vec<String>>,
}

// ============================================================================
// HORIZON CLIENT
// ============================================================================

/// Client for Stellar Horizon API
pub struct HorizonClient {
    config: StellarConfig,
    http: Client,
}

impl HorizonClient {
    /// Create new Horizon client
    pub fn new(config: StellarConfig) -> Self {
        let http = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");
        
        Self { config, http }
    }
    
    /// Create client for mainnet
    pub fn mainnet() -> Self {
        Self::new(StellarConfig::mainnet())
    }
    
    /// Create client for testnet
    pub fn testnet() -> Self {
        Self::new(StellarConfig::testnet())
    }
    
    /// Get configuration
    pub fn config(&self) -> &StellarConfig {
        &self.config
    }
    
    // ==================== Account Operations ====================
    
    /// Check if account exists
    pub async fn account_exists(&self, address: &str) -> Result<bool> {
        let url = format!("{}/accounts/{}", self.config.horizon_url, address);
        
        let response = self.http.get(&url).send().await?;
        
        match response.status().as_u16() {
            200 => Ok(true),
            404 => Ok(false),
            429 => Err(PaymentError::RateLimited),
            status => {
                let error_text = response.text().await.unwrap_or_default();
                Err(PaymentError::HorizonError(format!(
                    "HTTP {}: {}", status, error_text
                )))
            }
        }
    }
    
    /// Load account information
    pub async fn load_account(&self, address: &str) -> Result<AccountInfo> {
        let url = format!("{}/accounts/{}", self.config.horizon_url, address);
        
        debug!("Loading account: {}", address);
        
        let response = self.http.get(&url).send().await?;
        
        match response.status().as_u16() {
            200 => {
                let account: AccountInfo = response.json().await?;
                Ok(account)
            }
            404 => Err(PaymentError::AccountNotFound(address.to_string())),
            429 => Err(PaymentError::RateLimited),
            status => {
                let error_text = response.text().await.unwrap_or_default();
                Err(PaymentError::HorizonError(format!(
                    "HTTP {}: {}", status, error_text
                )))
            }
        }
    }
    
    /// Get account balances
    pub async fn get_balances(&self, address: &str) -> Result<Vec<Balance>> {
        let account = self.load_account(address).await?;
        Ok(account.balances)
    }
    
    /// Get XLM balance
    pub async fn get_xlm_balance(&self, address: &str) -> Result<f64> {
        let account = self.load_account(address).await?;
        Ok(account.xlm_balance())
    }
    
    /// Get GNS token balance
    pub async fn get_gns_balance(&self, address: &str) -> Result<f64> {
        let account = self.load_account(address).await?;
        Ok(account
            .asset_balance(&self.config.gns_asset_code, &self.config.gns_issuer)
            .unwrap_or(0.0))
    }
    
    /// Check if account has GNS trustline
    pub async fn has_gns_trustline(&self, address: &str) -> Result<bool> {
        let account = self.load_account(address).await?;
        Ok(account.has_trustline(&self.config.gns_asset_code, &self.config.gns_issuer))
    }
    
    // ==================== Claimable Balances ====================
    
    /// Get claimable balances for an account
    pub async fn get_claimable_balances(&self, address: &str) -> Result<Vec<ClaimableBalance>> {
        let url = format!(
            "{}/claimable_balances?claimant={}",
            self.config.horizon_url, address
        );
        
        debug!("Fetching claimable balances for: {}", address);
        
        let response = self.http.get(&url).send().await?;
        
        match response.status().as_u16() {
            200 => {
                let data: serde_json::Value = response.json().await?;
                let records = data["_embedded"]["records"]
                    .as_array()
                    .cloned()
                    .unwrap_or_default();
                
                let balances: Vec<ClaimableBalance> = records
                    .into_iter()
                    .filter_map(|r| serde_json::from_value(r).ok())
                    .collect();
                
                Ok(balances)
            }
            429 => Err(PaymentError::RateLimited),
            status => {
                let error_text = response.text().await.unwrap_or_default();
                Err(PaymentError::HorizonError(format!(
                    "HTTP {}: {}", status, error_text
                )))
            }
        }
    }
    
    /// Get GNS claimable balances specifically
    pub async fn get_gns_claimable_balances(&self, address: &str) -> Result<Vec<ClaimableBalance>> {
        let all = self.get_claimable_balances(address).await?;
        
        let expected_asset = format!(
            "{}:{}",
            self.config.gns_asset_code,
            self.config.gns_issuer
        );
        
        Ok(all
            .into_iter()
            .filter(|b| b.asset == expected_asset)
            .collect())
    }
    
    // ==================== Transaction Submission ====================
    
    /// Submit a signed transaction
    pub async fn submit_transaction(&self, envelope_xdr: &str) -> Result<TransactionResponse> {
        let url = format!("{}/transactions", self.config.horizon_url);
        
        debug!("Submitting transaction...");
        
        let response = self.http
            .post(&url)
            .form(&[("tx", envelope_xdr)])
            .send()
            .await?;
        
        match response.status().as_u16() {
            200 => {
                let tx_response: TransactionResponse = response.json().await?;
                debug!("Transaction successful: {}", tx_response.hash);
                Ok(tx_response)
            }
            400 => {
                let error: HorizonErrorResponse = response.json().await?;
                let reason = error.extras
                    .and_then(|e| e.result_codes)
                    .map(|rc| format!(
                        "tx: {:?}, ops: {:?}",
                        rc.transaction,
                        rc.operations
                    ))
                    .unwrap_or_else(|| error.detail.unwrap_or_default());
                
                warn!("Transaction rejected: {}", reason);
                Err(PaymentError::TransactionRejected { reason })
            }
            429 => Err(PaymentError::RateLimited),
            504 => Err(PaymentError::TransactionTimeout),
            status => {
                let error_text = response.text().await.unwrap_or_default();
                Err(PaymentError::HorizonError(format!(
                    "HTTP {}: {}", status, error_text
                )))
            }
        }
    }
    
    // ==================== Testnet Only ====================
    
    /// Fund account using friendbot (testnet only)
    pub async fn friendbot_fund(&self, address: &str) -> Result<()> {
        let friendbot_url = self.config.friendbot_url()
            .ok_or_else(|| PaymentError::ConfigError(
                "Friendbot only available on testnet".to_string()
            ))?;
        
        let url = format!("{}?addr={}", friendbot_url, address);
        
        debug!("Requesting friendbot funding for: {}", address);
        
        let response = self.http.get(&url).send().await?;
        
        match response.status().as_u16() {
            200 => {
                debug!("Friendbot funded account: {}", address);
                Ok(())
            }
            status => {
                let error_text = response.text().await.unwrap_or_default();
                Err(PaymentError::HorizonError(format!(
                    "Friendbot HTTP {}: {}", status, error_text
                )))
            }
        }
    }
    
    // ==================== Fee Estimation ====================
    
    /// Get current fee stats
    pub async fn get_fee_stats(&self) -> Result<FeeStats> {
        let url = format!("{}/fee_stats", self.config.horizon_url);
        
        let response = self.http.get(&url).send().await?;
        let stats: FeeStats = response.json().await?;
        
        Ok(stats)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeeStats {
    pub last_ledger: String,
    pub last_ledger_base_fee: String,
    pub ledger_capacity_usage: String,
    pub fee_charged: FeeChargedStats,
    pub max_fee: MaxFeeStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeeChargedStats {
    pub max: String,
    pub min: String,
    pub mode: String,
    pub p10: String,
    pub p20: String,
    pub p30: String,
    pub p40: String,
    pub p50: String,
    pub p60: String,
    pub p70: String,
    pub p80: String,
    pub p90: String,
    pub p95: String,
    pub p99: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaxFeeStats {
    pub max: String,
    pub min: String,
    pub mode: String,
    pub p10: String,
    pub p20: String,
    pub p30: String,
    pub p40: String,
    pub p50: String,
    pub p60: String,
    pub p70: String,
    pub p80: String,
    pub p90: String,
    pub p95: String,
    pub p99: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_balance_is_native() {
        let xlm = Balance {
            asset_type: "native".to_string(),
            asset_code: "".to_string(),
            asset_issuer: "".to_string(),
            balance: "100.0".to_string(),
            limit: None,
            buying_liabilities: None,
            selling_liabilities: None,
        };
        
        assert!(xlm.is_native());
        assert_eq!(xlm.amount(), 100.0);
    }
    
    #[test]
    fn test_balance_matches_asset() {
        let gns = Balance {
            asset_type: "credit_alphanum4".to_string(),
            asset_code: "GNS".to_string(),
            asset_issuer: "GBVZT...".to_string(),
            balance: "500.0".to_string(),
            limit: None,
            buying_liabilities: None,
            selling_liabilities: None,
        };
        
        assert!(gns.matches_asset("GNS", "GBVZT..."));
        assert!(!gns.matches_asset("USD", "GBVZT..."));
    }
}
