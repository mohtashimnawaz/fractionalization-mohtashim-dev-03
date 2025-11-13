import { useWalletUi } from '@wallet-ui/react'
import { useWalletUiGill } from '@wallet-ui/react-gill'
import { VersionedTransaction, PublicKey } from '@solana/web3.js'

/**
 * Custom hook to abstract Wallet UI and related functionality from your app.
 *
 * This is a great place to add custom shared Solana logic or clients.
 */
export function useSolana() {
  const walletUi = useWalletUi()
  const client = useWalletUiGill()

  // Create publicKey for compatibility with existing code
  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('🔑 useSolana - wallet info:', {
      connected: walletUi.connected,
      hasAccount: !!walletUi.account,
      account: walletUi.account,
      accountAddress: walletUi.account?.address,
    });
  }

  const publicKey = walletUi.account?.address ? new PublicKey(walletUi.account.address) : null;

  // Expose signTransaction method
  // Note: This is a simplified version that just returns the transaction
  // The actual signing and sending should be done using the gill client directly
  const signTransaction = async (transaction: VersionedTransaction) => {
    // For wallet-ui/gill, we don't separate signing from sending
    // This function is here for compatibility but shouldn't be used
    // Use client.rpc.sendTransaction() or sendAndConfirm() instead
    console.warn('signTransaction called - this should use gill client directly instead')
    return transaction
  }
  
  // Expose a method to send and confirm transactions
  const sendAndConfirmTransaction = async (transaction: VersionedTransaction) => {
    if (!walletUi.connected || !walletUi.account) {
      throw new Error('Wallet not connected')
    }
    
    if (!client) {
      throw new Error('Client not initialized')
    }
    
    try {
      console.log('Sending transaction with gill client')
      
      // Serialize the transaction
      const serializedTx = Buffer.from(transaction.serialize()).toString('base64');
      
      // Send the transaction using the gill client
      // This will automatically prompt the wallet to sign
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const signature = await client.rpc.sendTransaction(serializedTx as any, {
        skipPreflight: false,
        maxRetries: BigInt(3),
      }) as unknown as string;
      
      console.log('Transaction sent:', signature)
      
      return signature
    } catch (error) {
      console.error('Transaction error:', error)
      throw error
    }
  }

  return {
    ...walletUi,
    client,
    publicKey,
    signTransaction,
    sendAndConfirmTransaction,
  }
}
