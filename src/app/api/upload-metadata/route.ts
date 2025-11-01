/**
 * API route to upload metadata JSON to Pinata
 * Keeps PINATA_JWT secure on the server side
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const PINATA_JWT = process.env.PINATA_JWT;

    if (!PINATA_JWT) {
      return NextResponse.json(
        { error: 'Pinata not configured. Add PINATA_JWT to .env' },
        { status: 500 }
      );
    }

    const { name, symbol, description, imageUrl } = await request.json();

    if (!name || !symbol) {
      return NextResponse.json(
        { error: 'Name and symbol are required' },
        { status: 400 }
      );
    }

    // Create metadata JSON
    const metadata = {
      name,
      symbol,
      description: description || `${name} - Compressed NFT`,
      image: imageUrl || 'https://arweave.net/placeholder-image',
      attributes: [
        {
          trait_type: 'Type',
          value: 'Compressed NFT',
        },
        {
          trait_type: 'Created',
          value: new Date().toISOString(),
        },
      ],
      properties: {
        files: [
          {
            uri: imageUrl || 'https://arweave.net/placeholder-image',
            type: 'image/png',
          },
        ],
        category: 'image',
      },
    };

    console.log('📤 Uploading metadata to Pinata:', { name, symbol });
    console.log('🔑 JWT length:', PINATA_JWT.length, 'chars');
    console.log('🔑 JWT preview:', PINATA_JWT.substring(0, 20) + '...');

    // Upload to Pinata
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Pinata API error:', response.status, errorText);
      console.error('💡 Hint: If 401, check your PINATA_JWT in .env');
      console.error('💡 JWT should be 100+ characters, yours is:', PINATA_JWT.length);
      return NextResponse.json(
        { error: `Pinata API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;

    console.log('✅ Metadata uploaded:', ipfsUrl);

    return NextResponse.json({ ipfsUrl, ipfsHash: data.IpfsHash });
  } catch (error) {
    console.error('Upload metadata error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
