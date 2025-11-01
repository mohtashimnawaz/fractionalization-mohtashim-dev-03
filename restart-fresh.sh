#!/bin/bash

echo "🧹 Cleaning Next.js cache..."
rm -rf .next
rm -rf node_modules/.cache

echo "✅ Cache cleared!"
echo ""
echo "📋 Current tree address in .env:"
grep "NEXT_PUBLIC_MERKLE_TREE_ADDRESS" .env | grep -v "^#"
echo ""
echo "🚀 Starting dev server..."
echo ""

npm run dev
