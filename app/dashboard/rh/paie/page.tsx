'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign, Users, Printer, RefreshCw, Check,
  AlertTriangle, Loader2, FileText, Eye, Calendar,
  X, ChevronLeft, ChevronRight, TrendingUp, Building2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { captureSupabaseError } from '@/lib/monitoring'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Employe {
  id: string
  nom: string
  poste: string
  contrat: string
  salaire_base: number
  cnss: string
  statut: string
}

interface BulletinRow {
  employe_id: string
  nom: string
  poste: string
  contrat: string
  cnss_num: string
  salaire_base: number
  primes: number
  heures_sup: number
  taux_horaire: number
  brut: number
  cnss_salarie: number
  cnss_patronal: number
  irpp: number
  net: number
  statut: 'generee' | 'validee' | 'payee'
  existingId?: string
}

// ── Constantes Congo-Brazzaville ───────────────────────────────────────────────

const TAUX_CNSS_SALARIE  = 0.0504
const TAUX_CNSS_PATRONAL = 0.1416
const PLAFOND_CNSS       = 3_375_000

const MOIS_LABELS = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

// ── Fonctions de calcul ────────────────────────────────────────────────────────

function calcIRPP(imposable: number): number {
  if (imposable <= 50_000)  return 0
  if (imposable <= 100_000) return (imposable - 50_000) * 0.01
  if (imposable <= 250_000) return 500 + (imposable - 100_000) * 0.10
  if (imposable <= 500_000) return 15_500 + (imposable - 250_000) * 0.20
  return 65_500 + (imposable - 500_000) * 0.30
}

function calcBulletin(salaire_base: number, primes: number, heures_sup: number, taux_horaire: number) {
  const brut         = Math.round(salaire_base + primes + heures_sup * taux_horaire)
  const base_cnss    = Math.min(brut, PLAFOND_CNSS)
  const cnss_salarie = Math.round(base_cnss * TAUX_CNSS_SALARIE)
  const cnss_patro   = Math.round(base_cnss * TAUX_CNSS_PATRONAL)
  const irpp         = Math.round(calcIRPP((brut - cnss_salarie) * 0.9))
  const net          = brut - cnss_salarie - irpp
  return { brut, cnss_salarie, cnss_patronal: cnss_patro, irpp, net }
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n))
}

// ── Impression du bulletin ─────────────────────────────────────────────────────

function printBulletin(row: BulletinRow, mois: number, annee: number, entreprise: string) {
  const w = window.open('', '_blank', 'width=800,height=1000')
  if (!w) return
  w.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Bulletin de paie — ${row.nom}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: #fff; }
    .page { max-width: 700px; margin: 0 auto; padding: 32px 28px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 18px; }
    .logo { font-size: 22px; font-weight: 800; color: #111; letter-spacing: -0.5px; }
    .logo span { color: #16A34A; }
    .period { text-align: right; }
    .period h2 { font-size: 14px; font-weight: 700; }
    .period p { color: #555; font-size: 10px; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .box { background: #f7f7f7; border-radius: 6px; padding: 12px; }
    .box h3 { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; }
    .box p { line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    thead th { background: #111; color: #fff; padding: 7px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    tbody tr:nth-child(even) { background: #f9f9f9; }
    tbody td { padding: 7px 10px; border-bottom: 1px solid #eee; }
    .sep { border-top: 2px solid #111; }
    .total-row td { font-weight: 700; padding: 9px 10px; background: #f0f0f0; }
    .net-box { background: #111; color: #fff; border-radius: 8px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .net-box .label { font-size: 12px; opacity: 0.7; }
    .net-box .amount { font-size: 22px; font-weight: 800; }
    .footer { text-align: center; font-size: 9px; color: #aaa; border-top: 1px solid #eee; padding-top: 12px; margin-top: 8px; }
    .mention { font-size: 9px; color: #888; margin-bottom: 4px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="logo">ora<span>forme</span></div>
      <div style="font-size:10px;color:#555;margin-top:4px">${entreprise}</div>
    </div>
    <div class="period">
      <h2>BULLETIN DE PAIE</h2>
      <p>${MOIS_LABELS[mois]} ${annee}</p>
      <p style="margin-top:4px;font-size:9px">Édité le ${new Date().toLocaleDateString('fr-FR')}</p>
    </div>
  </div>

  <div class="parties">
    <div class="box">
      <h3>Employeur</h3>
      <p><strong>${entreprise}</strong></p>
      <p>République du Congo</p>
      <p>Brazzaville</p>
    </div>
    <div class="box">
      <h3>Employé</h3>
      <p><strong>${row.nom}</strong></p>
      <p>${row.poste}</p>
      <p>N° CNSS : ${row.cnss_num || '—'}</p>
      <p>Contrat : ${row.contrat?.toUpperCase()}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr><th>Élément</th><th style="text-align:right">Montant (FCFA)</th></tr>
    </thead>
    <tbody>
      <tr><td>Salaire de base</td><td style="text-align:right">${fmt(row.salaire_base)}</td></tr>
      ${row.primes > 0 ? `<tr><td>Primes & indemnités</td><td style="text-align:right">${fmt(row.primes)}</td></tr>` : ''}
      ${row.heures_sup > 0 ? `<tr><td>Heures supplémentaires (${row.heures_sup}h × ${fmt(row.taux_horaire)} FCFA)</td><td style="text-align:right">${fmt(row.heures_sup * row.taux_horaire)}</td></tr>` : ''}
      <tr class="total-row"><td>SALAIRE BRUT</td><td style="text-align:right">${fmt(row.brut)}</td></tr>
    </tbody>
  </table>

  <table>
    <thead>
      <tr><th>Cotisations</th><th style="text-align:right">Part salarié</th><th style="text-align:right">Part patronale</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>CNSS (base plafonnée à ${fmt(Math.min(row.brut, PLAFOND_CNSS))} FCFA)</td>
        <td style="text-align:right">− ${fmt(row.cnss_salarie)}<br><span style="font-size:9px;color:#888">taux 5,04 %</span></td>
        <td style="text-align:right">${fmt(row.cnss_patronal)}<br><span style="font-size:9px;color:#888">taux 14,16 %</span></td>
      </tr>
      <tr>
        <td>IRPP (tranche progressive)</td>
        <td style="text-align:right">− ${fmt(row.irpp)}</td>
        <td style="text-align:right">—</td>
      </tr>
      <tr class="total-row sep">
        <td>Total retenues salariales</td>
        <td style="text-align:right">− ${fmt(row.cnss_salarie + row.irpp)}</td>
        <td style="text-align:right">${fmt(row.cnss_patronal)}</td>
      </tr>
    </tbody>
  </table>

  <div class="net-box">
    <div>
      <div class="label">NET À PAYER</div>
      <div style="font-size:10px;opacity:0.5;margin-top:2px">Arrêté à la somme de ${fmt(row.net)} francs CFA</div>
    </div>
    <div class="amount">${fmt(row.net)} FCFA</div>
  </div>

  <p class="mention">Coût total employeur : ${fmt(row.brut + row.cnss_patronal)} FCFA</p>
  <p class="mention">Ce bulletin est établi conformément au Code du travail de la République du Congo et aux décrets CNSS en vigueur.</p>

  <div class="footer">
    Généré par oraforme · ${new Date().toLocaleString('fr-FR')} · Conservez ce document pendant 5 ans
  </div>
</div>
<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`)
  w.document.close()
}

// ── Composant KPI ──────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string
  color: string; icon: React.ElementType
}) {
  return (
    <motion.div
      className="rounded-xl border border-[var(--border)] p-4 flex gap-3 items-start"
      style={{ background: '#FFFFFF' }}
      whileHover={{ scale: 1.02, y: -1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
    >
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

// ── Statut badge ───────────────────────────────────────────────────────────────

function StatutBulletin({ statut }: { statut: string }) {
  const MAP: Record<string, { label: string; color: string; bg: string }> = {
    generee: { label: 'Générée',  color: '#DC2626', bg: '#DC262618' },
    validee: { label: 'Validée',  color: '#DC2626', bg: '#DC262618' },
    payee:   { label: 'Payée',    color: '#16A34A', bg: '#16A34A18' },
  }
  const s = MAP[statut] ?? MAP.generee
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: s.color, backgroundColor: s.bg }}>
      {s.label}
    </span>
  )
}

// ── Input numérique inline ─────────────────────────────────────────────────────

function NumInput({ value, onChange, disabled }: {
  value: number; onChange: (v: number) => void; disabled?: boolean
}) {
  return (
    <input
      type="number"
      min="0"
      value={value || ''}
      onChange={e => onChange(Number(e.target.value) || 0)}
      disabled={disabled}
      className="w-24 bg-[var(--surface)] border border-[var(--border)] rounded-md px-2 py-1 text-xs text-[#101729] text-right
                 focus:outline-none focus:border-[#00b9a7] disabled:opacity-40 disabled:cursor-not-allowed"
    />
  )
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function PaiePage() {
  const { tenantId, loading: loadingTenant } = useTenant()
  const { t, locale } = useLocale()

  const now = new Date()
  const [mois,  setMois]  = useState(now.getMonth() + 1)
  const [annee, setAnnee] = useState(now.getFullYear())

  const [employes, setEmployes]   = useState<Employe[]>([])
  const [rows,     setRows]       = useState<BulletinRow[]>([])
  const [loading,  setLoading]    = useState(false)
  const [saving,   setSaving]     = useState(false)
  const [saved,    setSaved]      = useState(false)
  const [entreprise, setEntreprise] = useState('Mon Entreprise')

  // ── Chargement ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    const [{ data: emps, error: empsErr }, { data: buls, error: bulsErr }, { data: tenant }] = await Promise.all([
      supabase
        .from('employes')
        .select('id,nom,poste,contrat,salaire_base,cnss,statut')
        .eq('tenant_id', tenantId)
        .eq('statut', 'actif')
        .order('nom'),
      supabase
        .from('bulletins_paie')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('mois', mois)
        .eq('annee', annee),
      supabase
        .from('tenants')
        .select('nom_entreprise')
        .eq('id', tenantId)
        .limit(1)
        .maybeSingle(),
    ])

    captureSupabaseError('load employes', empsErr, { module: 'rh/paie', tenant_id: tenantId })
    captureSupabaseError('load bulletins_paie', bulsErr, { module: 'rh/paie', tenant_id: tenantId })
    if (tenant?.nom_entreprise) setEntreprise(tenant.nom_entreprise)

    const empList: Employe[] = emps ?? []
    setEmployes(empList)

    const bulMap = new Map((buls ?? []).map((b: Record<string, unknown>) => [b.employe_id as string, b]))

    setRows(empList.map(e => {
      const existing = bulMap.get(e.id)
      if (existing) {
        return {
          employe_id:    e.id,
          nom:           e.nom,
          poste:         e.poste,
          contrat:       e.contrat,
          cnss_num:      e.cnss,
          salaire_base:  existing.salaire_base as number,
          primes:        existing.primes as number,
          heures_sup:    existing.heures_sup as number,
          taux_horaire:  existing.taux_horaire as number,
          brut:          existing.brut as number,
          cnss_salarie:  existing.cnss_salarie as number,
          cnss_patronal: existing.cnss_patronal as number,
          irpp:          existing.irpp as number,
          net:           existing.net as number,
          statut:        (existing.statut as 'generee' | 'validee' | 'payee') ?? 'generee',
          existingId:    existing.id as string,
        }
      }
      const calc = calcBulletin(e.salaire_base, 0, 0, 0)
      return {
        employe_id:   e.id,
        nom:          e.nom,
        poste:        e.poste,
        contrat:      e.contrat,
        cnss_num:     e.cnss,
        salaire_base: e.salaire_base,
        primes:       0,
        heures_sup:   0,
        taux_horaire: 0,
        statut:       'generee',
        ...calc,
      }
    }))

    setLoading(false)
  }, [tenantId, mois, annee])

  useEffect(() => { load() }, [load])

  // ── Mise à jour d'une ligne ─────────────────────────────────────────────────

  function updateRow(id: string, field: 'primes' | 'heures_sup' | 'taux_horaire', val: number) {
    setRows(prev => prev.map(r => {
      if (r.employe_id !== id) return r
      const next = { ...r, [field]: val }
      const calc = calcBulletin(next.salaire_base, next.primes, next.heures_sup, next.taux_horaire)
      return { ...next, ...calc }
    }))
  }

  function updateStatut(id: string, statut: 'generee' | 'validee' | 'payee') {
    setRows(prev => prev.map(r => r.employe_id === id ? { ...r, statut } : r))
  }

  // ── Génération en masse ─────────────────────────────────────────────────────

  async function genererToutesPaies() {
    if (!tenantId) return
    setSaving(true)
    const toUpsert = rows.map(r => ({
      tenant_id:     tenantId,
      employe_id:    r.employe_id,
      mois,
      annee,
      salaire_base:  r.salaire_base,
      primes:        r.primes,
      heures_sup:    r.heures_sup,
      taux_horaire:  r.taux_horaire,
      brut:          r.brut,
      cnss_salarie:  r.cnss_salarie,
      cnss_patronal: r.cnss_patronal,
      irpp:          r.irpp,
      net:           r.net,
      statut:        r.statut,
    }))

    await supabase
      .from('bulletins_paie')
      .upsert(toUpsert, { onConflict: 'employe_id,mois,annee' })

    // Sync bulletins marqués "payee" vers trésorerie (déduplication par source_id)
    const payees = rows.filter(r => r.statut === 'payee')
    if (payees.length > 0) {
      const sourceIds = payees.map(r => `bulletin_${r.employe_id}_${mois}_${annee}`)
      const { data: existing } = await supabase
        .from('transactions')
        .select('source_id')
        .eq('tenant_id', tenantId)
        .eq('source', 'bulletin_paie')
        .in('source_id', sourceIds)
      const existingIds = new Set((existing ?? []).map((e: { source_id: string }) => e.source_id))
      const toInsert = payees
        .filter(r => !existingIds.has(`bulletin_${r.employe_id}_${mois}_${annee}`))
        .map(r => ({
          tenant_id:     tenantId,
          type:          'sortie',
          categorie:     'Salaires & CNSS',
          description:   `Paie ${r.nom} — ${mois.toString().padStart(2, '0')}/${annee}`,
          montant:       r.net,
          date:          new Date(annee, mois - 1, 28).toISOString().split('T')[0],
          mode_paiement: 'virement',
          source:        'bulletin_paie',
          source_id:     `bulletin_${r.employe_id}_${mois}_${annee}`,
        }))
      if (toInsert.length > 0) {
        await supabase.from('transactions').insert(toInsert)
      }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    load()
  }

  // ── Navigation de période ───────────────────────────────────────────────────

  function prevMois() {
    if (mois === 1) { setMois(12); setAnnee(a => a - 1) }
    else setMois(m => m - 1)
  }
  function nextMois() {
    const today = new Date()
    if (annee > today.getFullYear() || (annee === today.getFullYear() && mois >= today.getMonth() + 1)) return
    if (mois === 12) { setMois(1); setAnnee(a => a + 1) }
    else setMois(m => m + 1)
  }

  // ── Totaux ─────────────────────────────────────────────────────────────────

  const totalBrut   = rows.reduce((s, r) => s + r.brut, 0)
  const totalNet    = rows.reduce((s, r) => s + r.net, 0)
  const totalPatro  = rows.reduce((s, r) => s + r.cnss_patronal, 0)
  const totalIRPP   = rows.reduce((s, r) => s + r.irpp, 0)
  const totalCout   = totalBrut + totalPatro

  const isCurrentMonth = mois === now.getMonth() + 1 && annee === now.getFullYear()
  const notYetGenerated = rows.length > 0 && rows.every(r => !r.existingId)

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loadingTenant) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">
        <Loader2 className="animate-spin mr-2" size={18} /> {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#101729]">{t('rh.paie.title')}</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {t('rh.paie.subtitle')}
          </p>
        </div>

        {/* Sélecteur de période */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevMois}
            className="p-1.5 rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729] hover:border-[#00b9a7]/40 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5">
            <Calendar size={13} className="text-[#DC2626]" />
            <select
              value={mois}
              onChange={e => setMois(Number(e.target.value))}
              className="bg-transparent text-[#101729] text-sm font-medium focus:outline-none cursor-pointer"
            >
              {MOIS_LABELS.slice(1).map((m, i) => (
                <option key={i+1} value={i+1} className="bg-[var(--card-bg)]">{m}</option>
              ))}
            </select>
            <select
              value={annee}
              onChange={e => setAnnee(Number(e.target.value))}
              className="bg-transparent text-[#101729] text-sm font-medium focus:outline-none cursor-pointer"
            >
              {[2023, 2024, 2025, 2026].map(y => (
                <option key={y} value={y} className="bg-[var(--card-bg)]">{y}</option>
              ))}
            </select>
          </div>
          <button
            onClick={nextMois}
            className="p-1.5 rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729] hover:border-[#00b9a7]/40 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={load}
            className="p-1.5 rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#101729] hover:border-[#00b9a7]/40 transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Alerte paie non générée */}
      <AnimatePresence>
        {isCurrentMonth && notYetGenerated && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 bg-[#DC2626]/10 border border-[#DC2626]/30 rounded-xl px-4 py-3">
              <AlertTriangle size={15} className="text-[#DC2626] shrink-0" />
              <p className="text-sm text-[#DC2626]">
                La paie de <strong>{MOIS_LABELS[mois]} {annee}</strong> n&apos;a pas encore été générée.
                Vérifiez les primes et heures supplémentaires puis cliquez sur &quot;Générer toutes les paies&quot;.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label={t('rh.paie.kpi.masseSalariale')}
          value={`${fmt(totalBrut)} FCFA`}
          sub={`${rows.length} employés actifs`}
          color="#DC2626"
          icon={DollarSign}
        />
        <KpiCard
          label={t('rh.paie.kpi.net')}
          value={`${fmt(totalNet)} FCFA`}
          sub={`Économie salariés : ${fmt(totalBrut - totalNet)} FCFA`}
          color="#16A34A"
          icon={TrendingUp}
        />
        <KpiCard
          label={t('rh.paie.kpi.cnss')}
          value={`${fmt(totalPatro)} FCFA`}
          sub="Taux 14,16 % plafonné"
          color="#DC2626"
          icon={Building2}
        />
        <KpiCard
          label={t('rh.paie.kpi.employes')}
          value={`${fmt(totalCout)} FCFA`}
          sub={`IRPP total : ${fmt(totalIRPP)} FCFA`}
          color="#DC2626"
          icon={Users}
        />
      </div>

      {/* Bouton générer */}
      <div className="flex justify-end">
        <motion.button
          onClick={genererToutesPaies}
          disabled={saving || rows.length === 0}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
          style={{
            background: saved
              ? '#238636'
              : '#DC2626',
            boxShadow: saved
              ? '0 0 20px #16A34A40'
              : '0 0 20px #DC262640',
          }}
        >
          {saving ? (
            <><Loader2 className="animate-spin" size={15} /> {t('common.loading')}</>
          ) : saved ? (
            <><Check size={15} /> {t('common.save')} !</>
          ) : (
            <><FileText size={15} /> {t('rh.paie.run')} — {MOIS_LABELS[mois]} {annee}</>
          )}
        </motion.button>
      </div>

      {/* Tableau principal */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-[var(--text-secondary)]">
          <Loader2 className="animate-spin mr-2" size={16} /> {t('common.loading')}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-secondary)]">
          <Users size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t('rh.paie.noPayroll')}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]" style={{ background: '#F9FAFB' }}>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Employé</th>
                  <th className="text-right px-3 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Base</th>
                  <th className="text-right px-3 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Primes</th>
                  <th className="text-right px-3 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider min-w-[160px]">Heures sup</th>
                  <th className="text-right px-3 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Brut</th>
                  <th className="text-right px-3 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">CNSS sal.</th>
                  <th className="text-right px-3 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">IRPP</th>
                  <th className="text-right px-3 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-[#16A34A]">Net</th>
                  <th className="text-right px-3 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Patro.</th>
                  <th className="text-center px-3 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Statut</th>
                  <th className="text-center px-3 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <motion.tr
                    key={row.employe_id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                    className="border-b border-[var(--border)] hover:bg-gray-50 transition-colors"
                  >
                    {/* Employé */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                          style={{
                            background: `hsl(${row.nom.charCodeAt(0) * 7 % 360}, 55%, 38%)`,
                            color: '#fff',
                          }}
                        >
                          {row.nom.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white text-xs font-medium leading-tight">{row.nom}</p>
                          <p className="text-[var(--text-secondary)] text-[10px]">{row.poste}</p>
                        </div>
                      </div>
                    </td>

                    {/* Base */}
                    <td className="px-3 py-3 text-right text-xs text-[var(--text-secondary)]">
                      {fmt(row.salaire_base)}
                    </td>

                    {/* Primes */}
                    <td className="px-3 py-3 text-right">
                      <NumInput
                        value={row.primes}
                        onChange={v => updateRow(row.employe_id, 'primes', v)}
                        disabled={row.statut === 'payee'}
                      />
                    </td>

                    {/* Heures sup */}
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <NumInput
                          value={row.heures_sup}
                          onChange={v => updateRow(row.employe_id, 'heures_sup', v)}
                          disabled={row.statut === 'payee'}
                        />
                        <span className="text-[10px] text-[var(--text-secondary)]">×</span>
                        <NumInput
                          value={row.taux_horaire}
                          onChange={v => updateRow(row.employe_id, 'taux_horaire', v)}
                          disabled={row.statut === 'payee'}
                        />
                      </div>
                    </td>

                    {/* Brut */}
                    <td className="px-3 py-3 text-right text-xs font-semibold text-[#101729]">
                      {fmt(row.brut)}
                    </td>

                    {/* CNSS salarié */}
                    <td className="px-3 py-3 text-right text-xs text-[#DC2626]">
                      −{fmt(row.cnss_salarie)}
                    </td>

                    {/* IRPP */}
                    <td className="px-3 py-3 text-right text-xs text-[#DC2626]">
                      −{fmt(row.irpp)}
                    </td>

                    {/* Net */}
                    <td className="px-3 py-3 text-right text-xs font-bold text-[#16A34A]">
                      {fmt(row.net)}
                    </td>

                    {/* Patronal */}
                    <td className="px-3 py-3 text-right text-xs text-[var(--text-secondary)]">
                      {fmt(row.cnss_patronal)}
                    </td>

                    {/* Statut */}
                    <td className="px-3 py-3 text-center">
                      <select
                        value={row.statut}
                        onChange={e => updateStatut(row.employe_id, e.target.value as 'generee' | 'validee' | 'payee')}
                        className="bg-transparent text-[10px] focus:outline-none cursor-pointer"
                        style={{
                          color: row.statut === 'payee' ? '#16A34A' : row.statut === 'validee' ? '#DC2626' : '#DC2626',
                        }}
                      >
                        <option value="generee"  className="bg-[var(--card-bg)] text-[#DC2626]">Générée</option>
                        <option value="validee"  className="bg-[var(--card-bg)] text-[#DC2626]">Validée</option>
                        <option value="payee"    className="bg-[var(--card-bg)] text-[#16A34A]">Payée</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => printBulletin(row, mois, annee, entreprise)}
                          title={t('common.print')}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium
                                     bg-[var(--surface)] hover:bg-gray-200 text-[var(--text-secondary)] hover:text-[#101729]
                                     border border-[var(--border)] transition-colors"
                        >
                          <Printer size={11} />
                          {t('common.print')}
                        </button>
                        {row.existingId && (
                          <button
                            onClick={async () => {
                              const res = await fetch(`/api/rh/paie/${row.existingId}/bulletin-pdf`)
                              if (!res.ok) return
                              const blob = await res.blob()
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `bulletin-${row.nom}-${MOIS_LABELS[mois]}-${annee}.pdf`
                              a.click()
                              URL.revokeObjectURL(url)
                            }}
                            title="Télécharger PDF"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium
                                       bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#DC2626]
                                       border border-[#DC2626]/20 transition-colors"
                          >
                            <FileText size={11} />
                            PDF
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>

              {/* Ligne totaux */}
              <tfoot>
                <tr style={{ background: '#F9FAFB', borderTop: '1px solid #E5E7EB' }}>
                  <td className="px-4 py-3 text-xs font-bold text-[#101729]">
                    TOTAUX ({rows.length} employés)
                  </td>
                  <td className="px-3 py-3 text-right text-xs text-[var(--text-secondary)] font-semibold">
                    {fmt(rows.reduce((s, r) => s + r.salaire_base, 0))}
                  </td>
                  <td className="px-3 py-3 text-right text-xs text-[var(--text-secondary)] font-semibold">
                    {fmt(rows.reduce((s, r) => s + r.primes, 0))}
                  </td>
                  <td />
                  <td className="px-3 py-3 text-right text-xs font-bold text-[#101729]">
                    {fmt(totalBrut)}
                  </td>
                  <td className="px-3 py-3 text-right text-xs font-bold text-[#DC2626]">
                    −{fmt(rows.reduce((s, r) => s + r.cnss_salarie, 0))}
                  </td>
                  <td className="px-3 py-3 text-right text-xs font-bold text-[#DC2626]">
                    −{fmt(totalIRPP)}
                  </td>
                  <td className="px-3 py-3 text-right text-xs font-bold text-[#16A34A]">
                    {fmt(totalNet)}
                  </td>
                  <td className="px-3 py-3 text-right text-xs font-bold text-[var(--text-secondary)]">
                    {fmt(totalPatro)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Résumé coût total */}
      {rows.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          <div className="col-span-full md:col-span-2 rounded-xl border border-[var(--border)] p-4"
               style={{ background: '#F9FAFB' }}>
            <p className="text-xs text-[var(--text-secondary)] mb-3 font-semibold uppercase tracking-wider">
              Récapitulatif — {MOIS_LABELS[mois]} {annee}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-[10px] text-[var(--text-secondary)]">Brut total</p>
                <p className="font-bold text-[#101729]">{fmt(totalBrut)} FCFA</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--text-secondary)]">CNSS salarié total</p>
                <p className="font-bold text-[#DC2626]">{fmt(rows.reduce((s, r) => s + r.cnss_salarie, 0))} FCFA</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--text-secondary)]">IRPP total</p>
                <p className="font-bold text-[#DC2626]">{fmt(totalIRPP)} FCFA</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--text-secondary)]">Net à payer</p>
                <p className="font-bold text-[#16A34A]">{fmt(totalNet)} FCFA</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#16A34A]/30 p-4 flex flex-col justify-between"
               style={{ background: 'rgba(46,160,67,0.06)' }}>
            <p className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider mb-2">Coût employeur total</p>
            <div>
              <p className="text-2xl font-bold text-[#101729]">{fmt(totalCout)}</p>
              <p className="text-xs text-[var(--text-secondary)]">FCFA · dont CNSS patro {fmt(totalPatro)} FCFA</p>
            </div>
            <button
              onClick={genererToutesPaies}
              disabled={saving}
              className="mt-3 w-full py-2 rounded-lg text-xs font-semibold text-[#16A34A] border border-[#16A34A]/40
                         hover:bg-[#16A34A]/10 transition-colors disabled:opacity-50"
            >
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
