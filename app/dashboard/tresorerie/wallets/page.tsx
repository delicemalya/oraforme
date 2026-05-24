'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  Smartphone, Plus, Check, X, Loader2, ChevronLeft,
  ArrowUpCircle, ArrowDownCircle, TrendingUp, Eye,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Wallet {
  id: string
  operateur: string
  numero: string
  intitule: string
  solde: number
  actif: boolean
  created_at: string
}

interface WalletOp {
  id: string
  wallet_id: string
  type: 'entree' | 'sortie' | 'frais'
  montant: number
  frais: number
  libelle: string
  reference: string | null
  date_operation: string
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFCFA(n: number) {
  return new Intl.NumberFormat('fr-CG', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const OPERATEUR_COLORS: Record<string, string> = {
  'Airtel Money': '#DC2626',
  'MTN Mobile Money': '#EAB308',
  'Orange Money': '#F97316',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WalletsPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const [wallets, setWallets]         = useState<Wallet[]>([])
  const [ops, setOps]                 = useState<WalletOp[]>([])
  const [selectedWallet, setSelected] = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState('')
  const [showAddWallet, setShowAddW]  = useState(false)
  const [showAddOp, setShowAddOp]     = useState(false)
  const [opType, setOpType]           = useState<'entree' | 'sortie'>('entree')

  const [walletForm, setWalletForm] = useState({ operateur: '', numero: '', intitule: '', solde_initial: '0' })
  const [opForm, setOpForm] = useState({ montant: '', libelle: '', frais: '0', reference: '', date_operation: new Date().toISOString().slice(0, 10) })

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase
      .from('mobile_money_wallets').select('*').eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    setWallets(data || [])
    setLoading(false)
  }, [tenantId])

  const loadOps = useCallback(async (walletId: string) => {
    const { data } = await supabase
      .from('mobile_wallet_operations').select('*').eq('wallet_id', walletId)
      .eq('tenant_id', tenantId!).order('created_at', { ascending: false }).limit(50)
    setOps(data || [])
  }, [tenantId])

  useEffect(() => { if (!tenantLoading) load() }, [tenantLoading, load])
  useEffect(() => { if (selectedWallet && tenantId) loadOps(selectedWallet) }, [selectedWallet, loadOps, tenantId])

  const notify = (msg: string, isErr = false) => {
    if (isErr) { setError(msg); setTimeout(() => setError(''), 4000) }
    else       { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  }

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId) return
    setSaving(true)
    const { error: err } = await supabase.from('mobile_money_wallets').insert({
      tenant_id: tenantId,
      operateur: walletForm.operateur.trim(),
      numero:    walletForm.numero.trim(),
      intitule:  walletForm.intitule.trim() || walletForm.operateur.trim(),
      solde:     Number(walletForm.solde_initial) || 0,
      actif:     true,
    })
    setSaving(false)
    if (err) { notify(err.message, true); return }
    notify('Wallet ajouté ✓')
    setShowAddW(false)
    setWalletForm({ operateur: '', numero: '', intitule: '', solde_initial: '0' })
    load()
  }

  const handleAddOp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId || !selectedWallet) return
    setSaving(true)
    const { error: err } = await supabase.from('mobile_wallet_operations').insert({
      tenant_id:      tenantId,
      wallet_id:      selectedWallet,
      type:           opType,
      montant:        Number(opForm.montant),
      frais:          Number(opForm.frais) || 0,
      libelle:        opForm.libelle.trim(),
      reference:      opForm.reference || null,
      date_operation: opForm.date_operation,
    })
    setSaving(false)
    if (err) { notify(err.message, true); return }
    notify('Opération enregistrée ✓')
    setShowAddOp(false)
    setOpForm({ montant: '', libelle: '', frais: '0', reference: '', date_operation: new Date().toISOString().slice(0, 10) })
    load()
    loadOps(selectedWallet)
  }

  const totalSolde = wallets.filter(w => w.actif).reduce((s, w) => s + w.solde, 0)
  const activeWallet = wallets.find(w => w.id === selectedWallet)

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
        <Link href="/dashboard/tresorerie" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Mobile Money</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Wallets Airtel, MTN, Orange…
          </p>
        </div>
        <button
          onClick={() => setShowAddW(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium text-sm transition-opacity hover:opacity-90"
          style={{ background: 'var(--primary)' }}>
          <Plus className="w-4 h-4" /> Ajouter wallet
        </button>
      </div>

      {error   && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}
      {success && <div className="p-3 rounded-xl bg-green-50 text-green-700 text-sm border border-green-200">{success}</div>}

      {/* Total */}
      <div className="rounded-2xl p-5 text-white" style={{ background: 'var(--primary)' }}>
        <p className="text-sm font-medium opacity-80">Solde total Mobile Money</p>
        <p className="text-3xl font-bold mt-1">{fmtFCFA(totalSolde)}</p>
        <p className="text-sm opacity-70 mt-1">{wallets.filter(w => w.actif).length} wallet(s) actif(s)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wallets List */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>MES WALLETS</h2>
          {wallets.length === 0 && (
            <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--border)' }}>
              <Smartphone className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Aucun wallet configuré</p>
            </div>
          )}
          {wallets.map(w => {
            const color = OPERATEUR_COLORS[w.operateur] || '#6366F1'
            const isSelected = selectedWallet === w.id
            return (
              <button key={w.id} onClick={() => setSelected(isSelected ? null : w.id)}
                className={`w-full text-left rounded-2xl border p-4 transition-all ${isSelected ? 'ring-2' : 'hover:bg-gray-50'}`}
                style={{
                  background: 'var(--surface)', borderColor: isSelected ? color : 'var(--border)',
                  ringColor: color,
                }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: color }}>
                    {w.operateur.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{w.intitule}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{w.operateur} · {w.numero}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm" style={{ color }}>{fmtFCFA(w.solde)}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${w.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {w.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Operations Panel */}
        <div>
          {!selectedWallet && (
            <div className="rounded-2xl border p-8 text-center h-full flex flex-col items-center justify-center"
              style={{ borderColor: 'var(--border)', borderStyle: 'dashed' }}>
              <Eye className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Sélectionner un wallet</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>pour voir ses opérations</p>
            </div>
          )}
          {selectedWallet && activeWallet && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  OPÉRATIONS — {activeWallet.intitule.toUpperCase()}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setOpType('entree'); setShowAddOp(true) }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium text-white"
                    style={{ background: 'var(--success)' }}>
                    <ArrowUpCircle className="w-3.5 h-3.5" /> Entrée
                  </button>
                  <button
                    onClick={() => { setOpType('sortie'); setShowAddOp(true) }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium text-white"
                    style={{ background: 'var(--danger)' }}>
                    <ArrowDownCircle className="w-3.5 h-3.5" /> Sortie
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                {ops.length === 0 && (
                  <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Aucune opération
                  </div>
                )}
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {ops.map(op => (
                    <div key={op.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                      style={{ background: 'var(--surface)' }}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${op.type === 'entree' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {op.type === 'entree'
                          ? <ArrowUpCircle className="w-4 h-4 text-green-600" />
                          : <ArrowDownCircle className="w-4 h-4 text-red-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{op.libelle}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {fmtDate(op.date_operation)}
                          {op.frais > 0 && ` · Frais: ${fmtFCFA(op.frais)}`}
                        </p>
                      </div>
                      <span className={`font-semibold text-sm ${op.type === 'entree' ? 'text-green-600' : 'text-red-600'}`}>
                        {op.type === 'entree' ? '+' : '-'}{fmtFCFA(op.montant)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Wallet Modal */}
      {showAddWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Nouveau wallet Mobile Money</h2>
              <button onClick={() => setShowAddW(false)} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleAddWallet} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Opérateur *</label>
                <select value={walletForm.operateur}
                  onChange={e => setWalletForm(f => ({ ...f, operateur: e.target.value }))}
                  required
                  className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                  <option value="">— Choisir —</option>
                  <option value="Airtel Money">Airtel Money</option>
                  <option value="MTN Mobile Money">MTN Mobile Money</option>
                  <option value="Orange Money">Orange Money</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Numéro *</label>
                <input type="text" required value={walletForm.numero}
                  onChange={e => setWalletForm(f => ({ ...f, numero: e.target.value }))}
                  placeholder="06 XXX XX XX"
                  className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Intitulé (nom)</label>
                <input type="text" value={walletForm.intitule}
                  onChange={e => setWalletForm(f => ({ ...f, intitule: e.target.value }))}
                  placeholder="Ex: Airtel principal"
                  className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Solde initial (FCFA)</label>
                <input type="number" min="0" value={walletForm.solde_initial}
                  onChange={e => setWalletForm(f => ({ ...f, solde_initial: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg)' }} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddW(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Operation Modal */}
      {showAddOp && selectedWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                  {opType === 'entree' ? '📥 Entrée' : '📤 Sortie'} — {activeWallet?.intitule}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Solde actuel: {fmtFCFA(activeWallet?.solde || 0)}</p>
              </div>
              <button onClick={() => setShowAddOp(false)} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleAddOp} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Montant (FCFA) *</label>
                  <input type="number" required min="1" value={opForm.montant}
                    onChange={e => setOpForm(f => ({ ...f, montant: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Frais (FCFA)</label>
                  <input type="number" min="0" value={opForm.frais}
                    onChange={e => setOpForm(f => ({ ...f, frais: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Libellé *</label>
                <input type="text" required value={opForm.libelle}
                  onChange={e => setOpForm(f => ({ ...f, libelle: e.target.value }))}
                  placeholder="Objet de l'opération"
                  className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg)' }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Référence</label>
                  <input type="text" value={opForm.reference}
                    onChange={e => setOpForm(f => ({ ...f, reference: e.target.value }))}
                    placeholder="N° transaction"
                    className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Date</label>
                  <input type="date" value={opForm.date_operation}
                    onChange={e => setOpForm(f => ({ ...f, date_operation: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddOp(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: opType === 'entree' ? 'var(--success)' : 'var(--danger)' }}>
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
