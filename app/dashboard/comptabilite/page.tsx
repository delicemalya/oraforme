'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Plus, BookOpen, X, Loader2, Download, Scale, List, BarChart2 } from 'lucide-react'
import { fmtFCFA } from '@/lib/admin-config'
import { OHADA_ACCOUNTS, resolveAccounts, accountLabel, type AccountCode } from '@/lib/accounting-engine'

type JournalEntry = {
  id: string
  date: string
  libelle: string
  type: 'recette' | 'depense'
  montant_ht: number
  tva: number
  ca: number
  montant_ttc: number
  categorie: string
  debit_account?: string
  credit_account?: string
  created_at: string
}

type DoubleEntry = {
  id: string
  date_operation: string
  libelle: string
  debit_account: string
  credit_account: string
  montant: number
  source?: string
  created_at: string
}

type GrandLivreLine = {
  account_number: string
  account_name: string
  account_type: string
  total_debit: number
  total_credit: number
  solde: number
}

const TABS = ['Journal', 'Partie double', 'Grand Livre', 'Rapport mensuel', 'Analyse MIAA+']
const CATS_RECETTE = ['Vente produit', 'Prestation service', 'Loyer reçu', 'Autre recette']
const CATS_DEPENSE = ['Achats', 'Salaires', 'Loyer', 'Charges', 'Taxes', 'Autre dépense']
const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

function calcTVACongo(ht: number) {
  const tva = Math.round(ht * 0.18)
  const ca  = Math.round(tva * 0.05)
  return { tva, ca, ttc: ht + tva + ca }
}

export default function ComptabilitePage() {
  const [tab, setTab] = useState(0)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [doubleEntries, setDoubleEntries] = useState<DoubleEntry[]>([])
  const [grandLivre, setGrandLivre] = useState<GrandLivreLine[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear] = useState(new Date().getFullYear())
  const [tenantId, setTenantId] = useState<string | null>(null)

  const [form, setForm] = useState({
    type: 'recette' as 'recette' | 'depense',
    libelle: '',
    montant_ht: '',
    categorie: CATS_RECETTE[0],
    date: new Date().toISOString().split('T')[0],
    debit_account: '' as AccountCode,
    credit_account: '' as AccountCode,
  })

  // Auto-resolve accounts from type/category
  useEffect(() => {
    const mappedType = form.type === 'recette' ? 'entree' : 'sortie'
    const catMap: Record<string, string> = {
      'Vente produit': 'Vente',
      'Prestation service': 'Prestation',
      'Salaires': 'Salaires',
      'Achats': 'Achats',
      'Loyer': 'Loyer',
      'Taxes': 'Taxes',
      'Charges': 'Charges',
    }
    const [d, c] = resolveAccounts(mappedType, catMap[form.categorie] ?? form.categorie)
    setForm(f => ({ ...f, debit_account: d, credit_account: c }))
  }, [form.type, form.categorie])

  const loadTenant = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase
      .from('profiles').select('tenant_id').eq('user_id', user.id).maybeSingle()
    setTenantId(profile?.tenant_id ?? null)
    return profile?.tenant_id ?? null
  }, [])

  const load = useCallback(async () => {
    const tid = tenantId ?? await loadTenant()
    if (!tid) return

    const [{ data: jc }, { data: je }] = await Promise.all([
      supabase.from('journal_comptable').select('*').eq('tenant_id', tid).order('date', { ascending: false }),
      supabase.from('journal_entries').select('*').eq('tenant_id', tid).order('date_operation', { ascending: false }).limit(500),
    ])

    setEntries(jc ?? [])
    setDoubleEntries(je ?? [])

    // Build grand livre from journal_entries
    const accountMap: Record<string, GrandLivreLine> = {}
    for (const e of (je ?? [])) {
      const accounts = OHADA_ACCOUNTS as readonly { number: string; name: string; type: string }[]

      if (!accountMap[e.debit_account]) {
        const found = accounts.find(a => a.number === e.debit_account)
        accountMap[e.debit_account] = {
          account_number: e.debit_account,
          account_name: found?.name ?? e.debit_account,
          account_type: found?.type ?? '—',
          total_debit: 0, total_credit: 0, solde: 0,
        }
      }
      if (!accountMap[e.credit_account]) {
        const found = accounts.find(a => a.number === e.credit_account)
        accountMap[e.credit_account] = {
          account_number: e.credit_account,
          account_name: found?.name ?? e.credit_account,
          account_type: found?.type ?? '—',
          total_debit: 0, total_credit: 0, solde: 0,
        }
      }
      accountMap[e.debit_account].total_debit  += e.montant
      accountMap[e.credit_account].total_credit += e.montant
    }
    const gl = Object.values(accountMap).map(a => ({
      ...a,
      solde: a.total_debit - a.total_credit,
    })).sort((a, b) => a.account_number.localeCompare(b.account_number))
    setGrandLivre(gl)

    setLoading(false)
  }, [tenantId, loadTenant])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!form.libelle || !form.montant_ht) return
    setSaving(true)
    const tid = tenantId ?? await loadTenant()
    if (!tid) { setSaving(false); return }

    const ht = parseInt(form.montant_ht)
    const { tva, ca, ttc } = calcTVACongo(form.type === 'recette' ? ht : 0)
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('journal_comptable').insert({
      tenant_id:    tid,
      date:         form.date,
      libelle:      form.libelle,
      type:         form.type,
      montant_ht:   ht,
      tva:          form.type === 'recette' ? tva : 0,
      ca:           form.type === 'recette' ? ca : 0,
      montant_ttc:  form.type === 'recette' ? ttc : ht,
      categorie:    form.categorie,
      debit_account:  form.debit_account || undefined,
      credit_account: form.credit_account || undefined,
      source:       'comptabilite',
      created_by:   user?.id,
    })

    // Also write a journal_entry for double-entry tracking
    if (form.debit_account && form.credit_account) {
      await supabase.from('journal_entries').insert({
        tenant_id:      tid,
        date_operation: form.date,
        libelle:        form.libelle,
        debit_account:  form.debit_account,
        credit_account: form.credit_account,
        montant:        ht,
        source:         'comptabilite',
        fiscal_year:    new Date(form.date).getFullYear(),
        created_by:     user?.id,
      })
    }

    setShowModal(false)
    setForm({ type: 'recette', libelle: '', montant_ht: '', categorie: CATS_RECETTE[0], date: new Date().toISOString().split('T')[0], debit_account: '', credit_account: '' })
    setSaving(false)
    load()
  }

  async function analyserMIAA() {
    setAiLoading(true)
    const totalRecettes = entries.filter(e => e.type === 'recette').reduce((s, e) => s + e.montant_ht, 0)
    const totalDepenses = entries.filter(e => e.type === 'depense').reduce((s, e) => s + e.montant_ht, 0)
    const benefice      = totalRecettes - totalDepenses
    const marge         = totalRecettes > 0 ? Math.round((benefice / totalRecettes) * 100) : 0

    const message = `Analyse ma comptabilité : Recettes HT = ${fmtFCFA(totalRecettes)}, Dépenses = ${fmtFCFA(totalDepenses)}, Bénéfice = ${fmtFCFA(benefice)}, Marge = ${marge}%. Donne une analyse concise et 3 recommandations pratiques en 150 mots max.`
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, module: 'comptabilite' }),
    })
    const data = await res.json()
    setAiAnalysis(data.reply ?? 'Erreur lors de l\'analyse.')
    setAiLoading(false)
  }

  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(selectedYear, new Date().getMonth() - (5 - i), 1)
    const monthStr = d.toISOString().slice(0, 7)
    const recettes = entries.filter(e => e.type === 'recette' && e.date.startsWith(monthStr)).reduce((s, e) => s + e.montant_ht, 0)
    const depenses = entries.filter(e => e.type === 'depense' && e.date.startsWith(monthStr)).reduce((s, e) => s + e.montant_ht, 0)
    return { mois: MONTHS_FR[d.getMonth()], Recettes: recettes, Dépenses: depenses }
  })

  const reportMonthStr  = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`
  const monthEntries    = entries.filter(e => e.date.startsWith(reportMonthStr))
  const reportRecettes  = monthEntries.filter(e => e.type === 'recette').reduce((s, e) => s + e.montant_ht, 0)
  const reportRecTTC    = monthEntries.filter(e => e.type === 'recette').reduce((s, e) => s + e.montant_ttc, 0)
  const reportTVA       = monthEntries.filter(e => e.type === 'recette').reduce((s, e) => s + e.tva, 0)
  const reportCA        = monthEntries.filter(e => e.type === 'recette').reduce((s, e) => s + e.ca, 0)
  const reportDepenses  = monthEntries.filter(e => e.type === 'depense').reduce((s, e) => s + e.montant_ht, 0)
  const reportBenef     = reportRecettes - reportDepenses

  const TAB_ICONS = [List, BookOpen, Scale, BarChart2, null]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#388BFD]/10 border border-[#388BFD]/20 flex items-center justify-center">
          <BookOpen size={18} className="text-[#388BFD]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#E6EDF3]">Comptabilité</h1>
          <p className="text-xs text-[#484F58]">Double entrée OHADA · TVA Congo automatique</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#388BFD]/10 border border-[#388BFD]/30 text-[#388BFD] text-sm font-medium hover:bg-[#388BFD]/20 transition-colors">
          <Plus size={15} /> Opération
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#161B22] border border-[#30363D] rounded-xl p-1 overflow-x-auto">
        {TABS.map((t, i) => {
          const Icon = TAB_ICONS[i]
          return (
            <button key={i} onClick={() => setTab(i)}
              className={`flex-1 min-w-fit py-2 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                tab === i ? 'bg-[#388BFD]/10 text-[#388BFD]' : 'text-[#8B949E] hover:text-[#E6EDF3]'
              }`}>
              {Icon && <Icon size={11} />}
              {t}
            </button>
          )
        })}
      </div>

      {/* Tab 0 — Journal simplifié */}
      {tab === 0 && (
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#30363D]">
                  {['Date', 'Libellé', 'Catégorie', 'Type', 'HT', 'TVA', 'CA', 'TTC'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#484F58] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21262D]">
                {loading && <tr><td colSpan={8} className="text-center py-8"><Loader2 size={18} className="animate-spin text-[#484F58] mx-auto" /></td></tr>}
                {!loading && entries.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-10 text-[#484F58] text-sm">Aucune opération</td></tr>
                )}
                {entries.map(e => (
                  <tr key={e.id} className="hover:bg-[#21262D]/30 transition-colors">
                    <td className="px-4 py-2.5 text-[#8B949E] text-xs whitespace-nowrap">
                      {new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-4 py-2.5 max-w-[200px]">
                      <p className="text-[#E6EDF3] truncate">{e.libelle}</p>
                      {(e.debit_account || e.credit_account) && (
                        <p className="text-[10px] text-[#484F58] font-mono mt-0.5">
                          D:{e.debit_account} / C:{e.credit_account}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[#8B949E] text-xs">{e.categorie}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded border ${
                        e.type === 'recette'
                          ? 'text-[#2EA043] bg-[#2EA043]/10 border-[#2EA043]/30'
                          : 'text-[#F85149] bg-[#F85149]/10 border-[#F85149]/30'
                      }`}>{e.type}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#E6EDF3] font-medium whitespace-nowrap">{fmtFCFA(e.montant_ht)}</td>
                    <td className="px-4 py-2.5 text-right text-[#8B949E] text-xs whitespace-nowrap">{fmtFCFA(e.tva)}</td>
                    <td className="px-4 py-2.5 text-right text-[#8B949E] text-xs whitespace-nowrap">{fmtFCFA(e.ca)}</td>
                    <td className="px-4 py-2.5 text-right text-[#F0A30A] font-semibold whitespace-nowrap">{fmtFCFA(e.montant_ttc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 1 — Partie double (journal_entries) */}
      {tab === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#484F58]">
              {doubleEntries.length} écritures · alimentées automatiquement par toutes les opérations (trésorerie, factures, paie, dépenses)
            </p>
          </div>
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#30363D]">
                    {['Date', 'Libellé', 'Compte Débité', 'Compte Crédité', 'Montant', 'Source'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#484F58] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21262D]">
                  {loading && <tr><td colSpan={6} className="text-center py-8"><Loader2 size={18} className="animate-spin text-[#484F58] mx-auto" /></td></tr>}
                  {!loading && doubleEntries.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-10 text-[#484F58] text-sm">
                      Aucune écriture — les opérations de trésorerie génèrent des écritures automatiquement
                    </td></tr>
                  )}
                  {doubleEntries.map(e => (
                    <tr key={e.id} className="hover:bg-[#21262D]/30 transition-colors">
                      <td className="px-4 py-2.5 text-[#8B949E] text-xs whitespace-nowrap">
                        {new Date(e.date_operation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>
                      <td className="px-4 py-2.5 text-[#E6EDF3] max-w-[180px] truncate">{e.libelle}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-[11px] text-[#2EA043] bg-[#2EA043]/10 px-2 py-0.5 rounded">
                          {e.debit_account}
                        </span>
                        <p className="text-[10px] text-[#484F58] mt-0.5 max-w-[120px] truncate">
                          {accountLabel(e.debit_account)}
                        </p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-[11px] text-[#F85149] bg-[#F85149]/10 px-2 py-0.5 rounded">
                          {e.credit_account}
                        </span>
                        <p className="text-[10px] text-[#484F58] mt-0.5 max-w-[120px] truncate">
                          {accountLabel(e.credit_account)}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-right text-[#F0A30A] font-semibold whitespace-nowrap">
                        {fmtFCFA(e.montant)}
                      </td>
                      <td className="px-4 py-2.5">
                        {e.source && (
                          <span className="text-[10px] text-[#388BFD] bg-[#388BFD]/10 px-2 py-0.5 rounded">
                            {e.source}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2 — Grand Livre */}
      {tab === 2 && (
        <div className="space-y-4">
          <p className="text-xs text-[#484F58]">Balance des comptes OHADA — cumulé tous exercices</p>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-[#484F58]" /></div>
          ) : grandLivre.length === 0 ? (
            <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-10 text-center">
              <Scale size={32} className="text-[#30363D] mx-auto mb-3" />
              <p className="text-[#484F58] text-sm">Aucune écriture comptable</p>
              <p className="text-[#30363D] text-xs mt-1">Enregistrez des opérations de trésorerie pour alimenter le Grand Livre</p>
            </div>
          ) : (
            <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#30363D]">
                      {['Compte', 'Intitulé', 'Type', 'Débit total', 'Crédit total', 'Solde'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#484F58] uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21262D]">
                    {grandLivre.map(gl => (
                      <tr key={gl.account_number} className="hover:bg-[#21262D]/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-[11px] bg-[#21262D] text-[#E6EDF3] px-2 py-0.5 rounded">
                            {gl.account_number}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[#E6EDF3] text-xs max-w-[180px] truncate">{gl.account_name}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded ${
                            gl.account_type === 'tresorerie' ? 'bg-[#388BFD]/10 text-[#388BFD]' :
                            gl.account_type === 'produit'    ? 'bg-[#2EA043]/10 text-[#2EA043]' :
                            gl.account_type === 'charge'     ? 'bg-[#F85149]/10 text-[#F85149]' :
                            gl.account_type === 'actif'      ? 'bg-[#F0A30A]/10 text-[#F0A30A]' :
                            'bg-[#8957E5]/10 text-[#8957E5]'
                          }`}>{gl.account_type}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-[#2EA043] font-mono text-xs whitespace-nowrap">
                          {fmtFCFA(gl.total_debit)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[#F85149] font-mono text-xs whitespace-nowrap">
                          {fmtFCFA(gl.total_credit)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap" style={{
                          color: gl.solde > 0 ? '#2EA043' : gl.solde < 0 ? '#F85149' : '#484F58'
                        }}>
                          {gl.solde >= 0 ? '' : '-'}{fmtFCFA(Math.abs(gl.solde))}
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr className="bg-[#21262D] border-t-2 border-[#388BFD]/30">
                      <td className="px-4 py-3" colSpan={3}>
                        <span className="text-xs font-bold text-[#E6EDF3] uppercase tracking-wider">Totaux</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#2EA043] whitespace-nowrap">
                        {fmtFCFA(grandLivre.reduce((s, g) => s + g.total_debit, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#F85149] whitespace-nowrap">
                        {fmtFCFA(grandLivre.reduce((s, g) => s + g.total_credit, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#F0A30A] whitespace-nowrap">
                        {fmtFCFA(grandLivre.reduce((s, g) => s + g.solde, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3 — Rapport mensuel */}
      {tab === 3 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}
              className="bg-[#161B22] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] outline-none">
              {MONTHS_FR.map((m, i) => <option key={i} value={i}>{m} {selectedYear}</option>)}
            </select>
          </div>
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5 mb-4">
            <h2 className="text-sm font-semibold text-[#E6EDF3] mb-4">Recettes vs Dépenses — 6 derniers mois</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} barGap={4} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262D" vertical={false} />
                <XAxis dataKey="mois" tick={{ fill: '#8B949E', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8B949E', fontSize: 10 }} axisLine={false} tickLine={false} width={36}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip contentStyle={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [fmtFCFA(Number(v ?? 0)), '']} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#8B949E' }} />
                <Bar dataKey="Recettes" fill="#2EA043" radius={[3, 3, 0, 0]} maxBarSize={32} />
                <Bar dataKey="Dépenses" fill="#F85149" radius={[3, 3, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6">
            <h2 className="text-sm font-bold text-[#E6EDF3] mb-4 uppercase tracking-wider">
              Rapport {MONTHS_FR[selectedMonth]} {selectedYear}
            </h2>
            <div className="space-y-3">
              {[
                { label: 'Recettes HT',                         value: fmtFCFA(reportRecettes),   color: '#2EA043' },
                { label: 'TVA collectée (18%)',                  value: fmtFCFA(reportTVA),        color: '#8B949E' },
                { label: "Contribution d'Appui (5% TVA)",        value: fmtFCFA(reportCA),         color: '#8B949E' },
                { label: 'Recettes TTC',                        value: fmtFCFA(reportRecTTC),     color: '#F0A30A' },
                { label: 'Dépenses totales',                    value: fmtFCFA(reportDepenses),   color: '#F85149' },
                { label: 'Bénéfice brut',                       value: fmtFCFA(reportBenef),      color: reportBenef >= 0 ? '#2EA043' : '#F85149' },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between border-b border-[#21262D] pb-2 last:border-0">
                  <span className="text-sm text-[#8B949E]">{r.label}</span>
                  <span className="text-sm font-semibold" style={{ color: r.color }}>{r.value}</span>
                </div>
              ))}
            </div>
            <button className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm bg-[#21262D] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] transition-colors">
              <Download size={14} /> Exporter PDF (à venir)
            </button>
          </div>
        </div>
      )}

      {/* Tab 4 — Analyse MIAA+ */}
      {tab === 4 && (
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#E6EDF3]">Analyse MIAA+ de votre comptabilité</h2>
            <button onClick={analyserMIAA} disabled={aiLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-[#F0A30A] text-[#0D1117] font-medium hover:bg-[#F0A30A]/90 disabled:opacity-50 transition-colors">
              {aiLoading ? <Loader2 size={13} className="animate-spin" /> : '✨'}
              Analyser
            </button>
          </div>
          {!aiAnalysis && !aiLoading && (
            <p className="text-sm text-[#484F58] text-center py-8">
              Cliquez sur &quot;Analyser&quot; pour obtenir une analyse IA de votre comptabilité
            </p>
          )}
          {aiLoading && (
            <div className="flex items-center gap-3 text-[#8B949E] py-6">
              <Loader2 size={16} className="animate-spin text-[#F0A30A]" />
              <span className="text-sm">MIAA+ analyse vos données…</span>
            </div>
          )}
          {aiAnalysis && (
            <div className="bg-[#0D1117] border-l-2 border-[#F0A30A]/60 rounded-r-xl p-4 text-sm text-[#E6EDF3] leading-relaxed whitespace-pre-wrap">
              {aiAnalysis}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60" onClick={() => setShowModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-[#161B22] border border-[#30363D] rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
              <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-[#484F58] hover:text-[#8B949E]"><X size={16} /></button>
              <h3 className="text-base font-bold text-[#E6EDF3] mb-4">Nouvelle opération</h3>
              <div className="flex gap-2 mb-4">
                {(['recette', 'depense'] as const).map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, type: t, categorie: t === 'recette' ? CATS_RECETTE[0] : CATS_DEPENSE[0] }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      form.type === t ? t === 'recette' ? 'bg-[#2EA043] text-white' : 'bg-[#F85149] text-white' : 'bg-[#21262D] text-[#8B949E]'
                    }`}>
                    {t === 'recette' ? '+ Recette' : '− Dépense'}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Libellé</label>
                  <input value={form.libelle} onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))}
                    placeholder="Description de l'opération..."
                    className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] placeholder-[#484F58] outline-none focus:border-[#388BFD]/50" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Montant HT (FCFA)</label>
                    <input type="number" value={form.montant_ht} onChange={e => setForm(f => ({ ...f, montant_ht: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] placeholder-[#484F58] outline-none focus:border-[#388BFD]/50" />
                  </div>
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Date</label>
                    <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] outline-none" />
                  </div>
                </div>
                {form.type === 'recette' && form.montant_ht && (
                  <div className="bg-[#F0A30A]/5 border border-[#F0A30A]/20 rounded-lg p-3 text-xs space-y-1">
                    <p className="text-[#8B949E]">TVA (18%) : <span className="text-[#F0A30A] font-medium">{fmtFCFA(Math.round(parseInt(form.montant_ht || '0') * 0.18))}</span></p>
                    <p className="text-[#8B949E]">CA (5% TVA) : <span className="text-[#F0A30A] font-medium">{fmtFCFA(Math.round(parseInt(form.montant_ht || '0') * 0.18 * 0.05))}</span></p>
                    <p className="text-[#8B949E] font-medium">TTC : <span className="text-[#F0A30A] font-bold">{fmtFCFA(Math.round(parseInt(form.montant_ht || '0') * 1.189))}</span></p>
                  </div>
                )}
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Catégorie</label>
                  <select value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}
                    className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] outline-none">
                    {(form.type === 'recette' ? CATS_RECETTE : CATS_DEPENSE).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>

                {/* Double-entry accounts */}
                <div className="border-t border-[#30363D] pt-3">
                  <p className="text-[10px] text-[#6E7681] uppercase tracking-wider mb-2 flex items-center gap-1">
                    <BookOpen size={10} /> Écriture à partie double (OHADA)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#8B949E] mb-1 block">Compte débité</label>
                      <select value={form.debit_account} onChange={e => setForm(f => ({ ...f, debit_account: e.target.value }))}
                        className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-2 py-2 text-xs text-[#E6EDF3] outline-none">
                        {(OHADA_ACCOUNTS as readonly { number: string; name: string }[]).map(a => (
                          <option key={a.number} value={a.number}>{a.number} — {a.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-[#8B949E] mb-1 block">Compte crédité</label>
                      <select value={form.credit_account} onChange={e => setForm(f => ({ ...f, credit_account: e.target.value }))}
                        className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-2 py-2 text-xs text-[#E6EDF3] outline-none">
                        {(OHADA_ACCOUNTS as readonly { number: string; name: string }[]).map(a => (
                          <option key={a.number} value={a.number}>{a.number} — {a.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {form.debit_account && form.credit_account && (
                    <p className="text-[10px] text-[#484F58] mt-2 font-mono">
                      D {form.debit_account} / C {form.credit_account}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm bg-[#21262D] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] transition-colors">
                  Annuler
                </button>
                <button onClick={save} disabled={saving || !form.libelle || !form.montant_ht}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-[#388BFD] text-white hover:bg-[#388BFD]/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
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
