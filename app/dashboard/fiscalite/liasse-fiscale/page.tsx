'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useFmt } from '@/lib/hooks/useFmt'
import { FileText, Download, ChevronDown, ChevronRight } from 'lucide-react'

// Liasse fiscale DGI Congo — tableaux normalisés
// Référence : CGI Congo, formulaires DGI Brazzaville
// Comptes SYSCOHADA utilisés pour les agrégats

interface JournalEntry {
  debit_account: string
  credit_account: string
  montant: number
  date_operation: string
}

const YEARS = [2024, 2025, 2026, 2027]

// Définitions des tableaux de la liasse
const TABLEAUX = [
  {
    id: 'bilan_actif',
    titre: 'Bilan — Actif',
    lignes: [
      { code: 'AA', libelle: 'Immobilisations incorporelles', comptes: ['21'] },
      { code: 'AB', libelle: 'Immobilisations corporelles', comptes: ['22', '23', '24'] },
      { code: 'AC', libelle: 'Immobilisations financières', comptes: ['26', '27'] },
      { code: 'BA', libelle: 'Stocks et en-cours', comptes: ['31', '32', '33', '34', '35', '36', '37', '38'] },
      { code: 'BB', libelle: 'Créances clients', comptes: ['411', '412', '413'] },
      { code: 'BC', libelle: 'Autres créances', comptes: ['40', '42', '43', '44', '45', '46', '48'] },
      { code: 'BD', libelle: 'Disponibilités', comptes: ['51', '52', '53', '54', '57'] },
      { code: 'BZ', libelle: 'TOTAL ACTIF', comptes: ['21','22','23','24','26','27','31','32','33','34','35','36','37','38','411','412','413','40','42','43','44','45','46','48','51','52','53','54','57'] },
    ],
  },
  {
    id: 'bilan_passif',
    titre: 'Bilan — Passif',
    lignes: [
      { code: 'CA', libelle: 'Capital social', comptes: ['101', '102'] },
      { code: 'CB', libelle: 'Réserves', comptes: ['11', '12'] },
      { code: 'CC', libelle: 'Résultat de l\'exercice', comptes: ['13'] },
      { code: 'DA', libelle: 'Dettes financières', comptes: ['16', '17'] },
      { code: 'DB', libelle: 'Fournisseurs', comptes: ['401', '402', '403'] },
      { code: 'DC', libelle: 'Dettes fiscales & sociales', comptes: ['431', '432', '441', '442', '443', '447'] },
      { code: 'DD', libelle: 'Autres dettes', comptes: ['40','41','44','45','46','48'] },
      { code: 'DZ', libelle: 'TOTAL PASSIF', comptes: ['101','102','11','12','13','16','17','401','402','403','431','432','441','442','443','447'] },
    ],
  },
  {
    id: 'compte_resultat',
    titre: 'Compte de Résultat',
    lignes: [
      { code: 'TA', libelle: 'Ventes de marchandises', comptes: ['701'] },
      { code: 'TB', libelle: 'Ventes de produits fabriqués', comptes: ['702', '703', '704'] },
      { code: 'TC', libelle: 'Prestations de services', comptes: ['706'] },
      { code: 'TD', libelle: 'Autres produits d\'exploitation', comptes: ['71', '72', '73', '75'] },
      { code: 'XA', libelle: "Chiffre d'affaires net", comptes: ['70'] },
      { code: 'RA', libelle: 'Achats de marchandises', comptes: ['601', '602'] },
      { code: 'RB', libelle: 'Charges de personnel', comptes: ['661', '662', '663', '664'] },
      { code: 'RC', libelle: 'Dotations aux amortissements', comptes: ['681', '682', '683'] },
      { code: 'RD', libelle: 'Autres charges d\'exploitation', comptes: ['60', '62', '63', '64', '65'] },
      { code: 'XF', libelle: 'Résultat d\'exploitation', comptes: ['70','71','72','73','75','60','61','62','63','64','65','66','68'] },
      { code: 'XH', libelle: 'Résultat financier', comptes: ['77', '67'] },
      { code: 'XI', libelle: 'Résultat net', comptes: ['70','71','72','73','74','75','76','77','78','79','60','61','62','63','64','65','66','67','68','69'] },
    ],
  },
  {
    id: 'etat_fiscal',
    titre: 'État fiscal',
    lignes: [
      { code: 'F1', libelle: 'Résultat comptable', comptes: ['70','71','72','73','74','75','76','77','78','79','60','61','62','63','64','65','66','67','68','69'] },
      { code: 'F2', libelle: 'Réintégrations fiscales', comptes: [] },
      { code: 'F3', libelle: 'Déductions fiscales', comptes: [] },
      { code: 'F4', libelle: 'Résultat fiscal (base IS)', comptes: [] },
      { code: 'F5', libelle: 'IS théorique (30%)', comptes: [] },
      { code: 'F6', libelle: 'Minimum IS (1% CA HT)', comptes: [] },
      { code: 'F7', libelle: 'IS à payer', comptes: [] },
    ],
  },
]

export default function LiasseFiscalePage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId } = useTenant()
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [expanded, setExpanded] = useState<string[]>(['compte_resultat'])

  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('journal_entries')
        .select('debit_account, credit_account, montant, date_operation')
        .eq('tenant_id', tenantId)
        .eq('fiscal_year', year)
      setEntries((data || []) as JournalEntry[])
      setLoading(false)
    })()
  }, [tenantId, year])

  // Calcul des soldes par préfixe
  const soldes = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of entries) {
      if (e.debit_account) {
        const cur = map.get(e.debit_account) || 0
        map.set(e.debit_account, cur + e.montant)
      }
      if (e.credit_account) {
        const cur = map.get(e.credit_account) || 0
        map.set(e.credit_account, cur - e.montant)
      }
    }
    return map
  }, [entries])

  function getSolde(prefixes: string[]): number {
    if (!prefixes.length) return 0
    let total = 0
    for (const [key, val] of soldes.entries()) {
      if (prefixes.some(p => key === p || key.startsWith(p))) {
        total += val
      }
    }
    return total
  }

  // CA pour le minimum IS
  const caHT = getSolde(['70', '71'])

  function getLigneMontant(tableau_id: string, code: string, comptes: string[]): number {
    if (tableau_id === 'etat_fiscal') {
      const resultatComptable = getSolde(['70','71','72','73','74','75','76','77','78','79','60','61','62','63','64','65','66','67','68','69'])
      if (code === 'F1') return resultatComptable
      if (code === 'F4') return resultatComptable
      if (code === 'F5') return Math.round(Math.max(0, resultatComptable) * 0.30)
      if (code === 'F6') return Math.round(caHT * 0.01)
      if (code === 'F7') return Math.round(Math.max(
        Math.max(0, resultatComptable) * 0.30,
        Math.max(500000, caHT * 0.01)
      ))
      return 0
    }
    return Math.abs(getSolde(comptes))
  }

  function exportCSV() {
    const rows: { Tableau: string; Code: string; Libellé: string; Montant: number }[] = []
    for (const tab of TABLEAUX) {
      for (const ligne of tab.lignes) {
        rows.push({
          Tableau: tab.titre,
          Code: ligne.code,
          Libellé: ligne.libelle,
          Montant: getLigneMontant(tab.id, ligne.code, ligne.comptes),
        })
      }
    }
    const csv = '﻿' + [Object.keys(rows[0]).join(';'), ...rows.map(r => Object.values(r).join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `liasse-fiscale-${year}.csv`; a.click()
  }

  function toggle(id: string) {
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-[#94A3B8]">
      <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mr-2" />
      Chargement…
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
            <FileText size={22} className="text-[#2563EB]" />
            Liasse Fiscale DGI
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            Déclarations annuelles consolidées — Exercice {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-white focus:outline-none">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] text-white rounded-lg text-[12px] font-bold">
            <Download size={13} /> Exporter CSV
          </button>
        </div>
      </div>

      {/* KPI résumé */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Chiffre d'affaires HT", value: fmtFCFA(Math.abs(getSolde(['70']))), color: '#2563EB' },
          { label: 'Résultat net', value: fmtFCFA(Math.abs(getSolde(['70','71','72','73','74','75','76','77','78','79','60','61','62','63','64','65','66','67','68','69']))), color: '#16A34A' },
          { label: 'IS estimé', value: fmtFCFA(Math.round(Math.max(Math.max(0, getSolde(['70','71','72','73','74','75','76','77','78','79','60','61','62','63','64','65','66','67','68','69'])) * 0.30, Math.max(500000, Math.abs(getSolde(['70'])) * 0.01)))), color: '#DC2626' },
          { label: 'Entrées journal', value: String(entries.length), color: '#7C3AED' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <div className="text-[18px] font-extrabold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[11px] text-[#64748B] mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tableaux */}
      {TABLEAUX.map(tab => {
        const isExp = expanded.includes(tab.id)
        return (
          <div key={tab.id} className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <button
              onClick={() => toggle(tab.id)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#F8FAFC]"
            >
              <span className="text-[13px] font-extrabold text-[#0F172A]">{tab.titre}</span>
              {isExp ? <ChevronDown size={16} className="text-[#64748B]" /> : <ChevronRight size={16} className="text-[#64748B]" />}
            </button>
            {isExp && (
              <div className="border-t border-[#F1F5F9] overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="bg-[#F8FAFC]">
                    <tr>
                      <th className="px-4 py-2 text-left text-[10px] font-semibold text-[#94A3B8] uppercase w-16">Code</th>
                      <th className="px-4 py-2 text-left text-[10px] font-semibold text-[#94A3B8] uppercase">Libellé</th>
                      <th className="px-4 py-2 text-right text-[10px] font-semibold text-[#94A3B8] uppercase w-40">Montant (FCFA)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tab.lignes.map((ligne, i) => {
                      const montant = getLigneMontant(tab.id, ligne.code, ligne.comptes)
                      const isTotal = ligne.code.startsWith('BZ') || ligne.code.startsWith('DZ') || ligne.code === 'XI' || ligne.code === 'F7' || ligne.code === 'XA'
                      return (
                        <tr key={ligne.code} className={`border-t border-[#F8FAFC] ${isTotal ? 'bg-[#EFF6FF] font-extrabold' : 'hover:bg-[#F8FAFC]'}`}>
                          <td className="px-4 py-2 font-mono text-[11px] font-bold text-[#2563EB]">{ligne.code}</td>
                          <td className="px-4 py-2 text-[#0F172A]">{ligne.libelle}</td>
                          <td className="px-4 py-2 text-right font-bold" style={{ color: montant < 0 ? '#DC2626' : '#0F172A' }}>
                            {montant !== 0 ? fmtFCFA(montant) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
