/**
 * Cancel Reclaim Button Component
 * Allows the reclaim initiator to cancel an ongoing reclaim and get their tokens back
 */

'use client';

import { Button } from '@/components/ui/button';
import { useCancelReclaim } from '@/hooks/useCancelReclaim';
import { Loader2, XCircle } from 'lucide-react';
import type { Vault } from '@/types/vault';

interface CancelReclaimButtonProps {
  vault: Vault;
}

export function CancelReclaimButton({ vault }: CancelReclaimButtonProps) {
  const { cancelReclaim, isLoading } = useCancelReclaim();

  const handleCancel = async () => {
    await cancelReclaim({ vault });
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground space-y-2">
        <p>
          Cancel this reclaim to get your {(vault.tokensInEscrow / 1e9).toFixed(2)} escrowed tokens back.
        </p>
        <p className="text-yellow-600 dark:text-yellow-500">
          <strong>Note:</strong> A 100 USDC cancellation fee will be charged to the treasury.
        </p>
      </div>

      <Button
        onClick={handleCancel}
        disabled={isLoading}
        variant="destructive"
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cancelling Reclaim...
          </>
        ) : (
          <>
            <XCircle className="mr-2 h-4 w-4" />
            Cancel Reclaim (100 USDC Fee)
          </>
        )}
      </Button>
    </div>
  );
}
