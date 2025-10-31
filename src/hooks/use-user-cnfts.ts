/**
 * Hook for fetching user's compressed NFTs via Helius DAS API
 */

import { useQuery } from '@tanstack/react-query';
import { CompressedNFT } from '@/lib/helius';

interface DASAsset {
  id: string;
  content: {
    json_uri?: string;
    files?: Array<{ uri: string }>;
    metadata: {
      name: string;
      symbol: string;
      description?: string;
      attributes?: Array<{
        trait_type: string;
        value: string;
      }>;
    };
    links?: {
      image?: string;
    };
  };
  compression: {
    compressed: boolean;
    tree: string;
    leaf_id: number;
  };
  ownership: {
    owner: string;
  };
}

/**
 * Fetch compressed NFTs owned by the connected wallet
 */
const fetchUserCNFTs = async (
  walletAddress?: string
): Promise<CompressedNFT[]> => {
  if (!walletAddress) return [];

  try {
    console.log('🔍 Fetching cNFTs for wallet:', walletAddress);
    
    // Use API proxy to keep API key secure
    const response = await fetch('/api/helius-rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'helius-das-api',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: walletAddress,
          page: 1,
          limit: 1000,
          displayOptions: {
            showFungible: false,
            showNativeBalance: false,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Helius API error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    const result = data.result as {
      total: number;
      items: DASAsset[];
    };

    // Filter only compressed NFTs and map to simplified structure
    const assets = result.items
      .filter((asset) => asset.compression?.compressed)
      .map((asset) => ({
        id: asset.id,
        mint: asset.id,
        name: asset.content?.metadata?.name || 'Unnamed cNFT',
        symbol: asset.content?.metadata?.symbol || '',
        description: asset.content?.metadata?.description,
        image:
          asset.content?.links?.image ||
          asset.content?.files?.[0]?.uri ||
          '/placeholder-nft.png',
        attributes: asset.content?.metadata?.attributes,
        tree: asset.compression.tree,
        leafId: asset.compression.leaf_id,
        owner: asset.ownership.owner,
      }));

    console.log(`✅ Found ${assets.length} compressed NFT(s)`);
    
    if (assets.length > 0) {
      console.log('📋 cNFT Details:');
      assets.forEach((asset, index) => {
        console.log(`  ${index + 1}. ${asset.name || 'Unnamed'} (${asset.symbol})`);
        console.log(`     Asset ID: ${asset.id}`);
        console.log(`     Mint: ${asset.mint}`);
        console.log(`     Tree: ${asset.tree}`);
        console.log(`     Leaf ID: ${asset.leafId}`);
        console.log(`     Image: ${asset.image}`);
        if (asset.description) {
          console.log(`     Description: ${asset.description}`);
        }
        if (asset.attributes && asset.attributes.length > 0) {
          console.log(`     Attributes:`, asset.attributes);
        }
      });
    }
    
    return assets;
  } catch (error) {
    console.error('❌ Failed to fetch cNFTs:', error);
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to fetch compressed NFTs'
    );
  }
};

/**
 * Hook to fetch user's compressed NFTs from Helius
 */
export const useUserCNFTs = (walletAddress?: string) => {
  return useQuery({
    queryKey: ['userCNFTs', walletAddress],
    queryFn: () => fetchUserCNFTs(walletAddress),
    enabled: !!walletAddress,
    staleTime: 30000, // 30 seconds
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
};
