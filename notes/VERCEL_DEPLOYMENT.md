# Vercel Deployment Guide

## Pre-Deployment Checklist

### ✅ Required Environment Variables

Add these to your Vercel project settings (Settings → Environment Variables):

```bash
# Helius API Key (Server-side only - no NEXT_PUBLIC_ prefix)
HELIUS_API_KEY=your_helius_api_key_here

# Pinata JWT for metadata uploads
PINATA_JWT=your_pinata_jwt_here

# Solana Network
NEXT_PUBLIC_SOLANA_NETWORK=devnet  # or mainnet-beta

# Merkle Tree Address (your cNFT tree)
NEXT_PUBLIC_MERKLE_TREE_ADDRESS=5HzyhuPZXyUi4fUk4P6zk57w4XDsCn67UGRbHxZwgFro

# Fractionalization Program ID
NEXT_PUBLIC_FRACTIONALIZATION_PROGRAM_ID=DM26SsAwF5NSGVWSebfaUBkYAG3ioLkfFnqt1Vr7pq2P

# Address Lookup Tables
NEXT_PUBLIC_LOOKUP_TABLE_ADDRESS=7LzCaxGwX5GzmXbcr96diDM1YAFTnK3ALvqmBzPn18bU
NEXT_PUBLIC_SHARED_ALT=G2cLwAYSniRLjzo4gAT8drg8FstVTdo6z5rsTKg5RAAc

# Optional: Collection Mint
NEXT_PUBLIC_COLLECTION_MINT=your_collection_mint_here
```

### ⚠️ Important Notes

1. **Never commit `.env` to git** - it contains secrets
2. **Use Vercel's Environment Variables UI** - don't put secrets in `vercel.json`
3. **Separate dev/prod keys** - use different API keys for production

## Known Build Warnings (Safe to Ignore)

### 1. bigint-buffer warning
```
bigint: Failed to load bindings, pure JS will be used (try npm run rebuild?)
```

**Status**: ✅ Safe to ignore
**Why**: The `bigint-buffer` package tries to load native bindings for performance, but falls back to pure JavaScript. This doesn't affect functionality.
**Impact on Vercel**: None - the build will succeed and the app will work correctly.

### 2. useSolana wallet info
```
🔑 useSolana - wallet info: { connected: undefined, hasAccount: false, ... }
```

**Status**: ✅ Fixed - only shows in development now
**Why**: Debug logging that runs before wallet is connected
**Impact on Vercel**: None - suppressed in production builds

## Deployment Steps

### 1. Install Vercel CLI (optional)
```bash
npm i -g vercel
```

### 2. Deploy via Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Add environment variables (see checklist above)
5. Click "Deploy"

### 3. Deploy via CLI
```bash
vercel --prod
```

## Build Configuration

The project is configured for optimal Vercel deployment:

### next.config.ts
- ✅ Webpack configured to suppress warnings
- ✅ Image domains whitelisted
- ✅ Fallbacks configured for browser polyfills

### vercel.json
- ✅ Build environment variables
- ✅ Route configuration
- ✅ Next.js build settings

## Post-Deployment Verification

### 1. Check Environment Variables
```bash
vercel env ls
```

### 2. Test API Routes
```bash
curl https://your-app.vercel.app/api/helius-rpc -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"test","method":"getHealth","params":{}}'
```

Should return: `{"jsonrpc":"2.0","result":"ok","id":"test"}`

### 3. Test Wallet Connection
1. Visit your deployed app
2. Click "Connect Wallet"
3. Connect with Phantom/Solflare
4. Check console for errors (should be none)

### 4. Test Fractionalization
1. Go to `/fractionalize`
2. Select a cNFT
3. Fractionalize it
4. Verify transaction on Solscan

### 5. Test Initialize Reclaim
1. Go to a vault detail page
2. Click "Initialize Reclaim" (if eligible)
3. Should only require 1 signature (not 3)
4. Verify on Solscan

## Troubleshooting

### Build Fails

**Error**: "HELIUS_API_KEY not defined"
**Fix**: Add `HELIUS_API_KEY` to Vercel environment variables (NOT prefixed with NEXT_PUBLIC_)

**Error**: "Module not found: Can't resolve 'fs'"
**Fix**: Already handled in `next.config.ts` webpack config

**Error**: "Cannot find module 'dotenv'"
**Fix**: Only scripts need dotenv, not the Next.js app. Make sure you're running `npm run build`, not custom scripts.

### Runtime Errors

**Error**: "Shared ALT not configured"
**Fix**: Add `NEXT_PUBLIC_SHARED_ALT` to Vercel environment variables

**Error**: "Helius API rate limit"
**Fix**: Upgrade your Helius plan or implement caching (already done in `/api/helius-rpc`)

**Error**: "Transaction too large"
**Fix**: Make sure the shared ALT has the proof addresses. Run locally:
```bash
node scripts/extend-shared-alt.mjs <asset-id>
```

### Performance Issues

**Slow API responses**
- Enable Vercel Edge Functions for API routes
- Increase Helius API plan for higher rate limits
- Implement Redis caching for frequently accessed data

**Large bundle size**
- Check bundle analyzer: `npm run build`
- Tree-shake unused Anchor/Metaplex imports
- Use dynamic imports for heavy components

## Security Best Practices

### ✅ DO:
- ✅ Use separate API keys for dev/prod
- ✅ Keep `HELIUS_API_KEY` and `PINATA_JWT` secret (no NEXT_PUBLIC_ prefix)
- ✅ Rotate API keys periodically
- ✅ Monitor Vercel logs for suspicious activity
- ✅ Use Vercel's environment variable encryption

### ❌ DON'T:
- ❌ Commit `.env` to git
- ❌ Share API keys in Discord/Slack
- ❌ Use `NEXT_PUBLIC_` prefix for sensitive keys
- ❌ Deploy without testing locally first

## Monitoring

### Vercel Analytics
Enable in project settings for:
- Page views
- API route usage
- Error tracking
- Performance metrics

### Custom Logging
Check Vercel logs:
```bash
vercel logs
```

Filter by function:
```bash
vercel logs --filter="helius-rpc"
```

### Helius Dashboard
Monitor your API usage at [helius.dev/dashboard](https://helius.dev/dashboard)

## Cost Estimates

### Vercel Free Tier
- ✅ 100GB bandwidth/month
- ✅ Unlimited deployments
- ✅ Automatic SSL
- ⚠️ Serverless function timeout: 10s

### Vercel Pro ($20/month)
- ✅ 1TB bandwidth/month
- ✅ 60s function timeout
- ✅ Priority support
- ✅ Team collaboration

### Helius Free Tier
- ✅ 100,000 requests/month
- ⚠️ Rate limited

### Estimated Monthly Cost (Small Project)
- Vercel: Free - $20
- Helius: Free - $10
- Pinata: Free - $10
- **Total: $0 - $40/month**

## Scaling Considerations

### When to upgrade:

**Vercel Pro** when:
- >100GB bandwidth/month
- Need longer function timeouts
- Multiple team members

**Helius Paid** when:
- >100k requests/month
- Need higher rate limits
- Need priority support

**Redis Caching** when:
- Helius rate limits hit
- Need sub-100ms responses
- High traffic (>10k users)

## Mainnet Deployment

### Additional Steps:

1. **Update Environment Variables**
   ```bash
   NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
   NEXT_PUBLIC_MERKLE_TREE_ADDRESS=<mainnet-tree>
   NEXT_PUBLIC_FRACTIONALIZATION_PROGRAM_ID=<mainnet-program>
   ```

2. **Create Mainnet ALT**
   ```bash
   # Switch to mainnet in .env
   node scripts/create-shared-alt.mjs
   node scripts/extend-shared-alt.mjs <mainnet-asset-id>
   ```

3. **Test Thoroughly**
   - Test with small amounts first
   - Verify all transactions on Solscan
   - Check for any errors in Vercel logs

4. **Update Documentation**
   - Update README with mainnet addresses
   - Document any mainnet-specific quirks
   - Share with community

---

**Last Updated**: November 13, 2025
**Deployment Target**: Vercel (Next.js 15.5.3)
**Network**: Devnet (Mainnet-ready)
