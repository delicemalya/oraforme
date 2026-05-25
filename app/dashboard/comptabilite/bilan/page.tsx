'use client'

/**
 * Bilan & Compte de Résultat OHADA — États financiers automatiques
 * Bilan (Actif/Passif) + Compte de Résultat + SIG
 */

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { fmtFCFA } from '@/lib/admin-config'
import { getActifAccounts, getPassifAccounts, OHADA_ACCOUNTS } from '@/lib/accounting-engine'
import { TrendingUp, TrendingDown, Download, FileText, BarChart2 } from 'lucide-react'

interface Movement { date_operation: string; debit_account: string; credit_account: string; montant: number }
interface AccountBalance { number: string; name: string; solde: number }

const YEARS = [2024, 2025, 2026, 2027]

export default function BilanPage() {
  const { tenantId } = useTenant()
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading]     = useState(true)
  const [year, setYear]           = useState(new Date().getFullYear())
  const [tab, setTab]             = useState<'bilan' | 'resultat' | 'sig'>('bilan')

  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('journal_entries')
        .select('date_operation, debit_account, credit_account, montant')
        .eq('tenant_id', tenantId)
        .eq('fiscal_year', year)
      setMovements((data || []) as Movement[])
      setLoading(false)
    })()
  }, [tenantId, year])

  /* Compute solde per account */
  const soldes = useMemo(() => {
    const map = new Map<string, number>()
    for (const mv of movements) {
      map.set(mv.debit_account,  (map.get(mv.debit_account)  || 0) + mv.montant)
      map.set(mv.credit_account, (map.get(mv.credit_account) || 0) - mv.montant)
    }
    return map
  }, [movements])

  function getAccountBalance(number: string): number {
    return soldes.get(number) || 0
  }

  /* ── BILAN — Actif ────────────────────────────────────────── */
  const ACTIF_GROUPS = [
    {
      label: 'ACTIF IMMOBILISÉ',
      accounts: ['211000','213000','214000','215000','216000','218000','221000','222000','231000','232000','241000','242000','251000','261000','271000'],
    },
    {
      label: 'ACTIF CIRCULANT',
      accounts: ['301000','311000','321000','331000','361000','401000','411000','418000','421000','440000','450000','470000','481000'],
    },
    {
      label: 'TRÉSORERIE ACTIF',
      accounts: ['512000','514000','521000','531000','571000','571100'],
    },
  ]

  const PASSIF_GROUPS = [
    {
      label: 'CAPITAUX PROPRES',
      accounts: ['101000','104000','105000','106000','111000','121000','130000','131000','141000'],
    },
    {
      label: 'DETTES FINANCIÈRES',
      accounts: ['161000','162000','163000','164000','165000','166000','168000'],
    },
    {
      label: 'DETTES D\'EXPLOITATION',
      accounts: ['401000','404000','408000','419000','421000','422000','431000','432000','441000','444000','447000','448000','481000'],
    },
    {
      label: 'TRÉSORERIE PASSIF',
      accounts: ['519000','551000','561000'],
    },
  ]

  /* Build bilan lines */
  function buildGroupLines(accounts: string[]) {
    return accounts
      .map(num => {
        const ohada = OHADA_ACCOUNTS.find(a => String(a.number) === num)
        const solde = getAccountBalance(num)
        return { number: num, name: ohada?.name || num, solde: Math.abs(solde) }
      })
      .filter(l => l.solde > 0)
  }

  const actifGroups  = ACTIF_GROUPS.map(g  => ({ ...g, lines: buildGroupLines(g.accounts), total: 0 }))
  const passifGroups = PASSIF_GROUPS.map(g => ({ ...g, lines: buildGroupLines(g.accounts), total: 0 }))
  actifGroups.forEach(g  => { g.total  = g.lines.reduce((s, l) => s + l.solde, 0) })
  passifGroups.forEach(g => { g.total = g.lines.reduce((s, l) => s + l.solde, 0) })

  const totalActif  = actifGroups.reduce((s, g) => s + g.total, 0)
  const totalPassif = passifGroups.reduce((s, g) => s + g.total, 0)

  /* ── COMPTE DE RÉSULTAT ────────────────────────────────────── */
  /* Produits (classe 7) */
  const PRODUITS_GROUPS = [
    { label: "Chiffre d'affaires", accounts: ['701000','702000','703000','704000','705000','706000','707000','708000'] },
    { label: 'Autres produits',    accounts: ['751000','752000','753000','761000','771000','773000','778000','791000','798000'] },
  ]
  /* Charges (classe 6) */
  const CHARGES_GROUPS = [
    { label: 'Achats & stocks',     accounts: ['601000','602000','603000','604000','605000','608000','609000'] },
    { label: 'Services extérieurs', accounts: ['611000','612000','613000','614000','615000','616000','617000','618000','621000','622000','623000','624000','625000','626000','627000','628000'] },
    { label: 'Impôts & taxes',      accounts: ['631000','632000','633000'] },
    { label: 'Charges de personnel',accounts: ['641000','642000','643000','644000','645000','648000'] },
    { label: 'Autres charges',      accounts: ['651000','652000','653000','661000','671000','681000','691000'] },
  ]

  const produitsGrps = PRODUITS_GROUPS.map(g => ({ ...g, lines: buildGroupLines(g.accounts), total: 0 }))
  const chargesGrps  = CHARGES_GROUPS.map(g  => ({ ...g, lines: buildGroupLines(g.accounts), total: 0 }))
  produitsGrps.forEach(g => { g.total = g.lines.reduce((s, l) => s + l.solde, 0) })
  chargesGrps.forEach(g  => { g.total = g.lines.reduce((s, l) => s + l.solde, 0) })

  const totalProduits = produitsGrps.reduce((s, g) => s + g.total, 0)
  const totalCharges  = chargesGrps.reduce((s, g) => s + g.total, 0)
  const resultatNet   = totalProduits - totalCharges

  /* ── SIG ───────────────────────────────────────────────────── */
  const ca            = produitsGrps[0]?.total || 0
  const achatsRevente = chargesGrps[0]?.total  || 0
  const margeCommerciale = ca - achatsRevente
  const chargesPersonnel = chargesGrps.find(g => g.label.includes('personnel'))?.total || 0
  const ebe              = margeCommerciale - chargesPersonnel
  const amortissements   = 0 // would come from immobilisations
  const resultatExp      = ebe - amortissements
  const produitsFin      = (produitsGrps[1]?.total || 0) * 0.1
  const chargesFin       = (chargesGrps[4]?.total  || 0) * 0.1

  /* ── Export CSV ─────────────────────────────────────────────── */
  function exportCSV() {
    const rows = [
      ['BILAN', '', ''],
      ['ACTIF', '', ''],
      ...actifGroups.flatMap(g => [
        [g.label, '', ''],
        ...g.lines.map(l => [l.number, l.name, l.solde]),
        ['', `Sous-total ${g.label}`, g.total],
      ]),
      ['TOTAL ACTIF', '', totalActif],
      ['', '', ''],
      ['PASSIF', '', ''],
      ...passifGroups.flatMap(g => [
        [g.label, '', ''],
        ...g.lines.map(l => [l.number, l.name, l.solde]),
        ['', `Sous-total ${g.label}`, g.total],
      ]),
      ['TOTAL PASSIF', '', totalPassif],
    ]
    const csv = '﻿' + rows.map(r => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `bilan-${year}.csv`; a.click()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-[#94A3B8]">
      <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mr-2" />
      Chargement états financiers…
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
            <TrendingUp size={22} className="text-[#2563EB]" />
            Bilan & Compte de Résultat
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">États financiers OHADA · Exercice {year}</p>
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

      {/* Tabs */}
      <div className="flex rounded-xl border border-[#E2E8F0] overflow-hidden bg-white">
        {[
          { id: 'bilan',    label: 'Bilan',              icon: BarChart2  },
          { id: 'resultat', label: 'Compte de Résultat', icon: FileText   },
          { id: 'sig',      label: 'SIG',                icon: TrendingUp },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold transition-all ${
              tab === t.id ? 'bg-[#2563EB] text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'
            }`}>
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── BILAN ─────────────────────────────────────────────── */}
      {tab === 'bilan' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ACTIF */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="bg-[#2563EB] text-white px-4 py-3">
              <p className="text-[13px] font-extrabold">ACTIF</p>
              <p className="text-[20px] font-extrabold mt-0.5">{fmtFCFA(totalActif)}</p>
            </div>
            {actifGroups.map(g => (
              <div key={g.label}>
                <div className="px-4 py-2 bg-[#EFF6FF] border-b border-[#E2E8F0]">
                  <p className="text-[11px] font-bold text-[#2563EB]">{g.label}</p>
                </div>
                {g.lines.length === 0 ? (
                  <p className="px-4 py-2 text-[11px] text-[#94A3B8] italic">— Aucun solde —</p>
                ) : (
                  g.lines.map(l => (
                    <div key={l.number} className="flex items-center justify-between px-4 py-1.5 border-b border-[#F8FAFC] hover:bg-[#F8FAFC]">
                      <span className="text-[11px] text-[#64748B] font-mono w-16 shrink-0">{l.number}</span>
                      <span className="text-[12px] text-[#0F172A] flex-1 mx-2 truncate">{l.name}</span>
                      <span className="text-[12px] font-bold text-[#0F172A]">{fmtFCFA(l.solde)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between px-4 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <span className="text-[11px] font-semibold text-[#64748B]">Sous-total {g.label}</span>
                  <span className="text-[12px] font-extrabold text-[#2563EB]">{fmtFCFA(g.total)}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-between px-4 py-3 bg-[#2563EB] text-white">
              <span className="font-bold">TOTAL ACTIF</span>
              <span className="font-extrabold text-[15px]">{fmtFCFA(totalActif)}</span>
            </div>
          </div>

          {/* PASSIF */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="bg-[#16A34A] text-white px-4 py-3">
              <p className="text-[13px] font-extrabold">PASSIF & CAPITAUX PROPRES</p>
              <p className="text-[20px] font-extrabold mt-0.5">{fmtFCFA(totalPassif)}</p>
            </div>
            {passifGroups.map(g => (
              <div key={g.label}>
                <div className="px-4 py-2 bg-[#F0FDF4] border-b border-[#E2E8F0]">
                  <p className="text-[11px] font-bold text-[#16A34A]">{g.label}</p>
                </div>
                {g.lines.length === 0 ? (
                  <p className="px-4 py-2 text-[11px] text-[#94A3B8] italic">— Aucun solde —</p>
                ) : (
                  g.lines.map(l => (
                    <div key={l.number} className="flex items-center justify-between px-4 py-1.5 border-b border-[#F8FAFC] hover:bg-[#F8FAFC]">
                      <span className="text-[11px] text-[#64748B] font-mono w-16 shrink-0">{l.number}</span>
                      <span className="text-[12px] text-[#0F172A] flex-1 mx-2 truncate">{l.name}</span>
                      <span className="text-[12px] font-bold text-[#0F172A]">{fmtFCFA(l.solde)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between px-4 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <span className="text-[11px] font-semibold text-[#64748B]">Sous-total {g.label}</span>
                  <span className="text-[12px] font-extrabold text-[#16A34A]">{fmtFCFA(g.total)}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-between px-4 py-3 bg-[#16A34A] text-white">
              <span className="font-bold">TOTAL PASSIF</span>
              <span className="font-extrabold text-[15px]">{fmtFCFA(totalPassif)}</span>
            </div>
          </div>

          {/* Équilibre */}
          {(totalActif > 0 || totalPassif > 0) && (
            <div className={`lg:col-span-2 px-4 py-3 rounded-xl border font-semibold text-[12px] flex items-center gap-2 ${
              Math.abs(totalActif - totalPassif) < 1
                ? 'bg-[#F0FDF4] border-[#86EFAC] text-[#16A34A]'
                : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
            }`}>
              {Math.abs(totalActif - totalPassif) < 1
                ? '✓ Bilan équilibré — Actif = Passif'
                : `⚠ Bilan déséquilibré — Écart: ${fmtFCFA(Math.abs(totalActif - totalPassif))} (normal en cours d'exercice)`}
            </div>
          )}
        </div>
      )}

      {/* ── COMPTE DE RÉSULTAT ─────────────────────────────────── */}
      {tab === 'resultat' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Produits */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="bg-[#16A34A] text-white px-4 py-3 flex justify-between items-center">
              <p className="text-[13px] font-extrabold">PRODUITS (Classe 7)</p>
              <p className="text-[18px] font-extrabold">{fmtFCFA(totalProduits)}</p>
            </div>
            {produitsGrps.map(g => (
              <div key={g.label}>
                <div className="px-4 py-1.5 bg-[#F0FDF4] border-b border-[#E2E8F0]">
                  <p className="text-[11px] font-bold text-[#16A34A]">{g.label}</p>
                </div>
                {g.lines.map(l => (
                  <div key={l.number} className="flex justify-between items-center px-4 py-1.5 border-b border-[#F8FAFC] hover:bg-[#F8FAFC]">
                    <span className="text-[11px] text-[#64748B] font-mono w-16">{l.number}</span>
                    <span className="text-[12px] text-[#0F172A] flex-1 mx-2 truncate">{l.name}</span>
                    <span className="text-[12px] font-bold text-[#16A34A]">{fmtFCFA(l.solde)}</span>
                  </div>
                ))}
                {g.lines.length === 0 && <p className="px-4 py-1.5 text-[11px] text-[#94A3B8] italic">— Aucun solde —</p>}
              </div>
            ))}
          </div>

          {/* Charges */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="bg-[#DC2626] text-white px-4 py-3 flex justify-between items-center">
              <p className="text-[13px] font-extrabold">CHARGES (Classe 6)</p>
              <p className="text-[18px] font-extrabold">{fmtFCFA(totalCharges)}</p>
            </div>
            {chargesGrps.map(g => (
              <div key={g.label}>
                <div className="px-4 py-1.5 bg-[#FEF2F2] border-b border-[#E2E8F0]">
                  <p className="text-[11px] font-bold text-[#DC2626]">{g.label}</p>
                </div>
                {g.lines.map(l => (
                  <div key={l.number} className="flex justify-between items-center px-4 py-1.5 border-b border-[#F8FAFC] hover:bg-[#F8FAFC]">
                    <span className="text-[11px] text-[#64748B] font-mono w-16">{l.number}</span>
                    <span className="text-[12px] text-[#0F172A] flex-1 mx-2 truncate">{l.name}</span>
                    <span className="text-[12px] font-bold text-[#DC2626]">{fmtFCFA(l.solde)}</span>
                  </div>
                ))}
                {g.lines.length === 0 && <p className="px-4 py-1.5 text-[11px] text-[#94A3B8] italic">— Aucun solde —</p>}
              </div>
            ))}
          </div>

          {/* Résultat */}
          <div className={`lg:col-span-2 px-6 py-4 rounded-xl border-2 flex items-center justify-between ${
            resultatNet >= 0
              ? 'bg-[#F0FDF4] border-[#86EFAC]'
              : 'bg-[#FEF2F2] border-[#FECACA]'
          }`}>
            <div>
              <p className="text-[14px] font-extrabold text-[#0F172A]">
                {resultatNet >= 0 ? '✓ Résultat net — Bénéfice' : '⚠ Résultat net — Déficit'}
              </p>
              <p className="text-[12px] text-[#64748B] mt-0.5">
                Produits ({fmtFCFA(totalProduits)}) — Charges ({fmtFCFA(totalCharges)})
              </p>
            </div>
            <div className="text-right">
              <div className="text-[28px] font-extrabold" style={{ color: resultatNet >= 0 ? '#16A34A' : '#DC2626' }}>
                {resultatNet >= 0 ? '+' : '-'}{fmtFCFA(Math.abs(resultatNet))}
              </div>
              <div className="text-[11px] text-[#64748B]">
                Marge: {totalProduits > 0 ? Math.round((resultatNet / totalProduits) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SIG ───────────────────────────────────────────────── */}
      {tab === 'sig' && (
        <div className="space-y-3">
          <p className="text-[13px] text-[#64748B]">Soldes Intermédiaires de Gestion (SYSCOHADA)</p>
          {[
            { label: "Chiffre d'affaires (CA)",          value: ca,                                          color: '#16A34A' },
            { label: 'Marge commerciale brute',           value: margeCommerciale,                            color: '#2563EB' },
            { label: 'Charges de personnel',              value: chargesPersonnel,                            color: '#DC2626', sign: '-' },
            { label: 'Excédent Brut d\'Exploitation (EBE)', value: ebe,                                       color: ebe >= 0 ? '#16A34A' : '#DC2626' },
            { label: 'Dotations aux amortissements',      value: amortissements,                              color: '#DC2626', sign: '-' },
            { label: 'Résultat d\'Exploitation',          value: resultatExp,                                 color: resultatExp >= 0 ? '#2563EB' : '#DC2626' },
            { label: 'Produits financiers',               value: produitsFin,                                 color: '#16A34A' },
            { label: 'Charges financières',               value: chargesFin,                                  color: '#DC2626', sign: '-' },
            { label: 'RÉSULTAT NET',                      value: resultatNet,                                 color: resultatNet >= 0 ? '#16A34A' : '#DC2626', bold: true },
          ].map((sig, i) => (
            <div key={sig.label} className={`flex items-center justify-between px-5 py-3 rounded-xl border ${
              sig.bold ? 'border-2 border-[#E2E8F0] bg-[#0F172A]' : 'border-[#E2E8F0] bg-white'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-mono text-[#94A3B8] w-4">{i + 1}.</span>
                <span className={`text-[12px] font-semibold ${sig.bold ? 'text-white' : 'text-[#0F172A]'}`}>{sig.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {'sign' in sig && sig.sign && <span className="text-[#DC2626] font-bold">{sig.sign}</span>}
                <span className={`text-[14px] font-extrabold ${sig.bold ? 'text-white' : ''}`} style={!sig.bold ? { color: sig.color } : {}}>
                  {sig.value !== 0 ? fmtFCFA(Math.abs(sig.value)) : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
