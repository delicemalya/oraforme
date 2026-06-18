'use client'

import { useMemo } from 'react'
import { AlertTriangle, Clock, CheckCircle2, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { getEcheances, type EcheanceFiscale } from '@/lib/fiscal/alertes-fiscales'
import { usePays } from '@/lib/contexts/PaysContext'

// ── Badge urgence ─────────────────────────────────────────────────────────────

function Badge({ urgence, jours }: { urgence: EcheanceFiscale['urgence']; jours: number }) {
  if (urgence === 'rouge') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
        <AlertTriangle size={9} className="shrink-0" />
        {jours <= 1 ? 'Aujourd\'hui' : `${jours}j`}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
      <Clock size={9} className="shrink-0" />
      {jours}j
    </span>
  )
}

// ── Formatage date ────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function AlertesFiscales() {
  const { pays, paysGeo } = usePays()
  const echeances = useMemo(() => getEcheances(30, pays), [pays])

  if (echeances.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 size={16} className="text-green-500" />
          <span className="text-sm font-bold text-[#0F172A]">Alertes fiscales</span>
        </div>
        <p className="text-xs text-[#64748B]">Aucune échéance dans les 30 prochains jours.</p>
      </div>
    )
  }

  const nbRouge  = echeances.filter(e => e.urgence === 'rouge').length
  const nbOrange = echeances.filter(e => e.urgence === 'orange').length

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
            <AlertTriangle size={15} className="text-[#DC2626]" />
          </div>
          <div>
            <span className="text-sm font-bold text-[#0F172A]">Échéances fiscales</span>
            <p className="text-[10px] text-[#94A3B8]">{paysGeo.nom} · 30 prochains jours</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {nbRouge > 0 && (
            <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
              {nbRouge} urgent{nbRouge > 1 ? 's' : ''}
            </span>
          )}
          {nbOrange > 0 && (
            <span className="text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
              {nbOrange} proche{nbOrange > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Liste */}
      <ul className="divide-y divide-gray-50">
        {echeances.map(e => (
          <li key={`${e.id}-${e.dateLimite.toISOString()}`}
            className={`flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors ${
              e.urgence === 'rouge' ? 'bg-red-50/30' : ''
            }`}>
            {/* Indicateur couleur */}
            <div className={`w-1.5 h-8 rounded-full shrink-0 ${
              e.urgence === 'rouge' ? 'bg-red-500' : 'bg-orange-400'
            }`} />

            {/* Contenu */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-bold text-[#0F172A] truncate">{e.nom}</span>
                <Badge urgence={e.urgence} jours={e.joursRestants} />
              </div>
              <p className="text-[10px] text-[#64748B] truncate">{e.description}</p>
              <p className="text-[10px] text-[#94A3B8] mt-0.5">{e.base}</p>
            </div>

            {/* Date limite */}
            <div className="text-right shrink-0">
              <div className={`text-[11px] font-bold ${
                e.urgence === 'rouge' ? 'text-red-600' : 'text-orange-600'
              }`}>
                {formatDate(e.dateLimite)}
              </div>
              <div className="text-[10px] text-[#94A3B8] capitalize">
                {e.recurrence}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/50">
        <Link href="/dashboard/fiscalite"
          className="flex items-center justify-between text-xs font-semibold text-[#64748B] hover:text-[#DC2626] transition-colors group">
          <span>Voir toutes les déclarations fiscales</span>
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  )
}
