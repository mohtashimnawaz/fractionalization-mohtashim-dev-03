import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import idl from '@/lib/idl/fractionalization.json';
import { Fractionalization } from '@/types/fractionalization';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync 
} from '@solana/spl-token';

const PROGRAM_ID = new PublicKey(idl.address);
const MPL_BUBBLEGUM_ID = new PublicKey('BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY');
const SPL_ACCOUNT_COMPRESSION_PROGRAM_ID = new PublicKey('cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK');
const SPL_NOOP_PROGRAM_ID = new PublicKey('noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV');
const USDC_MINT = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');
const TREASURY_ACCOUNT = new PublicKey('tDeV8biSQiZCEdPvVmJ2fMNh5r7horSMgJ51mYi8HL5');

export async function POST(request: NextRequest) {
  const connection = new Connection(process.env.HELIUS_RPC_URL!);
  try {
    const body = await request.json();
    const {
      vaultAddress,
      nftAssetId,
      merkleTree,
      root,
      dataHash,
      creatorHash,
      nonce,
      index,
      raydiumPoolId,
      observationStateId,
      userPublicKey,
    } = body;

    // Validate required fields
    if (!vaultAddress || !nftAssetId || !merkleTree || !root || !dataHash || 
        !creatorHash || nonce === undefined || index === undefined || 
        !raydiumPoolId || !observationStateId || !userPublicKey) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const vaultPda = new PublicKey(vaultAddress);
    const nftAssetIdPubkey = new PublicKey(nftAssetId);
    const merkleTreePubkey = new PublicKey(merkleTree);
    const userPubkey = new PublicKey(userPublicKey);
    const raydiumPoolPubkey = new PublicKey(raydiumPoolId);
    const observationStatePubkey = new PublicKey(observationStateId);

    // Fetch vault account to get fraction_mint
    // @ts-expect-error - Anchor types mismatch
    const program = new anchor.Program(idl as Fractionalization, PROGRAM_ID, {
      connection,
    } as anchor.AnchorProvider);

    const vaultAccount = await program.account.vault.fetch(vaultPda);
    const fractionMint = vaultAccount.fractionMint as PublicKey;

    // Derive tree authority
    const [treeAuthority] = PublicKey.findProgramAddressSync(
      [merkleTreePubkey.toBuffer()],
      MPL_BUBBLEGUM_ID
    );

    // Derive token escrow PDA
    const [compensationEscrowAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('compensation_escrow')],
      PROGRAM_ID
    );

    // Token escrow (locked fractions)
    const tokenEscrow = getAssociatedTokenAddressSync(
      fractionMint,
      compensationEscrowAuthority,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // User's fraction token account
    const userFractionedTokenAccount = getAssociatedTokenAddressSync(
      fractionMint,
      userPubkey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // User's USDC account
    const userUsdcAccount = getAssociatedTokenAddressSync(
      USDC_MINT,
      userPubkey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Treasury USDC account
    const treasuryUsdcAccount = getAssociatedTokenAddressSync(
      USDC_MINT,
      TREASURY_ACCOUNT,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Compensation escrow (USDC)
    const compensationEscrow = getAssociatedTokenAddressSync(
      USDC_MINT,
      compensationEscrowAuthority,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Convert proof arrays (normalize 33-byte to 32-byte if needed)
    const rootBytes = Array.from(Buffer.from(root.replace('0x', ''), 'hex'));
    const dataHashBytes = Array.from(Buffer.from(dataHash.replace('0x', ''), 'hex'));
    const creatorHashBytes = Array.from(Buffer.from(creatorHash.replace('0x', ''), 'hex'));

    // Fetch asset proof
    const assetProofResponse = await fetch(process.env.HELIUS_RPC_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'finalize-reclaim-proof',
        method: 'getAssetProof',
        params: { id: nftAssetId },
      }),
    });

    const assetProofData = await assetProofResponse.json();
    const proof = assetProofData.result.proof;

    // Build accounts object
    const accounts = {
      user: userPubkey,
      vault: vaultPda,
      fractionMint,
      userFractionedTokenAccount,
      usdcMint: USDC_MINT,
      userUsdcAccount,
      treasury: TREASURY_ACCOUNT,
      treasuryUsdcAccount,
      compensationEscrowAuthority,
      compensationEscrow,
      tokenEscrow,
      raydiumPool: raydiumPoolPubkey,
      observationState: observationStatePubkey,
      bubblegumProgram: MPL_BUBBLEGUM_ID,
      compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
      merkleTree: merkleTreePubkey,
      treeAuthority,
      leafDelegate: null,
      logWrapper: SPL_NOOP_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    };

    // Build instruction
    const instruction = await program.methods
      .finalizeReclaimV1(
        nftAssetIdPubkey,
        rootBytes,
        dataHashBytes,
        creatorHashBytes,
        nonce,
        index
      )
      .accounts(accounts)
      .remainingAccounts(
        proof.map((node: string): { pubkey: PublicKey; isWritable: boolean; isSigner: boolean } => ({
          pubkey: new PublicKey(node),
          isWritable: false,
          isSigner: false,
        }))
      )
      .instruction();

    // Get latest blockhash
    const { blockhash } = await connection.getLatestBlockhash();

    // Return instruction data
    return NextResponse.json({
      instruction: {
        programId: instruction.programId.toBase58(),
        data: instruction.data.toString('base64'),
        keys: instruction.keys.map((key: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }) => ({
          pubkey: key.pubkey.toBase58(),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
      },
      blockhash,
    });

  } catch (error: unknown) {
    console.error('Finalize reclaim API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to build finalize reclaim instruction' },
      { status: 500 }
    );
  }
}
