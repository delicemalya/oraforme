'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useFmt } from '@/lib/hooks/useFmt'
import {
  genererFluxTresorerie, genererCompteResultat,
  type LigneEcriture, type FluxTresorerie,
} from '@/lib/syscohada/etats-financiers'
import { Droplets, Download, ChevronLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import Link from 'next/link'

const YEARS = [2024, 2025, 2026, 2027]

const SECTION_COLORS: Record<string, { bg: string; text: string; light: string }> = {
  ZA: { bg: '#2563EB', text: '#FFFFFF', light: '#EFF6FF' },
  ZB: { bg: '#7C3AED', text: '#FFFFFF', light: '#F5F3FF' },
  ZC: { bg: '#0891B2', text: '#FFFFFF', light: '#F0F9FF' },
}

function FluxIcon({ val }: { val: number }) {
  if (val > 0)  return <TrendingUp  size={14} className="text-[#16A34A]" />
  if (val < 0)  return <TrendingDown size={14} className="text-[#DC2626]" />
  return <Minus size={14} className="text-[#94A3B8]" />
}

export default function FluxTresoreriePage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId } = useTenant()
  const [ecritures, setEcritures] = useState<LigneEcriture[]>([])
  const [loading, setLoading]     = useState(true)
  const [year, setYear]           = useState(new Date().getFullYear())

  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('journal_entries')
        .select('debit_account, credit_account, montant')
        .eq('tenant_id', tenantId)
        .eq('fiscal_year', year)
      setEcritures((data || []).map((e: { debit_account: string; credit_account: string; montant: number }) => ({
        compte: e.debit_account, debit: e.montant, credit: 0,
      })).concat((data || []).map((e: { debit_account: string; credit_account: string; montant: number }) => ({
        compte: e.credit_account, debit: 0, credit: e.montant,
      }))))
      setLoading(false)
    })()
  }, [tenantId, year])

  const flux = useMemo<FluxTresorerie | null>(() => {
    if (!ecritures.length) return null
    const cr = genererCompteResultat(ecritures, String(year))
    return genererFluxTresorerie(ecritures, String(year), cr.resultatNet)
  }, [ecritures, year])

  function exportCSV() {
    if (!flux) return
    const rows: (string | number)[][] = [
      ['TABLEAU DES FLUX DE TRÉSORERIE', `Exercice ${year}`],
      [],
    ]
    for (const sec of flux.sections) {
      rows.push([sec.code, sec.titre])
      for (const l of sec.lignes) {
        rows.push([l.code, l.libelle, l.montant])
      }
      rows.push(['', `TOTAL ${sec.code}`, sec.total])
      rows.push([])
    }
    rows.push(['', 'VARIATION NETTE DE TRÉSORERIE', flux.variationNette])
    rows.push(['', 'Trésorerie à l\'ouverture', flux.tresoOuverture])
    rows.push(['', 'Trésorerie à la clôture', flux.tresoClôture])

    const csv = '﻿' + rows.map(r => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `flux-tresorerie-${year}.csv`
    a.click()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-[#94A3B8]">
      <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mr-2" />
      Calcul des flux…
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/comptabilite"
            className="p-2 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC]">
            <ChevronLeft size={16} className="text-[#64748B]" />
          </Link>
          <div>
            <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
              <Droplets size={22} className="text-[#2563EB]" />
              Tableau des Flux de Trésorerie
            </h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">
              SYSCOHADA révisé 2017 · Méthode indirecte · Exercice {year}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-white focus:outline-none">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
            <Download size={13} /> CSV
          </button>
        </div>
      </div>

      {!flux ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
          <Droplets size={40} className="mx-auto text-[#E2E8F0] mb-3" />
          <p className="text-[#64748B] text-[14px]">Aucune écriture comptable pour {year}</p>
          <p className="text-[12px] text-[#94A3B8] mt-1">
            Le tableau des flux se calcule automatiquement depuis le journal SYSCOHADA
          </p>
        </div>
      ) : (
        <>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Flux activités',    val: flux.sections[0].total, code: 'ZA', suffix: '' },
              { label: 'Flux investissement',val: flux.sections[1].total, code: 'ZB', suffix: '' },
              { label: 'Flux financement',  val: flux.sections[2].total, code: 'ZC', suffix: '' },
              { label: 'Variation nette',   val: flux.variationNette,    code: '=',  suffix: '' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[#94A3B8] font-semibold uppercase">{k.label}</span>
                  <span className="text-[10px] font-bold text-[#64748B]">{k.code}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FluxIcon val={k.val} />
                  <span className="text-[15px] font-extrabold" style={{
                    color: k.val > 0 ? '#16A34A' : k.val < 0 ? '#DC2626' : '#64748B'
                  }}>
                    {k.val !== 0 ? fmtFCFA(Math.abs(k.val)) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Sections de flux */}
          <div className="space-y-4">
            {flux.sections.map(sec => {
              const col = SECTION_COLORS[sec.code]
              return (
                <div key={sec.code} className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                  <div className="px-5 py-3.5 flex items-center justify-between"
                    style={{ background: col.bg }}>
                    <div>
                      <span className="text-[11px] font-bold opacity-80" style={{ color: col.text }}>
                        {sec.code}
                      </span>
                      <p className="text-[13px] font-extrabold mt-0.5" style={{ color: col.text }}>
                        {sec.titre}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] opacity-80" style={{ color: col.text }}>Total</p>
                      <p className="text-[18px] font-extrabold" style={{ color: col.text }}>
                        {sec.total >= 0 ? '+' : ''}{fmtFCFA(sec.total)}
                      </p>
                    </div>
                  </div>

                  <div>
                    {sec.lignes.map(ligne => (
                      <div key={ligne.code}
                        className="flex items-center justify-between px-5 py-2.5 border-b border-[#F8FAFC] hover:bg-[#F8FAFC]">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-mono font-bold text-[#94A3B8] w-8">{ligne.code}</span>
                          <span className="text-[12px] text-[#0F172A]">{ligne.libelle}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <FluxIcon val={ligne.montant} />
                          <span className="text-[12px] font-bold min-w-[100px] text-right" style={{
                            color: ligne.montant > 0 ? '#16A34A' : ligne.montant < 0 ? '#DC2626' : '#94A3B8'
                          }}>
                            {ligne.montant !== 0
                              ? `${ligne.montant > 0 ? '+' : ''}${fmtFCFA(ligne.montant)}`
                              : '—'}
                          </span>
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center justify-between px-5 py-3"
                      style={{ background: col.light }}>
                      <span className="text-[12px] font-extrabold" style={{ color: col.bg }}>
                        = Flux net {sec.code}
                      </span>
                      <span className="text-[14px] font-extrabold" style={{ color: col.bg }}>
                        {sec.total >= 0 ? '+' : ''}{fmtFCFA(sec.total)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Récapitulatif trésorerie */}
          <div className="bg-white rounded-xl border-2 border-[#0F172A] overflow-hidden">
            <div className="bg-[#0F172A] px-5 py-3">
              <p className="text-white text-[13px] font-extrabold">RÉCAPITULATIF — VARIATION DE TRÉSORERIE</p>
            </div>
            <div className="divide-y divide-[#E2E8F0]">
              {[
                { label: 'ZA — Flux des activités ordinaires',      val: flux.sections[0].total, bold: false },
                { label: 'ZB — Flux des activités d\'investissement', val: flux.sections[1].total, bold: false },
                { label: 'ZC — Flux des activités de financement',   val: flux.sections[2].total, bold: false },
                { label: 'VARIATION NETTE DE TRÉSORERIE (ZA+ZB+ZC)', val: flux.variationNette,    bold: true  },
                { label: 'Trésorerie à l\'ouverture de l\'exercice', val: flux.tresoOuverture,    bold: false },
                { label: 'Trésorerie à la clôture de l\'exercice',   val: flux.tresoClôture,      bold: true  },
              ].map(row => (
                <div key={row.label}
                  className={`flex items-center justify-between px-5 py-3 ${row.bold ? 'bg-[#F8FAFC]' : ''}`}>
                  <span className={`text-[12px] ${row.bold ? 'font-extrabold text-[#0F172A]' : 'text-[#64748B]'}`}>
                    {row.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <FluxIcon val={row.val} />
                    <span className={`text-[13px] font-extrabold ${row.bold ? 'text-[#0F172A]' : ''}`}
                      style={!row.bold ? { color: row.val >= 0 ? '#16A34A' : '#DC2626' } : {}}>
                      {row.val >= 0 ? '+' : ''}{fmtFCFA(row.val)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Note méthodologique */}
          <div className="bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] p-4 text-[11px] text-[#64748B]">
            <p className="font-semibold text-[#0F172A] mb-1">Méthode de calcul — SYSCOHADA révisé 2017</p>
            <p>
              Ce tableau est établi selon la <strong>méthode indirecte</strong> à partir des écritures du journal SYSCOHADA.
              La variation de trésorerie est calculée depuis les mouvements nets sur les comptes de classe 3 (stocks),
              4 (tiers), 2 (immobilisations), 1 (capitaux) et 5 (trésorerie).
              Les flux ZA, ZB, ZC correspondent aux définitions officielles du Système Comptable OHADA révisé 2017.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
