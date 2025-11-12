/**
 * Zustand store for managing vault data
 * Fetches all vaults once and stores them in memory for efficient filtering/pagination
 */

import { create } from 'zustand';
import { Vault, VaultStatus } from '@/types';
import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import idl from '@/lib/idl/fractionalization.json';

interface VaultStore {
  // State
  vaults: Vault[];
  isLoading: boolean;
  error: string | null;
  lastFetchTimestamp: number;
  userPositions: Record<string, number>; // fractionMint -> balance
  
  // Actions
  fetchAllVaults: () => Promise<void>;
  fetchVaultsIfStale: () => Promise<void>;
  fetchVaultById: (vaultId: string) => Promise<void>;
  fetchUserPositions: (userWallet: string) => Promise<void>;
  getVaultsByStatus: (status?: VaultStatus) => Vault[];
  getLatestVaults: (limit: number) => Vault[];
  clearUserPositions: () => void;
  invalidateCache: () => void;
  isCacheValid: () => boolean;
}

// Cache configuration
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const PROGRAM_ID = new PublicKey(idl.address);

export const useVaultStore = create<VaultStore>((set, get) => ({
  // Initial state
  vaults: [],
  isLoading: false,
  error: null,
  lastFetchTimestamp: 0,
  userPositions: {},

  // Fetch all vaults from the program
  fetchAllVaults: async () => {
    set({ isLoading: true, error: null });
    
    try {
      console.log('📡 Fetching RPC endpoint...');
      const endpointResponse = await fetch('/api/rpc-endpoint');
      
      if (!endpointResponse.ok) {
        throw new Error(`Failed to fetch RPC endpoint: ${endpointResponse.status}`);
      }
      
      const { endpoint } = await endpointResponse.json();
      console.log('✅ RPC endpoint:', endpoint);
      
      const connection = new Connection(endpoint, 'confirmed');

      console.log('🔍 Fetching ALL vaults from program:', PROGRAM_ID.toBase58());

      // Create Anchor provider and program
      const provider = new anchor.AnchorProvider(
        connection,
        {} as anchor.Wallet,
        { commitment: 'confirmed' }
      );
      const program = new anchor.Program(idl as anchor.Idl, provider);

      // Fetch all vault accounts using Anchor (automatically deserializes)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vaultAccounts = await (program.account as any).vault.all();
      
      console.log(`📦 Found ${vaultAccounts.length} vault accounts`);

      // Parse all vault accounts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsedVaults: Vault[] = vaultAccounts.map((vaultAccount: any) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const account = vaultAccount.account as any;
          const pubkey = vaultAccount.publicKey;

          // Helper to safely convert BN to number
          const safeToNumber = (bn: anchor.BN, divisor = 1): number => {
            return parseFloat(bn.toString()) / divisor;
          };

          return {
            id: pubkey.toBase58(),
            publicKey: pubkey.toBase58(),
            nftMint: account.nftMint.toBase58(),
            nftAssetId: account.nftAssetId.toBase58(),
            nftMetadata: {
              name: 'Loading...',
              symbol: '',
              uri: '',
              image: '/placeholder-nft.svg',
            },
            fractionMint: account.fractionMint.toBase58(),
            totalSupply: safeToNumber(account.totalSupply, 1e9),
            creator: account.creator.toBase58(),
            creationTimestamp: safeToNumber(account.creationTimestamp, 1) * 1000,
            status: account.status.active ? VaultStatus.Active :
                    account.status.reclaimInitiated ? VaultStatus.ReclaimInitiated :
                    account.status.reclaimedFinalized ? VaultStatus.ReclaimedFinalized :
                    VaultStatus.Closed,
            reclaimTimestamp: safeToNumber(account.reclaimTimestamp, 1) * 1000,
            twapPriceAtReclaim: safeToNumber(account.twapPriceAtReclaim),
            totalCompensation: safeToNumber(account.totalCompensation),
            remainingCompensation: safeToNumber(account.remainingCompensation),
            minLpAgeSeconds: safeToNumber(account.minLpAgeSeconds),
            minReclaimPercentage: account.minReclaimPercentage,
            minLiquidityPercent: account.minLiquidityPercent,
            minVolumePercent30d: account.minVolumePercent30d,
            reclaimInitiator: account.reclaimInitiator.equals(PublicKey.default) 
              ? PublicKey.default.toBase58()
              : account.reclaimInitiator.toBase58(),
            reclaimInitiationTimestamp: safeToNumber(account.reclaimInitiationTimestamp, 1) * 1000,
            tokensInEscrow: safeToNumber(account.tokensInEscrow, 1e9),
          };
        } catch (err) {
          console.error('Error parsing vault:', err);
          return null;
        }
      }).filter((v: Vault | null): v is Vault => v !== null);

      // Sort by creation timestamp (newest first)
      const sortedVaults = parsedVaults.sort((a, b) => b.creationTimestamp - a.creationTimestamp);

      // Fetch metadata for all vaults
      await fetchMetadataForVaults(sortedVaults);

      set({ 
        vaults: sortedVaults, 
        isLoading: false, 
        lastFetchTimestamp: Date.now() 
      });

      console.log(`✅ Loaded ${sortedVaults.length} vaults into store`);
    } catch (error) {
      console.error('Error fetching vaults:', error);
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  // Smart fetch: Only fetch if cache is stale
  fetchVaultsIfStale: async () => {
    const { lastFetchTimestamp, vaults, isLoading } = get();
    const now = Date.now();
    const cacheAge = now - lastFetchTimestamp;
    
    // Don't fetch if already loading
    if (isLoading) {
      console.log('⏳ Already loading, skipping fetch');
      return;
    }
    
    // Check if cache is still valid
    if (vaults.length > 0 && cacheAge < CACHE_DURATION_MS) {
      const remainingMinutes = Math.ceil((CACHE_DURATION_MS - cacheAge) / 60000);
      console.log(`✨ Using cached data (${remainingMinutes} min remaining)`);
      return;
    }
    
    // Cache is stale or empty, fetch new data
    console.log('🔄 Cache expired, fetching fresh data...');
    await get().fetchAllVaults();
  },

  // Fetch a specific vault by ID and update it in the store
  fetchVaultById: async (vaultId: string) => {
    try {
      console.log(`🔍 Fetching vault: ${vaultId.slice(0, 8)}...`);
      
      const endpointResponse = await fetch('/api/rpc-endpoint');
      const { endpoint } = await endpointResponse.json();
      const connection = new Connection(endpoint, 'confirmed');
      
      // Create Anchor provider and program
      const provider = new anchor.AnchorProvider(
        connection,
        {} as anchor.Wallet,
        { commitment: 'confirmed' }
      );
      const program = new anchor.Program(idl as anchor.Idl, provider);
      
      const vaultPubkey = new PublicKey(vaultId);
      
      // Fetch vault account using Anchor (automatically deserializes)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vaultAccount = await (program.account as any).vault.fetch(vaultPubkey);
      
      if (!vaultAccount) {
        console.log(`⚠️ Vault not found: ${vaultId}`);
        return;
      }
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const account = vaultAccount as any;
      
      // Helper to safely convert BN to number
      const safeToNumber = (bn: anchor.BN, divisor = 1): number => {
        return parseFloat(bn.toString()) / divisor;
      };

      const updatedVault: Vault = {
        id: vaultPubkey.toBase58(),
        publicKey: vaultPubkey.toBase58(),
        nftMint: account.nftMint.toBase58(),
        nftAssetId: account.nftAssetId.toBase58(),
        nftMetadata: {
          name: 'Loading...',
          symbol: '',
          uri: '',
          image: '/placeholder-nft.svg',
        },
        fractionMint: account.fractionMint.toBase58(),
        totalSupply: safeToNumber(account.totalSupply, 1e9),
        creator: account.creator.toBase58(),
        creationTimestamp: safeToNumber(account.creationTimestamp, 1) * 1000,
        status: account.status.active ? VaultStatus.Active :
                account.status.reclaimInitiated ? VaultStatus.ReclaimInitiated :
                account.status.reclaimedFinalized ? VaultStatus.ReclaimedFinalized :
                VaultStatus.Closed,
        reclaimTimestamp: safeToNumber(account.reclaimTimestamp, 1) * 1000,
        twapPriceAtReclaim: safeToNumber(account.twapPriceAtReclaim),
        totalCompensation: safeToNumber(account.totalCompensation),
        remainingCompensation: safeToNumber(account.remainingCompensation),
        minLpAgeSeconds: safeToNumber(account.minLpAgeSeconds),
        minReclaimPercentage: account.minReclaimPercentage,
        minLiquidityPercent: account.minLiquidityPercent,
        minVolumePercent30d: account.minVolumePercent30d,
        reclaimInitiator: account.reclaimInitiator.equals(PublicKey.default) 
          ? PublicKey.default.toBase58()
          : account.reclaimInitiator.toBase58(),
        reclaimInitiationTimestamp: safeToNumber(account.reclaimInitiationTimestamp, 1) * 1000,
        tokensInEscrow: safeToNumber(account.tokensInEscrow, 1e9),
      };

      // Fetch metadata for this vault
      await fetchMetadataForVaults([updatedVault]);

      // Update the vault in the store
      const { vaults } = get();
      const existingIndex = vaults.findIndex(v => v.id === vaultId);
      
      if (existingIndex >= 0) {
        // Update existing vault
        const newVaults = [...vaults];
        newVaults[existingIndex] = updatedVault;
        set({ vaults: newVaults });
        console.log(`✅ Updated vault: ${updatedVault.nftMetadata.name}`);
      } else {
        // Add new vault (it was just created)
        const newVaults = [updatedVault, ...vaults].sort((a, b) => 
          b.creationTimestamp - a.creationTimestamp
        );
        set({ vaults: newVaults });
        console.log(`✅ Added new vault: ${updatedVault.nftMetadata.name}`);
      }
    } catch (error) {
      console.error(`Error fetching vault ${vaultId}:`, error);
    }
  },

  // Fetch user positions for all vaults (with rate limiting)
  fetchUserPositions: async (userWallet: string) => {
    const { vaults } = get();
    
    if (vaults.length === 0) {
      console.log('⚠️ No vaults to fetch positions for');
      return;
    }

    console.log(`🔍 Fetching positions for wallet: ${userWallet.slice(0, 8)}... (${vaults.length} vaults)`);

    try {
      const endpointResponse = await fetch('/api/rpc-endpoint');
      const { endpoint } = await endpointResponse.json();
      const connection = new Connection(endpoint, 'confirmed');
      const userPubkey = new PublicKey(userWallet);

      const positions: Record<string, number> = {};

      // Fetch all positions in parallel with Promise.all (faster)
      // But limit to batches of 20 to avoid overwhelming the RPC
      const BATCH_SIZE = 20;
      for (let i = 0; i < vaults.length; i += BATCH_SIZE) {
        const batch = vaults.slice(i, i + BATCH_SIZE);
        
        console.log(`Checking batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(vaults.length/BATCH_SIZE)} (${batch.length} vaults)`);
        
        await Promise.all(
          batch.map(async (vault) => {
            try {
              const mintPubkey = new PublicKey(vault.fractionMint);
              
              const response = await connection.getTokenAccountsByOwner(
                userPubkey,
                { mint: mintPubkey }
              );

              if (response.value.length > 0) {
                const accountInfo = response.value[0].account.data;
                const amountBN = new anchor.BN(accountInfo.slice(64, 72), 'le');
                const balance = parseFloat(amountBN.toString()) / 1e9;
                
                if (balance > 0) {
                  positions[vault.fractionMint] = balance;
                  console.log(`✅ User has ${balance} tokens for ${vault.nftMetadata.name}`);
                }
              }
            } catch (error) {
              // Silently skip errors for individual vaults
            }
          })
        );
        
        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < vaults.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      console.log(`✅ Fetched positions for ${Object.keys(positions).length} vaults out of ${vaults.length} total`);
      console.log('📊 Positions:', positions);
      
      set({ userPositions: positions });
    } catch (error) {
      console.error('Error fetching user positions:', error);
    }
  },

  // Get vaults filtered by status
  getVaultsByStatus: (status?: VaultStatus) => {
    const { vaults } = get();
    if (!status) return vaults;
    return vaults.filter(v => v.status === status);
  },

  // Get the latest N vaults
  getLatestVaults: (limit: number) => {
    const { vaults } = get();
    return vaults.slice(0, limit);
  },

  // Clear user positions (when wallet disconnects)
  clearUserPositions: () => {
    set({ userPositions: {} });
  },

  // Invalidate cache (force next fetch to reload data)
  invalidateCache: () => {
    set({ lastFetchTimestamp: 0 });
    console.log('🗑️ Cache invalidated');
  },

  // Check if cache is still valid
  isCacheValid: () => {
    const { lastFetchTimestamp, vaults } = get();
    if (vaults.length === 0) return false;
    const cacheAge = Date.now() - lastFetchTimestamp;
    return cacheAge < CACHE_DURATION_MS;
  },
}));

// Helper function to fetch metadata for vaults
async function fetchMetadataForVaults(vaults: Vault[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractImageUrl = (asset: any): string => {
    let imageUrl = '';
    
    if (asset.content?.files && asset.content.files.length > 0) {
      const imageFile = asset.content.files.find((file: { uri?: string; mime?: string }) => 
        file.mime?.startsWith('image/') || file.uri?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
      );
      if (imageFile?.uri) {
        imageUrl = imageFile.uri;
      }
    }
    
    if (!imageUrl && asset.content?.links?.image) {
      imageUrl = asset.content.links.image;
    }
    
    if (!imageUrl && asset.content?.json_uri) {
      imageUrl = asset.content.json_uri;
    }
    
    return imageUrl || '/placeholder-nft.svg';
  };

  // Fetch metadata in batches to avoid overwhelming the API
  const BATCH_SIZE = 5; // Reduced from 10 to be more conservative
  for (let i = 0; i < vaults.length; i += BATCH_SIZE) {
    const batch = vaults.slice(i, i + BATCH_SIZE);
    
    console.log(`🔄 Fetching metadata batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(vaults.length/BATCH_SIZE)}`);
    
    await Promise.all(
      batch.map(async (vault) => {
        try {
          const response = await fetch('/api/helius-rpc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 'vault-metadata',
              method: 'getAsset',
              params: { id: vault.nftAssetId },
            }),
          });

          const { result } = await response.json();

          if (result) {
            vault.nftMetadata = {
              name: result.content?.metadata?.name || 'Unknown NFT',
              symbol: result.content?.metadata?.symbol || '',
              uri: result.content?.json_uri || '',
              image: extractImageUrl(result),
            };
          }
        } catch (error) {
          console.error(`Failed to fetch metadata for ${vault.nftAssetId}:`, error);
        }
      })
    );

    // Rate limiting between batches - increased delay
    if (i + BATCH_SIZE < vaults.length) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Increased from 500ms to 1000ms
    }
  }
}
