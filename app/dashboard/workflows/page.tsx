'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, Plus, Play, Pause, Trash2, Edit2, RefreshCw,
  CheckCircle, XCircle, Clock, ChevronRight, Loader2,
  List, Activity, Settings, Copy, MoreVertical,
} from 'lucide-react'
import { WORKFLOW_PRESETS, getPresetsByCategory } from '@/lib/workflow/presets'
import type { WorkflowDefinition, WorkflowPreset } from '@/lib/workflow/types'
import { usePlanFeature } from '@/lib/hooks/usePlanFeature'
import PlanFeatureGate from '@/components/PlanFeatureGate'

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG = '#F5F7FB'
const CARD = '#FFFFFF'
const PRIMARY = '#DC2626'
const TEXT = '#0F172A'
const MUTED = '#64748B'
const BORDER = '#E5E7EB'

const CATEGORY_LABELS: Record<string, string> = {
  finance: 'Finance', rh: 'RH', ecole: 'École',
  hotel: 'Hôtel', restaurant: 'Restaurant', stock: 'Stock', system: 'Système',
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#16A34A', failed: '#DC2626', running: '#2563EB',
  pending: '#D97706', skipped: '#94A3B8',
}

// ── Workflow card ─────────────────────────────────────────────────────────────
function WorkflowCard({
  wf,
  onToggle,
  onRun,
  onDelete,
}: {
  wf: WorkflowDefinition
  onToggle: (id: string, active: boolean) => void
  onRun: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [running, setRunning] = useState(false)
  const [menu, setMenu] = useState(false)

  const handleRun = async () => {
    setRunning(true)
    await onRun(wf.id)
    setRunning(false)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        position: 'relative',
      }}
    >
      {/* Active indicator */}
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: wf.is_active ? '#16A34A' : BORDER,
        flexShrink: 0,
      }} />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: TEXT }}>{wf.name}</span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px',
            borderRadius: 20, background: '#F1F5F9', color: MUTED,
          }}>
            {wf.trigger_type}
          </span>
        </div>
        {wf.description && (
          <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>{wf.description}</p>
        )}
        <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
          <span style={{ fontSize: 11, color: MUTED }}>
            {wf.actions.length} action{wf.actions.length !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 11, color: MUTED }}>
            {wf.run_count} exécution{wf.run_count !== 1 ? 's' : ''}
          </span>
          {wf.last_run_at && (
            <span style={{ fontSize: 11, color: MUTED }}>
              Dernier: {new Date(wf.last_run_at).toLocaleDateString('fr-FR')}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => onToggle(wf.id, !wf.is_active)}
          title={wf.is_active ? 'Désactiver' : 'Activer'}
          style={{
            padding: '6px 12px', borderRadius: 8, border: `1px solid ${BORDER}`,
            background: CARD, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            color: wf.is_active ? '#DC2626' : '#16A34A',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {wf.is_active ? <Pause size={13} /> : <Play size={13} />}
          {wf.is_active ? 'Pause' : 'Activer'}
        </button>

        <button
          onClick={handleRun}
          disabled={running || !wf.is_active}
          style={{
            padding: '6px 12px', borderRadius: 8,
            background: wf.is_active ? PRIMARY : BORDER,
            border: 'none', cursor: wf.is_active ? 'pointer' : 'not-allowed',
            color: '#fff', fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: wf.is_active ? 1 : 0.5,
          }}
        >
          {running ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={13} />}
          Tester
        </button>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenu(m => !m)}
            style={{ padding: 6, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6 }}
          >
            <MoreVertical size={16} color={MUTED} />
          </button>
          {menu && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', zIndex: 10,
              background: CARD, border: `1px solid ${BORDER}`,
              borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.1)',
              minWidth: 140, overflow: 'hidden',
            }}>
              <button
                onClick={() => { onDelete(wf.id); setMenu(false) }}
                style={{
                  width: '100%', padding: '10px 16px', border: 'none',
                  background: 'transparent', cursor: 'pointer', textAlign: 'left',
                  fontSize: 13, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <Trash2 size={13} /> Supprimer
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Preset card ───────────────────────────────────────────────────────────────
function PresetCard({ preset, onInstall }: { preset: WorkflowPreset; onInstall: (p: WorkflowPreset) => void }) {
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,.08)' }}
      style={{
        background: CARD, border: `1px solid ${BORDER}`,
        borderRadius: 14, padding: 18, cursor: 'pointer',
      }}
      onClick={() => onInstall(preset)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: preset.color + '20',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>
          <Zap size={16} color={preset.color} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>{preset.name}</div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{preset.trigger_type}</div>
        </div>
      </div>
      <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, margin: 0 }}>{preset.description}</p>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: MUTED }}>{preset.actions.length} action{preset.actions.length !== 1 ? 's' : ''}</span>
        <span style={{
          fontSize: 11, fontWeight: 600, color: preset.color,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          Installer <ChevronRight size={12} />
        </span>
      </div>
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WorkflowsPage() {
  const { allowed: canWorkflows } = usePlanFeature('workflows-avances')
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'workflows' | 'presets'>('workflows')
  const [presetCategory, setPresetCategory] = useState<string>('all')
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null)

  const showFeedback = (msg: string, ok = true) => {
    setFeedback({ msg, ok })
    setTimeout(() => setFeedback(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/workflows')
    if (res.ok) {
      const d = await res.json()
      setWorkflows(d.workflows ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleToggle = async (id: string, active: boolean) => {
    const res = await fetch(`/api/workflows/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: active }),
    })
    if (res.ok) {
      setWorkflows(ws => ws.map(w => w.id === id ? { ...w, is_active: active } : w))
      showFeedback(active ? 'Workflow activé' : 'Workflow pausé')
    }
  }

  const handleRun = async (id: string) => {
    const res = await fetch(`/api/workflows/${id}/run`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const d = await res.json()
    if (d.success) showFeedback(`Exécution réussie — ${d.actions?.length ?? 0} action(s)`)
    else showFeedback(d.error ?? 'Échec', false)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce workflow ?')) return
    const res = await fetch(`/api/workflows/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setWorkflows(ws => ws.filter(w => w.id !== id))
      showFeedback('Workflow supprimé')
    }
  }

  const handleInstallPreset = async (preset: WorkflowPreset) => {
    const res = await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: preset.name,
        description: preset.description,
        trigger_type: preset.trigger_type,
        trigger_config: preset.trigger_config,
        conditions: preset.conditions,
        actions: preset.actions,
        is_active: false,
      }),
    })
    if (res.ok) {
      showFeedback(`"${preset.name}" installé — activez-le pour l'utiliser`)
      setTab('workflows')
      load()
    } else {
      showFeedback('Erreur lors de l\'installation', false)
    }
  }

  const filteredPresets = presetCategory === 'all'
    ? WORKFLOW_PRESETS
    : WORKFLOW_PRESETS.filter(p => p.category === presetCategory)

  if (!canWorkflows) return <PlanFeatureGate feature="workflows-avances" />

  return (
    <div style={{ minHeight: '100vh', background: BG, padding: '32px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: PRIMARY + '15',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={22} color={PRIMARY} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: TEXT }}>Workflows</h1>
              <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
                {workflows.length} workflow{workflows.length !== 1 ? 's' : ''} —{' '}
                {workflows.filter(w => w.is_active).length} actif{workflows.filter(w => w.is_active).length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={load}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10,
              border: `1px solid ${BORDER}`, background: CARD,
              cursor: 'pointer', fontSize: 13, color: MUTED,
            }}
          >
            <RefreshCw size={14} /> Rafraîchir
          </button>
        </div>

        {/* Feedback toast */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                marginBottom: 16, padding: '12px 16px', borderRadius: 10,
                background: feedback.ok ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${feedback.ok ? '#BBF7D0' : '#FECACA'}`,
                color: feedback.ok ? '#16A34A' : '#DC2626',
                fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {feedback.ok ? <CheckCircle size={15} /> : <XCircle size={15} />}
              {feedback.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: CARD, borderRadius: 12, padding: 4, border: `1px solid ${BORDER}`, width: 'fit-content' }}>
          {[
            { key: 'workflows', label: 'Mes workflows', icon: <List size={14} /> },
            { key: 'presets', label: 'Bibliothèque', icon: <Zap size={14} /> },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              style={{
                padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
                background: tab === t.key ? PRIMARY : 'transparent',
                color: tab === t.key ? '#fff' : MUTED,
                fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.15s',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Workflows list */}
        {tab === 'workflows' && (
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: MUTED }}>
                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : workflows.length === 0 ? (
              <div style={{
                background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16,
                padding: 60, textAlign: 'center',
              }}>
                <Zap size={40} color={BORDER} style={{ marginBottom: 16 }} />
                <p style={{ fontSize: 16, fontWeight: 600, color: TEXT, margin: '0 0 8px' }}>Aucun workflow</p>
                <p style={{ fontSize: 13, color: MUTED, margin: '0 0 20px' }}>
                  Créez votre premier workflow depuis la bibliothèque
                </p>
                <button
                  onClick={() => setTab('presets')}
                  style={{
                    padding: '10px 20px', borderRadius: 10, border: 'none',
                    background: PRIMARY, color: '#fff', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <Plus size={14} /> Parcourir la bibliothèque
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <AnimatePresence mode="popLayout">
                  {workflows.map(wf => (
                    <WorkflowCard
                      key={wf.id}
                      wf={wf}
                      onToggle={handleToggle}
                      onRun={handleRun}
                      onDelete={handleDelete}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* Presets library */}
        {tab === 'presets' && (
          <div>
            {/* Category filter */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {['all', ...Object.keys(CATEGORY_LABELS)].map(cat => (
                <button
                  key={cat}
                  onClick={() => setPresetCategory(cat)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, border: `1px solid ${BORDER}`,
                    background: presetCategory === cat ? PRIMARY : CARD,
                    color: presetCategory === cat ? '#fff' : MUTED,
                    cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  }}
                >
                  {cat === 'all' ? 'Tous' : CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 14,
            }}>
              {filteredPresets.map(p => (
                <PresetCard key={p.id} preset={p} onInstall={handleInstallPreset} />
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
