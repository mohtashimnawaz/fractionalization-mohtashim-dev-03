/**
 * Hook for fetching compressed NFT asset details
 */

import { useQuery } from '@tanstack/react-query';
import { DASAsset } from '@/lib/helius';

/**
 * Fetch detailed asset information for a specific cNFT
 */
const fetchCNFTAsset = async (assetId?: string): Promise<DASAsset | null> => {
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
        id: 'asset-request',
        method: 'getAsset',
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

    return data.result as DASAsset;
  } catch (error) {
    console.error('Failed to fetch cNFT asset:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to fetch asset details'
    );
  }
};

/**
 * Hook to fetch detailed cNFT asset information
 */
export const useCNFTAsset = (assetId?: string) => {
  return useQuery({
    queryKey: ['cnftAsset', assetId],
    queryFn: () => fetchCNFTAsset(assetId),
    enabled: !!assetId,
    staleTime: 60000, // 1 minute
    retry: 2,
  });
};
