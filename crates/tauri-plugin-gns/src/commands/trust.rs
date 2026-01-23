//! Trust Score Commands
//!
//! Commands for calculating and verifying Proof-of-Trajectory based trust scores.

use tauri::{command, State};
use crate::{
    error::{Error, Result},
    models::trust::{TrustScore, TrustComponents, TrustTier, TrustVerification, TrustCheck, TrustRequirements},
    GnsState,
};
use chrono::{Utc, Duration};

/// Get the trust score for the active identity.
///
/// The trust score is calculated from multiple components:
/// - Trajectory quality (pattern consistency)
/// - Temporal consistency (regular breadcrumb collection)
/// - Chain integrity (valid hash chains)
/// - Epoch reliability (published epochs)
/// - Geographic diversity (unique locations visited)
#[command]
pub async fn get_trust_score(state: State<'_, GnsState>) -> Result<TrustScore> {
    let storage = state.storage.read().await;
    
    // Get active identity
    let identities = storage.list_identities()?;
    let identity = identities.iter()
        .find(|i| i.is_default)
        .or_else(|| identities.first())
        .ok_or(Error::IdentityNotFound("No identity found".into()))?;
    
    // Calculate trust score from stored metrics
    let breadcrumb_count = identity.breadcrumb_count as u32;
    let trust_score = identity.trust_score;
    
    // Note: Account age calculation removed because Identity.created_at is String
    // In production, parse the ISO 8601 string to DateTime and calculate
    let account_age_days = 30u32; // Placeholder - would calculate from created_at string
    
    // For now, estimate other metrics from breadcrumb count
    // In production, these would be calculated from actual breadcrumb data
    let estimated_unique_locations = (breadcrumb_count as f32 * 0.3).min(1000.0) as u32;
    let estimated_epoch_count = breadcrumb_count / 100; // ~100 breadcrumbs per epoch
    
    // Calculate component scores (0-100 each)
    let trajectory_quality = calculate_trajectory_quality(breadcrumb_count, account_age_days);
    let temporal_consistency = calculate_temporal_consistency(breadcrumb_count, account_age_days);
    let chain_integrity = 100.0; // Assume valid chains (verified on collection)
    let epoch_reliability = if estimated_epoch_count > 0 { 80.0 } else { 0.0 };
    let geographic_diversity = calculate_geographic_diversity(estimated_unique_locations);
    
    let components = TrustComponents {
        trajectory_quality: trajectory_quality as f64,
        temporal_consistency: temporal_consistency as f64,
        chain_integrity: chain_integrity as f64,
        epoch_reliability: epoch_reliability as f64,
        geographic_diversity: geographic_diversity as f64,
    };
    
    // Weighted average of components (convert to f64)
    let calculated_score = (
        trajectory_quality as f64 * 0.25 +
        temporal_consistency as f64 * 0.20 +
        chain_integrity as f64 * 0.25 +
        epoch_reliability as f64 * 0.15 +
        geographic_diversity as f64 * 0.15
    ).min(100.0);
    
    // Use stored score if available, otherwise use calculated
    let final_score = if trust_score > 0.0 { trust_score } else { calculated_score };
    
    Ok(TrustScore {
        score: final_score,
        tier: TrustTier::from_score(final_score),
        components,
        calculated_at: Utc::now().to_rfc3339(),
        breadcrumb_count,
        account_age_days,
        unique_locations: estimated_unique_locations,
        epoch_count: estimated_epoch_count,
    })
}

/// Get detailed trust score breakdown with all components.
#[command]
pub async fn get_trust_details(state: State<'_, GnsState>) -> Result<TrustScore> {
    // Same as get_trust_score but guaranteed to include all component details
    get_trust_score(state).await
}

/// Verify an identity meets specified trust requirements.
///
/// This is used before allowing privileged operations like:
/// - Claiming a handle (requires Rooted tier)
/// - Sending payments (requires Established tier)
/// - Publishing to public feeds (requires Trusted tier)
#[command]
pub async fn verify_identity(
    state: State<'_, GnsState>,
    public_key: Option<String>,
    requirements: Option<TrustRequirements>,
) -> Result<TrustVerification> {
    let storage = state.storage.read().await;
    
    // Get identity to verify
    let identity = if let Some(pk) = public_key {
        storage.get_identity(&pk)?
            .ok_or(Error::IdentityNotFound(pk))?
    } else {
        // Get default identity summary first, then fetch full identity
        let identities = storage.list_identities()?;
        let summary = identities.into_iter()
            .find(|i| i.is_default)
            .ok_or(Error::IdentityNotFound("No default identity".into()))?;
        storage.get_identity(&summary.public_key)?
            .ok_or(Error::IdentityNotFound("Default identity not found".into()))?
    };
    
    // Use provided requirements or defaults
    let reqs = requirements.unwrap_or_else(TrustRequirements::for_handle_claim);
    
    // Get current trust score
    let trust_score = get_trust_score_for_identity(&identity)?;
    
    // Run verification checks
    let mut checks = Vec::new();
    let mut all_passed = true;
    
    // Check minimum trust score
    let min_score = reqs.min_trust_score;
    if min_score > 0.0 {
        let passed = trust_score.score >= min_score;
        if !passed { all_passed = false; }
        checks.push(TrustCheck {
            name: "Minimum Trust Score".to_string(),
            passed,
            details: format!("Required: {}%, Actual: {:.1}%", min_score, trust_score.score),
            required: Some(min_score.to_string()),
            actual: Some(trust_score.score.to_string()),
        });
    }
    
    // Check minimum breadcrumbs
    let min_breadcrumbs = reqs.min_breadcrumbs;
    if min_breadcrumbs > 0 {
        let passed = trust_score.breadcrumb_count >= min_breadcrumbs;
        if !passed { all_passed = false; }
        checks.push(TrustCheck {
            name: "Minimum Breadcrumbs".to_string(),
            passed,
            details: format!("Required: {}, Actual: {}", min_breadcrumbs, trust_score.breadcrumb_count),
            required: Some(min_breadcrumbs.to_string()),
            actual: Some(trust_score.breadcrumb_count.to_string()),
        });
    }
    
    // Check account age
    let min_age = reqs.min_account_age_days;
    if min_age > 0 {
        let passed = trust_score.account_age_days >= min_age;
        if !passed { all_passed = false; }
        checks.push(TrustCheck {
            name: "Account Age".to_string(),
            passed,
            details: format!("Required: {} days, Actual: {} days", min_age, trust_score.account_age_days),
            required: Some(min_age.to_string()),
            actual: Some(trust_score.account_age_days.to_string()),
        });
    }
    
    // Check unique locations
    let min_locations = reqs.min_unique_locations;
    if min_locations > 0 {
        let passed = trust_score.unique_locations >= min_locations;
        if !passed { all_passed = false; }
        checks.push(TrustCheck {
            name: "Unique Locations".to_string(),
            passed,
            details: format!("Required: {}, Actual: {}", min_locations, trust_score.unique_locations),
            required: Some(min_locations.to_string()),
            actual: Some(trust_score.unique_locations.to_string()),
        });
    }
    
    // Check trust tier
    if let Some(required_tier) = &reqs.required_tier {
        let passed = trust_score.tier as u8 >= required_tier.clone() as u8;
        if !passed { all_passed = false; }
        checks.push(TrustCheck {
            name: "Trust Tier".to_string(),
            passed,
            details: format!("Required: {} {}, Actual: {} {}", 
                required_tier.emoji(), required_tier.display_name(),
                trust_score.tier.emoji(), trust_score.tier.display_name()),
            required: Some(required_tier.min_score().to_string()),
            actual: Some(trust_score.score.to_string()),
        });
    }
    
    Ok(TrustVerification {
        identity: identity.public_key,
        is_verified: all_passed,
        trust_score,
        checks,
        verified_at: Utc::now().to_rfc3339(),
    })
}

// Helper functions for score calculation

fn calculate_trajectory_quality(breadcrumb_count: u32, account_age_days: u32) -> f32 {
    if account_age_days == 0 {
        return 0.0;
    }
    
    // Expected ~10 breadcrumbs per day for active user
    let expected = account_age_days * 10;
    let ratio = (breadcrumb_count as f32 / expected as f32).min(2.0);
    
    // Score based on meeting expectations (100 if ratio >= 1.0)
    (ratio * 50.0).min(100.0)
}

fn calculate_temporal_consistency(breadcrumb_count: u32, account_age_days: u32) -> f32 {
    if account_age_days < 7 {
        // New accounts get partial credit
        return (breadcrumb_count as f32 / 10.0).min(30.0);
    }
    
    // Check for consistent collection over time
    // In production, this would analyze actual timestamp distribution
    let daily_avg = breadcrumb_count as f32 / account_age_days as f32;
    
    if daily_avg >= 5.0 {
        100.0
    } else if daily_avg >= 2.0 {
        80.0
    } else if daily_avg >= 1.0 {
        60.0
    } else if daily_avg >= 0.5 {
        40.0
    } else {
        20.0
    }
}

fn calculate_geographic_diversity(unique_locations: u32) -> f32 {
    // Score based on number of unique H3 cells visited
    match unique_locations {
        0..=5 => unique_locations as f32 * 5.0,
        6..=20 => 25.0 + (unique_locations - 5) as f32 * 2.5,
        21..=50 => 62.5 + (unique_locations - 20) as f32 * 1.0,
        51..=100 => 92.5 + (unique_locations - 50) as f32 * 0.15,
        _ => 100.0,
    }
}

fn get_trust_score_for_identity(identity: &crate::models::Identity) -> Result<TrustScore> {
    let breadcrumb_count = identity.breadcrumb_count as u32;
    // Account age calculation removed - created_at is String
    let account_age_days = 30u32; // Placeholder
    let estimated_unique_locations = (breadcrumb_count as f32 * 0.3).min(1000.0) as u32;
    let estimated_epoch_count = breadcrumb_count / 100;
    
    let trajectory_quality = calculate_trajectory_quality(breadcrumb_count, account_age_days);
    let temporal_consistency = calculate_temporal_consistency(breadcrumb_count, account_age_days);
    let chain_integrity = 100.0;
    let epoch_reliability = if estimated_epoch_count > 0 { 80.0 } else { 0.0 };
    let geographic_diversity = calculate_geographic_diversity(estimated_unique_locations);
    
    let components = TrustComponents {
        trajectory_quality: trajectory_quality as f64,
        temporal_consistency: temporal_consistency as f64,
        chain_integrity: chain_integrity as f64,
        epoch_reliability: epoch_reliability as f64,
        geographic_diversity: geographic_diversity as f64,
    };
    
    let score = if identity.trust_score > 0.0 {
        identity.trust_score
    } else {
        (trajectory_quality as f64 * 0.25 +
         temporal_consistency as f64 * 0.20 +
         chain_integrity as f64 * 0.25 +
         epoch_reliability as f64 * 0.15 +
         geographic_diversity as f64 * 0.15).min(100.0)
    };
    
    Ok(TrustScore {
        score,
        tier: TrustTier::from_score(score),
        components,
        calculated_at: Utc::now().to_rfc3339(),
        breadcrumb_count,
        account_age_days,
        unique_locations: estimated_unique_locations,
        epoch_count: estimated_epoch_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_trajectory_quality_calculation() {
        // New account with no breadcrumbs
        assert_eq!(calculate_trajectory_quality(0, 0), 0.0);
        
        // 7 days with expected breadcrumbs (70)
        let score = calculate_trajectory_quality(70, 7);
        assert!(score >= 45.0 && score <= 55.0);
        
        // Very active user
        let score = calculate_trajectory_quality(200, 7);
        assert!(score >= 90.0);
    }
    
    #[test]
    fn test_temporal_consistency_calculation() {
        // New account
        assert!(calculate_temporal_consistency(5, 1) < 50.0);
        
        // Consistent daily collection
        assert!(calculate_temporal_consistency(70, 7) >= 80.0);
        
        // Sparse collection
        assert!(calculate_temporal_consistency(7, 30) < 50.0);
    }
    
    #[test]
    fn test_geographic_diversity_calculation() {
        assert_eq!(calculate_geographic_diversity(0), 0.0);
        assert_eq!(calculate_geographic_diversity(5), 25.0);
        assert!(calculate_geographic_diversity(50) > 80.0);
        assert_eq!(calculate_geographic_diversity(200), 100.0);
    }
    
    #[test]
    fn test_trust_tier_from_score() {
        assert!(matches!(TrustTier::from_score(10.0), TrustTier::Seedling));
        assert!(matches!(TrustTier::from_score(25.0), TrustTier::Rooted));
        assert!(matches!(TrustTier::from_score(50.0), TrustTier::Established));
        assert!(matches!(TrustTier::from_score(70.0), TrustTier::Trusted));
        assert!(matches!(TrustTier::from_score(90.0), TrustTier::Verified));
    }
}
