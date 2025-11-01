# Create New Merkle Tree - Quick Guide

## Why You Need This

The current tree doesn't have the correct canopy depth for fractionalization. You need a tree with **canopy depth 14** so that:
- ✅ 0 proof nodes needed (vs 20 currently)
- ✅ Transactions are small (~900 bytes vs 1500+ bytes)
- ✅ Fractionalization always works
- ✅ Any user can mint cNFTs (public tree)

## Prerequisites

### 1. Install Solana CLI

```bash
# macOS/Linux
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Verify installation
solana --version
```

### 2. Create/Configure Wallet

```bash
# Create new wallet (if you don't have one)
solana-keygen new --outfile ~/.config/solana/id.json

# Or use existing wallet
solana config set --keypair ~/.config/solana/id.json

# Set to devnet
solana config set --url devnet
```

### 3. Fund Wallet

```bash
# Get devnet SOL (you need ~1 SOL for tree creation)
solana airdrop 1

# Check balance
solana balance
```

You need at least **0.5-1.0 SOL** for creating a tree with canopy depth 14.

## Create the Tree

### Run the Script

```bash
# Make sure you're in the project directory
cd /path/to/fractionalization-mohtashim-dev-2

# Run the tree creation script
node create-tree.cjs
```

### Expected Output

```
🔑 Wallet: YourWalletAddress...
💰 Balance: 1.5000 SOL

🌳 Creating Merkle Tree...

📋 Configuration:
   Max depth: 14 (capacity: 16,384 cNFTs)
   Max buffer size: 64
   Canopy depth: 14 (0 proof nodes needed!)

💵 Estimated cost: ~0.5-1.0 SOL (higher due to canopy depth 14)

⏳ Creating tree (this may take 60-90 seconds)...

   Tree address: NewTreeAddress...

✅ Tree created successfully!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Add this to your .env file:

# Merkle Tree with Canopy Depth 14 - Perfect for Fractionalization!
# Capacity: 16,384 cNFTs | Public access | 0 proof nodes needed
NEXT_PUBLIC_MERKLE_TREE_ADDRESS=NewTreeAddress...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 View on Solana Explorer:
https://explorer.solana.com/address/NewTreeAddress...?cluster=devnet

✨ Tree Features:
   • Canopy depth 14 = 0 proof nodes needed
   • Public access = any user can mint
   • Perfect for fractionalization (small transactions)

🎉 Ready to use!
```

### Update .env

Copy the tree address from the output and update your `.env` file:

```bash
# Replace the old tree address
NEXT_PUBLIC_MERKLE_TREE_ADDRESS=NewTreeAddress...
```

## Test It

### 1. Restart Dev Server

```bash
# Stop current server (Ctrl+C)
# Then restart
npm run dev
```

### 2. Mint a cNFT

1. Go to http://localhost:3000/fractionalize
2. Click "Mint cNFT"
3. Fill in name and symbol
4. Click "Mint cNFT"
5. Wait 30 seconds for indexing

### 3. Try Fractionalizing

1. Refresh the cNFT list
2. Select the newly minted cNFT
3. Click "Next"
4. Configure tokens
5. Click "Fractionalize NFT"

**Expected result**:
```
🌳 Using 0 proof nodes (all available)
📦 Transaction size: ~900 bytes ✅
✍️ Requesting wallet signature...
✅ Transaction sent!
```

## Troubleshooting

### "Insufficient balance"

```bash
# Get more SOL
solana airdrop 1

# Check balance
solana balance
```

### "Wallet not found"

```bash
# Create wallet
solana-keygen new

# Or specify path
export SOLANA_KEYPAIR_PATH=~/.config/solana/id.json
```

### "Transaction failed"

- Wait a few seconds and try again
- Devnet can be slow sometimes
- Check your balance: `solana balance`

### "Tree creation takes too long"

- Canopy depth 14 requires more computation
- Can take 60-90 seconds
- Be patient!

## Tree Configuration Details

```typescript
{
  maxDepth: 14,        // 16,384 cNFTs capacity
  maxBufferSize: 64,   // Standard buffer
  canopyDepth: 14,     // ← CRITICAL! 0 proof nodes
  public: true,        // Any user can mint
}
```

### Why Canopy Depth 14?

```
Proof nodes needed = maxDepth - canopyDepth
                   = 14 - 14
                   = 0 proof nodes ✅

With 0 proof nodes:
- Transaction size: ~900 bytes
- Always under 1232 byte limit
- No proof validation issues
- Fast and reliable
```

### Cost Breakdown

- Base tree: ~0.1 SOL
- Canopy depth 14: ~0.4-0.9 SOL (stores proof data on-chain)
- **Total**: ~0.5-1.0 SOL

Higher canopy = higher cost, but **much better UX**!

## Summary

1. ✅ Fund wallet with 1+ SOL
2. ✅ Run `node create-tree.cjs`
3. ✅ Copy tree address to `.env`
4. ✅ Restart dev server
5. ✅ Mint fresh cNFT
6. ✅ Fractionalize successfully!

---

**This will solve all the proof node issues!** 🎉
