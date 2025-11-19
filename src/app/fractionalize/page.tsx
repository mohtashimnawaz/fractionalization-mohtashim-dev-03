/**
 * Fractionalization page - Fractionalize your NFTs
 */

'use client';

import { FractionalizationWorkflow } from '@/components/fractionalization/fractionalization-workflow';
import { Coins, Sparkles } from 'lucide-react';

export default function FractionalizePage() {
  return (
    <div className="relative">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-40 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center slide-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-full mb-4 glass-effect">
            <Coins className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">NFT Fractionalization</span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-gradient float-animation">
            Fractionalize Your NFT
          </h1>
          <p className="text-muted-foreground text-lg">
            Convert your NFT into fractional tokens and unlock liquidity
          </p>
        </div>
        
        <div className="scale-in">
          <FractionalizationWorkflow />
        </div>
      </div>
    </div>
  );
}
