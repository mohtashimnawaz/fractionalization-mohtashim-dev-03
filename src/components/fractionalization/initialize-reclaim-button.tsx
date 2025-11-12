/**
 * Initialize Reclaim Button with Confirmation Modal
 * Shows different UI for 100% vs majority ownership
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, Lock, Zap } from 'lucide-react';
import { Vault } from '@/types';
import { useInitializeReclaim } from '@/hooks/useInitializeReclaim';
import { Badge } from '@/components/ui/badge';

interface InitializeReclaimButtonProps {
  vault: Vault;
  userBalance: number;
}

export function InitializeReclaimButton({ vault, userBalance }: InitializeReclaimButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { initializeReclaim, isLoading } = useInitializeReclaim();

  const totalSupply = vault.totalSupply;
  const userPercentage = (userBalance / totalSupply) * 100;
  const hasFullOwnership = userPercentage >= 99.99; // Account for floating point precision

  const formatTokenAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const handleInitializeReclaim = async () => {
    try {
      await initializeReclaim(vault.id, vault.nftAssetId);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to initialize reclaim:', error);
      // Error is already handled in the hook with toast
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsModalOpen(true)}
        disabled={isLoading}
        className="gap-2"
        size="lg"
      >
        {hasFullOwnership ? (
          <>
            <Zap className="h-4 w-4" />
            Reclaim NFT (Instant)
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" />
            Initialize Reclaim
          </>
        )}
      </Button>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {hasFullOwnership ? (
                <>
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Instant NFT Reclaim
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5 text-blue-500" />
                  Initialize Reclaim Process
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {hasFullOwnership 
                ? 'You own 100% of the fractions. Your cNFT will be transferred immediately.'
                : 'You own the majority of fractions. Your tokens will be locked during the reclaim period.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* User Position Summary */}
            <div className="rounded-lg border border-gray-700 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Your Balance</span>
                <span className="font-bold">
                  {formatTokenAmount(userBalance)} Tokens
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Ownership</span>
                <Badge variant={hasFullOwnership ? "default" : "secondary"}>
                  {userPercentage.toFixed(2)}%
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Required</span>
                <span className="text-sm">
                  {vault.minReclaimPercentage}% minimum
                </span>
              </div>
            </div>

            {/* Process Explanation */}
            {hasFullOwnership ? (
              <Alert className="bg-green-500/10 border-green-500/20">
                <Zap className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-sm">
                  <strong>Instant Transfer:</strong> Since you own 100% of the fractions, your cNFT will be transferred immediately. All fraction tokens will be burned, and no escrow period is required.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Alert className="bg-blue-500/10 border-blue-500/20">
                  <Lock className="h-4 w-4 text-blue-500" />
                  <AlertDescription className="text-sm space-y-2">
                    <strong>Escrow Period:</strong> Your {formatTokenAmount(userBalance)} tokens will be locked in an escrow account for the reclaim period.
                    
                    <ul className="list-disc list-inside space-y-1 mt-2 text-xs">
                      <li>Duration: Configurable escrow period</li>
                      <li>After the period ends, you can finalize the reclaim</li>
                      <li>You can cancel anytime (100 USDC fee applies)</li>
                      <li>Minority holders can redeem their tokens for compensation</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    During the escrow period, your tokens will be locked and cannot be transferred or traded.
                  </AlertDescription>
                </Alert>
              </>
            )}

            {/* NFT Info */}
            <div className="rounded-lg border border-gray-700 p-4">
              <div className="flex items-center gap-3">
                {vault.nftMetadata?.image && (
                  <img 
                    src={vault.nftMetadata.image} 
                    alt={vault.nftMetadata.name}
                    className="w-16 h-16 rounded object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {vault.nftMetadata?.name || 'Unknown NFT'}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {vault.nftAssetId.slice(0, 12)}...{vault.nftAssetId.slice(-12)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleInitializeReclaim}
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : hasFullOwnership ? (
                'Reclaim Now'
              ) : (
                'Lock Tokens & Start Reclaim'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
