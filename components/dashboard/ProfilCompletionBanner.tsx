'use client'

import { useState, useEffect } from 'react'
import { Clock, X, ChevronRight } from 'lucide-react'
import { useTenant } from '@/lib/hooks/useTenant'

interface Props {
  onOpen: () => void
}

function useCountdown(deadline: string | null): { hours: number; minutes: number; expired: boolean } {
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (!deadline) return { hours: 0, minutes: 0, expired: false }

  const diff = new Date(deadline).getTime() - now
  if (diff <= 0) return { hours: 0, minutes: 0, expired: true }

  const hours   = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return { hours, minutes, expired: false }
}

// Urgency level based on remaining time
function urgency(hours: number, expired: boolean): 'critical' | 'warning' | 'info' {
  if (expired || hours < 24) return 'critical'
  if (hours < 48)            return 'warning'
  return 'info'
}

const URGENCY_STYLES = {
  info:     { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', badge: '#F59E0B', badgeTxt: 'white'   },
  warning:  { bg: '#FFF7ED', border: '#FED7AA', text: '#9A3412', badge: '#EA580C', badgeTxt: 'white'   },
  critical: { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', badge: '#DC2626', badgeTxt: 'white'   },
}

export default function ProfilCompletionBanner({ onOpen }: Props) {
  const { profilComplet, companyDeadline, loading } = useTenant()
  const [dismissed, setDismissed] = useState(false)
  const { hours, minutes, expired } = useCountdown(companyDeadline)

  // Don't render if: loading, profile complete, or dismissed
  if (loading || profilComplet || dismissed) return null

  const level = urgency(hours, expired)
  const s     = URGENCY_STYLES[level]

  const timeLabel = expired
    ? 'Délai dépassé'
    : hours >= 1
      ? `${hours}h${minutes > 0 ? ` ${minutes}min` : ''} restantes`
      : `${minutes} minutes restantes`

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]"
      style={{ background: s.bg, borderBottom: `1px solid ${s.border}` }}>

      {/* Left — clock + message */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <Clock size={14} style={{ color: s.badge }} />
          <span className="font-black text-[12px] px-1.5 py-0.5 rounded-md text-white"
            style={{ background: s.badge }}>
            {timeLabel}
          </span>
        </div>
        <p className="truncate" style={{ color: s.text }}>
          {expired
            ? 'Complétez votre entreprise pour accéder à toutes les fonctionnalités.'
            : 'Complétez votre entreprise — logo, adresse, dirigeant, documents...'}
        </p>
      </div>

      {/* Right — CTA + dismiss */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpen}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-black text-white transition-all hover:opacity-90"
          style={{ background: s.badge }}>
          Finaliser mon entreprise <ChevronRight size={12} />
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-lg hover:bg-black/5 transition-all"
          title="Masquer (temporairement)">
          <X size={13} style={{ color: s.text }} />
        </button>
      </div>
    </div>
  )
}
