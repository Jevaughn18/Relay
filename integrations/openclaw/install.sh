#!/bin/bash
#
# Seamless Relay + OpenClaw Integration Installer
#
# Usage: ./install.sh
#

set -e

echo ""
echo "═══════════════════════════════════════════"
echo "  Relay + OpenClaw Integration Installer"
echo "═══════════════════════════════════════════"
echo ""

# Check if OpenClaw is installed
if [ ! -d "$HOME/.openclaw" ]; then
  echo "❌ OpenClaw not found at ~/.openclaw"
  echo ""
  echo "Install OpenClaw first:"
  echo "  npm install -g openclaw"
  echo "  openclaw init"
  echo ""
  exit 1
fi

echo "✓ OpenClaw found"
echo ""

# Check if Relay is installed
if ! command -v relay &> /dev/null; then
  echo "⚠ Relay not found - installing..."
  echo ""
  npm install -g relay-protocol
  echo ""
fi

echo "✓ Relay installed"
echo ""

# Create directories
echo "Creating directories..."
mkdir -p ~/.openclaw/tools/relay
mkdir -p ~/.openclaw/skills/relay

# Install Relay tool
echo "Installing Relay tool..."
cp relay-tool.js ~/.openclaw/tools/relay/index.js

# Install Relay skill
echo "Installing Relay skill..."
cp RELAY_SKILL.md ~/.openclaw/skills/relay/SKILL.md

echo ""
echo "✓ Relay integration installed"
echo ""

# Check if Relay is initialized
if [ ! -f "$HOME/.relay/config.json" ]; then
  echo "Initializing Relay..."
  echo ""
  relay start --detach
  sleep 3
  echo ""
  echo "✓ Relay started in background"
else
  echo "✓ Relay already initialized"
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  Installation Complete!"
echo "═══════════════════════════════════════════"
echo ""
echo "Your OpenClaw agent now has access to:"
echo "  • relay_search - Search for agents"
echo "  • relay_delegate - Hire agents"
echo "  • relay_balance - Check credits"
echo ""
echo "Next steps:"
echo "  1. Restart OpenClaw: openclaw restart"
echo "  2. Try asking: 'Search for flight booking agents'"
echo ""
echo "Relay Dashboard: http://127.0.0.1:8787"
echo "Relay Token: $(relay token 2>/dev/null || echo 'Run: relay token')"
echo ""
