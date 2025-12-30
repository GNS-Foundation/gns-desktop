#!/bin/bash
# GNS Browser - GitHub Secrets Setup Helper
# Run this script to check and guide secrets configuration

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   🔐 GNS Browser - GitHub Secrets Setup Guide"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if gh CLI is available
if command -v gh &> /dev/null; then
    GH_CLI=true
    echo "✅ GitHub CLI detected"
    
    # Check if authenticated
    if gh auth status &> /dev/null; then
        echo "✅ Authenticated with GitHub"
        REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
        if [ -n "$REPO" ]; then
            echo "📦 Repository: $REPO"
        fi
    else
        echo "⚠️  Not authenticated. Run: gh auth login"
        GH_CLI=false
    fi
else
    GH_CLI=false
    echo "ℹ️  GitHub CLI not found. Install from: https://cli.github.com/"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   📋 Required Secrets Checklist"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to check/set secret
check_secret() {
    local name=$1
    local description=$2
    local required=$3
    
    echo -n "  $name"
    if [ "$required" = "required" ]; then
        echo -n " (REQUIRED)"
    else
        echo -n " (optional)"
    fi
    echo ""
    echo "    └─ $description"
    echo ""
}

echo "🌐 CLOUDFLARE (for WASM deployment)"
echo "─────────────────────────────────────────────────────────────────────────"
check_secret "CLOUDFLARE_API_TOKEN" "API token with Pages:Edit permission" "required"
check_secret "CLOUDFLARE_ACCOUNT_ID" "Your Cloudflare account ID" "required"

echo ""
echo "🍎 APPLE (for macOS/iOS signing)"
echo "─────────────────────────────────────────────────────────────────────────"
check_secret "APPLE_CERTIFICATE" "Base64-encoded .p12 certificate" "optional"
check_secret "APPLE_CERTIFICATE_PASSWORD" "Password for the .p12 file" "optional"
check_secret "APPLE_SIGNING_IDENTITY" "Signing identity string" "optional"
check_secret "APPLE_ID" "Your Apple ID email" "optional"
check_secret "APPLE_PASSWORD" "App-specific password" "optional"
check_secret "APPLE_TEAM_ID" "10-character Team ID" "optional"

echo ""
echo "🪟 WINDOWS (for code signing)"
echo "─────────────────────────────────────────────────────────────────────────"
check_secret "TAURI_PRIVATE_KEY" "Windows signing private key" "optional"
check_secret "TAURI_KEY_PASSWORD" "Password for the key" "optional"

echo ""
echo "🤖 ANDROID (for APK signing)"
echo "─────────────────────────────────────────────────────────────────────────"
check_secret "ANDROID_KEYSTORE" "Base64-encoded keystore" "optional"
check_secret "ANDROID_KEYSTORE_PASSWORD" "Keystore password" "optional"
check_secret "ANDROID_KEY_ALIAS" "Key alias" "optional"
check_secret "ANDROID_KEY_PASSWORD" "Key password" "optional"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   🚀 Quick Setup Commands"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$GH_CLI" = true ] && [ -n "$REPO" ]; then
    echo "Using GitHub CLI to set secrets:"
    echo ""
    echo "  # Cloudflare (required for WASM deploy)"
    echo "  gh secret set CLOUDFLARE_API_TOKEN"
    echo "  gh secret set CLOUDFLARE_ACCOUNT_ID"
    echo ""
    echo "  # Or set from file:"
    echo "  gh secret set CLOUDFLARE_API_TOKEN < ~/secrets/cloudflare_token.txt"
    echo ""
else
    echo "Set secrets in GitHub web UI:"
    echo ""
    echo "  1. Go to your repository on GitHub"
    echo "  2. Settings → Secrets and variables → Actions"
    echo "  3. Click 'New repository secret'"
    echo "  4. Add each secret from the list above"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   📖 Documentation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "See CONTRIBUTING.md for detailed instructions on:"
echo "  • Generating Apple certificates"
echo "  • Creating Android keystore"
echo "  • Getting Cloudflare tokens"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
