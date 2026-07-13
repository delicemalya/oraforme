'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Plus, Trash2, Eye, Edit3, Send, Download,
  CheckCircle, Clock, AlertTriangle, XCircle, Search,
  Loader2, X, MessageCircle, Settings, ExternalLink, Mail,
  DollarSign, RotateCcw, BarChart2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { captureSupabaseError } from '@/lib/monitoring'
import { usePays } from '@/lib/contexts/PaysContext'

// ── Types ──────────────────────────────────────────────────────────────────────

type StatutFac = 'brouillon' | 'envoyee' | 'payee' | 'partiellement_payee' | 'retard' | 'annulee'

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
  type: 'facture' | 'proforma' | 'avoir' | 'recurrente'
  facture_ref_id: string | null
  remise_pct: number
  montant_paye: number
  moyen_paiement: string | null
  devis_id: string | null
}
interface EntrepriseConfig {
  prefixe_facture: string
  message_defaut: string | null
  delai_paiement: number
  nom: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<StatutFac, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  brouillon:          { label: 'Brouillon',  color: '#64748B', bg: '#64748B18', icon: Clock },
  envoyee:            { label: 'Envoyée',    color: '#DC2626', bg: '#DC262618', icon: Send },
  payee:              { label: 'Payée',      color: '#0F172A', bg: '#0F172A18', icon: CheckCircle },
  partiellement_payee: { label: 'Partiel',  color: '#F59E0B', bg: '#F59E0B18', icon: Clock },
  retard:             { label: 'En retard',  color: '#DC2626', bg: '#DC262618', icon: AlertTriangle },
  annulee:            { label: 'Annulée',   color: '#64748B', bg: '#48495818', icon: XCircle },
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function emptyLigne(): FactureLigne { return { description: '', price: 0, quantity: 1, total: 0 } }

// ── Sub-components ────────────────────────────────────────────────────────────

function sKey(s: StatutFac | string) {
  return s === 'partiellement_payee' ? 'fact.status.partiel' : `fact.status.${s}`
}

function StatutBadge({ statut, size = 'sm' }: { statut: StatutFac; size?: 'sm' | 'xs' }) {
  const cfg = STATUT_CONFIG[statut] ?? STATUT_CONFIG.brouillon
  const { t } = useLocale()
  const Icon = cfg.icon
  const px = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${px}`} style={{ color: cfg.color, background: cfg.bg }}>
      <Icon size={size === 'xs' ? 9 : 11} />
      {t(sKey(statut))}
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
        <p className="text-base font-bold text-[#101729] truncate">{value}</p>
      </div>
    </motion.div>
  )
}

function ActionBtn({ icon, title, onClick, disabled, hoverClass = 'hover:text-[#101729]' }: {
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
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[#101729] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[#00b9a7]"
      />
    </div>
  )
}

// ── PaymentModal ──────────────────────────────────────────────────────────────

function PaymentModal({ facture, onClose, onPaid, tenantId }: {
  facture: Facture
  onClose: () => void
  onPaid: () => void
  tenantId: string
}) {
  const { t } = useLocale()
  const { formaterMontant: fmt } = usePays()
  const resteARegler = facture.total - (facture.montant_paye ?? 0)
  const [montant, setMontant] = useState(resteARegler)
  const [mode, setMode] = useState<string>('especes')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [payError, setPayError] = useState('')

  const modes = [
    { value: 'especes',      label: 'Espèces' },
    { value: 'banque',       label: 'Banque' },
    { value: 'mobile_money', label: 'Mobile Money' },
    { value: 'carte',        label: 'Carte' },
    { value: 'virement',     label: 'Virement' },
    { value: 'cheque',       label: 'Chèque' },
  ]

  const isPTotal = montant >= resteARegler

  async function handlePay() {
    if (!montant || montant <= 0) return
    setSaving(true)
    setPayError('')
    const { error } = await supabase.from('paiements_factures').insert({
      tenant_id: tenantId,
      facture_id: facture.id,
      montant: Math.min(montant, resteARegler),
      mode_paiement: mode,
      date,
      reference: reference || null,
    })
    setSaving(false)
    if (error) { setPayError(error.message); return }
    onPaid()
    onClose()
  }

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <motion.div
          className="relative w-full max-w-md bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-2xl"
          initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
            <div>
              <h3 className="text-base font-bold text-[#101729]">Encaisser un paiement</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Reste à régler : <span className="font-semibold text-[#DC2626]">{fmt(resteARegler)}</span>
              </p>
            </div>
            <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[#101729] transition-colors"><X size={18} /></button>
          </div>

          <div className="p-6 space-y-4">
            {/* Mode paiement */}
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Mode de paiement</label>
              <select
                value={mode}
                onChange={e => setMode(e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[#101729] focus:outline-none focus:border-[#00b9a7]"
              >
                {modes.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            {/* Montant */}
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('common.amount')}</label>
              <input
                type="number"
                min={0}
                max={resteARegler}
                value={montant || ''}
                onChange={e => setMontant(Math.min(Number(e.target.value), resteARegler))}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[#101729] focus:outline-none focus:border-[#00b9a7] text-right"
              />
              <div className="mt-1.5 flex justify-end">
                {isPTotal
                  ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#16A34A18', color: '#16A34A' }}>Paiement total</span>
                  : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#F59E0B18', color: '#F59E0B' }}>Paiement partiel</span>
                }
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('common.date')}</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[#101729] focus:outline-none focus:border-[#00b9a7]"
              />
            </div>

            {/* Référence optionnelle */}
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Référence (optionnel)</label>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="N° chèque, reçu mobile money…"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[#101729] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[#00b9a7]"
              />
            </div>

            {payError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{payError}</p>
            )}
            {/* Boutons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729] text-sm font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handlePay}
                disabled={saving || !montant || montant <= 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-40 transition-opacity hover:opacity-90"
                style={{ background: '#16A34A' }}
              >
                {saving ? <Loader2 className="animate-spin" size={14} /> : <><DollarSign size={14} /> Enregistrer</>}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FacturationPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const { t } = useLocale()
  const { calculerTVA, formaterMontant: fmt, paysFiscal, paysGeo } = usePays()
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
  const [paymentFac,     setPaymentFac]     = useState<Facture | null>(null)

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
    const [{ data: facs, error: facErr }, { data: cfg, error: cfgErr }] = await Promise.all([
      supabase.from('factures').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200),
      supabase.from('entreprise_config').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: true }).limit(1).maybeSingle(),
    ])
    captureSupabaseError('load factures', facErr, { module: 'facturation', tenant_id: tenantId })
    captureSupabaseError('load entreprise_config', cfgErr, { module: 'facturation', tenant_id: tenantId })
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
    const year = new Date().getFullYear()
    const prefixe = config.prefixe_facture ?? 'FAC'
    const num = `${prefixe}-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`
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
  const { tva: tvaLive, ca: caLive, ttc: ttcLive } = calculerTVA(subtotalLive)

  const tvaLabel  = `TVA ${parseFloat((paysFiscal.tva.taux_normal * 100).toFixed(2))}%`
  const caAddTax  = paysFiscal.tva.taxes_additionnelles?.[0]
  const caLabel   = caAddTax ? `${caAddTax.code ?? 'CA'} ${parseFloat((caAddTax.taux * 100).toFixed(0))}%` : ''

  function updateLigne(i: number, key: keyof FactureLigne, val: string | number) {
    setLignes(prev => prev.map((l, idx) => {
      if (idx !== i) return l
      const next = { ...l, [key]: key === 'description' ? val : Number(val) }
      if (key === 'price' || key === 'quantity') next.total = next.price * next.quantity
      return next
    }))
  }

  // ── Pont comptable — délègue au moteur central emit_accounting_event (migration 138/139) ──
  // Ne jamais écrire directement dans journal_entries : une seule autorité d'écriture.

  async function emitFactureEvent(params: {
    eventType: 'FAC-001' | 'FAC-002'
    facId: string; invoiceNo: string; clientName: string; dateOp: string
    ht: number; tva: number; ttc: number; ca: number; modePaiement?: string
  }) {
    if (!tenantId) return
    const { eventType, facId, invoiceNo, clientName, dateOp, ht, tva, ttc, ca, modePaiement = 'virement' } = params
    await supabase.rpc('emit_accounting_event', {
      p_tenant_id:     tenantId,
      p_event_type:    eventType,
      p_source_module: 'facturation',
      p_source_table:  'factures',
      p_source_id:     facId,
      p_montant_ht:    eventType === 'FAC-001' ? ht  : 0,
      p_montant_tva:   eventType === 'FAC-001' ? tva : 0,
      p_montant_ttc:   ttc,
      p_libelle:       eventType === 'FAC-001'
        ? `Facture ${invoiceNo} — ${clientName}`
        : `Règlement ${invoiceNo} — ${clientName}`,
      p_date_event:    dateOp,
      p_fiscal_year:   new Date(dateOp).getFullYear(),
      p_metadata:      { piece_number: invoiceNo, client_name: clientName, ca, country_code: paysGeo?.code ?? 'CG', mode_paiement: modePaiement },
    })
  }

  async function reverseFactureEvents(facId: string) {
    if (!tenantId) return
    const { data: events } = await supabase
      .from('accounting_events')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('source_table', 'factures')
      .eq('source_id', facId)
      .eq('status', 'processed')
      .in('event_type', ['FAC-001', 'FAC-002'])
    for (const ev of events ?? []) {
      await supabase.rpc('fn_reverse_accounting_event', {
        p_event_id:   ev.id,
        p_reason:     'Facture supprimée',
        p_created_by: null,
      })
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function handleSave(asStatut?: StatutFac) {
    if (!clientNom.trim() || !tenantId) return
    setSaving(true)
    const finalStatut = asStatut ?? statut
    const ht = subtotalLive
    const { tva: tvaFinal, ca: caFinal, ttc } = calculerTVA(ht)

    if (editId) {
      const { error: errUpd } = await supabase.from('factures').update({
        invoice_number: invoiceNum, client_name: clientNom, client_address: clientAddress,
        client_phone: clientPhone, client_email: clientEmail,
        date: dateVal, due_date: dueDate || null,
        subtotal: ht, tva: tvaFinal, ca: caFinal, total: ttc,
        notes: notes || null, statut: finalStatut,
      }).eq('id', editId)
      if (errUpd) { showToast('Erreur mise à jour : ' + errUpd.message); setSaving(false); return }
      const { error: errDel } = await supabase.from('facture_lignes').delete().eq('invoice_id', editId)
      if (errDel) { showToast('Erreur suppression lignes : ' + errDel.message); setSaving(false); return }
      const { error: errIns } = await supabase.from('facture_lignes').insert(lignes.filter(l => l.description).map(l => ({ invoice_id: editId, description: l.description, price: l.price, quantity: l.quantity, total: l.total })))
      if (errIns) { showToast('Erreur insertion lignes : ' + errIns.message); setSaving(false); return }
      if (finalStatut === 'envoyee' || finalStatut === 'payee')
        await emitFactureEvent({ eventType: 'FAC-001', facId: editId, invoiceNo: invoiceNum, clientName: clientNom, dateOp: dateVal, ht, tva: tvaFinal, ttc, ca: caFinal })
      if (finalStatut === 'payee')
        await emitFactureEvent({ eventType: 'FAC-002', facId: editId, invoiceNo: invoiceNum, clientName: clientNom, dateOp: dateVal, ht: 0, tva: 0, ttc, ca: 0 })
      showToast('Facture mise à jour !')
    } else {
      const { data: fac, error: errCreate } = await supabase.from('factures').insert({
        tenant_id: tenantId, invoice_number: invoiceNum, client_name: clientNom,
        client_nom: clientNom, client_address: clientAddress, client_phone: clientPhone,
        client_email: clientEmail, date: dateVal, due_date: dueDate || null,
        subtotal: ht, montant_ht: ht, tva: tvaFinal, ca: caFinal, total: ttc,
        notes: notes || null, statut: finalStatut,
      }).select('id').single()
      if (errCreate || !fac?.id) { showToast('Erreur création : ' + (errCreate?.message ?? 'ID manquant')); setSaving(false); return }
      const lignesValides = lignes.filter(l => l.description)
      if (lignesValides.length > 0) {
        const { error: errLignes } = await supabase.from('facture_lignes').insert(lignesValides.map(l => ({ invoice_id: fac.id, description: l.description, price: l.price, quantity: l.quantity, total: l.total })))
        if (errLignes) { showToast('Facture créée, erreur lignes : ' + errLignes.message); setSaving(false); setShowForm(false); resetForm(); load(); return }
      }
      if (finalStatut === 'envoyee' || finalStatut === 'payee')
        await emitFactureEvent({ eventType: 'FAC-001', facId: fac.id, invoiceNo: invoiceNum, clientName: clientNom, dateOp: dateVal, ht, tva: tvaFinal, ttc, ca: caFinal })
      if (finalStatut === 'payee')
        await emitFactureEvent({ eventType: 'FAC-002', facId: fac.id, invoiceNo: invoiceNum, clientName: clientNom, dateOp: dateVal, ht: 0, tva: 0, ttc, ca: 0 })
      showToast('Facture créée !')
    }
    setSaving(false)
    setShowForm(false)
    resetForm()
    load()
  }

  // ── Delete / Statut ───────────────────────────────────────────────────────────

  async function del(id: string) {
    await reverseFactureEvents(id)
    const { error } = await supabase.from('factures').delete().eq('id', id)
    if (error) { showToast('Erreur suppression : ' + error.message); return }
    setFactures(f => f.filter(x => x.id !== id))
    showToast('Facture supprimée.')
  }

  async function updateStatut(id: string, s: StatutFac) {
    const { error } = await supabase.from('factures').update({ statut: s }).eq('id', id)
    if (error) { showToast('Erreur statut : ' + error.message); return }
    setFactures(f => f.map(x => x.id === id ? { ...x, statut: s } : x))
  }

  async function applyStatutChange() {
    if (!confirmStatut) return
    const fac = factures.find(f => f.id === confirmStatut.id)
    await updateStatut(confirmStatut.id, confirmStatut.next)
    if (confirmStatut.next === 'payee' && confirmStatut.current !== 'payee' && fac) {
      const ht       = fac.subtotal ?? fac.montant_ht ?? 0
      const { tva: tvaAmt, ca: caAmt, ttc } = calculerTVA(ht)
      const dateOp   = new Date().toISOString().split('T')[0]
      const invoiceNo = fac.invoice_number ?? ''
      const facDate   = fac.date ?? dateOp
      const clientName = fac.client_name ?? fac.client_nom ?? ''
      // FAC-001 : idempotent (no-op si déjà émis), FAC-002 : paiement
      await emitFactureEvent({ eventType: 'FAC-001', facId: confirmStatut.id, invoiceNo, clientName, dateOp: facDate, ht, tva: tvaAmt, ttc: ttc || fac.total || 0, ca: caAmt })
      await emitFactureEvent({ eventType: 'FAC-002', facId: confirmStatut.id, invoiceNo, clientName, dateOp, ht: 0, tva: 0, ttc: ttc || fac.total || 0, ca: 0 })
    }
    showToast(`Statut → ${t(sKey(confirmStatut.next))}`)
    setConfirmStatut(null)
  }

  // ── Avoir ─────────────────────────────────────────────────────────────────────

  async function creerAvoir(facture: Facture) {
    if (!tenantId) return
    const { count } = await supabase.from('factures').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    const avoirNum = `AV-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, '0')}`
    const { data: lignesAvoir } = await supabase.from('facture_lignes').select('*').eq('invoice_id', facture.id)
    const { data: av } = await supabase.from('factures').insert({
      tenant_id: tenantId,
      invoice_number: avoirNum,
      type: 'avoir',
      facture_ref_id: facture.id,
      client_name: facture.client_name ?? facture.client_nom,
      client_nom: facture.client_name ?? facture.client_nom,
      client_address: facture.client_address,
      client_phone: facture.client_phone,
      client_email: facture.client_email,
      date: new Date().toISOString().split('T')[0],
      subtotal: -(facture.subtotal ?? facture.montant_ht ?? 0),
      montant_ht: -(facture.subtotal ?? facture.montant_ht ?? 0),
      tva: -(facture.tva ?? 0),
      ca: -(facture.ca ?? 0),
      total: -(facture.total ?? 0),
      notes: `Avoir sur facture ${facture.invoice_number ?? facture.id.slice(0, 8)}`,
      statut: 'envoyee',
    }).select('id').single()
    if (av?.id && lignesAvoir?.length) {
      await supabase.from('facture_lignes').insert(
        lignesAvoir.map((l: FactureLigne) => ({ invoice_id: av.id, description: l.description, price: -l.price, quantity: l.quantity, total: -l.total }))
      )
    }
    showToast('Avoir créé : ' + avoirNum)
    load()
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
    const ttc = calculerTVA(f.subtotal ?? f.montant_ht ?? 0).ttc
    const msg = encodeURIComponent(`Bonjour,\n\nVeuillez trouver ci-joint la facture ${num} d'un montant de ${fmt(ttc)}.\n\nCordialement,\n${config.nom ?? 'oraforme'}`)
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
  }

  function sendEmail(f: Facture) {
    const num = f.invoice_number ?? f.id.slice(0, 8)
    const ttc = calculerTVA(f.subtotal ?? f.montant_ht ?? 0).ttc
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
  const totalEnAttente = factures.filter(f => f.statut === 'envoyee' || f.statut === 'brouillon' || f.statut === 'partiellement_payee').reduce((s, f) => s + (f.total ?? 0), 0)
  const totalPartiels  = factures.filter(f => f.statut === 'partiellement_payee').length
  const totalEnRetard  = factures.filter(f => f.statut === 'retard').reduce((s, f) => s + (f.total ?? 0), 0)

  const viewedFac = viewId ? factures.find(f => f.id === viewId) ?? null : null

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">
        <Loader2 className="animate-spin mr-2" size={18} /> {t('invoice.loading')}
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
            className="fixed top-4 right-4 z-50 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm text-[#101729] shadow-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#101729]">{t('invoice.title')}</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {paysGeo.drapeau} TVA {(paysFiscal.tva.taux_normal * 100).toFixed(1)}%{paysFiscal.tva.taxes_additionnelles?.length ? ` + ${paysFiscal.tva.taxes_additionnelles[0].code}` : ''} · {paysGeo.nom}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/devis" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729] hover:border-[#DC2626]/40 text-xs font-medium transition-colors">
            <FileText size={13} /> Devis
          </Link>
          <Link href="/dashboard/facturation/rapports" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729] hover:border-[#DC2626]/40 text-xs font-medium transition-colors">
            <BarChart2 size={13} /> Rapports
          </Link>
          <Link href="/dashboard/parametres" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729] hover:border-[#00b9a7]/40 text-xs font-medium transition-colors">
            <Settings size={13} /> {t('invoice.settings')}
          </Link>
          <motion.button
            onClick={openNew}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: '#DC2626', color: '#0F172A', boxShadow: '0 0 18px #DC262635' }}
          >
            <Plus size={15} /> {t('invoice.new')}
          </motion.button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label={t('invoice.thisMonth')} value={`${totalCeMois} facture${totalCeMois !== 1 ? 's' : ''}`} color="#DC2626"  icon={FileText} />
        <KpiCard label={t('invoice.collected')} value={fmt(totalEncaisse)}  color="#16A34A"  icon={CheckCircle} />
        <KpiCard label={t('invoice.waiting')}   value={fmt(totalEnAttente)} color="#DC2626"  icon={Clock} />
        <KpiCard label={t('invoice.late')}      value={fmt(totalEnRetard)}  color="#DC2626"  icon={AlertTriangle} />
        <KpiCard label="Paiements partiels"     value={`${totalPartiels} facture${totalPartiels !== 1 ? 's' : ''}`} color="#F59E0B" icon={DollarSign} />
      </div>

      {/* Filters + Search */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-1 flex-wrap">
          {([
            ['toutes',              t('invoice.all')],
            ['brouillon',           t('invoice.drafts')],
            ['envoyee',             t('invoice.sent')],
            ['payee',               t('invoice.paid2')],
            ['partiellement_payee', 'Partiel'],
            ['retard',              t('invoice.late')],
            ['annulee',             t('invoice.cancelled')],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{ background: filter === val ? '#DC2626' : 'transparent', color: filter === val ? '#0F172A' : '#64748B' }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            className="pl-8 pr-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs text-[#101729] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[#00b9a7] w-52"
            placeholder={t('common.search') + ' client, N°…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Invoice Table */}
      {displayed.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-secondary)]">
          <FileText size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t('invoice.noInvoice')}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]" style={{ background: '#F9FAFB' }}>
                  {[t('invoice.number'), t('invoice.client'), t('common.date'), 'HT', 'TVA+CA', 'TTC', t('common.status'), t('common.actions')].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((f, i) => {
                  const ht = f.subtotal ?? f.montant_ht ?? 0
                  const { tva, ca, ttc } = calculerTVA(ht)
                  return (
                    <motion.tr
                      key={f.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.25 }}
                      className="border-b border-[var(--border)] hover:bg-gray-50 transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-mono font-semibold text-[#DC2626]">
                            {f.invoice_number ?? f.id.slice(0, 8).toUpperCase()}
                          </span>
                          {f.type === 'avoir' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#DC262618', color: '#DC2626' }}>AVOIR</span>
                          )}
                          {f.type === 'proforma' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#64748B18', color: '#64748B' }}>PROFORMA</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-[#101729]">{f.client_name ?? f.client_nom}</p>
                        {f.client_email && <p className="text-[10px] text-[var(--text-secondary)]">{f.client_email}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                        {fmtDate(f.date ?? f.created_at)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{fmt(ht)}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{fmt(tva + ca)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-[#DC2626]">{fmt(ttc)}</td>
                      <td className="px-4 py-3">
                        {/* Controlled select — triggers confirmation dialog */}
                        <select
                          value={f.statut}
                          onChange={e => setConfirmStatut({ id: f.id, current: f.statut, next: e.target.value as StatutFac })}
                          className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer rounded-full px-2 py-1 border-0"
                          style={{ color: STATUT_CONFIG[f.statut]?.color, background: STATUT_CONFIG[f.statut]?.bg }}
                        >
                          {Object.entries(STATUT_CONFIG).map(([k]) => (
                            <option key={k} value={k} className="bg-[var(--card-bg)] text-[#101729]">{t(sKey(k))}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ActionBtn title="Voir détail"     onClick={() => setViewId(f.id)}                                                                       icon={<Eye size={13} />} />
                          <ActionBtn title="Aperçu plein écran" onClick={() => router.push(`/dashboard/factures/${f.id}/preview`)}                                 icon={<ExternalLink size={13} />} hoverClass="hover:text-[#DC2626]" />
                          <ActionBtn title={t('common.edit')}        onClick={() => openEdit(f)}                                                                           icon={<Edit3 size={13} />} />
                          {f.client_phone && <ActionBtn title="WhatsApp" onClick={() => sendWhatsApp(f)}                                                           icon={<MessageCircle size={13} />} hoverClass="hover:text-[#25D366]" />}
                          {f.client_email && <ActionBtn title="Envoyer par email" onClick={() => sendEmail(f)}                                                     icon={<Mail size={13} />} hoverClass="hover:text-[#DC2626]" />}
                          <ActionBtn
                            title="Télécharger PDF"
                            onClick={() => downloadPDF(f.id, f.invoice_number ?? f.id.slice(0, 8))}
                            disabled={dlLoading === f.id}
                            icon={dlLoading === f.id ? <Loader2 className="animate-spin" size={13} /> : <Download size={13} />}
                            hoverClass="hover:text-[#DC2626]"
                          />
                          {f.statut !== 'payee' && f.statut !== 'annulee' && (
                            <ActionBtn title="Encaisser" onClick={() => setPaymentFac(f)} icon={<DollarSign size={13} />} hoverClass="hover:text-[#16A34A]" />
                          )}
                          {f.statut === 'payee' && (f.type === 'facture' || !f.type) && (
                            <ActionBtn title="Créer un avoir" onClick={() => creerAvoir(f)} icon={<RotateCcw size={13} />} hoverClass="hover:text-[#F59E0B]" />
                          )}
                          <ActionBtn title={t('common.delete')} onClick={() => del(f.id)} icon={<Trash2 size={13} />} hoverClass="hover:text-red-400" />
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
                className="relative w-full max-w-4xl bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-2xl mb-10"
                initial={{ scale: 0.96, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 20 }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                  <h2 className="text-base font-bold text-[#101729]">{editId ? t('invoice.editInvoice') : t('invoice.new')}</h2>
                  <button onClick={() => setShowForm(false)} className="text-[var(--text-secondary)] hover:text-[#101729] transition-colors"><X size={18} /></button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Client + Metadata */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t('invoice.clientInfo')}</p>
                      <FormInput label={t('invoice.companyName')} value={clientNom} onChange={setClientNom} placeholder="Entreprise ABC" />
                      <FormInput label={t('common.address')} value={clientAddress} onChange={setClientAddress} placeholder="123 Rue du Commerce, Brazzaville" />
                      <div className="grid grid-cols-2 gap-3">
                        <FormInput label={t('common.phone')} value={clientPhone} onChange={setClientPhone} placeholder="+242 06 000 0000" />
                        <FormInput label={t('common.email')} value={clientEmail} onChange={setClientEmail} placeholder="client@mail.com" type="email" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t('invoice.invoiceInfo')}</p>
                      <FormInput label={t('invoice.number')} value={invoiceNum} onChange={setInvoiceNum} placeholder="FAC-2025-0001" />
                      <div className="grid grid-cols-2 gap-3">
                        <FormInput label={t('common.date')} value={dateVal} onChange={setDateVal} type="date" />
                        <FormInput label={t('invoice.dueDate2')} value={dueDate} onChange={setDueDate} type="date" />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('common.status')}</label>
                        <select value={statut} onChange={e => setStatut(e.target.value as StatutFac)} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[#101729] focus:outline-none focus:border-[#00b9a7]">
                          {Object.entries(STATUT_CONFIG).map(([k]) => <option key={k} value={k} className="bg-[var(--card-bg)]">{t(sKey(k))}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Lines */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t('invoice.items')}</p>
                      <button onClick={() => setLignes(p => [...p, emptyLigne()])} className="text-xs text-[#DC2626] hover:underline flex items-center gap-1">
                        <Plus size={11} /> {t('invoice.addLine')}
                      </button>
                    </div>
                    <div className="grid grid-cols-12 gap-2 mb-1 px-1">
                      <span className="col-span-5 text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">{t('invoice.designation')}</span>
                      <span className="col-span-3 text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">{t('invoice.unitPrice')}</span>
                      <span className="col-span-2 text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">{t('invoice.qty')}</span>
                      <span className="col-span-1 text-[10px] text-[var(--text-secondary)] uppercase tracking-wider text-right">{t('common.total')}</span>
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
                            <input className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-xs text-[#101729] focus:outline-none focus:border-[#00b9a7]" placeholder={t('common.description') + '…'} value={l.description} onChange={e => updateLigne(i, 'description', e.target.value)} />
                          </div>
                          <div className="col-span-3">
                            <input type="number" min="0" className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-xs text-[#101729] focus:outline-none focus:border-[#00b9a7] text-right" value={l.price || ''} onChange={e => updateLigne(i, 'price', e.target.value)} />
                          </div>
                          <div className="col-span-2">
                            <input type="number" min="1" className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-xs text-[#101729] focus:outline-none focus:border-[#00b9a7] text-center" value={l.quantity} onChange={e => updateLigne(i, 'quantity', e.target.value)} />
                          </div>
                          <div className="col-span-1 text-right">
                            <span className="text-xs font-semibold text-[#DC2626]">{fmt(l.price * l.quantity)}</span>
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
                  <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                    <div className="px-4 py-2 border-b border-[var(--border)]" style={{ background: '#F9FAFB' }}>
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('invoice.fiscalSummary')}</span>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">{t('invoice.subtotal')}</span><span className="text-[#101729] font-medium">{fmt(subtotalLive)}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">{tvaLabel}</span><span className="text-[#101729]">{fmt(tvaLive)}</span></div>
                      {caLive > 0 && <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">{caLabel}</span><span className="text-[#101729]">{fmt(caLive)}</span></div>}
                      <div className="border-t border-[var(--border)] pt-3 flex justify-between">
                        <span className="text-base font-bold text-[#101729]">{t('invoice.totalTTC')}</span>
                        <span className="text-xl font-bold text-[#DC2626]">{fmt(ttcLive)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1.5">{t('invoice.notesOptional')}</label>
                    <textarea rows={3} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[#00b9a7] resize-none" placeholder="Conditions de paiement, remerciements…" value={notes} onChange={e => setNotes(e.target.value)} />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729] hover:border-[#00b9a7]/40 text-sm font-medium transition-colors">
                      {t('common.cancel')}
                    </button>
                    <button onClick={() => handleSave('brouillon')} disabled={saving || !clientNom} className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729] hover:border-[#00b9a7]/40 text-sm font-medium transition-colors disabled:opacity-40">
                      {saving ? <Loader2 className="animate-spin" size={14} /> : t('invoice.saveDraft')}
                    </button>
                    <button
                      onClick={() => handleSave('envoyee')}
                      disabled={saving || !clientNom}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm flex-1 justify-center disabled:opacity-40"
                      style={{ background: '#DC2626', color: '#0F172A' }}
                    >
                      {saving ? <Loader2 className="animate-spin" size={14} /> : <><Send size={14} /> {t('invoice.emit')}</>}
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
                className="relative w-full max-w-2xl max-h-[90vh] bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col"
                initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-bold text-[#101729]">{viewedFac.invoice_number ?? '—'}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{viewedFac.client_name ?? viewedFac.client_nom}</p>
                    </div>
                    <StatutBadge statut={viewedFac.statut} size="xs" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/dashboard/factures/${viewedFac.id}/preview`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729] text-xs font-medium transition-colors"
                    >
                      <ExternalLink size={12} /> {t('invoice.preview')}
                    </button>
                    <button
                      onClick={() => downloadPDF(viewedFac.id, viewedFac.invoice_number ?? viewedFac.id.slice(0, 8))}
                      disabled={dlLoading === viewedFac.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#DC2626]/15 border border-[#DC2626]/30 text-[#DC2626] text-xs font-semibold hover:bg-[#DC2626]/25 transition-colors disabled:opacity-50"
                    >
                      {dlLoading === viewedFac.id ? <Loader2 className="animate-spin" size={12} /> : <Download size={12} />} PDF
                    </button>
                    <button onClick={() => setViewId(null)} className="text-[var(--text-secondary)] hover:text-[#101729] p-1 transition-colors"><X size={18} /></button>
                  </div>
                </div>

                {/* Scrollable body */}
                <div className="overflow-y-auto flex-1 p-6 space-y-5">

                  {/* Client + Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-2">{t('invoice.clientSection')}</p>
                      <p className="font-semibold text-[#101729] text-sm">{viewedFac.client_name ?? viewedFac.client_nom}</p>
                      {viewedFac.client_address && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{viewedFac.client_address}</p>}
                      {viewedFac.client_phone   && <p className="text-xs text-[var(--text-secondary)]">{viewedFac.client_phone}</p>}
                      {viewedFac.client_email   && <p className="text-xs text-[var(--text-secondary)]">{viewedFac.client_email}</p>}
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-2">{t('invoice.datesSection')}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{t('invoice.issuedOn')} <span className="text-[#101729]">{fmtDate(viewedFac.date ?? viewedFac.created_at)}</span></p>
                      {viewedFac.due_date && <p className="text-xs text-[var(--text-secondary)] mt-1">{t('invoice.dueOn')} <span className="text-[#101729]">{fmtDate(viewedFac.due_date)}</span></p>}
                    </div>
                  </div>

                  {/* Lignes table */}
                  {viewLignes.length > 0 && (
                    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[var(--border)]" style={{ background: 'rgba(240,163,10,0.08)' }}>
                            <th className="text-left px-3 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t('invoice.designation')}</th>
                            <th className="text-right px-3 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t('invoice.unitPrice')}</th>
                            <th className="text-center px-3 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t('invoice.qty')}</th>
                            <th className="text-right px-3 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t('common.total')}</th>
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
                    const ht = viewedFac.subtotal ?? viewedFac.montant_ht ?? 0
                    const { tva, ca, ttc } = calculerTVA(ht)
                    return (
                      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-2">
                        <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">{t('invoice.subtotal')}</span><span className="text-[#101729]">{fmt(ht)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">{tvaLabel}</span><span className="text-[#101729]">{fmt(tva)}</span></div>
                        {ca > 0 && <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">{caLabel}</span><span className="text-[#101729]">{fmt(ca)}</span></div>}
                        <div className="border-t border-[var(--border)] pt-2 flex justify-between">
                          <span className="font-bold text-[#101729]">{t('invoice.totalTTC')}</span>
                          <span className="font-bold text-[#DC2626] text-lg">{fmt(ttc)}</span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Changer statut */}
                  <div>
                    <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-2">{t('common.status')}</p>
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
                                : { color: '#64748B', background: 'transparent', borderColor: '#E5E7EB', cursor: 'pointer' }
                            }
                          >
                            <Icon size={10} /> {t(sKey(k))}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* PDF Preview toggle */}
                  <div>
                    <button
                      onClick={() => setShowPdfPreview(p => !p)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729] hover:border-[#00b9a7]/40 text-sm font-medium transition-colors"
                    >
                      <span className="flex items-center gap-2"><FileText size={14} /> {showPdfPreview ? t('invoice.hidePreview') : t('invoice.showPreview')} {t('invoice.pdfPreview')}</span>
                      <span>{showPdfPreview ? '▲' : '▼'}</span>
                    </button>
                    <AnimatePresence>
                      {showPdfPreview && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 500 }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden rounded-b-xl border-x border-b border-[var(--border)]"
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
                    <div className="bg-[#F9FAFB] border border-[var(--border)] rounded-xl p-4">
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">{t('invoice.notesOptional')}</p>
                      <p className="text-sm text-[var(--text)]">{viewedFac.notes}</p>
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
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#DC2626]/30 text-[#DC2626] text-xs font-semibold hover:bg-[#DC2626]/10 transition-colors"
                      >
                        <Mail size={13} /> Email
                      </button>
                    )}
                    <button
                      onClick={() => { setViewId(null); openEdit(viewedFac) }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729] text-xs font-medium transition-colors"
                    >
                      <Edit3 size={13} /> {t('common.edit')}
                    </button>
                  </div>

                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── PAYMENT MODAL ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {paymentFac && tenantId && (
          <PaymentModal
            facture={paymentFac}
            tenantId={tenantId}
            onClose={() => setPaymentFac(null)}
            onPaid={() => { load(); showToast('Paiement enregistré !') }}
          />
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
                className="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-2xl p-6"
                initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }}
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-base font-bold text-[#101729] mb-2">{t('invoice.confirmChange')}</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-5">
                  {t('invoice.changeStatus')}{' '}
                  <span className="font-semibold" style={{ color: STATUT_CONFIG[confirmStatut.current].color }}>
                    {t(sKey(confirmStatut.current))}
                  </span>
                  {' '}→{' '}
                  <span className="font-semibold" style={{ color: STATUT_CONFIG[confirmStatut.next].color }}>
                    {t(sKey(confirmStatut.next))}
                  </span>
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmStatut(null)}
                    className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729] text-sm font-medium transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={applyStatutChange}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90"
                    style={{ background: STATUT_CONFIG[confirmStatut.next].color }}
                  >
                    {t('common.confirm')}
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
