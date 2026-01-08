//! Stellar Tauri Commands
//!
//! Exposes Stellar/GNS token functionality to the React frontend

use tauri::State;
use serde::{Deserialize, Serialize};
use crate::AppState;
use crate::stellar::{StellarService, PaymentHistoryItem, StellarError};

// ==================== RESPONSE TYPES ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StellarBalancesResponse {
    pub stellar_address: String,
    pub account_exists: bool,
    pub xlm_balance: f64,
    pub gns_balance: f64,
    pub has_trustline: bool,
    pub claimable_gns: Vec<ClaimableBalanceResponse>,
    pub use_testnet: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimableBalanceResponse {
    pub balance_id: String,
    pub amount: String,
    pub asset_code: String,
    pub sponsor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionResponse {
    pub success: bool,
    pub hash: Option<String>,
    pub error: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendGnsRequest {
    pub recipient_handle: Option<String>,
    pub recipient_public_key: Option<String>,
    pub amount: f64,
    pub memo: Option<String>,
}

// ==================== COMMANDS ====================

/// Get Stellar address for current identity
#[tauri::command]
pub async fn get_stellar_address(
    state: State<'_, AppState>,
) -> Result<String, String> {
    let identity = state.identity.lock().await;
    
    let public_key = identity.public_key()
        .ok_or("No identity found")?;
    
    // Convert GNS key to Stellar address
    StellarService::gns_key_to_stellar(&public_key)
        .map_err(|e| e.to_string())
}

/// Get Stellar Explorer URL for account
#[tauri::command]
pub async fn get_stellar_explorer_url(
    state: State<'_, AppState>,
) -> Result<String, String> {
    let identity = state.identity.lock().await;
    let public_key = identity.public_key().ok_or("No identity found")?;
    let stellar_address = StellarService::gns_key_to_stellar(&public_key)
        .map_err(|e| e.to_string())?;
    
    let stellar = state.stellar.lock().await;
    let base_url = if stellar.config().use_testnet {
        "https://stellar.expert/explorer/testnet/account"
    } else {
        "https://stellar.expert/explorer/public/account"
    };
    
    Ok(format!("{}/{}", base_url, stellar_address))
}

/// Get comprehensive Stellar balances
#[tauri::command]
pub async fn get_stellar_balances(
    state: State<'_, AppState>,
) -> Result<StellarBalancesResponse, String> {
    let identity = state.identity.lock().await;
    
    let public_key = identity.public_key()
        .ok_or("No identity found")?;
    
    // Get Stellar service
    let stellar = state.stellar.lock().await;
    
    let balances = stellar.get_stellar_balances(&public_key).await
        .map_err(|e| e.to_string())?;
    
    Ok(StellarBalancesResponse {
        stellar_address: balances.stellar_address,
        account_exists: balances.account_exists,
        xlm_balance: balances.xlm_balance,
        gns_balance: balances.gns_balance,
        has_trustline: balances.has_trustline,
        claimable_gns: balances.claimable_gns.into_iter().map(|cb| {
            ClaimableBalanceResponse {
                balance_id: cb.balance_id,
                amount: cb.amount,
                asset_code: cb.asset_code,
                sponsor: cb.sponsor,
            }
        }).collect(),
        use_testnet: stellar.config().use_testnet,
    })
}

/// Claim all GNS tokens (creates trustline if needed)
#[tauri::command]
pub async fn claim_gns_tokens(
    state: State<'_, AppState>,
) -> Result<TransactionResponse, String> {
    let identity = state.identity.lock().await;
    
    let public_key = identity.public_key()
        .ok_or("No identity found")?;
    
    let private_key = identity.private_key_bytes()
        .ok_or("No private key available")?;
    
    // Get Stellar service
    let stellar = state.stellar.lock().await;

    // Claim all GNS tokens
    match stellar.claim_all_gns(&public_key, &private_key).await {
        Ok(result) => Ok(TransactionResponse {
            success: result.success,
            hash: result.hash.clone(),
            error: result.error,
            message: if result.success {
                Some(result.hash.unwrap_or_else(|| "Tokens claimed!".to_string()))
            } else {
                None
            },
        }),
        Err(e) => Ok(TransactionResponse {
            success: false,
            hash: None,
            error: Some(e.to_string()),
            message: None,
        }),
    }
}

/// Create GNS trustline
#[tauri::command]
pub async fn create_gns_trustline(
    state: State<'_, AppState>,
) -> Result<TransactionResponse, String> {
    let identity = state.identity.lock().await;
    
    let public_key = identity.public_key()
        .ok_or("No identity found")?;
    
    let private_key = identity.private_key_bytes()
        .ok_or("No private key available")?;
    
    // Get Stellar service
    let stellar = state.stellar.lock().await;

    // Create trustline
    match stellar.create_gns_trustline(&public_key, &private_key).await {
        Ok(result) => Ok(TransactionResponse {
            success: result.success,
            hash: result.hash,
            error: result.error,
            message: if result.success {
                Some("Trustline created!".to_string())
            } else {
                None
            },
        }),
        Err(e) => Ok(TransactionResponse {
            success: false,
            hash: None,
            error: Some(e.to_string()),
            message: None,
        }),
    }
}

/// Send GNS tokens
#[tauri::command]
pub async fn send_gns(
    request: SendGnsRequest,
    state: State<'_, AppState>,
) -> Result<TransactionResponse, String> {
    let identity = state.identity.lock().await;
    
    let sender_pk = identity.public_key()
        .ok_or("No identity found")?;
    
    let sender_private_key = identity.private_key_bytes()
        .ok_or("No private key available")?;
    
    // Convert sender to Stellar address
    let _sender_stellar = StellarService::gns_key_to_stellar(&sender_pk)
        .map_err(|e| e.to_string())?;
    
    // Resolve recipient
    let recipient_pk = if let Some(handle) = &request.recipient_handle {
        // Look up handle via API
        let api = &state.api;
        let resolved = api.resolve_handle(handle).await
            .map_err(|e| format!("Failed to resolve handle: {}", e))?
            .ok_or_else(|| format!("Handle @{} not found", handle))?;
        resolved.public_key
    } else if let Some(pk) = &request.recipient_public_key {
        pk.clone()
    } else {
        return Err("No recipient specified".to_string());
    };
    
    // Get Stellar service
    let stellar = state.stellar.lock().await;

    // Send GNS
    match stellar.send_gns(
        &sender_pk,
        &sender_private_key,
        None, 
        None, 
        &recipient_pk, // We already resolved this to a hex string
        request.amount,
    ).await {
        Ok(result) => Ok(TransactionResponse {
            success: result.success,
            hash: result.hash.clone(),
            error: result.error,
            message: if result.success {
                let msg = if let Some(handle) = request.recipient_handle {
                    format!("Sent {:.2} GNS to @{}", request.amount, handle)
                } else {
                    format!("Sent {:.2} GNS", request.amount)
                };
                Some(msg)
            } else {
                None
            },
        }),
        Err(e) => Ok(TransactionResponse {
            success: false,
            hash: None,
            error: Some(e.to_string()),
            message: None,
        }),
    }
}

/// Fund account on testnet (development only)
#[tauri::command]
pub async fn fund_testnet_account(
    state: State<'_, AppState>,
) -> Result<TransactionResponse, String> {
    let identity = state.identity.lock().await;
    
    let public_key = identity.public_key()
        .ok_or("No identity found")?;
    
    // Convert to Stellar address
    let stellar_address = StellarService::gns_key_to_stellar(&public_key)
        .map_err(|e| e.to_string())?;
    
    // Get Stellar service
    let stellar = state.stellar.lock().await;
    
    // Fund via friendbot
    match stellar.fund_testnet(&stellar_address).await {
        Ok(success) => Ok(TransactionResponse {
            success,
            hash: None,
            error: if success { None } else { Some("Friendbot failed".to_string()) },
            message: if success {
                Some("Account funded with 10,000 XLM (testnet)".to_string())
            } else {
                None
            },
        }),
        Err(e) => Ok(TransactionResponse {
            success: false,
            hash: None,
            error: Some(e.to_string()),
            message: None,
        }),
    }
}

/// Get payment history (from Stellar Horizon)
#[tauri::command]
pub async fn get_payment_history(
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<PaymentHistoryItem>, String> {
    let identity = state.identity.lock().await;
    
    let public_key = identity.public_key()
        .ok_or("No identity found")?;
    
    // Convert to Stellar address
    let stellar_address = StellarService::gns_key_to_stellar(&public_key)
        .map_err(|e| e.to_string())?;
    
    let stellar = state.stellar.lock().await;
    
    // Fetch from Horizon API
    stellar.get_payment_history(&stellar_address, limit.unwrap_or(20)).await
        .map_err(|e: StellarError| e.to_string())
}
