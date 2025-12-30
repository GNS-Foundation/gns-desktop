# GNS Browser

**The Identity Web Browser** - A unified cross-platform application built with Tauri 2.0 and Rust.

<p align="center">
  <img src="docs/logo.png" alt="GNS Browser" width="200">
</p>

## Overview

GNS Browser is the official client for the Global Name System (GNS), a decentralized identity protocol that proves humanity through "proof-of-trajectory" rather than biometric scanning.

### Key Features

- 🔐 **Cryptographic Identity** - Ed25519 signing + X25519 encryption
- 📍 **Proof-of-Trajectory** - Collect breadcrumbs to prove you're human
- 💬 **End-to-End Encrypted Messaging** - Private by default
- 🌐 **@handle System** - Claim your permanent identity
- 💰 **GNS Token Integration** - Stellar-based payments
- 📱 **Cross-Platform** - iOS, Android, macOS, Windows, Linux

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Rust Crypto Core (gns-crypto-core)                 │
│  ═══════════════════════════════════════            │
│  • ed25519-dalek (signing)                          │
│  • x25519-dalek (key exchange)                      │
│  • chacha20poly1305 (AEAD encryption)               │
└─────────────────────────────────────────────────────┘
              │                        │
              ▼                        ▼
┌─────────────────────┐    ┌─────────────────────────┐
│  Tauri 2.0 Native   │    │  WebAssembly (WASM)     │
│  (Mobile + Desktop) │    │  (Panthera Browser)     │
└─────────────────────┘    └─────────────────────────┘
```

**One Rust implementation serves all platforms**, guaranteeing cryptographic consistency.

## Project Structure

```
gns-browser/
├── Cargo.toml                 # Workspace configuration
├── crates/
│   ├── gns-crypto-core/       # Core cryptographic library
│   │   ├── src/
│   │   │   ├── identity.rs    # GnsIdentity (Ed25519 + X25519)
│   │   │   ├── encryption.rs  # ChaCha20-Poly1305 encryption
│   │   │   ├── signing.rs     # Ed25519 signatures
│   │   │   ├── envelope.rs    # GNS message envelopes
│   │   │   └── breadcrumb.rs  # Location proof system
│   │   └── Cargo.toml
│   │
│   └── gns-crypto-wasm/       # WebAssembly bindings
│       ├── src/lib.rs         # WASM exports
│       └── Cargo.toml
│
├── src-tauri/                 # Tauri application
│   ├── src/
│   │   ├── main.rs            # Application entry point
│   │   ├── commands/          # IPC command handlers
│   │   │   ├── identity.rs    # Identity management
│   │   │   ├── messaging.rs   # Message handling
│   │   │   ├── handles.rs     # @handle resolution
│   │   │   ├── breadcrumbs.rs # Location collection
│   │   │   └── network.rs     # Connection management
│   │   ├── crypto/            # Keychain integration
│   │   ├── storage/           # SQLite database
│   │   ├── location/          # GPS collection (mobile)
│   │   └── network/           # API & WebSocket
│   ├── tauri.conf.json        # Tauri configuration
│   └── Cargo.toml
│
├── ui/                        # React frontend
│   ├── src/
│   │   ├── App.tsx            # Main application
│   │   ├── components/        # React components
│   │   ├── lib/
│   │   │   └── tauri.ts       # Type-safe IPC hooks
│   │   └── index.css          # Tailwind styles
│   ├── package.json
│   └── vite.config.ts
│
└── scripts/                   # Build & deployment scripts
```

## Development Setup

### Prerequisites

- [Rust](https://rustup.rs/) 1.70+
- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) (recommended) or npm

### Platform-Specific Requirements

**macOS:**
```bash
xcode-select --install
```

**Linux:**
```bash
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev
```

**Windows:**
- Visual Studio Build Tools with C++ workload
- WebView2 (usually pre-installed on Windows 10/11)

**iOS Development:**
```bash
# Requires macOS
xcode-select --install
rustup target add aarch64-apple-ios
cargo install tauri-cli --version "^2.0.0"
```

**Android Development:**
```bash
# Install Android Studio and SDK
rustup target add aarch64-linux-android armv7-linux-androideabi
```

### Quick Start

```bash
# Clone the repository
git clone https://github.com/gcrumbs/gns-browser.git
cd gns-browser

# Install UI dependencies
cd ui && pnpm install && cd ..

# Run in development mode
cargo tauri dev

# Build for production
cargo tauri build
```

### Building for Mobile

**iOS:**
```bash
cargo tauri ios init
cargo tauri ios dev
cargo tauri ios build
```

**Android:**
```bash
cargo tauri android init
cargo tauri android dev
cargo tauri android build
```

### Building WASM (for Panthera)

```bash
cd crates/gns-crypto-wasm
wasm-pack build --target web --release
```

## IPC Commands

All cryptographic operations happen in Rust. The UI communicates via typed IPC commands:

### Identity
- `get_public_key()` → `string | null`
- `get_encryption_key()` → `string | null`
- `get_current_handle()` → `string | null`
- `generate_identity()` → `IdentityInfo`
- `import_identity(privateKeyHex)` → `IdentityInfo`

### Handles
- `resolve_handle(handle)` → `HandleInfo | null`
- `check_handle_available(handle)` → `HandleAvailability`
- `claim_handle(handle)` → `ClaimResult`

### Messaging
- `send_message(params)` → `SendResult`
- `get_threads()` → `ThreadPreview[]`
- `get_messages(threadId)` → `Message[]`

### Breadcrumbs
- `get_breadcrumb_count()` → `number`
- `get_breadcrumb_status()` → `BreadcrumbStatus`
- `set_collection_enabled(enabled)` → `void`

See `ui/src/lib/tauri.ts` for complete type definitions.

## Security Model

```
UNTRUSTED ZONE (WebView)          TRUSTED ZONE (Rust)
─────────────────────────          ────────────────────
• User input                       • Private keys (keychain)
• UI rendering                     • All crypto operations
• Remote-loaded content            • Signature generation
                                   • Encryption/decryption
        │                          • Breadcrumb signing
        │    Tauri IPC Barrier
        └──────────────────────────────▶
```

**Private keys NEVER leave Rust.** The WebView only receives public keys and encrypted data.

## Breadcrumb Collection Strategy

Collection frequency adapts to user lifecycle:

| User State | Interval | Battery Impact |
|------------|----------|----------------|
| New (< 100 crumbs) | 30 seconds | ~10%/day |
| Established (handle claimed) | 10 minutes (motion-aware) | ~3%/day |
| Low Battery | 30 minutes | < 1%/day |

## Testing

```bash
# Run all Rust tests
cargo test --workspace

# Run specific crate tests
cargo test -p gns-crypto-core

# Run WASM tests
cd crates/gns-crypto-wasm
wasm-pack test --headless --chrome

# Run UI tests
cd ui && pnpm test
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GNS_API_URL` | Backend API endpoint | `https://api.gcrumbs.com` |
| `GNS_RELAY_URL` | WebSocket relay | `wss://relay.gcrumbs.com` |
| `GNS_LOG_LEVEL` | Logging verbosity | `info` |

### tauri.conf.json

Key configuration options:
- `app.windows[0].width/height` - Default window size
- `bundle.identifier` - App bundle ID
- `bundle.iOS/android` - Platform-specific settings

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Rust: `cargo fmt` and `cargo clippy`
- TypeScript: `pnpm lint`

## License

This project is licensed under the Business Source License 1.1.

## Links

- **Website:** https://gcrumbs.com
- **Documentation:** https://docs.gcrumbs.com
- **API Reference:** https://api.gcrumbs.com/docs
- **Support:** support@gcrumbs.com

---

<p align="center">
  Built with ❤️ by the GNS Team
</p>
