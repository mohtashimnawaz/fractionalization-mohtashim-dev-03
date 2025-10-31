/**
 * Fractionalization workflow type definitions
 */

/**
 * Step in the fractionalization process
 */
export enum FractionalizationStep {
  SelectNFT = 1,
  ConfigureTokens = 2,
}

/**
 * Form data for fractionalization
 */
export interface FractionalizationFormData {
  nftMint: string;
  totalSupply: string;
  minLpAgeSeconds: string;
  minReclaimPercent: string;
  minLiquidityPercent: string;
  minVolumePercent30d: string;
}

/**
 * Parameters for fractionalizeV1 instruction
 */
export interface FractionalizeParams {
  assetId: string; // cNFT asset ID
  totalSupply: string; // Total fraction supply (in tokens, will be converted to u64 with decimals)
  minLpAgeSeconds: string | null; // Min LP age in seconds (optional)
  minReclaimPercent: string | null; // Min reclaim % (optional, 0-100)
  minLiquidityPercent: string | null; // Min liquidity % (optional, 0-100)
  minVolumePercent30d: string | null; // Min 30-day volume % (optional, 0-100)
}

/**
 * NFT owned by the user
 */
export interface UserNFT {
  mint: string;
  name: string;
  symbol: string;
  image: string;
  uri: string;
}

