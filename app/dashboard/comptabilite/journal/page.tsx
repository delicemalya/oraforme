'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import {
  BookOpen, Loader2, Search,
  Download, RefreshCw,
  ChevronLeft, ChevronRight,
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

const SOURCE_CSS: Record<string, string> = {
  facture:   'bg-blue-100 text-blue-700',
  achat:     'bg-purple-100 text-purple-700',
  paie:      'bg-pink-100 text-pink-700',
  cheque:    'bg-yellow-100 text-yellow-700',
  virement:  'bg-indigo-100 text-indigo-700',
  caisse:    'bg-green-100 text-green-700',
  transfer:  'bg-teal-100 text-teal-700',
  mobile:    'bg-orange-100 text-orange-700',
  tva:       'bg-red-100 text-red-700',
  stock:     'bg-cyan-100 text-cyan-700',
  manuel:    'bg-gray-100 text-gray-700',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function JournalPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const { t, locale } = useLocale()

  const [entries, setEntries]         = useState<JournalEntry[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filterSource, setFilterSource] = useState('all')
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear]   = useState(new Date().getFullYear())
  const [page, setPage]               = useState(0)
  const PAGE_SIZE = 50

  // Locale-aware month names
  const intlLocale = locale === 'fr' ? 'fr-FR' : locale === 'en' ? 'en-GB' : locale === 'pt' ? 'pt-PT' : locale === 'es' ? 'es-ES' : 'fr-FR'
  const MONTHS = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(intlLocale, { month: 'long' }).format(new Date(2024, i, 1))
  )

  // Locale-aware date formatting
  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString(intlLocale, { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // Source labels from i18n
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
      [t('common.date'), t('compta.journal.colPiece'), t('compta.journal.colDebit'), t('compta.journal.colCredit'), t('common.amount'), t('compta.journal.colLabel'), t('compta.journal.colSource')],
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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('compta.journal.title')}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {t('compta.journal.subtitle')}
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors hover:bg-gray-50"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          <Download className="w-4 h-4" /> {t('common.export')} CSV
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
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>
            {MONTHS[filterMonth - 1]} {filterYear}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {filtered.length} {t('compta.journal.empty').toLowerCase()}
          </p>
        </div>
        <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('compta.journal.totalDebit')}</p>
          <p className="text-xl font-bold" style={{ color: 'var(--info)' }}>{fmtFCFA(totalDebit)}</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('compta.journal.totalCredit')}</p>
          <p className="text-xl font-bold" style={{ color: 'var(--success)' }}>{fmtFCFA(totalCredit)}</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('compta.journal.balance')}</p>
          <p className="text-xl font-bold text-green-600">{t('compta.journal.balanced')}</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('common.year')}</p>
          <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>{filterYear}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text" placeholder={t('compta.journal.searchPlh')}
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm border outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          />
        </div>
        <select
          value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-xl text-sm border outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <option value="all">{t('compta.journal.filterAll')}</option>
          {Object.entries(SOURCE_KEYS).map(([k, tKey]) => (
            <option key={k} value={k}>{t(tKey)}</option>
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
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-secondary)', width: '100px' }}>{t('compta.journal.colDate')}</th>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-secondary)', width: '100px' }}>{t('compta.journal.colPiece')}</th>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('compta.journal.colLabel')}</th>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-secondary)', width: '120px' }}>{t('compta.journal.colDebit')}</th>
              <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--text-secondary)', width: '140px' }}>{t('compta.journal.colDebit')}</th>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-secondary)', width: '120px' }}>{t('compta.journal.colCredit')}</th>
              <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--text-secondary)', width: '140px' }}>{t('compta.journal.colCredit')}</th>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-secondary)', width: '110px' }}>{t('compta.journal.colSource')}</th>
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
                  {t('compta.journal.empty')}
                  <p className="text-xs mt-1">{t('compta.journal.subtitle')}</p>
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
                  {t('treso.historique.totalPeriod').toUpperCase()}
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
            ← {t('common.previous')}
          </button>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('common.period')} {page + 1}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-xl text-sm font-medium border hover:bg-gray-50 transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            {t('common.next')} →
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="rounded-2xl border p-4" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>{t('compta.plan.title').toUpperCase()}</p>
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
