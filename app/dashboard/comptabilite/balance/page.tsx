'use client'

/**
 * Balance Générale OHADA — Trial Balance
 * Totaux débit/crédit/solde par compte pour une période
 */

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { fmtFCFA } from '@/lib/admin-config'
import { OHADA_ACCOUNTS } from '@/lib/accounting-engine'
import { BarChart2, Download, CheckCircle2, AlertTriangle } from 'lucide-react'

interface Movement { id: string; date_operation: string; libelle: string; debit_account: string; credit_account: string; montant: number }

interface BalanceLine {
  number: string; name: string; classe: number; type: string
  total_debit: number; total_credit: number
  solde_debiteur: number; solde_crediteur: number
}

const YEARS = [2024, 2025, 2026, 2027]

export default function BalancePage() {
  const { tenantId } = useTenant()
  const { t, locale } = useLocale()
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading]     = useState(true)
  const [year, setYear]           = useState(new Date().getFullYear())
  const [periode, setPeriode]     = useState<'annee' | number>('annee')
  const [filterClasse, setFilterClasse] = useState('all')
  const [showZero, setShowZero]   = useState(false)

  const intlLocale = locale === 'fr' ? 'fr-FR' : locale === 'en' ? 'en-GB' : locale === 'pt' ? 'pt-PT' : locale === 'es' ? 'es-ES' : 'fr-FR'
  const MONTHS = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(intlLocale, { month: 'long' }).format(new Date(2024, i, 1))
  )

  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('journal_entries')
        .select('id, date_operation, libelle, debit_account, credit_account, montant')
        .eq('tenant_id', tenantId)
        .eq('fiscal_year', year)
        .order('date_operation')
      setMovements((data || []) as Movement[])
      setLoading(false)
    })()
  }, [tenantId, year])

  /* Filter by month if needed */
  const filtered = useMemo(() => {
    if (periode === 'annee') return movements
    return movements.filter(m => new Date(m.date_operation).getMonth() + 1 === periode)
  }, [movements, periode])

  /* Build balance lines */
  const balanceLines = useMemo<BalanceLine[]>(() => {
    const map = new Map<string, BalanceLine>()

    for (const mv of filtered) {
      for (const [acct, side] of [[mv.debit_account, 'debit'], [mv.credit_account, 'credit']] as [string, string][]) {
        if (!acct) continue
        if (!map.has(acct)) {
          const ohada = OHADA_ACCOUNTS.find(a => String(a.number) === acct)
          map.set(acct, {
            number: acct, name: ohada?.name || acct,
            classe: Math.floor(Number(acct) / 100000),
            type: ohada?.type || '—',
            total_debit: 0, total_credit: 0,
            solde_debiteur: 0, solde_crediteur: 0,
          })
        }
        const line = map.get(acct)!
        if (side === 'debit') line.total_debit += mv.montant
        else line.total_credit += mv.montant
      }
    }

    for (const line of map.values()) {
      const diff = line.total_debit - line.total_credit
      line.solde_debiteur  = diff > 0 ? diff : 0
      line.solde_crediteur = diff < 0 ? Math.abs(diff) : 0
    }

    return Array.from(map.values())
      .filter(l => showZero || (l.total_debit > 0 || l.total_credit > 0))
      .filter(l => filterClasse === 'all' || String(l.classe) === filterClasse)
      .sort((a, b) => a.number.localeCompare(b.number))
  }, [filtered, showZero, filterClasse])

  /* Totals */
  const totDebit  = balanceLines.reduce((s, l) => s + l.total_debit, 0)
  const totCredit = balanceLines.reduce((s, l) => s + l.total_credit, 0)
  const totSoldD  = balanceLines.reduce((s, l) => s + l.solde_debiteur, 0)
  const totSoldC  = balanceLines.reduce((s, l) => s + l.solde_crediteur, 0)
  const isBalanced = Math.abs(totDebit - totCredit) < 1 && Math.abs(totSoldD - totSoldC) < 1

  /* CSV */
  function exportCSV() {
    const rows = balanceLines.map(l => ({
      [t('compta.balance.colCompte')]: l.number,
      [t('compta.balance.colIntitule')]: l.name,
      Classe: l.classe, Type: l.type,
      [t('compta.balance.colDebit')]: l.total_debit,
      [t('compta.balance.colCredit')]: l.total_credit,
      [t('compta.balance.colSolde') + ' D']: l.solde_debiteur,
      [t('compta.balance.colSolde') + ' C']: l.solde_crediteur,
    }))
    if (!rows.length) return
    const csv = '﻿' + [Object.keys(rows[0]).join(';'), ...rows.map(r => Object.values(r).join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `balance-${year}${periode !== 'annee' ? `-m${periode}` : ''}.csv`; a.click()
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
            <BarChart2 size={22} className="text-[#2563EB]" />
            {t('compta.balance.title')}
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            {t('compta.balance.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-white focus:outline-none">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={String(periode)} onChange={e => setPeriode(e.target.value === 'annee' ? 'annee' : Number(e.target.value))}
            className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] bg-white focus:outline-none">
            <option value="annee">{t('common.year')}</option>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
            <Download size={13} /> CSV
          </button>
        </div>
      </div>

      {/* Équilibre banner */}
      <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${
        isBalanced
          ? 'bg-[#F0FDF4] border-[#86EFAC] text-[#16A34A]'
          : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
      }`}>
        {isBalanced
          ? <CheckCircle2 size={16} />
          : <AlertTriangle size={16} />}
        <p className="text-[12px] font-bold">
          {isBalanced
            ? `${t('compta.balance.equilibreOk')} — ${balanceLines.length} comptes`
            : `${t('compta.balance.equilibreKo')} — ${t('compta.rapproch.ecart')}: ${fmtFCFA(Math.abs(totDebit - totCredit))}`}
        </p>
      </div>

      {/* Totaux KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('compta.balance.colDebit'),   value: fmtFCFA(totDebit),  color: '#2563EB' },
          { label: t('compta.balance.colCredit'),  value: fmtFCFA(totCredit), color: '#16A34A' },
          { label: t('compta.balance.colSolde') + ' D', value: fmtFCFA(totSoldD),  color: '#8B5CF6' },
          { label: t('compta.balance.colSolde') + ' C', value: fmtFCFA(totSoldC),  color: '#D97706' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-3">
            <div className="text-[16px] font-extrabold truncate" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[10px] text-[#64748B] mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <select value={filterClasse} onChange={e => setFilterClasse(e.target.value)}
          className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] bg-white focus:outline-none">
          <option value="all">{t('compta.plan.allClasses')}</option>
          {[1,2,3,4,5,6,7].map(c => <option key={c} value={c}>Classe {c}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[12px] text-[#64748B] cursor-pointer">
          <input type="checkbox" checked={showZero} onChange={e => setShowZero(e.target.checked)}
            className="rounded" />
          {t('compta.balance.empty')}
        </label>
      </div>

      {/* Balance table */}
      {balanceLines.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] py-20 text-center">
          <BarChart2 size={36} className="mx-auto mb-2 text-[#E2E8F0]" />
          <p className="text-[13px] text-[#94A3B8]">{t('compta.balance.empty')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-[#0F172A] text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold w-24">{t('compta.balance.colCompte')}</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold">{t('compta.balance.colIntitule')}</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold">{t('compta.balance.colDebit')}</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold">{t('compta.balance.colCredit')}</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold border-l border-white/20">{t('compta.balance.colSolde')} D</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold">{t('compta.balance.colSolde')} C</th>
                </tr>
              </thead>
              <tbody>
                {/* Group by class */}
                {[1,2,3,4,5,6,7].map(cl => {
                  const clLines = balanceLines.filter(l => l.classe === cl)
                  if (clLines.length === 0) return null
                  const clLabel = ['','Capitaux','Immobilisations','Stocks','Tiers','Trésorerie','Charges','Produits'][cl]
                  const clD = clLines.reduce((s, l) => s + l.total_debit, 0)
                  const clC = clLines.reduce((s, l) => s + l.total_credit, 0)
                  const clSD = clLines.reduce((s, l) => s + l.solde_debiteur, 0)
                  const clSC = clLines.reduce((s, l) => s + l.solde_crediteur, 0)

                  return (
                    <>
                      {/* Class header */}
                      <tr key={`cl-${cl}`} className="bg-[#EFF6FF] border-b border-[#E2E8F0]">
                        <td colSpan={6} className="px-4 py-1.5 text-[11px] font-bold text-[#2563EB]">
                          Classe {cl} — {clLabel}
                        </td>
                      </tr>
                      {clLines.map(l => (
                        <tr key={l.number} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                          <td className="px-4 py-2 font-mono text-[11px] font-bold text-[#2563EB]">{l.number}</td>
                          <td className="px-4 py-2 font-medium text-[#0F172A]">{l.name}</td>
                          <td className="px-4 py-2 text-right text-[#2563EB] font-medium">{fmtFCFA(l.total_debit)}</td>
                          <td className="px-4 py-2 text-right text-[#16A34A] font-medium">{fmtFCFA(l.total_credit)}</td>
                          <td className="px-4 py-2 text-right font-bold border-l border-[#F1F5F9]">
                            {l.solde_debiteur > 0 ? fmtFCFA(l.solde_debiteur) : '—'}
                          </td>
                          <td className="px-4 py-2 text-right font-bold">
                            {l.solde_crediteur > 0 ? fmtFCFA(l.solde_crediteur) : '—'}
                          </td>
                        </tr>
                      ))}
                      {/* Class subtotal */}
                      <tr key={`cl-${cl}-tot`} className="bg-[#F8FAFC] border-b-2 border-[#E2E8F0]">
                        <td colSpan={2} className="px-4 py-1.5 text-[11px] font-bold text-[#64748B] italic">
                          Classe {cl} — {t('compta.balance.totalRow')}
                        </td>
                        <td className="px-4 py-1.5 text-right text-[11px] font-bold text-[#2563EB]">{fmtFCFA(clD)}</td>
                        <td className="px-4 py-1.5 text-right text-[11px] font-bold text-[#16A34A]">{fmtFCFA(clC)}</td>
                        <td className="px-4 py-1.5 text-right text-[11px] font-bold border-l border-[#E2E8F0]">{clSD > 0 ? fmtFCFA(clSD) : '—'}</td>
                        <td className="px-4 py-1.5 text-right text-[11px] font-bold">{clSC > 0 ? fmtFCFA(clSC) : '—'}</td>
                      </tr>
                    </>
                  )
                })}

                {/* Grand total */}
                <tr className="bg-[#0F172A] text-white">
                  <td colSpan={2} className="px-4 py-3 font-extrabold text-[12px]">{t('compta.balance.totalRow')}</td>
                  <td className="px-4 py-3 text-right font-extrabold">{fmtFCFA(totDebit)}</td>
                  <td className="px-4 py-3 text-right font-extrabold">{fmtFCFA(totCredit)}</td>
                  <td className="px-4 py-3 text-right font-extrabold border-l border-white/20">{fmtFCFA(totSoldD)}</td>
                  <td className="px-4 py-3 text-right font-extrabold">{fmtFCFA(totSoldC)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
