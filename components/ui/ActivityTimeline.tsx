'use client'

import { motion } from 'framer-motion'
import { FileText, CheckCircle, Clock, Send } from 'lucide-react'
import Link from 'next/link'

export interface ActivityItem {
  id: string
  client_nom: string
  total: number
  statut: string
  created_at: string
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const j = Math.floor(diff / 86400000)
  if (m < 60) return `il y a ${m}min`
  if (h < 24) return `il y a ${h}h`
  return `il y a ${j}j`
}

const STATUT: Record<string, { label: string; color: string; Icon: React.ElementType; action: string }> = {
  brouillon: { label: 'Brouillon',  color: '#8B949E', Icon: Clock,        action: 'créé un brouillon' },
  envoyee:   { label: 'Envoyée',   color: '#F51E33', Icon: Send,         action: 'envoyé une facture' },
  payee:     { label: 'Payée',     color: '#142850', Icon: CheckCircle,  action: 'reçu un paiement' },
  annulee:   { label: 'Annulée',  color: '#F51E33', Icon: FileText,     action: 'annulé une facture' },
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n))
}

export default function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <div className="w-10 h-10 rounded-full bg-[var(--surface-alt)] flex items-center justify-center">
          <FileText size={18} className="text-[var(--text-secondary)]" />
        </div>
        <p className="text-xs text-[var(--text-secondary)]">Aucune activité récente</p>
        <Link href="/dashboard/facturation" className="text-xs text-[#F51E33] hover:underline mt-1">
          Créer une facture →
        </Link>
      </div>
    )
  }

  return (
    <div>
      {items.map((item, i) => {
        const st = STATUT[item.statut] ?? STATUT.brouillon
        const { Icon } = st
        const initials = (item.client_nom ?? 'C')
          .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.38, delay: i * 0.06, ease: [0.23, 1, 0.32, 1] }}
            className="flex items-start gap-3 py-3 border-b border-[var(--border)] last:border-0 hover:bg-white/5/30 px-1 -mx-1 rounded-lg transition-colors"
          >
            {/* Colored avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
              style={{ backgroundColor: `${st.color}1C`, color: st.color }}
            >
              {initials}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs text-[var(--text)] font-semibold truncate">{item.client_nom}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Icon size={10} style={{ color: st.color }} className="shrink-0" />
                <span className="text-[10px]" style={{ color: st.color }}>{st.action}</span>
                <span className="text-[10px] text-[var(--text-secondary)]">·</span>
                <span className="text-[10px] font-semibold text-[var(--text-secondary)]">{fmt(item.total)} FCFA</span>
              </div>
            </div>

            <span className="text-[10px] text-[var(--text-secondary)] shrink-0 mt-0.5 whitespace-nowrap">
              {timeAgo(item.created_at)}
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}
