# Proof Validation Error - Troubleshooting

## Error

```
❌ Error: Invalid root recomputed from proof
Program log: Error using concurrent merkle tree: Invalid root recomputed from proof
```

## What This Means

The on-chain program is rejecting the merkle proof. This happens when:

1. **Proof is stale** - The tree state changed after we fetched the proof
2. **Wrong tree** - The cNFT is on a different tree than expected
3. **cNFT already moved** - The cNFT was transferred or burned
4. **Proof format mismatch** - We're passing the proof incorrectly

## Diagnostic Steps

### 1. Check the Console Logs

Look for these logs:
```
🌳 Merkle tree info: {
  treeId: '...',
  proofLength: 6,
  leafId: 123,
  root: 'abc123...'
}
```

**Questions**:
- Does `treeId` match `NEXT_PUBLIC_MERKLE_TREE_ADDRESS`?
- Is `proofLength` reasonable (6-14)?
- Is `leafId` a valid number?

### 2. Check if cNFT Was Already Fractionalized

The cNFT might already be owned by a vault:

```typescript
// Check ownership
const owner = assetData.ownership.owner;
const [expectedVault] = PublicKey.findProgramAddressSync(
  [Buffer.from('vault'), nftAssetId.toBuffer()],
  programId
);

if (owner === expectedVault) {
  // Already fractionalized!
}
```

### 3. Verify Tree Configuration

Check the merkle tree on Solana Explorer:
```
https://explorer.solana.com/address/TREE_ADDRESS?cluster=devnet
```

Look for:
- **Max Depth**: Should be 14
- **Canopy Depth**: Should be 6-14
- **Active**: Tree should not be closed

### 4. Check Proof Freshness

The proof might be stale if:
- You fetched it a while ago
- Someone else modified the tree
- The tree was updated

**Solution**: Refetch the proof right before fractionalizing.

## Common Causes

### Cause 1: cNFT Already Fractionalized

**Symptom**: Error every time you try to fractionalize the same cNFT

**Check**: Look at the cNFT owner in console logs

**Solution**: Select a different cNFT that hasn't been fractionalized

### Cause 2: Wrong Merkle Tree

**Symptom**: Warning in console: "cNFT is on a different tree!"

**Check**: Compare `treeId` with `NEXT_PUBLIC_MERKLE_TREE_ADDRESS`

**Solution**: This is actually OK - we use the cNFT's actual tree

### Cause 3: Insufficient Canopy Depth

**Symptom**: Error with specific proof length

**Check**: 
```
Required canopy = maxDepth - proofLength
If maxDepth = 14 and proofLength = 8:
  Required canopy = 14 - 8 = 6
```

**Solution**: The tree needs higher canopy depth, or we need more proof nodes

### Cause 4: Proof Format Issue

**Symptom**: Error even with fresh proof

**Check**: Are we passing proof nodes correctly?

```typescript
// Correct format
const proofAccounts: AccountMeta[] = proof.map((node: string) => ({
  pubkey: new PublicKey(node),
  isWritable: false,
  isSigner: false,
}));
```

## Current Implementation

We're using:
- **All proof nodes** from Helius (not limiting)
- **Fresh proof** fetched right before transaction
- **Correct tree** from the cNFT's actual tree ID

## Possible Solutions

### Solution 1: Use Different cNFT

Try fractionalizing a different cNFT:
1. Go back to select NFT step
2. Choose a different cNFT
3. Try again

### Solution 2: Mint Fresh cNFT

Mint a new cNFT specifically for testing:
1. Click "Mint cNFT" button
2. Wait for it to be indexed
3. Try fractionalizing the new one

### Solution 3: Check Tree Canopy

The tree might have insufficient canopy depth:

```bash
# Check tree account
solana account TREE_ADDRESS --url devnet

# Look for canopy depth in the account data
```

### Solution 4: Use Address Lookup Table

If transaction is too large with all proof nodes:
1. Create an address lookup table
2. Add frequently used accounts
3. Reference by index instead of full pubkey
4. Saves ~20-30 bytes per account

## Next Steps

1. **Check console logs** for tree info
2. **Try different cNFT** to see if it's cNFT-specific
3. **Verify tree configuration** on explorer
4. **Check if cNFT was already fractionalized**

## Debug Mode

Add this to see full proof data:

```typescript
console.log('🔍 Full proof data:', {
  proof: assetProofData.proof,
  root: assetProofData.root,
  dataHash: assetData.compression.data_hash,
  creatorHash: assetData.compression.creator_hash,
  leafId: assetData.compression.leaf_id,
});
```

---

**The proof validation error suggests an issue with the cNFT or tree, not the code.**
