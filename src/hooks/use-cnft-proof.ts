/**
 * Hook for fetching compressed NFT Merkle proof
 */

import { useQuery } from '@tanstack/react-query';
import { AssetProof } from '@/lib/helius';

/**
 * Fetch Merkle proof for a compressed NFT
 * Required for on-chain transactions (fractionalize, transfer, etc.)
 */
const fetchCNFTProof = async (
  assetId?: string
): Promise<AssetProof | null> => {
  if (!assetId) return null;

  try {
    // Use API proxy to keep API key secure
    const response = await fetch('/api/helius-rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'proof-request',
        method: 'getAssetProof',
        params: { id: assetId },
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Helius API error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    return data.result as AssetProof;
  } catch (error) {
    console.error('Failed to fetch cNFT proof:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to fetch asset proof'
    );
  }
};

/**
 * Hook to fetch Merkle proof for a cNFT
 * Use this before fractionalizing to get proof for remaining_accounts
 */
export const useCNFTProof = (assetId?: string) => {
  return useQuery({
    queryKey: ['cnftProof', assetId],
    queryFn: () => fetchCNFTProof(assetId),
    enabled: !!assetId,
    staleTime: 60000, // 1 minute
    retry: 2,
    // Don't cache proofs too long - they should be fresh for transactions
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};
