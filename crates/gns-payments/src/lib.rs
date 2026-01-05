// ============================================================================
// GNS-PAYMENTS - Stellar Integration
// ============================================================================
// Real Stellar mainnet integration for GNS platform.
//
// Key insight: GNS identity (Ed25519 public key) = Stellar wallet address!
// The same cryptographic key that proves your identity also holds your tokens.
//
// Features:
// - Convert GNS hex keys ↔ Stellar G... addresses
// - Query account balances (XLM, GNS, any asset)
// - Send XLM payments
// - Send GNS token payments
// - Create/claim claimable balances
// - Manage trustlines
// ============================================================================

pub mod config;
pub mod strkey;
pub mod horizon;
pub mod transaction;
pub mod stellar_client;
pub mod error;

pub use config::{StellarConfig, Network};
pub use strkey::{gns_to_stellar, stellar_to_gns, encode_stellar_public_key, decode_stellar_public_key};
pub use horizon::{HorizonClient, AccountInfo, Balance, ClaimableBalance};
pub use transaction::{TransactionBuilder, TransactionResult};
pub use stellar_client::{StellarClient, SendResult, AirdropResult, WalletBalance};
pub use error::PaymentError;

/// Re-export for convenience
pub type Result<T> = std::result::Result<T, PaymentError>;
