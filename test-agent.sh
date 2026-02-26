#!/bin/bash
set -e

echo "🚀 Relay Protocol - Agent Setup Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Use direct CLI path
CLI="./relay-cli.sh"

echo "Step 1: Initialize Agent"
$CLI init --name "TestAgent"
echo ""

echo "Step 2: Check Initial Status"
$CLI status
echo ""

echo "Step 3: Deposit 1000 Credits"
$CLI deposit 1000
echo ""

echo "Step 4: Verify Balance Persists"
$CLI status
echo ""

echo "Step 5: Check state.json"
echo "Contents of ~/.relay/state.json:"
cat ~/.relay/state.json
echo ""

echo "Step 6: Register Capability"
$CLI register-capability examples/capability-summarizer.json
echo ""

echo "Step 7: Final Status"
$CLI status
echo ""

echo "✅ SUCCESS! Agent is fully configured!"
echo ""
echo "Your agent:"
echo "  - Has 1000 credits"
echo "  - Can perform: summarize_text"
echo "  - Ready to accept tasks"
