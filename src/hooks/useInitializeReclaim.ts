/**
 * Hook for initializing vault reclaim
 * Handles the initialize_reclaim_v1 instruction
 */

import { useCallback, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { 
  TransactionInstruction, 
  PublicKey, 
  TransactionMessage, 
  VersionedTransaction,
  MessageV0,
  AddressLookupTableProgram
} from '@solana/web3.js';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useVaultStore } from '@/stores/useVaultStore';
import { getAssetWithProof } from '@/lib/helius';
import {
  getOrCreateReclaimALT,
  storeALTAddress,
  checkProofAddressesInALT,
  getAddressLookupTableAccount,
  createALTInstruction,
  extendALTInstruction
} from '@/lib/alt-manager';

export function useInitializeReclaim() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
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

        // Step 2: Setup Address Lookup Table for proof accounts
        toast.loading('Setting up Address Lookup Table...', { id: loadingToast });
        
        const proofPublicKeys = assetWithProof.proof.proof.map(p => new PublicKey(p));
        const { altAddress, needsCreation } = await getOrCreateReclaimALT(connection, publicKey);

        // Check if we need to add proof addresses to the ALT
        const { allPresent, missingAddresses } = await checkProofAddressesInALT(
          connection,
          altAddress,
          proofPublicKeys
        );

        // If ALT needs creation or updating, do it in separate transactions
        if (needsCreation || !allPresent) {
          toast.loading('Preparing Address Lookup Table...', { id: loadingToast });
          console.log(`📋 ALT needs ${needsCreation ? 'creation' : 'updating'}`);
          
          if (!signTransaction) {
            throw new Error('Wallet does not support transaction signing');
          }
          
          // Step 1: Create ALT if needed
          if (needsCreation) {
            const slot = await connection.getSlot();
            // Use a slot in the near future to ensure activation
            const [createIx] = createALTInstruction(publicKey, slot);

            const { blockhash: createBlockhash } = await connection.getLatestBlockhash();
            const createMessage = new TransactionMessage({
              payerKey: publicKey,
              recentBlockhash: createBlockhash,
              instructions: [createIx],
            }).compileToLegacyMessage();

            const createTx = new VersionedTransaction(createMessage);
            const signedCreateTx = await signTransaction(createTx);
            const createSig = await connection.sendRawTransaction(signedCreateTx.serialize());
            
            console.log('📤 ALT create transaction sent:', createSig);
            
            toast.loading('Confirming ALT creation...', { id: loadingToast });
            await connection.confirmTransaction(createSig, 'confirmed');
            
            // Wait for the ALT to be fully activated and indexed by RPC
            // Need to wait for the slot to advance past the creation slot
            console.log('⏳ Waiting for ALT activation (slot advancement)...');
            let currentSlot = await connection.getSlot();
            while (currentSlot <= slot) {
              await new Promise(resolve => setTimeout(resolve, 400)); // Wait 400ms per slot
              currentSlot = await connection.getSlot();
              console.log(`Current slot: ${currentSlot}, creation slot: ${slot}`);
            }
            
            // Now wait for the account to be indexed by the RPC
            console.log('⏳ Waiting for ALT to be indexed by RPC...');
            let retries = 0;
            const maxRetries = 10;
            while (retries < maxRetries) {
              const altAccountInfo = await connection.getAccountInfo(altAddress);
              if (altAccountInfo) {
                console.log('✅ ALT account indexed, owner:', altAccountInfo.owner.toBase58());
                break;
              }
              retries++;
              console.log(`Retry ${retries}/${maxRetries}...`);
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between retries
            }
            
            if (retries >= maxRetries) {
              throw new Error('ALT creation timed out. Please try again.');
            }
            
            storeALTAddress(altAddress);
            console.log('✅ ALT created and activated at slot', currentSlot);
          }
          
          // Step 2: Extend ALT with proof addresses if needed
          if (missingAddresses.length > 0) {
            toast.loading(`Adding ${missingAddresses.length} addresses to ALT...`, { id: loadingToast });
            
            // Verify the ALT exists on-chain before extending
            console.log('🔍 Verifying ALT exists before extension...');
            const altAccountInfo = await connection.getAccountInfo(altAddress);
            if (!altAccountInfo) {
              console.error('❌ ALT account does not exist on-chain, clearing storage and recreating...');
              localStorage.removeItem('reclaim_alt_address');
              toast.error('Address Lookup Table is invalid. Please try Initialize Reclaim again.', { id: loadingToast });
              return;
            }
            console.log('✅ ALT account exists, owner:', altAccountInfo.owner.toBase58());
            
            // Add addresses in batches of 30 (max per instruction)
            for (let i = 0; i < missingAddresses.length; i += 30) {
              const batch = missingAddresses.slice(i, i + 30);
              const extendIx = extendALTInstruction(altAddress, publicKey, publicKey, batch);

              const { blockhash: extendBlockhash } = await connection.getLatestBlockhash();
              const extendMessage = new TransactionMessage({
                payerKey: publicKey,
                recentBlockhash: extendBlockhash,
                instructions: [extendIx],
              }).compileToLegacyMessage();

              const extendTx = new VersionedTransaction(extendMessage);
              const signedExtendTx = await signTransaction(extendTx);
              const extendSig = await connection.sendRawTransaction(signedExtendTx.serialize());
              
              console.log(`📤 ALT extend transaction ${i / 30 + 1} sent:`, extendSig);
              
              await connection.confirmTransaction(extendSig, 'confirmed');
            }
            
            console.log('✅ ALT extended with all addresses');
          }
        }

        // Step 3: Build main transaction via API
        toast.loading('Building reclaim transaction...', { id: loadingToast });
        
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

        const { instructions: instructionsData, blockhash, feePayer } = await response.json();

        // Step 3: Build transaction client-side from instruction data
        toast.loading('Building transaction...', { id: loadingToast });
        
        // Convert all instructions from JSON to TransactionInstruction objects
        const instructions = instructionsData.map((ixData: { 
          programId: string; 
          data: string; 
          keys: { pubkey: string; isSigner: boolean; isWritable: boolean }[] 
        }) => new TransactionInstruction({
          programId: new PublicKey(ixData.programId),
          data: Buffer.from(ixData.data, 'base64'),
          keys: ixData.keys.map(k => ({
            pubkey: new PublicKey(k.pubkey),
            isSigner: k.isSigner,
            isWritable: k.isWritable,
          })),
        }));

        console.log(`📦 Building transaction with ${instructions.length} instructions`);

        // Count total unique accounts
        const allAccounts = new Set<string>();
        instructions.forEach((ix: TransactionInstruction) => {
          ix.keys.forEach((k: { pubkey: PublicKey }) => allAccounts.add(k.pubkey.toString()));
        });
        console.log(`📊 Total unique accounts before ALT: ${allAccounts.size}`);

        // Fetch the ALT account to use in the transaction
        toast.loading('Fetching Address Lookup Table...', { id: loadingToast });
        const altAccount = await getAddressLookupTableAccount(connection, altAddress);
        
        if (!altAccount) {
          throw new Error('Failed to fetch Address Lookup Table. Please try again.');
        }

        console.log(`📋 ALT contains ${altAccount.state.addresses.length} addresses`);

        // Build VersionedTransaction with ALT
        let versionedTransaction;
        
        try {
          const messageV0 = new TransactionMessage({
            payerKey: new PublicKey(feePayer),
            recentBlockhash: blockhash,
            instructions,
          }).compileToV0Message([altAccount]); // Pass ALT here!

          versionedTransaction = new VersionedTransaction(messageV0);
          
          const txSize = versionedTransaction.serialize().length;
          console.log(`📏 Transaction size with ALT: ${txSize} bytes`);
          
          if (txSize > 1232) {
            console.warn(`⚠️ Transaction still large: ${txSize} bytes`);
          }
        } catch (compileError) {
          console.error('❌ Transaction compilation error:', compileError);
          throw new Error(
            'Failed to build transaction with Address Lookup Table. Please try again.'
          );
        }
        
        console.log('📝 Signing transaction...');
        if (!signTransaction) {
          throw new Error('Wallet does not support transaction signing');
        }
        
        const signedTx = await signTransaction(versionedTransaction);
        
        console.log('📤 Sending signed transaction...');
        const signature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: true,  // Skip preflight to avoid any simulation overhead
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
    [publicKey, connection, signTransaction, router, fetchVaultById]
  );

  return {
    initializeReclaim,
    isLoading,
  };
}
