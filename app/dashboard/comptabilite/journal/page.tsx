'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  BookOpen, Loader2, ChevronLeft, Search, Filter,
  Download, TrendingUp, TrendingDown, RefreshCw,
  ChevronLeft as ChevLeft, ChevronRight as ChevRight,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface JournalEntry {
  id: string
  date: string
  piece_number: string | null
  account_debit:  string
  account_credit: string
  amount:         number
  description:    string
  source:         string | null
  fiscal_year:    number | null
  created_at:     string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFCFA(n: number) {
  return new Intl.NumberFormat('fr-CG', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const SOURCE_LABELS: Record<string, { label: string; cls: string }> = {
  facture:   { label: 'Facture',       cls: 'bg-blue-100 text-blue-700'   },
  achat:     { label: 'Achat',         cls: 'bg-purple-100 text-purple-700' },
  paie:      { label: 'Paie',          cls: 'bg-pink-100 text-pink-700'   },
  cheque:    { label: 'Chèque',        cls: 'bg-yellow-100 text-yellow-700' },
  virement:  { label: 'Virement',      cls: 'bg-indigo-100 text-indigo-700' },
  caisse:    { label: 'Caisse',        cls: 'bg-green-100 text-green-700' },
  transfer:  { label: 'Transfert',     cls: 'bg-teal-100 text-teal-700'  },
  mobile:    { label: 'Mobile Money',  cls: 'bg-orange-100 text-orange-700' },
  tva:       { label: 'TVA',           cls: 'bg-red-100 text-red-700'    },
  stock:     { label: 'Stock',         cls: 'bg-cyan-100 text-cyan-700'  },
  manuel:    { label: 'Manuel',        cls: 'bg-gray-100 text-gray-700'  },
}

const MONTHS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function JournalPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const [entries, setEntries]         = useState<JournalEntry[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filterSource, setFilterSource] = useState('all')
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear]   = useState(new Date().getFullYear())
  const [page, setPage]               = useState(0)
  const PAGE_SIZE = 50

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    const start = `${filterYear}-${String(filterMonth).padStart(2, '0')}-01`
    const end   = new Date(filterYear, filterMonth, 0).toISOString().slice(0, 10)

    let query = supabase
      .from('journal_entries')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })
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
    return e.description.toLowerCase().includes(q) ||
      e.account_debit.includes(q)  ||
      e.account_credit.includes(q) ||
      (e.piece_number || '').toLowerCase().includes(q)
  })

  const totalDebit  = filtered.reduce((s, e) => s + e.amount, 0)
  const totalCredit = totalDebit // double-entry: always equal

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
      ['Date','Pièce','N° Débit','N° Crédit','Montant','Libellé','Source'],
      ...filtered.map(e => [
        fmtDate(e.date), e.piece_number || '', e.account_debit, e.account_credit,
        e.amount.toString(), `"${e.description}"`, e.source || '',
      ]),
    ]
    const csv = rows.map(r => r.join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `journal_${filterYear}_${String(filterMonth).padStart(2,'0')}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/comptabilite" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Journal Comptable OHADA</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Écritures en partie double — générées automatiquement par les triggers
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors hover:bg-gray-50"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          <Download className="w-4 h-4" /> Exporter CSV
        </button>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors hover:bg-gray-50"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Period Navigator */}
      <div className="flex items-center justify-between rounded-2xl border p-4"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>
            {MONTHS[filterMonth - 1]} {filterYear}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {filtered.length} écriture(s) affichée(s)
          </p>
        </div>
        <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevRight className="w-5 h-5" />
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Total débit</p>
          <p className="text-xl font-bold" style={{ color: 'var(--info)' }}>{fmtFCFA(totalDebit)}</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Total crédit</p>
          <p className="text-xl font-bold" style={{ color: 'var(--success)' }}>{fmtFCFA(totalCredit)}</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Équilibre</p>
          <p className="text-xl font-bold text-green-600">✓ Équilibré</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Exercice</p>
          <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>{filterYear}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Fiscal year</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text" placeholder="Libellé, N° compte, pièce…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm border outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          />
        </div>
        <select
          value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-xl text-sm border outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <option value="all">Toutes sources</option>
          {Object.entries(SOURCE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={filterYear} onChange={e => { setFilterYear(Number(e.target.value)); setPage(0) }}
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
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-secondary)', width: '100px' }}>Date</th>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-secondary)', width: '100px' }}>Pièce</th>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>Libellé</th>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-secondary)', width: '120px' }}>N° Débit</th>
              <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--text-secondary)', width: '140px' }}>Débit</th>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-secondary)', width: '120px' }}>N° Crédit</th>
              <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--text-secondary)', width: '140px' }}>Crédit</th>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-secondary)', width: '110px' }}>Source</th>
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
                  Aucune écriture pour cette période
                  <p className="text-xs mt-1">Les écritures sont créées automatiquement par les triggers lors de chaque opération financière.</p>
                </td>
              </tr>
            )}
            {!loading && filtered.map((e, i) => {
              const src = SOURCE_LABELS[e.source || ''] || { label: e.source || '—', cls: 'bg-gray-100 text-gray-700' }
              return (
                <tr key={e.id}
                  className="border-t transition-colors hover:bg-gray-50"
                  style={{ borderColor: 'var(--border)', background: i % 2 === 0 ? 'var(--surface)' : 'transparent' }}>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{fmtDate(e.date)}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {e.piece_number || '—'}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate" style={{ color: 'var(--text)' }} title={e.description}>
                    {e.description}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-sm" style={{ color: 'var(--info)' }}>
                    {e.account_debit}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--info)' }}>
                    {fmtFCFA(e.amount)}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-sm" style={{ color: 'var(--success)' }}>
                    {e.account_credit}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--success)' }}>
                    {fmtFCFA(e.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${src.cls}`}>
                      {src.label}
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
                <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--info)' }}>
                  {fmtFCFA(totalDebit)}
                </td>
                <td></td>
                <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--success)' }}>
                  {fmtFCFA(totalCredit)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination */}
      {filtered.length === PAGE_SIZE && (
        <div className="flex items-center justify-center gap-4">
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-xl text-sm font-medium border disabled:opacity-30 hover:bg-gray-50 transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            ← Précédent
          </button>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Page {page + 1}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-xl text-sm font-medium border hover:bg-gray-50 transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            Suivant →
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="rounded-2xl border p-4" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>PLAN COMPTABLE OHADA — COMPTES UTILISÉS</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {[
            ['310000', 'Stocks marchandises'],
            ['401000', 'Fournisseurs'],
            ['411000', 'Clients'],
            ['421000', 'Personnel — rémun.'],
            ['431000', 'CNSS'],
            ['441000', 'TVA collectée'],
            ['444000', 'TVA déductible'],
            ['512000', 'Chèques à encaisser'],
            ['521000', 'Banque'],
            ['571000', 'Caisse'],
            ['641000', 'Charges personnel'],
            ['644000', 'Charges sociales'],
            ['706000', 'Produits (ventes)'],
            ['661000', 'Charges financières'],
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
