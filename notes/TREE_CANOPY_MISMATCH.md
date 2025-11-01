# Tree Canopy Depth Mismatch

## The Real Issue

The tree at `5HzyhuPZXyUi4fUk4P6zk57w4XDsCn67UGRbHxZwgFro` claims to have **canopy depth 14** (in the `.env` comment), but Helius is providing **20 proof nodes**, which means the actual canopy depth is probably **0 or very low**.

```
Proof nodes needed = maxDepth - canopyDepth

If we get 20 proof nodes:
- maxDepth is probably 20 (not 14)
- OR canopyDepth is 0 and maxDepth is 20
- OR there's a mismatch in the tree configuration
```

## What This Means

The tree configuration is incorrect. Either:
1. The tree was created with wrong parameters
2. The comment in `.env` is wrong
3. The tree address is wrong

## Current Behavior

The app now:
1. ✅ Detects when > 10 proof nodes are needed
2. ⚠️ Shows warning but continues anyway
3. 🔧 Tries with 8 proof nodes (will likely fail on-chain)
4. ❌ Will get "Invalid root recomputed from proof" error

## The Solution

### Option 1: Create New Tree with Correct Canopy

Create a new merkle tree with proper configuration:

```typescript
const merkleTree = await createTree(umi, {
  merkleTree: generateSigner(umi),
  maxDepth: 14,          // ← 16,384 cNFTs capacity
  maxBufferSize: 64,     // ← Standard
  canopyDepth: 14,       // ← IMPORTANT! Must be 14
});
```

Then update `.env`:
```bash
NEXT_PUBLIC_MERKLE_TREE_ADDRESS=new_tree_address_here
```

### Option 2: Verify Current Tree

Check the tree on Solana Explorer:
```
https://explorer.solana.com/address/5HzyhuPZXyUi4fUk4P6zk57w4XDsCn67UGRbHxZwgFro?cluster=devnet
```

Look for:
- **Max Depth**: Should be 14
- **Canopy Depth**: Should be 14 (but probably isn't!)
- **Buffer Size**: Should be 64

### Option 3: Use Address Lookup Table

If you can't create a new tree, use an Address Lookup Table to reduce transaction size:

1. Create lookup table with common accounts
2. Reference by index instead of full pubkey
3. Saves ~20-30 bytes per account
4. Can fit more proof nodes

## Recommended Action

**Create a new tree** with the correct configuration:

```bash
# Run the tree creation script
node create-tree.cjs

# It should output:
# ✅ Tree created with canopy depth 14
# Address: [new address]

# Update .env with the new address
```

## Why Canopy Depth 14 is Important

With canopy depth 14 and maxDepth 14:
```
Proof nodes needed = 14 - 14 = 0
```

**Zero proof nodes** means:
- Smallest possible transaction
- No proof validation issues
- Always works
- Fast and reliable

## Current Workaround

The app will now **try anyway** with 8 proof nodes:
- ⚠️ Shows warning in console
- 🔧 Limits to 8 proof nodes
- 📤 Sends transaction
- ❌ Will likely fail with "Invalid root recomputed from proof"

But at least you'll see the attempt and can verify the tree configuration is the issue.

## Summary

**Problem**: Tree claims canopy 14 but actually has canopy 0

**Evidence**: Helius provides 20 proof nodes (should be 0 if canopy was 14)

**Solution**: Create new tree with actual canopy depth 14

**Workaround**: App will try with 8 nodes (will fail but shows the issue)

---

**You need to create a new merkle tree with correct canopy depth!**
