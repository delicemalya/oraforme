'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { motion, AnimatePresence } from 'framer-motion'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Receipt, Plus, X, Loader2, TrendingDown, TrendingUp, BookOpen, Trash2 } from 'lucide-react'
import { fmtFCFA } from '@/lib/admin-config'
import { resolveAccounts, accountLabel } from '@/lib/accounting-engine'

type Depense = {
  id: string
  categorie: string
  description: string
  montant: number
  date: string
  mode_paiement: string
  created_at: string
}
type CostCenter = { id: string; code: string; nom: string }

const CATEGORIES = [
  { id: 'carburant',    label: '🚗 Carburant & Transport',       color: '#F51E33' },
  { id: 'loyer',        label: '🏠 Loyer & Charges locatives',    color: '#8B0070' },
  { id: 'electricite',  label: '💡 Électricité & Eau',           color: '#F51E33' },
  { id: 'telephone',    label: '📱 Téléphone & Internet',        color: '#F51E33' },
  { id: 'salaires',     label: '👥 Salaires & RH',               color: '#8B0070' },
  { id: 'fournitures',  label: '🛒 Achats & Fournitures',        color: '#142850' },
  { id: 'sante',        label: '🏥 Santé & Assurances',          color: '#142850' },
  { id: 'taxes',        label: '📊 Taxes & Impôts',              color: '#F51E33' },
  { id: 'maintenance',  label: '🔧 Maintenance & Réparations',   color: '#84CC16' },
  { id: 'marketing',    label: '📢 Marketing & Communication',   color: '#F51E33' },
  { id: 'voyages',      label: '✈️ Voyages & Déplacements',      color: '#F51E33' },
  { id: 'autre',        label: '📦 Autre',                       color: '#484F58' },
]

const MODES = ['Espèces', 'Airtel Money', 'MTN MoMo', 'Virement', 'Carte']

export default function DepensesPage() {
  const { tenantId, loading: tLoading } = useTenant()
  const [depenses,     setDepenses]     = useState<Depense[]>([])
  const [costCenters,  setCostCenters]  = useState<CostCenter[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [periode,      setPeriode]      = useState(30)
  // OHADA account mapping per depense category
  const CAT_ACCOUNTS: Record<string, [string, string]> = {
    carburant:    ['601000', '571000'],
    loyer:        ['651000', '571000'],
    electricite:  ['651000', '571000'],
    telephone:    ['651000', '571000'],
    salaires:     ['641000', '571000'],
    fournitures:  ['601000', '571000'],
    sante:        ['651000', '571000'],
    taxes:        ['441000', '521000'],
    maintenance:  ['651000', '571000'],
    marketing:    ['651000', '571000'],
    voyages:      ['601000', '571000'],
    autre:        ['651000', '571000'],
  }

  const [form, setForm] = useState({
    categorie: 'carburant',
    description: '',
    montant: '',
    date: new Date().toISOString().split('T')[0],
    mode_paiement: 'Espèces',
    reference_piece: '',
    cost_center_id: '',
    debit_account: '601000',
    credit_account: '571000',
  })

  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!tenantId) return
    const [{ data: dep }, { data: cc }] = await Promise.all([
      supabase.from('depenses').select('*').eq('tenant_id', tenantId).order('date', { ascending: false }),
      supabase.from('cost_centers').select('id, code, nom').eq('tenant_id', tenantId).order('code'),
    ])
    setDepenses(dep ?? [])
    setCostCenters(cc ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (!tLoading && tenantId) load() }, [tLoading, tenantId, load])

  async function save() {
    if (!form.description || !form.montant || !tenantId) return
    setSaving(true)
    const montant = parseInt(form.montant)

    // fn_create_depense() is SECURITY DEFINER → écrit depense + transaction
    // atomiquement côté serveur, même pour les utilisateurs non-financiers
    const { error } = await supabase.rpc('fn_create_depense', {
      p_categorie:      form.categorie,
      p_description:    form.description,
      p_montant:        montant,
      p_date:           form.date,
      p_mode_paiement:  form.mode_paiement,
      p_reference:      form.reference_piece || null,
      p_cost_center_id: form.cost_center_id  || null,
      p_debit_account:  form.debit_account,
      p_credit_account: form.credit_account,
    })

    if (error) {
      console.error('fn_create_depense error:', error.message)
      setSaving(false)
      return
    }

    setShowModal(false)
    setForm({
      categorie: 'carburant', description: '', montant: '',
      date: new Date().toISOString().split('T')[0], mode_paiement: 'Espèces',
      reference_piece: '', cost_center_id: '', debit_account: '601000', credit_account: '571000',
    })
    setSaving(false)
    load()
  }

  async function deleteDepense(id: string) {
    if (!confirm('Supprimer cette dépense et la transaction associée ?')) return
    setDeleting(id)
    // fn_delete_depense() is SECURITY DEFINER → supprime depense + transaction liée
    await supabase.rpc('fn_delete_depense', { p_dep_id: id })
    setDeleting(null)
    load()
  }

  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - periode)
  const filtered = depenses.filter(d => new Date(d.date) >= cutoff)
  const totalMois = filtered.reduce((s, d) => s + d.montant, 0)
  const maxDepense = filtered.reduce((max, d) => d.montant > max.montant ? d : max, filtered[0] ?? { description: '—', montant: 0 })
  const moyJour = filtered.length > 0 ? Math.round(totalMois / periode) : 0

  // Comparison with previous period
  const prevCutoff = new Date(); prevCutoff.setDate(prevCutoff.getDate() - periode * 2)
  const prevFiltered = depenses.filter(d => new Date(d.date) >= prevCutoff && new Date(d.date) < cutoff)
  const prevTotal = prevFiltered.reduce((s, d) => s + d.montant, 0)
  const varPct = prevTotal > 0 ? Math.round(((totalMois - prevTotal) / prevTotal) * 100) : 0

  // Pie chart data by category
  const byCat = CATEGORIES.map(c => ({
    name: c.label.split(' ').slice(1).join(' '),
    value: filtered.filter(d => d.categorie === c.id).reduce((s, d) => s + d.montant, 0),
    color: c.color,
  })).filter(c => c.value > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#F51E33]/10 border border-[#F51E33]/20 flex items-center justify-center">
          <Receipt size={18} className="text-[#F51E33]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Dépenses & Charges</h1>
          <p className="text-xs text-[var(--text-secondary)]">Suivi de toutes vos dépenses par catégorie</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-medium hover:bg-[#F51E33]/90 transition-colors">
          <Plus size={15} /> Dépense
        </button>
      </div>

      {/* Periode filter */}
      <div className="flex gap-1">
        {[{ label: '7 jours', days: 7 }, { label: '30 jours', days: 30 }, { label: '90 jours', days: 90 }].map(p => (
          <button key={p.days} onClick={() => setPeriode(p.days)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              periode === p.days ? 'bg-[#F51E33]/10 text-[#F51E33] border border-[#F51E33]/30' : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-white/5'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total période',       value: fmtFCFA(totalMois),   gradient: '#F51E33', icon: TrendingDown },
          { label: 'Plus grosse dépense', value: maxDepense.description !== '—' ? fmtFCFA(maxDepense.montant) : '—', gradient: '#F51E33', icon: Receipt },
          { label: 'Moyenne par jour',    value: fmtFCFA(moyJour),     gradient: '#8B0070', icon: Receipt },
          { label: 'Vs période préc.',    value: prevTotal > 0 ? `${varPct > 0 ? '+' : ''}${varPct}%` : '—', gradient: varPct > 0 ? '#F51E33' : '#142850', icon: varPct > 0 ? TrendingUp : TrendingDown },
        ].map(k => {
          const Icon = k.icon
          return (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2, scale: 1.01 }}
              className="relative rounded-xl p-4 overflow-hidden"
              style={{ background: k.gradient }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'transparent' }} />
              <div className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                <Icon size={12} className="text-white" />
              </div>
              <div className="relative">
                <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wider mb-1">{k.label}</p>
                <p className="text-white text-lg font-bold leading-none">{k.value}</p>
              </div>
            </motion.div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie chart */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[var(--text)] mb-4">Répartition par catégorie</h2>
          {byCat.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] text-center py-12">Aucune dépense sur la période</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byCat} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                  {byCat.map((c, i) => <Cell key={i} fill={c.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0f1e3d', border: '1px solid #30363D', borderRadius: 8, fontSize: 11 }}
                  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                  formatter={(v: any) => [fmtFCFA(Number(v ?? 0)), '']}
                />
                <Legend wrapperStyle={{ fontSize: 10, color: '#8B949E' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top categories */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[var(--text)] mb-4">Top catégories</h2>
          <div className="space-y-3">
            {byCat.slice(0, 6).map(c => (
              <div key={c.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[var(--text-secondary)] truncate">{c.name}</span>
                  <span className="text-[var(--text)] font-medium ml-2 shrink-0">
                    {fmtFCFA(c.value)} ({totalMois > 0 ? Math.round((c.value / totalMois) * 100) : 0}%)
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--surface-alt)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${totalMois > 0 ? (c.value / totalMois) * 100 : 0}%`, backgroundColor: c.color }} />
                </div>
              </div>
            ))}
            {byCat.length === 0 && <p className="text-sm text-[var(--text-secondary)] text-center py-6">Aucune dépense</p>}
          </div>
        </div>
      </div>

      {/* Liste */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text)]">Liste des dépenses</h2>
          <span className="text-xs text-[var(--text-secondary)]">{filtered.length} dépense{filtered.length > 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 size={18} className="animate-spin text-[var(--text-secondary)]" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-[var(--text-secondary)] text-sm">Aucune dépense sur la période</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filtered.slice(0, 50).map(d => {
              const cat = CATEGORIES.find(c => c.id === d.categorie)
              return (
                <div key={d.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/5/30 group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[var(--surface-alt)] text-base">
                    {cat?.label.split(' ')[0] ?? '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text)] truncate">{d.description}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{cat?.label.split(' ').slice(1).join(' ') ?? d.categorie} · {d.mode_paiement}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-[#F51E33]">-{fmtFCFA(d.montant)}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteDepense(d.id)}
                    disabled={deleting === d.id}
                    className="opacity-0 group-hover:opacity-100 ml-1 p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[#F51E33] hover:bg-[#F51E33]/10 transition-all"
                    title="Supprimer"
                  >
                    {deleting === d.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Trash2 size={13} />}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60" onClick={() => setShowModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
              <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-secondary)]"><X size={16} /></button>
              <h3 className="text-base font-bold text-[var(--text)] mb-4">Nouvelle dépense</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Catégorie</label>
                  <select value={form.categorie} onChange={e => {
                    const cat = e.target.value
                    const [d, c] = CAT_ACCOUNTS[cat] ?? ['651000', '571000']
                    setForm(f => ({ ...f, categorie: cat, debit_account: d, credit_account: c }))
                  }}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none">
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Description</label>
                  <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Description de la dépense..."
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#484F58] outline-none focus:border-[#F51E33]/50" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[var(--text-secondary)] mb-1 block">Montant (FCFA)</label>
                    <input type="number" value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#484F58] outline-none focus:border-[#F51E33]/50" />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-secondary)] mb-1 block">Date</label>
                    <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Mode de paiement</label>
                  <select value={form.mode_paiement} onChange={e => setForm(f => ({ ...f, mode_paiement: e.target.value }))}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none">
                    {MODES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                {costCenters.length > 0 && (
                  <div>
                    <label className="text-xs text-[var(--text-secondary)] mb-1 block">Centre de coût (facultatif)</label>
                    <select value={form.cost_center_id} onChange={e => setForm(f => ({ ...f, cost_center_id: e.target.value }))}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none">
                      <option value="">— Aucun centre —</option>
                      {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.code} — {cc.nom}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Réf. pièce (facultatif)</label>
                  <input value={form.reference_piece} onChange={e => setForm(f => ({ ...f, reference_piece: e.target.value }))}
                    placeholder="Ex: FAC-2025-001, BON-42..."
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[#484F58] outline-none focus:border-[#F51E33]/50" />
                </div>

                {/* Écriture OHADA */}
                <div className="border-t border-[var(--border)] pt-3">
                  <p className="text-[10px] text-[#6E7681] uppercase tracking-wider mb-2 flex items-center gap-1">
                    <BookOpen size={10} /> Écriture OHADA (auto-calculée)
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="bg-[var(--surface)] border border-[#142850]/20 rounded-lg px-3 py-2">
                      <p className="text-[var(--text-secondary)] mb-0.5">Débit</p>
                      <p className="text-[#F51E33] font-semibold">{form.debit_account}</p>
                      <p className="text-[var(--text-secondary)] text-[9px] truncate">{accountLabel(form.debit_account)}</p>
                    </div>
                    <div className="bg-[var(--surface)] border border-[#F51E33]/20 rounded-lg px-3 py-2">
                      <p className="text-[var(--text-secondary)] mb-0.5">Crédit</p>
                      <p className="text-[#F51E33] font-semibold">{form.credit_account}</p>
                      <p className="text-[var(--text-secondary)] text-[9px] truncate">{accountLabel(form.credit_account)}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)]">Annuler</button>
                <button onClick={save} disabled={saving || !form.description || !form.montant}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-white hover:bg-[#F51E33]/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={13} className="animate-spin" />} Enregistrer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
