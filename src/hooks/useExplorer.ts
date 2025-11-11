/**
 * Explorer hooks - Queries and mutations for vault explorer
 */

import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Vault, VaultStatus } from '@/types';

interface UseVaultsOptions {
  limit?: number;
  offset?: number;
}

/**
 * Fetch vaults with pagination
 */
const fetchVaults = async (
  options: UseVaultsOptions = {}
): Promise<{ vaults: Vault[]; total: number }> => {
  const { limit = 10, offset = 0 } = options;

  try {
    const programId = process.env.NEXT_PUBLIC_FRACTIONALIZATION_PROGRAM_ID;
    if (!programId) {
      console.error('NEXT_PUBLIC_FRACTIONALIZATION_PROGRAM_ID not configured');
      return { vaults: [], total: 0 };
    }

    console.log('🔍 Fetching vaults from program:', programId);

    // Get RPC endpoint from API route (keeps API key secure)
    const endpointResponse = await fetch('/api/rpc-endpoint');
    const { endpoint } = await endpointResponse.json();
    const connection = new anchor.web3.Connection(endpoint, 'confirmed');

    // Get all vault accounts from the program
    const allAccounts = await connection.getProgramAccounts(
      new PublicKey(programId)
    );

    console.log('📦 Found total program accounts:', allAccounts.length);

    // Log all account sizes to debug
    const accountSizes = new Map<number, number>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allAccounts.forEach((a: any) => {
      const size = a.account.data.length;
      accountSizes.set(size, (accountSizes.get(size) || 0) + 1);
    });
    console.log('📏 Account sizes distribution:', Array.from(accountSizes.entries()).map(([size, count]) => `${size} bytes: ${count} accounts`));

    // Try multiple possible vault sizes since we're not sure of the exact size
    // Old size was 197 bytes, new calculated size could be 205 (8 + 197) or 245 (8 + 237)
    const possibleVaultSizes = [197, 245]; // Old format (197) and new format (245)
    
    // Filter for vault accounts - accept any of the possible sizes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vaultAccounts = allAccounts.filter((a: any) => {
      const size = a.account.data.length;
      return possibleVaultSizes.includes(size);
    });

    console.log(`📦 Found vault accounts (sizes: ${possibleVaultSizes.join(', ')}):`, vaultAccounts.length);

    // Parse ALL vault accounts first so we can sort by creation_timestamp
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allVaults: Vault[] = vaultAccounts.map((account: any) => {
      try {
        const data = account.account.data;
        const dataLength = data.length;

        // All Anchor accounts have 8-byte discriminator at the start
        // Old format: 197 bytes = 8 (discriminator) + 189 (data, missing last 3 fields)
        // New format: 245 bytes = 8 (discriminator) + 237 (data with all fields)
        const isOldFormat = dataLength === 197;
        let off = 8; // Skip discriminator

        // pub nft_mint: Pubkey - 32 bytes
        const nftMint = new PublicKey(data.slice(off, off + 32));
        off += 32;

        // pub nft_asset_id: Pubkey - 32 bytes
        const nftAssetId = new PublicKey(data.slice(off, off + 32));
        off += 32;

        // pub fraction_mint: Pubkey - 32 bytes
        const fractionMint = new PublicKey(data.slice(off, off + 32));
        off += 32;

        // pub total_supply: u64 - 8 bytes
        const totalSupplyBN = new anchor.BN(data.slice(off, off + 8), 'le');
        off += 8;

        // pub creator: Pubkey - 32 bytes
        const creator = new PublicKey(data.slice(off, off + 32));
        off += 32;

        // pub creation_timestamp: i64 - 8 bytes
        const creationTimestamp = new anchor.BN(data.slice(off, off + 8), 'le', true);
        off += 8;

        // pub status: VaultStatus - 1 byte (enum)
        const statusByte = data[off];
        off += 1;

        // pub reclaim_timestamp: i64 - 8 bytes
        const reclaimTimestamp = new anchor.BN(data.slice(off, off + 8), 'le', true);
        off += 8;

        // pub twap_price_at_reclaim: u64 - 8 bytes
        const twapPriceAtReclaim = new anchor.BN(data.slice(off, off + 8), 'le');
        off += 8;

        // pub total_compensation: u64 - 8 bytes
        const totalCompensation = new anchor.BN(data.slice(off, off + 8), 'le');
        off += 8;

        // pub remaining_compensation: u64 - 8 bytes
        const remainingCompensation = new anchor.BN(data.slice(off, off + 8), 'le');
        off += 8;

        // pub bump: u8 - 1 byte
        off += 1;

        // pub min_lp_age_seconds: i64 - 8 bytes
        const minLpAgeSeconds = new anchor.BN(data.slice(off, off + 8), 'le', true);
        off += 8;

        // pub min_reclaim_percentage: u8 - 1 byte
        const minReclaimPercentage = data[off];
        off += 1;

        // pub min_liquidity_percent: u8 - 1 byte
        const minLiquidityPercent = data[off];
        off += 1;

        // pub min_volume_percent_30d: u8 - 1 byte
        const minVolumePercent30d = data[off];
        off += 1;

        // Fields added in new format (only present in 245-byte accounts)
        let reclaimInitiator: PublicKey;
        let reclaimInitiationTimestamp: anchor.BN;
        let tokensInEscrow: anchor.BN;

        if (isOldFormat) {
          // Old format: use default values for missing fields
          reclaimInitiator = PublicKey.default;
          reclaimInitiationTimestamp = new anchor.BN(0);
          tokensInEscrow = new anchor.BN(0);
        } else {
          // New format: read the additional fields
          // pub reclaim_initiator: Pubkey - 32 bytes
          reclaimInitiator = new PublicKey(data.slice(off, off + 32));
          off += 32;

          // pub reclaim_initiation_timestamp: i64 - 8 bytes
          reclaimInitiationTimestamp = new anchor.BN(data.slice(off, off + 8), 'le', true);
          off += 8;

          // pub tokens_in_escrow: u64 - 8 bytes
          tokensInEscrow = new anchor.BN(data.slice(off, off + 8), 'le');
        }

        // Helper to safely convert BN to number, with fallback for large values
        const safeToNumber = (bn: anchor.BN, divisor = 1): number => {
          try {
            // Check if the number is within safe integer range
            if (bn.lte(new anchor.BN(Number.MAX_SAFE_INTEGER))) {
              return bn.toNumber() / divisor;
            }
            // For large numbers, convert to string then parse as float
            return parseFloat(bn.toString()) / divisor;
          } catch (e) {
            console.warn('Failed to convert BN to number:', e);
            return 0;
          }
        };

        return {
          id: account.pubkey.toBase58(),
          publicKey: account.pubkey.toBase58(),
          nftMint: nftMint.toBase58(),
          nftAssetId: nftAssetId.toBase58(),
          nftMetadata: {
            name: 'Loading...',
            symbol: '',
            uri: '',
            image: '/placeholder-nft.svg',
          },
          fractionMint: fractionMint.toBase58(),
          totalSupply: safeToNumber(totalSupplyBN, 1e9), // Convert from lamports to tokens
          creator: creator.toBase58(),
          creationTimestamp: safeToNumber(creationTimestamp, 1) * 1000, // Convert to milliseconds
          status: statusByte as VaultStatus,
          reclaimTimestamp: safeToNumber(reclaimTimestamp, 1) * 1000,
          twapPriceAtReclaim: safeToNumber(twapPriceAtReclaim),
          totalCompensation: safeToNumber(totalCompensation),
          remainingCompensation: safeToNumber(remainingCompensation),
          minLpAgeSeconds: safeToNumber(minLpAgeSeconds),
          minReclaimPercentage,
          minLiquidityPercent,
          minVolumePercent30d,
          reclaimInitiator: reclaimInitiator.toBase58(),
          reclaimInitiationTimestamp: safeToNumber(reclaimInitiationTimestamp, 1) * 1000,
          tokensInEscrow: safeToNumber(tokensInEscrow, 1e9),
        };
      } catch (err) {
        console.error('Error parsing vault account:', account.pubkey?.toBase58(), err);
        return null;
      }
    }).filter((v: Vault | null): v is Vault => v !== null);

    // Sort by creation timestamp (newest first)
    const sortedVaults = allVaults.sort((a, b) => b.creationTimestamp - a.creationTimestamp);

    // Apply pagination to get the latest N vaults
    const paginatedVaults = sortedVaults.slice(offset, offset + limit);

    console.log(`📄 Returning ${paginatedVaults.length} vaults (offset: ${offset}, limit: ${limit}), sorted by creation time`);

    // Helper to extract image URL from asset (same logic as useFractionalize)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractImageUrl = (asset: any): string => {
      let imageUrl = '';
      
      // First check files array - this is where Helius puts the image URI from metadata
      if (asset.content?.files && asset.content.files.length > 0) {
        const imageFile = asset.content.files.find((file: { uri?: string; mime?: string }) => 
          file.mime?.startsWith('image/') || file.uri?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
        );
        if (imageFile?.uri) {
          imageUrl = imageFile.uri;
        }
      }
      
      // Fallback to links.image
      if (!imageUrl && asset.content?.links?.image) {
        imageUrl = asset.content.links.image;
      }
      
      // If still no image, use json_uri - the CNFTImage component will fetch and parse it
      if (!imageUrl && asset.content?.json_uri) {
        imageUrl = asset.content.json_uri;
      }
      
      return imageUrl || '/placeholder-nft.svg';
    };

    // Fetch NFT metadata for each vault using nft_asset_id
    const vaultsWithMetadata = await Promise.all(
      paginatedVaults.map(async (vault) => {
        try {
          const response = await fetch('/api/helius-rpc', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 'vault-metadata',
              method: 'getAsset',
              params: {
                id: vault.nftAssetId, // Use nft_asset_id instead of nft_mint
              },
            }),
          });

          const { result } = await response.json();

          if (result && result.content) {
            return {
              ...vault,
              nftMetadata: {
                name: result.content.metadata.name || 'Unknown NFT',
                symbol: result.content.metadata.symbol || '',
                uri: result.content.json_uri || '',
                image: extractImageUrl(result),
                description: result.content.metadata.description,
                attributes: result.content.metadata.attributes || [],
              },
            };
          }

          return vault;
        } catch (err) {
          console.error(`Error fetching metadata for ${vault.nftAssetId}:`, err);
          return vault;
        }
      })
    );

    return {
      vaults: vaultsWithMetadata,
      total: vaultAccounts.length,
    };
  } catch (error) {
    console.error('Error fetching vaults:', error);
    return { vaults: [], total: 0 };
  }
};

/**
 * Hook to fetch vaults with pagination
 */
export const useVaults = (options: UseVaultsOptions = {}) => {
  return useQuery({
    queryKey: ['vaults', options.limit, options.offset],
    queryFn: () => fetchVaults(options),
    staleTime: 5000, // 5 seconds - refresh frequently to show new vaults
    refetchInterval: 15000, // Refetch every 15 seconds
    refetchOnWindowFocus: true, // Refetch when user comes back to tab
  });
};

/**
 * Fetch user's token balance for a specific fraction mint
 */
const fetchUserTokenBalance = async (
  fractionMint: string,
  userWallet: string
): Promise<number> => {
  try {
    const endpointResponse = await fetch('/api/rpc-endpoint');
    const { endpoint } = await endpointResponse.json();
    const connection = new anchor.web3.Connection(endpoint, 'confirmed');

    const mintPubkey = new PublicKey(fractionMint);
    const userPubkey = new PublicKey(userWallet);
    
    console.log(`🔍 Checking balance for wallet ${userWallet.slice(0, 8)}... on mint ${fractionMint.slice(0, 8)}...`);
    
    const response = await connection.getTokenAccountsByOwner(
      userPubkey,
      { mint: mintPubkey }
    );

    console.log(`📊 Found ${response.value.length} token account(s) for this mint`);

    if (response.value.length === 0) {
      console.log(`❌ No token account found for ${fractionMint.slice(0, 8)}...`);
      return 0;
    }

    // Decode token account data
    const accountInfo = response.value[0].account.data;
    // Token amount is at bytes 64-72 (u64 little-endian)
    const amountBN = new anchor.BN(accountInfo.slice(64, 72), 'le');
    
    // Safely convert large BN to number (always use string conversion for safety)
    const balance = parseFloat(amountBN.toString()) / 1e9;
    
    // Log ALL balances for debugging (including zero)
    console.log(`💰 Balance for ${fractionMint.slice(0, 8)}...: ${balance} tokens (raw: ${amountBN.toString()})`);
    
    return balance;
  } catch (error) {
    console.error(`❌ Error fetching balance for ${fractionMint.slice(0, 8)}...:`, error);
    return 0;
  }
};

/**
 * Hook to fetch vaults with user positions
 */
export const useVaultsWithPositions = (
  userWallet: string | null | undefined,
  options: UseVaultsOptions = {}
) => {
  return useQuery({
    queryKey: ['vaults', 'with-positions', userWallet, options.limit, options.offset],
    queryFn: async () => {
      const { vaults, total } = await fetchVaults(options);

      if (!userWallet) {
        console.log('⚠️ No wallet connected, skipping position fetch');
        return { vaults, total };
      }

      console.log(`🔍 Fetching positions for wallet: ${userWallet.slice(0, 8)}...`);

      // Fetch user positions for all vaults with rate limiting
      // Process sequentially to avoid hitting RPC rate limits
      const vaultsWithPositions = [];
      for (const vault of vaults) {
        const userPosition = await fetchUserTokenBalance(vault.fractionMint, userWallet);
        vaultsWithPositions.push({
          ...vault,
          userPosition,
        });
        // Small delay to avoid rate limiting (only if there are more vaults to process)
        if (vaultsWithPositions.length < vaults.length) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between requests
        }
      }

      return { vaults: vaultsWithPositions, total };
    },
    staleTime: 5000,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    enabled: true, // Always enabled, will return vaults without positions if no wallet
  });
};

/**
 * Hook to fetch vaults filtered by status with pagination
 */
export const useVaultsByStatus = (status?: VaultStatus, options: UseVaultsOptions = {}) => {
  return useQuery({
    queryKey: ['vaults', status, options.limit, options.offset],
    queryFn: async () => {
      const { vaults, total } = await fetchVaults(options);
      const filtered = status ? vaults.filter((v) => v.status === status) : vaults;
      return { vaults: filtered, total };
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
};
