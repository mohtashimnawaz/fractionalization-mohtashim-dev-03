/**
 * Step 2: Configure fractionalization parameters
 */

'use client';

import { useState } from 'react';
import { useFractionalizationStore } from '@/stores';
import { useFractionalizeCNFT } from '@/hooks/use-fractionalize-cnft';
import { FractionalizationStep } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function ConfigureTokensStep() {
  const router = useRouter();
  const { formData, setStep, resetForm } = useFractionalizationStore();
  const { fractionalize, isPending } = useFractionalizeCNFT();

  const [totalSupply, setTotalSupply] = useState(formData.totalSupply || '1000000');
  const [minLpAgeSeconds, setMinLpAgeSeconds] = useState(formData.minLpAgeSeconds || '');
  const [minReclaimPercent, setMinReclaimPercent] = useState(formData.minReclaimPercent || '');
  const [minLiquidityPercent, setMinLiquidityPercent] = useState(formData.minLiquidityPercent || '');
  const [minVolumePercent30d, setMinVolumePercent30d] = useState(formData.minVolumePercent30d || '');

  const handleBack = () => {
    setStep(FractionalizationStep.SelectNFT);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nftMint || !totalSupply) {
      return;
    }

    fractionalize({
      assetId: formData.nftMint,
      totalSupply,
      minLpAgeSeconds: minLpAgeSeconds || null,
      minReclaimPercent: minReclaimPercent || null,
      minLiquidityPercent: minLiquidityPercent || null,
      minVolumePercent30d: minVolumePercent30d || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {/* Total Supply - Required */}
        <div className="space-y-2">
          <Label htmlFor="totalSupply" className="flex items-center gap-1">
            Total Supply <span className="text-destructive">*</span>
          </Label>
          <Input
            id="totalSupply"
            type="number"
            placeholder="1000000"
            value={totalSupply}
            onChange={(e) => setTotalSupply(e.target.value)}
            min="1"
            required
          />
          <p className="text-xs text-muted-foreground">
            Total number of fractional tokens to create (with 9 decimals)
          </p>
        </div>

        {/* Optional Parameters */}
        <div className="pt-2 border-t">
          <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
            Optional Parameters
          </h4>

          <div className="space-y-4">
            {/* Min LP Age Seconds */}
            <div className="space-y-2">
              <Label htmlFor="minLpAgeSeconds">
                Minimum LP Age (seconds)
              </Label>
              <Input
                id="minLpAgeSeconds"
                type="number"
                placeholder="e.g., 86400 (1 day)"
                value={minLpAgeSeconds}
                onChange={(e) => setMinLpAgeSeconds(e.target.value)}
                min="0"
              />
              <p className="text-xs text-muted-foreground">
                Minimum age of the liquidity pool before reclaim is allowed
              </p>
            </div>

            {/* Min Reclaim Percent */}
            <div className="space-y-2">
              <Label htmlFor="minReclaimPercent">
                Minimum Reclaim Percentage (%)
              </Label>
              <Input
                id="minReclaimPercent"
                type="number"
                placeholder="e.g., 51"
                value={minReclaimPercent}
                onChange={(e) => setMinReclaimPercent(e.target.value)}
                min="0"
                max="100"
              />
              <p className="text-xs text-muted-foreground">
                Minimum % of tokens needed to reclaim the NFT (0-100)
              </p>
            </div>

            {/* Min Liquidity Percent */}
            <div className="space-y-2">
              <Label htmlFor="minLiquidityPercent">
                Minimum Liquidity Percentage (%)
              </Label>
              <Input
                id="minLiquidityPercent"
                type="number"
                placeholder="e.g., 20"
                value={minLiquidityPercent}
                onChange={(e) => setMinLiquidityPercent(e.target.value)}
                min="0"
                max="100"
              />
              <p className="text-xs text-muted-foreground">
                Minimum % of liquidity required in the pool (0-100)
              </p>
            </div>

            {/* Min Volume Percent 30d */}
            <div className="space-y-2">
              <Label htmlFor="minVolumePercent30d">
                Minimum 30-Day Volume Percentage (%)
              </Label>
              <Input
                id="minVolumePercent30d"
                type="number"
                placeholder="e.g., 10"
                value={minVolumePercent30d}
                onChange={(e) => setMinVolumePercent30d(e.target.value)}
                min="0"
                max="100"
              />
              <p className="text-xs text-muted-foreground">
                Minimum % of 30-day trading volume required (0-100)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-muted rounded-lg p-4 space-y-2">
        <h4 className="font-semibold text-sm">Summary</h4>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Supply:</span>
            <span className="font-medium">
              {totalSupply ? Number(totalSupply).toLocaleString() : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Protocol Fee:</span>
            <span className="font-medium">5%</span>
          </div>
          {minLpAgeSeconds && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Min LP Age:</span>
              <span className="font-medium">{minLpAgeSeconds}s</span>
            </div>
          )}
          {minReclaimPercent && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Min Reclaim %:</span>
              <span className="font-medium">{minReclaimPercent}%</span>
            </div>
          )}
          {minLiquidityPercent && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Min Liquidity %:</span>
              <span className="font-medium">{minLiquidityPercent}%</span>
            </div>
          )}
          {minVolumePercent30d && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Min 30d Volume %:</span>
              <span className="font-medium">{minVolumePercent30d}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={isPending}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={isPending || !totalSupply}
          className="flex-1"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fractionalizing...
            </>
          ) : (
            'Fractionalize NFT'
          )}
        </Button>
      </div>
    </form>
  );
}