// ============================================================================
// GNS-PAYMENTS - Error Types
// ============================================================================

use thiserror::Error;

#[derive(Error, Debug)]
pub enum PaymentError {
    // ==================== Key Errors ====================
    #[error("Invalid GNS public key: {0}")]
    InvalidGnsKey(String),
    
    #[error("Invalid Stellar address: {0}")]
    InvalidStellarAddress(String),
    
    #[error("Invalid secret key")]
    InvalidSecretKey,
    
    #[error("Key conversion failed: {0}")]
    KeyConversionError(String),

    // ==================== Account Errors ====================
    #[error("Account not found: {0}")]
    AccountNotFound(String),
    
    #[error("Account not funded (needs minimum XLM balance)")]
    AccountNotFunded,
    
    #[error("Insufficient balance: need {needed}, have {available}")]
    InsufficientBalance { needed: String, available: String },
    
    #[error("Trustline not established for asset {asset_code}")]
    NoTrustline { asset_code: String },

    // ==================== Transaction Errors ====================
    #[error("Transaction failed: {0}")]
    TransactionFailed(String),
    
    #[error("Transaction rejected: {reason}")]
    TransactionRejected { reason: String },
    
    #[error("Transaction timeout")]
    TransactionTimeout,
    
    #[error("Invalid transaction: {0}")]
    InvalidTransaction(String),
    
    #[error("Signing failed: {0}")]
    SigningError(String),

    // ==================== Network Errors ====================
    #[error("Horizon API error: {0}")]
    HorizonError(String),
    
    #[error("Network request failed: {0}")]
    NetworkError(String),
    
    #[error("Rate limited - try again later")]
    RateLimited,
    
    #[error("Network not configured")]
    NetworkNotConfigured,

    // ==================== Asset Errors ====================
    #[error("Invalid asset: {0}")]
    InvalidAsset(String),
    
    #[error("Asset not found: {code} issued by {issuer}")]
    AssetNotFound { code: String, issuer: String },

    // ==================== Claimable Balance Errors ====================
    #[error("Claimable balance not found: {0}")]
    ClaimableBalanceNotFound(String),
    
    #[error("Claimable balance expired")]
    ClaimableBalanceExpired,
    
    #[error("Not authorized to claim this balance")]
    NotAuthorizedToClaim,

    // ==================== Configuration Errors ====================
    #[error("Distribution wallet not configured")]
    DistributionWalletNotConfigured,
    
    #[error("Configuration error: {0}")]
    ConfigError(String),

    // ==================== Internal Errors ====================
    #[error("Internal error: {0}")]
    Internal(String),
    
    #[error("Serialization error: {0}")]
    SerializationError(String),
}

impl From<reqwest::Error> for PaymentError {
    fn from(err: reqwest::Error) -> Self {
        PaymentError::NetworkError(err.to_string())
    }
}

impl From<serde_json::Error> for PaymentError {
    fn from(err: serde_json::Error) -> Self {
        PaymentError::SerializationError(err.to_string())
    }
}

impl From<hex::FromHexError> for PaymentError {
    fn from(err: hex::FromHexError) -> Self {
        PaymentError::KeyConversionError(err.to_string())
    }
}
