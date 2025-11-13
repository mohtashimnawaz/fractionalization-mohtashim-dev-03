/**
 * Proxy API route for Helius RPC calls
 * Keeps API key secure on the server
 * Includes retry logic for 429 rate limit errors
 * Includes simple caching to reduce API calls
 */

import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds

/**
 * Generate cache key from request
 */
function getCacheKey(body: unknown): string {
  return JSON.stringify(body);
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_TTL;
}

/**
 * Retry a request with exponential backoff
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 5,
  baseDelay = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // If rate limited (429), retry with exponential backoff
      if (response.status === 429 && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`⚠️ Rate limited (429). Retrying after ${delay}ms delay... (attempt ${attempt + 1}/${maxRetries})`);
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
        console.warn(`⚠️ Network error. Retrying after ${delay}ms delay... (attempt ${attempt + 1}/${maxRetries})`);
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
    
    // Check cache first
    const cacheKey = getCacheKey(body);
    const cached = cache.get(cacheKey);
    
    if (cached && isCacheValid(cached.timestamp)) {
      console.log('✅ Cache hit for Helius request');
      return NextResponse.json(cached.data);
    }
    
    const response = await fetchWithRetry(
      `https://${network}.helius-rpc.com/?api-key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      5, // max retries (increased from 3)
      1000 // base delay in ms (increased from 500)
    );

    const data = await response.json();
    
    // Cache the response
    cache.set(cacheKey, { data, timestamp: Date.now() });
    
    // Log rate limit headers if available
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    
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
