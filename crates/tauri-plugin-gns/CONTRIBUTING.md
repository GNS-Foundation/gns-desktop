# Contributing to tauri-plugin-gns

Thank you for your interest in contributing to the GNS Protocol Tauri plugin! This document provides guidelines for contributing.

## Getting Started

### Prerequisites

- Rust 1.70+ with cargo
- Node.js 18+ with npm
- Tauri CLI 2.0+

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/gns-protocol/tauri-plugin-gns.git
   cd tauri-plugin-gns
   ```

2. Build the Rust plugin:
   ```bash
   cargo build --all-features
   ```

3. Build the TypeScript bindings:
   ```bash
   cd guest-js
   npm install
   npm run build
   ```

4. Run tests:
   ```bash
   cargo test --all-features
   ```

## Development Workflow

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/changes

### Commit Messages

Follow conventional commits:
```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(crypto): add X25519 key agreement`
- `fix(storage): handle encrypted key derivation`
- `docs(readme): update installation instructions`

### Pull Request Process

1. Fork the repository and create your branch from `main`
2. Update documentation for any changed functionality
3. Add tests for new features
4. Ensure all tests pass (`cargo test --all-features`)
5. Run clippy (`cargo clippy --all-features -- -D warnings`)
6. Run rustfmt (`cargo fmt --all`)
7. Submit a pull request

## Code Guidelines

### Rust

- Follow Rust API guidelines
- Use meaningful variable and function names
- Document public APIs with doc comments
- Use `Result` for fallible operations
- Prefer `thiserror` for error types

```rust
/// Derives an X25519 public key from an Ed25519 secret key.
///
/// # Arguments
/// * `ed25519_secret` - The Ed25519 secret key bytes
///
/// # Returns
/// The X25519 public key as a base64 string
///
/// # Errors
/// Returns `Error::CryptoError` if key derivation fails
pub fn derive_x25519_public_key(ed25519_secret: &[u8]) -> Result<String> {
    // implementation
}
```

### TypeScript

- Use TypeScript strict mode
- Provide JSDoc comments for public functions
- Export types alongside functions
- Use async/await for Tauri invoke calls

```typescript
/**
 * Creates a new GNS identity with an Ed25519 keypair.
 * 
 * @param name - Human-readable name for the identity
 * @returns The created identity with public key
 * @throws {GnsError} If identity creation fails
 * 
 * @example
 * ```typescript
 * const identity = await createIdentity("My Identity");
 * console.log(identity.publicKey);
 * ```
 */
export async function createIdentity(name?: string): Promise<Identity> {
  return invoke<Identity>('plugin:gns|create_identity', { name });
}
```

### Security Considerations

This plugin handles sensitive cryptographic operations. When contributing:

1. **Never log secret keys** - Only log public keys or hashes
2. **Validate all inputs** - Check parameters before cryptographic operations
3. **Use constant-time comparisons** - For any security-sensitive comparisons
4. **Clear sensitive data** - Zeroize secret keys when done
5. **Follow cryptographic best practices** - Use established libraries, don't roll your own crypto

### Testing

- Unit tests for all new functions
- Integration tests for command flows
- Test error conditions, not just happy paths
- Use meaningful test names

```rust
#[test]
fn test_key_derivation_produces_valid_x25519_key() {
    let (pk, sk) = generate_keypair();
    let x25519_pk = derive_x25519_public_key(&sk).unwrap();
    
    assert_eq!(x25519_pk.len(), 44); // base64 of 32 bytes
}

#[test]
fn test_key_derivation_fails_with_invalid_input() {
    let result = derive_x25519_public_key(&[0u8; 16]);
    assert!(result.is_err());
}
```

## Feature Flags

The plugin uses feature flags for optional functionality:

| Flag | Description |
|------|-------------|
| `trajectory` | Location-based breadcrumb collection |
| `biometric` | Platform biometric authentication |
| `payments` | Stellar blockchain integration |
| `dix` | Decentralized microblogging |
| `full` | Enable all features |

When adding features:
1. Use `#[cfg(feature = "...")]` for conditional compilation
2. Update `Cargo.toml` features section
3. Document the feature in README.md
4. Add feature-specific tests

## Platform Considerations

### iOS

- Location permissions require `NSLocationWhenInUseUsageDescription`
- Keychain access requires appropriate entitlements
- Test on real devices for location features

### Android

- Location requires `ACCESS_FINE_LOCATION` permission
- Keystore operations need appropriate API levels
- Test on multiple Android versions

### Desktop

- Consider cross-platform key storage
- Test on all three major platforms
- Handle platform-specific path separators

## Documentation

- Update README.md for user-facing changes
- Add doc comments for new public APIs
- Update CHANGELOG.md following [Keep a Changelog](https://keepachangelog.com/)
- Consider adding examples for complex features

## Questions?

- Open an issue for bugs or feature requests
- Join the GNS Discord for discussions
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the same terms as the project (MIT OR Apache-2.0).
