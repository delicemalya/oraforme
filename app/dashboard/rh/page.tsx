'use client'

/**
 * Dashboard RH Enterprise — Vue d'ensemble du module RH
 * KPIs temps réel, alertes, activités récentes, accès rapide
 */

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserCheck, Plus, Trash2, ChevronRight, X, Check,
  AlertTriangle, Calendar, Clock, TrendingUp,
  Users, Bell, FileText, Loader2, Briefcase,
  DollarSign, Star, Shield, ArrowRight, Activity,
  CheckCircle, XCircle, Building2, Phone, Mail, Edit3,
  GitBranch, BarChart2, Gift, FolderOpen, User, LayoutDashboard,
} from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { calculerPaie } from '@/lib/paie/calcul-paie'

// ── Types ─────────────────────────────────────────────────────────────────────

type Contrat = 'cdi' | 'cdd' | 'stage' | 'freelance' | 'vacation' | 'prestataire'
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
  departement?: string | null
  manager?: string | null
  photo_url?: string | null
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

interface BulletinPaie {
  id: string
  employe_id: string
  mois: number
  annee: number
  net: number
  statut: string
  created_at: string
  employes?: { nom: string }
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const CONTRAT_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  cdi:         { label: 'CDI',         color: '#10B981', bg: '#D1FAE5' },
  cdd:         { label: 'CDD',         color: '#F59E0B', bg: '#FEF3C7' },
  stage:       { label: 'Stage',       color: '#3B82F6', bg: '#DBEAFE' },
  freelance:   { label: 'Freelance',   color: '#8B5CF6', bg: '#EDE9FE' },
  vacation:    { label: 'Vacation',    color: '#EC4899', bg: '#FCE7F3' },
  prestataire: { label: 'Prestataire', color: '#64748B', bg: '#F1F5F9' },
}

const STATUT_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  actif:    { label: 'Actif',     color: '#10B981', bg: '#D1FAE5' },
  conge:    { label: 'En congé',  color: '#F59E0B', bg: '#FEF3C7' },
  malade:   { label: 'Malade',    color: '#EF4444', bg: '#FEE2E2' },
  licencie: { label: 'Licencié',  color: '#6B7280', bg: '#F3F4F6' },
  retraite: { label: 'Retraité',  color: '#9CA3AF', bg: '#F9FAFB' },
}

const TAUX_CNSS_PATRONAL = 0.1436

const MOIS_LABELS = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

// Wrapper autour du moteur officiel lib/paie/calcul-paie.ts (barème CGI Congo révisé)
function calcNet(brut: number) {
  const r = calculerPaie({ salaire_base: brut })
  return { cnss: r.cnss_employe, irpp: r.irpp, net: r.salaire_net, patro: r.cnss_patronal }
}

function fmt(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)) }
function fmtFCFA(n: number) { return fmt(n) + ' FCFA' }

function daysBetween(d1: string, d2: Date = new Date()) {
  return Math.floor((d2.getTime() - new Date(d1).getTime()) / 86400000)
}
function ageYears(dob: string) { return Math.floor(daysBetween(dob) / 365.25) }

function StatutBadge({ statut }: { statut: string }) {
  const s = STATUT_STYLES[statut] ?? STATUT_STYLES.actif
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: s.color, backgroundColor: s.bg }}>
      {s.label}
    </span>
  )
}

function ContratBadge({ contrat }: { contrat: string }) {
  const s = CONTRAT_STYLES[contrat] ?? CONTRAT_STYLES.cdi
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: s.color, backgroundColor: s.bg }}>
      {s.label}
    </span>
  )
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

function EmployeeAvatar({ emp, size = 'sm' }: { emp: Employe; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'w-14 h-14 text-lg' : size === 'md' ? 'w-10 h-10 text-sm' : 'w-7 h-7 text-[10px]'
  if (emp.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={emp.photo_url} alt={emp.nom} className={`${sz} rounded-full object-cover border-2 border-white shadow-sm`} />
    )
  }
  const colors = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2']
  const color  = colors[emp.nom.charCodeAt(0) % colors.length]
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold shrink-0`} style={{ background: color + '20', color }}>
      {emp.nom.charAt(0).toUpperCase()}
    </div>
  )
}

// ── Module cards ───────────────────────────────────────────────────────────────

const QUICK_MODULES = [
  { label: 'Paie',          href: '/dashboard/rh/paie',         icon: DollarSign, color: '#F59E0B', desc: 'Bulletins & virements'    },
  { label: 'Recrutement',   href: '/dashboard/rh/recrutement',  icon: Briefcase,  color: '#2563EB', desc: 'Offres & candidats'        },
  { label: 'Présences',     href: '/dashboard/rh/presences',    icon: Clock,      color: '#10B981', desc: 'Pointages & absences'      },
  { label: 'Contrats',      href: '/dashboard/rh/contrats',     icon: FileText,   color: '#8B5CF6', desc: 'Gestion des contrats'      },
  { label: 'Évaluations',   href: '/dashboard/rh/evaluations',  icon: Star,       color: '#F59E0B', desc: 'Performances & notes'      },
  { label: 'Organigramme',  href: '/dashboard/rh/organigramme', icon: GitBranch,  color: '#64748B', desc: 'Structure entreprise'      },
  { label: 'Portail Emp.', href: '/dashboard/rh/portail',      icon: User,       color: '#0891B2', desc: 'Espace employé'            },
  { label: 'Analytics',     href: '/dashboard/rh/analytics',    icon: BarChart2,  color: '#DC2626', desc: 'Statistiques RH'           },
]

// ── Onglet Équipe (Tab content) ────────────────────────────────────────────────

function TabEquipe({ tenantId, employes, onRefresh }: {
  tenantId: string; employes: Employe[]; onRefresh: () => void
}) {
  const { t } = useLocale()
  const [showForm,      setShowForm]      = useState(false)
  const [showEdit,      setShowEdit]      = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [selected,      setSelected]      = useState<Employe | null>(null)
  const [filterStatut,  setFilterStatut]  = useState<string>('tous')
  const [search,        setSearch]        = useState('')
  const [editForm, setEditForm] = useState<Partial<Employe>>({})
  const [form, setForm] = useState({
    nom: '', poste: '', email: '', telephone: '',
    salaire_base: '', contrat: 'cdi' as Contrat,
    statut: 'actif' as Statut, cnss: '',
    date_embauche: '', date_naissance: '',
    date_fin_contrat: '', notes: '',
    ville: 'PNR', departement: '', manager: '',
    photo_url: '',
  })

  const displayed = employes
    .filter(e => filterStatut === 'tous' || e.statut === filterStatut)
    .filter(e => {
      const q = search.toLowerCase()
      return !q || e.nom.toLowerCase().includes(q) || e.poste.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) || e.agent_code?.toLowerCase().includes(q)
    })

  async function handleSave() {
    if (!form.nom.trim()) return
    setSaving(true)
    const resp = await fetch('/api/hr/employees', {
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
        departement: form.departement || null,
        manager: form.manager || null,
        photo_url: form.photo_url || null,
      }),
    })
    setSaving(false)
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      alert('Erreur création employé : ' + (err?.error ?? err?.message ?? resp.statusText))
      return
    }
    setShowForm(false)
    resetForm()
    onRefresh()
  }

  function resetForm() {
    setForm({ nom:'',poste:'',email:'',telephone:'',salaire_base:'',contrat:'cdi',statut:'actif',cnss:'',date_embauche:'',date_naissance:'',date_fin_contrat:'',notes:'',ville:'PNR',departement:'',manager:'',photo_url:'' })
  }

  async function updateStatut(id: string, statut: string) {
    const { error } = await supabase.from('employes').update({ statut }).eq('id', id)
    if (error) { alert('Erreur mise à jour statut : ' + error.message); return }
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, statut: statut as Statut } : null)
    onRefresh()
  }

  async function handleDelete(id: string) {
    if (!confirm(t('rh.deletePermanent'))) return
    const { error } = await supabase.from('employes').delete().eq('id', id)
    if (error) { alert('Erreur suppression employé : ' + error.message); return }
    setSelected(null)
    onRefresh()
  }

  function openEdit(emp: Employe) {
    setEditForm({
      nom: emp.nom, poste: emp.poste, email: emp.email,
      telephone: emp.telephone, salaire_base: emp.salaire_base,
      contrat: emp.contrat, cnss: emp.cnss, departement: emp.departement ?? '',
      manager: emp.manager ?? '', notes: emp.notes,
      date_fin_contrat: emp.date_fin_contrat ?? '',
    })
    setShowEdit(true)
  }

  async function handleEditSave() {
    if (!selected) return
    setSaving(true)
    const { error } = await supabase.from('employes').update({
      nom:             editForm.nom,
      poste:           editForm.poste,
      email:           editForm.email,
      telephone:       editForm.telephone,
      salaire_base:    Number(editForm.salaire_base) || selected.salaire_base,
      contrat:         editForm.contrat,
      cnss:            editForm.cnss,
      departement:     editForm.departement || null,
      manager:         editForm.manager    || null,
      notes:           editForm.notes,
      date_fin_contrat: editForm.date_fin_contrat || null,
    }).eq('id', selected.id)
    setSaving(false)
    if (error) { alert('Erreur mise à jour : ' + error.message); return }
    setShowEdit(false)
    setSelected(null)
    onRefresh()
  }

  const masseBrute = employes.filter(e => e.statut === 'actif').reduce((s, e) => s + e.salaire_base, 0)

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('rh.activeSalary'),    val: employes.filter(e=>e.statut==='actif').length,                   color: '#10B981', icon: Users },
          { label: t('rh.onLeaveOrSick'),   val: employes.filter(e=>['conge','malade'].includes(e.statut)).length, color: '#F59E0B', icon: Calendar },
          { label: t('rh.payrollMass'),     val: fmtFCFA(masseBrute),                                             color: '#3B82F6', icon: TrendingUp },
          { label: t('rh.employerCharge'),  val: fmtFCFA(employes.filter(e=>e.statut==='actif').reduce((s,e)=>s+calculerPaie({salaire_base:e.salaire_base}).cnss_patronal, 0)), color: '#8B5CF6', icon: AlertTriangle },
        ].map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: k.color + '18' }}>
                  <Icon size={14} style={{ color: k.color }} />
                </div>
              </div>
              <p className="text-[18px] font-bold text-[#0F172A] tabular-nums leading-tight">{k.val}</p>
              <p className="text-[11px] text-[#64748B] mt-0.5">{k.label}</p>
            </div>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <input
              type="text"
              placeholder={t('rh.searchEmployee')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 w-48"
            />
            <Users size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          </div>
          <div className="flex gap-1 flex-wrap">
            {['tous','actif','conge','malade','licencie'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatut(s)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  filterStatut === s
                    ? 'bg-[#F59E0B] text-white'
                    : 'border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
                }`}
              >
                {s === 'tous' ? t('common.all') : STATUT_STYLES[s]?.label ?? s}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-2 bg-[#F59E0B] text-white rounded-xl text-[12px] font-bold hover:bg-amber-600 transition-colors shadow-sm"
        >
          <Plus size={13} /> {t('rh.addEmployee')}
        </button>
      </div>

      {/* Employee table */}
      {displayed.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] py-14 text-center">
          <Users size={36} className="mx-auto mb-3 text-[#CBD5E1]" />
          <p className="text-sm text-[#64748B]">{t('rh.noEmployee')}</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-[12px] text-[#F59E0B] font-semibold hover:underline">
            + {t('rh.addFirstEmployee')}
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  {[t('rh.employee'),t('rh.matricule'),'Poste / Dép.',t('rh.contract'),t('common.status'),t('rh.gross'),t('rh.net'),t('common.actions')].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {displayed.map((e, i) => {
                  const calc = calcNet(e.salaire_base)
                  return (
                    <motion.tr
                      key={e.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                      onClick={() => setSelected(e)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <EmployeeAvatar emp={e} />
                          <div>
                            <p className="font-semibold text-[#0F172A] text-[13px]">{e.nom}</p>
                            {e.email && <p className="text-[10px] text-[#94A3B8]">{e.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[10px] text-[#F59E0B] bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                          {e.matricule ?? e.agent_code ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[12px] text-[#0F172A]">{e.poste || '—'}</p>
                        {e.departement && <p className="text-[10px] text-[#94A3B8]">{e.departement}</p>}
                      </td>
                      <td className="px-4 py-3"><ContratBadge contrat={e.contrat} /></td>
                      <td className="px-4 py-3"><StatutBadge statut={e.statut} /></td>
                      <td className="px-4 py-3 text-[12px] font-semibold text-[#0F172A]">{fmt(e.salaire_base)} F</td>
                      <td className="px-4 py-3 text-[12px] font-bold text-[#10B981]">{fmt(calc.net)} F</td>
                      <td className="px-4 py-3 text-right" onClick={ev => ev.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Link href="/dashboard/rh/paie" className="p-1.5 rounded-lg hover:bg-amber-50 text-[#94A3B8] hover:text-[#F59E0B] transition-colors" title="Paie">
                            <FileText size={13} />
                          </Link>
                          <button onClick={() => { setSelected(e); openEdit(e) }} className="p-1.5 rounded-lg hover:bg-blue-50 text-[#94A3B8] hover:text-blue-500 transition-colors" title="Modifier">
                            <Edit3 size={13} />
                          </button>
                          <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-[#94A3B8] hover:text-red-500 transition-colors" title="Supprimer">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Employee detail drawer */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40" onClick={() => setSelected(null)} />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white border-l border-[#E2E8F0] z-50 overflow-y-auto shadow-2xl"
            >
              <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar emp={selected} size="lg" />
                    <div>
                      <h2 className="text-base font-bold text-[#0F172A]">{selected.nom}</h2>
                      <p className="text-xs text-[#64748B]">{selected.poste || t('rh.position')}</p>
                      {selected.departement && (
                        <p className="text-[10px] text-[#94A3B8]">{selected.departement}</p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-[#64748B] hover:text-[#0F172A] p-1">
                    <X size={18} />
                  </button>
                </div>

                {/* Badges */}
                <div className="flex gap-2 flex-wrap">
                  <StatutBadge statut={selected.statut} />
                  <ContratBadge contrat={selected.contrat} />
                  <span className="text-[10px] border border-[#E2E8F0] rounded-full px-2 py-0.5 text-[#64748B]">
                    {selected.solde_conges ?? 26} j congés
                  </span>
                  {selected.matricule && (
                    <span className="font-mono text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                      {selected.matricule}
                    </span>
                  )}
                </div>

                {/* Change status */}
                <div>
                  <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-2">{t('rh.changeStatus')}</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(Object.keys(STATUT_STYLES) as Statut[]).map(s => (
                      <button key={s} onClick={() => updateStatut(selected.id, s)}
                        className={`py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                          selected.statut === s
                            ? 'bg-amber-500 text-white'
                            : 'border border-[#E2E8F0] text-[#64748B] hover:border-amber-200 hover:bg-amber-50'
                        }`}>
                        {STATUT_STYLES[s].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info grid */}
                <div className="space-y-1.5">
                  {[
                    [t('rh.matricule'),   selected.matricule ?? selected.agent_code ?? '—'],
                    [t('common.email'),   selected.email || '—'],
                    [t('common.phone'),   selected.telephone || '—'],
                    [t('rh.cnss'),        selected.cnss || '—'],
                    [t('rh.department'),  selected.departement || '—'],
                    [t('rh.manager'),     selected.manager || '—'],
                    [t('rh.startDate'),   selected.date_embauche ? new Date(selected.date_embauche).toLocaleDateString('fr-FR') : '—'],
                    [t('rh.birthDate'),   selected.date_naissance ? `${new Date(selected.date_naissance).toLocaleDateString('fr-FR')} (${ageYears(selected.date_naissance)} ans)` : '—'],
                    [t('rh.endDate'),     selected.date_fin_contrat ? new Date(selected.date_fin_contrat).toLocaleDateString('fr-FR') : '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center bg-[#F8FAFC] rounded-lg px-3 py-2">
                      <span className="text-[11px] text-[#64748B]">{k}</span>
                      <span className="text-[11px] text-[#0F172A] font-medium text-right max-w-[55%] truncate">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Payroll preview */}
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2">
                  <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-3">{t('rh.paySimulation')}</p>
                  {(() => {
                    const { cnss, irpp, net, patro } = calcNet(selected.salaire_base)
                    return (
                      <>
                        <div className="flex justify-between text-[12px]"><span className="text-[#64748B]">{t('rh.gross')}</span><span className="font-semibold text-[#0F172A]">{fmt(selected.salaire_base)} FCFA</span></div>
                        <div className="flex justify-between text-[12px]"><span className="text-[#64748B]">{t('rh.cnss')} (5,04%)</span><span className="text-red-500">−{fmt(cnss)} FCFA</span></div>
                        <div className="flex justify-between text-[12px]"><span className="text-[#64748B]">{t('rh.irpp')}</span><span className="text-red-500">−{fmt(irpp)} FCFA</span></div>
                        <div className="flex justify-between font-bold text-[13px] pt-2 border-t border-[#E2E8F0]">
                          <span className="text-[#0F172A]">{t('rh.netToPay')}</span>
                          <span className="text-[#10B981]">{fmt(net)} FCFA</span>
                        </div>
                        <div className="flex justify-between text-[11px] pt-1">
                          <span className="text-[#94A3B8]">{t('rh.employerCnss')}</span>
                          <span className="text-[#94A3B8]">{fmt(patro)} FCFA</span>
                        </div>
                      </>
                    )
                  })()}
                </div>

                {selected.notes && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-blue-600 mb-1">{t('rh.internalNotes')}</p>
                    <p className="text-[12px] text-[#64748B]">{selected.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/dashboard/rh/paie"
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-[12px] font-semibold hover:bg-amber-100 transition-colors">
                    <FileText size={13} /> {t('rh.generateSlip')}
                  </Link>
                  <button onClick={() => openEdit(selected)}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-[12px] font-semibold hover:bg-blue-100 transition-colors">
                    <Edit3 size={13} /> Modifier
                  </button>
                  <Link href="/dashboard/rh/evaluations"
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] rounded-xl text-[12px] font-semibold hover:bg-[#F1F5F9] transition-colors">
                    <Star size={13} /> {t('rh.evaluation')}
                  </Link>
                  <button onClick={() => handleDelete(selected.id)}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-[12px] font-semibold hover:bg-red-100 transition-colors">
                    <Trash2 size={13} /> {t('common.delete')}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit Employee Modal */}
      <AnimatePresence>
        {showEdit && selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowEdit(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-xl">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-[16px] font-bold text-[#0F172A]">Modifier — {selected.nom}</h2>
                    <p className="text-[11px] text-[#64748B] mt-0.5">{selected.matricule ?? selected.agent_code}</p>
                  </div>
                  <button onClick={() => setShowEdit(false)}><X size={18} className="text-[#64748B]" /></button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Nom complet',    key: 'nom',       placeholder: 'Jean-Pierre Moussounga' },
                    { label: 'Email',           key: 'email',     placeholder: 'email@entreprise.com' },
                    { label: 'Téléphone',       key: 'telephone', placeholder: '+242 06 xxx xxx' },
                    { label: 'N° CNSS',         key: 'cnss',      placeholder: '1234567' },
                    { label: 'Département',     key: 'departement',placeholder: 'Finance, RH, IT…' },
                    { label: 'Manager direct',  key: 'manager',   placeholder: 'Nom du manager' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className={lCls}>{f.label}</label>
                      <input
                        value={String((editForm as Record<string, unknown>)[f.key] ?? '')}
                        onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className={iCls}
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className={lCls}>Poste / Fonction</label>
                    <input value={editForm.poste ?? ''} onChange={e => setEditForm(p => ({...p, poste: e.target.value}))}
                      placeholder="Directeur Général, Comptable…" className={iCls} />
                  </div>
                  <div>
                    <label className={lCls}>Type de contrat</label>
                    <select value={editForm.contrat ?? 'cdi'} onChange={e => setEditForm(p => ({...p, contrat: e.target.value as Contrat}))} className={iCls}>
                      {Object.entries(CONTRAT_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lCls}>Salaire de base (FCFA)</label>
                    <input type="number" value={editForm.salaire_base ?? ''}
                      onChange={e => setEditForm(p => ({...p, salaire_base: Number(e.target.value)}))}
                      className={iCls} />
                  </div>
                  <div>
                    <label className={lCls}>Date fin contrat</label>
                    <input type="date" value={editForm.date_fin_contrat ?? ''}
                      onChange={e => setEditForm(p => ({...p, date_fin_contrat: e.target.value}))} className={iCls} />
                  </div>
                </div>

                <div className="mt-3">
                  <label className={lCls}>Notes internes</label>
                  <textarea value={editForm.notes ?? ''} onChange={e => setEditForm(p => ({...p, notes: e.target.value}))}
                    rows={2} className={`${iCls} resize-none`} />
                </div>

                {/* Preview nouveau net */}
                {Number(editForm.salaire_base) > 0 && (() => {
                  const { cnss, irpp, net } = calcNet(Number(editForm.salaire_base))
                  return (
                    <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3 text-[12px] space-y-1">
                      <p className="font-bold text-amber-800 mb-1">Simulation nouveau salaire</p>
                      <div className="flex justify-between"><span className="text-[#64748B]">CNSS (5,04%)</span><span className="text-red-500">−{fmt(cnss)} F</span></div>
                      <div className="flex justify-between"><span className="text-[#64748B]">IRPP</span><span className="text-red-500">−{fmt(irpp)} F</span></div>
                      <div className="flex justify-between font-bold border-t border-amber-200 pt-1"><span>Net à payer</span><span className="text-[#10B981]">{fmt(net)} F</span></div>
                    </div>
                  )
                })()}

                <div className="flex gap-3 mt-5">
                  <button onClick={() => setShowEdit(false)}
                    className="flex-1 py-2.5 border border-[#E2E8F0] text-[#64748B] rounded-xl text-[13px] font-semibold hover:bg-[#F8FAFC]">
                    Annuler
                  </button>
                  <button onClick={handleEditSave} disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#2563EB] text-white rounded-xl text-[13px] font-bold disabled:opacity-50 hover:bg-blue-700 transition-colors">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowForm(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-xl">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-[16px] font-bold text-[#0F172A]">{t('rh.newEmployee')}</h2>
                  <button onClick={() => setShowForm(false)}><X size={18} className="text-[#64748B]" /></button>
                </div>

                {/* Photo URL */}
                <div className="mb-4">
                  <label className={lCls}>{t('rh.photoUrl')}</label>
                  <input value={form.photo_url} onChange={e => setForm(p => ({...p, photo_url: e.target.value}))}
                    placeholder="https://..." className={iCls} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Nom complet *', key: 'nom',       placeholder: 'Jean-Pierre Moussounga' },
                    { label: 'Email',          key: 'email',     placeholder: 'email@entreprise.com' },
                    { label: 'Téléphone',      key: 'telephone', placeholder: '+242 06 xxx xxx' },
                    { label: 'N° CNSS',        key: 'cnss',      placeholder: '1234567' },
                    { label: 'Département',    key: 'departement',placeholder: 'Finance, RH, IT…' },
                    { label: 'Manager direct', key: 'manager',   placeholder: 'Nom du manager' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className={lCls}>{f.label}</label>
                      <input
                        value={(form as Record<string, string>)[f.key]}
                        onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className={iCls}
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className={lCls}>{t('rh.positionFunc')}</label>
                    <input value={form.poste} onChange={e => setForm(p => ({...p, poste: e.target.value}))}
                      placeholder="Directeur Général, Comptable…" className={iCls} />
                  </div>
                  <div>
                    <label className={lCls}>{t('rh.contractType')}</label>
                    <select value={form.contrat} onChange={e => setForm(p => ({...p, contrat: e.target.value as Contrat}))} className={iCls}>
                      {Object.entries(CONTRAT_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lCls}>{t('rh.grossSalary')}</label>
                    <input type="number" value={form.salaire_base}
                      onChange={e => setForm(p => ({...p, salaire_base: e.target.value}))}
                      placeholder="150000" className={iCls} />
                  </div>
                  <div>
                    <label className={lCls}>{t('rh.workCity')}</label>
                    <select value={form.ville} onChange={e => setForm(p => ({...p, ville: e.target.value}))} className={iCls}>
                      <option value="PNR">Pointe-Noire</option>
                      <option value="BZV">Brazzaville</option>
                      <option value="KIN">Kinshasa</option>
                      <option value="LBV">Libreville</option>
                      <option value="DLA">Douala</option>
                      <option value="ABJ">Abidjan</option>
                      <option value="DKR">Dakar</option>
                      <option value="LOS">Lagos</option>
                    </select>
                  </div>
                  <div>
                    <label className={lCls}>{t('rh.startDate')}</label>
                    <input type="date" value={form.date_embauche} onChange={e => setForm(p => ({...p, date_embauche: e.target.value}))} className={iCls} />
                  </div>
                  <div>
                    <label className={lCls}>{t('rh.birthDate')}</label>
                    <input type="date" value={form.date_naissance} onChange={e => setForm(p => ({...p, date_naissance: e.target.value}))} className={iCls} />
                  </div>
                  {(form.contrat === 'cdd' || form.contrat === 'stage' || form.contrat === 'vacation') && (
                    <div className="col-span-2">
                      <label className={lCls}>{t('rh.endDate')}</label>
                      <input type="date" value={form.date_fin_contrat} onChange={e => setForm(p => ({...p, date_fin_contrat: e.target.value}))} className={iCls} />
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <label className={lCls}>{t('rh.internalNotes')}</label>
                  <textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))}
                    rows={2} placeholder="Observations, informations complémentaires…"
                    className={`${iCls} resize-none`} />
                </div>

                {/* Matricule preview */}
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-[10px] font-bold text-amber-700 mb-1">{t('rh.autoMatricule')}</p>
                  <p className="font-mono text-[13px] font-bold text-amber-900">
                    {form.nom ? form.nom.substring(0, 3).toUpperCase() : 'XXX'}-{new Date().getFullYear()}-{form.ville || 'PNR'}-####
                  </p>
                </div>

                {/* Payroll preview */}
                {Number(form.salaire_base) > 0 && (() => {
                  const { cnss, irpp, net } = calcNet(Number(form.salaire_base))
                  return (
                    <div className="mt-3 bg-[#F8FAFC] rounded-xl p-3 text-[12px] space-y-1">
                      <p className="font-bold text-[#64748B] mb-2">{t('rh.payPreview')}</p>
                      <div className="flex justify-between"><span className="text-[#64748B]">{t('rh.cnss')}</span><span className="text-red-500">−{fmt(cnss)} F</span></div>
                      <div className="flex justify-between"><span className="text-[#64748B]">{t('rh.irpp')}</span><span className="text-red-500">−{fmt(irpp)} F</span></div>
                      <div className="flex justify-between font-bold border-t border-[#E2E8F0] pt-1"><span>{t('rh.netToPay')}</span><span className="text-[#10B981]">{fmt(net)} F</span></div>
                    </div>
                  )
                })()}

                <div className="flex gap-3 mt-5">
                  <button onClick={() => setShowForm(false)}
                    className="flex-1 py-2.5 border border-[#E2E8F0] text-[#64748B] rounded-xl text-[13px] font-semibold hover:bg-[#F8FAFC]">
                    {t('common.cancel')}
                  </button>
                  <button onClick={handleSave} disabled={saving || !form.nom.trim()}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#F59E0B] text-white rounded-xl text-[13px] font-bold disabled:opacity-50 hover:bg-amber-600 transition-colors">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {saving ? t('rh.saving') : t('rh.createEmployee')}
                  </button>
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
  const { t } = useLocale()
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
    const { error } = await supabase.from('conges').insert({
      tenant_id: tenantId, employe_id: form.employe_id,
      type_conge: form.type_conge, date_debut: form.date_debut,
      date_fin: form.date_fin, nb_jours: jours, motif: form.motif, statut: 'en_attente',
    })
    setSaving(false)
    if (error) { alert('Erreur création congé : ' + error.message); return }
    setShowForm(false)
    setForm({ employe_id:'',type_conge:'annuel',date_debut:'',date_fin:'',motif:'' })
    onRefresh()
  }

  async function approuver(id: string, statut: 'approuve' | 'refuse') {
    const { error } = await supabase.from('conges').update({ statut }).eq('id', id)
    if (error) { alert('Erreur mise à jour congé : ' + error.message); return }
    onRefresh()
  }

  const STATUT_CONGE: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    en_attente: { label: 'En attente', color: '#F59E0B', icon: <Clock size={11} /> },
    approuve:   { label: 'Approuvé',   color: '#10B981', icon: <CheckCircle size={11} /> },
    refuse:     { label: 'Refusé',     color: '#EF4444', icon: <XCircle size={11} /> },
  }

  const TYPE_LABELS: Record<string, string> = {
    annuel: 'Congé annuel', maladie: 'Congé maladie',
    maternite: 'Maternité', exceptionnel: 'Exceptionnel',
  }

  const joursForm = nbJours(form.date_debut, form.date_fin)
  const pending   = conges.filter(c => c.statut === 'en_attente')
  const approved  = conges.filter(c => c.statut === 'approuve')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('common.pending'),  val: pending.length,  color: '#F59E0B' },
          { label: t('common.approved'), val: approved.length, color: '#10B981' },
          { label: t('common.total'),    val: approved.reduce((s, c) => s + c.nb_jours, 0), color: '#2563EB' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-[#E2E8F0] p-4">
            <p className="text-[20px] font-bold tabular-nums" style={{ color: k.color }}>{k.val}</p>
            <p className="text-[11px] text-[#64748B]">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[#64748B]">{conges.length} demande{conges.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-2 bg-[#F59E0B] text-white rounded-xl text-[12px] font-bold hover:bg-amber-600 transition-colors">
          <Plus size={13} /> {t('rh.newLeaveRequest')}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-white border border-[#E2E8F0] rounded-2xl p-5 space-y-4 overflow-hidden shadow-sm">
            <h3 className="text-[14px] font-bold text-[#0F172A]">{t('rh.leaveRequest')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lCls}>{t('rh.employee')} *</label>
                <select value={form.employe_id} onChange={e => setForm(p => ({...p, employe_id: e.target.value}))} className={iCls}>
                  <option value="">Sélectionner...</option>
                  {employes.filter(e => e.statut === 'actif').map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </select>
              </div>
              <div>
                <label className={lCls}>{t('rh.leaveType')}</label>
                <select value={form.type_conge} onChange={e => setForm(p => ({...p, type_conge: e.target.value as TypeConge}))} className={iCls}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={lCls}>{t('rh.leaveStart')}</label>
                <input type="date" value={form.date_debut} onChange={e => setForm(p => ({...p, date_debut: e.target.value}))} className={iCls} />
              </div>
              <div>
                <label className={lCls}>{t('rh.leaveEnd')} {joursForm > 0 && <span className="text-amber-600">({joursForm} j)</span>}</label>
                <input type="date" value={form.date_fin} onChange={e => setForm(p => ({...p, date_fin: e.target.value}))} className={iCls} />
              </div>
            </div>
            <div>
              <label className={lCls}>{t('rh.leaveReason')}</label>
              <input value={form.motif} onChange={e => setForm(p => ({...p, motif: e.target.value}))}
                placeholder={t('rh.leaveReason') + '…'} className={iCls} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-[12px] text-[#64748B] hover:text-[#0F172A]">{t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving || !form.employe_id || joursForm < 1}
                className="flex items-center gap-2 px-4 py-2 bg-[#F59E0B] text-white rounded-xl text-[12px] font-bold disabled:opacity-50">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                {t('common.submit')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {conges.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] py-12 text-center">
          <Calendar size={32} className="mx-auto mb-3 text-[#CBD5E1]" />
          <p className="text-[13px] text-[#64748B]">{t('rh.noLeave')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conges.map((c, i) => {
            const emp = employes.find(e => e.id === c.employe_id)
            const st  = STATUT_CONGE[c.statut] ?? STATUT_CONGE.en_attente
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="bg-white border border-[#E2E8F0] rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-bold shrink-0"
                  style={{ background: '#7C3AED20', color: '#7C3AED' }}>
                  {emp?.nom?.charAt(0) ?? 'E'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#0F172A]">{emp?.nom ?? 'Employé inconnu'}</p>
                  <p className="text-[11px] text-[#64748B]">
                    {TYPE_LABELS[c.type_conge]} · {new Date(c.date_debut).toLocaleDateString('fr-FR')} → {new Date(c.date_fin).toLocaleDateString('fr-FR')} · <span className="font-semibold">{c.nb_jours} j</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ color: st.color, backgroundColor: st.color + '15' }}>
                    {st.icon}{st.label}
                  </span>
                  {c.statut === 'en_attente' && (
                    <>
                      <button onClick={() => approuver(c.id, 'approuve')} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100"><Check size={13} /></button>
                      <button onClick={() => approuver(c.id, 'refuse')} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><X size={13} /></button>
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
  const { t } = useLocale()
  const today = new Date()
  const alerts: { type: 'error' | 'warning' | 'info'; emp: Employe; msg: string; sub: string; href: string }[] = []

  employes.forEach(e => {
    if (e.date_naissance) {
      const age = ageYears(e.date_naissance)
      if (age >= 59 && e.statut === 'actif') {
        alerts.push({ type: 'warning', emp: e, msg: `Retraite imminente — ${age} ans`, sub: 'Préparer le dossier de retraite', href: '/dashboard/rh#equipe' })
      }
    }
    if (e.date_fin_contrat) {
      const remaining = Math.ceil((new Date(e.date_fin_contrat).getTime() - today.getTime()) / 86400000)
      if (remaining < 0) {
        alerts.push({ type: 'error', emp: e, msg: 'Contrat expiré', sub: `Depuis ${Math.abs(remaining)} jours — Régulariser immédiatement`, href: '/dashboard/rh/contrats' })
      } else if (remaining <= 30) {
        alerts.push({ type: 'warning', emp: e, msg: `Contrat expire dans ${remaining} jour${remaining !== 1 ? 's' : ''}`, sub: 'Décider du renouvellement', href: '/dashboard/rh/contrats' })
      }
    }
    if ((e.solde_conges ?? 26) < 5 && e.statut === 'actif') {
      alerts.push({ type: 'info', emp: e, msg: `Solde congés critique — ${e.solde_conges ?? 0} jours`, sub: 'Vérifier les droits annuels', href: '/dashboard/rh#conges' })
    }
  })

  const COLORS = {
    error:   { text: '#EF4444', bg: '#FEE2E2', border: '#FECACA' },
    warning: { text: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
    info:    { text: '#2563EB', bg: '#DBEAFE', border: '#BFDBFE' },
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-[#64748B]">{alerts.length} alerte{alerts.length !== 1 ? 's' : ''} active{alerts.length !== 1 ? 's' : ''}</p>
      {alerts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] py-14 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <Check size={22} className="text-green-600" />
          </div>
          <p className="text-[13px] text-[#64748B]">{t('rh.noAlert')}</p>
        </div>
      ) : (
        alerts.map((a, i) => {
          const c = COLORS[a.type]
          return (
            <Link key={i} href={a.href}>
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                className="flex items-start gap-3 p-4 rounded-2xl border cursor-pointer hover:shadow-md transition-shadow"
                style={{ backgroundColor: c.bg, borderColor: c.border }}>
                <AlertTriangle size={14} style={{ color: c.text }} className="shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold" style={{ color: c.text }}>{a.emp.nom} — {a.msg}</p>
                  <p className="text-[11px] text-[#64748B] mt-0.5">{a.sub}</p>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ color: c.text, backgroundColor: `${c.text}20` }}>
                  {a.type === 'error' ? 'URGENT' : a.type === 'warning' ? 'ATTENTION' : 'INFO'}
                </span>
              </motion.div>
            </Link>
          )
        })
      )}
    </div>
  )
}

// ── Onglet : Rapports ──────────────────────────────────────────────────────────

function TabRapports({ employes, conges }: { employes: Employe[]; conges: Conge[] }) {
  const { t } = useLocale()
  const actifs      = employes.filter(e => e.statut === 'actif')
  const masseBrute  = actifs.reduce((s, e) => s + e.salaire_base, 0)
  const massePatro  = actifs.reduce((s, e) => s + calculerPaie({ salaire_base: e.salaire_base }).cnss_patronal, 0)
  const masseNette  = actifs.reduce((s, e) => s + calculerPaie({ salaire_base: e.salaire_base }).salaire_net, 0)
  const congesApp   = conges.filter(c => c.statut === 'approuve')
  const totalJours  = congesApp.reduce((s, c) => s + c.nb_jours, 0)

  const parContrat = Object.entries(CONTRAT_STYLES).map(([k, v]) => ({
    label: v.label, count: employes.filter(e => e.contrat === k).length, color: v.color,
  }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: t('rh.grossMass'),        val: fmtFCFA(masseBrute),              color: '#0F172A', sub: t('rh.employees') },
          { label: t('rh.netMass'),          val: fmtFCFA(masseNette),              color: '#10B981', sub: `après ${t('rh.cnss')} + ${t('rh.irpp')}` },
          { label: t('rh.employerCharges'),  val: fmtFCFA(massePatro),              color: '#EF4444', sub: '14,16% plafonné' },
          { label: t('rh.totalCost'),        val: fmtFCFA(masseBrute + massePatro), color: '#0F172A', sub: 'brut + charges' },
          { label: t('rh.grantedLeave'),     val: `${totalJours} jours`,             color: '#2563EB', sub: `${congesApp.length} demande(s)` },
          { label: t('rh.totalHeadcount'),   val: employes.length,                  color: '#0F172A', sub: `${actifs.length} ${t('common.active')}` },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-2">{k.label}</p>
            <p className="text-[16px] font-bold tabular-nums" style={{ color: k.color }}>{k.val}</p>
            <p className="text-[10px] text-[#64748B] mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm">
        <h3 className="text-[13px] font-bold text-[#0F172A] mb-4">{t('rh.contractBreakdown')}</h3>
        <div className="space-y-3">
          {parContrat.map(({ label, count, color }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-[11px] text-[#64748B] w-20 shrink-0">{label}</span>
              <div className="flex-1 h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${employes.length ? (count / employes.length) * 100 : 0}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }} />
              </div>
              <span className="text-[11px] font-bold text-[#0F172A] w-5 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/dashboard/rh/paie"
          className="flex items-center gap-3 p-4 bg-white border border-[#E2E8F0] rounded-2xl hover:border-amber-200 hover:shadow-md transition-all">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center"><FileText size={16} className="text-amber-600" /></div>
          <div><p className="text-[13px] font-semibold text-[#0F172A]">{t('rh.payProcessing')}</p><p className="text-[11px] text-[#64748B]">{t('rh.generateSlips')}</p></div>
        </Link>
        <Link href="/dashboard/rh/analytics"
          className="flex items-center gap-3 p-4 bg-white border border-[#E2E8F0] rounded-2xl hover:border-amber-200 hover:shadow-md transition-all">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center"><BarChart2 size={16} className="text-blue-600" /></div>
          <div><p className="text-[13px] font-semibold text-[#0F172A]">{t('rh.rhAnalytics')}</p><p className="text-[11px] text-[#64748B]">{t('rh.advancedStats')}</p></div>
        </Link>
      </div>
    </div>
  )
}

// ── Shared input styles ───────────────────────────────────────────────────────

const lCls = 'text-[10px] font-bold text-[#64748B] uppercase tracking-wide block mb-1'
const iCls = 'w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-[12px] text-[#0F172A] placeholder-[#94A3B8] outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 transition-all'

// ── Page principale ────────────────────────────────────────────────────────────

const MAIN_TABS_DEF = [
  { id: 'dashboard', labelKey: 'rh.dashboard', icon: LayoutDashboard },
  { id: 'equipe',    labelKey: 'rh.team',       icon: Users },
  { id: 'conges',    labelKey: 'rh.leave',      icon: Calendar },
  { id: 'alertes',   labelKey: 'rh.alerts',     icon: Bell },
  { id: 'rapports',  labelKey: 'rh.reports',    icon: TrendingUp },
]

export default function RHPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const { t } = useLocale()
  const [activeTab,  setActiveTab]  = useState('dashboard')
  const [employes,   setEmployes]   = useState<Employe[]>([])
  const [conges,     setConges]     = useState<Conge[]>([])
  const [bulletins,  setBulletins]  = useState<BulletinPaie[]>([])
  const [loading,    setLoading]    = useState(true)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [empRes, congesRes, bulRes] = await Promise.all([
      supabase.from('employes').select('*').eq('tenant_id', tenantId).order('nom').limit(200),
      supabase.from('conges').select('*, employes(nom)').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200),
      supabase.from('bulletins_paie').select('id, employe_id, mois, annee, net, statut, created_at, employes(nom)')
        .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(10),
    ])
    setEmployes((empRes.data   ?? []) as Employe[])
    setConges((congesRes.data  ?? []) as Conge[])
    setBulletins((bulRes.data  ?? []) as unknown as BulletinPaie[])
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

  const masseSalariale = employes.filter(e => e.statut === 'actif').reduce((s, e) => s + e.salaire_base, 0)
  const pendingConges  = conges.filter(c => c.statut === 'en_attente').length
  const expiring       = employes.filter(e => {
    if (!e.date_fin_contrat) return false
    const r = Math.ceil((new Date(e.date_fin_contrat).getTime() - Date.now()) / 86400000)
    return r >= 0 && r <= 30
  }).length

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="text-[#F59E0B] animate-spin" />
      </div>
    )
  }

  // ── Dashboard tab ─────────────────────────────────────────────────────────

  const DashboardTab = () => (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('rh.employees'),           val: employes.filter(e=>e.statut==='actif').length,    color: '#10B981', icon: Users,         sub: `${employes.length} total` },
          { label: t('rh.payrollMass'),         val: fmtFCFA(masseSalariale),                          color: '#F59E0B', icon: DollarSign,    sub: 'mensuelle brute' },
          { label: t('rh.leave'),               val: pendingConges,                                    color: '#2563EB', icon: Calendar,      sub: t('rh.toValidate') },
          { label: t('rh.expiringContracts'),   val: expiring,                                         color: expiring > 0 ? '#EF4444' : '#64748B', icon: AlertTriangle, sub: t('rh.in30days') },
        ].map(k => {
          const Icon = k.icon
          return (
            <motion.div key={k.label} whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 400 }}
              className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: k.color + '18' }}>
                  <Icon size={18} style={{ color: k.color }} />
                </div>
              </div>
              <p className="text-[22px] font-bold text-[#0F172A] tabular-nums leading-none">{k.val}</p>
              <p className="text-[12px] font-semibold text-[#0F172A] mt-1">{k.label}</p>
              <p className="text-[11px] text-[#64748B] mt-0.5">{k.sub}</p>
            </motion.div>
          )
        })}
      </div>

      {/* Quick module access */}
      <div>
        <h3 className="text-[13px] font-bold text-[#0F172A] mb-3">{t('rh.modules')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {QUICK_MODULES.map(mod => {
            const Icon = mod.icon
            return (
              <Link key={mod.href} href={mod.href}>
                <motion.div whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 400 }}
                  className="bg-white rounded-2xl border border-[#E2E8F0] p-4 hover:border-amber-200 hover:shadow-md transition-all cursor-pointer">
                  <div className="w-9 h-9 rounded-xl mb-3 flex items-center justify-center" style={{ background: mod.color + '18' }}>
                    <Icon size={16} style={{ color: mod.color }} />
                  </div>
                  <p className="text-[12px] font-bold text-[#0F172A]">{mod.label}</p>
                  <p className="text-[10px] text-[#94A3B8] mt-0.5">{mod.desc}</p>
                </motion.div>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent employees */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm">
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-[#0F172A]">{t('rh.lastEmployees')}</h3>
            <button onClick={() => setActiveTab('equipe')} className="text-[11px] text-[#F59E0B] font-semibold hover:underline flex items-center gap-0.5">
              {t('common.seeAll')} <ArrowRight size={11} />
            </button>
          </div>
          <div className="divide-y divide-[#E2E8F0]">
            {employes.slice(0, 5).map(e => (
              <div key={e.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#F8FAFC] transition-colors">
                <EmployeeAvatar emp={e} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[#0F172A] truncate">{e.nom}</p>
                  <p className="text-[10px] text-[#94A3B8]">{e.poste || '—'}</p>
                </div>
                <StatutBadge statut={e.statut} />
              </div>
            ))}
            {employes.length === 0 && (
              <div className="px-5 py-8 text-center text-[12px] text-[#94A3B8]">{t('rh.noEmployeeFull')}</div>
            )}
          </div>
        </div>

        {/* Recent bulletins */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm">
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-[#0F172A]">{t('rh.lastPayslips')}</h3>
            <Link href="/dashboard/rh/paie" className="text-[11px] text-[#F59E0B] font-semibold hover:underline flex items-center gap-0.5">
              {t('rh.payManage')} <ArrowRight size={11} />
            </Link>
          </div>
          <div className="divide-y divide-[#E2E8F0]">
            {bulletins.slice(0, 5).map(b => (
              <div key={b.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#F8FAFC] transition-colors">
                <div className="w-7 h-7 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                  <FileText size={13} className="text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[#0F172A] truncate">
                    {(b.employes as unknown as { nom: string })?.nom ?? 'Employé'}
                  </p>
                  <p className="text-[10px] text-[#94A3B8]">{MOIS_LABELS[b.mois]} {b.annee}</p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] font-bold text-[#10B981]">{fmt(b.net)} F</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    b.statut === 'payee' ? 'bg-green-100 text-green-700' :
                    b.statut === 'validee' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>{b.statut}</span>
                </div>
              </div>
            ))}
            {bulletins.length === 0 && (
              <div className="px-5 py-8 text-center text-[12px] text-[#94A3B8]">{t('rh.noPayslip')}</div>
            )}
          </div>
        </div>
      </div>

      {/* Alerts preview */}
      {nbAlertes > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600" />
              <p className="text-[13px] font-bold text-amber-800">{nbAlertes} alerte{nbAlertes > 1 ? 's' : ''} RH nécessite{nbAlertes > 1 ? 'nt' : ''} votre attention</p>
            </div>
            <button onClick={() => setActiveTab('alertes')} className="text-[11px] font-semibold text-amber-700 hover:underline flex items-center gap-0.5">
              Voir alertes <ArrowRight size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
            <Users size={18} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A]">{t('nav.rh')}</h1>
            <p className="text-[11px] text-[#64748B]">
              {employes.length} {t('rh.employee')}{employes.length !== 1 ? 's' : ''} · {pendingConges} {t('rh.leave')} {t('rh.pendingLeave')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/rh/paie" className="flex items-center gap-1.5 px-3 py-2 border border-[#E2E8F0] text-[#64748B] rounded-xl text-[12px] font-semibold hover:border-amber-200 hover:text-amber-600 transition-colors">
            <DollarSign size={13} /> {t('rh.payroll')}
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-1">
        {MAIN_TABS_DEF.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all flex-1 justify-center ${
                activeTab === tab.id
                  ? 'bg-white text-[#F59E0B] shadow-sm'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{t(tab.labelKey)}</span>
              {tab.id === 'alertes' && nbAlertes > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center bg-[#EF4444] text-white">
                  {nbAlertes}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'equipe'    && <TabEquipe    tenantId={tenantId!} employes={employes} onRefresh={load} />}
          {activeTab === 'conges'    && <TabConges   tenantId={tenantId!} employes={employes} conges={conges} onRefresh={load} />}
          {activeTab === 'alertes'   && <TabAlertes  employes={employes} />}
          {activeTab === 'rapports'  && <TabRapports employes={employes} conges={conges} />}
        </motion.div>
      </AnimatePresence>

      {/* Modules liés */}
      <div className="pt-4 border-t border-[#E2E8F0]">
        <p className="text-[11px] text-[#94A3B8] uppercase tracking-wide mb-3">Modules liés</p>
        <div className="flex gap-3 flex-wrap">
          <Link
            href="/dashboard/rh/recrutement"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E2E8F0] hover:border-blue-200 hover:text-blue-600 text-[12px] text-[#64748B] font-semibold transition-all"
          >
            <Briefcase size={13} /> Recrutement IA
          </Link>
          <Link
            href="/dashboard/rh#conges"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E2E8F0] hover:border-amber-200 hover:text-amber-600 text-[12px] text-[#64748B] font-semibold transition-all"
          >
            <Calendar size={13} /> Congés &amp; Absences
          </Link>
        </div>
      </div>
    </div>
  )
}
