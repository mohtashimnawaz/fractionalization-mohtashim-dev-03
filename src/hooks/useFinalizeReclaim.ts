import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { 
  PublicKey, 
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction
} from '@solana/web3.js';
import { toast } from 'sonner';
import { useVaultStore } from '@/stores/useVaultStore';
import type { Vault } from '@/types/vault';

const SHARED_ALT = process.env.NEXT_PUBLIC_SHARED_ALT;

interface FinalizeReclaimParams {
  vault: Vault;
  raydiumPoolId: string;
  observationStateId: string;
}

export function useFinalizeReclaim() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const { fetchVaultById } = useVaultStore();

  const finalizeReclaim = async ({ vault, raydiumPoolId, observationStateId }: FinalizeReclaimParams) => {
    if (!publicKey) {
      toast.error('Please connect your wallet');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Fetch asset proof from Helius via secure API proxy
      const assetProofResponse = await fetch('/api/helius-rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'finalize-reclaim-proof',
          method: 'getAssetProof',
          params: { id: vault.nftAssetId },
        }),
      });

      const assetProofData = await assetProofResponse.json();
      if (assetProofData.error) {
        throw new Error(`Failed to fetch asset proof: ${assetProofData.error.message}`);
      }

      const proof = assetProofData.result.proof;
      if (!proof || proof.length === 0) {
        throw new Error('No proof nodes returned from Helius');
      }

      // 2. Load shared ALT
      if (!SHARED_ALT) {
        throw new Error('Shared ALT not configured');
      }

      const altAddress = new PublicKey(SHARED_ALT);
      const lookupTableAccount = await connection.getAddressLookupTable(altAddress);
      
      if (!lookupTableAccount.value) {
        throw new Error('Failed to load shared ALT');
      }

      const altAccount = lookupTableAccount.value;

      // 3. Fetch asset data for metadata
      const assetResponse = await fetch('/api/helius-rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'finalize-reclaim-asset',
          method: 'getAsset',
          params: { id: vault.nftAssetId },
        }),
      });

      const assetData = await assetResponse.json();
      if (assetData.error) {
        throw new Error(`Failed to fetch asset: ${assetData.error.message}`);
      }

      const asset = assetData.result;
      const root = assetProofData.result.root;
      const dataHash = asset.compression.data_hash;
      const creatorHash = asset.compression.creator_hash;
      const nonce = asset.compression.leaf_id;
      const index = asset.compression.leaf_id;
      const merkleTree = asset.compression.tree;

      // 4. Build finalize instruction via API
      const instructionResponse = await fetch('/api/finalize-reclaim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaultAddress: vault.id,
          nftAssetId: vault.nftAssetId,
          merkleTree,
          root,
          dataHash,
          creatorHash,
          nonce,
          index,
          raydiumPoolId,
          observationStateId,
          userPublicKey: publicKey.toBase58(),
        }),
      });

      if (!instructionResponse.ok) {
        const errorData = await instructionResponse.json();
        throw new Error(errorData.error || 'Failed to build finalize instruction');
      }

      const { instruction: ixData, blockhash } = await instructionResponse.json();

      // 5. Reconstruct the instruction
      const instruction = new TransactionInstruction({
        programId: new PublicKey(ixData.programId),
        keys: ixData.keys.map((key: { pubkey: string; isSigner: boolean; isWritable: boolean }) => ({
          pubkey: new PublicKey(key.pubkey),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
        data: Buffer.from(ixData.data, 'base64'),
      });

      // 6. Compile transaction with ALT
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [instruction],
      }).compileToV0Message([altAccount]);

      const versionedTx = new VersionedTransaction(messageV0);

      // 7. Send transaction
      const signature = await sendTransaction(versionedTx, connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      toast.loading('Confirming finalize reclaim transaction...', { id: signature });

      await connection.confirmTransaction(signature, 'confirmed');

      toast.success('Reclaim finalized successfully!', { id: signature });

      // 8. Refresh vault data
      await fetchVaultById(vault.id);

    } catch (error: unknown) {
      console.error('Finalize reclaim error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to finalize reclaim');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    finalizeReclaim,
    isLoading,
  };
}
