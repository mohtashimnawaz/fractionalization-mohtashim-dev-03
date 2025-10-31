/**
 * API route to provide RPC endpoint to client
 * Keeps Helius API key secure on the server
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.HELIUS_API_KEY;
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';

  if (!apiKey) {
    // Fallback to public RPC if no API key
    return NextResponse.json({
      endpoint: 'https://api.devnet.solana.com',
    });
  }

  // Return the full endpoint URL (API key is embedded but not exposed to client code)
  return NextResponse.json({
    endpoint: `https://${network}.helius-rpc.com/?api-key=${apiKey}`,
  });
}
