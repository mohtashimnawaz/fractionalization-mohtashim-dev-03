/**
 * Pinata IPFS utilities for uploading cNFT metadata
 * Documentation: https://docs.pinata.cloud/
 */

/**
 * Upload metadata JSON to Pinata via API route
 * This keeps the JWT secure on the server side
 */
export async function uploadMetadataToPinata(
  name: string,
  symbol: string,
  description?: string,
  imageUrl?: string
): Promise<string> {
  try {
    console.log('📤 Uploading metadata to Pinata...');

    const response = await fetch('/api/upload-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        symbol,
        description: description || `${name} - Compressed NFT`,
        imageUrl: imageUrl || 'https://arweave.net/placeholder-image',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    console.log('✅ Metadata uploaded to Pinata:', data.ipfsUrl);
    return data.ipfsUrl;
  } catch (error) {
    console.error('❌ Pinata upload failed:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to upload metadata to Pinata'
    );
  }
}

/**
 * Upload image file to Pinata via API route
 * Returns IPFS URL for the image
 */
export async function uploadImageToPinata(file: File): Promise<string> {
  try {
    console.log('📤 Uploading image to Pinata...');

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    console.log('✅ Image uploaded to Pinata:', data.ipfsUrl);
    return data.ipfsUrl;
  } catch (error) {
    console.error('❌ Pinata image upload failed:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to upload image to Pinata'
    );
  }
}
