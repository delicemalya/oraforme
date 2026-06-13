'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, Users2, GraduationCap, AlertTriangle, Unlock,
  Calendar, Megaphone, Award, Handshake, Plus, Trash2, Check,
  Loader2, RefreshCw, DollarSign, Swords,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useRoleGuard } from '@/lib/hooks/useRoleGuard'
import {
  type Etudiant, type PaiementScolaire, type ClasseEcole, type Enseignant, type PlanningEcole,
  type TypeEvent, TYPE_EVENT, fmt, generateCode, KpiCard, Avatar, FI,
} from '../_lib/shared'
import { SectionDiplomes, SectionSoutenances } from '../_lib/academic-sections'
import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'

type SubTab = 'vue' | 'finances' | 'evenements' | 'bourses' | 'partenaires' | 'communication'
           | 'diplomes' | 'soutenances'

// ── Vue Globale ───────────────────────────────────────────────────────────────

function SectionVue({ tenantId, etudiants, enseignants, classes, onRefresh }: {
  tenantId: string; etudiants: Etudiant[]; enseignants: Enseignant[]; classes: ClasseEcole[]; onRefresh: () => void
}) {
  const { fmt: fmtCurrency } = useFmt()
  const { t } = useLocale()
  const [revenuMois,   setRevenuMois]   = useState(0)
  const [revenuAnnee,  setRevenuAnnee]  = useState(0)
  const [impayeCount,  setImpayeCount]  = useState(0)
  const [recentPaie,   setRecentPaie]   = useState<PaiementScolaire[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [blocking,     setBlocking]     = useState(false)

  useEffect(() => {
    async function loadStats() {
      setStatsLoading(true)
      const now       = new Date()
      const startMonth= new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const startYear = new Date(now.getFullYear(), 0, 1).toISOString()
      const annee     = now.getFullYear().toString()

      const [{ data: pMois }, { data: pAnnee }, { data: recent }] = await Promise.all([
        supabase.from('paiements_scolaires').select('montant').eq('tenant_id', tenantId).eq('statut', 'paye').gte('created_at', startMonth),
        supabase.from('paiements_scolaires').select('montant').eq('tenant_id', tenantId).eq('statut', 'paye').gte('created_at', startYear),
        supabase.from('paiements_scolaires').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(8),
      ])

      const actifs = etudiants.filter(e => e.statut === 'actif').map(e => e.id)
      let impaye = 0
      if (actifs.length > 0) {
        const { data: pPaid } = await supabase.from('paiements_scolaires').select('etudiant_id').eq('tenant_id', tenantId).in('etudiant_id', actifs).ilike('annee_scolaire', `%${annee}%`)
        const paidIds = new Set((pPaid ?? []).map(p => p.etudiant_id))
        impaye = actifs.filter(id => !paidIds.has(id)).length
      }

      setRevenuMois(pMois?.reduce((s, p) => s + p.montant, 0) ?? 0)
      setRevenuAnnee(pAnnee?.reduce((s, p) => s + p.montant, 0) ?? 0)
      setImpayeCount(impaye)
      setRecentPaie((recent ?? []) as PaiementScolaire[])
      setStatsLoading(false)
    }
    loadStats()
  }, [tenantId, etudiants])

  async function autoBlock() {
    setBlocking(true)
    const annee   = new Date().getFullYear().toString()
    const actifs  = etudiants.filter(e => e.statut === 'actif').map(e => e.id)
    if (actifs.length > 0) {
      const { data: paid } = await supabase.from('paiements_scolaires').select('etudiant_id').eq('tenant_id', tenantId).in('etudiant_id', actifs).ilike('annee_scolaire', `%${annee}%`)
      const paidIds = new Set((paid ?? []).map(p => p.etudiant_id))
      const toBlock = actifs.filter(id => !paidIds.has(id))
      for (const id of toBlock) {
        await supabase.from('etudiants').update({ statut: 'suspendu', code_deblocage: generateCode() }).eq('id', id)
      }
    }
    setBlocking(false); onRefresh()
  }

  const kpis = [
    { label: t('ecole.direction.kpi.revenuMois'),  value: statsLoading ? '…' : fmtCurrency(revenuMois),   color: '#0F172A' },
    { label: t('ecole.direction.kpi.revenuAnnee'), value: statsLoading ? '…' : fmtCurrency(revenuAnnee), color: '#DC2626' },
    { label: t('ecole.direction.kpi.etudiants'),   value: etudiants.filter(e => e.statut === 'actif').length, color: '#DC2626' },
    { label: t('ecole.direction.kpi.impayes'),     value: statsLoading ? '…' : impayeCount,                  color: '#DC2626' },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(k => <KpiCard key={k.label} label={k.label} value={k.value} color={k.color} />)}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label={t('ecole.direction.kpi.enseignants')} value={enseignants.filter(e => e.statut === 'actif').length} color="#7C3AED" />
        <KpiCard label={t('ecole.direction.kpi.classes')}     value={classes.length} color="#0F172A" />
        <KpiCard label={t('ecole.direction.kpi.diplomes')}    value={etudiants.filter(e => e.statut === 'diplome').length} color="#7C3AED" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#DC2626]/30 p-4 space-y-3" style={{ background: 'rgba(248,81,73,0.04)' }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-[#DC2626]" />
            <p className="text-xs font-bold text-[#DC2626]">{t('ecole.direction.kpi.gestionImpayes')}</p>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {t('ecole.direction.kpi.gestionImpayesDesc')}
          </p>
          <button onClick={autoBlock} disabled={blocking || impayeCount === 0 || statsLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
            style={{ background: '#00b9a7', color: '#fff' }}>
            {blocking ? <Loader2 className="animate-spin" size={12} /> : <Unlock size={12} />}
            {t('ecole.direction.block')} {impayeCount}
          </button>
        </div>

        <div className="rounded-xl border border-[var(--border)] p-4" style={{ background: '#FFFFFF' }}>
          <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">{t('ecole.direction.kpi.effectifsClasse')}</p>
          {classes.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">{t('ecole.direction.kpi.noClasse')}</p>
          ) : (
            <div className="space-y-2">
              {classes.map(c => {
                const nb  = etudiants.filter(e => e.classe === c.nom).length
                const pct = c.nb_places > 0 ? Math.min((nb / c.nb_places) * 100, 100) : 0
                return (
                  <div key={c.id}>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-[#101729]">{c.nom}</span>
                      <span className="text-[var(--text-secondary)]">{nb}/{c.nb_places}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--border)]">
                      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: pct > 90 ? '#DC2626' : '#DC2626' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {recentPaie.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]" style={{ background: '#FFFFFF' }}>
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('ecole.direction.kpi.derniersPaiements')}</p>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr style={{ background: '#FFFFFF' }}>{[t('common.date'), t('common.student'), t('common.label'), t('common.method'), t('common.amount')].map(h => <th key={h} className="text-left px-4 py-2.5 text-[10px] text-[var(--text-secondary)]">{h}</th>)}</tr></thead>
            <tbody>
              {recentPaie.map(p => {
                const etu = etudiants.find(e => e.id === p.etudiant_id)
                return (
                  <tr key={p.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">{new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-2.5 text-[#101729]">{etu ? `${etu.prenom} ${etu.nom}` : '—'}</td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">{p.libelle}</td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)] capitalize">{p.methode.replace('_', ' ')}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#DC2626]">{fmtCurrency(p.montant)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Finances ──────────────────────────────────────────────────────────────────

function SectionFinances({ tenantId }: { tenantId: string }) {
  const { fmt: fmtCurrency } = useFmt()
  const { t } = useLocale()
  const [paiements, setPaiements] = useState<PaiementScolaire[]>([])
  const [loading,   setLoading]   = useState(true)
  const [periode,   setPeriode]   = useState<'mois' | 'annee' | 'tout'>('mois')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const now   = new Date()
      let gte: string | null = null
      if (periode === 'mois')  gte = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      if (periode === 'annee') gte = new Date(now.getFullYear(), 0, 1).toISOString()
      let q = supabase.from('paiements_scolaires').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
      if (gte) q = q.gte('created_at', gte)
      const { data } = await q
      setPaiements((data ?? []) as PaiementScolaire[])
      setLoading(false)
    }
    load()
  }, [tenantId, periode])

  const totalPaye    = paiements.filter(p => p.statut === 'paye').reduce((s, p) => s + p.montant, 0)
  const byMethod     = paiements.reduce((acc, p) => { acc[p.methode] = (acc[p.methode] ?? 0) + p.montant; return acc }, {} as Record<string, number>)

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-[var(--surface-alt)] border border-[var(--border)] rounded-lg p-1 w-fit">
        {([['mois', t('ecole.direction.periode.mois')], ['annee', t('ecole.direction.periode.annee')], ['tout', t('ecole.direction.periode.tout')]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setPeriode(k)} className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{ background: periode === k ? '#00b9a7' : 'transparent', color: periode === k ? '#fff' : 'var(--text-secondary)' }}>
            {l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label={t('ecole.direction.fin.totalEncaisse')}   value={loading ? '…' : fmtCurrency(totalPaye)} color="#0F172A" />
        <KpiCard label={t('ecole.direction.fin.nbPaiements')}     value={loading ? '…' : paiements.length}         color="#DC2626" />
        <KpiCard label={t('ecole.direction.fin.moyenne')}         value={loading || !paiements.length ? '…' : fmtCurrency(totalPaye / paiements.length)} color="#DC2626" />
      </div>

      {Object.keys(byMethod).length > 0 && (
        <div className="rounded-xl border border-[var(--border)] p-4" style={{ background: '#FFFFFF' }}>
          <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">{t('ecole.direction.fin.repartitionMode')}</p>
          <div className="space-y-2">
            {Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([method, amount]) => {
              const pct = totalPaye > 0 ? (amount / totalPaye) * 100 : 0
              return (
                <div key={method}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#101729] capitalize">{method.replace('_', ' ')}</span>
                    <span className="text-[var(--text-secondary)]">{fmtCurrency(amount)} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--border)]">
                    <div className="h-2 rounded-full bg-[#DC2626]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && paiements.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]" style={{ background: '#FFFFFF' }}>
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('ecole.direction.fin.historique')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr style={{ background: '#FFFFFF' }}>{[t('common.date'), t('common.label'), t('common.method'), t('common.amount')].map(h => <th key={h} className="text-left px-4 py-2.5 text-[10px] text-[var(--text-secondary)]">{h}</th>)}</tr></thead>
              <tbody>
                {paiements.slice(0, 50).map(p => (
                  <tr key={p.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">{new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-2.5 text-[#101729]">{p.libelle}</td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)] capitalize">{p.methode.replace('_', ' ')}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#DC2626]">{fmtCurrency(p.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Événements ────────────────────────────────────────────────────────────────

function SectionEvenements({ tenantId }: { tenantId: string }) {
  const { t } = useLocale()
  const [planning,   setPlanning]   = useState<PlanningEcole[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [filterType, setFilterType] = useState<'tous' | TypeEvent>('tous')
  const [form, setForm] = useState({ titre: '', description: '', date_debut: '', date_fin: '', type: 'evenement' as TypeEvent })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('planning_ecole').select('*').eq('tenant_id', tenantId).order('date_debut').limit(200)
    setPlanning((data ?? []) as PlanningEcole[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    await supabase.from('planning_ecole').insert({ tenant_id: tenantId, titre: form.titre.trim(), description: form.description || null, date_debut: form.date_debut, date_fin: form.date_fin || null, type: form.type })
    setForm({ titre: '', description: '', date_debut: '', date_fin: '', type: 'evenement' })
    setShowForm(false); load(); setSaving(false)
  }

  async function del(id: string) {
    await supabase.from('planning_ecole').delete().eq('id', id); load()
  }

  const today     = new Date().toISOString().slice(0, 10)
  const displayed = planning.filter(p => filterType === 'tous' || p.type === filterType)

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[var(--text-secondary)]" size={18} /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 justify-between flex-wrap">
        <div className="flex gap-1 bg-[var(--surface-alt)] border border-[var(--border)] rounded-lg p-1">
          {(['tous', 'examen', 'conge_scolaire', 'evenement', 'conseil', 'autre'] as const).map(item => (
            <button key={item} onClick={() => setFilterType(item)} className="px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{ background: filterType === item ? '#00b9a7' : 'transparent', color: filterType === item ? '#fff' : 'var(--text-secondary)' }}>
              {item === 'tous' ? t('common.all') : TYPE_EVENT[item as TypeEvent]?.label ?? item}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: '#00b9a7', color: '#fff' }}>
          <Plus size={13} /> {t('ecole.direction.newEvent')}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-xl border border-[#DC2626]/30 p-4 space-y-3" style={{ background: 'rgba(56,139,253,0.04)' }}>
            <div className="grid grid-cols-2 gap-3">
              <FI label={t('common.titleField')} value={form.titre} onChange={v => setForm(p => ({ ...p, titre: v }))} />
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('common.type')}</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as TypeEvent }))} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] focus:outline-none">
                  {(Object.entries(TYPE_EVENT) as [TypeEvent, { label: string }][]).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <FI label={t('common.dateStart')} value={form.date_debut} onChange={v => setForm(p => ({ ...p, date_debut: v }))} type="date" />
              <FI label={t('common.dateEnd')}   value={form.date_fin}   onChange={v => setForm(p => ({ ...p, date_fin: v }))}   type="date" />
              <div className="col-span-2">
                <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('common.description')}</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[#101729] focus:outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={saving || !form.titre || !form.date_debut} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#00b9a7', color: '#fff' }}>
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} {t('common.save')}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-[var(--text-secondary)] border border-[var(--border)]">{t('common.cancel')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {displayed.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-secondary)] text-xs">{t('ecole.direction.noEvent')}</div>
      ) : (
        <div className="space-y-2">
          {displayed.map(p => {
            const ev = TYPE_EVENT[p.type] ?? TYPE_EVENT.autre
            return (
              <div key={p.id} className="rounded-xl border border-[var(--border)] p-4 flex items-start gap-4" style={{ background: '#FFFFFF', opacity: p.date_debut < today ? 0.5 : 1 }}>
                <div className="rounded-lg p-2.5 shrink-0" style={{ background: ev.bg }}><Calendar size={14} style={{ color: ev.color }} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#101729]">{p.titre}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: ev.color, background: ev.bg }}>{ev.label}</span>
                  </div>
                  {p.description && <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{p.description}</p>}
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                    {new Date(p.date_debut + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    {p.date_fin && ` → ${new Date(p.date_fin + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`}
                  </p>
                </div>
                <button onClick={() => del(p.id)} className="text-[var(--text-secondary)] hover:text-red-400"><Trash2 size={12} /></button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Bourses ───────────────────────────────────────────────────────────────────

function SectionBourses({ tenantId, etudiants }: { tenantId: string; etudiants: Etudiant[] }) {
  const { fmt: fmtCurrency } = useFmt()
  const { t } = useLocale()
  const [bourses, setBourses] = useState<{ id: string; etudiant_id: string; montant: number; libelle: string; created_at: string }[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({ etudiant_id: '', montant: '', libelle: '' })

  useEffect(() => {
    supabase.from('bourses_etudiants').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setBourses((data ?? []) as typeof bourses))
  }, [tenantId])

  async function add() {
    if (!form.etudiant_id || !form.montant || !form.libelle) return
    setSaving(true)
    const { data } = await supabase.from('bourses_etudiants').insert({ tenant_id: tenantId, etudiant_id: form.etudiant_id, montant: Number(form.montant), libelle: form.libelle }).select().single()
    if (data) setBourses(p => [data as typeof bourses[0], ...p])
    setForm({ etudiant_id: '', montant: '', libelle: '' }); setShowForm(false); setSaving(false)
  }

  const total = bourses.reduce((s, b) => s + b.montant, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <KpiCard label={t('ecole.direction.kpi.totalBourses')} value={fmtCurrency(total)} color="#7C3AED" />
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: '#7C3AED', color: '#fff' }}>
          <Plus size={13} /> {t('ecole.direction.newBourse')}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-xl border border-[#7C3AED]/30 p-4 space-y-3" style={{ background: 'rgba(139,92,246,0.04)' }}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('common.student')} *</label>
                <select value={form.etudiant_id} onChange={e => setForm(p => ({ ...p, etudiant_id: e.target.value }))} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] focus:outline-none">
                  <option value="">— {t('common.choose')} —</option>
                  {etudiants.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.numero_id})</option>)}
                </select>
              </div>
              <FI label={t('ecole.direction.bourse.montant')} value={form.montant} onChange={v => setForm(p => ({ ...p, montant: v }))} type="number" />
              <div className="col-span-2">
                <FI label={t('common.label')} value={form.libelle} onChange={v => setForm(p => ({ ...p, libelle: v }))} placeholder={t('ecole.direction.bourse.libellePlaceholder')} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={add} disabled={saving || !form.etudiant_id || !form.montant || !form.libelle} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#7C3AED', color: '#fff' }}>
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} {t('ecole.direction.newBourse')}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-[var(--text-secondary)] border border-[var(--border)]">{t('common.cancel')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {bourses.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-secondary)] text-xs">{t('ecole.direction.noBourse')}</div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr style={{ background: '#FFFFFF' }}>{[t('common.student'), t('common.label'), t('common.amount'), t('common.date')].map(h => <th key={h} className="text-left px-4 py-2.5 text-[10px] text-[var(--text-secondary)]">{h}</th>)}</tr></thead>
              <tbody>
                {bourses.map(b => {
                  const etu = etudiants.find(e => e.id === b.etudiant_id)
                  return (
                    <tr key={b.id} className="border-t border-[var(--border)]">
                      <td className="px-4 py-2.5">
                        {etu ? (
                          <div className="flex items-center gap-2">
                            <Avatar nom={etu.nom} prenom={etu.prenom} photoUrl={etu.photo_url} size={24} />
                            <span className="text-[#101729]">{etu.prenom} {etu.nom}</span>
                          </div>
                        ) : <span className="text-[var(--text-secondary)]">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--text-secondary)]">{b.libelle}</td>
                      <td className="px-4 py-2.5 font-semibold text-[#7C3AED]">{fmtCurrency(b.montant)}</td>
                      <td className="px-4 py-2.5 text-[var(--text-secondary)]">{new Date(b.created_at).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Partenaires ───────────────────────────────────────────────────────────────

function SectionPartenaires({ tenantId }: { tenantId: string }) {
  const { t } = useLocale()
  const [partenaires, setPartenaires] = useState<{ id: string; nom: string; type: string; contact: string | null; description: string | null; created_at: string }[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({ nom: '', type: 'entreprise', contact: '', description: '' })

  useEffect(() => {
    supabase.from('partenaires_ecole').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setPartenaires((data ?? []) as typeof partenaires))
  }, [tenantId])

  async function add() {
    if (!form.nom) return
    setSaving(true)
    const { data } = await supabase.from('partenaires_ecole').insert({ tenant_id: tenantId, nom: form.nom, type: form.type, contact: form.contact || null, description: form.description || null }).select().single()
    if (data) setPartenaires(p => [data as typeof partenaires[0], ...p])
    setForm({ nom: '', type: 'entreprise', contact: '', description: '' }); setShowForm(false); setSaving(false)
  }

  async function del(id: string) {
    await supabase.from('partenaires_ecole').delete().eq('id', id)
    setPartenaires(p => p.filter(x => x.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: '#ff7000', color: '#fff' }}>
          <Plus size={13} /> {t('ecole.direction.newPartner')}
        </button>
      </div>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-xl border border-[#DC2626]/30 p-4 space-y-3" style={{ background: 'rgba(240,163,10,0.04)' }}>
            <div className="grid grid-cols-2 gap-3">
              <FI label={t('common.nameField')} value={form.nom} onChange={v => setForm(p => ({ ...p, nom: v }))} />
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('common.type')}</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] focus:outline-none">
                  {['entreprise', 'ong', 'gouvernement', 'universite', 'autre'].map(item => <option key={item} value={item} className="capitalize">{item.charAt(0).toUpperCase() + item.slice(1)}</option>)}
                </select>
              </div>
              <FI label={t('common.contact')} value={form.contact} onChange={v => setForm(p => ({ ...p, contact: v }))} placeholder={t('ecole.direction.partner.contactPlaceholder')} />
              <FI label={t('common.description')} value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} placeholder={t('ecole.direction.partner.descPlaceholder')} />
            </div>
            <div className="flex gap-2">
              <button onClick={add} disabled={saving || !form.nom} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#ff7000', color: '#fff' }}>
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} {t('common.save')}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-[var(--text-secondary)] border border-[var(--border)]">{t('common.cancel')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {partenaires.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-secondary)] text-xs">{t('ecole.direction.noPartner')}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {partenaires.map(p => (
            <div key={p.id} className="rounded-xl border border-[var(--border)] p-4" style={{ background: '#FFFFFF' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold text-[#101729]">{p.nom}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 capitalize">{p.type}</p>
                  {p.contact && <p className="text-[10px] text-[#DC2626] mt-1">{p.contact}</p>}
                  {p.description && <p className="text-[10px] text-[var(--text-secondary)] mt-1">{p.description}</p>}
                </div>
                <button onClick={() => del(p.id)} className="text-[var(--text-secondary)] hover:text-red-400"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Communication ─────────────────────────────────────────────────────────────

function SectionCommunication({ tenantId }: { tenantId: string }) {
  const { t } = useLocale()
  const [annonces, setAnnonces] = useState<{ id: string; titre: string; message: string; cible: string; created_at: string }[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({ titre: '', message: '', cible: 'tous' })

  useEffect(() => {
    supabase.from('annonces_ecole').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setAnnonces((data ?? []) as typeof annonces))
  }, [tenantId])

  async function add() {
    if (!form.titre || !form.message) return
    setSaving(true)
    const { data } = await supabase.from('annonces_ecole').insert({ tenant_id: tenantId, titre: form.titre, message: form.message, cible: form.cible }).select().single()
    if (data) setAnnonces(p => [data as typeof annonces[0], ...p])
    setForm({ titre: '', message: '', cible: 'tous' }); setShowForm(false); setSaving(false)
  }

  async function del(id: string) {
    await supabase.from('annonces_ecole').delete().eq('id', id)
    setAnnonces(p => p.filter(x => x.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: '#7C3AED', color: '#fff' }}>
          <Megaphone size={13} /> {t('ecole.direction.sendMessage')}
        </button>
      </div>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-xl border border-[#7C3AED]/30 p-4 space-y-3" style={{ background: 'rgba(236,72,153,0.04)' }}>
            <div className="space-y-3">
              <FI label={t('common.titleField')} value={form.titre} onChange={v => setForm(p => ({ ...p, titre: v }))} />
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('ecole.direction.comm.destinataires')}</label>
                <select value={form.cible} onChange={e => setForm(p => ({ ...p, cible: e.target.value }))} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] focus:outline-none">
                  {['tous', 'etudiants', 'parents', 'enseignants'].map(c => <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('common.message')} *</label>
                <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} rows={3} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[#101729] focus:outline-none resize-none" placeholder={t('ecole.direction.comm.messagePlaceholder')} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={add} disabled={saving || !form.titre || !form.message} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#7C3AED', color: '#fff' }}>
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Megaphone size={12} />} {t('ecole.direction.comm.publier')}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-[var(--text-secondary)] border border-[var(--border)]">{t('common.cancel')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {annonces.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-secondary)] text-xs">{t('ecole.direction.comm.noAnnonce')}</div>
      ) : (
        <div className="space-y-3">
          {annonces.map(a => (
            <div key={a.id} className="rounded-xl border border-[var(--border)] p-4" style={{ background: '#FFFFFF' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-[#101729]">{a.titre}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] font-bold capitalize">{a.cible}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{a.message}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-2">{new Date(a.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
                <button onClick={() => del(a.id)} className="text-[var(--text-secondary)] hover:text-red-400 ml-3 shrink-0"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DirectionPage() {
  const { fmt: fmtCurrency } = useFmt()
  useRoleGuard(['DIRECTION_GENERALE'])
  const { tenantId, loading: tenantLoading } = useTenant()
  const { t } = useLocale()

  const SUB_TABS = [
    { id: 'vue'          as SubTab, label: t('ecole.direction.tab.vue'),           icon: TrendingUp  },
    { id: 'finances'     as SubTab, label: t('ecole.direction.tab.finances'),      icon: DollarSign  },
    { id: 'evenements'   as SubTab, label: t('ecole.direction.tab.evenements'),    icon: Calendar    },
    { id: 'bourses'      as SubTab, label: t('ecole.direction.tab.bourses'),       icon: Award       },
    { id: 'partenaires'  as SubTab, label: t('ecole.direction.tab.partenaires'),   icon: Handshake   },
    { id: 'communication'as SubTab, label: t('ecole.direction.tab.communication'), icon: Megaphone   },
    { id: 'diplomes'     as SubTab, label: t('ecole.direction.tab.diplomes'),      icon: GraduationCap },
    { id: 'soutenances'  as SubTab, label: t('ecole.direction.tab.soutenances'),   icon: Swords      },
  ]

  const [subTab,     setSubTab]     = useState<SubTab>('vue')
  const [etudiants,  setEtudiants]  = useState<Etudiant[]>([])
  const [enseignants,setEnseignants]= useState<Enseignant[]>([])
  const [classes,    setClasses]    = useState<ClasseEcole[]>([])
  const [loading,    setLoading]    = useState(true)
  const [nomEcole,   setNomEcole]   = useState('Mon École')

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [{ data: etus }, { data: tenant }, { data: ens }, { data: cls }] = await Promise.all([
      supabase.from('etudiants').select('*').eq('tenant_id', tenantId).order('nom').limit(200),
      supabase.from('tenants').select('nom_entreprise').eq('id', tenantId).limit(1).maybeSingle(),
      supabase.from('enseignants').select('*').eq('tenant_id', tenantId).limit(200),
      supabase.from('classes_ecole').select('*').eq('tenant_id', tenantId).limit(200),
    ])
    setEtudiants((etus ?? []) as Etudiant[])
    setEnseignants((ens ?? []) as Enseignant[])
    setClasses((cls ?? []) as ClasseEcole[])
    if (tenant?.nom_entreprise) setNomEcole(tenant.nom_entreprise)
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  if (tenantLoading || loading) return (
    <div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">
      <Loader2 className="animate-spin mr-2" size={18} /> {t('common.loading')}
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#101729]">{t('ecole.direction.title')}</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{nomEcole}</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729] transition-colors"><RefreshCw size={14} /></button>
      </div>

      <div className="flex gap-1 bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl p-1 overflow-x-auto scrollbar-none">
        {SUB_TABS.map(tab_ => {
          const Icon = tab_.icon
          return (
            <button key={tab_.id} onClick={() => setSubTab(tab_.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0"
              style={{ background: subTab === tab_.id ? '#00b9a7' : 'transparent', color: subTab === tab_.id ? '#fff' : 'var(--text-secondary)' }}>
              <Icon size={12} /> {tab_.label}
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={subTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
          {subTab === 'vue'          && tenantId && <SectionVue          tenantId={tenantId} etudiants={etudiants} enseignants={enseignants} classes={classes} onRefresh={load} />}
          {subTab === 'finances'     && tenantId && <SectionFinances     tenantId={tenantId} />}
          {subTab === 'evenements'   && tenantId && <SectionEvenements   tenantId={tenantId} />}
          {subTab === 'bourses'      && tenantId && <SectionBourses      tenantId={tenantId} etudiants={etudiants} />}
          {subTab === 'partenaires'  && tenantId && <SectionPartenaires  tenantId={tenantId} />}
          {subTab === 'communication'&& tenantId && <SectionCommunication tenantId={tenantId} />}
          {subTab === 'diplomes'     && tenantId && <SectionDiplomes     tenantId={tenantId} etudiants={etudiants} nomEcole={nomEcole} />}
          {subTab === 'soutenances'  && tenantId && <SectionSoutenances  tenantId={tenantId} etudiants={etudiants} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
