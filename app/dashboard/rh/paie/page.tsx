'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign, Users, RefreshCw, Check, AlertTriangle, Loader2,
  FileText, Calendar, X, ChevronLeft, ChevronRight, TrendingUp,
  Building2, Play, Plus, Printer, CreditCard, Eye, Lock,
  ChevronDown, ChevronUp, Download, BarChart3, Zap, Trash2,
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
  employe_id:           string
  nom:                  string
  prenom:               string
  poste:                string
  type_employe:         string
  cnss_num:             string
  situation:            SituationFamiliale
  nb_enfants:           number
  annees_anciennete:    number
  existingId?:          string
  statut:               'brouillon' | 'generee' | 'validee' | 'payee'
  heures_sup:           number
  taux_horaire:         number
  // Gains
  salaire_base:         number
  heures_sup_montant:   number
  prime_rendement:      number
  prime_anciennete:     number
  prime_transport:      number
  prime_logement:       number
  prime_risque:         number
  prime_responsabilite: number
  indemnite_deplacement:number
  avantages_nature:     number
  autres_gains:         number
  salaire_brut:         number
  // Retenues salarié
  cnss_employe:         number
  base_irpp:            number
  irpp:                 number
  irpp_detail:          DetailIRPP[]
  mutuelle:             number
  acompte:              number
  opposition:           number
  autres_retenues:      number
  total_retenues:       number
  salaire_net:          number
  // Patronal
  cnss_patronal:        number
  tus_patronal:         number
  medecine_travail:     number
  cout_total_employeur: number
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
  prime_risque?:           number
  prime_responsabilite?:   number
  indemnite_deplacement?:  number
  avantages_nature?:       number
  autres_gains?:           number
  mutuelle?:               number
  acompte?:                number
  opposition?:             number
  autres_retenues?:        number
}

type CalcResult = Omit<BulletinRow,
  'employe_id'|'nom'|'prenom'|'poste'|'type_employe'|'cnss_num'|'situation'|
  'nb_enfants'|'annees_anciennete'|'existingId'|'statut'|'heures_sup'|'taux_horaire'|'salaire_base'>

function computeBulletin(
  cfg: CountryConfig,
  codePays: CodePays,
  el: ElementsVariables,
  situation: SituationFamiliale,
  nb_enfants: number,
): CalcResult {
  const heures_sup_montant  = Math.round((el.heures_sup || 0) * (el.taux_horaire || 0))
  const prime_rendement     = el.prime_rendement     || 0
  const prime_anciennete    = el.prime_anciennete    || 0
  const prime_transport     = el.prime_transport     || 0
  const prime_logement      = el.prime_logement      || 0
  const prime_risque        = el.prime_risque        || 0
  const prime_responsabilite    = el.prime_responsabilite    || 0
  const indemnite_deplacement   = el.indemnite_deplacement   || 0
  const avantages_nature        = el.avantages_nature        || 0
  const autres_gains            = el.autres_gains            || 0

  const salaire_brut = el.salaire_base + heures_sup_montant + prime_rendement +
    prime_anciennete + prime_transport + prime_logement + prime_risque +
    prime_responsabilite + indemnite_deplacement + avantages_nature + autres_gains

  let cnss_employe = 0; let cnss_patronal = 0; let tus_patronal = 0
  try {
    const cnssRes = calculerChargesSociales({ codePays, salaireBrut: salaire_brut })
    cnss_employe = cnssRes.total_salarie
    const tusBranch = cnssRes.branches.find(b => b.code === 'TUS')
    tus_patronal  = tusBranch?.montant_patronal ?? 0
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
  const cout_total_employeur = salaire_brut + cnss_patronal + tus_patronal

  return {
    heures_sup_montant, prime_rendement, prime_anciennete, prime_transport, prime_logement,
    prime_risque, prime_responsabilite, indemnite_deplacement, avantages_nature, autres_gains,
    salaire_brut, cnss_employe, base_irpp, irpp, irpp_detail,
    mutuelle, acompte, opposition, autres_retenues, total_retenues, salaire_net,
    cnss_patronal, tus_patronal, medecine_travail, cout_total_employeur,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) { return fmtNum(n) }

function planFrom(taille: string | null | undefined): Plan {
  if (taille === 'pme' || taille === 'grande') return taille
  return 'tpe'
}

function PlanBadge({ plan }: { plan: Plan }) {
  const cfg = {
    tpe:    { label: 'Entrepreneur', color: '#6B7280', bg: '#6B728015' },
    pme:    { label: 'Business',     color: '#2563EB', bg: '#2563EB15' },
    grande: { label: 'Compagnie',    color: '#7C3AED', bg: '#7C3AED15' },
  }[plan]
  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border"
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

function NumInput({ value, onChange, disabled, placeholder, className }: {
  value: number; onChange: (v: number) => void; disabled?: boolean; placeholder?: string; className?: string
}) {
  return (
    <input type="number" min="0" value={value || ''} placeholder={placeholder ?? '0'}
      onChange={e => onChange(Number(e.target.value) || 0)} disabled={disabled}
      className={`bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs
                 text-right focus:outline-none focus:border-[#F59E0B] disabled:opacity-40 disabled:cursor-not-allowed ${className ?? 'w-full'}`} />
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
  const devise = cfg.devise

  w.document.write(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/>
<title>Bulletin — ${row.prenom} ${row.nom}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#111}
  .page{max-width:700px;margin:0 auto;padding:32px 28px}
  .header{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:18px}
  .logo{font-size:22px;font-weight:800}.logo span{color:#16A34A}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
  .box{background:#f7f7f7;border-radius:6px;padding:12px}.box h3{font-size:9px;text-transform:uppercase;color:#888;margin-bottom:6px}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px}
  thead th{background:#111;color:#fff;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase}
  tbody tr:nth-child(even){background:#f9f9f9}tbody td{padding:6px 10px;border-bottom:1px solid #eee}
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
      <p style="font-size:9px;margin-top:4px">Édité le ${new Date().toLocaleDateString('fr-FR')}</p></div>
  </div>
  <div class="parties">
    <div class="box"><h3>Employeur</h3><p><strong>${entreprise}</strong></p><p>${cfg.nom_pays}</p></div>
    <div class="box"><h3>Employé</h3><p><strong>${row.prenom} ${row.nom}</strong></p><p>${row.poste}</p>
      <p>N° ${cfg.cnss.acronyme} : ${row.cnss_num || '—'}</p>
      <p>Contrat : ${row.type_employe?.toUpperCase() || '—'} · Ancienneté : ${row.annees_anciennete} ans</p></div>
  </div>
  <table><thead><tr><th>Élément de paie</th><th style="text-align:right">Montant (${devise})</th></tr></thead>
  <tbody>
    <tr><td>Salaire de base</td><td style="text-align:right">${fmt(row.salaire_base)}</td></tr>
    ${row.prime_anciennete > 0 ? `<tr><td>Prime d'ancienneté (${row.annees_anciennete} ans)</td><td style="text-align:right">${fmt(row.prime_anciennete)}</td></tr>` : ''}
    ${row.prime_transport > 0 ? `<tr><td>Prime de transport</td><td style="text-align:right">${fmt(row.prime_transport)}</td></tr>` : ''}
    ${row.prime_logement > 0 ? `<tr><td>Prime de logement</td><td style="text-align:right">${fmt(row.prime_logement)}</td></tr>` : ''}
    ${row.prime_rendement > 0 ? `<tr><td>Prime de rendement</td><td style="text-align:right">${fmt(row.prime_rendement)}</td></tr>` : ''}
    ${row.prime_risque > 0 ? `<tr><td>Prime de risque</td><td style="text-align:right">${fmt(row.prime_risque)}</td></tr>` : ''}
    ${row.prime_responsabilite > 0 ? `<tr><td>Prime de responsabilité</td><td style="text-align:right">${fmt(row.prime_responsabilite)}</td></tr>` : ''}
    ${row.indemnite_deplacement > 0 ? `<tr><td>Indemnité de déplacement</td><td style="text-align:right">${fmt(row.indemnite_deplacement)}</td></tr>` : ''}
    ${row.avantages_nature > 0 ? `<tr><td>Avantages en nature</td><td style="text-align:right">${fmt(row.avantages_nature)}</td></tr>` : ''}
    ${row.heures_sup > 0 ? `<tr><td>Heures sup. (${row.heures_sup}h × ${fmt(row.taux_horaire)} ${devise})</td><td style="text-align:right">${fmt(row.heures_sup_montant)}</td></tr>` : ''}
    <tr class="total-row"><td>SALAIRE BRUT</td><td style="text-align:right">${fmt(row.salaire_brut)}</td></tr>
  </tbody></table>
  <table><thead><tr><th>Cotisations & retenues</th><th style="text-align:right">Part salarié</th></tr></thead>
  <tbody>
    <tr><td>${cfg.cnss.acronyme} salarié (${(cnssEmpTaux * 100).toFixed(2)}% plafonné)</td><td style="text-align:right">− ${fmt(row.cnss_employe)}</td></tr>
    <tr><td>${cfg.irpp.nom}</td><td style="text-align:right">− ${fmt(row.irpp)}</td></tr>
    ${row.mutuelle > 0 ? `<tr><td>Mutuelle</td><td style="text-align:right">− ${fmt(row.mutuelle)}</td></tr>` : ''}
    ${row.acompte > 0 ? `<tr><td>Acompte sur salaire</td><td style="text-align:right">− ${fmt(row.acompte)}</td></tr>` : ''}
    ${row.opposition > 0 ? `<tr><td>Opposition / saisie</td><td style="text-align:right">− ${fmt(row.opposition)}</td></tr>` : ''}
    ${row.autres_retenues > 0 ? `<tr><td>Autres retenues</td><td style="text-align:right">− ${fmt(row.autres_retenues)}</td></tr>` : ''}
    <tr class="total-row"><td>Total retenues</td><td style="text-align:right">− ${fmt(row.total_retenues)}</td></tr>
  </tbody></table>
  ${irppRows ? `<table><thead><tr><th>Détail ${cfg.irpp.nom.split(' ')[0]} par tranche</th><th style="text-align:right">Base</th><th style="text-align:right">Taux</th><th style="text-align:right">Impôt</th></tr></thead><tbody>${irppRows}</tbody></table>` : ''}
  <div class="net-box"><div><div style="font-size:12px;opacity:0.7">NET À PAYER</div></div><div class="amount">${fmt(row.salaire_net)} ${devise}</div></div>
  <p style="font-size:9px;color:#888;margin-bottom:4px">Coût total employeur : ${fmt(row.cout_total_employeur)} ${devise}</p>
  <p style="font-size:9px;color:#888">Bulletin conforme au droit du travail — ${cfg.nom_pays} · ${cfg.systeme_comptable}</p>
  <div class="footer">Généré par oraforme · ${new Date().toLocaleString('fr-FR')} · Conservez ce document 5 ans</div>
</div><script>window.onload=()=>{window.print()}<\/script></body></html>`)
  w.document.close()
}

// ── Modal Détail Bulletin — COMPLET ──────────────────────────────────────────

function ModalDetailBulletin({
  row, mois, annee, cfg, codePays, onClose, onSave,
}: {
  row: BulletinRow; mois: number; annee: number
  cfg: CountryConfig; codePays: CodePays
  onClose: () => void; onSave: (updates: Partial<BulletinRow>) => void
}) {
  const { t } = useLocale()
  const [el, setEl] = useState({
    heures_sup:           row.heures_sup,
    taux_horaire:         row.taux_horaire,
    prime_rendement:      row.prime_rendement,
    prime_transport:      row.prime_transport,
    prime_logement:       row.prime_logement,
    prime_risque:         row.prime_risque,
    prime_responsabilite: row.prime_responsabilite,
    indemnite_deplacement:row.indemnite_deplacement,
    avantages_nature:     row.avantages_nature,
    autres_gains:         row.autres_gains,
    mutuelle:             row.mutuelle,
    acompte:              row.acompte,
    opposition:           row.opposition,
    autres_retenues:      row.autres_retenues,
  })

  const calc = useMemo(() => computeBulletin(
    cfg, codePays,
    { ...el, salaire_base: row.salaire_base, prime_anciennete: row.prime_anciennete },
    row.situation, row.nb_enfants,
  ), [el, row, cfg, codePays])

  const set = (key: keyof typeof el) => (v: number) => setEl(prev => ({ ...prev, [key]: v }))

  const cnssEmpTaux = cfg.cnss.branches.find(b => b.taux_salarie > 0)?.taux_salarie ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-2 sm:p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#101729]">
              Détail bulletin — {row.prenom} {row.nom}
            </h2>
            <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-[var(--text-secondary)]">
              <span>{row.poste}</span>
              <span className="opacity-40">·</span>
              <span className="uppercase font-medium">{row.type_employe || '—'}</span>
              <span className="opacity-40">·</span>
              <span>{t(MONTH_KEYS[mois])} {annee}</span>
              <span className="opacity-40">·</span>
              <span>{cfg.cnss.acronyme} {row.cnss_num || '—'}</span>
              <span className="opacity-40">·</span>
              <span>{row.annees_anciennete} ans ancienneté</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-[var(--text-secondary)] shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="p-5 space-y-5">

            {/* ── Info employé ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Situation', val: row.situation === 'marie' ? 'Marié(e)' : 'Célibataire' },
                { label: 'Enfants', val: `${row.nb_enfants} enfant(s)` },
                { label: 'Parts IRPP', val: `${1 + (row.situation === 'marie' ? 1 : 0) + row.nb_enfants * 0.5} parts` },
                { label: 'SMIG', val: `${fmt(cfg.smig)} ${cfg.devise}` },
              ].map(k => (
                <div key={k.label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-[var(--text-secondary)]">{k.label}</p>
                  <p className="text-xs font-semibold text-[#101729] mt-0.5">{k.val}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* ── Formulaire ── */}
              <div className="space-y-4">

                {/* Heures supplémentaires */}
                <div className="rounded-xl border border-[var(--border)] p-4">
                  <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                    Heures supplémentaires
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[var(--text-secondary)] block mb-1">Nombre d&apos;heures</label>
                      <NumInput value={el.heures_sup} onChange={set('heures_sup')} placeholder="0 h" />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--text-secondary)] block mb-1">Taux horaire ({cfg.devise}/h)</label>
                      <NumInput value={el.taux_horaire} onChange={set('taux_horaire')} />
                    </div>
                  </div>
                  {el.heures_sup > 0 && (
                    <p className="text-[11px] text-amber-700 mt-2 font-medium">
                      = {fmt(Math.round(el.heures_sup * el.taux_horaire))} {cfg.devise}
                    </p>
                  )}
                </div>

                {/* Primes */}
                <div className="rounded-xl border border-[var(--border)] p-4">
                  <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                    Primes & indemnités
                  </p>
                  <div className="space-y-2">
                    {([
                      { key: 'prime_rendement',      label: 'Prime de rendement / performance' },
                      { key: 'prime_transport',       label: 'Prime de transport' },
                      { key: 'prime_logement',        label: 'Prime de logement' },
                      { key: 'prime_risque',          label: 'Prime de risque / danger' },
                      { key: 'prime_responsabilite',  label: 'Prime de responsabilité' },
                      { key: 'indemnite_deplacement', label: 'Indemnité de déplacement' },
                      { key: 'avantages_nature',      label: 'Avantages en nature' },
                      { key: 'autres_gains',          label: 'Autres gains divers' },
                    ] as { key: keyof typeof el; label: string }[]).map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-2">
                        <label className="flex-1 text-xs text-[var(--text-secondary)]">{label}</label>
                        <div className="flex items-center gap-1 shrink-0">
                          <NumInput value={el[key]} onChange={set(key)} className="w-28" />
                          {el[key] > 0 && (
                            <button onClick={() => setEl(p => ({ ...p, [key]: 0 }))}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Prime ancienneté (readonly) */}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--border)]">
                    <label className="flex-1 text-xs text-[var(--text-secondary)]">
                      Prime d&apos;ancienneté ({row.annees_anciennete} ans) <span className="text-[10px] opacity-60">calculée auto</span>
                    </label>
                    <span className="text-xs font-semibold text-green-700 w-28 text-right pr-7">
                      {fmt(row.prime_anciennete)} {cfg.devise}
                    </span>
                  </div>
                </div>

                {/* Retenues */}
                <div className="rounded-xl border border-[var(--border)] p-4">
                  <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                    Retenues complémentaires
                  </p>
                  <div className="space-y-2">
                    {([
                      { key: 'mutuelle',        label: 'Mutuelle / assurance complémentaire' },
                      { key: 'acompte',         label: 'Acompte sur salaire' },
                      { key: 'opposition',      label: 'Opposition / saisie sur salaire' },
                      { key: 'autres_retenues', label: 'Autres retenues' },
                    ] as { key: keyof typeof el; label: string }[]).map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-2">
                        <label className="flex-1 text-xs text-[var(--text-secondary)]">{label}</label>
                        <div className="flex items-center gap-1 shrink-0">
                          <NumInput value={el[key]} onChange={set(key)} className="w-28" />
                          {el[key] > 0 && (
                            <button onClick={() => setEl(p => ({ ...p, [key]: 0 }))}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Récapitulatif live ── */}
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--border)] overflow-hidden sticky top-0">
                  <div className="bg-gray-50 px-4 py-2.5 border-b border-[var(--border)]">
                    <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Bulletin calculé</p>
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {/* Gains */}
                      <tr className="border-b border-[var(--border)]/40">
                        <td className="px-4 py-1.5 text-[var(--text-secondary)]">Salaire de base</td>
                        <td className="px-4 py-1.5 text-right">{fmt(row.salaire_base)}</td>
                      </tr>
                      {calc.prime_anciennete > 0 && (
                        <tr className="border-b border-[var(--border)]/40">
                          <td className="px-4 py-1.5 text-[var(--text-secondary)]">Prime ancienneté</td>
                          <td className="px-4 py-1.5 text-right text-green-700">+{fmt(calc.prime_anciennete)}</td>
                        </tr>
                      )}
                      {calc.heures_sup_montant > 0 && (
                        <tr className="border-b border-[var(--border)]/40">
                          <td className="px-4 py-1.5 text-[var(--text-secondary)]">Heures sup. ({el.heures_sup}h)</td>
                          <td className="px-4 py-1.5 text-right text-green-700">+{fmt(calc.heures_sup_montant)}</td>
                        </tr>
                      )}
                      {calc.prime_transport > 0 && (
                        <tr className="border-b border-[var(--border)]/40">
                          <td className="px-4 py-1.5 text-[var(--text-secondary)]">Prime transport</td>
                          <td className="px-4 py-1.5 text-right text-green-700">+{fmt(calc.prime_transport)}</td>
                        </tr>
                      )}
                      {calc.prime_logement > 0 && (
                        <tr className="border-b border-[var(--border)]/40">
                          <td className="px-4 py-1.5 text-[var(--text-secondary)]">Prime logement</td>
                          <td className="px-4 py-1.5 text-right text-green-700">+{fmt(calc.prime_logement)}</td>
                        </tr>
                      )}
                      {calc.prime_rendement > 0 && (
                        <tr className="border-b border-[var(--border)]/40">
                          <td className="px-4 py-1.5 text-[var(--text-secondary)]">Prime rendement</td>
                          <td className="px-4 py-1.5 text-right text-green-700">+{fmt(calc.prime_rendement)}</td>
                        </tr>
                      )}
                      {calc.prime_risque > 0 && (
                        <tr className="border-b border-[var(--border)]/40">
                          <td className="px-4 py-1.5 text-[var(--text-secondary)]">Prime risque</td>
                          <td className="px-4 py-1.5 text-right text-green-700">+{fmt(calc.prime_risque)}</td>
                        </tr>
                      )}
                      {calc.prime_responsabilite > 0 && (
                        <tr className="border-b border-[var(--border)]/40">
                          <td className="px-4 py-1.5 text-[var(--text-secondary)]">Prime responsabilité</td>
                          <td className="px-4 py-1.5 text-right text-green-700">+{fmt(calc.prime_responsabilite)}</td>
                        </tr>
                      )}
                      {calc.indemnite_deplacement > 0 && (
                        <tr className="border-b border-[var(--border)]/40">
                          <td className="px-4 py-1.5 text-[var(--text-secondary)]">Indemnité déplacement</td>
                          <td className="px-4 py-1.5 text-right text-green-700">+{fmt(calc.indemnite_deplacement)}</td>
                        </tr>
                      )}
                      {calc.avantages_nature > 0 && (
                        <tr className="border-b border-[var(--border)]/40">
                          <td className="px-4 py-1.5 text-[var(--text-secondary)]">Avantages nature</td>
                          <td className="px-4 py-1.5 text-right text-green-700">+{fmt(calc.avantages_nature)}</td>
                        </tr>
                      )}
                      {calc.autres_gains > 0 && (
                        <tr className="border-b border-[var(--border)]/40">
                          <td className="px-4 py-1.5 text-[var(--text-secondary)]">Autres gains</td>
                          <td className="px-4 py-1.5 text-right text-green-700">+{fmt(calc.autres_gains)}</td>
                        </tr>
                      )}
                      {/* Brut */}
                      <tr className="border-b border-[var(--border)] bg-gray-50">
                        <td className="px-4 py-2 font-bold text-[#101729]">SALAIRE BRUT</td>
                        <td className="px-4 py-2 font-bold text-right text-[#101729]">{fmt(calc.salaire_brut)}</td>
                      </tr>
                      {/* Retenues */}
                      <tr className="border-b border-[var(--border)]/40">
                        <td className="px-4 py-1.5 text-[#DC2626]">{cfg.cnss.acronyme} salarié ({(cnssEmpTaux * 100).toFixed(2)}%)</td>
                        <td className="px-4 py-1.5 text-right text-[#DC2626]">−{fmt(calc.cnss_employe)}</td>
                      </tr>
                      <tr className="border-b border-[var(--border)]/40">
                        <td className="px-4 py-1.5 text-[#DC2626]">{cfg.irpp.nom.split(' ')[0]}</td>
                        <td className="px-4 py-1.5 text-right text-[#DC2626]">
                          {calc.irpp === 0 ? <span className="text-gray-400">Exonéré</span> : `−${fmt(calc.irpp)}`}
                        </td>
                      </tr>
                      {calc.mutuelle > 0 && (
                        <tr className="border-b border-[var(--border)]/40">
                          <td className="px-4 py-1.5 text-[#DC2626]">Mutuelle</td>
                          <td className="px-4 py-1.5 text-right text-[#DC2626]">−{fmt(calc.mutuelle)}</td>
                        </tr>
                      )}
                      {calc.acompte > 0 && (
                        <tr className="border-b border-[var(--border)]/40">
                          <td className="px-4 py-1.5 text-[#D97706]">Acompte</td>
                          <td className="px-4 py-1.5 text-right text-[#D97706]">−{fmt(calc.acompte)}</td>
                        </tr>
                      )}
                      {calc.opposition > 0 && (
                        <tr className="border-b border-[var(--border)]/40">
                          <td className="px-4 py-1.5 text-[#DC2626]">Opposition</td>
                          <td className="px-4 py-1.5 text-right text-[#DC2626]">−{fmt(calc.opposition)}</td>
                        </tr>
                      )}
                      {calc.autres_retenues > 0 && (
                        <tr className="border-b border-[var(--border)]/40">
                          <td className="px-4 py-1.5 text-[#DC2626]">Autres retenues</td>
                          <td className="px-4 py-1.5 text-right text-[#DC2626]">−{fmt(calc.autres_retenues)}</td>
                        </tr>
                      )}
                      {/* Net */}
                      <tr className="bg-[#16A34A]/8">
                        <td className="px-4 py-3 font-bold text-[#16A34A]">NET À PAYER</td>
                        <td className="px-4 py-3 font-bold text-right text-[#16A34A] text-sm">
                          {fmt(calc.salaire_net)} {cfg.devise}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Détail IRPP */}
                  {calc.irpp_detail.length > 0 && (
                    <details className="border-t border-[var(--border)]">
                      <summary className="px-4 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase cursor-pointer hover:bg-gray-50">
                        Détail {cfg.irpp.nom.split(' ')[0]} par tranche
                      </summary>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-[var(--border)]">
                            <th className="px-3 py-1.5 text-left text-[10px] text-[var(--text-secondary)] uppercase">Tranche</th>
                            <th className="px-3 py-1.5 text-right text-[10px] text-[var(--text-secondary)] uppercase">Taux</th>
                            <th className="px-3 py-1.5 text-right text-[10px] text-[var(--text-secondary)] uppercase">Impôt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calc.irpp_detail.map((d, i) => (
                            <tr key={i} className="border-b border-[var(--border)]/40">
                              <td className="px-3 py-1 text-[var(--text-secondary)]">{d.label}</td>
                              <td className="px-3 py-1 text-right">{d.taux}%</td>
                              <td className="px-3 py-1 text-right font-medium">{fmt(d.montant)}</td>
                            </tr>
                          ))}
                          <tr className="bg-gray-50">
                            <td className="px-3 py-1.5 font-bold text-[#101729]" colSpan={2}>Total</td>
                            <td className="px-3 py-1.5 font-bold text-right text-[#DC2626]">{fmt(calc.irpp)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </details>
                  )}

                  {/* Coût employeur */}
                  <div className="px-4 py-2.5 bg-[#101729]/5 border-t border-[var(--border)] flex items-center justify-between">
                    <span className="text-[10px] text-[var(--text-secondary)]">Coût total employeur</span>
                    <span className="text-xs font-bold text-[#101729]">{fmt(calc.cout_total_employeur)} {cfg.devise}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border)] bg-gray-50 shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-gray-200 transition-colors">
            Annuler
          </button>
          <button
            onClick={() => {
              onSave({ heures_sup: el.heures_sup, taux_horaire: el.taux_horaire, ...calc })
              onClose()
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ background: '#F59E0B' }}>
            <Check size={14} /> Appliquer les modifications
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Modal Lancer la paie ───────────────────────────────────────────────────────

function ModalLancerPaie({
  rows, mois, annee, saving, erreur, cfg, onClose, onConfirm,
}: {
  rows: BulletinRow[]; mois: number; annee: number; saving: boolean; erreur: string | null
  cfg: CountryConfig; onClose: () => void; onConfirm: () => void
}) {
  const { t } = useLocale()
  const totalBrut  = rows.reduce((s, r) => s + r.salaire_brut, 0)
  const totalNet   = rows.reduce((s, r) => s + r.salaire_net, 0)
  const totalPatro = rows.reduce((s, r) => s + r.cnss_patronal + r.tus_patronal, 0)

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
          {erreur && (
            <div className="flex items-start gap-2 bg-[#DC2626]/10 border border-[#DC2626]/30 rounded-xl px-4 py-3">
              <AlertTriangle size={14} className="text-[#DC2626] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-[#DC2626]">Erreur lors de la génération</p>
                <p className="text-[10px] text-[#DC2626]/80 mt-0.5">{erreur}</p>
              </div>
            </div>
          )}
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
            {saving ? 'Génération en cours…' : 'Confirmer & générer tous'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Carte mobile ──────────────────────────────────────────────────────────────

function EmployeeCard({
  row, mois, annee, plan, cfg, codePays, onDetailOpen, onPrint, onDownloadPdf, onStatutChange, onGenerate,
}: {
  row: BulletinRow; mois: number; annee: number; plan: Plan
  cfg: CountryConfig; codePays: CodePays
  onDetailOpen: () => void; onPrint: () => void; onDownloadPdf: () => void
  onStatutChange: (s: BulletinRow['statut']) => void; onGenerate: () => void
}) {
  const [open, setOpen] = useState(false)
  void codePays
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
        {open ? <ChevronUp size={14} className="text-[var(--text-secondary)]" /> : <ChevronDown size={14} className="text-[var(--text-secondary)]" />}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-[var(--border)]">
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Salaire base', val: row.salaire_base },
                  { label: 'Salaire brut', val: row.salaire_brut },
                  { label: `${cfg.cnss.acronyme} salarié`, val: -row.cnss_employe },
                  { label: cfg.irpp.nom.split(' ')[0], val: -row.irpp },
                  { label: 'Net à payer', val: row.salaire_net },
                  { label: 'Coût employeur', val: row.cout_total_employeur },
                ].map(k => (
                  <div key={k.label} className="bg-gray-50 rounded-lg p-2">
                    <p className="text-[10px] text-[var(--text-secondary)]">{k.label}</p>
                    <p className={`text-xs font-semibold ${k.val < 0 ? 'text-red-600' : k.label === 'Net à payer' ? 'text-green-700' : ''}`}>
                      {k.val < 0 ? '−' : ''}{fmt(Math.abs(k.val))} {cfg.devise}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={row.statut} onChange={e => onStatutChange(e.target.value as BulletinRow['statut'])}
                  className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-[var(--border)] focus:outline-none bg-white"
                  style={{ color: statutColor }}>
                  <option value="brouillon">Brouillon</option>
                  <option value="generee">Générée</option>
                  <option value="validee">Validée</option>
                  <option value="payee">Payée</option>
                </select>
                <button onClick={onGenerate}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] bg-[#DC2626] text-white font-semibold">
                  <Play size={10} /> Générer
                </button>
                <button onClick={onPrint}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border border-[var(--border)] text-[var(--text-secondary)]">
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

  const codePays = useMemo<CodePays>(() => (tenantPays ?? 'CG') as CodePays, [tenantPays])
  const cfg = useMemo(() => getCountryConfig(codePays), [codePays])

  const confidenceCls = cfg.data_confidence === 'verified'
    ? 'bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30'
    : 'bg-[#F59E0B]/10 text-[#D97706] border-[#F59E0B]/30'

  const now = new Date()
  const [mois,  setMois]  = useState(now.getMonth() + 1)
  const [annee, setAnnee] = useState(now.getFullYear())

  const [rows,          setRows]          = useState<BulletinRow[]>([])
  const [loading,       setLoading]       = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [erreurSave,    setErreurSave]    = useState<string | null>(null)
  const [entreprise,    setEntreprise]    = useState('Mon Entreprise')
  const [acomptesList,  setAcomptesList]  = useState<AcompteLine[]>([])
  const [showLancerModal, setShowLancerModal] = useState(false)
  const [detailRow,     setDetailRow]     = useState<BulletinRow | null>(null)
  const [aEmployeId,    setAEmployeId]    = useState('')
  const [aMontant,      setAMontant]      = useState(0)
  const [aNotes,        setANotes]        = useState('')
  const [addingAcompte, setAddingAcompte] = useState(false)
  const [showAcompteForm, setShowAcompteForm] = useState(false)
  const [showCharges,   setShowCharges]   = useState(true)

  // ── Chargement ───────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setErreurSave(null)

    const [
      { data: emps, error: empsErr },
      { data: buls, error: bulsErr },
      { data: tenant },
      { data: acomptes },
    ] = await Promise.all([
      supabase.from('employes')
        .select('id,nom,prenom,poste,type_employe,salaire_base,numero_cnss,statut,date_recrutement,situation_matrimoniale,nb_enfants,prime_transport,prime_logement,prime_rendement,prime_risque,taux_horaire')
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
    const bulMap  = new Map((buls ?? []).map((b: Record<string, unknown>) => [b.employe_id as string, b]))

    const acompteMap  = new Map<string, number>()
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
      const existing     = bulMap.get(e.id as string) as Record<string, unknown> | undefined
      const sit: SituationFamiliale = (e.situation_matrimoniale as SituationFamiliale) ?? 'celibataire'
      const nbEnf  = (e.nb_enfants as number) ?? 0
      const base   = e.salaire_base as number
      const pa     = calcPrimeAnciennete(base, annees)

      const inputs: ElementsVariables = {
        salaire_base:          existing ? ((existing.salaire_base as number) ?? base) : base,
        heures_sup:            Number(existing?.heures_sup)    || 0,
        taux_horaire:          Number(existing?.taux_horaire)  || Number(e.taux_horaire) || 0,
        prime_rendement:       Number(existing?.prime_rendement)    || Number(e.prime_rendement)    || 0,
        prime_anciennete:      Number(existing?.prime_anciennete)   || pa,
        prime_transport:       Number(existing?.prime_transport)    || Number(e.prime_transport)    || 0,
        prime_logement:        Number(existing?.prime_logement)     || Number(e.prime_logement)     || 0,
        prime_risque:          Number(existing?.prime_risque)       || Number(e.prime_risque)       || 0,
        prime_responsabilite:  Number(existing?.prime_responsabilite)  || 0,
        indemnite_deplacement: Number(existing?.indemnite_deplacement) || 0,
        avantages_nature:      Number(existing?.avantages_nature)      || 0,
        autres_gains:          Number(existing?.autres_gains)          || 0,
        mutuelle:              Number(existing?.mutuelle)              || 0,
        acompte:               Number(existing?.acompte)              || acompteTotal,
        opposition:            Number(existing?.opposition)            || 0,
        autres_retenues:       Number(existing?.autres_retenues)       || 0,
      }

      const res = computeBulletin(cfg, codePays, inputs, sit, nbEnf)

      return {
        employe_id: e.id as string, nom: e.nom as string, prenom: (e.prenom as string) ?? '',
        poste: e.poste as string, type_employe: (e.type_employe as string) ?? '',
        cnss_num: (e.numero_cnss as string) ?? '', situation: sit, nb_enfants: nbEnf,
        annees_anciennete: annees,
        existingId: existing ? (existing.id as string) : undefined,
        statut: existing ? ((existing.statut as BulletinRow['statut']) ?? 'generee') : 'brouillon',
        heures_sup: inputs.heures_sup!, taux_horaire: inputs.taux_horaire!,
        salaire_base: inputs.salaire_base,
        ...res,
      }
    }))

    setLoading(false)
  }, [tenantId, mois, annee, cfg, codePays])

  useEffect(() => { load() }, [load])

  // ── Mise à jour ligne ────────────────────────────────────────────────────────

  function applyDetailUpdates(id: string, updates: Partial<BulletinRow>) {
    setRows(prev => prev.map(r => r.employe_id === id ? { ...r, ...updates } : r))
  }

  function updateStatut(id: string, statut: BulletinRow['statut']) {
    setRows(prev => prev.map(r => r.employe_id === id ? { ...r, statut } : r))
  }

  // ── Construction du payload ──────────────────────────────────────────────────

  function buildUpsertPayload(targetRows: BulletinRow[], forceStatut?: BulletinRow['statut']) {
    return targetRows.map(r => ({
      tenant_id: tenantId!, employe_id: r.employe_id, mois, annee,
      salaire_base: r.salaire_base, heures_sup: r.heures_sup, taux_horaire: r.taux_horaire,
      prime_rendement: r.prime_rendement, prime_anciennete: r.prime_anciennete,
      prime_transport: r.prime_transport, prime_logement: r.prime_logement,
      prime_risque: r.prime_risque, prime_responsabilite: r.prime_responsabilite,
      indemnite_deplacement: r.indemnite_deplacement, avantages_nature: r.avantages_nature,
      autres_gains: r.autres_gains,
      brut: r.salaire_brut, cnss_salarie: r.cnss_employe, cnss_patronal: r.cnss_patronal,
      irpp: r.irpp, net: r.salaire_net,
      mutuelle: r.mutuelle, acompte: r.acompte, opposition: r.opposition,
      autres_retenues: r.autres_retenues, total_retenues: r.total_retenues,
      tus_patronal: r.tus_patronal, medecine_travail: r.medecine_travail,
      cout_total_employeur: r.cout_total_employeur,
      statut: forceStatut ?? r.statut, genere_par: 'paie_module',
    }))
  }

  // ── Sauvegarde globale ────────────────────────────────────────────────────────

  async function sauvegarderPaie(forceStatut?: BulletinRow['statut']) {
    if (!tenantId) return
    setSaving(true); setErreurSave(null)

    const toUpsert = buildUpsertPayload(rows, forceStatut)

    const { error } = await supabase.from('bulletins_paie')
      .upsert(toUpsert, { onConflict: 'employe_id,mois,annee' })

    if (error) {
      captureSupabaseError('upsert bulletins_paie', error, { module: 'rh/paie', tenant_id: tenantId })
      setErreurSave(error.message)
      setSaving(false)
      return
    }

    // Sync trésorerie + OHADA (PME/Grande)
    if (plan !== 'tpe') {
      const payees = rows.filter(r => (forceStatut ?? r.statut) === 'payee')
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
          await supabase.from('transactions').insert(toInsert)
        }
        const totalNetP  = payees.reduce((s, r) => s + r.salaire_net, 0)
        const totalCnssP = payees.reduce((s, r) => s + r.cnss_patronal + r.tus_patronal, 0)
        const dateEcr    = new Date(annee, mois - 1, 28).toISOString().split('T')[0]
        const lib        = `Paie ${MOIS_LABELS[mois]} ${annee}`
        await supabase.from('mouvements_comptables').upsert([
          { tenant_id: tenantId, date: dateEcr, compte_debit: '661', compte_credit: '422', montant: totalNetP, libelle: lib, source: 'paie', source_id: `paie_661_${mois}_${annee}` },
          { tenant_id: tenantId, date: dateEcr, compte_debit: '664', compte_credit: '431', montant: totalCnssP, libelle: `Charges patro. ${lib}`, source: 'paie', source_id: `paie_664_${mois}_${annee}` },
        ], { onConflict: 'source_id' }).then(() => null, () => null)
      }
    }

    setSaving(false); setSaved(true); setShowLancerModal(false)
    setTimeout(() => setSaved(false), 2500)
    load()
  }

  // ── Génération individuelle ──────────────────────────────────────────────────

  async function genererBulletinUnique(row: BulletinRow) {
    if (!tenantId) return
    const payload = buildUpsertPayload([row], 'generee')
    const { error } = await supabase.from('bulletins_paie')
      .upsert(payload, { onConflict: 'employe_id,mois,annee' })
    if (error) {
      setErreurSave(error.message)
      captureSupabaseError('upsert bulletin unique', error, { module: 'rh/paie', tenant_id: tenantId })
    } else {
      load()
    }
  }

  // ── Acomptes ─────────────────────────────────────────────────────────────────

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

  // ── Download PDF ─────────────────────────────────────────────────────────────

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
  const totalCout    = rows.reduce((s, r) => s + r.cout_total_employeur, 0)

  const isCurrentMonth  = mois === now.getMonth() + 1 && annee === now.getFullYear()
  const notYetGenerated = rows.length > 0 && rows.every(r => !r.existingId)
  const cnssEmpTaux     = cfg.cnss.branches.find(b => b.taux_salarie > 0)?.taux_salarie ?? 0

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

      {/* ── Erreur sauvegarde ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {erreurSave && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-3 bg-[#DC2626]/10 border border-[#DC2626]/30 rounded-xl px-4 py-3">
            <AlertTriangle size={15} className="text-[#DC2626] shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#DC2626]">Erreur lors de la génération des bulletins</p>
              <p className="text-xs text-[#DC2626]/80 mt-0.5">{erreurSave}</p>
              <p className="text-xs text-[#DC2626]/60 mt-1">Si le problème persiste, vérifiez que la migration 077_paie_v2 a été appliquée dans Supabase.</p>
            </div>
            <button onClick={() => setErreurSave(null)} className="text-[#DC2626] hover:bg-red-50 p-1 rounded">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-[#101729]">Gestion de la paie</h1>
            <PlanBadge plan={plan} />
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-2 flex-wrap">
            <span>{cfg.nom_pays} · {cfg.cnss.acronyme} salarié {(cnssEmpTaux * 100).toFixed(2)}% · {cfg.irpp.tranches.length} tranches {cfg.irpp.nom.split(' ')[0]} · SMIG {fmtNum(cfg.smig)} {cfg.devise}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${confidenceCls}`}>
              {cfg.data_confidence === 'verified' ? '✓ vérifié' : '⚠ à vérifier'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={prevMois} className="p-1.5 rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729]"><ChevronLeft size={14} /></button>
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
          <button onClick={nextMois} className="p-1.5 rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729]"><ChevronRight size={14} /></button>
          <button onClick={load} className="p-1.5 rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729]"><RefreshCw size={13} /></button>
        </div>
      </div>

      {/* ── Banners mesures spéciales ─────────────────────────────────────── */}
      {cfg.cnss.mesures_speciales && cfg.cnss.mesures_speciales.length > 0 && (
        <div className="flex items-start gap-3 bg-[#2563EB]/8 border border-[#2563EB]/20 rounded-xl px-4 py-3">
          <Zap size={15} className="text-[#2563EB] shrink-0 mt-0.5" />
          <p className="text-xs text-[#1D4ED8]"><strong>{cfg.cnss.source}</strong> — {cfg.cnss.mesures_speciales.map(m => m.description).join(' · ')}</p>
        </div>
      )}

      {/* ── Alerte paie non générée ───────────────────────────────────────── */}
      <AnimatePresence>
        {isCurrentMonth && notYetGenerated && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex items-center gap-3 bg-[#D97706]/10 border border-[#D97706]/30 rounded-xl px-4 py-3">
              <AlertTriangle size={15} className="text-[#D97706] shrink-0" />
              <p className="text-sm text-[#D97706]">La paie de <strong>{t(MONTH_KEYS[mois])} {annee}</strong> n&apos;a pas encore été générée.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── KPI ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Masse salariale brute" value={`${fmt(totalBrut)} ${cfg.devise}`} sub={`${rows.length} employé(s) actif(s)`} color="#DC2626" icon={DollarSign} />
        <KpiCard label="Net total à payer" value={`${fmt(totalNet)} ${cfg.devise}`} sub={`Retenues : ${fmt(totalBrut - totalNet)} ${cfg.devise}`} color="#16A34A" icon={TrendingUp} />
        <KpiCard label={`${cfg.cnss.acronyme} salarié`} value={`${fmt(totalCnssEmp)} ${cfg.devise}`} sub={`${(cnssEmpTaux * 100).toFixed(2)}% plafonné`} color="#2563EB" icon={Building2} />
        <KpiCard label="Coût total employeur" value={`${fmt(totalCout)} ${cfg.devise}`} sub={`${cfg.irpp.nom.split(' ')[0]} : ${fmt(totalIRPP)} ${cfg.devise}`} color="#7C3AED" icon={Users} />
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--text-secondary)]">
          {rows.filter(r => r.statut === 'payee').length} payé(s) · {rows.filter(r => r.statut === 'validee').length} validé(s) · {rows.filter(r => r.statut === 'generee').length} générée(s)
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

      {/* ── Tableau / Cards ───────────────────────────────────────────────── */}
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
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {rows.map(row => (
              <EmployeeCard key={row.employe_id}
                row={row} mois={mois} annee={annee} plan={plan} cfg={cfg} codePays={codePays}
                onDetailOpen={() => setDetailRow(row)}
                onPrint={() => printBulletin(row, mois, annee, entreprise, cfg)}
                onDownloadPdf={() => downloadPdf(row)}
                onStatutChange={s => updateStatut(row.employe_id, s)}
                onGenerate={() => genererBulletinUnique(row)} />
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-gray-50">
                    {['Employé', 'Base', ...(plan !== 'tpe' ? ['H.sup'] : []), 'Brut', cfg.cnss.acronyme, cfg.irpp.nom.split(' ')[0], 'Acompte', 'Net', 'Statut', 'Actions'].map(h => (
                      <th key={h} className="px-3 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-left first:px-4 last:text-center whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const statutColor = row.statut === 'payee' ? '#16A34A' : row.statut === 'validee' ? '#2563EB' : row.statut === 'generee' ? '#D97706' : '#6B7280'
                    return (
                      <motion.tr key={row.employe_id}
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                        className="border-b border-[var(--border)] hover:bg-gray-50 transition-colors">

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 text-white"
                              style={{ background: `hsl(${row.nom.charCodeAt(0) * 7 % 360}, 55%, 38%)` }}>
                              {(row.prenom?.[0] ?? row.nom[0]).toUpperCase()}{row.nom[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-[#101729]">{row.prenom} {row.nom}</p>
                              <p className="text-[10px] text-[var(--text-secondary)]">{row.poste}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3 text-right text-xs text-[var(--text-secondary)] whitespace-nowrap">{fmt(row.salaire_base)}</td>

                        {plan !== 'tpe' && (
                          <td className="px-3 py-3 text-xs text-[var(--text-secondary)] text-right whitespace-nowrap">
                            {row.heures_sup > 0 ? `${row.heures_sup}h` : '—'}
                          </td>
                        )}

                        <td className="px-3 py-3 text-right text-xs font-semibold text-[#101729] whitespace-nowrap">{fmt(row.salaire_brut)}</td>
                        <td className="px-3 py-3 text-right text-xs text-[#DC2626] whitespace-nowrap">−{fmt(row.cnss_employe)}</td>
                        <td className="px-3 py-3 text-right text-xs whitespace-nowrap" style={{ color: row.irpp === 0 ? '#9CA3AF' : '#DC2626' }}>
                          {row.irpp === 0 ? 'Exo.' : `−${fmt(row.irpp)}`}
                        </td>
                        <td className="px-3 py-3 text-right text-xs text-[#D97706] whitespace-nowrap">{row.acompte > 0 ? `−${fmt(row.acompte)}` : '—'}</td>
                        <td className="px-3 py-3 text-right text-xs font-bold text-[#16A34A] whitespace-nowrap">{fmt(row.salaire_net)}</td>

                        <td className="px-3 py-3 text-center">
                          <select value={row.statut} onChange={e => updateStatut(row.employe_id, e.target.value as BulletinRow['statut'])}
                            className="bg-transparent text-[10px] focus:outline-none cursor-pointer font-semibold"
                            style={{ color: statutColor }}>
                            <option value="brouillon">Brouillon</option>
                            <option value="generee">Générée</option>
                            <option value="validee">Validée</option>
                            <option value="payee">Payée</option>
                          </select>
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {/* Générer individuellement */}
                            <button onClick={() => genererBulletinUnique(row)}
                              title="Générer ce bulletin"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#DC2626] border border-[#DC2626]/20">
                              <Play size={9} /> Générer
                            </button>
                            {plan !== 'tpe' && (
                              <button onClick={() => setDetailRow(row)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 text-[#D97706] border border-[#F59E0B]/20">
                                <Eye size={9} /> Détail
                              </button>
                            )}
                            <button onClick={() => printBulletin(row, mois, annee, entreprise, cfg)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-[var(--surface)] hover:bg-gray-200 text-[var(--text-secondary)] border border-[var(--border)]">
                              <Printer size={9} /> Print
                            </button>
                            {plan !== 'tpe' && row.existingId && (
                              <button onClick={() => downloadPdf(row)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-[var(--surface)] hover:bg-gray-200 text-[var(--text-secondary)] border border-[var(--border)]">
                                <Download size={9} /> PDF
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-[var(--border)]">
                    <td className="px-4 py-3 text-xs font-bold text-[#101729]">TOTAUX ({rows.length})</td>
                    <td className="px-3 py-3 text-right text-xs font-semibold text-[var(--text-secondary)]">{fmt(rows.reduce((s, r) => s + r.salaire_base, 0))}</td>
                    {plan !== 'tpe' && <td />}
                    <td className="px-3 py-3 text-right text-xs font-bold">{fmt(totalBrut)}</td>
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

      {/* ── Charges patronales (PME/Grande) ──────────────────────────────── */}
      {plan !== 'tpe' && rows.length > 0 && (
        <div>
          <button onClick={() => setShowCharges(v => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[#101729] mb-2">
            {showCharges ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Charges patronales & synthèse
          </button>
          <AnimatePresence>
            {showCharges && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        {cfg.cnss.branches.filter(b => b.taux_patronal > 0).map(b => {
                          const col = b.code === 'TUS' ? '#D97706' : '#DC2626'
                          const montant = rows.reduce((s, r) => {
                            try {
                              const res = calculerChargesSociales({ codePays, salaireBrut: r.salaire_brut })
                              return s + (res.branches.find(rb => rb.code === b.code)?.montant_patronal ?? 0)
                            } catch { return s }
                          }, 0)
                          return (
                            <tr key={b.code} className="border-b border-[var(--border)]/50">
                              <td className="px-4 py-2" style={{ color: col }}>{b.libelle}</td>
                              <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{(b.taux_patronal * 100).toFixed(3)}%{b.plafond_mensuel ? ` · pl. ${fmt(b.plafond_mensuel)}` : ''}</td>
                              <td className="px-4 py-2 text-right font-semibold" style={{ color: col }}>{fmt(montant)}</td>
                            </tr>
                          )
                        })}
                        <tr className="bg-gray-50 border-t border-[var(--border)]">
                          <td className="px-4 py-2 font-bold text-[#101729]">Total charges patronales</td>
                          <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{(cfg.cnss.branches.filter(b => b.taux_patronal > 0).reduce((s, b) => s + b.taux_patronal, 0) * 100).toFixed(3)}%</td>
                          <td className="px-4 py-2 text-right font-bold text-[#DC2626]">{fmt(totalCnssP + totalTus)}</td>
                        </tr>
                        <tr className="bg-[#101729]/5">
                          <td className="px-4 py-2.5 font-bold text-[#101729]">Coût total employeur</td>
                          <td />
                          <td className="px-4 py-2.5 text-right font-bold text-[#101729] text-sm">{fmt(totalCout)} {cfg.devise}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] p-4 space-y-2.5">
                    <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Synthèse — {t(MONTH_KEYS[mois])} {annee}</p>
                    {[
                      { label: 'Brut total', value: fmt(totalBrut), color: '#101729' },
                      { label: 'Net total à verser', value: fmt(totalNet), color: '#16A34A' },
                      { label: `${cfg.cnss.acronyme} salarié à reverser`, value: fmt(totalCnssEmp), color: '#DC2626' },
                      { label: `${cfg.irpp.nom.split(' ')[0]} à reverser (DGI)`, value: fmt(totalIRPP), color: '#DC2626' },
                      { label: 'Charges patronales totales', value: fmt(totalCnssP + totalTus), color: '#D97706' },
                    ].map(k => (
                      <div key={k.label} className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-secondary)]">{k.label}</span>
                        <span className="font-bold" style={{ color: k.color }}>{k.value} {cfg.devise}</span>
                      </div>
                    ))}
                    <div className="mt-3 p-2.5 rounded-lg bg-[#2563EB]/8 border border-[#2563EB]/20">
                      <p className="text-[10px] text-[#2563EB] font-medium flex items-center gap-1">
                        <BarChart3 size={11} /> Écritures {cfg.systeme_comptable} générées automatiquement à la validation
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Upgrade notice (TPE) ──────────────────────────────────────────── */}
      {plan === 'tpe' && rows.length > 0 && (
        <div className="rounded-xl border border-dashed border-[#F59E0B]/50 bg-[#F59E0B]/5 p-4 flex items-start gap-3">
          <Lock size={15} className="text-[#D97706] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#D97706]">Fonctionnalités avancées — Plan Business</p>
            <p className="text-xs text-[#92400E] mt-0.5">
              Détail bulletin éditable (toutes les primes, heures supp., avantages nature), téléchargement PDF, charges patronales détaillées,
              synchronisation {cfg.systeme_comptable} et trésorerie — disponibles en Business ou Compagnie.
            </p>
          </div>
        </div>
      )}

      {/* ── Acomptes ──────────────────────────────────────────────────────── */}
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
                    <td className="px-4 py-2 font-medium text-[#101729]">{a.employe_nom}</td>
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

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showLancerModal && (
          <ModalLancerPaie rows={rows} mois={mois} annee={annee} saving={saving} erreur={erreurSave} cfg={cfg}
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
