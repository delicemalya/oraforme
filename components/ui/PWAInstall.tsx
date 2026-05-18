'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, Smartphone } from 'lucide-react'

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
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#F0A30A] flex items-center justify-center shrink-0">
              <Smartphone size={20} className="text-[#0D1117]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#111827]">Installer Oraforme</p>
              <p className="text-xs text-[#4B5563] mt-0.5 leading-relaxed">
                Accédez rapidement depuis votre écran d'accueil, même hors ligne.
              </p>
            </div>
            <button onClick={dismiss} className="text-[#6B7280] hover:text-[#4B5563] transition-colors shrink-0">
              <X size={16} />
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={dismiss} className="flex-1 py-2 text-xs text-[#4B5563] bg-[#F0F4FF] border border-[#E2E8F0] rounded-xl hover:border-[#8B0073] transition-all">
              Plus tard
            </button>
            <button onClick={install} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-[#0D1117] bg-[#F0A30A] rounded-xl hover:bg-[#E09000] transition-all">
              <Download size={13} /> Installer
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
