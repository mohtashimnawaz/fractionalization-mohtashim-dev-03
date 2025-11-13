# Shared ALT Implementation

## Problem
Previously, every user had to create their own Address Lookup Table (ALT) when initializing reclaim. This meant:
- Each user paid for ALT creation (~0.002 SOL)
- Each user had to sign 2-3 transactions (create ALT, extend ALT, then actual reclaim)
- Poor UX - users didn't understand why they needed to pay extra
- ALTs were wallet-specific, so switching wallets required creating new ALTs

## Solution
Implemented a **shared ALT** that is created once by the platform admin and used by ALL users.

### Benefits
✅ **No ALT creation fees for users** - they only pay for the reclaim transaction itself
✅ **One signature instead of 3** - users only sign the initialize_reclaim transaction
✅ **Better UX** - no confusing "setting up lookup table" steps
✅ **Works across wallets** - same ALT for everyone
✅ **Admin-controlled** - platform can extend the ALT as needed

## Setup Instructions

### 1. Create Shared ALT (One-time setup)

```bash
node scripts/create-shared-alt.mjs
```

This creates an ALT with common addresses (Bubblegum, SPL programs, etc.)

Output:
```
✅ Done! Add this to your .env.local:
   NEXT_PUBLIC_SHARED_ALT=G2cLwAYSniRLjzo4gAT8drg8FstVTdo6z5rsTKg5RAAc
```

### 2. Add to Environment Variables

Add the ALT address to `.env`:

```bash
NEXT_PUBLIC_SHARED_ALT=G2cLwAYSniRLjzo4gAT8drg8FstVTdo6z5rsTKg5RAAc
```

### 3. Extend ALT with Proof Addresses

For each cNFT that users will fractionalize/reclaim, add its proof addresses:

```bash
node scripts/extend-shared-alt.mjs <asset-id>
```

Example:
```bash
node scripts/extend-shared-alt.mjs 2hHh3skctK2gsyJKbLWaGnSk9M7HpJ6TkvYDS6XCX2XP
```

This adds the 20 Merkle proof nodes to the ALT so they can be compressed.

## How It Works

### Before (Per-User ALT)
```
User clicks "Initialize Reclaim"
  ↓
1. Sign: Create ALT           (costs ~0.002 SOL)
  ↓
2. Wait for activation        (1-2 seconds)
  ↓
3. Sign: Extend ALT           (costs ~0.001 SOL)
  ↓
4. Wait for confirmation      (1-2 seconds)
  ↓
5. Sign: Initialize Reclaim   (main transaction)
```

**Total: 3 signatures, ~5 seconds, ~0.003 SOL extra fees**

### After (Shared ALT)
```
User clicks "Initialize Reclaim"
  ↓
1. Sign: Initialize Reclaim   (main transaction)
```

**Total: 1 signature, instant, no extra fees**

## Technical Details

### ALT Contents
The shared ALT contains:
- **Common programs** (7 addresses):
  - Bubblegum program
  - SPL Account Compression
  - Noop program
  - System program
  - Token program
  - Associated Token program

- **Proof addresses** (20 per cNFT):
  - Merkle tree proof nodes for each asset

### Transaction Compression
Without ALT: ~35 accounts × 32 bytes = ~1120 bytes
With ALT: ~15 accounts × 32 bytes + 1 byte index per proof = ~500 bytes

**Savings: ~620 bytes (55% reduction)**

This keeps the transaction under wallet adapter serialization limits.

## Maintenance

### Adding New cNFTs
When users fractionalize new cNFTs that you want to support for reclaim:

```bash
node scripts/extend-shared-alt.mjs <new-asset-id>
```

The script:
1. Fetches proof addresses from Helius
2. Checks which addresses are already in the ALT
3. Only adds missing addresses
4. Batches in groups of 20 to avoid transaction size limits

### Checking ALT Status
```bash
solana address-lookup-table G2cLwAYSniRLjzo4gAT8drg8FstVTdo6z5rsTKg5RAAc
```

Shows:
- Authority (your wallet)
- Number of addresses
- Last extended slot

### Cost Analysis
- **Create ALT**: ~0.002 SOL (one-time)
- **Extend ALT (20 addresses)**: ~0.001 SOL per batch
- **Per cNFT**: ~0.001 SOL to add its 20 proof addresses

For 100 cNFTs: ~0.1 SOL total platform cost
vs
Per-user ALT: 0.003 SOL × 100 users = 0.3 SOL

**Shared ALT saves 66% in costs for 100 users**

## Code Changes

### useInitializeReclaimWithALT.ts
- Removed per-user ALT creation logic
- Added shared ALT loading from `NEXT_PUBLIC_SHARED_ALT`
- Falls back to error if ALT not configured
- Users only sign the main transaction

### initialize-reclaim-button.tsx
- Updated to use `useInitializeReclaimWithALT`
- No more "Setting up Address Lookup Table" loading state
- Single transaction flow

## Security

- **ALT Authority**: Your admin wallet (6xX9G1jy4quapnew9CpHd1rz3pWKgysM2Q4MMBkmQMxN)
- **Read-only for users**: Users can't modify the ALT, only read from it
- **No centralization risk**: ALT is just an on-chain optimization, doesn't control funds
- **Backup**: Keep your admin wallet keypair secure - it's needed to extend the ALT

## Troubleshooting

### Error: "Shared ALT not configured"
- Make sure `NEXT_PUBLIC_SHARED_ALT` is in `.env`
- Restart dev server after adding the variable

### Error: "Shared ALT not found on-chain"
- ALT address is wrong or on wrong network
- Verify with: `solana address-lookup-table <address> --url devnet`

### Transaction still too large
- The cNFT's proof addresses might not be in the ALT yet
- Run: `node scripts/extend-shared-alt.mjs <asset-id>`

## Future Improvements

1. **Auto-extend on fractionalize**: Automatically add proof addresses when a cNFT is fractionalized
2. **ALT per tree**: Create separate ALTs for different Merkle trees
3. **Monitoring**: Track ALT usage and extend proactively
4. **Multi-network**: Separate ALTs for devnet/mainnet

---

**Last updated**: November 13, 2025
**ALT Address (Devnet)**: G2cLwAYSniRLjzo4gAT8drg8FstVTdo6z5rsTKg5RAAc
**Authority**: 6xX9G1jy4quapnew9CpHd1rz3pWKgysM2Q4MMBkmQMxN
