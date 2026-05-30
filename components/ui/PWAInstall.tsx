'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }

    const dismissed = localStorage.getItem('pwa_dismissed')
    if (dismissed) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setTimeout(() => setShow(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setShow(false)
    setDeferredPrompt(null)
  }

  const dismiss = () => {
    setShow(false)
    localStorage.setItem('pwa_dismissed', '1')
  }

  if (installed || !show) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 80 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-[360px] z-50"
      >
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Oraforme" className="w-11 h-11 rounded-xl object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[var(--text)]">Installer Oraforme</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                Accédez rapidement depuis votre écran d&apos;accueil, même hors ligne.
              </p>
            </div>
            <button onClick={dismiss} className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors shrink-0">
              <X size={16} />
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={dismiss} className="flex-1 py-2 text-xs font-semibold text-[var(--text-secondary)] bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl hover:border-gray-400 transition-all">
              Plus tard
            </button>
            <button onClick={install} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-white bg-[#DC2626] hover:bg-[#B91C1C] rounded-xl transition-all">
              <Download size={13} /> Installer
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
