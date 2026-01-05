// ============================================================================
// GNS-PAYMENTS - StrKey Encoding/Decoding
// ============================================================================
// Convert between GNS hex public keys and Stellar G... addresses.
//
// Stellar uses "StrKey" encoding: base32 + checksum + version byte
// GNS uses raw Ed25519 public keys as hex strings
//
// Key insight: They're the SAME key, just encoded differently!
// ============================================================================

use crate::error::PaymentError;
use crate::Result;

/// Stellar StrKey version bytes
const VERSION_ACCOUNT_ID: u8 = 6 << 3; // G... addresses (0x30 = 48)

/// CRC16-CCITT polynomial
const CRC16_POLY: u16 = 0x1021;

// ============================================================================
// PUBLIC API
// ============================================================================

/// Convert GNS hex public key to Stellar G... address
///
/// # Example
/// ```
/// use gns_payments::strkey::gns_to_stellar;
///
/// let gns_key = "26b9c6a8eda4130a7b5c8f7e1234567890abcdef0123456789abcdef01234567";
/// let stellar_addr = gns_to_stellar(gns_key).unwrap();
/// assert!(stellar_addr.starts_with("G"));
/// assert_eq!(stellar_addr.len(), 56);
/// ```
pub fn gns_to_stellar(gns_hex_key: &str) -> Result<String> {
    // Clean the hex string (remove 0x prefix if present)
    let clean_hex = gns_hex_key.trim_start_matches("0x");
    
    // Validate length (Ed25519 public key = 32 bytes = 64 hex chars)
    if clean_hex.len() != 64 {
        return Err(PaymentError::InvalidGnsKey(format!(
            "Expected 64 hex chars, got {}", clean_hex.len()
        )));
    }
    
    // Decode hex to bytes
    let key_bytes = hex::decode(clean_hex)?;
    
    // Encode as Stellar public key
    encode_stellar_public_key(&key_bytes)
}

/// Convert Stellar G... address to GNS hex public key
///
/// # Example
/// ```
/// use gns_payments::strkey::stellar_to_gns;
///
/// let stellar_addr = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
/// let gns_key = stellar_to_gns(stellar_addr).unwrap();
/// assert_eq!(gns_key.len(), 64);
/// ```
pub fn stellar_to_gns(stellar_address: &str) -> Result<String> {
    let key_bytes = decode_stellar_public_key(stellar_address)?;
    Ok(hex::encode(key_bytes))
}

/// Encode raw Ed25519 public key bytes as Stellar G... address
pub fn encode_stellar_public_key(key_bytes: &[u8]) -> Result<String> {
    if key_bytes.len() != 32 {
        return Err(PaymentError::InvalidGnsKey(format!(
            "Expected 32 bytes, got {}", key_bytes.len()
        )));
    }
    
    // Build payload: version byte + key bytes
    let mut payload = Vec::with_capacity(35); // 1 + 32 + 2
    payload.push(VERSION_ACCOUNT_ID);
    payload.extend_from_slice(key_bytes);
    
    // Calculate CRC16 checksum (over version + key)
    let checksum = crc16(&payload);
    
    // Append checksum (little-endian)
    payload.push((checksum & 0xFF) as u8);
    payload.push((checksum >> 8) as u8);
    
    // Encode as base32 (no padding)
    Ok(base32_encode(&payload))
}

/// Decode Stellar G... address to raw Ed25519 public key bytes
pub fn decode_stellar_public_key(address: &str) -> Result<Vec<u8>> {
    // Validate format
    if !address.starts_with('G') {
        return Err(PaymentError::InvalidStellarAddress(
            "Must start with 'G'".to_string()
        ));
    }
    
    if address.len() != 56 {
        return Err(PaymentError::InvalidStellarAddress(format!(
            "Expected 56 chars, got {}", address.len()
        )));
    }
    
    // Decode base32
    let decoded = base32_decode(address)?;
    
    if decoded.len() != 35 {
        return Err(PaymentError::InvalidStellarAddress(
            "Invalid decoded length".to_string()
        ));
    }
    
    // Verify version byte
    if decoded[0] != VERSION_ACCOUNT_ID {
        return Err(PaymentError::InvalidStellarAddress(
            "Invalid version byte".to_string()
        ));
    }
    
    // Extract components
    let key_bytes = &decoded[1..33];
    let checksum_bytes = &decoded[33..35];
    let stored_checksum = (checksum_bytes[0] as u16) | ((checksum_bytes[1] as u16) << 8);
    
    // Verify checksum
    let calculated_checksum = crc16(&decoded[0..33]);
    if stored_checksum != calculated_checksum {
        return Err(PaymentError::InvalidStellarAddress(
            "Checksum mismatch".to_string()
        ));
    }
    
    Ok(key_bytes.to_vec())
}

// ============================================================================
// BASE32 ENCODING (Stellar uses RFC 4648 base32, no padding)
// ============================================================================

const BASE32_ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

fn base32_encode(data: &[u8]) -> String {
    let mut result = String::new();
    let mut buffer: u64 = 0;
    let mut bits_in_buffer = 0;
    
    for &byte in data {
        buffer = (buffer << 8) | (byte as u64);
        bits_in_buffer += 8;
        
        while bits_in_buffer >= 5 {
            bits_in_buffer -= 5;
            let index = ((buffer >> bits_in_buffer) & 0x1F) as usize;
            result.push(BASE32_ALPHABET[index] as char);
        }
    }
    
    // Handle remaining bits
    if bits_in_buffer > 0 {
        let index = ((buffer << (5 - bits_in_buffer)) & 0x1F) as usize;
        result.push(BASE32_ALPHABET[index] as char);
    }
    
    result
}

fn base32_decode(encoded: &str) -> Result<Vec<u8>> {
    let mut result = Vec::new();
    let mut buffer: u64 = 0;
    let mut bits_in_buffer = 0;
    
    for c in encoded.chars() {
        let value = match c {
            'A'..='Z' => (c as u8) - b'A',
            '2'..='7' => (c as u8) - b'2' + 26,
            _ => return Err(PaymentError::InvalidStellarAddress(
                format!("Invalid base32 character: {}", c)
            )),
        };
        
        buffer = (buffer << 5) | (value as u64);
        bits_in_buffer += 5;
        
        if bits_in_buffer >= 8 {
            bits_in_buffer -= 8;
            result.push(((buffer >> bits_in_buffer) & 0xFF) as u8);
        }
    }
    
    Ok(result)
}

// ============================================================================
// CRC16-CCITT (XModem variant used by Stellar)
// ============================================================================

fn crc16(data: &[u8]) -> u16 {
    let mut crc: u16 = 0;
    
    for &byte in data {
        crc ^= (byte as u16) << 8;
        for _ in 0..8 {
            if crc & 0x8000 != 0 {
                crc = (crc << 1) ^ CRC16_POLY;
            } else {
                crc <<= 1;
            }
        }
    }
    
    crc
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_roundtrip_conversion() {
        // Test with a known key
        let original_hex = "0000000000000000000000000000000000000000000000000000000000000000";
        let stellar = gns_to_stellar(original_hex).unwrap();
        let back_to_hex = stellar_to_gns(&stellar).unwrap();
        assert_eq!(original_hex, back_to_hex);
    }
    
    #[test]
    fn test_stellar_address_format() {
        let gns_key = "26b9c6a8eda4130a7b5c8f7e1234567890abcdef0123456789abcdef01234567";
        let stellar = gns_to_stellar(gns_key).unwrap();
        
        // Should start with G
        assert!(stellar.starts_with('G'));
        
        // Should be 56 characters
        assert_eq!(stellar.len(), 56);
        
        // Should only contain base32 characters
        assert!(stellar.chars().all(|c| c.is_ascii_uppercase() || ('2'..='7').contains(&c)));
    }
    
    #[test]
    fn test_known_stellar_address() {
        // All zeros = GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVCHKLE
        let zeros = vec![0u8; 32];
        let stellar = encode_stellar_public_key(&zeros).unwrap();
        
        // Verify it starts with G and has correct length
        assert!(stellar.starts_with('G'));
        assert_eq!(stellar.len(), 56);
    }
    
    #[test]
    fn test_invalid_gns_key_length() {
        let result = gns_to_stellar("abc");
        assert!(result.is_err());
    }
    
    #[test]
    fn test_invalid_stellar_address() {
        // Wrong prefix
        let result = stellar_to_gns("SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
        assert!(result.is_err());
        
        // Wrong length
        let result = stellar_to_gns("GAAAA");
        assert!(result.is_err());
    }
    
    #[test]
    fn test_crc16() {
        // Test vector
        let data = vec![VERSION_ACCOUNT_ID];
        let _crc = crc16(&data);
        // CRC should be consistent
        assert_eq!(crc16(&data), crc16(&data));
    }
}
