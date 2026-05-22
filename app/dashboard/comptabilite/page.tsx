'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Plus, BookOpen, X, Loader2, Download, Scale, List, BarChart2, GitMerge, CheckCircle, AlertTriangle, Circle, Trash2 } from 'lucide-react'
import { fmtFCFA } from '@/lib/admin-config'
import { useTenant } from '@/lib/hooks/useTenant'
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

type RapprochementEntry = {
  id: string
  date_releve: string
  reference: string
  montant: number
  type: 'debit' | 'credit'
  libelle: string | null
  statut: 'non_rapproche' | 'rapproche' | 'ecart'
  created_at: string
}

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h]
      if (val === null || val === undefined) return ''
      const s = String(val)
      return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }).join(';')
  )
  const csv = '﻿' + [headers.join(';'), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const TABS = ['Journal', 'Partie double', 'Grand Livre', 'Rapport mensuel', 'Analyse MIAA+', 'Rapprochement']
const CATS_RECETTE = ['Vente produit', 'Prestation service', 'Loyer reçu', 'Autre recette']
const CATS_DEPENSE = ['Achats', 'Salaires', 'Loyer', 'Charges', 'Taxes', 'Autre dépense']
const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

function calcTVACongo(ht: number) {
  const tva = Math.round(ht * 0.18)
  const ca  = Math.round(tva * 0.05)
  return { tva, ca, ttc: ht + tva + ca }
}

export default function ComptabilitePage() {
  const { tenantId } = useTenant()
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

  // Rapprochement state
  const [rapprochements, setRapprochements] = useState<RapprochementEntry[]>([])
  const [rapLoading, setRapLoading] = useState(false)
  const [rapFilter, setRapFilter] = useState<'all' | 'non_rapproche' | 'rapproche' | 'ecart'>('all')
  const [showRapModal, setShowRapModal] = useState(false)
  const [rapSaving, setRapSaving] = useState(false)
  const [rapForm, setRapForm] = useState({
    date_releve: new Date().toISOString().split('T')[0],
    reference: '',
    montant: '',
    type: 'credit' as 'credit' | 'debit',
    libelle: '',
  })

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

  const load = useCallback(async () => {
    const tid = tenantId
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
  }, [tenantId])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (tab === 5) loadRapprochements() }, [tab, rapFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!form.libelle || !form.montant_ht) return
    setSaving(true)
    const tid = tenantId
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

  async function loadRapprochements() {
    setRapLoading(true)
    try {
      const res = await fetch(`/api/rapprochement?statut=${rapFilter}`)
      const json = await res.json()
      setRapprochements(json.data ?? [])
    } catch {
      setRapprochements([])
    }
    setRapLoading(false)
  }

  async function saveRapprochement() {
    if (!rapForm.reference || !rapForm.montant || !rapForm.date_releve) return
    setRapSaving(true)
    await fetch('/api/rapprochement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date_releve: rapForm.date_releve,
        reference: rapForm.reference,
        montant: Number(rapForm.montant),
        type: rapForm.type,
        libelle: rapForm.libelle || null,
      }),
    })
    setShowRapModal(false)
    setRapForm({ date_releve: new Date().toISOString().split('T')[0], reference: '', montant: '', type: 'credit', libelle: '' })
    setRapSaving(false)
    loadRapprochements()
  }

  async function updateRapStatut(id: string, statut: 'rapproche' | 'ecart' | 'non_rapproche') {
    await fetch('/api/rapprochement', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, statut }),
    })
    setRapprochements(prev => prev.map(r => r.id === id ? { ...r, statut } : r))
  }

  async function deleteRap(id: string) {
    await fetch(`/api/rapprochement?id=${id}`, { method: 'DELETE' })
    setRapprochements(prev => prev.filter(r => r.id !== id))
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

  const TAB_ICONS = [List, BookOpen, Scale, BarChart2, null, GitMerge]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--primary-light)] border border-[var(--primary)] flex items-center justify-center">
          <BookOpen size={18} className="text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="page-title">Comptabilité</h1>
          <p className="text-xs text-[var(--text-secondary)]">Double entrée OHADA · TVA Congo automatique</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary-light)] border border-[var(--primary)] text-[var(--primary-text)] text-sm font-medium hover:bg-[var(--primary)] hover:text-white transition-colors">
          <Plus size={15} /> Opération
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-1 overflow-x-auto">
        {TABS.map((t, i) => {
          const Icon = TAB_ICONS[i]
          return (
            <button key={i} onClick={() => setTab(i)}
              className={`flex-1 min-w-fit py-2 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                tab === i ? 'bg-[var(--primary-light)] text-[var(--primary-text)]' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}>
              {Icon && <Icon size={11} />}
              {t}
            </button>
          )
        })}
      </div>

      {/* Tab 0 — Journal simplifié */}
      {tab === 0 && (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['Date', 'Libellé', 'Catégorie', 'Type', 'HT', 'TVA', 'CA', 'TTC'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {loading && <tr><td colSpan={8} className="text-center py-8"><Loader2 size={18} className="animate-spin text-[var(--text-secondary)] mx-auto" /></td></tr>}
                {!loading && entries.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-10 text-[var(--text-secondary)] text-sm">Aucune opération</td></tr>
                )}
                {entries.map(e => (
                  <tr key={e.id} className="hover:bg-white/5/30 transition-colors">
                    <td className="px-4 py-2.5 text-[var(--text-secondary)] text-xs whitespace-nowrap">
                      {new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-4 py-2.5 max-w-[200px]">
                      <p className="text-[var(--text)] truncate">{e.libelle}</p>
                      {(e.debit_account || e.credit_account) && (
                        <p className="text-[10px] text-[var(--text-secondary)] font-mono mt-0.5">
                          D:{e.debit_account} / C:{e.credit_account}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)] text-xs">{e.categorie}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded border ${
                        e.type === 'recette'
                          ? 'text-[#F51E33] bg-[var(--surface)]/10 border-[#142850]/30'
                          : 'text-[#F51E33] bg-[#F51E33]/10 border-[#F51E33]/30'
                      }`}>{e.type}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-[var(--text)] font-medium whitespace-nowrap">{fmtFCFA(e.montant_ht)}</td>
                    <td className="px-4 py-2.5 text-right text-[var(--text-secondary)] text-xs whitespace-nowrap">{fmtFCFA(e.tva)}</td>
                    <td className="px-4 py-2.5 text-right text-[var(--text-secondary)] text-xs whitespace-nowrap">{fmtFCFA(e.ca)}</td>
                    <td className="px-4 py-2.5 text-right text-[#F51E33] font-semibold whitespace-nowrap">{fmtFCFA(e.montant_ttc)}</td>
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
            <p className="text-xs text-[var(--text-secondary)]">
              {doubleEntries.length} écritures · alimentées automatiquement par toutes les opérations (trésorerie, factures, paie, dépenses)
            </p>
          </div>
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {['Date', 'Libellé', 'Compte Débité', 'Compte Crédité', 'Montant', 'Source'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {loading && <tr><td colSpan={6} className="text-center py-8"><Loader2 size={18} className="animate-spin text-[var(--text-secondary)] mx-auto" /></td></tr>}
                  {!loading && doubleEntries.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-10 text-[var(--text-secondary)] text-sm">
                      Aucune écriture — les opérations de trésorerie génèrent des écritures automatiquement
                    </td></tr>
                  )}
                  {doubleEntries.map(e => (
                    <tr key={e.id} className="hover:bg-white/5/30 transition-colors">
                      <td className="px-4 py-2.5 text-[var(--text-secondary)] text-xs whitespace-nowrap">
                        {new Date(e.date_operation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--text)] max-w-[180px] truncate">{e.libelle}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-[11px] text-[#F51E33] bg-[var(--surface)]/10 px-2 py-0.5 rounded">
                          {e.debit_account}
                        </span>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 max-w-[120px] truncate">
                          {accountLabel(e.debit_account)}
                        </p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-[11px] text-[#F51E33] bg-[#F51E33]/10 px-2 py-0.5 rounded">
                          {e.credit_account}
                        </span>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 max-w-[120px] truncate">
                          {accountLabel(e.credit_account)}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-right text-[#F51E33] font-semibold whitespace-nowrap">
                        {fmtFCFA(e.montant)}
                      </td>
                      <td className="px-4 py-2.5">
                        {e.source && (
                          <span className="text-[10px] text-[#F51E33] bg-[#F51E33]/10 px-2 py-0.5 rounded">
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
          <p className="text-xs text-[var(--text-secondary)]">Balance des comptes OHADA — cumulé tous exercices</p>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-[var(--text-secondary)]" /></div>
          ) : grandLivre.length === 0 ? (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-10 text-center">
              <Scale size={32} className="text-[var(--text-secondary)] mx-auto mb-3" />
              <p className="text-[var(--text-secondary)] text-sm">Aucune écriture comptable</p>
              <p className="text-[var(--text-secondary)] text-xs mt-1">Enregistrez des opérations de trésorerie pour alimenter le Grand Livre</p>
            </div>
          ) : (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      {['Compte', 'Intitulé', 'Type', 'Débit total', 'Crédit total', 'Solde'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {grandLivre.map(gl => (
                      <tr key={gl.account_number} className="hover:bg-white/5/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-[11px] bg-[var(--surface-alt)] text-[var(--text)] px-2 py-0.5 rounded">
                            {gl.account_number}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[var(--text)] text-xs max-w-[180px] truncate">{gl.account_name}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded ${
                            gl.account_type === 'tresorerie' ? 'bg-[#F51E33]/10 text-[#F51E33]' :
                            gl.account_type === 'produit'    ? 'bg-[var(--surface)]/10 text-[#F51E33]' :
                            gl.account_type === 'charge'     ? 'bg-[#F51E33]/10 text-[#F51E33]' :
                            gl.account_type === 'actif'      ? 'bg-[#F51E33]/10 text-[#F51E33]' :
                            'bg-[#8957E5]/10 text-[#8957E5]'
                          }`}>{gl.account_type}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-[#F51E33] font-mono text-xs whitespace-nowrap">
                          {fmtFCFA(gl.total_debit)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[#F51E33] font-mono text-xs whitespace-nowrap">
                          {fmtFCFA(gl.total_credit)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap" style={{
                          color: gl.solde > 0 ? 'var(--success)' : gl.solde < 0 ? 'var(--danger)' : 'var(--text-secondary)'
                        }}>
                          {gl.solde >= 0 ? '' : '-'}{fmtFCFA(Math.abs(gl.solde))}
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr className="bg-[var(--surface-alt)] border-t-2 border-[var(--border-strong)]">
                      <td className="px-4 py-3" colSpan={3}>
                        <span className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">Totaux</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[var(--text)] whitespace-nowrap">
                        {fmtFCFA(grandLivre.reduce((s, g) => s + g.total_debit, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[var(--text)] whitespace-nowrap">
                        {fmtFCFA(grandLivre.reduce((s, g) => s + g.total_credit, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[var(--text)] whitespace-nowrap">
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
              className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none">
              {MONTHS_FR.map((m, i) => <option key={i} value={i}>{m} {selectedYear}</option>)}
            </select>
          </div>
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 mb-4">
            <h2 className="text-sm font-semibold text-[var(--text)] mb-4">Recettes vs Dépenses — 6 derniers mois</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} barGap={4} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mois" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} width={36}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [fmtFCFA(Number(v ?? 0)), '']} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                <Bar dataKey="Recettes" fill="#F59E0B" radius={[3, 3, 0, 0]} maxBarSize={32} />
                <Bar dataKey="Dépenses" fill="#EF4444" radius={[3, 3, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-6">
            <h2 className="text-sm font-bold text-[var(--text)] mb-4 uppercase tracking-wider">
              Rapport {MONTHS_FR[selectedMonth]} {selectedYear}
            </h2>
            <div className="space-y-3">
              {[
                { label: 'Recettes HT',                         value: fmtFCFA(reportRecettes),   color: 'var(--success)' },
                { label: 'TVA collectée (18%)',                  value: fmtFCFA(reportTVA),        color: 'var(--text-secondary)' },
                { label: "Contribution d'Appui (5% TVA)",        value: fmtFCFA(reportCA),         color: 'var(--text-secondary)' },
                { label: 'Recettes TTC',                        value: fmtFCFA(reportRecTTC),     color: 'var(--primary)' },
                { label: 'Dépenses totales',                    value: fmtFCFA(reportDepenses),   color: 'var(--danger)' },
                { label: 'Bénéfice brut',                       value: fmtFCFA(reportBenef),      color: reportBenef >= 0 ? 'var(--success)' : 'var(--danger)' },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between border-b border-[var(--border)] pb-2 last:border-0">
                  <span className="text-sm text-[var(--text-secondary)]">{r.label}</span>
                  <span className="text-sm font-semibold" style={{ color: r.color }}>{r.value}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => downloadCSV(
                monthEntries.map(e => ({
                  date: e.date,
                  libelle: e.libelle,
                  type: e.type,
                  categorie: e.categorie,
                  montant_ht: e.montant_ht,
                  tva: e.tva,
                  ca: e.ca,
                  montant_ttc: e.montant_ttc,
                  compte_debit: e.debit_account ?? '',
                  compte_credit: e.credit_account ?? '',
                })),
                `journal_${MONTHS_FR[selectedMonth]}_${selectedYear}.csv`
              )}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
            >
              <Download size={14} /> Exporter CSV ({monthEntries.length} lignes)
            </button>
            <button
              onClick={() => downloadCSV(
                grandLivre.map(gl => ({
                  compte: gl.account_number,
                  intitule: gl.account_name,
                  type: gl.account_type,
                  total_debit: gl.total_debit,
                  total_credit: gl.total_credit,
                  solde: gl.solde,
                })),
                `grand_livre_${selectedYear}.csv`
              )}
              className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
            >
              <Download size={14} /> Exporter Grand Livre CSV
            </button>
          </div>
        </div>
      )}

      {/* Tab 4 — Analyse MIAA+ */}
      {tab === 4 && (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text)]">Analyse MIAA+ de votre comptabilité</h2>
            <button onClick={analyserMIAA} disabled={aiLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-[var(--primary)] text-white font-medium hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors">
              {aiLoading ? <Loader2 size={13} className="animate-spin" /> : '✨'}
              Analyser
            </button>
          </div>
          {!aiAnalysis && !aiLoading && (
            <p className="text-sm text-[var(--text-secondary)] text-center py-8">
              Cliquez sur &quot;Analyser&quot; pour obtenir une analyse IA de votre comptabilité
            </p>
          )}
          {aiLoading && (
            <div className="flex items-center gap-3 text-[var(--text-secondary)] py-6">
              <Loader2 size={16} className="animate-spin text-[#F51E33]" />
              <span className="text-sm">MIAA+ analyse vos données…</span>
            </div>
          )}
          {aiAnalysis && (
            <div className="bg-[var(--surface-alt)] border-l-2 border-[var(--primary)] rounded-r-xl p-4 text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
              {aiAnalysis}
            </div>
          )}
        </div>
      )}

      {/* Tab 5 — Rapprochement bancaire */}
      {tab === 5 && (() => {
        const filtered = rapFilter === 'all' ? rapprochements : rapprochements.filter(r => r.statut === rapFilter)
        const totalCredit = rapprochements.filter(r => r.type === 'credit').reduce((s, r) => s + r.montant, 0)
        const totalDebit  = rapprochements.filter(r => r.type === 'debit').reduce((s, r) => s + r.montant, 0)
        const nbNonRap    = rapprochements.filter(r => r.statut === 'non_rapproche').length
        const nbEcart     = rapprochements.filter(r => r.statut === 'ecart').length

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--text-secondary)]">
                Comparez les relevés bancaires avec vos transactions enregistrées
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadCSV(
                    rapprochements.map(r => ({ date: r.date_releve, reference: r.reference, libelle: r.libelle ?? '', type: r.type, montant: r.montant, statut: r.statut })),
                    'rapprochement_bancaire.csv'
                  )}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
                >
                  <Download size={12} /> CSV
                </button>
                <button onClick={() => setShowRapModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-[#F51E33]/10 border border-[#F51E33]/30 text-[#F51E33] hover:bg-[#F51E33]/20 transition-colors">
                  <Plus size={12} /> Ajouter ligne
                </button>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Crédits totaux',    value: fmtFCFA(totalCredit), color: 'var(--success)' },
                { label: 'Débits totaux',     value: fmtFCFA(totalDebit),  color: 'var(--danger)' },
                { label: 'Non rapprochés',    value: nbNonRap,             color: 'var(--warning)' },
                { label: 'Écarts détectés',   value: nbEcart,              color: 'var(--danger)' },
              ].map(k => (
                <div key={k.label} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4">
                  <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-1">{k.label}</p>
                  <p className="text-lg font-bold" style={{ color: k.color }}>{k.value}</p>
                </div>
              ))}
            </div>

            {/* Filter */}
            <div className="flex gap-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-1 w-fit">
              {([['all', 'Tous'], ['non_rapproche', 'Non rapprochés'], ['rapproche', 'Rapprochés'], ['ecart', 'Écarts']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setRapFilter(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${rapFilter === v ? 'bg-[var(--primary-light)] text-[var(--primary-text)]' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'}`}>
                  {l}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
              {rapLoading ? (
                <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-[var(--text-secondary)]" /></div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                  <GitMerge size={32} className="text-[var(--text-secondary)] mx-auto mb-3" />
                  <p className="text-[var(--text-secondary)] text-sm">Aucune ligne de rapprochement</p>
                  <p className="text-[var(--text-secondary)] text-xs mt-1">Ajoutez vos lignes de relevé bancaire pour les rapprocher</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        {['Date', 'Référence', 'Libellé', 'Type', 'Montant', 'Statut', 'Actions'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {filtered.map(r => (
                        <tr key={r.id} className="hover:bg-white/5/30 transition-colors">
                          <td className="px-4 py-2.5 text-[var(--text-secondary)] text-xs whitespace-nowrap">
                            {new Date(r.date_releve).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--text)]">{r.reference}</td>
                          <td className="px-4 py-2.5 text-[var(--text-secondary)] text-xs max-w-[160px] truncate">{r.libelle ?? '—'}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${r.type === 'credit' ? 'bg-[var(--success-light)] text-[var(--success-text)]' : 'bg-[var(--danger-light)] text-[var(--danger-text)]'}`}>
                              {r.type === 'credit' ? '↑ Crédit' : '↓ Débit'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap" style={{ color: r.type === 'credit' ? 'var(--success)' : 'var(--danger)' }}>
                            {fmtFCFA(r.montant)}
                          </td>
                          <td className="px-4 py-2.5">
                            {r.statut === 'rapproche'     && <span className="flex items-center gap-1 text-[10px] text-[var(--success)]"><CheckCircle size={10} /> Rapproché</span>}
                            {r.statut === 'non_rapproche' && <span className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]"><Circle size={10} /> En attente</span>}
                            {r.statut === 'ecart'         && <span className="flex items-center gap-1 text-[10px] text-[var(--danger)]"><AlertTriangle size={10} /> Écart</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1">
                              {r.statut !== 'rapproche' && (
                                <button onClick={() => updateRapStatut(r.id, 'rapproche')}
                                  className="px-2 py-1 rounded text-[10px] bg-[var(--surface)]/10 text-[#F51E33] hover:bg-[var(--surface)]/20 transition-colors" title="Marquer rapproché">
                                  ✓
                                </button>
                              )}
                              {r.statut !== 'ecart' && (
                                <button onClick={() => updateRapStatut(r.id, 'ecart')}
                                  className="px-2 py-1 rounded text-[10px] bg-[#F51E33]/10 text-[#F51E33] hover:bg-[#F51E33]/20 transition-colors" title="Signaler écart">
                                  !
                                </button>
                              )}
                              {r.statut !== 'non_rapproche' && (
                                <button onClick={() => updateRapStatut(r.id, 'non_rapproche')}
                                  className="px-2 py-1 rounded text-[10px] bg-[#F51E33]/10 text-[#F51E33] hover:bg-[#F51E33]/20 transition-colors" title="Remettre en attente">
                                  ↺
                                </button>
                              )}
                              <button onClick={() => deleteRap(r.id)}
                                className="px-2 py-1 rounded text-[10px] bg-[#484F58]/10 text-[var(--text-secondary)] hover:bg-[#F51E33]/10 hover:text-[#F51E33] transition-colors" title="Supprimer">
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Modal rapprochement */}
      <AnimatePresence>
        {showRapModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60" onClick={() => setShowRapModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <button onClick={() => setShowRapModal(false)} className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-secondary)]"><X size={16} /></button>
              <h3 className="text-base font-bold text-[var(--text)] mb-4">Nouvelle ligne de relevé</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[var(--text-secondary)] mb-1 block">Date relevé</label>
                    <input type="date" value={rapForm.date_releve} onChange={e => setRapForm(f => ({ ...f, date_releve: e.target.value }))}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-secondary)] mb-1 block">Type</label>
                    <div className="flex gap-2">
                      {(['credit', 'debit'] as const).map(t => (
                        <button key={t} onClick={() => setRapForm(f => ({ ...f, type: t }))}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${rapForm.type === t ? t === 'credit' ? 'bg-[var(--success)] text-white' : 'bg-[var(--danger)] text-white' : 'bg-[var(--surface-alt)] text-[var(--text-secondary)]'}`}>
                          {t === 'credit' ? '↑ Crédit' : '↓ Débit'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Référence</label>
                  <input value={rapForm.reference} onChange={e => setRapForm(f => ({ ...f, reference: e.target.value }))}
                    placeholder="VIR-2025-001, CHQ-456…"
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] outline-none focus:border-[#F51E33]/50" />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Montant (FCFA)</label>
                  <input type="number" value={rapForm.montant} onChange={e => setRapForm(f => ({ ...f, montant: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] outline-none focus:border-[#F51E33]/50" />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Libellé (optionnel)</label>
                  <input value={rapForm.libelle} onChange={e => setRapForm(f => ({ ...f, libelle: e.target.value }))}
                    placeholder="Description…"
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] outline-none focus:border-[#F51E33]/50" />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowRapModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
                  Annuler
                </button>
                <button onClick={saveRapprochement} disabled={rapSaving || !rapForm.reference || !rapForm.montant}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {rapSaving && <Loader2 size={13} className="animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60" onClick={() => setShowModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
              <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-secondary)]"><X size={16} /></button>
              <h3 className="text-base font-bold text-[var(--text)] mb-4">Nouvelle opération</h3>
              <div className="flex gap-2 mb-4">
                {(['recette', 'depense'] as const).map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, type: t, categorie: t === 'recette' ? CATS_RECETTE[0] : CATS_DEPENSE[0] }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      form.type === t ? t === 'recette' ? 'bg-[var(--success)] text-white' : 'bg-[var(--danger)] text-white' : 'bg-[var(--surface-alt)] text-[var(--text-secondary)]'
                    }`}>
                    {t === 'recette' ? '+ Recette' : '− Dépense'}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Libellé</label>
                  <input value={form.libelle} onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))}
                    placeholder="Description de l'opération..."
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] outline-none focus:border-[#F51E33]/50" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[var(--text-secondary)] mb-1 block">Montant HT (FCFA)</label>
                    <input type="number" value={form.montant_ht} onChange={e => setForm(f => ({ ...f, montant_ht: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] outline-none focus:border-[#F51E33]/50" />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-secondary)] mb-1 block">Date</label>
                    <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none" />
                  </div>
                </div>
                {form.type === 'recette' && form.montant_ht && (
                  <div className="bg-[#F51E33]/5 border border-[#F51E33]/20 rounded-lg p-3 text-xs space-y-1">
                    <p className="text-[var(--text-secondary)]">TVA (18%) : <span className="text-[#F51E33] font-medium">{fmtFCFA(Math.round(parseInt(form.montant_ht || '0') * 0.18))}</span></p>
                    <p className="text-[var(--text-secondary)]">CA (5% TVA) : <span className="text-[#F51E33] font-medium">{fmtFCFA(Math.round(parseInt(form.montant_ht || '0') * 0.18 * 0.05))}</span></p>
                    <p className="text-[var(--text-secondary)] font-medium">TTC : <span className="text-[#F51E33] font-bold">{fmtFCFA(Math.round(parseInt(form.montant_ht || '0') * 1.189))}</span></p>
                  </div>
                )}
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Catégorie</label>
                  <select value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none">
                    {(form.type === 'recette' ? CATS_RECETTE : CATS_DEPENSE).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>

                {/* Double-entry accounts */}
                <div className="border-t border-[var(--border)] pt-3">
                  <p className="text-[10px] text-[#6E7681] uppercase tracking-wider mb-2 flex items-center gap-1">
                    <BookOpen size={10} /> Écriture à partie double (OHADA)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[var(--text-secondary)] mb-1 block">Compte débité</label>
                      <select value={form.debit_account} onChange={e => setForm(f => ({ ...f, debit_account: e.target.value }))}
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-2 text-xs text-[var(--text)] outline-none">
                        {(OHADA_ACCOUNTS as readonly { number: string; name: string }[]).map(a => (
                          <option key={a.number} value={a.number}>{a.number} — {a.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-[var(--text-secondary)] mb-1 block">Compte crédité</label>
                      <select value={form.credit_account} onChange={e => setForm(f => ({ ...f, credit_account: e.target.value }))}
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-2 text-xs text-[var(--text)] outline-none">
                        {(OHADA_ACCOUNTS as readonly { number: string; name: string }[]).map(a => (
                          <option key={a.number} value={a.number}>{a.number} — {a.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {form.debit_account && form.credit_account && (
                    <p className="text-[10px] text-[var(--text-secondary)] mt-2 font-mono">
                      D {form.debit_account} / C {form.credit_account}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
                  Annuler
                </button>
                <button onClick={save} disabled={saving || !form.libelle || !form.montant_ht}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
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
