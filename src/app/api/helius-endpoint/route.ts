/**
 * API route to get Helius RPC endpoint URL
 * Returns the full Helius URL with API key for server-side use only
 * This is used by Umi initialization which needs the full URL
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.HELIUS_API_KEY;
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Helius API key not configured' },
      { status: 500 }
    );
  }

  // Return the full Helius RPC URL (this stays on the server)
  return NextResponse.json({
    url: `https://${network}.helius-rpc.com/?api-key=${apiKey}`
  });
}
