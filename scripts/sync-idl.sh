#!/bin/bash

# Script to sync IDL from Anchor build to src/lib/idl for deployment
# Run this after building your Anchor program

echo "🔄 Syncing IDL files..."

# Copy IDL JSON
cp anchor/target/idl/fractionalization.json src/lib/idl/fractionalization.json

if [ $? -eq 0 ]; then
    echo "✅ IDL synced successfully to src/lib/idl/fractionalization.json"
else
    echo "❌ Failed to sync IDL"
    exit 1
fi
