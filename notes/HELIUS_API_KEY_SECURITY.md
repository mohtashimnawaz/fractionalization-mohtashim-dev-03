# Helius API Key Security Update

## Changes Made

The project has been updated to keep the Helius API key secure by removing the `NEXT_PUBLIC_` prefix and implementing server-side API routes.

### Environment Variable

**Before:**
```env
NEXT_PUBLIC_HELIUS_API_KEY=your-key-here
```

**After:**
```env
HELIUS_API_KEY=your-key-here
```

The `NEXT_PUBLIC_` prefix exposes environment variables to the client-side bundle, making them visible in the browser. By removing this prefix, the API key is now only accessible on the server.

### New API Routes

Two new API routes were created to proxy Helius requests:

1. **`/api/rpc-endpoint`** - Returns the Helius RPC endpoint URL
   - Used by wallet adapter and connection providers
   - GET request returns `{ endpoint: "https://devnet.helius-rpc.com/?api-key=..." }`

2. **`/api/helius-rpc`** - Proxies Helius RPC calls
   - Used by hooks that need to call Helius DAS API methods
   - POST request forwards the JSON-RPC body to Helius

### Updated Files

**Client-side components/hooks:**
- `src/components/solana/wallet-adapter-provider.tsx` - Fetches endpoint from API route
- `src/hooks/use-mint-cnft.ts` - Uses API proxy for Helius calls
- `src/hooks/use-fractionalize-cnft.ts` - Uses API proxy for asset/proof fetching
- `src/hooks/use-vaults.ts` - Uses API proxy for metadata fetching
- `src/hooks/use-user-cnfts.ts` - Uses API proxy for fetching user's cNFTs
- `src/hooks/use-cnft-asset.ts` - Uses API proxy for asset details
- `src/hooks/use-cnft-proof.ts` - Uses API proxy for Merkle proofs
- `src/hooks/use-fractionalize.ts` - Uses API proxy for proof fetching

**Server-side files:**
- `src/lib/helius.ts` - Updated to use `HELIUS_API_KEY`
- `src/app/api/test-helius/route.ts` - Updated to use `HELIUS_API_KEY`

**Scripts:**
- `check-setup.cjs` - Updated to use `HELIUS_API_KEY`
- `create-tree.cjs` - Updated to use `HELIUS_API_KEY`
- `show-cnfts.cjs` - Updated to use `HELIUS_API_KEY` from .env

### Deployment to Vercel

When deploying to Vercel, add the environment variable:

```
HELIUS_API_KEY=your-api-key-here
```

**Important:** Do NOT use `NEXT_PUBLIC_HELIUS_API_KEY` as this will expose the key in the client bundle.

### Local Development

Update your `.env` file:

```env
HELIUS_API_KEY=your-api-key-here
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_MERKLE_TREE_ADDRESS=your-tree-address
NEXT_PUBLIC_FRACTIONALIZATION_PROGRAM_ID=your-program-id
```

### How It Works

1. Client components fetch the RPC endpoint from `/api/rpc-endpoint`
2. The API route reads `HELIUS_API_KEY` from server environment
3. Returns the full endpoint URL (with API key embedded)
4. Client uses this endpoint for connections

For Helius DAS API calls (getAsset, getAssetProof, etc.):
1. Client sends request to `/api/helius-rpc`
2. API route forwards to Helius with API key
3. Returns response to client

This keeps the API key secure while maintaining full functionality.
