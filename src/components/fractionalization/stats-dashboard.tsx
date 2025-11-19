/**
 * Stats Dashboard Component
 * Shows platform statistics with animated counters
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Users, Coins, Activity } from 'lucide-react';
import { useVaultStore } from '@/stores/useVaultStore';

interface StatItemProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  suffix?: string;
  prefix?: string;
}

function StatItem({ label, value, icon, suffix = '', prefix = '' }: StatItemProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 2000; // 2 seconds
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      if (step < steps) {
        current += increment;
        setDisplayValue(Math.floor(current));
        step++;
      } else {
        setDisplayValue(value);
        clearInterval(timer);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <Card className="card-3d glass-effect">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{label}</p>
            <p className="text-3xl font-bold text-gradient">
              {prefix}{displayValue.toLocaleString()}{suffix}
            </p>
          </div>
          <div className="w-12 h-12 bg-gradient-blue rounded-lg flex items-center justify-center opacity-80">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatsDashboard() {
  const vaults = useVaultStore(state => state.vaults);
  const userPositions = useVaultStore(state => state.userPositions);

  const totalVaults = vaults.length;
  const activeVaults = vaults.filter(v => v.status === 0).length;
  const totalFractions = vaults.reduce((sum, v) => sum + v.totalSupply, 0);
  const userVaultsCount = Object.keys(userPositions).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 slide-up">
      <StatItem
        label="Total Vaults"
        value={totalVaults}
        icon={<Activity className="w-6 h-6 text-white" />}
      />
      <StatItem
        label="Active Vaults"
        value={activeVaults}
        icon={<TrendingUp className="w-6 h-6 text-white" />}
      />
      <StatItem
        label="Total Fractions"
        value={Math.floor(totalFractions)}
        icon={<Coins className="w-6 h-6 text-white" />}
      />
      <StatItem
        label="Your Positions"
        value={userVaultsCount}
        icon={<Users className="w-6 h-6 text-white" />}
      />
    </div>
  );
}
