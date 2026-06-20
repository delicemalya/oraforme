'use client'

import { useState } from 'react'
import { Sparkles, RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

interface ScoreItem {
  label:   string
  points:  number
  max:     number
  ok:      boolean
  detail?: string
}

interface MIAAScoringProps {
  employeId?:      string
  score:           number
  niveau:          'vert' | 'orange' | 'rouge'
  items:           ScoreItem[]
  alertes:         string[]
  recommandations: string[]
  plan:            'tpe' | 'pme' | 'grande'
  onRefresh?:      () => Promise<void>
}

const GAUGE_COLOR: Record<string, string> = {
  vert:   'bg-green-500',
  orange: 'bg-amber-400',
  rouge:  'bg-red-500',
}

const NIVEAU_LABEL: Record<string, string> = {
  vert:   'Conforme',
  orange: 'À vérifier',
  rouge:  'Non conforme',
}

export function MIAAScoring({
  employeId, score, niveau, items, alertes, recommandations, plan, onRefresh,
}: MIAAScoringProps) {
  const [miaaResult, setMiaaResult]   = useState<string | null>(null)
  const [miaaLoading, setMiaaLoading] = useState(false)
  const [miaaError, setMiaaError]     = useState<string | null>(null)

  async function runMIAA() {
    if (!employeId) return
    setMiaaLoading(true)
    setMiaaError(null)
    setMiaaResult(null)
    try {
      const outil = plan === 'grande' ? 'risques_rh' : 'evaluation_collaborateur'
      const res   = await fetch('/api/miaa/rh-expert', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ employe_id: employeId, outil }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur MIAA+')
      setMiaaResult(data.analyse || data.result || JSON.stringify(data, null, 2))
    } catch (e: unknown) {
      setMiaaError(e instanceof Error ? e.message : 'Erreur inattendue')
    } finally {
      setMiaaLoading(false)
    }
  }

  const NiveauIcon = niveau === 'vert' ? CheckCircle : niveau === 'orange' ? AlertTriangle : XCircle
  const niveauColor = niveau === 'vert'
    ? 'text-green-700'
    : niveau === 'orange'
    ? 'text-amber-700'
    : 'text-red-700'

  return (
    <div className="space-y-5">
      {/* ─── Jauge score ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NiveauIcon className={`w-5 h-5 ${niveauColor}`} />
            <span className={`font-semibold ${niveauColor}`}>{NIVEAU_LABEL[niveau]}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-slate-800">{score}</span>
            <span className="text-slate-400 text-sm">/100</span>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                title="Recalculer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${GAUGE_COLOR[niveau]}`}
            style={{ width: `${score}%` }}
          />
        </div>

        <div className="grid grid-cols-1 gap-1.5">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.ok ? 'bg-green-500' : 'bg-red-400'}`} />
              <span className={item.ok ? 'text-slate-600' : 'text-slate-500'}>{item.label}</span>
              <span className="ml-auto font-mono text-xs text-slate-400">{item.points}/{item.max}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Alertes ─────────────────────────────────────────────────────── */}
      {alertes.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-2">
          <h4 className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            {alertes.length} alerte{alertes.length > 1 ? 's' : ''}
          </h4>
          <ul className="space-y-1">
            {alertes.map((a, i) => (
              <li key={i} className="text-sm text-red-600 flex items-start gap-2">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-red-400 shrink-0" />
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── Recommandations ─────────────────────────────────────────────── */}
      {recommandations.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-2">
          <h4 className="text-sm font-semibold text-amber-700">Recommandations</h4>
          <ul className="space-y-1">
            {recommandations.map((r, i) => (
              <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── MIAA+ (PME / Grande) ────────────────────────────────────────── */}
      {(plan === 'pme' || plan === 'grande') && employeId && (
        <div className="space-y-3">
          <button
            onClick={runMIAA}
            disabled={miaaLoading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                       bg-gradient-to-r from-amber-500 to-orange-500
                       text-white text-sm font-semibold shadow
                       hover:from-amber-600 hover:to-orange-600 transition-all
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {miaaLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {miaaLoading ? 'Analyse en cours…' : 'Analyser avec MIAA+'}
          </button>

          {miaaError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
              {miaaError}
            </p>
          )}

          {miaaResult && (
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-4 text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">
              <div className="flex items-center gap-1.5 mb-3 text-amber-400 text-xs font-semibold">
                <Sparkles className="w-3 h-3" />
                Analyse MIAA+ — {plan === 'grande' ? 'Risques RH' : 'Évaluation collaborateur'}
              </div>
              {miaaResult}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
