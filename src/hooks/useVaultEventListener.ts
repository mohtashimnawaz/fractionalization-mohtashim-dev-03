/**
 * Hook to listen to program events and refresh vault store
 * Uses selective updates to fetch only affected vaults
 */

import { useEffect, useRef } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useVaultStore } from '@/stores/useVaultStore';
import idl from '@/lib/idl/fractionalization.json';

const PROGRAM_ID = new PublicKey(idl.address);

// Allow disabling event listener via environment variable
const ENABLE_EVENT_LISTENER = process.env.NEXT_PUBLIC_ENABLE_EVENT_LISTENER !== 'false';

export function useVaultEventListener() {
  const { fetchVaultById, fetchAllVaults } = useVaultStore();
  const isListening = useRef(false);
  const connectionRef = useRef<Connection | null>(null);
  const subscriptionIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Skip if disabled via environment variable
    if (!ENABLE_EVENT_LISTENER) {
      console.log('📡 Event listener disabled via environment variable');
      return;
    }

    // Prevent duplicate subscriptions
    if (isListening.current) {
      console.log('📡 Event listener already active');
      return;
    }

    const setupListener = async () => {
      try {
        // Only set up listener in browser environment
        if (typeof window === 'undefined') {
          console.log('⚠️ Skipping event listener setup in SSR');
          return;
        }

        const endpointResponse = await fetch('/api/rpc-endpoint');
        if (!endpointResponse.ok) {
          throw new Error('Failed to fetch RPC endpoint');
        }
        
        const { endpoint } = await endpointResponse.json();
        
        // Create connection - Solana web3.js will handle WebSocket automatically
        // For Helius: wss://devnet.helius-rpc.com/?api-key=xxx
        let wsEndpoint: string | undefined;
        
        try {
          // Convert HTTP(S) endpoint to WebSocket endpoint
          if (endpoint.includes('helius-rpc.com')) {
            wsEndpoint = endpoint.replace('https://', 'wss://');
          } else if (endpoint.includes('solana.com')) {
            // Public Solana RPC endpoints
            wsEndpoint = endpoint.replace('https://api.', 'wss://api.').replace('http://', 'ws://');
          }
        } catch (e) {
          console.warn('Could not determine WebSocket endpoint, using default');
        }

        connectionRef.current = new Connection(endpoint, {
          commitment: 'confirmed',
          ...(wsEndpoint && { wsEndpoint }),
        });

        console.log('📡 Setting up event listener for program:', PROGRAM_ID.toBase58());

        // Listen to all logs from the program with error handling
        subscriptionIdRef.current = connectionRef.current.onLogs(
          PROGRAM_ID,
          async (logs) => {
            try {
              const logMessages = logs.logs.join(' ');
              
              // Extract vault address from logs if possible
              let vaultAddress: string | null = null;
              
              // Try to extract the vault pubkey from logs
              for (const log of logs.logs) {
                const match = log.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
                if (match) {
                  vaultAddress = match[0];
                  break;
                }
              }
              
              // Check if this is a vault-related event
              if (
                logMessages.includes('Fractionalized') ||
                logMessages.includes('ReclaimInitiated') ||
                logMessages.includes('ReclaimFinalized') ||
                logMessages.includes('ReclaimCancelled') ||
                logMessages.includes('Redeemed') ||
                logMessages.includes('VaultClosed')
              ) {
                console.log('🔔 Vault event detected:', {
                  signature: logs.signature,
                  hasVaultAddress: !!vaultAddress
                });
                
                // If we found a specific vault address, fetch only that vault
                if (vaultAddress) {
                  try {
                    console.log(`🎯 Fetching specific vault: ${vaultAddress.slice(0, 8)}...`);
                    await fetchVaultById(vaultAddress);
                  } catch (error) {
                    console.error('Failed to fetch specific vault, falling back to full fetch:', error);
                    await fetchAllVaults();
                  }
                } else {
                  // If we can't determine the specific vault, fetch all
                  console.log('🔄 Vault address not found, refreshing all vaults...');
                  await fetchAllVaults();
                }
              }
            } catch (error) {
              console.error('Error handling vault event:', error);
            }
          },
          'confirmed'
        );

        isListening.current = true;
        console.log('✅ Event listener set up successfully');
      } catch (error) {
        // Silently fail if WebSocket setup fails - this is non-critical
        // The app will still work, just without real-time updates
        console.warn('⚠️ Event listener setup failed (non-critical):', error);
        isListening.current = false;
        connectionRef.current = null;
        subscriptionIdRef.current = null;
      }
    };

    setupListener();

    // Cleanup on unmount
    return () => {
      if (connectionRef.current && subscriptionIdRef.current !== null) {
        try {
          console.log('📡 Removing event listener');
          connectionRef.current.removeOnLogsListener(subscriptionIdRef.current);
        } catch (error) {
          // Ignore cleanup errors
          console.warn('Error removing event listener:', error);
        } finally {
          isListening.current = false;
          connectionRef.current = null;
          subscriptionIdRef.current = null;
        }
      }
    };
  }, [fetchAllVaults, fetchVaultById]);
}
