//! Trust Models
//!
//! Trust scoring based on Proof-of-Trajectory.
//! Trust is earned through physical presence, not purchased.

use serde::{Deserialize, Serialize};

/// Trust score details
///
/// Trust is calculated from breadcrumb patterns and cannot be faked
/// without physical presence across diverse locations over time.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustScore {
    /// Overall trust score (0-100)
    pub score: f64,

    /// Trust tier (Seedling → Rooted → Established → Trusted → Verified)
    pub tier: TrustTier,

    /// Component scores
    pub components: TrustComponents,

    /// When the score was calculated
    pub calculated_at: String,

    /// Total breadcrumb count
    pub breadcrumb_count: u32,

    /// Account age in days
    pub account_age_days: u32,

    /// Number of unique H3 cells visited
    pub unique_locations: u32,

    /// Number of published epochs
    pub epoch_count: u32,
}

/// Trust score component breakdown
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustComponents {
    /// Trajectory quality (spatial diversity)
    pub trajectory_quality: f64,

    /// Temporal consistency (regular activity)
    pub temporal_consistency: f64,

    /// Chain integrity (unbroken breadcrumb chain)
    pub chain_integrity: f64,

    /// Epoch reliability (published proofs)
    pub epoch_reliability: f64,

    /// Geographic diversity
    pub geographic_diversity: f64,
}

/// Trust tiers based on score ranges
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TrustTier {
    /// 0-19: New identity, minimal trajectory
    Seedling,
    /// 20-39: Building trajectory
    Rooted,
    /// 40-59: Established presence
    Established,
    /// 60-79: Trusted identity
    Trusted,
    /// 80-100: Fully verified through extensive trajectory
    Verified,
}

impl TrustTier {
    /// Get the tier from a score
    pub fn from_score(score: f64) -> Self {
        match score as u32 {
            0..=19 => TrustTier::Seedling,
            20..=39 => TrustTier::Rooted,
            40..=59 => TrustTier::Established,
            60..=79 => TrustTier::Trusted,
            _ => TrustTier::Verified,
        }
    }

    /// Get the display name
    pub fn display_name(&self) -> &'static str {
        match self {
            TrustTier::Seedling => "Seedling",
            TrustTier::Rooted => "Rooted",
            TrustTier::Established => "Established",
            TrustTier::Trusted => "Trusted",
            TrustTier::Verified => "Verified",
        }
    }

    /// Get the tier color (for UI)
    pub fn color(&self) -> &'static str {
        match self {
            TrustTier::Seedling => "#94a3b8",    // gray
            TrustTier::Rooted => "#84cc16",      // lime
            TrustTier::Established => "#22c55e", // green
            TrustTier::Trusted => "#0ea5e9",     // sky blue
            TrustTier::Verified => "#8b5cf6",    // purple
        }
    }

    /// Get the emoji for the tier
    pub fn emoji(&self) -> &'static str {
        match self {
            TrustTier::Seedling => "🌱",
            TrustTier::Rooted => "🌿",
            TrustTier::Established => "🌲",
            TrustTier::Trusted => "🏔️",
            TrustTier::Verified => "⭐",
        }
    }

    /// Minimum score for this tier
    pub fn min_score(&self) -> f64 {
        match self {
            TrustTier::Seedling => 0.0,
            TrustTier::Rooted => 20.0,
            TrustTier::Established => 40.0,
            TrustTier::Trusted => 60.0,
            TrustTier::Verified => 80.0,
        }
    }
}

/// Trust verification result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustVerification {
    /// The identity that was verified
    pub identity: String,

    /// Whether the identity meets minimum requirements
    pub is_verified: bool,

    /// Current trust score
    pub trust_score: TrustScore,

    /// Verification checks performed
    pub checks: Vec<TrustCheck>,

    /// When verification was performed
    pub verified_at: String,
}

/// Individual trust verification check
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustCheck {
    /// Check name
    pub name: String,

    /// Whether check passed
    pub passed: bool,

    /// Check details
    pub details: String,

    /// Required value (if applicable)
    pub required: Option<String>,

    /// Actual value (if applicable)
    pub actual: Option<String>,
}

/// Requirements for different operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustRequirements {
    /// Minimum trust score
    pub min_trust_score: f64,

    /// Minimum breadcrumb count
    pub min_breadcrumbs: u32,

    /// Minimum account age in days
    pub min_account_age_days: u32,

    /// Minimum unique locations
    pub min_unique_locations: u32,

    /// Required tier
    pub required_tier: Option<TrustTier>,
}

impl Default for TrustRequirements {
    fn default() -> Self {
        Self {
            min_trust_score: 20.0,
            min_breadcrumbs: 100,
            min_account_age_days: 7,
            min_unique_locations: 10,
            required_tier: Some(TrustTier::Rooted),
        }
    }
}

impl TrustRequirements {
    /// Requirements for claiming a handle
    pub fn for_handle_claim() -> Self {
        Self {
            min_trust_score: 20.0,
            min_breadcrumbs: 100,
            min_account_age_days: 7,
            min_unique_locations: 10,
            required_tier: Some(TrustTier::Rooted),
        }
    }

    /// Requirements for sending payments
    pub fn for_payment() -> Self {
        Self {
            min_trust_score: 40.0,
            min_breadcrumbs: 200,
            min_account_age_days: 14,
            min_unique_locations: 20,
            required_tier: Some(TrustTier::Established),
        }
    }

    /// No requirements (for basic messaging)
    pub fn none() -> Self {
        Self {
            min_trust_score: 0.0,
            min_breadcrumbs: 0,
            min_account_age_days: 0,
            min_unique_locations: 0,
            required_tier: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trust_tier_from_score() {
        assert_eq!(TrustTier::from_score(0.0), TrustTier::Seedling);
        assert_eq!(TrustTier::from_score(19.9), TrustTier::Seedling);
        assert_eq!(TrustTier::from_score(20.0), TrustTier::Rooted);
        assert_eq!(TrustTier::from_score(50.0), TrustTier::Established);
        assert_eq!(TrustTier::from_score(75.0), TrustTier::Trusted);
        assert_eq!(TrustTier::from_score(100.0), TrustTier::Verified);
    }

    #[test]
    fn test_tier_colors() {
        assert!(!TrustTier::Verified.color().is_empty());
        assert!(!TrustTier::Seedling.emoji().is_empty());
    }

    #[test]
    fn test_requirements() {
        let handle_req = TrustRequirements::for_handle_claim();
        assert_eq!(handle_req.min_breadcrumbs, 100);

        let payment_req = TrustRequirements::for_payment();
        assert!(payment_req.min_trust_score > handle_req.min_trust_score);
    }
}
