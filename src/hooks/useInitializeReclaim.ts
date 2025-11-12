/**
 * Hook for initializing vault reclaim
 * Handles the initialize_reclaim_v1 instruction
 */

import { useCallback, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { VersionedTransaction } from '@solana/web3.js';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useVaultStore } from '@/stores/useVaultStore';
import { getAssetWithProof } from '@/lib/helius';

export function useInitializeReclaim() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { fetchVaultById } = useVaultStore();

  const initializeReclaim = useCallback(
    async (vaultAddress: string, nftAssetId: string) => {
      if (!publicKey) {
        toast.error('Please connect your wallet');
        return;
      }

      setIsLoading(true);
      const loadingToast = toast.loading('Initializing reclaim...');

      try {
        // Step 1: Fetch asset with proof from Helius
        toast.loading('Fetching NFT proof...', { id: loadingToast });
        
        console.log('📡 Fetching asset with proof for:', nftAssetId);
        const assetWithProof = await getAssetWithProof(nftAssetId);
        
        if (!assetWithProof.proof || assetWithProof.proof.proof.length === 0) {
          throw new Error('Asset proof not available. Please wait a moment and try again.');
        }

        console.log('✅ Asset proof fetched:', {
          merkleTree: assetWithProof.merkleTree,
          proofLength: assetWithProof.proof.proof.length,
          leafId: assetWithProof.compression.leaf_id,
        });

        // Step 2: Build transaction via API
        toast.loading('Building transaction...', { id: loadingToast });
        
        const response = await fetch('/api/initialize-reclaim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vaultAddress,
            nftAssetId,
            root: Array.from(assetWithProof.root),
            dataHash: Array.from(assetWithProof.dataHash),
            creatorHash: Array.from(assetWithProof.creatorHash),
            nonce: assetWithProof.nonce.toString(),
            index: assetWithProof.index,
            userPublicKey: publicKey.toBase58(),
            merkleTree: assetWithProof.merkleTree,
            proofPath: assetWithProof.proof.proof,
            leafDelegate: assetWithProof.leafDelegate,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to build transaction');
        }

        const { transaction: serializedTx } = await response.json();

        // Step 3: Deserialize and send transaction
        toast.loading('Waiting for signature...', { id: loadingToast });
        
        const txBuffer = Buffer.from(serializedTx, 'base64');
        const tx = VersionedTransaction.deserialize(txBuffer);
        
        console.log('📝 Sending transaction...');
        const signature = await sendTransaction(tx, connection, {
          skipPreflight: false,
          maxRetries: 3,
        });

        console.log('📤 Transaction sent:', signature);

        // Step 4: Wait for confirmation
        toast.loading('Confirming transaction...', { id: loadingToast });
        
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');

        if (confirmation.value.err) {
          throw new Error('Transaction failed');
        }

        console.log('✅ Transaction confirmed');

        // Step 5: Parse logs to determine the event type
        const txDetails = await connection.getTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });

        let eventType: 'instant' | 'escrow' = 'escrow';
        let vaultAddressFromEvent: string | null = null;

        if (txDetails?.meta?.logMessages) {
          const logs = txDetails.meta.logMessages.join(' ');
          
          console.log('📋 Transaction logs:', logs);
          
          // Check if it was an instant reclaim (ReclaimFinalized immediately)
          if (logs.includes('ReclaimFinalized')) {
            eventType = 'instant';
            console.log('⚡ Detected instant reclaim (100% ownership)');
          } else if (logs.includes('ReclaimInitiated')) {
            eventType = 'escrow';
            console.log('🔒 Detected escrow reclaim (majority ownership)');
          }

          // Try to extract vault address from logs
          for (const log of txDetails.meta.logMessages) {
            const match = log.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
            if (match && match[0] !== nftAssetId && match[0].length >= 32) {
              vaultAddressFromEvent = match[0];
              console.log('🎯 Extracted vault address from logs:', vaultAddressFromEvent);
              break;
            }
          }
        }

        // Step 6: Show success message based on event type
        if (eventType === 'instant') {
          toast.success('🎉 NFT reclaimed successfully!', {
            id: loadingToast,
            description: 'Your cNFT has been transferred to your wallet immediately.',
            duration: 5000,
          });
        } else {
          toast.success('✅ Reclaim initiated successfully!', {
            id: loadingToast,
            description: 'Your tokens are now in escrow. You can finalize after the period ends.',
            duration: 5000,
          });
        }

        // Step 7: Fetch updated vault and redirect
        const finalVaultAddress = vaultAddressFromEvent || vaultAddress;
        
        console.log('🔄 Fetching updated vault data...');
        
        // Small delay to ensure blockchain state is updated
        setTimeout(async () => {
          await fetchVaultById(finalVaultAddress);
          
          // Redirect to explorer
          router.push('/fractionalize');
          
          // Scroll to top
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 2000);

      } catch (error) {
        const err = error as Error;
        console.error('❌ Initialize reclaim error:', err);
        toast.error('Failed to initialize reclaim', {
          id: loadingToast,
          description: err.message || 'Please try again',
          duration: 5000,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [publicKey, connection, sendTransaction, router, fetchVaultById]
  );

  return {
    initializeReclaim,
    isLoading,
  };
}
