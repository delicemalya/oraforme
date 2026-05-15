'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Plus, Minus, TrendingUp, TrendingDown, Wallet, X, Loader2,
  BookOpen, ChevronDown, ChevronUp, Settings2, Smartphone,
} from 'lucide-react'
import { MOBILE_MONEY_MODES } from '@/lib/erp-core'
import { fmtFCFA } from '@/lib/admin-config'
import {
  OHADA_ACCOUNTS, resolveAccounts, accountLabel,
  setOpeningBalance, getOpeningBalance,
  type AccountCode,
} from '@/lib/accounting-engine'

type Transaction = {
  id: string
  type: 'entree' | 'sortie'
  categorie: string
  description: string
  montant: number
  date: string
  mode_paiement: string
  debit_account?: string
  credit_account?: string
  source?: string
  created_at: string
}

const CATS_ENTREE = ['Vente', 'Facture payée', 'Prestation', 'Avance client', 'Virement reçu', 'Remboursement', 'Autre']
const CATS_SORTIE = ['Salaires', 'CNSS', 'Loyer', 'Achats', 'Carburant', 'Taxes', 'Charges', 'Autre']
const MODES = ['Espèces', 'Airtel Money', 'MTN MoMo', 'Virement', 'Carte']
const PERIODES = [
  { label: "Aujourd'hui", days: 0 },
  { label: 'Cette semaine', days: 7 },
  { label: 'Ce mois', days: 30 },
  { label: 'Tout', days: 365 },
]

const TRESORERIE_ACCOUNTS = OHADA_ACCOUNTS.filter(a =>
  ['tresorerie', 'actif', 'passif', 'charge', 'produit'].includes(a.type)
)

export default function TresoreriePage() {
  const { tenantId, loading: tLoading } = useTenant()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [periode, setPeriode] = useState(30)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showOpeningBalance, setShowOpeningBalance] = useState(false)
  const [openingBalance, setOpeningBalanceValue] = useState(0)
  const [openingYear] = useState(new Date().getFullYear())
  const [savingOB, setSavingOB] = useState(false)
  const [showAccounting, setShowAccounting] = useState(false)

  const [form, setForm] = useState({
    type: 'entree' as 'entree' | 'sortie',
    categorie: 'Vente',
    description: '',
    montant: '',
    date: new Date().toISOString().split('T')[0],
    mode_paiement: 'Espèces',
    debit_account: '' as AccountCode,
    credit_account: '' as AccountCode,
  })

  const load = useCallback(async () => {
    if (!tenantId) return
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 365)
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('date', cutoff.toISOString().split('T')[0])
      .order('date', { ascending: false })
    setTransactions(data ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    if (!tLoading && tenantId) {
      load()
      getOpeningBalance(tenantId, openingYear).then(setOpeningBalanceValue)
    }
  }, [tLoading, tenantId, load, openingYear])

  // Auto-resolve accounts when type/category changes
  useEffect(() => {
    const [d, c] = resolveAccounts(form.type, form.categorie)
    setForm(f => ({ ...f, debit_account: d, credit_account: c }))
  }, [form.type, form.categorie])

  const now = new Date()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - (periode === 0 ? 0 : periode))
  const cutoffStr = periode === 0
    ? now.toISOString().split('T')[0]
    : cutoff.toISOString().split('T')[0]

  const filtered = transactions.filter(t =>
    periode === 365 ? true : t.date >= cutoffStr
  )

  const totalEntrees = filtered.filter(t => t.type === 'entree').reduce((s, t) => s + t.montant, 0)
  const totalSorties = filtered.filter(t => t.type === 'sortie').reduce((s, t) => s + t.montant, 0)
  const solde = openingBalance + totalEntrees - totalSorties

  const chartData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    const dayStr = d.toISOString().split('T')[0]
    const entrées = transactions.filter(t => t.type === 'entree' && t.date === dayStr).reduce((s, t) => s + t.montant, 0)
    const sorties = transactions.filter(t => t.type === 'sortie' && t.date === dayStr).reduce((s, t) => s + t.montant, 0)
    return { day: i % 5 === 0 ? `${d.getDate()}/${d.getMonth() + 1}` : '', entrées, sorties }
  })
  let cumul = openingBalance
  const chartWithCumul = chartData.map(d => {
    cumul += d.entrées - d.sorties
    return { ...d, solde: cumul }
  })

  async function save() {
    if (!form.description || !form.montant || !tenantId) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('transactions').insert({
      tenant_id:      tenantId,
      type:           form.type,
      categorie:      form.categorie,
      description:    form.description,
      montant:        parseInt(form.montant),
      date:           form.date,
      mode_paiement:  form.mode_paiement,
      source:         'tresorerie',
      debit_account:  form.debit_account || undefined,
      credit_account: form.credit_account || undefined,
      created_by:     user?.id,
    })

    setShowModal(false)
    setForm({
      type: 'entree', categorie: 'Vente', description: '', montant: '',
      date: new Date().toISOString().split('T')[0], mode_paiement: 'Espèces',
      debit_account: '', credit_account: '',
    })
    setSaving(false)
    load()
  }

  async function saveOpeningBalance() {
    if (!tenantId) return
    setSavingOB(true)
    await setOpeningBalance({ tenant_id: tenantId, annee: openingYear, solde_ouverture: openingBalance })
    setSavingOB(false)
    setShowOpeningBalance(false)
    load()
  }

  return (
    <div className="space-y-6">

      {/* Hero solde card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="sm:col-span-1 relative rounded-2xl p-5 overflow-hidden"
          style={{ background: solde >= 0 ? 'linear-gradient(135deg,#4C1D95 0%,#6D28D9 50%,#7C3AED 100%)' : 'linear-gradient(135deg,#7C1D1D 0%,#B91C1C 50%,#EF4444 100%)' }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.12) 0%, transparent 60%)' }} />
          <div className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <Wallet size={16} className="text-white" />
          </div>
          <div className="relative">
            <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wider mb-2">Solde Actuel</p>
            <p className="text-white text-3xl font-bold leading-none mb-1">{fmtFCFA(solde)}</p>
            {openingBalance !== 0 && (
              <p className="text-white/50 text-[10px] mb-1">Report N-1: {fmtFCFA(openingBalance)}</p>
            )}
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15">
              {solde >= 0 ? <TrendingUp size={10} className="text-white" /> : <TrendingDown size={10} className="text-white" />}
              <span className="text-white text-[10px] font-bold">{solde >= 0 ? 'Positif' : 'Déficit'}</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.07 }}
          className="relative rounded-2xl p-5 overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#065F46 0%,#059669 50%,#10B981 100%)' }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.12) 0%, transparent 60%)' }} />
          <div className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <TrendingUp size={16} className="text-white" />
          </div>
          <div className="relative">
            <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wider mb-2">Entrées</p>
            <p className="text-white text-2xl font-bold leading-none mb-1">{fmtFCFA(totalEntrees)}</p>
            <p className="text-white/50 text-[10px]">{filtered.filter(t => t.type === 'entree').length} transactions</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.14 }}
          className="relative rounded-2xl p-5 overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#7C1D1D 0%,#B91C1C 50%,#EF4444 100%)' }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.12) 0%, transparent 60%)' }} />
          <div className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <TrendingDown size={16} className="text-white" />
          </div>
          <div className="relative">
            <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wider mb-2">Sorties</p>
            <p className="text-white text-2xl font-bold leading-none mb-1">{fmtFCFA(totalSorties)}</p>
            <p className="text-white/50 text-[10px]">{filtered.filter(t => t.type === 'sortie').length} transactions</p>
          </div>
        </motion.div>
      </div>

      {/* Mobile Money summary */}
      {(() => {
        const mmIn  = filtered.filter(t => t.type === 'entree' && MOBILE_MONEY_MODES.includes(t.mode_paiement)).reduce((s, t) => s + t.montant, 0)
        const mmOut = filtered.filter(t => t.type === 'sortie' && MOBILE_MONEY_MODES.includes(t.mode_paiement)).reduce((s, t) => s + t.montant, 0)
        const mmCount = filtered.filter(t => MOBILE_MONEY_MODES.includes(t.mode_paiement)).length
        if (mmCount === 0) return null
        return (
          <div className="flex items-center gap-3 px-4 py-3 bg-[#161B22] border border-[#30363D] rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-[#F97316]/10 flex items-center justify-center shrink-0">
              <Smartphone size={15} className="text-[#F97316]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#E6EDF3]">Mobile Money</p>
              <p className="text-[10px] text-[#484F58]">{mmCount} transaction{mmCount > 1 ? 's' : ''} via Airtel Money / MTN MoMo</p>
            </div>
            <div className="flex gap-4 text-xs">
              <span className="text-[#2EA043] font-medium">+{fmtFCFA(mmIn)}</span>
              {mmOut > 0 && <span className="text-[#F85149] font-medium">-{fmtFCFA(mmOut)}</span>}
            </div>
          </div>
        )
      })()}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={() => { setForm(f => ({ ...f, type: 'entree', categorie: 'Vente' })); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2EA043] text-white text-sm font-medium hover:bg-[#2EA043]/90 transition-colors"
        >
          <Plus size={15} /> Entrée d&apos;argent
        </button>
        <button
          onClick={() => { setForm(f => ({ ...f, type: 'sortie', categorie: 'Salaires' })); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F85149]/10 border border-[#F85149]/30 text-[#F85149] text-sm font-medium hover:bg-[#F85149]/20 transition-colors"
        >
          <Minus size={15} /> Sortie d&apos;argent
        </button>
        <button
          onClick={() => setShowOpeningBalance(v => !v)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#21262D] border border-[#30363D] text-[#8B949E] text-sm hover:text-[#E6EDF3] transition-colors"
        >
          <Settings2 size={14} /> Solde N-1 {openingBalance !== 0 && <span className="text-[#F0A30A] text-xs">{fmtFCFA(openingBalance)}</span>}
        </button>
        <div className="ml-auto flex gap-1">
          {PERIODES.map(p => (
            <button
              key={p.days}
              onClick={() => setPeriode(p.days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                periode === p.days
                  ? 'bg-[#F0A30A]/10 text-[#F0A30A] border border-[#F0A30A]/30'
                  : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#21262D]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Opening balance panel */}
      <AnimatePresence>
        {showOpeningBalance && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-[#161B22] border border-[#F0A30A]/30 rounded-xl p-5 overflow-hidden"
          >
            <h3 className="text-sm font-semibold text-[#E6EDF3] mb-1">
              Solde d&apos;ouverture — Exercice {openingYear}
            </h3>
            <p className="text-xs text-[#8B949E] mb-4">
              Saisissez le solde de trésorerie au 1er janvier {openingYear} (report de l&apos;année N-1).
              Ce montant s&apos;ajoute aux mouvements de l&apos;exercice pour calculer le solde réel.
            </p>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs text-[#8B949E] mb-1 block">Solde N-1 (FCFA)</label>
                <input
                  type="number"
                  value={openingBalance}
                  onChange={e => setOpeningBalanceValue(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] outline-none focus:border-[#F0A30A]/50"
                />
              </div>
              <button
                onClick={saveOpeningBalance}
                disabled={savingOB}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#F0A30A] text-[#0D1117] hover:bg-[#F0A30A]/90 disabled:opacity-50 flex items-center gap-2"
              >
                {savingOB && <Loader2 size={13} className="animate-spin" />}
                Enregistrer
              </button>
              <button onClick={() => setShowOpeningBalance(false)} className="text-[#484F58] hover:text-[#8B949E]">
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chart */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#E6EDF3] mb-4">Flux de trésorerie — 30 derniers jours</h2>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartWithCumul} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262D" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: '#8B949E', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#8B949E', fontSize: 10 }} axisLine={false} tickLine={false} width={36}
              tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
            <Tooltip
              contentStyle={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#8B949E' }}
              /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
              formatter={(v: any, name: any) => [fmtFCFA(Number(v ?? 0)), name]}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#8B949E' }} />
            <Bar dataKey="entrées" fill="#2EA043" radius={[2, 2, 0, 0]} maxBarSize={14} />
            <Bar dataKey="sorties" fill="#F85149" radius={[2, 2, 0, 0]} maxBarSize={14} />
            <Line type="monotone" dataKey="solde" name="Solde cumulé" stroke="#388BFD" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Transactions list */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl">
        <div className="px-5 py-4 border-b border-[#30363D] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#E6EDF3]">Transactions récentes</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAccounting(v => !v)}
              className="flex items-center gap-1 text-xs text-[#484F58] hover:text-[#8B949E] transition-colors"
            >
              <BookOpen size={12} />
              {showAccounting ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Comptes
            </button>
            <span className="text-xs text-[#484F58]">{filtered.length} opération{filtered.length > 1 ? 's' : ''}</span>
          </div>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 size={20} className="animate-spin text-[#484F58]" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[#484F58] text-sm">Aucune transaction</p>
            <p className="text-[#30363D] text-xs mt-1">Commencez par enregistrer une entrée ou sortie</p>
          </div>
        ) : (
          <div className="divide-y divide-[#21262D]">
            {filtered.slice(0, 50).map(t => (
              <div key={t.id} className="flex items-start gap-3 px-5 py-3 hover:bg-[#21262D]/30 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  t.type === 'entree' ? 'bg-[#2EA043]/10' : 'bg-[#F85149]/10'
                }`}>
                  {t.type === 'entree'
                    ? <TrendingUp size={14} className="text-[#2EA043]" />
                    : <TrendingDown size={14} className="text-[#F85149]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#E6EDF3] truncate">{t.description}</p>
                  <p className="text-xs text-[#484F58]">{t.categorie} · {t.mode_paiement}
                    {t.source && t.source !== 'tresorerie' && (
                      <span className="ml-1 text-[#388BFD]">· {t.source}</span>
                    )}
                  </p>
                  {showAccounting && (t.debit_account || t.credit_account) && (
                    <p className="text-[10px] text-[#6E7681] mt-0.5 font-mono">
                      D: {t.debit_account ?? '—'} · C: {t.credit_account ?? '—'}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${t.type === 'entree' ? 'text-[#2EA043]' : 'text-[#F85149]'}`}>
                    {t.type === 'entree' ? '+' : '-'}{fmtFCFA(t.montant)}
                  </p>
                  <p className="text-xs text-[#484F58]">
                    {new Date(t.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
              </div>
            ))}
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
              className="relative bg-[#161B22] border border-[#30363D] rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
              <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-[#484F58] hover:text-[#8B949E]">
                <X size={16} />
              </button>
              <h3 className="text-base font-bold text-[#E6EDF3] mb-4">Nouvelle transaction</h3>

              {/* Type toggle */}
              <div className="flex gap-2 mb-4">
                {(['entree', 'sortie'] as const).map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, type: t, categorie: t === 'entree' ? 'Vente' : 'Salaires' }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      form.type === t
                        ? t === 'entree' ? 'bg-[#2EA043] text-white' : 'bg-[#F85149] text-white'
                        : 'bg-[#21262D] text-[#8B949E] hover:text-[#E6EDF3]'
                    }`}>
                    {t === 'entree' ? '+ Entrée' : '− Sortie'}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Catégorie</label>
                  <select value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}
                    className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] outline-none">
                    {(form.type === 'entree' ? CATS_ENTREE : CATS_SORTIE).map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Description</label>
                  <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Ex: Vente client Dupont..."
                    className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] placeholder-[#484F58] outline-none focus:border-[#F0A30A]/50" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Montant (FCFA)</label>
                    <input type="number" value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] placeholder-[#484F58] outline-none focus:border-[#F0A30A]/50" />
                  </div>
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Date</label>
                    <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] outline-none focus:border-[#F0A30A]/50" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Mode de paiement</label>
                  <select value={form.mode_paiement} onChange={e => setForm(f => ({ ...f, mode_paiement: e.target.value }))}
                    className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] outline-none">
                    {MODES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>

                {/* Accounting section */}
                <div className="border-t border-[#30363D] pt-3">
                  <p className="text-[10px] text-[#6E7681] uppercase tracking-wider mb-2 flex items-center gap-1">
                    <BookOpen size={10} /> Écriture comptable (OHADA)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#8B949E] mb-1 block">Compte débité</label>
                      <select
                        value={form.debit_account}
                        onChange={e => setForm(f => ({ ...f, debit_account: e.target.value }))}
                        className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-2 py-2 text-xs text-[#E6EDF3] outline-none"
                      >
                        {TRESORERIE_ACCOUNTS.map(a => (
                          <option key={a.number} value={a.number}>
                            {a.number} — {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-[#8B949E] mb-1 block">Compte crédité</label>
                      <select
                        value={form.credit_account}
                        onChange={e => setForm(f => ({ ...f, credit_account: e.target.value }))}
                        className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-2 py-2 text-xs text-[#E6EDF3] outline-none"
                      >
                        {TRESORERIE_ACCOUNTS.map(a => (
                          <option key={a.number} value={a.number}>
                            {a.number} — {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {form.debit_account && form.credit_account && (
                    <p className="text-[10px] text-[#484F58] mt-2 font-mono">
                      D {form.debit_account} / C {form.credit_account} — {fmtFCFA(parseInt(form.montant) || 0)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm bg-[#21262D] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] transition-colors">
                  Annuler
                </button>
                <button onClick={save} disabled={saving || !form.description || !form.montant}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-[#F0A30A] text-[#0D1117] hover:bg-[#F0A30A]/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
