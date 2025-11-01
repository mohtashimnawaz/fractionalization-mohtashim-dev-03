/**
 * API route to upload image file to Pinata
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

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('📤 Uploading image to Pinata:', file.name, file.type, file.size);

    // Create FormData for Pinata
    const pinataFormData = new FormData();
    pinataFormData.append('file', file);

    // Optional: Add metadata
    const metadata = JSON.stringify({
      name: file.name,
    });
    pinataFormData.append('pinataMetadata', metadata);

    // Upload to Pinata
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: pinataFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Pinata API error:', errorText);
      return NextResponse.json(
        { error: `Pinata API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;

    console.log('✅ Image uploaded:', ipfsUrl);

    return NextResponse.json({ ipfsUrl, ipfsHash: data.IpfsHash });
  } catch (error) {
    console.error('Upload image error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
