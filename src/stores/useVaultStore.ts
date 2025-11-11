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
  fetchUserPositions: (userWallet: string) => Promise<void>;
  getVaultsByStatus: (status?: VaultStatus) => Vault[];
  getLatestVaults: (limit: number) => Vault[];
  clearUserPositions: () => void;
}

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

      // Get all program accounts
      const allAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
        encoding: 'base64',
      });

      console.log('📦 Found total program accounts:', allAccounts.length);

      const possibleVaultSizes = [197, 245]; // Old and new format
      
      // Filter for vault accounts
      const vaultAccounts = allAccounts.filter((a) => {
        const size = a.account.data.length;
        return possibleVaultSizes.includes(size);
      });

      console.log(`📦 Found ${vaultAccounts.length} vault accounts (sizes: ${possibleVaultSizes.join(', ')})`);

      // Parse all vault accounts
      const parsedVaults: Vault[] = vaultAccounts.map((account) => {
        try {
          const data = account.account.data;
          const dataLength = data.length;
          const isOldFormat = dataLength === 197;
          
          let off = 8; // Skip discriminator

          // Parse vault fields
          const nftMint = new PublicKey(data.slice(off, off + 32));
          off += 32;

          const nftAssetId = new PublicKey(data.slice(off, off + 32));
          off += 32;

          const fractionMint = new PublicKey(data.slice(off, off + 32));
          off += 32;

          const totalSupplyBN = new anchor.BN(data.slice(off, off + 8), 'le');
          off += 8;

          const creator = new PublicKey(data.slice(off, off + 32));
          off += 32;

          const creationTimestamp = new anchor.BN(data.slice(off, off + 8), 'le', true);
          off += 8;

          const statusByte = data[off];
          off += 1;

          const reclaimTimestamp = new anchor.BN(data.slice(off, off + 8), 'le', true);
          off += 8;

          const twapPriceAtReclaim = new anchor.BN(data.slice(off, off + 8), 'le');
          off += 8;

          const totalCompensation = new anchor.BN(data.slice(off, off + 8), 'le');
          off += 8;

          const remainingCompensation = new anchor.BN(data.slice(off, off + 8), 'le');
          off += 8;

          off += 1; // bump

          const minLpAgeSeconds = new anchor.BN(data.slice(off, off + 8), 'le', true);
          off += 8;

          const minReclaimPercentage = data[off];
          off += 1;

          const minLiquidityPercent = data[off];
          off += 1;

          const minVolumePercent30d = data[off];
          off += 1;

          // New fields (only in 245-byte accounts)
          let reclaimInitiator: PublicKey;
          let reclaimInitiationTimestamp: anchor.BN;
          let tokensInEscrow: anchor.BN;

          if (isOldFormat) {
            reclaimInitiator = PublicKey.default;
            reclaimInitiationTimestamp = new anchor.BN(0);
            tokensInEscrow = new anchor.BN(0);
          } else {
            reclaimInitiator = new PublicKey(data.slice(off, off + 32));
            off += 32;
            reclaimInitiationTimestamp = new anchor.BN(data.slice(off, off + 8), 'le', true);
            off += 8;
            tokensInEscrow = new anchor.BN(data.slice(off, off + 8), 'le');
          }

          // Helper to safely convert BN to number
          const safeToNumber = (bn: anchor.BN, divisor = 1): number => {
            return parseFloat(bn.toString()) / divisor;
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
            totalSupply: safeToNumber(totalSupplyBN, 1e9),
            creator: creator.toBase58(),
            creationTimestamp: safeToNumber(creationTimestamp, 1) * 1000,
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
          console.error('Error parsing vault:', err);
          return null;
        }
      }).filter((v): v is Vault => v !== null);

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
      let checkedCount = 0;

      // Fetch positions sequentially with rate limiting
      for (const vault of vaults) {
        try {
          const mintPubkey = new PublicKey(vault.fractionMint);
          
          console.log(`Checking balance ${++checkedCount}/${vaults.length} for mint ${vault.fractionMint.slice(0, 8)}...`);
          
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
              console.log(`✅ User has ${balance} tokens for mint ${vault.fractionMint.slice(0, 8)} (${vault.nftMetadata.name})`);
            }
          }

          // Rate limiting: 100ms delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          // Silently skip vaults where we can't fetch balance
          console.warn(`Failed to fetch balance for ${vault.fractionMint.slice(0, 8)}:`, error);
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
  const BATCH_SIZE = 10;
  for (let i = 0; i < vaults.length; i += BATCH_SIZE) {
    const batch = vaults.slice(i, i + BATCH_SIZE);
    
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

    // Rate limiting between batches
    if (i + BATCH_SIZE < vaults.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}
