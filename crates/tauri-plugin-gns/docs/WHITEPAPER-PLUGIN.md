# tauri-plugin-gns: Technical White Paper

**Self-Sovereign Identity Infrastructure for Cross-Platform Applications**

Version 1.0 | January 2026

---

## Abstract

tauri-plugin-gns provides a complete self-sovereign identity infrastructure for Tauri applications, enabling developers to integrate decentralized identity, end-to-end encrypted messaging, and trust verification without relying on centralized identity providers. Built on the GNS Protocol's Proof-of-Trajectory system, the plugin offers a paradigm shift from existing identity solutions: trust is earned through physical presence in the world, not purchased or granted by corporations.

This white paper details the plugin's architecture, cryptographic foundations, API design, and integration patterns for the Tauri ecosystem.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Architecture Overview](#2-architecture-overview)
3. [Cryptographic Foundations](#3-cryptographic-foundations)
4. [Core Modules](#4-core-modules)
5. [Integration Patterns](#5-integration-patterns)
6. [Security Model](#6-security-model)
7. [Performance Characteristics](#7-performance-characteristics)
8. [Comparison with Alternatives](#8-comparison-with-alternatives)
9. [Future Roadmap](#9-future-roadmap)

---

## 1. Introduction

### 1.1 The Problem

Modern applications face a fundamental identity crisis:

- **Centralized providers** (OAuth, social login) create single points of failure and surveillance
- **Biometric solutions** (WorldID, Clear) require specialized hardware and raise privacy concerns
- **Blockchain identity** (ENS, Lens) conflates financial speculation with identity
- **Traditional PKI** is complex, expensive, and still relies on certificate authorities

Developers need identity infrastructure that is:
- Self-sovereign (user controls keys)
- Privacy-preserving (no biometric capture)
- Sybil-resistant (hard to fake multiple identities)
- Cross-platform (works on desktop, mobile, web)
- Offline-capable (no always-on connectivity required)

### 1.2 The Solution

tauri-plugin-gns addresses these requirements through:

1. **Ed25519 Identity Keys** - The public key IS the identity. No registration, no central authority.

2. **Proof-of-Trajectory** - Trust earned by collecting cryptographically-signed location breadcrumbs over time. Cannot be faked without physically moving through diverse locations.

3. **E2E Encrypted Messaging** - X25519 key exchange with ChaCha20-Poly1305 encryption. Forward secrecy through ephemeral keys.

4. **Local-First Storage** - Encrypted SQLite database. Works offline, syncs when connected.

5. **Tauri Integration** - Native Rust performance with TypeScript bindings. Permissions system for fine-grained capability control.

### 1.3 Design Principles

| Principle | Implementation |
|-----------|----------------|
| Identity = Public Key | No registrars, no accounts, no passwords |
| Trust Through Trajectory | Physical presence proves humanity |
| Privacy by Default | H3 cells not GPS, E2E encryption |
| Local First | All data stored locally, user controls |
| Open Standards | Ed25519, X25519, ChaCha20, H3 |

---

## 2. Architecture Overview

### 2.1 Plugin Structure

```
tauri-plugin-gns/
├── src/
│   ├── lib.rs              # Plugin entry point
│   ├── config.rs           # Configuration types
│   ├── error.rs            # Error handling
│   ├── commands/           # Tauri IPC commands
│   │   ├── identity.rs     # Identity management
│   │   ├── messaging.rs    # E2E messaging
│   │   ├── resolver.rs     # Handle resolution
│   │   ├── trust.rs        # Trust scoring
│   │   └── trajectory.rs   # Breadcrumb collection
│   ├── core/               # Core functionality
│   │   ├── crypto.rs       # Cryptographic operations
│   │   ├── storage.rs      # SQLite storage
│   │   └── network.rs      # Relay communication
│   └── models/             # Data structures
│       ├── identity.rs
│       ├── message.rs
│       ├── record.rs
│       ├── breadcrumb.rs
│       └── trust.rs
├── guest-js/               # TypeScript bindings
├── permissions/            # Capability definitions
├── ios/                    # iOS native code
└── android/                # Android native code
```

### 2.2 Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Tauri Application                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              TypeScript API Layer                     │   │
│  │  @anthropic/tauri-plugin-gns-api                      │   │
│  │                                                       │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │   │
│  │  │identity │ │messaging│ │resolver │ │ trust   │    │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘    │   │
│  └───────┼───────────┼───────────┼───────────┼──────────┘   │
│          │           │           │           │              │
│          ▼           ▼           ▼           ▼              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Tauri IPC Bridge (invoke)                │   │
│  └──────────────────────────────────────────────────────┘   │
│          │           │           │           │              │
├──────────┼───────────┼───────────┼───────────┼──────────────┤
│          ▼           ▼           ▼           ▼              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 Rust Plugin Core                      │   │
│  │                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │   │
│  │  │   Crypto    │  │   Storage   │  │   Network   │   │   │
│  │  │  Engine     │  │   Manager   │  │   Client    │   │   │
│  │  │             │  │             │  │             │   │   │
│  │  │ ・Ed25519   │  │ ・SQLite    │  │ ・Relay     │   │   │
│  │  │ ・X25519    │  │ ・Encrypted │  │ ・REST API  │   │   │
│  │  │ ・ChaCha20  │  │ ・Indexed   │  │ ・WebSocket │   │   │
│  │  │ ・HKDF      │  │             │  │             │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │   │
│  │                                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 State Management

The plugin maintains state through `GnsState`:

```rust
pub struct GnsState {
    pub crypto: CryptoEngine,           // Stateless crypto operations
    pub storage: Arc<RwLock<StorageManager>>,  // Thread-safe storage
    pub network: NetworkClient,         // HTTP client for relays
    pub config: GnsConfig,              // Runtime configuration
    pub active_identity: Arc<RwLock<Option<String>>>,  // Current identity PK
}
```

This design enables:
- Thread-safe concurrent access to storage
- Stateless cryptographic operations (no key material in memory longer than needed)
- Configuration hot-reloading
- Multiple identity support with active identity tracking

---

## 3. Cryptographic Foundations

### 3.1 Key Hierarchy

```
                    ┌─────────────────────────┐
                    │   Ed25519 Keypair       │
                    │   (Identity Root)       │
                    │                         │
                    │   sk: 32 bytes          │
                    │   pk: 32 bytes          │
                    └───────────┬─────────────┘
                                │
                    ┌───────────┴───────────┐
                    │        HKDF           │
                    │  salt: "gns-x25519"   │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   X25519 Keypair      │
                    │   (Encryption Key)    │
                    │                       │
                    │   sk: 32 bytes        │
                    │   pk: 32 bytes        │
                    └───────────────────────┘
```

### 3.2 Message Encryption Flow

```
Sender                                              Recipient
──────                                              ─────────

1. Generate ephemeral X25519 keypair
   (eph_sk, eph_pk)

2. Get recipient's X25519 public key
   (rec_pk)

3. X25519 DH: shared = eph_sk × rec_pk
                                    
4. HKDF: msg_key = HKDF(shared, info)

5. Encrypt: ciphertext = ChaCha20-Poly1305(
      key = msg_key,
      nonce = random_12_bytes,
      plaintext = payload
   )

6. Sign: sig = Ed25519_Sign(
      sk = sender_ed25519_sk,
      msg = ciphertext || eph_pk || nonce
   )

7. Create envelope:
   {
     from_pk: sender_pk,
     to_pk: recipient_pk,
     ephemeral_pk: eph_pk,
     ciphertext: ciphertext,
     nonce: nonce,
     signature: sig
   }
                                    ────────────────────────▶

                                    8. Verify signature with from_pk

                                    9. X25519 DH: shared = rec_sk × eph_pk
                                       (Same shared secret!)

                                    10. HKDF: msg_key = HKDF(shared, info)

                                    11. Decrypt: plaintext = ChaCha20-Poly1305_Open(
                                          key = msg_key,
                                          nonce = nonce,
                                          ciphertext = ciphertext
                                        )
```

### 3.3 Algorithm Selection Rationale

| Algorithm | Purpose | Why This Choice |
|-----------|---------|-----------------|
| Ed25519 | Signatures | Fast, compact (64-byte sigs), no side-channel attacks, deterministic. Used by Stellar, Tor, Signal. |
| X25519 | Key Exchange | Derived from Ed25519, constant-time, widely implemented. |
| ChaCha20-Poly1305 | AEAD Encryption | Faster than AES on platforms without hardware acceleration, no padding oracle attacks. |
| HKDF-SHA256 | Key Derivation | Standard KDF, resistant to related-key attacks. |
| H3 | Location Cells | Hierarchical, uniform cell sizes, efficient adjacency queries. |

### 3.4 Forward Secrecy

Every message uses a fresh ephemeral keypair:

1. Compromise of long-term keys doesn't reveal past messages
2. Each message has unique encryption key
3. Ephemeral keys discarded after transmission

---

## 4. Core Modules

### 4.1 Identity Module

**Responsibilities:**
- Generate Ed25519 keypairs
- Derive X25519 encryption keys
- Sign and verify messages
- Export/import identity backups

**Key Operations:**

```rust
// Key generation (32 bytes random → keypair)
pub fn generate_keypair() -> (String, String) {
    let secret = SigningKey::generate(&mut OsRng);
    let public = secret.verifying_key();
    (hex::encode(secret.as_bytes()), hex::encode(public.as_bytes()))
}

// X25519 derivation (Ed25519 → X25519 via HKDF)
pub fn derive_encryption_key(ed25519_secret: &[u8]) -> (Vec<u8>, Vec<u8>) {
    let hkdf = Hkdf::<Sha256>::new(Some(b"gns-x25519-derive"), ed25519_secret);
    let mut x25519_secret = [0u8; 32];
    hkdf.expand(b"", &mut x25519_secret).unwrap();
    // ... compute public from secret
}
```

### 4.2 Messaging Module

**Responsibilities:**
- Encrypt messages with ephemeral keys
- Decrypt received messages
- Manage conversation threads
- Track read status

**Message Flow:**

```
User Request              Plugin                    Network
────────────             ───────                   ───────

sendMessage({           ┌────────────────┐
  to: "@bob",           │ 1. Resolve      │
  payload: {...}   ──▶  │    @bob → pk    │
})                      │                 │
                        │ 2. Generate     │
                        │    ephemeral    │
                        │    keypair      │
                        │                 │
                        │ 3. X25519 DH    │
                        │    + HKDF       │
                        │                 │
                        │ 4. Encrypt      │
                        │    payload      │
                        │                 │
                        │ 5. Sign         │
                        │    envelope     │
                        └───────┬────────┘
                                │
                                │         POST /api/messages
                                └────────────────────────────▶
                                
                        ┌────────────────┐
                   ◀────│ 6. Store local │
Message                 │    with cache  │
                        └────────────────┘
```

### 4.3 Resolver Module

**Responsibilities:**
- Resolve @handles to public keys
- Cache resolutions with TTL
- Validate handle format
- Manage handle claims/releases

**Handle Validation Rules:**

```
Valid:    alice, bob_123, user42
Invalid:  ALICE (uppercase)
          ab (too short)
          admin (reserved)
          user@name (special chars)
          a_very_long_handle_name_that_exceeds_limit (>20 chars)
```

### 4.4 Trust Module

**Responsibilities:**
- Calculate trust scores from breadcrumb data
- Verify identity meets requirements
- Provide trust tier information

**Trust Score Components:**

| Component | Weight | Calculation |
|-----------|--------|-------------|
| Trajectory Quality | 25% | Pattern consistency, realistic movements |
| Temporal Consistency | 20% | Regular collection intervals |
| Chain Integrity | 20% | Valid hash chains, no gaps |
| Epoch Reliability | 20% | Published epochs, Merkle proofs |
| Geographic Diversity | 15% | Unique H3 cells visited |

### 4.5 Trajectory Module

**Responsibilities:**
- Collect location breadcrumbs
- Quantize to H3 cells
- Build cryptographic chains
- Publish epochs with Merkle roots

**Breadcrumb Chain Structure:**

```
Breadcrumb N-2          Breadcrumb N-1          Breadcrumb N
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│ h3_index    │         │ h3_index    │         │ h3_index    │
│ timestamp   │         │ timestamp   │         │ timestamp   │
│ prev_hash ──┼────┐    │ prev_hash ──┼────┐    │ prev_hash   │
│ hash ───────┼──┐ │    │ hash ───────┼──┐ │    │ hash        │
│ signature   │  │ │    │ signature   │  │ │    │ signature   │
└─────────────┘  │ │    └─────────────┘  │ │    └─────────────┘
                 │ │                      │ │
                 │ └──────────────────────┘ │
                 └──────────────────────────┘
```

---

## 5. Integration Patterns

### 5.1 Basic Integration

```rust
// src-tauri/src/lib.rs
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_gns::init())
        .run(tauri::generate_context!())
        .expect("error running app");
}
```

```typescript
// src/App.tsx
import { createIdentity, gns } from '@anthropic/tauri-plugin-gns-api';

async function initGns() {
  // Check for existing identity
  const identities = await gns.identity.list();
  
  if (identities.length === 0) {
    // Create first identity
    await createIdentity({ name: 'Default', setAsDefault: true });
  }
  
  // Start trajectory collection
  await gns.trajectory.start();
}
```

### 5.2 Custom Configuration

```rust
use tauri_plugin_gns::GnsBuilder;

fn main() {
    let gns_plugin = GnsBuilder::new()
        .relay_urls(vec![
            "https://primary-relay.example.com".into(),
            "https://backup-relay.example.com".into(),
        ])
        .encrypt_storage(true)
        .cache_ttl_seconds(3600)
        .h3_resolution(7)
        .build();

    tauri::Builder::default()
        .plugin(gns_plugin)
        .run(tauri::generate_context!())
        .expect("error running app");
}
```

### 5.3 Capability-Based Permissions

```json
// src-tauri/capabilities/main.json
{
  "identifier": "main",
  "description": "Main window capabilities",
  "windows": ["main"],
  "permissions": [
    "gns:default",
    "gns:allow-delete-identity"
  ]
}
```

### 5.4 Error Handling

```typescript
import { GnsError, GnsErrorCode } from '@anthropic/tauri-plugin-gns-api';

try {
  await gns.resolver.claim('myhandle');
} catch (e) {
  const error = e as GnsError;
  
  switch (error.code) {
    case 'GNS_HANDLE_UNAVAILABLE':
      console.log('Handle already taken');
      break;
    case 'GNS_INSUFFICIENT_TRUST':
      console.log('Need more breadcrumbs to claim handle');
      break;
    case 'GNS_INSUFFICIENT_BREADCRUMBS':
      console.log(`Collected: ${error.details.actual}, Required: ${error.details.required}`);
      break;
    default:
      if (error.recoverable) {
        // Retry logic
      }
  }
}
```

---

## 6. Security Model

### 6.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Key theft | Encrypted storage, optional biometric unlock |
| Man-in-middle | E2E encryption, signature verification |
| Sybil attacks | Proof-of-trajectory requires physical presence |
| Replay attacks | Message timestamps, nonce uniqueness |
| Location tracking | H3 quantization (~5 km² cells), local storage |
| Relay compromise | E2E encryption, client-side signatures |

### 6.2 Key Storage

```
┌────────────────────────────────────────────┐
│              SQLite Database                │
├────────────────────────────────────────────┤
│  identities                                 │
│  ┌────────────────────────────────────┐    │
│  │ public_key: TEXT (hex)             │    │
│  │ secret_key_encrypted: BLOB         │◀───┼── AES-256-GCM with
│  │ encryption_secret: BLOB            │    │   platform keychain
│  │ encryption_public: TEXT            │    │
│  │ ...                                │    │
│  └────────────────────────────────────┘    │
└────────────────────────────────────────────┘
```

### 6.3 Permission System

The plugin uses Tauri's capability system:

- **Default permissions**: Read operations, messaging, resolution
- **Dangerous operations** (require explicit grant): Delete identity, access raw keys
- **Feature-gated** (require feature flag): Trajectory collection, payments

---

## 7. Performance Characteristics

### 7.1 Benchmarks

| Operation | Time (typical) | Notes |
|-----------|----------------|-------|
| Key generation | < 1ms | Ed25519 + X25519 derivation |
| Message encryption | < 2ms | Includes DH, HKDF, ChaCha20 |
| Message decryption | < 2ms | Same as encryption |
| Signature | < 1ms | Ed25519 |
| Verification | < 1ms | Ed25519 |
| H3 encoding | < 0.1ms | Lat/lng to H3 index |
| Handle resolution (cache hit) | < 1ms | SQLite lookup |
| Handle resolution (cache miss) | 50-200ms | Network round-trip |

### 7.2 Storage Footprint

| Data Type | Size (typical) |
|-----------|----------------|
| Identity record | ~200 bytes |
| Message (encrypted) | ~500 bytes + payload |
| Breadcrumb | ~150 bytes |
| Epoch header | ~300 bytes |
| Handle cache entry | ~200 bytes |

### 7.3 Network Usage

- **Message send**: 1 HTTP POST (~1 KB)
- **Message fetch**: 1 HTTP GET (variable, paginated)
- **Handle resolution**: 1 HTTP GET (~500 bytes)
- **Epoch publish**: 1 HTTP POST (~500 bytes header)

---

## 8. Comparison with Alternatives

### 8.1 vs. WorldID (Biometric)

| Aspect | WorldID | tauri-plugin-gns |
|--------|---------|------------------|
| Hardware | Orb device required | Any device |
| Privacy | Iris scan stored | No biometrics |
| Sybil resistance | Strong (one iris = one ID) | Strong (trajectory unfakeable) |
| Offline | No | Yes |
| Decentralization | Centralized (Orb network) | Federated relays |

### 8.2 vs. ENS (Blockchain)

| Aspect | ENS | tauri-plugin-gns |
|--------|-----|------------------|
| Cost | Gas fees + registration | Free |
| Speed | Block confirmation time | Instant |
| Identity model | Wallet-based | Key-based |
| Sybil resistance | Weak (money = identities) | Strong |
| Offline | No | Yes |

### 8.3 vs. OAuth/Social Login

| Aspect | OAuth | tauri-plugin-gns |
|--------|-------|------------------|
| Self-sovereign | No (provider controls) | Yes |
| Privacy | Provider sees activity | No third party |
| Offline | No | Yes |
| Vendor lock-in | High | None |
| Account recovery | Provider-dependent | User-controlled backup |

---

## 9. Future Roadmap

### 9.1 Planned Features

| Version | Features |
|---------|----------|
| 0.2 | WebSocket real-time messaging, group chats |
| 0.3 | Stellar payment integration, invoicing |
| 0.4 | DIX microblogging module, content feeds |
| 0.5 | Biometric key unlock (platform APIs) |
| 1.0 | Stable API, full documentation |

### 9.2 Research Directions

- **Zero-knowledge proofs** for trajectory verification without location disclosure
- **Threshold signatures** for multi-device identity management
- **QUIC transport** for improved relay performance
- **Onion routing** for metadata-resistant messaging

---

## Conclusion

tauri-plugin-gns provides a complete, privacy-preserving identity infrastructure for Tauri applications. By combining battle-tested cryptography with the novel Proof-of-Trajectory system, it offers a practical alternative to centralized identity providers, biometric systems, and speculative blockchain solutions.

The plugin's architecture prioritizes:
- **Security** through standard cryptographic primitives
- **Privacy** through local-first design and H3 quantization
- **Usability** through TypeScript bindings and comprehensive APIs
- **Interoperability** through open standards and federated relays

For developers building applications that respect user sovereignty, tauri-plugin-gns offers a foundation for the decentralized identity layer the internet deserves.

---

## References

1. Bernstein, D. J., et al. "High-speed high-security signatures." Journal of Cryptographic Engineering (2012).
2. Langley, A., Hamburg, M., Turner, S. "Elliptic Curves for Security." RFC 7748 (2016).
3. Nir, Y., Langley, A. "ChaCha20 and Poly1305 for IETF Protocols." RFC 8439 (2018).
4. Krawczyk, H., Eronen, P. "HMAC-based Extract-and-Expand Key Derivation Function." RFC 5869 (2010).
5. Uber Technologies. "H3: A Hexagonal Hierarchical Geospatial Indexing System." (2018).

---

**Patent Notice:** GNS Protocol Proof-of-Trajectory methodology is protected under US Provisional Patent Application #63/948,788.

**License:** This white paper is released under CC BY 4.0. The tauri-plugin-gns software is dual-licensed under MIT and Apache 2.0.
