'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Home, ClipboardList, Users, FileText, CreditCard, FolderOpen,
  Bell, Send, MessageSquare, Download, Check, X, Clock,
  CheckCircle, XCircle, AlertCircle, ChevronRight,
  Loader2, RefreshCw, Star, UserCheck,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'accueil' | 'demandes' | 'candidats' | 'contrats' | 'factures' | 'documents'

interface Notification { id: string; title: string; body: string; type: string; read: boolean; created_at: string }
interface Demande { id: string; titre: string; localisation: string; type_contrat: string; statut: string; created_at: string }
interface CandidatPropose {
  id: string; poste: string; statut: string; score_match: number | null
  message_agence: string | null; date_proposition: string
  candidat: { id: string; nom: string; prenom: string; email: string; poste_habituel: string; score_global: number | null; cv_url: string | null } | null
  offre: { id: string; titre: string } | null
}
interface Contrat { id: string; reference: string; poste: string; type_contrat: string; statut: string; date_signature: string | null; document_url: string | null }
interface Facture { id: string; numero: string; objet: string; total: number; statut: string; date_echeance: string | null; created_at: string }
interface Document { id: string; nom: string; type_document: string; taille: number | null; url_stockage: string | null; created_at: string }
interface Message { id: string; direction: string; subject: string; body: string; read: boolean; created_at: string }

interface PortalData {
  tenant: { nom_entreprise: string; logo_url: string | null } | null
  client: { id: string; nom: string; email: string; telephone: string | null } | null
  demandes: Demande[]; candidatsProposes: CandidatPropose[]; contrats: Contrat[]
  factures: Facture[]; documents: Document[]; notifications: Notification[]; messages: Message[]
  tenantId: string; clientId: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TABS: Array<{ key: Tab; label: string; icon: React.ElementType; mobileLabel: string }> = [
  { key: 'accueil',    label: 'Tableau de bord', icon: Home,         mobileLabel: 'Accueil'    },
  { key: 'demandes',   label: 'Mes demandes',    icon: ClipboardList, mobileLabel: 'Demandes'  },
  { key: 'candidats',  label: 'Candidats',       icon: Users,         mobileLabel: 'Candidats' },
  { key: 'factures',   label: 'Factures',        icon: CreditCard,    mobileLabel: 'Factures'  },
  { key: 'contrats',   label: 'Contrats',        icon: FileText,      mobileLabel: 'Contrats'  },
  { key: 'documents',  label: 'Documents',       icon: FolderOpen,    mobileLabel: 'Docs'      },
]

const STATUT_PROPOSE: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  propose:              { label: 'Proposé',          color: '#2563EB', bg: '#EFF6FF', icon: Clock },
  accepte:              { label: 'Accepté',          color: '#16A34A', bg: '#F0FDF4', icon: CheckCircle },
  refuse:               { label: 'Refusé',           color: '#DC2626', bg: '#FEF2F2', icon: XCircle },
  entretien_planifie:   { label: 'Entretien prévu',  color: '#D97706', bg: '#FFFBEB', icon: Clock },
  place:                { label: 'Placé',            color: '#7C3AED', bg: '#F5F3FF', icon: Star },
}

const STATUT_FACT: Record<string, { label: string; color: string; bg: string }> = {
  brouillon: { label: 'Brouillon',  color: '#94A3B8', bg: '#F8FAFC' },
  envoyee:   { label: 'À payer',    color: '#2563EB', bg: '#EFF6FF' },
  payee:     { label: 'Payée',      color: '#16A34A', bg: '#F0FDF4' },
  retard:    { label: 'En retard',  color: '#DC2626', bg: '#FEF2F2' },
  annulee:   { label: 'Annulée',    color: '#94A3B8', bg: '#F8FAFC' },
}

function formatDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatMoney(n: number): string {
  return n.toLocaleString('fr-FR') + ' FCFA'
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

function StatusBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color, background: bg }}>
      {label}
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

// ── Message modal ─────────────────────────────────────────────────────────────

function MessageModal({ token, onClose, onSent }: { token: string; onClose: () => void; onSent: () => void }) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  async function send() {
    if (!body.trim()) return
    setSending(true)
    await fetch('/api/portail/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action: 'send_message', data: { subject, body } }),
    })
    setSending(false)
    onSent()
    onClose()
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
            className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-200" />
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Votre message…" rows={5}
            className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
          <button onClick={send} disabled={sending || !body.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[13px] text-white bg-[#1E40AF] hover:bg-[#1E3A8A] disabled:opacity-50 transition-colors">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {sending ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Content ───────────────────────────────────────────────────────────────

function ClientPortalContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('t') ?? ''

  const [data,     setData]     = useState<PortalData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [tab,      setTab]      = useState<Tab>('accueil')
  const [showMsg,  setShowMsg]  = useState(false)
  const [toast,    setToast]    = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
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
      const res = await fetch(`/api/portail/client?t=${token}`)
      const json = await res.json() as PortalData & { error?: string }
      if (!res.ok) { setError(json.error ?? 'Accès non autorisé'); return }
      setData(json)
    } catch { setError('Erreur de connexion') }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { void load() }, [load])

  // Real-time notifications via SSE polling (simplified — true Realtime needs Supabase client)
  useEffect(() => {
    if (!data) return
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/portail/client?t=${token}`)
        const json = await res.json() as PortalData
        if (res.ok && json.notifications) {
          const newNotifs = json.notifications.filter(n =>
            !n.read && !data.notifications.find(old => old.id === n.id)
          )
          if (newNotifs.length > 0) {
            setData(json)
            showToast(newNotifs[0].title)
          }
        }
      } catch { /* ignore */ }
    }, 30_000) // Poll every 30s
    return () => clearInterval(id)
  }, [data, token])  

  async function handleCandidatAction(propositionId: string, action: 'accept_candidat' | 'decline_candidat', poste: string) {
    setActionId(propositionId)
    await fetch('/api/portail/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action, data: { proposition_id: propositionId, poste } }),
    })
    setActionId(null)
    showToast(action === 'accept_candidat' ? '✓ Candidat accepté' : 'Candidat refusé')
    void load()
  }

  async function markAllRead() {
    await fetch('/api/portail/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action: 'mark_read', data: {} }),
    })
    void load()
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8]">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#1E40AF]/10 flex items-center justify-center">
          <Loader2 size={28} className="text-[#1E40AF] animate-spin" />
        </div>
        <p className="text-[14px] font-semibold text-[#374151]">Chargement de votre portail…</p>
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
  const pendingFactures = data.factures.filter(f => f.statut === 'envoyee' || f.statut === 'retard').length
  const newCandidats = data.candidatsProposes.filter(c => c.statut === 'propose').length

  return (
    <div className="min-h-screen bg-[#F0F4F8]">

      {/* ── Header ── */}
      <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1E40AF] flex items-center justify-center">
              <Users size={16} className="text-white" />
            </div>
            <div>
              <p className="text-[12px] font-black text-[#1E40AF] leading-none">
                {data.tenant?.nom_entreprise ?? 'Portail Client'}
              </p>
              <p className="text-[10px] text-[#94A3B8]">{data.client?.nom ?? 'Client'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowMsg(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium
                bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] transition-colors">
              <MessageSquare size={12} />Message
            </button>
            <button onClick={markAllRead} className="relative p-2 rounded-xl hover:bg-[#F1F5F9] transition-colors">
              <Bell size={18} className="text-[#64748B]" />
              <NotifBadge count={unread} />
            </button>
          </div>
        </div>

        {/* Desktop tabs */}
        <div className="hidden sm:flex max-w-4xl mx-auto px-4 gap-0 border-t border-[#F1F5F9]">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium border-b-2 transition-all
                ${tab === t.key ? 'border-[#1E40AF] text-[#1E40AF]' : 'border-transparent text-[#64748B] hover:text-[#374151]'}`}>
              <t.icon size={13} />
              {t.label}
              {t.key === 'candidats' && newCandidats > 0 && (
                <span className="ml-1 text-[9px] bg-[#1E40AF] text-white px-1.5 rounded-full font-bold">{newCandidats}</span>
              )}
              {t.key === 'factures' && pendingFactures > 0 && (
                <span className="ml-1 text-[9px] bg-red-500 text-white px-1.5 rounded-full font-bold">{pendingFactures}</span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-4xl mx-auto px-4 py-5 pb-24 sm:pb-8">

        {/* ACCUEIL */}
        {tab === 'accueil' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Demandes',      value: data.demandes.length,          color: '#1E40AF', bg: '#EFF6FF' },
                { label: 'Candidats',     value: newCandidats,                  color: '#7C3AED', bg: '#F5F3FF', badge: newCandidats > 0 },
                { label: 'Factures',      value: pendingFactures,               color: '#DC2626', bg: '#FEF2F2', badge: pendingFactures > 0 },
                { label: 'Contrats',      value: data.contrats.length,          color: '#16A34A', bg: '#F0FDF4' },
              ].map(({ label, value, color, bg, badge }) => (
                <div key={label} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-[#94A3B8] font-medium">{label}</p>
                    {badge && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                  </div>
                  <p className="text-[24px] font-extrabold" style={{ color }}>{value}</p>
                  <div className="h-1 rounded-full mt-2" style={{ background: bg, opacity: 0.6 }} />
                </div>
              ))}
            </div>

            {/* Candidats en attente */}
            {newCandidats > 0 && (
              <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] font-bold text-[#0F172A]">Candidats en attente de votre réponse</p>
                  <button onClick={() => setTab('candidats')} className="text-[11px] text-[#1E40AF] font-medium flex items-center gap-1">
                    Voir tous <ChevronRight size={12} />
                  </button>
                </div>
                {data.candidatsProposes.filter(c => c.statut === 'propose').slice(0, 3).map(cp => (
                  <div key={cp.id} className="flex items-center gap-3 py-2.5 border-b border-[#F8FAFC] last:border-0">
                    <div className="w-9 h-9 rounded-full bg-[#1E40AF]/10 flex items-center justify-center shrink-0">
                      <UserCheck size={16} className="text-[#1E40AF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#0F172A] truncate">
                        {cp.candidat?.prenom} {cp.candidat?.nom}
                      </p>
                      <p className="text-[10px] text-[#94A3B8]">{cp.poste}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => handleCandidatAction(cp.id, 'accept_candidat', cp.poste)}
                        disabled={actionId === cp.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white bg-[#16A34A] hover:bg-green-700 disabled:opacity-50">
                        {actionId === cp.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                        OK
                      </button>
                      <button onClick={() => handleCandidatAction(cp.id, 'decline_candidat', cp.poste)}
                        disabled={actionId === cp.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-[#DC2626] bg-red-50 hover:bg-red-100 disabled:opacity-50">
                        <X size={10} />Non
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Notifications récentes */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
              <p className="text-[13px] font-bold text-[#0F172A] mb-3">Activité récente</p>
              {data.notifications.length === 0 ? (
                <p className="text-[12px] text-[#94A3B8] text-center py-4">Aucune notification</p>
              ) : (
                <div className="space-y-2">
                  {data.notifications.slice(0, 5).map(n => (
                    <div key={n.id} className={`flex gap-3 p-2.5 rounded-xl ${n.read ? 'bg-[#F8FAFC]' : 'bg-blue-50'}`}>
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read ? 'bg-[#CBD5E1]' : 'bg-[#1E40AF]'}`} />
                      <div>
                        <p className={`text-[12px] font-semibold ${n.read ? 'text-[#64748B]' : 'text-[#0F172A]'}`}>{n.title}</p>
                        {n.body && <p className="text-[10px] text-[#94A3B8]">{n.body}</p>}
                        <p className="text-[9px] text-[#CBD5E1] mt-0.5">{formatDate(n.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* DEMANDES */}
        {tab === 'demandes' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-bold text-[#0F172A]">Mes demandes de recrutement</p>
              <button onClick={load} className="text-[#1E40AF]"><RefreshCw size={14} /></button>
            </div>
            {data.demandes.length === 0
              ? <EmptyState icon={ClipboardList} text="Aucune demande en cours" />
              : data.demandes.map(d => (
                <div key={d.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[14px] font-bold text-[#0F172A]">{d.titre}</p>
                      <p className="text-[11px] text-[#94A3B8] mt-0.5">
                        {d.type_contrat?.toUpperCase()} · {d.localisation || '—'}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: d.statut === 'active' ? '#F0FDF4' : '#F8FAFC',
                        color: d.statut === 'active' ? '#16A34A' : '#94A3B8',
                      }}>
                      {d.statut === 'active' ? 'En cours' : d.statut}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#CBD5E1] mt-2">Créée le {formatDate(d.created_at)}</p>
                </div>
              ))
            }
          </div>
        )}

        {/* CANDIDATS */}
        {tab === 'candidats' && (
          <div className="space-y-3">
            <p className="text-[14px] font-bold text-[#0F172A]">Candidats proposés par l&apos;agence</p>
            {data.candidatsProposes.length === 0
              ? <EmptyState icon={Users} text="Aucun candidat proposé pour l'instant" />
              : data.candidatsProposes.map(cp => {
                const statut = STATUT_PROPOSE[cp.statut] ?? STATUT_PROPOSE.propose
                const StatusIcon = statut.icon
                return (
                  <div key={cp.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-full bg-[#1E40AF]/10 flex items-center justify-center shrink-0">
                          <UserCheck size={18} className="text-[#1E40AF]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[14px] font-bold text-[#0F172A]">
                                {cp.candidat?.prenom} {cp.candidat?.nom}
                              </p>
                              <p className="text-[11px] text-[#64748B]">{cp.candidat?.poste_habituel || cp.poste}</p>
                            </div>
                            <StatusBadge label={statut.label} color={statut.color} bg={statut.bg} />
                          </div>
                          {cp.score_match !== null && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="flex-1 h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                                <div className="h-full rounded-full bg-[#1E40AF]"
                                  style={{ width: `${cp.score_match}%` }} />
                              </div>
                              <span className="text-[10px] text-[#1E40AF] font-bold shrink-0">
                                {cp.score_match}% match
                              </span>
                            </div>
                          )}
                          {cp.message_agence && (
                            <p className="text-[11px] text-[#64748B] bg-[#F8FAFC] rounded-lg px-3 py-2 mt-2 italic">
                              {cp.message_agence}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Pour le poste */}
                    <div className="px-4 py-2 bg-[#F8FAFC] border-t border-[#F1F5F9] flex items-center justify-between">
                      <p className="text-[10px] text-[#94A3B8]">
                        Pour : {cp.offre?.titre ?? cp.poste} · {formatDate(cp.date_proposition)}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {cp.candidat?.cv_url && (
                          <a href={cp.candidat.cv_url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium text-[#1E40AF] bg-blue-50 hover:bg-blue-100">
                            <Download size={10} />CV
                          </a>
                        )}
                        {cp.statut === 'propose' && (
                          <>
                            <button onClick={() => handleCandidatAction(cp.id, 'accept_candidat', cp.poste)}
                              disabled={actionId === cp.id}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white bg-[#16A34A] disabled:opacity-50">
                              {actionId === cp.id ? <Loader2 size={9} className="animate-spin" /> : <Check size={10} />}Accepter
                            </button>
                            <button onClick={() => handleCandidatAction(cp.id, 'decline_candidat', cp.poste)}
                              disabled={actionId === cp.id}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-[#DC2626] bg-red-50">
                              <X size={10} />Refuser
                            </button>
                          </>
                        )}
                        {cp.statut !== 'propose' && (
                          <div className="flex items-center gap-1 text-[10px]" style={{ color: statut.color }}>
                            <StatusIcon size={10} />{statut.label}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            }
          </div>
        )}

        {/* FACTURES */}
        {tab === 'factures' && (
          <div className="space-y-3">
            <p className="text-[14px] font-bold text-[#0F172A]">Factures & Paiements</p>
            {data.factures.length === 0
              ? <EmptyState icon={CreditCard} text="Aucune facture" />
              : data.factures.map(f => {
                const st = STATUT_FACT[f.statut] ?? STATUT_FACT.brouillon
                return (
                  <div key={f.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-bold text-[#0F172A]">{f.objet || `Facture ${f.numero}`}</p>
                        <p className="text-[11px] text-[#94A3B8]">Réf: {f.numero}</p>
                        <p className="text-[20px] font-black text-[#0F172A] mt-1">{formatMoney(f.total)}</p>
                        {f.date_echeance && (
                          <p className="text-[10px] text-[#94A3B8] mt-0.5">
                            Échéance : {formatDate(f.date_echeance)}
                          </p>
                        )}
                      </div>
                      <StatusBadge label={st.label} color={st.color} bg={st.bg} />
                    </div>
                  </div>
                )
              })
            }
          </div>
        )}

        {/* CONTRATS */}
        {tab === 'contrats' && (
          <div className="space-y-3">
            <p className="text-[14px] font-bold text-[#0F172A]">Contrats</p>
            {data.contrats.length === 0
              ? <EmptyState icon={FileText} text="Aucun contrat" />
              : data.contrats.map(c => (
                <div key={c.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[14px] font-bold text-[#0F172A]">{c.poste}</p>
                      <p className="text-[11px] text-[#94A3B8]">
                        {c.reference} · {c.type_contrat?.toUpperCase()}
                      </p>
                      <p className="text-[10px] text-[#94A3B8] mt-0.5">Signé le {formatDate(c.date_signature)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge
                        label={c.statut === 'signe' ? 'Signé' : c.statut === 'en_attente' ? 'En attente' : c.statut}
                        color={c.statut === 'signe' ? '#16A34A' : '#D97706'}
                        bg={c.statut === 'signe' ? '#F0FDF4' : '#FFFBEB'}
                      />
                      {c.document_url && (
                        <a href={c.document_url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-[10px] text-[#1E40AF] hover:underline">
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

        {/* DOCUMENTS */}
        {tab === 'documents' && (
          <div className="space-y-3">
            <p className="text-[14px] font-bold text-[#0F172A]">Documents partagés</p>
            {data.documents.length === 0
              ? <EmptyState icon={FolderOpen} text="Aucun document partagé" />
              : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {data.documents.map(d => (
                    <div key={d.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
                      <div className="w-10 h-10 rounded-xl bg-[#1E40AF]/10 flex items-center justify-center mb-3">
                        <FileText size={18} className="text-[#1E40AF]" />
                      </div>
                      <p className="text-[12px] font-semibold text-[#0F172A] truncate">{d.nom}</p>
                      <p className="text-[10px] text-[#94A3B8]">{d.type_document}</p>
                      {d.url_stockage && (
                        <a href={d.url_stockage} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 mt-2 text-[10px] text-[#1E40AF] hover:underline">
                          <Download size={9} />Télécharger
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

      </main>

      {/* ── Mobile bottom navigation ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] z-30">
        <div className="flex">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors relative
                ${tab === t.key ? 'text-[#1E40AF]' : 'text-[#94A3B8]'}`}>
              <t.icon size={18} />
              <span className="text-[9px] font-medium">{t.mobileLabel}</span>
              {t.key === 'candidats' && newCandidats > 0 && (
                <span className="absolute top-1 right-1/4 w-2 h-2 bg-red-500 rounded-full" />
              )}
              {t.key === 'factures' && pendingFactures > 0 && (
                <span className="absolute top-1 right-1/4 w-2 h-2 bg-red-500 rounded-full" />
              )}
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

export default function ClientPortalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8]">
        <Loader2 size={28} className="text-[#1E40AF] animate-spin" />
      </div>
    }>
      <ClientPortalContent />
    </Suspense>
  )
}
