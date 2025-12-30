//! Location Module - Breadcrumb Collection
//!
//! Handles GPS location collection and breadcrumb creation.
//! Only active on mobile platforms (iOS/Android).

use std::time::{Duration, Instant};
use gns_crypto_core::{Breadcrumb, create_breadcrumb, GnsIdentity};

/// Collection strategy based on user lifecycle
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CollectionStrategy {
    /// New user: every 30 seconds
    Aggressive,
    
    /// Established user: every 10 minutes when moving
    MotionAware,
    
    /// Low battery: every 30 minutes
    BatterySaver,
    
    /// Collection disabled
    Disabled,
}

impl std::fmt::Display for CollectionStrategy {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CollectionStrategy::Aggressive => write!(f, "aggressive"),
            CollectionStrategy::MotionAware => write!(f, "motion_aware"),
            CollectionStrategy::BatterySaver => write!(f, "battery_saver"),
            CollectionStrategy::Disabled => write!(f, "disabled"),
        }
    }
}

/// Breadcrumb collector
pub struct BreadcrumbCollector {
    /// Current collection strategy
    strategy: CollectionStrategy,
    
    /// Is collection enabled
    enabled: bool,
    
    /// Last collection time
    last_collection: Option<Instant>,
    
    /// Breadcrumb count (cached)
    breadcrumb_count: u32,
    
    /// Handle claimed status
    handle_claimed: bool,
    
    /// Battery level (0.0 - 1.0)
    battery_level: f32,
    
    /// Is device charging
    is_charging: bool,
}

impl BreadcrumbCollector {
    /// Create a new breadcrumb collector
    pub fn new() -> Self {
        Self {
            strategy: CollectionStrategy::Aggressive, // Default for new users
            enabled: false,
            last_collection: None,
            breadcrumb_count: 0,
            handle_claimed: false,
            battery_level: 1.0,
            is_charging: false,
        }
    }
    
    /// Start collection
    pub fn start(&mut self) -> Result<(), CollectorError> {
        self.enabled = true;
        self.recalculate_strategy();
        tracing::info!("Breadcrumb collection started with strategy: {:?}", self.strategy);
        Ok(())
    }
    
    /// Stop collection
    pub fn stop(&mut self) {
        self.enabled = false;
        tracing::info!("Breadcrumb collection stopped");
    }
    
    /// Check if enabled
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }
    
    /// Get current strategy
    pub fn current_strategy(&self) -> CollectionStrategy {
        self.strategy
    }
    
    /// Update state
    pub fn update_state(
        &mut self,
        breadcrumb_count: u32,
        handle_claimed: bool,
        battery_level: f32,
        is_charging: bool,
    ) {
        self.breadcrumb_count = breadcrumb_count;
        self.handle_claimed = handle_claimed;
        self.battery_level = battery_level;
        self.is_charging = is_charging;
        
        self.recalculate_strategy();
    }
    
    /// Recalculate strategy based on current state
    fn recalculate_strategy(&mut self) {
        if !self.enabled {
            self.strategy = CollectionStrategy::Disabled;
            return;
        }
        
        self.strategy = if self.battery_level < 0.15 && !self.is_charging {
            // Critical battery
            CollectionStrategy::BatterySaver
            
        } else if !self.handle_claimed && self.breadcrumb_count < 100 {
            // New user - aggressive collection
            CollectionStrategy::Aggressive
            
        } else if self.handle_claimed {
            // Established user
            if self.battery_level < 0.30 && !self.is_charging {
                CollectionStrategy::BatterySaver
            } else {
                CollectionStrategy::MotionAware
            }
            
        } else {
            CollectionStrategy::MotionAware
        };
        
        tracing::debug!(
            "Strategy: {:?} (breadcrumbs: {}, handle: {}, battery: {:.0}%)",
            self.strategy,
            self.breadcrumb_count,
            self.handle_claimed,
            self.battery_level * 100.0
        );
    }
    
    /// Get collection interval
    pub fn collection_interval(&self) -> Duration {
        match self.strategy {
            CollectionStrategy::Aggressive => Duration::from_secs(30),
            CollectionStrategy::MotionAware => Duration::from_secs(600), // 10 minutes
            CollectionStrategy::BatterySaver => Duration::from_secs(1800), // 30 minutes
            CollectionStrategy::Disabled => Duration::from_secs(u64::MAX),
        }
    }
    
    /// Should collect now?
    pub fn should_collect(&self) -> bool {
        if !self.enabled {
            return false;
        }
        
        match self.last_collection {
            Some(last) => last.elapsed() >= self.collection_interval(),
            None => true,
        }
    }
    
    /// Record a successful collection
    pub fn record_collection(&mut self) {
        self.last_collection = Some(Instant::now());
        self.breadcrumb_count += 1;
    }
    
    /// Create a breadcrumb from coordinates
    pub fn create_breadcrumb(
        &self,
        identity: &GnsIdentity,
        latitude: f64,
        longitude: f64,
    ) -> Result<Breadcrumb, CollectorError> {
        create_breadcrumb(identity, latitude, longitude, None)
            .map_err(|e| CollectorError::CryptoError(e.to_string()))
    }
}

impl Default for BreadcrumbCollector {
    fn default() -> Self {
        Self::new()
    }
}

/// Collector errors
#[derive(Debug, thiserror::Error)]
pub enum CollectorError {
    #[error("Location error: {0}")]
    LocationError(String),
    
    #[error("Crypto error: {0}")]
    CryptoError(String),
    
    #[error("Permission denied")]
    PermissionDenied,
}
