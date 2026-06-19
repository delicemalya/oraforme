'use client'

import { useState, useEffect } from 'react'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'

export default function OfflineIndicator() {
  const [isOnline, setIsOnline]     = useState(true)
  const [showBack, setShowBack]     = useState(false)
  const [mounted,  setMounted]      = useState(false)

  useEffect(() => {
    setMounted(true)
    setIsOnline(navigator.onLine)

    const handleOffline = () => {
      setIsOnline(false)
      setShowBack(false)
    }

    const handleOnline = () => {
      setIsOnline(true)
      setShowBack(true)
      setTimeout(() => setShowBack(false), 4000)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online',  handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online',  handleOnline)
    }
  }, [])

  if (!mounted) return null

  // Reconnecté — banner vert temporaire
  if (showBack && isOnline) {
    return (
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-lg text-white text-sm font-semibold"
        style={{ background: '#16A34A', minWidth: 240, animation: 'slideUp 0.3s ease' }}
      >
        <Wifi size={15} />
        Connexion rétablie — données synchronisées ✓
      </div>
    )
  }

  // Hors ligne — banner rouge permanent
  if (!isOnline) {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-3 text-white text-sm"
        style={{ background: '#DC2626' }}
      >
        <div className="flex items-center gap-2 font-semibold">
          <WifiOff size={15} className="shrink-0" />
          Hors ligne — les données seront synchronisées à la reconnexion
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          <RefreshCw size={12} /> Réessayer
        </button>
      </div>
    )
  }

  return null
}
