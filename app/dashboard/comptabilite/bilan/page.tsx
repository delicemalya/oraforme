'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useFmt } from '@/lib/hooks/useFmt'
import { COMPTES_PLATS } from '@/lib/syscohada/plan-comptable'
import { useLocale } from '@/lib/hooks/useLocale'
import { TrendingUp, Download, FileText, BarChart2 } from 'lucide-react'

interface Movement { date_operation: string; debit_account: string; credit_account: string; montant: number }

const YEARS = [2024, 2025, 2026, 2027]

/* Libellé SYSCOHADA pour un numéro de compte */
function libelle(num: string): string {
  return COMPTES_PLATS.find(c => c.numero === num)?.nom ?? num
}

export default function BilanPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId } = useTenant()
  const { t } = useLocale()
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

  /* Solde par compte (avec matching préfixe) */
  const soldes = useMemo(() => {
    const map = new Map<string, number>()
    for (const mv of movements) {
      map.set(mv.debit_account,  (map.get(mv.debit_account)  ?? 0) + mv.montant)
      map.set(mv.credit_account, (map.get(mv.credit_account) ?? 0) - mv.montant)
    }
    return map
  }, [movements])

  /* Retourne le solde net d'un compte ou de tous ses sous-comptes */
  function getSolde(numero: string): number {
    let total = 0
    for (const [key, val] of soldes) {
      if (key === numero || key.startsWith(numero)) total += val
    }
    return total
  }

  function buildGroupLines(accounts: string[]) {
    return accounts
      .map(num => ({ number: num, name: libelle(num), solde: Math.abs(getSolde(num)) }))
      .filter(l => l.solde > 0)
  }

  /* ── BILAN ACTIF ─────────────────────────────────────────── */
  const ACTIF_GROUPS = [
    {
      label: 'ACTIF IMMOBILISÉ',
      accounts: ['211','212','213','214','215','216','218','221','222','231','232','241','242','243','251','261','271','272','273','274','275','276','277'],
    },
    {
      label: 'ACTIF CIRCULANT (STOCKS)',
      accounts: ['31','32','33','34','35','36','37','38'],
    },
    {
      label: 'ACTIF CIRCULANT (CRÉANCES)',
      accounts: ['401','411','412','413','414','418','421','441','444','445','446','448','481','488'],
    },
    {
      label: 'TRÉSORERIE ACTIF',
      accounts: ['511','512','514','521','522','531','541','542','543','544','548','571'],
    },
  ]

  /* ── BILAN PASSIF ────────────────────────────────────────── */
  const PASSIF_GROUPS = [
    {
      label: 'CAPITAUX PROPRES',
      accounts: ['101','102','103','104','105','106','111','112','113','118','119','121','129','130','131','141','142','143','151','152','153','154','155','158'],
    },
    {
      label: 'DETTES FINANCIÈRES (LONG TERME)',
      accounts: ['161','162','163','164','165','166','168','169'],
    },
    {
      label: 'DETTES D\'EXPLOITATION',
      accounts: ['401','404','408','419','422','423','424','425','426','427','428','431','432','433','441','443','444','447','448','481','482','488'],
    },
    {
      label: 'TRÉSORERIE PASSIF',
      accounts: ['519','521','551','552','553','561','562','563','564','565','566','567','568'],
    },
  ]

  const actifGroups  = ACTIF_GROUPS.map(g  => ({ ...g, lines: buildGroupLines(g.accounts), total: 0 }))
  const passifGroups = PASSIF_GROUPS.map(g => ({ ...g, lines: buildGroupLines(g.accounts), total: 0 }))
  actifGroups.forEach(g  => { g.total = g.lines.reduce((s, l) => s + l.solde, 0) })
  passifGroups.forEach(g => { g.total = g.lines.reduce((s, l) => s + l.solde, 0) })

  const totalActif  = actifGroups.reduce((s, g) => s + g.total, 0)
  const totalPassif = passifGroups.reduce((s, g) => s + g.total, 0)

  /* ── COMPTE DE RÉSULTAT ──────────────────────────────────── */
  const PRODUITS_GROUPS = [
    {
      label: "Chiffre d'affaires (Classe 7)",
      accounts: ['701','702','703','704','705','706','707','708'],
    },
    {
      label: 'Autres produits',
      accounts: ['71','72','73','75','751','752','753','754','755','761','762','763','764','771','772','773','774','775','776','778','781','791','796','798'],
    },
  ]

  const CHARGES_GROUPS = [
    {
      label: 'Achats & stocks (60)',
      accounts: ['601','602','603','604','605','608','609'],
    },
    {
      label: 'Transports (61)',
      accounts: ['611','612','613','614','615','616','617','618'],
    },
    {
      label: 'Services extérieurs A (62)',
      accounts: ['621','622','623','624','625','626','627','628'],
    },
    {
      label: 'Services extérieurs B (63)',
      accounts: ['631','632','633','634','635','636','637','638'],
    },
    {
      label: 'Impôts & taxes (64)',
      accounts: ['641','642','643','644','645','646','648'],
    },
    {
      label: 'Charges de personnel (66)',
      accounts: ['661','662','663','664','665','666','667','668'],
    },
    {
      label: 'Charges financières & autres (67-69)',
      accounts: ['671','672','673','674','675','676','677','678','681','691'],
    },
  ]

  const produitsGrps = PRODUITS_GROUPS.map(g => ({ ...g, lines: buildGroupLines(g.accounts), total: 0 }))
  const chargesGrps  = CHARGES_GROUPS.map(g  => ({ ...g, lines: buildGroupLines(g.accounts), total: 0 }))
  produitsGrps.forEach(g => { g.total = g.lines.reduce((s, l) => s + l.solde, 0) })
  chargesGrps.forEach(g  => { g.total = g.lines.reduce((s, l) => s + l.solde, 0) })

  const totalProduits = produitsGrps.reduce((s, g) => s + g.total, 0)
  const totalCharges  = chargesGrps.reduce((s, g) => s + g.total, 0)
  const resultatNet   = totalProduits - totalCharges

  /* ── SIG ─────────────────────────────────────────────────── */
  const caTotal          = getSolde('70')                                              // Ventes
  const achatsNets       = getSolde('601') + getSolde('602') + getSolde('603')        // Achats - retours
  const margeCommerciale = caTotal - achatsNets
  const valeurAjoutee    = margeCommerciale - (getSolde('621') + getSolde('622') + getSolde('623') + getSolde('624') + getSolde('625') + getSolde('626') + getSolde('627') + getSolde('628') + getSolde('61'))
  const chargesPersonnel = getSolde('66')
  const ebe              = Math.abs(valeurAjoutee) - Math.abs(chargesPersonnel)
  const dotAmort         = getSolde('681')
  const resultatExp      = ebe - Math.abs(dotAmort)
  const gainChange       = Math.abs(getSolde('776'))
  const perteChange      = Math.abs(getSolde('676'))
  const chargesFin       = Math.abs(getSolde('671')) + Math.abs(getSolde('672')) + perteChange
  const produitsFin      = Math.abs(getSolde('771')) + gainChange
  const resultatFin      = produitsFin - chargesFin

  /* ── Export CSV ──────────────────────────────────────────── */
  function exportCSV() {
    const rows: (string | number)[][] = [
      ['BILAN SYSCOHADA', year, ''],
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
    a.download = `bilan-syscohada-${year}.csv`; a.click()
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
            <TrendingUp size={22} className="text-[#2563EB]" />
            {t('compta.bilan.title')}
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            {t('compta.bilan.subtitle')} · SYSCOHADA Révisé 2017 · {year}
          </p>
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
          { id: 'bilan',    label: t('compta.rapports.bilan'),  icon: BarChart2  },
          { id: 'resultat', label: t('compta.rapports.cr'),      icon: FileText   },
          { id: 'sig',      label: 'SIG',                        icon: TrendingUp },
        ].map(tab_ => (
          <button key={tab_.id} onClick={() => setTab(tab_.id as typeof tab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold transition-all ${
              tab === tab_.id ? 'bg-[#2563EB] text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'
            }`}>
            <tab_.icon size={13} />
            {tab_.label}
          </button>
        ))}
      </div>

      {/* ── BILAN ─────────────────────────────────────────────── */}
      {tab === 'bilan' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ACTIF */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="bg-[#2563EB] text-white px-4 py-3">
              <p className="text-[13px] font-extrabold">{t('compta.bilan.actif')}</p>
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
                      <span className="text-[11px] text-[#64748B] font-mono w-10 shrink-0">{l.number}</span>
                      <span className="text-[12px] text-[#0F172A] flex-1 mx-2 truncate">{l.name}</span>
                      <span className="text-[12px] font-bold text-[#0F172A]">{fmtFCFA(l.solde)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between px-4 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <span className="text-[11px] font-semibold text-[#64748B]">Sous-total</span>
                  <span className="text-[12px] font-extrabold text-[#2563EB]">{fmtFCFA(g.total)}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-between px-4 py-3 bg-[#2563EB] text-white">
              <span className="font-bold">{t('compta.bilan.totalActif')}</span>
              <span className="font-extrabold text-[15px]">{fmtFCFA(totalActif)}</span>
            </div>
          </div>

          {/* PASSIF */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="bg-[#16A34A] text-white px-4 py-3">
              <p className="text-[13px] font-extrabold">{t('compta.bilan.passif')}</p>
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
                      <span className="text-[11px] text-[#64748B] font-mono w-10 shrink-0">{l.number}</span>
                      <span className="text-[12px] text-[#0F172A] flex-1 mx-2 truncate">{l.name}</span>
                      <span className="text-[12px] font-bold text-[#0F172A]">{fmtFCFA(l.solde)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between px-4 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <span className="text-[11px] font-semibold text-[#64748B]">Sous-total</span>
                  <span className="text-[12px] font-extrabold text-[#16A34A]">{fmtFCFA(g.total)}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-between px-4 py-3 bg-[#16A34A] text-white">
              <span className="font-bold">{t('compta.bilan.totalPassif')}</span>
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
                ? '✓ Bilan équilibré — Actif = Passif (SYSCOHADA révisé 2017)'
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
              <p className="text-[13px] font-extrabold">PRODUITS — Classe 7</p>
              <p className="text-[18px] font-extrabold">{fmtFCFA(totalProduits)}</p>
            </div>
            {produitsGrps.map(g => (
              <div key={g.label}>
                <div className="px-4 py-1.5 bg-[#F0FDF4] border-b border-[#E2E8F0]">
                  <p className="text-[11px] font-bold text-[#16A34A]">{g.label}</p>
                </div>
                {g.lines.map(l => (
                  <div key={l.number} className="flex justify-between items-center px-4 py-1.5 border-b border-[#F8FAFC] hover:bg-[#F8FAFC]">
                    <span className="text-[11px] text-[#64748B] font-mono w-10">{l.number}</span>
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
              <p className="text-[13px] font-extrabold">CHARGES — Classes 6</p>
              <p className="text-[18px] font-extrabold">{fmtFCFA(totalCharges)}</p>
            </div>
            {chargesGrps.map(g => (
              <div key={g.label}>
                <div className="px-4 py-1.5 bg-[#FEF2F2] border-b border-[#E2E8F0]">
                  <p className="text-[11px] font-bold text-[#DC2626]">{g.label}</p>
                </div>
                {g.lines.map(l => (
                  <div key={l.number} className="flex justify-between items-center px-4 py-1.5 border-b border-[#F8FAFC] hover:bg-[#F8FAFC]">
                    <span className="text-[11px] text-[#64748B] font-mono w-10">{l.number}</span>
                    <span className="text-[12px] text-[#0F172A] flex-1 mx-2 truncate">{l.name}</span>
                    <span className="text-[12px] font-bold text-[#DC2626]">{fmtFCFA(l.solde)}</span>
                  </div>
                ))}
                {g.lines.length === 0 && <p className="px-4 py-1.5 text-[11px] text-[#94A3B8] italic">— Aucun solde —</p>}
              </div>
            ))}
          </div>

          {/* Résultat net */}
          <div className={`lg:col-span-2 px-6 py-4 rounded-xl border-2 flex items-center justify-between ${
            resultatNet >= 0
              ? 'bg-[#F0FDF4] border-[#86EFAC]'
              : 'bg-[#FEF2F2] border-[#FECACA]'
          }`}>
            <div>
              <p className="text-[14px] font-extrabold text-[#0F172A]">
                {resultatNet >= 0 ? '✓ Résultat net — Bénéfice' : '⚠ Résultat net — Déficit'} (XI SYSCOHADA)
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
          <p className="text-[13px] text-[#64748B]">Soldes Intermédiaires de Gestion — SYSCOHADA Révisé 2017</p>
          {[
            { label: "Chiffre d'affaires net (XB)",        value: caTotal,        color: '#16A34A' },
            { label: 'Marge brute sur marchandises (XA)',  value: margeCommerciale, color: '#2563EB' },
            { label: 'Valeur ajoutée produite (XC)',       value: valeurAjoutee,  color: '#2563EB' },
            { label: 'Charges de personnel — 66 (sign -)', value: chargesPersonnel, color: '#DC2626', sign: '-' },
            { label: 'Excédent Brut d\'Exploitation (XD)', value: ebe,            color: ebe >= 0 ? '#16A34A' : '#DC2626' },
            { label: 'Dotations amortissements — 681 (-)', value: dotAmort,       color: '#DC2626', sign: '-' },
            { label: 'Résultat d\'Exploitation (XF)',      value: resultatExp,    color: resultatExp >= 0 ? '#2563EB' : '#DC2626' },
            { label: 'Produits financiers nets — 77',      value: produitsFin,    color: '#16A34A' },
            { label: 'Charges financières — 671-676 (-)',  value: chargesFin,     color: '#DC2626', sign: '-' },
            { label: 'Résultat financier (XH)',            value: resultatFin,    color: resultatFin >= 0 ? '#16A34A' : '#DC2626' },
            { label: 'RÉSULTAT NET DE L\'EXERCICE (XI)',   value: resultatNet,    color: resultatNet >= 0 ? '#16A34A' : '#DC2626', bold: true },
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
