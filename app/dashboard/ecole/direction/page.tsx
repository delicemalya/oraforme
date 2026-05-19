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

type SubTab = 'vue' | 'finances' | 'evenements' | 'bourses' | 'partenaires' | 'communication'
           | 'diplomes' | 'soutenances'

const SUB_TABS = [
  { id: 'vue'          as SubTab, label: 'Vue Globale',   icon: TrendingUp  },
  { id: 'finances'     as SubTab, label: 'Finances',      icon: DollarSign  },
  { id: 'evenements'   as SubTab, label: 'Événements',    icon: Calendar    },
  { id: 'bourses'      as SubTab, label: 'Bourses',       icon: Award       },
  { id: 'partenaires'  as SubTab, label: 'Partenaires',   icon: Handshake   },
  { id: 'communication'as SubTab, label: 'Communication', icon: Megaphone   },
  { id: 'diplomes'     as SubTab, label: 'Diplômes',      icon: GraduationCap },
  { id: 'soutenances'  as SubTab, label: 'Soutenances',   icon: Swords      },
]

// ── Vue Globale ───────────────────────────────────────────────────────────────

function SectionVue({ tenantId, etudiants, enseignants, classes, onRefresh }: {
  tenantId: string; etudiants: Etudiant[]; enseignants: Enseignant[]; classes: ClasseEcole[]; onRefresh: () => void
}) {
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
    { label: 'Revenu du mois',   value: statsLoading ? '…' : fmt(revenuMois) + ' FCFA',   color: '#0D2147' },
    { label: 'Revenu de l\'année', value: statsLoading ? '…' : fmt(revenuAnnee) + ' FCFA', color: '#F07900' },
    { label: 'Étudiants',        value: etudiants.filter(e => e.statut === 'actif').length, color: '#F0A30A' },
    { label: 'Impayés',          value: statsLoading ? '…' : impayeCount,                  color: '#F01F38' },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        {kpis.map(k => <KpiCard key={k.label} label={k.label} value={k.value} color={k.color} />)}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Enseignants actifs" value={enseignants.filter(e => e.statut === 'actif').length} color="#8B0073" />
        <KpiCard label="Classes" value={classes.length} color="#0D2147" />
        <KpiCard label="Diplômés" value={etudiants.filter(e => e.statut === 'diplome').length} color="#8B0073" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#F01F38]/30 p-4 space-y-3" style={{ background: 'rgba(248,81,73,0.04)' }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-[#F01F38]" />
            <p className="text-xs font-bold text-[#F01F38]">Gestion des impayés</p>
          </div>
          <p className="text-xs text-[#8B949E] leading-relaxed">
            Suspendre automatiquement les étudiants actifs sans paiement cette année. Un code de déblocage est généré pour chacun.
          </p>
          <button onClick={autoBlock} disabled={blocking || impayeCount === 0 || statsLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
            style={{ background: '#F01F38', color: '#fff' }}>
            {blocking ? <Loader2 className="animate-spin" size={12} /> : <Unlock size={12} />}
            Bloquer {impayeCount} impayé(s)
          </button>
        </div>

        <div className="rounded-xl border border-white/[0.06] p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <p className="text-xs font-bold text-[#8B949E] uppercase tracking-wider mb-3">Effectifs par classe</p>
          {classes.length === 0 ? (
            <p className="text-xs text-[#484F58]">Aucune classe configurée.</p>
          ) : (
            <div className="space-y-2">
              {classes.map(c => {
                const nb  = etudiants.filter(e => e.classe === c.nom).length
                const pct = c.nb_places > 0 ? Math.min((nb / c.nb_places) * 100, 100) : 0
                return (
                  <div key={c.id}>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-white">{c.nom}</span>
                      <span className="text-[#8B949E]">{nb}/{c.nb_places}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06]">
                      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: pct > 90 ? '#F01F38' : '#F0A30A' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {recentPaie.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">Derniers paiements</p>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr style={{ background: 'rgba(255,255,255,0.02)' }}>{['Date', 'Étudiant', 'Libellé', 'Méthode', 'Montant'].map(h => <th key={h} className="text-left px-4 py-2.5 text-[10px] text-[#8B949E]">{h}</th>)}</tr></thead>
            <tbody>
              {recentPaie.map(p => {
                const etu = etudiants.find(e => e.id === p.etudiant_id)
                return (
                  <tr key={p.id} className="border-t border-white/[0.04]">
                    <td className="px-4 py-2.5 text-[#8B949E]">{new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-2.5 text-white">{etu ? `${etu.prenom} ${etu.nom}` : '—'}</td>
                    <td className="px-4 py-2.5 text-[#8B949E]">{p.libelle}</td>
                    <td className="px-4 py-2.5 text-[#8B949E] capitalize">{p.methode.replace('_', ' ')}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#0D2147]">{fmt(p.montant)} FCFA</td>
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
      <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-1 w-fit">
        {([['mois', 'Ce mois'], ['annee', 'Cette année'], ['tout', 'Tout']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setPeriode(k)} className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{ background: periode === k ? '#F07900' : 'transparent', color: periode === k ? '#fff' : '#8B949E' }}>
            {l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Total encaissé" value={loading ? '…' : fmt(totalPaye) + ' FCFA'} color="#0D2147" />
        <KpiCard label="Nb paiements"   value={loading ? '…' : paiements.length}         color="#F07900" />
        <KpiCard label="Moyenne/paiement" value={loading || !paiements.length ? '…' : fmt(totalPaye / paiements.length) + ' FCFA'} color="#F0A30A" />
      </div>

      {Object.keys(byMethod).length > 0 && (
        <div className="rounded-xl border border-white/[0.06] p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <p className="text-xs font-bold text-[#8B949E] uppercase tracking-wider mb-3">Répartition par mode de paiement</p>
          <div className="space-y-2">
            {Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([method, amount]) => {
              const pct = totalPaye > 0 ? (amount / totalPaye) * 100 : 0
              return (
                <div key={method}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white capitalize">{method.replace('_', ' ')}</span>
                    <span className="text-[#8B949E]">{fmt(amount)} FCFA ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.06]">
                    <div className="h-2 rounded-full bg-[#F07900]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && paiements.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">Historique</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr style={{ background: 'rgba(255,255,255,0.02)' }}>{['Date', 'Libellé', 'Méthode', 'Montant'].map(h => <th key={h} className="text-left px-4 py-2.5 text-[10px] text-[#8B949E]">{h}</th>)}</tr></thead>
              <tbody>
                {paiements.slice(0, 50).map(p => (
                  <tr key={p.id} className="border-t border-white/[0.04]">
                    <td className="px-4 py-2.5 text-[#8B949E]">{new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-2.5 text-white">{p.libelle}</td>
                    <td className="px-4 py-2.5 text-[#8B949E] capitalize">{p.methode.replace('_', ' ')}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#0D2147]">{fmt(p.montant)} FCFA</td>
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
  const [planning,   setPlanning]   = useState<PlanningEcole[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [filterType, setFilterType] = useState<'tous' | TypeEvent>('tous')
  const [form, setForm] = useState({ titre: '', description: '', date_debut: '', date_fin: '', type: 'evenement' as TypeEvent })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('planning_ecole').select('*').eq('tenant_id', tenantId).order('date_debut')
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

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#8B949E]" size={18} /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 justify-between flex-wrap">
        <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-1">
          {(['tous', 'examen', 'conge_scolaire', 'evenement', 'conseil', 'autre'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)} className="px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{ background: filterType === t ? '#F07900' : 'transparent', color: filterType === t ? '#fff' : '#8B949E' }}>
              {t === 'tous' ? 'Tous' : TYPE_EVENT[t as TypeEvent]?.label ?? t}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: 'linear-gradient(135deg,#F07900,#1a6fd4)', color: '#fff' }}>
          <Plus size={13} /> Programmer
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-xl border border-[#F07900]/30 p-4 space-y-3" style={{ background: 'rgba(56,139,253,0.04)' }}>
            <div className="grid grid-cols-2 gap-3">
              <FI label="Titre *" value={form.titre} onChange={v => setForm(p => ({ ...p, titre: v }))} />
              <div>
                <label className="block text-xs text-[#8B949E] mb-1">Type</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as TypeEvent }))} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none">
                  {(Object.entries(TYPE_EVENT) as [TypeEvent, { label: string }][]).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <FI label="Date début *" value={form.date_debut} onChange={v => setForm(p => ({ ...p, date_debut: v }))} type="date" />
              <FI label="Date fin"     value={form.date_fin}   onChange={v => setForm(p => ({ ...p, date_fin: v }))}   type="date" />
              <div className="col-span-2">
                <label className="block text-xs text-[#8B949E] mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={saving || !form.titre || !form.date_debut} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#F07900', color: '#fff' }}>
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} Enregistrer
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-[#8B949E] border border-white/[0.06]">Annuler</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {displayed.length === 0 ? (
        <div className="text-center py-12 text-[#8B949E] text-xs">Aucun événement planifié.</div>
      ) : (
        <div className="space-y-2">
          {displayed.map(p => {
            const t = TYPE_EVENT[p.type] ?? TYPE_EVENT.autre
            return (
              <div key={p.id} className="rounded-xl border border-white/[0.06] p-4 flex items-start gap-4" style={{ background: 'rgba(255,255,255,0.02)', opacity: p.date_debut < today ? 0.5 : 1 }}>
                <div className="rounded-lg p-2.5 shrink-0" style={{ background: t.bg }}><Calendar size={14} style={{ color: t.color }} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{p.titre}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: t.color, background: t.bg }}>{t.label}</span>
                  </div>
                  {p.description && <p className="text-[11px] text-[#8B949E] mt-0.5">{p.description}</p>}
                  <p className="text-[10px] text-[#484F58] mt-1">
                    {new Date(p.date_debut + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    {p.date_fin && ` → ${new Date(p.date_fin + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`}
                  </p>
                </div>
                <button onClick={() => del(p.id)} className="text-[#484F58] hover:text-red-400"><Trash2 size={12} /></button>
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
  const [bourses, setBourses] = useState<{ id: string; etudiant_id: string; montant: number; libelle: string; created_at: string }[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({ etudiant_id: '', montant: '', libelle: '' })

  useEffect(() => {
    supabase.from('bourses_etudiants').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
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
        <KpiCard label="Total bourses accordées" value={fmt(total) + ' FCFA'} color="#8B0073" />
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: 'linear-gradient(135deg,#8B0073,#7c3aed)', color: '#fff' }}>
          <Plus size={13} /> Accorder une bourse
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-xl border border-[#8B0073]/30 p-4 space-y-3" style={{ background: 'rgba(139,92,246,0.04)' }}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#8B949E] mb-1">Étudiant *</label>
                <select value={form.etudiant_id} onChange={e => setForm(p => ({ ...p, etudiant_id: e.target.value }))} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none">
                  <option value="">— Choisir —</option>
                  {etudiants.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.numero_id})</option>)}
                </select>
              </div>
              <FI label="Montant (FCFA) *" value={form.montant} onChange={v => setForm(p => ({ ...p, montant: v }))} type="number" />
              <div className="col-span-2">
                <FI label="Libellé *" value={form.libelle} onChange={v => setForm(p => ({ ...p, libelle: v }))} placeholder="Bourse d'excellence, Aide sociale…" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={add} disabled={saving || !form.etudiant_id || !form.montant || !form.libelle} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#8B0073', color: '#fff' }}>
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} Accorder
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-[#8B949E] border border-white/[0.06]">Annuler</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {bourses.length === 0 ? (
        <div className="text-center py-12 text-[#8B949E] text-xs">Aucune bourse accordée.</div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr style={{ background: 'rgba(255,255,255,0.02)' }}>{['Étudiant', 'Libellé', 'Montant', 'Date'].map(h => <th key={h} className="text-left px-4 py-2.5 text-[10px] text-[#8B949E]">{h}</th>)}</tr></thead>
              <tbody>
                {bourses.map(b => {
                  const etu = etudiants.find(e => e.id === b.etudiant_id)
                  return (
                    <tr key={b.id} className="border-t border-white/[0.04]">
                      <td className="px-4 py-2.5">
                        {etu ? (
                          <div className="flex items-center gap-2">
                            <Avatar nom={etu.nom} prenom={etu.prenom} photoUrl={etu.photo_url} size={24} />
                            <span className="text-white">{etu.prenom} {etu.nom}</span>
                          </div>
                        ) : <span className="text-[#484F58]">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-[#8B949E]">{b.libelle}</td>
                      <td className="px-4 py-2.5 font-semibold text-[#8B0073]">{fmt(b.montant)} FCFA</td>
                      <td className="px-4 py-2.5 text-[#8B949E]">{new Date(b.created_at).toLocaleDateString('fr-FR')}</td>
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
  const [partenaires, setPartenaires] = useState<{ id: string; nom: string; type: string; contact: string | null; description: string | null; created_at: string }[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({ nom: '', type: 'entreprise', contact: '', description: '' })

  useEffect(() => {
    supabase.from('partenaires_ecole').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
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
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: 'linear-gradient(135deg,#F0A30A,#d4880a)', color: '#0D1117' }}>
          <Plus size={13} /> Ajouter un partenaire
        </button>
      </div>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-xl border border-[#F0A30A]/30 p-4 space-y-3" style={{ background: 'rgba(240,163,10,0.04)' }}>
            <div className="grid grid-cols-2 gap-3">
              <FI label="Nom *" value={form.nom} onChange={v => setForm(p => ({ ...p, nom: v }))} />
              <div>
                <label className="block text-xs text-[#8B949E] mb-1">Type</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none">
                  {['entreprise', 'ong', 'gouvernement', 'universite', 'autre'].map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <FI label="Contact" value={form.contact} onChange={v => setForm(p => ({ ...p, contact: v }))} placeholder="Téléphone ou email" />
              <FI label="Description" value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} placeholder="Type de partenariat…" />
            </div>
            <div className="flex gap-2">
              <button onClick={add} disabled={saving || !form.nom} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#F0A30A', color: '#0D1117' }}>
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} Enregistrer
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-[#8B949E] border border-white/[0.06]">Annuler</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {partenaires.length === 0 ? (
        <div className="text-center py-12 text-[#8B949E] text-xs">Aucun partenaire enregistré.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {partenaires.map(p => (
            <div key={p.id} className="rounded-xl border border-white/[0.06] p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold text-white">{p.nom}</p>
                  <p className="text-[10px] text-[#8B949E] mt-0.5 capitalize">{p.type}</p>
                  {p.contact && <p className="text-[10px] text-[#F07900] mt-1">{p.contact}</p>}
                  {p.description && <p className="text-[10px] text-[#8B949E] mt-1">{p.description}</p>}
                </div>
                <button onClick={() => del(p.id)} className="text-[#484F58] hover:text-red-400"><Trash2 size={12} /></button>
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
  const [annonces, setAnnonces] = useState<{ id: string; titre: string; message: string; cible: string; created_at: string }[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({ titre: '', message: '', cible: 'tous' })

  useEffect(() => {
    supabase.from('annonces_ecole').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
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
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: 'linear-gradient(135deg,#EC4899,#be185d)', color: '#fff' }}>
          <Megaphone size={13} /> Nouvelle annonce
        </button>
      </div>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-xl border border-[#EC4899]/30 p-4 space-y-3" style={{ background: 'rgba(236,72,153,0.04)' }}>
            <div className="space-y-3">
              <FI label="Titre *" value={form.titre} onChange={v => setForm(p => ({ ...p, titre: v }))} />
              <div>
                <label className="block text-xs text-[#8B949E] mb-1">Destinataires</label>
                <select value={form.cible} onChange={e => setForm(p => ({ ...p, cible: e.target.value }))} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none">
                  {['tous', 'etudiants', 'parents', 'enseignants'].map(c => <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#8B949E] mb-1">Message *</label>
                <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} rows={3} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none" placeholder="Rédigez votre annonce…" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={add} disabled={saving || !form.titre || !form.message} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#EC4899', color: '#fff' }}>
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Megaphone size={12} />} Publier
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-[#8B949E] border border-white/[0.06]">Annuler</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {annonces.length === 0 ? (
        <div className="text-center py-12 text-[#8B949E] text-xs">Aucune annonce publiée.</div>
      ) : (
        <div className="space-y-3">
          {annonces.map(a => (
            <div key={a.id} className="rounded-xl border border-white/[0.06] p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-white">{a.titre}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EC4899]/10 text-[#EC4899] font-bold capitalize">{a.cible}</span>
                  </div>
                  <p className="text-xs text-[#8B949E] leading-relaxed">{a.message}</p>
                  <p className="text-[10px] text-[#484F58] mt-2">{new Date(a.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
                <button onClick={() => del(a.id)} className="text-[#484F58] hover:text-red-400 ml-3 shrink-0"><Trash2 size={12} /></button>
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
  useRoleGuard(['DIRECTION_GENERALE'])
  const { tenantId, loading: tenantLoading } = useTenant()
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
      supabase.from('etudiants').select('*').eq('tenant_id', tenantId).order('nom'),
      supabase.from('tenants').select('nom_entreprise').eq('id', tenantId).maybeSingle(),
      supabase.from('enseignants').select('*').eq('tenant_id', tenantId),
      supabase.from('classes_ecole').select('*').eq('tenant_id', tenantId),
    ])
    setEtudiants((etus ?? []) as Etudiant[])
    setEnseignants((ens ?? []) as Enseignant[])
    setClasses((cls ?? []) as ClasseEcole[])
    if (tenant?.nom_entreprise) setNomEcole(tenant.nom_entreprise)
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  if (tenantLoading || loading) return (
    <div className="flex items-center justify-center h-64 text-[#8B949E]">
      <Loader2 className="animate-spin mr-2" size={18} /> Chargement…
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Direction Générale</h1>
          <p className="text-xs text-[#8B949E] mt-0.5">{nomEcole}</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-white/[0.08] text-[#8B949E] hover:text-white transition-colors"><RefreshCw size={14} /></button>
      </div>

      <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit flex-wrap">
        {SUB_TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setSubTab(t.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
              style={{ background: subTab === t.id ? '#F07900' : 'transparent', color: subTab === t.id ? '#fff' : '#8B949E' }}>
              <Icon size={12} /> {t.label}
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
