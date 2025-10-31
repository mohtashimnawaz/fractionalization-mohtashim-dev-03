'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletAdapterProviderProps {
  children: React.ReactNode;
}

/**
 * Standard Solana Wallet Adapter Provider
 * Provides wallet connection and transaction signing capabilities
 */
export function WalletAdapterProvider({ children }: WalletAdapterProviderProps) {
  // Fetch RPC endpoint from API route (keeps API key secure)
  const [endpoint, setEndpoint] = useState('https://api.devnet.solana.com');

  useEffect(() => {
    fetch('/api/rpc-endpoint')
      .then((res) => res.json())
      .then((data) => {
        if (data.endpoint) {
          setEndpoint(data.endpoint);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch RPC endpoint:', err);
      });
  }, []);

  // Configure wallet adapters
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={true}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
