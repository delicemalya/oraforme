'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, Plus, ArrowRight, Loader2, X, CheckCircle2, XCircle,
  Building2, Smartphone, Banknote, CreditCard, AlertTriangle, Download,
} from 'lucide-react'

type CompteType = 'banque' | 'mobile_money' | 'caisse' | 'virement_externe'
type TransfertType = 'transfert' | 'remboursement_client' | 'remboursement_erreur' | 'remboursement_entreprise'

interface Transfert {
  id: string
  type: TransfertType
  source_type: CompteType
  dest_type: CompteType
  description: string
  montant: number
  reference?: string
  client_nom?: string
  motif_remboursement?: string
  statut: 'execute' | 'annule' | 'en_attente'
  date_operation: string
  created_at: string
}

const COMPTE_ICONS: Record<CompteType, React.ReactNode> = {
  banque:            <Building2 size={15} className="text-blue-500" />,
  mobile_money:      <Smartphone size={15} className="text-green-500" />,
  caisse:            <Banknote size={15} className="text-amber-500" />,
  virement_externe:  <CreditCard size={15} className="text-purple-500" />,
}

const COMPTE_LABELS: Record<CompteType, string> = {
  banque: 'Banque', mobile_money: 'Mobile Money', caisse: 'Caisse physique', virement_externe: 'Virement externe',
}

const TYPE_LABELS: Record<TransfertType, string> = {
  transfert: 'Transfert interne',
  remboursement_client: 'Remboursement client',
  remboursement_erreur: 'Remboursement erreur paiement',
  remboursement_entreprise: 'Remboursement entreprise',
}

const TYPE_COLORS: Record<TransfertType, string> = {
  transfert:               'bg-blue-50 text-blue-700 border-blue-200',
  remboursement_client:    'bg-orange-50 text-orange-700 border-orange-200',
  remboursement_erreur:    'bg-red-50 text-red-700 border-red-200',
  remboursement_entreprise:'bg-purple-50 text-purple-700 border-purple-200',
}

function fmtFCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const QUICK_FLOWS: Array<{ label: string; source: CompteType; dest: CompteType; color: string }> = [
  { label: 'Caisse → Banque',         source: 'caisse',       dest: 'banque',       color: '#3B82F6' },
  { label: 'Banque → Mobile Money',   source: 'banque',       dest: 'mobile_money', color: '#10B981' },
  { label: 'Mobile Money → Caisse',   source: 'mobile_money', dest: 'caisse',       color: '#F59E0B' },
  { label: 'Banque → Caisse',         source: 'banque',       dest: 'caisse',       color: '#8B5CF6' },
]

export default function TransfertsPage() {
  const [transferts, setTransferts] = useState<Transfert[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null)
  const [filterType, setFilterType] = useState<'all' | TransfertType>('all')

  const [form, setForm] = useState({
    type:          'transfert' as TransfertType,
    source_type:   'caisse' as CompteType,
    dest_type:     'banque' as CompteType,
    description:   '',
    montant:       '',
    reference:     '',
    client_nom:    '',
    motif_remboursement: '',
  })

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/finance/transferts')
      if (res.ok) {
        const data = await res.json()
        setTransferts(data.transferts ?? [])
      }
    } catch {
      // Table might not exist yet
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function applyQuickFlow(qf: typeof QUICK_FLOWS[number]) {
    setForm(f => ({ ...f, source_type: qf.source, dest_type: qf.dest }))
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description || !form.montant) return
    if (form.source_type === form.dest_type) {
      showToast('Source et destination ne peuvent pas être identiques', false)
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        montant: parseFloat(form.montant),
      }
      const res = await fetch('/api/admin/finance/transferts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur')
      showToast('Transfert enregistré avec succès')
      setShowForm(false)
      setForm({ type: 'transfert', source_type: 'caisse', dest_type: 'banque', description: '', montant: '', reference: '', client_nom: '', motif_remboursement: '' })
      load()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erreur', false)
    } finally {
      setSaving(false)
    }
  }

  function exportCSV() {
    const rows = filtered.map(t => [
      fmtDate(t.date_operation), TYPE_LABELS[t.type], COMPTE_LABELS[t.source_type], COMPTE_LABELS[t.dest_type],
      t.description, t.montant, t.reference ?? '', t.client_nom ?? '', t.statut,
    ])
    const csv = [['Date', 'Type', 'Source', 'Destination', 'Description', 'Montant', 'Référence', 'Client', 'Statut'], ...rows]
      .map(r => r.join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'transferts-oraforme.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = transferts.filter(t => filterType === 'all' || t.type === filterType)

  const totalTransferts   = transferts.filter(t => t.type === 'transfert' && t.statut !== 'annule').reduce((s, t) => s + t.montant, 0)
  const totalRemboursements = transferts.filter(t => t.type !== 'transfert' && t.statut !== 'annule').reduce((s, t) => s + t.montant, 0)
  const isRemboursement = form.type !== 'transfert'

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-[13px] font-semibold ${toast.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {toast.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Transferts & Remboursements</h1>
          <p className="text-sm text-gray-500 mt-0.5">Mouvements entre comptes et remboursements clients</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-[12px] text-gray-600 hover:bg-gray-50 transition-colors">
            <Download size={13} /> Export CSV
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-[13px] font-semibold hover:bg-amber-600 transition-colors shadow-sm">
            <Plus size={14} /> Nouveau transfert
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wide mb-1">Transferts internes</p>
          <p className="text-[20px] font-bold text-gray-900">{fmtFCFA(totalTransferts)}</p>
          <p className="text-[12px] text-gray-400 mt-1">{transferts.filter(t => t.type === 'transfert').length} opération(s)</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-[11px] font-bold text-orange-600 uppercase tracking-wide mb-1">Total remboursements</p>
          <p className="text-[20px] font-bold text-gray-900">{fmtFCFA(totalRemboursements)}</p>
          <p className="text-[12px] text-gray-400 mt-1">{transferts.filter(t => t.type !== 'transfert').length} remboursement(s)</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Total opérations</p>
          <p className="text-[20px] font-bold text-gray-900">{transferts.length}</p>
          <p className="text-[12px] text-gray-400 mt-1">{transferts.filter(t => t.statut === 'execute').length} exécutées</p>
        </div>
      </div>

      {/* Quick flows */}
      <div>
        <h2 className="text-[14px] font-bold text-gray-900 mb-3">Flux rapides</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {QUICK_FLOWS.map(qf => (
            <button
              key={qf.label}
              onClick={() => applyQuickFlow(qf)}
              className="flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all text-left group"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {COMPTE_ICONS[qf.source]}
                <ArrowRight size={12} className="text-gray-300 flex-shrink-0" />
                {COMPTE_ICONS[qf.dest]}
              </div>
              <p className="text-[11px] font-semibold text-gray-600 group-hover:text-gray-900 transition-colors">{qf.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'transfert', 'remboursement_client', 'remboursement_erreur', 'remboursement_entreprise'] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${
              filterType === t ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            {t === 'all' ? 'Tous' : TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-gray-900">Historique ({filtered.length})</h2>
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <RefreshCw size={13} className="text-gray-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-amber-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <RefreshCw size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-[13px] text-gray-400 font-medium">Aucun transfert</p>
            <p className="text-[12px] text-gray-300 mt-1">Utilisez les flux rapides ci-dessus pour commencer</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-gray-50">
                  {['Date', 'Type', 'De', 'Vers', 'Description', 'Montant', 'Statut'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-2.5 text-[11px] text-gray-500 whitespace-nowrap">{fmtDate(t.date_operation)}</td>
                    <td className="px-5 py-2.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TYPE_COLORS[t.type]}`}>
                        {TYPE_LABELS[t.type]}
                      </span>
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {COMPTE_ICONS[t.source_type]}
                        <span className="text-[11px] text-gray-600">{COMPTE_LABELS[t.source_type]}</span>
                      </div>
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {COMPTE_ICONS[t.dest_type]}
                        <span className="text-[11px] text-gray-600">{COMPTE_LABELS[t.dest_type]}</span>
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-[12px] text-gray-800 max-w-[200px] truncate">
                      {t.description}
                      {t.client_nom && <span className="ml-1 text-gray-400">— {t.client_nom}</span>}
                    </td>
                    <td className="px-5 py-2.5">
                      <span className="text-[13px] font-bold text-gray-900">{fmtFCFA(t.montant)}</span>
                    </td>
                    <td className="px-5 py-2.5">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        t.statut === 'execute' ? 'bg-green-50 text-green-700' :
                        t.statut === 'annule'  ? 'bg-gray-100 text-gray-400' :
                        'bg-yellow-50 text-yellow-700'
                      }`}>
                        {t.statut === 'execute' ? '✓ Exécuté' : t.statut === 'annule' ? 'Annulé' : 'En attente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h3 className="text-[15px] font-bold text-gray-900">Nouveau transfert / remboursement</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={15} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {/* Type */}
              <div>
                <label className="text-[12px] font-semibold text-gray-700 mb-1.5 block">Type d&apos;opération</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['transfert', 'remboursement_client', 'remboursement_erreur', 'remboursement_entreprise'] as const).map(t => (
                    <button
                      key={t} type="button"
                      onClick={() => setForm(f => ({ ...f, type: t }))}
                      className={`py-2 px-2 rounded-xl border text-[11px] font-semibold transition-all text-left ${
                        form.type === t ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Source → Dest visual */}
              <div>
                <label className="text-[12px] font-semibold text-gray-700 mb-1.5 block">Flux</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-400 block mb-1">Source</label>
                    <select
                      value={form.source_type}
                      onChange={e => setForm(f => ({ ...f, source_type: e.target.value as CompteType }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] outline-none focus:border-amber-400"
                    >
                      {Object.entries(COMPTE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-shrink-0 mt-5">
                    <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
                      <ArrowRight size={14} className="text-amber-500" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-400 block mb-1">Destination</label>
                    <select
                      value={form.dest_type}
                      onChange={e => setForm(f => ({ ...f, dest_type: e.target.value as CompteType }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] outline-none focus:border-amber-400"
                    >
                      {Object.entries(COMPTE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {form.source_type === form.dest_type && (
                  <p className="flex items-center gap-1.5 text-[11px] text-amber-600 mt-1.5">
                    <AlertTriangle size={11} /> Source et destination identiques
                  </p>
                )}
              </div>

              {/* Client name (if remboursement) */}
              {isRemboursement && (
                <div>
                  <label className="text-[12px] font-semibold text-gray-700 mb-1.5 block">Nom du client</label>
                  <input
                    value={form.client_nom}
                    onChange={e => setForm(f => ({ ...f, client_nom: e.target.value }))}
                    placeholder="Nom de l'entreprise ou personne"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] outline-none focus:border-amber-400"
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <label className="text-[12px] font-semibold text-gray-700 mb-1.5 block">Description *</label>
                <input
                  required
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={isRemboursement ? 'Motif du remboursement…' : 'Description du transfert…'}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-semibold text-gray-700 mb-1.5 block">Montant (FCFA) *</label>
                  <input
                    required type="number" min="1" step="1"
                    value={form.montant}
                    onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
                    placeholder="Ex: 50000"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-gray-700 mb-1.5 block">Référence</label>
                  <input
                    value={form.reference}
                    onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                    placeholder="N° virement, ticket…"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <button
                type="submit" disabled={saving || form.source_type === form.dest_type}
                className="w-full py-3 rounded-xl bg-amber-500 text-white text-[14px] font-bold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                {saving ? 'Enregistrement…' : 'Valider le transfert'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
