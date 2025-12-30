# Contributing to GNS Browser

Thank you for your interest in contributing to GNS Browser! This guide will help you get set up for development.

## Development Setup

### Prerequisites

1. **Rust** (1.70+): https://rustup.rs/
2. **Node.js** (18+): https://nodejs.org/
3. **Platform-specific tools** (see README.md)

### Quick Start

```bash
# Clone the repo
git clone https://github.com/gcrumbs/gns-browser-tauri.git
cd gns-browser-tauri

# Run setup script
./scripts/setup.sh

# Start development
cargo tauri dev
```

## CI/CD Overview

We use GitHub Actions for continuous integration and deployment:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pr-check.yml` | Pull requests | Fast checks (lint, test, type-check) |
| `build.yml` | Push to main, tags | Full builds for all platforms |
| `nightly.yml` | Daily at 4 AM UTC | Catch platform issues early |
| `deploy-wasm.yml` | Push to main (crypto changes) | Deploy WASM to Cloudflare |

### Pull Request Flow

```
1. Create branch from main
2. Make changes
3. Push → triggers pr-check.yml
4. Review & merge → triggers build.yml
5. Tag release → creates GitHub Release
```

## Setting Up Secrets

For full CI/CD functionality, repository admins need to configure these secrets:

### Required Secrets

| Secret | Description | Where to get |
|--------|-------------|--------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare Pages API token | [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens) |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID | Cloudflare Dashboard → Overview |

### macOS Signing (App Store)

| Secret | Description |
|--------|-------------|
| `APPLE_CERTIFICATE` | Base64-encoded .p12 certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the .p12 file |
| `APPLE_SIGNING_IDENTITY` | e.g., "Developer ID Application: Your Name (TEAM_ID)" |
| `APPLE_ID` | Your Apple ID email |
| `APPLE_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | 10-character Team ID |

<details>
<summary>How to get macOS certificates</summary>

1. Open Keychain Access
2. Export your "Developer ID Application" certificate as .p12
3. Base64 encode: `base64 -i certificate.p12 | pbcopy`
4. Paste as `APPLE_CERTIFICATE` secret

</details>

### Windows Signing

| Secret | Description |
|--------|-------------|
| `TAURI_PRIVATE_KEY` | Windows code signing private key |
| `TAURI_KEY_PASSWORD` | Password for the key |

### Android Signing

| Secret | Description |
|--------|-------------|
| `ANDROID_KEYSTORE` | Base64-encoded keystore file |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias in the keystore |
| `ANDROID_KEY_PASSWORD` | Key password |

<details>
<summary>How to create Android keystore</summary>

```bash
# Generate keystore
keytool -genkey -v -keystore gns-release.keystore -alias gns-key -keyalg RSA -keysize 2048 -validity 10000

# Base64 encode
base64 -i gns-release.keystore | pbcopy  # macOS
base64 gns-release.keystore | xclip      # Linux
```

</details>

## Code Style

### Rust

```bash
# Format code
cargo fmt

# Check for issues
cargo clippy

# Run tests
cargo test
```

### TypeScript

```bash
cd ui

# Type check
npm run typecheck

# Lint
npm run lint
```

## Making a Release

1. Update version in:
   - `Cargo.toml` (workspace version)
   - `src-tauri/Cargo.toml`
   - `ui/package.json`
   - `src-tauri/tauri.conf.json`

2. Create a git tag:
   ```bash
   git tag -a v1.2.3 -m "Release v1.2.3"
   git push origin v1.2.3
   ```

3. GitHub Actions will:
   - Build for all platforms
   - Create a draft release
   - Upload artifacts

4. Edit the release notes and publish

## Project Structure

```
gns-browser/
├── crates/
│   ├── gns-crypto-core/    # 🔐 Crypto primitives (Rust)
│   └── gns-crypto-wasm/    # 🌐 WASM bindings
├── src-tauri/              # 📱 Tauri app (Rust)
│   └── src/
│       ├── commands/       # IPC handlers
│       ├── crypto/         # Keychain integration
│       ├── storage/        # SQLite
│       ├── location/       # GPS (mobile)
│       └── network/        # API/WebSocket
├── ui/                     # ⚛️ React frontend
└── .github/workflows/      # 🔄 CI/CD
```

## Testing

### Unit Tests (Rust)

```bash
# All tests
cargo test --workspace

# Specific crate
cargo test -p gns-crypto-core

# With output
cargo test -- --nocapture
```

### WASM Tests

```bash
cd crates/gns-crypto-wasm
wasm-pack test --headless --chrome
```

### E2E Tests

```bash
# Build app
cargo tauri build

# Run with test config
# (E2E framework TBD)
```

## Getting Help

- 📖 [Documentation](https://docs.gcrumbs.com)
- 💬 [Discord](https://discord.gg/gns)
- 🐛 [Issue Tracker](https://github.com/gcrumbs/gns-browser-tauri/issues)

## License

By contributing, you agree that your contributions will be licensed under the BSL-1.1 license.
