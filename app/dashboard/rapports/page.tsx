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
const TABS = ['Vue d\'ensemble', 'Compte de résultat', 'Bilan', 'Flux de trésorerie', 'Rapport TVA', 'Analyse MIAA+']
const TAB_ICONS = [BarChart2, List, Scale, Activity, Receipt, Sparkles]

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

function Section({ title, rows, total, totalLabel, totalColor = '#F0A30A' }: {
  title: string
  rows: { label: string; value: number; color?: string; indent?: boolean }[]
  total: number
  totalLabel: string
  totalColor?: string
}) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#E2E8F0] bg-white/50">
        <h3 className="text-xs font-bold text-[#111827] uppercase tracking-wider">{title}</h3>
      </div>
      <div className="divide-y divide-[#EEF2FF]">
        {rows.map((r, i) => (
          <div key={i} className={`flex justify-between items-center px-5 py-2.5 ${r.indent ? 'pl-8' : ''}`}>
            <span className="text-sm text-[#4B5563]">{r.label}</span>
            <span className="text-sm font-semibold" style={{ color: r.color ?? '#E6EDF3' }}>
              {fmtFCFA(r.value)}
            </span>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 border-t border-[#E2E8F0] bg-white/50 flex justify-between items-center">
        <span className="text-sm font-bold text-[#111827]">{totalLabel}</span>
        <span className="text-base font-bold" style={{ color: totalColor }}>{fmtFCFA(total)}</span>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────
export default function RapportsPage() {
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
      .from('profiles').select('tenant_id, tenants(nom_entreprise)').eq('user_id', user.id).maybeSingle()
    if (!profile?.tenant_id) return
    const tid = profile.tenant_id
    setTenantId(tid)
    const t = profile.tenants as unknown as { nom_entreprise: string } | null
    if (t?.nom_entreprise) setNomEntreprise(t.nom_entreprise)

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

    const totalEntrees = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + t.montant, 0)
    const totalSorties = transactions.filter(t => t.type === 'sortie').reduce((s, t) => s + t.montant, 0)
    const caResto      = transactions.filter(t => t.type === 'entree' && t.source === 'pos').reduce((s, t) => s + t.montant, 0)

    // Produits
    const ventesFactures = factures.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.montant_ht ?? f.total ?? 0), 0)
    const tvaCollectee   = factures.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.tva ?? 0), 0)
    const caCollecte     = factures.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.ca ?? 0), 0)
    const prestations    = transactions.filter(t => t.type === 'entree' && (t.categorie?.toLowerCase().includes('prestation') || t.source === 'paiement_scolaire')).reduce((s, t) => s + t.montant, 0)
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
    setAiText(d.reply ?? "Erreur lors de l'analyse.")
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
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#065F46,#059669)' }}>
            <BarChart2 size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#111827]">Rapports Financiers</h1>
            <p className="text-xs text-[#6B7280]">ERP · {nomEntreprise} · {moisLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}
            className="bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#111827] outline-none">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={load} className="p-2 rounded-lg bg-[#F0F4FF] border border-[#E2E8F0] text-[#4B5563] hover:text-[#111827] transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-[#E2E8F0] rounded-xl p-1 overflow-x-auto">
        {TABS.map((t, i) => {
          const Icon = TAB_ICONS[i]
          return (
            <button key={i} onClick={() => setTab(i)}
              className={`flex-1 min-w-fit py-2 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                tab === i ? 'bg-[#2EA043]/10 text-[#2EA043]' : 'text-[#4B5563] hover:text-[#111827]'
              }`}>
              <Icon size={11} />{t}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#4B5563]">
          <Loader2 size={22} className="animate-spin mr-2" /> Chargement des données…
        </div>
      ) : data ? (
        <>

          {/* ── TAB 0 : Vue d'ensemble ── */}
          {tab === 0 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard i={1} label="Recettes totales"   value={fmtFCFA(data.totalEntrees)} sub="Encaissements exercice"
                  color="linear-gradient(135deg,#065F46 0%,#059669 50%,#10B981 100%)" icon={TrendingUp} trend={marge > 0 ? marge : undefined} />
                <KpiCard i={2} label="Charges totales"    value={fmtFCFA(totalCharges)}       sub="Toutes dépenses"
                  color="linear-gradient(135deg,#7C1D1D 0%,#B91C1C 50%,#EF4444 100%)"  icon={TrendingDown} />
                <KpiCard i={3} label="Résultat net"       value={fmtFCFA(resultatNet)}        sub={`Marge ${marge}%`}
                  color={resultatNet >= 0 ? 'linear-gradient(135deg,#1E3A5F 0%,#1D4ED8 50%,#3B82F6 100%)' : 'linear-gradient(135deg,#4C1D95 0%,#7C3AED 50%,#8B0073 100%)'}
                  icon={resultatNet >= 0 ? ArrowUpRight : ArrowDownRight} trend={marge} />
                <KpiCard i={4} label="Taux de paiement"  value={`${txPaiement}%`}            sub={`${data.nbFacturesPayees}/${data.nbFactures} factures`}
                  color="linear-gradient(135deg,#78350F 0%,#D97706 50%,#F59E0B 100%)"  icon={CheckCircle} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 bg-white border border-[#EEF2FF] rounded-2xl p-5">
                  <h2 className="text-sm font-bold text-[#111827] mb-4 flex items-center gap-2">
                    <FileText size={14} className="text-[#F0A30A]" /> Détail financier — {data.annee}
                  </h2>
                  <div className="space-y-3">
                    {[
                      { label: 'Recettes brutes',     val: totalProduits,       color: '#2EA043', pct: 100 },
                      { label: 'Achats & stock',       val: data.achatsTotal,    color: '#F01F38', pct: totalProduits > 0 ? (data.achatsTotal / totalProduits) * 100 : 0 },
                      { label: 'Masse salariale',      val: data.salairesTotal,  color: '#8B0073', pct: totalProduits > 0 ? (data.salairesTotal / totalProduits) * 100 : 0 },
                      { label: 'Charges locatives',    val: data.loyerTotal,     color: '#F97316', pct: totalProduits > 0 ? (data.loyerTotal / totalProduits) * 100 : 0 },
                      { label: 'Résultat net',         val: resultatNet,         color: resultatNet >= 0 ? '#F07900' : '#F01F38', pct: totalProduits > 0 ? Math.abs(resultatNet / totalProduits) * 100 : 0 },
                    ].map(row => (
                      <div key={row.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-[#4B5563]">{row.label}</span>
                          <span className="text-xs font-bold" style={{ color: row.color }}>{fmtFCFA(row.val)}</span>
                        </div>
                        <div className="h-1.5 bg-[#F0F4FF] rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full" style={{ background: row.color }}
                            initial={{ width: 0 }} animate={{ width: `${Math.min(row.pct, 100)}%` }} transition={{ duration: 0.8 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-[#EEF2FF]">
                    {[
                      { label: 'Factures payées', val: `${data.nbFacturesPayees}/${data.nbFactures}`, color: txPaiement >= 80 ? '#2EA043' : '#F0A30A' },
                      { label: 'Employés', val: data.nbEmployes.toString(), color: '#F07900' },
                      { label: 'Marge nette', val: `${marge}%`, color: marge >= 20 ? '#2EA043' : marge >= 10 ? '#F0A30A' : '#F01F38' },
                    ].map(s => (
                      <div key={s.label} className="bg-white border border-[#EEF2FF] rounded-xl p-3 text-center">
                        <p className="text-[10px] text-[#6B7280] mb-1 uppercase tracking-wide">{s.label}</p>
                        <p className="text-base font-bold" style={{ color: s.color }}>{s.val}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white border border-[#EEF2FF] rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#1E3A5F,#1D4ED8)' }}>
                        <Users size={14} className="text-white" />
                      </div>
                      <p className="text-sm font-bold text-[#111827]">Ressources Humaines</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between py-2 border-b border-[#EEF2FF]">
                        <span className="text-xs text-[#4B5563]">Effectif</span>
                        <span className="text-sm font-bold text-[#8B0073]">{data.nbEmployes}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-[#EEF2FF]">
                        <span className="text-xs text-[#4B5563]">Masse salariale</span>
                        <span className="text-sm font-bold text-[#8B0073]">{fmtFCFA(data.salairesTotal)}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-xs text-[#4B5563]">Charges CNSS</span>
                        <span className="text-sm font-bold text-[#F97316]">{fmtFCFA(data.cnssTotal)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white border border-[#EEF2FF] rounded-2xl p-5">
                    <p className="text-xs font-bold text-[#111827] mb-3 uppercase tracking-wide">Exports</p>
                    <div className="space-y-2">
                      {[
                        { label: 'Rapport PDF', note: 'À venir' },
                        { label: 'Export CSV', note: 'À venir' },
                        { label: 'Rapport TVA Congo', note: 'Onglet TVA' },
                      ].map(e => (
                        <button key={e.label} onClick={() => e.note === 'Onglet TVA' ? setTab(4) : undefined}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-[#EEF2FF] hover:border-[#E2E8F0] hover:bg-[#F0F4FF] transition-all group text-left">
                          <div className="flex items-center gap-2">
                            <Download size={12} className="text-[#6B7280] group-hover:text-[#F0A30A] transition-colors" />
                            <span className="text-xs text-[#4B5563] group-hover:text-[#111827] transition-colors">{e.label}</span>
                          </div>
                          <span className="text-[10px] text-[#6B7280]">{e.note}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {data.caResto > 0 && (() => {
                const fiscal = calculerTVACongo(data.caResto)
                return (
                  <div className="bg-white border border-[#EEF2FF] rounded-2xl p-5">
                    <h2 className="text-sm font-bold text-[#111827] mb-4 flex items-center gap-2">
                      <ChefHat size={14} className="text-[#F0A30A]" /> Restaurant — {data.annee}
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'CA TTC Restaurant', val: fmtFCFA(data.caResto),   color: '#F0A30A' },
                        { label: 'CA HT',              val: fmtFCFA(fiscal.ht),      color: '#F07900' },
                        { label: 'TVA collectée (18%)',val: fmtFCFA(fiscal.tva),     color: '#8B0073' },
                        { label: 'CA (5% TVA)',         val: fmtFCFA(fiscal.ca),      color: '#F01F38' },
                      ].map(k => (
                        <div key={k.label} className="bg-white border border-[#EEF2FF] rounded-xl p-4">
                          <p className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-2">{k.label}</p>
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
              <p className="text-xs text-[#6B7280]">Exercice {data.annee} · OHADA / Plan comptable congolais</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Section
                  title="PRODUITS D'EXPLOITATION"
                  rows={[
                    { label: '707 — Ventes factures',          value: data.ventesFactures,   color: '#2EA043' },
                    { label: '706 — Prestations de services',  value: data.prestations,       color: '#2EA043' },
                    { label: '708/709 — Autres produits',      value: data.autresProduits,    color: '#2EA043' },
                  ]}
                  total={totalProduits}
                  totalLabel="TOTAL PRODUITS"
                  totalColor="#2EA043"
                />
                <Section
                  title="CHARGES D'EXPLOITATION"
                  rows={[
                    { label: '601 — Achats & marchandises',    value: data.achatsTotal,       color: '#F01F38' },
                    { label: '641 — Rémunérations personnel',  value: data.salairesTotal,     color: '#F01F38' },
                    { label: '644 — Charges sociales (CNSS)',  value: data.cnssTotal,         color: '#F01F38' },
                    { label: '651 — Loyer, énergie, comm.',    value: data.loyerTotal,        color: '#F01F38' },
                    { label: '601 — Carburant & déplacements', value: data.carburantTotal,    color: '#F01F38' },
                    { label: '441 — Taxes & impôts',          value: data.taxesTotal,        color: '#F01F38' },
                    { label: '651 — Autres charges',           value: data.autresCharges,     color: '#F01F38' },
                  ]}
                  total={totalCharges}
                  totalLabel="TOTAL CHARGES"
                  totalColor="#F01F38"
                />
              </div>

              {/* Résultat net */}
              <div className={`rounded-2xl p-6 border-2 ${resultatNet >= 0 ? 'border-[#2EA043]/40 bg-[#2EA043]/5' : 'border-[#F01F38]/40 bg-[#F01F38]/5'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#4B5563]">
                      {resultatNet >= 0 ? 'BÉNÉFICE NET' : 'PERTE NETTE'} — EXERCICE {data.annee}
                    </p>
                    <p className="text-3xl font-bold mt-1" style={{ color: resultatNet >= 0 ? '#2EA043' : '#F01F38' }}>
                      {fmtFCFA(Math.abs(resultatNet))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#6B7280]">Marge nette</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: marge >= 20 ? '#2EA043' : marge >= 10 ? '#F0A30A' : '#F01F38' }}>
                      {marge}%
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    { label: 'Produits', value: fmtFCFA(totalProduits), color: '#2EA043' },
                    { label: 'Charges',  value: fmtFCFA(totalCharges),  color: '#F01F38' },
                    { label: 'Résultat', value: fmtFCFA(resultatNet),   color: resultatNet >= 0 ? '#F07900' : '#F01F38' },
                  ].map(r => (
                    <div key={r.label} className="bg-white/60 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-[#6B7280] mb-1">{r.label}</p>
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
              <p className="text-xs text-[#6B7280]">Bilan simplifié au 31/12/{data.annee} — OHADA</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Section
                  title="ACTIF"
                  rows={[
                    { label: 'Trésorerie (caisse + banque)',  value: data.soldeTresorerie,       color: '#F07900' },
                    { label: 'Créances clients (à recevoir)', value: data.clientsCreances,       color: '#F0A30A' },
                  ]}
                  total={Math.max(0, data.soldeTresorerie) + data.clientsCreances}
                  totalLabel="TOTAL ACTIF"
                  totalColor="#F07900"
                />
                <div className="space-y-3">
                  <Section
                    title="CAPITAUX PROPRES"
                    rows={[
                      { label: 'Report à nouveau (N-1)',  value: data.openingBalance,  color: '#8B0073' },
                      { label: 'Résultat de l\'exercice', value: resultatNet,           color: resultatNet >= 0 ? '#2EA043' : '#F01F38' },
                    ]}
                    total={data.openingBalance + resultatNet}
                    totalLabel="TOTAL CAPITAUX PROPRES"
                    totalColor="#8B0073"
                  />
                  <Section
                    title="DETTES"
                    rows={[
                      { label: 'Fournisseurs (à payer)',       value: data.dettesFournisseurs, color: '#F01F38' },
                      { label: 'Dettes sociales (CNSS)',       value: data.cnssTotal,          color: '#F97316' },
                      { label: 'TVA collectée à reverser',     value: data.tvaCollectee + data.caCollecte, color: '#F0A30A' },
                    ]}
                    total={data.dettesFournisseurs + data.cnssTotal + data.tvaCollectee + data.caCollecte}
                    totalLabel="TOTAL DETTES"
                    totalColor="#F01F38"
                  />
                </div>
              </div>

              {/* Équilibre */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale size={16} className="text-[#F0A30A]" />
                    <span className="text-sm font-bold text-[#111827]">Vérification équilibre</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#6B7280]">Actif — Passif</p>
                    <p className="text-sm font-bold text-[#4B5563]">
                      (bilan simplifié — hors immobilisations)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 3 : Flux de trésorerie ── */}
          {tab === 3 && (
            <div className="space-y-4">
              <p className="text-xs text-[#6B7280]">Flux de trésorerie — Exercice {data.annee}</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Solde ouverture', value: data.openingBalance,    color: '#8B0073', icon: Wallet },
                  { label: 'Variation nette', value: data.totalEntrees - data.totalSorties, color: (data.totalEntrees - data.totalSorties) >= 0 ? '#2EA043' : '#F01F38', icon: Activity },
                  { label: 'Solde clôture',  value: data.soldeTresorerie,    color: data.soldeTresorerie >= 0 ? '#F07900' : '#F01F38', icon: Wallet },
                ].map((k, i) => (
                  <motion.div key={k.label} {...fadeUp(i)} className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: k.color + '20' }}>
                      <k.icon size={18} style={{ color: k.color }} />
                    </div>
                    <div>
                      <p className="text-xs text-[#6B7280] mb-0.5">{k.label}</p>
                      <p className="text-lg font-bold" style={{ color: k.color }}>{fmtFCFA(k.value)}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <Section
                title="FLUX D'EXPLOITATION"
                rows={[
                  { label: 'Encaissements clients',          value: data.totalEntrees,   color: '#2EA043' },
                  { label: 'Décaissements fournisseurs',     value: -data.achatsTotal,   color: '#F01F38' },
                  { label: 'Décaissements salaires & CNSS',  value: -(data.salairesTotal + data.cnssTotal), color: '#F01F38' },
                  { label: 'Décaissements charges diverses', value: -(data.loyerTotal + data.carburantTotal + data.taxesTotal + data.autresCharges), color: '#F01F38' },
                ]}
                total={data.totalEntrees - data.totalSorties}
                totalLabel="FLUX NET D'EXPLOITATION"
                totalColor={(data.totalEntrees - data.totalSorties) >= 0 ? '#2EA043' : '#F01F38'}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
                  <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-3">FLUX D'INVESTISSEMENT</h3>
                  <p className="text-sm text-[#6B7280] text-center py-4">Non suivi dans cet exercice</p>
                </div>
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
                  <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-3">FLUX DE FINANCEMENT</h3>
                  <p className="text-sm text-[#6B7280] text-center py-4">Non suivi dans cet exercice</p>
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
                <p className="text-xs text-[#6B7280]">Rapport TVA Congo DRC — Exercice {data.annee}</p>

                <Section
                  title="TVA COLLECTÉE — Sur factures"
                  rows={[
                    { label: 'Base imposable HT',          value: data.ventesFactures,  color: '#E6EDF3' },
                    { label: 'TVA 18% collectée',          value: tvaTotal,             color: '#8B0073' },
                    { label: "Contribution d'Appui (5%)",  value: caTotal,              color: '#F97316' },
                  ]}
                  total={totalDGI}
                  totalLabel="TOTAL TVA + CA À REVERSER"
                  totalColor="#F01F38"
                />

                {fiscalResto && (
                  <Section
                    title="TVA COLLECTÉE — CA Restaurant"
                    rows={[
                      { label: 'CA TTC restaurant',      value: data.caResto,       color: '#E6EDF3' },
                      { label: 'CA HT (base imposable)', value: fiscalResto.ht,     color: '#E6EDF3' },
                      { label: 'TVA 18% collectée',      value: fiscalResto.tva,    color: '#8B0073' },
                      { label: "CA (5% TVA)",            value: fiscalResto.ca,     color: '#F97316' },
                    ]}
                    total={fiscalResto.tva + fiscalResto.ca}
                    totalLabel="TOTAL TVA RESTO À REVERSER"
                    totalColor="#F01F38"
                  />
                )}

                {/* Récap DGI */}
                <div className="bg-[#F0A30A]/5 border-2 border-[#F0A30A]/30 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-[#F0A30A] mb-4 uppercase tracking-wider">
                    Déclaration DGI — {data.annee}
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: 'TVA collectée sur ventes',     value: tvaTotal + (fiscalResto?.tva ?? 0) },
                      { label: 'TVA déductible sur achats',    value: 0 },
                      { label: 'TVA nette à reverser',         value: tvaTotal + (fiscalResto?.tva ?? 0) },
                      { label: "Contribution d'Appui (CA)",    value: caTotal + (fiscalResto?.ca ?? 0) },
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center py-2 border-b border-[#F0A30A]/10 last:border-0">
                        <span className="text-sm text-[#4B5563]">{r.label}</span>
                        <span className="text-sm font-bold text-[#F0A30A]">{fmtFCFA(r.value)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-[#F0A30A]/30 flex justify-between items-center">
                    <span className="text-base font-bold text-[#111827]">TOTAL À PAYER À LA DGI</span>
                    <span className="text-xl font-bold text-[#F01F38]">
                      {fmtFCFA(totalDGI + (fiscalResto?.tva ?? 0) + (fiscalResto?.ca ?? 0))}
                    </span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── TAB 5 : Analyse MIAA+ ── */}
          {tab === 5 && (
            <div className="bg-white border border-[#EEF2FF] rounded-2xl p-5 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-48 h-48 opacity-5 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #F0A30A 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#78350F,#D97706)' }}>
                      <Sparkles size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#111827]">Analyse MIAA+</p>
                      <p className="text-[10px] text-[#6B7280]">Powered by Claude · {nomEntreprise} · {data.annee}</p>
                    </div>
                  </div>
                  <button onClick={genererAnalyse} disabled={aiLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#F0A30A,#d4880a)', color: '#0D1117' }}>
                    {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    {aiText ? 'Régénérer' : 'Générer'}
                  </button>
                </div>
                {!aiText && !aiLoading && (
                  <div className="border border-dashed border-[#E2E8F0] rounded-xl p-8 text-center">
                    <Sparkles size={24} className="mx-auto mb-3 text-[#F0A30A] opacity-40" />
                    <p className="text-sm text-[#4B5563]">MIAA+ analyse vos données et génère une analyse financière complète</p>
                    <p className="text-xs text-[#6B7280] mt-1">Compte de résultat · Trésorerie · Créances · Recommandations</p>
                  </div>
                )}
                {aiLoading && (
                  <div className="flex items-center gap-3 text-[#4B5563] py-6 px-2">
                    <Loader2 size={16} className="animate-spin text-[#F0A30A]" />
                    <span className="text-sm">MIAA+ rédige votre analyse financière complète…</span>
                  </div>
                )}
                {aiText && !aiLoading && (
                  <div className="bg-white border-l-2 border-[#F0A30A]/60 rounded-r-xl p-5 text-sm text-[#111827] leading-relaxed whitespace-pre-wrap">
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
