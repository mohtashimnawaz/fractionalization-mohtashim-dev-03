/**
 * Hook to listen to program events and refresh vault store
 */

import { useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useVaultStore } from '@/stores/useVaultStore';
import idl from '@/lib/idl/fractionalization.json';

const PROGRAM_ID = new PublicKey(idl.address);

export function useVaultEventListener() {
  const { fetchAllVaults } = useVaultStore();

  useEffect(() => {
    let connection: Connection;
    let subscriptionId: number | null = null;

    const setupListener = async () => {
      try {
        const endpointResponse = await fetch('/api/rpc-endpoint');
        const { endpoint } = await endpointResponse.json();
        connection = new Connection(endpoint, 'confirmed');

        console.log('📡 Setting up event listener for program:', PROGRAM_ID.toBase58());

        // Listen to all logs from the program
        subscriptionId = connection.onLogs(
          PROGRAM_ID,
          (logs) => {
            // Check if this is a Fractionalized event (or other relevant events)
            const logMessages = logs.logs.join(' ');
            
            if (
              logMessages.includes('Fractionalized') ||
              logMessages.includes('ReclaimInitiated') ||
              logMessages.includes('ReclaimFinalized') ||
              logMessages.includes('ReclaimCancelled') ||
              logMessages.includes('Redeemed') ||
              logMessages.includes('VaultClosed')
            ) {
              console.log('🔔 Vault event detected, refreshing store...');
              // Refetch all vaults when an event is detected
              fetchAllVaults();
            }
          },
          'confirmed'
        );

        console.log('✅ Event listener set up successfully');
      } catch (error) {
        console.error('Failed to set up event listener:', error);
      }
    };

    setupListener();

    // Cleanup on unmount
    return () => {
      if (connection && subscriptionId !== null) {
        console.log('📡 Removing event listener');
        connection.removeOnLogsListener(subscriptionId);
      }
    };
  }, [fetchAllVaults]);
}
