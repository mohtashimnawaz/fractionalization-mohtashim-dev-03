/**
 * Simplified hook for initializing vault reclaim
 * Attempts to build transaction WITHOUT Address Lookup Tables
 */

import { useCallback, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { 
  TransactionInstruction, 
  PublicKey, 
  TransactionMessage, 
  VersionedTransaction,
} from '@solana/web3.js';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useVaultStore } from '@/stores/useVaultStore';
import { getAssetWithProof } from '@/lib/helius';

export function useInitializeReclaimSimple() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { fetchVaultById } = useVaultStore();

  const initializeReclaim = useCallback(
    async (vaultAddress: string, nftAssetId: string) => {
      if (!publicKey || !signTransaction) {
        toast.error('Please connect your wallet');
        return;
      }

      setIsLoading(true);
      const loadingToast = toast.loading('Initializing reclaim...');

      try {
        // Step 1: Fetch asset with proof
        toast.loading('Fetching NFT proof...', { id: loadingToast });
        console.log('📡 Fetching asset with proof for:', nftAssetId);
        
        const assetWithProof = await getAssetWithProof(nftAssetId);
        
        if (!assetWithProof.proof || assetWithProof.proof.proof.length === 0) {
          throw new Error('Asset proof not available');
        }

        console.log('✅ Asset proof fetched:', {
          merkleTree: assetWithProof.compression.tree,
          proofLength: assetWithProof.proof.proof.length,
          leafId: assetWithProof.compression.leaf_id,
        });

        // Step 2: Build instruction on server
        toast.loading('Building transaction...', { id: loadingToast });
        
        // Ensure all hash fields are arrays
        const rootArray = Array.isArray(assetWithProof.proof.root) 
          ? assetWithProof.proof.root 
          : Array.from(assetWithProof.proof.root);
        const dataHashArray = Array.isArray(assetWithProof.compression.data_hash)
          ? assetWithProof.compression.data_hash
          : Array.from(assetWithProof.compression.data_hash);
        const creatorHashArray = Array.isArray(assetWithProof.compression.creator_hash)
          ? assetWithProof.compression.creator_hash
          : Array.from(assetWithProof.compression.creator_hash);
        
        const response = await fetch('/api/initialize-reclaim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vaultAddress,
            nftAssetId,
            userPublicKey: publicKey.toBase58(),
            merkleTree: assetWithProof.compression.tree,
            root: rootArray,
            dataHash: dataHashArray,
            creatorHash: creatorHashArray,
            nonce: Number(assetWithProof.compression.leaf_id),
            index: Number(assetWithProof.compression.leaf_id),
            proofPath: assetWithProof.proof.proof,
            leafDelegate: assetWithProof.leafDelegate || publicKey.toBase58(),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to build instruction');
        }

        const { instructions } = await response.json();

        // Step 3: Rebuild instruction client-side
        const ix = new TransactionInstruction({
          keys: instructions[0].keys.map((key: { pubkey: string; isSigner: boolean; isWritable: boolean }) => ({
            pubkey: new PublicKey(key.pubkey),
            isSigner: key.isSigner,
            isWritable: key.isWritable,
          })),
          programId: new PublicKey(instructions[0].programId),
          data: Buffer.from(instructions[0].data, 'base64'),
        });

        // Step 4: Build VersionedTransaction WITHOUT ALT (exactly like the test)
        toast.loading('Creating transaction...', { id: loadingToast });
        
        const { blockhash } = await connection.getLatestBlockhash();
        const message = new TransactionMessage({
          payerKey: publicKey,
          recentBlockhash: blockhash,
          instructions: [ix], // ONLY the main instruction, no compute budget
        }).compileToV0Message(); // No ALT array parameter

        const tx = new VersionedTransaction(message);
        
        console.log('✅ Transaction built (35 accounts), signing...');
        
        // Step 5: Sign transaction
        const signedTx = await signTransaction(tx);
        
        // Step 6: Send transaction
        toast.loading('Sending transaction...', { id: loadingToast });
        const signature = await connection.sendRawTransaction(signedTx.serialize());
        
        console.log('📤 Transaction sent:', signature);
        
        // Step 7: Confirm transaction
        toast.loading('Confirming transaction...', { id: loadingToast });
        await connection.confirmTransaction(signature, 'confirmed');
        
        toast.success('Reclaim initialized successfully!', { id: loadingToast });
        
        // Refresh vault data
        await fetchVaultById(vaultAddress);
        router.push(`/vault/${vaultAddress}`);
        
      } catch (error: unknown) {
        console.error('❌ Initialize reclaim error:', error);
        
        let errorMessage = 'Failed to initialize reclaim';
        if (error instanceof Error) {
          if (error.message.includes('encoding overruns')) {
            errorMessage = 'Transaction too large. This is a known limitation with compressed NFTs.';
          } else {
            errorMessage = error.message;
          }
        }
        
        toast.error(errorMessage, { id: loadingToast });
      } finally {
        setIsLoading(false);
      }
    },
    [connection, publicKey, signTransaction, router, fetchVaultById]
  );

  return {
    initializeReclaim,
    isLoading,
  };
}
