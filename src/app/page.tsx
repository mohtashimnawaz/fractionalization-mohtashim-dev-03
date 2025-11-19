/**
 * Home page - Vault Explorer (default route)
 */

'use client';

import { VaultExplorer } from '@/components/fractionalization/vault-explorer';
import { FloatingActionButton } from '@/components/floating-action-button';
import { Sparkles, TrendingUp, Shield } from 'lucide-react';

export default function Home() {
  return (
    <div className="relative">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Hero Section with 3D Effects */}
        <div className="mb-12 text-center perspective-container">
          <div className="slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-full mb-6 glass-effect">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">NFT Fractionalization Platform</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-4 text-gradient float-animation">
              Vault Explorer
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Browse and explore fractionalized NFT vaults. Own a piece of valuable NFTs through fractional ownership.
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <div className="glass-effect px-6 py-3 rounded-full flex items-center gap-2 hover:scale-105 transition-transform duration-300 card-3d">
                <Shield className="w-5 h-5 text-blue-500" />
                <span className="font-medium">Secure & Transparent</span>
              </div>
              <div className="glass-effect px-6 py-3 rounded-full flex items-center gap-2 hover:scale-105 transition-transform duration-300 card-3d">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                <span className="font-medium">Liquid Markets</span>
              </div>
              <div className="glass-effect px-6 py-3 rounded-full flex items-center gap-2 hover:scale-105 transition-transform duration-300 card-3d">
                <Sparkles className="w-5 h-5 text-blue-500" />
                <span className="font-medium">Premium NFTs</span>
              </div>
            </div>
          </div>
        </div>

        {/* Vault Explorer with animation */}
        <div className="scale-in">
          <VaultExplorer />
        </div>
      </div>

      {/* Floating Action Button */}
      <FloatingActionButton />
    </div>
  );
}
