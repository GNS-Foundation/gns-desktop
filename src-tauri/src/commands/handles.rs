//! Handle Module - Handle validation, reservation, and claiming
//!
//! Implements the GNS handle lifecycle:
//! 1. Validate handle format
//! 2. Check availability
//! 3. Reserve handle (before breadcrumbs)
//! 4. Claim handle (after 100 breadcrumbs with PoT)

use serde::{Deserialize, Serialize};
use regex::Regex;
use std::sync::LazyLock;

// ==================== Command Result Wrapper ====================

#[derive(Debug, Clone, Serialize)]
pub struct CommandResult<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}


// ==================== Validation ====================

static HANDLE_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[a-z0-9_]{3,20}$").unwrap()
});

const RESERVED_HANDLES: &[&str] = &[
    "admin", "root", "system", "gns", "layer", "browser", 
    "support", "help", "official", "verified", "echo", "bot",
    "api", "www", "app", "mail", "ftp", "ssh", "localhost",
];

/// Validate a handle format
pub fn validate_handle(handle: &str) -> Result<String, HandleError> {
    let clean = handle.trim().to_lowercase().replace('@', "");
    
    if clean.is_empty() {
        return Err(HandleError::Empty);
    }
    
    if clean.len() < 3 {
        return Err(HandleError::TooShort { min: 3, got: clean.len() });
    }
    
    if clean.len() > 20 {
        return Err(HandleError::TooLong { max: 20, got: clean.len() });
    }
    
    if !HANDLE_REGEX.is_match(&clean) {
        return Err(HandleError::InvalidCharacters);
    }
    
    if RESERVED_HANDLES.contains(&clean.as_str()) {
        return Err(HandleError::Reserved);
    }
    
    Ok(clean)
}

// ==================== Handle Status ====================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HandleStatus {
    /// No handle associated
    None,
    /// Handle is reserved but not yet claimed (collecting breadcrumbs)
    Reserved { 
        handle: String, 
        reserved_at: String,
        network_reserved: bool,
    },
    /// Handle is fully claimed and verified
    Claimed { 
        handle: String,
        claimed_at: String,
    },
}

impl HandleStatus {
    pub fn display_name(&self) -> String {
        match self {
            HandleStatus::None => "Anonymous".to_string(),
            HandleStatus::Reserved { handle, .. } => format!("@{} (pending)", handle),
            HandleStatus::Claimed { handle, .. } => format!("@{}", handle),
        }
    }
    
    pub fn handle(&self) -> Option<&str> {
        match self {
            HandleStatus::None => None,
            HandleStatus::Reserved { handle, .. } => Some(handle),
            HandleStatus::Claimed { handle, .. } => Some(handle),
        }
    }
    
    pub fn is_claimed(&self) -> bool {
        matches!(self, HandleStatus::Claimed { .. })
    }
    
    pub fn is_reserved(&self) -> bool {
        matches!(self, HandleStatus::Reserved { .. })
    }
}

// ==================== API Types ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandleCheckResult {
    pub handle: String,
    pub available: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandleReservationResult {
    pub success: bool,
    pub handle: String,
    pub network_reserved: bool,
    pub expires_at: Option<String>,
    pub message: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandleClaimResult {
    pub success: bool,
    pub handle: Option<String>,
    pub message: Option<String>,
    pub error: Option<String>,
    pub requirements: Option<ClaimRequirements>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimRequirements {
    pub breadcrumbs_required: u32,
    pub breadcrumbs_current: u32,
    pub trust_required: f64,
    pub trust_current: f64,
}

impl ClaimRequirements {
    pub fn new(breadcrumbs: u32, trust: f64) -> Self {
        Self {
            breadcrumbs_required: 100,
            breadcrumbs_current: breadcrumbs,
            trust_required: 20.0,
            trust_current: trust,
        }
    }
    
    pub fn is_met(&self) -> bool {
        self.breadcrumbs_current >= self.breadcrumbs_required &&
        self.trust_current >= self.trust_required
    }
}

// ==================== Errors ====================

#[derive(Debug, Clone, Serialize, thiserror::Error)]
pub enum HandleError {
    #[error("Handle cannot be empty")]
    Empty,
    
    #[error("Handle must be at least {min} characters (got {got})")]
    TooShort { min: usize, got: usize },
    
    #[error("Handle cannot exceed {max} characters (got {got})")]
    TooLong { max: usize, got: usize },
    
    #[error("Handle can only contain lowercase letters, numbers, and underscores")]
    InvalidCharacters,
    
    #[error("This handle is reserved")]
    Reserved,
    
    #[error("Handle is already taken")]
    Taken,
    
    #[error("Network error: {0}")]
    NetworkError(String),
    
    #[error("Not enough breadcrumbs")]
    InsufficientBreadcrumbs { required: u32, current: u32 },
    
    #[error("Trust score too low")]
    InsufficientTrust { required: f64, current: f64 },
    
    #[error("No handle reserved")]
    NoReservation,
    
    #[error("Signature error: {0}")]
    SignatureError(String),
}

// ==================== Canonical JSON for Signing ====================

/// Create canonical JSON for signing (sorted keys, no null values)
/// Must match the server's canonicalJson() function exactly
pub fn canonical_json(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => "null".to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        serde_json::Value::Number(n) => {
            // Handle integers vs floats to match JavaScript
            if let Some(i) = n.as_i64() {
                i.to_string()
            } else if let Some(f) = n.as_f64() {
                if f == f.trunc() {
                    (f as i64).to_string()
                } else {
                    f.to_string()
                }
            } else {
                n.to_string()
            }
        }
        serde_json::Value::String(s) => format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\"")),
        serde_json::Value::Array(arr) => {
            let items: Vec<String> = arr.iter().map(canonical_json).collect();
            format!("[{}]", items.join(","))
        }
        serde_json::Value::Object(obj) => {
            // Sort keys alphabetically
            let mut keys: Vec<&String> = obj.keys().collect();
            keys.sort();
            
            let pairs: Vec<String> = keys
                .iter()
                .filter(|k| !obj[k.as_str()].is_null()) // Filter out null values
                .map(|k| format!("\"{}\":{}", k, canonical_json(&obj[k.as_str()])))
                .collect();
            
            format!("{{{}}}", pairs.join(","))
        }
    }
}


#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_validate_handle() {
        assert!(validate_handle("alice").is_ok());
        assert!(validate_handle("bob_123").is_ok());
        assert!(validate_handle("@alice").is_ok()); // @ is stripped
        
        assert!(validate_handle("ab").is_err()); // Too short
        assert!(validate_handle("admin").is_err()); // Reserved
        assert!(validate_handle("has space").is_err()); // Invalid chars
        assert!(validate_handle("HAS_CAPS").is_ok()); // Converted to lowercase
    }
    
    #[test]
    fn test_canonical_json() {
        let json = serde_json::json!({
            "z_key": "last",
            "a_key": "first",
            "number": 100.0,
            "null_value": null
        });
        
        let canonical = canonical_json(&json);
        
        // Keys should be sorted, null filtered, 100.0 -> 100
        assert!(canonical.starts_with("{\"a_key\""));
        assert!(canonical.contains("\"number\":100"));
        assert!(!canonical.contains("null_value"));
    }
}
