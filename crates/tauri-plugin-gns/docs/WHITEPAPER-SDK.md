# GNS Protocol SDK: Developer Integration Guide

**Building Sovereign Identity Applications with Proof-of-Trajectory**

Version 1.0 | January 2026

---

## Executive Summary

The GNS Protocol SDK enables developers to integrate self-sovereign identity into any application. Unlike traditional identity systems that rely on centralized authorities, biometric capture, or blockchain speculation, GNS proves humanity through physical presence in the world.

This document provides a comprehensive guide for developers implementing GNS Protocol across platforms, with detailed specifications for cryptographic operations, network protocols, and integration patterns.

---

## 1. Protocol Overview

### 1.1 Core Principles

**Identity = Public Key**

In GNS Protocol, your Ed25519 public key is your identity. There is no registration process, no username/password, no corporate gatekeeper. Generate a keypair, and you exist.

```
Identity: 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069
Handle:   @alice (optional, earned through trajectory)
```

**Trust = Trajectory**

Trust is not purchased or granted—it is earned by moving through the physical world. Users collect location "breadcrumbs" that form cryptographically-verifiable chains. The longer and more diverse your trajectory, the higher your trust score.

```
Trust Tiers:
  🌱 Seedling    (0-19%)   New identity, basic functions
  🌿 Rooted      (20-39%)  Can claim @handle
  🌲 Established (40-59%)  Can send payments
  🏔️ Trusted     (60-79%)  Priority network access
  ⭐ Verified    (80-100%) Full protocol features
```

**Privacy by Design**

- No GPS coordinates stored—only H3 hexagonal cell indices (~5 km² resolution)
- End-to-end encryption for all messages
- Local-first storage—you control your data
- No biometric capture, no surveillance infrastructure

### 1.2 Protocol Stack

```
┌─────────────────────────────────────────────────────────┐
│                   Application Layer                      │
│  (Your App, DIX Timeline, Messaging, Payments, IoT)     │
├─────────────────────────────────────────────────────────┤
│                    GNS SDK Layer                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │Identity │ │Messaging│ │Resolver │ │ Trust   │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
├─────────────────────────────────────────────────────────┤
│                  Cryptographic Layer                     │
│  Ed25519 | X25519 | ChaCha20-Poly1305 | HKDF | H3      │
├─────────────────────────────────────────────────────────┤
│                   Storage Layer                          │
│  SQLite (Encrypted) | Platform Keychain                 │
├─────────────────────────────────────────────────────────┤
│                   Network Layer                          │
│  GNS Relay Protocol (HTTPS/REST + WebSocket)            │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Cryptographic Specifications

### 2.1 Key Generation

**Ed25519 Identity Keypair**

```
Algorithm: Ed25519 (RFC 8032)
Secret Key: 32 bytes (256 bits) from CSPRNG
Public Key: 32 bytes (derived from secret)
Signature:  64 bytes
```

Implementation (Rust):
```rust
use ed25519_dalek::{SigningKey, VerifyingKey};
use rand::rngs::OsRng;

let secret_key = SigningKey::generate(&mut OsRng);
let public_key = secret_key.verifying_key();

// Hex encoding for wire format
let identity = hex::encode(public_key.as_bytes());
// Example: "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"
```

**X25519 Encryption Keypair (Derived)**

```
Algorithm: X25519 (RFC 7748)
Derivation: HKDF-SHA256
Salt: "gns-x25519-derive" (literal bytes)
Info: empty
Output: 32-byte X25519 secret key
```

Implementation:
```rust
use hkdf::Hkdf;
use sha2::Sha256;
use x25519_dalek::{StaticSecret, PublicKey};

fn derive_x25519(ed25519_secret: &[u8; 32]) -> (StaticSecret, PublicKey) {
    let hkdf = Hkdf::<Sha256>::new(Some(b"gns-x25519-derive"), ed25519_secret);
    let mut x25519_secret_bytes = [0u8; 32];
    hkdf.expand(b"", &mut x25519_secret_bytes).unwrap();
    
    let secret = StaticSecret::from(x25519_secret_bytes);
    let public = PublicKey::from(&secret);
    
    (secret, public)
}
```

### 2.2 Message Encryption

**Protocol: X25519 + HKDF + ChaCha20-Poly1305**

```
1. EPHEMERAL KEY GENERATION
   eph_secret, eph_public = X25519.generate()

2. KEY EXCHANGE
   shared_secret = X25519.DH(eph_secret, recipient_public)

3. KEY DERIVATION
   encryption_key = HKDF-SHA256(
     ikm: shared_secret,
     salt: "gns-message-key",
     info: sender_pk || recipient_pk || eph_public,
     length: 32
   )

4. ENCRYPTION
   nonce = random(12 bytes)
   ciphertext = ChaCha20-Poly1305.encrypt(
     key: encryption_key,
     nonce: nonce,
     plaintext: JSON.serialize(payload),
     aad: empty
   )

5. SIGNATURE
   signature = Ed25519.sign(
     key: sender_secret,
     message: ciphertext || eph_public || nonce || timestamp
   )

6. ENVELOPE
   {
     "version": 1,
     "from_pk": sender_public_key_hex,
     "to_pk": recipient_public_key_hex,
     "ephemeral_pk": eph_public_hex,
     "encrypted_payload": base64(ciphertext),
     "nonce": hex(nonce),
     "signature": hex(signature),
     "message_id": uuid_v4,
     "timestamp": iso8601
   }
```

### 2.3 Breadcrumb Chain

**Structure**

```
Breadcrumb {
  id: UUID v4
  h3_index: H3 cell index (resolution 7 default)
  h3_resolution: 7 (configurable 0-15)
  timestamp: ISO 8601
  prev_hash: SHA-256 of previous breadcrumb (hex)
  hash: SHA-256 of this breadcrumb (hex)
  signature: Ed25519 signature (hex)
  source: "gps" | "wifi" | "cell" | "network" | "manual" | "fused"
  accuracy: float (meters, optional)
  published: boolean
}
```

**Hash Calculation**

```
hash = SHA-256(
  h3_index || 
  h3_resolution.to_string() || 
  timestamp || 
  prev_hash || 
  source
)
```

**Signature**

```
signature = Ed25519.sign(
  key: identity_secret,
  message: hash
)
```

### 2.4 Epoch Publication

**Merkle Tree Construction**

```
Given breadcrumbs B1, B2, B3, B4:

        Merkle Root
           /    \
         H12    H34
         / \    / \
       H1  H2  H3  H4
       |   |   |   |
       B1  B2  B3  B4

H1 = SHA-256(B1.hash)
H2 = SHA-256(B2.hash)
H12 = SHA-256(H1 || H2)
...
```

**Epoch Header**

```
EpochHeader {
  identity: public_key_hex
  epoch_index: sequential integer
  start_time: ISO 8601 (first breadcrumb)
  end_time: ISO 8601 (last breadcrumb)
  merkle_root: hex
  block_count: integer
  prev_epoch_hash: hex (optional)
  signature: Ed25519(epoch_hash)
  epoch_hash: SHA-256(identity || epoch_index || merkle_root || prev_epoch_hash)
}
```

---

## 3. Network Protocol

### 3.1 Relay API

GNS operates through federated relay servers. Any entity can run a relay.

**Base URL**: `https://relay.example.com/api/v1`

**Endpoints**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/handles/{handle}` | Resolve @handle to public key |
| POST | `/handles/claim` | Claim a @handle |
| POST | `/handles/{handle}/release` | Release a @handle |
| GET | `/identities/{pk}` | Get GNS record for public key |
| POST | `/identities` | Update GNS record |
| POST | `/messages` | Send encrypted message |
| GET | `/messages?to={pk}&since={ts}` | Fetch messages |
| POST | `/epochs` | Publish epoch |
| GET | `/epochs?identity={pk}` | Get epochs for identity |
| GET | `/health` | Relay health check |

### 3.2 Handle Resolution

**Request**
```
GET /handles/alice
```

**Response (200 OK)**
```json
{
  "handle": "alice",
  "public_key": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
  "encryption_key": "a1b2c3d4e5f6...",
  "trust_score": 45,
  "breadcrumb_count": 234,
  "resolved_at": "2026-01-15T10:30:00Z"
}
```

**Response (404 Not Found)**
```json
{
  "error": "HANDLE_NOT_FOUND",
  "message": "Handle @alice is not registered"
}
```

### 3.3 Handle Claiming

**Request**
```
POST /handles/claim
Content-Type: application/json

{
  "handle": "alice",
  "identity": "7f83b165...",
  "proof": {
    "breadcrumb_count": 150,
    "trust_score": 25,
    "first_breadcrumb_at": "2025-12-01T00:00:00Z",
    "latest_epoch_root": "abc123..."
  },
  "signature": "ed25519_signature_of_claim..."
}
```

**Response (201 Created)**
```json
{
  "handle": "alice",
  "claimed_at": "2026-01-15T10:30:00Z"
}
```

**Response (409 Conflict)**
```json
{
  "error": "HANDLE_UNAVAILABLE",
  "message": "Handle @alice is already claimed"
}
```

### 3.4 Message Sending

**Request**
```
POST /messages
Content-Type: application/json

{
  "version": 1,
  "from_pk": "7f83b165...",
  "to_pk": "deadbeef...",
  "ephemeral_pk": "a1b2c3d4...",
  "encrypted_payload": "base64...",
  "nonce": "hex12bytes...",
  "signature": "ed25519sig...",
  "message_id": "uuid-v4",
  "timestamp": "2026-01-15T10:30:00Z"
}
```

**Response (202 Accepted)**
```json
{
  "message_id": "uuid-v4",
  "accepted_at": "2026-01-15T10:30:00Z"
}
```

### 3.5 Message Fetching

**Request**
```
GET /messages?to=7f83b165...&since=2026-01-15T00:00:00Z
X-GNS-PublicKey: 7f83b165...
```

**Response (200 OK)**
```json
{
  "messages": [
    {
      "version": 1,
      "from_pk": "deadbeef...",
      "to_pk": "7f83b165...",
      "ephemeral_pk": "a1b2c3d4...",
      "encrypted_payload": "base64...",
      "nonce": "hex12bytes...",
      "signature": "ed25519sig...",
      "message_id": "uuid-v4",
      "timestamp": "2026-01-15T10:30:00Z"
    }
  ],
  "has_more": false
}
```

---

## 4. Platform Integration

### 4.1 Tauri (Desktop/Mobile)

```rust
// Add plugin
tauri::Builder::default()
    .plugin(tauri_plugin_gns::init())
    .run(tauri::generate_context!())
```

```typescript
// TypeScript usage
import { gns, createIdentity } from '@anthropic/tauri-plugin-gns-api';

const identity = await createIdentity({ name: 'Alice' });
await gns.messaging.send({ to: '@bob', payload: { type: 'text', content: 'Hello!' } });
```

### 4.2 Flutter (Mobile)

```dart
// Dart package (gns_protocol)
import 'package:gns_protocol/gns_protocol.dart';

final gns = GnsProtocol();
await gns.init();

final identity = await gns.createIdentity(name: 'Alice');
await gns.sendMessage(to: '@bob', content: 'Hello!');
```

### 4.3 React Native

```typescript
// npm package (@gns-protocol/react-native)
import { GnsProvider, useGns } from '@gns-protocol/react-native';

function App() {
  return (
    <GnsProvider config={{ relayUrl: 'https://relay.gns.earth' }}>
      <MainScreen />
    </GnsProvider>
  );
}

function MainScreen() {
  const { identity, sendMessage } = useGns();
  // ...
}
```

### 4.4 Web (Browser)

```typescript
// npm package (@gns-protocol/web)
import { GnsClient } from '@gns-protocol/web';

const gns = new GnsClient({
  relayUrl: 'https://relay.gns.earth',
  storage: 'indexeddb' // or 'localstorage'
});

await gns.init();
const identity = await gns.createIdentity({ name: 'Alice' });
```

### 4.5 Node.js (Server)

```typescript
// npm package (@gns-protocol/node)
import { GnsServer } from '@gns-protocol/node';

const gns = new GnsServer({
  relayUrl: 'https://relay.gns.earth',
  storagePath: './gns-data'
});

// Server-to-server messaging
await gns.sendMessage({
  from: serverIdentity,
  to: '@user',
  payload: { type: 'system', content: 'Welcome!' }
});
```

---

## 5. Trust System Deep Dive

### 5.1 Score Calculation

```
Trust Score = (
  0.25 × TrajectoryQuality +
  0.20 × TemporalConsistency +
  0.20 × ChainIntegrity +
  0.20 × EpochReliability +
  0.15 × GeographicDiversity
)
```

**Trajectory Quality** (0-100)
- Measures realistic movement patterns
- Penalizes teleportation (impossible speed)
- Rewards natural daily/weekly rhythms

**Temporal Consistency** (0-100)
- Regular breadcrumb collection intervals
- Consistent daily activity
- Continuous presence over weeks/months

**Chain Integrity** (0-100)
- Valid hash chains (no tampering)
- No gaps in sequence
- Valid signatures on all breadcrumbs

**Epoch Reliability** (0-100)
- Published epochs at regular intervals
- Valid Merkle proofs
- Epochs verified by network

**Geographic Diversity** (0-100)
- Unique H3 cells visited
- Coverage across regions
- Realistic travel patterns

### 5.2 Trust Requirements

| Action | Min Score | Min Breadcrumbs | Min Age | Min Locations |
|--------|-----------|-----------------|---------|---------------|
| Basic messaging | 0% | 0 | 0 | 0 |
| Claim @handle | 20% | 100 | 7 days | 10 |
| Send payments | 40% | 200 | 14 days | 20 |
| Run relay | 60% | 500 | 30 days | 50 |
| Protocol governance | 80% | 1000 | 90 days | 100 |

### 5.3 Sybil Resistance Analysis

Creating fake identities is expensive:

1. **Physical Presence Required**: Must physically move to collect breadcrumbs
2. **Time Investment**: Building trust takes weeks/months
3. **Diversity Required**: Multiple locations, not just repeated visits
4. **Verifiable Patterns**: Unrealistic patterns detected and penalized

Attack cost estimation:
- 100 breadcrumbs × 10 locations × 7 days = ~170 hours of physical movement
- Multiple identities = multiplicative cost
- Automated spoofing detectable via pattern analysis

---

## 6. Storage Schema

### 6.1 SQLite Tables

```sql
-- Identities
CREATE TABLE identities (
  public_key TEXT PRIMARY KEY,
  secret_key_encrypted BLOB NOT NULL,
  encryption_secret BLOB NOT NULL,
  encryption_public TEXT NOT NULL,
  name TEXT NOT NULL,
  handle TEXT,
  created_at TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  trust_score REAL DEFAULT 0,
  breadcrumb_count INTEGER DEFAULT 0
);

-- Messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  from_pk TEXT NOT NULL,
  to_pk TEXT NOT NULL,
  payload TEXT NOT NULL,
  ephemeral_pk TEXT,
  nonce TEXT,
  signature TEXT NOT NULL,
  created_at TEXT NOT NULL,
  received_at TEXT,
  is_read INTEGER DEFAULT 0,
  decrypted_cache TEXT
);
CREATE INDEX idx_messages_from ON messages(from_pk);
CREATE INDEX idx_messages_to ON messages(to_pk);
CREATE INDEX idx_messages_created ON messages(created_at);

-- Breadcrumbs
CREATE TABLE breadcrumbs (
  id TEXT PRIMARY KEY,
  identity_pk TEXT NOT NULL REFERENCES identities(public_key) ON DELETE CASCADE,
  h3_index TEXT NOT NULL,
  h3_resolution INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  signature TEXT NOT NULL,
  source TEXT NOT NULL,
  accuracy REAL,
  published INTEGER DEFAULT 0
);
CREATE INDEX idx_breadcrumbs_identity ON breadcrumbs(identity_pk);
CREATE INDEX idx_breadcrumbs_timestamp ON breadcrumbs(timestamp);

-- Epochs
CREATE TABLE epochs (
  epoch_hash TEXT PRIMARY KEY,
  identity_pk TEXT NOT NULL REFERENCES identities(public_key) ON DELETE CASCADE,
  epoch_index INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  merkle_root TEXT NOT NULL,
  block_count INTEGER NOT NULL,
  prev_epoch_hash TEXT,
  signature TEXT NOT NULL
);

-- Handle Cache
CREATE TABLE handle_cache (
  handle TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  encryption_key TEXT NOT NULL,
  trust_score REAL,
  breadcrumb_count INTEGER,
  cached_at TEXT NOT NULL
);

-- Contacts
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  owner_pk TEXT NOT NULL REFERENCES identities(public_key) ON DELETE CASCADE,
  contact_pk TEXT NOT NULL,
  name TEXT NOT NULL,
  handle TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(owner_pk, contact_pk)
);
```

---

## 7. Error Handling

### 7.1 Error Codes

| Code | Description | Recovery |
|------|-------------|----------|
| GNS_CRYPTO | Cryptographic operation failed | Check inputs |
| GNS_STORAGE | Database error | Retry, check disk |
| GNS_NETWORK | Network request failed | Retry with backoff |
| GNS_IDENTITY_NOT_FOUND | Identity not in local storage | Create or import |
| GNS_HANDLE_NOT_FOUND | Handle not registered | Check spelling |
| GNS_HANDLE_UNAVAILABLE | Handle already claimed | Choose different |
| GNS_INVALID_HANDLE | Handle format invalid | Fix format |
| GNS_DECRYPTION_FAILED | Cannot decrypt message | Check keys |
| GNS_INVALID_SIGNATURE | Signature verification failed | Message tampered |
| GNS_INSUFFICIENT_TRUST | Trust score too low | Collect breadcrumbs |
| GNS_INSUFFICIENT_BREADCRUMBS | Not enough breadcrumbs | Continue collecting |
| GNS_PERMISSION_DENIED | Operation not permitted | Check permissions |
| GNS_RATE_LIMITED | Too many requests | Wait and retry |

### 7.2 Retry Strategy

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!error.recoverable || attempt === maxAttempts) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

## 8. Security Best Practices

### 8.1 Key Management

1. **Never log secret keys**
2. **Use platform keychain** for key storage when available
3. **Encrypt database** with strong passphrase
4. **Support key backup** via encrypted export
5. **Implement key rotation** for long-lived identities

### 8.2 Network Security

1. **Always use HTTPS** for relay communication
2. **Verify TLS certificates** (no certificate pinning in dev)
3. **Implement request signing** for authenticated endpoints
4. **Rate limit** client requests to prevent abuse

### 8.3 Privacy Protection

1. **Use H3 resolution 7** or higher (5 km² cells)
2. **Don't store raw GPS** coordinates
3. **Encrypt all messages** before transmission
4. **Clear sensitive data** from memory after use

---

## 9. Running a Relay

### 9.1 Requirements

- Linux server (Ubuntu 22.04+ recommended)
- 2+ CPU cores, 4GB+ RAM
- PostgreSQL 14+
- Domain with TLS certificate

### 9.2 Configuration

```yaml
# relay-config.yaml
server:
  host: 0.0.0.0
  port: 443
  tls:
    cert: /etc/ssl/relay.crt
    key: /etc/ssl/relay.key

database:
  url: postgresql://user:pass@localhost/gns_relay

limits:
  max_message_size: 1048576  # 1 MB
  rate_limit_per_minute: 100
  cache_ttl_seconds: 3600

federation:
  peers:
    - https://relay1.gns.earth
    - https://relay2.gns.earth
```

### 9.3 API Implementation

Relay operators must implement the full GNS Relay Protocol (Section 3) and participate in federated message routing.

---

## 10. Appendices

### A. H3 Resolution Reference

| Resolution | Avg Area | Use Case |
|------------|----------|----------|
| 5 | ~253 km² | Country-level |
| 6 | ~36 km² | Region-level |
| 7 | ~5.2 km² | **City-level (default)** |
| 8 | ~0.74 km² | Neighborhood |
| 9 | ~0.11 km² | Block |
| 10 | ~0.015 km² | Building |

### B. Wire Format Examples

**GNS Record**
```json
{
  "version": 1,
  "identity": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
  "handle": "alice",
  "encryption_key": "a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd",
  "modules": [
    {
      "id": "profile",
      "schema": "profile@1.0",
      "name": "Public Profile",
      "is_public": true,
      "data_url": "https://gns.earth/records/7f83b165/profile.json"
    }
  ],
  "endpoints": [
    {
      "type": "relay",
      "protocol": "https",
      "address": "relay.gns.earth",
      "port": 443,
      "priority": 1,
      "is_active": true
    }
  ],
  "epoch_roots": [
    "abc123...",
    "def456..."
  ],
  "trust_score": 45.5,
  "breadcrumb_count": 234,
  "created_at": "2025-12-01T00:00:00Z",
  "updated_at": "2026-01-15T10:30:00Z"
}
```

### C. Reserved Handles

The following handles are reserved and cannot be claimed:

```
admin, root, system, gns, gcrumbs, support, help, info, contact,
null, undefined, localhost, api, www, mail, smtp, ftp, ssh
```

---

## Contact

- **Website**: https://gns.earth
- **Documentation**: https://docs.gns.earth
- **GitHub**: https://github.com/gns-protocol
- **Discord**: https://discord.gg/gns-protocol

---

**HUMANS PREVAIL** 🌍

*Patent Pending: US Provisional #63/948,788*
