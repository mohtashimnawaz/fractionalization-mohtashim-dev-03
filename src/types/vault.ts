/**
 * Vault-related type definitions for the fractionalization protocol
 */

/**
 * Status of a vault in the fractionalization protocol
 * Matches the VaultStatus enum in the Rust program
 */
export enum VaultStatus {
  Active = 0,
  ReclaimInitiated = 1,
  ReclaimedFinalized = 2,
  Closed = 3,
}

/**
 * NFT metadata structure
 */
export interface NFTMetadata {
  name: string;
  symbol: string;
  uri: string;
  image: string;
  description?: string;
  attributes?: Array<{
    trait_type: string;
    value: string;
  }>;
}

/**
 * Vault data structure representing a fractionalized NFT
 * Matches the Vault struct in vault.rs
 */
export interface Vault {
  id: string; // Vault PDA address
  publicKey: string; // Same as id
  nftMint: string; // cNFT identifier (nft_mint from Rust)
  nftAssetId: string; // Bubblegum asset id (nft_asset_id from Rust)
  nftMetadata: NFTMetadata; // Fetched from Helius
  fractionMint: string; // SPL mint of fractions (fraction_mint from Rust)
  totalSupply: number; // User-chosen supply (in tokens, not lamports)
  creator: string; // Fractionalizer address
  creationTimestamp: number; // Unix timestamp in milliseconds
  status: VaultStatus; // Active / ReclaimInitiated / ReclaimedFinalized / Closed
  reclaimTimestamp: number; // When reclaim happened (unix ms)
  twapPriceAtReclaim: number; // Price used for compensation
  totalCompensation: number; // Total USDC locked
  remainingCompensation: number; // USDC still in escrow
  minLpAgeSeconds: number; // Pool age floor (seconds)
  minReclaimPercentage: number; // 80% default
  minLiquidityPercent: number; // 5% default
  minVolumePercent30d: number; // 10% default
  reclaimInitiator: string; // Who initiated the reclaim
  reclaimInitiationTimestamp: number; // When escrow period started (unix ms)
  tokensInEscrow: number; // Amount of tokens locked in escrow
  // UI-only fields
  userPosition?: number; // User's token balance (fetched separately)
}

/**
 * User's position in a specific vault
 */
export interface UserVaultPosition {
  vaultId: string;
  fractionalTokenBalance: number;
  sharePercentage: number;
}

/**
 * Redemption request data
 */
export interface RedemptionRequest {
  id: string;
  vaultId: string;
  user: string;
  amount: number;
  timestamp: number;
  status: 'pending' | 'completed' | 'cancelled';
}
