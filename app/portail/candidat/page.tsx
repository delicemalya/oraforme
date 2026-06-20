'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  User, FileText, Briefcase, ClipboardList, Banknote, Star,
  GraduationCap, Bell, Send, MessageSquare, Download, Edit3,
  Save, X, CheckCircle, AlertCircle, Loader2,
  MapPin, Phone, Mail, Globe, Award, Calendar, TrendingUp,
  RefreshCw, ChevronRight, Building,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'profil' | 'cv' | 'missions' | 'contrats' | 'paie' | 'evaluations' | 'formations'

interface Notification { id: string; title: string; body: string; type: string; read: boolean; created_at: string }
interface Candidat {
  id: string; nom: string; prenom: string; email: string; telephone: string | null
  ville: string | null; pays: string | null; poste_habituel: string | null
  qualification: string | null; score_global: number | null; cv_url: string | null
  linkedin_url: string | null; disponibilite: string | null; type_contrat_souhaite: string | null
  salaire_souhaite: number | null; mobilite: string | null; langues: string | null
  created_at: string
}
interface Mission {
  id: string; poste: string; entreprise_cliente: string | null; type_contrat: string | null
  date_debut: string | null; date_fin: string | null; salaire_mensuel: number | null
  statut: string; notes: string | null; created_at: string
}
interface Affectation {
  id: string; poste_client: string; date_debut: string; date_fin_prevue: string | null
  date_fin_reelle: string | null; salaire_mensuel_brut: number | null
  nb_heures_semaine: number | null; statut: string; renouvellements: number | null
  client: { nom: string } | null
}
interface Contrat {
  id: string; reference: string; poste: string; type_contrat: string | null
  statut: string; date_signature: string | null; salaire_brut: number | null
  document_url: string | null; created_at: string
}
interface Paie {
  id: string; mois: string; salaire_base: number | null; salaire_brut: number | null
  salaire_net: number | null; cotisation_cnss_salarie: number | null; irpp: number | null
  statut: string; created_at: string
}
interface Evaluation {
  id: string; nom_test: string; type_test: string | null; score: number | null
  score_max: number | null; date_passation: string | null; duree_minutes: number | null
  statut: string; notes: string | null
}
interface Diplome {
  id: string; titre: string; etablissement: string | null; domaine: string | null
  annee: number | null; niveau: string | null
}
interface Certification {
  id: string; titre: string; organisme: string | null; date_obtention: string | null
  date_expiration: string | null; credential_url: string | null
}
interface Experience {
  id: string; poste: string; entreprise: string | null; secteur: string | null
  date_debut: string | null; date_fin: string | null; en_cours: boolean | null; description: string | null
}
interface Entretien {
  id: string; type: string | null; statut: string; date_entretien: string | null
  note: number | null; commentaire: string | null; created_at: string
}

interface PortalData {
  tenant: { nom_entreprise: string; logo_url: string | null } | null
  candidat: Candidat | null
  missions: Mission[]; affectations: Affectation[]; contrats: Contrat[]
  paie: Paie[]; evaluations: Evaluation[]
  diplomes: Diplome[]; certifications: Certification[]
  experiences: Experience[]; entretiens: Entretien[]
  notifications: Notification[]
  tenantId: string; candidatId: string
}

type ProfilePatch = {
  telephone?: string; ville?: string; disponibilite?: string
  salaire_souhaite?: number; type_contrat_souhaite?: string; mobilite?: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TABS: Array<{ key: Tab; label: string; icon: React.ElementType; mobileLabel: string }> = [
  { key: 'profil',      label: 'Mon profil',      icon: User,          mobileLabel: 'Profil'     },
  { key: 'cv',          label: 'Mon CV',           icon: FileText,      mobileLabel: 'CV'         },
  { key: 'missions',    label: 'Mes missions',     icon: Briefcase,     mobileLabel: 'Missions'   },
  { key: 'contrats',    label: 'Mes contrats',     icon: ClipboardList, mobileLabel: 'Contrats'   },
  { key: 'paie',        label: 'Ma paie',          icon: Banknote,      mobileLabel: 'Paie'       },
  { key: 'evaluations', label: 'Évaluations',      icon: Star,          mobileLabel: 'Tests'      },
  { key: 'formations',  label: 'Formations',       icon: GraduationCap, mobileLabel: 'Formation'  },
]

const DISPONIBILITE_OPTIONS = [
  'Immédiate', 'Dans 1 mois', 'Dans 2 mois', 'Dans 3 mois', 'En poste',
]
const CONTRAT_OPTIONS = ['CDI', 'CDD', 'Intérim', 'Mission MAD', 'Stage', 'Freelance']
const MOBILITE_OPTIONS = ['Locale', 'Régionale', 'Nationale', 'Internationale', 'Télétravail']

function formatDate(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function formatMoney(n: number | null | undefined): string {
  if (!n && n !== 0) return '—'
  return n.toLocaleString('fr-FR') + ' FCFA'
}
function formatMois(s: string): string {
  const [y, m] = s.split('-')
  const months = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc']
  return `${months[parseInt(m) - 1] ?? m} ${y}`
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function NotifBadge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] flex items-center justify-center">
        <Icon size={24} className="text-[#CBD5E1]" />
      </div>
      <p className="text-[13px] text-[#94A3B8] font-medium">{text}</p>
    </div>
  )
}

function ScoreBar({ score, max }: { score: number | null; max: number | null }) {
  const pct = (score && max && max > 0) ? Math.round((score / max) * 100) : null
  if (pct === null) return <span className="text-[11px] text-[#94A3B8]">—</span>
  const color = pct >= 75 ? '#16A34A' : pct >= 50 ? '#F59E0B' : '#DC2626'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] font-bold shrink-0" style={{ color }}>{pct}%</span>
    </div>
  )
}

function MessageModal({ token, onClose, onSent }: { token: string; onClose: () => void; onSent: () => void }) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  async function send() {
    if (!body.trim()) return
    setSending(true)
    await fetch('/api/portail/candidat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action: 'send_message', data: { subject, body } }),
    })
    setSending(false); onSent(); onClose()
  }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
          <p className="text-[14px] font-bold text-[#0F172A]">Message à l&apos;agence</p>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Sujet (optionnel)"
            className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-amber-200" />
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Votre message…" rows={5}
            className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-amber-200 resize-none" />
          <button onClick={send} disabled={sending || !body.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[13px] text-white bg-[#F59E0B] hover:bg-amber-600 disabled:opacity-50 transition-colors">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {sending ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Profile Editor ─────────────────────────────────────────────────────────────

function ProfileEditor({ candidat, token, onSaved }: { candidat: Candidat; token: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm] = useState<ProfilePatch>({
    telephone:            candidat.telephone ?? '',
    ville:                candidat.ville ?? '',
    disponibilite:        candidat.disponibilite ?? '',
    salaire_souhaite:     candidat.salaire_souhaite ?? undefined,
    type_contrat_souhaite: candidat.type_contrat_souhaite ?? '',
    mobilite:             candidat.mobilite ?? '',
  })

  async function save() {
    setSaving(true)
    await fetch('/api/portail/candidat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action: 'update_profile', data: form }),
    })
    setSaving(false); setEditing(false); onSaved()
  }

  function field(label: string, value: string | null | undefined) {
    return (
      <div>
        <p className="text-[9px] text-[#94A3B8] font-semibold uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-[13px] text-[#0F172A] font-medium">{value || '—'}</p>
      </div>
    )
  }

  if (!editing) return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
      {/* Avatar strip */}
      <div className="bg-gradient-to-r from-[#F59E0B] to-amber-400 px-5 py-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <span className="text-[24px] font-black text-white">
              {(candidat.prenom?.[0] ?? '') + (candidat.nom?.[0] ?? '')}
            </span>
          </div>
          <div>
            <p className="text-[20px] font-extrabold text-white">{candidat.prenom} {candidat.nom}</p>
            <p className="text-[13px] text-amber-100">{candidat.poste_habituel ?? candidat.qualification ?? 'Candidat'}</p>
            {candidat.score_global !== null && (
              <div className="flex items-center gap-1.5 mt-1">
                <Star size={11} className="text-amber-200 fill-amber-200" />
                <span className="text-[11px] text-amber-100 font-semibold">Score global : {candidat.score_global}/100</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">
          <div className="flex items-center gap-2">
            <Mail size={12} className="text-[#94A3B8] shrink-0" />
            <p className="text-[12px] text-[#374151] truncate">{candidat.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Phone size={12} className="text-[#94A3B8] shrink-0" />
            <p className="text-[12px] text-[#374151]">{candidat.telephone || '—'}</p>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={12} className="text-[#94A3B8] shrink-0" />
            <p className="text-[12px] text-[#374151]">{candidat.ville || '—'}</p>
          </div>
          {candidat.linkedin_url && (
            <div className="flex items-center gap-2">
              <Globe size={12} className="text-[#94A3B8] shrink-0" />
              <a href={candidat.linkedin_url} target="_blank" rel="noreferrer"
                className="text-[12px] text-[#2563EB] hover:underline truncate">LinkedIn</a>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3 border-t border-[#F1F5F9]">
          {field('Disponibilité',     candidat.disponibilite)}
          {field('Type de contrat',   candidat.type_contrat_souhaite)}
          {field('Salaire souhaité',  candidat.salaire_souhaite ? formatMoney(candidat.salaire_souhaite) : null)}
          {field('Mobilité',          candidat.mobilite)}
          {field('Langues',           candidat.langues)}
        </div>

        <button onClick={() => setEditing(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-bold
            border border-[#E2E8F0] text-[#374151] hover:bg-[#F8FAFC] transition-colors">
          <Edit3 size={13} />Modifier mes informations
        </button>
      </div>
    </div>
  )

  // Edit mode
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-bold text-[#0F172A]">Modifier le profil</p>
        <button onClick={() => setEditing(false)} className="text-[#94A3B8]"><X size={16} /></button>
      </div>

      {[
        { key: 'telephone', label: 'Téléphone', type: 'tel' as const },
        { key: 'ville', label: 'Ville', type: 'text' as const },
      ].map(({ key, label, type }) => (
        <div key={key}>
          <label className="text-[11px] font-semibold text-[#374151] uppercase tracking-wide mb-1 block">{label}</label>
          <input type={type} value={(form as Record<string, unknown>)[key] as string ?? ''}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-amber-200" />
        </div>
      ))}

      <div>
        <label className="text-[11px] font-semibold text-[#374151] uppercase tracking-wide mb-1 block">Disponibilité</label>
        <select value={form.disponibilite ?? ''} onChange={e => setForm(f => ({ ...f, disponibilite: e.target.value }))}
          className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-amber-200">
          <option value="">— Choisir —</option>
          {DISPONIBILITE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      <div>
        <label className="text-[11px] font-semibold text-[#374151] uppercase tracking-wide mb-1 block">Type de contrat souhaité</label>
        <select value={form.type_contrat_souhaite ?? ''} onChange={e => setForm(f => ({ ...f, type_contrat_souhaite: e.target.value }))}
          className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-amber-200">
          <option value="">— Choisir —</option>
          {CONTRAT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      <div>
        <label className="text-[11px] font-semibold text-[#374151] uppercase tracking-wide mb-1 block">Salaire souhaité (FCFA)</label>
        <input type="number" value={form.salaire_souhaite ?? ''}
          onChange={e => setForm(f => ({ ...f, salaire_souhaite: parseInt(e.target.value) || undefined }))}
          className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-amber-200" />
      </div>

      <div>
        <label className="text-[11px] font-semibold text-[#374151] uppercase tracking-wide mb-1 block">Mobilité</label>
        <select value={form.mobilite ?? ''} onChange={e => setForm(f => ({ ...f, mobilite: e.target.value }))}
          className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-amber-200">
          <option value="">— Choisir —</option>
          {MOBILITE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      <button onClick={save} disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[13px] text-white bg-[#F59E0B] hover:bg-amber-600 disabled:opacity-50 transition-colors">
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        {saving ? 'Enregistrement…' : 'Sauvegarder'}
      </button>
    </div>
  )
}

// ── Main Content ───────────────────────────────────────────────────────────────

function CandidatPortalContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('t') ?? ''

  const [data,    setData]    = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [tab,     setTab]     = useState<Tab>('profil')
  const [showMsg, setShowMsg] = useState(false)
  const [toast,   setToast]   = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    if (!token) { setError('Lien invalide'); setLoading(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/portail/candidat?t=${token}`)
      const json = await res.json() as PortalData & { error?: string }
      if (!res.ok) { setError(json.error ?? 'Accès non autorisé'); return }
      setData(json)
    } catch { setError('Erreur de connexion') }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { void load() }, [load])

  async function markAllRead() {
    await fetch('/api/portail/candidat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action: 'mark_read', data: {} }),
    })
    void load()
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8]">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#F59E0B]/10 flex items-center justify-center">
          <Loader2 size={28} className="text-[#F59E0B] animate-spin" />
        </div>
        <p className="text-[14px] font-semibold text-[#374151]">Chargement de votre espace…</p>
      </div>
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8] p-4">
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-8 max-w-sm text-center">
        <AlertCircle size={36} className="mx-auto mb-4 text-red-400" />
        <h2 className="text-[16px] font-bold text-[#0F172A] mb-2">Accès non autorisé</h2>
        <p className="text-[13px] text-[#64748B]">{error ?? 'Lien expiré ou invalide. Contactez votre agence RH.'}</p>
      </div>
    </div>
  )

  const unread = data.notifications.filter(n => !n.read).length
  const c = data.candidat

  return (
    <div className="min-h-screen bg-[#F0F4F8]">

      {/* ── Header ── */}
      <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F59E0B] flex items-center justify-center shrink-0">
              <span className="text-[13px] font-black text-white">
                {(c?.prenom?.[0] ?? '') + (c?.nom?.[0] ?? '')}
              </span>
            </div>
            <div>
              <p className="text-[12px] font-black text-[#0F172A] leading-none">
                {c?.prenom} {c?.nom}
              </p>
              <p className="text-[10px] text-[#94A3B8]">{data.tenant?.nom_entreprise ?? 'Portail Candidat'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowMsg(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] transition-colors">
              <MessageSquare size={12} />Message
            </button>
            <button onClick={markAllRead} className="relative p-2 rounded-xl hover:bg-[#F1F5F9] transition-colors">
              <Bell size={18} className="text-[#64748B]" />
              <NotifBadge count={unread} />
            </button>
          </div>
        </div>

        {/* Desktop tabs */}
        <div className="hidden sm:flex max-w-4xl mx-auto px-4 gap-0 border-t border-[#F1F5F9] overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium border-b-2 transition-all whitespace-nowrap shrink-0
                ${tab === t.key ? 'border-[#F59E0B] text-[#D97706]' : 'border-transparent text-[#64748B] hover:text-[#374151]'}`}>
              <t.icon size={12} />{t.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-4xl mx-auto px-4 py-5 pb-24 sm:pb-8">

        {/* PROFIL */}
        {tab === 'profil' && c && (
          <div className="space-y-4">
            <ProfileEditor candidat={c} token={token} onSaved={() => { void load(); showToast('✓ Profil mis à jour') }} />

            {/* Notifications */}
            {data.notifications.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                <p className="text-[13px] font-bold text-[#0F172A] mb-3">Activité récente</p>
                <div className="space-y-2">
                  {data.notifications.slice(0, 5).map(n => (
                    <div key={n.id} className={`flex gap-3 p-2.5 rounded-xl ${n.read ? 'bg-[#F8FAFC]' : 'bg-amber-50'}`}>
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read ? 'bg-[#CBD5E1]' : 'bg-[#F59E0B]'}`} />
                      <div>
                        <p className={`text-[12px] font-semibold ${n.read ? 'text-[#64748B]' : 'text-[#0F172A]'}`}>{n.title}</p>
                        {n.body && <p className="text-[10px] text-[#94A3B8]">{n.body}</p>}
                        <p className="text-[9px] text-[#CBD5E1] mt-0.5">{formatDate(n.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MON CV */}
        {tab === 'cv' && (
          <div className="space-y-4">
            {/* CV download */}
            {c?.cv_url && (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
                    <FileText size={18} className="text-[#D97706]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-[#0F172A]">Mon CV</p>
                    <p className="text-[10px] text-[#94A3B8]">Fichier disponible</p>
                  </div>
                </div>
                <a href={c.cv_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-white bg-[#F59E0B] hover:bg-amber-600">
                  <Download size={12} />Télécharger
                </a>
              </div>
            )}

            {/* Expériences */}
            {data.experiences.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                <p className="text-[13px] font-bold text-[#0F172A] mb-3">Expériences professionnelles</p>
                <div className="space-y-3">
                  {data.experiences.map(e => (
                    <div key={e.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-[#F59E0B] mt-1" />
                        <div className="w-0.5 bg-[#F1F5F9] flex-1 mt-1" />
                      </div>
                      <div className="pb-3">
                        <p className="text-[13px] font-bold text-[#0F172A]">{e.poste}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Building size={10} className="text-[#94A3B8]" />
                          <p className="text-[11px] text-[#64748B]">{e.entreprise ?? '—'}</p>
                          {e.secteur && <span className="text-[10px] text-[#94A3B8]">· {e.secteur}</span>}
                        </div>
                        <p className="text-[10px] text-[#94A3B8] mt-0.5 flex items-center gap-1">
                          <Calendar size={9} />
                          {formatDate(e.date_debut)} — {e.en_cours ? "Présent" : formatDate(e.date_fin)}
                        </p>
                        {e.description && (
                          <p className="text-[11px] text-[#64748B] mt-1 line-clamp-2">{e.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Diplômes */}
            {data.diplomes.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                <p className="text-[13px] font-bold text-[#0F172A] mb-3">Formation académique</p>
                <div className="space-y-2.5">
                  {data.diplomes.map(d => (
                    <div key={d.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center shrink-0">
                        <GraduationCap size={14} className="text-[#D97706]" />
                      </div>
                      <div>
                        <p className="text-[12px] font-bold text-[#0F172A]">{d.titre}</p>
                        <p className="text-[10px] text-[#64748B]">{d.etablissement ?? '—'} {d.annee ? `· ${d.annee}` : ''}</p>
                        {d.niveau && <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-semibold">{d.niveau}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.experiences.length === 0 && data.diplomes.length === 0 && !c?.cv_url && (
              <EmptyState icon={FileText} text="Aucune information CV disponible" />
            )}
          </div>
        )}

        {/* MISSIONS */}
        {tab === 'missions' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-bold text-[#0F172A]">Mes missions</p>
              <button onClick={load} className="text-[#F59E0B]"><RefreshCw size={14} /></button>
            </div>
            {data.missions.length === 0 && data.affectations.length === 0
              ? <EmptyState icon={Briefcase} text="Aucune mission enregistrée" />
              : (
                <>
                  {data.missions.map(m => (
                    <div key={m.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[14px] font-bold text-[#0F172A]">{m.poste}</p>
                          <p className="text-[11px] text-[#64748B]">{m.entreprise_cliente ?? '—'}</p>
                          <p className="text-[10px] text-[#94A3B8] mt-1">
                            {formatDate(m.date_debut)} → {formatDate(m.date_fin)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: m.statut === 'en_cours' ? '#F0FDF4' : '#F8FAFC',
                              color: m.statut === 'en_cours' ? '#16A34A' : '#94A3B8',
                            }}>
                            {m.statut === 'en_cours' ? 'En cours' : m.statut}
                          </span>
                          {m.salaire_mensuel && (
                            <p className="text-[11px] font-bold text-[#F59E0B] mt-1">{formatMoney(m.salaire_mensuel)}/mois</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {data.affectations.map(a => (
                    <div key={a.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[14px] font-bold text-[#0F172A]">{a.poste_client}</p>
                          <p className="text-[11px] text-[#64748B]">{(a.client as { nom?: string } | null)?.nom ?? '—'}</p>
                          <p className="text-[10px] text-[#94A3B8] mt-1">
                            {formatDate(a.date_debut)} → {a.date_fin_reelle ? formatDate(a.date_fin_reelle) : formatDate(a.date_fin_prevue)}
                          </p>
                          {a.nb_heures_semaine && (
                            <p className="text-[10px] text-[#94A3B8]">{a.nb_heures_semaine}h/semaine</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: a.statut === 'en_cours' ? '#EFF6FF' : '#F8FAFC',
                              color: a.statut === 'en_cours' ? '#2563EB' : '#94A3B8',
                            }}>
                            MAD · {a.statut}
                          </span>
                          {a.salaire_mensuel_brut && (
                            <p className="text-[11px] font-bold text-[#F59E0B] mt-1">{formatMoney(a.salaire_mensuel_brut)}/mois</p>
                          )}
                          {a.renouvellements !== null && a.renouvellements > 0 && (
                            <p className="text-[9px] text-[#94A3B8]">{a.renouvellements} renouvellement(s)</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )
            }
          </div>
        )}

        {/* CONTRATS */}
        {tab === 'contrats' && (
          <div className="space-y-3">
            <p className="text-[14px] font-bold text-[#0F172A]">Mes contrats</p>
            {data.contrats.length === 0
              ? <EmptyState icon={ClipboardList} text="Aucun contrat enregistré" />
              : data.contrats.map(c => (
                <div key={c.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[14px] font-bold text-[#0F172A]">{c.poste}</p>
                      <p className="text-[11px] text-[#64748B]">{c.reference} · {c.type_contrat?.toUpperCase() ?? '—'}</p>
                      <p className="text-[10px] text-[#94A3B8] mt-0.5">Signé le {formatDate(c.date_signature)}</p>
                      {c.salaire_brut && (
                        <p className="text-[12px] font-bold text-[#F59E0B] mt-1">{formatMoney(c.salaire_brut)}/mois brut</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: c.statut === 'signe' ? '#F0FDF4' : '#FFFBEB',
                          color: c.statut === 'signe' ? '#16A34A' : '#D97706',
                        }}>
                        {c.statut === 'signe' ? 'Signé' : 'En attente'}
                      </span>
                      {c.document_url && (
                        <a href={c.document_url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-[10px] text-[#F59E0B] hover:underline">
                          <Download size={10} />Télécharger
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* PAIE */}
        {tab === 'paie' && (
          <div className="space-y-3">
            <p className="text-[14px] font-bold text-[#0F172A]">Mes bulletins de paie</p>
            {data.paie.length === 0
              ? <EmptyState icon={Banknote} text="Aucun bulletin de paie disponible" />
              : (
                <>
                  {/* Mini chart: last 6 months net */}
                  {data.paie.length >= 2 && (() => {
                    const last6 = data.paie.slice(0, 6).reverse()
                    const max = Math.max(...last6.map(p => p.salaire_net ?? 0))
                    return (
                      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                        <p className="text-[11px] font-semibold text-[#64748B] mb-3">Salaire net — 6 derniers mois</p>
                        <div className="flex items-end gap-1.5 h-16">
                          {last6.map((p, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                              <div className="w-full rounded-t-md bg-[#F59E0B]/20 relative overflow-hidden"
                                style={{ height: `${max > 0 ? Math.max(6, ((p.salaire_net ?? 0) / max) * 56) : 6}px` }}>
                                <div className="absolute inset-0 bg-[#F59E0B] opacity-70" />
                              </div>
                              <p className="text-[8px] text-[#94A3B8] text-center leading-none">
                                {p.mois.slice(5, 7)}/{p.mois.slice(2, 4)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  {data.paie.map(p => (
                    <div key={p.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[14px] font-bold text-[#0F172A]">{formatMois(p.mois)}</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                            {[
                              { label: 'Brut', v: p.salaire_brut },
                              { label: 'Net', v: p.salaire_net },
                              { label: 'CNSS salarié', v: p.cotisation_cnss_salarie },
                              { label: 'IRPP', v: p.irpp },
                            ].map(({ label, v }) => (
                              <div key={label}>
                                <p className="text-[9px] text-[#94A3B8]">{label}</p>
                                <p className={`text-[12px] font-bold ${label === 'Net' ? 'text-[#16A34A]' : 'text-[#374151]'}`}>
                                  {formatMoney(v)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: p.statut === 'paye' ? '#F0FDF4' : '#FFFBEB',
                            color: p.statut === 'paye' ? '#16A34A' : '#D97706',
                          }}>
                          {p.statut === 'paye' ? 'Payé' : 'En attente'}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )
            }
          </div>
        )}

        {/* ÉVALUATIONS */}
        {tab === 'evaluations' && (
          <div className="space-y-4">
            {/* Score global */}
            {c?.score_global !== null && c?.score_global !== undefined && (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-bold text-[#0F172A]">Score global</p>
                  <p className="text-[28px] font-extrabold text-[#F59E0B]">{c.score_global}<span className="text-[16px] font-normal text-[#94A3B8]">/100</span></p>
                </div>
                <div className="h-2.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                  <div className="h-full rounded-full bg-[#F59E0B]" style={{ width: `${c.score_global}%` }} />
                </div>
              </div>
            )}

            {/* Tests */}
            <p className="text-[14px] font-bold text-[#0F172A]">Tests & Évaluations</p>
            {data.evaluations.length === 0
              ? <EmptyState icon={Star} text="Aucun test ou évaluation enregistré" />
              : data.evaluations.map(e => (
                <div key={e.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-[13px] font-bold text-[#0F172A]">{e.nom_test}</p>
                      <p className="text-[10px] text-[#94A3B8]">
                        {e.type_test ?? '—'} · {formatDate(e.date_passation)}
                        {e.duree_minutes ? ` · ${e.duree_minutes} min` : ''}
                      </p>
                      {(e.score !== null && e.score_max !== null) && (
                        <div className="mt-2">
                          <ScoreBar score={e.score} max={e.score_max} />
                          <p className="text-[10px] text-[#94A3B8] mt-0.5">{e.score}/{e.score_max} points</p>
                        </div>
                      )}
                      {e.notes && (
                        <p className="text-[10px] text-[#64748B] italic mt-1.5 bg-[#F8FAFC] rounded px-2 py-1">
                          {e.notes}
                        </p>
                      )}
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        background: e.statut === 'termine' ? '#F0FDF4' : '#EFF6FF',
                        color: e.statut === 'termine' ? '#16A34A' : '#2563EB',
                      }}>
                      {e.statut === 'termine' ? 'Terminé' : 'En cours'}
                    </span>
                  </div>
                </div>
              ))
            }

            {/* Entretiens */}
            {data.entretiens.length > 0 && (
              <>
                <p className="text-[13px] font-bold text-[#0F172A]">Entretiens</p>
                {data.entretiens.map(e => (
                  <div key={e.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[12px] font-bold text-[#0F172A]">{e.type ?? 'Entretien'}</p>
                        <p className="text-[10px] text-[#94A3B8] flex items-center gap-1">
                          <Calendar size={9} />{formatDate(e.date_entretien)}
                        </p>
                        {e.commentaire && (
                          <p className="text-[10px] text-[#64748B] mt-1 italic">{e.commentaire}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F8FAFC] text-[#64748B]">
                          {e.statut}
                        </span>
                        {e.note !== null && (
                          <div className="flex items-center gap-1">
                            <Star size={10} className="text-[#F59E0B] fill-[#F59E0B]" />
                            <span className="text-[10px] font-bold text-[#374151]">{e.note}/10</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* FORMATIONS */}
        {tab === 'formations' && (
          <div className="space-y-4">
            {/* Certifications */}
            <p className="text-[14px] font-bold text-[#0F172A]">Certifications</p>
            {data.certifications.length === 0
              ? <EmptyState icon={Award} text="Aucune certification enregistrée" />
              : data.certifications.map(cert => (
                <div key={cert.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center shrink-0">
                      <Award size={18} className="text-[#D97706]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-bold text-[#0F172A]">{cert.titre}</p>
                      <p className="text-[11px] text-[#64748B]">{cert.organisme ?? '—'}</p>
                      <p className="text-[10px] text-[#94A3B8] mt-0.5">
                        Obtenu le {formatDate(cert.date_obtention)}
                        {cert.date_expiration ? ` · Expire le ${formatDate(cert.date_expiration)}` : ''}
                      </p>
                      {cert.credential_url && (
                        <a href={cert.credential_url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 mt-1.5 text-[10px] text-[#2563EB] hover:underline">
                          <ChevronRight size={9} />Voir le certificat
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))
            }

            {/* Diplômes */}
            {data.diplomes.length > 0 && (
              <>
                <p className="text-[13px] font-bold text-[#0F172A] mt-2">Diplômes</p>
                {data.diplomes.map(d => (
                  <div key={d.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                        <GraduationCap size={18} className="text-[#D97706]" />
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-[#0F172A]">{d.titre}</p>
                        <p className="text-[11px] text-[#64748B]">{d.etablissement ?? '—'}</p>
                        <p className="text-[10px] text-[#94A3B8]">
                          {d.domaine ?? ''}{d.domaine && d.annee ? ' · ' : ''}{d.annee ?? ''}
                        </p>
                        {d.niveau && (
                          <span className="inline-block text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold mt-1">
                            {d.niveau}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Entretiens de formation */}
            {data.certifications.length === 0 && data.diplomes.length === 0 && (
              <EmptyState icon={GraduationCap} text="Aucune formation enregistrée" />
            )}

            {/* CTA formation */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-100 p-4">
              <div className="flex items-center gap-3">
                <TrendingUp size={20} className="text-[#D97706] shrink-0" />
                <div>
                  <p className="text-[12px] font-bold text-[#92400E]">Développez vos compétences</p>
                  <p className="text-[10px] text-[#B45309]">Contactez votre agence pour des recommandations de formation personnalisées.</p>
                </div>
                <button onClick={() => setShowMsg(true)}
                  className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-bold text-white bg-[#F59E0B] hover:bg-amber-600">
                  <Send size={11} />Contacter
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ── Mobile bottom navigation ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] z-30">
        <div className="flex overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors min-w-0 relative
                ${tab === t.key ? 'text-[#F59E0B]' : 'text-[#94A3B8]'}`}>
              <t.icon size={16} />
              <span className="text-[8px] font-medium truncate w-full text-center px-1">{t.mobileLabel}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-2 bg-[#0F172A] text-white px-4 py-2.5 rounded-2xl shadow-xl text-[12px] font-medium">
            <CheckCircle size={14} className="text-green-400" />{toast}
          </div>
        </div>
      )}

      {/* ── Message modal ── */}
      {showMsg && (
        <MessageModal token={token} onClose={() => setShowMsg(false)} onSent={() => showToast('Message envoyé')} />
      )}
    </div>
  )
}

export default function CandidatPortalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8]">
        <Loader2 size={28} className="text-[#F59E0B] animate-spin" />
      </div>
    }>
      <CandidatPortalContent />
    </Suspense>
  )
}
