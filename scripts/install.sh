#!/bin/bash
set -e

# Relay Protocol Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/Jevaughn18/Relay/main/scripts/install.sh | bash

echo ""
echo "🚀 Installing Relay Protocol..."
echo ""

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     PLATFORM=linux;;
    Darwin*)    PLATFORM=mac;;
    CYGWIN*)    PLATFORM=windows;;
    MINGW*)     PLATFORM=windows;;
    *)          PLATFORM="unknown"
esac

echo "✓ Detected platform: $PLATFORM"

# Check if Node.js is installed, install if missing
if ! command -v node &> /dev/null; then
    echo "⚙️  Node.js not found. Installing..."

    if [ "$PLATFORM" = "mac" ]; then
        if command -v brew &> /dev/null; then
            brew install node
        else
            echo "❌ Please install Homebrew first: https://brew.sh"
            exit 1
        fi
    elif [ "$PLATFORM" = "linux" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        echo "❌ Please install Node.js manually: https://nodejs.org"
        exit 1
    fi
fi

echo "✓ Node.js detected: $(node --version)"

# Install Relay globally
echo ""
echo "Installing relay-protocol..."

# For development: clone and install from repo
# For production: use npm install -g relay-protocol
npm install -g relay-protocol

echo ""
echo "✅ Relay Protocol installed!"
echo ""
echo "🎯 Just run it - setup is automatic:"
echo ""
echo "  relay               → Initialize & show status"
echo "  relay stack:start   → Start full stack + dashboard"
echo ""
