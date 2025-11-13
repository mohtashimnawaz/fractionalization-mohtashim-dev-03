/**
 * Address Lookup Table (ALT) Manager
 * Handles creation and management of ALTs for reducing transaction size
 */

import {
  Connection,
  PublicKey,
  AddressLookupTableProgram,
  AddressLookupTableAccount,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';

const ALT_STORAGE_KEY = 'reclaim_alt_address';

/**
 * Get or create an ALT for initialize_reclaim transactions
 */
export async function getOrCreateReclaimALT(
  connection: Connection,
  payer: PublicKey
): Promise<{ altAddress: PublicKey; needsCreation: boolean }> {
  // Check if we have an existing ALT in localStorage
  const storedALT = localStorage.getItem(ALT_STORAGE_KEY);
  
  if (storedALT) {
    try {
      const altAddress = new PublicKey(storedALT);
      console.log('✅ Using existing ALT from storage:', altAddress.toBase58());
      // Don't verify on-chain here - we'll verify when we need to extend it
      // This avoids the issue of the ALT not being indexed immediately after creation
      return { altAddress, needsCreation: false };
    } catch (error) {
      console.warn('⚠️ Stored ALT is invalid, will create new one');
      localStorage.removeItem(ALT_STORAGE_KEY);
    }
  }

  // Need to create a new ALT
  const slot = await connection.getSlot();
  const [, altAddress] = AddressLookupTableProgram.createLookupTable({
    authority: payer,
    payer: payer,
    recentSlot: slot,
  });

  console.log('📝 New ALT address generated:', altAddress.toBase58());
  return { altAddress, needsCreation: true };
}

/**
 * Create ALT instruction
 */
export function createALTInstruction(
  payer: PublicKey,
  recentSlot: number
) {
  return AddressLookupTableProgram.createLookupTable({
    authority: payer,
    payer: payer,
    recentSlot,
  });
}

/**
 * Extend ALT with new addresses
 */
export function extendALTInstruction(
  altAddress: PublicKey,
  authority: PublicKey,
  payer: PublicKey,
  addresses: PublicKey[]
) {
  return AddressLookupTableProgram.extendLookupTable({
    lookupTable: altAddress,
    authority,
    payer,
    addresses,
  });
}

/**
 * Fetch an Address Lookup Table account
 */
export async function getAddressLookupTableAccount(
  connection: Connection,
  lookupTableAddress: PublicKey
): Promise<AddressLookupTableAccount | null> {
  const result = await connection.getAddressLookupTable(lookupTableAddress);
  return result.value;
}

/**
 * Store ALT address in localStorage
 */
export function storeALTAddress(altAddress: PublicKey) {
  localStorage.setItem(ALT_STORAGE_KEY, altAddress.toBase58());
  console.log('💾 Stored ALT address:', altAddress.toBase58());
}

/**
 * Check if proof addresses are already in the ALT
 */
export async function checkProofAddressesInALT(
  connection: Connection,
  altAddress: PublicKey,
  proofAddresses: PublicKey[]
): Promise<{ allPresent: boolean; missingAddresses: PublicKey[] }> {
  const altAccount = await getAddressLookupTableAccount(connection, altAddress);
  
  if (!altAccount) {
    return { allPresent: false, missingAddresses: proofAddresses };
  }

  const existingAddresses = new Set(
    altAccount.state.addresses.map(addr => addr.toBase58())
  );

  const missingAddresses = proofAddresses.filter(
    addr => !existingAddresses.has(addr.toBase58())
  );

  return {
    allPresent: missingAddresses.length === 0,
    missingAddresses,
  };
}

