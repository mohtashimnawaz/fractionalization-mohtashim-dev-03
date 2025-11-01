/**
 * Centralized Umi instance hook
 * Creates and configures Umi once with all necessary plugins
 */

import { useMemo } from 'react';
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

  const umi = useMemo(() => {
    // Get Helius RPC endpoint
    const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';
    const heliusRpc = `https://devnet.helius-rpc.com/?api-key=${heliusApiKey}`;

    const umiInstance = createUmi(heliusRpc)
      .use(mplBubblegum())
      .use(dasApi());

    // Add wallet adapter if wallet is connected
    if (wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions) {
      umiInstance.use(walletAdapterIdentity(wallet));
    }

    return umiInstance;
  }, [wallet]);

  return umi;
}
