/**
 * Helius DAS (Digital Asset Standard) API Client
 * Documentation: https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api
 * 
 * ⚠️ IMPORTANT: This requires REAL compressed NFTs on Solana devnet.
 * 
 * Mock NFTs will NOT work because:
 * - Merkle proofs must match actual on-chain tree structures
 * - Your program will verify proofs on-chain
 * - Invalid proofs will cause transaction failures
 * 
 * You MUST:
 * 1. Create a real cNFT on Solana devnet
 * 2. Add HELIUS_API_KEY to .env (server-side only, NOT NEXT_PUBLIC_)
 * 3. Connect wallet that owns the cNFT
 * 
 * See CNFT_SETUP.md for instructions.
 * 
 * Security Note: API calls are proxied through /api/helius-rpc to keep the API key secure
 */

import { PublicKey } from '@solana/web3.js';

/**
 * Compressed NFT metadata structure from Helius DAS API
 */
export interface DASAsset {
  id: string; // Asset ID (mint address for cNFTs)
  content: {
    $schema: string;
    json_uri: string;
    files?: Array<{
      uri: string;
      mime?: string;
    }>;
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
      external_url?: string;
    };
  };
  authorities?: Array<{
    address: string;
    scopes: string[];
  }>;
  compression: {
    eligible: boolean;
    compressed: boolean;
    data_hash: string;
    creator_hash: string;
    asset_hash: string;
    tree: string;
    seq: number;
    leaf_id: number;
  };
  grouping?: Array<{
    group_key: string;
    group_value: string;
  }>;
  royalty?: {
    royalty_model: string;
    target: string | null;
    percent: number;
    basis_points: number;
    primary_sale_happened: boolean;
    locked: boolean;
  };
  creators?: Array<{
    address: string;
    share: number;
    verified: boolean;
  }>;
  ownership: {
    frozen: boolean;
    delegated: boolean;
    delegate: string | null;
    ownership_model: string;
    owner: string;
  };
  supply?: {
    print_max_supply: number;
    print_current_supply: number;
    edition_nonce: number | null;
  };
  mutable: boolean;
  burnt: boolean;
}

/**
 * Asset proof structure from Helius
 */
export interface AssetProof {
  root: string;
  proof: string[];
  node_index: number;
  leaf: string;
  tree_id: string;
}

/**
 * Simplified cNFT structure for UI
 */
export interface CompressedNFT {
  id: string;
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  image: string;
  attributes?: Array<{
    trait_type: string;
    value: string;
  }>;
  tree: string;
  leafId: number;
  owner: string;
}

/**
 * Call Helius DAS API through the secure server-side proxy
 * This keeps the API key secure and never exposes it to the client
 * Includes automatic retry logic with exponential backoff for rate limiting (429 errors)
 */
async function callDASApi<T>(method: string, params: unknown, retryCount = 0): Promise<T> {
  const maxRetries = 3;
  const baseDelay = 1000; // Start with 1 second
  
  try {
    const response = await fetch('/api/helius-rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'helius-das-api',
        method,
        params,
      }),
    });

    // Handle rate limiting (429)
    if (response.status === 429) {
      if (retryCount >= maxRetries) {
        throw new Error(`Helius API rate limit exceeded after ${maxRetries} retries`);
      }
      
      const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
      console.warn(`⚠️  Rate limited by Helius API. Retrying after ${delay}ms (attempt ${retryCount + 1}/${maxRetries})...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return callDASApi<T>(method, params, retryCount + 1);
    }

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Helius API error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    return data.result;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.error('❌ Network error connecting to Helius API via proxy');
      console.error('   This might be a network problem or the proxy route is not working');
      throw new Error('Failed to connect to Helius API. Check your internet connection.');
    }
    throw error;
  }
}

/**
 * Fetch all compressed NFTs owned by an address
 * Uses: getAssetsByOwner
 */
export async function getAssetsByOwner(
  ownerAddress: string
): Promise<CompressedNFT[]> {
  try {
    const result = await callDASApi<{
      total: number;
      limit: number;
      page: number;
      items: DASAsset[];
    }>('getAssetsByOwner', {
      ownerAddress,
      page: 1,
      limit: 1000,
      displayOptions: {
        showFungible: false, // Only NFTs
        showNativeBalance: false,
      },
    });

    // Filter only compressed NFTs and map to simplified structure
    return result.items
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
  } catch (error) {
    console.error('Error fetching cNFTs:', error);
    throw error;
  }
}

/**
 * Fetch detailed information about a specific asset
 * Uses: getAsset
 */
export async function getAsset(assetId: string): Promise<DASAsset> {
  try {
    return await callDASApi<DASAsset>('getAsset', {
      id: assetId,
    });
  } catch (error) {
    console.error('Error fetching asset:', error);
    throw error;
  }
}

/**
 * Fetch Merkle proof for a compressed NFT
 * Required for on-chain operations (fractionalize, transfer, etc.)
 * Uses: getAssetProof
 */
export async function getAssetProof(assetId: string): Promise<AssetProof> {
  try {
    return await callDASApi<AssetProof>('getAssetProof', {
      id: assetId,
    });
  } catch (error) {
    console.error('Error fetching asset proof:', error);
    throw error;
  }
}

/**
 * Convert proof to PublicKey array for transaction accounts
 */
export function proofToAccounts(proof: AssetProof): PublicKey[] {
  return proof.proof.map((node) => new PublicKey(node));
}

/**
 * Get Helius RPC endpoint URL (for server-side use only)
 * Client-side code should use the /api/helius-rpc proxy
 */
export function getHeliusRpcUrl(): string {
  const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
  return `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
}

/**
 * Combined structure with asset and proof data
 * Used for on-chain operations that require both
 */
export interface AssetWithProof {
  asset: DASAsset;
  proof: AssetProof;
  // Convenience fields
  rpcAsset: {
    id: string;
  };
  metadata: {
    name: string;
    symbol: string;
    uri: string;
  };
  compression: {
    data_hash: string;
    creator_hash: string;
    leaf_id: number;
    tree: string;
  };
  merkleTree: string;
  root: Uint8Array;
  dataHash: Uint8Array;
  creatorHash: Uint8Array;
  nonce: bigint;
  index: number;
  leafDelegate: string | null;
}

/**
 * Fetch asset with proof - combines both getAsset and getAssetProof
 * This is the main function you'll use for initialize_reclaim
 */
export async function getAssetWithProof(assetId: string): Promise<AssetWithProof> {
  try {
    // Fetch both asset and proof in parallel
    const [asset, proof] = await Promise.all([
      getAsset(assetId),
      getAssetProof(assetId),
    ]);

    // Convert proof strings to Uint8Arrays (must be exactly 32 bytes)
    // Helius sometimes returns 33 bytes with a version prefix, so we take the last 32 bytes
    const rootBuffer = Buffer.from(proof.root, 'base64');
    const dataHashBuffer = Buffer.from(asset.compression.data_hash, 'base64');
    const creatorHashBuffer = Buffer.from(asset.compression.creator_hash, 'base64');

    // Ensure exactly 32 bytes by taking the last 32 bytes (removes any prefix)
    const root = new Uint8Array(rootBuffer.slice(-32));
    const dataHash = new Uint8Array(dataHashBuffer.slice(-32));
    const creatorHash = new Uint8Array(creatorHashBuffer.slice(-32));

    console.log('✅ Asset proof data lengths after normalization:', {
      rootLength: root.length,
      dataHashLength: dataHash.length,
      creatorHashLength: creatorHash.length,
    });

    return {
      asset,
      proof,
      rpcAsset: {
        id: asset.id,
      },
      metadata: {
        name: asset.content?.metadata?.name || 'Unknown',
        symbol: asset.content?.metadata?.symbol || '',
        uri: asset.content?.json_uri || '',
      },
      compression: {
        data_hash: asset.compression.data_hash,
        creator_hash: asset.compression.creator_hash,
        leaf_id: asset.compression.leaf_id,
        tree: asset.compression.tree,
      },
      merkleTree: asset.compression.tree,
      root,
      dataHash,
      creatorHash,
      nonce: BigInt(asset.compression.leaf_id),
      index: asset.compression.leaf_id,
      leafDelegate: asset.ownership.delegate,
    };
  } catch (error) {
    console.error('Error fetching asset with proof:', error);
    throw error;
  }
}
