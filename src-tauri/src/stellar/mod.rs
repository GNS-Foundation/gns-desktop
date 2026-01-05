//! Stellar Network Integration for GNS
//!
//! Converts GNS Ed25519 keys to Stellar addresses and handles:
//! - Balance queries via Horizon REST API
//! - Trustline creation
//! - GNS token transfers
//! - Claimable balance claims

pub mod backend;

use reqwest::Client;
use serde::{Deserialize, Serialize};
use gns_crypto_core::GnsIdentity;
// Imports moved to inner function scope where needed or removed if unused


use std::convert::TryInto; // For array conversion
use base64::Engine; // Import Engine trait

pub use backend::StellarBackendClient;

// ==================== CONFIGURATION ====================

/// Stellar network configuration
#[derive(Clone)]
pub struct StellarConfig {
    pub horizon_url: String,
    pub network_passphrase: String,
    pub gns_token_code: String,
    pub gns_issuer: String,
    pub use_testnet: bool,
    pub backend_url: Option<String>,
}

impl Default for StellarConfig {
    fn default() -> Self {
        Self::mainnet()
    }
}

impl StellarConfig {
    pub fn mainnet() -> Self {
        Self {
            horizon_url: "https://horizon.stellar.org".to_string(),
            network_passphrase: "Public Global Stellar Network ; September 2015".to_string(),
            gns_token_code: "GNS".to_string(),
            gns_issuer: "GBVZTFST4PIPV5C3APDIVULNZYZENQSLGDSOKOVQI77GSMT6WVYGF5GL".to_string(),
            use_testnet: false,
            backend_url: Some("https://gns-stellar-backend-production.up.railway.app/stellar".to_string()),
        }
    }

    pub fn testnet() -> Self {
        Self {
            horizon_url: "https://horizon-testnet.stellar.org".to_string(),
            network_passphrase: "Test SDF Network ; September 2015".to_string(),
            gns_token_code: "GNS".to_string(),
            gns_issuer: "GBVZTFST4PIPV5C3APDIVULNZYZENQSLGDSOKOVQI77GSMT6WVYGF5GL".to_string(),
            use_testnet: true,
            backend_url: Some("https://gns-stellar-backend-production.up.railway.app/stellar".to_string()),
        }
    }
}

// ==================== DATA TYPES ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StellarBalance {
    pub asset_code: String,
    pub asset_issuer: Option<String>,
    pub balance: String,
    pub is_native: bool,
}

impl StellarBalance {
    pub fn amount(&self) -> f64 {
        self.balance.parse().unwrap_or(0.0)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimableBalance {
    pub balance_id: String,
    pub asset_code: String,
    pub asset_issuer: Option<String>,
    pub amount: String,
    pub sponsor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StellarBalances {
    pub stellar_address: String,
    pub account_exists: bool,
    pub xlm_balance: f64,
    pub gns_balance: f64,
    pub has_trustline: bool,
    pub claimable_gns: Vec<ClaimableBalance>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionResult {
    pub success: bool,
    pub hash: Option<String>,
    pub error: Option<String>,
}

impl TransactionResult {
    pub fn ok(hash: String) -> Self {
        Self { success: true, hash: Some(hash), error: None }
    }

    pub fn err(error: String) -> Self {
        Self { success: false, hash: None, error: Some(error) }
    }
}

// ==================== HORIZON API RESPONSES ====================

#[derive(Debug, Deserialize)]
struct HorizonAccount {
    #[allow(dead_code)]
    id: String,
    sequence: String,
    balances: Vec<HorizonBalance>,
}

#[derive(Debug, Deserialize)]
struct HorizonBalance {
    balance: String,
    asset_type: String,
    asset_code: Option<String>,
    asset_issuer: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HorizonClaimableBalancesResponse {
    #[serde(rename = "_embedded")]
    embedded: HorizonClaimableBalancesEmbedded,
}

#[derive(Debug, Deserialize)]
struct HorizonClaimableBalancesEmbedded {
    records: Vec<HorizonClaimableBalance>,
}

#[derive(Debug, Deserialize)]
struct HorizonClaimableBalance {
    id: String,
    asset: String,
    amount: String,
    sponsor: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HorizonTransactionResponse {
    successful: Option<bool>,
    hash: Option<String>,
    #[serde(default)]
    extras: Option<HorizonExtras>,
}

#[derive(Debug, Deserialize, Default)]
struct HorizonExtras {
    result_codes: Option<HorizonResultCodes>,
}

#[derive(Debug, Deserialize)]
struct HorizonResultCodes {
    #[allow(dead_code)]
    transaction: Option<String>,
    operations: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct HorizonPaymentsResponse {
    #[serde(rename = "_embedded")]
    embedded: HorizonPaymentsEmbedded,
}

#[derive(Debug, Deserialize)]
struct HorizonPaymentsEmbedded {
    records: Vec<HorizonPayment>,
}

#[derive(Debug, Deserialize)]
struct HorizonPayment {
    id: String,
    transaction_hash: String,
    created_at: String,
    #[serde(rename = "type")]
    payment_type: String,
    from: Option<String>,
    to: Option<String>,
    amount: Option<String>,
    starting_balance: Option<String>,
    asset_code: Option<String>,
    asset_type: Option<String>,
}

// ==================== STELLAR SERVICE ====================

pub struct StellarService {
    config: StellarConfig,
    client: Client,
    backend: StellarBackendClient,
}

impl StellarService {
    pub fn new(config: StellarConfig) -> Self {
        Self {
            client: Client::new(),
            backend: StellarBackendClient::new(config.backend_url.as_deref()),
            config,
        }
    }

    pub fn mainnet() -> Self {
        Self::new(StellarConfig::mainnet())
    }

    pub fn testnet() -> Self {
        Self::new(StellarConfig::testnet())
    }

    pub fn config(&self) -> &StellarConfig {
        &self.config
    }

    // ==================== KEY CONVERSION ====================

    /// Convert GNS hex public key (32 bytes Ed25519) to Stellar G... address
    pub fn gns_key_to_stellar(gns_hex_public_key: &str) -> Result<String, StellarError> {
        let clean_hex = gns_hex_public_key.replace("0x", "").to_lowercase();

        if clean_hex.len() != 64 {
            return Err(StellarError::InvalidKeyLength(clean_hex.len()));
        }

        let public_key_bytes = hex::decode(&clean_hex)
            .map_err(|e| StellarError::HexDecodeError(e.to_string()))?;

        // Stellar address encoding:
        // 1. Prepend version byte (0x30 for G... addresses = account ID)
        // 2. Append 2-byte CRC16 checksum
        // 3. Base32 encode

        let mut payload = vec![0x30]; // G... version byte
        payload.extend_from_slice(&public_key_bytes);

        // Calculate CRC16-XModem checksum
        let checksum = crc16_xmodem(&payload);
        payload.push((checksum & 0xFF) as u8);
        payload.push((checksum >> 8) as u8);

        // Base32 encode (Stellar uses RFC 4648 without padding)
        Ok(base32_encode(&payload))
    }

    // ==================== ACCOUNT OPERATIONS ====================

    /// Check if Stellar account exists
    pub async fn account_exists(&self, stellar_address: &str) -> bool {
        let url = format!("{}/accounts/{}", self.config.horizon_url, stellar_address);

        match self.client.get(&url).send().await {
            Ok(response) => response.status().is_success(),
            Err(_) => false,
        }
    }

    /// Get account details from Horizon
    async fn get_account(&self, stellar_address: &str) -> Result<HorizonAccount, StellarError> {
        let url = format!("{}/accounts/{}", self.config.horizon_url, stellar_address);

        let response = self.client.get(&url).send().await
            .map_err(|e| StellarError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(StellarError::AccountNotFound);
        }

        response.json().await
            .map_err(|e| StellarError::ParseError(e.to_string()))
    }

    /// Get all balances for account
    pub async fn get_balances(&self, stellar_address: &str) -> Result<Vec<StellarBalance>, StellarError> {
        let account = self.get_account(stellar_address).await?;

        Ok(account.balances.into_iter().map(|b| {
            let is_native = b.asset_type == "native";
            StellarBalance {
                asset_code: if is_native { "XLM".to_string() } else { b.asset_code.unwrap_or_default() },
                asset_issuer: b.asset_issuer,
                balance: b.balance,
                is_native,
            }
        }).collect())
    }

    /// Get GNS token balance specifically
    pub async fn get_gns_balance(&self, stellar_address: &str) -> Result<f64, StellarError> {
        let balances = self.get_balances(stellar_address).await?;

        for balance in balances {
            if balance.asset_code == self.config.gns_token_code
                && balance.asset_issuer.as_deref() == Some(&self.config.gns_issuer)
            {
                return Ok(balance.amount());
            }
        }

        Ok(0.0)
    }

    /// Check if account has GNS trustline
    pub async fn has_gns_trustline(&self, stellar_address: &str) -> Result<bool, StellarError> {
        let balances = self.get_balances(stellar_address).await?;

        Ok(balances.iter().any(|b| {
            b.asset_code == self.config.gns_token_code
                && b.asset_issuer.as_deref() == Some(&self.config.gns_issuer)
        }))
    }

    /// Get comprehensive balance info
    pub async fn get_stellar_balances(&self, gns_hex_public_key: &str) -> Result<StellarBalances, StellarError> {
        let stellar_address = Self::gns_key_to_stellar(gns_hex_public_key)?;

        let account_exists = self.account_exists(&stellar_address).await;

        let (xlm_balance, gns_balance, has_trustline) = if account_exists {
            let balances = self.get_balances(&stellar_address).await?;

            let xlm = balances.iter()
                .find(|b| b.is_native)
                .map(|b| b.amount())
                .unwrap_or(0.0);

            let gns = balances.iter()
                .find(|b| b.asset_code == self.config.gns_token_code
                    && b.asset_issuer.as_deref() == Some(&self.config.gns_issuer))
                .map(|b| b.amount())
                .unwrap_or(0.0);

            let has_trustline = balances.iter().any(|b|
                b.asset_code == self.config.gns_token_code
                    && b.asset_issuer.as_deref() == Some(&self.config.gns_issuer)
            );

            (xlm, gns, has_trustline)
        } else {
            (0.0, 0.0, false)
        };

        // Get claimable balances (works even without account)
        let claimable_gns = self.get_gns_claimable_balances(&stellar_address).await
            .unwrap_or_default();

        Ok(StellarBalances {
            stellar_address,
            account_exists,
            xlm_balance,
            gns_balance,
            has_trustline,
            claimable_gns,
        })
    }

    // ==================== CLAIMABLE BALANCES ====================

    /// Get claimable balances for an account
    pub async fn get_claimable_balances(&self, stellar_address: &str) -> Result<Vec<ClaimableBalance>, StellarError> {
        let url = format!(
            "{}/claimable_balances?claimant={}",
            self.config.horizon_url,
            stellar_address
        );

        let response = self.client.get(&url).send().await
            .map_err(|e| StellarError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            return Ok(vec![]);
        }

        let data: HorizonClaimableBalancesResponse = response.json().await
            .map_err(|e| StellarError::ParseError(e.to_string()))?;

        Ok(data.embedded.records.into_iter().map(|r| {
            // Parse asset string (e.g., "GNS:GBVZ..." or "native")
            let (asset_code, asset_issuer) = if r.asset == "native" {
                ("XLM".to_string(), None)
            } else {
                let parts: Vec<&str> = r.asset.split(':').collect();
                if parts.len() == 2 {
                    (parts[0].to_string(), Some(parts[1].to_string()))
                } else {
                    (r.asset.clone(), None)
                }
            };

            ClaimableBalance {
                balance_id: r.id,
                asset_code,
                asset_issuer,
                amount: r.amount,
                sponsor: r.sponsor,
            }
        }).collect())
    }

    /// Get GNS claimable balances specifically
    pub async fn get_gns_claimable_balances(&self, stellar_address: &str) -> Result<Vec<ClaimableBalance>, StellarError> {
        let all = self.get_claimable_balances(stellar_address).await?;

        Ok(all.into_iter().filter(|cb| {
            cb.asset_code == self.config.gns_token_code
                && cb.asset_issuer.as_deref() == Some(&self.config.gns_issuer)
        }).collect())
    }

    // ==================== PAYMENT HISTORY ====================

    /// Get payment history from Horizon
    pub async fn get_payment_history(&self, stellar_address: &str, limit: u32) -> Result<Vec<PaymentHistoryItem>, StellarError> {
        let url = format!(
            "{}/accounts/{}/payments?limit={}&order=desc",
            self.config.horizon_url,
            stellar_address,
            limit
        );

        let response = self.client.get(&url).send().await
            .map_err(|e| StellarError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            return Ok(vec![]);
        }

        let data: HorizonPaymentsResponse = response.json().await
            .map_err(|e| StellarError::ParseError(e.to_string()))?;

        Ok(data.embedded.records.into_iter()
            .filter(|p| p.payment_type == "payment" || p.payment_type == "create_account")
            .map(|p| {
                let direction = if p.from.as_deref() == Some(stellar_address) {
                    "sent".to_string()
                } else {
                    "received".to_string()
                };

                let amount = if p.payment_type == "create_account" {
                    p.starting_balance.unwrap_or_default()
                } else {
                    p.amount.unwrap_or_default()
                };

                let asset_code = if p.payment_type == "create_account" {
                    "XLM".to_string()
                } else {
                    p.asset_code.unwrap_or_else(|| {
                        if p.asset_type.as_deref() == Some("native") {
                            "XLM".to_string()
                        } else {
                            "Unknown".to_string()
                        }
                    })
                };

                PaymentHistoryItem {
                    id: p.id,
                    tx_hash: p.transaction_hash,
                    created_at: p.created_at,
                    direction,
                    amount,
                    asset_code,
                    from_address: p.from.unwrap_or_default(),
                    to_address: p.to.unwrap_or_default(),
                    memo: None,
                }
            })
            .collect())
    }

    // ==================== TESTNET OPERATIONS ====================

    /// Fund account via Friendbot (testnet only)
    pub async fn fund_testnet(&self, stellar_address: &str) -> Result<bool, StellarError> {
        if !self.config.use_testnet {
            return Err(StellarError::TestnetOnly);
        }

        let url = format!("https://friendbot.stellar.org?addr={}", stellar_address);

        let response = self.client.get(&url).send().await
            .map_err(|e| StellarError::NetworkError(e.to_string()))?;

        Ok(response.status().is_success())
    }

    // ==================== TRANSACTION OPERATIONS ====================
    // Note: These require XDR building. For MVP, recommend using backend-assisted signing.

    /// Create GNS trustline via backend
    pub async fn create_gns_trustline(
        &self,
        public_key_hex: &str,
        private_key_bytes: &[u8],
    ) -> Result<TransactionResult, StellarError> {
        let private_key_hex = hex::encode(private_key_bytes);
        
        // Reconstruct identity for signing (since we have the seed/bytes)
        let identity = GnsIdentity::from_hex(&private_key_hex)
            .map_err(|e| StellarError::InvalidKeyLength(e.to_string().len()))?; // Rough mapping
            // Note: Ideally we'd map to a generic "KeyError", but using what we have.

        let sign_fn = |msg: &str| {
            let signature = identity.sign(msg.as_bytes());
            Ok(hex::encode(signature.to_bytes()))
        };

        let network = if self.config.use_testnet { Some("testnet") } else { None };

        let initial_response = self.backend.create_trustline(public_key_hex, network, None, sign_fn).await;

        match initial_response {
            Ok(response) => {
                if response.success {
                    Ok(TransactionResult { success: true, hash: response.hash, error: None })
                } else if response.error.as_deref() == Some("SIGN_REQUIRED") {
                     // Get XDR, sign it, and resubmit
                     if let Some(xdr) = response.hash {
                        let signed_xdr = self.sign_transaction(&xdr, private_key_bytes)?;
                        
                        // Re-create sign_fn because it's consumed or we need a fresh one? 
                        // Actually Fn is OK.
                        let sign_fn_2 = |msg: &str| {
                            let signature = identity.sign(msg.as_bytes());
                            Ok(hex::encode(signature.to_bytes()))
                        };

                        let final_res = self.backend.create_trustline(public_key_hex, network, Some(&signed_xdr), sign_fn_2).await;
                        match final_res {
                            Ok(r) => Ok(TransactionResult { success: r.success, hash: r.hash, error: r.error }),
                            Err(e) => Ok(TransactionResult { success: false, hash: None, error: Some(e) }),
                        }
                     } else {
                        Ok(TransactionResult { success: false, hash: None, error: Some("SIGN_REQUIRED but no XDR returned".to_string()) })
                     }
                } else {
                    Ok(TransactionResult { success: false, hash: response.hash, error: response.error })
                }
            },
            Err(e) => Ok(TransactionResult { success: false, hash: None, error: Some(e) }),
        }
    }

    /// Claim a claimable balance (placeholder - needs XDR implementation or backend)
    pub async fn claim_balance(
        &self,
        _stellar_address: &str,
        _private_key_bytes: &[u8],
        _balance_id: &str,
    ) -> Result<TransactionResult, StellarError> {
        // TODO: Implement XDR building or call backend
        Err(StellarError::NotImplemented(
            "Use backend-assisted transaction signing for MVP".to_string()
        ))
    }

    /// Send GNS tokens via backend
    pub async fn send_gns(
        &self,
        sender_public_key: &str,
        sender_private_key: &[u8],
        _recipient_public_key: Option<&str>,
        _recipient_handle: Option<&str>, // Not used directly here, but could be passed in memo? The backend handles logic.
        // Actually backend.send_gns takes explicit args.
        // Let's match backend arguments best as possible.
        // wait, backend.send_gns has recipient_stellar_address OR recipient_public_key.
        recipient_input: &str, // This could be address or public key
        amount: f64,
    ) -> Result<TransactionResult, StellarError> {
        let private_key_hex = hex::encode(sender_private_key);
        let identity = GnsIdentity::from_hex(&private_key_hex)
            .map_err(|e| StellarError::InvalidKeyLength(e.to_string().len()))?;

        let sign_fn = |msg: &str| {
            let signature = identity.sign(msg.as_bytes());
            Ok(hex::encode(signature.to_bytes()))
        };

        // Determine if recipient is address or key
        let (recipient_address, recipient_pk) = if recipient_input.starts_with('G') {
            (Some(recipient_input), None)
        } else {
            (None, Some(recipient_input))
        };

        let network = if self.config.use_testnet { Some("testnet") } else { None };

        let initial_res = self.backend.send_gns(
            recipient_address, 
            recipient_pk, 
            amount, 
            None, 
            sender_public_key, 
            network,
            None,
            sign_fn
        ).await;

        match initial_res {
             Ok(response) => {
                  if response.success {
                      Ok(TransactionResult { success: true, hash: response.hash, error: None })
                  } else if response.error.as_deref() == Some("SIGN_REQUIRED") {
                       if let Some(xdr) = response.hash {
                           let signed_xdr = self.sign_transaction(&xdr, sender_private_key)?;

                           let sign_fn_2 = |msg: &str| {
                                let signature = identity.sign(msg.as_bytes());
                                Ok(hex::encode(signature.to_bytes()))
                           };

                           let final_res = self.backend.send_gns(
                                recipient_address, 
                                recipient_pk, 
                                amount, 
                                None, 
                                sender_public_key, 
                                network,
                                Some(&signed_xdr),
                                sign_fn_2
                           ).await;

                           match final_res {
                                Ok(r) => Ok(TransactionResult { success: r.success, hash: r.hash, error: r.error }),
                                Err(e) => Ok(TransactionResult { success: false, hash: None, error: Some(e) }),
                           }
                       } else {
                           Ok(TransactionResult { success: false, hash: None, error: Some("SIGN_REQUIRED but no XDR".to_string()) })
                       }
                  } else {
                      Ok(TransactionResult { success: false, hash: response.hash, error: response.error })
                  }
             },
             Err(e) => Ok(TransactionResult { success: false, hash: None, error: Some(e) }),
        }
    }

    /// Claim all GNS tokens via backend
    pub async fn claim_all_gns(
        &self,
        public_key_hex: &str,
        private_key_bytes: &[u8],
    ) -> Result<TransactionResult, StellarError> {
        let private_key_hex = hex::encode(private_key_bytes);
        let identity = GnsIdentity::from_hex(&private_key_hex)
            .map_err(|e| StellarError::InvalidKeyLength(e.to_string().len()))?;

        let sign_fn = |msg: &str| {
            let signature = identity.sign(msg.as_bytes());
            Ok(hex::encode(signature.to_bytes()))
        };

        let network = if self.config.use_testnet { Some("testnet") } else { None };

        let initial_res = self.backend.claim_gns(public_key_hex, network, None, sign_fn, None).await;

        match initial_res {
             Ok(response) => {
                  if response.success {
                       Ok(TransactionResult { success: true, hash: response.hash, error: None })
                  } else if response.error.as_deref() == Some("SIGN_REQUIRED") || response.error.as_deref() == Some("COSIGN_REQUIRED") {
                       // Note: COSIGN_REQUIRED uses same mechanism
                       if let Some(xdr) = response.hash {
                            let signed_xdr = self.sign_transaction(&xdr, private_key_bytes)?;
                            
                            let sign_fn_2 = |msg: &str| {
                                let signature = identity.sign(msg.as_bytes());
                                Ok(hex::encode(signature.to_bytes()))
                            };

                            let final_res = self.backend.claim_gns(public_key_hex, network, Some(&signed_xdr), sign_fn_2, None).await;
                            
                             match final_res {
                                Ok(r) => Ok(TransactionResult { success: r.success, hash: r.hash, error: r.error }),
                                Err(e) => Ok(TransactionResult { success: false, hash: None, error: Some(e) }),
                            }
                       } else {
                            Ok(TransactionResult { success: false, hash: None, error: Some("SIGN_REQUIRED but no XDR".to_string()) })
                       }
                  } else {
                       Ok(TransactionResult { success: false, hash: response.hash, error: response.error })
                  }
             },
             Err(e) => Ok(TransactionResult { success: false, hash: None, error: Some(e) }),
        }
    }

    // ==================== SIGNING HELPER ====================

    /// Parse, sign, and re-serialize a transaction XDR
    fn sign_transaction(
        &self,
        xdr_base64: &str,
        private_key_bytes: &[u8],
    ) -> Result<String, StellarError> {
        use stellar_xdr::curr::{
            Hash, Limits, TransactionEnvelope, TransactionSignaturePayload,
            TransactionSignaturePayloadTaggedTransaction, DecoratedSignature, Signature,
            SignatureHint, WriteXdr, ReadXdr, 
        };
        use sha2::{Sha256, Digest};

        use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;

        // 1. Decode base64
        let xdr_bytes = BASE64_STANDARD.decode(xdr_base64)
            .map_err(|e| StellarError::Validation(format!("Invalid base64 XDR: {}", e)))?;

        // 2. Parse XDR
        let mut envelope = TransactionEnvelope::from_xdr(&xdr_bytes, Limits::none())
            .map_err(|e| StellarError::Validation(format!("Invalid XDR: {}", e)))?;

        // 3. Prepare Network ID
        let network_passphrase = &self.config.network_passphrase;
        let network_hash = Sha256::digest(network_passphrase.as_bytes());
        let network_id = Hash(network_hash.into());

        // 4. Construct Signature Payload
        let tagged_tx = match &envelope {
            TransactionEnvelope::Tx(v1) => TransactionSignaturePayloadTaggedTransaction::Tx(v1.tx.clone()),
            TransactionEnvelope::TxFeeBump(v1) => TransactionSignaturePayloadTaggedTransaction::TxFeeBump(v1.tx.clone()),
            _ => return Err(StellarError::Validation("Unsupported transaction type".to_string())),
        };

        let payload = TransactionSignaturePayload {
            network_id,
            tagged_transaction: tagged_tx,
        };

        // 5. Hash Payload
        let payload_bytes = payload.to_xdr(Limits::none())
             .map_err(|e| StellarError::Validation(format!("XDR encoding error: {}", e)))?;
        let payload_hash = Sha256::digest(&payload_bytes);

        // 6. Sign Hash
        let private_key_hex = hex::encode(private_key_bytes);
        let identity = GnsIdentity::from_hex(&private_key_hex)
            .map_err(|_| StellarError::Validation("Invalid identity".to_string()))?;
        
        // Note: GnsIdentity::sign typically signs the message bytes (Ed25519). 
        // Stellar requires signing the SHA256 hash of the payload.
        // We pass the hash as the message.
        let signature_bytes = identity.sign(&payload_hash);
        let signature_vec = signature_bytes.to_bytes().to_vec();

        // 7. Add signature to envelope
        let pub_key_bytes = identity.public_key_bytes();
        let hint_bytes: [u8; 4] = pub_key_bytes[28..32].try_into().unwrap();
        
        let decorated_sig = DecoratedSignature {
            hint: SignatureHint(hint_bytes),
            signature: Signature(signature_vec.try_into().map_err(|_| StellarError::Validation("Signature length mismatch".to_string()))?),
        };
        
        match &mut envelope {
             TransactionEnvelope::Tx(v1) => {
                 let mut sigs = v1.signatures.to_vec();
                 sigs.push(decorated_sig);
                 v1.signatures = sigs.try_into().map_err(|_| StellarError::Validation("Too many signatures".to_string()))?;
             },
             TransactionEnvelope::TxFeeBump(v1) => {
                 let mut sigs = v1.signatures.to_vec();
                 sigs.push(decorated_sig);
                 v1.signatures = sigs.try_into().map_err(|_| StellarError::Validation("Too many signatures".to_string()))?;
             },
             _ => {},
        }
        
        // 8. Encode
        let signed_xdr_bytes = envelope.to_xdr(Limits::none())
            .map_err(|e| StellarError::Validation(format!("XDR encoding error: {}", e)))?;
            
        Ok(BASE64_STANDARD.encode(signed_xdr_bytes))
    }
}

// ==================== PAYMENT HISTORY ITEM ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentHistoryItem {
    pub id: String,
    pub tx_hash: String,
    pub created_at: String,
    pub direction: String,
    pub amount: String,
    pub asset_code: String,
    pub from_address: String,
    pub to_address: String,
    pub memo: Option<String>,
}

// ==================== ERROR TYPES ====================

#[derive(Debug, thiserror::Error)]
pub enum StellarError {
    #[error("Invalid key length: {0}, expected 64 hex chars")]
    InvalidKeyLength(usize),

    #[error("Hex decode error: {0}")]
    HexDecodeError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Account not found")]
    AccountNotFound,

    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("This operation only works on testnet")]
    TestnetOnly,

    #[error("Not implemented: {0}")]
    NotImplemented(String),

    #[error("Validation error: {0}")]
    Validation(String),
}

// ==================== HELPER FUNCTIONS ====================

/// CRC16-XModem checksum (used by Stellar for address encoding)
fn crc16_xmodem(data: &[u8]) -> u16 {
    let mut crc: u16 = 0;
    for byte in data {
        let mut code = crc >> 8;
        code ^= *byte as u16;
        code ^= code >> 4;
        crc = (crc << 8) ^ (code << 12) ^ (code << 5) ^ code;
    }
    crc
}

/// Base32 encode (RFC 4648, no padding - Stellar format)
fn base32_encode(data: &[u8]) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    let mut result = String::new();
    let mut buffer: u64 = 0;
    let mut bits_left = 0;

    for &byte in data {
        buffer = (buffer << 8) | byte as u64;
        bits_left += 8;

        while bits_left >= 5 {
            bits_left -= 5;
            let index = ((buffer >> bits_left) & 0x1F) as usize;
            result.push(ALPHABET[index] as char);
        }
    }

    if bits_left > 0 {
        buffer <<= 5 - bits_left;
        let index = (buffer & 0x1F) as usize;
        result.push(ALPHABET[index] as char);
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gns_key_to_stellar() {
        // Test with a 64-char hex key
        let gns_key = "5940f0ab33863be19c2b437ddcea18ef88ddce56dcc9f3f87cf88cb6954aee7c";
        
        let result = StellarService::gns_key_to_stellar(gns_key);
        assert!(result.is_ok());
        
        let stellar_addr = result.unwrap();
        assert!(stellar_addr.starts_with('G'));
        assert_eq!(stellar_addr.len(), 56);
    }

    #[test]
    fn test_invalid_key_length() {
        let short_key = "5940f0ab33863be1";
        let result = StellarService::gns_key_to_stellar(short_key);
        assert!(result.is_err());
    }

    #[test]
    fn test_crc16_xmodem() {
        // Test vector - just verify it produces a value
        let data = vec![0x30, 0x00, 0x00, 0x00];
        let crc = crc16_xmodem(&data);
        assert!(crc > 0);
    }
}
