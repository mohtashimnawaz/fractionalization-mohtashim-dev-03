/**
 * Hook for fetching individual vault details
 */

import { useQuery } from '@tanstack/react-query';
import { useVaultStore } from '@/stores/useVaultStore';
import { useEffect } from 'react';

/**
 * Hook to fetch vault details by ID
 * First checks the store, then fetches if not found
 */
export const useVaultDetails = (id: string) => {
  const vaults = useVaultStore((state) => state.vaults);
  const fetchVaultById = useVaultStore((state) => state.fetchVaultById);
  const fetchVaultsIfStale = useVaultStore((state) => state.fetchVaultsIfStale);
  
  // Fetch all vaults if store is empty
  useEffect(() => {
    if (id && vaults.length === 0) {
      console.log('📦 Store is empty, fetching all vaults...');
      fetchVaultsIfStale();
    }
  }, [id, vaults.length, fetchVaultsIfStale]);

  return useQuery({
    queryKey: ['vault', id],
    queryFn: async () => {
      console.log(`🔍 Looking for vault ${id} in store...`);
      
      // First try to find in existing vaults
      let vault = vaults.find((v) => v.id === id || v.publicKey === id);
      
      if (vault) {
        console.log('✅ Found vault in store');
        return vault;
      }
      
      // Not in store, try to fetch it specifically
      console.log('⚠️ Vault not in store, fetching from chain...');
      await fetchVaultById(id);
      
      // Check store again after fetching
      vault = useVaultStore.getState().vaults.find((v) => v.id === id || v.publicKey === id);
      
      if (vault) {
        console.log('✅ Vault fetched and found in store');
        return vault;
      }
      
      console.error('❌ Vault not found:', id);
      return null;
    },
    enabled: !!id,
    staleTime: 30000,
    retry: 2,
  });
};
