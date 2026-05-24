'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserCheck, Plus, Trash2, ChevronRight, X, Check,
  AlertTriangle, Calendar, Clock, TrendingUp,
  Users, Bell, FileText, Edit3, Loader2, Briefcase,
} from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

// ── Types ─────────────────────────────────────────────────────────────────────

type Contrat = 'cdi' | 'cdd' | 'stage' | 'freelance'
type Statut  = 'actif' | 'conge' | 'malade' | 'licencie' | 'retraite'
type TypeConge = 'annuel' | 'maladie' | 'maternite' | 'exceptionnel'

interface Employe {
  id: string
  nom: string
  poste: string
  email: string
  telephone: string
  salaire_base: number
  contrat: Contrat
  statut: Statut
  cnss: string
  agent_code: string | null
  matricule: string | null
  ville: string | null
  date_embauche: string | null
  date_naissance: string | null
  date_fin_contrat: string | null
  date_retraite_prevue: string | null
  solde_conges: number
  notes: string
  created_at: string
}

interface Conge {
  id: string
  employe_id: string
  type_conge: TypeConge
  date_debut: string
  date_fin: string
  nb_jours: number
  statut: string
  motif: string
  created_at: string
  employes?: { nom: string }
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const CONTRAT_STYLES: Record<Contrat, { label: string; color: string; bg: string }> = {
  cdi:       { label: 'CDI',       color: '#10B981', bg: '#D1FAE5' },
  cdd:       { label: 'CDD',       color: '#F59E0B', bg: '#FEF3C7' },
  stage:     { label: 'Stage',     color: '#3B82F6', bg: '#DBEAFE' },
  freelance: { label: 'Freelance', color: '#8B5CF6', bg: '#EDE9FE' },
}

const STATUT_STYLES: Record<Statut, { label: string; color: string; bg: string }> = {
  actif:    { label: 'Actif',     color: '#10B981', bg: '#D1FAE5' },
  conge:    { label: 'En congé',  color: '#F59E0B', bg: '#FEF3C7' },
  malade:   { label: 'Malade',    color: '#EF4444', bg: '#FEE2E2' },
  licencie: { label: 'Licencié', color: '#6B7280', bg: '#F3F4F6' },
  retraite: { label: 'Retraité', color: '#9CA3AF', bg: '#F9FAFB' },
}

const TAUX_CNSS_SALARIE  = 0.0504
const TAUX_CNSS_PATRONAL = 0.1416
const PLAFOND_CNSS       = 3_375_000

function calcNet(brut: number) {
  const base  = Math.min(brut, PLAFOND_CNSS)
  const cnss  = Math.round(base * TAUX_CNSS_SALARIE)
  const irpp  = Math.round(calcIRPP((brut - cnss) * 0.9))
  const net   = brut - cnss - irpp
  const patro = Math.round(base * TAUX_CNSS_PATRONAL)
  return { cnss, irpp, net, patro }
}

function calcIRPP(imposable: number): number {
  if (imposable <= 50_000)  return 0
  if (imposable <= 100_000) return (imposable - 50_000)  * 0.01
  if (imposable <= 250_000) return 500  + (imposable - 100_000) * 0.10
  if (imposable <= 500_000) return 15_500 + (imposable - 250_000) * 0.20
  return 65_500 + (imposable - 500_000) * 0.30
}

function fmt(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)) }

function daysBetween(d1: string, d2: Date = new Date()) {
  return Math.floor((d2.getTime() - new Date(d1).getTime()) / 86400000)
}

function ageYears(dob: string) {
  return Math.floor(daysBetween(dob) / 365.25)
}

// ── Composants ─────────────────────────────────────────────────────────────────

function StatutBadge({ statut }: { statut: Statut }) {
  const s = STATUT_STYLES[statut] ?? STATUT_STYLES.actif
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: s.color, backgroundColor: s.bg }}>
      {s.label}
    </span>
  )
}

function ContratBadge({ contrat }: { contrat: Contrat }) {
  const s = CONTRAT_STYLES[contrat] ?? CONTRAT_STYLES.cdi
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: s.color, backgroundColor: s.bg }}>
      {s.label}
    </span>
  )
}

// ── Onglet : Équipe ────────────────────────────────────────────────────────────

function TabEquipe({ tenantId, employes, onRefresh }: {
  tenantId: string; employes: Employe[]; onRefresh: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [selected, setSelected] = useState<Employe | null>(null)
  const [filterStatut, setFilterStatut] = useState<string>('tous')
  const [form, setForm] = useState({
    nom: '', poste: '', email: '', telephone: '',
    salaire_base: '', contrat: 'cdi' as Contrat,
    statut: 'actif' as Statut, cnss: '',
    date_embauche: '', date_naissance: '',
    date_fin_contrat: '', notes: '', ville: 'PNR',
  })

  const displayed = filterStatut === 'tous'
    ? employes
    : employes.filter(e => e.statut === filterStatut)

  async function handleSave() {
    if (!form.nom.trim()) return
    setSaving(true)
    await fetch('/api/hr/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom: form.nom, poste: form.poste,
        email: form.email, telephone: form.telephone,
        salaire_base: Number(form.salaire_base) || 0,
        contrat: form.contrat, statut: form.statut, cnss: form.cnss,
        date_embauche: form.date_embauche || null,
        date_naissance: form.date_naissance || null,
        date_fin_contrat: form.date_fin_contrat || null,
        notes: form.notes, ville: form.ville,
      }),
    })
    setSaving(false)
    setShowForm(false)
    setForm({ nom:'',poste:'',email:'',telephone:'',salaire_base:'',contrat:'cdi',statut:'actif',cnss:'',date_embauche:'',date_naissance:'',date_fin_contrat:'',notes:'',ville:'PNR' })
    onRefresh()
  }

  async function updateStatut(id: string, statut: string) {
    await supabase.from('employes').update({ statut }).eq('id', id)
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, statut: statut as Statut } : null)
    onRefresh()
  }

  async function handleDelete(id: string) {
    await supabase.from('employes').delete().eq('id', id)
    setSelected(null)
    onRefresh()
  }

  const masseBrute = employes.filter(e => e.statut === 'actif').reduce((s, e) => s + e.salaire_base, 0)

  return (
    <div className="space-y-4">
      {/* KPIs hero gradient */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Effectif actif',    val: employes.filter(e=>e.statut==='actif').length,        gradient: '#10B981',  icon: Users },
          { label: 'En congé / Malade', val: employes.filter(e=>['conge','malade'].includes(e.statut)).length, gradient: '#F59E0B', icon: Calendar },
          { label: 'Masse salariale',   val: `${fmt(masseBrute)} F`,                               gradient: '#3B82F6',   icon: TrendingUp },
          { label: 'Charge patronale',  val: `${fmt(masseBrute * TAUX_CNSS_PATRONAL)} F`,          gradient: '#8B5CF6',  icon: AlertTriangle },
        ].map(k => {
          const Icon = k.icon
          return (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2, scale: 1.01 }}
              className="relative rounded-2xl p-4 overflow-hidden"
              style={{ background: k.gradient }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'transparent' }} />
              <div className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Icon size={14} className="text-white" />
              </div>
              <div className="relative">
                <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wide mb-2">{k.label}</p>
                <p className="text-white text-xl font-bold leading-none">{k.val}</p>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {['tous','actif','conge','malade','licencie','retraite'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatut(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterStatut === s
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
              }`}
            >
              {s === 'tous' ? 'Tous' : STATUT_STYLES[s as Statut]?.label ?? s}
            </button>
          ))}
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-2 bg-[var(--primary)] text-white rounded-lg text-xs font-bold"
        >
          <Plus size={13} /> Ajouter un employé
        </motion.button>
      </div>

      {/* Employee list */}
      {displayed.length === 0 ? (
        <div className="text-center py-14 text-[var(--text-secondary)]">
          <Users size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucun employé dans cette catégorie.</p>
        </div>
      ) : (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['Employé','Code agent','Poste','Contrat','Statut','Brut mensuel','Net estimé',''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {displayed.map((e, i) => {
                  const calc = calcNet(e.salaire_base)
                  return (
                    <motion.tr
                      key={e.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="hover:bg-white/5/50 transition-colors cursor-pointer"
                      onClick={() => setSelected(e)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#7C3AED]/15 flex items-center justify-center text-[10px] font-bold text-[#7C3AED] shrink-0">
                            {e.nom.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-semibold text-[var(--text)]">{e.nom}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[10px] text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded">
                          {e.agent_code ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{e.poste || '—'}</td>
                      <td className="px-4 py-3"><ContratBadge contrat={e.contrat} /></td>
                      <td className="px-4 py-3"><StatutBadge statut={e.statut} /></td>
                      <td className="px-4 py-3 text-xs text-[var(--text)] font-semibold">{fmt(e.salaire_base)} F</td>
                      <td className="px-4 py-3 text-xs font-bold text-[var(--success)]">{fmt(calc.net)} F</td>
                      <td className="px-4 py-3 text-right" onClick={ev => ev.stopPropagation()}>
                        <button onClick={() => handleDelete(e.id)} className="text-[var(--text-secondary)] hover:text-red-400 transition-colors p-1">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Employee detail panel */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setSelected(null)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-[var(--card-bg)] border-l border-[var(--border)] z-50 overflow-y-auto"
            >
              <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#7C3AED]/15 flex items-center justify-center text-lg font-bold text-[#7C3AED]">
                      {selected.nom.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-[var(--text)]">{selected.nom}</h2>
                      <p className="text-xs text-[var(--text-secondary)]">{selected.poste || 'Aucun poste'}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-secondary)] p-1">
                    <X size={18} />
                  </button>
                </div>

                {/* Status + badges */}
                <div className="flex gap-2 flex-wrap">
                  <StatutBadge statut={selected.statut} />
                  <ContratBadge contrat={selected.contrat} />
                  <span className="text-[10px] text-[var(--text-secondary)] border border-[var(--border)] rounded-full px-2 py-0.5">
                    {selected.solde_conges ?? 26} j congés
                  </span>
                </div>

                {/* Change status */}
                <div>
                  <p className="text-xs font-bold text-[var(--text-secondary)] mb-2">Changer le statut</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(STATUT_STYLES) as Statut[]).map(s => (
                      <button
                        key={s}
                        onClick={() => updateStatut(selected.id, s)}
                        className={`py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                          selected.statut === s
                            ? 'ring-1 ring-[#DC2626] text-[var(--primary)] bg-[var(--primary)]/10'
                            : 'border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                        }`}
                      >
                        {STATUT_STYLES[s].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info grid */}
                <div className="space-y-2">
                  {[
                    ['Code agent', selected.agent_code ?? '—'],
                    ['Matricule', selected.matricule ?? '—'],
                    ['Email', selected.email || '—'],
                    ['Téléphone', selected.telephone || '—'],
                    ['N° CNSS', selected.cnss || '—'],
                    ['Date d\'embauche', selected.date_embauche ? new Date(selected.date_embauche).toLocaleDateString('fr-FR') : '—'],
                    ['Date naissance', selected.date_naissance ? `${new Date(selected.date_naissance).toLocaleDateString('fr-FR')} (${ageYears(selected.date_naissance)} ans)` : '—'],
                    ['Fin de contrat', selected.date_fin_contrat ? new Date(selected.date_fin_contrat).toLocaleDateString('fr-FR') : '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between items-start bg-[var(--surface)] rounded-lg px-3 py-2">
                      <span className="text-xs text-[var(--text-secondary)]">{k}</span>
                      <span className="text-xs text-[var(--text)] text-right max-w-[55%]">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Payroll preview */}
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-[var(--text-secondary)] mb-3">Calcul de paie</p>
                  {(() => {
                    const { cnss, irpp, net, patro } = calcNet(selected.salaire_base)
                    return (
                      <>
                        <div className="flex justify-between text-xs"><span className="text-[var(--text-secondary)]">Salaire brut</span><span className="font-semibold text-[var(--text)]">{fmt(selected.salaire_base)} FCFA</span></div>
                        <div className="flex justify-between text-xs"><span className="text-[var(--text-secondary)]">CNSS salarié (5,04%)</span><span className="text-red-400">−{fmt(cnss)} FCFA</span></div>
                        <div className="flex justify-between text-xs"><span className="text-[var(--text-secondary)]">IRPP progressif</span><span className="text-red-400">−{fmt(irpp)} FCFA</span></div>
                        <div className="flex justify-between font-bold text-sm pt-2 border-t border-[var(--border)]">
                          <span className="text-[var(--text)]">Net à payer</span>
                          <span className="text-[var(--success)]">{fmt(net)} FCFA</span>
                        </div>
                        <div className="flex justify-between text-xs pt-1">
                          <span className="text-[var(--text-secondary)]">Charge patronale CNSS (14,16%)</span>
                          <span className="text-[var(--text-secondary)]">{fmt(patro)} FCFA</span>
                        </div>
                      </>
                    )
                  })()}
                </div>

                {selected.notes && (
                  <div className="bg-[var(--surface)] rounded-lg p-3">
                    <p className="text-[10px] text-[var(--text-secondary)] mb-1">Notes</p>
                    <p className="text-xs text-[var(--text-secondary)]">{selected.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Link
                    href="/dashboard/rh/paie"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[var(--primary)]/10 border border-[#DC2626]/20 text-[var(--primary)] rounded-lg text-xs font-semibold hover:bg-[var(--primary)]/20 transition-colors"
                  >
                    <FileText size={12} /> Générer bulletin
                  </Link>
                  <button
                    onClick={() => { handleDelete(selected.id) }}
                    className="py-2 px-3 bg-red-500/8 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/15 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Employee Modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowForm(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-[var(--text)]">Nouvel employé</h2>
                  <button onClick={() => setShowForm(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-secondary)]"><X size={18} /></button>
                </div>

                {[
                  { label: 'Nom complet *', key: 'nom', placeholder: 'Jean-Pierre Moussounga' },
                  { label: 'Email', key: 'email', placeholder: 'email@entreprise.cg' },
                  { label: 'Téléphone', key: 'telephone', placeholder: '+242 06 xxx xxx' },
                  { label: 'N° CNSS', key: 'cnss', placeholder: '1234567' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">{f.label}</label>
                    <input
                      value={(form as Record<string, string>)[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--primary)] transition-colors"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">Poste / Fonction</label>
                  <select value={form.poste} onChange={e => setForm(p => ({ ...p, poste: e.target.value }))}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)] transition-colors">
                    <option value="">— Sélectionner —</option>
                    <optgroup label="Restaurant">
                      <option>Gérant / Directeur</option>
                      <option>Chef cuisinier</option>
                      <option>Cuisinier / Aide-cuisinier</option>
                      <option>Serveur / Serveuse</option>
                      <option>Caissier / Caissière</option>
                      <option>Agent de sécurité</option>
                      <option>Agent d&apos;entretien</option>
                      <option>Livreur</option>
                    </optgroup>
                    <optgroup label="Administration">
                      <option>Directeur Général</option>
                      <option>Comptable</option>
                      <option>Assistant administratif</option>
                      <option>Responsable RH</option>
                      <option>Commercial / Vendeur</option>
                    </optgroup>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">Type contrat</label>
                    <select value={form.contrat} onChange={e => setForm(p => ({ ...p, contrat: e.target.value as Contrat }))}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none">
                      {Object.entries(CONTRAT_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">Salaire brut (FCFA)</label>
                    <input type="number" value={form.salaire_base}
                      onChange={e => setForm(p => ({ ...p, salaire_base: e.target.value }))}
                      placeholder="150000"
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--primary)] transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">Date d'embauche</label>
                    <input type="date" value={form.date_embauche}
                      onChange={e => setForm(p => ({ ...p, date_embauche: e.target.value }))}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">Date naissance</label>
                    <input type="date" value={form.date_naissance}
                      onChange={e => setForm(p => ({ ...p, date_naissance: e.target.value }))}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]" />
                  </div>
                </div>

                {form.contrat === 'cdd' || form.contrat === 'stage' ? (
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">Fin de contrat</label>
                    <input type="date" value={form.date_fin_contrat}
                      onChange={e => setForm(p => ({ ...p, date_fin_contrat: e.target.value }))}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]" />
                  </div>
                ) : null}

                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">Ville de travail</label>
                  <select value={form.ville} onChange={e => setForm(p => ({ ...p, ville: e.target.value }))}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]">
                    <option value="PNR">Pointe-Noire</option>
                    <option value="BZV">Brazzaville</option>
                  </select>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">Le code agent sera généré automatiquement (ex : ORA-{new Date().getFullYear()}-{form.ville}-0001)</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">Notes internes</label>
                  <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    rows={2} placeholder="Observations..."
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] outline-none resize-none focus:border-[var(--primary)] transition-colors" />
                </div>

                {form.salaire_base && Number(form.salaire_base) > 0 && (() => {
                  const { cnss, irpp, net } = calcNet(Number(form.salaire_base))
                  return (
                    <div className="bg-[var(--surface)] rounded-lg p-3 text-xs space-y-1">
                      <p className="text-[var(--text-secondary)] font-semibold mb-2">Aperçu calcul paie</p>
                      <div className="flex justify-between"><span className="text-[var(--text-secondary)]">CNSS salarié</span><span className="text-red-400">−{fmt(cnss)} F</span></div>
                      <div className="flex justify-between"><span className="text-[var(--text-secondary)]">IRPP</span><span className="text-red-400">−{fmt(irpp)} F</span></div>
                      <div className="flex justify-between font-bold border-t border-[var(--border)] pt-1"><span className="text-[var(--text)]">Net</span><span className="text-[var(--success)]">{fmt(net)} F</span></div>
                    </div>
                  )
                })()}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-[var(--border)] text-[var(--text-secondary)] rounded-lg text-sm hover:border-[var(--border-strong)] transition-colors">
                    Annuler
                  </button>
                  <motion.button whileTap={{ scale: 0.96 }} onClick={handleSave} disabled={saving || !form.nom.trim()}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[var(--primary)] text-white rounded-lg text-sm font-bold disabled:opacity-50">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {saving ? 'Enregistrement...' : 'Ajouter'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Onglet : Congés ────────────────────────────────────────────────────────────

function TabConges({ tenantId, employes, conges, onRefresh }: {
  tenantId: string; employes: Employe[]; conges: Conge[]; onRefresh: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    employe_id: '', type_conge: 'annuel' as TypeConge,
    date_debut: '', date_fin: '', motif: '',
  })

  function nbJours(d1: string, d2: string) {
    if (!d1 || !d2) return 0
    return Math.max(0, Math.ceil((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000) + 1)
  }

  async function handleSave() {
    const jours = nbJours(form.date_debut, form.date_fin)
    if (!form.employe_id || !form.date_debut || !form.date_fin || jours < 1) return
    setSaving(true)
    await supabase.from('conges').insert({
      tenant_id: tenantId,
      employe_id: form.employe_id,
      type_conge: form.type_conge,
      date_debut: form.date_debut,
      date_fin: form.date_fin,
      nb_jours: jours,
      motif: form.motif,
      statut: 'en_attente',
    })
    setSaving(false)
    setShowForm(false)
    setForm({ employe_id:'',type_conge:'annuel',date_debut:'',date_fin:'',motif:'' })
    onRefresh()
  }

  async function approuver(id: string, statut: 'approuve' | 'refuse') {
    await supabase.from('conges').update({ statut }).eq('id', id)
    onRefresh()
  }

  const STATUT_CONGE: Record<string, { label: string; color: string }> = {
    en_attente: { label: 'En attente', color: '#F59E0B' },
    approuve:   { label: 'Approuvé',  color: '#10B981' },
    refuse:     { label: 'Refusé',   color: '#EF4444' },
  }

  const TYPE_LABELS: Record<string, string> = {
    annuel: 'Congé annuel', maladie: 'Congé maladie',
    maternite: 'Maternité', exceptionnel: 'Exceptionnel',
  }

  const joursForm = nbJours(form.date_debut, form.date_fin)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">{conges.length} demande{conges.length !== 1 ? 's' : ''} de congé</p>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-2 bg-[var(--primary)] text-white rounded-lg text-xs font-bold">
          <Plus size={13} /> Nouvelle demande
        </motion.button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 space-y-4 overflow-hidden"
          >
            <h3 className="text-sm font-bold text-[var(--text)]">Demande de congé</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">Employé *</label>
                <select value={form.employe_id} onChange={e => setForm(p => ({ ...p, employe_id: e.target.value }))}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none">
                  <option value="">Sélectionner...</option>
                  {employes.filter(e => e.statut === 'actif').map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">Type de congé</label>
                <select value={form.type_conge} onChange={e => setForm(p => ({ ...p, type_conge: e.target.value as TypeConge }))}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none">
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">Date début</label>
                <input type="date" value={form.date_debut} onChange={e => setForm(p => ({ ...p, date_debut: e.target.value }))}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">
                  Date fin {joursForm > 0 && <span className="text-[var(--primary)]">({joursForm} jours)</span>}
                </label>
                <input type="date" value={form.date_fin} onChange={e => setForm(p => ({ ...p, date_fin: e.target.value }))}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">Motif (optionnel)</label>
              <input value={form.motif} onChange={e => setForm(p => ({ ...p, motif: e.target.value }))}
                placeholder="Motif de la demande..."
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--primary)]" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">Annuler</button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={handleSave} disabled={saving || !form.employe_id || joursForm < 1}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-xs font-bold disabled:opacity-50">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Soumettre
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {conges.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-secondary)]">
          <Calendar size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucune demande de congé enregistrée.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {conges.map((c, i) => {
            const emp = employes.find(e => e.id === c.employe_id)
            const st = STATUT_CONGE[c.statut] ?? STATUT_CONGE.en_attente
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-[#7C3AED]/15 flex items-center justify-center text-xs font-bold text-[#7C3AED] shrink-0">
                  {emp?.nom?.charAt(0) ?? 'E'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)]">{emp?.nom ?? 'Employé inconnu'}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {TYPE_LABELS[c.type_conge]} · {new Date(c.date_debut).toLocaleDateString('fr-FR')} → {new Date(c.date_fin).toLocaleDateString('fr-FR')} · <span className="font-semibold">{c.nb_jours} j</span>
                  </p>
                  {c.motif && <p className="text-xs text-[var(--text-secondary)] mt-0.5">"{c.motif}"</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: st.color, backgroundColor: `${st.color}18` }}>{st.label}</span>
                  {c.statut === 'en_attente' && (
                    <>
                      <button onClick={() => approuver(c.id, 'approuve')} className="p-1 rounded text-[var(--success)] hover:bg-[var(--success-light)] transition-colors"><Check size={14} /></button>
                      <button onClick={() => approuver(c.id, 'refuse')} className="p-1 rounded text-red-400 hover:bg-red-400/10 transition-colors"><X size={14} /></button>
                    </>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Onglet : Alertes ───────────────────────────────────────────────────────────

function TabAlertes({ employes }: { employes: Employe[] }) {
  const today = new Date()

  const alerts: { type: 'danger' | 'warning' | 'info'; emp: Employe; msg: string; sub: string }[] = []

  employes.forEach(e => {
    // Retraite dans < 90 jours (âge > 59 ans)
    if (e.date_naissance) {
      const age = ageYears(e.date_naissance)
      if (age >= 59 && e.statut === 'actif') {
        const jRestants = 365 - (daysBetween(e.date_naissance) % 365)
        alerts.push({ type: 'warning', emp: e, msg: `Retraite imminente — ${age} ans`, sub: `Prévoir le dossier de retraite sous ${jRestants} jours` })
      }
    }
    // Fin de contrat dans < 30 jours
    if (e.date_fin_contrat) {
      const remaining = Math.ceil((new Date(e.date_fin_contrat).getTime() - today.getTime()) / 86400000)
      if (remaining >= 0 && remaining <= 30) {
        alerts.push({ type: remaining <= 7 ? 'danger' : 'warning', emp: e, msg: `Contrat expire dans ${remaining} jour${remaining !== 1 ? 's' : ''}`, sub: `${CONTRAT_STYLES[e.contrat]?.label ?? e.contrat} — Décider du renouvellement` })
      } else if (remaining < 0) {
        alerts.push({ type: 'danger', emp: e, msg: 'Contrat expiré', sub: `Depuis ${Math.abs(remaining)} jours — Régulariser immédiatement` })
      }
    }
    // Congé faible (< 5 jours)
    if ((e.solde_conges ?? 26) < 5 && e.statut === 'actif') {
      alerts.push({ type: 'info', emp: e, msg: `Solde congés critique — ${e.solde_conges ?? 0} jours`, sub: 'Vérifier les droits annuels' })
    }
  })

  const COLORS = {
    danger:  { text: '#EF4444', bg: '#FEE2E2', border: '#FECACA' },
    warning: { text: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
    info:    { text: '#2563EB', bg: '#DBEAFE', border: '#BFDBFE' },
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-secondary)]">{alerts.length} alerte{alerts.length !== 1 ? 's' : ''} active{alerts.length !== 1 ? 's' : ''}</p>
      {alerts.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 rounded-full bg-[var(--success-light)] flex items-center justify-center mx-auto mb-3">
            <Check size={22} className="text-[var(--success)]" />
          </div>
          <p className="text-sm text-[var(--text-secondary)]">Aucune alerte RH active. Tout est en ordre.</p>
        </div>
      ) : (
        alerts.map((a, i) => {
          const c = COLORS[a.type]
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className="flex items-start gap-3 p-4 rounded-xl border"
              style={{ backgroundColor: c.bg, borderColor: c.border }}
            >
              <AlertTriangle size={14} style={{ color: c.text }} className="shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold" style={{ color: c.text }}>{a.emp.nom} — {a.msg}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{a.sub}</p>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ color: c.text, backgroundColor: `${c.text}20` }}>
                {a.type === 'danger' ? 'URGENT' : a.type === 'warning' ? 'ATTENTION' : 'INFO'}
              </span>
            </motion.div>
          )
        })
      )}
    </div>
  )
}

// ── Onglet : Rapports ──────────────────────────────────────────────────────────

function TabRapports({ employes, conges }: { employes: Employe[]; conges: Conge[] }) {
  const actifs = employes.filter(e => e.statut === 'actif')
  const masseBrute = actifs.reduce((s, e) => s + e.salaire_base, 0)
  const massePatro = actifs.reduce((s, e) => s + Math.min(e.salaire_base, PLAFOND_CNSS) * TAUX_CNSS_PATRONAL, 0)
  const masseNette = actifs.reduce((s, e) => s + calcNet(e.salaire_base).net, 0)

  const parContrat = Object.entries(CONTRAT_STYLES).map(([k, v]) => ({
    label: v.label, count: employes.filter(e => e.contrat === k).length, color: v.color
  }))

  const congesApprouves = conges.filter(c => c.statut === 'approuve')
  const totalJoursConges = congesApprouves.reduce((s, c) => s + c.nb_jours, 0)

  return (
    <div className="space-y-4">
      {/* Global stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: 'Masse salariale brute',    val: `${fmt(masseBrute)} FCFA`,  color: 'var(--text)', sub: 'employés actifs' },
          { label: 'Masse salariale nette',     val: `${fmt(masseNette)} FCFA`,  color: 'var(--success)', sub: 'après CNSS + IRPP' },
          { label: 'Charges patronales CNSS',   val: `${fmt(massePatro)} FCFA`,  color: 'var(--danger)', sub: '14,16% plafonné' },
          { label: 'Coût total employeur',      val: `${fmt(masseBrute + massePatro)} FCFA`, color: 'var(--text)', sub: 'brut + charges' },
          { label: 'Congés pris (période)',     val: `${totalJoursConges} jours`,color: 'var(--primary)', sub: `${congesApprouves.length} demande(s)` },
          { label: 'Effectif total',            val: employes.length,            color: 'var(--text)', sub: `${actifs.length} actifs` },
        ].map(k => (
          <div key={k.label} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4">
            <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-2">{k.label}</p>
            <p className="text-base font-bold" style={{ color: k.color }}>{k.val}</p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Breakdown by contract */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="text-sm font-bold text-[var(--text)] mb-4">Répartition par type de contrat</h3>
        <div className="space-y-3">
          {parContrat.map(({ label, count, color }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-secondary)] w-20 shrink-0">{label}</span>
              <div className="flex-1 h-2 bg-[var(--surface-alt)] rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${employes.length ? (count / employes.length) * 100 : 0}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
              <span className="text-xs font-bold text-[var(--text)] w-6 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/dashboard/rh/paie" className="flex items-center gap-3 p-4 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl hover:border-[var(--primary)] transition-colors">
          <div className="w-9 h-9 rounded-lg bg-[var(--primary-light)] flex items-center justify-center"><FileText size={16} className="text-[var(--primary)]" /></div>
          <div><p className="text-sm font-semibold text-[var(--text)]">Traitement de la paie</p><p className="text-xs text-[var(--text-secondary)]">Générer les bulletins</p></div>
        </Link>
        <Link href="/dashboard/rh/recrutement" className="flex items-center gap-3 p-4 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl hover:border-[var(--primary)] transition-colors">
          <div className="w-9 h-9 rounded-lg bg-[var(--primary-light)] flex items-center justify-center"><Briefcase size={16} className="text-[var(--primary)]" /></div>
          <div><p className="text-sm font-semibold text-[var(--text)]">Recrutement IA</p><p className="text-xs text-[var(--text-secondary)]">Analyser les CVs</p></div>
        </Link>
      </div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────

const TABS = [
  { id: 'equipe',    label: 'Équipe',   icon: Users },
  { id: 'conges',   label: 'Congés',   icon: Calendar },
  { id: 'alertes',  label: 'Alertes',  icon: Bell },
  { id: 'rapports', label: 'Rapports', icon: TrendingUp },
]

export default function RHPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const [activeTab, setActiveTab] = useState('equipe')
  const [employes, setEmployes]   = useState<Employe[]>([])
  const [conges, setConges]       = useState<Conge[]>([])
  const [loading, setLoading]     = useState(true)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [empRes, congesRes] = await Promise.all([
      supabase.from('employes').select('*').eq('tenant_id', tenantId).order('nom'),
      supabase.from('conges').select('*, employes(nom)').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    ])
    setEmployes((empRes.data ?? []) as Employe[])
    setConges((congesRes.data ?? []) as Conge[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const nbAlertes = (() => {
    let n = 0
    employes.forEach(e => {
      if (e.date_naissance && ageYears(e.date_naissance) >= 59 && e.statut === 'actif') n++
      if (e.date_fin_contrat) {
        const rem = Math.ceil((new Date(e.date_fin_contrat).getTime() - Date.now()) / 86400000)
        if (rem <= 30) n++
      }
      if ((e.solde_conges ?? 26) < 5 && e.statut === 'actif') n++
    })
    return n
  })()

  if (tenantLoading || loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={28} className="text-[var(--primary)] animate-spin" /></div>
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--text)]">Ressources Humaines</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {employes.length} employé{employes.length !== 1 ? 's' : ''} · {conges.filter(c=>c.statut==='en_attente').length} demande{conges.filter(c=>c.statut==='en_attente').length !== 1 ? 's' : ''} en attente
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/rh/paie" className="flex items-center gap-1.5 px-3 py-2 border border-[var(--border)] text-[var(--text-secondary)] rounded-lg text-xs font-semibold hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors">
            <FileText size={13} /> Paie
          </Link>
          <Link href="/dashboard/rh/recrutement" className="flex items-center gap-1.5 px-3 py-2 border border-[var(--border)] text-[var(--text-secondary)] rounded-lg text-xs font-semibold hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors">
            <Briefcase size={13} /> Recrutement
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-1">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all flex-1 justify-center ${
                activeTab === tab.id ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-white/5'
              }`}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.id === 'alertes' && nbAlertes > 0 && (
                <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${activeTab === 'alertes' ? 'bg-[var(--surface)] text-[var(--primary)]' : 'bg-[var(--primary)] text-white'}`}>
                  {nbAlertes}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
          {activeTab === 'equipe'    && <TabEquipe    tenantId={tenantId!} employes={employes} onRefresh={load} />}
          {activeTab === 'conges'   && <TabConges   tenantId={tenantId!} employes={employes} conges={conges} onRefresh={load} />}
          {activeTab === 'alertes'  && <TabAlertes  employes={employes} />}
          {activeTab === 'rapports' && <TabRapports employes={employes} conges={conges} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
