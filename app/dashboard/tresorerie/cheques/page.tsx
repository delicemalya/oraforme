'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  FileCheck, Plus, Check, X, Clock, Loader2,
  ChevronLeft, Search, AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Cheque {
  id: string
  numero_cheque: string
  beneficiaire:  string
  montant:       number
  date_emission: string
  date_echeance: string | null
  date_encaissement: string | null
  banque:        string | null
  motif:         string | null
  statut:        'en_attente' | 'encaisse' | 'rejete' | 'annule'
  created_at:    string
}

interface CompteBancaire {
  id: string; intitule: string; banque: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFCFA(n: number) {
  return new Intl.NumberFormat('fr-CG', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUT_BADGE: Record<string, { label: string; cls: string }> = {
  en_attente: { label: 'En attente',  cls: 'bg-yellow-100 text-yellow-800' },
  encaisse:   { label: 'Encaissé',    cls: 'bg-green-100 text-green-800'   },
  rejete:     { label: 'Rejeté',      cls: 'bg-red-100 text-red-800'       },
  annule:     { label: 'Annulé',      cls: 'bg-gray-100 text-gray-600'     },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChequesPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const [cheques, setCheques]           = useState<Cheque[]>([])
  const [comptes, setComptes]           = useState<CompteBancaire[]>([])
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')
  const [success, setSuccess]           = useState('')
  const [showForm, setShowForm]         = useState(false)
  const [filterStatut, setFilterStatut] = useState('all')
  const [search, setSearch]             = useState('')

  const [form, setForm] = useState({
    numero_cheque: '', beneficiaire: '', montant: '',
    date_emission: new Date().toISOString().slice(0, 10),
    date_echeance: '', banque: '', motif: '', compte_bancaire_id: '',
  })

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [{ data: c }, { data: cb }] = await Promise.all([
      supabase.from('cheques').select('*').eq('tenant_id', tenantId)
        .order('date_emission', { ascending: false }).limit(100),
      supabase.from('comptes_bancaires').select('id, intitule, banque')
        .eq('tenant_id', tenantId).eq('actif', true),
    ])
    setCheques(c || [])
    setComptes(cb || [])
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
    const { error: err } = await supabase.from('cheques').insert({
      tenant_id:          tenantId,
      numero_cheque:      form.numero_cheque.trim(),
      beneficiaire:       form.beneficiaire.trim(),
      montant:            Number(form.montant),
      date_emission:      form.date_emission,
      date_echeance:      form.date_echeance || null,
      banque:             form.banque        || null,
      motif:              form.motif         || null,
      compte_bancaire_id: form.compte_bancaire_id || null,
      statut:             'en_attente',
    })
    setSaving(false)
    if (err) { notify(err.message, true); return }
    notify('Chèque enregistré ✓')
    setShowForm(false)
    setForm({ numero_cheque: '', beneficiaire: '', montant: '', date_emission: new Date().toISOString().slice(0, 10), date_echeance: '', banque: '', motif: '', compte_bancaire_id: '' })
    load()
  }

  const handleEncaisser = async (id: string) => {
    if (!confirm('Marquer ce chèque comme encaissé ?')) return
    const { error: err } = await supabase.from('cheques')
      .update({ statut: 'encaisse', date_encaissement: new Date().toISOString().slice(0, 10) })
      .eq('id', id).eq('tenant_id', tenantId)
    if (err) { notify(err.message, true); return }
    notify('Chèque encaissé ✓')
    load()
  }

  const handleRejeter = async (id: string) => {
    if (!confirm('Marquer ce chèque comme rejeté ?')) return
    const { error: err } = await supabase.from('cheques')
      .update({ statut: 'rejete' }).eq('id', id).eq('tenant_id', tenantId)
    if (err) { notify(err.message, true); return }
    notify('Chèque marqué rejeté')
    load()
  }

  const filtered = cheques.filter(c => {
    const matchStatut = filterStatut === 'all' || c.statut === filterStatut
    const matchSearch = !search ||
      c.numero_cheque.toLowerCase().includes(search.toLowerCase()) ||
      c.beneficiaire.toLowerCase().includes(search.toLowerCase()) ||
      (c.motif || '').toLowerCase().includes(search.toLowerCase())
    return matchStatut && matchSearch
  })

  const isEcheanceDepassee = (c: Cheque) =>
    c.statut === 'en_attente' && c.date_echeance && new Date(c.date_echeance) < new Date()

  const totals = {
    attente: cheques.filter(c => c.statut === 'en_attente').reduce((s, c) => s + c.montant, 0),
    encaisse: cheques.filter(c => c.statut === 'encaisse').reduce((s, c) => s + c.montant, 0),
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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Chèques</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Suivi des chèques émis et reçus
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium text-sm transition-opacity hover:opacity-90"
          style={{ background: 'var(--primary)' }}>
          <Plus className="w-4 h-4" /> Nouveau chèque
        </button>
      </div>

      {error   && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}
      {success && <div className="p-3 rounded-xl bg-green-50 text-green-700 text-sm border border-green-200">{success}</div>}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'En attente', val: fmtFCFA(totals.attente), sub: `${cheques.filter(c => c.statut === 'en_attente').length} chèque(s)`, cls: 'text-yellow-600' },
          { label: 'Encaissés',  val: fmtFCFA(totals.encaisse), sub: `${cheques.filter(c => c.statut === 'encaisse').length} chèque(s)`, cls: 'text-green-600' },
          { label: 'Rejetés',    val: `${cheques.filter(c => c.statut === 'rejete').length}`, sub: 'chèque(s) rejeté(s)', cls: 'text-red-600' },
          { label: 'Échus',      val: `${cheques.filter(isEcheanceDepassee).length}`, sub: 'chèque(s) en retard', cls: 'text-orange-600' },
        ].map((k, i) => (
          <div key={i} className="rounded-2xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{k.label}</p>
            <p className={`text-xl font-bold ${k.cls}`}>{k.val}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text" placeholder="N° chèque, bénéficiaire…" value={search}
            onChange={e => setSearch(e.target.value)}
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
          <option value="encaisse">Encaissé</option>
          <option value="rejete">Rejeté</option>
          <option value="annule">Annulé</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              {['N° Chèque', 'Bénéficiaire', 'Banque', 'Émission', 'Échéance', 'Montant', 'Statut', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center" style={{ color: 'var(--text-secondary)' }}>
                  <FileCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Aucun chèque
                </td>
              </tr>
            )}
            {filtered.map((c, i) => {
              const badge = STATUT_BADGE[c.statut] || { label: c.statut, cls: 'bg-gray-100 text-gray-700' }
              const echu  = isEcheanceDepassee(c)
              return (
                <tr key={c.id}
                  className="border-t transition-colors hover:bg-gray-50"
                  style={{ borderColor: 'var(--border)', background: i % 2 === 0 ? 'var(--surface)' : 'transparent' }}>
                  <td className="px-4 py-3 font-mono font-medium" style={{ color: 'var(--text)' }}>{c.numero_cheque}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>{c.beneficiaire}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{c.banque || '—'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{fmtDate(c.date_emission)}</td>
                  <td className="px-4 py-3">
                    <span className={echu ? 'text-orange-600 font-medium' : ''} style={!echu ? { color: 'var(--text-secondary)' } : {}}>
                      {fmtDate(c.date_echeance)}
                      {echu && <AlertTriangle className="inline w-3 h-3 ml-1" />}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text)' }}>{fmtFCFA(c.montant)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.statut === 'en_attente' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEncaisser(c.id)}
                          className="px-3 py-1 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-80"
                          style={{ background: 'var(--success)' }}>
                          Encaisser
                        </button>
                        <button
                          onClick={() => handleRejeter(c.id)}
                          className="px-3 py-1 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-80"
                          style={{ background: 'var(--danger)' }}>
                          Rejeter
                        </button>
                      </div>
                    )}
                    {c.statut !== 'en_attente' && (
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
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Enregistrer un chèque</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>N° Chèque *</label>
                  <input type="text" required value={form.numero_cheque}
                    onChange={e => setForm(f => ({ ...f, numero_cheque: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Banque</label>
                  <input type="text" value={form.banque}
                    onChange={e => setForm(f => ({ ...f, banque: e.target.value }))}
                    placeholder="BGFI, LCB…"
                    className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Bénéficiaire *</label>
                <input type="text" required value={form.beneficiaire}
                  onChange={e => setForm(f => ({ ...f, beneficiaire: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg)' }} />
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
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Date émission</label>
                  <input type="date" value={form.date_emission}
                    onChange={e => setForm(f => ({ ...f, date_emission: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Date échéance</label>
                  <input type="date" value={form.date_echeance}
                    onChange={e => setForm(f => ({ ...f, date_echeance: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Compte bancaire</label>
                  <select value={form.compte_bancaire_id}
                    onChange={e => setForm(f => ({ ...f, compte_bancaire_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                    <option value="">— Aucun —</option>
                    {comptes.map(c => <option key={c.id} value={c.id}>{c.intitule} ({c.banque})</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Motif</label>
                <input type="text" value={form.motif}
                  onChange={e => setForm(f => ({ ...f, motif: e.target.value }))}
                  placeholder="Objet du paiement (optionnel)"
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
