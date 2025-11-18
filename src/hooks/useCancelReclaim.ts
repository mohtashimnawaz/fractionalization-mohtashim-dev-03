/**
 * Hook for cancelling an initiated reclaim
 * Allows the initiator to get their escrowed tokens back and abort the reclaim process
 */

import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import { toast } from 'sonner';
import { useVaultStore } from '@/stores/useVaultStore';
import { VaultStatus, type Vault } from '@/types/vault';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

const CANCEL_FEE_USDC = 100; // 100 USDC

interface CancelReclaimParams {
  vault: Vault;
}

export function useCancelReclaim() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const { fetchVaultById } = useVaultStore();

  const cancelReclaim = async ({ vault }: CancelReclaimParams) => {
    if (!publicKey) {
      toast.error('Please connect your wallet');
      return;
    }

    // Verify caller is the initiator
    if (vault.reclaimInitiator !== publicKey.toBase58()) {
      toast.error('Only the reclaim initiator can cancel');
      return;
    }

    // Verify vault is in ReclaimInitiated status
    if (vault.status !== VaultStatus.ReclaimInitiated) {
      toast.error('Vault is not in reclaim initiated status');
      return;
    }

    setIsLoading(true);

    try {
      const USDC_MINT_DEVNET = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');
      
      // Derive user's USDC account
      const userUsdcAccount = getAssociatedTokenAddressSync(
        USDC_MINT_DEVNET,
        publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Check if user has enough USDC for cancellation fee
      try {
        const usdcBalance = await connection.getTokenAccountBalance(userUsdcAccount);
        const usdcAmount = parseFloat(usdcBalance.value.amount) / 1_000_000; // Convert from micro USDC
        
        if (usdcAmount < CANCEL_FEE_USDC) {
          toast.error(`Insufficient USDC balance. Need ${CANCEL_FEE_USDC} USDC, have ${usdcAmount.toFixed(2)} USDC`);
          setIsLoading(false);
          return;
        }
      } catch {
        toast.error('USDC account not found. Please ensure you have USDC in your wallet.');
        setIsLoading(false);
        return;
      }

      toast.info('Building cancel reclaim transaction...');

      // Build the transaction via API
      const response = await fetch('/api/cancel-reclaim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaultAddress: vault.id,
          nftAssetId: vault.nftAssetId,
          userPublicKey: publicKey.toBase58(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to build transaction');
      }

      const data = await response.json();
      const { transaction: serializedTx, blockhash, lastValidBlockHeight } = data;

      // Deserialize and sign transaction
      const txBuffer = Buffer.from(serializedTx, 'base64');
      const transaction = VersionedTransaction.deserialize(txBuffer);

      toast.info('Please confirm the transaction in your wallet...');

      // Send transaction
      const signature = await sendTransaction(transaction, connection);
      
      toast.loading('Cancelling reclaim...', { id: 'cancel-reclaim' });

      // Confirm transaction
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });

      const tokensReturned = (vault.tokensInEscrow / 1e9).toFixed(2);
      toast.success(
        `Reclaim cancelled! ${tokensReturned} tokens returned. ${CANCEL_FEE_USDC} USDC fee paid.`,
        { id: 'cancel-reclaim' }
      );

      // Refresh vault data
      await fetchVaultById(vault.id);

      return signature;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      console.error('Cancel reclaim error:', error);
      
      // Parse Anchor errors
      if (errorMessage.includes('VaultNotInReclaimInitiated')) {
        toast.error('Vault is not in reclaim initiated status', { id: 'cancel-reclaim' });
      } else if (errorMessage.includes('UnauthorizedCancellation')) {
        toast.error('Only the reclaim initiator can cancel', { id: 'cancel-reclaim' });
      } else if (errorMessage.includes('InsufficientUsdcForCancellationFee')) {
        toast.error(`Insufficient USDC balance. Need ${CANCEL_FEE_USDC} USDC for cancellation fee`, { id: 'cancel-reclaim' });
      } else if (errorMessage.includes('User rejected')) {
        toast.error('Transaction cancelled', { id: 'cancel-reclaim' });
      } else {
        toast.error(`Failed to cancel reclaim: ${errorMessage || 'Unknown error'}`, { id: 'cancel-reclaim' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    cancelReclaim,
    isLoading,
  };
}
