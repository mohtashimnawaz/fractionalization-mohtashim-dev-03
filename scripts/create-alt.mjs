#!/usr/bin/env node

/**
 * Create an Address Lookup Table for proof accounts
 * This dramatically reduces transaction size for initialize_reclaim
 */

import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableProgram,
  Keypair,
} from '@solana/web3.js';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import 'dotenv/config';

async function main() {
  const heliusApiKey = process.env.HELIUS_API_KEY;
  if (!heliusApiKey) {
    throw new Error('HELIUS_API_KEY not found in .env');
  }

  const rpcUrl = `https://devnet.helius-rpc.com/?api-key=${heliusApiKey}`;
  const connection = new Connection(rpcUrl, 'confirmed');

  // Load wallet
  const keypairPath = join(homedir(), '.config', 'solana', 'id.json');
  const keypairData = JSON.parse(await readFile(keypairPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(new Uint8Array(keypairData));

  console.log('🔑 Payer:', payer.publicKey.toBase58());
  console.log('📡 Creating Address Lookup Table...\n');

  // Create the lookup table
  const [lookupTableInst, lookupTableAddress] =
    AddressLookupTableProgram.createLookupTable({
      authority: payer.publicKey,
      payer: payer.publicKey,
      recentSlot: await connection.getSlot(),
    });

  console.log('📋 Lookup Table Address:', lookupTableAddress.toBase58());

  // Get a blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  // Build and send the create transaction
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: [lookupTableInst],
  }).compileToLegacyMessage();

  const transaction = new VersionedTransaction(message);
  transaction.sign([payer]);

  const signature = await connection.sendTransaction(transaction);
  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  });

  console.log('✅ Lookup table created!');
  console.log('📝 Signature:', signature);
  console.log('\n💡 Add this to your .env file:');
  console.log(`NEXT_PUBLIC_ALT_ADDRESS=${lookupTableAddress.toBase58()}`);
  console.log('\n⚠️  Wait ~10 seconds before adding addresses...');
}

main().catch(console.error);
