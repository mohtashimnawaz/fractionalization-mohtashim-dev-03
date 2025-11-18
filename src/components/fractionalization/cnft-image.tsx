/**
 * cNFT Image Component
 * Handles fetching metadata from json_uri if image is not directly available
 */

'use client';

import { useState, useEffect } from 'react';

interface CNFTImageProps {
  imageUrl: string;
  name: string;
  className?: string;
}

// Helper to convert IPFS URLs
function convertIpfsUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }
  
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
  }
  if (url.startsWith('Qm') || url.startsWith('bafy')) {
    return `https://gateway.pinata.cloud/ipfs/${url}`;
  }
  return url;
}

// Helper to validate URL
function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function CNFTImage({ imageUrl, name, className }: CNFTImageProps) {
  const [resolvedImage, setResolvedImage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    // Reset state when imageUrl changes
    setIsLoading(true);
    setError(false);
    setResolvedImage('');

    async function resolveImage() {
      try {
        // If no imageUrl, fail early
        if (!imageUrl) {
          if (isMounted) {
            setError(true);
            setIsLoading(false);
          }
          return;
        }

        // Check if it's clearly an image URL
        const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i;
        if (imageUrl.match(imageExtensions)) {
          // Direct image URL - use it
          const convertedUrl = convertIpfsUrl(imageUrl);
          if (isMounted && isValidUrl(convertedUrl)) {
            setResolvedImage(convertedUrl);
            setIsLoading(false);
          } else if (isMounted) {
            setError(true);
            setIsLoading(false);
          }
          return;
        }

        // If it looks like a metadata URI (IPFS, Arweave, or contains /ipfs/), fetch the metadata
        const isMetadataUri = imageUrl.includes('gateway.pinata.cloud/ipfs/') || 
                             imageUrl.includes('ipfs://') ||
                             imageUrl.includes('/ipfs/') ||
                             imageUrl.includes('arweave.net') ||
                             imageUrl.startsWith('Qm') ||
                             imageUrl.startsWith('baf');

        if (isMetadataUri) {
          try {
            const metadataUrl = convertIpfsUrl(imageUrl);
            
            // Add timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
            
            const response = await fetch(metadataUrl, { 
              signal: controller.signal,
              cache: 'force-cache' // Use browser cache
            });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
              // Silently fail for 404s - these are expected for some old/broken NFTs
              if (isMounted) {
                setError(true);
                setIsLoading(false);
              }
              return;
            }

            const contentType = response.headers.get('content-type');
            
            // Try to parse as JSON first
            if (!contentType || contentType.includes('application/json') || contentType.includes('text/plain')) {
              try {
                const metadata = await response.json();
                
                if (isMounted && metadata.image) {
                  const finalImageUrl = convertIpfsUrl(metadata.image);
                  if (isValidUrl(finalImageUrl)) {
                    setResolvedImage(finalImageUrl);
                    setIsLoading(false);
                    return;
                  }
                }
                
                // Check properties.files as fallback
                if (isMounted && metadata.properties?.files?.[0]?.uri) {
                  const finalImageUrl = convertIpfsUrl(metadata.properties.files[0].uri);
                  if (isValidUrl(finalImageUrl)) {
                    setResolvedImage(finalImageUrl);
                    setIsLoading(false);
                    return;
                  }
                }
              } catch {
                // Not valid JSON, might be an image - try displaying it directly
                if (isMounted && isValidUrl(metadataUrl)) {
                  setResolvedImage(metadataUrl);
                  setIsLoading(false);
                } else if (isMounted) {
                  setError(true);
                  setIsLoading(false);
                }
                return;
              }
            }
            
            // If we get here, treat the URL as a direct image
            if (isMounted && isValidUrl(metadataUrl)) {
              setResolvedImage(metadataUrl);
              setIsLoading(false);
            } else if (isMounted) {
              setError(true);
              setIsLoading(false);
            }
            return;
          } catch {
            // Failed to fetch - show placeholder
            if (isMounted) {
              setError(true);
              setIsLoading(false);
            }
            return;
          }
        }
        
        // Otherwise assume it's a direct image URL
        const convertedUrl = convertIpfsUrl(imageUrl);
        if (isMounted && isValidUrl(convertedUrl)) {
          setResolvedImage(convertedUrl);
          setIsLoading(false);
        } else if (isMounted) {
          setError(true);
          setIsLoading(false);
        }
      } catch {
        // Silently handle errors - most are expected (404s, CORS, etc.)
        if (isMounted) {
          setError(true);
          setIsLoading(false);
        }
      }
    }

    resolveImage();

    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  if (isLoading) {
    return (
      <div className={`${className} bg-gray-100 animate-pulse flex items-center justify-center`}>
        <span className="text-xs text-gray-400">Loading...</span>
      </div>
    );
  }

  if (error || !resolvedImage || !isValidUrl(resolvedImage)) {
    return (
      <div className={`${className} bg-gray-200 dark:bg-gray-800 flex items-center justify-center`}>
        <div className="text-center p-4">
          <div className="w-16 h-16 mx-auto mb-2 bg-gray-300 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-xs text-gray-500">No Image</p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={resolvedImage}
      alt={name}
      className={`${className} object-cover w-full h-full`}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}
