/**
 * API Route: Initialize Reclaim
 * Builds the initialize_reclaim_v1 transaction server-side
 */

import { NextRequest, NextResponse } from 'next/server';
import * as anchor from '@coral-xyz/anchor';
import { 
  Connection, 
  PublicKey
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
      rootType: typeof root,
      rootIsArray: Array.isArray(root),
      rootLength: root?.length,
      dataHashType: typeof dataHash,
      dataHashLength: dataHash?.length,
      creatorHashType: typeof creatorHash,
      creatorHashLength: creatorHash?.length,
      nonceType: typeof nonce,
      nonce,
      index,
    });

    // Ensure arrays are exactly 32 bytes (slice if needed)
    // Keep them as plain arrays - no Uint8Array conversion to avoid encoding issues
    const rootArray = Array.isArray(root) ? (root.length > 32 ? root.slice(root.length - 32) : root) : root;
    const dataHashArray = Array.isArray(dataHash) ? (dataHash.length > 32 ? dataHash.slice(dataHash.length - 32) : dataHash) : dataHash;
    const creatorHashArray = Array.isArray(creatorHash) ? (creatorHash.length > 32 ? creatorHash.slice(creatorHash.length - 32) : creatorHash) : creatorHash;

    console.log('✂️ Arrays after normalization:', {
      rootLength: rootArray.length,
      dataHashLength: dataHashArray.length,
      creatorHashLength: creatorHashArray.length,
      rootSample: rootArray.slice(0, 4),
      dataHashSample: dataHashArray.slice(0, 4),
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      leafDelegate: leafDelegate && leafDelegate !== 'null' ? new PublicKey(leafDelegate) : userPubkey, // Use user if no delegate
      logWrapper: SPL_NOOP_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    };

    console.log('🔧 Building instruction with params:', {
      nftAssetId: nftAssetIdPubkey.toBase58(),
      rootLength: rootArray.length,
      dataHashLength: dataHashArray.length,
      creatorHashLength: creatorHashArray.length,
      nonce,
      index,
    });

    // Build the instruction
    let ix;
    try {
      ix = await program.methods
        .initializeReclaimV1(
          nftAssetIdPubkey,
          rootArray, // Plain number array, already 32 bytes
          dataHashArray, // Plain number array, already 32 bytes
          creatorHashArray, // Plain number array, already 32 bytes
          new anchor.BN(nonce),
          index
        )
        .accounts(accounts)
        .remainingAccounts(proofAccounts)
        .instruction();

      console.log('✅ Instruction built successfully');
    } catch (buildError) {
      console.error('❌ Instruction build error:', buildError);
      console.error('Error details:', {
        message: buildError instanceof Error ? buildError.message : String(buildError),
        stack: buildError instanceof Error ? buildError.stack : undefined,
      });
      throw buildError;
    }

    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    console.log('🔧 Preparing transaction data for client-side building');

    // Return just the main instruction (no compute budget to reduce size)
    return NextResponse.json({
      instructions: [
        {
          programId: PROGRAM_ID.toBase58(),
          data: Buffer.from(ix.data).toString('base64'),
          keys: ix.keys.map(k => ({
            pubkey: k.pubkey.toBase58(),
            isSigner: k.isSigner,
            isWritable: k.isWritable,
          })),
        },
      ],
      blockhash,
      lastValidBlockHeight,
      feePayer: userPubkey.toBase58(),
      message: 'Instructions built successfully',
    });

  } catch (error) {
    const err = error as Error;
    console.error('❌ Initialize reclaim API error:', err);
    return NextResponse.json(
      { 
        error: err.message || 'Failed to build transaction',
        details: err.toString(),
      },
      { status: 500 }
    );
  }
}
