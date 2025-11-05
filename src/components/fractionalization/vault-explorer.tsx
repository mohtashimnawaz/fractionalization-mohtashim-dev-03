/**
 * Vault explorer component - Browse and filter vaults with pagination
 */

'use client';

import { useState } from 'react';
import { useVaults } from '@/hooks/useExplorer';
import { VaultCard } from './vault-card';
import { VaultStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, X } from 'lucide-react';

const filterOptions = [
  { label: 'All', value: undefined },
  { label: 'Active', value: VaultStatus.Active },
  { label: 'Redeemable', value: VaultStatus.Redeemable },
  { label: 'Closed', value: VaultStatus.Closed },
];

const VAULTS_PER_PAGE = 12;
const INITIAL_LOAD = 50; // Load first 50 vaults initially for fast page load

export function VaultExplorer() {
  const [statusFilter, setStatusFilter] = useState<VaultStatus | undefined>(undefined);
  const [displayLimit, setDisplayLimit] = useState(VAULTS_PER_PAGE);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadLimit, setLoadLimit] = useState(INITIAL_LOAD); // How many to fetch from API
  
  // Load vaults in batches for better performance
  const { data, isLoading, error } = useVaults({ limit: loadLimit, offset: 0 });

  const allVaults = data?.vaults || [];
  const totalVaults = data?.total || 0;

  // Filter vaults by status and search query
  const filteredVaults = allVaults.filter((vault) => {
    if (!vault) return false;
    
    // Status filter
    const matchesStatus = statusFilter ? vault.status === statusFilter : true;
    
    // Search filter (by name or symbol)
    const matchesSearch = searchQuery
      ? vault.nftMetadata.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vault.nftMetadata.symbol.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    
    return matchesStatus && matchesSearch;
  });

  // Apply display limit (for "Load More" functionality)
  const displayedVaults = filteredVaults.slice(0, displayLimit);
  const hasMore = displayLimit < filteredVaults.length;
  
  // Check if we need to load more from API (when filtering shows we need more data)
  const needsMoreData = searchQuery && filteredVaults.length < 10 && loadLimit < totalVaults;

  const handleLoadMore = () => {
    // If we've displayed all filtered results but there are more in the backend
    if (displayLimit >= filteredVaults.length && loadLimit < totalVaults) {
      // Load more from API
      setLoadLimit((prev) => Math.min(prev + 50, totalVaults));
    } else {
      // Just show more from already loaded vaults
      setDisplayLimit((prev) => prev + VAULTS_PER_PAGE);
    }
  };

  // Show loading skeleton only on initial load
  const isInitialLoad = isLoading && allVaults.length === 0;
  
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
        <p className="text-destructive">Failed to load vaults</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name or symbol..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setDisplayLimit(VAULTS_PER_PAGE); // Reset display limit when searching
            }}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setDisplayLimit(VAULTS_PER_PAGE); // Reset when clearing search
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {loadLimit < totalVaults && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLoadLimit(totalVaults)}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              `Load All (${totalVaults})`
            )}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <Button
              key={option.label}
              variant={statusFilter === option.value ? 'default' : 'outline'}
              onClick={() => {
                setStatusFilter(option.value);
                setDisplayLimit(VAULTS_PER_PAGE); // Reset display limit when changing filter
              }}
              size="sm"
            >
              {option.label}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Showing {displayedVaults.length} of {filteredVaults.length} vaults
          {loadLimit < totalVaults && ` (loaded ${allVaults.length} of ${totalVaults})`}
          {searchQuery && ` (filtered by "${searchQuery}")`}
          {statusFilter && !searchQuery && ` (${statusFilter} only)`}
          {needsMoreData && ' - Loading more...'}
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
                disabled={isLoading}
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20 space-y-2">
          <p className="text-muted-foreground text-lg">No vaults found</p>
          <p className="text-sm text-muted-foreground">
            Fractionalize your first cNFT to create a vault
          </p>
        </div>
      )}
    </div>
  );
}
