/**
 * API route to build cancel_reclaim_v1 instruction
 * Returns serialized transaction for client to sign and send
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
const USDC_MINT = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');
const TREASURY_ACCOUNT = new PublicKey('tDeV8biSQiZCEdPvVmJ2fMNh5r7horSMgJ51mYi8HL5');
const COMPENSATION_ESCROW_SEED = Buffer.from('compensation_escrow');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vaultAddress, nftAssetId, userPublicKey } = body;

    if (!vaultAddress || !nftAssetId || !userPublicKey) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Get RPC endpoint
    const rpcResponse = await fetch(`${request.nextUrl.origin}/api/rpc-endpoint`);
    const { endpoint } = await rpcResponse.json();
    
    const connection = new Connection(endpoint, 'confirmed');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const program: any = new anchor.Program(idl as anchor.Idl, { connection });

    const user = new PublicKey(userPublicKey);
    const vault = new PublicKey(vaultAddress);
    const nftAsset = new PublicKey(nftAssetId);

    // Fetch vault data to get fraction mint
    const vaultAccount = await program.account.vault.fetch(vault);
    const fractionMint = vaultAccount.fractionMint as PublicKey;

    // Derive user's fraction token account
    const userFractionAccount = getAssociatedTokenAddressSync(
      fractionMint,
      user,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Derive user's USDC account
    const userUsdcAccount = getAssociatedTokenAddressSync(
      USDC_MINT,
      user,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Derive compensation escrow authority
    const [compensationEscrowAuthority] = PublicKey.findProgramAddressSync(
      [COMPENSATION_ESCROW_SEED, vault.toBuffer()],
      PROGRAM_ID
    );

    // Derive token escrow (ATA of escrow authority)
    const tokenEscrow = getAssociatedTokenAddressSync(
      fractionMint,
      compensationEscrowAuthority,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Derive treasury USDC account
    const treasuryUsdcAccount = getAssociatedTokenAddressSync(
      USDC_MINT,
      TREASURY_ACCOUNT,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Build the cancel reclaim instruction
    const instruction = await program.methods
      .cancelReclaimV1(nftAsset)
      .accounts({
        user,
        vault,
        fractionMint,
        userFractionedTokenAccount: userFractionAccount,
        usdcMint: USDC_MINT,
        userUsdcAccount,
        treasury: TREASURY_ACCOUNT,
        treasuryUsdcAccount,
        compensationEscrowAuthority,
        tokenEscrow,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();

    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    // Add compute budget
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300_000,
    });
    const computePriceIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1,
    });

    // Build transaction
    const messageV0 = new TransactionMessage({
      payerKey: user,
      recentBlockhash: blockhash,
      instructions: [computeBudgetIx, computePriceIx, instruction],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Serialize transaction
    const serializedTx = Buffer.from(transaction.serialize()).toString('base64');

    return NextResponse.json({
      transaction: serializedTx,
      blockhash,
      lastValidBlockHeight,
      message: 'Transaction built successfully',
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Cancel reclaim API error:', error);
    return NextResponse.json(
      { error: errorMessage || 'Failed to build cancel reclaim transaction' },
      { status: 500 }
    );
  }
}
