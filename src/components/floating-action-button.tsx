/**
 * Floating Action Button for Quick Actions
 */

'use client';

import { useState } from 'react';
import { Plus, Sparkles, RefreshCw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const actions = [
    {
      icon: <Sparkles className="w-5 h-5" />,
      label: 'Fractionalize NFT',
      onClick: () => router.push('/fractionalize'),
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      label: 'View Activity',
      onClick: () => router.push('/redemption'),
      color: 'bg-purple-500 hover:bg-purple-600',
    },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col-reverse items-end gap-3">
      {/* Action buttons */}
      {isOpen && (
        <div className="flex flex-col-reverse gap-3 slide-up">
          {actions.map((action, index) => (
            <Button
              key={index}
              onClick={() => {
                action.onClick();
                setIsOpen(false);
              }}
              className={`${action.color} text-white shadow-lg hover:shadow-xl transition-all duration-300 group`}
              size="lg"
            >
              {action.icon}
              <span className="ml-2">{action.label}</span>
            </Button>
          ))}
        </div>
      )}

      {/* Main FAB */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-gradient-blue text-white shadow-lg hover:shadow-2xl transition-all duration-300 group p-0"
        size="icon"
      >
        <div className={`transition-transform duration-300 ${isOpen ? 'rotate-45' : 'rotate-0'}`}>
          {isOpen ? <Plus className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </div>
      </Button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm -z-10 animate-in fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
