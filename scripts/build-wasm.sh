#!/bin/bash
set -e

echo "🦀 Building GNS Crypto WASM..."

cd "$(dirname "$0")/../crates/gns-crypto-wasm"

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "Installing wasm-pack..."
    cargo install wasm-pack
fi

# Build for web target
echo "Building for web..."
wasm-pack build --target web --release --out-dir pkg

# Build for Node.js (optional, for backend use)
echo "Building for Node.js..."
wasm-pack build --target nodejs --release --out-dir pkg-node

# Copy to Panthera if it exists
PANTHERA_DIR="../../panthera-web/src/lib/wasm"
if [ -d "$PANTHERA_DIR" ]; then
    echo "Copying to Panthera..."
    cp -r pkg/* "$PANTHERA_DIR/"
fi

echo "✅ WASM build complete!"
echo ""
echo "Output directories:"
echo "  - pkg/           (web target)"
echo "  - pkg-node/      (Node.js target)"
