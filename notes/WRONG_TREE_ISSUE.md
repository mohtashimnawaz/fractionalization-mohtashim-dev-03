# Wrong Tree Issue - Solution

## The Problem

Your `.env` has a tree with **canopy depth 14**:
```bash
NEXT_PUBLIC_MERKLE_TREE_ADDRESS=5HzyhuPZXyUi4fUk4P6zk57w4XDsCn67UGRbHxZwgFro
# Canopy Depth 14 - Only 0 proof nodes needed!
```

But the cNFT you're trying to fractionalize was **minted on a different tree** with **canopy depth 0** (needs 20 proof nodes).

## Why This Happens

When you mint a cNFT, it's permanently associated with the tree it was minted on. You can't change it later.

The cNFTs in your wallet were probably minted on a test tree with low canopy depth.

## The Solution

### Option 1: Mint New cNFT on Correct Tree (Recommended)

1. **Update the minting code** to use the correct tree:

Check `src/hooks/use-mint-cnft.ts` - it should use:
```typescript
const treeAddress = process.env.NEXT_PUBLIC_MERKLE_TREE_ADDRESS;
// Should be: 5HzyhuPZXyUi4fUk4P6zk57w4XDsCn67UGRbHxZwgFro
```

2. **Mint a fresh cNFT**:
   - Go to fractionalize page
   - Click "Mint cNFT"
   - Fill in details
   - This will mint on the correct tree (canopy 14)

3. **Try fractionalizing the new cNFT**:
   - It should need 0 proof nodes
   - Transaction will be much smaller
   - Should work perfectly!

### Option 2: Use Different Tree in .env

If you want to use your existing cNFTs, update `.env` to point to their tree:

```bash
# Find the tree your cNFTs are on (check console logs)
NEXT_PUBLIC_MERKLE_TREE_ADDRESS=the_tree_your_cnfts_are_on
```

But this only works if that tree has canopy depth >= 6.

## How to Check Tree Canopy Depth

Visit Solana Explorer:
```
https://explorer.solana.com/address/5HzyhuPZXyUi4fUk4P6zk57w4XDsCn67UGRbHxZwgFro?cluster=devnet
```

Look for the tree account data - canopy depth should be visible.

## Updated Error Message

The app now shows:
```
❌ This cNFT requires 20 proof nodes (canopy depth ~0).
   We can only fit 8 proof nodes in a transaction.

   This cNFT was minted on: [actual tree]
   Expected tree: 5HzyhuPZXyUi4fUk4P6zk57w4XDsCn67UGRbHxZwgFro

   Please mint a new cNFT on the correct tree (with canopy depth 14)
   or select a different cNFT.
```

## Proof Node Requirements by Canopy Depth

```
maxDepth = 14

Canopy 0  → 14 proof nodes ❌ (too many for transaction)
Canopy 6  → 8 proof nodes  ⚠️ (barely fits)
Canopy 8  → 6 proof nodes  ✅ (fits comfortably)
Canopy 10 → 4 proof nodes  ✅ (fits easily)
Canopy 14 → 0 proof nodes  ✅ (perfect!)
```

## Quick Fix

**Mint a new cNFT** using the "Mint cNFT" button:
1. It will automatically use the correct tree from `.env`
2. That tree has canopy depth 14
3. Fractionalization will work perfectly
4. Transaction will be small (no proof nodes needed!)

## Verify Minting Uses Correct Tree

Check `src/hooks/use-mint-cnft.ts`:

```typescript
const treeAddress = process.env.NEXT_PUBLIC_MERKLE_TREE_ADDRESS;

if (!treeAddress) {
  throw new Error('NEXT_PUBLIC_MERKLE_TREE_ADDRESS not configured');
}

console.log('Using existing Merkle tree:', treeAddress);
// Should log: 5HzyhuPZXyUi4fUk4P6zk57w4XDsCn67UGRbHxZwgFro
```

## Summary

**Problem**: Your cNFTs are on a different tree with low canopy depth

**Solution**: Mint a new cNFT using the "Mint cNFT" button - it will use the correct tree

**Result**: Fractionalization will work with 0 proof nodes (canopy depth 14)

---

**Just mint a fresh cNFT and it will work!** 🎉
