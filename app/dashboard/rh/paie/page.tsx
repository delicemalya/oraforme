'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign, Users, RefreshCw, Check, AlertTriangle, Loader2,
  FileText, Calendar, X, ChevronLeft, ChevronRight, TrendingUp,
  Building2, Play, Plus, Printer, CreditCard, Eye, Lock,
  ChevronDown, ChevronUp, Download, BarChart3, Zap,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { captureSupabaseError } from '@/lib/monitoring'
import { calcPrimeAnciennete, fmtNum } from '@/lib/paie/calcul-paie'
import {
  calculerIRPP, calculerChargesSociales,
  type SituationFamiliale,
} from '@/lib/fiscal/universal-tax-engine'
import { getCountryConfig } from '@/lib/countries'
import type { CountryConfig, CodePays } from '@/lib/countries/types'

// ── Constantes ─────────────────────────────────────────────────────────────────

const MOIS_LABELS = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
const MONTH_KEYS = [
  '', 'month.jan', 'month.feb', 'month.mar', 'month.apr', 'month.may', 'month.jun',
  'month.jul', 'month.aug', 'month.sep', 'month.oct', 'month.nov', 'month.dec',
]

// ── Types ─────────────────────────────────────────────────────────────────────

type Plan = 'tpe' | 'pme' | 'grande'

interface DetailIRPP { label: string; taux: number; base: number; montant: number }

interface BulletinRow {
  employe_id:         string
  nom:                string
  prenom:             string
  poste:              string
  type_employe:       string
  cnss_num:           string
  situation:          SituationFamiliale
  nb_enfants:         number
  annees_anciennete:  number
  existingId?:        string
  statut:             'brouillon' | 'generee' | 'validee' | 'payee'
  // Inputs
  heures_sup:         number
  taux_horaire:       number
  // Gains
  salaire_base:       number
  heures_sup_montant: number
  prime_rendement:    number
  prime_anciennete:   number
  prime_transport:    number
  prime_logement:     number
  prime_responsabilite:   number
  indemnite_deplacement:  number
  avantages_nature:       number
  autres_gains:           number
  salaire_brut:           number
  // Retenues salarié
  cnss_employe:           number
  base_irpp:              number
  irpp:                   number
  irpp_detail:            DetailIRPP[]
  mutuelle:               number
  acompte:                number
  opposition:             number
  autres_retenues:        number
  total_retenues:         number
  salaire_net:            number
  // Patronal
  cnss_patronal:          number
  tus_patronal:           number
  medecine_travail:       number
  cout_total_employeur:   number
}

interface AcompteLine {
  id: string; employe_id: string; montant: number
  date_acompte: string; notes?: string; employe_nom?: string
}

// ── Moteur de calcul — CountryConfig ──────────────────────────────────────────

interface ElementsVariables {
  salaire_base:            number
  heures_sup?:             number
  taux_horaire?:           number
  prime_rendement?:        number
  prime_anciennete?:       number
  prime_transport?:        number
  prime_logement?:         number
  prime_responsabilite?:   number
  indemnite_deplacement?:  number
  avantages_nature?:       number
  autres_gains?:           number
  mutuelle?:               number
  acompte?:                number
  opposition?:             number
  autres_retenues?:        number
}

function computeBulletin(
  cfg: CountryConfig,
  codePays: CodePays,
  el: ElementsVariables,
  situation: SituationFamiliale,
  nb_enfants: number,
): Omit<BulletinRow, 'employe_id'|'nom'|'prenom'|'poste'|'type_employe'|'cnss_num'|'situation'|'nb_enfants'|'annees_anciennete'|'existingId'|'statut'|'heures_sup'|'taux_horaire'|'salaire_base'> {
  const heures_sup_montant = Math.round((el.heures_sup || 0) * (el.taux_horaire || 0))
  const prime_rendement    = el.prime_rendement    || 0
  const prime_anciennete   = el.prime_anciennete   || 0
  const prime_transport    = el.prime_transport    || 0
  const prime_logement     = el.prime_logement     || 0
  const prime_responsabilite   = el.prime_responsabilite   || 0
  const indemnite_deplacement  = el.indemnite_deplacement  || 0
  const avantages_nature       = el.avantages_nature       || 0
  const autres_gains           = el.autres_gains           || 0

  const salaire_brut = el.salaire_base + heures_sup_montant + prime_rendement +
    prime_anciennete + prime_transport + prime_logement + prime_responsabilite +
    indemnite_deplacement + avantages_nature + autres_gains

  let cnss_employe = 0; let cnss_patronal = 0; let tus_patronal = 0
  try {
    const cnssRes = calculerChargesSociales({ codePays, salaireBrut: salaire_brut })
    cnss_employe = cnssRes.total_salarie
    const tusBranch = cnssRes.branches.find(b => b.code === 'TUS')
    tus_patronal = tusBranch?.montant_patronal ?? 0
    cnss_patronal = cnssRes.total_patronal_net - tus_patronal
  } catch { void cfg }

  const base_irpp = Math.max(0, salaire_brut - cnss_employe)
  let irpp = 0; let irpp_detail: DetailIRPP[] = []
  try {
    const irppRes = calculerIRPP({ codePays, salaireBrut: base_irpp, situation, nombreEnfants: nb_enfants })
    irpp = irppRes.irpp_net
    irpp_detail = irppRes.tranches
      .filter(t => t.impot_total > 0)
      .map(t => ({ label: t.libelle, taux: +(t.taux * 100).toFixed(0), base: t.base, montant: t.impot_total }))
  } catch { void cfg }

  const mutuelle        = el.mutuelle        || 0
  const acompte         = el.acompte         || 0
  const opposition      = el.opposition      || 0
  const autres_retenues = el.autres_retenues || 0
  const total_retenues  = cnss_employe + irpp + mutuelle + acompte + opposition + autres_retenues
  const salaire_net     = salaire_brut - total_retenues
  const medecine_travail = 0
  const cout_total_employeur = salaire_brut + cnss_patronal + tus_patronal + medecine_travail

  return {
    heures_sup_montant, prime_rendement, prime_anciennete, prime_transport, prime_logement,
    prime_responsabilite, indemnite_deplacement, avantages_nature, autres_gains,
    salaire_brut, cnss_employe, base_irpp, irpp, irpp_detail,
    mutuelle, acompte, opposition, autres_retenues, total_retenues, salaire_net,
    cnss_patronal, tus_patronal, medecine_travail, cout_total_employeur,
  }
}

// ── Helpers UI ─────────────────────────────────────────────────────────────────

function fmt(n: number) { return fmtNum(n) }

function planFrom(taille: string | null | undefined): Plan {
  if (taille === 'pme' || taille === 'grande') return taille
  return 'tpe'
}

function PlanBadge({ plan }: { plan: Plan }) {
  const cfg = {
    tpe:   { label: 'Entrepreneur', color: '#6B7280', bg: '#6B728015' },
    pme:   { label: 'Business',     color: '#2563EB', bg: '#2563EB15' },
    grande:{ label: 'Compagnie',    color: '#7C3AED', bg: '#7C3AED15' },
  }[plan]
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.color + '30' }}>
      {cfg.label}
    </span>
  )
}

function KpiCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string; color: string; icon: React.ElementType
}) {
  return (
    <motion.div className="rounded-xl border border-[var(--border)] p-4 flex gap-3 items-start bg-white"
      whileHover={{ scale: 1.01, y: -1 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}20` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-[var(--text-secondary)] mb-0.5">{label}</p>
        <p className="text-lg font-bold text-[#101729] truncate">{value}</p>
        {sub && <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  )
}

function NumInput({ value, onChange, disabled, placeholder }: {
  value: number; onChange: (v: number) => void; disabled?: boolean; placeholder?: string
}) {
  return (
    <input type="number" min="0" value={value || ''} placeholder={placeholder}
      onChange={e => onChange(Number(e.target.value) || 0)} disabled={disabled}
      className="w-24 bg-[var(--surface)] border border-[var(--border)] rounded-md px-2 py-1 text-xs
                 text-right focus:outline-none focus:border-[#F59E0B] disabled:opacity-40 disabled:cursor-not-allowed" />
  )
}

// ── Impression bulletin ────────────────────────────────────────────────────────

function printBulletin(row: BulletinRow, mois: number, annee: number, entreprise: string, cfg: CountryConfig) {
  const w = window.open('', '_blank', 'width=800,height=1000')
  if (!w) return
  const irppRows = row.irpp_detail.map(d =>
    `<tr><td>${d.label}</td><td style="text-align:right">${fmt(d.base)}</td><td style="text-align:right">${d.taux}%</td><td style="text-align:right">${fmt(d.montant)}</td></tr>`
  ).join('')
  const cnssEmpTaux = cfg.cnss.branches.find(b => b.taux_salarie > 0)?.taux_salarie ?? 0
  const cnssPatTaux = cfg.cnss.branches.reduce((s, b) => s + b.taux_patronal, 0)
  const devise = cfg.devise

  w.document.write(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/>
<title>Bulletin de paie — ${row.prenom} ${row.nom}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;background:#fff}
  .page{max-width:700px;margin:0 auto;padding:32px 28px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:18px}
  .logo{font-size:22px;font-weight:800}.logo span{color:#16A34A}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
  .box{background:#f7f7f7;border-radius:6px;padding:12px}
  .box h3{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px}
  thead th{background:#111;color:#fff;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase}
  tbody tr:nth-child(even){background:#f9f9f9}
  tbody td{padding:6px 10px;border-bottom:1px solid #eee}
  .total-row td{font-weight:700;background:#f0f0f0;padding:8px 10px}
  .net-box{background:#111;color:#fff;border-radius:8px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
  .net-box .amount{font-size:22px;font-weight:800}
  .footer{text-align:center;font-size:9px;color:#aaa;border-top:1px solid #eee;padding-top:12px;margin-top:8px}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="page">
  <div class="header">
    <div><div class="logo">ora<span>forme</span></div><div style="font-size:10px;color:#555;margin-top:4px">${entreprise}</div></div>
    <div style="text-align:right"><h2 style="font-size:14px;font-weight:700">BULLETIN DE PAIE</h2>
      <p style="color:#555;font-size:10px">${MOIS_LABELS[mois]} ${annee}</p>
      <p style="font-size:9px;margin-top:4px">Édité le ${new Date().toLocaleDateString('fr-FR')}</p>
    </div>
  </div>
  <div class="parties">
    <div class="box"><h3>Employeur</h3><p><strong>${entreprise}</strong></p><p>${cfg.nom_pays}</p></div>
    <div class="box"><h3>Employé</h3><p><strong>${row.prenom} ${row.nom}</strong></p><p>${row.poste}</p>
      <p>N° ${cfg.cnss.acronyme} : ${row.cnss_num || '—'}</p><p>Contrat : ${row.type_employe?.toUpperCase() || '—'}</p></div>
  </div>
  <table><thead><tr><th>Élément de paie</th><th style="text-align:right">Montant (${devise})</th></tr></thead>
  <tbody>
    <tr><td>Salaire de base</td><td style="text-align:right">${fmt(row.salaire_base)}</td></tr>
    ${row.prime_anciennete > 0 ? `<tr><td>Prime d'ancienneté (${row.annees_anciennete} ans)</td><td style="text-align:right">${fmt(row.prime_anciennete)}</td></tr>` : ''}
    ${row.prime_transport > 0 ? `<tr><td>Prime de transport</td><td style="text-align:right">${fmt(row.prime_transport)}</td></tr>` : ''}
    ${row.prime_logement > 0 ? `<tr><td>Prime de logement</td><td style="text-align:right">${fmt(row.prime_logement)}</td></tr>` : ''}
    ${row.prime_rendement > 0 ? `<tr><td>Prime de rendement</td><td style="text-align:right">${fmt(row.prime_rendement)}</td></tr>` : ''}
    ${row.prime_responsabilite > 0 ? `<tr><td>Prime de responsabilité</td><td style="text-align:right">${fmt(row.prime_responsabilite)}</td></tr>` : ''}
    ${row.heures_sup > 0 ? `<tr><td>Heures sup. (${row.heures_sup}h × ${fmt(row.taux_horaire)} ${devise})</td><td style="text-align:right">${fmt(row.heures_sup_montant)}</td></tr>` : ''}
    <tr class="total-row"><td>SALAIRE BRUT</td><td style="text-align:right">${fmt(row.salaire_brut)}</td></tr>
  </tbody></table>
  <table><thead><tr><th>Cotisations & retenues</th><th style="text-align:right">Part salarié</th></tr></thead>
  <tbody>
    <tr><td>${cfg.cnss.acronyme} salarié (${(cnssEmpTaux * 100).toFixed(2)}% plafonné)</td><td style="text-align:right">− ${fmt(row.cnss_employe)}</td></tr>
    <tr><td>${cfg.irpp.nom} (barème progressif)</td><td style="text-align:right">− ${fmt(row.irpp)}</td></tr>
    ${row.mutuelle > 0 ? `<tr><td>Mutuelle</td><td style="text-align:right">− ${fmt(row.mutuelle)}</td></tr>` : ''}
    ${row.acompte > 0 ? `<tr><td>Acompte sur salaire</td><td style="text-align:right">− ${fmt(row.acompte)}</td></tr>` : ''}
    ${row.opposition > 0 ? `<tr><td>Opposition / saisie</td><td style="text-align:right">− ${fmt(row.opposition)}</td></tr>` : ''}
    <tr class="total-row"><td>Total retenues</td><td style="text-align:right">− ${fmt(row.total_retenues)}</td></tr>
  </tbody></table>
  ${irppRows ? `<table><thead><tr><th>Détail ${cfg.irpp.nom.split(' ')[0]} par tranche</th><th style="text-align:right">Base</th><th style="text-align:right">Taux</th><th style="text-align:right">Impôt</th></tr></thead><tbody>${irppRows}</tbody></table>` : ''}
  <div class="net-box">
    <div><div style="font-size:12px;opacity:0.7">NET À PAYER</div></div>
    <div class="amount">${fmt(row.salaire_net)} ${devise}</div>
  </div>
  <p style="font-size:9px;color:#888;margin-bottom:4px">Coût total employeur : ${fmt(row.cout_total_employeur)} ${devise} — ${cfg.cnss.acronyme} patro ${(cnssPatTaux * 100).toFixed(3)}%</p>
  <p style="font-size:9px;color:#888">Bulletin conforme au droit du travail — ${cfg.nom_pays} · ${cfg.systeme_comptable}</p>
  <div class="footer">Généré par oraforme · ${new Date().toLocaleString('fr-FR')} · Conservez ce document pendant 5 ans</div>
</div>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`)
  w.document.close()
}

// ── Modal Détail Bulletin (PME/Grande) ────────────────────────────────────────

function ModalDetailBulletin({
  row, mois, annee, cfg, codePays, onClose, onSave,
}: {
  row: BulletinRow; mois: number; annee: number
  cfg: CountryConfig; codePays: CodePays
  onClose: () => void; onSave: (updates: Partial<BulletinRow>) => void
}) {
  const { t } = useLocale()
  const [el, setEl] = useState({
    heures_sup: row.heures_sup, taux_horaire: row.taux_horaire,
    prime_rendement: row.prime_rendement, prime_transport: row.prime_transport,
    prime_logement: row.prime_logement, prime_responsabilite: row.prime_responsabilite,
    mutuelle: row.mutuelle, acompte: row.acompte,
  })

  const calc = useMemo(() => computeBulletin(
    cfg, codePays,
    { ...el, salaire_base: row.salaire_base, prime_anciennete: row.prime_anciennete,
      indemnite_deplacement: row.indemnite_deplacement, avantages_nature: row.avantages_nature, autres_gains: row.autres_gains,
      opposition: row.opposition, autres_retenues: row.autres_retenues },
    row.situation, row.nb_enfants,
  ), [el, row, cfg, codePays])

  const field = (label: string, key: keyof typeof el, placeholder?: string) => (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-[var(--text-secondary)]">{label}</span>
      <NumInput value={el[key]} onChange={v => setEl(prev => ({ ...prev, [key]: v }))} placeholder={placeholder} />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-bold text-[#101729]">Détail bulletin — {row.prenom} {row.nom}</h2>
            <p className="text-xs text-[var(--text-secondary)]">{row.poste} · {t(MONTH_KEYS[mois])} {annee} · N° {cfg.cnss.acronyme} {row.cnss_num || '—'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-[var(--text-secondary)]"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-xl border border-[var(--border)] p-4">
            <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Éléments variables</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 divide-y divide-[var(--border)]">
              <div className="col-span-2 py-1.5 text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Gains</div>
              <div>
                {field('Heures supp.', 'heures_sup', 'h')}
                {field('Taux horaire', 'taux_horaire', cfg.devise + '/h')}
                {field('Prime de rendement', 'prime_rendement')}
              </div>
              <div>
                {field('Prime de transport', 'prime_transport')}
                {field('Prime de logement', 'prime_logement')}
                {field('Prime de responsabilité', 'prime_responsabilite')}
              </div>
              <div className="col-span-2 pt-3 border-t border-[var(--border)]">
                <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase mb-2">Retenues complémentaires</div>
              </div>
              <div>{field('Mutuelle', 'mutuelle')}</div>
              <div>{field('Acompte sur salaire', 'acompte')}</div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-[var(--border)]">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Élément</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Montant ({cfg.devise})</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--border)]/50"><td className="px-4 py-1.5 text-[var(--text-secondary)]">Salaire de base</td><td className="px-4 py-1.5 text-right">{fmt(row.salaire_base)}</td></tr>
                {calc.prime_anciennete > 0 && <tr className="border-b border-[var(--border)]/50"><td className="px-4 py-1.5 text-[var(--text-secondary)]">Prime ancienneté ({row.annees_anciennete} ans)</td><td className="px-4 py-1.5 text-right">{fmt(calc.prime_anciennete)}</td></tr>}
                {calc.heures_sup_montant > 0 && <tr className="border-b border-[var(--border)]/50"><td className="px-4 py-1.5 text-[var(--text-secondary)]">Heures sup. ({el.heures_sup}h × {fmt(el.taux_horaire)})</td><td className="px-4 py-1.5 text-right">{fmt(calc.heures_sup_montant)}</td></tr>}
                {calc.prime_transport > 0 && <tr className="border-b border-[var(--border)]/50"><td className="px-4 py-1.5 text-[var(--text-secondary)]">Prime transport</td><td className="px-4 py-1.5 text-right">{fmt(calc.prime_transport)}</td></tr>}
                {calc.prime_logement > 0 && <tr className="border-b border-[var(--border)]/50"><td className="px-4 py-1.5 text-[var(--text-secondary)]">Prime logement</td><td className="px-4 py-1.5 text-right">{fmt(calc.prime_logement)}</td></tr>}
                {calc.prime_rendement > 0 && <tr className="border-b border-[var(--border)]/50"><td className="px-4 py-1.5 text-[var(--text-secondary)]">Prime rendement</td><td className="px-4 py-1.5 text-right">{fmt(calc.prime_rendement)}</td></tr>}
                <tr className="border-b border-[var(--border)] bg-gray-50"><td className="px-4 py-2 font-bold text-[#101729]">SALAIRE BRUT</td><td className="px-4 py-2 font-bold text-right text-[#101729]">{fmt(calc.salaire_brut)}</td></tr>
                <tr className="border-b border-[var(--border)]/50"><td className="px-4 py-1.5 text-[#DC2626]">{cfg.cnss.acronyme} salarié ({(cfg.cnss.branches.find(b => b.taux_salarie > 0)?.taux_salarie ?? 0) * 100}%)</td><td className="px-4 py-1.5 text-right text-[#DC2626]">− {fmt(calc.cnss_employe)}</td></tr>
                <tr className="border-b border-[var(--border)]/50"><td className="px-4 py-1.5 text-[#DC2626]">{cfg.irpp.nom}</td><td className="px-4 py-1.5 text-right text-[#DC2626]">− {fmt(calc.irpp)}</td></tr>
                {calc.mutuelle > 0 && <tr className="border-b border-[var(--border)]/50"><td className="px-4 py-1.5 text-[#DC2626]">Mutuelle</td><td className="px-4 py-1.5 text-right text-[#DC2626]">− {fmt(calc.mutuelle)}</td></tr>}
                {calc.acompte > 0 && <tr className="border-b border-[var(--border)]/50"><td className="px-4 py-1.5 text-[#DC2626]">Acompte</td><td className="px-4 py-1.5 text-right text-[#DC2626]">− {fmt(calc.acompte)}</td></tr>}
                <tr className="border-b border-[var(--border)] bg-[#16A34A]/5">
                  <td className="px-4 py-2.5 font-bold text-[#16A34A]">NET À PAYER</td>
                  <td className="px-4 py-2.5 font-bold text-right text-[#16A34A] text-base">{fmt(calc.salaire_net)} {cfg.devise}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {calc.irpp_detail.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Détail {cfg.irpp.nom.split(' ')[0]} par tranche</p>
              <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[var(--border)]">
                      {['Tranche', 'Base', 'Taux', 'Impôt'].map(h => (
                        <th key={h} className="px-3 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase text-right first:text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calc.irpp_detail.map((d, i) => (
                      <tr key={i} className="border-b border-[var(--border)]/50">
                        <td className="px-3 py-1.5 text-[var(--text-secondary)]">{d.label}</td>
                        <td className="px-3 py-1.5 text-right">{fmt(d.base)}</td>
                        <td className="px-3 py-1.5 text-right">{d.taux}%</td>
                        <td className="px-3 py-1.5 text-right font-medium">{fmt(d.montant)}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50">
                      <td className="px-3 py-2 font-bold text-[#101729]" colSpan={3}>Total {cfg.irpp.nom.split(' ')[0]}</td>
                      <td className="px-3 py-2 font-bold text-right text-[#DC2626]">{fmt(calc.irpp)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border)] bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-gray-200 transition-colors">Annuler</button>
          <button onClick={() => { onSave({ heures_sup: el.heures_sup, taux_horaire: el.taux_horaire, ...calc }); onClose() }}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors" style={{ background: '#F59E0B' }}>
            <Check size={14} className="inline mr-1" /> Appliquer
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Modal Lancer la paie ───────────────────────────────────────────────────────

function ModalLancerPaie({
  rows, mois, annee, saving, cfg, onClose, onConfirm,
}: {
  rows: BulletinRow[]; mois: number; annee: number; saving: boolean
  cfg: CountryConfig
  onClose: () => void; onConfirm: () => void
}) {
  const { t } = useLocale()
  const totalBrut  = rows.reduce((s, r) => s + r.salaire_brut, 0)
  const totalNet   = rows.reduce((s, r) => s + r.salaire_net, 0)
  const totalPatro = rows.reduce((s, r) => s + r.cnss_patronal + r.tus_patronal + r.medecine_travail, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-bold text-[#101729]">Lancer la paie — {t(MONTH_KEYS[mois])} {annee}</h2>
            <p className="text-xs text-[var(--text-secondary)]">{rows.length} bulletin{rows.length > 1 ? 's' : ''} à générer</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Masse brute', value: fmt(totalBrut), color: '#101729' },
              { label: 'Net total', value: fmt(totalNet), color: '#16A34A' },
              { label: 'Charges patro.', value: fmt(totalPatro), color: '#DC2626' },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-[10px] text-[var(--text-secondary)] mb-1">{k.label}</p>
                <p className="font-bold text-sm" style={{ color: k.color }}>{k.value}</p>
                <p className="text-[9px] text-[var(--text-secondary)]">{cfg.devise}</p>
              </div>
            ))}
          </div>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Employé</th>
                  <th className="text-right px-3 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Brut</th>
                  <th className="text-right px-3 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Net</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.employe_id} className="border-b border-[var(--border)]/50">
                    <td className="px-3 py-1.5">
                      <span className="font-medium text-[#101729]">{r.prenom} {r.nom}</span>
                      <span className="text-[10px] text-[var(--text-secondary)] ml-1">· {r.poste}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right text-[var(--text-secondary)]">{fmt(r.salaire_brut)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-[#16A34A]">{fmt(r.salaire_net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-start gap-2 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl px-4 py-3">
            <AlertTriangle size={14} className="text-[#F59E0B] shrink-0 mt-0.5" />
            <p className="text-xs text-[#D97706]">
              Les bulletins seront générés avec le statut <strong>Générée</strong>. Vous pourrez les valider et marquer comme payés ensuite.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border)] bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-gray-200 transition-colors">Annuler</button>
          <button onClick={onConfirm} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
            style={{ background: '#DC2626' }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {saving ? 'Génération...' : 'Confirmer & générer'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Carte employé mobile ───────────────────────────────────────────────────────

function EmployeeCard({
  row, mois, annee, plan, cfg, codePays, onDetailOpen, onPrint, onDownloadPdf, onStatutChange,
}: {
  row: BulletinRow; mois: number; annee: number; plan: Plan
  cfg: CountryConfig; codePays: CodePays
  onDetailOpen: () => void
  onPrint: () => void
  onDownloadPdf: () => void
  onStatutChange: (s: BulletinRow['statut']) => void
}) {
  const [open, setOpen] = useState(false)
  const statutColor = row.statut === 'payee' ? '#16A34A' : row.statut === 'validee' ? '#2563EB' : row.statut === 'generee' ? '#D97706' : '#6B7280'

  return (
    <div className="border border-[var(--border)] rounded-xl bg-white overflow-hidden">
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setOpen(v => !v)}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 text-white"
          style={{ background: `hsl(${row.nom.charCodeAt(0) * 7 % 360}, 55%, 38%)` }}>
          {(row.prenom?.[0] ?? row.nom[0]).toUpperCase()}{row.nom[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#101729] truncate">{row.prenom} {row.nom}</p>
          <p className="text-[11px] text-[var(--text-secondary)] truncate">{row.poste}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-[#16A34A]">{fmt(row.salaire_net)}</p>
          <p className="text-[10px] text-[var(--text-secondary)]">{cfg.devise} net</p>
        </div>
        <button className="p-1 text-[var(--text-secondary)]">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-[var(--border)]">
            <div className="p-3 space-y-3">
              {/* Détail paie */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Salaire de base', val: row.salaire_base, color: '' },
                  { label: 'Salaire brut', val: row.salaire_brut, color: 'font-semibold' },
                  { label: `${cfg.cnss.acronyme} salarié`, val: -row.cnss_employe, color: 'text-red-500' },
                  { label: cfg.irpp.nom.split(' ')[0], val: -row.irpp, color: 'text-red-500' },
                  { label: 'Acompte', val: row.acompte > 0 ? -row.acompte : 0, color: 'text-amber-600' },
                  { label: 'Net à payer', val: row.salaire_net, color: 'text-green-700 font-bold' },
                ].map(k => (
                  <div key={k.label} className="bg-gray-50 rounded-lg p-2">
                    <p className="text-[10px] text-[var(--text-secondary)]">{k.label}</p>
                    <p className={`text-xs ${k.color}`}>
                      {k.val < 0 ? '−' : ''}{fmt(Math.abs(k.val))} {cfg.devise}
                    </p>
                  </div>
                ))}
              </div>

              {/* Statut + actions */}
              <div className="flex flex-wrap items-center gap-2">
                <select value={row.statut} onChange={e => onStatutChange(e.target.value as BulletinRow['statut'])}
                  className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-[var(--border)] focus:outline-none bg-white"
                  style={{ color: statutColor }}>
                  <option value="brouillon">Brouillon</option>
                  <option value="generee">Générée</option>
                  <option value="validee">Validée</option>
                  <option value="payee">Payée</option>
                </select>
                <button onClick={onPrint}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-50">
                  <Printer size={11} /> Imprimer
                </button>
                {plan !== 'tpe' && (
                  <button onClick={onDetailOpen}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] bg-amber-50 text-amber-700 border border-amber-200">
                    <Eye size={11} /> Détail
                  </button>
                )}
                {plan !== 'tpe' && row.existingId && (
                  <button onClick={onDownloadPdf}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] bg-red-50 text-red-600 border border-red-200">
                    <Download size={11} /> PDF
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function PaiePage() {
  const { tenantId, taille, pays: tenantPays, loading: loadingTenant } = useTenant()
  const { t } = useLocale()
  const plan = planFrom(taille)

  // ── Config pays ──────────────────────────────────────────────────────────────
  const codePays = useMemo<CodePays>(() => (tenantPays ?? 'CG') as CodePays, [tenantPays])
  const cfg = useMemo(() => getCountryConfig(codePays), [codePays])

  const confidenceCls = cfg.data_confidence === 'verified'
    ? 'bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30'
    : cfg.data_confidence === 'to_verify'
    ? 'bg-[#F59E0B]/10 text-[#D97706] border-[#F59E0B]/30'
    : 'bg-gray-100 text-gray-500 border-gray-200'
  const confidenceLabel = cfg.data_confidence === 'verified' ? '✓ vérifié' : cfg.data_confidence === 'to_verify' ? '⚠ à vérifier' : '~ estimé'

  const now = new Date()
  const [mois,  setMois]  = useState(now.getMonth() + 1)
  const [annee, setAnnee] = useState(now.getFullYear())

  const [rows,         setRows]         = useState<BulletinRow[]>([])
  const [loading,      setLoading]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [entreprise,   setEntreprise]   = useState('Mon Entreprise')
  const [acomptesList, setAcomptesList] = useState<AcompteLine[]>([])
  const [showLancerModal, setShowLancerModal] = useState(false)
  const [detailRow,   setDetailRow]     = useState<BulletinRow | null>(null)
  const [aEmployeId,  setAEmployeId]    = useState('')
  const [aMontant,    setAMontant]      = useState(0)
  const [aNotes,      setANotes]        = useState('')
  const [addingAcompte, setAddingAcompte] = useState(false)
  const [showAcompteForm, setShowAcompteForm] = useState(false)
  const [showCharges, setShowCharges]   = useState(true)

  // ── Chargement ───────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    const [
      { data: emps, error: empsErr },
      { data: buls, error: bulsErr },
      { data: tenant },
      { data: acomptes },
    ] = await Promise.all([
      supabase.from('employes')
        .select('id,nom,prenom,poste,type_employe,salaire_base,numero_cnss,statut,date_recrutement,situation_matrimoniale,nb_enfants,prime_transport,prime_logement,prime_rendement,taux_horaire')
        .eq('tenant_id', tenantId).eq('statut', 'actif').order('nom'),
      supabase.from('bulletins_paie')
        .select('*').eq('tenant_id', tenantId).eq('mois', mois).eq('annee', annee),
      supabase.from('tenants')
        .select('nom_entreprise').eq('id', tenantId).limit(1).maybeSingle(),
      supabase.from('acomptes_salaires')
        .select('id,employe_id,montant,date_acompte,notes,statut')
        .eq('tenant_id', tenantId).eq('annee_imputee', annee).eq('mois_impute', mois),
    ])

    captureSupabaseError('load employes paie', empsErr, { module: 'rh/paie', tenant_id: tenantId })
    captureSupabaseError('load bulletins_paie', bulsErr, { module: 'rh/paie', tenant_id: tenantId })

    if (tenant?.nom_entreprise) setEntreprise(tenant.nom_entreprise)

    const empList = emps ?? []
    const bulMap = new Map((buls ?? []).map((b: Record<string, unknown>) => [b.employe_id as string, b]))

    const acompteMap = new Map<string, number>()
    const acompteRows: AcompteLine[] = []
    for (const a of (acomptes ?? []) as AcompteLine[]) {
      if ((a as unknown as { statut: string }).statut === 'en_attente') {
        acompteMap.set(a.employe_id, (acompteMap.get(a.employe_id) || 0) + a.montant)
      }
      const emp = empList.find((e: Record<string, unknown>) => e.id === a.employe_id)
      acompteRows.push({ ...a, employe_nom: (emp as Record<string, string>)?.nom ?? '' })
    }
    setAcomptesList(acompteRows)

    setRows(empList.map((e: Record<string, unknown>) => {
      const annees = e.date_recrutement
        ? Math.floor((Date.now() - new Date(e.date_recrutement as string).getTime()) / (365.25 * 24 * 3600 * 1000))
        : 0
      const acompteTotal = acompteMap.get(e.id as string) || 0
      const existing = bulMap.get(e.id as string) as Record<string, unknown> | undefined
      const sit: SituationFamiliale = (e.situation_matrimoniale as SituationFamiliale) ?? 'celibataire'
      const nbEnf = (e.nb_enfants as number) ?? 0
      const base = e.salaire_base as number
      const pa = calcPrimeAnciennete(base, annees)

      if (existing) {
        const res = computeBulletin(cfg, codePays, {
          salaire_base: (existing.salaire_base as number) ?? base,
          heures_sup: (existing.heures_sup as number) || 0,
          taux_horaire: (existing.taux_horaire as number) || 0,
          prime_rendement: (existing.prime_rendement as number) || 0,
          prime_anciennete: (existing.prime_anciennete as number) || pa,
          prime_transport: (existing.prime_transport as number) || (e.prime_transport as number) || 0,
          prime_logement: (existing.prime_logement as number) || (e.prime_logement as number) || 0,
          prime_responsabilite: (existing.prime_responsabilite as number) || 0,
          indemnite_deplacement: (existing.indemnite_deplacement as number) || 0,
          avantages_nature: (existing.avantages_nature as number) || 0,
          autres_gains: (existing.autres_gains as number) || 0,
          mutuelle: (existing.mutuelle as number) || 0,
          acompte: (existing.acompte as number) || acompteTotal,
          opposition: (existing.opposition as number) || 0,
          autres_retenues: (existing.autres_retenues as number) || 0,
        }, sit, nbEnf)
        return {
          employe_id: e.id as string, nom: e.nom as string, prenom: (e.prenom as string) ?? '',
          poste: e.poste as string, type_employe: (e.type_employe as string) ?? '',
          cnss_num: (e.numero_cnss as string) ?? '', situation: sit, nb_enfants: nbEnf,
          annees_anciennete: annees, existingId: existing.id as string,
          statut: (existing.statut as BulletinRow['statut']) ?? 'generee',
          heures_sup: (existing.heures_sup as number) || 0,
          taux_horaire: (existing.taux_horaire as number) || (e.taux_horaire as number) || 0,
          salaire_base: (existing.salaire_base as number) ?? base,
          ...res,
        }
      }

      const res = computeBulletin(cfg, codePays, {
        salaire_base: base, prime_anciennete: pa, acompte: acompteTotal,
        prime_transport: (e.prime_transport as number) || 0,
        prime_logement: (e.prime_logement as number) || 0,
        prime_rendement: (e.prime_rendement as number) || 0,
        taux_horaire: (e.taux_horaire as number) || 0,
      }, sit, nbEnf)

      return {
        employe_id: e.id as string, nom: e.nom as string, prenom: (e.prenom as string) ?? '',
        poste: e.poste as string, type_employe: (e.type_employe as string) ?? '',
        cnss_num: (e.numero_cnss as string) ?? '', situation: sit, nb_enfants: nbEnf,
        annees_anciennete: annees, statut: 'brouillon' as const,
        heures_sup: 0, taux_horaire: (e.taux_horaire as number) || 0,
        salaire_base: base,
        ...res,
      }
    }))

    setLoading(false)
  }, [tenantId, mois, annee, cfg, codePays])

  useEffect(() => { load() }, [load])

  // ── Mise à jour d'une ligne ──────────────────────────────────────────────────

  function updateRow(id: string, updates: Partial<Pick<BulletinRow, 'heures_sup' | 'taux_horaire'>>) {
    setRows(prev => prev.map(r => {
      if (r.employe_id !== id) return r
      const next = { ...r, ...updates }
      const res = computeBulletin(cfg, codePays, {
        salaire_base: next.salaire_base, heures_sup: next.heures_sup,
        taux_horaire: next.taux_horaire, prime_rendement: next.prime_rendement,
        prime_anciennete: next.prime_anciennete, prime_transport: next.prime_transport,
        prime_logement: next.prime_logement, prime_responsabilite: next.prime_responsabilite,
        indemnite_deplacement: next.indemnite_deplacement, avantages_nature: next.avantages_nature,
        mutuelle: next.mutuelle, acompte: next.acompte, opposition: next.opposition,
        autres_retenues: next.autres_retenues,
      }, next.situation, next.nb_enfants)
      return { ...next, ...res }
    }))
  }

  function applyDetailUpdates(id: string, updates: Partial<BulletinRow>) {
    setRows(prev => prev.map(r => r.employe_id === id ? { ...r, ...updates } : r))
  }

  function updateStatut(id: string, statut: BulletinRow['statut']) {
    setRows(prev => prev.map(r => r.employe_id === id ? { ...r, statut } : r))
  }

  // ── Sauvegarde / génération ──────────────────────────────────────────────────

  async function sauvegarderPaie(forceStatut?: BulletinRow['statut']) {
    if (!tenantId) return
    setSaving(true)

    const toUpsert = rows.map(r => ({
      tenant_id: tenantId, employe_id: r.employe_id, mois, annee,
      salaire_base: r.salaire_base, heures_sup: r.heures_sup, taux_horaire: r.taux_horaire,
      prime_rendement: r.prime_rendement, prime_anciennete: r.prime_anciennete,
      prime_transport: r.prime_transport, prime_logement: r.prime_logement,
      prime_responsabilite: r.prime_responsabilite, indemnite_deplacement: r.indemnite_deplacement,
      avantages_nature: r.avantages_nature, autres_gains: r.autres_gains,
      brut: r.salaire_brut, cnss_salarie: r.cnss_employe,
      cnss_patronal: r.cnss_patronal, irpp: r.irpp, net: r.salaire_net,
      mutuelle: r.mutuelle, acompte: r.acompte, opposition: r.opposition,
      autres_retenues: r.autres_retenues, total_retenues: r.total_retenues,
      tus_patronal: r.tus_patronal, medecine_travail: r.medecine_travail,
      cout_total_employeur: r.cout_total_employeur,
      statut: forceStatut ?? r.statut, genere_par: 'paie_module',
    }))

    const { error } = await supabase.from('bulletins_paie')
      .upsert(toUpsert, { onConflict: 'employe_id,mois,annee' })

    if (error) {
      captureSupabaseError('upsert bulletins_paie', error, { module: 'rh/paie', tenant_id: tenantId })
      setSaving(false)
      return
    }

    // Sync trésorerie (PME/Grande seulement)
    if (plan !== 'tpe') {
      const statutFinal = forceStatut ?? null
      const payees = rows.filter(r => (statutFinal ?? r.statut) === 'payee')
      if (payees.length > 0) {
        const sourceIds = payees.map(r => `bulletin_${r.employe_id}_${mois}_${annee}`)
        const { data: existing } = await supabase.from('transactions').select('source_id')
          .eq('tenant_id', tenantId).eq('source', 'bulletin_paie').in('source_id', sourceIds)
        const existingSet = new Set((existing ?? []).map((e: { source_id: string }) => e.source_id))
        const toInsert = payees
          .filter(r => !existingSet.has(`bulletin_${r.employe_id}_${mois}_${annee}`))
          .map(r => ({
            tenant_id: tenantId, type: 'sortie', categorie: 'Salaires & CNSS',
            description: `Paie ${r.prenom} ${r.nom} — ${String(mois).padStart(2, '0')}/${annee}`,
            montant: r.salaire_net,
            date: new Date(annee, mois - 1, 28).toISOString().split('T')[0],
            mode_paiement: 'virement', source: 'bulletin_paie',
            source_id: `bulletin_${r.employe_id}_${mois}_${annee}`,
          }))
        if (toInsert.length > 0) {
          const { error: errTx } = await supabase.from('transactions').insert(toInsert)
          if (errTx) captureSupabaseError('insert transactions from paie', errTx, { module: 'rh/paie', tenant_id: tenantId })
        }

        // Écritures SYSCOHADA (PME/Grande uniquement)
        const totalNet  = payees.reduce((s, r) => s + r.salaire_net, 0)
        const totalCnssP = payees.reduce((s, r) => s + r.cnss_patronal + r.tus_patronal, 0)
        const dateEcr = new Date(annee, mois - 1, 28).toISOString().split('T')[0]
        const libelle = `Paie ${MOIS_LABELS[mois]} ${annee} — ${payees.length} employé(s)`
        await supabase.from('mouvements_comptables').upsert([
          { tenant_id: tenantId, date: dateEcr, compte_debit: '661', compte_credit: '422', montant: totalNet, libelle, source: 'paie', source_id: `paie_661_${mois}_${annee}` },
          { tenant_id: tenantId, date: dateEcr, compte_debit: '664', compte_credit: '431', montant: totalCnssP, libelle: `Charges patronales ${MOIS_LABELS[mois]} ${annee}`, source: 'paie', source_id: `paie_664_${mois}_${annee}` },
        ], { onConflict: 'source_id' }).then(() => null, () => null)
      }
    }

    setSaving(false); setSaved(true); setShowLancerModal(false)
    setTimeout(() => setSaved(false), 2500)
    load()
  }

  // ── Ajouter acompte ──────────────────────────────────────────────────────────

  async function ajouterAcompte() {
    if (!tenantId || !aEmployeId || aMontant <= 0) return
    setAddingAcompte(true)
    const { error } = await supabase.from('acomptes_salaires').insert({
      tenant_id: tenantId, employe_id: aEmployeId, montant: aMontant,
      date_acompte: new Date().toISOString().split('T')[0],
      mois_impute: mois, annee_imputee: annee, statut: 'en_attente', notes: aNotes || null,
    })
    if (error) captureSupabaseError('insert acompte', error, { module: 'rh/paie', tenant_id: tenantId })
    setAddingAcompte(false)
    setAEmployeId(''); setAMontant(0); setANotes(''); setShowAcompteForm(false)
    load()
  }

  // ── Téléchargement PDF ───────────────────────────────────────────────────────

  async function downloadPdf(row: BulletinRow) {
    if (!row.existingId) return
    const res = await fetch(`/api/rh/paie/${row.existingId}/bulletin-pdf`)
    if (!res.ok) return
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `bulletin-${row.nom}-${MOIS_LABELS[mois]}-${annee}.pdf`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  function prevMois() { if (mois === 1) { setMois(12); setAnnee(a => a - 1) } else setMois(m => m - 1) }
  function nextMois() {
    const today = new Date()
    if (annee > today.getFullYear() || (annee === today.getFullYear() && mois >= today.getMonth() + 1)) return
    if (mois === 12) { setMois(1); setAnnee(a => a + 1) } else setMois(m => m + 1)
  }

  // ── Totaux ───────────────────────────────────────────────────────────────────

  const totalBrut    = rows.reduce((s, r) => s + r.salaire_brut, 0)
  const totalNet     = rows.reduce((s, r) => s + r.salaire_net, 0)
  const totalIRPP    = rows.reduce((s, r) => s + r.irpp, 0)
  const totalCnssEmp = rows.reduce((s, r) => s + r.cnss_employe, 0)
  const totalCnssP   = rows.reduce((s, r) => s + r.cnss_patronal, 0)
  const totalTus     = rows.reduce((s, r) => s + r.tus_patronal, 0)
  const totalMed     = rows.reduce((s, r) => s + r.medecine_travail, 0)
  const totalCout    = rows.reduce((s, r) => s + r.cout_total_employeur, 0)

  const isCurrentMonth  = mois === now.getMonth() + 1 && annee === now.getFullYear()
  const notYetGenerated = rows.length > 0 && rows.every(r => !r.existingId)

  // ── Charges patronales breakdown (depuis CountryConfig) ───────────────────

  const chargesBreakdown = useMemo(() => {
    const branches = cfg.cnss.branches.filter(b => b.taux_patronal > 0)
    const totalTaux = branches.reduce((s, b) => s + b.taux_patronal, 0)
    return { branches, totalTaux }
  }, [cfg])

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loadingTenant) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">
        <Loader2 className="animate-spin mr-2" size={18} /> Chargement…
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-[#101729]">Gestion de la paie</h1>
            <PlanBadge plan={plan} />
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-2 flex-wrap">
            <span>
              {cfg.nom_pays} · {cfg.cnss.acronyme} salarié {(cfg.cnss.branches.find(b => b.taux_salarie > 0)?.taux_salarie ?? 0) * 100}% ·
              {cfg.irpp.tranches.length} tranches {cfg.irpp.nom.split(' ')[0]} · SMIG {fmtNum(cfg.smig)} {cfg.devise}
            </span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${confidenceCls}`}>
              {confidenceLabel}
            </span>
          </p>
        </div>

        {/* Sélecteur de période */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={prevMois} className="p-1.5 rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729]">
            <ChevronLeft size={14} />
          </button>
          <div className="flex items-center gap-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5">
            <Calendar size={13} className="text-[#DC2626]" />
            <select value={mois} onChange={e => setMois(Number(e.target.value))}
              className="bg-transparent text-[#101729] text-sm font-medium focus:outline-none cursor-pointer">
              {MONTH_KEYS.slice(1).map((k, i) => <option key={i + 1} value={i + 1}>{t(k)}</option>)}
            </select>
            <select value={annee} onChange={e => setAnnee(Number(e.target.value))}
              className="bg-transparent text-[#101729] text-sm font-medium focus:outline-none cursor-pointer">
              {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={nextMois} className="p-1.5 rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729]">
            <ChevronRight size={14} />
          </button>
          <button onClick={load} className="p-1.5 rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729]">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── Mesures spéciales (depuis CountryConfig) ─────────────────────── */}
      {cfg.irpp.mesures_speciales?.some(m => m.actif) && (
        <div className="flex items-start gap-3 bg-[#16A34A]/10 border border-[#16A34A]/30 rounded-xl px-4 py-3">
          <span className="text-base shrink-0 mt-0.5">🎁</span>
          <div>
            <p className="text-sm font-semibold text-[#16A34A]">Mesure Exceptionnelle — {cfg.irpp.source}</p>
            <p className="text-xs text-[#15803D] mt-0.5">
              {cfg.irpp.mesures_speciales.filter(m => m.actif).map(m => m.description).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Banner info LF (toujours visible pour CG) */}
      {cfg.cnss.mesures_speciales && cfg.cnss.mesures_speciales.length > 0 && (
        <div className="flex items-start gap-3 bg-[#2563EB]/8 border border-[#2563EB]/20 rounded-xl px-4 py-3">
          <Zap size={15} className="text-[#2563EB] shrink-0 mt-0.5" />
          <p className="text-xs text-[#1D4ED8]">
            <strong>{cfg.cnss.source}</strong> — {cfg.cnss.mesures_speciales.map(m => m.description).join(' · ')}
          </p>
        </div>
      )}

      {/* ── Alerte paie non générée ───────────────────────────────────────── */}
      <AnimatePresence>
        {isCurrentMonth && notYetGenerated && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex items-center gap-3 bg-[#D97706]/10 border border-[#D97706]/30 rounded-xl px-4 py-3">
              <AlertTriangle size={15} className="text-[#D97706] shrink-0" />
              <p className="text-sm text-[#D97706]">
                La paie de <strong>{t(MONTH_KEYS[mois])} {annee}</strong> n&apos;a pas encore été générée.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── KPI ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Masse salariale brute"
          value={`${fmt(totalBrut)} ${cfg.devise}`}
          sub={`${rows.length} employé(s) actif(s)`}
          color="#DC2626" icon={DollarSign} />
        <KpiCard label="Net total à payer"
          value={`${fmt(totalNet)} ${cfg.devise}`}
          sub={`Retenues : ${fmt(totalBrut - totalNet)} ${cfg.devise}`}
          color="#16A34A" icon={TrendingUp} />
        <KpiCard label={`${cfg.cnss.acronyme} salarié`}
          value={`${fmt(totalCnssEmp)} ${cfg.devise}`}
          sub={`Taux ${(cfg.cnss.branches.find(b => b.taux_salarie > 0)?.taux_salarie ?? 0) * 100}% plafonné`}
          color="#2563EB" icon={Building2} />
        <KpiCard label="Coût total employeur"
          value={`${fmt(totalCout)} ${cfg.devise}`}
          sub={`${cfg.irpp.nom.split(' ')[0]} total : ${fmt(totalIRPP)} ${cfg.devise}`}
          color="#7C3AED" icon={Users} />
      </div>

      {/* ── Barre d'actions ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--text-secondary)]">
          {rows.filter(r => r.statut === 'payee').length} payé(s) ·{' '}
          {rows.filter(r => r.statut === 'validee').length} validé(s) ·{' '}
          {rows.filter(r => r.statut === 'generee').length} générée(s)
        </p>
        <div className="flex items-center gap-2">
          <motion.button onClick={() => sauvegarderPaie()} disabled={saving || rows.length === 0}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-100 disabled:opacity-50 transition-all">
            {saved ? <Check size={14} className="text-[#16A34A]" /> : <FileText size={14} />}
            {saved ? 'Sauvegardé !' : 'Sauvegarder'}
          </motion.button>
          <motion.button onClick={() => setShowLancerModal(true)} disabled={rows.length === 0}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: '#DC2626', boxShadow: '0 0 20px #DC262630' }}>
            <Play size={14} />
            <span className="hidden sm:inline">Lancer la paie —</span> {t(MONTH_KEYS[mois])} {annee}
          </motion.button>
        </div>
      </div>

      {/* ── Tableau desktop ── Mobile cards ─────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-[var(--text-secondary)]">
          <Loader2 className="animate-spin mr-2" size={16} /> Chargement…
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-secondary)]">
          <Users size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucun employé actif trouvé pour cette période.</p>
          <p className="text-xs mt-1 opacity-70">Vérifiez que les employés ont le statut <code>actif</code>.</p>
        </div>
      ) : (
        <>
          {/* ── Mobile : cards ────────────────────────────────────────────── */}
          <div className="md:hidden space-y-2">
            {rows.map(row => (
              <EmployeeCard
                key={row.employe_id}
                row={row} mois={mois} annee={annee} plan={plan} cfg={cfg} codePays={codePays}
                onDetailOpen={() => setDetailRow(row)}
                onPrint={() => printBulletin(row, mois, annee, entreprise, cfg)}
                onDownloadPdf={() => downloadPdf(row)}
                onStatutChange={s => updateStatut(row.employe_id, s)}
              />
            ))}
          </div>

          {/* ── Desktop : table ───────────────────────────────────────────── */}
          <div className="hidden md:block rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-gray-50">
                    {[
                      'Employé', 'Base',
                      ...(plan !== 'tpe' ? ['H.sup'] : []),
                      'Brut',
                      `${cfg.cnss.acronyme}`,
                      cfg.irpp.nom.split(' ')[0],
                      'Acompte', 'Net', 'Statut', 'Actions',
                    ].map(h => (
                      <th key={h} className="px-3 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-left first:px-4 last:text-center whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <motion.tr key={row.employe_id}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.3 }}
                      className="border-b border-[var(--border)] hover:bg-gray-50 transition-colors">

                      {/* Employé */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 text-white"
                            style={{ background: `hsl(${row.nom.charCodeAt(0) * 7 % 360}, 55%, 38%)` }}>
                            {(row.prenom?.[0] ?? row.nom[0]).toUpperCase()}{row.nom[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-medium leading-tight text-[#101729]">{row.prenom} {row.nom}</p>
                            <p className="text-[10px] text-[var(--text-secondary)]">{row.poste}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3 text-right text-xs text-[var(--text-secondary)] whitespace-nowrap">{fmt(row.salaire_base)}</td>

                      {plan !== 'tpe' && (
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <NumInput value={row.heures_sup} onChange={v => updateRow(row.employe_id, { heures_sup: v })} disabled={row.statut === 'payee'} />
                            <span className="text-[10px] text-[var(--text-secondary)]">h</span>
                          </div>
                        </td>
                      )}

                      <td className="px-3 py-3 text-right text-xs font-semibold text-[#101729] whitespace-nowrap">{fmt(row.salaire_brut)}</td>
                      <td className="px-3 py-3 text-right text-xs text-[#DC2626] whitespace-nowrap">−{fmt(row.cnss_employe)}</td>
                      <td className="px-3 py-3 text-right text-xs text-[#DC2626] whitespace-nowrap">−{fmt(row.irpp)}</td>
                      <td className="px-3 py-3 text-right text-xs text-[#D97706] whitespace-nowrap">{row.acompte > 0 ? `−${fmt(row.acompte)}` : '—'}</td>
                      <td className="px-3 py-3 text-right text-xs font-bold text-[#16A34A] whitespace-nowrap">{fmt(row.salaire_net)}</td>

                      <td className="px-3 py-3 text-center">
                        <select value={row.statut} onChange={e => updateStatut(row.employe_id, e.target.value as BulletinRow['statut'])}
                          className="bg-transparent text-[10px] focus:outline-none cursor-pointer font-semibold"
                          style={{ color: row.statut === 'payee' ? '#16A34A' : row.statut === 'validee' ? '#2563EB' : row.statut === 'generee' ? '#D97706' : '#6B7280' }}>
                          <option value="brouillon">Brouillon</option>
                          <option value="generee">Générée</option>
                          <option value="validee">Validée</option>
                          <option value="payee">Payée</option>
                        </select>
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {plan !== 'tpe' && (
                            <button onClick={() => setDetailRow(row)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 text-[#D97706] border border-[#F59E0B]/20">
                              <Eye size={10} /> Détail
                            </button>
                          )}
                          <button onClick={() => printBulletin(row, mois, annee, entreprise, cfg)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-[var(--surface)] hover:bg-gray-200 text-[var(--text-secondary)] border border-[var(--border)]">
                            <Printer size={10} /> Print
                          </button>
                          {plan !== 'tpe' && row.existingId && (
                            <button onClick={() => downloadPdf(row)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#DC2626] border border-[#DC2626]/20">
                              <Download size={10} /> PDF
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-[var(--border)]">
                    <td className="px-4 py-3 text-xs font-bold text-[#101729]">TOTAUX ({rows.length})</td>
                    <td className="px-3 py-3 text-right text-xs font-semibold text-[var(--text-secondary)]">{fmt(rows.reduce((s, r) => s + r.salaire_base, 0))}</td>
                    {plan !== 'tpe' && <td />}
                    <td className="px-3 py-3 text-right text-xs font-bold text-[#101729]">{fmt(totalBrut)}</td>
                    <td className="px-3 py-3 text-right text-xs font-bold text-[#DC2626]">−{fmt(totalCnssEmp)}</td>
                    <td className="px-3 py-3 text-right text-xs font-bold text-[#DC2626]">−{fmt(totalIRPP)}</td>
                    <td className="px-3 py-3 text-right text-xs font-bold text-[#D97706]">−{fmt(rows.reduce((s, r) => s + r.acompte, 0))}</td>
                    <td className="px-3 py-3 text-right text-xs font-bold text-[#16A34A]">{fmt(totalNet)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Charges patronales (PME/Grande seulement) ────────────────────── */}
      {plan !== 'tpe' && rows.length > 0 && (
        <div>
          <button onClick={() => setShowCharges(v => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[#101729] mb-2 transition-colors">
            {showCharges ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Récapitulatif charges patronales & synthèse
          </button>
          <AnimatePresence>
            {showCharges && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tableau charges */}
                  <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-[var(--border)]">
                      <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Charges patronales</p>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)]/50">
                          <th className="text-left px-4 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Charge</th>
                          <th className="text-right px-4 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Taux</th>
                          <th className="text-right px-4 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chargesBreakdown.branches.map(b => {
                          const isAccumulatedRows = rows.reduce((s, r) => {
                            const branchCalcRes = calculerChargesSociales({ codePays, salaireBrut: r.salaire_brut })
                            const found = branchCalcRes.branches.find(rb => rb.code === b.code)
                            return s + (found?.montant_patronal ?? 0)
                          }, 0)
                          const color = b.code === 'TUS' ? '#D97706' : '#DC2626'
                          return (
                            <tr key={b.code} className="border-b border-[var(--border)]/50">
                              <td className="px-4 py-2" style={{ color }}>{b.libelle}</td>
                              <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{(b.taux_patronal * 100).toFixed(3)}%{b.plafond_mensuel ? ` (pl. ${fmt(b.plafond_mensuel)})` : ''}</td>
                              <td className="px-4 py-2 text-right font-semibold" style={{ color }}>{fmt(isAccumulatedRows)}</td>
                            </tr>
                          )
                        })}
                        <tr className="border-b border-[var(--border)] bg-gray-50">
                          <td className="px-4 py-2 font-bold text-[#101729]">Total charges patronales</td>
                          <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{(chargesBreakdown.totalTaux * 100).toFixed(3)}%</td>
                          <td className="px-4 py-2 text-right font-bold text-[#DC2626]">{fmt(totalCnssP + totalTus + totalMed)}</td>
                        </tr>
                        <tr className="bg-[#101729]/5">
                          <td className="px-4 py-2.5 font-bold text-[#101729]">Coût total employeur</td>
                          <td />
                          <td className="px-4 py-2.5 text-right font-bold text-[#101729] text-sm">{fmt(totalCout)} {cfg.devise}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Synthèse */}
                  <div className="rounded-xl border border-[var(--border)] p-4 space-y-2.5">
                    <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Synthèse — {t(MONTH_KEYS[mois])} {annee}
                    </p>
                    {[
                      { label: 'Brut total', value: fmt(totalBrut), color: '#101729' },
                      { label: 'Net total à verser', value: fmt(totalNet), color: '#16A34A' },
                      { label: `${cfg.cnss.acronyme} salarié à reverser`, value: fmt(totalCnssEmp), color: '#DC2626' },
                      { label: `${cfg.irpp.nom.split(' ')[0]} à reverser (DGI)`, value: fmt(totalIRPP), color: '#DC2626' },
                      { label: 'Charges patronales totales', value: fmt(totalCnssP + totalTus + totalMed), color: '#D97706' },
                    ].map(k => (
                      <div key={k.label} className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-secondary)]">{k.label}</span>
                        <span className="font-bold" style={{ color: k.color }}>{k.value} {cfg.devise}</span>
                      </div>
                    ))}

                    {/* Note OHADA */}
                    <div className="mt-3 p-2.5 rounded-lg bg-[#2563EB]/8 border border-[#2563EB]/20">
                      <p className="text-[10px] text-[#2563EB] font-medium flex items-center gap-1">
                        <BarChart3 size={11} /> Écritures {cfg.systeme_comptable} générées automatiquement à la validation
                      </p>
                      <p className="text-[10px] text-[#1D4ED8] mt-0.5">661 Charges salariales → 422 Personnel · 664 Charges patronales → 431 CNSS</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Fonctionnalités réservées PME/Grande ─────────────────────────── */}
      {plan === 'tpe' && rows.length > 0 && (
        <div className="rounded-xl border border-dashed border-[#F59E0B]/50 bg-[#F59E0B]/5 p-4 flex items-start gap-3">
          <Lock size={15} className="text-[#D97706] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#D97706]">Fonctionnalités avancées — Plan Business</p>
            <p className="text-xs text-[#92400E] mt-0.5">
              Détail bulletin par employé, édition des éléments variables (heures sup, primes), téléchargement PDF, charges patronales détaillées,
              synchronisation OHADA et trésorerie — disponibles avec le plan Business ou Compagnie.
            </p>
          </div>
        </div>
      )}

      {/* ── Section Acomptes ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-[var(--border)]">
          <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Acomptes sur salaires — {t(MONTH_KEYS[mois])} {annee}
          </p>
          <button onClick={() => setShowAcompteForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: '#F59E0B' }}>
            <Plus size={12} /> Ajouter
          </button>
        </div>

        <AnimatePresence>
          {showAcompteForm && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-[var(--border)]">
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold block mb-1">Employé</label>
                  <select value={aEmployeId} onChange={e => setAEmployeId(e.target.value)}
                    className="w-full text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#F59E0B]">
                    <option value="">— Choisir —</option>
                    {rows.map(r => <option key={r.employe_id} value={r.employe_id}>{r.prenom} {r.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold block mb-1">Montant ({cfg.devise})</label>
                  <input type="number" min="0" value={aMontant || ''} onChange={e => setAMontant(Number(e.target.value) || 0)}
                    className="w-full text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#F59E0B]" />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold block mb-1">Notes</label>
                  <input type="text" value={aNotes} onChange={e => setANotes(e.target.value)} placeholder="Optionnel"
                    className="w-full text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#F59E0B]" />
                </div>
                <div className="flex items-end">
                  <button onClick={ajouterAcompte} disabled={addingAcompte || !aEmployeId || aMontant <= 0}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                    style={{ background: '#16A34A' }}>
                    {addingAcompte ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Valider
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {acomptesList.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
            <CreditCard size={24} className="mx-auto mb-2 opacity-30" />
            Aucun acompte enregistré pour cette période
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)]/50">
                  <th className="text-left px-4 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Employé</th>
                  <th className="text-right px-4 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Montant</th>
                  <th className="text-left px-4 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase hidden sm:table-cell">Date</th>
                  <th className="text-left px-4 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase hidden sm:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody>
                {acomptesList.map(a => (
                  <tr key={a.id} className="border-b border-[var(--border)]/50">
                    <td className="px-4 py-2 font-medium text-[#101729]">{a.employe_nom || a.employe_id.slice(0, 8)}</td>
                    <td className="px-4 py-2 text-right font-bold text-[#D97706]">{fmt(a.montant)} {cfg.devise}</td>
                    <td className="px-4 py-2 text-[var(--text-secondary)] hidden sm:table-cell">{new Date(a.date_acompte).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-2 text-[var(--text-secondary)] hidden sm:table-cell">{a.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showLancerModal && (
          <ModalLancerPaie rows={rows} mois={mois} annee={annee} saving={saving} cfg={cfg}
            onClose={() => setShowLancerModal(false)}
            onConfirm={() => sauvegarderPaie('generee')} />
        )}
        {detailRow && plan !== 'tpe' && (
          <ModalDetailBulletin row={detailRow} mois={mois} annee={annee} cfg={cfg} codePays={codePays}
            onClose={() => setDetailRow(null)}
            onSave={updates => { applyDetailUpdates(detailRow.employe_id, updates); setDetailRow(null) }} />
        )}
      </AnimatePresence>

    </div>
  )
}
