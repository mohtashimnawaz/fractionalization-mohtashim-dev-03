/**
 * Skeleton loader for vault cards
 */

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';

export function VaultCardSkeleton() {
  return (
    <Card className="overflow-hidden h-full flex flex-col animate-pulse">
      {/* Image Skeleton */}
      <CardHeader className="p-0">
        <div className="relative aspect-square w-full bg-muted shimmer-effect" />
      </CardHeader>

      <CardContent className="p-4 flex-1">
        {/* Title and Badge Skeleton */}
        <div className="flex items-start justify-between mb-3">
          <div className="h-6 bg-muted rounded w-3/4 shimmer-effect" />
          <div className="h-5 bg-muted rounded w-16 shimmer-effect" />
        </div>

        {/* Info Grid Skeleton */}
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between">
              <div className="h-4 bg-muted rounded w-1/3 shimmer-effect" />
              <div className="h-4 bg-muted rounded w-1/4 shimmer-effect" />
            </div>
          ))}
          
          {/* Position Skeleton */}
          <div className="bg-muted/30 rounded-lg p-3 mt-3">
            <div className="h-3 bg-muted rounded w-1/3 mb-2 shimmer-effect" />
            <div className="h-5 bg-muted rounded w-1/2 shimmer-effect" />
          </div>
        </div>
      </CardContent>

      {/* Button Skeleton */}
      <CardFooter className="p-4 pt-0">
        <div className="h-9 bg-muted rounded w-full shimmer-effect" />
      </CardFooter>
    </Card>
  );
}
