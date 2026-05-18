'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Plus, Minus, TrendingUp, TrendingDown, Wallet, X, Loader2,
  Smartphone, Banknote, Building2, CheckCircle, AlertCircle, FileText,
  ArrowUpCircle, ArrowDownCircle, RefreshCw,
  LayoutDashboard, Landmark, Archive, Upload, GitMerge,
  BarChart3, Eye, ListOrdered, Lock, Sliders, PiggyBank,
} from 'lucide-react'
import { fmtFCFA } from '@/lib/admin-config'
import { resolveAccounts } from '@/lib/accounting-engine'
import { writeComptaEntry, modeToAccount } from '@/lib/compta-sync-client'

// ─── Types ───────────────────────────────────────────────────────────────────

type Transaction = {
  id: string
  type: 'entree' | 'sortie'
  categorie: string
  description: string
  montant: number
  date: string
  mode_paiement: string
  source?: string
  reference?: string
  created_at: string
}

type Caisse = {
  id: string
  nom: string
  numero_compte: string
  solde: number
  actif: boolean
}

type CompteBancaire = {
  id: string
  banque: string
  intitule: string
  numero_compte: string
  solde: number
  actif: boolean
}

type CaisseOp = {
  id: string
  caisse_id: string
  type: 'depense' | 'approvisionnement'
  montant: number
  motif: string | null
  beneficiaire: string | null
  reference_piece: string | null
  date: string
  cloture_date: string | null
  created_at: string
}

type MainTab = 'overview' | 'banque' | 'caisse' | 'import' | 'rapprochement' | 'previsions'
type CaisseTab = 'apercu' | 'operations' | 'journal' | 'cloture' | 'parametrage'
type ModalType = 'encaisser' | 'decaisser' | 'addBanque' | null

// ─── Constantes ──────────────────────────────────────────────────────────────

const CATS_ENTREE = [
  "Vente / Chiffre d'affaires", 'Frais de scolarité', 'Facture payée',
  'Prestation de services', 'Avance client', 'Virement reçu',
  'Remboursement', 'Subvention / Don', 'Autre recette',
]

const CATS_SORTIE = [
  'Achats / Fournisseur', 'Loyer', 'Carburant / Transport',
  'Charges diverses', 'Impôts / Taxes', 'CNSS', 'Frais bancaires',
  'Remboursement client', 'Autre dépense',
]

const MODES = [
  { value: 'especes',      label: 'Espèces',      icon: Banknote,   color: '#2EA043' },
  { value: 'virement',     label: 'Virement',     icon: Building2,  color: '#388BFD' },
  { value: 'cheque',       label: 'Chèque',       icon: FileText,   color: '#8B5CF6' },
  { value: 'airtel_money', label: 'Airtel Money', icon: Smartphone, color: '#F97316' },
  { value: 'mtn_momo',     label: 'MTN MoMo',     icon: Smartphone, color: '#F0A30A' },
]

const BANQUES_CONGO = [
  'BGFI Bank', 'Ecobank', 'Rawbank', 'Equity BCDC', 'TMB',
  'Afriland First Bank', 'UBA Congo', 'Citibank', 'Autre',
]

const MAIN_TABS = [
  { id: 'overview' as MainTab,        label: 'Vue d\'ensemble',  icon: LayoutDashboard },
  { id: 'banque' as MainTab,          label: 'Comptes bancaires', icon: Landmark },
  { id: 'caisse' as MainTab,          label: 'Caisse',            icon: Archive },
  { id: 'import' as MainTab,          label: 'Import relevés',    icon: Upload },
  { id: 'rapprochement' as MainTab,   label: 'Rapprochement',     icon: GitMerge },
  { id: 'previsions' as MainTab,      label: 'Prévisions',        icon: BarChart3 },
]

const CAISSE_TABS = [
  { id: 'apercu' as CaisseTab,       label: 'Aperçu',       icon: Eye },
  { id: 'operations' as CaisseTab,   label: 'Opérations',   icon: ListOrdered },
  { id: 'journal' as CaisseTab,      label: 'Journal',      icon: FileText },
  { id: 'cloture' as CaisseTab,      label: 'Clôture',      icon: Lock },
  { id: 'parametrage' as CaisseTab,  label: 'Paramétrage',  icon: Sliders },
]

const CATS_DEPENSE = [
  'Fournitures', 'Carburant', 'Repas / Représentation', 'Transport',
  'Petit matériel', 'Réparations', 'Charges diverses', 'Autre',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().split('T')[0] }

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TresoreriePage() {
  const { tenantId, loading: tLoading } = useTenant()

  // ── Global state ──────────────────────────────────────────────────────────
  const [mainTab,     setMainTab]    = useState<MainTab>('overview')
  const [caisseTab,   setCaisseTab]  = useState<CaisseTab>('apercu')
  const [modal,       setModal]      = useState<ModalType>(null)
  const [toast,       setToast]      = useState<{ msg: string; ok: boolean } | null>(null)
  const [saving,      setSaving]     = useState(false)
  const [loading,     setLoading]    = useState(true)

  // ── Data ──────────────────────────────────────────────────────────────────
  const [transactions,    setTransactions]   = useState<Transaction[]>([])
  const [caisses,         setCaisses]        = useState<Caisse[]>([])
  const [comptesBancaires, setComptesBancaires] = useState<CompteBancaire[]>([])
  const [caisseOps,       setCaisseOps]      = useState<CaisseOp[]>([])
  const [selectedCaisse,  setSelectedCaisse] = useState<Caisse | null>(null)
  const [openingBal,      setOpeningBal]     = useState(0)

  // ── Encaisser form ────────────────────────────────────────────────────────
  const [fEnc, setFEnc] = useState({
    categorie: "Vente / Chiffre d'affaires", description: '',
    montant: '', date: today(), mode: 'especes',
  })

  // ── Décaisser form ────────────────────────────────────────────────────────
  const [fDec, setFDec] = useState({
    categorie: 'Achats / Fournisseur', description: '',
    montant: '', date: today(), mode: 'especes',
  })

  // ── Banque form ───────────────────────────────────────────────────────────
  const [fBanque, setFBanque] = useState({
    banque: 'BGFI Bank', intitule: '', numero_compte: '', solde: '',
  })

  // ── Caisse opération form ─────────────────────────────────────────────────
  const [opType,        setOpType]        = useState<'depense' | 'approvisionnement'>('depense')
  const [fOp, setFOp] = useState({
    montant: '', motif: '', beneficiaire: '',
    categorie: 'Fournitures', reference_piece: '', date: today(),
  })

  // ── New caisse form ───────────────────────────────────────────────────────
  const [fCaisse, setFCaisse] = useState({ nom: 'Caisse principale', numero_compte: '571000' })
  const [savingCaisse, setSavingCaisse] = useState(false)

  // ── Clôture ───────────────────────────────────────────────────────────────
  const [clotureSolde,   setClotureSolde]   = useState('')
  const [clotureDate,    setClotureDate]    = useState(today())
  const [savingCloture,  setSavingCloture]  = useState(false)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Load all data ─────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 1)
    const cutoffStr = cutoff.toISOString().split('T')[0]

    const [txRes, caisseRes, banqueRes, obRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('tenant_id', tenantId)
        .gte('date', cutoffStr).order('date', { ascending: false }),
      supabase.from('caisses').select('*').eq('tenant_id', tenantId).eq('actif', true),
      supabase.from('comptes_bancaires').select('*').eq('tenant_id', tenantId).eq('actif', true),
      supabase.from('opening_balances').select('solde_ouverture')
        .eq('tenant_id', tenantId).eq('annee', new Date().getFullYear()).maybeSingle(),
    ])

    setTransactions((txRes.data ?? []) as Transaction[])
    const caisseList = (caisseRes.data ?? []) as Caisse[]
    setCaisses(caisseList)
    setComptesBancaires((banqueRes.data ?? []) as CompteBancaire[])
    setOpeningBal(obRes.data?.solde_ouverture ?? 0)

    // Auto-select first caisse
    if (caisseList.length > 0 && !selectedCaisse) {
      setSelectedCaisse(caisseList[0])
      loadCaisseOps(caisseList[0].id)
    }

    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  async function loadCaisseOps(caisseId: string) {
    const { data } = await supabase
      .from('caisse_operations')
      .select('*')
      .eq('caisse_id', caisseId)
      .order('date', { ascending: false })
      .limit(100)
    setCaisseOps((data ?? []) as CaisseOp[])
  }

  useEffect(() => {
    if (!tLoading && tenantId) load()
  }, [tLoading, tenantId, load])

  useEffect(() => {
    if (selectedCaisse) loadCaisseOps(selectedCaisse.id)
  }, [selectedCaisse])

  // ── KPI computed ──────────────────────────────────────────────────────────

  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthTx = transactions.filter(t => t.date.startsWith(thisMonth))
  const encaissementsMois  = monthTx.filter(t => t.type === 'entree').reduce((s, t) => s + t.montant, 0)
  const decaissementsMois  = monthTx.filter(t => t.type === 'sortie').reduce((s, t) => s + t.montant, 0)
  const totalEntrees       = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + t.montant, 0)
  const totalSorties       = transactions.filter(t => t.type === 'sortie').reduce((s, t) => s + t.montant, 0)
  const soldeGlobal        = openingBal + totalEntrees - totalSorties
  const totalBanque        = comptesBancaires.reduce((s, c) => s + c.solde, 0)
  const totalCaisse        = caisses.reduce((s, c) => s + c.solde, 0)
  const tresorerieGlobale  = totalBanque + totalCaisse

  // ── Chart ─────────────────────────────────────────────────────────────────

  const chartData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    const ds = d.toISOString().split('T')[0]
    const e = transactions.filter(t => t.type === 'entree' && t.date === ds).reduce((s, t) => s + t.montant, 0)
    const s = transactions.filter(t => t.type === 'sortie' && t.date === ds).reduce((s, t) => s + t.montant, 0)
    return { day: i % 5 === 0 ? `${d.getDate()}/${d.getMonth() + 1}` : '', entrées: e, sorties: s }
  })
  let cumul = openingBal
  const chartFull = chartData.map(d => { cumul += d.entrées - d.sorties; return { ...d, solde: cumul } })

  // ── Save encaisser ────────────────────────────────────────────────────────

  async function saveEncaisser() {
    if (!tenantId || !fEnc.description || !fEnc.montant) return
    setSaving(true)
    try {
      const montant = parseInt(fEnc.montant)
      const [debit, credit] = resolveAccounts('entree', fEnc.categorie)
      const { data: { user } } = await supabase.auth.getUser()
      const { data: tx } = await supabase.from('transactions').insert({
        tenant_id: tenantId, type: 'entree', categorie: fEnc.categorie,
        description: fEnc.description, montant, date: fEnc.date,
        mode_paiement: fEnc.mode, source: 'tresorerie',
        debit_account: debit, credit_account: credit, created_by: user?.id,
      }).select('id').single()
      await writeComptaEntry({
        tenantId, date: fEnc.date, libelle: fEnc.description,
        type: 'recette', montant, categorie: fEnc.categorie,
        debitAccount: debit, creditAccount: credit,
        source: 'tresorerie', sourceId: tx?.id, createdBy: user?.id,
      })
      await supabase.from('notifications').insert({
        tenant_id: tenantId, role: 'DIRECTION_GENERALE',
        title: `Encaissement — ${fmtFCFA(montant)}`,
        body: `${fEnc.categorie} · ${fEnc.description}`, link: '/dashboard/tresorerie', lu: false,
      })
      showToast(`Encaissement de ${fmtFCFA(montant)} enregistré`)
      setModal(null)
      setFEnc({ categorie: "Vente / Chiffre d'affaires", description: '', montant: '', date: today(), mode: 'especes' })
      load()
    } catch (e: any) { showToast(e?.message ?? 'Erreur', false) }
    setSaving(false)
  }

  // ── Save décaisser ────────────────────────────────────────────────────────

  async function saveDecaisser() {
    if (!tenantId || !fDec.description || !fDec.montant) return
    setSaving(true)
    try {
      const montant = parseInt(fDec.montant)
      const [debit, credit] = resolveAccounts('sortie', fDec.categorie)
      const { data: { user } } = await supabase.auth.getUser()
      const { data: tx } = await supabase.from('transactions').insert({
        tenant_id: tenantId, type: 'sortie', categorie: fDec.categorie,
        description: fDec.description, montant, date: fDec.date,
        mode_paiement: fDec.mode, source: 'tresorerie',
        debit_account: debit, credit_account: credit, created_by: user?.id,
      }).select('id').single()
      await writeComptaEntry({
        tenantId, date: fDec.date, libelle: fDec.description,
        type: 'depense', montant, categorie: fDec.categorie,
        debitAccount: debit, creditAccount: credit,
        source: 'tresorerie', sourceId: tx?.id, createdBy: user?.id,
      })
      showToast(`Décaissement de ${fmtFCFA(montant)} enregistré`)
      setModal(null)
      setFDec({ categorie: 'Achats / Fournisseur', description: '', montant: '', date: today(), mode: 'especes' })
      load()
    } catch (e: any) { showToast(e?.message ?? 'Erreur', false) }
    setSaving(false)
  }

  // ── Save compte bancaire ──────────────────────────────────────────────────

  async function saveBanque() {
    if (!tenantId || !fBanque.intitule) return
    setSaving(true)
    const { error } = await supabase.from('comptes_bancaires').insert({
      tenant_id: tenantId, banque: fBanque.banque, intitule: fBanque.intitule,
      numero_compte: fBanque.numero_compte, solde: parseFloat(fBanque.solde) || 0,
    })
    if (error) showToast(error.message, false)
    else { showToast('Compte bancaire ajouté'); setModal(null); setFBanque({ banque: 'BGFI Bank', intitule: '', numero_compte: '', solde: '' }); load() }
    setSaving(false)
  }

  // ── Save caisse ───────────────────────────────────────────────────────────

  async function saveCaisse() {
    if (!tenantId || !fCaisse.nom) return
    setSavingCaisse(true)
    const { data, error } = await supabase.from('caisses').insert({
      tenant_id: tenantId, nom: fCaisse.nom, numero_compte: fCaisse.numero_compte,
    }).select('*').single()
    if (error) showToast(error.message, false)
    else {
      showToast('Caisse créée')
      setFCaisse({ nom: 'Caisse principale', numero_compte: '571000' })
      load()
      if (data) setSelectedCaisse(data as Caisse)
    }
    setSavingCaisse(false)
  }

  // ── Save caisse opération ─────────────────────────────────────────────────

  async function saveCaisseOp() {
    if (!tenantId || !selectedCaisse || !fOp.montant) return
    const montant = parseFloat(fOp.montant)
    if (montant <= 0) return
    if (opType === 'depense' && montant > selectedCaisse.solde) {
      showToast('Solde insuffisant dans la caisse', false); return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('caisse_operations').insert({
      caisse_id: selectedCaisse.id, tenant_id: tenantId,
      type: opType, montant, motif: fOp.motif || null,
      beneficiaire: fOp.beneficiaire || null,
      compte_charge: opType === 'depense' ? '571000' : '521000',
      compte_source: opType === 'depense' ? '521000' : '571000',
      reference_piece: fOp.reference_piece || null,
      date: fOp.date, created_by: user?.id,
    })
    if (error) { showToast(error.message, false) }
    else {
      showToast(opType === 'depense'
        ? `Dépense de ${fmtFCFA(montant)} enregistrée`
        : `Approvisionnement de ${fmtFCFA(montant)} enregistré`)
      setFOp({ montant: '', motif: '', beneficiaire: '', categorie: 'Fournitures', reference_piece: '', date: today() })
      load()
    }
    setSaving(false)
  }

  // ── Clôture de caisse ─────────────────────────────────────────────────────

  async function saveCloture() {
    if (!selectedCaisse || !clotureDate) return
    setSavingCloture(true)
    await supabase.from('caisse_operations')
      .update({ cloture_date: clotureDate })
      .eq('caisse_id', selectedCaisse.id)
      .is('cloture_date', null)
      .eq('date', clotureDate)
    if (clotureSolde !== '') {
      await supabase.from('caisses').update({ solde: parseFloat(clotureSolde) }).eq('id', selectedCaisse.id)
    }
    showToast(`Caisse clôturée pour le ${fmtDate(clotureDate)}`)
    setClotureSolde('')
    setSavingCloture(false)
    load()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (tLoading || loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-[#484F58]" size={24} />
      </div>
    )
  }

  return (
    <div className="space-y-0">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="fixed top-5 right-5 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium"
            style={{ background: toast.ok ? '#0D1117' : '#1A0D0D', borderColor: toast.ok ? '#2EA043' : '#F85149', color: toast.ok ? '#2EA043' : '#F85149' }}>
            {toast.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-[#E6EDF3]">Trésorerie</h1>
          <p className="text-xs text-[#484F58]">Gestion des flux financiers</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModal('encaisser')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2EA043]/15 text-[#2EA043] border border-[#2EA043]/30 hover:bg-[#2EA043]/25 transition-colors">
            <ArrowUpCircle size={13} /> Encaisser
          </button>
          <button onClick={() => setModal('decaisser')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F85149]/15 text-[#F85149] border border-[#F85149]/30 hover:bg-[#F85149]/25 transition-colors">
            <ArrowDownCircle size={13} /> Décaisser
          </button>
          <button onClick={load}
            className="p-1.5 rounded-lg text-[#484F58] hover:text-[#8B949E] hover:bg-[#21262D] transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Main tab nav ──────────────────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-5 border-b border-[#21262D]">
        {MAIN_TABS.map(tab => {
          const Icon = tab.icon
          const active = mainTab === tab.id
          return (
            <button key={tab.id} onClick={() => setMainTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium whitespace-nowrap transition-colors relative ${
                active
                  ? 'text-[#F0A30A] bg-[#F0A30A]/5'
                  : 'text-[#484F58] hover:text-[#8B949E] hover:bg-[#21262D]'
              }`}>
              <Icon size={13} />
              {tab.label}
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F0A30A] rounded-full" />
              )}
            </button>
          )
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: VUE D'ENSEMBLE                                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'overview' && (
        <div className="space-y-5">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Trésorerie globale */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}
              className="relative rounded-2xl p-4 overflow-hidden"
              style={{ background: 'linear-gradient(135deg,#0a1a2e 0%,#0d2347 50%,#1a3a6b 100%)' }}>
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 80% 10%,rgba(255,255,255,0.08) 0%,transparent 60%)' }} />
              <div className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                <PiggyBank size={14} className="text-white" />
              </div>
              <p className="text-white/50 text-[9px] font-bold uppercase tracking-widest mb-1">Trésorerie globale</p>
              <p className="text-white text-xl font-bold leading-none mb-1">{fmtFCFA(tresorerieGlobale)}</p>
              <p className="text-white/40 text-[9px]">Banque + Caisse</p>
            </motion.div>

            {/* Encaissements ce mois */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="relative rounded-2xl p-4 overflow-hidden"
              style={{ background: 'linear-gradient(135deg,#0a2318 0%,#0e3320 50%,#166534 100%)' }}>
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 80% 10%,rgba(255,255,255,0.08) 0%,transparent 60%)' }} />
              <div className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                <TrendingUp size={14} className="text-white" />
              </div>
              <p className="text-white/50 text-[9px] font-bold uppercase tracking-widest mb-1">Encaissements</p>
              <p className="text-white text-xl font-bold leading-none mb-1">{fmtFCFA(encaissementsMois)}</p>
              <p className="text-white/40 text-[9px]">Ce mois · {monthTx.filter(t => t.type === 'entree').length} op.</p>
            </motion.div>

            {/* Décaissements ce mois */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="relative rounded-2xl p-4 overflow-hidden"
              style={{ background: 'linear-gradient(135deg,#2d0a0a 0%,#4a1010 50%,#7f1d1d 100%)' }}>
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 80% 10%,rgba(255,255,255,0.08) 0%,transparent 60%)' }} />
              <div className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                <TrendingDown size={14} className="text-white" />
              </div>
              <p className="text-white/50 text-[9px] font-bold uppercase tracking-widest mb-1">Décaissements</p>
              <p className="text-white text-xl font-bold leading-none mb-1">{fmtFCFA(decaissementsMois)}</p>
              <p className="text-white/40 text-[9px]">Ce mois · {monthTx.filter(t => t.type === 'sortie').length} op.</p>
            </motion.div>

            {/* Solde net */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="relative rounded-2xl p-4 overflow-hidden"
              style={{ background: soldeGlobal >= 0 ? 'linear-gradient(135deg,#0e1a10 0%,#1a3020 50%,#2EA043 100%)' : 'linear-gradient(135deg,#1a0d0d 0%,#2d0a0a 50%,#7f1d1d 100%)' }}>
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 80% 10%,rgba(255,255,255,0.08) 0%,transparent 60%)' }} />
              <div className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                <Wallet size={14} className="text-white" />
              </div>
              <p className="text-white/50 text-[9px] font-bold uppercase tracking-widest mb-1">Solde net</p>
              <p className="text-white text-xl font-bold leading-none mb-1">{fmtFCFA(soldeGlobal)}</p>
              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/15">
                {soldeGlobal >= 0 ? <TrendingUp size={9} className="text-white" /> : <TrendingDown size={9} className="text-white" />}
                <span className="text-white text-[9px] font-bold">{soldeGlobal >= 0 ? 'Positif' : 'Déficit'}</span>
              </div>
            </motion.div>
          </div>

          {/* Répartition rapide Banque / Caisse */}
          {(comptesBancaires.length > 0 || caisses.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Landmark size={14} className="text-[#388BFD]" />
                  <span className="text-xs font-semibold text-[#E6EDF3]">Comptes bancaires</span>
                  <span className="ml-auto text-xs font-bold text-[#388BFD]">{fmtFCFA(totalBanque)}</span>
                </div>
                {comptesBancaires.length === 0 ? (
                  <p className="text-[10px] text-[#484F58]">Aucun compte configuré</p>
                ) : comptesBancaires.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-[#21262D] last:border-0">
                    <div>
                      <p className="text-xs text-[#E6EDF3]">{c.intitule}</p>
                      <p className="text-[10px] text-[#484F58]">{c.banque}</p>
                    </div>
                    <span className={`text-xs font-bold ${c.solde >= 0 ? 'text-[#2EA043]' : 'text-[#F85149]'}`}>{fmtFCFA(c.solde)}</span>
                  </div>
                ))}
              </div>

              <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Archive size={14} className="text-[#F0A30A]" />
                  <span className="text-xs font-semibold text-[#E6EDF3]">Caisses</span>
                  <span className="ml-auto text-xs font-bold text-[#F0A30A]">{fmtFCFA(totalCaisse)}</span>
                </div>
                {caisses.length === 0 ? (
                  <p className="text-[10px] text-[#484F58]">Aucune caisse configurée</p>
                ) : caisses.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-[#21262D] last:border-0">
                    <div>
                      <p className="text-xs text-[#E6EDF3]">{c.nom}</p>
                      <p className="text-[10px] text-[#484F58]">Cpte {c.numero_compte}</p>
                    </div>
                    <span className={`text-xs font-bold ${c.solde >= 0 ? 'text-[#F0A30A]' : 'text-[#F85149]'}`}>{fmtFCFA(c.solde)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chart */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5">
            <h2 className="text-xs font-semibold text-[#E6EDF3] mb-4">Flux de trésorerie — 30 jours</h2>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={chartFull} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262D" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#8B949E', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8B949E', fontSize: 9 }} axisLine={false} tickLine={false} width={36}
                  tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip contentStyle={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: any, n: any) => [fmtFCFA(Number(v ?? 0)), n]} />
                <Bar dataKey="entrées" fill="#2EA043" radius={[2, 2, 0, 0]} maxBarSize={12} />
                <Bar dataKey="sorties" fill="#F85149" radius={[2, 2, 0, 0]} maxBarSize={12} />
                <Line type="monotone" dataKey="solde" name="Solde cumulé" stroke="#388BFD" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Recent transactions */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl">
            <div className="px-5 py-3 border-b border-[#30363D]">
              <h2 className="text-xs font-semibold text-[#E6EDF3]">Transactions récentes</h2>
            </div>
            {transactions.length === 0 ? (
              <div className="p-10 text-center">
                <Wallet size={24} className="mx-auto mb-2 text-[#30363D]" />
                <p className="text-[#484F58] text-sm">Aucune transaction</p>
              </div>
            ) : (
              <div className="divide-y divide-[#21262D]">
                {transactions.slice(0, 20).map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-[#21262D]/30 transition-colors">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${t.type === 'entree' ? 'bg-[#2EA043]/10' : 'bg-[#F85149]/10'}`}>
                      {t.type === 'entree'
                        ? <ArrowUpCircle size={13} className="text-[#2EA043]" />
                        : <ArrowDownCircle size={13} className="text-[#F85149]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#E6EDF3] truncate">{t.description}</p>
                      <p className="text-[10px] text-[#484F58]">{t.categorie}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-bold ${t.type === 'entree' ? 'text-[#2EA043]' : 'text-[#F85149]'}`}>
                        {t.type === 'entree' ? '+' : '−'}{fmtFCFA(t.montant)}
                      </p>
                      <p className="text-[10px] text-[#484F58]">{fmtDate(t.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: COMPTES BANCAIRES                                                */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'banque' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#8B949E]">
              {comptesBancaires.length} compte{comptesBancaires.length !== 1 ? 's' : ''} · Total{' '}
              <span className="text-[#388BFD] font-bold">{fmtFCFA(totalBanque)}</span>
            </p>
            <button onClick={() => setModal('addBanque')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#388BFD]/15 text-[#388BFD] border border-[#388BFD]/30 hover:bg-[#388BFD]/25 transition-colors">
              <Plus size={12} /> Ajouter un compte
            </button>
          </div>

          {comptesBancaires.length === 0 ? (
            <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-12 text-center">
              <Landmark size={28} className="mx-auto mb-3 text-[#30363D]" />
              <p className="text-[#484F58] text-sm">Aucun compte bancaire</p>
              <p className="text-[#30363D] text-xs mt-1">Ajoutez vos comptes pour suivre vos soldes.</p>
              <button onClick={() => setModal('addBanque')}
                className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-[#388BFD]/15 text-[#388BFD] border border-[#388BFD]/30">
                <Plus size={12} className="inline mr-1" />Ajouter un compte
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {comptesBancaires.map((c, i) => {
                const colors = ['#388BFD', '#2EA043', '#8B5CF6', '#F0A30A', '#F97316']
                const col = colors[i % colors.length]
                return (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 hover:border-[#484F58] transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${col}20` }}>
                        <Landmark size={18} style={{ color: col }} />
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border" style={{ color: col, borderColor: `${col}40`, background: `${col}10` }}>
                        ACTIF
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[#E6EDF3] mb-0.5">{c.intitule}</p>
                    <p className="text-[10px] text-[#484F58] mb-4">{c.banque}{c.numero_compte ? ` · ${c.numero_compte}` : ''}</p>
                    <p className="text-2xl font-bold" style={{ color: col }}>{fmtFCFA(c.solde)}</p>
                    <p className="text-[9px] text-[#484F58] mt-1">Solde actuel</p>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: CAISSE                                                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'caisse' && (
        <div className="space-y-4">

          {/* Sélecteur de caisse — visible si plusieurs */}
          {caisses.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {caisses.map(c => (
                <button key={c.id} onClick={() => setSelectedCaisse(c)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedCaisse?.id === c.id
                      ? 'bg-[#F0A30A]/15 text-[#F0A30A] border-[#F0A30A]/40'
                      : 'text-[#8B949E] border-[#30363D] hover:border-[#484F58]'
                  }`}>
                  <Archive size={12} />
                  {c.nom}
                  <span className="font-bold">{fmtFCFA(c.solde)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Sous-onglets — TOUJOURS visibles */}
          <div className="flex gap-1 border-b border-[#21262D]">
            {CAISSE_TABS.map(tab => {
              const Icon = tab.icon
              const active = caisseTab === tab.id
              return (
                <button key={tab.id} onClick={() => setCaisseTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors relative ${
                    active ? 'text-[#F0A30A]' : 'text-[#484F58] hover:text-[#8B949E]'
                  }`}>
                  <Icon size={12} />
                  {tab.label}
                  {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F0A30A] rounded-full" />}
                </button>
              )
            })}
          </div>

          {/* Empty state — si pas de caisse et pas dans Paramétrage */}
          {caisses.length === 0 && caisseTab !== 'parametrage' && (
            <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-12 text-center">
              <Archive size={28} className="mx-auto mb-3 text-[#30363D]" />
              <p className="text-[#484F58] text-sm">Aucune caisse configurée</p>
              <p className="text-[#30363D] text-xs mt-1">Créez votre première caisse dans Paramétrage.</p>
              <button onClick={() => setCaisseTab('parametrage')}
                className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-[#F0A30A]/15 text-[#F0A30A] border border-[#F0A30A]/30 hover:bg-[#F0A30A]/25 transition-colors">
                Aller au Paramétrage
              </button>
            </div>
          )}

          {/* ── Aperçu ── */}
          {caisseTab === 'apercu' && selectedCaisse && caisses.length > 0 && (
            <div className="space-y-4">
              <div className="relative rounded-2xl p-6 overflow-hidden"
                style={{ background: 'linear-gradient(135deg,#1a1200 0%,#2a1e00 50%,#3d2c00 100%)' }}>
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 80% 10%,rgba(240,163,10,0.15) 0%,transparent 60%)' }} />
                <div className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-[#F0A30A]/20 flex items-center justify-center">
                  <Archive size={18} className="text-[#F0A30A]" />
                </div>
                <p className="text-[#F0A30A]/60 text-[10px] font-bold uppercase tracking-widest mb-2">{selectedCaisse.nom}</p>
                <p className="text-white text-4xl font-bold mb-1">{fmtFCFA(selectedCaisse.solde)}</p>
                <p className="text-[#F0A30A]/40 text-[10px]">Compte {selectedCaisse.numero_compte}</p>
              </div>
              {(() => {
                const todayOps = caisseOps.filter(o => o.date === today())
                const depAuj = todayOps.filter(o => o.type === 'depense').reduce((s, o) => s + o.montant, 0)
                const appAuj = todayOps.filter(o => o.type === 'approvisionnement').reduce((s, o) => s + o.montant, 0)
                return (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#161B22] border border-[#F85149]/20 rounded-xl p-4">
                      <p className="text-[10px] text-[#484F58] mb-1">Dépenses aujourd'hui</p>
                      <p className="text-[#F85149] text-lg font-bold">−{fmtFCFA(depAuj)}</p>
                      <p className="text-[10px] text-[#484F58] mt-0.5">{todayOps.filter(o => o.type === 'depense').length} opération(s)</p>
                    </div>
                    <div className="bg-[#161B22] border border-[#2EA043]/20 rounded-xl p-4">
                      <p className="text-[10px] text-[#484F58] mb-1">Approvisionnements</p>
                      <p className="text-[#2EA043] text-lg font-bold">+{fmtFCFA(appAuj)}</p>
                      <p className="text-[10px] text-[#484F58] mt-0.5">{todayOps.filter(o => o.type === 'approvisionnement').length} opération(s)</p>
                    </div>
                  </div>
                )
              })()}
              <div className="flex gap-2">
                <button onClick={() => { setOpType('depense'); setCaisseTab('operations') }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-[#F85149]/30 bg-[#F85149]/10 text-[#F85149] text-sm font-semibold transition-colors hover:bg-[#F85149]/20">
                  <Minus size={15} /> Dépense
                </button>
                <button onClick={() => { setOpType('approvisionnement'); setCaisseTab('operations') }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-[#2EA043]/30 bg-[#2EA043]/10 text-[#2EA043] text-sm font-semibold transition-colors hover:bg-[#2EA043]/20">
                  <Plus size={15} /> Approvisionnement
                </button>
              </div>
            </div>
          )}

          {/* ── Opérations ── */}
          {caisseTab === 'operations' && selectedCaisse && caisses.length > 0 && (
            <div className="space-y-4">
              <div className="flex gap-1 p-1 bg-[#0D1117] border border-[#30363D] rounded-xl">
                <button onClick={() => setOpType('depense')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    opType === 'depense' ? 'bg-[#F85149] text-white' : 'text-[#8B949E] hover:text-[#E6EDF3]'
                  }`}>
                  <Minus size={14} /> Dépense en espèces
                </button>
                <button onClick={() => setOpType('approvisionnement')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    opType === 'approvisionnement' ? 'bg-[#2EA043] text-white' : 'text-[#8B949E] hover:text-[#E6EDF3]'
                  }`}>
                  <Plus size={14} /> Approvisionnement
                </button>
              </div>
              <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 space-y-4">
                {opType === 'depense' && (
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Catégorie</label>
                    <select value={fOp.categorie} onChange={e => setFOp(f => ({ ...f, categorie: e.target.value }))}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] outline-none focus:border-[#F85149]/50">
                      {CATS_DEPENSE.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Motif</label>
                  <input value={fOp.motif} onChange={e => setFOp(f => ({ ...f, motif: e.target.value }))}
                    placeholder={opType === 'depense' ? 'Ex: Achat carburant générateur…' : 'Ex: Virement depuis compte BGFI…'}
                    className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] placeholder-[#484F58] outline-none focus:border-[#F0A30A]/50" />
                </div>
                {opType === 'depense' && (
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Bénéficiaire</label>
                    <input value={fOp.beneficiaire} onChange={e => setFOp(f => ({ ...f, beneficiaire: e.target.value }))}
                      placeholder="Ex: Pharmacie SIKA…"
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] placeholder-[#484F58] outline-none focus:border-[#F0A30A]/50" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Montant (FCFA)</label>
                    <input type="number" value={fOp.montant} onChange={e => setFOp(f => ({ ...f, montant: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] placeholder-[#484F58] outline-none focus:border-[#F0A30A]/50" />
                  </div>
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Date</label>
                    <input type="date" value={fOp.date} onChange={e => setFOp(f => ({ ...f, date: e.target.value }))}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] outline-none focus:border-[#F0A30A]/50" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">N° pièce / référence</label>
                  <input value={fOp.reference_piece} onChange={e => setFOp(f => ({ ...f, reference_piece: e.target.value }))}
                    placeholder="Ex: RECU-2026-001"
                    className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] placeholder-[#484F58] outline-none focus:border-[#F0A30A]/50" />
                </div>
                {fOp.montant && parseFloat(fOp.montant) > 0 && (
                  <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                    opType === 'depense' ? 'bg-[#F85149]/10 border-[#F85149]/20' : 'bg-[#2EA043]/10 border-[#2EA043]/20'
                  }`}>
                    <span className="text-xs text-[#8B949E]">Solde après opération</span>
                    <span className={`text-sm font-bold ${opType === 'depense' ? 'text-[#F85149]' : 'text-[#2EA043]'}`}>
                      {fmtFCFA(opType === 'depense'
                        ? selectedCaisse.solde - parseFloat(fOp.montant)
                        : selectedCaisse.solde + parseFloat(fOp.montant))}
                    </span>
                  </div>
                )}
                <button onClick={saveCaisseOp} disabled={saving || !fOp.montant}
                  className={`w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 text-white ${
                    opType === 'depense' ? 'bg-[#F85149]' : 'bg-[#2EA043]'
                  }`}>
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {opType === 'depense' ? 'Enregistrer la dépense' : "Enregistrer l'approvisionnement"}
                </button>
              </div>
            </div>
          )}

          {/* ── Journal ── */}
          {caisseTab === 'journal' && selectedCaisse && caisses.length > 0 && (
            <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#30363D] flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#E6EDF3]">Journal de caisse — {selectedCaisse.nom}</h3>
                <span className="text-[10px] text-[#484F58]">{caisseOps.length} opération(s)</span>
              </div>
              {caisseOps.length === 0 ? (
                <div className="p-10 text-center">
                  <FileText size={24} className="mx-auto mb-2 text-[#30363D]" />
                  <p className="text-[#484F58] text-sm">Aucune opération</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#21262D]">
                        {['Date', 'Type', 'Motif', 'Bénéficiaire', 'Réf.', 'Montant', 'Statut'].map(h => (
                          <th key={h} className="text-left px-4 py-2 text-[10px] font-bold text-[#484F58] uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#21262D]">
                      {caisseOps.map(op => (
                        <tr key={op.id} className="hover:bg-[#21262D]/30 transition-colors">
                          <td className="px-4 py-2.5 text-[#8B949E]">{fmtDate(op.date)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              op.type === 'depense' ? 'bg-[#F85149]/10 text-[#F85149]' : 'bg-[#2EA043]/10 text-[#2EA043]'
                            }`}>
                              {op.type === 'depense' ? 'Dépense' : 'Approv.'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-[#E6EDF3] max-w-[140px] truncate">{op.motif ?? '—'}</td>
                          <td className="px-4 py-2.5 text-[#8B949E]">{op.beneficiaire ?? '—'}</td>
                          <td className="px-4 py-2.5 text-[#484F58]">{op.reference_piece ?? '—'}</td>
                          <td className={`px-4 py-2.5 font-bold ${op.type === 'depense' ? 'text-[#F85149]' : 'text-[#2EA043]'}`}>
                            {op.type === 'depense' ? '−' : '+'}{fmtFCFA(op.montant)}
                          </td>
                          <td className="px-4 py-2.5">
                            {op.cloture_date
                              ? <span className="text-[10px] text-[#484F58]">Clôturé</span>
                              : <span className="text-[10px] text-[#F0A30A]">En cours</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Clôture ── */}
          {caisseTab === 'cloture' && selectedCaisse && caisses.length > 0 && (
            <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F0A30A]/20 flex items-center justify-center">
                  <Lock size={18} className="text-[#F0A30A]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#E6EDF3]">Clôture de caisse</p>
                  <p className="text-[10px] text-[#484F58]">Arrêter les opérations d'une journée</p>
                </div>
              </div>
              <div>
                <label className="text-xs text-[#8B949E] mb-1 block">Date à clôturer</label>
                <input type="date" value={clotureDate} onChange={e => setClotureDate(e.target.value)}
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] outline-none focus:border-[#F0A30A]/50" />
              </div>
              <div>
                <label className="text-xs text-[#8B949E] mb-1 block">Solde physique constaté (optionnel)</label>
                <input type="number" value={clotureSolde} onChange={e => setClotureSolde(e.target.value)}
                  placeholder={String(selectedCaisse.solde)}
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] placeholder-[#484F58] outline-none focus:border-[#F0A30A]/50" />
                <p className="text-[10px] text-[#484F58] mt-1">
                  Solde comptable : {fmtFCFA(selectedCaisse.solde)}
                  {clotureSolde && ` · Écart : ${parseFloat(clotureSolde) - selectedCaisse.solde >= 0 ? '+' : ''}${fmtFCFA(parseFloat(clotureSolde) - selectedCaisse.solde)}`}
                </p>
              </div>
              {(() => {
                const toClose = caisseOps.filter(o => o.date === clotureDate && !o.cloture_date)
                return toClose.length > 0 ? (
                  <div className="bg-[#0D1117] border border-[#F0A30A]/20 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-[#F0A30A] mb-2">{toClose.length} opération(s) à clôturer</p>
                    {toClose.map(o => (
                      <div key={o.id} className="flex justify-between text-[10px] py-0.5">
                        <span className="text-[#8B949E]">{o.motif ?? o.type}</span>
                        <span className={o.type === 'depense' ? 'text-[#F85149]' : 'text-[#2EA043]'}>
                          {o.type === 'depense' ? '−' : '+'}{fmtFCFA(o.montant)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-[#484F58]">Aucune opération non clôturée pour cette date.</p>
                )
              })()}
              <button onClick={saveCloture} disabled={savingCloture}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-[#F0A30A] text-[#0D1117] disabled:opacity-50 flex items-center justify-center gap-2">
                {savingCloture && <Loader2 size={13} className="animate-spin" />}
                Clôturer la caisse
              </button>
            </div>
          )}

          {/* ── Paramétrage ── */}
          {caisseTab === 'parametrage' && (
            <div className="space-y-4">
              {caisses.length > 0 && (
                <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#30363D]">
                    <p className="text-xs font-semibold text-[#E6EDF3]">Caisses existantes</p>
                  </div>
                  {caisses.map(c => (
                    <div key={c.id} className="flex items-center gap-3 px-5 py-3 border-b border-[#21262D] last:border-0">
                      <div className="w-8 h-8 rounded-lg bg-[#F0A30A]/10 flex items-center justify-center">
                        <Archive size={14} className="text-[#F0A30A]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-[#E6EDF3]">{c.nom}</p>
                        <p className="text-[10px] text-[#484F58]">Compte {c.numero_compte} · {fmtFCFA(c.solde)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5">
                <p className="text-xs font-semibold text-[#E6EDF3] mb-4">Créer une nouvelle caisse</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Nom de la caisse</label>
                    <input value={fCaisse.nom} onChange={e => setFCaisse(f => ({ ...f, nom: e.target.value }))}
                      placeholder="Ex: Caisse principale, Caisse annexe…"
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] placeholder-[#484F58] outline-none focus:border-[#F0A30A]/50" />
                  </div>
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Compte OHADA</label>
                    <select value={fCaisse.numero_compte} onChange={e => setFCaisse(f => ({ ...f, numero_compte: e.target.value }))}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] outline-none">
                      <option value="571000">571000 — Caisse principale</option>
                      <option value="571100">571100 — Caisse annexe</option>
                      <option value="572000">572000 — Caisse devises</option>
                    </select>
                  </div>
                  <button onClick={saveCaisse} disabled={savingCaisse || !fCaisse.nom}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold bg-[#F0A30A] text-[#0D1117] disabled:opacity-50 flex items-center justify-center gap-2">
                    {savingCaisse && <Loader2 size={13} className="animate-spin" />}
                    Créer la caisse
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PLACEHOLDER TABS                                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {(mainTab === 'import' || mainTab === 'rapprochement' || mainTab === 'previsions') && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#F0A30A]/10 border border-[#F0A30A]/20 flex items-center justify-center">
            {mainTab === 'import'
              ? <Upload size={24} className="text-[#F0A30A]" />
              : mainTab === 'rapprochement'
                ? <GitMerge size={24} className="text-[#F0A30A]" />
                : <BarChart3 size={24} className="text-[#F0A30A]" />}
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[#E6EDF3] mb-1">
              {mainTab === 'import' ? 'Import de relevés bancaires'
                : mainTab === 'rapprochement' ? 'Rapprochement bancaire'
                : 'Prévisions de trésorerie'}
            </p>
            <p className="text-xs text-[#484F58]">Cette fonctionnalité sera disponible prochainement.</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#F0A30A]/10 text-[#F0A30A] text-[10px] font-bold border border-[#F0A30A]/20">
            Bientôt disponible
          </span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL ENCAISSER                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {modal === 'encaisser' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70" onClick={() => setModal(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-[#161B22] border border-[#2EA043]/30 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[#2EA043]/20 flex items-center justify-center">
                  <ArrowUpCircle size={20} className="text-[#2EA043]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#E6EDF3]">Encaisser</h3>
                  <p className="text-[11px] text-[#484F58]">Enregistrer une entrée d'argent</p>
                </div>
                <button onClick={() => setModal(null)} className="ml-auto text-[#484F58] hover:text-[#8B949E]"><X size={16} /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[#8B949E] mb-2 block font-medium">Mode de réception</label>
                  <div className="grid grid-cols-5 gap-2">
                    {MODES.map(m => {
                      const Icon = m.icon
                      const sel = fEnc.mode === m.value
                      return (
                        <button key={m.value} onClick={() => setFEnc(f => ({ ...f, mode: m.value }))}
                          className="flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[10px] font-medium transition-all"
                          style={{ borderColor: sel ? m.color : '#30363D', background: sel ? `${m.color}18` : '#0D1117', color: sel ? m.color : '#484F58' }}>
                          <Icon size={16} />{m.label.split(' ')[0]}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Catégorie</label>
                  <select value={fEnc.categorie} onChange={e => setFEnc(f => ({ ...f, categorie: e.target.value }))}
                    className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] outline-none focus:border-[#2EA043]/50">
                    {CATS_ENTREE.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Description</label>
                  <input value={fEnc.description} onChange={e => setFEnc(f => ({ ...f, description: e.target.value }))}
                    placeholder="Ex: Paiement client KALALA…"
                    className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] placeholder-[#484F58] outline-none focus:border-[#2EA043]/50" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Montant (FCFA)</label>
                    <input type="number" value={fEnc.montant} onChange={e => setFEnc(f => ({ ...f, montant: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] placeholder-[#484F58] outline-none focus:border-[#2EA043]/50" />
                  </div>
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Date</label>
                    <input type="date" value={fEnc.date} onChange={e => setFEnc(f => ({ ...f, date: e.target.value }))}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] outline-none focus:border-[#2EA043]/50" />
                  </div>
                </div>
                {fEnc.montant && parseInt(fEnc.montant) > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2EA043]/10 border border-[#2EA043]/20">
                    <ArrowUpCircle size={14} className="text-[#2EA043]" />
                    <span className="text-[#2EA043] text-sm font-bold">+ {fmtFCFA(parseInt(fEnc.montant))}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setModal(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-[#21262D] border border-[#30363D] text-[#8B949E]">Annuler</button>
                <button onClick={saveEncaisser} disabled={saving || !fEnc.description || !fEnc.montant}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 bg-[#2EA043] text-white">
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL DÉCAISSER                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {modal === 'decaisser' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70" onClick={() => setModal(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-[#161B22] border border-[#F85149]/30 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[#F85149]/20 flex items-center justify-center">
                  <ArrowDownCircle size={20} className="text-[#F85149]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#E6EDF3]">Décaisser</h3>
                  <p className="text-[11px] text-[#484F58]">Enregistrer une sortie d'argent</p>
                </div>
                <button onClick={() => setModal(null)} className="ml-auto text-[#484F58] hover:text-[#8B949E]"><X size={16} /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[#8B949E] mb-2 block font-medium">Mode de paiement</label>
                  <div className="grid grid-cols-5 gap-2">
                    {MODES.map(m => {
                      const Icon = m.icon
                      const sel = fDec.mode === m.value
                      return (
                        <button key={m.value} onClick={() => setFDec(f => ({ ...f, mode: m.value }))}
                          className="flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[10px] font-medium transition-all"
                          style={{ borderColor: sel ? m.color : '#30363D', background: sel ? `${m.color}18` : '#0D1117', color: sel ? m.color : '#484F58' }}>
                          <Icon size={16} />{m.label.split(' ')[0]}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Catégorie</label>
                  <select value={fDec.categorie} onChange={e => setFDec(f => ({ ...f, categorie: e.target.value }))}
                    className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] outline-none focus:border-[#F85149]/50">
                    {CATS_SORTIE.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Description</label>
                  <input value={fDec.description} onChange={e => setFDec(f => ({ ...f, description: e.target.value }))}
                    placeholder="Ex: Loyer bureau janvier…"
                    className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] placeholder-[#484F58] outline-none focus:border-[#F85149]/50" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Montant (FCFA)</label>
                    <input type="number" value={fDec.montant} onChange={e => setFDec(f => ({ ...f, montant: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] placeholder-[#484F58] outline-none focus:border-[#F85149]/50" />
                  </div>
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Date</label>
                    <input type="date" value={fDec.date} onChange={e => setFDec(f => ({ ...f, date: e.target.value }))}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] outline-none focus:border-[#F85149]/50" />
                  </div>
                </div>
                {fDec.montant && parseInt(fDec.montant) > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F85149]/10 border border-[#F85149]/20">
                    <ArrowDownCircle size={14} className="text-[#F85149]" />
                    <span className="text-[#F85149] text-sm font-bold">− {fmtFCFA(parseInt(fDec.montant))}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setModal(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-[#21262D] border border-[#30363D] text-[#8B949E]">Annuler</button>
                <button onClick={saveDecaisser} disabled={saving || !fDec.description || !fDec.montant}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 bg-[#F85149] text-white">
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL AJOUTER COMPTE BANCAIRE                                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {modal === 'addBanque' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70" onClick={() => setModal(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-[#161B22] border border-[#388BFD]/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[#388BFD]/20 flex items-center justify-center">
                  <Landmark size={20} className="text-[#388BFD]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#E6EDF3]">Ajouter un compte</h3>
                  <p className="text-[11px] text-[#484F58]">Compte bancaire de l'entreprise</p>
                </div>
                <button onClick={() => setModal(null)} className="ml-auto text-[#484F58] hover:text-[#8B949E]"><X size={16} /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Banque</label>
                  <select value={fBanque.banque} onChange={e => setFBanque(f => ({ ...f, banque: e.target.value }))}
                    className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] outline-none focus:border-[#388BFD]/50">
                    {BANQUES_CONGO.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Intitulé du compte</label>
                  <input value={fBanque.intitule} onChange={e => setFBanque(f => ({ ...f, intitule: e.target.value }))}
                    placeholder="Ex: Compte courant entreprise"
                    className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] placeholder-[#484F58] outline-none focus:border-[#388BFD]/50" />
                </div>
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Numéro de compte</label>
                  <input value={fBanque.numero_compte} onChange={e => setFBanque(f => ({ ...f, numero_compte: e.target.value }))}
                    placeholder="Ex: 001-12345678-01"
                    className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] placeholder-[#484F58] outline-none focus:border-[#388BFD]/50" />
                </div>
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Solde initial (FCFA)</label>
                  <input type="number" value={fBanque.solde} onChange={e => setFBanque(f => ({ ...f, solde: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] placeholder-[#484F58] outline-none focus:border-[#388BFD]/50" />
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setModal(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-[#21262D] border border-[#30363D] text-[#8B949E]">Annuler</button>
                <button onClick={saveBanque} disabled={saving || !fBanque.intitule}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 bg-[#388BFD] text-white">
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  Ajouter le compte
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
