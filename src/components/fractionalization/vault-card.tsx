/**
 * Vault card component for displaying vault information in grid/list
 */

"use client";

import React from 'react'
import { Vault, VaultStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CNFTImage } from './cnft-image';
import { Calendar, User, Wallet } from 'lucide-react';

interface VaultCardProps {
  vault: Vault;
}

const statusColors: Record<VaultStatus, string> = {
  [VaultStatus.Active]: 'bg-green-500/10 text-green-500 hover:bg-green-500/20',
  [VaultStatus.ReclaimInitiated]: 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20',
  [VaultStatus.ReclaimedFinalized]: 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20',
  [VaultStatus.Closed]: 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20',
};

const statusLabels: Record<VaultStatus, string> = {
  [VaultStatus.Active]: 'Active',
  [VaultStatus.ReclaimInitiated]: 'Reclaim Initiated',
  [VaultStatus.ReclaimedFinalized]: 'Reclaimed',
  [VaultStatus.Closed]: 'Closed',
};

export function VaultCard({ vault }: VaultCardProps) {
  // Safety check: return null if vault data is invalid
  if (!vault || !vault.nftMetadata) {
    return null;
  }

  const hasPosition = vault.userPosition !== undefined && vault.userPosition > 0;
  const userSharePercentage = vault.userPosition && vault.totalSupply 
    ? (vault.userPosition / vault.totalSupply) * 100 
    : 0;

  // Check if user can initialize reclaim: status is Active AND user has >= min_reclaim_percentage
  const canInitializeReclaim = vault.status === VaultStatus.Active && 
                               userSharePercentage >= vault.minReclaimPercentage;

  const formatDate = (timestamp: number) => {
    if (!timestamp || timestamp === 0) return 'N/A';
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const shortenAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
      {/* NFT Image */}
      <CardHeader className="p-0">
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          <CNFTImage
            imageUrl={vault.nftMetadata.image}
            name={vault.nftMetadata.name}
            className="absolute inset-0"
          />
        </div>
      </CardHeader>

      <CardContent className="p-4 flex-1">
        {/* Name and Status */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-lg truncate flex-1 text-[oklch(0.4_0.2_250)]">
            {vault.nftMetadata.name}
          </h3>
          <Badge className={statusColors[vault.status]} variant="secondary">
            {statusLabels[vault.status]}
          </Badge>
        </div>

        {/* Info Grid */}
        <div className="space-y-2.5 text-sm">
          {/* Total Supply */}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Supply</span>
            <span className="font-medium text-[oklch(0.4_0.2_250)]">
              {vault.totalSupply.toLocaleString()} tokens
            </span>
          </div>

          {/* Creator */}
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              Creator
            </span>
            <span className="font-mono text-xs text-[oklch(0.4_0.2_250)]">
              {shortenAddress(vault.creator)}
            </span>
          </div>

          {/* NFT Asset ID */}
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1">
              <Wallet className="h-3.5 w-3.5" />
              Asset ID
            </span>
            <span className="font-mono text-xs text-[oklch(0.4_0.2_250)]">
              {shortenAddress(vault.nftAssetId)}
            </span>
          </div>

          {/* Creation Date */}
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Created
            </span>
            <span className="text-[oklch(0.4_0.2_250)]">
              {formatDate(vault.creationTimestamp)}
            </span>
          </div>

          {/* Divider */}
          <div className="border-t border-border my-3"></div>

          {/* User Position */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">Your Position</div>
            {hasPosition ? (
              <div>
                <div className="font-semibold text-[oklch(0.4_0.2_250)]">
                  {vault.userPosition!.toLocaleString()} tokens
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {userSharePercentage.toFixed(2)}% of supply
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No position</div>
            )}
          </div>
        </div>
      </CardContent>

      {/* Initialize Reclaim Button */}
      <CardFooter className="p-4 pt-0">
        <Button
          className="w-full"
          disabled={!canInitializeReclaim}
          variant={canInitializeReclaim ? 'default' : 'secondary'}
        >
          {canInitializeReclaim 
            ? 'Initialize Reclaim' 
            : `Reclaim (Need ≥${vault.minReclaimPercentage}%)`}
        </Button>
      </CardFooter>
    </Card>
  );
}

