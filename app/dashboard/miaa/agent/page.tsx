'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, RefreshCw, ChevronLeft, Check, X, Loader2,
  TrendingUp, Users, Package, Landmark, Briefcase,
  AlertTriangle, Info, ChevronDown, ChevronUp,
  FileText, ExternalLink, Brain,
} from 'lucide-react'
import Link from 'next/link'
import { useTenant } from '@/lib/hooks/useTenant'

// ── Types ──────────────────────────────────────────────────────────────────────

type Impact = 'critical' | 'high' | 'medium' | 'low'
type Statut = 'pending' | 'accepted' | 'rejected' | 'executed'

interface Proposal {
  id:           string
  module:       string
  titre:        string
  description:  string
  action_type:  string
  impact:       Impact
  action_label: string
  action_href?: string
  payload:      Record<string, unknown>
  statut?:      Statut
  resultat?:    string
}

interface AnalyseResult {
  proposals:        Proposal[]
  modules_analyses: string[]
  score_sante:      number
  nb_alertes:       number
  timestamp:        string
  last_briefing?:   { contenu: string; created_at: string; score_sante: number } | null
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const IMPACT_CONFIG: Record<Impact, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: 'Critique',  color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  high:     { label: 'Élevé',     color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  medium:   { label: 'Moyen',     color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  low:      { label: 'Faible',    color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
}

const MODULE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
  tresorerie:  { label: 'Trésorerie',  icon: TrendingUp },
  facturation: { label: 'Facturation', icon: FileText },
  rh:          { label: 'RH',          icon: Users },
  stock:       { label: 'Stock',       icon: Package },
  fiscalite:   { label: 'Fiscalité',   icon: Landmark },
  recrutement: { label: 'Recrutement', icon: Briefcase },
}

// ── Composant ProposalCard ─────────────────────────────────────────────────────

function ProposalCard({
  proposal,
  onAccept,
  onReject,
  onExecute,
  loading,
}: {
  proposal: Proposal
  onAccept:  (id: string) => void
  onReject:  (id: string) => void
  onExecute: (id: string) => Promise<string>
  loading:   string | null
}) {
  const [expanded, setExpanded]     = useState(false)
  const [resultat, setResultat]     = useState(proposal.resultat ?? '')
  const [executing, setExecuting]   = useState(false)
  const cfg                         = IMPACT_CONFIG[proposal.impact]
  const modCfg                      = MODULE_CONFIG[proposal.module]
  const ModIcon                     = modCfg?.icon ?? Info
  const isLoading = loading === proposal.id

  async function handleExecute() {
    setExecuting(true)
    const res = await onExecute(proposal.id)
    setResultat(res)
    setExecuting(false)
    if (res) setExpanded(true)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: cfg.border, background: cfg.bg }}
    >
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <div className="mt-0.5 p-2 rounded-xl" style={{ background: 'white' }}>
          <ModIcon size={16} style={{ color: cfg.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide text-white"
              style={{ background: cfg.color }}>
              {cfg.label}
            </span>
            <span className="text-[10px] text-[var(--text-secondary)] font-medium">
              {modCfg?.label ?? proposal.module}
            </span>
          </div>
          <p className="text-sm font-semibold text-[var(--text)] leading-tight">{proposal.titre}</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{proposal.description}</p>
        </div>

        <button onClick={() => setExpanded(e => !e)}
          className="p-1.5 rounded-lg hover:bg-black/5 transition-colors shrink-0 mt-0.5">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Résultat d'exécution */}
      <AnimatePresence>
        {expanded && resultat && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden">
            <div className="border-t border-[var(--border)] mx-4 pb-1" />
            <div className="px-4 pb-3">
              <p className="text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5">Résultat d'exécution</p>
              <pre className="text-[11px] text-[var(--text)] whitespace-pre-wrap font-sans leading-relaxed bg-white/70 rounded-xl p-3 max-h-48 overflow-y-auto">
                {resultat}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="px-4 pb-4 flex items-center gap-2 flex-wrap">
        {proposal.action_href && (
          <Link href={proposal.action_href}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all hover:opacity-80"
            style={{ borderColor: cfg.color, color: cfg.color, background: 'white' }}>
            <ExternalLink size={11} />
            Voir
          </Link>
        )}

        <button onClick={handleExecute} disabled={executing || isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: cfg.color }}>
          {(executing || isLoading) ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
          {proposal.action_label}
        </button>

        <button onClick={() => onAccept(proposal.id)} disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-[#16A34A] text-[#16A34A] hover:bg-[#F0FDF4] transition-all">
          <Check size={11} />
          Accepter
        </button>

        <button onClick={() => onReject(proposal.id)} disabled={isLoading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:border-[#DC2626] hover:text-[#DC2626] transition-all">
          <X size={11} />
          Ignorer
        </button>
      </div>
    </motion.div>
  )
}

// ── Composant ScoreCard ────────────────────────────────────────────────────────

function ScoreCard({ score }: { score: number }) {
  const color = score >= 80 ? '#16A34A' : score >= 50 ? '#D97706' : '#DC2626'
  const label = score >= 80 ? 'Bonne santé' : score >= 50 ? 'Attention requise' : 'Urgences détectées'

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex items-center gap-4">
      <div className="relative w-14 h-14 shrink-0">
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="24" fill="none" stroke="var(--border)" strokeWidth="4" />
          <circle cx="28" cy="28" r="24" fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={`${(score / 100) * 151} 151`}
            strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold"
          style={{ color }}>{score}</span>
      </div>
      <div>
        <p className="text-xs text-[var(--text-secondary)]">Score de santé ERP</p>
        <p className="text-base font-bold text-[var(--text)]">{label}</p>
      </div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function MIAAAgentPage() {
  const { tenantId } = useTenant()

  const [analyse,         setAnalyse]         = useState<AnalyseResult | null>(null)
  const [proposals,       setProposals]       = useState<Proposal[]>([])
  const [briefing,        setBriefing]        = useState<string>('')
  const [loadingAnalyse,  setLoadingAnalyse]  = useState(false)
  const [loadingBriefing, setLoadingBriefing] = useState(false)
  const [loadingAction,   setLoadingAction]   = useState<string | null>(null)
  const [briefingOpen,    setBriefingOpen]    = useState(false)
  const [filter,          setFilter]          = useState<Impact | 'all'>('all')

  const runAnalyse = useCallback(async (save = true) => {
    if (!tenantId) return
    setLoadingAnalyse(true)
    try {
      const res  = await fetch(`/api/miaa/agent?tenant_id=${tenantId}&save=${save ? 1 : 0}`)
      const data = await res.json() as AnalyseResult
      setAnalyse(data)
      setProposals(data.proposals ?? [])
      if (data.last_briefing?.contenu) {
        setBriefing(data.last_briefing.contenu)
      }
    } catch {}
    setLoadingAnalyse(false)
  }, [tenantId])

  // Charger les propositions sauvegardées au mount
  useEffect(() => {
    if (!tenantId) return
    fetch(`/api/miaa/agent?tenant_id=${tenantId}&saved=1`)
      .then(r => r.json())
      .then((data: { proposals: Proposal[] }) => {
        if (data.proposals?.length) setProposals(data.proposals)
      })
      .catch(() => {})
  }, [tenantId])

  async function genererBriefing() {
    if (!tenantId) return
    setLoadingBriefing(true)
    try {
      const res  = await fetch('/api/miaa/agent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'briefing', tenant_id: tenantId }),
      })
      const data = await res.json() as { briefing?: { contenu: string } }
      if (data.briefing?.contenu) {
        setBriefing(data.briefing.contenu)
        setBriefingOpen(true)
      }
    } catch {}
    setLoadingBriefing(false)
  }

  async function handleAction(proposalId: string, action: 'accept' | 'reject') {
    if (!tenantId) return
    setLoadingAction(proposalId)
    try {
      await fetch('/api/miaa/agent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action, proposal_id: proposalId, tenant_id: tenantId }),
      })
      setProposals(prev => prev.filter(p => p.id !== proposalId))
    } catch {}
    setLoadingAction(null)
  }

  async function handleExecute(proposalId: string): Promise<string> {
    if (!tenantId) return ''
    setLoadingAction(proposalId)
    try {
      const res  = await fetch('/api/miaa/agent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'execute', proposal_id: proposalId, tenant_id: tenantId }),
      })
      const data = await res.json() as { resultat?: string }
      setProposals(prev => prev.map(p =>
        p.id === proposalId ? { ...p, statut: 'executed', resultat: data.resultat } : p
      ))
      setLoadingAction(null)
      return data.resultat ?? ''
    } catch {
      setLoadingAction(null)
      return ''
    }
  }

  const filtered = filter === 'all'
    ? proposals
    : proposals.filter(p => p.impact === filter)

  const nbCritical = proposals.filter(p => p.impact === 'critical').length
  const nbHigh     = proposals.filter(p => p.impact === 'high').length

  return (
    <div className="space-y-5 w-full max-w-3xl mx-auto">

      {/* Retour */}
      <Link href="/dashboard/miaa"
        className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
        <ChevronLeft size={15} /> MIAA+
      </Link>

      {/* Header */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, #F59E0B 0%, transparent 60%)' }} />
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Brain size={18} style={{ color: '#F59E0B' }} />
              <span className="text-xs font-semibold uppercase tracking-widest text-white/60">MIAA+ Agent Autonome</span>
            </div>
            <h1 className="text-xl font-bold">Centre de Commandement</h1>
            <p className="text-sm text-white/60 mt-0.5">
              Surveillance en temps réel · Propositions d'actions · Exécution validée
            </p>
          </div>

          {/* Compteurs alertes */}
          {(nbCritical > 0 || nbHigh > 0) && (
            <div className="flex gap-2">
              {nbCritical > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                  style={{ background: '#DC2626', color: 'white' }}>
                  <AlertTriangle size={12} />
                  {nbCritical} critique{nbCritical > 1 ? 's' : ''}
                </div>
              )}
              {nbHigh > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                  style={{ background: '#D97706', color: 'white' }}>
                  {nbHigh} élevé{nbHigh > 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Boutons d'action */}
        <div className="relative flex gap-2 mt-5 flex-wrap">
          <button onClick={() => runAnalyse(true)} disabled={loadingAnalyse || !tenantId}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#1E293B] transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: '#F59E0B' }}>
            {loadingAnalyse
              ? <Loader2 size={14} className="animate-spin" />
              : <RefreshCw size={14} />}
            Lancer l'analyse
          </button>

          <button onClick={genererBriefing} disabled={loadingBriefing || !tenantId}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/30 text-white hover:bg-white/10 transition-all disabled:opacity-50">
            {loadingBriefing
              ? <Loader2 size={14} className="animate-spin" />
              : <FileText size={14} />}
            Briefing DG
          </button>
        </div>
      </div>

      {/* Score + info analyse */}
      {analyse && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ScoreCard score={analyse.score_sante} />
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-xs text-[var(--text-secondary)] mb-2">Dernière analyse</p>
            <p className="text-sm font-semibold text-[var(--text)]">
              {new Date(analyse.timestamp).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {analyse.modules_analyses.length} modules analysés · {analyse.proposals.length} proposition{analyse.proposals.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* Briefing DG */}
      <AnimatePresence>
        {briefing && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: '#FDE68A', background: '#FFFBEB' }}>
            <button
              onClick={() => setBriefingOpen(o => !o)}
              className="w-full flex items-center justify-between p-4 hover:bg-amber-50 transition-colors">
              <div className="flex items-center gap-2">
                <FileText size={15} style={{ color: '#D97706' }} />
                <span className="text-sm font-semibold text-[var(--text)]">Briefing DG du jour</span>
              </div>
              {briefingOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <AnimatePresence>
              {briefingOpen && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                  className="overflow-hidden">
                  <div className="px-4 pb-4 border-t border-[#FDE68A]">
                    <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap pt-3">
                      {briefing}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Propositions */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-base font-bold text-[var(--text)]">
            Propositions d'actions
            {proposals.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                style={{ background: '#F59E0B' }}>
                {proposals.length}
              </span>
            )}
          </h2>

          {/* Filtres impact */}
          {proposals.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {(['all', 'critical', 'high', 'medium', 'low'] as const).map(f => {
                const cfg = f === 'all' ? null : IMPACT_CONFIG[f]
                const count = f === 'all' ? proposals.length : proposals.filter(p => p.impact === f).length
                if (count === 0 && f !== 'all') return null
                return (
                  <button key={f} onClick={() => setFilter(f)}
                    className="px-2.5 py-1 rounded-xl text-xs font-medium border transition-all"
                    style={filter === f
                      ? { background: cfg?.color ?? '#F59E0B', color: 'white', borderColor: 'transparent' }
                      : { background: 'transparent', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                    {f === 'all' ? `Toutes (${count})` : `${cfg!.label} (${count})`}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {proposals.length === 0 && !loadingAnalyse && (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center">
            <Brain size={32} className="mx-auto mb-3 text-[var(--text-secondary)]" />
            <p className="text-sm font-medium text-[var(--text)]">Aucune proposition en attente</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Cliquez sur "Lancer l'analyse" pour détecter les actions prioritaires.
            </p>
          </div>
        )}

        {loadingAnalyse && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--border)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-[var(--border)] rounded w-1/4" />
                    <div className="h-4 bg-[var(--border)] rounded w-3/4" />
                    <div className="h-3 bg-[var(--border)] rounded w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map(p => (
              <ProposalCard
                key={p.id}
                proposal={p}
                onAccept={id => handleAction(id, 'accept')}
                onReject={id => handleAction(id, 'reject')}
                onExecute={handleExecute}
                loading={loadingAction}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Liens rapides */}
      <div className="flex gap-2 flex-wrap pt-2">
        <Link href="/dashboard/miaa/rapports"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:border-[#F59E0B] transition-colors">
          <FileText size={12} style={{ color: '#F59E0B' }} />
          Voir tous les rapports
        </Link>
        <Link href="/dashboard/miaa"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:border-[#F59E0B] transition-colors">
          <Brain size={12} style={{ color: '#F59E0B' }} />
          Chat MIAA+
        </Link>
      </div>
    </div>
  )
}
