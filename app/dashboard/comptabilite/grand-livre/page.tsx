'use client'

/**
 * Grand Livre OHADA — Soldes par compte avec détail des mouvements
 */

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { fmtFCFA } from '@/lib/admin-config'
import { OHADA_ACCOUNTS } from '@/lib/accounting-engine'
import { Scale, Search, Download, ChevronDown, ChevronRight } from 'lucide-react'

interface Movement { id: string; date_operation: string; libelle: string; debit_account: string; credit_account: string; montant: number; source: string }
interface AccountSummary { number: string; name: string; classe: number; type: string; total_debit: number; total_credit: number; solde: number; movements: Movement[] }

const YEARS = [2024, 2025, 2026, 2027]

export default function GrandLivrePage() {
  const { tenantId } = useTenant()
  const { t, locale } = useLocale()
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [classe, setClasse]       = useState('all')
  const [year, setYear]           = useState(new Date().getFullYear())
  const [expanded, setExpanded]   = useState<string | null>(null)

  const intlLocale = locale === 'fr' ? 'fr-FR' : locale === 'en' ? 'en-GB' : locale === 'pt' ? 'pt-PT' : locale === 'es' ? 'es-ES' : 'fr-FR'

  const CLASSES = [
    { id: 'all', label: t('compta.grandlivre.allAccounts') },
    { id: '1', label: 'Cl. 1 — Capitaux' },
    { id: '2', label: 'Cl. 2 — Immobilisations' },
    { id: '3', label: 'Cl. 3 — Stocks' },
    { id: '4', label: 'Cl. 4 — Tiers' },
    { id: '5', label: 'Cl. 5 — Trésorerie' },
    { id: '6', label: 'Cl. 6 — Charges' },
    { id: '7', label: 'Cl. 7 — Produits' },
  ]

  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('fiscal_year', year)
        .order('date_operation')
      setMovements((data || []) as Movement[])
      setLoading(false)
    })()
  }, [tenantId, year])

  /* Build account summaries */
  const accounts = useMemo<AccountSummary[]>(() => {
    const map = new Map<string, AccountSummary>()

    for (const mv of movements) {
      /* Debit side */
      if (mv.debit_account) {
        if (!map.has(mv.debit_account)) {
          const ohada = OHADA_ACCOUNTS.find(a => String(a.number) === mv.debit_account)
          map.set(mv.debit_account, {
            number: mv.debit_account, name: ohada?.name || mv.debit_account,
            classe: Math.floor(Number(mv.debit_account) / 100000),
            type: ohada?.type || '—', total_debit: 0, total_credit: 0, solde: 0, movements: [],
          })
        }
        const acc = map.get(mv.debit_account)!
        acc.total_debit += mv.montant
        acc.movements.push(mv)
      }
      /* Credit side */
      if (mv.credit_account) {
        if (!map.has(mv.credit_account)) {
          const ohada = OHADA_ACCOUNTS.find(a => String(a.number) === mv.credit_account)
          map.set(mv.credit_account, {
            number: mv.credit_account, name: ohada?.name || mv.credit_account,
            classe: Math.floor(Number(mv.credit_account) / 100000),
            type: ohada?.type || '—', total_debit: 0, total_credit: 0, solde: 0, movements: [],
          })
        }
        const acc = map.get(mv.credit_account)!
        acc.total_credit += mv.montant
        if (!acc.movements.find(m => m.id === mv.id)) acc.movements.push(mv)
      }
    }

    /* Compute solde */
    for (const acc of map.values()) {
      acc.solde = acc.total_debit - acc.total_credit
    }

    return Array.from(map.values()).sort((a, b) => a.number.localeCompare(b.number))
  }, [movements])

  /* Filtered */
  const filtered = useMemo(() => {
    return accounts.filter(a => {
      if (classe !== 'all' && String(a.classe) !== classe) return false
      if (search) {
        const q = search.toLowerCase()
        return a.number.includes(q) || a.name.toLowerCase().includes(q)
      }
      return true
    })
  }, [accounts, classe, search])

  /* Totals */
  const totalDebit  = filtered.reduce((s, a) => s + a.total_debit, 0)
  const totalCredit = filtered.reduce((s, a) => s + a.total_credit, 0)

  /* CSV export */
  function exportCSV() {
  const { t } = useLocale()
    const rows = filtered.flatMap(a =>
      a.movements.map(m => ({
        [t('compta.grandlivre.colCompte')]: a.number,
        [t('compta.grandlivre.colLabel')]: a.name,
        [t('compta.grandlivre.colDate')]: m.date_operation,
        [t('compta.grandlivre.colLabel')]: m.libelle,
        [t('compta.grandlivre.colDebit')]: m.debit_account === a.number ? m.montant : 0,
        [t('compta.grandlivre.colCredit')]: m.credit_account === a.number ? m.montant : 0,
        Source: m.source,
      }))
    )
    if (!rows.length) return
    const csv = '﻿' + [Object.keys(rows[0]).join(';'), ...rows.map(r => Object.values(r).join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `grand-livre-${year}.csv`; a.click()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-[#94A3B8]">
      <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mr-2" />
      {t('common.loading')}
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
            <Scale size={22} className="text-[#2563EB]" />
            {t('compta.grandlivre.title')}
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            {t('compta.grandlivre.subtitle')} · {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-white focus:outline-none">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
            <Download size={13} /> {t('common.export')} CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('compta.grandlivre.totalDebit'),  value: totalDebit,  color: '#2563EB' },
          { label: t('compta.grandlivre.totalCredit'), value: totalCredit, color: '#16A34A' },
          {
            label: t('compta.journal.balance'),
            value: Math.abs(totalDebit - totalCredit),
            color: Math.abs(totalDebit - totalCredit) < 1 ? '#16A34A' : '#DC2626',
            badge: Math.abs(totalDebit - totalCredit) < 1 ? t('compta.journal.balanced') : t('compta.journal.unbalanced'),
          },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <div className="text-[18px] font-extrabold truncate" style={{ color: k.color }}>{fmtFCFA(k.value)}</div>
            <div className="text-[11px] text-[#64748B]">{k.label}</div>
            {'badge' in k && k.badge && <div className="text-[10px] font-bold mt-0.5" style={{ color: k.color }}>{k.badge}</div>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('compta.grandlivre.searchPlh')}
            className="w-full pl-8 pr-3 py-2 text-[12px] border border-[#E2E8F0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30" />
        </div>
        <select value={classe} onChange={e => setClasse(e.target.value)}
          className="border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] bg-white focus:outline-none">
          {CLASSES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] py-20 text-center">
          <Scale size={36} className="mx-auto mb-2 text-[#E2E8F0]" />
          <p className="text-[13px] text-[#94A3B8]">{t('compta.grandlivre.empty')}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(acc => {
            const isExp = expanded === acc.number
            const soldeColor = acc.solde >= 0 ? '#16A34A' : '#DC2626'
            return (
              <div key={acc.number} className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                {/* Header row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#F8FAFC]"
                  onClick={() => setExpanded(isExp ? null : acc.number)}
                >
                  <span className="w-6 text-[#94A3B8]">
                    {isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  <span className="font-mono text-[12px] font-bold text-[#2563EB] w-20 shrink-0">{acc.number}</span>
                  <span className="flex-1 text-[12px] font-semibold text-[#0F172A] truncate">{acc.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#F1F5F9] text-[#64748B] font-semibold hidden sm:block">{acc.type}</span>
                  <span className="text-[11px] text-[#64748B] w-28 text-right hidden md:block">{fmtFCFA(acc.total_debit)}</span>
                  <span className="text-[11px] text-[#64748B] w-28 text-right hidden md:block">{fmtFCFA(acc.total_credit)}</span>
                  <span className="text-[12px] font-extrabold w-28 text-right" style={{ color: soldeColor }}>
                    {fmtFCFA(Math.abs(acc.solde))}
                  </span>
                  <span className="text-[9px] font-bold w-8 text-center" style={{ color: soldeColor }}>
                    {acc.solde >= 0 ? 'Dtr' : 'Ctr'}
                  </span>
                </div>

                {/* Movements detail */}
                {isExp && (
                  <div className="border-t border-[#F1F5F9] overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead className="bg-[#F8FAFC]">
                        <tr>
                          {[t('compta.grandlivre.colDate'), t('compta.grandlivre.colLabel'), t('compta.grandlivre.colDebit'), t('compta.grandlivre.colCredit'), 'Source'].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-[#94A3B8] uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {acc.movements.sort((a, b) => a.date_operation.localeCompare(b.date_operation)).map(m => (
                          <tr key={m.id} className="border-t border-[#F8FAFC] hover:bg-[#F8FAFC]">
                            <td className="px-3 py-1.5 text-[#64748B] whitespace-nowrap">
                              {new Date(m.date_operation).toLocaleDateString(intlLocale, { day: '2-digit', month: 'short' })}
                            </td>
                            <td className="px-3 py-1.5 max-w-[200px] truncate font-medium text-[#0F172A]">{m.libelle}</td>
                            <td className="px-3 py-1.5 text-right font-bold text-[#2563EB]">
                              {m.debit_account === acc.number ? fmtFCFA(m.montant) : '—'}
                            </td>
                            <td className="px-3 py-1.5 text-right font-bold text-[#16A34A]">
                              {m.credit_account === acc.number ? fmtFCFA(m.montant) : '—'}
                            </td>
                            <td className="px-3 py-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B] text-[9px] font-semibold uppercase">
                                {m.source || '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {/* Cumul */}
                        <tr className="bg-[#F8FAFC] border-t-2 border-[#E2E8F0]">
                          <td colSpan={2} className="px-3 py-2 text-[11px] font-bold text-[#0F172A]">
                            {t('compta.grandlivre.totalDebit').replace('Total ', '')} {acc.number}
                          </td>
                          <td className="px-3 py-2 text-right font-extrabold text-[#2563EB]">{fmtFCFA(acc.total_debit)}</td>
                          <td className="px-3 py-2 text-right font-extrabold text-[#16A34A]">{fmtFCFA(acc.total_credit)}</td>
                          <td className="px-3 py-2 text-right font-extrabold" style={{ color: soldeColor }}>
                            {t('compta.grandlivre.solde')}: {fmtFCFA(Math.abs(acc.solde))} {acc.solde >= 0 ? 'D' : 'C'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}

          {/* Grand total */}
          <div className="bg-[#0F172A] rounded-xl px-4 py-3 flex items-center gap-4 text-white">
            <span className="flex-1 text-[12px] font-bold">{t('compta.balance.totalRow')} — {filtered.length} compte{filtered.length > 1 ? 's' : ''}</span>
            <span className="text-[12px] hidden md:block">{t('compta.grandlivre.totalDebit')}: <strong>{fmtFCFA(totalDebit)}</strong></span>
            <span className="text-[12px] hidden md:block">{t('compta.grandlivre.totalCredit')}: <strong>{fmtFCFA(totalCredit)}</strong></span>
            <span className={`text-[12px] font-bold ${Math.abs(totalDebit - totalCredit) < 1 ? 'text-[#4ADE80]' : 'text-[#FCA5A5]'}`}>
              {Math.abs(totalDebit - totalCredit) < 1 ? t('compta.journal.balanced') : `${t('compta.rapproch.ecart')}: ${fmtFCFA(Math.abs(totalDebit - totalCredit))}`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
