/**
 * Step 2: Configure fractionalization parameters
 */

'use client';

import { useState } from 'react';
import { useFractionalizationStore } from '@/stores';
import { useFractionalizeCNFT } from '@/hooks';
import { FractionalizationStep } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Validation constants
const MIN_SUPPLY = 1;
const MAX_SUPPLY = 1_000_000_000; // 1 billion
const MIN_PERCENT = 0;
const MAX_PERCENT = 100;

export function ConfigureTokensStep() {
  const { formData, setStep } = useFractionalizationStore();
  const fractionalizeHook = useFractionalizeCNFT();
  const { fractionalize, isPending, isSuccess } = fractionalizeHook;

  const [totalSupply, setTotalSupply] = useState(String(formData.totalSupply || 1000000));
  const [minLpAgeSeconds, setMinLpAgeSeconds] = useState(String(formData.minLpAgeSeconds || ''));
  const [minReclaimPercent, setMinReclaimPercent] = useState(String(formData.minReclaimPercentage || ''));
  const [minLiquidityPercent, setMinLiquidityPercent] = useState(String(formData.minLiquidityPercent || ''));
  const [minVolumePercent30d, setMinVolumePercent30d] = useState(String(formData.minVolumePercent30d || ''));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleBack = () => {
    setStep(FractionalizationStep.SelectNFT);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate total supply
    const supplyNum = parseInt(totalSupply);
    if (isNaN(supplyNum) || supplyNum < MIN_SUPPLY) {
      newErrors.totalSupply = `Total supply must be at least ${MIN_SUPPLY.toLocaleString()}`;
    } else if (supplyNum > MAX_SUPPLY) {
      newErrors.totalSupply = `Total supply cannot exceed ${MAX_SUPPLY.toLocaleString()}`;
    }

    // Validate percentages
    if (minReclaimPercent) {
      const percent = parseInt(minReclaimPercent);
      if (isNaN(percent) || percent < MIN_PERCENT || percent > MAX_PERCENT) {
        newErrors.minReclaimPercent = `Must be between ${MIN_PERCENT} and ${MAX_PERCENT}`;
      }
    }

    if (minLiquidityPercent) {
      const percent = parseInt(minLiquidityPercent);
      if (isNaN(percent) || percent < MIN_PERCENT || percent > MAX_PERCENT) {
        newErrors.minLiquidityPercent = `Must be between ${MIN_PERCENT} and ${MAX_PERCENT}`;
      }
    }

    if (minVolumePercent30d) {
      const percent = parseInt(minVolumePercent30d);
      if (isNaN(percent) || percent < MIN_PERCENT || percent > MAX_PERCENT) {
        newErrors.minVolumePercent30d = `Must be between ${MIN_PERCENT} and ${MAX_PERCENT}`;
      }
    }

    // Validate LP age
    if (minLpAgeSeconds) {
      const seconds = parseInt(minLpAgeSeconds);
      if (isNaN(seconds) || seconds < 0) {
        newErrors.minLpAgeSeconds = 'Must be a positive number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nftMint || !totalSupply) {
      return;
    }

    if (!validateForm()) {
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
      {isSuccess && (
        <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <AlertCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Fractionalization successful! Check your wallet for the fractional tokens.
          </AlertDescription>
        </Alert>
      )}

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
            onChange={(e) => {
              setTotalSupply(e.target.value);
              if (errors.totalSupply) {
                setErrors((prev) => ({ ...prev, totalSupply: '' }));
              }
            }}
            min={MIN_SUPPLY}
            max={MAX_SUPPLY}
            required
            className={errors.totalSupply ? 'border-destructive' : ''}
          />
          {errors.totalSupply ? (
            <p className="text-xs text-destructive">{errors.totalSupply}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Range: {MIN_SUPPLY.toLocaleString()} - {MAX_SUPPLY.toLocaleString()} tokens (9 decimals)
            </p>
          )}
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
                onChange={(e) => {
                  setMinLpAgeSeconds(e.target.value);
                  if (errors.minLpAgeSeconds) {
                    setErrors((prev) => ({ ...prev, minLpAgeSeconds: '' }));
                  }
                }}
                min="0"
                className={errors.minLpAgeSeconds ? 'border-destructive' : ''}
              />
              {errors.minLpAgeSeconds ? (
                <p className="text-xs text-destructive">{errors.minLpAgeSeconds}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Minimum age of the liquidity pool before reclaim is allowed
                </p>
              )}
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
                onChange={(e) => {
                  setMinReclaimPercent(e.target.value);
                  if (errors.minReclaimPercent) {
                    setErrors((prev) => ({ ...prev, minReclaimPercent: '' }));
                  }
                }}
                min={MIN_PERCENT}
                max={MAX_PERCENT}
                className={errors.minReclaimPercent ? 'border-destructive' : ''}
              />
              {errors.minReclaimPercent ? (
                <p className="text-xs text-destructive">{errors.minReclaimPercent}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Range: {MIN_PERCENT}-{MAX_PERCENT}% - Minimum % of tokens needed to reclaim the NFT
                </p>
              )}
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
                onChange={(e) => {
                  setMinLiquidityPercent(e.target.value);
                  if (errors.minLiquidityPercent) {
                    setErrors((prev) => ({ ...prev, minLiquidityPercent: '' }));
                  }
                }}
                min={MIN_PERCENT}
                max={MAX_PERCENT}
                className={errors.minLiquidityPercent ? 'border-destructive' : ''}
              />
              {errors.minLiquidityPercent ? (
                <p className="text-xs text-destructive">{errors.minLiquidityPercent}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Range: {MIN_PERCENT}-{MAX_PERCENT}% - Minimum % of liquidity required in the pool
                </p>
              )}
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
                onChange={(e) => {
                  setMinVolumePercent30d(e.target.value);
                  if (errors.minVolumePercent30d) {
                    setErrors((prev) => ({ ...prev, minVolumePercent30d: '' }));
                  }
                }}
                min={MIN_PERCENT}
                max={MAX_PERCENT}
                className={errors.minVolumePercent30d ? 'border-destructive' : ''}
              />
              {errors.minVolumePercent30d ? (
                <p className="text-xs text-destructive">{errors.minVolumePercent30d}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Range: {MIN_PERCENT}-{MAX_PERCENT}% - Minimum % of 30-day trading volume required
                </p>
              )}
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