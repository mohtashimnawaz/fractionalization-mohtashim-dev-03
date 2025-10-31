/**
 * Hook to fractionalize a compressed NFT
 * 
 * Calls the fractionalizeV1 instruction from the fractionalization program
 * Separate from cNFT minting logic
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
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
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import type { FractionalizeParams } from '@/types';

// Import IDL directly - Next.js compatible
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

const MPL_BUBBLEGUM_ID = new PublicKey('BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY');
const SPL_ACCOUNT_COMPRESSION_PROGRAM_ID = new PublicKey('cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK');
const SPL_NOOP_PROGRAM_ID = new PublicKey('noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV');
const METAPLEX_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

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
      console.log('🚀 mutationFn called with:', params, 'type:', typeof params);
      
      if (!publicKey || !connection) {
        throw new Error('Wallet not connected');
      }

      const walletPublicKey = publicKey;

      const programId = process.env.NEXT_PUBLIC_FRACTIONALIZATION_PROGRAM_ID;
      if (!programId) {
        throw new Error('NEXT_PUBLIC_FRACTIONALIZATION_PROGRAM_ID not configured');
      }

      const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
      if (!heliusApiKey) {
        throw new Error('NEXT_PUBLIC_HELIUS_API_KEY not configured');
      }

      console.log('🎯 Starting fractionalization...', params);

      // Fetch asset and proof data using direct Helius RPC calls
      console.log('📡 Fetching asset with proof via Helius...', { assetId: params.assetId });
      
      try {
        const heliusRpcUrl = `https://devnet.helius-rpc.com/?api-key=${heliusApiKey}`;
        
        // Fetch asset proof via Helius RPC
        console.log('📡 Calling Helius getAssetProof...');
        const proofResponse = await fetch(heliusRpcUrl, {
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
        console.log('✅ Got asset proof:', assetProofData);
        
        // Fetch asset data via Helius RPC
        console.log('📡 Calling Helius getAsset...');
        const assetResponse = await fetch(heliusRpcUrl, {
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
        console.log('✅ Got asset data:', assetData);
        
        // Extract metadata from cNFT
        // Truncate strings if too long to fit in transaction size limit
        const MAX_NAME_LENGTH = 32;
        const MAX_SYMBOL_LENGTH = 10;
        const MAX_URI_LENGTH = 200;
        
        const cNftName = (assetData.content?.metadata?.name || 'Unknown NFT').slice(0, MAX_NAME_LENGTH);
        const cNftSymbol = (assetData.content?.metadata?.symbol || 'NFT').slice(0, MAX_SYMBOL_LENGTH);
        const cNftUri = (assetData.content?.json_uri || '').slice(0, MAX_URI_LENGTH);
        
        console.log('📝 Extracted metadata:', {
          name: cNftName,
          symbol: cNftSymbol,
          uri: cNftUri,
          uriLength: cNftUri.length,
        });
        
        if (!assetProofData.proof || assetProofData.proof.length === 0) {
          throw new Error('No merkle proof available for this cNFT');
        }

        console.log('✅ Asset with proof fetched:', {
          assetId: assetData.id,
          merkleTree: assetProofData.tree_id,
          proofLength: assetProofData.proof.length,
          leafId: assetData.compression.leaf_id,
          dataHash: assetData.compression.data_hash,
          creatorHash: assetData.compression.creator_hash,
          root: assetProofData.root,
          nodeIndex: assetProofData.node_index,
          nodeIndexType: typeof assetProofData.node_index,
        });

        // For compressed NFTs, the index should be the leaf_id, not node_index
        // node_index is used for tree navigation, but the instruction expects the leaf index
        const assetWithProof = {
          rpcAsset: assetData,
          merkleTree: assetProofData.tree_id,
          root: assetProofData.root,
          dataHash: assetData.compression.data_hash,
          creatorHash: assetData.compression.creator_hash,
          nonce: assetData.compression.leaf_id,
          index: assetData.compression.leaf_id, // Use leaf_id as the index
          proof: assetProofData.proof,
          leafDelegate: assetData.ownership.delegate,
        };

        // Convert to web3.js PublicKeys
        const nftAssetId = new PublicKey(assetWithProof.rpcAsset.id);
        const merkleTreeId = new PublicKey(assetWithProof.merkleTree);
        
        // Check ownership - the current wallet must be the owner to fractionalize
        const assetOwner = new PublicKey(assetWithProof.rpcAsset.ownership.owner);
        
        // Derive the vault PDA to check if this cNFT is already fractionalized
        const [expectedVault] = PublicKey.findProgramAddressSync(
          [Buffer.from('vault'), nftAssetId.toBuffer()],
          new PublicKey(programId)
        );
        
        // If the owner is the vault, this cNFT has already been fractionalized
        if (assetOwner.equals(expectedVault)) {
          throw new Error(
            `This cNFT has already been fractionalized! The vault owns it now (${assetOwner.toBase58()}). Please select a different cNFT that hasn't been fractionalized yet.`
          );
        }
        
        // Check if the current wallet owns the cNFT
        if (!assetOwner.equals(walletPublicKey)) {
          throw new Error(
            `You don't own this cNFT. Owner: ${assetOwner.toBase58()}, Your wallet: ${walletPublicKey.toBase58()}. Please switch to the owner wallet or transfer the cNFT first.`
          );
        }
        
        // If no delegate is set, use the owner (wallet) as the delegate
        // The program expects the delegate to match the owner for transfer authority
        const leafDelegate = assetWithProof.leafDelegate
          ? new PublicKey(assetWithProof.leafDelegate) 
          : walletPublicKey;
        
        console.log('👤 Leaf delegate:', leafDelegate.toBase58(), '(owner:', walletPublicKey.toBase58(), ')');

        // Derive tree authority PDA
        const [treeAuthority] = PublicKey.findProgramAddressSync(
          [merkleTreeId.toBuffer()],
          MPL_BUBBLEGUM_ID
        );

        // Generate random treasury for testing
        const treasury = Keypair.generate();
        console.log('💰 Generated treasury:', treasury.publicKey.toBase58());

        // Prepare Anchor program
        // We create a dummy wallet for Anchor since we're not using it for signing
        // The actual signing happens through the gill client
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
        // Multiply by 10^9 to account for token decimals (assuming 9 decimals)
        const totalSupplyBN = new anchor.BN(params.totalSupply).mul(new anchor.BN(10).pow(new anchor.BN(9)));
        
        // Optional parameters - null if not provided
        const minLpAgeSeconds = params.minLpAgeSeconds ? new anchor.BN(params.minLpAgeSeconds) : null;
        const minReclaimPercent = params.minReclaimPercent ? parseInt(params.minReclaimPercent) : null;
        const minLiquidityPercent = params.minLiquidityPercent ? parseInt(params.minLiquidityPercent) : null;
        const minVolumePercent30d = params.minVolumePercent30d ? parseInt(params.minVolumePercent30d) : null;
        const protocolPercentFee = 5; // u8, not BN

        console.log('🔧 Building fractionalize instruction with params:', {
          totalSupply: totalSupplyBN.toString(),
          totalSupplyRaw: params.totalSupply,
          minLpAgeSeconds: minLpAgeSeconds?.toString() || 'null',
          minReclaimPercent: minReclaimPercent !== null ? minReclaimPercent : 'null',
          minLiquidityPercent: minLiquidityPercent !== null ? minLiquidityPercent : 'null',
          minVolumePercent30d: minVolumePercent30d !== null ? minVolumePercent30d : 'null',
          protocolPercentFee,
        });

        // Build proof accounts
        console.log('📋 Proof data type:', typeof assetWithProof.proof, 'isArray:', Array.isArray(assetWithProof.proof));
        
        if (!Array.isArray(assetWithProof.proof)) {
          throw new Error(`Invalid proof format: expected array, got ${typeof assetWithProof.proof}`);
        }
        
        console.log('🌳 Full proof length:', assetWithProof.proof.length);
        
        // Limit proof accounts to reduce transaction size
        // The canopy depth typically allows us to use fewer proof nodes
        // With the new metadata account and string args, we need even fewer proof nodes
        // For a tree with maxDepth 14 and canopy 8: need 14-8 = 6 proof nodes minimum
        // Strings are truncated above to fit within transaction size limit
        const maxProofNodes = 6; // Minimum needed for canopy depth 8
        const limitedProof = assetWithProof.proof.slice(0, Math.min(maxProofNodes, assetWithProof.proof.length));
        
        console.log('🌳 Using proof length:', limitedProof.length, '(limited from', assetWithProof.proof.length, ')');
        
        const proofAccounts: AccountMeta[] = limitedProof.map((node: string) => ({
          pubkey: new PublicKey(node),
          isWritable: false,
          isSigner: false,
        }));

        console.log('🔧 Converting proof data...');
        let rootArray, dataHashArray, creatorHashArray;
        
        console.log('Converting root: string value:', assetWithProof.root);
        console.log('Converting dataHash: string value:', assetWithProof.dataHash);
        console.log('Converting creatorHash: string value:', assetWithProof.creatorHash);
        
        // The hash values are base58 encoded, not hex
        // Use PublicKey to decode base58 to bytes
        try {
          rootArray = Array.from(new PublicKey(assetWithProof.root).toBytes());
          dataHashArray = Array.from(new PublicKey(assetWithProof.dataHash).toBytes());
          creatorHashArray = Array.from(new PublicKey(assetWithProof.creatorHash).toBytes());
          
          console.log('✅ Arrays converted:', {
            rootLength: rootArray.length,
            dataHashLength: dataHashArray.length,
            creatorHashLength: creatorHashArray.length,
          });
        } catch (err) {
          console.error('❌ Base58 decode error:', err);
          throw new Error(`Failed to decode base58 hashes: ${err instanceof Error ? err.message : String(err)}`);
        }
        
        // Ensure arrays are exactly 32 bytes
        if (rootArray.length !== 32 || dataHashArray.length !== 32 || creatorHashArray.length !== 32) {
          throw new Error(`Invalid hash lengths: root=${rootArray.length}, dataHash=${dataHashArray.length}, creatorHash=${creatorHashArray.length}. Expected 32 bytes each.`);
        }

        // Derive vault PDA
        const [vault] = PublicKey.findProgramAddressSync(
          [Buffer.from('vault'), nftAssetId.toBuffer()],
          new PublicKey(programId)
        );
        console.log('🏛️  Derived vault PDA:', vault.toBase58());

        // Derive mint authority PDA
        const [mintAuthority] = PublicKey.findProgramAddressSync(
          [Buffer.from('mint_authority'), vault.toBuffer()],
          new PublicKey(programId)
        );
        console.log('🔑 Derived mint authority PDA:', mintAuthority.toBase58());

        // Derive fraction mint PDA
        const [fractionMint] = PublicKey.findProgramAddressSync(
          [Buffer.from('fraction_mint'), vault.toBuffer()],
          new PublicKey(programId)
        );
        console.log('💰 Derived fraction mint PDA:', fractionMint.toBase58());

        // Derive metadata PDA for fractional tokens
        const [metadataPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('metadata'),
            METAPLEX_PROGRAM_ID.toBuffer(),
            fractionMint.toBuffer(),
          ],
          METAPLEX_PROGRAM_ID
        );
        console.log('📝 Derived metadata PDA:', metadataPda.toBase58());

        // Derive token accounts
        const fractionalizerTokenAccount = getAssociatedTokenAddressSync(
          fractionMint,
          walletPublicKey,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        console.log('👛 Fractionalizer token account:', fractionalizerTokenAccount.toBase58());

        const treasuryTokenAccount = getAssociatedTokenAddressSync(
          fractionMint,
          treasury.publicKey,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        console.log('🏦 Treasury token account:', treasuryTokenAccount.toBase58());

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

        // Add compute budget instructions - fractionalization with metadata requires more compute
        console.log('📦 Building transaction with compute budget instructions...');
        
        const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
          units: 400_000, // Increased for metadata creation
        });
        
        const computePriceIx = ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 1,
        });

        // Build versioned transaction
        const messageV0 = new TransactionMessage({
          payerKey: walletPublicKey,
          recentBlockhash: blockhash,
          instructions: [computeBudgetIx, computePriceIx, fractionalizeIx],
        }).compileToV0Message();

        const versionedTx = new VersionedTransaction(messageV0);
        
        const txSize = versionedTx.serialize().length;
        console.log('📦 Transaction size:', txSize, 'bytes (limit: 1232)');
        console.log('📊 Instruction count:', versionedTx.message.compiledInstructions.length);
        console.log('🔢 Account keys count:', versionedTx.message.staticAccountKeys.length);
        
        if (txSize > 1232) {
          throw new Error(`Transaction too large: ${txSize} bytes (limit: 1232). Consider using fewer proof accounts or address lookup tables.`);
        }

        // Sign the transaction with the wallet
        console.log('✍️  Requesting wallet signature...');
        
        if (!signTransaction) {
          throw new Error('Wallet does not support transaction signing');
        }
        
        // Only the wallet needs to sign (fractionalizer is the only signer)
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
          // Check if the error is "already processed" - this means the transaction succeeded
          const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
          if (errorMessage.includes('already been processed') || errorMessage.includes('This transaction has already been processed')) {
            console.log('✅ Transaction was already processed successfully!');
            // Extract signature from the transaction
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
        console.log('🔗 View on Explorer:', `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        console.log('⏳ Waiting for confirmation...');
        
        // Wait for confirmation with timeout handling
        try {
          await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight,
          }, 'confirmed');
          console.log('✅ Fractionalization complete!');
        } catch (confirmError) {
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
      toast.success('🎉 NFT Fractionalized!', {
        description: `Transaction: ${data.signature.slice(0, 8)}...`,
      });

      // Invalidate queries to refresh vault data
      queryClient.invalidateQueries({ queryKey: ['vaults'] });
      queryClient.invalidateQueries({ queryKey: ['userVaults'] });
    },
    onError: (error: Error) => {
      console.error('❌ Fractionalization failed:', error);
      toast.error('Fractionalization Failed', {
        description: error.message,
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
