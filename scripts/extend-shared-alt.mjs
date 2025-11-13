/**
 * Extend the shared ALT with proof addresses from a specific cNFT
 * This adds the Merkle proof nodes so they can be compressed in transactions
 * 
 * Run with: node scripts/extend-shared-alt.mjs <asset-id>
 */

import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableProgram,
} from '@solana/web3.js';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

const NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
const SHARED_ALT = process.env.NEXT_PUBLIC_SHARED_ALT;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

if (!SHARED_ALT) {
  console.error('❌ NEXT_PUBLIC_SHARED_ALT not set in .env');
  process.exit(1);
}

if (!HELIUS_API_KEY) {
  console.error('❌ HELIUS_API_KEY not set in .env');
  process.exit(1);
}

const assetId = process.argv[2];
if (!assetId) {
  console.error('Usage: node scripts/extend-shared-alt.mjs <asset-id>');
  process.exit(1);
}

async function getAssetProof(assetId) {
  const response = await fetch(`https://${NETWORK}.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'get-proof',
      method: 'getAssetProof',
      params: { id: assetId },
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`Helius error: ${data.error.message}`);
  }

  return data.result;
}

async function main() {
  console.log('🚀 Extending shared ALT with proof addresses...\n');
  console.log('   Asset ID:', assetId);
  console.log('   Shared ALT:', SHARED_ALT, '\n');

  // Load wallet
  const walletPath = join(homedir(), '.config', 'solana', 'id.json');
  let keypair;
  
  try {
    const secretKey = JSON.parse(readFileSync(walletPath, 'utf-8'));
    keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
    console.log('✅ Loaded wallet:', keypair.publicKey.toBase58());
  } catch (error) {
    console.error('❌ Failed to load wallet from', walletPath);
    process.exit(1);
  }

  const connection = new Connection(`https://api.${NETWORK}.solana.com`, 'confirmed');

  // Fetch asset proof
  console.log('\n📝 Fetching asset proof from Helius...');
  const proof = await getAssetProof(assetId);
  console.log('   Proof nodes:', proof.proof.length);

  // Convert proof to PublicKeys and normalize arrays
  const proofAddresses = proof.proof.map(node => {
    // Helius returns 33-byte arrays, slice to 32 bytes
    const normalized = Array.isArray(node) 
      ? (node.length === 33 ? node.slice(1) : node)
      : node;
    
    return new PublicKey(normalized);
  });

  // Fetch current ALT
  console.log('\n📝 Checking current ALT...');
  const altAddress = new PublicKey(SHARED_ALT);
  const lookupTable = await connection.getAddressLookupTable(altAddress);
  
  if (!lookupTable.value) {
    console.error('❌ ALT not found on-chain');
    process.exit(1);
  }

  console.log('   Current addresses:', lookupTable.value.state.addresses.length);

  // Check which addresses are missing
  const existingAddresses = lookupTable.value.state.addresses;
  const missingAddresses = proofAddresses.filter(
    proof => !existingAddresses.some(existing => existing.equals(proof))
  );

  if (missingAddresses.length === 0) {
    console.log('\n✅ All proof addresses already in ALT!');
    return;
  }

  console.log('   Missing addresses:', missingAddresses.length);

  // Extend ALT in batches of 20
  console.log('\n📝 Extending ALT...');
  for (let i = 0; i < missingAddresses.length; i += 20) {
    const batch = missingAddresses.slice(i, i + 20);
    
    const extendIx = AddressLookupTableProgram.extendLookupTable({
      lookupTable: altAddress,
      authority: keypair.publicKey,
      payer: keypair.publicKey,
      addresses: batch,
    });

    const { blockhash } = await connection.getLatestBlockhash();
    const message = new TransactionMessage({
      payerKey: keypair.publicKey,
      recentBlockhash: blockhash,
      instructions: [extendIx],
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([keypair]);

    const sig = await connection.sendTransaction(tx);
    await connection.confirmTransaction(sig, 'confirmed');
    console.log(`   ✅ Batch ${Math.floor(i / 20) + 1}:`, sig);
  }

  // Verify
  console.log('\n📝 Verifying...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const updatedLookupTable = await connection.getAddressLookupTable(altAddress);
  if (updatedLookupTable.value) {
    console.log('   ✅ ALT now has', updatedLookupTable.value.state.addresses.length, 'addresses');
  }

  console.log('\n✅ Done!\n');
}

main().catch(console.error);
