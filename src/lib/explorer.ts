/**
 * Utility functions for Solana Explorer URLs
 */

type Cluster = 'mainnet-beta' | 'devnet' | 'testnet';

/**
 * Get the current cluster from environment or default to devnet
 */
export function getCluster(): Cluster {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || '';
  
  if (endpoint.includes('mainnet')) return 'mainnet-beta';
  if (endpoint.includes('testnet')) return 'testnet';
  return 'devnet';
}

/**
 * Build Solana Explorer URL for a transaction
 */
export function getExplorerTxUrl(signature: string, cluster?: Cluster): string {
  const clusterParam = cluster || getCluster();
  const clusterSuffix = clusterParam === 'mainnet-beta' ? '' : `?cluster=${clusterParam}`;
  return `https://explorer.solana.com/tx/${signature}${clusterSuffix}`;
}

/**
 * Build Solana Explorer URL for an account/address
 */
export function getExplorerAddressUrl(address: string, cluster?: Cluster): string {
  const clusterParam = cluster || getCluster();
  const clusterSuffix = clusterParam === 'mainnet-beta' ? '' : `?cluster=${clusterParam}`;
  return `https://explorer.solana.com/address/${address}${clusterSuffix}`;
}

/**
 * Build Solscan URL for a transaction
 */
export function getSolscanTxUrl(signature: string, cluster?: Cluster): string {
  const clusterParam = cluster || getCluster();
  const clusterSuffix = clusterParam === 'mainnet-beta' ? '' : `?cluster=${clusterParam}`;
  return `https://solscan.io/tx/${signature}${clusterSuffix}`;
}

/**
 * Build Solscan URL for an account/address
 */
export function getSolscanAddressUrl(address: string, cluster?: Cluster): string {
  const clusterParam = cluster || getCluster();
  const clusterSuffix = clusterParam === 'mainnet-beta' ? '' : `?cluster=${clusterParam}`;
  return `https://solscan.io/account/${address}${clusterSuffix}`;
}

/**
 * Format a signature for display (shortened)
 */
export function formatSignature(signature: string, length: number = 8): string {
  if (signature.length <= length * 2) return signature;
  return `${signature.substring(0, length)}...${signature.substring(signature.length - length)}`;
}

/**
 * Format an address for display (shortened)
 */
export function formatAddress(address: string, length: number = 4): string {
  if (address.length <= length * 2) return address;
  return `${address.substring(0, length)}...${address.substring(address.length - length)}`;
}
