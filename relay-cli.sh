#!/bin/bash
# Simple wrapper for Relay CLI to avoid npm link caching issues
node "$(dirname "$0")/dist/src/cli/index.js" "$@"
