#!/bin/bash
set -e

echo "🚀 Setting up GNS Browser development environment..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_command() {
    if command -v "$1" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 found"
        return 0
    else
        echo -e "${RED}✗${NC} $1 not found"
        return 1
    fi
}

# Check prerequisites
echo "Checking prerequisites..."
echo ""

MISSING=0

check_command "rustc" || MISSING=1
check_command "cargo" || MISSING=1
check_command "node" || MISSING=1
check_command "npm" || MISSING=1

echo ""

if [ $MISSING -eq 1 ]; then
    echo -e "${RED}Some prerequisites are missing. Please install them first.${NC}"
    echo ""
    echo "Install Rust: https://rustup.rs/"
    echo "Install Node.js: https://nodejs.org/"
    exit 1
fi

# Check Rust version
RUST_VERSION=$(rustc --version | cut -d' ' -f2)
echo "Rust version: $RUST_VERSION"

# Check Node version
NODE_VERSION=$(node --version)
echo "Node version: $NODE_VERSION"

echo ""

# Install Tauri CLI if not present
if ! cargo install --list | grep -q "tauri-cli"; then
    echo "Installing Tauri CLI..."
    cargo install tauri-cli --version "^2.0.0"
else
    echo -e "${GREEN}✓${NC} Tauri CLI already installed"
fi

echo ""

# Install UI dependencies
echo "Installing UI dependencies..."
cd ui
if command -v pnpm &> /dev/null; then
    pnpm install
elif command -v yarn &> /dev/null; then
    yarn install
else
    npm install
fi
cd ..

echo ""

# Build crypto core to verify it compiles
echo "Verifying Rust crypto core..."
cargo build -p gns-crypto-core
echo -e "${GREEN}✓${NC} Crypto core compiles successfully"

echo ""

# Check platform-specific requirements
echo "Checking platform-specific requirements..."

case "$(uname -s)" in
    Darwin*)
        echo "Platform: macOS"
        if ! xcode-select -p &> /dev/null; then
            echo -e "${YELLOW}!${NC} Xcode Command Line Tools not found"
            echo "  Run: xcode-select --install"
        else
            echo -e "${GREEN}✓${NC} Xcode Command Line Tools installed"
        fi
        ;;
    Linux*)
        echo "Platform: Linux"
        # Check for required libraries
        if ! pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
            echo -e "${YELLOW}!${NC} webkit2gtk-4.1 not found"
            echo "  Run: sudo apt install libwebkit2gtk-4.1-dev"
        else
            echo -e "${GREEN}✓${NC} webkit2gtk-4.1 found"
        fi
        ;;
    MINGW*|MSYS*|CYGWIN*)
        echo "Platform: Windows"
        echo -e "${GREEN}✓${NC} WebView2 should be pre-installed on Windows 10/11"
        ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Next steps:"
echo ""
echo "  1. Start development server:"
echo "     cargo tauri dev"
echo ""
echo "  2. Build for production:"
echo "     cargo tauri build"
echo ""
echo "  3. Build for iOS (macOS only):"
echo "     cargo tauri ios init"
echo "     cargo tauri ios dev"
echo ""
echo "  4. Build for Android:"
echo "     cargo tauri android init"
echo "     cargo tauri android dev"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
