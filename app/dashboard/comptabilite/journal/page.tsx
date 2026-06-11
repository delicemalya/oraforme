'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useFmt } from '@/lib/hooks/useFmt'
import { useLocale } from '@/lib/hooks/useLocale'
import {
  BookOpen, Loader2, Search,
  Download, RefreshCw,
  ChevronLeft, ChevronRight,
  Plus, X, CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'
import { rechercherCompte, getSoldeNormal, type CompteFlat } from '@/lib/syscohada/plan-comptable'

interface JournalEntry {
  id: string
  date_operation: string
  piece_number:   string | null
  debit_account:  string
  credit_account: string
  montant:        number
  libelle:        string
  source:         string | null
  fiscal_year:    number | null
  created_at:     string
}

function fmtFCFA(n: number) {
  return new Intl.NumberFormat('fr-CG', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(n)
}

const SOURCE_CSS: Record<string, string> = {
  facture:  'bg-blue-100 text-blue-700',
  achat:    'bg-purple-100 text-purple-700',
  paie:     'bg-pink-100 text-pink-700',
  cheque:   'bg-yellow-100 text-yellow-700',
  virement: 'bg-indigo-100 text-indigo-700',
  caisse:   'bg-green-100 text-green-700',
  transfer: 'bg-teal-100 text-teal-700',
  mobile:   'bg-orange-100 text-orange-700',
  tva:      'bg-red-100 text-red-700',
  stock:    'bg-cyan-100 text-cyan-700',
  manuel:   'bg-gray-100 text-gray-700',
}

// ── Autocomplete compte SYSCOHADA ─────────────────────────────────────────────

function CompteAutocomplete({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { fmt: fmtFCFA } = useFmt()
  const [query, setQuery]       = useState(value)
  const [results, setResults]   = useState<CompteFlat[]>([])
  const [open, setOpen]         = useState(false)
  const ref                     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setResults(rechercherCompte(query))
    setOpen(query.length >= 2)
  }, [query])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function select(c: CompteFlat) {
    setQuery(`${c.numero} — ${c.nom}`)
    onChange(c.numero)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange('') }}
        placeholder={placeholder ?? 'Numéro ou libellé…'}
        className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 bg-white border border-[#E2E8F0] rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
          {results.map(c => (
            <button key={c.numero} type="button"
              className="w-full text-left px-3 py-2 text-[12px] hover:bg-[#EFF6FF] flex items-center justify-between gap-2"
              onClick={() => select(c)}>
              <span>
                <span className="font-mono font-bold text-[#2563EB] mr-2">{c.numero}</span>
                <span className="text-[#0F172A]">{c.nom}</span>
              </span>
              <span className="text-[10px] text-[#94A3B8] shrink-0">{c.classeNom.split('—')[0].trim()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Modal Saisie Manuelle ─────────────────────────────────────────────────────

const EMPTY_SAISIE = {
  date_operation: new Date().toISOString().slice(0, 10),
  piece_number:   '',
  libelle:        '',
  debit_account:  '',
  credit_account: '',
  montant:        '' as string | number,
}

function ModalSaisie({
  tenantId,
  onClose,
  onSaved,
}: { tenantId: string; onClose: () => void; onSaved: () => void }) {
  const { fmt: fmtFCFA } = useFmt()
  const [form, setForm]     = useState(EMPTY_SAISIE)
  const [saving, setSaving] = useState(false)
  const [saveOk, setSaveOk] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const montant = Number(form.montant)
    if (!form.debit_account || !form.credit_account || !form.libelle || !montant) {
      setError('Tous les champs sont obligatoires')
      return
    }
    if (form.debit_account === form.credit_account) {
      setError('Le compte débit et crédit doivent être différents')
      return
    }
    setSaving(true); setError(null)
    const { error: err } = await supabase.from('journal_entries').insert({
      tenant_id:      tenantId,
      date_operation: form.date_operation,
      piece_number:   form.piece_number.trim() || null,
      libelle:        form.libelle.trim(),
      debit_account:  form.debit_account,
      credit_account: form.credit_account,
      montant,
      source:         'manuel',
      fiscal_year:    new Date(form.date_operation).getFullYear(),
    })
    if (err) { setError(err.message); setSaving(false); return }
    setSaveOk(true)
    setTimeout(() => { onSaved(); onClose() }, 800)
  }

  const montantNum = Number(form.montant) || 0
  const debitSens  = form.debit_account  ? getSoldeNormal(form.debit_account)  : null
  const creditSens = form.credit_account ? getSoldeNormal(form.credit_account) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-bold text-[#0F172A]">Saisie manuelle d'écriture</h2>
          <button onClick={onClose}><X size={18} className="text-[#94A3B8]" /></button>
        </div>

        <form id="saisie-manuelle" onSubmit={handleSubmit} className="p-5 space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Date *</label>
              <input type="date" value={form.date_operation}
                onChange={e => setForm(f => ({ ...f, date_operation: e.target.value }))}
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#64748B] block mb-1">N° pièce</label>
              <input value={form.piece_number}
                onChange={e => setForm(f => ({ ...f, piece_number: e.target.value }))}
                placeholder="Facture / reçu…"
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Libellé *</label>
            <input value={form.libelle}
              onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))}
              placeholder="Description de l'opération…"
              className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30" />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#64748B] block mb-1">
              Compte DÉBIT *
              {debitSens && (
                <span className="ml-2 text-[10px] text-[#2563EB]">sens normal : {debitSens}</span>
              )}
            </label>
            <CompteAutocomplete
              value={form.debit_account}
              onChange={v => setForm(f => ({ ...f, debit_account: v }))}
              placeholder="Ex: 601 — Achats de marchandises"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#64748B] block mb-1">
              Compte CRÉDIT *
              {creditSens && (
                <span className="ml-2 text-[10px] text-[#16A34A]">sens normal : {creditSens}</span>
              )}
            </label>
            <CompteAutocomplete
              value={form.credit_account}
              onChange={v => setForm(f => ({ ...f, credit_account: v }))}
              placeholder="Ex: 401 — Fournisseurs"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Montant (FCFA) *</label>
            <input type="number" min="1" step="1"
              value={form.montant}
              onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
              placeholder="0"
              className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30" />
          </div>

          {/* Récap partiel */}
          {montantNum > 0 && form.debit_account && form.credit_account && (
            <div className="bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0] text-[12px]">
              <div className="flex justify-between mb-1">
                <span className="text-[#2563EB] font-semibold">DÉBIT {form.debit_account}</span>
                <span className="font-bold text-[#2563EB]">{fmtFCFA(montantNum)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#16A34A] font-semibold">CRÉDIT {form.credit_account}</span>
                <span className="font-bold text-[#16A34A]">{fmtFCFA(montantNum)}</span>
              </div>
            </div>
          )}

          {error  && <p className="text-[12px] text-[#DC2626] bg-[#FEE2E2] px-3 py-2 rounded-lg">{error}</p>}
          {saveOk && (
            <p className="text-[12px] text-[#16A34A] bg-[#DCFCE7] px-3 py-2 rounded-lg flex items-center gap-2">
              <CheckCircle2 size={13} /> Écriture enregistrée !
            </p>
          )}
        </form>

        <div className="px-5 pb-5 flex gap-2">
          <button form="saisie-manuelle" type="submit" disabled={saving}
            className="flex-1 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12px] font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Enregistrer l'écriture
          </button>
          <button onClick={onClose}
            className="px-5 py-2.5 border border-[#E2E8F0] rounded-xl text-[12px] text-[#64748B]">
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function JournalPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId, loading: tenantLoading } = useTenant()
  const { t, locale } = useLocale()

  const [entries, setEntries]           = useState<JournalEntry[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [filterSource, setFilterSource] = useState('all')
  const [filterMonth, setFilterMonth]   = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear]     = useState(new Date().getFullYear())
  const [page, setPage]                 = useState(0)
  const [showSaisie, setShowSaisie]     = useState(false)
  const PAGE_SIZE = 50

  const intlLocale = locale === 'fr' ? 'fr-FR' : locale === 'en' ? 'en-GB' : locale === 'pt' ? 'pt-PT' : locale === 'es' ? 'es-ES' : 'fr-FR'
  const MONTHS = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(intlLocale, { month: 'long' }).format(new Date(2024, i, 1))
  )

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString(intlLocale, { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const SOURCE_KEYS: Record<string, string> = {
    facture:  'compta.journal.src.facture',
    achat:    'compta.journal.src.facture',
    paie:     'compta.journal.src.paie',
    cheque:   'compta.journal.src.cheque',
    virement: 'compta.journal.src.virement',
    caisse:   'compta.journal.src.caisse',
    transfer: 'compta.journal.src.transfer',
    mobile:   'compta.journal.src.mobile',
    tva:      'compta.journal.src.tva',
    stock:    'compta.journal.src.stock',
    manuel:   'compta.journal.src.manuel',
  }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const start = `${filterYear}-${String(filterMonth).padStart(2, '0')}-01`
    const end   = new Date(filterYear, filterMonth, 0).toISOString().slice(0, 10)
    let query = supabase
      .from('journal_entries')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .gte('date_operation', start)
      .lte('date_operation', end)
      .order('date_operation', { ascending: false })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (filterSource !== 'all') query = query.eq('source', filterSource)
    const { data, error } = await query
    if (!error) setEntries(data || [])
    setLoading(false)
  }, [tenantId, filterMonth, filterYear, filterSource, page])

  useEffect(() => { if (!tenantLoading) load() }, [tenantLoading, load])

  const filtered = entries.filter(e => {
    if (!search) return true
    const q = search.toLowerCase()
    return e.libelle.toLowerCase().includes(q) ||
      e.debit_account.includes(q) || e.credit_account.includes(q) ||
      (e.piece_number || '').toLowerCase().includes(q)
  })

  const totalDebit  = filtered.reduce((s, e) => s + e.montant, 0)
  const totalCredit = totalDebit

  const prevMonth = () => {
    setPage(0)
    if (filterMonth === 1) { setFilterMonth(12); setFilterYear(y => y - 1) }
    else setFilterMonth(m => m - 1)
  }
  const nextMonth = () => {
    setPage(0)
    if (filterMonth === 12) { setFilterMonth(1); setFilterYear(y => y + 1) }
    else setFilterMonth(m => m + 1)
  }

  const exportCSV = () => {
    const rows = [
      ['Date', 'Pièce', 'Libellé', 'Débit (compte)', 'Montant débit', 'Crédit (compte)', 'Montant crédit', 'Source'],
      ...filtered.map(e => [
        fmtDate(e.date_operation), e.piece_number || '', `"${e.libelle}"`,
        e.debit_account, e.montant.toString(),
        e.credit_account, e.montant.toString(),
        e.source || '',
      ]),
    ]
    const csv = '﻿' + rows.map(r => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `journal_${filterYear}_${String(filterMonth).padStart(2,'0')}.csv`
    a.click()
  }

  if (tenantLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
    </div>
  )

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {showSaisie && tenantId && (
        <ModalSaisie
          tenantId={tenantId}
          onClose={() => setShowSaisie(false)}
          onSaved={load}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/comptabilite" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('compta.journal.title')}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            SYSCOHADA · {t('compta.journal.subtitle')}
          </p>
        </div>
        <button onClick={() => setShowSaisie(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
          <Plus className="w-4 h-4" /> Saisie manuelle
        </button>
        <button onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors hover:bg-gray-50"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          <Download className="w-4 h-4" /> CSV
        </button>
        <button onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors hover:bg-gray-50"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Period Navigator */}
      <div className="flex items-center justify-between rounded-2xl border p-4"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>
            {MONTHS[filterMonth - 1]} {filterYear}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {filtered.length} écriture{filtered.length > 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total débits',  value: fmtFCFA(totalDebit),  color: 'var(--info)' },
          { label: 'Total crédits', value: fmtFCFA(totalCredit), color: 'var(--success)' },
          { label: 'Équilibre',     value: '✓ Équilibré',        color: '#16A34A' },
          { label: 'Exercice',      value: String(filterYear),   color: 'var(--text)' },
        ].map(k => (
          <div key={k.label} className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{k.label}</p>
            <p className="text-xl font-bold" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text" placeholder="Rechercher libellé, compte, pièce…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm border outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          />
        </div>
        <select value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-xl text-sm border outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <option value="all">Toutes sources</option>
          {Object.keys(SOURCE_KEYS).filter(k => k !== 'achat').map(k => (
            <option key={k} value={k}>{t(SOURCE_KEYS[k])}</option>
          ))}
        </select>
        <select value={filterYear} onChange={e => { setFilterYear(Number(e.target.value)); setPage(0) }}
          className="px-3 py-2 rounded-xl text-sm border outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Journal Table */}
      <div className="rounded-2xl border overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              <th className="px-4 py-3 text-left font-semibold text-[11px]" style={{ color: 'var(--text-secondary)' }}>Date</th>
              <th className="px-4 py-3 text-left font-semibold text-[11px]" style={{ color: 'var(--text-secondary)' }}>Pièce</th>
              <th className="px-4 py-3 text-left font-semibold text-[11px]" style={{ color: 'var(--text-secondary)' }}>Libellé</th>
              <th className="px-4 py-3 text-left font-semibold text-[11px]" style={{ color: 'var(--info)' }}>Compte débit</th>
              <th className="px-4 py-3 text-right font-semibold text-[11px]" style={{ color: 'var(--info)' }}>Débit</th>
              <th className="px-4 py-3 text-left font-semibold text-[11px]" style={{ color: 'var(--success)' }}>Compte crédit</th>
              <th className="px-4 py-3 text-right font-semibold text-[11px]" style={{ color: 'var(--success)' }}>Crédit</th>
              <th className="px-4 py-3 text-left font-semibold text-[11px]" style={{ color: 'var(--text-secondary)' }}>Source</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--primary)' }} />
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center" style={{ color: 'var(--text-secondary)' }}>
                  <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Aucune écriture pour cette période</p>
                  <p className="text-xs mt-1">Utilisez &ldquo;Saisie manuelle&rdquo; pour ajouter une écriture</p>
                </td>
              </tr>
            )}
            {!loading && filtered.map((e, i) => {
              const srcKey = SOURCE_KEYS[e.source || '']
              const srcLabel = srcKey ? t(srcKey) : (e.source || '—')
              const srcCls = SOURCE_CSS[e.source || ''] || 'bg-gray-100 text-gray-700'
              return (
                <tr key={e.id}
                  className="border-t transition-colors hover:bg-gray-50"
                  style={{ borderColor: 'var(--border)', background: i % 2 === 0 ? 'var(--surface)' : 'transparent' }}>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{fmtDate(e.date_operation)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{e.piece_number || '—'}</td>
                  <td className="px-4 py-2.5 max-w-xs truncate text-sm" style={{ color: 'var(--text)' }} title={e.libelle}>{e.libelle}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-sm" style={{ color: 'var(--info)' }}>{e.debit_account}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-sm" style={{ color: 'var(--info)' }}>{fmtFCFA(e.montant)}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-sm" style={{ color: 'var(--success)' }}>{e.credit_account}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-sm" style={{ color: 'var(--success)' }}>{fmtFCFA(e.montant)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${srcCls}`}>
                      {srcLabel}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr style={{ background: 'var(--bg)', borderTop: '2px solid var(--border)' }}>
                <td colSpan={4} className="px-4 py-3 font-semibold text-xs" style={{ color: 'var(--text-secondary)' }}>
                  TOTAL PÉRIODE
                </td>
                <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--info)' }}>{fmtFCFA(totalDebit)}</td>
                <td></td>
                <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--success)' }}>{fmtFCFA(totalCredit)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination */}
      {filtered.length === PAGE_SIZE && (
        <div className="flex items-center justify-center gap-4">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-xl text-sm font-medium border disabled:opacity-30 hover:bg-gray-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            ← Précédent
          </button>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Page {page + 1}</span>
          <button onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-xl text-sm font-medium border hover:bg-gray-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            Suivant →
          </button>
        </div>
      )}

      {/* Référence SYSCOHADA rapide */}
      <div className="rounded-2xl border p-4" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
          COMPTES SYSCOHADA FRÉQUENTS
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {[
            ['31',  'Marchandises'],  ['401', 'Fournisseurs'],
            ['411', 'Clients'],       ['421', 'Personnel — rémun.'],
            ['431', 'CNSS'],          ['4441','TVA facturée'],
            ['4446','TVA récupérable'],['512','Chèques à encaisser'],
            ['521', 'Banque'],        ['571', 'Caisse'],
            ['601', 'Achats marchandises'],['661','Charges personnel'],
            ['701', 'Ventes'],        ['664', 'CNSS patronal'],
          ].map(([num, lbl]) => (
            <div key={num} className="flex items-center gap-2">
              <span className="font-mono font-bold" style={{ color: 'var(--text)' }}>{num}</span>
              <span>{lbl}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
