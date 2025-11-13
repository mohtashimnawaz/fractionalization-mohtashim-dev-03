/**
 * cNFT Image Component
 * Handles fetching metadata from json_uri if image is not directly available
 */

'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

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
            
            const response = await fetch(metadataUrl);
            
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
      <Image
        src="/placeholder-nft.svg"
        alt={name}
        fill
        className="object-cover"
      />
    );
  }

  return (
    <Image
      src={resolvedImage}
      alt={name}
      fill
      className="object-cover"
      onError={() => setError(true)}
    />
  );
}
