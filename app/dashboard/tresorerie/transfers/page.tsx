'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  GitMerge, Plus, Check, X, Loader2, ChevronLeft,
  ArrowRight, Building2, Wallet, Smartphone,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Transfer {
  id: string
  source_type: 'banque' | 'caisse' | 'mobile'
  source_id:   string | null
  dest_type:   'banque' | 'caisse' | 'mobile'
  dest_id:     string | null
  montant:     number
  libelle:     string
  date_transfer: string
  statut:      string
  created_at:  string
}

interface CompteBancaire { id: string; intitule: string; banque: string }
interface Caisse          { id: string; nom: string }
interface Wallet          { id: string; operateur: string; numero: string; intitule: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFCFA(n: number) {
  return new Intl.NumberFormat('fr-CG', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  banque: <Building2 className="w-4 h-4" />,
  caisse: <Wallet    className="w-4 h-4" />,
  mobile: <Smartphone className="w-4 h-4" />,
}
const TYPE_LABELS = { banque: 'Banque', caisse: 'Caisse', mobile: 'Mobile Money' }

// ── Component ─────────────────────────────────────────────────────────────────

export default function TransfersPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [comptes, setComptes]     = useState<CompteBancaire[]>([])
  const [caisses, setCaisses]     = useState<Caisse[]>([])
  const [wallets, setWallets]     = useState<Wallet[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  const [showForm, setShowForm]   = useState(false)

  const [form, setForm] = useState({
    source_type: 'caisse' as 'banque' | 'caisse' | 'mobile',
    source_id:   '',
    dest_type:   'banque'  as 'banque' | 'caisse' | 'mobile',
    dest_id:     '',
    montant:     '',
    libelle:     '',
    date_transfer: new Date().toISOString().slice(0, 10),
  })

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [{ data: t }, { data: cb }, { data: ca }, { data: w }] = await Promise.all([
      supabase.from('transfers').select('*').eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }).limit(100),
      supabase.from('comptes_bancaires').select('id, intitule, banque').eq('tenant_id', tenantId).eq('actif', true),
      supabase.from('caisses').select('id, nom').eq('tenant_id', tenantId).eq('actif', true),
      supabase.from('mobile_money_wallets').select('id, operateur, numero, intitule').eq('tenant_id', tenantId).eq('actif', true),
    ])
    setTransfers(t || [])
    setComptes(cb || [])
    setCaisses(ca || [])
    setWallets(w  || [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (!tenantLoading) load() }, [tenantLoading, load])

  const notify = (msg: string, isErr = false) => {
    if (isErr) { setError(msg); setTimeout(() => setError(''), 4000) }
    else       { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId) return
    if (form.source_type === form.dest_type && form.source_id === form.dest_id) {
      notify('Source et destination identiques', true); return
    }
    setSaving(true)
    const { error: err } = await supabase.from('transfers').insert({
      tenant_id:     tenantId,
      source_type:   form.source_type,
      source_id:     form.source_id || null,
      dest_type:     form.dest_type,
      dest_id:       form.dest_id   || null,
      montant:       Number(form.montant),
      libelle:       form.libelle.trim(),
      date_transfer: form.date_transfer,
      statut:        'execute',
    })
    setSaving(false)
    if (err) { notify(err.message, true); return }
    notify('Transfert enregistré ✓')
    setShowForm(false)
    setForm({ source_type: 'caisse', source_id: '', dest_type: 'banque', dest_id: '', montant: '', libelle: '', date_transfer: new Date().toISOString().slice(0, 10) })
    load()
  }

  const getOptionsForType = (type: 'banque' | 'caisse' | 'mobile') => {
    if (type === 'banque') return comptes.map(c => ({ id: c.id, label: `${c.intitule} — ${c.banque}` }))
    if (type === 'caisse') return caisses.map(c => ({ id: c.id, label: c.nom }))
    return wallets.map(w => ({ id: w.id, label: `${w.intitule} (${w.operateur} ${w.numero})` }))
  }

  const totalTransfere = transfers.reduce((s, t) => s + t.montant, 0)

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/tresorerie" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Transferts inter-comptes</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Mouvements entre banque, caisse et mobile money
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium text-sm transition-opacity hover:opacity-90"
          style={{ background: 'var(--primary)' }}>
          <Plus className="w-4 h-4" /> Nouveau transfert
        </button>
      </div>

      {error   && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}
      {success && <div className="p-3 rounded-xl bg-green-50 text-green-700 text-sm border border-green-200">{success}</div>}

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Total transféré</p>
          <p className="text-xl font-bold" style={{ color: 'var(--primary)' }}>{fmtFCFA(totalTransfere)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{transfers.length} transfert(s)</p>
        </div>
        <div className="rounded-2xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Comptes banque</p>
          <p className="text-xl font-bold" style={{ color: 'var(--info)' }}>{comptes.length}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>comptes actifs</p>
        </div>
        <div className="rounded-2xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Caisses + Wallets</p>
          <p className="text-xl font-bold" style={{ color: 'var(--success)' }}>{caisses.length + wallets.length}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>comptes locaux</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              {['Date', 'Libellé', 'De', 'Vers', 'Montant'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transfers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center" style={{ color: 'var(--text-secondary)' }}>
                  <GitMerge className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Aucun transfert enregistré
                </td>
              </tr>
            )}
            {transfers.map((t, i) => (
              <tr key={t.id}
                className="border-t transition-colors hover:bg-gray-50"
                style={{ borderColor: 'var(--border)', background: i % 2 === 0 ? 'var(--surface)' : 'transparent' }}>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{fmtDate(t.date_transfer)}</td>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>{t.libelle}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    {TYPE_ICONS[t.source_type]}
                    {TYPE_LABELS[t.source_type as keyof typeof TYPE_LABELS]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                    {TYPE_ICONS[t.dest_type]}
                    {TYPE_LABELS[t.dest_type as keyof typeof TYPE_LABELS]}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text)' }}>{fmtFCFA(t.montant)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-lg rounded-2xl shadow-2xl" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Nouveau transfert inter-comptes</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {/* Source */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Source (depuis)</label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {(['caisse', 'banque', 'mobile'] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => setForm(f => ({ ...f, source_type: t, source_id: '' }))}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border-2 transition-all ${form.source_type === t ? 'border-current' : 'border-transparent bg-gray-50'}`}
                      style={form.source_type === t ? { borderColor: 'var(--primary)', color: 'var(--primary)', background: '#FEF3C7' } : { color: 'var(--text-secondary)' }}>
                      {TYPE_ICONS[t]} {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
                <select value={form.source_id} onChange={e => setForm(f => ({ ...f, source_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                  <option value="">— Sélectionner —</option>
                  {getOptionsForType(form.source_type).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>

              <div className="flex items-center justify-center">
                <ArrowRight className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
              </div>

              {/* Destination */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Destination (vers)</label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {(['caisse', 'banque', 'mobile'] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => setForm(f => ({ ...f, dest_type: t, dest_id: '' }))}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border-2 transition-all ${form.dest_type === t ? 'border-current' : 'border-transparent bg-gray-50'}`}
                      style={form.dest_type === t ? { borderColor: 'var(--info)', color: 'var(--info)', background: '#EFF6FF' } : { color: 'var(--text-secondary)' }}>
                      {TYPE_ICONS[t]} {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
                <select value={form.dest_id} onChange={e => setForm(f => ({ ...f, dest_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                  <option value="">— Sélectionner —</option>
                  {getOptionsForType(form.dest_type).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Montant (FCFA) *</label>
                  <input type="number" required min="1" value={form.montant}
                    onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Date</label>
                  <input type="date" value={form.date_transfer}
                    onChange={e => setForm(f => ({ ...f, date_transfer: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Libellé *</label>
                <input type="text" required value={form.libelle}
                  onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))}
                  placeholder="Objet du transfert"
                  className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg)' }} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors hover:bg-gray-50"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
