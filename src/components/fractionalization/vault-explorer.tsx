/**
 * Vault explorer component - Browse and filter vaults with pagination
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useVaultStore } from '@/stores/useVaultStore';
import { useVaultEventListener } from '@/hooks/useVaultEventListener';
import { VaultCard } from './vault-card';
import { VaultStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, X, RefreshCw } from 'lucide-react';

const filterOptions = [
  { label: 'All', value: undefined },
  { label: 'Active', value: VaultStatus.Active },
  { label: 'Reclaim Initiated', value: VaultStatus.ReclaimInitiated },
  { label: 'Reclaimed', value: VaultStatus.ReclaimedFinalized },
  { label: 'Closed', value: VaultStatus.Closed },
];

const INITIAL_DISPLAY = 10; // Show 10 vaults initially
const LOAD_MORE_COUNT = 10; // Load 10 more when clicking "Load More"

export function VaultExplorer() {
  const { publicKey } = useWallet();
  const [statusFilter, setStatusFilter] = useState<VaultStatus | undefined>(undefined);
  const [displayLimit, setDisplayLimit] = useState(INITIAL_DISPLAY);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedPositions = useRef(false);
  
  // Listen to program events and auto-refresh
  // Note: This uses WebSocket connections which may show warnings in console
  // The app will work fine without it - you'll just need to manually refresh
  useVaultEventListener();
  
  // Get store state and actions - use selector for better reactivity
  const vaults = useVaultStore(state => state.vaults);
  const isLoading = useVaultStore(state => state.isLoading);
  const error = useVaultStore(state => state.error);
  const userPositions = useVaultStore(state => state.userPositions);
  const lastFetchTimestamp = useVaultStore(state => state.lastFetchTimestamp);
  const fetchVaultsIfStale = useVaultStore(state => state.fetchVaultsIfStale);
  const fetchAllVaults = useVaultStore(state => state.fetchAllVaults);
  const fetchUserPositions = useVaultStore(state => state.fetchUserPositions);
  const clearUserPositions = useVaultStore(state => state.clearUserPositions);
  const getVaultsByStatus = useVaultStore(state => state.getVaultsByStatus);
  const invalidateCache = useVaultStore(state => state.invalidateCache);
  const isCacheValid = useVaultStore(state => state.isCacheValid);
  const fetchMetadataForVaults = useVaultStore(state => state.fetchMetadataForVaults);

  // Fetch vaults on mount (uses cached data if valid)
  useEffect(() => {
    console.log('🚀 Component mounted, checking vault cache...');
    console.log('Current vault count:', vaults.length);
    console.log('Is loading:', isLoading);
    console.log('Cache valid:', isCacheValid());
    
    // Use smart fetching that respects cache
    fetchVaultsIfStale().catch(err => {
      console.error('Failed to fetch vaults:', err);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch user positions when wallet connects AND vaults are loaded
  useEffect(() => {
    console.log('👛 Wallet effect running...', {
      hasWallet: !!publicKey,
      vaultCount: vaults.length,
      hasLoadedPositions: hasLoadedPositions.current
    });
    
    if (publicKey && vaults.length > 0 && !hasLoadedPositions.current) {
      console.log('💼 Wallet connected and vaults loaded, fetching positions...');
      fetchUserPositions(publicKey.toBase58()).catch(err => {
        console.error('Failed to fetch positions:', err);
      });
      hasLoadedPositions.current = true;
    } else if (!publicKey) {
      console.log('👋 Wallet disconnected, clearing positions');
      clearUserPositions();
      hasLoadedPositions.current = false;
    }
  }, [publicKey, vaults.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter vaults by status
  const statusFilteredVaults = statusFilter !== undefined 
    ? getVaultsByStatus(statusFilter) 
    : vaults;

  // Apply search filter
  const filteredVaults = statusFilteredVaults.filter((vault) => {
    if (!vault) return false;
    
    // Search filter (by name or symbol)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = vault.nftMetadata?.name?.toLowerCase().includes(query);
      const matchesSymbol = vault.nftMetadata?.symbol?.toLowerCase().includes(query);
      return matchesName || matchesSymbol;
    }
    
    return true;
  });

  // Add user positions to vaults
  const vaultsWithPositions = filteredVaults.map(vault => {
    const position = userPositions[vault.fractionMint] || 0;
    return {
      ...vault,
      userPosition: position,
    };
  });

  // Debug logging
  useEffect(() => {
    console.log(`📊 UserPositions from store:`, userPositions);
    console.log(`🎯 Vaults with positions:`, vaultsWithPositions.filter(v => v.userPosition && v.userPosition > 0).length);
    
    // Log specific mints we're looking for
    Object.keys(userPositions).forEach(mint => {
      console.log(`� Looking for mint ${mint.slice(0, 8)}... with position ${userPositions[mint]}`);
      const vault = vaultsWithPositions.find(v => v.fractionMint === mint);
      if (vault) {
        console.log(`✅ Found vault ${vault.nftMetadata.name} with position ${vault.userPosition}`);
      } else {
        console.log(`❌ Vault not found for mint ${mint.slice(0, 8)}`);
      }
    });
  }, [userPositions, vaultsWithPositions]);

  // Apply display limit
  const displayedVaults = vaultsWithPositions.slice(0, displayLimit);

  // Fetch metadata for currently displayed vaults (on-demand)
  useEffect(() => {
    if (displayedVaults.length > 0) {
      const vaultIds = displayedVaults.map(v => v.id);
      fetchMetadataForVaults(vaultIds).catch(err => {
        console.error('Failed to fetch metadata:', err);
      });
    }
  }, [displayLimit, filteredVaults.length, fetchMetadataForVaults]); // Re-fetch when display changes

  const hasMore = displayLimit < filteredVaults.length;
  const isInitialLoad = isLoading && vaults.length === 0;

  const handleLoadMore = () => {
    setDisplayLimit((prev) => prev + LOAD_MORE_COUNT);
  };

  // Manual refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    invalidateCache(); // Force cache invalidation
    await fetchAllVaults();
    if (publicKey) {
      await fetchUserPositions(publicKey.toBase58());
    }
    setIsRefreshing(false);
  };

  // Format last update time
  const getLastUpdateText = () => {
    if (!lastFetchTimestamp) return 'Never updated';
    const now = Date.now();
    const diff = now - lastFetchTimestamp;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (minutes === 0) {
      return `Updated ${seconds}s ago`;
    } else if (minutes < 60) {
      return `Updated ${minutes}m ago`;
    } else {
      const hours = Math.floor(minutes / 60);
      return `Updated ${hours}h ago`;
    }
  };
  
  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading vaults...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-destructive">Failed to load vaults: {error}</p>
        <Button onClick={() => fetchAllVaults()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Bar and Refresh */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name or symbol..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setDisplayLimit(INITIAL_DISPLAY); // Reset display limit when searching
            }}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setDisplayLimit(INITIAL_DISPLAY); // Reset when clearing search
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {/* Refresh Button */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Last Update Info */}
      {lastFetchTimestamp > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{getLastUpdateText()}</span>
          <span className={isCacheValid() ? 'text-green-600' : 'text-yellow-600'}>
            {isCacheValid() ? '✓ Cache valid' : '⚠ Cache expired'}
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <Button
              key={option.label}
              variant={statusFilter === option.value ? 'default' : 'outline'}
              onClick={() => {
                setStatusFilter(option.value);
                setDisplayLimit(INITIAL_DISPLAY); // Reset display limit when changing filter
              }}
              size="sm"
            >
              {option.label}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Showing {displayedVaults.length} of {filteredVaults.length} vaults
          {searchQuery && ` (filtered by "${searchQuery}")`}
        </p>
      </div>

      {/* Vault Grid */}
      {displayedVaults.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedVaults.map((vault) => (
              <VaultCard key={vault.id} vault={vault} />
            ))}
          </div>
          
          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={handleLoadMore}
                variant="outline"
                size="lg"
              >
                Load More ({filteredVaults.length - displayLimit} remaining)
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20 space-y-2">
          <p className="text-muted-foreground text-lg">No vaults found</p>
          <p className="text-sm text-muted-foreground">
            {searchQuery || statusFilter 
              ? 'Try adjusting your filters' 
              : 'Fractionalize your first cNFT to create a vault'}
          </p>
        </div>
      )}
    </div>
  );
}
