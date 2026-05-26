'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
  BarChart2, TrendingUp, TrendingDown, Loader2, Download,
  RefreshCw, ChefHat, Sparkles, ArrowUpRight, ArrowDownRight,
  FileText, Users, CheckCircle, Scale, Wallet, Activity,
  Receipt, List,
} from 'lucide-react'
import { fmtFCFA } from '@/lib/admin-config'
import { calculerTVACongo } from '@/lib/fiscalite-congo'
import { useLocale } from '@/lib/hooks/useLocale'

// ─── Types ───────────────────────────────────────────────────
type FinData = {
  // Trésorerie
  totalEntrees: number
  totalSorties: number
  soldeTresorerie: number
  openingBalance: number
  // Exploitation
  ventesFactures: number
  tvaCollectee: number
  caCollecte: number
  prestations: number
  autresProduits: number
  // Charges
  achatsTotal: number
  salairesTotal: number
  loyerTotal: number
  carburantTotal: number
  taxesTotal: number
  autresCharges: number
  // Bilan
  clientsCreances: number   // factures non payées
  dettesFournisseurs: number // achats non payés
  // Paie
  cnssTotal: number
  // Méta
  nbFactures: number
  nbFacturesPayees: number
  nbEmployes: number
  caResto: number
  mois: string
  annee: number
}

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function fadeUp(i: number) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay: i * 0.07, ease: [0.23, 1, 0.32, 1] as const },
  }
}

function KpiCard({ label, value, sub, color, icon: Icon, trend, i }: {
  label: string; value: string; sub: string; color: string; icon: React.ElementType; trend?: number; i: number
}) {
  return (
    <motion.div {...fadeUp(i)} whileHover={{ y: -2 }}
      className="relative rounded-2xl p-5 overflow-hidden" style={{ background: color }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.12) 0%, transparent 60%)' }} />
      <div className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
        <Icon size={16} className="text-white" />
      </div>
      <div className="relative">
        <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wider mb-2">{label}</p>
        <p className="text-white text-2xl font-bold leading-none mb-1">{value}</p>
        <p className="text-white/50 text-[10px] mb-2">{sub}</p>
        {trend !== undefined && (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15">
            {trend >= 0 ? <ArrowUpRight size={10} className="text-white" /> : <ArrowDownRight size={10} className="text-white" />}
            <span className="text-white text-[10px] font-bold">{trend >= 0 ? '+' : ''}{trend.toFixed(0)}%</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function Section({ title, rows, total, totalLabel, totalColor = '#DC2626' }: {
  title: string
  rows: { label: string; value: number; color?: string; indent?: boolean }[]
  total: number
  totalLabel: string
  totalColor?: string
}) {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--surface)]/50">
        <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">{title}</h3>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {rows.map((r, i) => (
          <div key={i} className={`flex justify-between items-center px-5 py-2.5 ${r.indent ? 'pl-8' : ''}`}>
            <span className="text-sm text-[var(--text-secondary)]">{r.label}</span>
            <span className="text-sm font-semibold" style={{ color: r.color ?? '#FFFFFF' }}>
              {fmtFCFA(r.value)}
            </span>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 border-t border-[var(--border)] bg-[var(--surface)]/50 flex justify-between items-center">
        <span className="text-sm font-bold text-[var(--text)]">{totalLabel}</span>
        <span className="text-base font-bold" style={{ color: totalColor }}>{fmtFCFA(total)}</span>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────
export default function RapportsPage() {
  const { t } = useLocale()

  const TABS = [
    t('rapports.tab.overview'),
    t('rapports.tab.resultat'),
    t('rapports.tab.bilan'),
    t('rapports.tab.flux'),
    t('rapports.tab.tva'),
    t('rapports.tab.miaa'),
  ]
  const TAB_ICONS = [BarChart2, List, Scale, Activity, Receipt, Sparkles]

  const [tab, setTab] = useState(0)
  const [data, setData] = useState<FinData | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [nomEntreprise, setNomEntreprise] = useState('votre entreprise')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [tenantId, setTenantId] = useState<string | null>(null)

  const now = new Date()
  const moisLabel = `${MONTHS_FR[now.getMonth()]} ${now.getFullYear()}`

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles').select('tenant_id, tenants(nom_entreprise)').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (!profile?.tenant_id) return
    const tid = profile.tenant_id
    setTenantId(tid)
    const tenant = profile.tenants as unknown as { nom_entreprise: string } | null
    if (tenant?.nom_entreprise) setNomEntreprise(tenant.nom_entreprise)

    const yearStart = `${selectedYear}-01-01`
    const yearEnd   = `${selectedYear}-12-31`

    const [facRes, depRes, achRes, empRes, txRes, bpRes, fyRes] = await Promise.all([
      supabase.from('factures').select('total, montant_ht, tva, ca, statut').eq('tenant_id', tid),
      supabase.from('depenses').select('montant, categorie').eq('tenant_id', tid).gte('date', yearStart).lte('date', yearEnd),
      supabase.from('achats').select('montant, statut').eq('tenant_id', tid).gte('date', yearStart).lte('date', yearEnd),
      supabase.from('employes').select('salaire_base, statut').eq('tenant_id', tid),
      supabase.from('transactions').select('montant, type, source, categorie').eq('tenant_id', tid).gte('date', yearStart).lte('date', yearEnd),
      supabase.from('bulletins_paie').select('net, cnss_salarie, cnss_patronal, statut').eq('tenant_id', tid),
      supabase.from('fiscal_years').select('solde_ouverture').eq('tenant_id', tid).eq('annee', selectedYear).maybeSingle(),
    ])

    const factures     = facRes.data  ?? []
    const depenses     = depRes.data  ?? []
    const achats       = achRes.data  ?? []
    const employes     = empRes.data  ?? []
    const transactions = txRes.data   ?? []
    const bulletins    = bpRes.data   ?? []
    const openingBalance = fyRes.data?.solde_ouverture ?? 0

    const totalEntrees = transactions.filter(tx => tx.type === 'entree').reduce((s, tx) => s + tx.montant, 0)
    const totalSorties = transactions.filter(tx => tx.type === 'sortie').reduce((s, tx) => s + tx.montant, 0)
    const caResto      = transactions.filter(tx => tx.type === 'entree' && tx.source === 'pos').reduce((s, tx) => s + tx.montant, 0)

    // Produits
    const ventesFactures = factures.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.montant_ht ?? f.total ?? 0), 0)
    const tvaCollectee   = factures.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.tva ?? 0), 0)
    const caCollecte     = factures.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.ca ?? 0), 0)
    const prestations    = transactions.filter(tx => tx.type === 'entree' && (tx.categorie?.toLowerCase().includes('prestation') || tx.source === 'paiement_scolaire')).reduce((s, tx) => s + tx.montant, 0)
    const autresProduits = totalEntrees - ventesFactures - prestations

    // Charges par catégorie depense
    const depBycat = (cat: string) => depenses.filter(d => d.categorie === cat).reduce((s, d) => s + d.montant, 0)
    const achatsTotal   = achats.reduce((s, a) => s + a.montant, 0)
    const salairesTotal = bulletins.filter(b => b.statut === 'payee').reduce((s, b) => s + b.net, 0)
      || employes.filter(e => e.statut === 'actif').reduce((s, e) => s + (e.salaire_base ?? 0), 0)
    const loyerTotal    = depBycat('loyer') + depBycat('electricite') + depBycat('telephone')
    const carburantTotal = depBycat('carburant') + depBycat('voyages')
    const taxesTotal    = depBycat('taxes')
    const cnssTotal     = bulletins.reduce((s, b) => s + (b.cnss_salarie ?? 0) + (b.cnss_patronal ?? 0), 0)
    const autresCharges = depenses.filter(d => !['loyer','electricite','telephone','carburant','voyages','taxes','salaires'].includes(d.categorie)).reduce((s, d) => s + d.montant, 0)

    // Bilan
    const clientsCreances     = factures.filter(f => f.statut !== 'payee' && f.statut !== 'annulee').reduce((s, f) => s + (f.total ?? 0), 0)
    const dettesFournisseurs  = achats.filter(a => a.statut !== 'paye').reduce((s, a) => s + a.montant, 0)

    setData({
      totalEntrees, totalSorties, soldeTresorerie: openingBalance + totalEntrees - totalSorties,
      openingBalance, ventesFactures, tvaCollectee, caCollecte, prestations,
      autresProduits: Math.max(0, autresProduits),
      achatsTotal, salairesTotal, loyerTotal, carburantTotal, taxesTotal,
      autresCharges, cnssTotal,
      clientsCreances, dettesFournisseurs,
      nbFactures: factures.length,
      nbFacturesPayees: factures.filter(f => f.statut === 'payee').length,
      nbEmployes: employes.length,
      caResto, mois: moisLabel, annee: selectedYear,
    })
    setLoading(false)
  }, [selectedYear, moisLabel])

  useEffect(() => { load() }, [load])

  async function genererAnalyse() {
    if (!data) return
    setAiLoading(true)
    const produits = data.ventesFactures + data.prestations + data.autresProduits
    const charges  = data.achatsTotal + data.salairesTotal + data.loyerTotal + data.carburantTotal + data.taxesTotal + data.autresCharges
    const resultat = produits - charges
    const marge    = produits > 0 ? Math.round((resultat / produits) * 100) : 0
    const txPaie   = data.nbFactures > 0 ? Math.round((data.nbFacturesPayees / data.nbFactures) * 100) : 0
    const msg = `Analyse financière ${nomEntreprise} — ${data.annee}.\n\nCompte de résultat :\n- Produits : ${fmtFCFA(produits)}\n- Charges totales : ${fmtFCFA(charges)}\n- Résultat net : ${fmtFCFA(resultat)} (marge ${marge}%)\n\nTrésorerie :\n- Solde actuel : ${fmtFCFA(data.soldeTresorerie)}\n- Encaissements : ${fmtFCFA(data.totalEntrees)}\n- Décaissements : ${fmtFCFA(data.totalSorties)}\n\nRH : ${data.nbEmployes} employés, masse salariale ${fmtFCFA(data.salairesTotal)}\nFactures : ${data.nbFacturesPayees}/${data.nbFactures} payées (${txPaie}%)\nCréances clients : ${fmtFCFA(data.clientsCreances)}\nDettes fournisseurs : ${fmtFCFA(data.dettesFournisseurs)}\n\nDonne une analyse financière professionnelle en 3 paragraphes : état général, alertes, recommandations concrètes. Style direct, 200 mots max.`
    const res = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, module: 'rapports', entreprise: nomEntreprise }) })
    const d = await res.json()
    setAiText(d.reply ?? t('rapports.miaa.errorAnalyse'))
    setAiLoading(false)
  }

  const totalProduits = data ? data.ventesFactures + data.prestations + data.autresProduits : 0
  const totalCharges  = data ? data.achatsTotal + data.salairesTotal + data.loyerTotal + data.carburantTotal + data.taxesTotal + data.autresCharges : 0
  const resultatNet   = totalProduits - totalCharges
  const marge         = totalProduits > 0 ? Math.round((resultatNet / totalProduits) * 100) : 0
  const txPaiement    = data && data.nbFactures > 0 ? Math.round((data.nbFacturesPayees / data.nbFactures) * 100) : 0

  const YEARS = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  return (
    <div className="space-y-5 pb-10">

      {/* Header */}
      <motion.div {...fadeUp(0)} className="flex items-center justify-between pt-1 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#071535,#0F172A)' }}>
            <BarChart2 size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">{t('rapports.title')}</h1>
            <p className="text-xs text-[var(--text-secondary)]">
              {t('rapports.subtitle').replace('{entreprise}', nomEntreprise).replace('{mois}', moisLabel)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}
            className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={load} className="p-2 rounded-lg bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-1 overflow-x-auto">
        {TABS.map((tabLabel, i) => {
          const Icon = TAB_ICONS[i]
          return (
            <button key={i} onClick={() => setTab(i)}
              className={`flex-1 min-w-fit py-2 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                tab === i ? 'bg-[var(--surface)]/10 text-[#DC2626]' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}>
              <Icon size={11} />{tabLabel}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[var(--text-secondary)]">
          <Loader2 size={22} className="animate-spin mr-2" /> {t('rapports.loading')}
        </div>
      ) : data ? (
        <>

          {/* ── TAB 0 : Vue d'ensemble ── */}
          {tab === 0 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard i={1} label={t('rapports.kpi.recettes')} value={fmtFCFA(data.totalEntrees)} sub={t('rapports.kpi.recettesSub')}
                  color="linear-gradient(135deg,#071535 0%,#0F172A 50%,#1A3570 100%)" icon={TrendingUp} trend={marge > 0 ? marge : undefined} />
                <KpiCard i={2} label={t('rapports.kpi.charges')}  value={fmtFCFA(totalCharges)}       sub={t('rapports.kpi.chargesSub')}
                  color="linear-gradient(135deg,#7A0000 0%,#A00018 50%,#DC2626 100%)"  icon={TrendingDown} />
                <KpiCard i={3} label={t('rapports.kpi.resultat')} value={fmtFCFA(resultatNet)}        sub={`${t('rapports.cr.margeNette')} ${marge}%`}
                  color={resultatNet >= 0 ? 'linear-gradient(135deg,#4A0040 0%,#7C3AED 50%,#7C3AED 100%)' : 'linear-gradient(135deg,#4A0040 0%,#7C3AED 50%,#7C3AED 100%)'}
                  icon={resultatNet >= 0 ? ArrowUpRight : ArrowDownRight} trend={marge} />
                <KpiCard i={4} label={t('rapports.kpi.tauxPaiement')} value={`${txPaiement}%`} sub={`${data.nbFacturesPayees}/${data.nbFactures} factures`}
                  color="linear-gradient(135deg,#7A3800 0%,#C06000 50%,#DC2626 100%)"  icon={CheckCircle} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5">
                  <h2 className="text-sm font-bold text-[var(--text)] mb-4 flex items-center gap-2">
                    <FileText size={14} className="text-[#DC2626]" /> {t('rapports.detail.title').replace('{annee}', String(data.annee))}
                  </h2>
                  <div className="space-y-3">
                    {[
                      { label: t('rapports.detail.recettes'), val: totalProduits,       color: '#0F172A', pct: 100 },
                      { label: t('rapports.detail.achats'),   val: data.achatsTotal,    color: '#DC2626', pct: totalProduits > 0 ? (data.achatsTotal / totalProduits) * 100 : 0 },
                      { label: t('rapports.detail.salaires'), val: data.salairesTotal,  color: '#7C3AED', pct: totalProduits > 0 ? (data.salairesTotal / totalProduits) * 100 : 0 },
                      { label: t('rapports.detail.loyer'),    val: data.loyerTotal,     color: '#DC2626', pct: totalProduits > 0 ? (data.loyerTotal / totalProduits) * 100 : 0 },
                      { label: t('rapports.detail.resultat'), val: resultatNet,         color: resultatNet >= 0 ? '#DC2626' : '#DC2626', pct: totalProduits > 0 ? Math.abs(resultatNet / totalProduits) * 100 : 0 },
                    ].map(row => (
                      <div key={row.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-[var(--text-secondary)]">{row.label}</span>
                          <span className="text-xs font-bold" style={{ color: row.color }}>{fmtFCFA(row.val)}</span>
                        </div>
                        <div className="h-1.5 bg-[var(--surface-alt)] rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full" style={{ background: row.color }}
                            initial={{ width: 0 }} animate={{ width: `${Math.min(row.pct, 100)}%` }} transition={{ duration: 0.8 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-[var(--border)]">
                    {[
                      { label: t('rapports.detail.facturesPaid'), val: `${data.nbFacturesPayees}/${data.nbFactures}`, color: txPaiement >= 80 ? '#0F172A' : '#DC2626' },
                      { label: t('rapports.detail.employes'),     val: data.nbEmployes.toString(), color: '#DC2626' },
                      { label: t('rapports.detail.margeNette'),   val: `${marge}%`, color: marge >= 20 ? '#0F172A' : marge >= 10 ? '#DC2626' : '#DC2626' },
                    ].map(s => (
                      <div key={s.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 text-center">
                        <p className="text-[10px] text-[var(--text-secondary)] mb-1 uppercase tracking-wide">{s.label}</p>
                        <p className="text-base font-bold" style={{ color: s.color }}>{s.val}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#4A0040,#7C3AED)' }}>
                        <Users size={14} className="text-white" />
                      </div>
                      <p className="text-sm font-bold text-[var(--text)]">{t('rapports.rh.title')}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between py-2 border-b border-[var(--border)]">
                        <span className="text-xs text-[var(--text-secondary)]">{t('rapports.rh.effectif')}</span>
                        <span className="text-sm font-bold text-[#DC2626]">{data.nbEmployes}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-[var(--border)]">
                        <span className="text-xs text-[var(--text-secondary)]">{t('rapports.rh.salaires')}</span>
                        <span className="text-sm font-bold text-[#7C3AED]">{fmtFCFA(data.salairesTotal)}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-xs text-[var(--text-secondary)]">{t('rapports.rh.cnss')}</span>
                        <span className="text-sm font-bold text-[#DC2626]">{fmtFCFA(data.cnssTotal)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5">
                    <p className="text-xs font-bold text-[var(--text)] mb-3 uppercase tracking-wide">{t('rapports.exports.title')}</p>
                    <div className="space-y-2">
                      {[
                        { label: t('rapports.exports.pdf'), note: t('rapports.exports.soon') },
                        { label: t('rapports.exports.csv'), note: t('rapports.exports.soon') },
                        { label: t('rapports.exports.tva'), note: t('rapports.exports.tvaTab') },
                      ].map(e => (
                        <button key={e.label} onClick={() => e.note === t('rapports.exports.tvaTab') ? setTab(4) : undefined}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-[var(--border)] hover:border-[var(--border)] hover:bg-white/5 transition-all group text-left">
                          <div className="flex items-center gap-2">
                            <Download size={12} className="text-[var(--text-secondary)] group-hover:text-[#DC2626] transition-colors" />
                            <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--text)] transition-colors">{e.label}</span>
                          </div>
                          <span className="text-[10px] text-[var(--text-secondary)]">{e.note}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {data.caResto > 0 && (() => {
                const fiscal = calculerTVACongo(data.caResto)
                return (
                  <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5">
                    <h2 className="text-sm font-bold text-[var(--text)] mb-4 flex items-center gap-2">
                      <ChefHat size={14} className="text-[#DC2626]" /> {t('rapports.resto.title').replace('{annee}', String(data.annee))}
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: t('rapports.resto.caTtc'), val: fmtFCFA(data.caResto),   color: '#DC2626' },
                        { label: t('rapports.resto.caHt'),  val: fmtFCFA(fiscal.ht),      color: '#DC2626' },
                        { label: t('rapports.resto.tva'),   val: fmtFCFA(fiscal.tva),     color: '#7C3AED' },
                        { label: t('rapports.resto.ca'),    val: fmtFCFA(fiscal.ca),      color: '#DC2626' },
                      ].map(k => (
                        <div key={k.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
                          <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-2">{k.label}</p>
                          <p className="text-base font-bold" style={{ color: k.color }}>{k.val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── TAB 1 : Compte de résultat ── */}
          {tab === 1 && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--text-secondary)]">{t('rapports.cr.exercice').replace('{annee}', String(data.annee))}</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Section
                  title={t('rapports.cr.produits')}
                  rows={[
                    { label: '707 — Ventes factures',          value: data.ventesFactures,   color: '#0F172A' },
                    { label: '706 — Prestations de services',  value: data.prestations,       color: '#0F172A' },
                    { label: '708/709 — Autres produits',      value: data.autresProduits,    color: '#0F172A' },
                  ]}
                  total={totalProduits}
                  totalLabel={t('rapports.cr.totalProduits')}
                  totalColor="#0F172A"
                />
                <Section
                  title={t('rapports.cr.charges')}
                  rows={[
                    { label: '601 — Achats & marchandises',    value: data.achatsTotal,       color: '#DC2626' },
                    { label: '641 — Rémunérations personnel',  value: data.salairesTotal,     color: '#DC2626' },
                    { label: '644 — Charges sociales (CNSS)',  value: data.cnssTotal,         color: '#DC2626' },
                    { label: '651 — Loyer, énergie, comm.',    value: data.loyerTotal,        color: '#DC2626' },
                    { label: '601 — Carburant & déplacements', value: data.carburantTotal,    color: '#DC2626' },
                    { label: '441 — Taxes & impôts',          value: data.taxesTotal,        color: '#DC2626' },
                    { label: '651 — Autres charges',           value: data.autresCharges,     color: '#DC2626' },
                  ]}
                  total={totalCharges}
                  totalLabel={t('rapports.cr.totalCharges')}
                  totalColor="#DC2626"
                />
              </div>

              {/* Résultat net */}
              <div className={`rounded-2xl p-6 border-2 ${resultatNet >= 0 ? 'border-[#0F172A]/40 bg-[var(--surface)]/5' : 'border-[#DC2626]/40 bg-[#DC2626]/5'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      {resultatNet >= 0 ? t('rapports.cr.benefice') : t('rapports.cr.perte')} — {t('rapports.cr.exerciceLabel').replace('{annee}', String(data.annee))}
                    </p>
                    <p className="text-3xl font-bold mt-1" style={{ color: resultatNet >= 0 ? '#0F172A' : '#DC2626' }}>
                      {fmtFCFA(Math.abs(resultatNet))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--text-secondary)]">{t('rapports.cr.margeNette')}</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: marge >= 20 ? '#0F172A' : marge >= 10 ? '#DC2626' : '#DC2626' }}>
                      {marge}%
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    { label: t('rapports.cr.prodRow'),    value: fmtFCFA(totalProduits), color: '#0F172A' },
                    { label: t('rapports.cr.chargesRow'), value: fmtFCFA(totalCharges),  color: '#DC2626' },
                    { label: t('rapports.cr.resultatRow'),value: fmtFCFA(resultatNet),   color: resultatNet >= 0 ? '#DC2626' : '#DC2626' },
                  ].map(r => (
                    <div key={r.label} className="bg-[var(--surface)]/60 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-[var(--text-secondary)] mb-1">{r.label}</p>
                      <p className="text-sm font-bold" style={{ color: r.color }}>{r.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2 : Bilan ── */}
          {tab === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--text-secondary)]">{t('rapports.bilan.subtitle').replace('{annee}', String(data.annee))}</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Section
                  title={t('rapports.bilan.actif')}
                  rows={[
                    { label: t('rapports.bilan.tresorerie'), value: data.soldeTresorerie,   color: '#DC2626' },
                    { label: t('rapports.bilan.creances'),   value: data.clientsCreances,   color: '#DC2626' },
                  ]}
                  total={Math.max(0, data.soldeTresorerie) + data.clientsCreances}
                  totalLabel={t('rapports.bilan.totalActif')}
                  totalColor="#DC2626"
                />
                <div className="space-y-3">
                  <Section
                    title={t('rapports.bilan.capitaux')}
                    rows={[
                      { label: t('rapports.bilan.report'),      value: data.openingBalance, color: '#7C3AED' },
                      { label: t('rapports.bilan.exerciceRes'), value: resultatNet,          color: resultatNet >= 0 ? '#0F172A' : '#DC2626' },
                    ]}
                    total={data.openingBalance + resultatNet}
                    totalLabel={t('rapports.bilan.totalCapitaux')}
                    totalColor="#7C3AED"
                  />
                  <Section
                    title={t('rapports.bilan.dettes')}
                    rows={[
                      { label: t('rapports.bilan.fournisseurs'), value: data.dettesFournisseurs,                  color: '#DC2626' },
                      { label: t('rapports.bilan.dettesCnss'),   value: data.cnssTotal,                          color: '#DC2626' },
                      { label: t('rapports.bilan.tvaReverser'),  value: data.tvaCollectee + data.caCollecte,     color: '#DC2626' },
                    ]}
                    total={data.dettesFournisseurs + data.cnssTotal + data.tvaCollectee + data.caCollecte}
                    totalLabel={t('rapports.bilan.totalDettes')}
                    totalColor="#DC2626"
                  />
                </div>
              </div>

              {/* Équilibre */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale size={16} className="text-[#DC2626]" />
                    <span className="text-sm font-bold text-[var(--text)]">{t('rapports.bilan.equilibre')}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--text-secondary)]">{t('rapports.bilan.actifPassif')}</p>
                    <p className="text-sm font-bold text-[var(--text-secondary)]">
                      {t('rapports.bilan.simplified')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 3 : Flux de trésorerie ── */}
          {tab === 3 && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--text-secondary)]">{t('rapports.flux.subtitle').replace('{annee}', String(data.annee))}</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: t('rapports.flux.soldeOuv'), value: data.openingBalance,    color: '#7C3AED', icon: Wallet },
                  { label: t('rapports.flux.variation'), value: data.totalEntrees - data.totalSorties, color: (data.totalEntrees - data.totalSorties) >= 0 ? '#0F172A' : '#DC2626', icon: Activity },
                  { label: t('rapports.flux.soldeClo'), value: data.soldeTresorerie,    color: data.soldeTresorerie >= 0 ? '#DC2626' : '#DC2626', icon: Wallet },
                ].map((k, i) => (
                  <motion.div key={k.label} {...fadeUp(i)} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: k.color + '20' }}>
                      <k.icon size={18} style={{ color: k.color }} />
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-secondary)] mb-0.5">{k.label}</p>
                      <p className="text-lg font-bold" style={{ color: k.color }}>{fmtFCFA(k.value)}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <Section
                title={t('rapports.flux.exploitation')}
                rows={[
                  { label: t('rapports.flux.encaissements'),  value: data.totalEntrees,   color: '#0F172A' },
                  { label: t('rapports.flux.decaisseFourn'),  value: -data.achatsTotal,   color: '#DC2626' },
                  { label: t('rapports.flux.decaisseRH'),     value: -(data.salairesTotal + data.cnssTotal), color: '#DC2626' },
                  { label: t('rapports.flux.decaisseDiv'),    value: -(data.loyerTotal + data.carburantTotal + data.taxesTotal + data.autresCharges), color: '#DC2626' },
                ]}
                total={data.totalEntrees - data.totalSorties}
                totalLabel={t('rapports.flux.netExploitation')}
                totalColor={(data.totalEntrees - data.totalSorties) >= 0 ? '#0F172A' : '#DC2626'}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
                  <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">{t('rapports.flux.investTitle')}</h3>
                  <p className="text-sm text-[var(--text-secondary)] text-center py-4">{t('rapports.flux.nonSuivi')}</p>
                </div>
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
                  <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">{t('rapports.flux.finTitle')}</h3>
                  <p className="text-sm text-[var(--text-secondary)] text-center py-4">{t('rapports.flux.nonSuivi')}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 4 : Rapport TVA ── */}
          {tab === 4 && (() => {
            const tvaTotal = data.tvaCollectee
            const caTotal  = data.caCollecte
            const totalDGI = tvaTotal + caTotal
            const fiscalResto = data.caResto > 0 ? calculerTVACongo(data.caResto) : null
            return (
              <div className="space-y-4">
                <p className="text-xs text-[var(--text-secondary)]">{t('rapports.tva.subtitle').replace('{annee}', String(data.annee))}</p>

                <Section
                  title={t('rapports.tva.collected')}
                  rows={[
                    { label: t('rapports.tva.baseHT'), value: data.ventesFactures, color: '#FFFFFF' },
                    { label: t('rapports.tva.tva18'),  value: tvaTotal,            color: '#7C3AED' },
                    { label: t('rapports.tva.ca5'),    value: caTotal,             color: '#DC2626' },
                  ]}
                  total={totalDGI}
                  totalLabel={t('rapports.tva.totalReverser')}
                  totalColor="#DC2626"
                />

                {fiscalResto && (
                  <Section
                    title={t('rapports.tva.collectedResto')}
                    rows={[
                      { label: t('rapports.tva.caTtcResto'), value: data.caResto,       color: '#FFFFFF' },
                      { label: t('rapports.tva.caHtBase'),   value: fiscalResto.ht,     color: '#FFFFFF' },
                      { label: t('rapports.tva.tva18'),      value: fiscalResto.tva,    color: '#7C3AED' },
                      { label: t('rapports.tva.ca5'),        value: fiscalResto.ca,     color: '#DC2626' },
                    ]}
                    total={fiscalResto.tva + fiscalResto.ca}
                    totalLabel={t('rapports.tva.totalResto')}
                    totalColor="#DC2626"
                  />
                )}

                {/* Récap DGI */}
                <div className="bg-[#DC2626]/5 border-2 border-[#DC2626]/30 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-[#DC2626] mb-4 uppercase tracking-wider">
                    {t('rapports.tva.dgiTitle').replace('{annee}', String(data.annee))}
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: t('rapports.tva.ventes'),      value: tvaTotal + (fiscalResto?.tva ?? 0) },
                      { label: t('rapports.tva.deductible'),  value: 0 },
                      { label: t('rapports.tva.nette'),       value: tvaTotal + (fiscalResto?.tva ?? 0) },
                      { label: t('rapports.tva.contribution'),value: caTotal + (fiscalResto?.ca ?? 0) },
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center py-2 border-b border-[#DC2626]/10 last:border-0">
                        <span className="text-sm text-[var(--text-secondary)]">{r.label}</span>
                        <span className="text-sm font-bold text-[#DC2626]">{fmtFCFA(r.value)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-[#DC2626]/30 flex justify-between items-center">
                    <span className="text-base font-bold text-[var(--text)]">{t('rapports.tva.totalDgi')}</span>
                    <span className="text-xl font-bold text-[#DC2626]">
                      {fmtFCFA(totalDGI + (fiscalResto?.tva ?? 0) + (fiscalResto?.ca ?? 0))}
                    </span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── TAB 5 : Analyse MIAA+ ── */}
          {tab === 5 && (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-48 h-48 opacity-5 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #DC2626 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#7A3800,#C06000)' }}>
                      <Sparkles size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text)]">{t('rapports.miaa.title')}</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">
                        {t('rapports.miaa.powered').replace('{entreprise}', nomEntreprise).replace('{annee}', String(data.annee))}
                      </p>
                    </div>
                  </div>
                  <button onClick={genererAnalyse} disabled={aiLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#DC2626,#d4880a)', color: '#0F172A' }}>
                    {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    {aiText ? t('rapports.miaa.regenerate') : t('rapports.miaa.generate')}
                  </button>
                </div>
                {!aiText && !aiLoading && (
                  <div className="border border-dashed border-[var(--border)] rounded-xl p-8 text-center">
                    <Sparkles size={24} className="mx-auto mb-3 text-[#DC2626] opacity-40" />
                    <p className="text-sm text-[var(--text-secondary)]">{t('rapports.miaa.emptyTitle')}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">{t('rapports.miaa.emptySubtitle')}</p>
                  </div>
                )}
                {aiLoading && (
                  <div className="flex items-center gap-3 text-[var(--text-secondary)] py-6 px-2">
                    <Loader2 size={16} className="animate-spin text-[#DC2626]" />
                    <span className="text-sm">{t('rapports.miaa.analyzing')}</span>
                  </div>
                )}
                {aiText && !aiLoading && (
                  <div className="bg-[var(--surface)] border-l-2 border-[#DC2626]/60 rounded-r-xl p-5 text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                    {aiText}
                  </div>
                )}
              </div>
            </div>
          )}

        </>
      ) : null}
    </div>
  )
}
