/**
 * Create a shared Address Lookup Table for Initialize Reclaim
 * This ALT will be used by ALL users, so they don't have to create their own
 * 
 * Run with: node scripts/create-shared-alt.mjs
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

const NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || `https://api.${NETWORK}.solana.com`;

// Common addresses that appear in initialize_reclaim transactions
const COMMON_ADDRESSES = [
  // Bubblegum program and accounts
  'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY', // Bubblegum program
  'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK', // Compression program
  'noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV', // Noop program
  '11111111111111111111111111111111', // System program
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token program
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token program
  
  // SPL Account Compression
  'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK',
];

async function main() {
  console.log('🚀 Creating shared ALT for Initialize Reclaim...\n');

  // Load wallet
  const walletPath = join(homedir(), '.config', 'solana', 'id.json');
  let keypair;
  
  try {
    const secretKey = JSON.parse(readFileSync(walletPath, 'utf-8'));
    keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
    console.log('✅ Loaded wallet:', keypair.publicKey.toBase58());
  } catch (error) {
    console.error('❌ Failed to load wallet from', walletPath);
    console.error('   Make sure you have a Solana wallet at ~/.config/solana/id.json');
    process.exit(1);
  }

  const connection = new Connection(RPC_URL, 'confirmed');
  const balance = await connection.getBalance(keypair.publicKey);
  console.log('💰 Balance:', balance / 1e9, 'SOL\n');

  if (balance < 0.01e9) {
    console.error('❌ Insufficient balance. Need at least 0.01 SOL');
    console.error('   Run: solana airdrop 1', keypair.publicKey.toBase58(), '--url', NETWORK);
    process.exit(1);
  }

  // Step 1: Create ALT
  console.log('📝 Step 1: Creating Address Lookup Table...');
  const currentSlot = await connection.getSlot();
  const [createIx, altAddress] = AddressLookupTableProgram.createLookupTable({
    authority: keypair.publicKey,
    payer: keypair.publicKey,
    recentSlot: currentSlot - 1,
  });

  console.log('   ALT Address:', altAddress.toBase58());

  const { blockhash } = await connection.getLatestBlockhash();
  const createMessage = new TransactionMessage({
    payerKey: keypair.publicKey,
    recentBlockhash: blockhash,
    instructions: [createIx],
  }).compileToV0Message();

  const createTx = new VersionedTransaction(createMessage);
  createTx.sign([keypair]);

  const createSig = await connection.sendTransaction(createTx);
  await connection.confirmTransaction(createSig, 'confirmed');
  console.log('   ✅ ALT created:', createSig);

  // Wait for activation
  console.log('\n⏳ Waiting for ALT activation (2 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 2: Extend ALT with common addresses
  console.log('\n📝 Step 2: Extending ALT with common addresses...');
  
  const addressesToAdd = COMMON_ADDRESSES
    .map(addr => {
      try {
        return new PublicKey(addr);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  console.log(`   Adding ${addressesToAdd.length} addresses...`);

  // Add in batches of 20
  for (let i = 0; i < addressesToAdd.length; i += 20) {
    const batch = addressesToAdd.slice(i, i + 20);
    
    const extendIx = AddressLookupTableProgram.extendLookupTable({
      lookupTable: altAddress,
      authority: keypair.publicKey,
      payer: keypair.publicKey,
      addresses: batch,
    });

    const { blockhash: extendBlockhash } = await connection.getLatestBlockhash();
    const extendMessage = new TransactionMessage({
      payerKey: keypair.publicKey,
      recentBlockhash: extendBlockhash,
      instructions: [extendIx],
    }).compileToV0Message();

    const extendTx = new VersionedTransaction(extendMessage);
    extendTx.sign([keypair]);

    const extendSig = await connection.sendTransaction(extendTx);
    await connection.confirmTransaction(extendSig, 'confirmed');
    console.log(`   ✅ Batch ${Math.floor(i / 20) + 1} added:`, extendSig);
  }

  // Step 3: Verify ALT
  console.log('\n📝 Step 3: Verifying ALT...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const lookupTable = await connection.getAddressLookupTable(altAddress);
  if (lookupTable.value) {
    console.log('   ✅ ALT has', lookupTable.value.state.addresses.length, 'addresses');
    console.log('\n📋 ALT Summary:');
    console.log('   Address:', altAddress.toBase58());
    console.log('   Authority:', lookupTable.value.state.authority?.toBase58());
    console.log('   Addresses:', lookupTable.value.state.addresses.length);
  } else {
    console.error('   ❌ Failed to fetch ALT');
  }

  // Step 4: Add to .env.local
  console.log('\n✅ Done! Add this to your .env.local:');
  console.log('\n   NEXT_PUBLIC_SHARED_ALT=' + altAddress.toBase58());
  console.log('\n⚠️  Important: This ALT is owned by', keypair.publicKey.toBase58());
  console.log('   Keep the wallet secure - you can extend the ALT later if needed.\n');
}

main().catch(console.error);
