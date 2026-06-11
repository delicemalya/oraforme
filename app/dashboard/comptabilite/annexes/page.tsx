'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useFmt } from '@/lib/hooks/useFmt'
import { calculerSolde, type LigneEcriture, type SoldeCompte } from '@/lib/syscohada/etats-financiers'
import { FileText, ChevronLeft, Download, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'

const YEARS = [2024, 2025, 2026, 2027]

// ── Types ─────────────────────────────────────────────────────────────────────

interface Entreprise {
  nom: string; adresse: string | null; ville: string | null
  forme_juridique: string | null; capital_social: number | null
  rccm: string | null; nif: string | null
}

// ── Accordéon ────────────────────────────────────────────────────────────────

function Section({ titre, badge, children }: { titre: string; badge?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-[#EFF6FF] border-b border-[#E2E8F0]">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-extrabold text-[#2563EB]">{titre}</span>
          {badge && (
            <span className="text-[10px] px-2 py-0.5 bg-[#2563EB] text-white rounded-full font-bold">{badge}</span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-[#64748B]" /> : <ChevronDown size={16} className="text-[#64748B]" />}
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  )
}

function TableSolde({ lignes, color = '#2563EB' }: { lignes: { num: string; nom: string; solde: number }[]; color?: string }) {
  const { fmt: fmtFCFA } = useFmt()
  if (!lignes.length) return <p className="text-[12px] text-[#94A3B8] italic">— Aucun solde significatif —</p>
  return (
    <table className="w-full text-[12px]">
      <thead>
        <tr className="border-b border-[#E2E8F0]">
          <th className="text-left py-1.5 text-[11px] text-[#94A3B8] font-semibold w-16">N°</th>
          <th className="text-left py-1.5 text-[11px] text-[#94A3B8] font-semibold">Intitulé</th>
          <th className="text-right py-1.5 text-[11px] text-[#94A3B8] font-semibold">Solde</th>
        </tr>
      </thead>
      <tbody>
        {lignes.map(l => (
          <tr key={l.num} className="border-b border-[#F8FAFC] hover:bg-[#F8FAFC]">
            <td className="py-1.5 font-mono font-bold" style={{ color }}>{l.num}</td>
            <td className="py-1.5 text-[#0F172A]">{l.nom}</td>
            <td className="py-1.5 text-right font-semibold text-[#0F172A]">{fmtFCFA(Math.abs(l.solde))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AnnexesPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId } = useTenant()
  const [ecritures, setEcritures] = useState<LigneEcriture[]>([])
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null)
  const [loading, setLoading]     = useState(true)
  const [year, setYear]           = useState(new Date().getFullYear())

  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      const [{ data: jData }, { data: tData }] = await Promise.all([
        supabase
          .from('journal_entries')
          .select('debit_account, credit_account, montant')
          .eq('tenant_id', tenantId)
          .eq('fiscal_year', year),
        supabase
          .from('tenants')
          .select('nom, adresse, ville, forme_juridique, capital_social, rccm, nif')
          .eq('id', tenantId)
          .maybeSingle(),
      ])

      const lines: LigneEcriture[] = []
      for (const e of (jData || []) as { debit_account: string; credit_account: string; montant: number }[]) {
        lines.push({ compte: e.debit_account,  debit: e.montant, credit: 0 })
        lines.push({ compte: e.credit_account, debit: 0, credit: e.montant })
      }
      setEcritures(lines)
      setEntreprise(tData as Entreprise | null)
      setLoading(false)
    })()
  }, [tenantId, year])

  const soldes = useMemo(() => calculerSolde(ecritures), [ecritures])

  function getSoldes(prefixes: string[], noms: Record<string, string>): { num: string; nom: string; solde: number }[] {
    const result: { num: string; nom: string; solde: number }[] = []
    for (const [num, s] of soldes) {
      if (prefixes.some(p => num.startsWith(p)) && Math.abs(s.solde) > 0) {
        result.push({ num, nom: noms[num] ?? `Compte ${num}`, solde: s.solde })
      }
    }
    return result.sort((a, b) => a.num.localeCompare(b.num, undefined, { numeric: true }))
  }

  // Intitulés SYSCOHADA pour les comptes principaux
  const NOMS_IMMO: Record<string, string> = {
    '21': 'Immo incorporelles', '211': 'Frais développement', '212': 'Brevets/licences', '213': 'Logiciels',
    '214': 'Marques', '215': 'Fonds commercial', '216': 'Droit au bail',
    '22': 'Terrains', '221': 'Terrains agric.', '222': 'Terrains nus', '223': 'Terrains bâtis',
    '23': 'Bâtiments', '231': 'Bâtiments sol propre', '232': 'Bâtiments sol autrui',
    '24': 'Matériel', '241': 'Matériel industriel', '244': 'Mobilier bureau', '245': 'Matériel transport', '247': 'Matériel informatique',
    '26': 'Titres participation', '261': 'Titres entreprises assoc.',
    '27': 'Autres immo financières', '271': 'Prêts et créances', '272': 'Dépôts cautionnements',
  }
  const NOMS_AMORT: Record<string, string> = {
    '281': 'Amort. charges immo', '282': 'Amort. immo incorporelles', '283': 'Amort. immo corporelles',
    '284': 'Amort. immo incorporelles', '286': 'Amort. bâtiments', '288': 'Amort. matériel',
  }
  const NOMS_PROV: Record<string, string> = {
    '39': 'Dépréciations stocks', '391': 'Dép. marchandises', '392': 'Dép. matières premières',
    '49': 'Dépréciations créances', '491': 'Dép. clients', '499': 'Provisions risques CT',
    '19': 'Provisions financières', '191': 'Prov. hausses prix', '194': 'Prov. pertes change',
    '15': 'Provisions réglementées',
  }
  const NOMS_CREANCES: Record<string, string> = {
    '411': 'Clients', '412': 'Effets à recevoir', '416': 'Créances litigieuses',
    '418': 'Clients produits non facturés', '445': 'État — subventions',
    '4445': 'TVA récup. immo', '4446': 'TVA récup. achats', '4447': 'Crédit TVA',
    '471': 'Débiteurs divers', '485': 'Créances cessions immo',
  }
  const NOMS_DETTES: Record<string, string> = {
    '401': 'Fournisseurs', '402': 'Effets à payer', '404': 'Four. investissements',
    '408': 'Factures non parvenues', '419': 'Clients créditeurs',
    '421': 'Personnel avances', '422': 'Personnel rémunérations', '423': 'Oppositions',
    '431': 'CNSS', '441': 'IS à payer', '442': 'Autres impôts',
    '4441': 'TVA facturée', '446': 'Collectivités — impôts', '447': 'Retenues source',
    '161': 'Emprunts obligataires', '162': 'Assoc. emprunts', '163': 'Autres emprunts',
    '164': 'Crédit-bail', '472': 'Créditeurs divers', '477': 'Produits constatés avance',
  }

  const immosBruts   = getSoldes(['21','22','23','24','25','26','27'], NOMS_IMMO)
  const amorts       = getSoldes(['28'], NOMS_AMORT)
  const provisions   = getSoldes(['15','19','39','49'], NOMS_PROV)
  const creances     = getSoldes(['41','4445','4446','4447','471','476'], NOMS_CREANCES)
  const dettes       = getSoldes(['40','41','42','43','44','161','162','163','164','472','477'], NOMS_DETTES)
  const treso        = getSoldes(['51','52','53','54','57'], { '512': 'Chèques à encaisser', '521': 'Banque', '531': 'CCP', '541': 'Airtel Money', '542': 'MTN MoMo', '543': 'Orange Money', '571': 'Caisse' })

  const totalImmosBrut = immosBruts.reduce((s, l) => s + Math.abs(l.solde), 0)
  const totalAmorts    = amorts.reduce((s, l) => s + Math.abs(l.solde), 0)
  const totalImmoNet   = totalImmosBrut - totalAmorts

  function exportCSV() {
    const rows = [
      ['NOTES ANNEXES — SYSCOHADA', `Exercice ${year}`],
      ['Entreprise', entreprise?.nom ?? ''],
      [],
      ['IMMOBILISATIONS (brut)', totalImmosBrut],
      ['AMORTISSEMENTS', -totalAmorts],
      ['NET IMMOBILISATIONS', totalImmoNet],
    ]
    const csv = '﻿' + rows.map(r => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `annexes-${year}.csv`; a.click()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-[#94A3B8]">
      <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mr-2" />
      Chargement des annexes…
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
              <FileText size={22} className="text-[#2563EB]" />
              Notes Annexes
            </h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">
              SYSCOHADA révisé 2017 · Informations complémentaires aux états financiers · {year}
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
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* NOTE 1 — Identification */}
      <Section titre="NOTE 1 — Identification de l'entité" badge="Obligatoire">
        <div className="grid grid-cols-2 gap-4 text-[12px]">
          {[
            ['Dénomination sociale', entreprise?.nom ?? '—'],
            ['Forme juridique',      entreprise?.forme_juridique ?? '—'],
            ['Siège social',         entreprise?.ville ?? '—'],
            ['Adresse',              entreprise?.adresse ?? '—'],
            ['Capital social',       entreprise?.capital_social ? fmtFCFA(entreprise.capital_social) : '—'],
            ['RCCM',                 entreprise?.rccm ?? '—'],
            ['NIF',                  entreprise?.nif ?? '—'],
            ['Exercice comptable',   `1er janvier − 31 décembre ${year}`],
            ['Référentiel comptable', 'SYSCOHADA révisé 2017'],
            ['Monnaie de présentation', 'Franc CFA (FCFA)'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-[#64748B] w-40 shrink-0">{k}</span>
              <span className="font-semibold text-[#0F172A]">{v}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* NOTE 2 — Méthodes comptables */}
      <Section titre="NOTE 2 — Méthodes et règles d'évaluation" badge="Obligatoire">
        <div className="space-y-4 text-[12px] text-[#374151]">
          <div>
            <p className="font-bold text-[#0F172A] mb-1">A. Immobilisations corporelles et incorporelles</p>
            <p>Les immobilisations sont comptabilisées au coût historique diminué des amortissements cumulés et des pertes de valeur éventuelles. Les amortissements sont calculés selon le mode linéaire sur les durées de vie économique estimées :</p>
            <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1">
              {[
                ['Frais d\'établissement', '5 ans'],
                ['Logiciels et sites web', '3 ans'],
                ['Fonds commercial', 'Durée indéterminée (test dépréciation annuel)'],
                ['Bâtiments sur sol propre', '20 à 40 ans'],
                ['Matériel industriel', '5 à 10 ans'],
                ['Matériel informatique', '3 à 5 ans'],
                ['Matériel de transport', '4 à 5 ans'],
                ['Mobilier de bureau', '5 à 10 ans'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-[#64748B] flex-1">{k}</span>
                  <span className="font-semibold text-[#0F172A] text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="font-bold text-[#0F172A] mb-1">B. Stocks et en-cours</p>
            <p>Les stocks sont évalués selon la méthode du <strong>coût moyen pondéré (CMP)</strong> conformément aux dispositions du SYSCOHADA révisé 2017. Les stocks font l&apos;objet d&apos;une dépréciation lorsque leur valeur nette de réalisation est inférieure au coût de revient.</p>
          </div>
          <div>
            <p className="font-bold text-[#0F172A] mb-1">C. Créances et dettes</p>
            <p>Les créances et dettes sont enregistrées à leur valeur nominale. Les créances douteuses font l&apos;objet d&apos;une provision calculée sur la base du risque de non-recouvrement estimé.</p>
          </div>
          <div>
            <p className="font-bold text-[#0F172A] mb-1">D. Produits</p>
            <p>Les produits des ventes de biens sont comptabilisés au moment du transfert du contrôle à l&apos;acheteur. Les produits de prestations de services sont comptabilisés selon le degré d&apos;avancement de la prestation.</p>
          </div>
          <div>
            <p className="font-bold text-[#0F172A] mb-1">E. Opérations en devises</p>
            <p>Les transactions en devises étrangères sont converties au cours du franc CFA à la date de la transaction. Les différences de change sont comptabilisées en résultat dans les comptes 676 (pertes) et 776 (gains).</p>
          </div>
          <div>
            <p className="font-bold text-[#0F172A] mb-1">F. Impôts et taxes</p>
            <p>La TVA congolaise est de <strong>18%</strong> + Centime Additionnel (CA) de <strong>5%</strong> de la TVA collectée. L&apos;IS est calculé au taux de <strong>30%</strong> sur le bénéfice fiscal. Les cotisations CNSS sont de <strong>5,04%</strong> (salarié) et <strong>14,16%</strong> (patronal).</p>
          </div>
        </div>
      </Section>

      {/* NOTE 3 — Immobilisations */}
      <Section titre="NOTE 3 — État des immobilisations" badge={`${immosBruts.length} lignes`}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Valeur brute', val: totalImmosBrut, color: '#2563EB' },
              { label: 'Amortissements cumulés', val: totalAmorts, color: '#DC2626' },
              { label: 'Valeur nette (VNA)', val: totalImmoNet, color: '#16A34A' },
            ].map(k => (
              <div key={k.label} className="bg-[#F8FAFC] rounded-xl p-3 text-center border border-[#E2E8F0]">
                <p className="text-[11px] text-[#64748B] mb-1">{k.label}</p>
                <p className="text-[16px] font-extrabold" style={{ color: k.color }}>{fmtFCFA(k.val)}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] font-bold text-[#64748B] uppercase mb-2">Valeur brute par compte</p>
          <TableSolde lignes={immosBruts} color="#2563EB" />
          <p className="text-[11px] font-bold text-[#64748B] uppercase mt-4 mb-2">Amortissements cumulés</p>
          <TableSolde lignes={amorts} color="#DC2626" />
        </div>
      </Section>

      {/* NOTE 4 — Provisions */}
      <Section titre="NOTE 4 — État des provisions" badge={`${provisions.length} lignes`}>
        <p className="text-[12px] text-[#64748B] mb-3">
          Les provisions ont été constituées selon le principe de prudence pour les risques identifiés à la date de clôture.
        </p>
        <TableSolde lignes={provisions} color="#F59E0B" />
      </Section>

      {/* NOTE 5 — Créances */}
      <Section titre="NOTE 5 — État des créances" badge={`${creances.length} lignes`}>
        <p className="text-[12px] text-[#64748B] mb-3">
          Détail des créances inscrites à l&apos;actif circulant et de leurs éventuelles dépréciations.
        </p>
        <TableSolde lignes={creances} color="#2563EB" />
      </Section>

      {/* NOTE 6 — Dettes */}
      <Section titre="NOTE 6 — État des dettes" badge={`${dettes.length} lignes`}>
        <p className="text-[12px] text-[#64748B] mb-3">
          Détail des dettes exigibles à court et long terme inscrites au passif.
        </p>
        <TableSolde lignes={dettes} color="#DC2626" />
      </Section>

      {/* NOTE 7 — Trésorerie */}
      <Section titre="NOTE 7 — Détail de la trésorerie" badge={`${treso.length} comptes`}>
        <p className="text-[12px] text-[#64748B] mb-3">
          Soldes des comptes de trésorerie à la clôture de l&apos;exercice — classe 5 SYSCOHADA.
        </p>
        <TableSolde lignes={treso} color="#0891B2" />
        <div className="mt-3 flex justify-between px-4 py-2 bg-[#F0F9FF] rounded-lg border border-[#BAE6FD]">
          <span className="text-[12px] font-bold text-[#0891B2]">Total trésorerie nette</span>
          <span className="text-[13px] font-extrabold text-[#0891B2]">
            {fmtFCFA(treso.reduce((s, l) => s + Math.abs(l.solde), 0))}
          </span>
        </div>
      </Section>

      {/* NOTE 8 — Engagements hors bilan */}
      <Section titre="NOTE 8 — Engagements hors bilan" badge="Obligatoire">
        <div className="text-[12px] text-[#374151] space-y-3">
          <p className="text-[#64748B] italic">
            Les engagements hors bilan représentent des obligations potentielles non comptabilisées au bilan.
            Ils doivent être mentionnés dès lors qu&apos;ils sont significatifs.
          </p>
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-3 text-[#92400E]">
            <p className="font-semibold mb-1">À renseigner manuellement :</p>
            <ul className="list-disc list-inside space-y-1 text-[11px]">
              <li>Cautions et garanties données</li>
              <li>Engagements de crédit-bail (loyers futurs)</li>
              <li>Commandes fermes passées non encore livrées</li>
              <li>Litiges en cours et provisions non encore constituées</li>
              <li>Engagements de retraite et avantages postérieurs à l&apos;emploi</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* NOTE 9 — Événements post-clôture */}
      <Section titre="NOTE 9 — Événements postérieurs à la clôture" badge="Obligatoire">
        <div className="text-[12px] text-[#374151] space-y-3">
          <p>Conformément au SYSCOHADA révisé 2017, les événements postérieurs à la date de clôture doivent être mentionnés lorsqu&apos;ils sont de nature à modifier l&apos;image fidèle des états financiers.</p>
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-3 text-[#92400E]">
            <p className="font-semibold mb-1">À renseigner manuellement :</p>
            <ul className="list-disc list-inside space-y-1 text-[11px]">
              <li>Événements ajustants (existence à la clôture, informations confirmées après)</li>
              <li>Événements non ajustants (survenants après la clôture — divulgation uniquement)</li>
              <li>Dividendes proposés ou déclarés après la date de clôture</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* NOTE 10 — Obligations SYSCOHADA */}
      <Section titre="NOTE 10 — Référentiel et conformité SYSCOHADA">
        <div className="text-[12px] text-[#374151] space-y-2">
          <p>Les présents états financiers ont été établis conformément au <strong>Système Comptable OHADA révisé (SYSCOHADA révisé 2017)</strong>, entré en vigueur le 1er janvier 2018.</p>
          <div className="grid grid-cols-2 gap-4 mt-3">
            {[
              ['Plan comptable', 'SYSCOHADA révisé 2017 — Classes 1 à 9'],
              ['Bilan', 'Format officiel — Codes AE à EE'],
              ['Compte de résultat', 'Format officiel — Codes XA à XI'],
              ['Flux de trésorerie', 'Méthode indirecte — Codes ZA, ZB, ZC'],
              ['Évaluation stocks', 'Coût moyen pondéré (CMP)'],
              ['Amortissements', 'Mode linéaire'],
              ['Provisions', 'Principe de prudence OHADA'],
              ['Monnaie', 'Franc CFA (XAF / FCFA)'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-[#64748B] w-36 shrink-0">{k}</span>
                <span className="font-semibold text-[#0F172A]">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

    </div>
  )
}
