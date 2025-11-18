/**
 * Initialize Reclaim with Address Lookup Tables
 * Uses a shared ALT so users don't have to create their own
 */

import { useCallback, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { 
  PublicKey, 
  TransactionMessage, 
  VersionedTransaction,
  AddressLookupTableAccount,
  TransactionInstruction,
} from '@solana/web3.js';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useVaultStore } from '@/stores/useVaultStore';
import { getAssetWithProof } from '@/lib/helius';

// Shared ALT address - created once by admin, used by all users
const SHARED_ALT_ADDRESS = process.env.NEXT_PUBLIC_SHARED_ALT 
  ? new PublicKey(process.env.NEXT_PUBLIC_SHARED_ALT)
  : null;

export function useInitializeReclaimWithALT() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { fetchVaultById } = useVaultStore();

  const initializeReclaim = useCallback(
    async (vaultAddress: string, nftAssetId: string) => {
      if (!publicKey || !signTransaction || !sendTransaction) {
        toast.error('Please connect your wallet');
        return;
      }

      setIsLoading(true);
      const loadingToast = toast.loading('Initializing reclaim...');

      try {
        // Step 1: Fetch asset proof
        toast.loading('Fetching NFT proof...', { id: loadingToast });
        const assetWithProof = await getAssetWithProof(nftAssetId);
        
        if (!assetWithProof.proof || assetWithProof.proof.proof.length === 0) {
          throw new Error('Asset proof not available');
        }

        const proofPublicKeys = assetWithProof.proof.proof.map(p => new PublicKey(p));
        console.log('✅ Proof nodes:', proofPublicKeys.length);

        // Step 2: Get shared ALT
        toast.loading('Loading Address Lookup Table...', { id: loadingToast });
        
        if (!SHARED_ALT_ADDRESS) {
          throw new Error('Shared ALT not configured. Please set NEXT_PUBLIC_SHARED_ALT in .env.local');
        }

        let altAccount: AddressLookupTableAccount | null = null;
        
        try {
          const lookupTable = await connection.getAddressLookupTable(SHARED_ALT_ADDRESS);
          altAccount = lookupTable.value;
          
          if (!altAccount) {
            throw new Error('Shared ALT not found on-chain');
          }
          
          console.log('✅ Using shared ALT:', SHARED_ALT_ADDRESS.toBase58());
          console.log('   ALT has', altAccount.state.addresses.length, 'addresses');
        } catch (error) {
          console.error('❌ Failed to load shared ALT:', error);
          throw new Error('Failed to load Address Lookup Table. Please contact support.');
        }

        // Step 3: Build instruction
        toast.loading('Building transaction...', { id: loadingToast });
        
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
        const ix = new TransactionInstruction({
          keys: instructions[0].keys.map((key: { pubkey: string; isSigner: boolean; isWritable: boolean }) => ({
            pubkey: new PublicKey(key.pubkey),
            isSigner: key.isSigner,
            isWritable: key.isWritable,
          })),
          programId: new PublicKey(instructions[0].programId),
          data: Buffer.from(instructions[0].data, 'base64'),
        });

        // Step 4: Build transaction with ALT
        toast.loading('Creating transaction with ALT...', { id: loadingToast });
        
        const { blockhash } = await connection.getLatestBlockhash();
        const message = new TransactionMessage({
          payerKey: publicKey,
          recentBlockhash: blockhash,
          instructions: [ix],
        }).compileToV0Message([altAccount]); // Use ALT!

        const tx = new VersionedTransaction(message);
        
        console.log('✅ Transaction built with ALT, signing...');
        
        // Step 5: Send transaction
        toast.loading('Sending transaction...', { id: loadingToast });
        const signature = await sendTransaction(tx, connection);
        
        console.log('📤 Transaction sent:', signature);
        
        // Step 6: Confirm
        toast.loading('Confirming transaction...', { id: loadingToast });
        await connection.confirmTransaction(signature, 'confirmed');
        
        toast.success('Reclaim initialized successfully!', { id: loadingToast });
        
        await fetchVaultById(vaultAddress);
        router.push(`/vault/${vaultAddress}`);
        
      } catch (error: unknown) {
        console.error('❌ Initialize reclaim error:', error);
        
        let errorMessage = 'Failed to initialize reclaim';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        
        toast.error(errorMessage, { id: loadingToast });
      } finally {
        setIsLoading(false);
      }
    },
    [connection, publicKey, signTransaction, sendTransaction, router, fetchVaultById]
  );

  return {
    initializeReclaim,
    isLoading,
  };
}
