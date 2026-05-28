'use client'

/**
 * Portail Employé — Self-service portal for employees
 * View own payslips, request leave, update personal info, see announcements
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import {
  User, FileText, Calendar, Clock, DollarSign,
  Download, Bell, ChevronRight, Star, Shield,
  CheckCircle2, XCircle, AlertCircle, Inbox,
} from 'lucide-react'

/* ─── Types ─────────────────────────────────────────────── */
interface Employe {
  id: string
  nom: string
  poste: string
  departement: string | null
  matricule: string | null
  photo_url: string | null
  statut: string
  date_debut_contrat: string | null
  type_contrat: string | null
  email_pro: string | null
  telephone: string | null
  salaire_brut: number | null
}

interface BulletinPaie {
  id: string
  mois: number
  annee: number
  brut: number
  net: number
  cnss_salarie: number
  irpp: number
  primes: number
  statut: string
  created_at: string
}

interface Conge {
  id: string
  type: string
  date_debut: string
  date_fin: string
  statut: string
  motif: string | null
  nb_jours: number | null
  created_at: string
}

interface Presence {
  id: string
  date: string
  type: string
  heure_arrivee: string | null
  heure_depart: string | null
}

/* ─── Helpers ────────────────────────────────────────────── */
const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

function fmtFCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

function fmtDate(d: string, intlLocale: string) {
  return new Date(d).toLocaleDateString(intlLocale, { day: '2-digit', month: 'short', year: 'numeric' })
}

function anciennete(dateStr: string | null) {
  if (!dateStr) return '—'
  const start = new Date(dateStr)
  const now = new Date()
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (months < 12) return `${months} mois`
  const y = Math.floor(months / 12)
  const m = months % 12
  return m > 0 ? `${y} an${y > 1 ? 's' : ''} ${m} mois` : `${y} an${y > 1 ? 's' : ''}`
}

const CONGE_STATUS: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  approuve: { label: 'Approuvé',  color: '#16A34A', bg: '#DCFCE7', icon: CheckCircle2 },
  refuse:   { label: 'Refusé',    color: '#DC2626', bg: '#FEE2E2', icon: XCircle      },
  en_attente: { label: 'En attente', color: '#D97706', bg: '#FEF3C7', icon: AlertCircle },
}

const PRESENCE_TYPES: Record<string, { label: string; color: string }> = {
  present:    { label: 'Présent',     color: '#16A34A' },
  absent:     { label: 'Absent',      color: '#DC2626' },
  retard:     { label: 'Retard',      color: '#D97706' },
  permission: { label: 'Permission',  color: '#2563EB' },
  teletravail:{ label: 'Télétravail', color: '#8B5CF6' },
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function PortailPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const { t, locale } = useLocale()
  const intlLocale = locale === 'fr' ? 'fr-FR' : locale
  const [tab, setTab] = useState<'accueil' | 'paie' | 'conges' | 'presences' | 'profil'>('accueil')

  /* Data */
  const [employes, setEmployes]   = useState<Employe[]>([])
  const [bulletins, setBulletins] = useState<BulletinPaie[]>([])
  const [conges, setConges]       = useState<Conge[]>([])
  const [presences, setPresences] = useState<Presence[]>([])
  const [loading, setLoading]     = useState(true)

  /* Congé request form */
  const [congeForm, setCongeForm] = useState({
    type: 'annuel', date_debut: '', date_fin: '', motif: ''
  })
  const [congeLoading, setCongeLoading] = useState(false)
  const [congeMsg, setCongeMsg]         = useState<string | null>(null)

  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      const [empR, bulR, conR, preR] = await Promise.all([
        supabase.from('employes').select('*').eq('tenant_id', tenantId)
          .eq('statut', 'actif').order('created_at', { ascending: true }).limit(50),
        supabase.from('bulletins_paie').select('*').eq('tenant_id', tenantId)
          .order('annee', { ascending: false }).order('mois', { ascending: false }).limit(24),
        supabase.from('conges').select('*').eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }).limit(20),
        supabase.from('presences').select('*').eq('tenant_id', tenantId)
          .order('date', { ascending: false }).limit(30),
      ])
      setEmployes(empR.data || [])
      setBulletins(bulR.data || [])
      setConges(conR.data || [])
      setPresences(preR.data || [])
      setLoading(false)
    })()
  }, [tenantId])

  /* Derive stats from first employee (or aggregated) */
  const firstEmp = employes[0] ?? null
  const lastBulletin = bulletins[0] ?? null
  const congesApprouves = conges.filter(c => c.statut === 'approuve').length
  const congesEnAttente = conges.filter(c => c.statut === 'en_attente').length

  /* ─── Request congé ─────────────────────────────────────── */
  async function handleCongeRequest() {
    if (!firstEmp || !congeForm.date_debut || !congeForm.date_fin) return
    setCongeLoading(true)
    setCongeMsg(null)

    const d1 = new Date(congeForm.date_debut)
    const d2 = new Date(congeForm.date_fin)
    const nb = Math.max(1, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1)

    const { error } = await supabase.from('conges').insert({
      tenant_id:  tenantId,
      employe_id: firstEmp.id,
      type:       congeForm.type,
      date_debut: congeForm.date_debut,
      date_fin:   congeForm.date_fin,
      nb_jours:   nb,
      motif:      congeForm.motif || null,
      statut:     'en_attente',
    })

    if (error) {
      setCongeMsg('Erreur: ' + error.message)
    } else {
      setCongeMsg('Demande de congé soumise avec succès.')
      setCongeForm({ type: 'annuel', date_debut: '', date_fin: '', motif: '' })
      // Reload
      const { data } = await supabase.from('conges').select('*')
        .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(20)
      setConges(data || [])
    }
    setCongeLoading(false)
  }

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center py-24 text-[#94A3B8]">
        <div className="w-6 h-6 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin mr-2" />
        {t('common.loading')}
      </div>
    )
  }

  const TABS = [
    { id: 'accueil',   label: t('rh.portail.myInfo'),     icon: User        },
    { id: 'paie',      label: t('rh.portail.myPayslips'), icon: DollarSign  },
    { id: 'conges',    label: t('rh.portail.myLeaves'),   icon: Calendar    },
    { id: 'presences', label: 'Présences',                icon: Clock       },
    { id: 'profil',    label: 'Mon profil',               icon: Shield      },
  ] as const

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#0F172A] to-[#1E293B] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#F59E0B] flex items-center justify-center text-white font-black text-xl shadow-lg">
            {firstEmp ? firstEmp.nom.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() : 'EMP'}
          </div>
          <div>
            <div className="text-[20px] font-extrabold">{firstEmp?.nom ?? t('rh.portail.title')}</div>
            <div className="text-[13px] text-slate-300 mt-0.5">
              {firstEmp?.poste ?? '—'} · {firstEmp?.departement ?? '—'}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              {firstEmp?.matricule && (
                <span className="text-[11px] bg-white/10 px-2 py-0.5 rounded font-mono">
                  {firstEmp.matricule}
                </span>
              )}
              {firstEmp?.date_debut_contrat && (
                <span className="text-[11px] text-slate-400">
                  Ancienneté: {anciennete(firstEmp.date_debut_contrat)}
                </span>
              )}
            </div>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2">
            <Bell size={16} className="text-[#F59E0B]" />
            <span className="text-[12px]">{congesEnAttente} demande{congesEnAttente > 1 ? 's' : ''} en attente</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 overflow-x-auto bg-white rounded-xl border border-[#E2E8F0] p-1">
        {TABS.map(tab_ => (
          <button
            key={tab_.id}
            onClick={() => setTab(tab_.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-lg whitespace-nowrap transition-all ${
              tab === tab_.id
                ? 'bg-[#F59E0B] text-white shadow-sm'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
            }`}
          >
            <tab_.icon size={13} />
            {tab_.label}
          </button>
        ))}
      </div>

      {/* ─── ACCUEIL ─────────────────────────────────────────── */}
      {tab === 'accueil' && (
        <div className="space-y-4">
          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Dernier salaire net',
                value: lastBulletin ? fmtFCFA(lastBulletin.net) : '—',
                sub: lastBulletin ? `${MONTHS[lastBulletin.mois - 1]} ${lastBulletin.annee}` : 'Aucun bulletin',
                color: '#16A34A', icon: DollarSign,
              },
              {
                label: 'Congés approuvés',
                value: congesApprouves.toString(),
                sub: `${congesEnAttente} en attente`,
                color: '#2563EB', icon: Calendar,
              },
              {
                label: 'Présences ce mois',
                value: presences.filter(p => {
                  const d = new Date(p.date)
                  const n = new Date()
                  return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
                    && p.type === 'present'
                }).length.toString(),
                sub: 'jours présents',
                color: '#F59E0B', icon: Clock,
              },
              {
                label: 'Bulletins totaux',
                value: bulletins.length.toString(),
                sub: 'Historique disponible',
                color: '#8B5CF6', icon: FileText,
              },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: k.color + '18' }}>
                    <k.icon size={13} style={{ color: k.color }} />
                  </div>
                  <span className="text-[11px] text-[#64748B]">{k.label}</span>
                </div>
                <div className="text-[18px] font-extrabold text-[#0F172A]">{k.value}</div>
                <div className="text-[10px] text-[#94A3B8] mt-0.5">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-[12px] font-bold text-[#0F172A] mb-3">Actions rapides</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Demander congé',  icon: Calendar, action: () => setTab('conges'),    color: '#2563EB' },
                { label: 'Voir mes fiches', icon: FileText, action: () => setTab('paie'),       color: '#16A34A' },
                { label: 'Mes présences',   icon: Clock,    action: () => setTab('presences'),  color: '#F59E0B' },
                { label: 'Mon profil',      icon: User,     action: () => setTab('profil'),     color: '#8B5CF6' },
              ].map(a => (
                <button
                  key={a.label}
                  onClick={a.action}
                  className="flex items-center gap-2 p-3 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] text-left transition-all hover:shadow-sm"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: a.color + '18' }}>
                    <a.icon size={14} style={{ color: a.color }} />
                  </div>
                  <span className="text-[12px] font-semibold text-[#0F172A]">{a.label}</span>
                  <ChevronRight size={12} className="ml-auto text-[#94A3B8]" />
                </button>
              ))}
            </div>
          </div>

          {/* Recent activity */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-[12px] font-bold text-[#0F172A] mb-3">Activité récente</p>
            {conges.length === 0 && bulletins.length === 0 ? (
              <div className="text-center py-6 text-[#94A3B8]">
                <Inbox size={28} className="mx-auto mb-2 text-[#E2E8F0]" />
                <p className="text-[12px]">Aucune activité récente</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bulletins.slice(0, 3).map(b => (
                  <div key={b.id} className="flex items-center gap-3 py-2 border-b border-[#F1F5F9] last:border-0">
                    <div className="w-7 h-7 rounded-lg bg-[#16A34A]/10 flex items-center justify-center">
                      <DollarSign size={12} className="text-[#16A34A]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[12px] font-semibold text-[#0F172A]">
                        Bulletin de paie — {MONTHS[b.mois - 1]} {b.annee}
                      </p>
                      <p className="text-[11px] text-[#64748B]">Net: {fmtFCFA(b.net)}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#DCFCE7] text-[#16A34A] font-semibold">
                      {b.statut}
                    </span>
                  </div>
                ))}
                {conges.slice(0, 2).map(c => {
                  const st = CONGE_STATUS[c.statut] || CONGE_STATUS['en_attente']
                  const Icon = st.icon
                  return (
                    <div key={c.id} className="flex items-center gap-3 py-2 border-b border-[#F1F5F9] last:border-0">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: st.bg }}>
                        <Icon size={12} style={{ color: st.color }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold text-[#0F172A]">
                          Congé {c.type} — {c.nb_jours ?? '?'} jour{(c.nb_jours ?? 0) > 1 ? 's' : ''}
                        </p>
                        <p className="text-[11px] text-[#64748B]">{fmtDate(c.date_debut, intlLocale)} → {fmtDate(c.date_fin, intlLocale)}</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── FICHES DE PAIE ──────────────────────────────────── */}
      {tab === 'paie' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-bold text-[#0F172A]">{t('rh.portail.myPayslips')} ({bulletins.length})</p>
          </div>
          {bulletins.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] py-16 text-center">
              <FileText size={32} className="mx-auto mb-2 text-[#E2E8F0]" />
              <p className="text-[13px] text-[#94A3B8]">Aucune fiche de paie disponible</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {bulletins.map(b => (
                <div key={b.id} className="bg-white rounded-xl border border-[#E2E8F0] p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#16A34A]/10 flex items-center justify-center">
                        <FileText size={16} className="text-[#16A34A]" />
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-[#0F172A]">
                          {MONTHS[b.mois - 1]} {b.annee}
                        </p>
                        <p className="text-[11px] text-[#64748B]">
                          Brut: {fmtFCFA(b.brut)} · CNSS: {fmtFCFA(b.cnss_salarie)} · IRPP: {fmtFCFA(b.irpp)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[16px] font-extrabold text-[#16A34A]">{fmtFCFA(b.net)}</div>
                      <p className="text-[10px] text-[#94A3B8]">NET À PAYER</p>
                    </div>
                  </div>
                  {b.primes > 0 && (
                    <div className="mt-2 pt-2 border-t border-[#F1F5F9]">
                      <span className="text-[11px] px-2 py-0.5 rounded bg-[#FEF3C7] text-[#D97706] font-semibold">
                        + {fmtFCFA(b.primes)} de primes
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── CONGÉS ──────────────────────────────────────────── */}
      {tab === 'conges' && (
        <div className="space-y-4">

          {/* Request form */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
            <p className="text-[14px] font-bold text-[#0F172A] mb-4">Nouvelle demande de congé</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Type de congé</label>
                <select
                  value={congeForm.type}
                  onChange={e => setCongeForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                >
                  <option value="annuel">Congé annuel</option>
                  <option value="maladie">Congé maladie</option>
                  <option value="maternite">Congé maternité</option>
                  <option value="evenement">Événement familial</option>
                  <option value="sans_solde">Sans solde</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Motif (optionnel)</label>
                <input
                  value={congeForm.motif}
                  onChange={e => setCongeForm(f => ({ ...f, motif: e.target.value }))}
                  placeholder="Précisez si besoin…"
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Date de début</label>
                <input
                  type="date"
                  value={congeForm.date_debut}
                  onChange={e => setCongeForm(f => ({ ...f, date_debut: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Date de fin</label>
                <input
                  type="date"
                  value={congeForm.date_fin}
                  onChange={e => setCongeForm(f => ({ ...f, date_fin: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                />
              </div>
            </div>

            {congeMsg && (
              <p className={`mt-3 text-[12px] px-3 py-2 rounded-lg font-medium ${
                congeMsg.startsWith('Erreur')
                  ? 'bg-[#FEE2E2] text-[#DC2626]'
                  : 'bg-[#DCFCE7] text-[#16A34A]'
              }`}>
                {congeMsg}
              </p>
            )}

            <button
              onClick={handleCongeRequest}
              disabled={congeLoading || !congeForm.date_debut || !congeForm.date_fin}
              className="mt-3 px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-white text-[12px] font-bold rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              {congeLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Soumettre la demande
            </button>
          </div>

          {/* History */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-[13px] font-bold text-[#0F172A] mb-3">Historique des congés</p>
            {conges.length === 0 ? (
              <p className="text-center py-8 text-[#94A3B8] text-[12px]">Aucune demande de congé</p>
            ) : (
              <div className="space-y-2">
                {conges.map(c => {
                  const st = CONGE_STATUS[c.statut] || CONGE_STATUS['en_attente']
                  const Icon = st.icon
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-[#F1F5F9] hover:bg-[#F8FAFC]">
                      <Icon size={16} style={{ color: st.color }} />
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold text-[#0F172A]">
                          {c.type.charAt(0).toUpperCase() + c.type.slice(1)} — {c.nb_jours ?? '?'} jour{(c.nb_jours ?? 0) > 1 ? 's' : ''}
                        </p>
                        <p className="text-[11px] text-[#64748B]">{fmtDate(c.date_debut, intlLocale)} → {fmtDate(c.date_fin, intlLocale)}</p>
                        {c.motif && <p className="text-[10px] text-[#94A3B8] italic">{c.motif}</p>}
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── PRÉSENCES ───────────────────────────────────────── */}
      {tab === 'presences' && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <p className="text-[13px] font-bold text-[#0F172A] mb-3">Mes 30 dernières présences</p>
          {presences.length === 0 ? (
            <p className="text-center py-8 text-[#94A3B8] text-[12px]">Aucune présence enregistrée</p>
          ) : (
            <div className="space-y-1">
              {presences.map(p => {
                const ptype = PRESENCE_TYPES[p.type] || { label: p.type, color: '#94A3B8' }
                return (
                  <div key={p.id} className="flex items-center gap-3 py-2 border-b border-[#F1F5F9] last:border-0">
                    <span className="w-2 h-2 rounded-full" style={{ background: ptype.color }} />
                    <span className="text-[12px] font-semibold text-[#0F172A] w-24">
                      {fmtDate(p.date, intlLocale)}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded font-semibold" style={{ background: ptype.color + '18', color: ptype.color }}>
                      {ptype.label}
                    </span>
                    {p.heure_arrivee && (
                      <span className="text-[11px] text-[#64748B]">
                        {p.heure_arrivee}{p.heure_depart ? ` → ${p.heure_depart}` : ''}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── MON PROFIL ──────────────────────────────────────── */}
      {tab === 'profil' && firstEmp && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4">
          <p className="text-[14px] font-bold text-[#0F172A]">Informations personnelles</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Nom complet',     value: firstEmp.nom          },
              { label: 'Matricule',       value: firstEmp.matricule    },
              { label: 'Poste',           value: firstEmp.poste        },
              { label: 'Département',     value: firstEmp.departement  },
              { label: 'Type de contrat', value: firstEmp.type_contrat },
              { label: 'Date d\'entrée',  value: firstEmp.date_debut_contrat ? fmtDate(firstEmp.date_debut_contrat, intlLocale) : null },
              { label: 'Email pro',       value: firstEmp.email_pro    },
              { label: 'Téléphone',       value: firstEmp.telephone    },
              { label: 'Ancienneté',      value: anciennete(firstEmp.date_debut_contrat) },
              { label: 'Salaire brut',    value: firstEmp.salaire_brut ? fmtFCFA(firstEmp.salaire_brut) : null },
            ].map(f => (
              <div key={f.label} className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide">{f.label}</span>
                <span className="text-[13px] font-semibold text-[#0F172A]">{f.value ?? '—'}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#94A3B8] border-t border-[#F1F5F9] pt-3">
            Pour modifier vos informations, contactez votre responsable RH.
          </p>
        </div>
      )}
      {tab === 'profil' && !firstEmp && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] py-16 text-center">
          <User size={32} className="mx-auto mb-2 text-[#E2E8F0]" />
          <p className="text-[13px] text-[#94A3B8]">Aucun profil employé trouvé</p>
        </div>
      )}
    </div>
  )
}
