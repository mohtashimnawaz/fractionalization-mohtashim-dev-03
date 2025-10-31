'use client'

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useEffect, useState } from 'react'

function WalletDropdown() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent SSR rendering to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="wallet-adapter-button wallet-adapter-button-trigger" style={{ pointerEvents: 'none', opacity: 0.6 }}>
        Select Wallet
      </div>
    )
  }

  return <WalletMultiButton />
}

export { WalletDropdown }
