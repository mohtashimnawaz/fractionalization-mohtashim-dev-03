/**
 * API Route: Initialize Reclaim
 * Builds the initialize_reclaim_v1 transaction server-side
 */

import { NextRequest, NextResponse } from 'next/server';
import * as anchor from '@coral-xyz/anchor';
import { 
  Connection, 
  PublicKey, 
  TransactionMessage, 
  VersionedTransaction,
  ComputeBudgetProgram 
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddressSync, 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID 
} from '@solana/spl-token';
import idl from '@/lib/idl/fractionalization.json';

const PROGRAM_ID = new PublicKey(idl.address);
const MPL_BUBBLEGUM_ID = new PublicKey('BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY');
const SPL_ACCOUNT_COMPRESSION_PROGRAM_ID = new PublicKey('cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK');
const SPL_NOOP_PROGRAM_ID = new PublicKey('noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV');

const VAULT_SEED = Buffer.from('vault');
const COMPENSATION_ESCROW_SEED = Buffer.from('compensation_escrow');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      vaultAddress,
      nftAssetId,
      root,
      dataHash,
      creatorHash,
      nonce,
      index,
      userPublicKey,
      merkleTree,
      proofPath,
      leafDelegate,
    } = body;

    console.log('📥 Initialize reclaim request:', {
      vaultAddress,
      nftAssetId: nftAssetId.slice(0, 8) + '...',
      userPublicKey: userPublicKey.slice(0, 8) + '...',
      proofLength: proofPath?.length,
    });

    // Validate inputs
    if (!vaultAddress || !nftAssetId || !root || !dataHash || !creatorHash || 
        nonce === undefined || index === undefined || !userPublicKey || !merkleTree || !proofPath) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Get RPC endpoint
    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
      throw new Error('HELIUS_API_KEY not configured');
    }

    const rpcEndpoint = `https://devnet.helius-rpc.com/?api-key=${apiKey}`;
    const connection = new Connection(rpcEndpoint, 'confirmed');

    // Convert addresses
    const vaultPubkey = new PublicKey(vaultAddress);
    const userPubkey = new PublicKey(userPublicKey);
    const nftAssetIdPubkey = new PublicKey(nftAssetId);
    const merkleTreePubkey = new PublicKey(merkleTree);

    console.log('📡 Fetching vault account...');

    // Fetch vault account to get required data
    const vaultAccount = await connection.getAccountInfo(vaultPubkey);
    if (!vaultAccount) {
      throw new Error('Vault account not found');
    }

    // Parse vault account manually to get fraction_mint
    const vaultData = vaultAccount.data;
    let off = 8; // Skip discriminator
    
    // Skip nft_mint (32 bytes)
    off += 32;
    // Skip nft_asset_id (32 bytes)
    off += 32;
    
    // Read fraction_mint (32 bytes)
    const fractionMint = new PublicKey(vaultData.slice(off, off + 32));
    console.log('✅ Fraction mint:', fractionMint.toBase58());

    // Derive PDAs
    const [compensationEscrowAuthority] = PublicKey.findProgramAddressSync(
      [COMPENSATION_ESCROW_SEED, vaultPubkey.toBuffer()],
      PROGRAM_ID
    );

    console.log('📋 Derived PDAs:', {
      compensationEscrowAuthority: compensationEscrowAuthority.toBase58(),
    });

    // Get user's fraction token account
    const userFractionedTokenAccount = getAssociatedTokenAddressSync(
      fractionMint,
      userPubkey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Token escrow ATA (will be created by the instruction)
    const tokenEscrow = getAssociatedTokenAddressSync(
      fractionMint,
      compensationEscrowAuthority,
      true, // Allow PDA owner
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Get tree authority PDA (for Bubblegum)
    const [treeAuthority] = PublicKey.findProgramAddressSync(
      [merkleTreePubkey.toBuffer()],
      MPL_BUBBLEGUM_ID
    );

    console.log('🏗️ Building instruction...');

    // Create provider with minimal setup
    const provider = new anchor.AnchorProvider(
      connection,
      {} as any,
      { commitment: 'confirmed' }
    );

    const program = new anchor.Program(idl as anchor.Idl, provider);

    // Convert proof path to remaining accounts
    const proofAccounts = proofPath.map((node: string) => ({
      pubkey: new PublicKey(node),
      isWritable: false,
      isSigner: false,
    }));

    console.log('📦 Proof accounts:', proofAccounts.length);

    // Build accounts object
    const accounts: any = {
      user: userPubkey,
      vault: vaultPubkey,
      fractionMint: fractionMint,
      userFractionedTokenAccount,
      compensationEscrowAuthority,
      tokenEscrow,
      bubblegumProgram: MPL_BUBBLEGUM_ID,
      compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
      merkleTree: merkleTreePubkey,
      treeAuthority,
      logWrapper: SPL_NOOP_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    };

    // Add leafDelegate only if it exists
    if (leafDelegate) {
      accounts.leafDelegate = new PublicKey(leafDelegate);
    }

    // Build the instruction
    const ix = await program.methods
      .initializeReclaimV1(
        nftAssetIdPubkey,
        Array.from(new Uint8Array(root)),
        Array.from(new Uint8Array(dataHash)),
        Array.from(new Uint8Array(creatorHash)),
        new anchor.BN(nonce),
        index
      )
      .accounts(accounts)
      .remainingAccounts(proofAccounts)
      .instruction();

    console.log('✅ Instruction built');

    // Add compute budget instructions
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400_000,
    });

    const computePriceIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1,
    });

    // Get latest blockhash
    const { blockhash } = await connection.getLatestBlockhash('confirmed');

    // Build versioned transaction
    const messageV0 = new TransactionMessage({
      payerKey: userPubkey,
      recentBlockhash: blockhash,
      instructions: [computeBudgetIx, computePriceIx, ix],
    }).compileToV0Message();

    const versionedTx = new VersionedTransaction(messageV0);

    // Serialize transaction
    const serializedTx = Buffer.from(versionedTx.serialize()).toString('base64');

    console.log('✅ Transaction built and serialized');

    return NextResponse.json({
      transaction: serializedTx,
      message: 'Transaction built successfully',
    });

  } catch (error: any) {
    console.error('❌ Initialize reclaim API error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to build transaction',
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
