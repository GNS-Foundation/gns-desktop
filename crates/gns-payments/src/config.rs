// ============================================================================
// GNS-PAYMENTS - Configuration
// ============================================================================
// Network configuration for Stellar mainnet and testnet.

use serde::{Deserialize, Serialize};

/// Network selection
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Network {
    Mainnet,
    Testnet,
}

impl Default for Network {
    fn default() -> Self {
        // Default to MAINNET for production
        #[cfg(feature = "mainnet")]
        return Network::Mainnet;
        
        #[cfg(feature = "testnet")]
        return Network::Testnet;
        
        #[cfg(not(any(feature = "mainnet", feature = "testnet")))]
        return Network::Mainnet;
    }
}

/// Stellar network configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StellarConfig {
    /// Network (mainnet or testnet)
    pub network: Network,
    
    /// Horizon API URL
    pub horizon_url: String,
    
    /// Network passphrase for transaction signing
    pub network_passphrase: String,
    
    /// GNS Token asset code
    pub gns_asset_code: String,
    
    /// GNS Token issuer (Stellar address)
    pub gns_issuer: String,
    
    /// Base fee in stroops (1 XLM = 10,000,000 stroops)
    pub base_fee: u32,
    
    /// Default XLM airdrop amount for new accounts
    pub xlm_airdrop_amount: String,
    
    /// Default GNS airdrop amount for new handles
    pub gns_airdrop_amount: String,
    
    /// Claimable balance expiry in days
    pub claimable_expiry_days: u32,
}

impl StellarConfig {
    /// Create mainnet configuration
    pub fn mainnet() -> Self {
        Self {
            network: Network::Mainnet,
            horizon_url: "https://horizon.stellar.org".to_string(),
            network_passphrase: "Public Global Stellar Network ; September 2015".to_string(),
            gns_asset_code: "GNS".to_string(),
            gns_issuer: "GBVZTFST4PIPV5C3APDIVULNZYZENQSLGDSOKOVQI77GSMT6WVYGF5GL".to_string(),
            base_fee: 100, // 0.00001 XLM
            xlm_airdrop_amount: "2".to_string(),    // 2 XLM to activate
            gns_airdrop_amount: "200".to_string(),  // 200 GNS welcome bonus
            claimable_expiry_days: 30,
        }
    }
    
    /// Create testnet configuration
    pub fn testnet() -> Self {
        Self {
            network: Network::Testnet,
            horizon_url: "https://horizon-testnet.stellar.org".to_string(),
            network_passphrase: "Test SDF Network ; September 2015".to_string(),
            gns_asset_code: "GNS".to_string(),
            // Testnet issuer (different from mainnet)
            gns_issuer: "GBVZTFST4PIPV5C3APDIVULNZYZENQSLGDSOKOVQI77GSMT6WVYGF5GL".to_string(),
            base_fee: 100,
            xlm_airdrop_amount: "10".to_string(),   // More generous on testnet
            gns_airdrop_amount: "1000".to_string(),
            claimable_expiry_days: 30,
        }
    }
    
    /// Get friendbot URL (testnet only)
    pub fn friendbot_url(&self) -> Option<&str> {
        match self.network {
            Network::Testnet => Some("https://friendbot.stellar.org"),
            Network::Mainnet => None,
        }
    }
    
    /// Check if this is mainnet
    pub fn is_mainnet(&self) -> bool {
        self.network == Network::Mainnet
    }
    
    /// Get Stellar Expert explorer URL for an address
    pub fn explorer_account_url(&self, address: &str) -> String {
        match self.network {
            Network::Mainnet => format!("https://stellar.expert/explorer/public/account/{}", address),
            Network::Testnet => format!("https://stellar.expert/explorer/testnet/account/{}", address),
        }
    }
    
    /// Get Stellar Expert explorer URL for a transaction
    pub fn explorer_tx_url(&self, hash: &str) -> String {
        match self.network {
            Network::Mainnet => format!("https://stellar.expert/explorer/public/tx/{}", hash),
            Network::Testnet => format!("https://stellar.expert/explorer/testnet/tx/{}", hash),
        }
    }
}

impl Default for StellarConfig {
    fn default() -> Self {
        Self::mainnet()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_mainnet_config() {
        let config = StellarConfig::mainnet();
        assert_eq!(config.network, Network::Mainnet);
        assert!(config.horizon_url.contains("horizon.stellar.org"));
        assert!(!config.horizon_url.contains("testnet"));
        assert!(config.friendbot_url().is_none());
    }
    
    #[test]
    fn test_testnet_config() {
        let config = StellarConfig::testnet();
        assert_eq!(config.network, Network::Testnet);
        assert!(config.horizon_url.contains("testnet"));
        assert!(config.friendbot_url().is_some());
    }
}
