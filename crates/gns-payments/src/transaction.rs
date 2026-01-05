// ============================================================================
// GNS-PAYMENTS - Transaction Builder
// ============================================================================
// Build and sign Stellar transactions for payments, trustlines, etc.
//
// Stellar transactions consist of:
// - Source account
// - Sequence number (incremented each transaction)
// - Fee
// - Time bounds
// - Memo (optional)
// - Operations (payment, create account, change trust, etc.)
// - Signatures
// ============================================================================

use crate::config::StellarConfig;
use crate::error::PaymentError;
use crate::horizon::AccountInfo;
use crate::strkey::{decode_stellar_public_key};
use crate::Result;
use ed25519_dalek::{Keypair, Signer};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

// ============================================================================
// TRANSACTION TYPES
// ============================================================================

/// Transaction operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Operation {
    /// Create a new account with starting balance
    CreateAccount {
        destination: String,
        starting_balance: String,
    },
    
    /// Payment of native XLM or any asset
    Payment {
        destination: String,
        asset: Asset,
        amount: String,
    },
    
    /// Create or modify trustline
    ChangeTrust {
        asset: Asset,
        limit: Option<String>,
    },
    
    /// Create claimable balance
    CreateClaimableBalance {
        asset: Asset,
        amount: String,
        claimants: Vec<ClaimantSpec>,
    },
    
    /// Claim a claimable balance
    ClaimClaimableBalance {
        balance_id: String,
    },
}

/// Stellar asset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Asset {
    Native,
    CreditAlphaNum4 { code: String, issuer: String },
    CreditAlphaNum12 { code: String, issuer: String },
}

impl Asset {
    /// Create native XLM asset
    pub fn native() -> Self {
        Asset::Native
    }
    
    /// Create custom asset
    pub fn credit(code: &str, issuer: &str) -> Self {
        if code.len() <= 4 {
            Asset::CreditAlphaNum4 {
                code: code.to_string(),
                issuer: issuer.to_string(),
            }
        } else {
            Asset::CreditAlphaNum12 {
                code: code.to_string(),
                issuer: issuer.to_string(),
            }
        }
    }
    
    /// Check if native
    pub fn is_native(&self) -> bool {
        matches!(self, Asset::Native)
    }
}

/// Claimant specification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimantSpec {
    pub destination: String,
    pub predicate: ClaimPredicate,
}

/// Claim predicate (conditions for claiming)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ClaimPredicate {
    Unconditional,
    BeforeAbsoluteTime(u64),
    BeforeRelativeTime(u64),
    And(Box<ClaimPredicate>, Box<ClaimPredicate>),
    Or(Box<ClaimPredicate>, Box<ClaimPredicate>),
    Not(Box<ClaimPredicate>),
}

/// Transaction memo
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum Memo {
    #[default]
    None,
    Text(String),
    Id(u64),
    Hash([u8; 32]),
    Return([u8; 32]),
}

/// Built transaction result
#[derive(Debug, Clone)]
pub struct TransactionResult {
    pub hash: String,
    pub envelope_xdr: String,
}

// ============================================================================
// TRANSACTION BUILDER
// ============================================================================

/// Builder for Stellar transactions
pub struct TransactionBuilder {
    config: StellarConfig,
    source_account: String,
    sequence: u64,
    fee: u32,
    operations: Vec<Operation>,
    memo: Memo,
    timeout_seconds: u64,
}

impl TransactionBuilder {
    /// Create new transaction builder
    pub fn new(config: &StellarConfig, source_account: &AccountInfo) -> Self {
        Self {
            config: config.clone(),
            source_account: source_account.id.clone(),
            sequence: source_account.sequence.parse::<u64>().unwrap_or(0) + 1,
            fee: config.base_fee,
            operations: Vec::new(),
            memo: Memo::None,
            timeout_seconds: 30,
        }
    }
    
    /// Create builder from account address and sequence
    pub fn from_sequence(
        config: &StellarConfig,
        source_account: &str,
        sequence: u64,
    ) -> Self {
        Self {
            config: config.clone(),
            source_account: source_account.to_string(),
            sequence: sequence + 1,
            fee: config.base_fee,
            operations: Vec::new(),
            memo: Memo::None,
            timeout_seconds: 30,
        }
    }
    
    /// Set fee per operation (in stroops)
    pub fn fee(mut self, fee: u32) -> Self {
        self.fee = fee;
        self
    }
    
    /// Set memo
    pub fn memo(mut self, memo: Memo) -> Self {
        self.memo = memo;
        self
    }
    
    /// Set text memo
    pub fn memo_text(mut self, text: &str) -> Self {
        self.memo = Memo::Text(text.to_string());
        self
    }
    
    /// Set timeout
    pub fn timeout(mut self, seconds: u64) -> Self {
        self.timeout_seconds = seconds;
        self
    }
    
    /// Add operation
    pub fn add_operation(mut self, op: Operation) -> Self {
        self.operations.push(op);
        self
    }
    
    /// Add create account operation
    pub fn create_account(self, destination: &str, starting_balance: &str) -> Self {
        self.add_operation(Operation::CreateAccount {
            destination: destination.to_string(),
            starting_balance: starting_balance.to_string(),
        })
    }
    
    /// Add XLM payment operation
    pub fn payment_xlm(self, destination: &str, amount: &str) -> Self {
        self.add_operation(Operation::Payment {
            destination: destination.to_string(),
            asset: Asset::Native,
            amount: amount.to_string(),
        })
    }
    
    /// Add asset payment operation
    pub fn payment_asset(
        self,
        destination: &str,
        asset_code: &str,
        asset_issuer: &str,
        amount: &str,
    ) -> Self {
        self.add_operation(Operation::Payment {
            destination: destination.to_string(),
            asset: Asset::credit(asset_code, asset_issuer),
            amount: amount.to_string(),
        })
    }
    
    /// Add GNS payment operation (uses config)
    pub fn payment_gns(self, destination: &str, amount: &str) -> Self {
        let asset_code = self.config.gns_asset_code.clone();
        let issuer = self.config.gns_issuer.clone();
        self.add_operation(Operation::Payment {
            destination: destination.to_string(),
            asset: Asset::credit(&asset_code, &issuer),
            amount: amount.to_string(),
        })
    }
    
    /// Add change trust operation (create trustline)
    pub fn change_trust(self, asset_code: &str, asset_issuer: &str, limit: Option<&str>) -> Self {
        self.add_operation(Operation::ChangeTrust {
            asset: Asset::credit(asset_code, asset_issuer),
            limit: limit.map(|s| s.to_string()),
        })
    }
    
    /// Add GNS trustline operation
    pub fn trust_gns(self) -> Self {
        let asset_code = self.config.gns_asset_code.clone();
        let issuer = self.config.gns_issuer.clone();
        self.add_operation(Operation::ChangeTrust {
            asset: Asset::credit(&asset_code, &issuer),
            limit: None,
        })
    }
    
    /// Add create claimable balance operation
    pub fn create_claimable_balance(
        self,
        asset_code: &str,
        asset_issuer: &str,
        amount: &str,
        claimants: Vec<ClaimantSpec>,
    ) -> Self {
        let asset = if asset_code.is_empty() {
            Asset::Native
        } else {
            Asset::credit(asset_code, asset_issuer)
        };
        
        self.add_operation(Operation::CreateClaimableBalance {
            asset,
            amount: amount.to_string(),
            claimants,
        })
    }
    
    /// Add GNS claimable balance with expiry
    pub fn create_gns_claimable_balance(
        self,
        recipient: &str,
        amount: &str,
        expiry_timestamp: u64,
    ) -> Self {
        let asset_code = self.config.gns_asset_code.clone();
        let issuer = self.config.gns_issuer.clone();
        self.create_claimable_balance(
            &asset_code,
            &issuer,
            amount,
            vec![ClaimantSpec {
                destination: recipient.to_string(),
                predicate: ClaimPredicate::BeforeAbsoluteTime(expiry_timestamp),
            }],
        )
    }
    
    /// Add claim claimable balance operation
    pub fn claim_balance(self, balance_id: &str) -> Self {
        self.add_operation(Operation::ClaimClaimableBalance {
            balance_id: balance_id.to_string(),
        })
    }
    
    /// Build the transaction (returns XDR envelope ready for signing)
    pub fn build(self) -> Result<UnsignedTransaction> {
        if self.operations.is_empty() {
            return Err(PaymentError::InvalidTransaction(
                "Transaction must have at least one operation".to_string()
            ));
        }
        
        // Calculate total fee (per operation)
        let total_fee = self.fee * self.operations.len() as u32;
        
        // Calculate time bounds
        let max_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            + self.timeout_seconds;
        
        Ok(UnsignedTransaction {
            config: self.config,
            source_account: self.source_account,
            sequence: self.sequence,
            fee: total_fee,
            min_time: 0,
            max_time,
            operations: self.operations,
            memo: self.memo,
        })
    }
}

// ============================================================================
// UNSIGNED TRANSACTION
// ============================================================================

/// Unsigned transaction ready for signing
pub struct UnsignedTransaction {
    config: StellarConfig,
    source_account: String,
    sequence: u64,
    fee: u32,
    min_time: u64,
    max_time: u64,
    operations: Vec<Operation>,
    memo: Memo,
}

impl UnsignedTransaction {
    /// Sign the transaction with Ed25519 secret key bytes
    pub fn sign(self, secret_key_bytes: &[u8; 32]) -> Result<TransactionResult> {
        use ed25519_dalek::{SecretKey, PublicKey};
        
        // Create keypair from secret bytes
        let secret = SecretKey::from_bytes(secret_key_bytes).map_err(|_| PaymentError::SigningError("Invalid secret key".into()))?;
        let public = PublicKey::from(&secret);
        let keypair = Keypair { secret, public };
        let public_key_bytes = public.as_bytes();
        
        // Build transaction XDR
        let tx_xdr = self.to_xdr()?;
        
        // Hash the transaction for signing
        // Stellar uses: sha256(network_passphrase) + sha256(ENVELOPE_TYPE_TX) + tx_xdr
        let network_id = {
            let mut hasher = Sha256::new();
            hasher.update(self.config.network_passphrase.as_bytes());
            hasher.finalize()
        };
        
        // Transaction hash = sha256(network_id + envelope_type + tx)
        let mut payload = Vec::new();
        payload.extend_from_slice(&network_id);
        payload.extend_from_slice(&[0, 0, 0, 2]); // ENVELOPE_TYPE_TX = 2
        payload.extend_from_slice(&tx_xdr);
        
        let tx_hash = {
            let mut hasher = Sha256::new();
            hasher.update(&payload);
            hasher.finalize()
        };
        
        // Sign the hash
        let signature = keypair.sign(&tx_hash);
        
        // Build envelope XDR with signature
        let envelope_xdr = self.build_envelope_xdr(&tx_xdr, public_key_bytes, signature.to_bytes().as_slice())?;
        
        // Encode as base64
        let envelope_base64 = base64_encode(&envelope_xdr);
        
        Ok(TransactionResult {
            hash: hex::encode(tx_hash),
            envelope_xdr: envelope_base64,
        })
    }
    
    /// Build transaction XDR (without envelope)
    fn to_xdr(&self) -> Result<Vec<u8>> {
        let mut xdr = Vec::new();
        
        // Source account (MuxedAccount)
        self.write_muxed_account(&mut xdr, &self.source_account)?;
        
        // Fee
        xdr.extend_from_slice(&self.fee.to_be_bytes());
        
        // Sequence number
        xdr.extend_from_slice(&self.sequence.to_be_bytes());
        
        // Preconditions (V2 format)
        // Type: PRECOND_TIME = 1
        xdr.extend_from_slice(&[0, 0, 0, 1]);
        // TimeBounds
        xdr.extend_from_slice(&self.min_time.to_be_bytes());
        xdr.extend_from_slice(&self.max_time.to_be_bytes());
        
        // Memo
        self.write_memo(&mut xdr)?;
        
        // Operations array
        xdr.extend_from_slice(&(self.operations.len() as u32).to_be_bytes());
        for op in &self.operations {
            self.write_operation(&mut xdr, op)?;
        }
        
        // Ext (reserved for future)
        xdr.extend_from_slice(&[0, 0, 0, 0]);
        
        Ok(xdr)
    }
    
    fn write_muxed_account(&self, xdr: &mut Vec<u8>, address: &str) -> Result<()> {
        let key_bytes = decode_stellar_public_key(address)?;
        
        // KEY_TYPE_ED25519 = 0
        xdr.extend_from_slice(&[0, 0, 0, 0]);
        xdr.extend_from_slice(&key_bytes);
        
        Ok(())
    }
    
    fn write_memo(&self, xdr: &mut Vec<u8>) -> Result<()> {
        match &self.memo {
            Memo::None => {
                // MEMO_NONE = 0
                xdr.extend_from_slice(&[0, 0, 0, 0]);
            }
            Memo::Text(text) => {
                // MEMO_TEXT = 1
                xdr.extend_from_slice(&[0, 0, 0, 1]);
                // String with length prefix
                let bytes = text.as_bytes();
                let padded_len = (bytes.len() + 3) / 4 * 4;
                xdr.extend_from_slice(&(bytes.len() as u32).to_be_bytes());
                xdr.extend_from_slice(bytes);
                // Pad to 4-byte boundary
                for _ in 0..(padded_len - bytes.len()) {
                    xdr.push(0);
                }
            }
            Memo::Id(id) => {
                // MEMO_ID = 2
                xdr.extend_from_slice(&[0, 0, 0, 2]);
                xdr.extend_from_slice(&id.to_be_bytes());
            }
            Memo::Hash(hash) | Memo::Return(hash) => {
                // MEMO_HASH = 3, MEMO_RETURN = 4
                let memo_type = if matches!(&self.memo, Memo::Hash(_)) { 3u32 } else { 4u32 };
                xdr.extend_from_slice(&memo_type.to_be_bytes());
                xdr.extend_from_slice(hash);
            }
        }
        Ok(())
    }
    
    fn write_operation(&self, xdr: &mut Vec<u8>, op: &Operation) -> Result<()> {
        // Source account (optional - none for same as tx source)
        xdr.extend_from_slice(&[0, 0, 0, 0]); // No source override
        
        match op {
            Operation::CreateAccount { destination, starting_balance } => {
                // CREATE_ACCOUNT = 0
                xdr.extend_from_slice(&[0, 0, 0, 0]);
                self.write_account_id(xdr, destination)?;
                self.write_int64(xdr, starting_balance)?;
            }
            
            Operation::Payment { destination, asset, amount } => {
                // PAYMENT = 1
                xdr.extend_from_slice(&[0, 0, 0, 1]);
                self.write_muxed_account(xdr, destination)?;
                self.write_asset(xdr, asset)?;
                self.write_int64(xdr, amount)?;
            }
            
            Operation::ChangeTrust { asset, limit } => {
                // CHANGE_TRUST = 6
                xdr.extend_from_slice(&[0, 0, 0, 6]);
                // ChangeTrustAsset (same as Asset for our purposes)
                self.write_change_trust_asset(xdr, asset)?;
                // Limit (max if not specified)
                let limit_value = limit.as_deref().unwrap_or("922337203685.4775807");
                self.write_int64(xdr, limit_value)?;
            }
            
            Operation::CreateClaimableBalance { asset, amount, claimants } => {
                // CREATE_CLAIMABLE_BALANCE = 14
                xdr.extend_from_slice(&[0, 0, 0, 14]);
                self.write_asset(xdr, asset)?;
                self.write_int64(xdr, amount)?;
                
                // Claimants array
                xdr.extend_from_slice(&(claimants.len() as u32).to_be_bytes());
                for claimant in claimants {
                    self.write_claimant(xdr, claimant)?;
                }
            }
            
            Operation::ClaimClaimableBalance { balance_id } => {
                // CLAIM_CLAIMABLE_BALANCE = 15
                xdr.extend_from_slice(&[0, 0, 0, 15]);
                // Balance ID is a ClaimableBalanceID
                self.write_claimable_balance_id(xdr, balance_id)?;
            }
        }
        
        Ok(())
    }
    
    fn write_account_id(&self, xdr: &mut Vec<u8>, address: &str) -> Result<()> {
        let key_bytes = decode_stellar_public_key(address)?;
        // PUBLIC_KEY_TYPE_ED25519 = 0
        xdr.extend_from_slice(&[0, 0, 0, 0]);
        xdr.extend_from_slice(&key_bytes);
        Ok(())
    }
    
    fn write_asset(&self, xdr: &mut Vec<u8>, asset: &Asset) -> Result<()> {
        match asset {
            Asset::Native => {
                // ASSET_TYPE_NATIVE = 0
                xdr.extend_from_slice(&[0, 0, 0, 0]);
            }
            Asset::CreditAlphaNum4 { code, issuer } => {
                // ASSET_TYPE_CREDIT_ALPHANUM4 = 1
                xdr.extend_from_slice(&[0, 0, 0, 1]);
                // Asset code (4 bytes, padded)
                let mut code_bytes = [0u8; 4];
                let code_slice = code.as_bytes();
                code_bytes[..code_slice.len().min(4)].copy_from_slice(&code_slice[..code_slice.len().min(4)]);
                xdr.extend_from_slice(&code_bytes);
                // Issuer
                self.write_account_id(xdr, issuer)?;
            }
            Asset::CreditAlphaNum12 { code, issuer } => {
                // ASSET_TYPE_CREDIT_ALPHANUM12 = 2
                xdr.extend_from_slice(&[0, 0, 0, 2]);
                // Asset code (12 bytes, padded)
                let mut code_bytes = [0u8; 12];
                let code_slice = code.as_bytes();
                code_bytes[..code_slice.len().min(12)].copy_from_slice(&code_slice[..code_slice.len().min(12)]);
                xdr.extend_from_slice(&code_bytes);
                // Issuer
                self.write_account_id(xdr, issuer)?;
            }
        }
        Ok(())
    }
    
    fn write_change_trust_asset(&self, xdr: &mut Vec<u8>, asset: &Asset) -> Result<()> {
        // ChangeTrustAsset is same as Asset for credit assets
        // (pool shares would be different but we don't support those)
        self.write_asset(xdr, asset)
    }
    
    fn write_claimant(&self, xdr: &mut Vec<u8>, claimant: &ClaimantSpec) -> Result<()> {
        // CLAIMANT_TYPE_V0 = 0
        xdr.extend_from_slice(&[0, 0, 0, 0]);
        self.write_account_id(xdr, &claimant.destination)?;
        self.write_claim_predicate(xdr, &claimant.predicate)?;
        Ok(())
    }
    
    fn write_claim_predicate(&self, xdr: &mut Vec<u8>, predicate: &ClaimPredicate) -> Result<()> {
        match predicate {
            ClaimPredicate::Unconditional => {
                // CLAIM_PREDICATE_UNCONDITIONAL = 0
                xdr.extend_from_slice(&[0, 0, 0, 0]);
            }
            ClaimPredicate::BeforeAbsoluteTime(timestamp) => {
                // CLAIM_PREDICATE_BEFORE_ABSOLUTE_TIME = 4
                xdr.extend_from_slice(&[0, 0, 0, 4]);
                xdr.extend_from_slice(&(*timestamp as i64).to_be_bytes());
            }
            ClaimPredicate::BeforeRelativeTime(seconds) => {
                // CLAIM_PREDICATE_BEFORE_RELATIVE_TIME = 5
                xdr.extend_from_slice(&[0, 0, 0, 5]);
                xdr.extend_from_slice(&(*seconds as i64).to_be_bytes());
            }
            ClaimPredicate::And(left, right) => {
                // CLAIM_PREDICATE_AND = 1
                xdr.extend_from_slice(&[0, 0, 0, 1]);
                // Array of 2 predicates
                xdr.extend_from_slice(&[0, 0, 0, 2]);
                self.write_claim_predicate(xdr, left)?;
                self.write_claim_predicate(xdr, right)?;
            }
            ClaimPredicate::Or(left, right) => {
                // CLAIM_PREDICATE_OR = 2
                xdr.extend_from_slice(&[0, 0, 0, 2]);
                // Array of 2 predicates
                xdr.extend_from_slice(&[0, 0, 0, 2]);
                self.write_claim_predicate(xdr, left)?;
                self.write_claim_predicate(xdr, right)?;
            }
            ClaimPredicate::Not(inner) => {
                // CLAIM_PREDICATE_NOT = 3
                xdr.extend_from_slice(&[0, 0, 0, 3]);
                // Optional predicate (present)
                xdr.extend_from_slice(&[0, 0, 0, 1]);
                self.write_claim_predicate(xdr, inner)?;
            }
        }
        Ok(())
    }
    
    fn write_claimable_balance_id(&self, xdr: &mut Vec<u8>, balance_id: &str) -> Result<()> {
        // ClaimableBalanceID: type (0 = v0) + hash
        // Balance ID format: "00000000..." (hex hash)
        let hash_bytes = hex::decode(balance_id)
            .map_err(|_| PaymentError::InvalidTransaction("Invalid balance ID".to_string()))?;
        
        // CLAIMABLE_BALANCE_ID_TYPE_V0 = 0
        xdr.extend_from_slice(&[0, 0, 0, 0]);
        xdr.extend_from_slice(&hash_bytes);
        
        Ok(())
    }
    
    fn write_int64(&self, xdr: &mut Vec<u8>, amount: &str) -> Result<()> {
        // Parse amount string to stroops (7 decimal places)
        let parsed: f64 = amount.parse()
            .map_err(|_| PaymentError::InvalidTransaction(format!("Invalid amount: {}", amount)))?;
        let stroops = (parsed * 10_000_000.0) as i64;
        xdr.extend_from_slice(&stroops.to_be_bytes());
        Ok(())
    }
    
    fn build_envelope_xdr(
        &self,
        tx_xdr: &[u8],
        public_key_bytes: &[u8],
        signature: &[u8],
    ) -> Result<Vec<u8>> {
        let mut envelope = Vec::new();
        
        // ENVELOPE_TYPE_TX = 2
        envelope.extend_from_slice(&[0, 0, 0, 2]);
        
        // Transaction
        envelope.extend_from_slice(tx_xdr);
        
        // Signatures array (1 signature)
        envelope.extend_from_slice(&[0, 0, 0, 1]);
        
        // DecoratedSignature
        // Hint (last 4 bytes of public key)
        envelope.extend_from_slice(&public_key_bytes[28..32]);
        // Signature (variable length opaque)
        envelope.extend_from_slice(&(signature.len() as u32).to_be_bytes());
        envelope.extend_from_slice(signature);
        // Pad to 4-byte boundary
        let padding = (4 - (signature.len() % 4)) % 4;
        for _ in 0..padding {
            envelope.push(0);
        }
        
        Ok(envelope)
    }
}

// ============================================================================
// HELPERS
// ============================================================================

fn base64_encode(data: &[u8]) -> String {
    use base64::{Engine as _, engine::general_purpose};
    general_purpose::STANDARD.encode(data)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_asset_native() {
        let asset = Asset::native();
        assert!(asset.is_native());
    }
    
    #[test]
    fn test_asset_credit() {
        let asset = Asset::credit("GNS", "GBVZT...");
        assert!(!asset.is_native());
    }
    
    #[test]
    fn test_builder_no_ops() {
        let config = StellarConfig::testnet();
        let account = AccountInfo {
            id: "GAAA...".to_string(),
            sequence: "100".to_string(),
            balances: vec![],
            subentry_count: 0,
            thresholds: Default::default(),
            flags: Default::default(),
            home_domain: None,
            inflation_destination: None,
        };
        
        let builder = TransactionBuilder::new(&config, &account);
        let result = builder.build();
        
        // Should fail - no operations
        assert!(result.is_err());
    }
}
