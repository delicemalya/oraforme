'use client'

/**
 * Dashboard Comptable OHADA — Vue d'ensemble financière premium
 * KPIs temps réel · Graphiques · Alertes · Accès rapide aux modules
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { resolveAccounts, type AccountCode } from '@/lib/accounting-engine'
import { COMPTES_PLATS } from '@/lib/syscohada/plan-comptable'
import { useFmt } from '@/lib/hooks/useFmt'
import { getCountryConfig } from '@/lib/countries'
import type { CodePays } from '@/lib/countries/types'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, Scale, AlertTriangle,
  BookOpen, BarChart2, GitMerge, Percent, Lock, Download,
  List, Users, Layers, Package, Plus, X, ChevronRight,
  CheckCircle2, ArrowUpRight, ArrowDownRight, Activity,
} from 'lucide-react'
import { useLocale } from '@/lib/hooks/useLocale'
import MIAAContextButton from '@/components/miaa/MIAAContextButton'

/* ─── Types ─────────────────────────────────────────────── */
interface JournalEntry {
  id: string; date: string; libelle: string
  type: 'recette' | 'depense'
  montant_ht: number; tva: number; ca: number; montant_ttc: number
  categorie: string; debit_account?: string; credit_account?: string
  created_at: string
}
interface DoubleEntry {
  id: string; date_operation: string; libelle: string
  debit_account: string; credit_account: string
  montant: number; source?: string; created_at: string
}

/* ─── Helpers ────────────────────────────────────────────── */
function calcTVA(ht: number, codePays: string | null) {
  const cfg = codePays ? getCountryConfig(codePays as CodePays) : null
  const tauxTVA = cfg?.tva?.taux_normal ?? 0.18
  const taxeAdd = cfg?.tva?.taxes_additionnelles?.find(t => t.base === 'tva_collectee')
  const tauxCA  = taxeAdd?.taux ?? 0
  const tva = Math.round(ht * tauxTVA)
  const ca  = Math.round(tva * tauxCA)
  return { tva, ca, ttc: ht + tva + ca, tauxTVA, tauxCA, libelleCA: taxeAdd?.libelle ?? null }
}

const CATS_RECETTE = ["Vente / Chiffre d'affaires", 'Frais de scolarité', 'Prestation de services', 'Virement reçu', 'Autre recette']
const CATS_DEPENSE = ['Salaires', 'CNSS', 'Achats / Fournisseur', 'Loyer', 'Impôts / Taxes', 'Charges diverses', 'Frais bancaires', 'Autre dépense']

/* ─── Main Page ──────────────────────────────────────────── */
export default function ComptabilitePage() {
  const router = useRouter()
  const { tenant: tenantCtx, loading: tenantCtxLoading } = useTenantContext()
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId, pays } = useTenant()
  const { t, locale } = useLocale()

  // Plan gate — redirect non-PME/Grande tenants who navigate directly to this URL
  useEffect(() => {
    if (!tenantCtxLoading && tenantCtx !== null && !tenantCtx.modulesActifs.includes('comptabilite')) {
      router.replace('/dashboard')
    }
  }, [tenantCtxLoading, tenantCtx, router])

  /* ─── Locale-aware month names ───────────────────────────── */
  const intlLocale = locale === 'fr' ? 'fr-FR' : locale === 'en' ? 'en-GB' : locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : locale === 'de' ? 'de-DE' : 'fr-FR'
  const MONTHS_FR = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(intlLocale, { month: 'short' }).format(new Date(2024, i, 1))),
    [intlLocale]
  )

  /* ─── Modules quick-access (inside component for i18n) ───── */
  const COMPTA_QUICK = [
    { href: '/dashboard/comptabilite/journal',         label: t('compta.overview.journal'),         icon: BookOpen,   color: '#2563EB', desc: 'Écritures chronologiques'   },
    { href: '/dashboard/comptabilite/grand-livre',     label: 'Grand Livre',                        icon: Scale,      color: '#16A34A', desc: 'Solde par compte'            },
    { href: '/dashboard/comptabilite/balance',         label: 'Balance',                            icon: BarChart2,  color: '#8B5CF6', desc: 'Totaux débit/crédit'        },
    { href: '/dashboard/comptabilite/bilan',           label: 'Bilan & Résultat',                   icon: TrendingUp, color: '#F59E0B', desc: 'États financiers SYSCOHADA'  },
    { href: '/dashboard/comptabilite/plan-comptable',  label: 'Plan Comptable',                     icon: List,       color: '#0891B2', desc: 'Comptes SYSCOHADA Classes 1-9' },
    { href: '/dashboard/comptabilite/tiers',           label: 'Tiers',                              icon: Users,      color: '#D97706', desc: 'Clients & fournisseurs'      },
    { href: '/dashboard/comptabilite/immobilisations', label: 'Immobilisations',                    icon: Package,    color: '#DC2626', desc: 'Amortissements auto'         },
    { href: '/dashboard/comptabilite/tva',             label: t('compta.overview.kpi.tva'),         icon: Percent,    color: '#0F172A', desc: 'Déclarations TVA Congo'       },
    { href: '/dashboard/comptabilite/rapprochement',   label: 'Rapprochement',                      icon: GitMerge,   color: '#64748B', desc: 'Banques & caisses'           },
    { href: '/dashboard/comptabilite/cloture',         label: 'Clôture',                            icon: Lock,       color: '#7C3AED', desc: 'Clôture mensuelle/annuelle'  },
    { href: '/dashboard/comptabilite/rapports',          label: 'Rapports',           icon: Download,     color: '#059669', desc: 'PDF · Excel · SYSCOHADA'        },
    { href: '/dashboard/comptabilite/centres-couts',    label: 'Centres de coûts',   icon: Layers,       color: '#EA580C', desc: 'Analytique par projet'            },
    { href: '/dashboard/comptabilite/flux-tresorerie',  label: 'Flux de trésorerie', icon: Activity,     color: '#0891B2', desc: 'Tableau ZA/ZB/ZC SYSCOHADA'      },
    { href: '/dashboard/comptabilite/annexes',          label: 'Notes annexes',      icon: BookOpen,     color: '#7C3AED', desc: '10 notes OHADA obligatoires'     },
    { href: '/dashboard/comptabilite/devises',          label: 'Multi-devises',      icon: ArrowUpRight, color: '#D97706', desc: 'Taux de change · XAF/EUR/USD'    },
  ]

  /* State */
  const [recettesTotal,  setRecettesTotal]  = useState(0)
  const [depensesTotal,  setDepensesTotal]  = useState(0)
  const [tvaCollectee,   setTvaCollectee]   = useState(0)
  const [recentEntries,  setRecentEntries]  = useState<JournalEntry[]>([])
  const [recentDouble,   setRecentDouble]   = useState<DoubleEntry[]>([])
  const [monthlyData,    setMonthlyData]    = useState<{ label: string; recettes: number; depenses: number }[]>([])
  const [loading,        setLoading]        = useState(true)
  const [loadErr,        setLoadErr]        = useState<string | null>(null)
  const [showModal,      setShowModal]      = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [saveOk,         setSaveOk]         = useState(false)
  const [saveErr,        setSaveErr]        = useState<string | null>(null)

  /* Form */
  const [formType,    setFormType]    = useState<'recette'|'depense'>('recette')
  const [formLibelle, setFormLibelle] = useState('')
  const [formMontant, setFormMontant] = useState('')
  const [formDate,    setFormDate]    = useState(new Date().toISOString().slice(0, 10))
  const [formCat,     setFormCat]     = useState('')
  const [formDebit,   setFormDebit]   = useState<AccountCode>('')
  const [formCredit,  setFormCredit]  = useState<AccountCode>('')

  /* ── Load data ───────────────────────────────────────────── */
  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    const now   = new Date()
    const year  = now.getFullYear()

    const jcR = await supabase.from('journal_comptable')
      .select('*').eq('tenant_id', tenantId)
      .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)
      .order('date', { ascending: false }).limit(50000)

    const jeR = await supabase.from('journal_entries')
      .select('*').eq('tenant_id', tenantId)
      .gte('date_operation', `${year}-01-01`).lte('date_operation', `${year}-12-31`)
      .order('date_operation', { ascending: false }).limit(50000)

    if (jcR.error || jeR.error) {
      const msg = ((jcR.error ?? jeR.error)?.message ?? '')
      if (msg.includes('steal') || msg.includes('AbortError') || msg.includes('Lock')) {
        setTimeout(load, 400)
        return
      }
      setLoadErr(msg)
      setLoading(false)
      return
    }

    const all   = (jcR.data || []) as JournalEntry[]
    const allJE = (jeR.data || []) as DoubleEntry[]

    /* KPIs — journal_comptable (saisies manuelles directes) */
    const thisYear = all.filter(e => new Date(e.date).getFullYear() === year)
    const recJC = thisYear.filter(e => e.type === 'recette').reduce((s, e) => s + e.montant_ht, 0)
    const depJC = thisYear.filter(e => e.type === 'depense').reduce((s, e) => s + e.montant_ht, 0)
    const tvaJC = thisYear.filter(e => e.type === 'recette').reduce((s, e) => s + (e.tva || 0), 0)

    /* KPIs — journal_entries automatiques (factures, paie — absents de journal_comptable) */
    const autoJE  = allJE.filter(e => e.source && e.source !== 'manuel')
    const recJE   = autoJE.filter(e => e.credit_account?.startsWith('7')).reduce((s, e) => s + e.montant, 0)
    const depJE   = autoJE.filter(e => e.debit_account?.startsWith('6')).reduce((s, e) => s + e.montant, 0)
    const tvaJE   = autoJE.filter(e => ['4441', '443'].includes(e.credit_account)).reduce((s, e) => s + e.montant, 0)

    setRecettesTotal(recJC + recJE)
    setDepensesTotal(depJC + depJE)
    setTvaCollectee(tvaJC + tvaJE)
    setRecentEntries(all.slice(0, 10))
    setRecentDouble(allJE.slice(0, 10))

    /* Monthly data for chart (6 months) */
    const monthly: { label: string; recettes: number; depenses: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d   = new Date(year, now.getMonth() - i, 1)
      const m   = d.getMonth() + 1
      const y   = d.getFullYear()
      const mrec = all.filter(e => {
        const ed = new Date(e.date)
        return ed.getMonth() + 1 === m && ed.getFullYear() === y && e.type === 'recette'
      }).reduce((s, e) => s + e.montant_ht, 0)
      const mdep = all.filter(e => {
        const ed = new Date(e.date)
        return ed.getMonth() + 1 === m && ed.getFullYear() === y && e.type === 'depense'
      }).reduce((s, e) => s + e.montant_ht, 0)
      const mrecJE = autoJE.filter(e => {
        const ed = new Date(e.date_operation)
        return ed.getMonth() + 1 === m && ed.getFullYear() === y && e.credit_account?.startsWith('7')
      }).reduce((s, e) => s + e.montant, 0)
      const mdepJE = autoJE.filter(e => {
        const ed = new Date(e.date_operation)
        return ed.getMonth() + 1 === m && ed.getFullYear() === y && e.debit_account?.startsWith('6')
      }).reduce((s, e) => s + e.montant, 0)
      monthly.push({ label: MONTHS_FR[m - 1], recettes: Math.round((mrec + mrecJE) / 1000), depenses: Math.round((mdep + mdepJE) / 1000) })
    }
    setMonthlyData(monthly)
    setLoading(false)
  }, [tenantId, intlLocale])

  useEffect(() => { load() }, [load])

  /* Auto-resolve OHADA accounts */
  useEffect(() => {
    if (!formCat) return
    const [d, c] = resolveAccounts(formType === 'recette' ? 'entree' : 'sortie', formCat)
    setFormDebit(d); setFormCredit(c)
  }, [formType, formCat])

  /* ── Save operation ──────────────────────────────────────── */
  async function handleSave() {
    if (!tenantId || !formLibelle.trim() || !formMontant || !formCat) {
      setSaveErr('Libellé, montant et catégorie obligatoires')
      return
    }
    setSaving(true); setSaveErr(null)

    const ht  = Number(formMontant)
    const { tva, ca, ttc } = calcTVA(ht, pays)

    /* 1. journal_comptable */
    const { error: e1 } = await supabase.from('journal_comptable').insert({
      tenant_id: tenantId, date: formDate,
      libelle: formLibelle.trim(), type: formType,
      montant_ht: ht, tva, ca, montant_ttc: ttc,
      categorie: formCat,
      debit_account:  formDebit  || null,
      credit_account: formCredit || null,
    })
    if (e1) { setSaveErr(e1.message); setSaving(false); return }

    /* 2. journal_entries (double-entry) */
    if (formDebit && formCredit) {
      await supabase.from('journal_entries').insert({
        tenant_id: tenantId,
        date_operation: formDate,
        libelle: formLibelle.trim(),
        debit_account: formDebit,
        credit_account: formCredit,
        montant: ht,
        source: 'manuel',
        fiscal_year: new Date(formDate).getFullYear(),
      })
    }

    setSaveOk(true)
    setTimeout(() => { setSaveOk(false); setShowModal(false); resetForm(); load() }, 1200)
    setSaving(false)
  }

  function resetForm() {
    setFormType('recette'); setFormLibelle(''); setFormMontant('')
    setFormDate(new Date().toISOString().slice(0, 10)); setFormCat('')
    setFormDebit(''); setFormCredit(''); setSaveErr(null); setSaveOk(false)
  }

  /* ── Derived ─────────────────────────────────────────────── */
  const resultat    = recettesTotal - depensesTotal
  const tvaAReverse = Math.round(tvaCollectee * 0.85) // estimation après déductible

  /* ── Mini bar chart (pure CSS) ───────────────────────────── */
  function MiniChart() {
    const maxVal = Math.max(...monthlyData.flatMap(d => [d.recettes, d.depenses]), 1)
    return (
      <div className="flex items-end gap-2 h-28 pt-2">
        {monthlyData.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex gap-0.5 items-end justify-center" style={{ height: '80px' }}>
              <div className="flex-1 rounded-t transition-all"
                style={{ height: `${Math.max(3, (d.recettes / maxVal) * 76)}px`, background: '#16A34A', opacity: 0.85 }} />
              <div className="flex-1 rounded-t transition-all"
                style={{ height: `${Math.max(3, (d.depenses / maxVal) * 76)}px`, background: '#DC2626', opacity: 0.7 }} />
            </div>
            <span className="text-[9px] text-[#94A3B8]">{d.label}</span>
          </div>
        ))}
      </div>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-[#94A3B8]">
      <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mr-2" />
      {t('common.loading')}
    </div>
  )

  if (loadErr) return (
    <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl p-6 text-[#DC2626] text-[13px]">
      <strong>Erreur de chargement comptabilité :</strong> {loadErr}
    </div>
  )

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
            <Scale size={22} className="text-[#2563EB]" />
            {t('compta.overview.title')}
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            {t('compta.overview.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MIAAContextButton module="comptabilite" />
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12px] font-bold rounded-lg shadow-sm"
          >
            <Plus size={14} />
            {t('compta.overview.newEntry')}
          </button>
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: `${t('compta.overview.kpi.ca')} (HT)`,
            value: fmtFCFA(recettesTotal),
            icon: ArrowUpRight, color: '#16A34A',
            trend: recettesTotal > depensesTotal ? '▲ Excédent' : undefined,
          },
          {
            label: `${t('compta.overview.kpi.charges')} (HT)`,
            value: fmtFCFA(depensesTotal),
            icon: ArrowDownRight, color: '#DC2626',
          },
          {
            label: `${t('compta.overview.kpi.solde')} (HT)`,
            value: fmtFCFA(Math.abs(resultat)),
            icon: resultat >= 0 ? TrendingUp : TrendingDown,
            color: resultat >= 0 ? '#2563EB' : '#DC2626',
            trend: resultat >= 0 ? '✓ Bénéfice' : '⚠ Perte',
          },
          {
            label: t('compta.overview.kpi.tva'),
            value: fmtFCFA(tvaCollectee),
            icon: Percent, color: '#D97706',
            trend: tvaAReverse > 0 ? `~${fmtFCFA(tvaAReverse)} à reverser` : undefined,
          },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: k.color + '18' }}>
                <k.icon size={14} style={{ color: k.color }} />
              </div>
            </div>
            <div className="text-[20px] font-extrabold text-[#0F172A] truncate">{k.value}</div>
            <div className="text-[11px] text-[#64748B] mt-0.5">{k.label}</div>
            {k.trend && <div className="text-[10px] mt-1 font-semibold" style={{ color: k.color }}>{k.trend}</div>}
          </div>
        ))}
      </div>

      {/* ── Cashflow Chart + Résumé ───────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Chart */}
        <div className="sm:col-span-2 bg-white rounded-xl border border-[#E2E8F0] p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] font-bold text-[#0F172A]">Cashflow 6 mois</p>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#16A34A] inline-block" /> {t('compta.overview.kpi.ca')}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#DC2626] inline-block" /> {t('compta.overview.kpi.charges')}</span>
              <span className="text-[#94A3B8]">(en milliers FCFA)</span>
            </div>
          </div>
          {monthlyData.some(d => d.recettes > 0 || d.depenses > 0) ? (
            <MiniChart />
          ) : (
            <div className="h-28 flex items-center justify-center text-[12px] text-[#94A3B8]">
              Aucune donnée pour les 6 derniers mois
            </div>
          )}
        </div>

        {/* Résumé financier */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 flex flex-col gap-3">
          <p className="text-[13px] font-bold text-[#0F172A]">Résumé financier</p>
          {[
            { label: `${t('compta.overview.kpi.ca')} (HT)`,       value: recettesTotal,         color: '#16A34A' },
            { label: t('compta.overview.kpi.tva'),                  value: tvaCollectee,          color: '#D97706' },
            { label: `${t('compta.overview.kpi.charges')} (HT)`,   value: depensesTotal,         color: '#DC2626' },
            { label: `${t('compta.overview.kpi.solde')} (HT)`,     value: Math.abs(resultat),    color: resultat >= 0 ? '#2563EB' : '#DC2626' },
          ].map(r => (
            <div key={r.label} className="flex justify-between items-center py-1.5 border-b border-[#F1F5F9] last:border-0">
              <span className="text-[12px] text-[#64748B]">{r.label}</span>
              <span className="text-[12px] font-bold" style={{ color: r.color }}>
                {r.value > 0 ? fmtFCFA(r.value) : '—'}
              </span>
            </div>
          ))}
          <Link href="/dashboard/comptabilite/bilan"
            className="mt-1 flex items-center justify-center gap-1 py-2 bg-[#EFF6FF] text-[#2563EB] text-[11px] font-bold rounded-lg hover:bg-[#DBEAFE]">
            Voir le bilan complet <ChevronRight size={11} />
          </Link>
        </div>
      </div>

      {/* ── Alertes comptables ────────────────────────────────── */}
      {(tvaAReverse > 0 || recentEntries.length === 0) && (
        <div className="space-y-2">
          {tvaAReverse > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[#FEF3C7] border border-[#FDE68A]">
              <AlertTriangle size={14} className="text-[#D97706] shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-bold text-[#D97706]">{t('compta.overview.kpi.tva')} à reverser estimée : {fmtFCFA(tvaAReverse)}</p>
                <p className="text-[11px] text-[#D97706]/80">Pensez à déclarer votre TVA mensuelle dans le module Fiscalité.</p>
              </div>
              <Link href="/dashboard/comptabilite/tva" className="ml-auto text-[11px] font-bold text-[#D97706] underline whitespace-nowrap">
                Déclarer →
              </Link>
            </div>
          )}
          {recentEntries.length === 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE]">
              <Activity size={14} className="text-[#2563EB] shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#2563EB]">{t('compta.overview.noEntries')} — cliquez sur &quot;{t('compta.overview.newEntry')}&quot; pour commencer.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Quick module grid ─────────────────────────────────── */}
      <div>
        <h2 className="text-[14px] font-bold text-[#0F172A] mb-3">{t('compta.overview.modules')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {COMPTA_QUICK.map(mod => (
            <Link key={mod.href} href={mod.href}>
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group">
                <div className="w-9 h-9 rounded-xl mb-3 flex items-center justify-center" style={{ background: mod.color + '15' }}>
                  <mod.icon size={16} style={{ color: mod.color }} />
                </div>
                <p className="text-[12px] font-bold text-[#0F172A] group-hover:text-[#2563EB]">{mod.label}</p>
                <p className="text-[10px] text-[#94A3B8] mt-0.5">{mod.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Dernières écritures ───────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[13px] font-bold text-[#0F172A]">{t('compta.overview.recentEntries')}</p>
          <Link href="/dashboard/comptabilite/journal" className="text-[11px] text-[#2563EB] font-semibold hover:underline">
            Voir tout →
          </Link>
        </div>
        {recentEntries.length === 0 ? (
          <p className="text-center py-6 text-[12px] text-[#94A3B8]">{t('compta.overview.noEntries')}</p>
        ) : (
          <div className="space-y-1">
            {recentEntries.map(e => (
              <div key={e.id} className="flex items-center gap-3 py-2 border-b border-[#F1F5F9] last:border-0">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.type === 'recette' ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`} />
                <span className="text-[11px] text-[#94A3B8] w-20 shrink-0">
                  {new Date(e.date).toLocaleDateString(intlLocale, { day:'2-digit', month:'short' })}
                </span>
                <span className="text-[12px] text-[#0F172A] flex-1 truncate">{e.libelle}</span>
                <span className="text-[11px] text-[#94A3B8] truncate hidden sm:block w-24">{e.categorie}</span>
                <span className={`text-[12px] font-bold shrink-0 ${e.type === 'recette' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                  {e.type === 'recette' ? '+' : '-'}{fmtFCFA(e.montant_ttc)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Dernières écritures double-entrée ─────────────────── */}
      {recentDouble.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-bold text-[#0F172A]">{t('compta.overview.doubleEntry')}</p>
            <Link href="/dashboard/comptabilite/journal" className="text-[11px] text-[#2563EB] font-semibold hover:underline">
              {t('compta.overview.journal')} complet →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[#E2E8F0]">
                  {[t('audit.colDate'),'Libellé','Débit','Crédit','Montant','Source'].map(h => (
                    <th key={h} className="pb-2 text-left text-[10px] font-semibold text-[#94A3B8] uppercase pr-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentDouble.map(e => (
                  <tr key={e.id} className="border-b border-[#F8FAFC] hover:bg-[#F8FAFC]">
                    <td className="py-1.5 pr-3 whitespace-nowrap text-[#64748B]">
                      {new Date(e.date_operation).toLocaleDateString(intlLocale, { day:'2-digit', month:'short' })}
                    </td>
                    <td className="py-1.5 pr-3 max-w-[200px] truncate font-medium text-[#0F172A]">{e.libelle}</td>
                    <td className="py-1.5 pr-3">
                      <span className="px-1.5 py-0.5 bg-[#EFF6FF] text-[#2563EB] rounded font-mono text-[10px]">
                        {e.debit_account}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3">
                      <span className="px-1.5 py-0.5 bg-[#F0FDF4] text-[#16A34A] rounded font-mono text-[10px]">
                        {e.credit_account}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 font-bold text-[#0F172A]">{fmtFCFA(e.montant)}</td>
                    <td className="py-1.5">
                      <span className="px-1.5 py-0.5 bg-[#F1F5F9] text-[#64748B] rounded text-[9px] font-semibold uppercase">
                        {e.source || 'manuel'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal Nouvelle Écriture ───────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
              <div>
                <h2 className="font-bold text-[#0F172A] text-[15px]">{t('compta.overview.addEntry')}</h2>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">Double entrée OHADA · TVA {pays ? getCountryConfig(pays as CodePays).nom_pays : ''} automatique</p>
              </div>
              <button onClick={() => { setShowModal(false); resetForm() }}><X size={18} className="text-[#94A3B8]" /></button>
            </div>

            <div className="p-5 space-y-4">

              {/* Écriture manuelle hors moteur — QW-BCI-02 */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-[#FEF3C7] border border-[#FDE68A]">
                <AlertTriangle size={13} className="text-[#D97706] shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#D97706]">
                  <strong>Écriture manuelle ·</strong> Apparaît dans le Grand Livre et la Balance, mais non tracée dans le moteur d&apos;audit central. Pour une traçabilité complète, utilisez le module métier concerné (Facturation, Paie...).
                </p>
              </div>

              {/* Type toggle */}
              <div className="flex rounded-xl border border-[#E2E8F0] overflow-hidden">
                {(['recette', 'depense'] as const).map(tab_ => (
                  <button key={tab_} onClick={() => { setFormType(tab_); setFormCat('') }}
                    className={`flex-1 py-2.5 text-[12px] font-bold transition-all ${
                      formType === tab_
                        ? tab_ === 'recette' ? 'bg-[#16A34A] text-white' : 'bg-[#DC2626] text-white'
                        : 'text-[#64748B] hover:bg-[#F8FAFC]'
                    }`}>
                    {tab_ === 'recette' ? `⬆ ${t('compta.overview.recette')}` : `⬇ ${t('compta.overview.depense')}`}
                  </button>
                ))}
              </div>

              {/* Libellé */}
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Libellé *</label>
                <input value={formLibelle} onChange={e => setFormLibelle(e.target.value)}
                  placeholder="Description de l'opération"
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30" />
              </div>

              {/* Montant + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Montant HT (FCFA) *</label>
                  <input type="number" value={formMontant} onChange={e => setFormMontant(e.target.value)}
                    placeholder="0"
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">{t('common.date')}</label>
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30" />
                </div>
              </div>

              {/* TVA preview */}
              {formMontant && Number(formMontant) > 0 && (() => {
                const { tva, ca, ttc, tauxTVA, tauxCA, libelleCA } = calcTVA(Number(formMontant), pays)
                return (
                  <div className={`bg-[#FEF3C7] rounded-lg p-3 text-[11px] gap-2 ${ca > 0 ? 'grid grid-cols-3' : 'grid grid-cols-2'}`}>
                    <div className="text-center"><div className="font-bold text-[#D97706]">{fmtFCFA(tva)}</div><div className="text-[#94A3B8]">TVA {Math.round(tauxTVA * 100)}%</div></div>
                    {ca > 0 && <div className="text-center"><div className="font-bold text-[#D97706]">{fmtFCFA(ca)}</div><div className="text-[#94A3B8]">{libelleCA ?? 'Taxes add.'} {Math.round(tauxCA * 100)}%</div></div>}
                    <div className="text-center"><div className="font-bold text-[#0F172A]">{fmtFCFA(ttc)}</div><div className="text-[#94A3B8]">TTC</div></div>
                  </div>
                )
              })()}

              {/* Catégorie */}
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Catégorie *</label>
                <select value={formCat} onChange={e => setFormCat(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30">
                  <option value="">— Sélectionner —</option>
                  {(formType === 'recette' ? CATS_RECETTE : CATS_DEPENSE).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Comptes OHADA */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Compte Débité</label>
                  <select value={formDebit} onChange={e => setFormDebit(e.target.value as AccountCode)}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[11px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30">
                    <option value="">— Auto —</option>
                    {COMPTES_PLATS.map(c => (
                      <option key={c.numero} value={c.numero}>{c.numero} — {c.nom}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">Compte Crédité</label>
                  <select value={formCredit} onChange={e => setFormCredit(e.target.value as AccountCode)}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[11px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30">
                    <option value="">— Auto —</option>
                    {COMPTES_PLATS.map(c => (
                      <option key={c.numero} value={c.numero}>{c.numero} — {c.nom}</option>
                    ))}
                  </select>
                </div>
              </div>

              {saveErr  && <p className="text-[12px] text-[#DC2626] bg-[#FEE2E2] px-3 py-2 rounded-lg">{saveErr}</p>}
              {saveOk   && <p className="text-[12px] text-[#16A34A] bg-[#DCFCE7] px-3 py-2 rounded-lg flex items-center gap-1"><CheckCircle2 size={13} /> Écriture enregistrée !</p>}

              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12px] font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {t('common.save')}
                </button>
                <button onClick={() => { setShowModal(false); resetForm() }}
                  className="px-4 py-2.5 border border-[#E2E8F0] rounded-lg text-[12px] text-[#64748B] hover:bg-[#F8FAFC]">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
