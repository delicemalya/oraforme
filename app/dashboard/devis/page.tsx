'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Plus, Trash2, Eye, Edit3, Send,
  CheckCircle, Clock, AlertTriangle, XCircle, Search,
  Loader2, X, ArrowRight, Calendar, Copy,
  TrendingUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { calculerTVACongo, formaterMontant } from '@/lib/fiscalite-congo'

// ── Types ──────────────────────────────────────────────────────────────────────

type StatutDevis = 'brouillon' | 'envoye' | 'accepte' | 'refuse' | 'expire'

interface DevisLigne { id?: string; description: string; price: number; quantity: number; total: number }
interface Devis {
  id: string
  devis_number: string | null
  client_name: string | null
  client_nom: string | null
  client_address: string | null
  client_phone: string | null
  client_email: string | null
  date: string | null
  date_validite: string | null
  subtotal: number
  montant_ht: number
  tva: number
  ca: number
  total: number
  notes: string | null
  statut: StatutDevis
  facture_id: string | null
  remise_pct: number
  created_at: string
}
interface EntrepriseConfig {
  prefixe_facture: string
  message_defaut: string | null
  delai_paiement: number
  nom: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<StatutDevis, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  brouillon: { label: 'Brouillon', color: '#64748B', bg: '#64748B18', icon: Clock },
  envoye:    { label: 'Envoyé',    color: '#DC2626', bg: '#DC262618', icon: Send },
  accepte:   { label: 'Accepté',  color: '#16A34A', bg: '#16A34A18', icon: CheckCircle },
  refuse:    { label: 'Refusé',   color: '#DC2626', bg: '#DC262618', icon: XCircle },
  expire:    { label: 'Expiré',   color: '#9CA3AF', bg: '#9CA3AF18', icon: AlertTriangle },
}

const fmt = formaterMontant
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function emptyLigne(): DevisLigne { return { description: '', price: 0, quantity: 1, total: 0 } }
function todayIso() { return new Date().toISOString().split('T')[0] }
function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatutBadge({ statut, size = 'sm' }: { statut: StatutDevis; size?: 'sm' | 'xs' }) {
  const cfg = STATUT_CONFIG[statut] ?? STATUT_CONFIG.brouillon
  const Icon = cfg.icon
  const px = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${px}`}
      style={{ color: cfg.color, background: cfg.bg }}
    >
      <Icon size={size === 'xs' ? 9 : 11} />
      {cfg.label}
    </span>
  )
}

function KpiCard({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: React.ElementType }) {
  return (
    <motion.div
      className="rounded-xl border border-[var(--border)] p-4 flex gap-3 items-start"
      style={{ background: '#FFFFFF' }}
      whileHover={{ scale: 1.02, y: -1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}20` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-[var(--text-secondary)] mb-0.5">{label}</p>
        <p className="text-base font-bold text-[#0F172A] truncate">{value}</p>
      </div>
    </motion.div>
  )
}

function ActionBtn({ icon, title, onClick, disabled, hoverClass = 'hover:text-[#0F172A]' }: {
  icon: React.ReactNode; title: string; onClick?: () => void; disabled?: boolean; hoverClass?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded hover:bg-gray-100 text-[var(--text-secondary)] ${hoverClass} transition-colors disabled:opacity-40`}
    >
      {icon}
    </button>
  )
}

function FormInput({ label, value, onChange, placeholder, type = 'text', readOnly }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className="block text-xs text-[var(--text-secondary)] mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[#0F172A] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[#DC2626] disabled:opacity-60 read-only:opacity-70 read-only:cursor-default"
      />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DevisPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const { t } = useLocale()

  const [devis,          setDevis]          = useState<Devis[]>([])
  const [_config,        setConfig]         = useState<EntrepriseConfig>({ prefixe_facture: 'FAC', message_defaut: null, delai_paiement: 30, nom: null })
  const [loading,        setLoading]        = useState(true)
  const [filter,         setFilter]         = useState<'tous' | StatutDevis>('tous')
  const [search,         setSearch]         = useState('')
  const [toast,          setToast]          = useState('')

  // Modals
  const [showForm,       setShowForm]       = useState(false)
  const [editId,         setEditId]         = useState<string | null>(null)
  const [viewId,         setViewId]         = useState<string | null>(null)
  const [viewLignes,     setViewLignes]     = useState<DevisLigne[]>([])
  const [saving,         setSaving]         = useState(false)
  const [converting,     setConverting]     = useState<string | null>(null)
  const [confirmConvert, setConfirmConvert] = useState<Devis | null>(null)
  const [confirmDelete,  setConfirmDelete]  = useState<string | null>(null)
  const [confirmStatut,  setConfirmStatut]  = useState<{ id: string; current: StatutDevis; next: StatutDevis } | null>(null)

  // Form fields
  const [clientNom,      setClientNom]      = useState('')
  const [clientAddress,  setClientAddress]  = useState('')
  const [clientPhone,    setClientPhone]    = useState('')
  const [clientEmail,    setClientEmail]    = useState('')
  const [devisNum,       setDevisNum]       = useState('')
  const [dateVal,        setDateVal]        = useState(todayIso())
  const [dateValidite,   setDateValidite]   = useState(addDays(todayIso(), 30))
  const [notes,          setNotes]          = useState('')
  const [remisePct,      setRemisePct]      = useState(0)
  const [lignes,         setLignes]         = useState<DevisLigne[]>([emptyLigne()])

  // ── Load ─────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [{ data: devs }, { data: cfg }] = await Promise.all([
      supabase.from('devis').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200),
      supabase.from('entreprise_config').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: true }).limit(1).maybeSingle(),
    ])
    setDevis((devs ?? []) as Devis[])
    if (cfg) setConfig(cfg as EntrepriseConfig)
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  // Load lignes when view modal opens
  useEffect(() => {
    if (!viewId) { setViewLignes([]); return }
    supabase.from('devis_lignes').select('*').eq('devis_id', viewId).order('id')
      .then(({ data }) => setViewLignes((data ?? []) as DevisLigne[]))
  }, [viewId])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3500) }

  // ── Computed totals ───────────────────────────────────────────────────────────

  const subtotalBrut = lignes.reduce((s, l) => s + l.price * l.quantity, 0)
  const subtotalNet  = subtotalBrut * (1 - remisePct / 100)
  const { tva: tvaLive, ca: caLive, ttc: ttcLive } = calculerTVACongo(subtotalNet)
  const montantRemise = subtotalBrut - subtotalNet

  function updateLigne(i: number, key: keyof DevisLigne, val: string | number) {
    setLignes(prev => prev.map((l, idx) => {
      if (idx !== i) return l
      const next = { ...l, [key]: key === 'description' ? val : Number(val) }
      if (key === 'price' || key === 'quantity') next.total = next.price * next.quantity
      return next
    }))
  }

  // ── Open new form ─────────────────────────────────────────────────────────────

  async function openNew() {
    if (!tenantId) return
    const { count } = await supabase.from('devis').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const num = `DEV-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, '0')}`
    resetForm()
    setDevisNum(num)
    setEditId(null)
    setShowForm(true)
  }

  function resetForm() {
    setClientNom(''); setClientAddress(''); setClientPhone(''); setClientEmail('')
    setDevisNum('')
    const today = todayIso()
    setDateVal(today)
    setDateValidite(addDays(today, 30))
    setNotes(''); setRemisePct(0); setLignes([emptyLigne()])
  }

  // ── Open edit ────────────────────────────────────────────────────────────────

  async function openEdit(d: Devis) {
    const { data: ls } = await supabase.from('devis_lignes').select('*').eq('devis_id', d.id).order('id')
    setClientNom(d.client_name ?? d.client_nom ?? '')
    setClientAddress(d.client_address ?? '')
    setClientPhone(d.client_phone ?? '')
    setClientEmail(d.client_email ?? '')
    setDevisNum(d.devis_number ?? '')
    setDateVal(d.date ?? d.created_at.split('T')[0])
    setDateValidite(d.date_validite ?? addDays(todayIso(), 30))
    setNotes(d.notes ?? '')
    setRemisePct(d.remise_pct ?? 0)
    setLignes((ls ?? []).length > 0 ? (ls as DevisLigne[]) : [emptyLigne()])
    setEditId(d.id)
    setShowForm(true)
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function handleSave(asStatut: StatutDevis = 'brouillon') {
    if (!clientNom.trim() || !tenantId) return
    setSaving(true)

    const ht = subtotalNet
    const { tva: tvaFinal, ca: caFinal, ttc } = calculerTVACongo(ht)

    try {
      if (editId) {
        const { error: errUpd } = await supabase.from('devis').update({
          devis_number: devisNum,
          client_name: clientNom, client_nom: clientNom,
          client_address: clientAddress, client_phone: clientPhone, client_email: clientEmail,
          date: dateVal, date_validite: dateValidite || null,
          subtotal: ht, montant_ht: ht, tva: tvaFinal, tva_montant: tvaFinal, ca: caFinal, total: ttc,
          notes: notes || null, statut: asStatut, remise_pct: remisePct,
        }).eq('id', editId)
        if (errUpd) throw errUpd
        await supabase.from('devis_lignes').delete().eq('devis_id', editId)
        await supabase.from('devis_lignes').insert(
          lignes.filter(l => l.description).map(l => ({ devis_id: editId, description: l.description, price: l.price, quantity: l.quantity, total: l.total }))
        )
        showToast('Devis mis à jour !')
      } else {
        const { data: newDevis, error: errIns } = await supabase.from('devis').insert({
          tenant_id: tenantId,
          devis_number: devisNum,
          client_name: clientNom, client_nom: clientNom,
          client_address: clientAddress, client_phone: clientPhone, client_email: clientEmail,
          date: dateVal, date_validite: dateValidite || null,
          subtotal: ht, montant_ht: ht, tva: tvaFinal, tva_montant: tvaFinal, ca: caFinal, total: ttc,
          notes: notes || null, statut: asStatut, remise_pct: remisePct,
          facture_id: null,
        }).select('id').single()
        if (errIns) throw errIns
        if (newDevis?.id) {
          await supabase.from('devis_lignes').insert(
            lignes.filter(l => l.description).map(l => ({ devis_id: newDevis.id, description: l.description, price: l.price, quantity: l.quantity, total: l.total }))
          )
        }
        showToast('Devis créé !')
      }
    } catch (e: unknown) {
      alert('Erreur enregistrement devis : ' + (e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e)))
      setSaving(false)
      return
    }

    setSaving(false)
    setShowForm(false)
    resetForm()
    load()
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    const { error: errLignes } = await supabase.from('devis_lignes').delete().eq('devis_id', id)
    if (errLignes) { showToast('Erreur suppression lignes : ' + errLignes.message); return }
    const { error } = await supabase.from('devis').delete().eq('id', id)
    if (error) { showToast('Erreur suppression devis : ' + error.message); return }
    setDevis(prev => prev.filter(d => d.id !== id))
    setConfirmDelete(null)
    showToast('Devis supprimé.')
  }

  // ── Statut change ─────────────────────────────────────────────────────────────

  async function applyStatutChange() {
    if (!confirmStatut) return
    const { error } = await supabase.from('devis').update({ statut: confirmStatut.next }).eq('id', confirmStatut.id)
    if (error) { showToast('Erreur changement statut : ' + error.message); return }
    setDevis(prev => prev.map(d => d.id === confirmStatut.id ? { ...d, statut: confirmStatut.next } : d))
    showToast(`Statut → ${STATUT_CONFIG[confirmStatut.next].label}`)
    setConfirmStatut(null)
    // If viewId matches, close view modal to refresh
    if (viewId === confirmStatut.id) setViewId(null)
  }

  // ── Dupliquer ─────────────────────────────────────────────────────────────────

  async function dupliquer(d: Devis) {
    if (!tenantId) return
    const { count } = await supabase.from('devis').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const { data: newDevis } = await supabase.from('devis').insert({
      tenant_id: tenantId,
      client_name: d.client_name, client_nom: d.client_nom,
      client_address: d.client_address, client_phone: d.client_phone, client_email: d.client_email,
      devis_number: `DEV-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, '0')}`,
      date: todayIso(),
      date_validite: addDays(todayIso(), 30),
      subtotal: d.subtotal, montant_ht: d.montant_ht, tva: d.tva, ca: d.ca, total: d.total,
      notes: d.notes,
      statut: 'brouillon' as StatutDevis,
      facture_id: null,
      remise_pct: d.remise_pct ?? 0,
    }).select('id').single()

    if (newDevis?.id) {
      const { data: lignesD } = await supabase.from('devis_lignes').select('*').eq('devis_id', d.id)
      if (lignesD?.length) {
        await supabase.from('devis_lignes').insert(
          lignesD.map(l => ({ devis_id: newDevis.id, description: l.description, price: l.price, quantity: l.quantity, total: l.total }))
        )
      }
    }
    showToast('Devis dupliqué !')
    load()
  }

  // ── Convert devis → facture ───────────────────────────────────────────────────

  async function convertDevisToFacture(d: Devis) {
    if (!tenantId) return
    setConverting(d.id)
    try {
      const { count } = await supabase.from('factures').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
      const invoiceNum = `FAC-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, '0')}`

      // Colonnes de factures, pas de devis : une seule colonne par grandeur
      // (client_nom, montant_ht). tva_montant est tenue par le trigger
      // trg_sync_facture_tva_montant (migration 172).
      const { data: fac, error: errFac } = await supabase.from('factures').insert({
        tenant_id: tenantId,
        invoice_number: invoiceNum,
        client_nom: d.client_name ?? d.client_nom,
        client_address: d.client_address,
        client_phone: d.client_phone,
        client_email: d.client_email,
        date: new Date().toISOString().split('T')[0],
        due_date: d.date_validite,
        montant_ht: d.subtotal,
        tva: d.tva,
        ca: d.ca,
        total: d.total,
        notes: d.notes,
        statut: 'envoyee',
        devis_id: d.id,
        remise_pct: d.remise_pct,
      }).select('id').single()

      if (errFac || !fac?.id) throw errFac ?? new Error('Facture non créée')

      const { data: lignesD } = await supabase.from('devis_lignes').select('*').eq('devis_id', d.id)
      if (lignesD?.length) {
        const { error: errLignes } = await supabase.from('facture_lignes').insert(
          lignesD.map(l => ({ invoice_id: fac.id, description: l.description, price: l.price, quantity: l.quantity, total: l.total }))
        )
        if (errLignes) throw errLignes
      }
      await supabase.from('devis').update({ facture_id: fac.id, statut: 'accepte' }).eq('id', d.id)

      showToast('Devis converti en facture !')
      setConfirmConvert(null)
      setViewId(null)
      load()
    } finally {
      setConverting(null)
    }
  }

  // ── Filtered list + KPIs ──────────────────────────────────────────────────────

  const displayed = devis.filter(d => {
    const matchFilter = filter === 'tous' || d.statut === filter
    const name = (d.client_name ?? d.client_nom ?? '').toLowerCase()
    const num  = (d.devis_number ?? '').toLowerCase()
    const matchSearch = !search || name.includes(search.toLowerCase()) || num.includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const totalCeMois    = devis.filter(d => (d.date ?? d.created_at) >= startOfMonth).length
  const totalAcceptes  = devis.filter(d => d.statut === 'accepte').reduce((s, d) => s + (d.total ?? 0), 0)
  const nbAccepte      = devis.filter(d => d.statut === 'accepte').length
  const nbRefuse       = devis.filter(d => d.statut === 'refuse').length
  const tauxAcceptation = (nbAccepte + nbRefuse) > 0 ? Math.round(nbAccepte / (nbAccepte + nbRefuse) * 100) : 0
  const totalEnAttente = devis.filter(d => d.statut === 'envoye').length

  const viewedDevis = viewId ? devis.find(d => d.id === viewId) ?? null : null

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">
        <Loader2 className="animate-spin mr-2" size={18} /> Chargement des devis…
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
            className="fixed top-4 right-4 z-50 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm text-[#0F172A] shadow-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">{t('devis.title') ?? 'Devis & Propositions'}</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('devis.subtitle') ?? 'Gérer vos devis et convertir en factures'}</p>
        </div>
        <motion.button
          onClick={openNew}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm"
          style={{ background: '#DC2626', color: '#FFFFFF', boxShadow: '0 0 18px #DC262635' }}
        >
          <Plus size={15} /> {t('devis.new') ?? 'Nouveau devis'}
        </motion.button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label={t('devis.thisMonth') ?? 'Ce mois'}
          value={`${totalCeMois} devis`}
          color="#DC2626"
          icon={FileText}
        />
        <KpiCard
          label={t('devis.accepted') ?? 'Acceptés'}
          value={fmt(totalAcceptes)}
          color="#16A34A"
          icon={CheckCircle}
        />
        <KpiCard
          label={t('devis.acceptanceRate') ?? "Taux d'acceptation"}
          value={`${tauxAcceptation} %`}
          color="#2563EB"
          icon={TrendingUp}
        />
        <KpiCard
          label={t('devis.pending') ?? 'En attente'}
          value={`${totalEnAttente} envoyé${totalEnAttente !== 1 ? 's' : ''}`}
          color="#DC2626"
          icon={Clock}
        />
      </div>

      {/* Filters + Search */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-1 flex-wrap">
          {([
            ['tous',      'Tous'],
            ['brouillon', 'Brouillon'],
            ['envoye',    'Envoyé'],
            ['accepte',   'Accepté'],
            ['refuse',    'Refusé'],
            ['expire',    'Expiré'],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: filter === val ? '#DC2626' : 'transparent',
                color: filter === val ? '#FFFFFF' : '#64748B',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            className="pl-8 pr-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs text-[#0F172A] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[#DC2626] w-52"
            placeholder={`${t('common.search') ?? 'Rechercher'} client, N°…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Devis Table */}
      {displayed.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-secondary)]">
          <FileText size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t('devis.noDevis') ?? 'Aucun devis trouvé'}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]" style={{ background: '#F9FAFB' }}>
                  {[
                    t('devis.number') ?? 'N° Devis',
                    t('invoice.client') ?? 'Client',
                    t('common.date') ?? 'Date',
                    t('devis.validUntil') ?? 'Validité',
                    'HT',
                    'TTC',
                    t('common.status') ?? 'Statut',
                    t('common.actions') ?? 'Actions',
                  ].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((d, i) => {
                  const ht = d.subtotal ?? d.montant_ht ?? 0
                  const canConvert = d.statut === 'accepte' || d.statut === 'envoye'
                  const canDelete  = d.statut === 'brouillon'
                  return (
                    <motion.tr
                      key={d.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.25 }}
                      className="border-b border-[var(--border)] hover:bg-gray-50 transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono font-semibold text-[#DC2626]">
                          {d.devis_number ?? d.id.slice(0, 8).toUpperCase()}
                        </span>
                        {d.facture_id && (
                          <span className="block text-[10px] text-[#16A34A] font-medium mt-0.5">→ Facturé</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-[#0F172A]">{d.client_name ?? d.client_nom}</p>
                        {d.client_email && <p className="text-[10px] text-[var(--text-secondary)]">{d.client_email}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                        {fmtDate(d.date ?? d.created_at)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                        {d.date_validite ? fmtDate(d.date_validite) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{fmt(ht)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-[#DC2626]">{fmt(d.total ?? 0)}</td>
                      <td className="px-4 py-3">
                        <select
                          value={d.statut}
                          onChange={e => setConfirmStatut({ id: d.id, current: d.statut, next: e.target.value as StatutDevis })}
                          className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer rounded-full px-2 py-1 border-0"
                          style={{ color: STATUT_CONFIG[d.statut]?.color, background: STATUT_CONFIG[d.statut]?.bg }}
                        >
                          {Object.entries(STATUT_CONFIG).map(([k, v]) => (
                            <option key={k} value={k} className="bg-[var(--card-bg)] text-[#0F172A]">{v.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ActionBtn
                            title="Voir détail"
                            onClick={() => setViewId(d.id)}
                            icon={<Eye size={13} />}
                          />
                          <ActionBtn
                            title={t('common.edit')}
                            onClick={() => openEdit(d)}
                            icon={<Edit3 size={13} />}
                          />
                          <ActionBtn
                            title={t('devis.duplicate') ?? 'Dupliquer'}
                            onClick={() => dupliquer(d)}
                            icon={<Copy size={13} />}
                            hoverClass="hover:text-[#2563EB]"
                          />
                          {canConvert && !d.facture_id && (
                            <ActionBtn
                              title={t('devis.convertToInvoice') ?? 'Convertir en facture'}
                              onClick={() => setConfirmConvert(d)}
                              disabled={converting === d.id}
                              icon={converting === d.id ? <Loader2 className="animate-spin" size={13} /> : <ArrowRight size={13} />}
                              hoverClass="hover:text-[#16A34A]"
                            />
                          )}
                          {d.facture_id && (
                            <ActionBtn
                              title={t('devis.alreadyConverted') ?? 'Déjà converti en facture'}
                              disabled
                              icon={<CheckCircle size={13} />}
                              hoverClass="hover:text-[#16A34A]"
                            />
                          )}
                          {canDelete && (
                            <ActionBtn
                              title={t('common.delete')}
                              onClick={() => setConfirmDelete(d.id)}
                              icon={<Trash2 size={13} />}
                              hoverClass="hover:text-red-400"
                            />
                          )}
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
            <motion.div
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setShowForm(false); resetForm() }}
            />
            <motion.div
              className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-10"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.div
                className="relative w-full max-w-4xl bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-2xl mb-10"
                initial={{ scale: 0.96, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 20 }}
                onClick={e => e.stopPropagation()}
              >
                {/* Modal header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                  <h2 className="text-base font-bold text-[#0F172A]">
                    {editId ? 'Modifier le devis' : (t('devis.new') ?? 'Nouveau devis')}
                  </h2>
                  <button
                    onClick={() => { setShowForm(false); resetForm() }}
                    className="text-[var(--text-secondary)] hover:text-[#0F172A] transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Client + Metadata */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Client info */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                        {t('invoice.clientInfo') ?? 'Informations client'}
                      </p>
                      <FormInput
                        label={t('invoice.companyName') ?? 'Nom / Entreprise'}
                        value={clientNom}
                        onChange={setClientNom}
                        placeholder="Entreprise ABC"
                      />
                      <FormInput
                        label={t('common.address') ?? 'Adresse'}
                        value={clientAddress}
                        onChange={setClientAddress}
                        placeholder="123 Rue du Commerce, Brazzaville"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <FormInput
                          label={t('common.phone') ?? 'Téléphone'}
                          value={clientPhone}
                          onChange={setClientPhone}
                          placeholder="+242 06 000 0000"
                        />
                        <FormInput
                          label={t('common.email') ?? 'Email'}
                          value={clientEmail}
                          onChange={setClientEmail}
                          placeholder="client@mail.com"
                          type="email"
                        />
                      </div>
                    </div>

                    {/* Devis info */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                        Informations devis
                      </p>
                      <FormInput
                        label={t('devis.number') ?? 'N° Devis'}
                        value={devisNum}
                        onChange={setDevisNum}
                        placeholder="DEV-2026-0001"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <FormInput
                          label={t('common.date') ?? 'Date'}
                          value={dateVal}
                          onChange={v => { setDateVal(v); setDateValidite(addDays(v, 30)) }}
                          type="date"
                        />
                        <FormInput
                          label={t('devis.validUntil') ?? 'Valide jusqu\'au'}
                          value={dateValidite}
                          onChange={setDateValidite}
                          type="date"
                        />
                      </div>
                      {/* Remise */}
                      <div>
                        <label className="block text-xs text-[var(--text-secondary)] mb-1">
                          {t('devis.discount') ?? 'Remise'} (%)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={remisePct || ''}
                            onChange={e => setRemisePct(Math.min(100, Math.max(0, Number(e.target.value))))}
                            placeholder="0"
                            className="w-24 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:border-[#DC2626] text-right"
                          />
                          {remisePct > 0 && (
                            <span className="text-xs text-[#DC2626] font-medium">
                              − {fmt(montantRemise)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Lines */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                        {t('invoice.items') ?? 'Lignes'}
                      </p>
                      <button
                        onClick={() => setLignes(p => [...p, emptyLigne()])}
                        className="text-xs text-[#DC2626] hover:underline flex items-center gap-1"
                      >
                        <Plus size={11} /> {t('invoice.addLine') ?? 'Ajouter une ligne'}
                      </button>
                    </div>
                    <div className="grid grid-cols-12 gap-2 mb-1 px-1">
                      <span className="col-span-5 text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">{t('invoice.designation') ?? 'Désignation'}</span>
                      <span className="col-span-3 text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">{t('invoice.unitPrice') ?? 'Prix unitaire'}</span>
                      <span className="col-span-2 text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">{t('invoice.qty') ?? 'Qté'}</span>
                      <span className="col-span-1 text-[10px] text-[var(--text-secondary)] uppercase tracking-wider text-right">{t('common.total') ?? 'Total'}</span>
                      <span className="col-span-1" />
                    </div>
                    <div className="space-y-2">
                      {lignes.map((l, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                          className={`grid grid-cols-12 gap-2 items-center rounded-lg px-2 py-1.5 ${i % 2 === 0 ? 'bg-[#F9FAFB]' : 'bg-transparent'}`}
                        >
                          <div className="col-span-5">
                            <input
                              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:border-[#DC2626]"
                              placeholder={`${t('common.description') ?? 'Description'}…`}
                              value={l.description}
                              onChange={e => updateLigne(i, 'description', e.target.value)}
                            />
                          </div>
                          <div className="col-span-3">
                            <input
                              type="number"
                              min="0"
                              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:border-[#DC2626] text-right"
                              value={l.price || ''}
                              onChange={e => updateLigne(i, 'price', e.target.value)}
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              min="1"
                              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:border-[#DC2626] text-center"
                              value={l.quantity}
                              onChange={e => updateLigne(i, 'quantity', e.target.value)}
                            />
                          </div>
                          <div className="col-span-1 text-right">
                            <span className="text-xs font-semibold text-[#DC2626]">{fmt(l.price * l.quantity)}</span>
                          </div>
                          <div className="col-span-1 flex justify-center">
                            {lignes.length > 1 && (
                              <button
                                onClick={() => setLignes(p => p.filter((_, idx) => idx !== i))}
                                className="text-[var(--text-secondary)] hover:text-red-400 transition-colors p-1"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Fiscal Breakdown */}
                  <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                    <div className="px-4 py-2 border-b border-[var(--border)]" style={{ background: '#F9FAFB' }}>
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                        {t('invoice.fiscalSummary') ?? 'Récapitulatif fiscal'}
                      </span>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--text-secondary)]">Sous-total brut</span>
                        <span className="text-[#0F172A] font-medium">{fmt(subtotalBrut)}</span>
                      </div>
                      {remisePct > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-[var(--text-secondary)]">Remise {remisePct} %</span>
                          <span className="text-[#DC2626]">− {fmt(montantRemise)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--text-secondary)]">{t('invoice.subtotal') ?? 'HT net'}</span>
                        <span className="text-[#0F172A] font-medium">{fmt(subtotalNet)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--text-secondary)]">{t('invoice.tva18') ?? 'TVA 18 %'}</span>
                        <span className="text-[#0F172A]">{fmt(tvaLive)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--text-secondary)]">{t('invoice.ca5') ?? 'CA 5 %'}</span>
                        <span className="text-[#0F172A]">{fmt(caLive)}</span>
                      </div>
                      <div className="border-t border-[var(--border)] pt-3 flex justify-between">
                        <span className="text-base font-bold text-[#0F172A]">{t('invoice.totalTTC') ?? 'Total TTC'}</span>
                        <span className="text-xl font-bold text-[#DC2626]">{fmt(ttcLive)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1.5">
                      {t('invoice.notesOptional') ?? 'Notes (optionnel)'}
                    </label>
                    <textarea
                      rows={3}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#0F172A] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[#DC2626] resize-none"
                      placeholder="Conditions de validité, remarques…"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      onClick={() => { setShowForm(false); resetForm() }}
                      className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#0F172A] hover:border-[#DC2626]/40 text-sm font-medium transition-colors"
                    >
                      {t('common.cancel') ?? 'Annuler'}
                    </button>
                    <button
                      onClick={() => handleSave('brouillon')}
                      disabled={saving || !clientNom.trim()}
                      className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#0F172A] hover:border-[#DC2626]/40 text-sm font-medium transition-colors disabled:opacity-40"
                    >
                      {saving ? <Loader2 className="animate-spin inline" size={14} /> : (t('devis.saveDraft') ?? 'Enregistrer brouillon')}
                    </button>
                    <button
                      onClick={() => handleSave('envoye')}
                      disabled={saving || !clientNom.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm flex-1 justify-center disabled:opacity-40"
                      style={{ background: '#DC2626', color: '#FFFFFF' }}
                    >
                      {saving
                        ? <Loader2 className="animate-spin" size={14} />
                        : <><Send size={14} /> {t('devis.send') ?? 'Envoyer le devis'}</>
                      }
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
        {viewedDevis && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setViewId(null)}
            />
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.div
                className="relative w-full max-w-2xl max-h-[90vh] bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col"
                initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-bold text-[#0F172A]">{viewedDevis.devis_number ?? '—'}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{viewedDevis.client_name ?? viewedDevis.client_nom}</p>
                    </div>
                    <StatutBadge statut={viewedDevis.statut} size="xs" />
                    {viewedDevis.facture_id && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-[#16A34A] bg-[#16A34A18]">
                        <CheckCircle size={9} /> Facturé
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setViewId(null)}
                    className="text-[var(--text-secondary)] hover:text-[#0F172A] p-1 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Scrollable body */}
                <div className="overflow-y-auto flex-1 p-6 space-y-5">

                  {/* Client + Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                        {t('invoice.clientSection') ?? 'Client'}
                      </p>
                      <p className="font-semibold text-[#0F172A] text-sm">{viewedDevis.client_name ?? viewedDevis.client_nom}</p>
                      {viewedDevis.client_address && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{viewedDevis.client_address}</p>}
                      {viewedDevis.client_phone   && <p className="text-xs text-[var(--text-secondary)]">{viewedDevis.client_phone}</p>}
                      {viewedDevis.client_email   && <p className="text-xs text-[var(--text-secondary)]">{viewedDevis.client_email}</p>}
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                        {t('invoice.datesSection') ?? 'Dates'}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Émis le{' '}
                        <span className="text-[#0F172A]">{fmtDate(viewedDevis.date ?? viewedDevis.created_at)}</span>
                      </p>
                      {viewedDevis.date_validite && (
                        <p className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1">
                          <Calendar size={10} />
                          {t('devis.validUntil') ?? 'Valide jusqu\'au'}{' '}
                          <span className="text-[#0F172A]">{fmtDate(viewedDevis.date_validite)}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Lignes table */}
                  {viewLignes.length > 0 && (
                    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[var(--border)]" style={{ background: '#F9FAFB' }}>
                            <th className="text-left px-3 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t('invoice.designation') ?? 'Désignation'}</th>
                            <th className="text-right px-3 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t('invoice.unitPrice') ?? 'P.U.'}</th>
                            <th className="text-center px-3 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t('invoice.qty') ?? 'Qté'}</th>
                            <th className="text-right px-3 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t('common.total') ?? 'Total'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewLignes.map((l, i) => (
                            <tr
                              key={i}
                              className={`border-b border-[var(--border)] ${i === viewLignes.length - 1 ? 'border-0' : ''}`}
                              style={{ background: i % 2 === 1 ? '#F9FAFB' : 'transparent' }}
                            >
                              <td className="px-3 py-2 text-[var(--text)]">{l.description}</td>
                              <td className="px-3 py-2 text-[var(--text-secondary)] text-right">{fmt(l.price)}</td>
                              <td className="px-3 py-2 text-[var(--text-secondary)] text-center">{l.quantity}</td>
                              <td className="px-3 py-2 text-[#DC2626] font-semibold text-right">{fmt(l.price * l.quantity)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Totals */}
                  {(() => {
                    const ht = viewedDevis.subtotal ?? viewedDevis.montant_ht ?? 0
                    const remise = viewedDevis.remise_pct ?? 0
                    const { tva, ca, ttc } = calculerTVACongo(ht)
                    return (
                      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-2">
                        {remise > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-[var(--text-secondary)]">Remise {remise} %</span>
                            <span className="text-[#DC2626]">appliquée</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-[var(--text-secondary)]">HT net</span>
                          <span className="text-[#0F172A]">{fmt(ht)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[var(--text-secondary)]">{t('invoice.tva18') ?? 'TVA 18 %'}</span>
                          <span className="text-[#0F172A]">{fmt(tva)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[var(--text-secondary)]">CA 5 %</span>
                          <span className="text-[#0F172A]">{fmt(ca)}</span>
                        </div>
                        <div className="border-t border-[var(--border)] pt-2 flex justify-between">
                          <span className="font-bold text-[#0F172A]">{t('invoice.totalTTC') ?? 'Total TTC'}</span>
                          <span className="font-bold text-[#DC2626] text-lg">{fmt(viewedDevis.total ?? ttc)}</span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Statut transitions */}
                  <div>
                    <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-2">{t('common.status') ?? 'Statut'}</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(STATUT_CONFIG).map(([k, v]) => {
                        const Icon = v.icon
                        const isCurrent = k === viewedDevis.statut
                        return (
                          <button
                            key={k}
                            onClick={() => !isCurrent && setConfirmStatut({ id: viewedDevis.id, current: viewedDevis.statut, next: k as StatutDevis })}
                            disabled={isCurrent}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border"
                            style={
                              isCurrent
                                ? { color: v.color, background: v.bg, borderColor: `${v.color}40`, cursor: 'default' }
                                : { color: '#64748B', background: 'transparent', borderColor: '#E5E7EB', cursor: 'pointer' }
                            }
                          >
                            <Icon size={10} /> {v.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Notes */}
                  {viewedDevis.notes && (
                    <div className="bg-[#F9FAFB] border border-[var(--border)] rounded-xl p-4">
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Notes</p>
                      <p className="text-sm text-[var(--text)]">{viewedDevis.notes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => { setViewId(null); openEdit(viewedDevis) }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#0F172A] text-xs font-medium transition-colors"
                    >
                      <Edit3 size={13} /> {t('common.edit') ?? 'Modifier'}
                    </button>
                    <button
                      onClick={() => { dupliquer(viewedDevis); setViewId(null) }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#2563EB]/30 text-[#2563EB] text-xs font-semibold hover:bg-[#2563EB]/10 transition-colors"
                    >
                      <Copy size={13} /> {t('devis.duplicate') ?? 'Dupliquer'}
                    </button>
                    {(viewedDevis.statut === 'accepte' || viewedDevis.statut === 'envoye') && !viewedDevis.facture_id && (
                      <button
                        onClick={() => setConfirmConvert(viewedDevis)}
                        disabled={converting === viewedDevis.id}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#16A34A]/30 text-[#16A34A] text-xs font-semibold hover:bg-[#16A34A]/10 transition-colors disabled:opacity-50"
                      >
                        {converting === viewedDevis.id
                          ? <Loader2 className="animate-spin" size={13} />
                          : <><ArrowRight size={13} /> {t('devis.convertToInvoice') ?? 'Convertir en facture'}</>
                        }
                      </button>
                    )}
                    {viewedDevis.facture_id && (
                      <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#16A34A]/20 text-[#16A34A] text-xs font-medium opacity-70">
                        <CheckCircle size={13} /> {t('devis.alreadyConverted') ?? 'Déjà converti en facture'}
                      </div>
                    )}
                  </div>

                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── CONFIRM CONVERT MODAL ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmConvert && (
          <>
            <motion.div
              className="fixed inset-0 z-[60] bg-black/60"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirmConvert(null)}
            />
            <motion.div
              className="fixed inset-0 z-[60] flex items-center justify-center p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-2xl p-6"
                initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }}
                onClick={e => e.stopPropagation()}
              >
                <div className="w-10 h-10 rounded-xl bg-[#16A34A18] flex items-center justify-center mb-4">
                  <ArrowRight size={18} style={{ color: '#16A34A' }} />
                </div>
                <h3 className="text-base font-bold text-[#0F172A] mb-2">
                  {t('devis.convertToInvoice') ?? 'Convertir en facture'}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-5">
                  Le devis <span className="font-semibold text-[#0F172A]">{confirmConvert.devis_number}</span> pour{' '}
                  <span className="font-semibold text-[#0F172A]">{confirmConvert.client_name ?? confirmConvert.client_nom}</span>{' '}
                  ({fmt(confirmConvert.total ?? 0)}) sera converti en facture. Cette action est irréversible.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmConvert(null)}
                    className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#0F172A] text-sm font-medium transition-colors"
                  >
                    {t('common.cancel') ?? 'Annuler'}
                  </button>
                  <button
                    onClick={() => convertDevisToFacture(confirmConvert)}
                    disabled={converting === confirmConvert.id}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: '#16A34A' }}
                  >
                    {converting === confirmConvert.id
                      ? <Loader2 className="animate-spin" size={14} />
                      : <><ArrowRight size={14} /> Convertir</>
                    }
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── CONFIRM DELETE MODAL ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmDelete && (
          <>
            <motion.div
              className="fixed inset-0 z-[60] bg-black/60"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirmDelete(null)}
            />
            <motion.div
              className="fixed inset-0 z-[60] flex items-center justify-center p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-2xl p-6"
                initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }}
                onClick={e => e.stopPropagation()}
              >
                <div className="w-10 h-10 rounded-xl bg-[#DC262618] flex items-center justify-center mb-4">
                  <Trash2 size={18} style={{ color: '#DC2626' }} />
                </div>
                <h3 className="text-base font-bold text-[#0F172A] mb-2">Supprimer le devis</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-5">
                  Cette action est irréversible. Le devis et toutes ses lignes seront définitivement supprimés.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#0F172A] text-sm font-medium transition-colors"
                  >
                    {t('common.cancel') ?? 'Annuler'}
                  </button>
                  <button
                    onClick={() => handleDelete(confirmDelete)}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90"
                    style={{ background: '#DC2626' }}
                  >
                    {t('common.delete') ?? 'Supprimer'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── CONFIRM STATUT CHANGE ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmStatut && (
          <>
            <motion.div
              className="fixed inset-0 z-[60] bg-black/60"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirmStatut(null)}
            />
            <motion.div
              className="fixed inset-0 z-[60] flex items-center justify-center p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-2xl p-6"
                initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }}
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-base font-bold text-[#0F172A] mb-2">
                  {t('invoice.confirmChange') ?? 'Confirmer le changement'}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-5">
                  {t('invoice.changeStatus') ?? 'Changer le statut de'}{' '}
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
                    className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#0F172A] text-sm font-medium transition-colors"
                  >
                    {t('common.cancel') ?? 'Annuler'}
                  </button>
                  <button
                    onClick={applyStatutChange}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90"
                    style={{ background: STATUT_CONFIG[confirmStatut.next].color }}
                  >
                    {t('common.confirm') ?? 'Confirmer'}
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
