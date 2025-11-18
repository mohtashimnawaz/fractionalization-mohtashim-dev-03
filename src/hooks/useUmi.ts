/**
 * Centralized Umi instance hook
 * Creates and configures Umi once with all necessary plugins
 * Uses /api/rpc-endpoint to keep API keys secure on the server
 */

import { useMemo, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { mplBubblegum } from '@metaplex-foundation/mpl-bubblegum';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';

/**
 * Hook to get configured Umi instance
 * Reuses the same instance when wallet doesn't change
 */
export function useUmi() {
  const wallet = useWallet();
  const [rpcEndpoint, setRpcEndpoint] = useState<string | null>(null);

  // Fetch the RPC endpoint from the server
  useEffect(() => {
    fetch('/api/rpc-endpoint')
      .then(res => res.json())
      .then(data => setRpcEndpoint(data.endpoint))
      .catch(err => console.error('Failed to fetch RPC endpoint:', err));
  }, []);

  const umi = useMemo(() => {
    // Use fetched endpoint or fallback to localhost for development
    const endpoint = rpcEndpoint || 'http://127.0.0.1:8899';

    const umiInstance = createUmi(endpoint)
      .use(mplBubblegum())
      .use(dasApi());

    // Add wallet adapter if wallet is connected
    if (wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions) {
      umiInstance.use(walletAdapterIdentity(wallet));
    }

    return umiInstance;
  }, [wallet, rpcEndpoint]);

  return umi;
}
