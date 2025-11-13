# Initialize Reclaim - Merkle Tree Canopy Depth Requirement

## Problem

The `initialize_reclaim` instruction fails with "encoding overruns Uint8Array" error during transaction building/signing.

## Root Cause

The cNFT being reclaimed is on a Merkle tree with **canopy depth 0**, which requires **20 proof nodes** to be included in the transaction. This results in:

- 13 main instruction accounts
- 20 proof node accounts  
- 3 compute budget instruction accounts (2 accounts total, but 2 instructions)
- **Total: 36+ accounts in the transaction**

This exceeds the practical limit for transaction serialization in Solana web3.js, causing the "encoding overruns Uint8Array" error.

## Solutions

### Option 1: Use Higher Canopy Depth Tree (RECOMMENDED)

Mint cNFTs on a Merkle tree with **canopy depth 10-14**:

- **Canopy 10**: Requires ~4 proof nodes
- **Canopy 12**: Requires ~2 proof nodes  
- **Canopy 14**: Requires ~0 proof nodes ✅ **BEST**

With canopy depth 14, the transaction would only need:
- 13 main accounts
- 0 proof accounts
- 2 compute budget accounts (from 2 instructions)
- **Total: ~15 accounts** ✅ Works!

### Option 2: Use Address Lookup Tables (ALTs)

Store the 20 proof node addresses in an Address Lookup Table, which dramatically reduces transaction size by referencing accounts indirectly.

**Steps:**
1. Create an ALT
2. Add all proof node addresses to the ALT
3. Reference the ALT in the transaction's `addressLookupTableAccounts`

**Pros:**
- Works with any canopy depth
- Reduces transaction size significantly

**Cons:**
- Requires additional setup (creating/managing ALTs)
- Adds complexity to transaction building
- ALT creation costs lamports

### Option 3: Split Into Multiple Transactions

Split the initialize_reclaim flow into multiple smaller transactions. However, this is not feasible for this instruction as it's atomic.

## Current Status

The application is configured for a tree with canopy depth 14 (in `.env`), but the test cNFT being used was minted on a different tree with canopy depth 0.

## Next Steps

1. **Immediate**: Mint a new cNFT on the correct tree (canopy 14)
2. **Or**: Implement Address Lookup Table support
3. **Or**: Update error message to guide users to use appropriate cNFTs

## Technical Details

### Transaction Size Limits

- **Legacy Transaction**: Max 1232 bytes
- **Versioned Transaction**: Larger, but still limited by serialization

### Canopy Depth vs Proof Nodes

Formula: `proof_nodes_needed = max_depth - canopy_depth`

For a tree with max_depth 20:
- Canopy 0: 20 proof nodes
- Canopy 6: 14 proof nodes
- Canopy 10: 10 proof nodes  
- Canopy 14: 6 proof nodes
- Canopy 20: 0 proof nodes (not practical - too large canopy)

### Error Message

```
WalletSignTransactionError: encoding overruns Uint8Array
```

This occurs in `TransactionMessage.compileToV0Message()` when the message has too many accounts to serialize properly.

## References

- `notes/WRONG_TREE_ISSUE.md` - Original tree mismatch documentation
- `notes/TRANSACTION_SIZE_FIX.md` - Previous transaction size optimization attempts
- `notes/CANOPY_DEPTH_ISSUE.md` - Canopy depth explanations
