/**
 * UI-specific fractionalization types
 * Separate from the Anchor-generated types in fractionalization.ts
 */

export enum FractionalizationStep {
  SelectNFT = 'select-nft',
  ConfigureTokens = 'configure-tokens',
}

export interface FractionalizationFormData {
  // Selected NFT
  nftMint?: string;
  nftAssetId?: string;
  nftMetadata?: {
    name: string;
    symbol: string;
    uri: string;
    image?: string;
  };
  
  // Token configuration
  tokenName: string;
  tokenSymbol: string;
  totalSupply: number | string;
  decimals: number;
  
  // Reclaim configuration
  minReclaimPercentage: number | string;
  minLiquidityPercent: number | string;
  minVolumePercent30d: number | string;
  minLpAgeSeconds: number | string;
}

export interface UserNFT {
  id: string;
  content: {
    metadata: {
      name: string;
      symbol: string;
      description?: string;
    };
    files?: Array<{
      uri: string;
      cdn_uri?: string;
      mime?: string;
    }>;
    links?: {
      image?: string;
    };
  };
  compression: {
    compressed: boolean;
    tree?: string;
    leaf_id?: number;
  };
}

export interface FractionalizeParams {
  assetId: string;                    // cNFT asset ID
  totalSupply: string;                // Total fraction supply
  minLpAgeSeconds: string | null;     // Min LP age in seconds
  minReclaimPercent: string | null;   // Min reclaim % (0-100)
  minLiquidityPercent: string | null; // Min liquidity % (0-100)
  minVolumePercent30d: string | null; // Min 30-day volume % (0-100)
}
