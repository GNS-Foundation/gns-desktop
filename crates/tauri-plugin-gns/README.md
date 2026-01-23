# tauri-plugin-gns

Self-sovereign identity for Tauri applications through **Proof-of-Trajectory**.

[![Crates.io](https://img.shields.io/crates/v/tauri-plugin-gns.svg)](https://crates.io/crates/tauri-plugin-gns)
[![npm](https://img.shields.io/npm/v/@anthropic/tauri-plugin-gns-api.svg)](https://www.npmjs.com/package/@anthropic/tauri-plugin-gns-api)
[![License](https://img.shields.io/badge/license-MIT%2FApache--2.0-blue.svg)](LICENSE)

## Overview

GNS Protocol (Geospatial Naming System) provides decentralized identity that doesn't require:
- Biometric scanning (no iris scans, no fingerprints)
- Corporate gatekeepers (no registrars, no verification services)
- Trust purchases (no premium accounts, no pay-to-verify)

Instead, GNS uses **Proof-of-Trajectory**: cryptographically-signed location breadcrumbs collected over time create unfakeable behavioral patterns that only real humans moving through the physical world can produce.

**Identity = Your Public Key. Trust = Your Trajectory.**

## Features

- 🔐 **Ed25519 Identity Keys** - Same curve as Stellar, Tor, Signal
- 🔒 **E2E Encrypted Messaging** - X25519 + ChaCha20-Poly1305
- 🌍 **Privacy-Preserving Location** - H3 hexagonal cells, not GPS coordinates
- ⛓️ **Cryptographic Trust Chain** - Breadcrumbs → Blocks → Epochs → Merkle Roots
- 📧 **Human-Readable Addresses** - @handles backed by proof-of-trajectory
- 💾 **Local-First Storage** - Encrypted SQLite, works offline

## Installation

### Rust

Add to your `Cargo.toml`:

```toml
[dependencies]
tauri-plugin-gns = "0.1"
```

Or with features:

```toml
[dependencies]
tauri-plugin-gns = { version = "0.1", features = ["trajectory", "payments"] }
```

### TypeScript/JavaScript

```bash
npm install @anthropic/tauri-plugin-gns-api
# or
yarn add @anthropic/tauri-plugin-gns-api
# or
pnpm add @anthropic/tauri-plugin-gns-api
```

## Quick Start

### 1. Register the Plugin

In your Tauri application's `src-tauri/src/lib.rs`:

```rust
use tauri_plugin_gns::GnsBuilder;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_gns::init())
        // Or with custom configuration:
        // .plugin(
        //     GnsBuilder::new()
        //         .relay_urls(vec!["https://my-relay.example.com".into()])
        //         .encrypt_storage(true)
        //         .build()
        // )
        .run(tauri::generate_context!())
        .expect("error running app");
}
```

### 2. Configure Permissions

In your `tauri.conf.json`:

```json
{
  "plugins": {
    "gns": {
      "relayUrls": ["https://gns-node-production.up.railway.app"],
      "encryptStorage": true
    }
  },
  "app": {
    "security": {
      "capabilities": ["gns:default"]
    }
  }
}
```

### 3. Use from TypeScript

```typescript
import { gns, createIdentity, sendMessage } from '@anthropic/tauri-plugin-gns-api';

// Create your identity
const identity = await createIdentity({ 
  name: 'Alice',
  setAsDefault: true 
});
console.log(`Your public key: ${identity.publicKey}`);

// Start collecting breadcrumbs (builds trust over time)
await gns.trajectory.start();

// Later, claim a @handle (requires sufficient breadcrumbs)
if (await gns.trust.canClaimHandle()) {
  await gns.resolver.claim('alice');
}

// Send an encrypted message
await sendMessage({
  to: '@bob',  // or use their public key
  payload: { type: 'text', content: 'Hello from GNS!' }
});

// Check your trust score
const score = await gns.trust.getScore();
console.log(`Trust: ${score.score}% ${gns.trust.getTierEmoji(score.tier)}`);
```

## Core Concepts

### Identity

Your GNS identity is an Ed25519 keypair. The public key IS your identity - no registration required.

```typescript
// Create identity
const id = await createIdentity({ name: 'My Identity' });

// Sign data
const sig = await gns.identity.sign('Hello, World!');

// Verify signature
const result = await gns.identity.verify(id.publicKey, 'Hello, World!', sig.signature);
```

### Proof-of-Trajectory

Trust is earned by collecting location breadcrumbs over time:

```typescript
// Start collection (typically runs in background)
await gns.trajectory.start();

// Check progress
const status = await gns.trajectory.getStatus();
console.log(`Breadcrumbs: ${status.totalCount}`);
console.log(`Pending: ${status.pendingCount}`);

// Publish epoch when ready
if (await gns.trajectory.canPublishEpoch()) {
  const epoch = await gns.trajectory.publishEpoch();
  console.log(`Published epoch ${epoch.epochIndex}`);
}
```

### Trust Tiers

| Tier | Score | Requirements | Capabilities |
|------|-------|--------------|--------------|
| 🌱 Seedling | 0-19% | New account | Basic messaging |
| 🌿 Rooted | 20-39% | 100 breadcrumbs, 7 days, 10 locations | Claim @handle |
| 🌲 Established | 40-59% | 200 breadcrumbs, 14 days, 20 locations | Send payments |
| 🏔️ Trusted | 60-79% | Consistent patterns | Priority relay |
| ⭐ Verified | 80-100% | Extensive history | Full features |

### @Handles

Human-readable addresses backed by proof-of-trajectory:

```typescript
// Check availability
if (await gns.resolver.isAvailable('myhandle')) {
  // Claim handle (requires Rooted tier)
  await gns.resolver.claim('myhandle');
}

// Resolve handle to public key
const resolved = await gns.resolver.resolve('alice');
console.log(resolved.publicKey);
```

### Encrypted Messaging

End-to-end encrypted messages using X25519 + ChaCha20-Poly1305:

```typescript
// Send message (to handle or public key)
await sendMessage({
  to: '@bob',
  payload: { type: 'text', content: 'Secret message!' }
});

// Get conversations
const convos = await gns.messaging.getConversations();

// Get messages from specific peer
const messages = await gns.messaging.getMessages({ 
  peerPk: resolved.publicKey,
  limit: 50 
});
```

## Features

Enable optional features in `Cargo.toml`:

| Feature | Description |
|---------|-------------|
| `trajectory` | Breadcrumb collection and epoch publishing |
| `biometric` | Platform biometric authentication for key access |
| `payments` | Stellar blockchain payment integration |
| `dix` | Decentralized microblogging (DIX Timeline) |
| `full` | All features enabled |

## Cryptography

GNS uses industry-standard cryptographic primitives:

| Purpose | Algorithm | Library |
|---------|-----------|---------|
| Identity Keys | Ed25519 | `ed25519-dalek` |
| Key Exchange | X25519 | `x25519-dalek` |
| Encryption | ChaCha20-Poly1305 | `chacha20poly1305` |
| Key Derivation | HKDF-SHA256 | `hkdf` |
| Hashing | SHA-256 | `sha2` |
| Location Cells | H3 | `h3o` |

## Privacy

GNS is designed with privacy as a core principle:

1. **No Raw GPS** - Locations are quantized to H3 hexagonal cells (~5 km² at default resolution)
2. **Local Storage** - Breadcrumbs stored locally, only Merkle roots published
3. **End-to-End Encryption** - Messages encrypted before leaving your device
4. **Self-Sovereign Keys** - You control your keys, no custodian

## API Reference

### Identity Module

```typescript
createIdentity(params)      // Create new identity
loadIdentity(publicKey)     // Load existing identity
getIdentity(publicKey?)     // Get identity info
listIdentities()            // List all identities
deleteIdentity(publicKey)   // Delete identity
exportIdentity(pk, pass?)   // Export for backup
importIdentity(params)      // Import from backup
signMessage(msg, pk?)       // Sign with Ed25519
verifySignature(pk, msg, sig) // Verify signature
```

### Messaging Module

```typescript
sendMessage(params)         // Send encrypted message
sendTextMessage(to, text)   // Send text (shorthand)
getMessages(query?)         // Get messages
getMessage(id)              // Get single message
decryptMessage(id)          // Decrypt message
markAsRead(id)              // Mark as read
getConversations()          // List conversations
```

### Resolver Module

```typescript
resolveHandle(handle)       // Resolve @handle → public key
resolveIdentity(pk)         // Resolve pk → GNS record
isHandleAvailable(handle)   // Check availability
claimHandle(handle)         // Claim @handle
releaseHandle(handle)       // Release @handle
getRecord(pk)               // Get GNS record
updateRecord(record)        // Update GNS record
```

### Trust Module

```typescript
getTrustScore()             // Get trust score
getTrustDetails()           // Get detailed breakdown
verifyIdentity(pk?, reqs?)  // Verify meets requirements
canClaimHandle()            // Check handle eligibility
canSendPayments()           // Check payment eligibility
```

### Trajectory Module

```typescript
startCollection()           // Start collecting breadcrumbs
stopCollection()            // Stop collection
getCollectionStatus()       // Get collection status
getBreadcrumbs(query?)      // Get breadcrumbs
publishEpoch()              // Publish new epoch
getEpochs(pk?)              // Get published epochs
verifyChain()               // Verify chain integrity
```

## Testing

### Run All Tests

```bash
# Unit tests
cargo test

# Integration tests
cargo test --test integration

# With specific features
cargo test --all-features
cargo test --test integration --features trajectory
```

### Test Categories

- **Unit Tests**: Within each module (`cargo test`)
- **Integration Tests**: End-to-end flows (`cargo test --test integration`)
  - `crypto_flow`: Key generation, signing, encryption roundtrip
  - `storage_flow`: Database CRUD, caching, concurrent access
  - `trajectory_flow`: H3 cells, breadcrumb chains, epochs (requires `--features trajectory`)

### Benchmarks

```bash
cargo test --test integration bench_ -- --nocapture
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Licensed under either of:

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT License ([LICENSE-MIT](LICENSE-MIT))

at your option.

## Links

- [GNS Protocol Website](https://gns.earth)
- [Documentation](https://docs.gns.earth)
- [Discord Community](https://discord.gg/gns-protocol)
- [GitHub Repository](https://github.com/gns-protocol/tauri-plugin-gns)

---

**HUMANS PREVAIL** 🌍
