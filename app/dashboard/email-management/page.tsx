'use client'

import { useState } from 'react'
import {
  Mail, Inbox, Send, Star, Trash2, Search, Plus, RefreshCw,
  Paperclip, ChevronDown, Settings, Users, MailOpen,
  ArrowLeft, Check, X, AlertCircle, ExternalLink, Download,
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailAccount {
  id:       string
  email:    string
  nom:      string
  provider: 'gmail' | 'outlook' | 'yahoo' | 'custom'
  active:   boolean
  unread:   number
}

interface EmailMessage {
  id:        string
  from:      string
  fromName:  string
  to:        string
  subject:   string
  body:      string
  date:      string
  read:      boolean
  starred:   boolean
  hasAttach: boolean
  folder:    'inbox' | 'sent' | 'drafts' | 'trash'
  accountId: string
}

// ─── Données demo ──────────────────────────────────────────────────────────────

const DEMO_ACCOUNTS: EmailAccount[] = [
  { id: 'a1', email: 'direction@monentreprise.com', nom: 'Direction',       provider: 'custom',  active: true,  unread: 5  },
  { id: 'a2', email: 'commercial@monentreprise.com', nom: 'Commercial',     provider: 'gmail',   active: true,  unread: 12 },
  { id: 'a3', email: 'rh@monentreprise.com',         nom: 'RH',             provider: 'outlook', active: false, unread: 0  },
]

const DEMO_EMAILS: EmailMessage[] = [
  {
    id: 'e1', from: 'client@acme.com', fromName: 'Jean Mbata',
    to: 'commercial@monentreprise.com', subject: 'Demande de devis — Fournitures bureau',
    body: `Bonjour,\n\nJe vous contacte pour obtenir un devis concernant des fournitures de bureau pour notre équipe de 50 personnes.\n\nNous recherchons :\n- Tables de réunion (x2)\n- Chaises ergonomiques (x50)\n- Étagères de rangement (x10)\n\nMerci de me faire parvenir votre meilleure offre.\n\nCordialement,\nJean Mbata\nDirecteur Général — ACME SA`,
    date: '2026-06-19T09:30:00Z', read: false, starred: true,  hasAttach: false, folder: 'inbox', accountId: 'a2',
  },
  {
    id: 'e2', from: 'banque@ecobank.com', fromName: 'Ecobank Congo',
    to: 'direction@monentreprise.com', subject: 'Relevé de compte — Juin 2026',
    body: `Madame, Monsieur,\n\nVeuillez trouver ci-joint votre relevé de compte pour le mois de juin 2026.\n\nSolde au 19/06/2026 : 4 850 000 FCFA\n\nPour toute question, contactez votre agence.\n\nEcobank Congo — Service Client`,
    date: '2026-06-19T08:00:00Z', read: false, starred: false, hasAttach: true,  folder: 'inbox', accountId: 'a1',
  },
  {
    id: 'e3', from: 'fournisseur@sodexo.cg', fromName: 'SODEXO Fournisseur',
    to: 'commercial@monentreprise.com', subject: 'Confirmation livraison #LIV-2026-0441',
    body: `Bonjour,\n\nNous confirmons la livraison de votre commande #LIV-2026-0441 pour le 20/06/2026 entre 9h et 12h.\n\nMontant de la livraison : 1 250 000 FCFA\n\nMerci de préparer la réception.\n\nCordialement,\nService Logistique SODEXO`,
    date: '2026-06-18T16:45:00Z', read: true,  starred: false, hasAttach: false, folder: 'inbox', accountId: 'a2',
  },
  {
    id: 'e4', from: 'impots@finances.gouv.cg', fromName: 'DGI Congo',
    to: 'direction@monentreprise.com', subject: 'Rappel déclaration TVA — Mai 2026',
    body: `Madame, Monsieur le Chef d'Entreprise,\n\nNous vous rappelons que la déclaration et le paiement de la TVA pour le mois de mai 2026 est attendu avant le 30 juin 2026.\n\nMontant estimé selon vos déclarations précédentes : 320 000 FCFA\n\nDirection Générale des Impôts`,
    date: '2026-06-18T11:00:00Z', read: true,  starred: true,  hasAttach: false, folder: 'inbox', accountId: 'a1',
  },
  {
    id: 'e5', from: 'direction@monentreprise.com', fromName: 'Moi',
    to: 'client@acme.com', subject: 'RE: Devis Fournitures — Ref DEVIS-2026-089',
    body: `Bonjour M. Mbata,\n\nVeuillez trouver en pièce jointe notre devis N° DEVIS-2026-089 pour les fournitures de bureau.\n\nTotal HT : 4 500 000 FCFA\nTVA 18% : 810 000 FCFA\nTotal TTC : 5 310 000 FCFA\n\nValidité : 30 jours\n\nCordialement,\nDirection Commerciale`,
    date: '2026-06-17T14:20:00Z', read: true,  starred: false, hasAttach: true,  folder: 'sent', accountId: 'a1',
  },
]

const PROVIDER_CONFIG = {
  gmail:   { label: 'Gmail',         color: '#EA4335', icon: '✉️', server: 'imap.gmail.com'   },
  outlook: { label: 'Outlook',       color: '#0078D4', icon: '📧', server: 'outlook.office365.com' },
  yahoo:   { label: 'Yahoo Mail',    color: '#6001D2', icon: '📬', server: 'imap.mail.yahoo.com'   },
  custom:  { label: 'Serveur SMTP',  color: '#374151', icon: '🖥️', server: 'Personnalisé'     },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmailManagementPage() {
  const [selectedAccount, setSelectedAccount] = useState<string | 'all'>('all')
  const [activeFolder,    setActiveFolder]    = useState<'inbox' | 'sent' | 'drafts' | 'trash'>('inbox')
  const [selectedEmail,   setSelectedEmail]   = useState<EmailMessage | null>(null)
  const [search,          setSearch]          = useState('')
  const [showCompose,     setShowCompose]      = useState(false)
  const [showConnect,     setShowConnect]      = useState(false)
  const [emails,          setEmails]           = useState(DEMO_EMAILS)

  const [compose, setCompose] = useState({ to: '', subject: '', body: '', from: DEMO_ACCOUNTS[0].email })

  // ── Filtrage emails ────────────────────────────────────────────────────────

  const filtered = emails.filter((e) => {
    if (selectedAccount !== 'all' && e.accountId !== selectedAccount) return false
    if (e.folder !== activeFolder) return false
    if (search && !e.subject.toLowerCase().includes(search.toLowerCase()) &&
        !e.fromName.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const unreadCount = emails.filter((e) => !e.read && e.folder === 'inbox').length

  function markRead(id: string) {
    setEmails((prev) => prev.map((e) => e.id === id ? { ...e, read: true } : e))
  }

  function toggleStar(id: string) {
    setEmails((prev) => prev.map((e) => e.id === id ? { ...e, starred: !e.starred } : e))
  }

  function openEmail(email: EmailMessage) {
    markRead(email.id)
    setSelectedEmail(email)
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 86400000) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    if (diff < 604800000) return d.toLocaleDateString('fr-FR', { weekday: 'short' })
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  }

  const FOLDERS = [
    { id: 'inbox' as const,  label: 'Boîte de réception', icon: Inbox,   badge: unreadCount },
    { id: 'sent' as const,   label: 'Envoyés',             icon: Send,    badge: 0 },
    { id: 'drafts' as const, label: 'Brouillons',          icon: Mail,    badge: 0 },
    { id: 'trash' as const,  label: 'Corbeille',           icon: Trash2,  badge: 0 },
  ]

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-56 shrink-0 border-r border-[#E8ECF0] bg-white flex flex-col overflow-y-auto">

        {/* Composer */}
        <div className="p-3 border-b border-[#F1F5F9]">
          <button
            onClick={() => setShowCompose(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #DC2626, #B91C1C)' }}
          >
            <Plus size={15} /> Nouveau message
          </button>
        </div>

        {/* Dossiers */}
        <div className="p-2">
          <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider px-2 mb-1">Dossiers</p>
          {FOLDERS.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => { setActiveFolder(id); setSelectedEmail(null) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeFolder === id
                  ? 'bg-[#FEF2F2] text-[#DC2626] font-semibold'
                  : 'text-[#374151] hover:bg-[#F8FAFC]'
              }`}
            >
              <Icon size={14} />
              <span className="flex-1 text-left">{label}</span>
              {badge > 0 && (
                <span className="text-[10px] font-bold bg-[#DC2626] text-white rounded-full w-5 h-5 flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => setActiveFolder('inbox')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-[#374151] hover:bg-[#F8FAFC] transition-colors"
          >
            <Star size={14} className="text-amber-400" />
            <span>Suivis</span>
          </button>
        </div>

        {/* Comptes */}
        <div className="p-2 mt-2">
          <div className="flex items-center justify-between px-2 mb-1">
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Comptes</p>
            <button
              onClick={() => setShowConnect(true)}
              className="text-[10px] font-bold text-[#DC2626] hover:underline"
            >
              + Ajouter
            </button>
          </div>

          <button
            onClick={() => setSelectedAccount('all')}
            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              selectedAccount === 'all' ? 'bg-[#F1F5F9] text-[#0F172A]' : 'text-[#64748B] hover:bg-[#F8FAFC]'
            }`}
          >
            <Users size={12} /> Tous les comptes
          </button>

          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.id}
              onClick={() => setSelectedAccount(acc.id)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-colors ${
                selectedAccount === acc.id ? 'bg-[#F1F5F9] text-[#0F172A] font-semibold' : 'text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: acc.active ? '#16A34A' : '#94A3B8' }}
              />
              <div className="flex-1 min-w-0 text-left">
                <p className="truncate font-medium">{acc.nom}</p>
                <p className="truncate text-[10px] text-[#94A3B8]">{acc.email}</p>
              </div>
              {acc.unread > 0 && (
                <span className="text-[9px] font-bold bg-[#EFF6FF] text-[#2563EB] rounded-full px-1.5 py-0.5">
                  {acc.unread}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Settings link */}
        <div className="mt-auto p-3 border-t border-[#F1F5F9]">
          <button
            onClick={() => setShowConnect(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
          >
            <Settings size={13} /> Gérer les comptes
          </button>
        </div>
      </aside>

      {/* ── Liste des emails ── */}
      <div className={`${selectedEmail ? 'hidden md:flex' : 'flex'} flex-col w-72 shrink-0 border-r border-[#E8ECF0] bg-[#FAFBFC]`}>

        {/* Toolbar */}
        <div className="p-3 border-b border-[#E8ECF0] flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-white border border-[#E8ECF0] rounded-xl px-2.5 py-1.5">
            <Search size={12} className="text-[#94A3B8] shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="flex-1 text-xs bg-transparent outline-none text-[#0F172A] placeholder-[#9CA3AF]"
            />
          </div>
          <button
            onClick={() => {}}
            title="Actualiser"
            className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-[#E8ECF0] transition-all text-[#64748B]"
          >
            <RefreshCw size={13} />
          </button>
        </div>

        {/* Folder title */}
        <div className="px-4 py-2 flex items-center justify-between">
          <h2 className="text-[13px] font-bold text-[#0F172A]">
            {FOLDERS.find((f) => f.id === activeFolder)?.label}
          </h2>
          <span className="text-[11px] text-[#94A3B8]">{filtered.length} messages</span>
        </div>

        {/* Emails list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-[#94A3B8]">
              <Inbox size={28} className="mb-2 opacity-30" />
              <p className="text-xs">Aucun message</p>
            </div>
          ) : (
            filtered.map((email) => (
              <button
                key={email.id}
                onClick={() => openEmail(email)}
                className={`w-full text-left px-4 py-3 border-b border-[#F1F5F9] transition-colors ${
                  selectedEmail?.id === email.id
                    ? 'bg-[#FEF2F2]'
                    : email.read ? 'bg-white hover:bg-[#F8FAFC]' : 'bg-[#FFFBEB] hover:bg-[#FEF9EC]'
                }`}
              >
                <div className="flex items-start gap-2">
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                    style={{ background: email.read ? '#94A3B8' : '#DC2626' }}
                  >
                    {email.fromName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={`text-xs truncate ${email.read ? 'text-[#374151]' : 'font-bold text-[#0F172A]'}`}>
                        {email.folder === 'sent' ? email.to : email.fromName}
                      </p>
                      <span className="text-[10px] text-[#94A3B8] shrink-0 ml-1">{formatDate(email.date)}</span>
                    </div>
                    <p className={`text-[12px] truncate ${email.read ? 'text-[#64748B]' : 'font-semibold text-[#0F172A]'}`}>
                      {email.subject}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {!email.read && <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] shrink-0" />}
                      {email.starred && <Star size={10} className="text-amber-400 fill-amber-400" />}
                      {email.hasAttach && <Paperclip size={10} className="text-[#94A3B8]" />}
                      <span className="text-[10px] text-[#94A3B8] truncate">
                        {email.body.substring(0, 50)}...
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Lecture email ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {selectedEmail ? (
          <>
            {/* Toolbar */}
            <div className="px-6 py-3 border-b border-[#E8ECF0] flex items-center gap-3">
              <button
                onClick={() => setSelectedEmail(null)}
                className="md:hidden p-1.5 rounded-lg hover:bg-[#F8FAFC] text-[#64748B]"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => toggleStar(selectedEmail.id)}
                  className={`p-1.5 rounded-lg hover:bg-[#F8FAFC] transition-colors ${selectedEmail.starred ? 'text-amber-400' : 'text-[#94A3B8]'}`}
                >
                  <Star size={16} className={selectedEmail.starred ? 'fill-amber-400' : ''} />
                </button>
                <button
                  onClick={() => setShowCompose(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-[#DC2626] hover:bg-[#B91C1C] transition-colors"
                >
                  <Send size={12} /> Répondre
                </button>
                <button className="p-1.5 rounded-lg hover:bg-[#F8FAFC] text-[#64748B] transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Email content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <h1 className="text-[20px] font-extrabold text-[#0F172A] mb-4">{selectedEmail.subject}</h1>

              {/* From / To */}
              <div className="flex items-start gap-3 mb-5 pb-5 border-b border-[#F1F5F9]">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[14px] font-bold shrink-0"
                  style={{ background: 'linear-gradient(135deg, #DC2626, #B91C1C)' }}
                >
                  {selectedEmail.fromName.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#0F172A]">{selectedEmail.fromName}</p>
                    <span className="text-xs text-[#94A3B8]">
                      {new Date(selectedEmail.date).toLocaleString('fr-FR', {
                        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B]">De : {selectedEmail.from}</p>
                  <p className="text-xs text-[#64748B]">À : {selectedEmail.to}</p>
                </div>
              </div>

              {/* Body */}
              <div className="text-[14px] text-[#374151] leading-relaxed whitespace-pre-wrap">
                {selectedEmail.body}
              </div>

              {/* Attachments */}
              {selectedEmail.hasAttach && (
                <div className="mt-6 p-4 bg-[#F8FAFC] rounded-2xl border border-[#E8ECF0]">
                  <p className="text-xs font-bold text-[#64748B] mb-3 uppercase tracking-wide">Pièces jointes</p>
                  <div className="flex flex-wrap gap-2">
                    {['Relevé_Juin_2026.pdf', 'DEVIS-2026-089.pdf'].slice(0, selectedEmail.id === 'e2' ? 1 : 2).map((file) => (
                      <div key={file} className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-[#E8ECF0] text-xs">
                        <Paperclip size={12} className="text-[#64748B]" />
                        <span className="font-medium text-[#374151]">{file}</span>
                        <button className="text-[#2563EB] hover:text-[#1D4ED8]">
                          <Download size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[#94A3B8]">
            <MailOpen size={48} className="mb-3 opacity-20" />
            <p className="text-sm font-medium">Sélectionnez un email à lire</p>
            <p className="text-xs mt-1">{filtered.length} messages dans {FOLDERS.find((f) => f.id === activeFolder)?.label.toLowerCase()}</p>
          </div>
        )}
      </div>

      {/* ── Modal Composer ── */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E8ECF0]"
              style={{ background: 'linear-gradient(135deg, #DC2626, #B91C1C)' }}>
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <Mail size={15} /> Nouveau message
              </span>
              <button onClick={() => setShowCompose(false)} className="text-white/70 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {/* De */}
              <div className="flex items-center gap-3 border-b border-[#F1F5F9] pb-3">
                <span className="text-[11px] font-bold text-[#94A3B8] w-14">DE</span>
                <select
                  value={compose.from}
                  onChange={(e) => setCompose((c) => ({ ...c, from: e.target.value }))}
                  className="flex-1 text-sm text-[#374151] outline-none bg-transparent"
                >
                  {DEMO_ACCOUNTS.filter((a) => a.active).map((a) => (
                    <option key={a.id} value={a.email}>{a.nom} — {a.email}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="text-[#94A3B8]" />
              </div>

              {/* À */}
              <div className="flex items-center gap-3 border-b border-[#F1F5F9] pb-3">
                <span className="text-[11px] font-bold text-[#94A3B8] w-14">À</span>
                <input
                  value={compose.to}
                  onChange={(e) => setCompose((c) => ({ ...c, to: e.target.value }))}
                  placeholder="destinataire@exemple.com"
                  className="flex-1 text-sm text-[#0F172A] outline-none placeholder-[#9CA3AF]"
                />
              </div>

              {/* Objet */}
              <div className="flex items-center gap-3 border-b border-[#F1F5F9] pb-3">
                <span className="text-[11px] font-bold text-[#94A3B8] w-14">OBJET</span>
                <input
                  value={compose.subject}
                  onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
                  placeholder="Objet du message"
                  className="flex-1 text-sm text-[#0F172A] outline-none placeholder-[#9CA3AF]"
                />
              </div>

              {/* Corps */}
              <textarea
                value={compose.body}
                onChange={(e) => setCompose((c) => ({ ...c, body: e.target.value }))}
                placeholder="Rédigez votre message..."
                rows={8}
                className="w-full text-sm text-[#374151] outline-none resize-none placeholder-[#9CA3AF] leading-relaxed"
              />
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[#E8ECF0] flex items-center gap-3">
              <button className="p-2 text-[#64748B] hover:text-[#374151] transition-colors" title="Pièce jointe">
                <Paperclip size={16} />
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setShowCompose(false)}
                className="px-4 py-2 rounded-xl border border-[#E8ECF0] text-sm text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
              >
                Annuler
              </button>
              <button
                disabled={!compose.to.trim() || !compose.subject.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                style={{ background: '#DC2626' }}
                onClick={() => {
                  setShowCompose(false)
                  setCompose({ to: '', subject: '', body: '', from: DEMO_ACCOUNTS[0].email })
                }}
              >
                <Send size={14} /> Envoyer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Connecter un compte ── */}
      {showConnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E8ECF0] flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-[#0F172A]">Connecter un compte email</h2>
              <button onClick={() => setShowConnect(false)} className="p-1 hover:bg-[#F8FAFC] rounded-lg">
                <X size={16} className="text-[#94A3B8]" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-[#64748B] mb-5">
                Connectez vos comptes email professionnels pour gérer tous vos messages depuis Oraforme.
              </p>

              <div className="space-y-3">
                {Object.entries(PROVIDER_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-[#E8ECF0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC] transition-all text-left"
                  >
                    <span className="text-2xl">{cfg.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-[#0F172A]">{cfg.label}</p>
                      <p className="text-xs text-[#94A3B8]">{cfg.server}</p>
                    </div>
                    <ExternalLink size={14} className="text-[#94A3B8]" />
                  </button>
                ))}
              </div>

              <div className="mt-5 p-4 bg-[#FFF7ED] rounded-xl border border-[#FED7AA] flex gap-3">
                <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  La connexion OAuth sécurisée sera disponible dans la prochaine mise à jour.
                  Contactez le support pour une configuration manuelle IMAP/SMTP.
                </p>
              </div>
            </div>

            {/* Comptes actifs */}
            <div className="px-6 pb-5">
              <p className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide mb-3">Comptes connectés</p>
              <div className="space-y-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <div key={acc.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E8ECF0]">
                    <div className="w-2 h-2 rounded-full" style={{ background: acc.active ? '#16A34A' : '#94A3B8' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#374151] truncate">{acc.nom}</p>
                      <p className="text-[10px] text-[#94A3B8] truncate">{acc.email}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      acc.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {acc.active ? 'Actif' : 'Inactif'}
                    </span>
                    {acc.active && <Check size={12} className="text-green-500" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
