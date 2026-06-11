'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FileText, Package } from 'lucide-react'
import { useFmt } from '@/lib/hooks/useFmt'

interface AlertItem {
  id: string
  type: 'warning' | 'danger'
  Icon: React.ElementType
  message: string
  sub?: string
}

interface Props {
  pendingCount: number
  pendingAmount: number
  lowStockCount: number
}

export default function AlertBanner({ pendingCount, pendingAmount, lowStockCount }: Props) {
  const { fmt: fmtCurrency } = useFmt()

  const initial: AlertItem[] = [
    ...(pendingCount > 0 ? [{
      id: 'pending',
      type: 'warning' as const,
      Icon: FileText,
      message: `${pendingCount} facture${pendingCount > 1 ? 's' : ''} en attente de paiement`,
      sub: pendingAmount > 0 ? `${fmtCurrency(pendingAmount)} non encaissés` : undefined,
    }] : []),
    ...(lowStockCount > 0 ? [{
      id: 'stock',
      type: 'danger' as const,
      Icon: Package,
      message: `${lowStockCount} article${lowStockCount > 1 ? 's' : ''} en rupture de stock`,
      sub: 'Réapprovisionnement urgent',
    }] : []),
  ]

  const [alerts, setAlerts] = useState(initial)
  if (alerts.length === 0) return null

  const COLORS = {
    warning: { text: '#DC2626', bg: '#DC26260C', border: '#DC262628' },
    danger:  { text: '#DC2626', bg: '#DC26260C', border: '#DC262628' },
  }

  return (
    <div className="space-y-2 mb-1">
      <AnimatePresence initial={false}>
        {alerts.map(a => {
          const c = COLORS[a.type]
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: -10, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto', marginBottom: 0 }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl border overflow-hidden"
              style={{ backgroundColor: c.bg, borderColor: c.border }}
            >
              <a.Icon size={13} style={{ color: c.text }} className="shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold" style={{ color: c.text }}>{a.message}</span>
                {a.sub && (
                  <span className="text-xs text-[var(--text-secondary)] ml-2 hidden sm:inline">{a.sub}</span>
                )}
              </div>
              <button
                onClick={() => setAlerts(prev => prev.filter(x => x.id !== a.id))}
                className="text-[var(--text-secondary)] hover:text-[var(--text-secondary)] transition-colors shrink-0 p-0.5 rounded"
              >
                <X size={13} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
