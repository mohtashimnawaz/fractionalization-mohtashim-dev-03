# Canopy Depth Issue - Too Many Proof Nodes

## The Problem

```
❌ Error: encoding overruns Uint8Array
🌳 Using 20 proof nodes (all available)
```

The cNFT's merkle tree has **very low canopy depth**, requiring 20 proof nodes. But we can only fit ~6-8 proof nodes in a Solana transaction (1232 byte limit).

## Why This Happens

### Merkle Tree Math

```
proofNodes = maxDepth - canopyDepth

If maxDepth = 14:
- canopyDepth 0  → needs 14 proof nodes ❌
- canopyDepth 6  → needs 8 proof nodes ⚠️
- canopyDepth 8  → needs 6 proof nodes ✅
- canopyDepth 10 → needs 4 proof nodes ✅
- canopyDepth 14 → needs 0 proof nodes ✅
```

### Transaction Size Limit

```
Solana transaction limit: 1232 bytes

With 20 proof nodes:
- Proof nodes: 20 × 32 = 640 bytes
- Base instruction: ~900 bytes
- Total: ~1540 bytes ❌ (over limit!)

With 6 proof nodes:
- Proof nodes: 6 × 32 = 192 bytes
- Base instruction: ~900 bytes
- Total: ~1092 bytes ✅ (under limit!)
```

## The Solution

### Option 1: Use a Different cNFT (Quick Fix)

The cNFT you're trying to fractionalize is on a tree with low canopy depth. 

**Try**:
1. Select a different cNFT from your wallet
2. Look for one on a tree with higher canopy depth
3. The app will now show an error if canopy is too low

### Option 2: Mint on Correct Tree (Recommended)

Mint cNFTs on a tree with **canopy depth >= 8**:

```typescript
// When creating the tree
const merkleTree = await createTree(umi, {
  merkleTree: generateSigner(umi),
  maxDepth: 14,
  maxBufferSize: 64,
  canopyDepth: 8,  // ← Important! Must be >= 8
});
```

### Option 3: Use Address Lookup Tables (Advanced)

Address lookup tables can reduce transaction size by ~200-300 bytes, allowing more proof nodes:

1. Create lookup table with common accounts
2. Reference accounts by index (1 byte) instead of pubkey (32 bytes)
3. Can fit ~10-12 proof nodes instead of 6-8

## Current Implementation

The app now:

1. **Checks proof node count** before building transaction
2. **Shows clear error** if > 10 proof nodes needed
3. **Limits to 6 nodes** for transaction size
4. **Calculates canopy depth** and shows it in error

## Error Message

If you see this error:
```
❌ This cNFT requires 20 proof nodes, but we can only fit 6-8 in a transaction.
   The merkle tree has insufficient canopy depth (0).
   Please use a cNFT from a tree with canopy depth >= 8.
```

**What it means**:
- The cNFT is on a tree with canopy depth 0
- It needs 20 proof nodes (14 - 0 = 14, but Helius provides 20?)
- We can only fit 6-8 in the transaction
- You need to use a different cNFT

## Recommended Tree Configuration

For fractionalization, use trees with:

```typescript
{
  maxDepth: 14,        // Supports 16,384 cNFTs
  maxBufferSize: 64,   // Standard buffer
  canopyDepth: 8,      // ← Needs only 6 proof nodes
}
```

Or even better:

```typescript
{
  maxDepth: 14,
  maxBufferSize: 64,
  canopyDepth: 10,     // ← Needs only 4 proof nodes
}
```

## Check Your Tree

Visit Solana Explorer:
```
https://explorer.solana.com/address/TREE_ADDRESS?cluster=devnet
```

Look for:
- **Max Depth**: Should be 14
- **Canopy Depth**: Should be >= 8
- **Buffer Size**: Should be 64

## Environment Variable

Update `.env` to use a tree with proper canopy:

```bash
# Use a tree with canopy depth >= 8
NEXT_PUBLIC_MERKLE_TREE_ADDRESS=your_tree_with_high_canopy
```

## Testing

The app will now show:
```
🌳 Merkle tree info: {
  treeId: '...',
  proofLength: 6,      // ← Should be <= 10
  leafId: 123
}
```

If `proofLength > 10`, you'll get a clear error message.

## Summary

**Problem**: cNFT on tree with low canopy depth (needs 20 proof nodes)

**Solution**: Use cNFT from tree with canopy depth >= 8 (needs 6 proof nodes)

**Quick Fix**: Try a different cNFT from your wallet

---

**The app now detects this issue and shows a helpful error message!**
