/**
 * Proxy API route for Helius RPC calls
 * Keeps API key secure on the server
 * Includes retry logic for 429 rate limit errors
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Retry a request with exponential backoff
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelay = 500
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // If rate limited (429), retry with exponential backoff
      if (response.status === 429 && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`⚠️ Rate limited (429). Retrying after ${delay}ms delay... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Return response for any other status code
      return response;
    } catch (error) {
      lastError = error as Error;
      
      // Retry on network errors
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`⚠️ Network error. Retrying after ${delay}ms delay... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }
  
  throw lastError || new Error('Max retries reached');
}

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
    
    const response = await fetchWithRetry(
      `https://${network}.helius-rpc.com/?api-key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      3, // max retries
      500 // base delay in ms
    );

    const data = await response.json();
    
    // Log rate limit headers if available
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    const rateLimitReset = response.headers.get('x-ratelimit-reset');
    
    if (rateLimitRemaining !== null) {
      console.log(`📊 Helius rate limit: ${rateLimitRemaining} remaining`);
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Helius RPC proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy Helius RPC request', details: (error as Error).message },
      { status: 500 }
    );
  }
}
