'use client'

/**
 * TVA & Fiscalité Congo-Brazzaville OHADA
 * TVA 18% + Contribution d'Appui 5% sur TVA collectée
 * Déclarations mensuelles, récupération, solde TVA
 */

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useFmt } from '@/lib/hooks/useFmt'
import { useLocale } from '@/lib/hooks/useLocale'
import { Receipt, Download, CheckCircle2, AlertTriangle, Calendar } from 'lucide-react'

interface Movement {
  id: string; date_operation: string; libelle: string
  debit_account: string; credit_account: string; montant: number; source: string
}

interface DeclarationMois {
  mois: number; annee: number; label: string
  tva_collectee: number; tva_deductible: number; solde_tva: number
  ca_assiette: number; contribution_appui: number
  statut: 'a_declarer' | 'declaree' | 'payee'
}

const TVA_RATE   = 0.18
const CA_RATE    = 0.05   // Contribution d'Appui = 5% sur TVA collectée
const YEARS      = [2024, 2025, 2026, 2027]

/* OHADA accounts for TVA */
// SYSCOHADA Révisé 2017 — 4441 TVA facturée · 4446 TVA récupérable sur achats
const TVA_COLLECTEE_ACCTS  = ['4441', '4442']   // TVA facturée (crédit)
const TVA_DEDUCTIBLE_ACCTS = ['4445', '4446']   // TVA récupérable (débit)
const CA_ACCT              = ['442']             // État, autres impôts (Contribution d'Appui 5%)

export default function TVAPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId } = useTenant()
  const { t, locale } = useLocale()
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading]     = useState(true)
  const [year, setYear]           = useState(new Date().getFullYear())
  const [selectedMois, setSelectedMois] = useState<number | null>(null)

  const intlLocale = locale === 'fr' ? 'fr-FR' : locale === 'en' ? 'en-GB' : locale === 'pt' ? 'pt-PT' : locale === 'es' ? 'es-ES' : 'fr-FR'
  const MONTHS_FR = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(intlLocale, { month: 'long' }).format(new Date(2024, i, 1))
  )

  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('journal_entries')
        .select('id, date_operation, libelle, debit_account, credit_account, montant, source')
        .eq('tenant_id', tenantId)
        .eq('fiscal_year', year)
        .order('date_operation')
      setMovements((data || []) as Movement[])
      setLoading(false)
    })()
  }, [tenantId, year])

  /* Build monthly declarations */
  const declarations = useMemo<DeclarationMois[]>(() => {
    return MONTHS_FR.map((label, idx) => {
      const mois   = idx + 1
      const mvMois = movements.filter(m => new Date(m.date_operation).getMonth() + 1 === mois)

      /* TVA collectée = mouvements sur comptes 4457xx en crédit */
      const tva_collectee = mvMois
        .filter(m => TVA_COLLECTEE_ACCTS.includes(m.credit_account))
        .reduce((s, m) => s + m.montant, 0)

      /* TVA déductible = mouvements sur comptes 4456xx en débit */
      const tva_deductible = mvMois
        .filter(m => TVA_DEDUCTIBLE_ACCTS.includes(m.debit_account))
        .reduce((s, m) => s + m.montant, 0)

      /* CA assiette = TVA collectée HT base */
      const ca_assiette = tva_collectee > 0 ? tva_collectee / TVA_RATE : 0

      /* Contribution d'Appui = 5% sur TVA collectée */
      const contribution_appui = tva_collectee * CA_RATE

      const solde_tva = tva_collectee - tva_deductible

      return {
        mois, annee: year, label,
        tva_collectee, tva_deductible, solde_tva,
        ca_assiette, contribution_appui,
        statut: solde_tva <= 0 ? 'declaree' : 'a_declarer',
      }
    })
  }, [movements, year])

  /* Annual totals */
  const totals = useMemo(() => ({
    tva_collectee:    declarations.reduce((s, d) => s + d.tva_collectee, 0),
    tva_deductible:   declarations.reduce((s, d) => s + d.tva_deductible, 0),
    solde_tva:        declarations.reduce((s, d) => s + d.solde_tva, 0),
    ca_assiette:      declarations.reduce((s, d) => s + d.ca_assiette, 0),
    contribution_appui: declarations.reduce((s, d) => s + d.contribution_appui, 0),
    a_payer:          declarations.filter(d => d.solde_tva > 0).reduce((s, d) => s + d.solde_tva, 0),
  }), [declarations])

  /* Detail movements for selected month */
  const detailMvs = useMemo(() => {
    if (selectedMois === null) return []
    return movements.filter(m => new Date(m.date_operation).getMonth() + 1 === selectedMois &&
      (TVA_COLLECTEE_ACCTS.includes(m.credit_account) ||
       TVA_DEDUCTIBLE_ACCTS.includes(m.debit_account) ||
       CA_ACCT.includes(m.credit_account)))
  }, [movements, selectedMois])

  function exportCSV() {
    const rows = declarations.map(d => ({
      Mois: d.label, Exercice: d.annee,
      'CA HT': d.ca_assiette, 'TVA collectée (18%)': d.tva_collectee,
      'TVA déductible': d.tva_deductible, 'Solde TVA': d.solde_tva,
      "Contribution d'Appui (5%)": d.contribution_appui,
    }))
    const csv = '﻿' + [Object.keys(rows[0]).join(';'), ...rows.map(r => Object.values(r).join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `tva-${year}.csv`; a.click()
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
            <Receipt size={22} className="text-[#2563EB]" />
            {t('compta.tva.title')}
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            {t('compta.tva.subtitle')} · {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-white focus:outline-none">
            {YEARS.map(y => <option key={y}>{y}</option>)}
          </select>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
            <Download size={13} /> CSV
          </button>
        </div>
      </div>

      {/* Règles TVA Congo */}
      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4 text-[12px] text-[#1E40AF] flex gap-3">
        <Receipt size={16} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Régime TVA — Congo-Brazzaville (SYSCOHADA)</p>
          <p className="mt-0.5 text-[11px]">
            TVA collectée <strong>18%</strong> sur ventes · TVA déductible <strong>18%</strong> sur achats ·
            Contribution d'Appui <strong>5%</strong> calculée sur la TVA collectée · Déclaration mensuelle obligatoire
          </p>
        </div>
      </div>

      {/* KPIs annuels */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'CA HT annuel',        value: totals.ca_assiette,       color: '#0F172A' },
          { label: 'TVA collectée',        value: totals.tva_collectee,     color: '#2563EB' },
          { label: 'TVA déductible',       value: totals.tva_deductible,    color: '#16A34A' },
          { label: 'Solde TVA net',        value: totals.solde_tva,         color: totals.solde_tva >= 0 ? '#DC2626' : '#16A34A' },
          { label: "Contrib. d'Appui",     value: totals.contribution_appui, color: '#D97706' },
          { label: 'TVA à payer/an',       value: totals.a_payer,           color: '#DC2626' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-3">
            <div className="text-[15px] font-extrabold truncate" style={{ color: k.color }}>{fmtFCFA(k.value)}</div>
            <div className="text-[10px] text-[#64748B] mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Monthly table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E8F0]">
          <h2 className="text-[13px] font-extrabold text-[#0F172A]">Déclarations mensuelles</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-[#0F172A] text-white">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold">{t('common.month')}</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold">CA HT</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold">TVA Collectée</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold">TVA Déductible</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold">Solde TVA</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold">Contrib. Appui</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold">{t('common.status')}</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold">Détail</th>
              </tr>
            </thead>
            <tbody>
              {declarations.map(d => {
                const isSelected = selectedMois === d.mois
                const isEmpty = d.tva_collectee === 0 && d.tva_deductible === 0
                return (
                  <tr key={d.mois}
                    className={`border-b border-[#F1F5F9] ${isSelected ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'} ${isEmpty ? 'opacity-40' : ''}`}>
                    <td className="px-4 py-2.5 font-semibold text-[#0F172A]">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} className="text-[#94A3B8]" />
                        {d.label}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#64748B]">{fmtFCFA(d.ca_assiette)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-[#2563EB]">{fmtFCFA(d.tva_collectee)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-[#16A34A]">{fmtFCFA(d.tva_deductible)}</td>
                    <td className="px-4 py-2.5 text-right font-extrabold" style={{ color: d.solde_tva > 0 ? '#DC2626' : '#16A34A' }}>
                      {fmtFCFA(Math.abs(d.solde_tva))}
                      <span className="ml-1 text-[9px]">{d.solde_tva > 0 ? '↑ À payer' : d.solde_tva < 0 ? '↓ Crédit' : ''}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#D97706] font-bold">{fmtFCFA(d.contribution_appui)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {isEmpty ? (
                        <span className="text-[10px] text-[#94A3B8]">—</span>
                      ) : d.solde_tva <= 0 ? (
                        <span className="flex items-center gap-1 justify-center text-[#16A34A] text-[10px] font-bold">
                          <CheckCircle2 size={11} /> Crédit TVA
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 justify-center text-[#DC2626] text-[10px] font-bold">
                          <AlertTriangle size={11} /> À déclarer
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {!isEmpty && (
                        <button
                          onClick={() => setSelectedMois(isSelected ? null : d.mois)}
                          className="text-[11px] px-2 py-0.5 bg-[#F1F5F9] rounded text-[#64748B] hover:bg-[#E2E8F0]">
                          {isSelected ? 'Masquer' : 'Voir'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {/* Annual total */}
              <tr className="bg-[#0F172A] text-white">
                <td className="px-4 py-3 font-extrabold text-[12px]">TOTAL {year}</td>
                <td className="px-4 py-3 text-right font-extrabold">{fmtFCFA(totals.ca_assiette)}</td>
                <td className="px-4 py-3 text-right font-extrabold">{fmtFCFA(totals.tva_collectee)}</td>
                <td className="px-4 py-3 text-right font-extrabold">{fmtFCFA(totals.tva_deductible)}</td>
                <td className="px-4 py-3 text-right font-extrabold" style={{ color: totals.solde_tva > 0 ? '#FCA5A5' : '#4ADE80' }}>
                  {fmtFCFA(Math.abs(totals.solde_tva))}
                </td>
                <td className="px-4 py-3 text-right font-extrabold text-[#FCD34D]">{fmtFCFA(totals.contribution_appui)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selectedMois !== null && detailMvs.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
            <h2 className="text-[13px] font-extrabold text-[#0F172A]">
              Mouvements TVA — {MONTHS_FR[selectedMois - 1]} {year}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-white border-b border-[#E2E8F0]">
                  {['Date','Libellé','Compte Débit','Compte Crédit','Montant','Type TVA'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-[#94A3B8] uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detailMvs.map(m => {
                  const isCollectee  = TVA_COLLECTEE_ACCTS.includes(m.credit_account)
                  const isDeductible = TVA_DEDUCTIBLE_ACCTS.includes(m.debit_account)
                  const isCA         = CA_ACCT.includes(m.credit_account)
                  return (
                    <tr key={m.id} className="border-t border-[#F8FAFC] hover:bg-[#F8FAFC]">
                      <td className="px-3 py-1.5 text-[#64748B]">
                        {new Date(m.date_operation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-3 py-1.5 font-medium text-[#0F172A] max-w-[180px] truncate">{m.libelle}</td>
                      <td className="px-3 py-1.5 font-mono text-[#64748B]">{m.debit_account}</td>
                      <td className="px-3 py-1.5 font-mono text-[#64748B]">{m.credit_account}</td>
                      <td className="px-3 py-1.5 text-right font-bold text-[#0F172A]">{fmtFCFA(m.montant)}</td>
                      <td className="px-3 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          isCollectee  ? 'bg-[#EFF6FF] text-[#2563EB]' :
                          isDeductible ? 'bg-[#F0FDF4] text-[#16A34A]' :
                          isCA         ? 'bg-[#FEF3C7] text-[#D97706]' : 'bg-[#F1F5F9] text-[#64748B]'
                        }`}>
                          {isCollectee ? 'TVA collectée' : isDeductible ? 'TVA déductible' : isCA ? "Contrib. Appui" : '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recap déclaration */}
      {selectedMois !== null && (
        <div className="bg-[#0F172A] rounded-xl p-5 text-white">
          <h3 className="text-[14px] font-extrabold mb-4">
            Récapitulatif déclaration TVA — {MONTHS_FR[selectedMois - 1]} {year}
          </h3>
          {(() => {
            const d = declarations[selectedMois - 1]
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'CA HT',              value: fmtFCFA(d.ca_assiette) },
                  { label: 'TVA facturée (18%)',  value: fmtFCFA(d.tva_collectee) },
                  { label: 'TVA récupérable',     value: fmtFCFA(d.tva_deductible) },
                  { label: 'TVA nette à verser',  value: fmtFCFA(Math.max(d.solde_tva, 0)), highlight: d.solde_tva > 0 },
                  { label: "Contrib. d'Appui (5%)", value: fmtFCFA(d.contribution_appui), highlight: true },
                  { label: 'Total à décaisser',   value: fmtFCFA(Math.max(d.solde_tva, 0) + d.contribution_appui), highlight: true },
                ].map(f => (
                  <div key={f.label}>
                    <div className="text-[10px] text-[#94A3B8] uppercase">{f.label}</div>
                    <div className={`text-[16px] font-extrabold mt-0.5 ${f.highlight ? 'text-[#FCD34D]' : 'text-white'}`}>
                      {f.value}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
