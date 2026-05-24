'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Wallet, Plus, TrendingUp, TrendingDown, RefreshCw,
  CheckCircle2, XCircle, Loader2, X, Filter, Download,
  Banknote, CreditCard, Smartphone, Building2, FileText,
} from 'lucide-react'

type Moyen = 'banque' | 'mobile_money' | 'cash' | 'cheque' | 'virement'
type TypeOp = 'entree' | 'sortie'
type Categorie = 'abonnement' | 'salaire' | 'infrastructure' | 'marketing' | 'remboursement' | 'investissement' | 'autre'

interface CaisseEntry {
  id: string
  type: TypeOp
  categorie: Categorie
  description: string
  montant: number
  moyen: Moyen
  reference?: string
  statut: 'valide' | 'annule'
  date_operation: string
  created_at: string
}

const MOYEN_ICONS: Record<Moyen, React.ReactNode> = {
  banque:       <Building2 size={13} className="text-blue-500" />,
  mobile_money: <Smartphone size={13} className="text-green-500" />,
  cash:         <Banknote size={13} className="text-amber-500" />,
  cheque:       <FileText size={13} className="text-purple-500" />,
  virement:     <CreditCard size={13} className="text-indigo-500" />,
}

const MOYEN_LABELS: Record<Moyen, string> = {
  banque: 'Banque', mobile_money: 'Mobile Money', cash: 'Cash', cheque: 'Chèque', virement: 'Virement',
}

const CAT_LABELS: Record<Categorie, string> = {
  abonnement: 'Abonnement client', salaire: 'Salaires', infrastructure: 'Infrastructure',
  marketing: 'Marketing', remboursement: 'Remboursement', investissement: 'Investissement', autre: 'Autre',
}

function fmtFCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function CaissePage() {
  const [entries, setEntries]   = useState<CaisseEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)
  const [filterType, setFilterType]   = useState<'all' | TypeOp>('all')
  const [filterMoyen, setFilterMoyen] = useState<'all' | Moyen>('all')

  // Form state
  const [form, setForm] = useState({
    type: 'entree' as TypeOp,
    categorie: 'abonnement' as Categorie,
    description: '',
    montant: '',
    moyen: 'banque' as Moyen,
    reference: '',
  })

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/finance/caisse')
      if (res.ok) {
        const data = await res.json()
        setEntries(data.entries ?? [])
      }
    } catch {
      // Table might not exist yet — show empty state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description || !form.montant) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/finance/caisse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, montant: parseFloat(form.montant) }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur')
      showToast('Opération enregistrée')
      setShowForm(false)
      setForm({ type: 'entree', categorie: 'abonnement', description: '', montant: '', moyen: 'banque', reference: '' })
      load()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erreur', false)
    } finally {
      setSaving(false)
    }
  }

  async function handleAnnuler(id: string) {
    try {
      const res = await fetch(`/api/admin/finance/caisse/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statut: 'annule' }) })
      if (!res.ok) throw new Error()
      showToast('Opération annulée')
      load()
    } catch {
      showToast('Erreur lors de l\'annulation', false)
    }
  }

  function exportCSV() {
    const rows = filtered.map(e => [
      fmtDate(e.date_operation), e.type, e.categorie, e.description, e.montant, e.moyen, e.reference ?? '', e.statut,
    ])
    const csv = [['Date', 'Type', 'Catégorie', 'Description', 'Montant', 'Moyen', 'Référence', 'Statut'], ...rows]
      .map(r => r.join(';'))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'caisse-oraforme.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = entries.filter(e => {
    if (filterType  !== 'all' && e.type  !== filterType)  return false
    if (filterMoyen !== 'all' && e.moyen !== filterMoyen) return false
    return true
  })

  const totalEntrees = entries.filter(e => e.type === 'entree' && e.statut === 'valide').reduce((s, e) => s + e.montant, 0)
  const totalSorties = entries.filter(e => e.type === 'sortie' && e.statut === 'valide').reduce((s, e) => s + e.montant, 0)
  const balance      = totalEntrees - totalSorties

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-[13px] font-semibold transition-all ${toast.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {toast.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Caisse & Liquidités</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestion des flux de trésorerie Oraforme</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-[12px] text-gray-600 hover:bg-gray-50 transition-colors">
            <Download size={13} /> Export CSV
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-[13px] font-semibold hover:bg-amber-600 transition-colors shadow-sm">
            <Plus size={14} /> Nouvelle opération
          </button>
        </div>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
              <TrendingUp size={15} className="text-green-600" />
            </div>
            <span className="text-[12px] font-semibold text-gray-500">Total Entrées</span>
          </div>
          <p className="text-[20px] font-bold text-green-700">{fmtFCFA(totalEntrees)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
              <TrendingDown size={15} className="text-red-600" />
            </div>
            <span className="text-[12px] font-semibold text-gray-500">Total Sorties</span>
          </div>
          <p className="text-[20px] font-bold text-red-600">{fmtFCFA(totalSorties)}</p>
        </div>
        <div className={`rounded-2xl border p-5 shadow-sm ${balance >= 0 ? 'bg-white border-amber-100' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${balance >= 0 ? 'bg-amber-50' : 'bg-red-100'}`}>
              <Wallet size={15} className={balance >= 0 ? 'text-amber-600' : 'text-red-600'} />
            </div>
            <span className="text-[12px] font-semibold text-gray-500">Solde Caisse</span>
          </div>
          <p className={`text-[20px] font-bold ${balance >= 0 ? 'text-amber-700' : 'text-red-700'}`}>{fmtFCFA(balance)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Filter size={13} className="text-gray-400" />
          <span className="text-[12px] text-gray-500 font-medium">Filtrer:</span>
        </div>
        {(['all', 'entree', 'sortie'] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${
              filterType === t ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            {t === 'all' ? 'Tout' : t === 'entree' ? '↑ Entrées' : '↓ Sorties'}
          </button>
        ))}
        <div className="h-4 w-px bg-gray-200" />
        {(['all', 'banque', 'mobile_money', 'cash', 'cheque', 'virement'] as const).map(m => (
          <button
            key={m}
            onClick={() => setFilterMoyen(m)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${
              filterMoyen === m ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            {m === 'all' ? 'Tous moyens' : MOYEN_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Entries table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-gray-900">Opérations ({filtered.length})</h2>
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
            <Wallet size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-[13px] text-gray-400 font-medium">Aucune opération</p>
            <p className="text-[12px] text-gray-300 mt-1">Créez votre première entrée ou sortie</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-gray-50">
                  {['Date', 'Type', 'Catégorie', 'Description', 'Moyen', 'Montant', 'Statut', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} className={`border-t border-gray-50 hover:bg-gray-50/50 transition-colors ${e.statut === 'annule' ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-2.5 text-[11px] text-gray-500 whitespace-nowrap">{fmtDate(e.date_operation)}</td>
                    <td className="px-5 py-2.5">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${e.type === 'entree' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                        {e.type === 'entree' ? '↑ Entrée' : '↓ Sortie'}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-[12px] text-gray-600">{CAT_LABELS[e.categorie]}</td>
                    <td className="px-5 py-2.5 text-[12px] text-gray-800 font-medium">{e.description}</td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {MOYEN_ICONS[e.moyen]}
                        <span className="text-[11px] text-gray-500">{MOYEN_LABELS[e.moyen]}</span>
                      </div>
                    </td>
                    <td className="px-5 py-2.5">
                      <span className={`text-[13px] font-bold ${e.type === 'entree' ? 'text-green-700' : 'text-red-600'}`}>
                        {e.type === 'entree' ? '+' : '-'}{fmtFCFA(e.montant)}
                      </span>
                    </td>
                    <td className="px-5 py-2.5">
                      {e.statut === 'valide'
                        ? <span className="text-[11px] font-semibold text-green-700">✓ Validé</span>
                        : <span className="text-[11px] font-semibold text-gray-400">Annulé</span>}
                    </td>
                    <td className="px-5 py-2.5">
                      {e.statut === 'valide' && (
                        <button
                          onClick={() => handleAnnuler(e.id)}
                          className="text-[11px] text-gray-400 hover:text-red-600 transition-colors"
                          title="Annuler"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New operation modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-[15px] font-bold text-gray-900">Nouvelle opération</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={15} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {/* Type */}
              <div>
                <label className="text-[12px] font-semibold text-gray-700 mb-1.5 block">Type d&apos;opération</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['entree', 'sortie'] as const).map(t => (
                    <button
                      key={t} type="button"
                      onClick={() => setForm(f => ({ ...f, type: t }))}
                      className={`py-2.5 rounded-xl border text-[13px] font-semibold transition-all ${
                        form.type === t
                          ? t === 'entree' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {t === 'entree' ? '↑ Entrée' : '↓ Sortie'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Catégorie */}
                <div>
                  <label className="text-[12px] font-semibold text-gray-700 mb-1.5 block">Catégorie</label>
                  <select
                    value={form.categorie}
                    onChange={e => setForm(f => ({ ...f, categorie: e.target.value as Categorie }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] text-gray-800 outline-none focus:border-amber-400"
                  >
                    {Object.entries(CAT_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>

                {/* Moyen */}
                <div>
                  <label className="text-[12px] font-semibold text-gray-700 mb-1.5 block">Moyen de paiement</label>
                  <select
                    value={form.moyen}
                    onChange={e => setForm(f => ({ ...f, moyen: e.target.value as Moyen }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] text-gray-800 outline-none focus:border-amber-400"
                  >
                    {Object.entries(MOYEN_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-[12px] font-semibold text-gray-700 mb-1.5 block">Description *</label>
                <input
                  required
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Ex: Paiement abonnement Entreprise X"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] text-gray-800 outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Montant */}
                <div>
                  <label className="text-[12px] font-semibold text-gray-700 mb-1.5 block">Montant (FCFA) *</label>
                  <input
                    required type="number" min="0" step="1"
                    value={form.montant}
                    onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
                    placeholder="Ex: 15000"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] text-gray-800 outline-none focus:border-amber-400"
                  />
                </div>

                {/* Référence */}
                <div>
                  <label className="text-[12px] font-semibold text-gray-700 mb-1.5 block">Référence (optionnel)</label>
                  <input
                    value={form.reference}
                    onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                    placeholder="N° reçu, virement…"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] text-gray-800 outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <button
                type="submit" disabled={saving}
                className="w-full py-3 rounded-xl bg-amber-500 text-white text-[14px] font-bold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                {saving ? 'Enregistrement…' : 'Enregistrer opération'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
