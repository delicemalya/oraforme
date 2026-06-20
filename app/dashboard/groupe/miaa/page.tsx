'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles, Crown, ArrowLeft, Loader2, Download, Copy, Check,
  RotateCcw, Globe, Building2, Layers, MapPin,
  FileBarChart, TrendingUp, AlertTriangle, ChevronRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { useTenant } from '@/lib/hooks/useTenant'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EntityData {
  id:               string
  nomEntreprise:    string
  typeEntite:       string
  pays:             string | null
  caYtd:            number
  caMois:           number
  tresorerieNette:  number
  nbEmployes:       number
  nbCandidats:      number
  nbPlacements:     number
  nbOffres:         number
  scoreAudit:       number
}

type ToolId = 'comparer_pays' | 'comparer_filiales' | 'comparer_agences' | 'rapport_consolide' | 'previsions'

interface Tool {
  id: ToolId
  label: string
  description: string
  icon: React.ElementType
  color: string
  entityTypes: string[]
}

// ── Tools ──────────────────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    id: 'comparer_pays',
    label: 'Comparer les Pays',
    description: 'Benchmarks inter-pays : CA, effectifs, placements, performances relatives',
    icon: Globe,
    color: '#F59E0B',
    entityTypes: ['societe'],
  },
  {
    id: 'comparer_filiales',
    label: 'Comparer les Filiales',
    description: 'Analyse comparative des filiales : champion, sous-performants, synergies',
    icon: Layers,
    color: '#16A34A',
    entityTypes: ['filiale'],
  },
  {
    id: 'comparer_agences',
    label: 'Comparer les Agences',
    description: 'Classement et diagnostics agences, redistribution des ressources',
    icon: MapPin,
    color: '#7C3AED',
    entityTypes: ['agence'],
  },
  {
    id: 'rapport_consolide',
    label: 'Rapport Consolidé DG',
    description: 'Rapport de direction générale complet avec synthèse exécutive et recommandations stratégiques',
    icon: FileBarChart,
    color: '#2563EB',
    entityTypes: ['groupe', 'societe', 'filiale', 'agence'],
  },
  {
    id: 'previsions',
    label: 'Prévisions & Forecasts',
    description: 'Prévisions CA, effectifs, placements sur 12 mois — scénarios conservateur/central/optimiste',
    icon: TrendingUp,
    color: '#DC2626',
    entityTypes: ['groupe', 'societe', 'filiale', 'agence'],
  },
]

// ── Markdown formatter ────────────────────────────────────────────────────────

function FormatOutput({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('# '))   return <h2 key={i} className="text-[16px] font-black text-[#0F172A] mt-4 mb-1">{line.slice(2)}</h2>
        if (line.startsWith('## '))  return <h3 key={i} className="text-[14px] font-bold text-[#1E293B] mt-3 mb-0.5">{line.slice(3)}</h3>
        if (line.startsWith('### ')) return <h4 key={i} className="text-[13px] font-bold text-[#374151] mt-2">{line.slice(4)}</h4>
        if (line.match(/^\*\*(.+)\*\*$/)) {
          return <p key={i} className="text-[13px] font-bold text-[#0F172A] mt-2">{line.replace(/\*\*/g, '')}</p>
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          const c = line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          return (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-[#F59E0B] mt-1 shrink-0 text-[10px]">•</span>
              <p className="text-[12px] text-[#374151] leading-relaxed flex-1" dangerouslySetInnerHTML={{ __html: c }} />
            </div>
          )
        }
        if (line.startsWith('| ')) {
          const cells = line.split('|').filter(c => c.trim())
          const isHeader = false
          return (
            <div key={i} className="flex gap-0 border-b border-[#F1F5F9] last:border-0">
              {cells.map((cell, j) => (
                <div key={j} className="flex-1 py-1.5 px-2 text-[11px] text-[#374151] font-medium"
                  dangerouslySetInnerHTML={{ __html: cell.trim().replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
              ))}
            </div>
          )
          return isHeader
        }
        if (line.trim() === '' || line.startsWith('---')) return <div key={i} className="h-2" />
        const c = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        return <p key={i} className="text-[12px] text-[#374151] leading-relaxed" dangerouslySetInnerHTML={{ __html: c }} />
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MIAAExecutivePage() {
  const { tenant } = useTenantContext()
  const { tenantId } = useTenant()
  const router = useRouter()

  const [activeTool, setActiveTool] = useState<Tool>(TOOLS[0])
  const [entities,   setEntities]   = useState<EntityData[]>([])
  const [selected,   setSelected]   = useState<Set<string>>(new Set())
  const [contexte,   setContexte]   = useState('')
  const [horizon,    setHorizon]    = useState('12 mois')
  const [hypotheses, setHypotheses] = useState('')
  const [groupeNom,  setGroupeNom]  = useState(tenant?.nomEntreprise ?? 'Groupe RH Afrique')
  const [periode,    setPeriode]    = useState('Année en cours')

  const [loadingEntities, setLoadingEntities] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [result,     setResult]     = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [copied,     setCopied]     = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  // Load entities on mount or tool change
  const loadEntities = useCallback(async () => {
    if (!tenantId) return
    setLoadingEntities(true)
    try {
      const { data } = await supabase.rpc('get_entities_with_kpis')
      const all: EntityData[] = (data ?? []).map((r: Record<string, unknown>) => ({
        id:              r.tenant_id as string,
        nomEntreprise:   r.nom_entreprise as string,
        typeEntite:      r.type_entite as string,
        pays:            r.pays as string | null,
        caYtd:           Number(r.ca_ytd) || 0,
        caMois:          Number(r.ca_mois) || 0,
        tresorerieNette: Number(r.tresorerie_nette) || 0,
        nbEmployes:      Number(r.nb_employes) || 0,
        nbCandidats:     Number(r.nb_candidats_actifs) || 0,
        nbPlacements:    Number(r.nb_placements_mois) || 0,
        nbOffres:        Number(r.nb_offres_actives) || 0,
        scoreAudit:      Number(r.score_audit) || 0,
      }))
      setEntities(all)
      // Auto-select entities matching the tool's type
      const matchIds = all
        .filter(e => activeTool.entityTypes.includes(e.typeEntite))
        .map(e => e.id)
      setSelected(new Set(matchIds))
    } catch { /* ignore */ }
    finally { setLoadingEntities(false) }
  }, [tenantId, activeTool.entityTypes])

  // Load on mount
  useState(() => { void loadEntities() })

  const handleToolSelect = useCallback((tool: Tool) => {
    setActiveTool(tool)
    setResult(null); setError(null)
    // Re-filter selected to match new tool type
    const matchIds = entities
      .filter(e => tool.entityTypes.includes(e.typeEntite))
      .map(e => e.id)
    setSelected(new Set(matchIds))
  }, [entities])

  const toggleEntity = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleGenerate = useCallback(async () => {
    if (!tenantId) return
    const selectedEntites = entities.filter(e => selected.has(e.id))
    if (selectedEntites.length === 0) { setError('Sélectionnez au moins une entité'); return }

    setGenerating(true); setError(null); setResult(null)
    try {
      const entitesPayload = selectedEntites.map(e => ({
        nom:        e.nomEntreprise,
        pays:       e.pays,
        ca_ytd:     e.caYtd,
        ca_mois:    e.caMois,
        tresorerie: e.tresorerieNette,
        effectifs:  e.nbEmployes,
        candidats:  e.nbCandidats,
        placements: e.nbPlacements,
        offres:     e.nbOffres,
        score_audit: e.scoreAudit,
      }))

      const res = await fetch('/api/miaa/executive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool:     activeTool.id,
          tenantId,
          inputs: {
            entites:    entitesPayload,
            contexte,
            groupe_nom: groupeNom,
            periode,
            horizon,
            hypotheses,
          },
        }),
      })
      const data = await res.json() as { text?: string; error?: string }
      if (!res.ok) { setError(data.error ?? 'Erreur serveur'); return }
      setResult(data.text ?? '')
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch {
      setError('Erreur de connexion')
    } finally {
      setGenerating(false)
    }
  }, [tenantId, entities, selected, activeTool.id, contexte, groupeNom, periode, horizon, hypotheses])

  const handleCopy = useCallback(async () => {
    if (!result) return
    await navigator.clipboard.writeText(result)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }, [result])

  const handleDownload = useCallback(() => {
    if (!result) return
    const blob = new Blob([result], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `miaa-executive-${activeTool.id}-${Date.now()}.txt`
    a.click(); URL.revokeObjectURL(url)
  }, [result, activeTool.id])

  const eligibleEntities = entities.filter(e => activeTool.entityTypes.includes(e.typeEntite))

  const TYPE_ICON_MAP: Record<string, React.ElementType> = {
    groupe: Globe, societe: Building2, filiale: Layers, agence: MapPin
  }
  const TYPE_COLOR_MAP: Record<string, string> = {
    groupe: '#2563EB', societe: '#F59E0B', filiale: '#16A34A', agence: '#7C3AED'
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] px-6 py-5">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard/groupe')}
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
              <ArrowLeft size={15} />
            </button>
            <div className="w-10 h-10 rounded-2xl bg-[#7C3AED]/25 flex items-center justify-center">
              <Sparkles size={19} className="text-[#7C3AED]" />
            </div>
            <div>
              <h1 className="text-white font-black text-[18px]">MIAA+ Executive</h1>
              <p className="text-[#94A3B8] text-[11px]">
                <Crown size={9} className="inline mr-1 text-[#7C3AED]" />
                Compagnie · IA stratégique pour groupes multi-pays
              </p>
            </div>
          </div>
          {(result || generating) && (
            <button onClick={() => { setResult(null); setError(null) }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium
                bg-white/10 text-white hover:bg-white/20 transition-colors">
              <RotateCcw size={12} />Nouvelle analyse
            </button>
          )}
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 py-6 flex gap-5">

        {/* ── Left: Tool picker ── */}
        <aside className="w-[240px] shrink-0 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] px-2 mb-2">
            Outils Executive
          </p>
          {TOOLS.map(tool => {
            const Icon = tool.icon
            const active = activeTool.id === tool.id
            return (
              <button key={tool.id} onClick={() => handleToolSelect(tool)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all
                  ${active ? 'bg-white shadow-md border border-[#E2E8F0]' : 'hover:bg-white/60'}`}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: active ? tool.color + '18' : '#F1F5F9' }}>
                  <Icon size={14} style={{ color: active ? tool.color : '#64748B' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] font-semibold truncate ${active ? 'text-[#0F172A]' : 'text-[#374151]'}`}>
                    {tool.label}
                  </p>
                </div>
                {active && <ChevronRight size={12} style={{ color: tool.color }} />}
              </button>
            )
          })}
        </aside>

        {/* ── Right: Tool config + result ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Tool header */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: activeTool.color + '15' }}>
                <activeTool.icon size={20} style={{ color: activeTool.color }} />
              </div>
              <div>
                <h2 className="text-[15px] font-black text-[#0F172A]">{activeTool.label}</h2>
                <p className="text-[12px] text-[#64748B]">{activeTool.description}</p>
              </div>
            </div>
          </div>

          {/* Entity selection */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] font-bold text-[#0F172A]">
                Entités à analyser
                <span className="ml-2 text-[10px] text-[#94A3B8] font-normal">
                  ({selected.size}/{eligibleEntities.length} sélectionnées)
                </span>
              </p>
              {loadingEntities && <Loader2 size={13} className="text-[#F59E0B] animate-spin" />}
              {eligibleEntities.length > 0 && (
                <button onClick={loadEntities}
                  className="text-[10px] text-[#94A3B8] hover:text-[#0F172A] transition-colors">
                  Rafraîchir
                </button>
              )}
            </div>

            {eligibleEntities.length === 0 ? (
              <div className="text-center py-6">
                <AlertTriangle size={20} className="mx-auto mb-2 text-[#D97706]" />
                <p className="text-[12px] text-[#64748B]">
                  Aucune entité de type &quot;{activeTool.entityTypes.join(', ')}&quot; trouvée.
                </p>
                <p className="text-[10px] text-[#94A3B8] mt-1">
                  Créez d&apos;abord des entités dans la Gestion du Groupe, puis actualisez les snapshots.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {eligibleEntities.map(e => {
                  const Icon = TYPE_ICON_MAP[e.typeEntite] ?? Building2
                  const color = TYPE_COLOR_MAP[e.typeEntite] ?? '#64748B'
                  const isSelected = selected.has(e.id)
                  return (
                    <button key={e.id} onClick={() => toggleEntity(e.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all`}
                      style={{
                        borderColor: isSelected ? color : '#E2E8F0',
                        background:  isSelected ? color + '10' : 'transparent',
                      }}>
                      <Icon size={13} style={{ color: isSelected ? color : '#94A3B8' }} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-semibold truncate ${isSelected ? 'text-[#0F172A]' : 'text-[#64748B]'}`}>
                          {e.nomEntreprise}
                        </p>
                        <p className="text-[9px] text-[#94A3B8] truncate">
                          CA: {e.caYtd > 0 ? `${(e.caYtd / 1_000_000).toFixed(1)}M` : '—'}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Tool-specific options */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4 space-y-3">
            <p className="text-[12px] font-bold text-[#0F172A]">Paramètres</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1.5">Nom du groupe</label>
                <input value={groupeNom} onChange={e => setGroupeNom(e.target.value)}
                  placeholder="Groupe RH Afrique"
                  className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[12px]
                    focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED] bg-[#FAFAFA]" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1.5">Période</label>
                <input value={periode} onChange={e => setPeriode(e.target.value)}
                  placeholder="Année en cours"
                  className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[12px]
                    focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED] bg-[#FAFAFA]" />
              </div>
            </div>

            {activeTool.id === 'previsions' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1.5">Horizon de prévision</label>
                  <select value={horizon} onChange={e => setHorizon(e.target.value)}
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[12px]
                      focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 bg-[#FAFAFA]">
                    {['3 mois', '6 mois', '12 mois', '2 ans', '3 ans'].map(h =>
                      <option key={h} value={h}>{h}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1.5">Hypothèses</label>
                  <input value={hypotheses} onChange={e => setHypotheses(e.target.value)}
                    placeholder="ex: croissance de 15%"
                    className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[12px]
                      focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 bg-[#FAFAFA]" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1.5">Contexte additionnel (optionnel)</label>
              <textarea value={contexte} onChange={e => setContexte(e.target.value)} rows={2}
                placeholder="ex: restructuration en cours, nouveau marché cible, crise sectorielle…"
                className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-[12px]
                  focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED]
                  bg-[#FAFAFA] resize-none" />
            </div>

            {error && (
              <p className="text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button onClick={handleGenerate} disabled={generating || selected.size === 0}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[13px]
                text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: generating ? '#94A3B8' : activeTool.color }}>
              {generating
                ? <><Loader2 size={15} className="animate-spin" />Analyse MIAA+ Executive en cours…</>
                : <><Sparkles size={15} />Lancer l&apos;analyse</>
              }
            </button>
          </div>

          {/* Loading skeleton */}
          {generating && (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-[#7C3AED]/15 flex items-center justify-center">
                    <Sparkles size={24} className="text-[#7C3AED] animate-pulse" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#7C3AED] flex items-center justify-center">
                    <Loader2 size={11} className="text-white animate-spin" />
                  </div>
                </div>
                <div>
                  <p className="text-[14px] font-bold text-[#0F172A]">MIAA+ Executive analyse les données…</p>
                  <p className="text-[12px] text-[#64748B] mt-1">
                    Analyse de {selected.size} entité{selected.size > 1 ? 's' : ''} — 20 à 45 secondes
                  </p>
                </div>
                <div className="w-full max-w-xs space-y-2">
                  {[90, 65, 80, 50].map((w, i) => (
                    <div key={i} className="h-2 rounded-full bg-[#F1F5F9] animate-pulse"
                      style={{ width: `${w}%`, animationDelay: `${i * 0.3}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div ref={resultRef} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#F1F5F9]"
                style={{ background: activeTool.color + '08' }}>
                <div className="flex items-center gap-2">
                  <Crown size={15} style={{ color: activeTool.color }} />
                  <span className="text-[13px] font-bold" style={{ color: activeTool.color }}>
                    MIAA+ Executive — {activeTool.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
                      text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors">
                    {copied ? <><Check size={12} className="text-green-500" />Copié</> : <><Copy size={12} />Copier</>}
                  </button>
                  <button onClick={handleDownload}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
                      text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors">
                    <Download size={12} />Télécharger
                  </button>
                </div>
              </div>
              <div className="p-6 max-h-[700px] overflow-y-auto">
                <FormatOutput text={result} />
              </div>
              <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#F1F5F9] flex items-center gap-2">
                <Sparkles size={11} className="text-[#7C3AED]" />
                <p className="text-[10px] text-[#94A3B8]">
                  Analyse MIAA+ Executive — Document à valider avant diffusion en comité de direction.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
