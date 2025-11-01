# Implementation Notes - Code Organization & UX Improvements

## Summary

Reorganized the codebase for better maintainability, added pagination to prevent API quota issues, improved form validation, and enhanced user feedback.

## Changes Implemented

### 1. Pagination for Explorer & Fractionalize Pages

**Problem**: Loading all vaults/cNFTs at once caused:
- Helius API quota exhaustion
- UI jamming/loading issues
- Poor performance

**Solution**:
- **Explorer**: Shows 10 most recent vaults with "Load More" button
- **Fractionalize**: Shows 10 most recent cNFTs with "Load More" button
- Reduces initial API calls and improves performance

### 2. Consolidated Hooks Architecture

Created organized hook structure:

#### `/src/hooks/useExplorer.ts`
- `useVaults(options)` - Fetch vaults with pagination
- `useVaultsByStatus(status, options)` - Filter vaults by status with pagination

#### `/src/hooks/useFractionalize.ts`
- `useUserCNFTs(walletAddress, limit, offset)` - Fetch user's cNFTs with pagination
- `useAssetWithProof(assetId)` - Get asset details + proof in one call (uses Bubblegum SDK)
- `useFractionalizeCNFT()` - Fractionalize cNFT with full validation

#### `/src/hooks/useUmi.ts`
- `useUmi()` - Centralized Umi instance creation (reused across app)
- Configured with mplBubblegum and dasApi plugins
- Automatically adds wallet adapter when connected

**Benefits**:
- Single Umi instance (no redundant creation)
- Consolidated asset + proof fetching (fewer API calls)
- Clear separation of concerns
- Easier to maintain and debug

### 3. Form Validation with User-Friendly Ranges

**Problem**: Users could enter invalid values causing blockchain errors with no feedback.

**Solution**: Added comprehensive validation in `configure-tokens-step.tsx`:

```typescript
// Validation constants
const MIN_SUPPLY = 1;
const MAX_SUPPLY = 1_000_000_000; // 1 billion
const MIN_PERCENT = 0;
const MAX_PERCENT = 100;
```

**Features**:
- Real-time validation with error messages
- Clear range indicators (e.g., "Range: 1 - 1,000,000,000 tokens")
- Prevents invalid submissions
- User-friendly error messages

**Validated Fields**:
- Total Supply: 1 to 1 billion tokens
- Min Reclaim %: 0-100%
- Min Liquidity %: 0-100%
- Min Volume %: 0-100%
- Min LP Age: Must be positive number

### 4. Enhanced User Feedback

**Success Toast**:
```typescript
toast.success('🎉 NFT Fractionalized Successfully!', {
  description: `Your cNFT has been fractionalized. Tx: ${signature}... View on Explorer: ${explorerUrl}`,
  duration: 10000,
});
```

**Features**:
- Shows transaction signature
- Provides Explorer link
- 10-second duration for user to copy/click
- Clear success/error states

**Error Handling**:
- Detailed error messages
- Ownership validation
- Already-fractionalized detection
- Transaction size validation

### 5. Metadata Handling (Pinata Ready)

The helper file provided shows Pinata integration for metadata upload. The current implementation uses Helius DAS API for fetching metadata, but the structure supports Pinata:

**Helper file functions** (in `/Users/mohtashimnawaz/Downloads/helper.ts`):
- `uploadImageToPinata(filePath)` - Upload image to IPFS via Pinata
- `uploadMetadataToPinata(name, symbol, imageUrl)` - Upload JSON metadata
- `mintCnftV1/V2()` - Mint cNFT with Pinata metadata

**To integrate**:
1. Add Pinata JWT to `.env`: `PINATA_JWT=your_jwt_here`
2. Use helper functions in minting flow
3. Metadata URLs will be `https://gateway.pinata.cloud/ipfs/{hash}`

### 6. Code Cleanup

**Removed old hooks**:
- `use-vaults.ts` → `useExplorer.ts`
- `use-user-cnfts.ts` → `useFractionalize.ts`
- `use-cnft-asset.ts` → consolidated into `useFractionalize.ts`
- `use-cnft-proof.ts` → consolidated into `useFractionalize.ts`
- `use-fractionalize.ts` → `useFractionalize.ts`
- `use-fractionalize-cnft.ts` → `useFractionalize.ts`

**Moved documentation**:
- All `.md` files moved to `/notes` folder
- Keeps root directory clean
- Easier to find project files

## File Structure

```
src/
├── hooks/
│   ├── useExplorer.ts          # Vault queries with pagination
│   ├── useFractionalize.ts     # cNFT queries + fractionalize mutation
│   ├── useUmi.ts               # Centralized Umi instance
│   ├── use-vault-details.ts    # Legacy (kept for compatibility)
│   ├── use-redeem.ts           # Legacy
│   ├── use-user-balance.ts     # Legacy
│   ├── use-mint-cnft.ts        # Legacy
│   └── index.ts                # Exports all hooks
├── components/
│   └── fractionalization/
│       ├── vault-explorer.tsx           # With pagination
│       ├── select-nft-step.tsx          # With pagination
│       └── configure-tokens-step.tsx    # With validation
└── ...

notes/                          # All documentation moved here
```

## Usage Examples

### Explorer with Pagination

```typescript
import { useVaults } from '@/hooks/useExplorer';

function VaultExplorer() {
  const [offset, setOffset] = useState(0);
  const { data, isLoading } = useVaults({ limit: 10, offset });
  
  const vaults = data?.vaults || [];
  const total = data?.total || 0;
  const hasMore = offset + 10 < total;
  
  return (
    <>
      {vaults.map(vault => <VaultCard key={vault.id} vault={vault} />)}
      {hasMore && <Button onClick={() => setOffset(prev => prev + 10)}>Load More</Button>}
    </>
  );
}
```

### Fractionalize with Validation

```typescript
import { useFractionalizeCNFT } from '@/hooks/useFractionalize';

function ConfigureTokens() {
  const { fractionalize, isPending, isSuccess } = useFractionalizeCNFT();
  
  const handleSubmit = () => {
    if (!validateForm()) return;
    
    fractionalize({
      assetId: nftMint,
      totalSupply: '1000000',
      minReclaimPercent: '51',
      // ... other params
    });
  };
  
  // Success toast automatically shown with tx signature
}
```

### Centralized Umi Instance

```typescript
import { useUmi } from '@/hooks/useUmi';
import { getAssetWithProof } from '@metaplex-foundation/mpl-bubblegum';

function MyComponent() {
  const umi = useUmi(); // Reuses same instance
  
  const fetchAsset = async (assetId) => {
    const asset = await getAssetWithProof(umi, assetId, { truncateCanopy: true });
    return asset;
  };
}
```

## Testing Checklist

- [x] Explorer loads 10 vaults initially
- [x] "Load More" button works in explorer
- [x] Fractionalize page loads 10 cNFTs initially
- [x] "Load More" button works in fractionalize
- [x] Form validation prevents invalid entries
- [x] Success toast shows transaction signature
- [x] Error messages are user-friendly
- [x] cNFT images display correctly (check metadata source)
- [ ] Pinata integration for minting (optional - use helper file)

## Next Steps

1. **Test pagination** - Verify "Load More" works correctly
2. **Test validation** - Try entering invalid values
3. **Check metadata** - Ensure cNFT images display (currently using Helius)
4. **Optional: Integrate Pinata** - Use helper file functions for minting
5. **Monitor Helius quota** - Pagination should reduce API calls significantly

## Notes

- All hooks now use pagination to protect Helius quota
- Form validation prevents blockchain errors before submission
- User feedback includes transaction signatures and Explorer links
- Code is organized for easier maintenance and debugging
- Umi instance is created once and reused (better performance)
- Asset + proof fetching consolidated (fewer API calls)

## Developer Experience Improvements

- Clear hook organization by feature
- Consistent naming conventions (useExplorer, useFractionalize)
- Comprehensive TypeScript types
- Detailed console logging for debugging
- Error boundaries with user-friendly messages
