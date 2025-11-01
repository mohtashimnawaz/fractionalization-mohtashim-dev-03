# Pinata JWT Setup Guide

## Issue

You're getting a 401 error from Pinata because the JWT token is invalid or incomplete.

Current JWT in `.env`:
```
PINATA_JWT=3e2abc00209e4f3d1fa3
```

This is too short! A valid Pinata JWT should be **100+ characters** long.

## How to Get a Valid Pinata JWT

### Step 1: Go to Pinata Dashboard
Visit: https://app.pinata.cloud/developers/api-keys

### Step 2: Create New API Key
1. Click "New Key" button
2. Give it a name (e.g., "Fractionalization App")
3. Enable these permissions:
   - ✅ `pinFileToIPFS`
   - ✅ `pinJSONToIPFS`
4. Click "Create Key"

### Step 3: Copy the JWT
You'll see a popup with your JWT token. It looks like:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiIxMjM0NTY3OC0xMjM0LTEyMzQtMTIzNC0xMjM0NTY3ODkwYWIiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJpZCI6IkZSQTEiLCJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MX1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiYWJjZGVmMTIzNDU2Iiwic2NvcGVkS2V5U2VjcmV0IjoiYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkwIiwiaWF0IjoxNjk4NzY1NDMyLCJleHAiOjE3MzAzMDE0MzJ9.abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOP
```

**Important**: Copy the ENTIRE token! It's very long.

### Step 4: Update .env File
Replace the current `PINATA_JWT` in your `.env` file:

```bash
# Before (wrong - too short)
PINATA_JWT=3e2abc00209e4f3d1fa3

# After (correct - full JWT)
PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiIxMjM0NTY3OC0xMjM0LTEyMzQtMTIzNC0xMjM0NTY3ODkwYWIiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJpZCI6IkZSQTEiLCJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MX1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiYWJjZGVmMTIzNDU2Iiwic2NvcGVkS2V5U2VjcmV0IjoiYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkwIiwiaWF0IjoxNjk4NzY1NDMyLCJleHAiOjE3MzAzMDE0MzJ9.abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOP
```

### Step 5: Restart Dev Server
```bash
# Stop the current server (Ctrl+C)
# Then restart
npm run dev
```

## Verify It Works

### Test 1: Check Server Logs
When you restart the dev server, you should NOT see any Pinata warnings.

### Test 2: Mint a cNFT
1. Go to fractionalize page
2. Click "Mint cNFT"
3. Fill in name and symbol
4. Click "Mint cNFT"
5. Check console - should see:
   ```
   📤 Uploading metadata to Pinata...
   ✅ Metadata uploaded to Pinata: https://gateway.pinata.cloud/ipfs/...
   ```

### Test 3: Check Pinata Dashboard
1. Go to https://app.pinata.cloud/pinmanager
2. You should see your uploaded metadata file
3. Click on it to view details

## Troubleshooting

### Still Getting 401 Error?

**Check 1: JWT is Complete**
- JWT should be 100+ characters
- Should have 3 parts separated by dots: `xxx.yyy.zzz`
- No spaces or line breaks

**Check 2: JWT Permissions**
Go to https://app.pinata.cloud/developers/api-keys and verify:
- ✅ `pinFileToIPFS` is enabled
- ✅ `pinJSONToIPFS` is enabled

**Check 3: JWT Not Expired**
- JWTs can expire
- Create a new one if needed

**Check 4: Server Restarted**
- Environment variables only load on server start
- Must restart dev server after changing `.env`

### Getting "Pinata not configured" Error?

This means the JWT is not being read from `.env`:
1. Check file is named exactly `.env` (not `.env.local` or `.env.txt`)
2. Check JWT line has no spaces: `PINATA_JWT=your_jwt_here`
3. Restart dev server

### Minting Still Works (Using Mock URL)

Good news! The app has a fallback:
- If Pinata fails, it uses a mock Arweave URL
- Minting still works for testing
- But metadata won't be permanent

## Current Behavior

Right now, your app is using the **fallback mock URL** because Pinata JWT is invalid:

```
⚠️ Using mock metadata URI: https://arweave.net/xxxxxxxxx...
```

This is fine for **testing**, but for **production** you need a valid Pinata JWT.

## Quick Fix for Testing

If you just want to test minting without Pinata:

### Option 1: Use Mock URLs (Current)
- Already working!
- Minting works fine
- Metadata is temporary

### Option 2: Get Valid Pinata JWT
- Follow steps above
- Get permanent IPFS metadata
- Production-ready

## Summary

**Problem**: JWT in `.env` is incomplete (only 24 characters)

**Solution**: Get full JWT from Pinata (100+ characters)

**Steps**:
1. Go to https://app.pinata.cloud/developers/api-keys
2. Create new API key with pinning permissions
3. Copy the FULL JWT (very long!)
4. Update `.env` with complete JWT
5. Restart dev server

**For now**: Minting works with mock URLs, which is fine for testing!

---

**Need help?** Share the first 20 characters of your JWT and I can verify if it looks valid.
