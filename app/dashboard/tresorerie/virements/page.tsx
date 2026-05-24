'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  ArrowRightLeft, Plus, Check, X, Clock, Loader2,
  ChevronLeft, Search, Filter, Building2,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Virement {
  id: string
  compte_source_id: string | null
  compte_dest_id:   string | null
  montant:          number
  libelle:          string
  date_virement:    string
  reference:        string | null
  statut:           'en_attente' | 'execute' | 'rejete'
  created_at:       string
  direction:        string | null
  comptes_bancaires?: { intitule: string; banque: string } | null
  comptes_dest?:     { intitule: string; banque: string } | null
}

interface CompteBancaire {
  id: string
  intitule: string
  banque: string
  solde: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFCFA(n: number) {
  return new Intl.NumberFormat('fr-CG', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUT_BADGE: Record<string, { label: string; cls: string }> = {
  en_attente: { label: 'En attente', cls: 'bg-yellow-100 text-yellow-800' },
  execute:    { label: 'Exécuté',    cls: 'bg-green-100 text-green-800'  },
  rejete:     { label: 'Rejeté',     cls: 'bg-red-100 text-red-800'      },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VirementsPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const [virements, setVirements]       = useState<Virement[]>([])
  const [comptes, setComptes]           = useState<CompteBancaire[]>([])
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')
  const [success, setSuccess]           = useState('')
  const [showForm, setShowForm]         = useState(false)
  const [filterStatut, setFilterStatut] = useState<string>('all')
  const [search, setSearch]             = useState('')

  // Form state
  const [form, setForm] = useState({
    compte_source_id: '', compte_dest_id: '',
    montant: '', libelle: '', date_virement: new Date().toISOString().slice(0, 10),
    reference: '',
  })

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [{ data: v }, { data: c }] = await Promise.all([
      supabase.from('virements').select('*').eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }).limit(100),
      supabase.from('comptes_bancaires').select('id, intitule, banque, solde')
        .eq('tenant_id', tenantId).eq('actif', true),
    ])
    setVirements(v || [])
    setComptes(c || [])
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
    setSaving(true)
    const { error: err } = await supabase.from('virements').insert({
      tenant_id:        tenantId,
      compte_source_id: form.compte_source_id || null,
      compte_dest_id:   form.compte_dest_id   || null,
      montant:          Number(form.montant),
      libelle:          form.libelle.trim(),
      date_virement:    form.date_virement,
      reference:        form.reference || null,
      statut:           'en_attente',
    })
    setSaving(false)
    if (err) { notify(err.message, true); return }
    notify('Virement créé ✓')
    setShowForm(false)
    setForm({ compte_source_id: '', compte_dest_id: '', montant: '', libelle: '', date_virement: new Date().toISOString().slice(0, 10), reference: '' })
    load()
  }

  const handleExecute = async (id: string) => {
    if (!confirm('Exécuter ce virement ?')) return
    const { error: err } = await supabase.from('virements')
      .update({ statut: 'execute', date_execution: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId)
    if (err) { notify(err.message, true); return }
    notify('Virement exécuté ✓')
    load()
  }

  const handleReject = async (id: string) => {
    if (!confirm('Rejeter ce virement ?')) return
    const { error: err } = await supabase.from('virements')
      .update({ statut: 'rejete' }).eq('id', id).eq('tenant_id', tenantId)
    if (err) { notify(err.message, true); return }
    notify('Virement rejeté')
    load()
  }

  const filtered = virements.filter(v => {
    const matchStatut = filterStatut === 'all' || v.statut === filterStatut
    const matchSearch = !search ||
      v.libelle.toLowerCase().includes(search.toLowerCase()) ||
      (v.reference || '').toLowerCase().includes(search.toLowerCase())
    return matchStatut && matchSearch
  })

  const totals = {
    attente: virements.filter(v => v.statut === 'en_attente').reduce((s, v) => s + v.montant, 0),
    execute: virements.filter(v => v.statut === 'execute').reduce((s, v) => s + v.montant, 0),
  }

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/tresorerie"
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Virements</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Ordres de virement bancaire
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium text-sm transition-opacity hover:opacity-90"
          style={{ background: 'var(--primary)' }}>
          <Plus className="w-4 h-4" /> Nouveau virement
        </button>
      </div>

      {/* Alerts */}
      {error   && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}
      {success && <div className="p-3 rounded-xl bg-green-50 text-green-700 text-sm border border-green-200">{success}</div>}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-2xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>En attente</p>
          <p className="text-xl font-bold text-yellow-600">{fmtFCFA(totals.attente)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            {virements.filter(v => v.statut === 'en_attente').length} virement(s)
          </p>
        </div>
        <div className="rounded-2xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Exécutés (total)</p>
          <p className="text-xl font-bold" style={{ color: 'var(--success)' }}>{fmtFCFA(totals.execute)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            {virements.filter(v => v.statut === 'execute').length} virement(s)
          </p>
        </div>
        <div className="rounded-2xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Comptes bancaires</p>
          <p className="text-xl font-bold" style={{ color: 'var(--info)' }}>{comptes.length}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>comptes actifs</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm border outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          />
        </div>
        <select
          value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm border outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <option value="all">Tous statuts</option>
          <option value="en_attente">En attente</option>
          <option value="execute">Exécuté</option>
          <option value="rejete">Rejeté</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>Date</th>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>Libellé</th>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>Référence</th>
              <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--text-secondary)' }}>Montant</th>
              <th className="px-4 py-3 text-center font-semibold" style={{ color: 'var(--text-secondary)' }}>Statut</th>
              <th className="px-4 py-3 text-center font-semibold" style={{ color: 'var(--text-secondary)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center" style={{ color: 'var(--text-secondary)' }}>
                  <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Aucun virement
                </td>
              </tr>
            )}
            {filtered.map((v, i) => {
              const badge = STATUT_BADGE[v.statut] || { label: v.statut, cls: 'bg-gray-100 text-gray-700' }
              return (
                <tr key={v.id}
                  className="border-t transition-colors hover:bg-gray-50"
                  style={{ borderColor: 'var(--border)', background: i % 2 === 0 ? 'var(--surface)' : 'transparent' }}>
                  <td className="px-4 py-3" style={{ color: 'var(--text)' }}>{fmtDate(v.date_virement)}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>{v.libelle}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{v.reference || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--text)' }}>{fmtFCFA(v.montant)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badge.cls}`}>
                      {v.statut === 'en_attente' && <Clock className="w-3 h-3" />}
                      {v.statut === 'execute'    && <Check className="w-3 h-3" />}
                      {v.statut === 'rejete'     && <X    className="w-3 h-3" />}
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {v.statut === 'en_attente' && (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleExecute(v.id)}
                          className="px-3 py-1 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-80"
                          style={{ background: 'var(--success)' }}>
                          Exécuter
                        </button>
                        <button
                          onClick={() => handleReject(v.id)}
                          className="px-3 py-1 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                          style={{ background: 'var(--danger)', color: 'white' }}>
                          Rejeter
                        </button>
                      </div>
                    )}
                    {v.statut !== 'en_attente' && (
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-lg rounded-2xl shadow-2xl" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Nouveau virement</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Compte source</label>
                  <select
                    value={form.compte_source_id} onChange={e => setForm(f => ({ ...f, compte_source_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                    <option value="">— Aucun —</option>
                    {comptes.map(c => <option key={c.id} value={c.id}>{c.intitule} ({c.banque})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Compte destination</label>
                  <select
                    value={form.compte_dest_id} onChange={e => setForm(f => ({ ...f, compte_dest_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                    <option value="">— Externe —</option>
                    {comptes.map(c => <option key={c.id} value={c.id}>{c.intitule} ({c.banque})</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Libellé *</label>
                <input
                  type="text" required value={form.libelle} onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))}
                  placeholder="Ex: Paiement fournisseur XYZ"
                  className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Montant (FCFA) *</label>
                  <input
                    type="number" required min="1" value={form.montant}
                    onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Date virement</label>
                  <input
                    type="date" value={form.date_virement} onChange={e => setForm(f => ({ ...f, date_virement: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Référence bancaire</label>
                <input
                  type="text" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                  placeholder="N° ordre de virement (optionnel)"
                  className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
                />
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
                  Créer le virement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
