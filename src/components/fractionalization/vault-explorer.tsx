/**
 * Vault explorer component - Browse and filter vaults with pagination
 */

'use client';

import { useState } from 'react';
import { useVaults } from '@/hooks/useExplorer';
import { VaultCard } from './vault-card';
import { VaultStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const filterOptions = [
  { label: 'All', value: undefined },
  { label: 'Active', value: VaultStatus.Active },
  { label: 'Redeemable', value: VaultStatus.Redeemable },
  { label: 'Closed', value: VaultStatus.Closed },
];

const VAULTS_PER_PAGE = 10;

export function VaultExplorer() {
  const [statusFilter, setStatusFilter] = useState<VaultStatus | undefined>(undefined);
  const [limit, setLimit] = useState(VAULTS_PER_PAGE);
  
  const { data, isLoading, error } = useVaults({ limit, offset: 0 });

  const vaults = data?.vaults || [];
  const total = data?.total || 0;

  // Filter vaults by status
  const filteredVaults = vaults.filter((vault) => {
    if (!vault) return false;
    return statusFilter ? vault.status === statusFilter : true;
  });

  const hasMore = limit < total;

  const handleLoadMore = () => {
    setLimit((prev) => prev + VAULTS_PER_PAGE);
  };

  if (isLoading && limit === VAULTS_PER_PAGE) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <Button
              key={option.label}
              variant={statusFilter === option.value ? 'default' : 'outline'}
              onClick={() => {
                setStatusFilter(option.value);
                setLimit(VAULTS_PER_PAGE); // Reset limit when changing filter
              }}
              size="sm"
            >
              {option.label}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Showing {filteredVaults.length} of {total} vaults
        </p>
      </div>

      {/* Vault Grid */}
      {filteredVaults.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVaults.map((vault) => (
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
