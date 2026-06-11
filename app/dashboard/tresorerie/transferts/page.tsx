'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'
import { writeComptaEntry } from '@/lib/compta-sync-client'
import {
  GitMerge, Plus, Search, Download, Check, X, Loader2,
  ArrowRight, Building2, Archive, Smartphone, Wallet2, Eye,
  Calendar, AlertCircle, RefreshCw,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type CompteType = 'banque' | 'caisse' | 'mobile' | 'wallet'

interface Transfert {
  id: string
  tenant_id: string
  date_transfert: string
  libelle: string
  montant: number
  frais: number
  source_type: CompteType
  source_id: string | null
  source_label: string
  dest_type: CompteType
  dest_id: string | null
  dest_label: string
  statut: 'en_attente' | 'exécuté' | 'annulé' | 'rejeté'
  reference: string
  notes: string
  created_at: string
}

interface CompteBancaire { id: string; intitule: string; banque: string; solde: number }
interface Caisse          { id: string; nom: string; solde: number }
interface Wallet          { id: string; operateur: string; intitule: string; numero: string; solde: number }

const TYPE_ICONS: Record<CompteType, React.ElementType> = {
  banque: Building2,
  caisse: Archive,
  mobile: Smartphone,
  wallet: Wallet2,
}

const TYPE_OHADA: Record<CompteType, string> = {
  banque: '521',
  caisse: '571',
  mobile: '54',
  wallet: '54',
}

const STATUT_COLORS: Record<string, string> = {
  en_attente: 'bg-amber-50 text-amber-700 border border-amber-200',
  exécuté:    'bg-green-50 text-green-700 border border-green-200',
  annulé:     'bg-slate-50 text-slate-500 border border-slate-200',
  rejeté:     'bg-red-50 text-red-700 border border-red-200',
}

const EMPTY_FORM = {
  date_transfert: new Date().toISOString().slice(0, 10),
  libelle: '',
  montant: '',
  frais: '0',
  source_type: 'banque' as CompteType,
  source_id: '',
  dest_type: 'caisse' as CompteType,
  dest_id: '',
  reference: '',
  notes: '',
}

export default function TransfertsPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId } = useTenant()
  const { t, locale } = useLocale()
  const intlLocale = locale === 'fr' ? 'fr-FR' : locale === 'en' ? 'en-GB' : 'fr-FR'
  const [rows, setRows]         = useState<Transfert[]>([])
  const [banques, setBanques]   = useState<CompteBancaire[]>([])
  const [caisses, setCaisses]   = useState<Caisse[]>([])
  const [wallets, setWallets]   = useState<Wallet[]>([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({ ...EMPTY_FORM })
  const [search, setSearch]     = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [selected, setSelected] = useState<Transfert | null>(null)

  const totalMois = rows.filter(r => {
    const d = new Date(r.date_transfert); const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && r.statut === 'exécuté'
  }).reduce((s, r) => s + r.montant, 0)

  const totalFrais = rows.filter(r => r.statut === 'exécuté').reduce((s, r) => s + r.frais, 0)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const [{ data: tr }, { data: ban }, { data: cai }, { data: wal }] = await Promise.all([
        supabase.from('transferts').select('*').eq('tenant_id', tenantId)
          .order('date_transfert', { ascending: false }).limit(200),
        supabase.from('comptes_bancaires').select('id,intitule,banque,solde').eq('tenant_id', tenantId).eq('actif', true).limit(200),
        supabase.from('caisses').select('id,nom,solde').eq('tenant_id', tenantId).eq('actif', true).limit(200),
        supabase.from('wallets').select('id,operateur,intitule,numero,solde').eq('tenant_id', tenantId).eq('actif', true).limit(200),
      ])
      setRows(tr ?? [])
      setBanques(ban ?? [])
      setCaisses(cai ?? [])
      setWallets(wal ?? [])
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  function getAccountList(type: CompteType) {
    if (type === 'banque') return banques.map(b => ({ id: b.id, label: `${b.intitule} — ${b.banque}`, solde: b.solde }))
    if (type === 'caisse') return caisses.map(c => ({ id: c.id, label: c.nom, solde: c.solde }))
    return wallets.map(w => ({ id: w.id, label: `${w.intitule} (${w.operateur})`, solde: w.solde }))
  }

  function getLabel(type: CompteType, id: string) {
    const list = getAccountList(type)
    return list.find(a => a.id === id)?.label ?? id
  }

  async function saveTransfert() {
    if (!tenantId || !form.montant || !form.libelle || !form.source_id || !form.dest_id) return
    setSaving(true)
    try {
      const montant = parseInt(form.montant)
      const frais = parseInt(form.frais || '0')
      const srcLabel = getLabel(form.source_type, form.source_id)
      const dstLabel = getLabel(form.dest_type, form.dest_id)

      // Check balance
      const srcList = getAccountList(form.source_type)
      const srcAcc = srcList.find(a => a.id === form.source_id)
      if (srcAcc && srcAcc.solde < montant + frais) {
        alert(`Solde insuffisant. Disponible: ${fmtFCFA(srcAcc.solde)}`)
        setSaving(false)
        return
      }

      const { data: tr, error } = await supabase.from('transferts').insert({
        tenant_id: tenantId,
        date_transfert: form.date_transfert,
        libelle: form.libelle || `Transfert ${srcLabel} → ${dstLabel}`,
        montant,
        frais,
        source_type: form.source_type,
        source_id: form.source_id,
        source_label: srcLabel,
        dest_type: form.dest_type,
        dest_id: form.dest_id,
        dest_label: dstLabel,
        statut: 'exécuté',
        reference: form.reference,
        notes: form.notes,
      }).select('id').single()

      if (error) throw error

      // OHADA double entry — source credit, dest debit
      const srcOhada = TYPE_OHADA[form.source_type]
      const dstOhada = TYPE_OHADA[form.dest_type]
      const libelle = form.libelle || `Transfert interne ${srcLabel} → ${dstLabel}`

      await writeComptaEntry({
        tenantId,
        date: form.date_transfert,
        libelle,
        type: 'depense',
        montant,
        categorie: 'transfert',
        debitAccount: dstOhada,
        creditAccount: srcOhada,
        source: 'transfert',
        sourceId: tr?.id,
      })

      // Frais OHADA entry
      if (frais > 0) {
        await writeComptaEntry({
          tenantId,
          date: form.date_transfert,
          libelle: `Frais transfert — ${libelle}`,
          type: 'depense',
          montant: frais,
          categorie: 'frais_bancaires',
          debitAccount: '631',
          creditAccount: srcOhada,
          source: 'transfert',
          sourceId: tr?.id,
        })
      }

      // Update balances
      if (form.source_type === 'banque' && form.source_id) {
        const cb = banques.find(b => b.id === form.source_id)
        if (cb) await supabase.from('comptes_bancaires').update({ solde: cb.solde - montant - frais }).eq('id', form.source_id)
      } else if (form.source_type === 'caisse' && form.source_id) {
        const ca = caisses.find(c => c.id === form.source_id)
        if (ca) await supabase.from('caisses').update({ solde: ca.solde - montant - frais }).eq('id', form.source_id)
      } else if (form.source_id) {
        const wa = wallets.find(w => w.id === form.source_id)
        if (wa) await supabase.from('wallets').update({ solde: wa.solde - montant - frais }).eq('id', form.source_id)
      }

      if (form.dest_type === 'banque' && form.dest_id) {
        const cb = banques.find(b => b.id === form.dest_id)
        if (cb) await supabase.from('comptes_bancaires').update({ solde: cb.solde + montant }).eq('id', form.dest_id)
      } else if (form.dest_type === 'caisse' && form.dest_id) {
        const ca = caisses.find(c => c.id === form.dest_id)
        if (ca) await supabase.from('caisses').update({ solde: ca.solde + montant }).eq('id', form.dest_id)
      } else if (form.dest_id) {
        const wa = wallets.find(w => w.id === form.dest_id)
        if (wa) await supabase.from('wallets').update({ solde: wa.solde + montant }).eq('id', form.dest_id)
      }

      setForm({ ...EMPTY_FORM })
      setShowModal(false)
      await load()
    } catch (e: unknown) {
      alert('Erreur: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  const filtered = rows.filter(r => {
    if (dateFrom && r.date_transfert < dateFrom) return false
    const q = search.toLowerCase()
    if (q && !r.libelle?.toLowerCase().includes(q) && !r.source_label?.toLowerCase().includes(q) && !r.dest_label?.toLowerCase().includes(q)) return false
    return true
  })

  function exportCSV() {
    const lines = ['Date,Libellé,Source,Destination,Montant,Frais,Statut,Référence']
    filtered.forEach(r => {
      lines.push([r.date_transfert, `"${r.libelle}"`, `"${r.source_label}"`, `"${r.dest_label}"`,
        r.montant, r.frais, r.statut, r.reference].join(','))
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `transferts_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  function AccountSelect({ label, typeKey, idKey }: { label: string; typeKey: 'source_type' | 'dest_type'; idKey: 'source_id' | 'dest_id' }) {
    const type = form[typeKey] as CompteType
    const accounts = getAccountList(type)
    return (
      <div className="space-y-2">
        <label className="block text-xs font-medium text-[#374151]">{label}</label>
        <div className="flex gap-2">
          <select value={type}
            onChange={e => setForm(f => ({ ...f, [typeKey]: e.target.value as CompteType, [idKey]: '' }))}
            className="w-28 border border-[#E2E8F0] rounded-xl px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
            <option value="banque">Banque</option>
            <option value="caisse">Caisse</option>
            <option value="mobile">Mobile</option>
            <option value="wallet">Wallet</option>
          </select>
          <select value={form[idKey]}
            onChange={e => setForm(f => ({ ...f, [idKey]: e.target.value }))}
            className="flex-1 border border-[#E2E8F0] rounded-xl px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0891B2]">
            <option value="">— Sélectionner —</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.label} ({fmtFCFA(a.solde)})</option>
            ))}
          </select>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <GitMerge size={20} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">{t('treso.transfers.title')}</h1>
            <p className="text-xs text-[#64748B]">{t('treso.transfers.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">
            <Download size={14} /> Exporter
          </button>
          <button onClick={() => { setForm({ ...EMPTY_FORM }); setShowModal(true) }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 shadow-sm">
            <Plus size={14} /> {t('treso.transfers.new')}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
          <div className="text-xs text-[#64748B] font-medium mb-2">Transféré ce mois</div>
          <div className="text-xl font-bold text-[#0F172A]">{fmtFCFA(totalMois)}</div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
          <div className="text-xs text-[#64748B] font-medium mb-2">Total transferts exécutés</div>
          <div className="text-xl font-bold text-[#0F172A]">{rows.filter(r => r.statut === 'exécuté').length}</div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
          <div className="text-xs text-[#64748B] font-medium mb-2">Frais totaux</div>
          <div className="text-xl font-bold text-red-500">{fmtFCFA(totalFrais)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('treso.transfers.searchPlh')}
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar size={12} className="text-[#94A3B8]" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-[#E2E8F0] rounded-xl px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E8F0]">
          <span className="text-sm font-semibold text-[#0F172A]">{filtered.length} transfert{filtered.length > 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#0891B2]" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#94A3B8]">
            <GitMerge size={32} className="mb-2 opacity-30" />
            <p className="text-sm font-medium">{t('treso.transfers.empty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {['Date', 'Source', '', 'Destination', 'Montant', 'Frais', 'Statut', ''].map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const SrcIcon = TYPE_ICONS[r.source_type] ?? Building2
                  const DstIcon = TYPE_ICONS[r.dest_type] ?? Building2
                  return (
                    <tr key={r.id} className={`border-t border-[#F1F5F9] hover:bg-[#F8FAFC] ${i % 2 === 0 ? '' : 'bg-[#FAFBFC]'}`}>
                      <td className="px-4 py-3 text-xs text-[#64748B] whitespace-nowrap">
                        {new Date(r.date_transfert).toLocaleDateString(intlLocale)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <SrcIcon size={12} className="text-[#64748B]" />
                          <div>
                            <div className="text-xs font-medium text-[#0F172A]">{r.source_label || r.source_type}</div>
                            <div className="text-[10px] text-[#94A3B8] capitalize">{r.source_type}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3"><ArrowRight size={14} className="text-[#94A3B8]" /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <DstIcon size={12} className="text-[#64748B]" />
                          <div>
                            <div className="text-xs font-medium text-[#0F172A]">{r.dest_label || r.dest_type}</div>
                            <div className="text-[10px] text-[#94A3B8] capitalize">{r.dest_type}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-purple-600">{fmtFCFA(r.montant)}</td>
                      <td className="px-4 py-3 text-xs text-[#64748B]">{r.frais > 0 ? fmtFCFA(r.frais) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-semibold ${STATUT_COLORS[r.statut] ?? ''}`}>{r.statut}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelected(r)} className="p-1 hover:bg-[#F1F5F9] rounded-lg">
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

      {/* Detail */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0F172A]">Détail du transfert</h3>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-[#F1F5F9] rounded-xl"><X size={16} /></button>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 flex items-center justify-between">
              <div className="text-center">
                <div className="text-[10px] text-[#64748B] mb-1 capitalize">{selected.source_type}</div>
                <div className="text-xs font-semibold text-[#0F172A]">{selected.source_label}</div>
              </div>
              <div className="flex flex-col items-center">
                <ArrowRight size={20} className="text-purple-500" />
                <div className="text-xs font-bold text-purple-600 mt-1">{fmtFCFA(selected.montant)}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-[#64748B] mb-1 capitalize">{selected.dest_type}</div>
                <div className="text-xs font-semibold text-[#0F172A]">{selected.dest_label}</div>
              </div>
            </div>
            <div className="space-y-2">
              {[
                ['Date', new Date(selected.date_transfert).toLocaleDateString(intlLocale)],
                ['Libellé', selected.libelle || '—'],
                ['Frais', selected.frais > 0 ? fmtFCFA(selected.frais) : '—'],
                ['Statut', selected.statut],
                ['Référence', selected.reference || '—'],
                ['Notes', selected.notes || '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-[#64748B]">{k}</span>
                  <span className="text-[#0F172A] font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0F172A]">Nouveau transfert interne</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-[#F1F5F9] rounded-xl"><X size={16} /></button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Date *</label>
                  <input type="date" value={form.date_transfert} onChange={e => setForm(f => ({ ...f, date_transfert: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Montant (FCFA) *</label>
                  <input type="number" value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
                    placeholder="0"
                    className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
                </div>
              </div>

              <AccountSelect label="Compte source *" typeKey="source_type" idKey="source_id" />

              <div className="flex items-center gap-2 py-1">
                <div className="flex-1 h-px bg-[#E2E8F0]" />
                <div className="flex items-center gap-1 px-3 py-1 bg-purple-50 rounded-full">
                  <ArrowRight size={12} className="text-purple-500" />
                  <span className="text-[10px] font-semibold text-purple-600">Transfert</span>
                </div>
                <div className="flex-1 h-px bg-[#E2E8F0]" />
              </div>

              <AccountSelect label="Compte destination *" typeKey="dest_type" idKey="dest_id" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">Frais (FCFA)</label>
                  <input type="number" value={form.frais} onChange={e => setForm(f => ({ ...f, frais: e.target.value }))}
                    placeholder="0"
                    className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">{t('common.reference')}</label>
                  <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                    placeholder="Réf. interne"
                    className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Libellé</label>
                <input value={form.libelle} onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))}
                  placeholder="Motif du transfert (optionnel)"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Observations…"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2] resize-none" />
              </div>
            </div>

            {form.source_id && form.dest_id && form.montant && (
              <div className="bg-purple-50 rounded-xl p-3 text-xs text-purple-800">
                <div className="font-semibold mb-1">Résumé de l'opération :</div>
                <div>Débit <strong>{TYPE_OHADA[form.dest_type]}</strong> ({form.dest_type}) + {fmtFCFA(parseInt(form.montant || '0'))}</div>
                <div>Crédit <strong>{TYPE_OHADA[form.source_type]}</strong> ({form.source_type}) - {fmtFCFA(parseInt(form.montant || '0'))}</div>
                {parseInt(form.frais || '0') > 0 && <div>Frais 627000 - {fmtFCFA(parseInt(form.frais || '0'))}</div>}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">{t('common.cancel')}</button>
              <button onClick={saveTransfert} disabled={saving || !form.montant || !form.source_id || !form.dest_id}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 disabled:opacity-50">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Exécuter le transfert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
