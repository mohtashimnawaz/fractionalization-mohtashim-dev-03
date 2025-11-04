/**
 * Fractionalization hooks - Queries and mutations for fractionalization flow
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import {
  PublicKey,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  AccountMeta,
  SystemProgram,
} from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import type { FractionalizeParams } from '@/types';

const MPL_BUBBLEGUM_ID = new PublicKey('BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY');
const SPL_ACCOUNT_COMPRESSION_PROGRAM_ID = new PublicKey('cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK');
const SPL_NOOP_PROGRAM_ID = new PublicKey('noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV');
const METAPLEX_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

const fractionalizationIdl = {
  address: 'DM26SsAwF5NSGVWSebfaUBkYAG3ioLkfFnqt1Vr7pq2P',
  metadata: {
    name: 'fractionalization',
    version: '0.1.0',
    spec: '0.1.0',
  },
  instructions: [
    {
      name: 'fractionalize_v1',
      discriminator: [182, 190, 181, 8, 5, 244, 64, 234],
      accounts: [
        { name: 'fractionalizer', writable: true, signer: true },
        { name: 'vault', writable: true },
        { name: 'mint_authority' },
        { name: 'fraction_mint', writable: true },
        { name: 'metadata_account', writable: true },
        { name: 'fractionalizer_token_account', writable: true },
        { name: 'treasury' },
        { name: 'treasury_token_account', writable: true },
        { name: 'token_program' },
        { name: 'associated_token_program' },
        { name: 'system_program' },
        { name: 'bubblegum_program' },
        { name: 'compression_program' },
        { name: 'nft_asset', writable: true },
        { name: 'merkle_tree', writable: true },
        { name: 'tree_authority', writable: true },
        { name: 'leaf_delegate', optional: true },
        { name: 'log_wrapper' },
        { name: 'token_metadata_program' },
      ],
      args: [
        { name: 'total_supply', type: 'u64' },
        { name: 'min_lp_age_seconds', type: { option: 'i64' } },
        { name: 'min_reclaim_percent', type: { option: 'u8' } },
        { name: 'min_liquidity_percent', type: { option: 'u8' } },
        { name: 'min_volume_percent_30d', type: { option: 'u8' } },
        { name: 'protocol_percent_fee', type: 'u8' },
        { name: 'root', type: { array: ['u8', 32] } },
        { name: 'data_hash', type: { array: ['u8', 32] } },
        { name: 'creator_hash', type: { array: ['u8', 32] } },
        { name: 'nonce', type: 'u64' },
        { name: 'index', type: 'u32' },
        { name: 'cnft_name', type: 'string' },
        { name: 'cnft_symbol', type: 'string' },
        { name: 'cnft_uri', type: 'string' },
      ],
    },
  ],
};

interface DASAsset {
  id: string;
  content: {
    json_uri?: string;
    files?: Array<{ uri: string }>;
    metadata: {
      name: string;
      symbol: string;
      description?: string;
      attributes?: Array<{
        trait_type: string;
        value: string;
      }>;
    };
    links?: {
      image?: string;
    };
  };
  compression: {
    compressed: boolean;
    tree: string;
    leaf_id: number;
  };
  ownership: {
    owner: string;
  };
}

interface CompressedNFT {
  id: string;
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  image: string;
  attributes?: Array<{
    trait_type: string;
    value: string;
  }>;
  tree: string;
  leafId: number;
  owner: string;
}

/**
 * Fetch user's compressed NFTs with pagination
 */
const fetchUserCNFTs = async (
  walletAddress?: string,
  limit = 10,
  offset = 0
): Promise<{ cnfts: CompressedNFT[]; total: number }> => {
  if (!walletAddress) return { cnfts: [], total: 0 };

  try {
    console.log('🔍 Fetching cNFTs for wallet:', walletAddress);

    const response = await fetch('/api/helius-rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'helius-das-api',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: walletAddress,
          page: Math.floor(offset / limit) + 1,
          limit,
          displayOptions: {
            showFungible: false,
            showNativeBalance: false,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Helius API error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    const result = data.result as {
      total: number;
      items: DASAsset[];
    };

    const assets = result.items
      .filter((asset) => asset.compression?.compressed)
      .map((asset) => ({
        id: asset.id,
        mint: asset.id,
        name: asset.content?.metadata?.name || 'Unnamed cNFT',
        symbol: asset.content?.metadata?.symbol || '',
        description: asset.content?.metadata?.description,
        image:
          asset.content?.links?.image ||
          asset.content?.files?.[0]?.uri ||
          '/placeholder-nft.png',
        attributes: asset.content?.metadata?.attributes,
        tree: asset.compression.tree,
        leafId: asset.compression.leaf_id,
        owner: asset.ownership.owner,
      }));

    console.log(`✅ Found ${assets.length} compressed NFT(s)`);

    return {
      cnfts: assets,
      total: result.total,
    };
  } catch (error) {
    console.error('❌ Failed to fetch cNFTs:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to fetch compressed NFTs'
    );
  }
};

/**
 * Hook to fetch user's compressed NFTs with pagination
 */
export const useUserCNFTs = (walletAddress?: string, limit = 10, offset = 0) => {
  return useQuery({
    queryKey: ['userCNFTs', walletAddress, limit, offset],
    queryFn: () => fetchUserCNFTs(walletAddress, limit, offset),
    enabled: !!walletAddress,
    staleTime: 30000,
    retry: 2,
  });
};

/**
 * Hook to get asset with proof using Bubblegum SDK
 * Combines asset details and proof array in one call
 * 
 * Note: Currently not used - we fetch asset and proof separately via Helius API
 * Keeping for future reference
 */
export const useAssetWithProof = (assetId?: string) => {
  // Commented out to avoid type errors - not currently used
  // const umi = useUmi();

  return useQuery({
    queryKey: ['assetWithProof', assetId],
    queryFn: async () => {
      if (!assetId) return null;

      // TODO: Fix Umi DAS API type compatibility
      // For now, we use Helius API directly in useFractionalizeCNFT
      throw new Error('useAssetWithProof is not implemented - use Helius API directly');
    },
    enabled: false, // Disabled until implemented
    staleTime: 60000,
    retry: 2,
  });
};

/**
 * Hook to fractionalize a compressed NFT
 */
export function useFractionalizeCNFT() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();

  const fractionalizeMutation = useMutation<
    { signature: string; assetId: string; treasury: string },
    Error,
    FractionalizeParams
  >({
    mutationFn: async (params) => {
      console.log('🚀 Starting fractionalization...', params);

      if (!publicKey || !connection) {
        throw new Error('Wallet not connected');
      }

      if (!signTransaction) {
        throw new Error('Wallet does not support transaction signing');
      }

      const walletPublicKey = publicKey;

      const programId = process.env.NEXT_PUBLIC_FRACTIONALIZATION_PROGRAM_ID;
      if (!programId) {
        throw new Error('NEXT_PUBLIC_FRACTIONALIZATION_PROGRAM_ID not configured');
      }

      // Validate total supply (must be > 0 and reasonable)
      const totalSupplyNum = parseInt(params.totalSupply);
      if (isNaN(totalSupplyNum) || totalSupplyNum <= 0) {
        throw new Error('Total supply must be a positive number');
      }
      if (totalSupplyNum > 1_000_000_000) {
        throw new Error('Total supply cannot exceed 1 billion tokens');
      }

      try {
        // Fetch asset proof via Helius RPC proxy
        console.log('📡 Calling Helius getAssetProof...');
        const proofResponse = await fetch('/api/helius-rpc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'proof-request',
            method: 'getAssetProof',
            params: { id: params.assetId },
          }),
        });
        const proofResult = await proofResponse.json();

        if (proofResult.error) {
          throw new Error(`getAssetProof failed: ${proofResult.error.message}`);
        }

        const assetProofData = proofResult.result;
        console.log('✅ Got asset proof');

        // Fetch asset data via Helius RPC proxy
        console.log('📡 Calling Helius getAsset...');
        const assetResponse = await fetch('/api/helius-rpc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'asset-request',
            method: 'getAsset',
            params: { id: params.assetId },
          }),
        });
        const assetResult = await assetResponse.json();

        if (assetResult.error) {
          throw new Error(`getAsset failed: ${assetResult.error.message}`);
        }

        const assetData = assetResult.result;
        console.log('✅ Got asset data');

        // Extract metadata from cNFT
        const MAX_NAME_LENGTH = 32;
        const MAX_SYMBOL_LENGTH = 10;
        const MAX_URI_LENGTH = 200;

        const cNftName = (assetData.content?.metadata?.name || 'Unknown NFT').slice(
          0,
          MAX_NAME_LENGTH
        );
        const cNftSymbol = (assetData.content?.metadata?.symbol || 'NFT').slice(
          0,
          MAX_SYMBOL_LENGTH
        );
        const cNftUri = (assetData.content?.json_uri || '').slice(0, MAX_URI_LENGTH);

        if (!assetProofData.proof || assetProofData.proof.length === 0) {
          throw new Error('No merkle proof available for this cNFT');
        }

        const assetWithProof = {
          rpcAsset: assetData,
          merkleTree: assetProofData.tree_id,
          root: assetProofData.root,
          dataHash: assetData.compression.data_hash,
          creatorHash: assetData.compression.creator_hash,
          nonce: assetData.compression.leaf_id,
          index: assetData.compression.leaf_id,
          proof: assetProofData.proof,
          leafDelegate: assetData.ownership.delegate,
        };

        // Convert to web3.js PublicKeys
        const nftAssetId = new PublicKey(assetWithProof.rpcAsset.id);
        const merkleTreeId = new PublicKey(assetWithProof.merkleTree);

        // Check ownership
        const assetOwner = new PublicKey(assetWithProof.rpcAsset.ownership.owner);

        const [expectedVault] = PublicKey.findProgramAddressSync(
          [Buffer.from('vault'), nftAssetId.toBuffer()],
          new PublicKey(programId)
        );

        if (assetOwner.equals(expectedVault)) {
          throw new Error(
            'This cNFT has already been fractionalized! Please select a different cNFT.'
          );
        }

        if (!assetOwner.equals(walletPublicKey)) {
          throw new Error(
            `You don't own this cNFT. Owner: ${assetOwner.toBase58()}, Your wallet: ${walletPublicKey.toBase58()}`
          );
        }

        const leafDelegate = assetWithProof.leafDelegate
          ? new PublicKey(assetWithProof.leafDelegate)
          : walletPublicKey;

        // Derive tree authority PDA
        const [treeAuthority] = PublicKey.findProgramAddressSync(
          [merkleTreeId.toBuffer()],
          MPL_BUBBLEGUM_ID
        );

        // Generate random treasury
        const treasury = Keypair.generate();
        console.log('💰 Generated treasury:', treasury.publicKey.toBase58());

        // Prepare Anchor program
        const anchorWallet = {
          publicKey: walletPublicKey,
          signTransaction: async (tx: VersionedTransaction) => tx,
          signAllTransactions: async (txs: VersionedTransaction[]) => txs,
        };

        const provider = new anchor.AnchorProvider(
          connection,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          anchorWallet as any,
          { commitment: 'confirmed' }
        );
        const program = new anchor.Program(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fractionalizationIdl as any,
          provider
        );

        // Convert parameters
        const totalSupplyBN = new anchor.BN(params.totalSupply).mul(
          new anchor.BN(10).pow(new anchor.BN(9))
        );

        const minLpAgeSeconds = params.minLpAgeSeconds
          ? new anchor.BN(params.minLpAgeSeconds)
          : null;
        const minReclaimPercent = params.minReclaimPercent
          ? parseInt(params.minReclaimPercent)
          : null;
        const minLiquidityPercent = params.minLiquidityPercent
          ? parseInt(params.minLiquidityPercent)
          : null;
        const minVolumePercent30d = params.minVolumePercent30d
          ? parseInt(params.minVolumePercent30d)
          : null;
        const protocolPercentFee = 5;

        console.log('🔧 Building fractionalize instruction');

        // Build proof accounts
        const maxProofNodes = 6;
        const limitedProof = assetWithProof.proof.slice(
          0,
          Math.min(maxProofNodes, assetWithProof.proof.length)
        );

        const proofAccounts: AccountMeta[] = limitedProof.map((node: string) => ({
          pubkey: new PublicKey(node),
          isWritable: false,
          isSigner: false,
        }));

        // Convert hashes
        const rootArray = Array.from(new PublicKey(assetWithProof.root).toBytes());
        const dataHashArray = Array.from(new PublicKey(assetWithProof.dataHash).toBytes());
        const creatorHashArray = Array.from(
          new PublicKey(assetWithProof.creatorHash).toBytes()
        );

        // Derive PDAs
        const [vault] = PublicKey.findProgramAddressSync(
          [Buffer.from('vault'), nftAssetId.toBuffer()],
          new PublicKey(programId)
        );

        const [mintAuthority] = PublicKey.findProgramAddressSync(
          [Buffer.from('mint_authority'), vault.toBuffer()],
          new PublicKey(programId)
        );

        const [fractionMint] = PublicKey.findProgramAddressSync(
          [Buffer.from('fraction_mint'), vault.toBuffer()],
          new PublicKey(programId)
        );

        const [metadataPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('metadata'), METAPLEX_PROGRAM_ID.toBuffer(), fractionMint.toBuffer()],
          METAPLEX_PROGRAM_ID
        );

        const fractionalizerTokenAccount = getAssociatedTokenAddressSync(
          fractionMint,
          walletPublicKey,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );

        const treasuryTokenAccount = getAssociatedTokenAddressSync(
          fractionMint,
          treasury.publicKey,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );

        // Build fractionalize instruction
        // @ts-expect-error - Anchor type instantiation depth
        const fractionalizeIx = await program.methods
          .fractionalizeV1(
            totalSupplyBN,
            minLpAgeSeconds,
            minReclaimPercent,
            minLiquidityPercent,
            minVolumePercent30d,
            protocolPercentFee,
            rootArray,
            dataHashArray,
            creatorHashArray,
            new anchor.BN(assetWithProof.nonce),
            assetWithProof.index,
            cNftName,
            cNftSymbol,
            cNftUri
          )
          .accounts({
            fractionalizer: walletPublicKey,
            vault,
            mintAuthority,
            fractionMint,
            metadataAccount: metadataPda,
            fractionalizerTokenAccount,
            treasury: treasury.publicKey,
            treasuryTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            bubblegumProgram: MPL_BUBBLEGUM_ID,
            compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
            nftAsset: nftAssetId,
            merkleTree: merkleTreeId,
            treeAuthority: treeAuthority,
            leafDelegate: leafDelegate,
            logWrapper: SPL_NOOP_PROGRAM_ID,
            tokenMetadataProgram: METAPLEX_PROGRAM_ID,
          })
          .remainingAccounts(proofAccounts)
          .instruction();

        // Get recent blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

        // Add compute budget instructions (minimal to save transaction size)
        const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
          units: 400_000,
        });

        // Build versioned transaction
        const messageV0 = new TransactionMessage({
          payerKey: walletPublicKey,
          recentBlockhash: blockhash,
          instructions: [computeBudgetIx, fractionalizeIx],
        }).compileToV0Message();

        const versionedTx = new VersionedTransaction(messageV0);

        const txSize = versionedTx.serialize().length;
        console.log('📦 Transaction size:', txSize, 'bytes');

        if (txSize > 1232) {
          throw new Error(`Transaction too large: ${txSize} bytes (limit: 1232)`);
        }

        // Sign the transaction with the wallet
        console.log('✍️  Requesting wallet signature...');

        const signedTx = await signTransaction(versionedTx);

        // Send the signed transaction
        console.log('📤 Sending signed transaction...');

        let signature: string;
        try {
          signature = await connection.sendRawTransaction(signedTx.serialize(), {
            skipPreflight: false,
            maxRetries: 3,
          });
        } catch (sendError) {
          const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
          if (
            errorMessage.includes('already been processed') ||
            errorMessage.includes('This transaction has already been processed')
          ) {
            console.log('✅ Transaction was already processed successfully!');
            signature = Buffer.from(signedTx.signatures[0]).toString('base64');
            console.log('🔗 Transaction signature:', signature);

            return {
              signature,
              assetId: params.assetId,
              treasury: treasury.publicKey.toBase58(),
            };
          }
          throw sendError;
        }

        console.log('✅ Transaction sent:', signature);

        // Wait for confirmation
        try {
          await connection.confirmTransaction(
            {
              signature,
              blockhash,
              lastValidBlockHeight,
            },
            'confirmed'
          );
          console.log('✅ Fractionalization complete!');
        } catch {
          console.warn('⏰ Confirmation timeout, checking status...');
          const status = await connection.getSignatureStatus(signature);
          console.log('Transaction status:', status);

          if (status.value?.err) {
            throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
          }

          console.log('Transaction sent, may still be confirming...');
        }

        return {
          signature,
          assetId: params.assetId,
          treasury: treasury.publicKey.toBase58(),
        };
      } catch (err) {
        console.error('❌ Fractionalization error:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        throw new Error(`Fractionalization failed: ${errorMessage}`);
      }
    },
    onSuccess: (data) => {
      import('@/lib/explorer').then(({ getExplorerTxUrl, formatSignature }) => {
        const explorerUrl = getExplorerTxUrl(data.signature);
        const shortSig = formatSignature(data.signature, 8);
        
        toast.success('🎉 NFT Fractionalized Successfully!', {
          description: `Your cNFT has been fractionalized into tokens! Transaction: ${shortSig}`,
          duration: 10000,
          action: {
            label: 'View on Explorer',
            onClick: () => window.open(explorerUrl, '_blank'),
          },
        });
      });

      // Invalidate queries to refresh vault data
      queryClient.invalidateQueries({ queryKey: ['vaults'] });
      queryClient.invalidateQueries({ queryKey: ['userVaults'] });
      queryClient.invalidateQueries({ queryKey: ['userCNFTs'] });
    },
    onError: (error: Error) => {
      console.error('❌ Fractionalization failed:', error);
      toast.error('Fractionalization Failed', {
        description: error.message,
        duration: 8000,
      });
    },
  });

  const fractionalize = (params: FractionalizeParams) => {
    console.log('🔄 Calling mutate with params:', params);
    return fractionalizeMutation.mutate(params);
  };

  return {
    fractionalize,
    fractionalizeAsync: fractionalizeMutation.mutateAsync,
    isPending: fractionalizeMutation.isPending,
    isSuccess: fractionalizeMutation.isSuccess,
    isError: fractionalizeMutation.isError,
    error: fractionalizeMutation.error,
    data: fractionalizeMutation.data,
    reset: fractionalizeMutation.reset,
  };
}
