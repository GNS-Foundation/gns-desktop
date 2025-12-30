#!/bin/bash
# fix_build.sh - Run this from gns-browser-tauri root directory

set -e
echo "🔧 Fixing GNS Browser Tauri build issues..."

# Check we're in the right directory
if [ ! -f "src-tauri/Cargo.toml" ]; then
    echo "❌ Error: Run this from the gns-browser-tauri directory"
    exit 1
fi

# 1. Fix main.rs - add Emitter import
echo "📝 Fixing main.rs imports..."
sed -i '' 's/use tauri::Manager;/use tauri::{Manager, Emitter};/' src-tauri/src/main.rs

# 2. Remove unused BreadcrumbCollector import
sed -i '' '/use crate::location::BreadcrumbCollector;/d' src-tauri/src/main.rs

# 3. Fix messaging.rs - remove broken import
echo "📝 Fixing messaging.rs..."
if grep -q "create_envelope_with_metadata" src-tauri/src/commands/messaging.rs; then
    sed -i '' 's/use gns_crypto_core::{create_envelope_with_metadata, GnsIdentity};/\/\/ TODO: Add envelope function when implemented\n\/\/ use gns_crypto_core::GnsIdentity;/' src-tauri/src/commands/messaging.rs
fi

# 4. Fix crypto/mod.rs unused Arc
echo "📝 Fixing crypto/mod.rs..."
sed -i '' 's/^use std::sync::Arc;$/\/\/ use std::sync::Arc;/' src-tauri/src/crypto/mod.rs 2>/dev/null || true

# 5. Fix unused variables (prefix with underscore)
echo "📝 Fixing unused variables..."
sed -i '' 's/enabled: bool,/_enabled: bool,/' src-tauri/src/commands/breadcrumbs.rs 2>/dev/null || true
sed -i '' 's/before_id: Option<&str>,/_before_id: Option<\&str>,/' src-tauri/src/storage/mod.rs 2>/dev/null || true
sed -i '' 's/payload: &\[u8\],/_payload: \&[u8],/' src-tauri/src/storage/mod.rs 2>/dev/null || true
sed -i '' 's/fn setup_deep_links(app_handle:/fn setup_deep_links(_app_handle:/' src-tauri/src/main.rs 2>/dev/null || true

echo "✅ All fixes applied!"
echo ""
echo "Now run:"
echo "  git add ."
echo "  git commit -m 'Fix: build errors for desktop and WASM'"
echo "  git push"
