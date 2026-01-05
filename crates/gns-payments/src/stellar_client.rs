// ============================================================================
// GNS-PAYMENTS - Stellar Client
// ============================================================================
// High-level client for Stellar operations.
// This is the main API that the Tauri app uses.
//
// Features:
// - Send XLM and GNS tokens
// - Create and claim claimable balances
// - Manage trustlines
// - Airdrop to new users
// ============================================================================

use crate::config::StellarConfig;
use crate::error::PaymentError;
use crate::horizon::{HorizonClient, ClaimableBalance};
use crate::strkey::{gns_to_stellar, stellar_to_gns};
use crate::transaction::{TransactionBuilder};
use crate::Result;
use ed25519_dalek::Keypair;
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

// ============================================================================
// RESULT TYPES
// ============================================================================

/// Result of a send operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendResult {
    pub success: bool,
    pub tx_hash: Option<String>,
    pub explorer_url: Option<String>,
    pub error: Option<String>,
}

/// Result of an airdrop operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AirdropResult {
    pub success: bool,
    pub stellar_address: String,
    pub xlm_tx_hash: Option<String>,
    pub gns_balance_id: Option<String>,
    pub error: Option<String>,
}

/// Wallet balance summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletBalance {
    pub stellar_address: String,
    pub gns_public_key: String,
    pub xlm_balance: f64,
    pub gns_balance: f64,
    pub available_xlm: f64,
    pub has_gns_trustline: bool,
    pub claimable_gns: f64,
}

// ============================================================================
// STELLAR CLIENT
// ============================================================================

/// High-level Stellar client for GNS
pub struct StellarClient {
    config: StellarConfig,
    horizon: HorizonClient,
    distribution_key: Option<Keypair>,
}

impl StellarClient {
    /// Create new client with config
    pub fn new(config: StellarConfig) -> Self {
        let horizon = HorizonClient::new(config.clone());
        Self {
            config,
            horizon,
            distribution_key: None,
        }
    }
    
    /// Create mainnet client
    pub fn mainnet() -> Self {
        Self::new(StellarConfig::mainnet())
    }
    
    /// Create testnet client
    pub fn testnet() -> Self {
        Self::new(StellarConfig::testnet())
    }
    
    /// Set distribution wallet for airdrops
    pub fn with_distribution_wallet(mut self, secret_key_bytes: &[u8; 32]) -> Self {
        use ed25519_dalek::{SecretKey, PublicKey};
        let secret = SecretKey::from_bytes(secret_key_bytes).expect("Invalid secret key bytes");
        let public = PublicKey::from(&secret);
        self.distribution_key = Some(Keypair { secret, public });
        self
    }
    
    /// Set distribution wallet from Stellar secret (S... format)
    pub fn with_distribution_secret(mut self, stellar_secret: &str) -> Result<Self> {
        use ed25519_dalek::{SecretKey, PublicKey};
        let secret_bytes = decode_stellar_secret(stellar_secret)?;
        let secret = SecretKey::from_bytes(&secret_bytes).map_err(|e| PaymentError::KeyConversionError(e.to_string()))?;
        let public = PublicKey::from(&secret);
        self.distribution_key = Some(Keypair { secret, public });
        
        let address = crate::strkey::encode_stellar_public_key(public.as_bytes())?;
        info!("Distribution wallet loaded: {}...", &address[..8]);
        
        Ok(self)
    }
    
    /// Get configuration
    pub fn config(&self) -> &StellarConfig {
        &self.config
    }
    
    /// Get horizon client
    pub fn horizon(&self) -> &HorizonClient {
        &self.horizon
    }
    
    // ==================== Key Conversion ====================
    
    /// Convert GNS hex public key to Stellar address
    pub fn gns_to_stellar(&self, gns_hex_key: &str) -> Result<String> {
        gns_to_stellar(gns_hex_key)
    }
    
    /// Convert Stellar address to GNS hex public key
    pub fn stellar_to_gns(&self, stellar_address: &str) -> Result<String> {
        stellar_to_gns(stellar_address)
    }
    
    // ==================== Account Queries ====================
    
    /// Check if account exists
    pub async fn account_exists(&self, stellar_address: &str) -> Result<bool> {
        self.horizon.account_exists(stellar_address).await
    }
    
    /// Check if GNS identity has a funded Stellar account
    pub async fn gns_account_exists(&self, gns_hex_key: &str) -> Result<bool> {
        let address = gns_to_stellar(gns_hex_key)?;
        self.horizon.account_exists(&address).await
    }
    
    /// Get full wallet balance information for a GNS key
    pub async fn get_wallet_balance(&self, gns_hex_key: &str) -> Result<WalletBalance> {
        let stellar_address = gns_to_stellar(gns_hex_key)?;
        
        // Check if account exists
        if !self.horizon.account_exists(&stellar_address).await? {
            return Ok(WalletBalance {
                stellar_address,
                gns_public_key: gns_hex_key.to_string(),
                xlm_balance: 0.0,
                gns_balance: 0.0,
                available_xlm: 0.0,
                has_gns_trustline: false,
                claimable_gns: 0.0,
            });
        }
        
        // Load account
        let account = self.horizon.load_account(&stellar_address).await?;
        
        // Get claimable balances
        let claimable = self.horizon.get_gns_claimable_balances(&stellar_address).await?;
        let claimable_gns: f64 = claimable
            .iter()
            .map(|b| b.amount.parse::<f64>().unwrap_or(0.0))
            .sum();
        
        Ok(WalletBalance {
            stellar_address,
            gns_public_key: gns_hex_key.to_string(),
            xlm_balance: account.xlm_balance(),
            gns_balance: account
                .asset_balance(&self.config.gns_asset_code, &self.config.gns_issuer)
                .unwrap_or(0.0),
            available_xlm: account.available_xlm(),
            has_gns_trustline: account.has_trustline(
                &self.config.gns_asset_code,
                &self.config.gns_issuer,
            ),
            claimable_gns,
        })
    }
    
    /// Get XLM balance
    pub async fn get_xlm_balance(&self, stellar_address: &str) -> Result<f64> {
        self.horizon.get_xlm_balance(stellar_address).await
    }
    
    /// Get GNS balance
    pub async fn get_gns_balance(&self, stellar_address: &str) -> Result<f64> {
        self.horizon.get_gns_balance(stellar_address).await
    }
    
    /// Get claimable GNS balances
    pub async fn get_claimable_balances(&self, stellar_address: &str) -> Result<Vec<ClaimableBalance>> {
        self.horizon.get_gns_claimable_balances(stellar_address).await
    }
    
    // ==================== Send Operations ====================
    
    /// Send XLM from one account to another
    pub async fn send_xlm(
        &self,
        sender_gns_key: &str,
        sender_secret_bytes: &[u8; 32],
        recipient_stellar_address: &str,
        amount: &str,
        memo: Option<&str>,
    ) -> Result<SendResult> {
        let sender_address = gns_to_stellar(sender_gns_key)?;
        
        // Load sender account
        let account = self.horizon.load_account(&sender_address).await?;
        
        // Check balance
        let amount_f64: f64 = amount.parse()
            .map_err(|_| PaymentError::InvalidTransaction("Invalid amount".to_string()))?;
        
        if account.available_xlm() < amount_f64 {
            return Ok(SendResult {
                success: false,
                tx_hash: None,
                explorer_url: None,
                error: Some(format!(
                    "Insufficient XLM: need {}, have {} available",
                    amount, account.available_xlm()
                )),
            });
        }
        
        // Check if recipient exists
        let recipient_exists = self.horizon.account_exists(recipient_stellar_address).await?;
        
        // Build transaction
        let mut builder = TransactionBuilder::new(&self.config, &account);
        
        if recipient_exists {
            builder = builder.payment_xlm(recipient_stellar_address, amount);
        } else {
            // Create account if it doesn't exist (requires minimum 1 XLM)
            if amount_f64 < 1.0 {
                return Ok(SendResult {
                    success: false,
                    tx_hash: None,
                    explorer_url: None,
                    error: Some("New accounts require at least 1 XLM".to_string()),
                });
            }
            builder = builder.create_account(recipient_stellar_address, amount);
        }
        
        // Add memo if provided
        if let Some(memo_text) = memo {
            builder = builder.memo_text(memo_text);
        }
        
        // Build and sign
        let unsigned = builder.build()?;
        let signed = unsigned.sign(sender_secret_bytes)?;
        
        // Submit
        match self.horizon.submit_transaction(&signed.envelope_xdr).await {
            Ok(response) => {
                info!("XLM sent: {} XLM -> {}", amount, recipient_stellar_address);
                Ok(SendResult {
                    success: true,
                    tx_hash: Some(response.hash.clone()),
                    explorer_url: Some(self.config.explorer_tx_url(&response.hash)),
                    error: None,
                })
            }
            Err(e) => {
                warn!("XLM send failed: {:?}", e);
                Ok(SendResult {
                    success: false,
                    tx_hash: None,
                    explorer_url: None,
                    error: Some(e.to_string()),
                })
            }
        }
    }
    
    /// Send GNS tokens from one account to another
    pub async fn send_gns(
        &self,
        sender_gns_key: &str,
        sender_secret_bytes: &[u8; 32],
        recipient_stellar_address: &str,
        amount: &str,
        memo: Option<&str>,
    ) -> Result<SendResult> {
        let sender_address = gns_to_stellar(sender_gns_key)?;
        
        // Load sender account
        let account = self.horizon.load_account(&sender_address).await?;
        
        // Check GNS balance
        let gns_balance = account
            .asset_balance(&self.config.gns_asset_code, &self.config.gns_issuer)
            .unwrap_or(0.0);
        
        let amount_f64: f64 = amount.parse()
            .map_err(|_| PaymentError::InvalidTransaction("Invalid amount".to_string()))?;
        
        if gns_balance < amount_f64 {
            return Ok(SendResult {
                success: false,
                tx_hash: None,
                explorer_url: None,
                error: Some(format!(
                    "Insufficient GNS: need {}, have {}",
                    amount, gns_balance
                )),
            });
        }
        
        // Check if recipient has trustline
        let recipient_has_trustline = self.horizon
            .has_gns_trustline(recipient_stellar_address)
            .await
            .unwrap_or(false);
        
        if !recipient_has_trustline {
            return Ok(SendResult {
                success: false,
                tx_hash: None,
                explorer_url: None,
                error: Some("Recipient doesn't have GNS trustline. Use claimable balance instead.".to_string()),
            });
        }
        
        // Build transaction
        let mut builder = TransactionBuilder::new(&self.config, &account)
            .payment_gns(recipient_stellar_address, amount);
        
        if let Some(memo_text) = memo {
            builder = builder.memo_text(memo_text);
        }
        
        // Build and sign
        let unsigned = builder.build()?;
        let signed = unsigned.sign(sender_secret_bytes)?;
        
        // Submit
        match self.horizon.submit_transaction(&signed.envelope_xdr).await {
            Ok(response) => {
                info!("GNS sent: {} GNS -> {}", amount, recipient_stellar_address);
                Ok(SendResult {
                    success: true,
                    tx_hash: Some(response.hash.clone()),
                    explorer_url: Some(self.config.explorer_tx_url(&response.hash)),
                    error: None,
                })
            }
            Err(e) => {
                warn!("GNS send failed: {:?}", e);
                Ok(SendResult {
                    success: false,
                    tx_hash: None,
                    explorer_url: None,
                    error: Some(e.to_string()),
                })
            }
        }
    }
    
    /// Send GNS to a GNS public key (converts to Stellar automatically)
    pub async fn send_gns_to_gns_key(
        &self,
        sender_gns_key: &str,
        sender_secret_bytes: &[u8; 32],
        recipient_gns_key: &str,
        amount: &str,
        memo: Option<&str>,
    ) -> Result<SendResult> {
        let recipient_address = gns_to_stellar(recipient_gns_key)?;
        self.send_gns(sender_gns_key, sender_secret_bytes, &recipient_address, amount, memo).await
    }
    
    // ==================== Trustline Operations ====================
    
    /// Create GNS trustline for an account
    pub async fn create_gns_trustline(
        &self,
        gns_key: &str,
        secret_bytes: &[u8; 32],
    ) -> Result<SendResult> {
        let address = gns_to_stellar(gns_key)?;
        
        // Load account
        let account = self.horizon.load_account(&address).await?;
        
        // Check if already has trustline
        if account.has_trustline(&self.config.gns_asset_code, &self.config.gns_issuer) {
            return Ok(SendResult {
                success: true,
                tx_hash: None,
                explorer_url: None,
                error: None,
            });
        }
        
        // Build transaction
        let builder = TransactionBuilder::new(&self.config, &account)
            .trust_gns();
        
        let unsigned = builder.build()?;
        let signed = unsigned.sign(secret_bytes)?;
        
        // Submit
        match self.horizon.submit_transaction(&signed.envelope_xdr).await {
            Ok(response) => {
                info!("GNS trustline created for: {}", address);
                Ok(SendResult {
                    success: true,
                    tx_hash: Some(response.hash.clone()),
                    explorer_url: Some(self.config.explorer_tx_url(&response.hash)),
                    error: None,
                })
            }
            Err(e) => {
                warn!("Trustline creation failed: {:?}", e);
                Ok(SendResult {
                    success: false,
                    tx_hash: None,
                    explorer_url: None,
                    error: Some(e.to_string()),
                })
            }
        }
    }
    
    // ==================== Claimable Balance Operations ====================
    
    /// Create a claimable GNS balance for a recipient
    pub async fn create_gns_claimable_balance(
        &self,
        sender_gns_key: &str,
        sender_secret_bytes: &[u8; 32],
        recipient_stellar_address: &str,
        amount: &str,
        expiry_days: Option<u32>,
    ) -> Result<SendResult> {
        let sender_address = gns_to_stellar(sender_gns_key)?;
        
        // Load sender account
        let account = self.horizon.load_account(&sender_address).await?;
        
        // Check GNS balance
        let gns_balance = account
            .asset_balance(&self.config.gns_asset_code, &self.config.gns_issuer)
            .unwrap_or(0.0);
        
        let amount_f64: f64 = amount.parse()
            .map_err(|_| PaymentError::InvalidTransaction("Invalid amount".to_string()))?;
        
        if gns_balance < amount_f64 {
            return Ok(SendResult {
                success: false,
                tx_hash: None,
                explorer_url: None,
                error: Some(format!(
                    "Insufficient GNS: need {}, have {}",
                    amount, gns_balance
                )),
            });
        }
        
        // Calculate expiry timestamp
        let days = expiry_days.unwrap_or(self.config.claimable_expiry_days);
        let expiry_timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            + (days as u64 * 24 * 60 * 60);
        
        // Build transaction
        let builder = TransactionBuilder::new(&self.config, &account)
            .create_gns_claimable_balance(recipient_stellar_address, amount, expiry_timestamp);
        
        let unsigned = builder.build()?;
        let signed = unsigned.sign(sender_secret_bytes)?;
        
        // Submit
        match self.horizon.submit_transaction(&signed.envelope_xdr).await {
            Ok(response) => {
                info!("GNS claimable balance created: {} GNS for {}", amount, recipient_stellar_address);
                Ok(SendResult {
                    success: true,
                    tx_hash: Some(response.hash.clone()),
                    explorer_url: Some(self.config.explorer_tx_url(&response.hash)),
                    error: None,
                })
            }
            Err(e) => {
                warn!("Claimable balance creation failed: {:?}", e);
                Ok(SendResult {
                    success: false,
                    tx_hash: None,
                    explorer_url: None,
                    error: Some(e.to_string()),
                })
            }
        }
    }
    
    /// Claim a claimable balance
    pub async fn claim_balance(
        &self,
        claimer_gns_key: &str,
        claimer_secret_bytes: &[u8; 32],
        balance_id: &str,
    ) -> Result<SendResult> {
        let address = gns_to_stellar(claimer_gns_key)?;
        
        // Load account
        let account = self.horizon.load_account(&address).await?;
        
        // Build transaction
        let builder = TransactionBuilder::new(&self.config, &account)
            .claim_balance(balance_id);
        
        let unsigned = builder.build()?;
        let signed = unsigned.sign(claimer_secret_bytes)?;
        
        // Submit
        match self.horizon.submit_transaction(&signed.envelope_xdr).await {
            Ok(response) => {
                info!("Claimable balance claimed: {}", balance_id);
                Ok(SendResult {
                    success: true,
                    tx_hash: Some(response.hash.clone()),
                    explorer_url: Some(self.config.explorer_tx_url(&response.hash)),
                    error: None,
                })
            }
            Err(e) => {
                warn!("Balance claim failed: {:?}", e);
                Ok(SendResult {
                    success: false,
                    tx_hash: None,
                    explorer_url: None,
                    error: Some(e.to_string()),
                })
            }
        }
    }
    
    // ==================== Airdrop Operations (requires distribution wallet) ====================
    
    /// Airdrop XLM and GNS to a new user
    pub async fn airdrop_to_new_user(&self, gns_hex_key: &str) -> Result<AirdropResult> {
        let distribution_key = self.distribution_key.as_ref()
            .ok_or(PaymentError::DistributionWalletNotConfigured)?;
        
        let stellar_address = gns_to_stellar(gns_hex_key)?;
        let distribution_address = crate::strkey::encode_stellar_public_key(
            distribution_key.public.as_bytes()
        )?;
        
        info!("Starting airdrop for {} -> {}", &gns_hex_key[..16], &stellar_address[..8]);
        
        // Load distribution account
        let dist_account = self.horizon.load_account(&distribution_address).await?;
        
        // Check if user account already exists
        let user_exists = self.horizon.account_exists(&stellar_address).await?;
        
        // Step 1: Send XLM (create account if needed)
        let xlm_result = if user_exists {
            // Account exists - just send XLM
            let builder = TransactionBuilder::new(&self.config, &dist_account)
                .payment_xlm(&stellar_address, &self.config.xlm_airdrop_amount)
                .memo_text("GNS Welcome Bonus");
            
            let unsigned = builder.build()?;
            let signed = unsigned.sign(distribution_key.secret.as_bytes())?;
            
            self.horizon.submit_transaction(&signed.envelope_xdr).await
        } else {
            // Create new account
            let builder = TransactionBuilder::new(&self.config, &dist_account)
                .create_account(&stellar_address, &self.config.xlm_airdrop_amount)
                .memo_text("GNS Welcome Bonus");
            
            let unsigned = builder.build()?;
            let signed = unsigned.sign(distribution_key.secret.as_bytes())?;
            
            self.horizon.submit_transaction(&signed.envelope_xdr).await
        };
        
        let xlm_tx_hash = match xlm_result {
            Ok(response) => Some(response.hash),
            Err(e) => {
                warn!("XLM airdrop failed: {:?}", e);
                return Ok(AirdropResult {
                    success: false,
                    stellar_address,
                    xlm_tx_hash: None,
                    gns_balance_id: None,
                    error: Some(format!("XLM airdrop failed: {}", e)),
                });
            }
        };
        
        // Small delay for network propagation
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        
        // Reload distribution account (sequence number changed)
        let dist_account = self.horizon.load_account(&distribution_address).await?;
        
        // Step 2: Create GNS claimable balance
        let expiry_timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            + (self.config.claimable_expiry_days as u64 * 24 * 60 * 60);
        
        let builder = TransactionBuilder::new(&self.config, &dist_account)
            .create_gns_claimable_balance(&stellar_address, &self.config.gns_airdrop_amount, expiry_timestamp);
        
        let unsigned = builder.build()?;
        let signed = unsigned.sign(distribution_key.secret.as_bytes())?;
        
        let gns_result = self.horizon.submit_transaction(&signed.envelope_xdr).await;
        
        let gns_balance_id = match gns_result {
            Ok(response) => Some(response.hash),
            Err(e) => {
                warn!("GNS claimable balance failed: {:?}", e);
                // Partial success - XLM was sent
                return Ok(AirdropResult {
                    success: false,
                    stellar_address,
                    xlm_tx_hash,
                    gns_balance_id: None,
                    error: Some(format!("GNS airdrop failed: {}", e)),
                });
            }
        };
        
        info!(
            "Airdrop complete: {} XLM + {} GNS -> {}",
            self.config.xlm_airdrop_amount,
            self.config.gns_airdrop_amount,
            &stellar_address[..8]
        );
        
        Ok(AirdropResult {
            success: true,
            stellar_address,
            xlm_tx_hash,
            gns_balance_id,
            error: None,
        })
    }
    
    /// Check if distribution wallet is configured
    pub fn has_distribution_wallet(&self) -> bool {
        self.distribution_key.is_some()
    }
    
    /// Get distribution wallet address
    pub fn get_distribution_address(&self) -> Option<String> {
        self.distribution_key.as_ref().map(|key| {
            crate::strkey::encode_stellar_public_key(key.public.as_bytes())
                .unwrap_or_default()
        })
    }
    
    // ==================== Testnet Utilities ====================
    
    /// Fund account using friendbot (testnet only)
    pub async fn friendbot_fund(&self, stellar_address: &str) -> Result<()> {
        self.horizon.friendbot_fund(stellar_address).await
    }
    
    /// Fund a GNS key using friendbot (testnet only)
    pub async fn friendbot_fund_gns(&self, gns_hex_key: &str) -> Result<()> {
        let address = gns_to_stellar(gns_hex_key)?;
        self.friendbot_fund(&address).await
    }
}

// ============================================================================
// STELLAR SECRET KEY DECODING
// ============================================================================

/// Decode Stellar secret key (S... format) to raw bytes
fn decode_stellar_secret(secret: &str) -> Result<[u8; 32]> {
    if !secret.starts_with('S') {
        return Err(PaymentError::InvalidSecretKey);
    }
    
    if secret.len() != 56 {
        return Err(PaymentError::InvalidSecretKey);
    }
    
    // Stellar secret key uses same base32 encoding as public keys
    // but with version byte 18 << 3 = 144 (0x90)
    let decoded = base32_decode(secret)?;
    
    if decoded.len() != 35 {
        return Err(PaymentError::InvalidSecretKey);
    }
    
    // Verify version byte (SECRET_KEY = 18 << 3 = 144)
    if decoded[0] != 144 {
        return Err(PaymentError::InvalidSecretKey);
    }
    
    // Extract secret key bytes
    let mut secret_bytes = [0u8; 32];
    secret_bytes.copy_from_slice(&decoded[1..33]);
    
    // Verify checksum
    let stored_checksum = (decoded[33] as u16) | ((decoded[34] as u16) << 8);
    let calculated_checksum = crc16(&decoded[0..33]);
    
    if stored_checksum != calculated_checksum {
        return Err(PaymentError::InvalidSecretKey);
    }
    
    Ok(secret_bytes)
}

// Base32 decode (same as in strkey.rs)
fn base32_decode(encoded: &str) -> Result<Vec<u8>> {
    let mut result = Vec::new();
    let mut buffer: u64 = 0;
    let mut bits_in_buffer = 0;
    
    for c in encoded.chars() {
        let value = match c {
            'A'..='Z' => (c as u8) - b'A',
            '2'..='7' => (c as u8) - b'2' + 26,
            _ => return Err(PaymentError::InvalidSecretKey),
        };
        
        buffer = (buffer << 5) | (value as u64);
        bits_in_buffer += 5;
        
        if bits_in_buffer >= 8 {
            bits_in_buffer -= 8;
            result.push(((buffer >> bits_in_buffer) & 0xFF) as u8);
        }
    }
    
    Ok(result)
}

// CRC16-CCITT (same as in strkey.rs)
fn crc16(data: &[u8]) -> u16 {
    const CRC16_POLY: u16 = 0x1021;
    let mut crc: u16 = 0;
    
    for &byte in data {
        crc ^= (byte as u16) << 8;
        for _ in 0..8 {
            if crc & 0x8000 != 0 {
                crc = (crc << 1) ^ CRC16_POLY;
            } else {
                crc <<= 1;
            }
        }
    }
    
    crc
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_client_creation() {
        let client = StellarClient::mainnet();
        assert!(client.config().is_mainnet());
        assert!(!client.has_distribution_wallet());
    }
    
    #[test]
    fn test_testnet_client() {
        let client = StellarClient::testnet();
        assert!(!client.config().is_mainnet());
    }
    
    #[test]
    fn test_key_conversion() {
        let client = StellarClient::mainnet();
        
        let gns_key = "0000000000000000000000000000000000000000000000000000000000000000";
        let stellar = client.gns_to_stellar(gns_key).unwrap();
        let back = client.stellar_to_gns(&stellar).unwrap();
        
        assert_eq!(gns_key, back);
    }
}
