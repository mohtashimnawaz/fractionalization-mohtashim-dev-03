'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useFinalizeReclaim } from '@/hooks/useFinalizeReclaim';
import type { Vault } from '@/types/vault';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon, Loader2 } from 'lucide-react';

interface FinalizeReclaimButtonProps {
  vault: Vault;
}

const RECLAIM_ESCROW_PERIOD_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds

export function FinalizeReclaimButton({ vault }: FinalizeReclaimButtonProps) {
  const { finalizeReclaim, isLoading } = useFinalizeReclaim();
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [escrowEnded, setEscrowEnded] = useState(false);
  const [open, setOpen] = useState(false);

  // Calculate escrow end time
  const escrowEndsAt = vault.reclaimInitiationTimestamp + (RECLAIM_ESCROW_PERIOD_SECONDS * 1000);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = Date.now();
      const remaining = escrowEndsAt - now;
      
      if (remaining <= 0) {
        setEscrowEnded(true);
        setTimeRemaining(0);
      } else {
        setEscrowEnded(false);
        setTimeRemaining(remaining);
      }
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [escrowEndsAt]);

  const formatTimeRemaining = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);

    if (days > 0) {
      return `${days}d ${hours}h remaining`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  };

  const handleFinalize = async (raydiumPoolId: string, observationStateId: string) => {
    await finalizeReclaim({
      vault,
      raydiumPoolId,
      observationStateId,
    });
    setOpen(false);
  };

  // TODO: Replace with actual pool ID and observation state from vault or user input
  const RAYDIUM_POOL_ID = 'YOUR_RAYDIUM_POOL_ID';
  const OBSERVATION_STATE_ID = 'YOUR_OBSERVATION_STATE_ID';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="w-full"
          size="lg"
          variant="default"
          disabled={!escrowEnded || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Finalizing...
            </>
          ) : escrowEnded ? (
            'Finalize Reclaim'
          ) : (
            `Escrow Period: ${formatTimeRemaining(timeRemaining)}`
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finalize NFT Reclaim</DialogTitle>
          <DialogDescription>
            The 7-day escrow period has ended. You can now finalize the reclaim and receive your NFT.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> By finalizing the reclaim:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Your {vault.tokensInEscrow.toLocaleString()} escrowed fraction tokens will be burned</li>
                <li>You will need to pay USDC compensation for minority holders</li>
                <li>The NFT will be transferred back to your wallet</li>
                <li>The vault will be closed permanently</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Vault ID:</span>
              <span className="text-sm font-mono">{vault.id.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">NFT:</span>
              <span className="text-sm">{vault.nftMetadata.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Tokens in Escrow:</span>
              <span className="text-sm font-semibold">{vault.tokensInEscrow.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => handleFinalize(RAYDIUM_POOL_ID, OBSERVATION_STATE_ID)}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Confirm Finalization'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
