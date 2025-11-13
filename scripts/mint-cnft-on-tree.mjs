#!/usr/bin/env node

/**
 * Mint a compressed NFT on the specified Merkle tree
 * This tree has canopy depth 14, so Initialize Reclaim will need minimal proof nodes
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mintV1 } from '@metaplex-foundation/mpl-bubblegum';
import { 
  generateSigner, 
  percentAmount, 
  publicKey, 
  signerIdentity,
  createSignerFromKeypair
} from '@metaplex-foundation/umi';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import 'dotenv/config';

async function main() {
  // Initialize UMI with Helius RPC
  const heliusApiKey = process.env.HELIUS_API_KEY;
  if (!heliusApiKey) {
    throw new Error('HELIUS_API_KEY not found in .env');
  }

  const rpcUrl = `https://devnet.helius-rpc.com/?api-key=${heliusApiKey}`;
  console.log('🔗 Connecting to Solana devnet via Helius...');
  
  const umi = createUmi(rpcUrl);

  // Load wallet from ~/.config/solana/id.json
  const keypairPath = join(homedir(), '.config', 'solana', 'id.json');
  console.log('🔑 Loading keypair from:', keypairPath);
  
  const keypairData = JSON.parse(await readFile(keypairPath, 'utf-8'));
  const keypairBytes = new Uint8Array(keypairData);
  const keypair = umi.eddsa.createKeypairFromSecretKey(keypairBytes);
  const signer = createSignerFromKeypair(umi, keypair);
  
  umi.use(signerIdentity(signer));
  console.log('✅ Wallet loaded:', signer.publicKey);

  // Get the Merkle tree address from .env
  const merkleTreeAddress = process.env.NEXT_PUBLIC_MERKLE_TREE_ADDRESS;
  if (!merkleTreeAddress) {
    throw new Error('NEXT_PUBLIC_MERKLE_TREE_ADDRESS not found in .env');
  }

  console.log('\n📦 Minting compressed NFT...');
  console.log('🌲 Merkle Tree:', merkleTreeAddress);
  console.log('👤 Owner:', signer.publicKey);

  // Generate unique name with timestamp
  const timestamp = Date.now();
  const name = `Test cNFT #${timestamp}`;
  const symbol = 'TCNFT';
  
  // Use a short Arweave URI (placeholder - for production, upload actual metadata)
  // Metaplex has a 200-character limit for URI
  const metadataUri = 'https://arweave.net/test';

  console.log('\n📝 Metadata:');
  console.log('  Name:', name);
  console.log('  Symbol:', symbol);
  console.log('  URI:', metadataUri);

  try {
    // Mint the compressed NFT
    const result = await mintV1(umi, {
      leafOwner: signer.publicKey,
      merkleTree: publicKey(merkleTreeAddress),
      metadata: {
        name,
        symbol,
        uri: metadataUri,
        sellerFeeBasisPoints: percentAmount(5.0), // 5% royalty
        collection: { key: publicKey('11111111111111111111111111111111'), verified: false },
        creators: [
          {
            address: signer.publicKey,
            verified: true,
            share: 100,
          },
        ],
      },
    }).sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });

    console.log('\n✅ cNFT minted successfully!');
    console.log('📝 Signature:', result.signature);
    console.log('\n⏳ Waiting 10 seconds for Helius to index...');
    
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('\n✅ Done! Your cNFT should now be visible in the app.');
    console.log('🔍 To view your cNFTs, run: node show-cnfts.cjs');
    console.log('\n💡 This cNFT is on a tree with canopy depth 14.');
    console.log('💡 Initialize Reclaim will now work with minimal proof nodes!');

  } catch (error) {
    console.error('\n❌ Error minting cNFT:', error);
    if (error.logs) {
      console.error('Transaction logs:', error.logs);
    }
    throw error;
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
