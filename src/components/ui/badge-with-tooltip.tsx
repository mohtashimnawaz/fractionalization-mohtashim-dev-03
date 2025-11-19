/**
 * Enhanced Badge with Tooltip
 */

'use client';

import { useState } from 'react';
import { Badge } from './badge';

interface BadgeWithTooltipProps {
  children: React.ReactNode;
  tooltip: string;
  className?: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

export function BadgeWithTooltip({ 
  children, 
  tooltip, 
  className = '',
  variant = 'default'
}: BadgeWithTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative inline-block">
      <Badge
        variant={variant}
        className={`${className} cursor-help`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {children}
      </Badge>
      
      {showTooltip && (
        <div className="absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap animate-in fade-in slide-in-from-bottom-2">
          {tooltip}
          <div className="absolute w-2 h-2 bg-gray-900 transform rotate-45 -bottom-1 left-1/2 -translate-x-1/2" />
        </div>
      )}
    </div>
  );
}
