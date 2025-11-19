/**
 * Optimized vault explorer with better loading states
 */

'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useVaultStore } from '@/stores/useVaultStore';
import { useVaultEventListener } from '@/hooks/useVaultEventListener';
import { VaultCard } from './vault-card';
import { VaultStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, X, RefreshCw } from 'lucide-react';
import { VaultCardSkeleton } from './vault-card-skeleton';
import { StatsDashboard } from './stats-dashboard';

const filterOptions = [
  { label: 'All', value: undefined },
  { label: 'Active', value: VaultStatus.Active },
  { label: 'Reclaim Initiated', value: VaultStatus.ReclaimInitiated },
  { label: 'Reclaimed', value: VaultStatus.ReclaimedFinalized },
  { label: 'Closed', value: VaultStatus.Closed },
];

const INITIAL_DISPLAY = 10;
const LOAD_MORE_COUNT = 10;

export function VaultExplorer() {
  const { publicKey } = useWallet();
  const [statusFilter, setStatusFilter] = useState<VaultStatus | undefined>(undefined);
  const [displayLimit, setDisplayLimit] = useState(INITIAL_DISPLAY);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const hasLoadedPositions = useRef(false);
  
  useVaultEventListener();
  
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

  // Fetch vaults on mount
  useEffect(() => {
    console.log('🚀 Component mounted, checking vault cache...');
    
    fetchVaultsIfStale().then(() => {
      const { vaults: loadedVaults } = useVaultStore.getState();
      if (loadedVaults.length > 0) {
        const firstVaults = loadedVaults.slice(0, 20).map(v => v.id);
        fetchMetadataForVaults(firstVaults).catch(console.error);
      }
    }).catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch user positions
  useEffect(() => {
    if (publicKey && vaults.length > 0 && !hasLoadedPositions.current) {
      console.log('💼 Fetching user positions...');
      setIsLoadingPositions(true);
      fetchUserPositions(publicKey.toBase58())
        .then(() => {
          hasLoadedPositions.current = true;
          setIsLoadingPositions(false);
        })
        .catch(err => {
          console.error('Failed to fetch positions:', err);
          setIsLoadingPositions(false);
        });
    } else if (!publicKey) {
      clearUserPositions();
      hasLoadedPositions.current = false;
      setIsLoadingPositions(false);
    }
  }, [publicKey, vaults.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Memoize filtered vaults
  const statusFilteredVaults = useMemo(() => {
    const result = statusFilter !== undefined ? getVaultsByStatus(statusFilter) : vaults;
    console.log('🔍 Filter Debug:', { 
      statusFilter, 
      totalVaults: vaults.length, 
      filteredCount: result.length,
      vaultStatuses: vaults.map(v => ({ id: v.id.slice(0, 8), status: v.status }))
    });
    return result;
  }, [statusFilter, vaults, getVaultsByStatus]);

  const filteredVaults = useMemo(() => 
    statusFilteredVaults.filter((vault) => {
      if (!vault || !searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return vault.nftMetadata?.name?.toLowerCase().includes(query) ||
             vault.nftMetadata?.symbol?.toLowerCase().includes(query);
    }),
    [statusFilteredVaults, searchQuery]
  );

  const vaultsWithPositions = useMemo(() => 
    filteredVaults.map(vault => ({
      ...vault,
      userPosition: userPositions[vault.fractionMint] || 0,
    })),
    [filteredVaults, userPositions]
  );

  const displayedVaults = useMemo(() => 
    vaultsWithPositions.slice(0, displayLimit),
    [vaultsWithPositions, displayLimit]
  );

  // Fetch metadata for displayed vaults
  useEffect(() => {
    if (displayedVaults.length > 0) {
      const vaultIds = displayedVaults.map(v => v.id);
      fetchMetadataForVaults(vaultIds).catch(console.error);
    }
  }, [displayLimit]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasMore = displayLimit < filteredVaults.length;
  const isInitialLoad = isLoading && vaults.length === 0;

  const handleLoadMore = () => {
    setDisplayLimit((prev) => prev + LOAD_MORE_COUNT);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    invalidateCache();
    await fetchAllVaults();
    if (publicKey) {
      await fetchUserPositions(publicKey.toBase58());
    }
    setIsRefreshing(false);
  };

  const getLastUpdateText = () => {
    if (!lastFetchTimestamp) return 'Never updated';
    const diff = Date.now() - lastFetchTimestamp;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (minutes === 0) return `Updated ${seconds}s ago`;
    if (minutes < 60) return `Updated ${minutes}m ago`;
    return `Updated ${Math.floor(minutes / 60)}h ago`;
  };
  
  if (isInitialLoad) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-muted-foreground font-medium">Loading vaults...</span>
        </div>
        
        {/* Skeleton loaders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <VaultCardSkeleton key={i} />
          ))}
        </div>
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
      {/* Stats Dashboard */}
      {!isLoadingPositions && vaults.length > 0 && (
        <StatsDashboard />
      )}
      {/* Search Bar and Refresh */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-blue-600 transition-colors" />
          <Input
            type="text"
            placeholder="Search by name or symbol..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setDisplayLimit(INITIAL_DISPLAY);
            }}
            className="pl-10 pr-10 border-2 focus:border-blue-400 transition-all duration-300"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setDisplayLimit(INITIAL_DISPLAY);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {isLoadingPositions && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading balances...
            </div>
          )}
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            variant="outline"
            size="sm"
            className="gap-2 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Last Update Info */}
      {lastFetchTimestamp > 0 && (
        <div className="flex items-center justify-between text-xs bg-blue-50/50 dark:bg-blue-950/20 rounded-lg px-4 py-2 border border-blue-100 dark:border-blue-900">
          <span className="text-muted-foreground">{getLastUpdateText()}</span>
          <span className={`font-medium ${isCacheValid() ? 'text-green-600' : 'text-yellow-600'}`}>
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
                setDisplayLimit(INITIAL_DISPLAY);
              }}
              size="sm"
              className={`transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                statusFilter === option.value 
                  ? 'bg-gradient-blue text-white shadow-lg shadow-blue-500/30 border-0' 
                  : 'hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20'
              }`}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground font-medium">
          Showing {displayedVaults.length} of {filteredVaults.length} vaults
          {searchQuery && ` (filtered by "${searchQuery}")`}
        </p>
      </div>

      {/* Vault Grid */}
      {displayedVaults.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedVaults.map((vault, index) => (
              <div
                key={vault.id}
                className="slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <VaultCard vault={vault} />
              </div>
            ))}
          </div>
          
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={handleLoadMore}
                variant="outline"
                size="lg"
                className="gap-2 hover:border-blue-400 hover:bg-gradient-blue hover:text-white transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-blue-500/30 border-2"
              >
                <span>Load More</span>
                <span className="text-xs bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded-full">
                  {filteredVaults.length - displayLimit} remaining
                </span>
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20 space-y-4">
          <div className="w-20 h-20 mx-auto bg-gradient-blue/10 rounded-full flex items-center justify-center">
            <Search className="h-10 w-10 text-blue-500/50" />
          </div>
          <p className="text-muted-foreground text-lg font-medium">No vaults found</p>
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
