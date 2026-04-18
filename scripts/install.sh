#!/bin/bash
# OPC Agent — One-line installer
# Usage: curl -fsSL https://raw.githubusercontent.com/Deepleaper/opc-agent/main/scripts/install.sh | bash

set -e

echo "🤖 Installing OPC Agent..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Install from https://nodejs.org (v18+)"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required (found v$(node -v))"
    exit 1
fi

# Install globally
echo "📦 Installing opc-agent globally..."
npm install -g opc-agent

# Verify
if command -v opc &> /dev/null; then
    echo ""
    echo "✅ OPC Agent installed successfully!"
    echo ""
    echo "Quick start:"
    echo "  opc init my-agent"
    echo "  cd my-agent"
    echo "  npm install"
    echo "  opc chat"
    echo ""
    echo "Run 'opc doctor' to check your environment."
else
    echo "⚠️  Installed but 'opc' command not found in PATH."
    echo "Try: npx opc-agent --help"
fi
