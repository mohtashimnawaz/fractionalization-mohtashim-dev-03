/**
 * Hook for redeeming fractional tokens
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface RedeemParams {
  vaultId: string;
  amount: number;
}

interface ReclaimParams {
  vaultId: string;
}

/**
 * Redeem fractional tokens for the underlying NFT
 * TODO: Replace with actual on-chain transaction when program is deployed
 */
const redeemTokens = async (_params: RedeemParams): Promise<string> => {
  // Throw error to prevent accidental use before implementation
  throw new Error('Redeem functionality not yet implemented. Deploy Anchor program first.');
};

/**
 * Reclaim NFT from vault (for vault authority)
 * TODO: Replace with actual on-chain transaction when program is deployed
 */
const reclaimNFT = async (_params: ReclaimParams): Promise<string> => {
  // Throw error to prevent accidental use before implementation
  throw new Error('Reclaim functionality not yet implemented. Deploy Anchor program first.');
};

/**
 * Hook to redeem fractional tokens
 */
export const useRedeem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: redeemTokens,
    onSuccess: (signature) => {
      import('@/lib/explorer').then(({ getExplorerTxUrl, formatSignature }) => {
        const explorerUrl = getExplorerTxUrl(signature);
        const shortSig = formatSignature(signature, 8);
        
        toast.success('Tokens redeemed successfully!', {
          description: `Transaction: ${shortSig}`,
          action: {
            label: 'View on Explorer',
            onClick: () => window.open(explorerUrl, '_blank'),
          },
        });
      });
      
      queryClient.invalidateQueries({ queryKey: ['vaults'] });
      queryClient.invalidateQueries({ queryKey: ['userBalance'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to redeem tokens', {
        description: error.message,
      });
    },
  });
};

/**
 * Hook to reclaim NFT from vault
 */
export const useReclaim = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reclaimNFT,
    onSuccess: (signature) => {
      import('@/lib/explorer').then(({ getExplorerTxUrl, formatSignature }) => {
        const explorerUrl = getExplorerTxUrl(signature);
        const shortSig = formatSignature(signature, 8);
        
        toast.success('NFT reclaimed successfully!', {
          description: `Transaction: ${shortSig}`,
          action: {
            label: 'View on Explorer',
            onClick: () => window.open(explorerUrl, '_blank'),
          },
        });
      });
      
      queryClient.invalidateQueries({ queryKey: ['vaults'] });
      queryClient.invalidateQueries({ queryKey: ['userNFTs'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to reclaim NFT', {
        description: error.message,
      });
    },
  });
};
