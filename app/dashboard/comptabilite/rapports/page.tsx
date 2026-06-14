'use client'

/**
 * Rapports Financiers OHADA
 * Export PDF / Excel · Bilan, CR, Balance, Grand Livre, TVA
 */

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useFmt } from '@/lib/hooks/useFmt'
import { COMPTES_PLATS } from '@/lib/syscohada/plan-comptable'
import { FileText, Download, BarChart2, TrendingUp, Scale, Receipt, BookOpen, Printer } from 'lucide-react'
import { useLocale } from '@/lib/hooks/useLocale'

interface Movement {
  id: string; date_operation: string; libelle: string
  debit_account: string; credit_account: string; montant: number
}

const YEARS   = [2024, 2025, 2026, 2027]
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

/* ─── Utility: compute solde from movements by SYSCOHADA prefix ─── */
function computeSolde(movements: Movement[], accounts: string[]): number {
  let total = 0
  for (const m of movements) {
    if (accounts.includes(m.debit_account))  total += m.montant
    if (accounts.includes(m.credit_account)) total -= m.montant
  }
  return total
}

// Filtre par préfixe(s) SYSCOHADA (codes 2-5 chiffres)
function computeSoldeByPrefix(movements: Movement[], ...prefixes: string[]): number {
  let total = 0
  for (const m of movements) {
    if (prefixes.some(p => m.debit_account?.startsWith(p)))  total += m.montant
    if (prefixes.some(p => m.credit_account?.startsWith(p))) total -= m.montant
  }
  return total
}

function accountNom(numero: string): string {
  const cp = COMPTES_PLATS.find(c => c.numero === numero)
  return cp?.nom || numero
}

export default function RapportsPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId } = useTenant()
  const { t } = useLocale()
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading]     = useState(true)
  const [year, setYear]           = useState(new Date().getFullYear())
  const [periode, setPeriode]     = useState<'annee' | number>('annee')
  const [activeReport, setActiveReport] = useState<string | null>(null)

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

  const filtered = useMemo(() => {
    if (periode === 'annee') return movements
    return movements.filter(m => new Date(m.date_operation).getMonth() + 1 === (periode as number))
  }, [movements, periode])

  /* ─── Bilan data ─── */
  const bilanData = useMemo(() => {
    // Classe 2 = actif immobilisé (net des amortissements 28)
    const actif_immo    = computeSoldeByPrefix(filtered, '20', '21', '22', '23', '24', '25', '26', '27')
    // Classe 3 (stocks) + actif circulant de classe 4 (clients, débiteurs)
    const actif_circ    = computeSoldeByPrefix(filtered, '3', '409', '411', '412', '413', '414', '416', '418', '421', '471', '476', '485')
    // Classe 5 (trésorerie)
    const actif_tres    = computeSoldeByPrefix(filtered, '50', '51', '52', '53', '54', '57')
    const total_actif   = actif_immo + actif_circ + actif_tres

    // Capitaux propres = classes 10 à 15
    const capitaux      = Math.abs(computeSoldeByPrefix(filtered, '10', '11', '12', '13', '14', '15'))
    // Dettes financières = classes 16-19
    const dettes_fin    = Math.abs(computeSoldeByPrefix(filtered, '16', '17', '18', '19'))
    // Dettes exploitation = passif de classe 4 (fournisseurs, personnel, État)
    const dettes_exp    = Math.abs(computeSoldeByPrefix(filtered, '40', '419', '422', '423', '424', '43', '44', '46', '47', '48'))
    const total_passif  = capitaux + dettes_fin + dettes_exp

    return { actif_immo, actif_circ, actif_tres, total_actif, capitaux, dettes_fin, dettes_exp, total_passif }
  }, [filtered])

  /* ─── CR data ─── */
  const crData = useMemo(() => {
    // Classe 7 = produits
    const produits      = Math.abs(computeSoldeByPrefix(filtered, '7'))
    // Classe 6 = charges
    const charges       = computeSoldeByPrefix(filtered, '6')
    const resultat_net  = produits - charges
    // 70x = ventes
    const ventes        = Math.abs(computeSoldeByPrefix(filtered, '70'))
    // 60x = achats
    const achats        = computeSoldeByPrefix(filtered, '60')
    const marge         = ventes - achats
    // 66x = charges de personnel (SYSCOHADA: 661 rémunérations, 664 CNSS patronal)
    const charges_perso = computeSoldeByPrefix(filtered, '66')
    // 68x = dotations aux amortissements
    const dotations     = computeSoldeByPrefix(filtered, '68')
    const ebe           = marge - charges_perso - dotations
    return { produits, charges, resultat_net, ventes, achats, marge, charges_perso, dotations, ebe }
  }, [filtered])

  /* ─── Balance data ─── */
  const balanceData = useMemo(() => {
    const map = new Map<string, { td: number; tc: number }>()
    for (const m of filtered) {
      if (m.debit_account) {
        const e = map.get(m.debit_account) || { td: 0, tc: 0 }
        e.td += m.montant; map.set(m.debit_account, e)
      }
      if (m.credit_account) {
        const e = map.get(m.credit_account) || { td: 0, tc: 0 }
        e.tc += m.montant; map.set(m.credit_account, e)
      }
    }
    const lines = Array.from(map.entries()).map(([acct, v]) => {
      return { acct, name: accountNom(acct), td: v.td, tc: v.tc, solde: v.td - v.tc }
    }).sort((a, b) => a.acct.localeCompare(b.acct, undefined, { numeric: true }))
    return lines
  }, [filtered])

  /* ─── TVA data ─── */
  const tvaData = useMemo(() => {
    // 4441 = TVA facturée (crédit = collectée) · 4446 = TVA récupérable sur achats (débit = déductible)
    const tva_collectee  = filtered.filter(m => m.credit_account?.startsWith('4441')).reduce((s, m) => s + m.montant, 0)
    const tva_deductible = filtered.filter(m => m.debit_account?.startsWith('4446')).reduce((s, m) => s + m.montant, 0)
    return { tva_collectee, tva_deductible, solde: tva_collectee - tva_deductible, contrib_appui: tva_collectee * 0.05 }
  }, [filtered])

  /* ─── Export CSV ─── */
  function exportBalance() {
    const rows = balanceData.map(l => ({
      Compte: l.acct, Intitulé: l.name,
      'Total Débit': l.td, 'Total Crédit': l.tc, Solde: l.solde,
    }))
    if (!rows.length) return
    const csv = '﻿' + [Object.keys(rows[0]).join(';'), ...rows.map(r => Object.values(r).join(';'))].join('\n')
    dlCSV(csv, `balance-${year}.csv`)
  }

  function exportBilan() {
    const rows = [
      { Section: 'ACTIF', Poste: 'Actif Immobilisé',       Montant: bilanData.actif_immo },
      { Section: 'ACTIF', Poste: 'Actif Circulant',         Montant: bilanData.actif_circ },
      { Section: 'ACTIF', Poste: 'Trésorerie Actif',        Montant: bilanData.actif_tres },
      { Section: 'ACTIF', Poste: 'TOTAL ACTIF',             Montant: bilanData.total_actif },
      { Section: 'PASSIF', Poste: 'Capitaux Propres',       Montant: bilanData.capitaux },
      { Section: 'PASSIF', Poste: 'Dettes Financières',     Montant: bilanData.dettes_fin },
      { Section: 'PASSIF', Poste: 'Dettes Exploitation',    Montant: bilanData.dettes_exp },
      { Section: 'PASSIF', Poste: 'TOTAL PASSIF',           Montant: bilanData.total_passif },
    ]
    const csv = '﻿' + [Object.keys(rows[0]).join(';'), ...rows.map(r => Object.values(r).join(';'))].join('\n')
    dlCSV(csv, `bilan-${year}.csv`)
  }

  function exportCR() {
    const rows = [
      { Poste: 'Chiffre d\'affaires', Montant: crData.ventes },
      { Poste: 'Coût des achats', Montant: crData.achats },
      { Poste: 'Marge brute', Montant: crData.marge },
      { Poste: 'Charges de personnel', Montant: crData.charges_perso },
      { Poste: 'Dotations amortissements', Montant: crData.dotations },
      { Poste: 'EBE', Montant: crData.ebe },
      { Poste: 'Total produits', Montant: crData.produits },
      { Poste: 'Total charges', Montant: crData.charges },
      { Poste: 'Résultat net', Montant: crData.resultat_net },
    ]
    const csv = '﻿' + [Object.keys(rows[0]).join(';'), ...rows.map(r => Object.values(r).join(';'))].join('\n')
    dlCSV(csv, `compte-resultat-${year}.csv`)
  }

  function exportTVA() {
    const rows = [
      { Poste: 'TVA collectée (18%)', Montant: tvaData.tva_collectee },
      { Poste: 'TVA déductible', Montant: tvaData.tva_deductible },
      { Poste: 'Solde TVA', Montant: tvaData.solde },
      { Poste: "Contribution d'Appui (5%)", Montant: tvaData.contrib_appui },
    ]
    const csv = '﻿' + [Object.keys(rows[0]).join(';'), ...rows.map(r => Object.values(r).join(';'))].join('\n')
    dlCSV(csv, `tva-${year}.csv`)
  }

  function dlCSV(csv: string, name: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = name; a.click()
  }

  function printReport() { window.print() }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-[#94A3B8]">
      <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mr-2" />
      {t('common.loading')}
    </div>
  )

  const REPORTS = [
    {
      id: 'bilan',      icon: Scale,    label: t('compta.rapports.bilan'),
      desc: t('compta.rapports.actif') + ' / ' + t('compta.rapports.passif'), color: '#2563EB',
      onExport: exportBilan,
      kpis: [
        { label: t('compta.rapports.actif'),  value: fmtFCFA(bilanData.total_actif) },
        { label: t('compta.rapports.passif'), value: fmtFCFA(bilanData.total_passif) },
        { label: 'Équilibre',    value: Math.abs(bilanData.total_actif - bilanData.total_passif) < 1 ? '✓ OK' : '⚠ Écart' },
      ],
    },
    {
      id: 'cr',         icon: TrendingUp, label: t('compta.rapports.cr'),
      desc: t('compta.rapports.produits') + ' / ' + t('compta.rapports.charges') + ' / ' + t('compta.rapports.resultat'), color: '#16A34A',
      onExport: exportCR,
      kpis: [
        { label: t('compta.rapports.produits'), value: fmtFCFA(crData.produits) },
        { label: t('compta.rapports.charges'),  value: fmtFCFA(crData.charges) },
        { label: t('compta.rapports.resultat'), value: fmtFCFA(crData.resultat_net) },
      ],
    },
    {
      id: 'balance',    icon: BarChart2, label: 'Balance Générale',
      desc: 'Totaux débit/crédit/solde par compte', color: '#8B5CF6',
      onExport: exportBalance,
      kpis: [
        { label: 'Comptes mouvementés', value: String(balanceData.length) },
        { label: 'Total Débit',          value: fmtFCFA(balanceData.reduce((s,l) => s+l.td, 0)) },
        { label: 'Total Crédit',         value: fmtFCFA(balanceData.reduce((s,l) => s+l.tc, 0)) },
      ],
    },
    {
      id: 'tva',        icon: Receipt,  label: 'Déclaration TVA',
      desc: 'TVA 18% + Contribution d\'Appui 5%', color: '#D97706',
      onExport: exportTVA,
      kpis: [
        { label: 'TVA collectée',   value: fmtFCFA(tvaData.tva_collectee) },
        { label: 'TVA déductible',  value: fmtFCFA(tvaData.tva_deductible) },
        { label: 'Solde TVA',       value: fmtFCFA(tvaData.solde) },
      ],
    },
  ]

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
            <FileText size={22} className="text-[#2563EB]" />
            {t('compta.rapports.title')}
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            {t('compta.rapports.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-white focus:outline-none">
            {YEARS.map(y => <option key={y}>{y}</option>)}
          </select>
          <select value={String(periode)} onChange={e => setPeriode(e.target.value === 'annee' ? 'annee' : Number(e.target.value))}
            className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] bg-white focus:outline-none">
            <option value="annee">Année entière</option>
            {MONTHS_FR.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <button onClick={printReport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
            <Printer size={13} /> Imprimer
          </button>
        </div>
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORTS.map(r => {
          const Icon = r.icon
          const isActive = activeReport === r.id
          return (
            <div key={r.id} className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: r.color + '15' }}>
                    <Icon size={18} style={{ color: r.color }} />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-extrabold text-[#0F172A]">{r.label}</h3>
                    <p className="text-[11px] text-[#64748B]">{r.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveReport(isActive ? null : r.id)}
                    className="text-[11px] px-3 py-1.5 bg-[#F1F5F9] rounded-lg text-[#64748B] hover:bg-[#E2E8F0]">
                    {isActive ? 'Masquer' : 'Aperçu'}
                  </button>
                  <button onClick={r.onExport}
                    className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-lg text-white font-semibold hover:opacity-90"
                    style={{ background: r.color }}>
                    <Download size={11} /> {t('compta.rapports.exportXLS')}
                  </button>
                </div>
              </div>
              {/* KPIs */}
              <div className="grid grid-cols-3 divide-x divide-[#F1F5F9] px-0">
                {r.kpis.map(k => (
                  <div key={k.label} className="px-4 py-3 text-center">
                    <div className="text-[13px] font-extrabold text-[#0F172A] truncate">{k.value}</div>
                    <div className="text-[9px] text-[#94A3B8] mt-0.5">{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Aperçu détaillé */}
              {isActive && r.id === 'bilan' && (
                <div className="border-t border-[#F1F5F9] p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[11px] font-extrabold text-[#2563EB] mb-2">ACTIF</h4>
                      {[
                        { label: 'Immobilisé',     v: bilanData.actif_immo },
                        { label: 'Circulant',      v: bilanData.actif_circ },
                        { label: 'Trésorerie',     v: bilanData.actif_tres },
                      ].map(row => (
                        <div key={row.label} className="flex justify-between text-[11px] py-1 border-b border-[#F8FAFC]">
                          <span className="text-[#64748B]">{row.label}</span>
                          <span className="font-bold text-[#0F172A]">{fmtFCFA(row.v)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-[12px] py-1.5 font-extrabold text-[#2563EB]">
                        <span>TOTAL ACTIF</span>
                        <span>{fmtFCFA(bilanData.total_actif)}</span>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[11px] font-extrabold text-[#16A34A] mb-2">PASSIF</h4>
                      {[
                        { label: 'Capitaux propres', v: bilanData.capitaux },
                        { label: 'Dettes fin.',       v: bilanData.dettes_fin },
                        { label: 'Dettes explo.',     v: bilanData.dettes_exp },
                      ].map(row => (
                        <div key={row.label} className="flex justify-between text-[11px] py-1 border-b border-[#F8FAFC]">
                          <span className="text-[#64748B]">{row.label}</span>
                          <span className="font-bold text-[#0F172A]">{fmtFCFA(row.v)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-[12px] py-1.5 font-extrabold text-[#16A34A]">
                        <span>TOTAL PASSIF</span>
                        <span>{fmtFCFA(bilanData.total_passif)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isActive && r.id === 'cr' && (
                <div className="border-t border-[#F1F5F9] p-4 space-y-1">
                  {[
                    { label: 'Chiffre d\'affaires',    v: crData.ventes,       color: '#0F172A' },
                    { label: '- Coût des achats',       v: -crData.achats,      color: '#DC2626' },
                    { label: '= Marge brute',           v: crData.marge,        color: '#2563EB', bold: true },
                    { label: '- Charges de personnel',  v: -crData.charges_perso, color: '#DC2626' },
                    { label: '- Dotations amort.',      v: -crData.dotations,   color: '#DC2626' },
                    { label: '= EBE',                   v: crData.ebe,          color: '#8B5CF6', bold: true },
                    { label: 'Total Produits',          v: crData.produits,     color: '#16A34A' },
                    { label: 'Total Charges',           v: crData.charges,      color: '#DC2626' },
                    { label: '= RÉSULTAT NET',          v: crData.resultat_net, color: crData.resultat_net >= 0 ? '#16A34A' : '#DC2626', bold: true },
                  ].map(row => (
                    <div key={row.label} className={`flex justify-between py-1.5 text-[12px] border-b border-[#F8FAFC] ${row.bold ? 'font-extrabold' : ''}`}>
                      <span style={{ color: row.bold ? row.color : '#64748B' }}>{row.label}</span>
                      <span style={{ color: row.color }} className="font-bold">{fmtFCFA(Math.abs(row.v))}</span>
                    </div>
                  ))}
                </div>
              )}

              {isActive && r.id === 'balance' && (
                <div className="border-t border-[#F1F5F9] max-h-64 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-[11px] min-w-[500px]">
                    <thead className="bg-[#F8FAFC] sticky top-0">
                      <tr>
                        {['Compte','Intitulé','Débit','Crédit','Solde'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-[#94A3B8] uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {balanceData.slice(0, 20).map(l => (
                        <tr key={l.acct} className="border-t border-[#F8FAFC] hover:bg-[#F8FAFC]">
                          <td className="px-3 py-1.5 font-mono font-bold text-[#2563EB]">{l.acct}</td>
                          <td className="px-3 py-1.5 text-[#0F172A] truncate max-w-[120px]">{l.name}</td>
                          <td className="px-3 py-1.5 text-right text-[#2563EB]">{fmtFCFA(l.td)}</td>
                          <td className="px-3 py-1.5 text-right text-[#16A34A]">{fmtFCFA(l.tc)}</td>
                          <td className="px-3 py-1.5 text-right font-bold" style={{ color: l.solde >= 0 ? '#2563EB' : '#DC2626' }}>
                            {fmtFCFA(Math.abs(l.solde))}
                          </td>
                        </tr>
                      ))}
                      {balanceData.length > 20 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-2 text-center text-[10px] text-[#94A3B8]">
                            {balanceData.length - 20} compte{balanceData.length - 20 > 1 ? 's' : ''} supplémentaire{balanceData.length - 20 > 1 ? 's' : ''} → Exporter CSV
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {isActive && r.id === 'tva' && (
                <div className="border-t border-[#F1F5F9] p-4 space-y-2">
                  {[
                    { label: 'CA HT',                      v: tvaData.tva_collectee / 0.18, color: '#0F172A' },
                    { label: 'TVA collectée (18%)',         v: tvaData.tva_collectee,        color: '#2563EB' },
                    { label: 'TVA déductible',              v: tvaData.tva_deductible,       color: '#16A34A' },
                    { label: 'Solde TVA net',               v: tvaData.solde,               color: tvaData.solde >= 0 ? '#DC2626' : '#16A34A' },
                    { label: "Contribution d'Appui (5%)",   v: tvaData.contrib_appui,        color: '#D97706' },
                    { label: 'Total à décaisser',           v: Math.max(tvaData.solde, 0) + tvaData.contrib_appui, color: '#DC2626', bold: true },
                  ].map(row => (
                    <div key={row.label} className={`flex justify-between text-[12px] py-1.5 border-b border-[#F8FAFC] ${row.bold ? 'font-extrabold' : ''}`}>
                      <span style={{ color: row.bold ? row.color : '#64748B' }}>{row.label}</span>
                      <span style={{ color: row.color }} className="font-bold">{fmtFCFA(row.v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary strip */}
      <div className="bg-[#0F172A] rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-extrabold">Synthèse exercice {year} — {periode === 'annee' ? 'Année entière' : MONTHS_FR[(periode as number) - 1]}</h2>
          <div className="flex gap-2">
            <button onClick={exportBalance}
              className="flex items-center gap-1 text-[11px] px-3 py-1.5 bg-white/10 rounded-lg hover:bg-white/20">
              <Download size={11} /> Balance
            </button>
            <button onClick={exportBilan}
              className="flex items-center gap-1 text-[11px] px-3 py-1.5 bg-white/10 rounded-lg hover:bg-white/20">
              <Download size={11} /> Bilan
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Chiffre d\'affaires', value: fmtFCFA(crData.ventes),       color: 'text-white' },
            { label: 'Marge brute',          value: fmtFCFA(crData.marge),        color: 'text-[#4ADE80]' },
            { label: 'Résultat net',         value: fmtFCFA(crData.resultat_net), color: crData.resultat_net >= 0 ? 'text-[#4ADE80]' : 'text-[#FCA5A5]' },
            { label: 'Total bilan',          value: fmtFCFA(bilanData.total_actif), color: 'text-[#93C5FD]' },
          ].map(k => (
            <div key={k.label}>
              <div className="text-[10px] text-[#94A3B8] uppercase">{k.label}</div>
              <div className={`text-[18px] font-extrabold mt-0.5 ${k.color}`}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
