'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'
import { resolveAccounts } from '@/lib/accounting-engine'
import { writeComptaEntry } from '@/lib/compta-sync-client'
import {
  ArrowUpCircle, Plus, Search, Filter, Download, Check, X, Loader2,
  Building2, Archive, Smartphone, CreditCard, Wallet2, Eye, RefreshCw,
  ChevronDown, Calendar, FileText, Tag, AlertCircle,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Encaissement {
  id: string
  tenant_id: string
  date_operation: string
  libelle: string
  montant: number
  categorie: string
  mode_paiement: string
  compte_destination: string
  compte_destination_id: string | null
  reference: string
  tiers: string
  statut: 'en_attente' | 'validé' | 'rejeté' | 'annulé'
  notes: string
  created_at: string
}

interface CompteBancaire { id: string; intitule: string; banque: string; numero_compte: string }
interface Caisse          { id: string; nom: string; solde: number }
interface Wallet          { id: string; operateur: string; intitule: string; numero: string }

const CATEGORIES = [
  { value: 'vente',           label: 'Vente de marchandises',    compte: '701' },
  { value: 'service',         label: 'Prestation de services',   compte: '705' },
  { value: 'client',          label: 'Règlement client',         compte: '411' },
  { value: 'subvention',      label: 'Subvention',               compte: '711' },
  { value: 'loyer',           label: 'Loyer perçu',              compte: '708' },
  { value: 'interet',         label: 'Intérêts reçus',           compte: '778' },
  { value: 'remboursement',   label: 'Remboursement reçu',       compte: '409' },
  { value: 'avance_client',   label: 'Avance client',            compte: '419' },
  { value: 'autre',           label: 'Autre encaissement',       compte: '758' },
]

const MODES_PAIEMENT = [
  { value: 'espece',      label: 'Espèces',          icon: Archive },
  { value: 'cheque',      label: 'Chèque',            icon: FileText },
  { value: 'virement',    label: 'Virement bancaire', icon: Building2 },
  { value: 'mobile',      label: 'Mobile Money',      icon: Smartphone },
  { value: 'carte',       label: 'Carte bancaire',    icon: CreditCard },
  { value: 'wallet',      label: 'Wallet',            icon: Wallet2 },
]

const STATUT_COLORS: Record<string, string> = {
  en_attente: 'bg-amber-50 text-amber-700 border border-amber-200',
  validé:     'bg-green-50 text-green-700 border border-green-200',
  rejeté:     'bg-red-50 text-red-700 border border-red-200',
  annulé:     'bg-slate-50 text-slate-500 border border-slate-200',
}

const EMPTY_FORM = {
  date_operation: new Date().toISOString().slice(0, 10),
  libelle: '',
  montant: '',
  categorie: 'client',
  mode_paiement: 'virement',
  compte_destination: 'banque',
  compte_destination_id: '',
  reference: '',
  tiers: '',
  notes: '',
}

export default function EncaissementsPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId } = useTenant()
  const { t, locale } = useLocale()
  const intlLocale = locale === 'fr' ? 'fr-FR' : locale === 'en' ? 'en-US' : locale
  const [rows, setRows]             = useState<Encaissement[]>([])
  const [banques, setBanques]       = useState<CompteBancaire[]>([])
  const [caisses, setCaisses]       = useState<Caisse[]>([])
  const [wallets, setWallets]       = useState<Wallet[]>([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [form, setForm]             = useState({ ...EMPTY_FORM })
  const [search, setSearch]         = useState('')
  const [filterCat, setFilterCat]   = useState('all')
  const [filterMode, setFilterMode] = useState('all')
  const [filterStatut, setFilterStatut] = useState('all')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const [selected, setSelected]     = useState<Encaissement | null>(null)

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const totalMois = rows
    .filter(r => {
      const d = new Date(r.date_operation)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && r.statut === 'validé'
    })
    .reduce((s, r) => s + r.montant, 0)

  const totalEnAttente = rows
    .filter(r => r.statut === 'en_attente')
    .reduce((s, r) => s + r.montant, 0)

  const totalAll = rows.filter(r => r.statut === 'validé').reduce((s, r) => s + r.montant, 0)

  // ── Loaders ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const [{ data: enc }, { data: ban }, { data: cai }, { data: wal }] = await Promise.all([
        supabase.from('encaissements')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('date_operation', { ascending: false })
          .limit(200),
        supabase.from('comptes_bancaires')
          .select('id, intitule, banque, numero_compte')
          .eq('tenant_id', tenantId)
          .eq('actif', true),
        supabase.from('caisses')
          .select('id, nom, solde')
          .eq('tenant_id', tenantId)
          .eq('actif', true),
        supabase.from('wallets')
          .select('id, operateur, intitule, numero')
          .eq('tenant_id', tenantId)
          .eq('actif', true),
      ])
      setRows(enc ?? [])
      setBanques(ban ?? [])
      setCaisses(cai ?? [])
      setWallets(wal ?? [])
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  // ── Save ────────────────────────────────────────────────────────────────────
  async function saveEncaissement() {
    if (!tenantId || !form.montant || !form.libelle) return
    setSaving(true)
    try {
      const montant = parseInt(form.montant)
      const cat = CATEGORIES.find(c => c.value === form.categorie)

      // Determine destination account based on mode
      const creditAccount = cat?.compte ?? '758'
      let debitAccount = '521'
      if (form.compte_destination === 'caisse')  debitAccount = '571'
      if (form.compte_destination === 'mobile')  debitAccount = '54'
      if (form.compte_destination === 'wallet')  debitAccount = '54'

      const { data: enc, error } = await supabase.from('encaissements').insert({
        tenant_id: tenantId,
        date_operation: form.date_operation,
        libelle: form.libelle,
        montant,
        categorie: form.categorie,
        mode_paiement: form.mode_paiement,
        compte_destination: form.compte_destination,
        compte_destination_id: form.compte_destination_id || null,
        reference: form.reference,
        tiers: form.tiers,
        notes: form.notes,
        statut: 'validé',
      }).select('id').single()

      if (error) throw error

      // OHADA sync
      await writeComptaEntry({
        tenantId,
        date: form.date_operation,
        libelle: form.libelle,
        type: 'recette',
        montant,
        categorie: form.categorie,
        debitAccount,
        creditAccount,
        source: 'encaissement',
        sourceId: enc?.id,
      })

      // Update balance depending on destination
      if (form.compte_destination === 'banque' && form.compte_destination_id) {
        const { data: cb } = await supabase.from('comptes_bancaires')
          .select('solde').eq('id', form.compte_destination_id).single()
        if (cb) {
          await supabase.from('comptes_bancaires')
            .update({ solde: (cb.solde ?? 0) + montant })
            .eq('id', form.compte_destination_id)
        }
      } else if (form.compte_destination === 'caisse' && form.compte_destination_id) {
        const { data: ca } = await supabase.from('caisses')
          .select('solde').eq('id', form.compte_destination_id).single()
        if (ca) {
          await supabase.from('caisses')
            .update({ solde: (ca.solde ?? 0) + montant })
            .eq('id', form.compte_destination_id)
        }
      }

      // Also create transaction record
      await supabase.from('transactions').insert({
        tenant_id: tenantId,
        date: form.date_operation,
        libelle: form.libelle,
        montant,
        type: 'entree',
        categorie: form.categorie,
        reference: form.reference,
        source_id: enc?.id,
      })

      setForm({ ...EMPTY_FORM })
      setShowModal(false)
      await load()
    } catch (e: unknown) {
      alert('Erreur: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filtered = rows.filter(r => {
    if (filterCat !== 'all' && r.categorie !== filterCat) return false
    if (filterMode !== 'all' && r.mode_paiement !== filterMode) return false
    if (filterStatut !== 'all' && r.statut !== filterStatut) return false
    if (dateFrom && r.date_operation < dateFrom) return false
    if (dateTo && r.date_operation > dateTo) return false
    const q = search.toLowerCase()
    if (q && !r.libelle.toLowerCase().includes(q) && !r.tiers.toLowerCase().includes(q) && !r.reference.toLowerCase().includes(q)) return false
    return true
  })

  // ── CSV Export ───────────────────────────────────────────────────────────────
  function exportCSV() {
    const lines = ['Date,Libellé,Tiers,Montant,Catégorie,Mode,Statut,Référence']
    filtered.forEach(r => {
      lines.push([
        r.date_operation, `"${r.libelle}"`, `"${r.tiers}"`,
        r.montant,
        CATEGORIES.find(c => c.value === r.categorie)?.label ?? r.categorie,
        r.mode_paiement, r.statut, r.reference,
      ].join(','))
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `encaissements_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  // ── Destination selector ─────────────────────────────────────────────────────
  function DestinationSelect() {
    if (form.compte_destination === 'banque') {
      return (
        <select value={form.compte_destination_id}
          onChange={e => setForm(f => ({ ...f, compte_destination_id: e.target.value }))}
          className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
          <option value="">— Sélectionner un compte —</option>
          {banques.map(b => <option key={b.id} value={b.id}>{b.intitule} — {b.banque}</option>)}
        </select>
      )
    }
    if (form.compte_destination === 'caisse') {
      return (
        <select value={form.compte_destination_id}
          onChange={e => setForm(f => ({ ...f, compte_destination_id: e.target.value }))}
          className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
          <option value="">— Sélectionner une caisse —</option>
          {caisses.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      )
    }
    if (form.compte_destination === 'mobile' || form.compte_destination === 'wallet') {
      return (
        <select value={form.compte_destination_id}
          onChange={e => setForm(f => ({ ...f, compte_destination_id: e.target.value }))}
          className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
          <option value="">— Sélectionner un wallet —</option>
          {wallets.map(w => <option key={w.id} value={w.id}>{w.intitule} ({w.operateur})</option>)}
        </select>
      )
    }
    return null
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <ArrowUpCircle size={20} className="text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">{t('treso.encaissements.title')}</h1>
            <p className="text-xs text-[#64748B]">{t('treso.encaissements.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC] transition-colors">
            <Download size={14} /> Exporter
          </button>
          <button onClick={() => { setForm({ ...EMPTY_FORM }); setShowModal(true) }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors shadow-sm">
            <Plus size={14} /> {t('treso.encaissements.newEntry')}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: t('treso.encaissements.kpi.mois'), value: totalMois, color: 'green', icon: ArrowUpCircle },
          { label: t('treso.encaissements.kpi.count'), value: totalEnAttente, color: 'amber', icon: AlertCircle },
          { label: t('treso.encaissements.kpi.total'), value: totalAll, color: 'cyan', icon: Check },
        ].map(k => {
          const Icon = k.icon
          const colorMap: Record<string, string> = {
            green: 'bg-green-50 text-green-600',
            amber: 'bg-amber-50 text-amber-600',
            cyan:  'bg-cyan-50 text-cyan-600',
          }
          return (
            <div key={k.label} className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#64748B] font-medium">{k.label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[k.color]}`}>
                  <Icon size={15} />
                </div>
              </div>
              <div className="text-xl font-bold text-[#0F172A]">{fmtFCFA(k.value)}</div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
          </div>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
            <option value="all">Toutes catégories</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={filterMode} onChange={e => setFilterMode(e.target.value)}
            className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
            <option value="all">Tous modes</option>
            {MODES_PAIEMENT.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
            className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
            <option value="all">Tous statuts</option>
            <option value="en_attente">{t('common.pending')}</option>
            <option value="validé">Validé</option>
            <option value="rejeté">{t('common.rejected')}</option>
            <option value="annulé">{t('common.cancelled')}</option>
          </select>
        </div>
        <div className="flex gap-2 mt-2">
          <div className="flex items-center gap-1.5">
            <Calendar size={12} className="text-[#94A3B8]" />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-[#E2E8F0] rounded-xl px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
          </div>
          <span className="text-xs text-[#94A3B8] self-center">→</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-[#E2E8F0] rounded-xl px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
          {(dateFrom || dateTo || filterCat !== 'all' || filterMode !== 'all' || filterStatut !== 'all' || search) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setFilterCat('all'); setFilterMode('all'); setFilterStatut('all'); setSearch('') }}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded-xl transition-colors">
              <X size={12} /> Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
          <span className="text-sm font-semibold text-[#0F172A]">
            {filtered.length} encaissement{filtered.length > 1 ? 's' : ''}
          </span>
          <span className="text-xs text-[#64748B]">
            Total filtré: <strong className="text-green-600">{fmtFCFA(filtered.filter(r => r.statut === 'validé').reduce((s, r) => s + r.montant, 0))}</strong>
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[#0891B2]" />
            <span className="ml-2 text-xs text-[#94A3B8]">{t('common.loading')}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#94A3B8]">
            <ArrowUpCircle size={32} className="mb-2 opacity-30" />
            <p className="text-sm font-medium">{t('treso.encaissements.noEntries')}</p>
            <p className="text-xs mt-1">Ajustez les filtres ou créez un nouvel encaissement</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {['Date', 'Libellé / Tiers', 'Catégorie', 'Mode', 'Destination', 'Montant', 'Statut', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const cat = CATEGORIES.find(c => c.value === r.categorie)
                  return (
                    <tr key={r.id} className={`border-t border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors ${i % 2 === 0 ? '' : 'bg-[#FAFBFC]'}`}>
                      <td className="px-4 py-3 text-xs text-[#64748B] whitespace-nowrap">
                        {new Date(r.date_operation).toLocaleDateString(intlLocale)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-[#0F172A]">{r.libelle}</div>
                        {r.tiers && <div className="text-[10px] text-[#94A3B8]">{r.tiers}</div>}
                        {r.reference && <div className="text-[10px] text-[#94A3B8]">Réf: {r.reference}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-50 text-cyan-700 rounded-lg text-[10px] font-medium">
                          <Tag size={10} />
                          {cat?.label ?? r.categorie}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-[#64748B]">
                          {MODES_PAIEMENT.find(m => m.value === r.mode_paiement)?.label ?? r.mode_paiement}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-[#64748B] capitalize">{r.compte_destination}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-green-600">+{fmtFCFA(r.montant)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold ${STATUT_COLORS[r.statut] ?? ''}`}>
                          {r.statut}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelected(r)}
                          className="p-1 hover:bg-[#F1F5F9] rounded-lg transition-colors">
                          <Eye size={13} className="text-[#94A3B8]" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0F172A]">Détail de l'encaissement</h3>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-[#F1F5F9] rounded-xl">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              {[
                ['Date', new Date(selected.date_operation).toLocaleDateString(intlLocale)],
                ['Libellé', selected.libelle],
                ['Tiers', selected.tiers || '—'],
                ['Montant', fmtFCFA(selected.montant)],
                ['Catégorie', CATEGORIES.find(c => c.value === selected.categorie)?.label ?? selected.categorie],
                ['Mode de paiement', MODES_PAIEMENT.find(m => m.value === selected.mode_paiement)?.label ?? selected.mode_paiement],
                ['Destination', selected.compte_destination],
                ['Référence', selected.reference || '—'],
                ['Statut', selected.statut],
                ['Notes', selected.notes || '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-[#64748B] font-medium">{k}</span>
                  <span className="text-[#0F172A] font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0F172A]">{t('treso.encaissements.newEntry')}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-[#F1F5F9] rounded-xl">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[#374151] mb-1">Libellé *</label>
                <input value={form.libelle} onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))}
                  placeholder="Description de l'encaissement"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Date *</label>
                <input type="date" value={form.date_operation} onChange={e => setForm(f => ({ ...f, date_operation: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Montant (FCFA) *</label>
                <input type="number" value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">{t('common.category')}</label>
                <select value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Mode de paiement</label>
                <select value={form.mode_paiement} onChange={e => setForm(f => ({ ...f, mode_paiement: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
                  {MODES_PAIEMENT.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Destination</label>
                <select value={form.compte_destination}
                  onChange={e => setForm(f => ({ ...f, compte_destination: e.target.value, compte_destination_id: '' }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
                  <option value="banque">Compte bancaire</option>
                  <option value="caisse">Caisse</option>
                  <option value="mobile">Mobile Money</option>
                  <option value="wallet">Wallet</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[#374151] mb-1">Compte de destination</label>
                <DestinationSelect />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Tiers / Payeur</label>
                <input value={form.tiers} onChange={e => setForm(f => ({ ...f, tiers: e.target.value }))}
                  placeholder="Nom du client / payeur"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">{t('common.reference')}</label>
                <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                  placeholder="N° facture, chèque, etc."
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[#374151] mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Observations…"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2] resize-none" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">
                {t('common.cancel')}
              </button>
              <button onClick={saveEncaissement} disabled={saving || !form.montant || !form.libelle}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
