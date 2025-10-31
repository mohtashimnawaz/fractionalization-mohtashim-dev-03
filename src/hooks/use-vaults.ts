/**
 * Hook for fetching and managing vault data
 */

import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Vault, VaultStatus } from '@/types';

/**
 * Fetch all vaults from the program
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetchVaults = async (rpcConnection: any, _walletPubkey?: PublicKey): Promise<Vault[]> => {
  try {
    const programId = process.env.NEXT_PUBLIC_FRACTIONALIZATION_PROGRAM_ID;
    if (!programId) {
      console.error('NEXT_PUBLIC_FRACTIONALIZATION_PROGRAM_ID not configured');
      return [];
    }

    console.log('🔍 Fetching vaults from program:', programId);

    // Get RPC endpoint from API route (keeps API key secure)
    const endpointResponse = await fetch('/api/rpc-endpoint');
    const { endpoint } = await endpointResponse.json();
    const connection = new anchor.web3.Connection(endpoint, 'confirmed');

    // Get all vault accounts from the program
    // Filter by discriminator to only get vault accounts
    // The discriminator is the first 8 bytes of the account data
    // We need to calculate it based on the account name "Vault"
    // For now, we'll fetch all and filter by size

    // First fetch ALL accounts to see their sizes
    const allAccounts = await connection.getProgramAccounts(
      new PublicKey(programId)
    );

    console.log('📦 Found total program accounts:', allAccounts.length);

    if (allAccounts.length > 0) {
      // Log all unique account sizes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sizes = allAccounts.map((a: any) => a.account.data.length);
      const uniqueSizes = Array.from(new Set(sizes)).sort((a, b) => (a as number) - (b as number));
      console.log('📊 Unique account sizes found:', uniqueSizes.join(', '));

      // Count accounts per size
      const sizeCounts: Record<number, number> = {};
      sizes.forEach((size: number) => {
        sizeCounts[size] = (sizeCounts[size] || 0) + 1;
      });
      console.log('📈 Account size distribution:', sizeCounts);
    }

    // Filter for vault accounts (197 bytes based on actual data)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vaultAccounts = allAccounts.filter((a: any) => {
      const size = a.account.data.length;
      return size === 197;
    });

    console.log('📦 Found vault accounts (197 bytes):', vaultAccounts.length);

    // Parse vault accounts into Vault objects
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vaults: Vault[] = vaultAccounts.map((account: any) => {
      try {
        const data = account.account.data;

        console.log(`\n📊 Parsing account ${account.pubkey.toBase58()}: ${data.length} bytes`);
        console.log('First 32 bytes (hex):', Buffer.from(data.slice(0, 32)).toString('hex'));

        // Check if account has enough data for vault structure
        if (data.length < 145) {
          console.log(`⏭️  Skipping account (too small): ${data.length} bytes`);
          return null;
        }

        // Anchor discriminator is 8 bytes
        let offset = 8; // Skip discriminator

        console.log(`Offset ${offset}: Reading nft_mint (32 bytes)`);
        const nftMint = new PublicKey(data.slice(offset, offset + 32));
        console.log('  NFT Mint:', nftMint.toBase58());
        offset += 32;

        console.log(`Offset ${offset}: Reading fraction_mint (32 bytes)`);
        const fractionMint = new PublicKey(data.slice(offset, offset + 32));
        console.log('  Fraction Mint:', fractionMint.toBase58());
        offset += 32;

        console.log(`Offset ${offset}: Reading treasury (32 bytes)`);
        const treasury = new PublicKey(data.slice(offset, offset + 32));
        console.log('  Treasury:', treasury.toBase58());
        offset += 32;

        console.log(`Offset ${offset}: Reading owner (32 bytes)`);
        const owner = new PublicKey(data.slice(offset, offset + 32));
        console.log('  Owner:', owner.toBase58());
        offset += 32;

        // Now at offset 136 (8 + 32*4)
        // Read the next 8 bytes as u64 total supply
        console.log(`Offset ${offset}: Reading total_supply (8 bytes)`);
        const totalSupplyBytes = data.slice(offset, offset + 8);
        console.log('  Total supply bytes (hex):', Buffer.from(totalSupplyBytes).toString('hex'));
        const totalSupplyBN = new anchor.BN(totalSupplyBytes, 'le');
        const totalSupply = totalSupplyBN.toString();
        console.log('  Total Supply:', totalSupply);
        offset += 8;

        // Now at offset 144
        // Check what comes next
        console.log(`Offset ${offset}: Next 20 bytes (hex):`, Buffer.from(data.slice(offset, offset + 20)).toString('hex'));

        // Try reading status as u8
        const statusByte = data[offset];
        console.log('  Status byte:', statusByte);
        let status = VaultStatus.Active;
        if (statusByte === 1) status = VaultStatus.Redeemable;
        else if (statusByte === 2) status = VaultStatus.Closed;

        // Don't skip accounts yet - let's see all the data
        console.log(`✅ Parsed account data (status: ${statusByte})`);

        // Create vault object
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
          createdAt: Date.now(), // Temporary
          updatedAt: Date.now(),
        };
      } catch (err) {
        console.error('Error parsing vault account:', account.pubkey?.toBase58(), err);
        return null;
      }
    }).filter((v: Vault | null): v is Vault => v !== null);

    console.log(`✅ Successfully parsed ${vaults.length} vaults`);

    // Fetch NFT metadata for each vault
    const vaultsWithMetadata = await Promise.all(
      vaults.map(async (vault) => {
        try {
          // Fetch cNFT metadata from Helius via API proxy
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
            console.log(`✅ Fetched metadata for ${vault.nftMint}:`, result.content.metadata.name);

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

    return vaultsWithMetadata;
  } catch (error) {
    console.error('Error fetching vaults:', error);
    return [];
  }
};

/**
 * Hook to fetch all vaults
 */
export const useVaults = () => {
  const { publicKey } = useWallet();

  return useQuery({
    queryKey: ['vaults', publicKey?.toBase58()],
    queryFn: () => fetchVaults(null, publicKey || undefined),
    enabled: true, // Always enabled since we create connection inside fetchVaults
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
};

/**
 * Hook to fetch vaults filtered by status
 */
export const useVaultsByStatus = (status?: VaultStatus) => {
  const { publicKey } = useWallet();

  return useQuery({
    queryKey: ['vaults', status, publicKey?.toBase58()],
    queryFn: async () => {
      const vaults = await fetchVaults(null, publicKey || undefined);
      return status ? vaults.filter((v) => v.status === status) : vaults;
    },
    enabled: true, // Always enabled since we create connection inside fetchVaults
    staleTime: 30000,
    refetchInterval: 60000,
  });
};
