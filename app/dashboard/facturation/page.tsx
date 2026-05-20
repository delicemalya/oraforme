'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Plus, Trash2, Eye, Edit3, Send, Download,
  CheckCircle, Clock, AlertTriangle, XCircle, Search,
  Loader2, X, MessageCircle, Settings, ExternalLink, Mail,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { calculerTVACongo, formaterMontant, genererNumeroFacture } from '@/lib/fiscalite-congo'

// ── Types ──────────────────────────────────────────────────────────────────────

type StatutFac = 'brouillon' | 'envoyee' | 'payee' | 'retard' | 'annulee'

interface FactureLigne { id?: string; description: string; price: number; quantity: number; total: number }
interface Facture {
  id: string
  invoice_number: string | null
  client_name: string | null
  client_nom: string | null
  client_address: string | null
  client_phone: string | null
  client_email: string | null
  date: string | null
  due_date: string | null
  subtotal: number
  montant_ht: number
  tva: number
  ca: number
  total: number
  notes: string | null
  statut: StatutFac
  created_at: string
}
interface EntrepriseConfig {
  prefixe_facture: string
  message_defaut: string | null
  delai_paiement: number
  nom: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<StatutFac, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  brouillon: { label: 'Brouillon',  color: '#8B949E', bg: '#8B949E18', icon: Clock },
  envoyee:   { label: 'Envoyée',    color: '#F51E33', bg: '#F51E3318', icon: Send },
  payee:     { label: 'Payée',      color: '#142850', bg: '#14285018', icon: CheckCircle },
  retard:    { label: 'En retard',  color: '#F51E33', bg: '#F51E3318', icon: AlertTriangle },
  annulee:   { label: 'Annulée',   color: '#484F58', bg: '#48495818', icon: XCircle },
}

const fmt = formaterMontant
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function emptyLigne(): FactureLigne { return { description: '', price: 0, quantity: 1, total: 0 } }

// ── Sub-components ────────────────────────────────────────────────────────────

function StatutBadge({ statut, size = 'sm' }: { statut: StatutFac; size?: 'sm' | 'xs' }) {
  const cfg = STATUT_CONFIG[statut] ?? STATUT_CONFIG.brouillon
  const Icon = cfg.icon
  const px = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${px}`} style={{ color: cfg.color, background: cfg.bg }}>
      <Icon size={size === 'xs' ? 9 : 11} />
      {cfg.label}
    </span>
  )
}

function KpiCard({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: React.ElementType }) {
  return (
    <motion.div
      className="rounded-xl border border-white/[0.06] p-4 flex gap-3 items-start"
      style={{ background: 'rgba(255,255,255,0.025)' }}
      whileHover={{ scale: 1.02, y: -1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}20` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-[var(--text-secondary)] mb-0.5">{label}</p>
        <p className="text-base font-bold text-white truncate">{value}</p>
      </div>
    </motion.div>
  )
}

function ActionBtn({ icon, title, onClick, disabled, hoverClass = 'hover:text-white' }: {
  icon: React.ReactNode; title: string; onClick?: () => void; disabled?: boolean; hoverClass?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded hover:bg-white/[0.08] text-[var(--text-secondary)] ${hoverClass} transition-colors disabled:opacity-40`}
    >
      {icon}
    </button>
  )
}

function FormInput({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-xs text-[var(--text-secondary)] mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-[#484F58] focus:outline-none focus:border-[#F51E33]/50"
      />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FacturationPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const router = useRouter()

  const [factures,       setFactures]       = useState<Facture[]>([])
  const [config,         setConfig]         = useState<EntrepriseConfig>({ prefixe_facture: 'FAC', message_defaut: null, delai_paiement: 30, nom: null })
  const [loading,        setLoading]        = useState(true)
  const [filter,         setFilter]         = useState<'toutes' | StatutFac>('toutes')
  const [search,         setSearch]         = useState('')
  const [toast,          setToast]          = useState('')

  // Modals
  const [showForm,       setShowForm]       = useState(false)
  const [editId,         setEditId]         = useState<string | null>(null)
  const [viewId,         setViewId]         = useState<string | null>(null)
  const [viewLignes,     setViewLignes]     = useState<FactureLigne[]>([])
  const [showPdfPreview, setShowPdfPreview] = useState(false)
  const [confirmStatut,  setConfirmStatut]  = useState<{ id: string; current: StatutFac; next: StatutFac } | null>(null)
  const [saving,         setSaving]         = useState(false)
  const [dlLoading,      setDlLoading]      = useState<string | null>(null)

  // Form fields
  const [clientNom,     setClientNom]     = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientPhone,   setClientPhone]   = useState('')
  const [clientEmail,   setClientEmail]   = useState('')
  const [invoiceNum,    setInvoiceNum]    = useState('')
  const [dateVal,       setDateVal]       = useState(new Date().toISOString().split('T')[0])
  const [dueDate,       setDueDate]       = useState('')
  const [notes,         setNotes]         = useState('')
  const [statut,        setStatut]        = useState<StatutFac>('brouillon')
  const [lignes,        setLignes]        = useState<FactureLigne[]>([emptyLigne()])

  // ── Load ─────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [{ data: facs }, { data: cfg }] = await Promise.all([
      supabase.from('factures').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      supabase.from('entreprise_config').select('*').eq('tenant_id', tenantId).maybeSingle(),
    ])
    setFactures((facs ?? []) as Facture[])
    if (cfg) setConfig(cfg as EntrepriseConfig)
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  // Load lignes when view modal opens
  useEffect(() => {
    if (!viewId) { setViewLignes([]); setShowPdfPreview(false); return }
    supabase.from('facture_lignes').select('*').eq('invoice_id', viewId).order('id')
      .then(({ data }) => setViewLignes((data ?? []) as FactureLigne[]))
  }, [viewId])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // ── Open new form ─────────────────────────────────────────────────────────────

  async function openNew() {
    if (!tenantId) return
    const { count } = await supabase.from('factures').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const num = genererNumeroFacture(config.prefixe_facture ?? 'FAC', count ?? 0)
    const defaultDue = new Date(Date.now() + (config.delai_paiement ?? 30) * 86400000).toISOString().split('T')[0]
    resetForm()
    setInvoiceNum(num)
    setDueDate(defaultDue)
    setEditId(null)
    setShowForm(true)
  }

  function resetForm() {
    setClientNom(''); setClientAddress(''); setClientPhone(''); setClientEmail('')
    setInvoiceNum(''); setDateVal(new Date().toISOString().split('T')[0]); setDueDate('')
    setNotes(''); setStatut('brouillon'); setLignes([emptyLigne()])
  }

  // ── Open edit ────────────────────────────────────────────────────────────────

  async function openEdit(f: Facture) {
    const { data: ls } = await supabase.from('facture_lignes').select('*').eq('invoice_id', f.id).order('id')
    setClientNom(f.client_name ?? f.client_nom ?? '')
    setClientAddress(f.client_address ?? '')
    setClientPhone(f.client_phone ?? '')
    setClientEmail(f.client_email ?? '')
    setInvoiceNum(f.invoice_number ?? '')
    setDateVal(f.date ?? f.created_at.split('T')[0])
    setDueDate(f.due_date ?? '')
    setNotes(f.notes ?? '')
    setStatut(f.statut)
    setLignes(
      (ls ?? []).length > 0
        ? (ls as FactureLigne[])
        : (JSON.parse(JSON.stringify(f)) as { items?: { description: string; prix_unitaire: number; quantite: number }[] })
            .items?.map(it => ({ description: it.description, price: it.prix_unitaire, quantity: it.quantite, total: it.prix_unitaire * it.quantite })) ?? [emptyLigne()]
    )
    setEditId(f.id)
    setShowForm(true)
  }

  // ── Computed totals ───────────────────────────────────────────────────────────

  const subtotalLive = lignes.reduce((s, l) => s + l.price * l.quantity, 0)
  const { tva: tvaLive, ca: caLive, ttc: ttcLive } = calculerTVACongo(subtotalLive)

  function updateLigne(i: number, key: keyof FactureLigne, val: string | number) {
    setLignes(prev => prev.map((l, idx) => {
      if (idx !== i) return l
      const next = { ...l, [key]: key === 'description' ? val : Number(val) }
      if (key === 'price' || key === 'quantity') next.total = next.price * next.quantity
      return next
    }))
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function handleSave(asStatut?: StatutFac) {
    if (!clientNom.trim() || !tenantId) return
    setSaving(true)
    const finalStatut = asStatut ?? statut
    const ht = subtotalLive
    const { tva: tvaFinal, ca: caFinal, ttc } = calculerTVACongo(ht)

    if (editId) {
      await supabase.from('factures').update({
        invoice_number: invoiceNum, client_name: clientNom, client_address: clientAddress,
        client_phone: clientPhone, client_email: clientEmail,
        date: dateVal, due_date: dueDate || null,
        subtotal: ht, tva: tvaFinal, ca: caFinal, total: ttc,
        notes: notes || null, statut: finalStatut,
      }).eq('id', editId)
      await supabase.from('facture_lignes').delete().eq('invoice_id', editId)
      await supabase.from('facture_lignes').insert(lignes.filter(l => l.description).map(l => ({ invoice_id: editId, description: l.description, price: l.price, quantity: l.quantity, total: l.total })))
      showToast('Facture mise à jour !')
    } else {
      const { data: fac } = await supabase.from('factures').insert({
        tenant_id: tenantId, invoice_number: invoiceNum, client_name: clientNom,
        client_nom: clientNom, client_address: clientAddress, client_phone: clientPhone,
        client_email: clientEmail, date: dateVal, due_date: dueDate || null,
        subtotal: ht, montant_ht: ht, tva: tvaFinal, ca: caFinal, total: ttc,
        notes: notes || null, statut: finalStatut,
      }).select('id').single()
      if (fac?.id) {
        await supabase.from('facture_lignes').insert(lignes.filter(l => l.description).map(l => ({ invoice_id: fac.id, description: l.description, price: l.price, quantity: l.quantity, total: l.total })))
      }
      showToast('Facture créée !')
    }
    setSaving(false)
    setShowForm(false)
    resetForm()
    load()
  }

  // ── Delete / Statut ───────────────────────────────────────────────────────────

  async function del(id: string) {
    await supabase.from('factures').delete().eq('id', id)
    setFactures(f => f.filter(x => x.id !== id))
    showToast('Facture supprimée.')
  }

  async function updateStatut(id: string, s: StatutFac) {
    await supabase.from('factures').update({ statut: s }).eq('id', id)
    setFactures(f => f.map(x => x.id === id ? { ...x, statut: s } : x))
  }

  async function applyStatutChange() {
    if (!confirmStatut) return
    const fac = factures.find(f => f.id === confirmStatut.id)
    await updateStatut(confirmStatut.id, confirmStatut.next)
    if (confirmStatut.next === 'payee' && confirmStatut.current !== 'payee' && fac && tenantId) {
      const { count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('source', 'facture')
        .eq('source_id', confirmStatut.id)
      if ((count ?? 0) === 0) {
        const ttc = calculerTVACongo(fac.subtotal ?? fac.montant_ht ?? 0).ttc
        await supabase.from('transactions').insert({
          tenant_id:     tenantId,
          type:          'entree',
          categorie:     'Facture payée',
          description:   `Facture ${fac.invoice_number ?? fac.id.slice(0, 8)} — ${fac.client_name ?? fac.client_nom ?? ''}`,
          montant:       ttc || fac.total || 0,
          date:          new Date().toISOString().split('T')[0],
          mode_paiement: 'virement',
          source:        'facture',
          source_id:     confirmStatut.id,
        })
      }
    }
    showToast(`Statut → ${STATUT_CONFIG[confirmStatut.next].label}`)
    setConfirmStatut(null)
  }

  // ── PDF ───────────────────────────────────────────────────────────────────────

  async function downloadPDF(id: string, num: string) {
    setDlLoading(id)
    const res = await fetch(`/api/factures/${id}/pdf`)
    if (!res.ok) { showToast('Erreur PDF'); setDlLoading(null); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${num}.pdf`; a.click()
    URL.revokeObjectURL(url)
    setDlLoading(null)
  }

  // ── Send ──────────────────────────────────────────────────────────────────────

  function sendWhatsApp(f: Facture) {
    const phone = f.client_phone?.replace(/\D/g, '') ?? ''
    const num = f.invoice_number ?? f.id.slice(0, 8)
    const ttc = calculerTVACongo(f.subtotal ?? f.montant_ht ?? 0).ttc
    const msg = encodeURIComponent(`Bonjour,\n\nVeuillez trouver ci-joint la facture ${num} d'un montant de ${fmt(ttc)}.\n\nCordialement,\n${config.nom ?? 'oraforme'}`)
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
  }

  function sendEmail(f: Facture) {
    const num = f.invoice_number ?? f.id.slice(0, 8)
    const ttc = calculerTVACongo(f.subtotal ?? f.montant_ht ?? 0).ttc
    const subject = encodeURIComponent(`Facture ${num} — ${config.nom ?? 'oraforme'}`)
    const body = encodeURIComponent(`Bonjour,\n\nVeuillez trouver ci-joint la facture ${num} d'un montant de ${fmt(ttc)}.\n\nCordialement,\n${config.nom ?? 'oraforme'}`)
    window.open(`mailto:${f.client_email ?? ''}?subject=${subject}&body=${body}`, '_blank')
  }

  // ── Filtered list + KPIs ──────────────────────────────────────────────────────

  const displayed = factures.filter(f => {
    const matchFilter = filter === 'toutes' || f.statut === filter
    const name = (f.client_name ?? f.client_nom ?? '').toLowerCase()
    const num = (f.invoice_number ?? '').toLowerCase()
    const matchSearch = !search || name.includes(search.toLowerCase()) || num.includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const totalCeMois    = factures.filter(f => (f.date ?? f.created_at) >= startOfMonth).length
  const totalEncaisse  = factures.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.total ?? 0), 0)
  const totalEnAttente = factures.filter(f => f.statut === 'envoyee' || f.statut === 'brouillon').reduce((s, f) => s + (f.total ?? 0), 0)
  const totalEnRetard  = factures.filter(f => f.statut === 'retard').reduce((s, f) => s + (f.total ?? 0), 0)

  const viewedFac = viewId ? factures.find(f => f.id === viewId) ?? null : null

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">
        <Loader2 className="animate-spin mr-2" size={18} /> Chargement…
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="fixed top-4 right-4 z-50 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm text-white shadow-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Facturation</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">TVA 18 % + CA 5 % · Congo-Brazzaville</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/parametres" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-[var(--text-secondary)] hover:text-white hover:border-white/20 text-xs font-medium transition-colors">
            <Settings size={13} /> Paramètres
          </Link>
          <motion.button
            onClick={openNew}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: '#F51E33', color: '#142850', boxShadow: '0 0 18px #F51E3335' }}
          >
            <Plus size={15} /> Nouvelle facture
          </motion.button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total ce mois"   value={`${totalCeMois} facture${totalCeMois !== 1 ? 's' : ''}`} color="#F51E33"  icon={FileText} />
        <KpiCard label="Encaissé"        value={fmt(totalEncaisse)}  color="#142850"  icon={CheckCircle} />
        <KpiCard label="En attente"      value={fmt(totalEnAttente)} color="#F51E33"  icon={Clock} />
        <KpiCard label="En retard"       value={fmt(totalEnRetard)}  color="#F51E33"  icon={AlertTriangle} />
      </div>

      {/* Filters + Search */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-1 flex-wrap">
          {([
            ['toutes',    'Toutes'],
            ['brouillon', 'Brouillons'],
            ['envoyee',   'Envoyées'],
            ['payee',     'Payées'],
            ['retard',    'En retard'],
            ['annulee',   'Annulées'],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{ background: filter === val ? '#F51E33' : 'transparent', color: filter === val ? '#142850' : '#8B949E' }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            className="pl-8 pr-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white placeholder-[#484F58] focus:outline-none focus:border-[#F51E33]/50 w-52"
            placeholder="Rechercher client, N°…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Invoice Table */}
      {displayed.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-secondary)]">
          <FileText size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucune facture trouvée.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.025)' }}>
                  {['N° Facture', 'Client', 'Date', 'HT', 'TVA+CA', 'TTC', 'Statut', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((f, i) => {
                  const ht = f.subtotal ?? f.montant_ht ?? 0
                  const { tva, ca, ttc } = calculerTVACongo(ht)
                  return (
                    <motion.tr
                      key={f.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.25 }}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono font-semibold text-[#F51E33]">
                          {f.invoice_number ?? f.id.slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-white">{f.client_name ?? f.client_nom}</p>
                        {f.client_email && <p className="text-[10px] text-[var(--text-secondary)]">{f.client_email}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                        {fmtDate(f.date ?? f.created_at)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{fmt(ht)}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{fmt(tva + ca)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-[#F51E33]">{fmt(ttc)}</td>
                      <td className="px-4 py-3">
                        {/* Controlled select — triggers confirmation dialog */}
                        <select
                          value={f.statut}
                          onChange={e => setConfirmStatut({ id: f.id, current: f.statut, next: e.target.value as StatutFac })}
                          className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer rounded-full px-2 py-1 border-0"
                          style={{ color: STATUT_CONFIG[f.statut]?.color, background: STATUT_CONFIG[f.statut]?.bg }}
                        >
                          {Object.entries(STATUT_CONFIG).map(([k, v]) => (
                            <option key={k} value={k} className="bg-[var(--card-bg)] text-white">{v.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ActionBtn title="Voir détail"     onClick={() => setViewId(f.id)}                                                                       icon={<Eye size={13} />} />
                          <ActionBtn title="Aperçu plein écran" onClick={() => router.push(`/dashboard/factures/${f.id}/preview`)}                                 icon={<ExternalLink size={13} />} hoverClass="hover:text-[#F51E33]" />
                          <ActionBtn title="Modifier"        onClick={() => openEdit(f)}                                                                           icon={<Edit3 size={13} />} />
                          {f.client_phone && <ActionBtn title="WhatsApp" onClick={() => sendWhatsApp(f)}                                                           icon={<MessageCircle size={13} />} hoverClass="hover:text-[#25D366]" />}
                          {f.client_email && <ActionBtn title="Envoyer par email" onClick={() => sendEmail(f)}                                                     icon={<Mail size={13} />} hoverClass="hover:text-[#F51E33]" />}
                          <ActionBtn
                            title="Télécharger PDF"
                            onClick={() => downloadPDF(f.id, f.invoice_number ?? f.id.slice(0, 8))}
                            disabled={dlLoading === f.id}
                            icon={dlLoading === f.id ? <Loader2 className="animate-spin" size={13} /> : <Download size={13} />}
                            hoverClass="hover:text-[#F51E33]"
                          />
                          <ActionBtn title="Supprimer" onClick={() => del(f.id)} icon={<Trash2 size={13} />} hoverClass="hover:text-red-400" />
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

      {/* ── FORM MODAL ────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowForm(false)} />
            <motion.div
              className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-10"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.div
                className="relative w-full max-w-4xl bg-[var(--card-bg)] border border-white/[0.08] rounded-2xl shadow-2xl mb-10"
                initial={{ scale: 0.96, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 20 }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                  <h2 className="text-base font-bold text-white">{editId ? 'Modifier la facture' : 'Nouvelle facture'}</h2>
                  <button onClick={() => setShowForm(false)} className="text-[var(--text-secondary)] hover:text-white transition-colors"><X size={18} /></button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Client + Metadata */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Informations client</p>
                      <FormInput label="Nom / Entreprise *" value={clientNom} onChange={setClientNom} placeholder="Entreprise ABC" />
                      <FormInput label="Adresse" value={clientAddress} onChange={setClientAddress} placeholder="123 Rue du Commerce, Brazzaville" />
                      <div className="grid grid-cols-2 gap-3">
                        <FormInput label="Téléphone" value={clientPhone} onChange={setClientPhone} placeholder="+242 06 000 0000" />
                        <FormInput label="Email" value={clientEmail} onChange={setClientEmail} placeholder="client@mail.com" type="email" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Informations facture</p>
                      <FormInput label="N° Facture" value={invoiceNum} onChange={setInvoiceNum} placeholder="FAC-2025-0001" />
                      <div className="grid grid-cols-2 gap-3">
                        <FormInput label="Date" value={dateVal} onChange={setDateVal} type="date" />
                        <FormInput label="Date d'échéance" value={dueDate} onChange={setDueDate} type="date" />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-secondary)] mb-1">Statut</label>
                        <select value={statut} onChange={e => setStatut(e.target.value as StatutFac)} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#F51E33]/50">
                          {Object.entries(STATUT_CONFIG).map(([k, v]) => <option key={k} value={k} className="bg-[var(--card-bg)]">{v.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Lines */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Lignes de facture</p>
                      <button onClick={() => setLignes(p => [...p, emptyLigne()])} className="text-xs text-[#F51E33] hover:underline flex items-center gap-1">
                        <Plus size={11} /> Ajouter une ligne
                      </button>
                    </div>
                    <div className="grid grid-cols-12 gap-2 mb-1 px-1">
                      <span className="col-span-5 text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Désignation</span>
                      <span className="col-span-3 text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Prix unitaire</span>
                      <span className="col-span-2 text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Qté</span>
                      <span className="col-span-1 text-[10px] text-[var(--text-secondary)] uppercase tracking-wider text-right">Total</span>
                      <span className="col-span-1" />
                    </div>
                    <div className="space-y-2">
                      {lignes.map((l, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                          className={`grid grid-cols-12 gap-2 items-center rounded-lg px-2 py-1.5 ${i % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'}`}
                        >
                          <div className="col-span-5">
                            <input className="w-full bg-white/[0.05] border border-white/[0.06] rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#F51E33]/50" placeholder="Description du service…" value={l.description} onChange={e => updateLigne(i, 'description', e.target.value)} />
                          </div>
                          <div className="col-span-3">
                            <input type="number" min="0" className="w-full bg-white/[0.05] border border-white/[0.06] rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#F51E33]/50 text-right" value={l.price || ''} onChange={e => updateLigne(i, 'price', e.target.value)} />
                          </div>
                          <div className="col-span-2">
                            <input type="number" min="1" className="w-full bg-white/[0.05] border border-white/[0.06] rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#F51E33]/50 text-center" value={l.quantity} onChange={e => updateLigne(i, 'quantity', e.target.value)} />
                          </div>
                          <div className="col-span-1 text-right">
                            <span className="text-xs font-semibold text-[#F51E33]">{fmt(l.price * l.quantity)}</span>
                          </div>
                          <div className="col-span-1 flex justify-center">
                            {lignes.length > 1 && (
                              <button onClick={() => setLignes(p => p.filter((_, idx) => idx !== i))} className="text-[var(--text-secondary)] hover:text-red-400 transition-colors p-1">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Fiscal Breakdown */}
                  <div className="border border-white/[0.08] rounded-xl overflow-hidden">
                    <div className="px-4 py-2 border-b border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Récapitulatif fiscal · Congo-Brazzaville</span>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">Sous-total HT</span><span className="text-white font-medium">{fmt(subtotalLive)}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">TVA (18 %)</span><span className="text-white">{fmt(tvaLive)}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">CA (5 % de la TVA)</span><span className="text-white">{fmt(caLive)}</span></div>
                      <div className="border-t border-white/[0.08] pt-3 flex justify-between">
                        <span className="text-base font-bold text-white">TOTAL TTC</span>
                        <span className="text-xl font-bold text-[#F51E33]">{fmt(ttcLive)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1.5">Notes (optionnel)</label>
                    <textarea rows={3} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#484F58] focus:outline-none focus:border-[#F51E33]/50 resize-none" placeholder="Conditions de paiement, remerciements…" value={notes} onChange={e => setNotes(e.target.value)} />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl border border-white/[0.08] text-[var(--text-secondary)] hover:text-white hover:border-white/20 text-sm font-medium transition-colors">
                      Annuler
                    </button>
                    <button onClick={() => handleSave('brouillon')} disabled={saving || !clientNom} className="px-4 py-2.5 rounded-xl border border-white/[0.08] text-[var(--text-secondary)] hover:text-white hover:border-white/20 text-sm font-medium transition-colors disabled:opacity-40">
                      {saving ? <Loader2 className="animate-spin" size={14} /> : 'Enregistrer brouillon'}
                    </button>
                    <button
                      onClick={() => handleSave('envoyee')}
                      disabled={saving || !clientNom}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm flex-1 justify-center disabled:opacity-40"
                      style={{ background: '#F51E33', color: '#142850' }}
                    >
                      {saving ? <Loader2 className="animate-spin" size={14} /> : <><Send size={14} /> Émettre la facture</>}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── VIEW MODAL ────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {viewedFac && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewId(null)} />
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.div
                className="relative w-full max-w-2xl max-h-[90vh] bg-[var(--card-bg)] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col"
                initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">{viewedFac.invoice_number ?? '—'}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{viewedFac.client_name ?? viewedFac.client_nom}</p>
                    </div>
                    <StatutBadge statut={viewedFac.statut} size="xs" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/dashboard/factures/${viewedFac.id}/preview`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[var(--text-secondary)] hover:text-white text-xs font-medium transition-colors"
                    >
                      <ExternalLink size={12} /> Aperçu
                    </button>
                    <button
                      onClick={() => downloadPDF(viewedFac.id, viewedFac.invoice_number ?? viewedFac.id.slice(0, 8))}
                      disabled={dlLoading === viewedFac.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F51E33]/15 border border-[#F51E33]/30 text-[#F51E33] text-xs font-semibold hover:bg-[#F51E33]/25 transition-colors disabled:opacity-50"
                    >
                      {dlLoading === viewedFac.id ? <Loader2 className="animate-spin" size={12} /> : <Download size={12} />} PDF
                    </button>
                    <button onClick={() => setViewId(null)} className="text-[var(--text-secondary)] hover:text-white p-1 transition-colors"><X size={18} /></button>
                  </div>
                </div>

                {/* Scrollable body */}
                <div className="overflow-y-auto flex-1 p-6 space-y-5">

                  {/* Client + Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-2">Client</p>
                      <p className="font-semibold text-white text-sm">{viewedFac.client_name ?? viewedFac.client_nom}</p>
                      {viewedFac.client_address && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{viewedFac.client_address}</p>}
                      {viewedFac.client_phone   && <p className="text-xs text-[var(--text-secondary)]">{viewedFac.client_phone}</p>}
                      {viewedFac.client_email   && <p className="text-xs text-[var(--text-secondary)]">{viewedFac.client_email}</p>}
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-2">Dates</p>
                      <p className="text-xs text-[var(--text-secondary)]">Émise le <span className="text-white">{fmtDate(viewedFac.date ?? viewedFac.created_at)}</span></p>
                      {viewedFac.due_date && <p className="text-xs text-[var(--text-secondary)] mt-1">Échéance <span className="text-white">{fmtDate(viewedFac.due_date)}</span></p>}
                    </div>
                  </div>

                  {/* Lignes table */}
                  {viewLignes.length > 0 && (
                    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/[0.06]" style={{ background: 'rgba(240,163,10,0.08)' }}>
                            <th className="text-left px-3 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Désignation</th>
                            <th className="text-right px-3 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Prix U.</th>
                            <th className="text-center px-3 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Qté</th>
                            <th className="text-right px-3 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewLignes.map((l, i) => (
                            <tr
                              key={i}
                              className={`border-b border-white/[0.04] ${i === viewLignes.length - 1 ? 'border-0' : ''}`}
                              style={{ background: i % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent' }}
                            >
                              <td className="px-3 py-2 text-[#FFFFFF]">{l.description}</td>
                              <td className="px-3 py-2 text-[var(--text-secondary)] text-right">{fmt(l.price)}</td>
                              <td className="px-3 py-2 text-[var(--text-secondary)] text-center">{l.quantity}</td>
                              <td className="px-3 py-2 text-[#F51E33] font-semibold text-right">{fmt(l.price * l.quantity)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Totals */}
                  {(() => {
                    const ht = viewedFac.subtotal ?? viewedFac.montant_ht ?? 0
                    const { tva, ca, ttc } = calculerTVACongo(ht)
                    return (
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-2">
                        <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">Sous-total HT</span><span className="text-white">{fmt(ht)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">TVA 18 %</span><span className="text-white">{fmt(tva)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">CA 5 %</span><span className="text-white">{fmt(ca)}</span></div>
                        <div className="border-t border-white/[0.08] pt-2 flex justify-between">
                          <span className="font-bold text-white">TOTAL TTC</span>
                          <span className="font-bold text-[#F51E33] text-lg">{fmt(ttc)}</span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Changer statut */}
                  <div>
                    <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-2">Changer le statut</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(STATUT_CONFIG).map(([k, v]) => {
                        const Icon = v.icon
                        const isCurrent = k === viewedFac.statut
                        return (
                          <button
                            key={k}
                            onClick={() => !isCurrent && setConfirmStatut({ id: viewedFac.id, current: viewedFac.statut, next: k as StatutFac })}
                            disabled={isCurrent}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border"
                            style={
                              isCurrent
                                ? { color: v.color, background: v.bg, borderColor: `${v.color}40`, cursor: 'default' }
                                : { color: '#8B949E', background: 'transparent', borderColor: 'rgba(255,255,255,0.08)', cursor: 'pointer' }
                            }
                          >
                            <Icon size={10} /> {v.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* PDF Preview toggle */}
                  <div>
                    <button
                      onClick={() => setShowPdfPreview(p => !p)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/[0.08] text-[var(--text-secondary)] hover:text-white hover:border-white/[0.16] text-sm font-medium transition-colors"
                    >
                      <span className="flex items-center gap-2"><FileText size={14} /> {showPdfPreview ? 'Masquer' : 'Afficher'} l&apos;aperçu PDF</span>
                      <span>{showPdfPreview ? '▲' : '▼'}</span>
                    </button>
                    <AnimatePresence>
                      {showPdfPreview && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 500 }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden rounded-b-xl border-x border-b border-white/[0.08]"
                        >
                          <iframe
                            src={`/api/factures/${viewedFac.id}/pdf`}
                            className="w-full h-[500px] bg-white"
                            title={`Aperçu ${viewedFac.invoice_number}`}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Notes */}
                  {viewedFac.notes && (
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Notes</p>
                      <p className="text-sm text-[#FFFFFF]">{viewedFac.notes}</p>
                    </div>
                  )}

                  {/* Send actions */}
                  <div className="flex gap-2">
                    {viewedFac.client_phone && (
                      <button
                        onClick={() => sendWhatsApp(viewedFac)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#25D366]/30 text-[#25D366] text-xs font-semibold hover:bg-[#25D366]/10 transition-colors"
                      >
                        <MessageCircle size={13} /> WhatsApp
                      </button>
                    )}
                    {viewedFac.client_email && (
                      <button
                        onClick={() => sendEmail(viewedFac)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#F51E33]/30 text-[#F51E33] text-xs font-semibold hover:bg-[#F51E33]/10 transition-colors"
                      >
                        <Mail size={13} /> Email
                      </button>
                    )}
                    <button
                      onClick={() => { setViewId(null); openEdit(viewedFac) }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.08] text-[var(--text-secondary)] hover:text-white text-xs font-medium transition-colors"
                    >
                      <Edit3 size={13} /> Modifier
                    </button>
                  </div>

                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── CONFIRMATION STATUT ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmStatut && (
          <>
            <motion.div className="fixed inset-0 z-[60] bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmStatut(null)} />
            <motion.div
              className="fixed inset-0 z-[60] flex items-center justify-center p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-sm bg-[var(--card-bg)] border border-white/[0.08] rounded-2xl shadow-2xl p-6"
                initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }}
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-base font-bold text-white mb-2">Confirmer le changement ?</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-5">
                  Passer de{' '}
                  <span className="font-semibold" style={{ color: STATUT_CONFIG[confirmStatut.current].color }}>
                    {STATUT_CONFIG[confirmStatut.current].label}
                  </span>
                  {' '}→{' '}
                  <span className="font-semibold" style={{ color: STATUT_CONFIG[confirmStatut.next].color }}>
                    {STATUT_CONFIG[confirmStatut.next].label}
                  </span>
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmStatut(null)}
                    className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-[var(--text-secondary)] hover:text-white text-sm font-medium transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={applyStatutChange}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90"
                    style={{ background: STATUT_CONFIG[confirmStatut.next].color }}
                  >
                    Confirmer
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  )
}
