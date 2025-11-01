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

    // Filter for vault accounts (197 bytes based on actual data)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vaultAccounts = allAccounts.filter((a: any) => {
      const size = a.account.data.length;
      return size === 197;
    });

    console.log('📦 Found vault accounts (197 bytes):', vaultAccounts.length);

    // Sort by most recent (reverse order for newest first)
    const sortedAccounts = [...vaultAccounts].reverse();

    // Apply pagination
    const paginatedAccounts = sortedAccounts.slice(offset, offset + limit);

    console.log(`📄 Returning ${paginatedAccounts.length} vaults (offset: ${offset}, limit: ${limit})`);

    // Parse vault accounts into Vault objects
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vaults: Vault[] = paginatedAccounts.map((account: any) => {
      try {
        const data = account.account.data;

        // Anchor discriminator is 8 bytes
        let offset = 8;

        const nftMint = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;

        const fractionMint = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;

        // Treasury (not used in display but part of account structure)
        offset += 32; // Skip treasury

        const owner = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;

        const totalSupplyBytes = data.slice(offset, offset + 8);
        const totalSupplyBN = new anchor.BN(totalSupplyBytes, 'le');
        const totalSupply = totalSupplyBN.toString();
        offset += 8;

        const statusByte = data[offset];
        let status = VaultStatus.Active;
        if (statusByte === 1) status = VaultStatus.Redeemable;
        else if (statusByte === 2) status = VaultStatus.Closed;

        return {
          id: account.pubkey.toBase58(),
          publicKey: account.pubkey.toBase58(),
          nftMint: nftMint.toBase58(),
          nftMetadata: {
            name: 'Loading...',
            symbol: '',
            uri: '',
            image: '/placeholder-nft.png',
          },
          fractionalMint: fractionMint.toBase58(),
          totalSupply: parseInt(totalSupply) / 1e9,
          circulatingSupply: parseInt(totalSupply) / 1e9,
          status,
          authority: owner.toBase58(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      } catch (err) {
        console.error('Error parsing vault account:', account.pubkey?.toBase58(), err);
        return null;
      }
    }).filter((v: Vault | null): v is Vault => v !== null);

    // Fetch NFT metadata for each vault
    const vaultsWithMetadata = await Promise.all(
      vaults.map(async (vault) => {
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
                id: vault.nftMint,
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
                image: result.content.links?.image || result.content.files?.[0]?.uri || '/placeholder-nft.png',
                description: result.content.metadata.description,
                attributes: result.content.metadata.attributes || [],
              },
            };
          }

          return vault;
        } catch (err) {
          console.error(`Error fetching metadata for ${vault.nftMint}:`, err);
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
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
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
