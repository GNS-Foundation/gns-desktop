# Changelog

All notable changes to `tauri-plugin-gns` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-01-13

### Added

#### Core Identity System
- **Ed25519 identity key generation** - Cryptographically secure keypairs for user identity
- **Identity management commands** - Create, load, list, delete, export, and import identities
- **Multi-identity support** - Users can manage multiple identities with default selection
- **Identity signing and verification** - Sign arbitrary messages with identity keys

#### Encrypted Messaging
- **End-to-end encryption** - X25519 key exchange with ChaCha20-Poly1305 AEAD
- **Forward secrecy** - Ephemeral keys per message prevent retroactive decryption
- **Message types** - Text, file, image, location, typing indicators, read receipts
- **Conversation management** - Thread-based message organization with unread tracking

#### Handle Resolution (GNS @handles)
- **Decentralized naming** - Human-readable @handles backed by Proof-of-Trajectory
- **Handle validation** - Client-side and server-side validation rules
- **Handle claiming** - Claim handles after meeting trust requirements
- **Network resolution** - Resolve handles to public keys via GNS relays

#### Trust System (Proof-of-Trajectory)
- **Trust score calculation** - Five-component weighted scoring algorithm
- **Trust tiers** - Seedling (🌱), Rooted (🌿), Established (🌲), Trusted (🏔️), Verified (⭐)
- **Requirement verification** - Verify identities meet requirements for operations
- **Anti-Sybil protection** - Location-based proofs make bot creation expensive

#### Trajectory Collection
- **H3 hexagonal quantization** - Privacy-preserving location representation
- **Breadcrumb chain** - Hash-linked location proofs with Ed25519 signatures
- **Epoch publication** - Bundle breadcrumbs into verifiable epochs
- **Configurable resolution** - Adjustable privacy/precision tradeoff

#### Platform Support
- **Tauri 2.0 integration** - Full plugin architecture with commands and events
- **Permission system** - Capability-based security for all operations
- **TypeScript bindings** - Complete API with ESM and CJS exports
- **Cross-platform** - Desktop (macOS, Windows, Linux), Mobile (iOS, Android)

### Security

- All cryptographic operations use established, audited libraries
- No raw GPS coordinates stored - only H3 cell indices
- Local-first architecture - data never leaves device without explicit action
- Encrypted SQLite storage with platform keychain integration

### Developer Experience

- Comprehensive TypeScript types with JSDoc documentation
- Unified `gns` client object with namespaced modules
- Individual function exports for tree-shaking
- Helper functions for formatting and validation
- React example application demonstrating all features

## [0.0.1] - 2024-12-01

### Added

- Initial project structure
- Basic Ed25519 key generation
- SQLite storage foundation

---

## Versioning Policy

This plugin follows semantic versioning:

- **MAJOR** (1.0.0): Breaking API changes
- **MINOR** (0.1.0): New features, backward compatible
- **PATCH** (0.0.1): Bug fixes, backward compatible

## Upgrade Notes

### 0.0.x → 0.1.0

This is the first feature-complete release. No migration required from pre-release versions.

## Links

- [GNS Protocol](https://gns.earth)
- [Tauri Plugins](https://github.com/tauri-apps/plugins-workspace)
- [Issue Tracker](https://github.com/tauri-apps/plugins-workspace/issues)
