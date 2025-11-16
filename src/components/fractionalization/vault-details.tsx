/**
 * Vault details component - Display detailed vault information
 */

'use client';

import { useVaultDetails, useUserBalance } from '@/hooks';
import { useWallet } from '@solana/wallet-adapter-react';
import { useVaultStore } from '@/stores/useVaultStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { VaultStatus } from '@/types';
import { CNFTImage } from './cnft-image';
import { InitializeReclaimButton } from './initialize-reclaim-button';
import { FinalizeReclaimButton } from './finalize-reclaim-button';

interface VaultDetailsProps {
  vaultId: string;
}

const statusColors: Record<VaultStatus, string> = {
  [VaultStatus.Active]: 'bg-green-500/10 text-green-500',
  [VaultStatus.ReclaimInitiated]: 'bg-yellow-500/10 text-yellow-500',
  [VaultStatus.ReclaimedFinalized]: 'bg-blue-500/10 text-blue-500',
  [VaultStatus.Closed]: 'bg-gray-500/10 text-gray-500',
};

export function VaultDetails({ vaultId }: VaultDetailsProps) {
  const { publicKey } = useWallet();
  const { data: vault, isLoading, error } = useVaultDetails(vaultId);
  
  // Get user positions from vault store instead of useUserBalance
  const userPositions = useVaultStore(state => state.userPositions);
  
  // Get the balance for this specific vault's fraction mint
  const userBalance = vault?.fractionMint ? userPositions[vault.fractionMint] : undefined;

  // Debug logging
  console.log('=== VAULT DETAILS DEBUG ===');
  console.log('isLoading:', isLoading);
  console.log('Vault:', vault);
  console.log('Vault Status:', vault?.status);
  console.log('VaultStatus.ReclaimInitiated:', VaultStatus.ReclaimInitiated);
  console.log('Status Match:', vault?.status === VaultStatus.ReclaimInitiated);
  console.log('Public Key:', publicKey?.toBase58());
  console.log('Reclaim Initiator:', vault?.reclaimInitiator);
  console.log('Initiator Match:', vault?.reclaimInitiator === publicKey?.toBase58());
  console.log('========================');

  if (isLoading) {
    console.log('⚠️ STUCK IN LOADING STATE - vault exists but isLoading is true');
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !vault) {
    return (
      <div className="text-center py-20">
        <p className="text-destructive">Vault not found</p>
        <Link href="/explorer">
          <Button variant="link" className="mt-4">
            Back to Explorer
          </Button>
        </Link>
      </div>
    );
  }

  const userSharePercentage = userBalance
    ? (userBalance / vault.totalSupply) * 100
    : 0;

  const meetsReclaimThreshold = userSharePercentage >= vault.minReclaimPercentage;

  // Debug logging
  console.log('🔍 VaultDetails Debug:', {
    vaultId,
    walletConnected: !!publicKey,
    walletAddress: publicKey?.toBase58(),
    fractionMint: vault.fractionMint,
    hasBalance: !!userBalance,
    balance: userBalance,
    userSharePercentage,
    minRequired: vault.minReclaimPercentage,
    meetsThreshold: meetsReclaimThreshold,
    vaultStatus: vault.status,
    VaultStatusActive: VaultStatus.Active,
  });

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/explorer">
        <Button variant="ghost" size="sm">
          ← Back to Explorer
        </Button>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* NFT Image & Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{vault.nftMetadata.name}</CardTitle>
              <Badge className={statusColors[vault.status]} variant="secondary">
                {vault.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
              <CNFTImage
                imageUrl={vault.nftMetadata.image}
                name={vault.nftMetadata.name}
                className="absolute inset-0"
              />
            </div>
            {vault.nftMetadata.description && (
              <p className="text-sm text-muted-foreground">
                {vault.nftMetadata.description}
              </p>
            )}
            {vault.nftMetadata.attributes && vault.nftMetadata.attributes.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Attributes</h4>
                <div className="grid grid-cols-2 gap-2">
                  {vault.nftMetadata.attributes.map((attr, idx) => (
                    <div
                      key={idx}
                      className="bg-muted rounded-lg p-2 text-sm"
                    >
                      <div className="text-muted-foreground text-xs">
                        {attr.trait_type}
                      </div>
                      <div className="font-medium">{attr.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vault Stats */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Vault Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Supply</span>
                  <span className="font-medium">{vault.totalSupply.toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Created</span>
                  <span>{new Date(vault.creationTimestamp).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Creator</span>
                  <span className="font-mono text-xs">{vault.creator.slice(0, 4)}...{vault.creator.slice(-4)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* User Position */}
          {publicKey && userBalance && (
            <Card>
              <CardHeader>
                <CardTitle>Your Position</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Your Balance</span>
                    <span className="font-medium">{userBalance.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Your Share</span>
                    <span className="font-medium">{userSharePercentage.toFixed(4)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reclaim Eligibility</span>
                    <Badge variant={meetsReclaimThreshold ? "default" : "destructive"}>
                      {meetsReclaimThreshold ? 'Eligible' : `Need ${vault.minReclaimPercentage}%`}
                    </Badge>
                  </div>
                </div>
                <div className="pt-4 space-y-2">
                  {/* Initialize Reclaim Button - Only show if Active and meets threshold */}
                  {vault.status === VaultStatus.Active && meetsReclaimThreshold && userBalance && (
                    <InitializeReclaimButton 
                      vault={vault}
                      userBalance={userBalance}
                    />
                  )}

                  {/* Old Reclaim Link - Keep for backwards compatibility */}
                  {vault.status === VaultStatus.Active && !meetsReclaimThreshold && (
                    <Button 
                      className="w-full" 
                      size="lg"
                      disabled
                    >
                      Reclaim NFT (Need ≥{vault.minReclaimPercentage}%)
                    </Button>
                  )}

                  {/* Redeem CTA: appears only after original NFT has been reclaimed (Redeemable status) */}
                  {vault.status === VaultStatus.ReclaimedFinalized && (
                    <Link href={`/redeem?vault=${vault.id}`}>
                      <Button className="w-full" size="lg" variant="outline">
                        Redeem for USDC
                      </Button>
                    </Link>
                  )}

                  <Link href="/redemption">
                    <Button className="w-full" size="lg" variant="ghost">
                      View Activity History
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Finalize Reclaim Button - Shows for reclaim initiator (no balance check needed) */}
          {vault.status === VaultStatus.ReclaimInitiated && 
           publicKey && 
           vault.reclaimInitiator === publicKey.toBase58() && (
            <Card>
              <CardHeader>
                <CardTitle>Finalize Reclaim</CardTitle>
              </CardHeader>
              <CardContent>
                <FinalizeReclaimButton vault={vault} />
              </CardContent>
            </Card>
          )}

          {/* Reclaim Actions - Show even without balance */}
          {publicKey && !userBalance && vault.status === VaultStatus.Active && (
            <Card>
              <CardHeader>
                <CardTitle>Reclaim Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  You need to own at least {vault.minReclaimPercentage}% of the fraction tokens to initialize reclaim.
                </p>
                <Button className="w-full" disabled>
                  No Tokens Owned
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Connect Wallet Prompt */}
          {!publicKey && vault.status === VaultStatus.Active && (
            <Card>
              <CardHeader>
                <CardTitle>Reclaim Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Connect your wallet to see your position and reclaim options.
                </p>
                <Button className="w-full" disabled>
                  Connect Wallet to Reclaim
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-between" asChild>
                <a
                  href={vault.nftMetadata.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Metadata
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
