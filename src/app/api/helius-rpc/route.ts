/**
 * Proxy API route for Helius RPC calls
 * Keeps API key secure on the server
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiKey = process.env.HELIUS_API_KEY;
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Helius API key not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    
    const response = await fetch(
      `https://${network}.helius-rpc.com/?api-key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Helius RPC proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy Helius RPC request' },
      { status: 500 }
    );
  }
}
