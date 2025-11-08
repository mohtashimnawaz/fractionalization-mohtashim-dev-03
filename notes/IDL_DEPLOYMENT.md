# IDL Management for Deployment

## Issue
The Vercel build was failing because `anchor/` directory is ignored in `.vercelignore`, but the code was trying to import the IDL from `anchor/target/idl/fractionalization.json`.

## Solution
Moved the IDL file to a location that's included in the build:
- **Location**: `src/lib/idl/fractionalization.json`
- **Import**: Changed from `../../anchor/target/idl/fractionalization.json` to `@/lib/idl/fractionalization.json`

## Keeping IDL in Sync

After rebuilding your Anchor program, run:
```bash
./scripts/sync-idl.sh
```

This script copies the updated IDL from `anchor/target/idl/fractionalization.json` to `src/lib/idl/fractionalization.json`.

## Why This Approach?

1. ✅ **Deployment friendly**: `src/lib/idl/` is not ignored, so it's included in Vercel builds
2. ✅ **Version controlled**: The IDL is committed to git, ensuring consistency
3. ✅ **Type safe**: Next.js can resolve the JSON import during build
4. ✅ **Easy sync**: Simple script to update after Anchor builds

## Important

**Always run `./scripts/sync-idl.sh` after:**
- Building your Anchor program (`anchor build`)
- Updating program instructions
- Making any changes to the IDL

This ensures your frontend uses the latest program interface.
