/**
 * Main navigation bar component
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletDropdown } from '@/components/wallet-dropdown';

export function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { label: 'Explorer', path: '/' },
    { label: 'Fractionalize', path: '/fractionalize' },
    { label: 'Activity', path: '/redemption' },
  ];

  const isActive = (path: string) => {
    return path === '/' ? pathname === '/' : pathname.startsWith(path);
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b glass-effect backdrop-blur-xl shadow-lg shadow-blue-500/5">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="w-8 h-8 bg-gradient-blue rounded-lg flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300">
              <span className="text-white font-bold">N</span>
            </div>
            <span className="text-xl font-bold text-gradient">NFT Fractionalization</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                className={`text-sm font-medium transition-all hover:text-primary relative group ${
                  isActive(link.path)
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {link.label}
                <span className={`absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-blue transition-all duration-300 group-hover:w-full ${
                  isActive(link.path) ? 'w-full' : ''
                }`} />
              </Link>
            ))}
          </div>

          {/* Wallet */}
          <div className="flex items-center space-x-4">
            <WalletDropdown />
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden flex space-x-4 pb-3">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              href={link.path}
              className={`text-sm font-medium transition-all hover:text-primary relative group ${
                isActive(link.path)
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {link.label}
              <span className={`absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-blue transition-all duration-300 group-hover:w-full ${
                isActive(link.path) ? 'w-full' : ''
              }`} />
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
