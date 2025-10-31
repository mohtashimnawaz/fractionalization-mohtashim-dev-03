# Pinata Integration Guide

## Overview

The helper file you provided includes Pinata integration for uploading cNFT metadata to IPFS. This guide shows how to integrate it into the minting flow.

## Setup

### 1. Add Pinata JWT to Environment

```bash
# .env.local
PINATA_JWT=your_pinata_jwt_token_here
```

Get your JWT from: https://app.pinata.cloud/developers/api-keys

### 2. Install Dependencies (if needed)

```bash
npm install axios form-data
```

## Helper Functions Available

From `/Users/mohtashimnawaz/Downloads/helper.ts`:

### `uploadImageToPinata(filePath: string): Promise<string>`
- Uploads an image file to Pinata
- Returns IPFS URL: `https://gateway.pinata.cloud/ipfs/{hash}`

### `uploadMetadataToPinata(name, symbol, imageUrl): Promise<string>`
- Uploads JSON metadata to Pinata
- Returns IPFS URL for metadata

### `mintCnftV1(umi, merkleTree, collection, payer): Promise<PublicKey>`
- Complete minting flow with Pinata
- Uploads image → metadata → mints cNFT
- Returns asset ID

## Integration Options

### Option 1: Use in Minting Hook

Update `src/hooks/use-mint-cnft.ts` to use Pinata:

```typescript
import { uploadImageToPinata, uploadMetadataToPinata } from '@/lib/pinata';

export function useMintCNFT() {
  const mintMutation = useMutation({
    mutationFn: async (params: { name: string; symbol: string; imageFile?: File }) => {
      // 1. Upload image to Pinata
      let imageUrl = '/placeholder-nft.png';
      if (params.imageFile) {
        imageUrl = await uploadImageToPinata(params.imageFile);
      }
      
      // 2. Upload metadata to Pinata
      const metadataUrl = await uploadMetadataToPinata(
        params.name,
        params.symbol,
        imageUrl
      );
      
      // 3. Mint cNFT with Pinata metadata
      // ... rest of minting logic
    }
  });
}
```

### Option 2: Create Pinata Utility Module

Create `src/lib/pinata.ts`:

```typescript
/**
 * Pinata IPFS utilities
 */

import axios from 'axios';
import FormData from 'form-data';

const PINATA_JWT = process.env.PINATA_JWT || process.env.NEXT_PUBLIC_PINATA_JWT;

if (!PINATA_JWT) {
  console.warn('⚠️ PINATA_JWT not set. Pinata uploads will fail.');
}

/**
 * Upload image to Pinata
 */
export async function uploadImageToPinata(file: File): Promise<string> {
  const url = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    console.log('📤 Uploading image to Pinata...');
    const response = await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${PINATA_JWT}`
      }
    });
    
    const ipfsHash = response.data.IpfsHash;
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
    console.log('✅ Image uploaded:', ipfsUrl);
    return ipfsUrl;
  } catch (error) {
    console.error('❌ Pinata upload failed:', error);
    throw new Error('Failed to upload image to Pinata');
  }
}

/**
 * Upload metadata JSON to Pinata
 */
export async function uploadMetadataToPinata(
  name: string,
  symbol: string,
  imageUrl: string,
  description?: string
): Promise<string> {
  const url = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
  
  const metadata = {
    name,
    symbol,
    description: description || `${name} - Compressed NFT`,
    image: imageUrl,
    attributes: [],
  };
  
  try {
    console.log('📤 Uploading metadata to Pinata...');
    const response = await axios.post(url, metadata, {
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
        'Content-Type': 'application/json'
      }
    });
    
    const ipfsHash = response.data.IpfsHash;
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
    console.log('✅ Metadata uploaded:', ipfsUrl);
    return ipfsUrl;
  } catch (error) {
    console.error('❌ Pinata metadata upload failed:', error);
    throw new Error('Failed to upload metadata to Pinata');
  }
}
```

### Option 3: Server-Side Upload (Recommended for Production)

Create API route `src/app/api/upload-to-pinata/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  try {
    const { name, symbol, imageUrl, description } = await request.json();
    
    const PINATA_JWT = process.env.PINATA_JWT;
    if (!PINATA_JWT) {
      return NextResponse.json(
        { error: 'Pinata not configured' },
        { status: 500 }
      );
    }
    
    const metadata = {
      name,
      symbol,
      description: description || `${name} - Compressed NFT`,
      image: imageUrl,
    };
    
    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      metadata,
      {
        headers: {
          'Authorization': `Bearer ${PINATA_JWT}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
    
    return NextResponse.json({ ipfsUrl });
  } catch (error) {
    console.error('Pinata upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
```

Then use in frontend:

```typescript
const response = await fetch('/api/upload-to-pinata', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, symbol, imageUrl, description })
});

const { ipfsUrl } = await response.json();
```

## Current Implementation

The app currently uses **Helius DAS API** for fetching metadata:

```typescript
// src/hooks/useFractionalize.ts
const response = await fetch('/api/helius-rpc', {
  method: 'POST',
  body: JSON.stringify({
    method: 'getAsset',
    params: { id: assetId }
  })
});

const asset = response.result;
const imageUrl = asset.content?.links?.image || asset.content?.files?.[0]?.uri;
```

This works fine for **reading** metadata. Pinata is only needed for **minting** new cNFTs.

## When to Use Pinata

### Use Pinata for:
- ✅ Minting new cNFTs (upload metadata first)
- ✅ Custom metadata that you control
- ✅ Permanent IPFS storage
- ✅ Fast, reliable uploads

### Use Helius for:
- ✅ Reading existing cNFT metadata
- ✅ Fetching asset details
- ✅ Getting merkle proofs
- ✅ Querying user's cNFTs

## Testing Pinata Integration

1. Get Pinata JWT from https://app.pinata.cloud
2. Add to `.env.local`: `PINATA_JWT=your_jwt`
3. Test image upload:
```typescript
const imageUrl = await uploadImageToPinata(imageFile);
console.log('Image URL:', imageUrl);
```
4. Test metadata upload:
```typescript
const metadataUrl = await uploadMetadataToPinata('Test NFT', 'TEST', imageUrl);
console.log('Metadata URL:', metadataUrl);
```
5. Use metadata URL when minting cNFT

## Benefits of Pinata

- **Fast**: Optimized IPFS gateway
- **Reliable**: 99.9% uptime
- **Permanent**: Files pinned forever
- **Free tier**: 1GB storage, 100GB bandwidth/month
- **Easy**: Simple REST API

## Notes

- Pinata is for **uploading** metadata (minting)
- Helius is for **reading** metadata (displaying)
- Both work together perfectly
- Current app works fine without Pinata (uses Helius)
- Add Pinata when you need custom minting

---

**The helper file you provided is ready to use - just add PINATA_JWT to .env!**
