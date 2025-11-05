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
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
  }
  if (url.startsWith('Qm') || url.startsWith('bafy')) {
    return `https://gateway.pinata.cloud/ipfs/${url}`;
  }
  return url;
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
          if (isMounted) {
            setResolvedImage(convertIpfsUrl(imageUrl));
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
            console.log('Fetching metadata from:', metadataUrl);
            
            const response = await fetch(metadataUrl);
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            
            // Try to parse as JSON first
            if (!contentType || contentType.includes('application/json') || contentType.includes('text/plain')) {
              try {
                const metadata = await response.json();
                console.log('Metadata parsed:', metadata);
                
                if (isMounted && metadata.image) {
                  const finalImageUrl = convertIpfsUrl(metadata.image);
                  console.log('Extracted image URL:', finalImageUrl);
                  setResolvedImage(finalImageUrl);
                  setIsLoading(false);
                  return;
                }
                
                // Check properties.files as fallback
                if (isMounted && metadata.properties?.files?.[0]?.uri) {
                  const finalImageUrl = convertIpfsUrl(metadata.properties.files[0].uri);
                  console.log('Extracted image URL from properties.files:', finalImageUrl);
                  setResolvedImage(finalImageUrl);
                  setIsLoading(false);
                  return;
                }
              } catch {
                // Not valid JSON, might be an image
                console.log('Not JSON, treating as image:', metadataUrl);
              }
            }
            
            // If we get here, treat the URL as a direct image
            if (isMounted) {
              setResolvedImage(metadataUrl);
              setIsLoading(false);
            }
            return;
          } catch (fetchErr) {
            console.warn('Failed to fetch metadata:', fetchErr);
            // Fall through to try as direct image
          }
        }
        
        // Otherwise assume it's a direct image URL
        if (isMounted) {
          setResolvedImage(convertIpfsUrl(imageUrl));
          setIsLoading(false);
        }
      } catch (err) {
        // Log error but don't spam console for expected failures
        if (err instanceof Error && !err.message.includes('HTTP 404')) {
          console.warn('Failed to resolve cNFT image:', err.message);
        }
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

  if (error || !resolvedImage) {
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
