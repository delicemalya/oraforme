'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  Send, CheckCheck, Clock, XCircle, Link2, AlertTriangle,
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
type BanqueTab = 'comptes' | 'cheques' | 'virements'
type ModalType = 'encaisser' | 'decaisser' | 'addBanque' | null

type Cheque = {
  id: string; compte_bancaire_id: string | null; type: 'emis' | 'recu'
  numero: string; montant: number; beneficiaire: string | null; emetteur: string | null
  banque_tiree: string | null; date_emission: string; date_echeance: string | null
  date_encaissement: string | null; motif: string | null
  statut: 'en_attente' | 'encaisse' | 'rejete' | 'annule'; created_at: string
}
type Virement = {
  id: string; compte_source_id: string | null; compte_source_label: string | null
  compte_dest_label: string; montant: number; motif: string | null
  date: string; statut: 'en_attente' | 'execute' | 'rejete' | 'annule'
  reference: string | null; created_at: string
}
type ReleveLigne = {
  id: string; compte_bancaire_id: string | null; date: string; libelle: string
  montant: number; type: 'credit' | 'debit'; reference: string | null
  statut: 'non_rapproche' | 'rapproche' | 'ignore'; transaction_id: string | null
}
type CsvRow = { date: string; libelle: string; montant: number; type: 'credit' | 'debit' }

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
  { value: 'especes',      label: 'Espèces',      icon: Banknote,   color: '#142850' },
  { value: 'virement',     label: 'Virement',     icon: Building2,  color: '#F08900' },
  { value: 'cheque',       label: 'Chèque',       icon: FileText,   color: '#8B0070' },
  { value: 'airtel_money', label: 'Airtel Money', icon: Smartphone, color: '#F08900' },
  { value: 'mtn_momo',     label: 'MTN MoMo',     icon: Smartphone, color: '#F08900' },
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

const BANQUE_TABS = [
  { id: 'comptes' as BanqueTab,   label: 'Comptes',   icon: Landmark },
  { id: 'cheques' as BanqueTab,   label: 'Chèques',   icon: FileText },
  { id: 'virements' as BanqueTab, label: 'Virements', icon: Send },
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
  const [banqueTab,   setBanqueTab]  = useState<BanqueTab>('comptes')
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

  // ── Chèques ───────────────────────────────────────────────────────────────
  const [cheques,         setCheques]        = useState<Cheque[]>([])
  const [chequeType,      setChequeType]     = useState<'emis' | 'recu'>('emis')
  const [showChequeForm,  setShowChequeForm] = useState(false)
  const [fCheque, setFCheque] = useState({
    numero: '', montant: '', beneficiaire: '', emetteur: '',
    banque_tiree: 'BGFI Bank', date_emission: today(), date_echeance: '',
    motif: '', compte_bancaire_id: '',
  })

  // ── Virements ─────────────────────────────────────────────────────────────
  const [virements,         setVirements]       = useState<Virement[]>([])
  const [showVirementForm,  setShowVirementForm] = useState(false)
  const [fVirement, setFVirement] = useState({
    compte_source_id: '', compte_dest_label: '', montant: '',
    motif: '', date: today(), reference: '',
  })

  // ── Import relevé ─────────────────────────────────────────────────────────
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [csvRows,         setCsvRows]         = useState<CsvRow[]>([])
  const [csvCompte,       setCsvCompte]       = useState('')
  const [importingSaving, setImportingSaving] = useState(false)

  // ── Rapprochement ─────────────────────────────────────────────────────────
  const [releveLignes,    setReleveLignes]   = useState<ReleveLigne[]>([])
  const [rapprochCompte,  setRapprochCompte] = useState('')
  const [rapprochLigne,   setRapprochLigne]  = useState<ReleveLigne | null>(null)
  const [rapprochTx,      setRapprochTx]     = useState<Transaction | null>(null)
  const [rapprochSaving,  setRapprochSaving] = useState(false)

  // ── Prévisions ────────────────────────────────────────────────────────────
  const [previsionDays,   setPrevisionDays]  = useState(30)

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

  // ── Load chèques / virements / relevés ───────────────────────────────────

  async function loadCheques() {
    if (!tenantId) return
    const { data } = await supabase.from('cheques').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
    setCheques((data ?? []) as Cheque[])
  }

  async function loadVirements() {
    if (!tenantId) return
    const { data } = await supabase.from('virements').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
    setVirements((data ?? []) as Virement[])
  }

  async function loadReleves(compteId: string) {
    const { data } = await supabase.from('releve_lignes').select('*')
      .eq('tenant_id', tenantId!).eq('compte_bancaire_id', compteId)
      .order('date', { ascending: false })
    setReleveLignes((data ?? []) as ReleveLigne[])
  }

  useEffect(() => { if (!tLoading && tenantId) { loadCheques(); loadVirements() } }, [tLoading, tenantId])
  useEffect(() => { if (rapprochCompte) loadReleves(rapprochCompte) }, [rapprochCompte])

  // ── Save chèque ───────────────────────────────────────────────────────────

  async function saveCheque() {
    if (!tenantId || !fCheque.numero || !fCheque.montant) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('cheques').insert({
      tenant_id: tenantId, type: chequeType,
      numero: fCheque.numero, montant: parseFloat(fCheque.montant),
      beneficiaire: chequeType === 'emis' ? fCheque.beneficiaire || null : null,
      emetteur: chequeType === 'recu' ? fCheque.emetteur || null : null,
      banque_tiree: fCheque.banque_tiree || null,
      date_emission: fCheque.date_emission,
      date_echeance: fCheque.date_echeance || null,
      motif: fCheque.motif || null,
      compte_bancaire_id: fCheque.compte_bancaire_id || null,
      statut: 'en_attente', created_by: user?.id,
    })
    if (error) showToast(error.message, false)
    else {
      showToast(chequeType === 'emis' ? 'Chèque émis enregistré' : 'Chèque reçu enregistré')
      setFCheque({ numero: '', montant: '', beneficiaire: '', emetteur: '', banque_tiree: 'BGFI Bank', date_emission: today(), date_echeance: '', motif: '', compte_bancaire_id: '' })
      setShowChequeForm(false)
      loadCheques()
    }
    setSaving(false)
  }

  async function encaisserCheque(cheque: Cheque) {
    if (!tenantId) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('cheques').update({ statut: 'encaisse', date_encaissement: today() }).eq('id', cheque.id)
    if (cheque.type === 'recu') {
      const txRes = await supabase.from('transactions').insert({
        tenant_id: tenantId, type: 'entree', categorie: 'Virement reçu',
        description: `Encaissement chèque n°${cheque.numero}${cheque.emetteur ? ' de ' + cheque.emetteur : ''}`,
        montant: cheque.montant, date: today(), mode_paiement: 'cheque',
        source: 'tresorerie', created_by: user?.id,
      }).select('id').single()
      if (txRes.data?.id) {
        await supabase.from('releve_lignes').update({ transaction_id: txRes.data.id }).eq('id', cheque.id)
      }
    }
    showToast(`Chèque de ${fmtFCFA(cheque.montant)} encaissé`)
    loadCheques(); load()
    setSaving(false)
  }

  async function updateChequeStatut(id: string, statut: Cheque['statut']) {
    await supabase.from('cheques').update({ statut }).eq('id', id)
    loadCheques()
    showToast(statut === 'annule' ? 'Chèque annulé' : statut === 'rejete' ? 'Chèque rejeté' : 'Statut mis à jour')
  }

  // ── Save virement ─────────────────────────────────────────────────────────

  async function saveVirement() {
    if (!tenantId || !fVirement.compte_dest_label || !fVirement.montant) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const sourceCompte = comptesBancaires.find(c => c.id === fVirement.compte_source_id)
    const { error } = await supabase.from('virements').insert({
      tenant_id: tenantId, compte_source_id: fVirement.compte_source_id || null,
      compte_source_label: sourceCompte?.intitule ?? null,
      compte_dest_label: fVirement.compte_dest_label,
      montant: parseFloat(fVirement.montant), motif: fVirement.motif || null,
      date: fVirement.date, reference: fVirement.reference || null,
      statut: 'en_attente', created_by: user?.id,
    })
    if (error) showToast(error.message, false)
    else {
      showToast('Virement enregistré')
      setFVirement({ compte_source_id: '', compte_dest_label: '', montant: '', motif: '', date: today(), reference: '' })
      setShowVirementForm(false)
      loadVirements()
    }
    setSaving(false)
  }

  async function updateVirementStatut(id: string, statut: Virement['statut']) {
    const { data: { user } } = await supabase.auth.getUser()
    const v = virements.find(x => x.id === id)
    await supabase.from('virements').update({ statut }).eq('id', id)
    if (statut === 'execute' && v && tenantId) {
      await supabase.from('transactions').insert({
        tenant_id: tenantId, type: 'sortie', categorie: 'Charges diverses',
        description: `Virement vers ${v.compte_dest_label}${v.motif ? ' — ' + v.motif : ''}`,
        montant: v.montant, date: v.date, mode_paiement: 'virement',
        source: 'tresorerie', created_by: user?.id,
      })
      load()
    }
    loadVirements()
    showToast(statut === 'execute' ? 'Virement exécuté' : 'Virement annulé')
  }

  // ── CSV Parser ────────────────────────────────────────────────────────────

  function handleCSVFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvRows(parseCSV(text))
    }
    reader.readAsText(file, 'latin1')
  }

  function parseCSV(text: string): CsvRow[] {
    const lines = text.trim().split(/\r?\n/)
    if (lines.length < 2) return []
    const sep = lines[0].includes(';') ? ';' : ','
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/["\r]/g, ''))
    const idx = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)))
    const dateIdx    = idx(['date'])
    const libelIdx   = idx(['libel', 'descr', 'motif', 'opéra', 'label'])
    const debitIdx   = idx(['débit', 'debit', 'sortie', 'retrait', 'debet'])
    const creditIdx  = idx(['crédit', 'credit', 'entrée', 'versem', 'credit'])
    const montantIdx = idx(['montant', 'amount', 'solde'])
    if (dateIdx === -1 || libelIdx === -1) return []
    const parseAmt = (s: string) => parseFloat(s.replace(/\s/g, '').replace(',', '.')) || 0
    const rows: CsvRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep).map(c => c.trim().replace(/["\r]/g, ''))
      const rawDate = cols[dateIdx] ?? ''
      const libelle = cols[libelIdx] ?? ''
      if (!rawDate || !libelle) continue
      const dm = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
      const date = dm ? `${dm[3]}-${dm[2].padStart(2,'0')}-${dm[1].padStart(2,'0')}` : rawDate
      let montant = 0; let type: 'credit' | 'debit' = 'credit'
      if (debitIdx !== -1 && creditIdx !== -1) {
        const d = parseAmt(cols[debitIdx]); const c = parseAmt(cols[creditIdx])
        if (d > 0) { montant = d; type = 'debit' } else if (c > 0) { montant = c; type = 'credit' } else continue
      } else if (montantIdx !== -1) {
        const raw = parseAmt(cols[montantIdx]); montant = Math.abs(raw); type = raw >= 0 ? 'credit' : 'debit'
      } else continue
      if (montant === 0) continue
      rows.push({ date, libelle, montant, type })
    }
    return rows
  }

  async function importReleve() {
    if (!tenantId || !csvCompte || csvRows.length === 0) return
    setImportingSaving(true)
    const rows = csvRows.map(r => ({
      tenant_id: tenantId, compte_bancaire_id: csvCompte,
      date: r.date, libelle: r.libelle, montant: r.montant,
      type: r.type, statut: 'non_rapproche',
    }))
    const { error } = await supabase.from('releve_lignes').insert(rows)
    if (error) showToast(error.message, false)
    else {
      showToast(`${rows.length} lignes importées`)
      setCsvRows([])
      if (csvInputRef.current) csvInputRef.current.value = ''
      setRapprochCompte(csvCompte)
      setMainTab('rapprochement')
      loadReleves(csvCompte)
    }
    setImportingSaving(false)
  }

  // ── Rapprochement ─────────────────────────────────────────────────────────

  async function rapprocher(ligne: ReleveLigne, tx: Transaction) {
    setRapprochSaving(true)
    await supabase.from('releve_lignes').update({ statut: 'rapproche', transaction_id: tx.id }).eq('id', ligne.id)
    showToast('Rapprochement effectué')
    setRapprochLigne(null); setRapprochTx(null)
    loadReleves(rapprochCompte)
    setRapprochSaving(false)
  }

  async function ignorerLigne(id: string) {
    await supabase.from('releve_lignes').update({ statut: 'ignore' }).eq('id', id)
    setRapprochLigne(null)
    loadReleves(rapprochCompte)
  }

  async function autoRapprocher() {
    setRapprochSaving(true)
    let matched = 0
    const pending = releveLignes.filter(l => l.statut === 'non_rapproche')
    for (const ligne of pending) {
      const txType = ligne.type === 'credit' ? 'entree' : 'sortie'
      const match = transactions.find(tx =>
        tx.type === txType &&
        Math.abs(tx.montant - ligne.montant) < 1 &&
        Math.abs(new Date(tx.date).getTime() - new Date(ligne.date).getTime()) <= 5 * 86400000
      )
      if (match) {
        await supabase.from('releve_lignes').update({ statut: 'rapproche', transaction_id: match.id }).eq('id', ligne.id)
        matched++
      }
    }
    showToast(`${matched} rapprochement(s) automatique(s)`)
    loadReleves(rapprochCompte)
    setRapprochSaving(false)
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
            style={{ background: toast.ok ? '#142850' : '#1A0D0D', borderColor: toast.ok ? '#142850' : '#F51E33', color: toast.ok ? '#142850' : '#F51E33' }}>
            {toast.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-[#FFFFFF]">Trésorerie</h1>
          <p className="text-xs text-[#484F58]">Gestion des flux financiers</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModal('encaisser')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#142850]/15 text-[#142850] border border-[#142850]/30 hover:bg-[#142850]/25 transition-colors">
            <ArrowUpCircle size={13} /> Encaisser
          </button>
          <button onClick={() => setModal('decaisser')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F51E33]/15 text-[#F51E33] border border-[#F51E33]/30 hover:bg-[#F51E33]/25 transition-colors">
            <ArrowDownCircle size={13} /> Décaisser
          </button>
          <button onClick={load}
            className="p-1.5 rounded-lg text-[#484F58] hover:text-[#8B949E] hover:bg-[#1a2d50] transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Main tab nav ──────────────────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-5 border-b border-[#1a2d50]">
        {MAIN_TABS.map(tab => {
          const Icon = tab.icon
          const active = mainTab === tab.id
          return (
            <button key={tab.id} onClick={() => setMainTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium whitespace-nowrap transition-colors relative ${
                active
                  ? 'text-[#F08900] bg-[#F08900]/5'
                  : 'text-[#484F58] hover:text-[#8B949E] hover:bg-[#1a2d50]'
              }`}>
              <Icon size={13} />
              {tab.label}
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F08900] rounded-full" />
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
              style={{ background: '#1a3a6b' }}>
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'transparent' }} />
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
              style={{ background: '#142850' }}>
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'transparent' }} />
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
              style={{ background: '#F51E33' }}>
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'transparent' }} />
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
              style={{ background: soldeGlobal >= 0 ? '#142850' : '#F51E33' }}>
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'transparent' }} />
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
              <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Landmark size={14} className="text-[#F08900]" />
                  <span className="text-xs font-semibold text-[#FFFFFF]">Comptes bancaires</span>
                  <span className="ml-auto text-xs font-bold text-[#F08900]">{fmtFCFA(totalBanque)}</span>
                </div>
                {comptesBancaires.length === 0 ? (
                  <p className="text-[10px] text-[#484F58]">Aucun compte configuré</p>
                ) : comptesBancaires.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-[#1a2d50] last:border-0">
                    <div>
                      <p className="text-xs text-[#FFFFFF]">{c.intitule}</p>
                      <p className="text-[10px] text-[#484F58]">{c.banque}</p>
                    </div>
                    <span className={`text-xs font-bold ${c.solde >= 0 ? 'text-[#142850]' : 'text-[#F51E33]'}`}>{fmtFCFA(c.solde)}</span>
                  </div>
                ))}
              </div>

              <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Archive size={14} className="text-[#F08900]" />
                  <span className="text-xs font-semibold text-[#FFFFFF]">Caisses</span>
                  <span className="ml-auto text-xs font-bold text-[#F08900]">{fmtFCFA(totalCaisse)}</span>
                </div>
                {caisses.length === 0 ? (
                  <p className="text-[10px] text-[#484F58]">Aucune caisse configurée</p>
                ) : caisses.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-[#1a2d50] last:border-0">
                    <div>
                      <p className="text-xs text-[#FFFFFF]">{c.nom}</p>
                      <p className="text-[10px] text-[#484F58]">Cpte {c.numero_compte}</p>
                    </div>
                    <span className={`text-xs font-bold ${c.solde >= 0 ? 'text-[#F08900]' : 'text-[#F51E33]'}`}>{fmtFCFA(c.solde)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chart */}
          <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl p-5">
            <h2 className="text-xs font-semibold text-[#FFFFFF] mb-4">Flux de trésorerie — 30 jours</h2>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={chartFull} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2d50" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#8B949E', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8B949E', fontSize: 9 }} axisLine={false} tickLine={false} width={36}
                  tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip contentStyle={{ background: '#0f1e3d', border: '1px solid #30363D', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: any, n: any) => [fmtFCFA(Number(v ?? 0)), n]} />
                <Bar dataKey="entrées" fill="#142850" radius={[2, 2, 0, 0]} maxBarSize={12} />
                <Bar dataKey="sorties" fill="#F51E33" radius={[2, 2, 0, 0]} maxBarSize={12} />
                <Line type="monotone" dataKey="solde" name="Solde cumulé" stroke="#F08900" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Recent transactions */}
          <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl">
            <div className="px-5 py-3 border-b border-[#30363D]">
              <h2 className="text-xs font-semibold text-[#FFFFFF]">Transactions récentes</h2>
            </div>
            {transactions.length === 0 ? (
              <div className="p-10 text-center">
                <Wallet size={24} className="mx-auto mb-2 text-[#30363D]" />
                <p className="text-[#484F58] text-sm">Aucune transaction</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1a2d50]">
                {transactions.slice(0, 20).map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-[#1a2d50]/30 transition-colors">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${t.type === 'entree' ? 'bg-[#142850]/10' : 'bg-[#F51E33]/10'}`}>
                      {t.type === 'entree'
                        ? <ArrowUpCircle size={13} className="text-[#142850]" />
                        : <ArrowDownCircle size={13} className="text-[#F51E33]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#FFFFFF] truncate">{t.description}</p>
                      <p className="text-[10px] text-[#484F58]">{t.categorie}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-bold ${t.type === 'entree' ? 'text-[#142850]' : 'text-[#F51E33]'}`}>
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
          {/* Sous-onglets banque */}
          <div className="flex gap-1 border-b border-[#1a2d50]">
            {BANQUE_TABS.map(tab => {
              const Icon = tab.icon
              const active = banqueTab === tab.id
              return (
                <button key={tab.id} onClick={() => setBanqueTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors relative ${active ? 'text-[#F08900]' : 'text-[#484F58] hover:text-[#8B949E]'}`}>
                  <Icon size={12} />{tab.label}
                  {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F08900] rounded-full" />}
                </button>
              )
            })}
            <div className="ml-auto flex items-center">
              <button onClick={() => setModal('addBanque')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F08900]/15 text-[#F08900] border border-[#F08900]/30 hover:bg-[#F08900]/25 transition-colors">
                <Plus size={12} /> Compte
              </button>
            </div>
          </div>

          {/* ── Comptes ── */}
          {banqueTab === 'comptes' && (
            comptesBancaires.length === 0 ? (
              <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl p-12 text-center">
                <Landmark size={28} className="mx-auto mb-3 text-[#30363D]" />
                <p className="text-[#484F58] text-sm">Aucun compte bancaire</p>
                <p className="text-[#30363D] text-xs mt-1">Ajoutez vos comptes pour suivre vos soldes.</p>
                <button onClick={() => setModal('addBanque')} className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-[#F08900]/15 text-[#F08900] border border-[#F08900]/30">
                  <Plus size={12} className="inline mr-1" />Ajouter un compte
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {comptesBancaires.map((c, i) => {
                  const colors = ['#F08900', '#142850', '#8B0070', '#F08900', '#F08900']
                  const col = colors[i % colors.length]
                  return (
                    <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl p-5 hover:border-[#484F58] transition-colors">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${col}20` }}>
                          <Landmark size={18} style={{ color: col }} />
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border" style={{ color: col, borderColor: `${col}40`, background: `${col}10` }}>ACTIF</span>
                      </div>
                      <p className="text-sm font-bold text-[#FFFFFF] mb-0.5">{c.intitule}</p>
                      <p className="text-[10px] text-[#484F58] mb-4">{c.banque}{c.numero_compte ? ` · ${c.numero_compte}` : ''}</p>
                      <p className="text-2xl font-bold" style={{ color: col }}>{fmtFCFA(c.solde)}</p>
                      <p className="text-[9px] text-[#484F58] mt-1">Solde actuel</p>
                    </motion.div>
                  )
                })}
              </div>
            )
          )}

          {/* ── Chèques ── */}
          {banqueTab === 'cheques' && (
            <div className="space-y-4">
              {/* Toggle émis / reçus */}
              <div className="flex gap-2 items-center flex-wrap">
                <div className="flex gap-1 p-1 bg-[#142850] border border-[#30363D] rounded-xl">
                  {(['emis', 'recu'] as const).map(t => (
                    <button key={t} onClick={() => setChequeType(t)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${chequeType === t ? 'bg-[#8B0070] text-white' : 'text-[#8B949E] hover:text-[#FFFFFF]'}`}>
                      {t === 'emis' ? 'Chèques émis' : 'Chèques reçus'}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowChequeForm(f => !f)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#8B0070]/15 text-[#8B0070] border border-[#8B0070]/30 hover:bg-[#8B0070]/25 transition-colors">
                  <Plus size={12} /> {chequeType === 'emis' ? 'Émettre un chèque' : 'Enregistrer un chèque reçu'}
                </button>
              </div>

              {/* Formulaire chèque */}
              {showChequeForm && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-[#0f1e3d] border border-[#8B0070]/30 rounded-2xl p-5 space-y-3">
                  <p className="text-xs font-bold text-[#FFFFFF]">{chequeType === 'emis' ? 'Nouveau chèque émis' : 'Chèque reçu à encaisser'}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#8B949E] mb-1 block">N° chèque *</label>
                      <input value={fCheque.numero} onChange={e => setFCheque(f => ({ ...f, numero: e.target.value }))}
                        placeholder="Ex: 0012345" className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none focus:border-[#8B0070]/50" />
                    </div>
                    <div>
                      <label className="text-xs text-[#8B949E] mb-1 block">Montant (FCFA) *</label>
                      <input type="number" value={fCheque.montant} onChange={e => setFCheque(f => ({ ...f, montant: e.target.value }))}
                        placeholder="0" className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none focus:border-[#8B0070]/50" />
                    </div>
                    <div>
                      <label className="text-xs text-[#8B949E] mb-1 block">{chequeType === 'emis' ? 'Bénéficiaire' : 'Émetteur'}</label>
                      <input value={chequeType === 'emis' ? fCheque.beneficiaire : fCheque.emetteur}
                        onChange={e => setFCheque(f => chequeType === 'emis' ? { ...f, beneficiaire: e.target.value } : { ...f, emetteur: e.target.value })}
                        placeholder="Nom..." className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none focus:border-[#8B0070]/50" />
                    </div>
                    <div>
                      <label className="text-xs text-[#8B949E] mb-1 block">Banque tirée</label>
                      <select value={fCheque.banque_tiree} onChange={e => setFCheque(f => ({ ...f, banque_tiree: e.target.value }))}
                        className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] outline-none">
                        {BANQUES_CONGO.map(b => <option key={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-[#8B949E] mb-1 block">Date d'émission</label>
                      <input type="date" value={fCheque.date_emission} onChange={e => setFCheque(f => ({ ...f, date_emission: e.target.value }))}
                        className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-[#8B949E] mb-1 block">Compte bancaire</label>
                      <select value={fCheque.compte_bancaire_id} onChange={e => setFCheque(f => ({ ...f, compte_bancaire_id: e.target.value }))}
                        className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] outline-none">
                        <option value="">— Aucun —</option>
                        {comptesBancaires.map(c => <option key={c.id} value={c.id}>{c.intitule} · {c.banque}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Motif</label>
                    <input value={fCheque.motif} onChange={e => setFCheque(f => ({ ...f, motif: e.target.value }))}
                      placeholder="Objet du chèque..." className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowChequeForm(false)} className="flex-1 py-2 rounded-xl text-sm bg-[#1a2d50] border border-[#30363D] text-[#8B949E]">Annuler</button>
                    <button onClick={saveCheque} disabled={saving || !fCheque.numero || !fCheque.montant}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold bg-[#8B0070] text-white disabled:opacity-50 flex items-center justify-center gap-2">
                      {saving && <Loader2 size={13} className="animate-spin" />} Enregistrer
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Liste des chèques */}
              {cheques.filter(c => c.type === chequeType).length === 0 ? (
                <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl p-10 text-center">
                  <FileText size={24} className="mx-auto mb-2 text-[#30363D]" />
                  <p className="text-[#484F58] text-sm">Aucun chèque {chequeType === 'emis' ? 'émis' : 'reçu'}</p>
                </div>
              ) : (
                <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#1a2d50]">
                          {['N° chèque', chequeType === 'emis' ? 'Bénéficiaire' : 'Émetteur', 'Banque', 'Montant', 'Date', 'Statut', 'Actions'].map(h => (
                            <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-[#484F58] uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1a2d50]">
                        {cheques.filter(c => c.type === chequeType).map(ch => (
                          <tr key={ch.id} className="hover:bg-[#1a2d50]/30 transition-colors">
                            <td className="px-4 py-2.5 font-mono text-[#FFFFFF]">{ch.numero}</td>
                            <td className="px-4 py-2.5 text-[#8B949E]">{(chequeType === 'emis' ? ch.beneficiaire : ch.emetteur) ?? '—'}</td>
                            <td className="px-4 py-2.5 text-[#484F58]">{ch.banque_tiree ?? '—'}</td>
                            <td className="px-4 py-2.5 font-bold text-[#8B0070]">{fmtFCFA(ch.montant)}</td>
                            <td className="px-4 py-2.5 text-[#484F58]">{fmtDate(ch.date_emission)}</td>
                            <td className="px-4 py-2.5">
                              {ch.statut === 'en_attente' && <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#F08900]/10 text-[#F08900] font-semibold flex items-center gap-1 w-fit"><Clock size={9} />En attente</span>}
                              {ch.statut === 'encaisse'   && <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#142850]/10 text-[#142850] font-semibold flex items-center gap-1 w-fit"><CheckCircle size={9} />Encaissé</span>}
                              {ch.statut === 'rejete'     && <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#F51E33]/10 text-[#F51E33] font-semibold flex items-center gap-1 w-fit"><AlertTriangle size={9} />Rejeté</span>}
                              {ch.statut === 'annule'     && <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#484F58]/10 text-[#484F58] font-semibold flex items-center gap-1 w-fit"><XCircle size={9} />Annulé</span>}
                            </td>
                            <td className="px-4 py-2.5">
                              {ch.statut === 'en_attente' && (
                                <div className="flex gap-1">
                                  {chequeType === 'recu' && (
                                    <button onClick={() => encaisserCheque(ch)} disabled={saving}
                                      className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-[#142850]/15 text-[#142850] border border-[#142850]/30 hover:bg-[#142850]/25 disabled:opacity-50">
                                      Encaisser
                                    </button>
                                  )}
                                  <button onClick={() => updateChequeStatut(ch.id, 'rejete')}
                                    className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-[#F51E33]/15 text-[#F51E33] border border-[#F51E33]/30 hover:bg-[#F51E33]/25">
                                    Rejeter
                                  </button>
                                  <button onClick={() => updateChequeStatut(ch.id, 'annule')}
                                    className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-[#1a2d50] text-[#484F58] border border-[#30363D]">
                                    Annuler
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Virements ── */}
          {banqueTab === 'virements' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => setShowVirementForm(f => !f)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F08900]/15 text-[#F08900] border border-[#F08900]/30 hover:bg-[#F08900]/25 transition-colors">
                  <Plus size={12} /> Nouveau virement
                </button>
              </div>

              {showVirementForm && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-[#0f1e3d] border border-[#F08900]/30 rounded-2xl p-5 space-y-3">
                  <p className="text-xs font-bold text-[#FFFFFF]">Ordre de virement</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#8B949E] mb-1 block">Compte source</label>
                      <select value={fVirement.compte_source_id} onChange={e => setFVirement(f => ({ ...f, compte_source_id: e.target.value }))}
                        className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] outline-none">
                        <option value="">— Aucun —</option>
                        {comptesBancaires.map(c => <option key={c.id} value={c.id}>{c.intitule}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-[#8B949E] mb-1 block">Destination *</label>
                      <input value={fVirement.compte_dest_label} onChange={e => setFVirement(f => ({ ...f, compte_dest_label: e.target.value }))}
                        placeholder="Ex: Fournisseur MAKALA, BGFI 0012…"
                        className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none focus:border-[#F08900]/50" />
                    </div>
                    <div>
                      <label className="text-xs text-[#8B949E] mb-1 block">Montant (FCFA) *</label>
                      <input type="number" value={fVirement.montant} onChange={e => setFVirement(f => ({ ...f, montant: e.target.value }))}
                        placeholder="0" className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none focus:border-[#F08900]/50" />
                    </div>
                    <div>
                      <label className="text-xs text-[#8B949E] mb-1 block">Date</label>
                      <input type="date" value={fVirement.date} onChange={e => setFVirement(f => ({ ...f, date: e.target.value }))}
                        className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-[#8B949E] mb-1 block">Motif</label>
                      <input value={fVirement.motif} onChange={e => setFVirement(f => ({ ...f, motif: e.target.value }))}
                        placeholder="Objet du virement…"
                        className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-[#8B949E] mb-1 block">Référence bancaire</label>
                      <input value={fVirement.reference} onChange={e => setFVirement(f => ({ ...f, reference: e.target.value }))}
                        placeholder="Ex: VIR-2026-001"
                        className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowVirementForm(false)} className="flex-1 py-2 rounded-xl text-sm bg-[#1a2d50] border border-[#30363D] text-[#8B949E]">Annuler</button>
                    <button onClick={saveVirement} disabled={saving || !fVirement.compte_dest_label || !fVirement.montant}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold bg-[#F08900] text-white disabled:opacity-50 flex items-center justify-center gap-2">
                      {saving && <Loader2 size={13} className="animate-spin" />} Enregistrer
                    </button>
                  </div>
                </motion.div>
              )}

              {virements.length === 0 ? (
                <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl p-10 text-center">
                  <Send size={24} className="mx-auto mb-2 text-[#30363D]" />
                  <p className="text-[#484F58] text-sm">Aucun virement</p>
                </div>
              ) : (
                <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#1a2d50]">
                          {['Date', 'Source', 'Destination', 'Montant', 'Motif', 'Réf.', 'Statut', 'Actions'].map(h => (
                            <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-[#484F58] uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1a2d50]">
                        {virements.map(v => (
                          <tr key={v.id} className="hover:bg-[#1a2d50]/30 transition-colors">
                            <td className="px-4 py-2.5 text-[#8B949E]">{fmtDate(v.date)}</td>
                            <td className="px-4 py-2.5 text-[#484F58]">{v.compte_source_label ?? '—'}</td>
                            <td className="px-4 py-2.5 text-[#FFFFFF] max-w-[120px] truncate">{v.compte_dest_label}</td>
                            <td className="px-4 py-2.5 font-bold text-[#F08900]">{fmtFCFA(v.montant)}</td>
                            <td className="px-4 py-2.5 text-[#8B949E] max-w-[100px] truncate">{v.motif ?? '—'}</td>
                            <td className="px-4 py-2.5 text-[#484F58]">{v.reference ?? '—'}</td>
                            <td className="px-4 py-2.5">
                              {v.statut === 'en_attente' && <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#F08900]/10 text-[#F08900] font-semibold flex items-center gap-1 w-fit"><Clock size={9} />En attente</span>}
                              {v.statut === 'execute'    && <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#142850]/10 text-[#142850] font-semibold flex items-center gap-1 w-fit"><CheckCircle size={9} />Exécuté</span>}
                              {v.statut === 'rejete'     && <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#F51E33]/10 text-[#F51E33] font-semibold flex items-center gap-1 w-fit"><AlertTriangle size={9} />Rejeté</span>}
                              {v.statut === 'annule'     && <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#484F58]/10 text-[#484F58] font-semibold flex items-center gap-1 w-fit"><XCircle size={9} />Annulé</span>}
                            </td>
                            <td className="px-4 py-2.5">
                              {v.statut === 'en_attente' && (
                                <div className="flex gap-1">
                                  <button onClick={() => updateVirementStatut(v.id, 'execute')} disabled={saving}
                                    className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-[#142850]/15 text-[#142850] border border-[#142850]/30 hover:bg-[#142850]/25 disabled:opacity-50">
                                    Exécuter
                                  </button>
                                  <button onClick={() => updateVirementStatut(v.id, 'annule')}
                                    className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-[#1a2d50] text-[#484F58] border border-[#30363D]">
                                    Annuler
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
                      ? 'bg-[#F08900]/15 text-[#F08900] border-[#F08900]/40'
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
          <div className="flex gap-1 border-b border-[#1a2d50]">
            {CAISSE_TABS.map(tab => {
              const Icon = tab.icon
              const active = caisseTab === tab.id
              return (
                <button key={tab.id} onClick={() => setCaisseTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors relative ${
                    active ? 'text-[#F08900]' : 'text-[#484F58] hover:text-[#8B949E]'
                  }`}>
                  <Icon size={12} />
                  {tab.label}
                  {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F08900] rounded-full" />}
                </button>
              )
            })}
          </div>

          {/* Empty state — si pas de caisse et pas dans Paramétrage */}
          {caisses.length === 0 && caisseTab !== 'parametrage' && (
            <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl p-12 text-center">
              <Archive size={28} className="mx-auto mb-3 text-[#30363D]" />
              <p className="text-[#484F58] text-sm">Aucune caisse configurée</p>
              <p className="text-[#30363D] text-xs mt-1">Créez votre première caisse dans Paramétrage.</p>
              <button onClick={() => setCaisseTab('parametrage')}
                className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-[#F08900]/15 text-[#F08900] border border-[#F08900]/30 hover:bg-[#F08900]/25 transition-colors">
                Aller au Paramétrage
              </button>
            </div>
          )}

          {/* ── Aperçu ── */}
          {caisseTab === 'apercu' && selectedCaisse && caisses.length > 0 && (
            <div className="space-y-4">
              <div className="relative rounded-2xl p-6 overflow-hidden"
                style={{ background: '#F08900' }}>
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'transparent' }} />
                <div className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-[#F08900]/20 flex items-center justify-center">
                  <Archive size={18} className="text-[#F08900]" />
                </div>
                <p className="text-[#F08900]/60 text-[10px] font-bold uppercase tracking-widest mb-2">{selectedCaisse.nom}</p>
                <p className="text-white text-4xl font-bold mb-1">{fmtFCFA(selectedCaisse.solde)}</p>
                <p className="text-[#F08900]/40 text-[10px]">Compte {selectedCaisse.numero_compte}</p>
              </div>
              {(() => {
                const todayOps = caisseOps.filter(o => o.date === today())
                const depAuj = todayOps.filter(o => o.type === 'depense').reduce((s, o) => s + o.montant, 0)
                const appAuj = todayOps.filter(o => o.type === 'approvisionnement').reduce((s, o) => s + o.montant, 0)
                return (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#0f1e3d] border border-[#F51E33]/20 rounded-xl p-4">
                      <p className="text-[10px] text-[#484F58] mb-1">Dépenses aujourd'hui</p>
                      <p className="text-[#F51E33] text-lg font-bold">−{fmtFCFA(depAuj)}</p>
                      <p className="text-[10px] text-[#484F58] mt-0.5">{todayOps.filter(o => o.type === 'depense').length} opération(s)</p>
                    </div>
                    <div className="bg-[#0f1e3d] border border-[#142850]/20 rounded-xl p-4">
                      <p className="text-[10px] text-[#484F58] mb-1">Approvisionnements</p>
                      <p className="text-[#142850] text-lg font-bold">+{fmtFCFA(appAuj)}</p>
                      <p className="text-[10px] text-[#484F58] mt-0.5">{todayOps.filter(o => o.type === 'approvisionnement').length} opération(s)</p>
                    </div>
                  </div>
                )
              })()}
              <div className="flex gap-2">
                <button onClick={() => { setOpType('depense'); setCaisseTab('operations') }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-[#F51E33]/30 bg-[#F51E33]/10 text-[#F51E33] text-sm font-semibold transition-colors hover:bg-[#F51E33]/20">
                  <Minus size={15} /> Dépense
                </button>
                <button onClick={() => { setOpType('approvisionnement'); setCaisseTab('operations') }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-[#142850]/30 bg-[#142850]/10 text-[#142850] text-sm font-semibold transition-colors hover:bg-[#142850]/20">
                  <Plus size={15} /> Approvisionnement
                </button>
              </div>
            </div>
          )}

          {/* ── Opérations ── */}
          {caisseTab === 'operations' && selectedCaisse && caisses.length > 0 && (
            <div className="space-y-4">
              <div className="flex gap-1 p-1 bg-[#142850] border border-[#30363D] rounded-xl">
                <button onClick={() => setOpType('depense')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    opType === 'depense' ? 'bg-[#F51E33] text-white' : 'text-[#8B949E] hover:text-[#FFFFFF]'
                  }`}>
                  <Minus size={14} /> Dépense en espèces
                </button>
                <button onClick={() => setOpType('approvisionnement')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    opType === 'approvisionnement' ? 'bg-[#142850] text-white' : 'text-[#8B949E] hover:text-[#FFFFFF]'
                  }`}>
                  <Plus size={14} /> Approvisionnement
                </button>
              </div>
              <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl p-5 space-y-4">
                {opType === 'depense' && (
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Catégorie</label>
                    <select value={fOp.categorie} onChange={e => setFOp(f => ({ ...f, categorie: e.target.value }))}
                      className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] outline-none focus:border-[#F51E33]/50">
                      {CATS_DEPENSE.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Motif</label>
                  <input value={fOp.motif} onChange={e => setFOp(f => ({ ...f, motif: e.target.value }))}
                    placeholder={opType === 'depense' ? 'Ex: Achat carburant générateur…' : 'Ex: Virement depuis compte BGFI…'}
                    className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none focus:border-[#F08900]/50" />
                </div>
                {opType === 'depense' && (
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Bénéficiaire</label>
                    <input value={fOp.beneficiaire} onChange={e => setFOp(f => ({ ...f, beneficiaire: e.target.value }))}
                      placeholder="Ex: Pharmacie SIKA…"
                      className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none focus:border-[#F08900]/50" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Montant (FCFA)</label>
                    <input type="number" value={fOp.montant} onChange={e => setFOp(f => ({ ...f, montant: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none focus:border-[#F08900]/50" />
                  </div>
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Date</label>
                    <input type="date" value={fOp.date} onChange={e => setFOp(f => ({ ...f, date: e.target.value }))}
                      className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] outline-none focus:border-[#F08900]/50" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">N° pièce / référence</label>
                  <input value={fOp.reference_piece} onChange={e => setFOp(f => ({ ...f, reference_piece: e.target.value }))}
                    placeholder="Ex: RECU-2026-001"
                    className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none focus:border-[#F08900]/50" />
                </div>
                {fOp.montant && parseFloat(fOp.montant) > 0 && (
                  <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                    opType === 'depense' ? 'bg-[#F51E33]/10 border-[#F51E33]/20' : 'bg-[#142850]/10 border-[#142850]/20'
                  }`}>
                    <span className="text-xs text-[#8B949E]">Solde après opération</span>
                    <span className={`text-sm font-bold ${opType === 'depense' ? 'text-[#F51E33]' : 'text-[#142850]'}`}>
                      {fmtFCFA(opType === 'depense'
                        ? selectedCaisse.solde - parseFloat(fOp.montant)
                        : selectedCaisse.solde + parseFloat(fOp.montant))}
                    </span>
                  </div>
                )}
                <button onClick={saveCaisseOp} disabled={saving || !fOp.montant}
                  className={`w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 text-white ${
                    opType === 'depense' ? 'bg-[#F51E33]' : 'bg-[#142850]'
                  }`}>
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {opType === 'depense' ? 'Enregistrer la dépense' : "Enregistrer l'approvisionnement"}
                </button>
              </div>
            </div>
          )}

          {/* ── Journal ── */}
          {caisseTab === 'journal' && selectedCaisse && caisses.length > 0 && (
            <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#30363D] flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#FFFFFF]">Journal de caisse — {selectedCaisse.nom}</h3>
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
                      <tr className="border-b border-[#1a2d50]">
                        {['Date', 'Type', 'Motif', 'Bénéficiaire', 'Réf.', 'Montant', 'Statut'].map(h => (
                          <th key={h} className="text-left px-4 py-2 text-[10px] font-bold text-[#484F58] uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a2d50]">
                      {caisseOps.map(op => (
                        <tr key={op.id} className="hover:bg-[#1a2d50]/30 transition-colors">
                          <td className="px-4 py-2.5 text-[#8B949E]">{fmtDate(op.date)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              op.type === 'depense' ? 'bg-[#F51E33]/10 text-[#F51E33]' : 'bg-[#142850]/10 text-[#142850]'
                            }`}>
                              {op.type === 'depense' ? 'Dépense' : 'Approv.'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-[#FFFFFF] max-w-[140px] truncate">{op.motif ?? '—'}</td>
                          <td className="px-4 py-2.5 text-[#8B949E]">{op.beneficiaire ?? '—'}</td>
                          <td className="px-4 py-2.5 text-[#484F58]">{op.reference_piece ?? '—'}</td>
                          <td className={`px-4 py-2.5 font-bold ${op.type === 'depense' ? 'text-[#F51E33]' : 'text-[#142850]'}`}>
                            {op.type === 'depense' ? '−' : '+'}{fmtFCFA(op.montant)}
                          </td>
                          <td className="px-4 py-2.5">
                            {op.cloture_date
                              ? <span className="text-[10px] text-[#484F58]">Clôturé</span>
                              : <span className="text-[10px] text-[#F08900]">En cours</span>}
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
            <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F08900]/20 flex items-center justify-center">
                  <Lock size={18} className="text-[#F08900]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#FFFFFF]">Clôture de caisse</p>
                  <p className="text-[10px] text-[#484F58]">Arrêter les opérations d'une journée</p>
                </div>
              </div>
              <div>
                <label className="text-xs text-[#8B949E] mb-1 block">Date à clôturer</label>
                <input type="date" value={clotureDate} onChange={e => setClotureDate(e.target.value)}
                  className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] outline-none focus:border-[#F08900]/50" />
              </div>
              <div>
                <label className="text-xs text-[#8B949E] mb-1 block">Solde physique constaté (optionnel)</label>
                <input type="number" value={clotureSolde} onChange={e => setClotureSolde(e.target.value)}
                  placeholder={String(selectedCaisse.solde)}
                  className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none focus:border-[#F08900]/50" />
                <p className="text-[10px] text-[#484F58] mt-1">
                  Solde comptable : {fmtFCFA(selectedCaisse.solde)}
                  {clotureSolde && ` · Écart : ${parseFloat(clotureSolde) - selectedCaisse.solde >= 0 ? '+' : ''}${fmtFCFA(parseFloat(clotureSolde) - selectedCaisse.solde)}`}
                </p>
              </div>
              {(() => {
                const toClose = caisseOps.filter(o => o.date === clotureDate && !o.cloture_date)
                return toClose.length > 0 ? (
                  <div className="bg-[#142850] border border-[#F08900]/20 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-[#F08900] mb-2">{toClose.length} opération(s) à clôturer</p>
                    {toClose.map(o => (
                      <div key={o.id} className="flex justify-between text-[10px] py-0.5">
                        <span className="text-[#8B949E]">{o.motif ?? o.type}</span>
                        <span className={o.type === 'depense' ? 'text-[#F51E33]' : 'text-[#142850]'}>
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
                className="w-full py-3 rounded-xl text-sm font-semibold bg-[#F08900] text-[#142850] disabled:opacity-50 flex items-center justify-center gap-2">
                {savingCloture && <Loader2 size={13} className="animate-spin" />}
                Clôturer la caisse
              </button>
            </div>
          )}

          {/* ── Paramétrage ── */}
          {caisseTab === 'parametrage' && (
            <div className="space-y-4">
              {caisses.length > 0 && (
                <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#30363D]">
                    <p className="text-xs font-semibold text-[#FFFFFF]">Caisses existantes</p>
                  </div>
                  {caisses.map(c => (
                    <div key={c.id} className="flex items-center gap-3 px-5 py-3 border-b border-[#1a2d50] last:border-0">
                      <div className="w-8 h-8 rounded-lg bg-[#F08900]/10 flex items-center justify-center">
                        <Archive size={14} className="text-[#F08900]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-[#FFFFFF]">{c.nom}</p>
                        <p className="text-[10px] text-[#484F58]">Compte {c.numero_compte} · {fmtFCFA(c.solde)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl p-5">
                <p className="text-xs font-semibold text-[#FFFFFF] mb-4">Créer une nouvelle caisse</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Nom de la caisse</label>
                    <input value={fCaisse.nom} onChange={e => setFCaisse(f => ({ ...f, nom: e.target.value }))}
                      placeholder="Ex: Caisse principale, Caisse annexe…"
                      className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none focus:border-[#F08900]/50" />
                  </div>
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Compte OHADA</label>
                    <select value={fCaisse.numero_compte} onChange={e => setFCaisse(f => ({ ...f, numero_compte: e.target.value }))}
                      className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] outline-none">
                      <option value="571000">571000 — Caisse principale</option>
                      <option value="571100">571100 — Caisse annexe</option>
                      <option value="572000">572000 — Caisse devises</option>
                    </select>
                  </div>
                  <button onClick={saveCaisse} disabled={savingCaisse || !fCaisse.nom}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold bg-[#F08900] text-[#142850] disabled:opacity-50 flex items-center justify-center gap-2">
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
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: IMPORT RELEVÉS                                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'import' && (
        <div className="space-y-5">
          <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-[#F08900]/10 flex items-center justify-center"><Upload size={16} className="text-[#F08900]" /></div>
              <div>
                <p className="text-sm font-bold text-[#FFFFFF]">Importer un relevé bancaire</p>
                <p className="text-[10px] text-[#484F58]">Fichier CSV — formats BGFI, Ecobank, Rawbank supportés</p>
              </div>
            </div>
            <div>
              <label className="text-xs text-[#8B949E] mb-1 block">Compte bancaire associé</label>
              {comptesBancaires.length === 0 ? (
                <p className="text-xs text-[#F51E33]">Aucun compte bancaire — ajoutez-en un dans l'onglet Banque.</p>
              ) : (
                <select value={csvCompte} onChange={e => setCsvCompte(e.target.value)}
                  className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] outline-none focus:border-[#F08900]/50">
                  <option value="">— Sélectionner un compte —</option>
                  {comptesBancaires.map(c => <option key={c.id} value={c.id}>{c.intitule} · {c.banque}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="text-xs text-[#8B949E] mb-1 block">Fichier CSV</label>
              <div className="flex items-center gap-3">
                <input ref={csvInputRef} type="file" accept=".csv,.txt" onChange={handleCSVFile} className="hidden" />
                <button onClick={() => csvInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#F08900]/40 bg-[#F08900]/10 text-[#F08900] text-xs font-semibold hover:bg-[#F08900]/20 transition-colors">
                  <Upload size={13} /> Choisir un fichier CSV
                </button>
                {csvRows.length > 0 && <span className="text-xs text-[#142850] font-semibold">{csvRows.length} lignes détectées</span>}
              </div>
              <p className="text-[10px] text-[#484F58] mt-1">Colonnes attendues : Date, Libellé, Débit, Crédit (ou Montant). Séparateur ; ou ,</p>
            </div>
          </div>

          {csvRows.length > 0 && (
            <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#30363D] flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#FFFFFF]">Aperçu — {csvRows.length} lignes</h3>
                <button onClick={importReleve} disabled={importingSaving || !csvCompte}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#142850]/15 text-[#142850] border border-[#142850]/30 hover:bg-[#142850]/25 disabled:opacity-50 transition-colors">
                  {importingSaving ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
                  Importer {csvRows.length} lignes
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1a2d50]">
                      {['Date', 'Libellé', 'Type', 'Montant'].map(h => (
                        <th key={h} className="text-left px-4 py-2 text-[10px] font-bold text-[#484F58] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a2d50]">
                    {csvRows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="hover:bg-[#1a2d50]/30">
                        <td className="px-4 py-2 text-[#8B949E]">{fmtDate(r.date)}</td>
                        <td className="px-4 py-2 text-[#FFFFFF] max-w-[200px] truncate">{r.libelle}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${r.type === 'credit' ? 'bg-[#142850]/10 text-[#142850]' : 'bg-[#F51E33]/10 text-[#F51E33]'}`}>
                            {r.type === 'credit' ? 'Crédit' : 'Débit'}
                          </span>
                        </td>
                        <td className={`px-4 py-2 font-bold ${r.type === 'credit' ? 'text-[#142850]' : 'text-[#F51E33]'}`}>
                          {r.type === 'credit' ? '+' : '−'}{fmtFCFA(r.montant)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvRows.length > 50 && <p className="px-4 py-2 text-[10px] text-[#484F58]">… et {csvRows.length - 50} lignes supplémentaires</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: RAPPROCHEMENT                                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'rapprochement' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <select value={rapprochCompte} onChange={e => setRapprochCompte(e.target.value)}
              className="bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] outline-none focus:border-[#F08900]/50">
              <option value="">— Sélectionner un compte —</option>
              {comptesBancaires.map(c => <option key={c.id} value={c.id}>{c.intitule} · {c.banque}</option>)}
            </select>
            {rapprochCompte && releveLignes.filter(l => l.statut === 'non_rapproche').length > 0 && (
              <button onClick={autoRapprocher} disabled={rapprochSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F08900]/15 text-[#F08900] border border-[#F08900]/30 hover:bg-[#F08900]/25 disabled:opacity-50 transition-colors">
                {rapprochSaving ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
                Auto-rapprocher
              </button>
            )}
            <div className="ml-auto text-xs text-[#484F58]">
              {releveLignes.filter(l => l.statut === 'non_rapproche').length} en attente ·{' '}
              <span className="text-[#142850]">{releveLignes.filter(l => l.statut === 'rapproche').length} rapprochés</span>
            </div>
          </div>

          {!rapprochCompte ? (
            <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl p-12 text-center">
              <GitMerge size={28} className="mx-auto mb-3 text-[#30363D]" />
              <p className="text-[#484F58] text-sm">Sélectionnez un compte pour commencer</p>
              <p className="text-[#30363D] text-xs mt-1">Importez d'abord un relevé dans l'onglet "Import relevés"</p>
            </div>
          ) : releveLignes.filter(l => l.statut === 'non_rapproche').length === 0 ? (
            <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl p-12 text-center">
              <CheckCheck size={28} className="mx-auto mb-3 text-[#142850]" />
              <p className="text-[#142850] text-sm font-semibold">Tout est rapproché !</p>
              <p className="text-[#484F58] text-xs mt-1">Aucune ligne en attente pour ce compte.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Lignes de relevé */}
              <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#30363D]">
                  <p className="text-xs font-semibold text-[#FFFFFF]">Relevé bancaire</p>
                  <p className="text-[10px] text-[#484F58]">Cliquer pour sélectionner une ligne</p>
                </div>
                <div className="divide-y divide-[#1a2d50] max-h-96 overflow-y-auto">
                  {releveLignes.filter(l => l.statut === 'non_rapproche').map(ligne => (
                    <div key={ligne.id} onClick={() => setRapprochLigne(l => l?.id === ligne.id ? null : ligne)}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${rapprochLigne?.id === ligne.id ? 'bg-[#F08900]/10 border-l-2 border-[#F08900]' : 'hover:bg-[#1a2d50]/50'}`}>
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${ligne.type === 'credit' ? 'bg-[#142850]/10' : 'bg-[#F51E33]/10'}`}>
                        {ligne.type === 'credit' ? <ArrowUpCircle size={12} className="text-[#142850]" /> : <ArrowDownCircle size={12} className="text-[#F51E33]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#FFFFFF] truncate">{ligne.libelle}</p>
                        <p className="text-[10px] text-[#484F58]">{fmtDate(ligne.date)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xs font-bold ${ligne.type === 'credit' ? 'text-[#142850]' : 'text-[#F51E33]'}`}>
                          {ligne.type === 'credit' ? '+' : '−'}{fmtFCFA(ligne.montant)}
                        </p>
                        <button onClick={e => { e.stopPropagation(); ignorerLigne(ligne.id) }}
                          className="text-[10px] text-[#484F58] hover:text-[#F51E33] transition-colors">Ignorer</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transactions correspondantes */}
              <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#30363D]">
                  <p className="text-xs font-semibold text-[#FFFFFF]">Transactions Oraforme</p>
                  <p className="text-[10px] text-[#484F58]">
                    {rapprochLigne ? `Sélectionné: ${fmtFCFA(rapprochLigne.montant)} · ${fmtDate(rapprochLigne.date)}` : 'Sélectionnez une ligne du relevé'}
                  </p>
                </div>
                {!rapprochLigne ? (
                  <div className="p-10 text-center">
                    <Link2 size={24} className="mx-auto mb-2 text-[#30363D]" />
                    <p className="text-[#484F58] text-xs">Cliquez sur une ligne du relevé à gauche</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#1a2d50] max-h-96 overflow-y-auto">
                    {(() => {
                      const txType = rapprochLigne.type === 'credit' ? 'entree' : 'sortie'
                      const ligneDate = new Date(rapprochLigne.date).getTime()
                      const suggestions = transactions.filter(tx =>
                        tx.type === txType &&
                        Math.abs(tx.montant - rapprochLigne.montant) / rapprochLigne.montant < 0.05 &&
                        Math.abs(new Date(tx.date).getTime() - ligneDate) <= 7 * 86400000
                      )
                      const others = transactions.filter(tx => tx.type === txType && !suggestions.find(s => s.id === tx.id)).slice(0, 10)
                      const list = [...suggestions, ...others]
                      if (list.length === 0) return (
                        <div className="p-8 text-center">
                          <p className="text-[#484F58] text-xs">Aucune transaction correspondante</p>
                        </div>
                      )
                      return list.map(tx => {
                        const isSuggestion = suggestions.find(s => s.id === tx.id)
                        const isSelected = rapprochTx?.id === tx.id
                        return (
                          <div key={tx.id} onClick={() => setRapprochTx(t => t?.id === tx.id ? null : tx)}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isSelected ? 'bg-[#142850]/10 border-l-2 border-[#142850]' : 'hover:bg-[#1a2d50]/50'}`}>
                            {isSuggestion && <span className="w-1.5 h-1.5 rounded-full bg-[#F08900] shrink-0" title="Suggestion" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-[#FFFFFF] truncate">{tx.description}</p>
                              <p className="text-[10px] text-[#484F58]">{tx.categorie} · {fmtDate(tx.date)}</p>
                            </div>
                            <p className={`text-xs font-bold shrink-0 ${tx.type === 'entree' ? 'text-[#142850]' : 'text-[#F51E33]'}`}>{fmtFCFA(tx.montant)}</p>
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}
                {rapprochLigne && rapprochTx && (
                  <div className="px-4 py-3 border-t border-[#30363D]">
                    <button onClick={() => rapprocher(rapprochLigne, rapprochTx)} disabled={rapprochSaving}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold bg-[#142850] text-white disabled:opacity-50 flex items-center justify-center gap-2">
                      {rapprochSaving ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                      Rapprocher ces deux éléments
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lignes rapprochées */}
          {releveLignes.filter(l => l.statut === 'rapproche').length > 0 && (
            <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#30363D]">
                <p className="text-xs font-semibold text-[#142850]">Lignes rapprochées — {releveLignes.filter(l => l.statut === 'rapproche').length}</p>
              </div>
              <div className="divide-y divide-[#1a2d50]">
                {releveLignes.filter(l => l.statut === 'rapproche').slice(0, 20).map(ligne => (
                  <div key={ligne.id} className="flex items-center gap-3 px-4 py-2.5">
                    <CheckCheck size={14} className="text-[#142850] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#8B949E] truncate">{ligne.libelle}</p>
                      <p className="text-[10px] text-[#484F58]">{fmtDate(ligne.date)}</p>
                    </div>
                    <p className={`text-xs font-bold ${ligne.type === 'credit' ? 'text-[#142850]' : 'text-[#F51E33]'}`}>{ligne.type === 'credit' ? '+' : '−'}{fmtFCFA(ligne.montant)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: PRÉVISIONS                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'previsions' && (() => {
        const last90Start = new Date(); last90Start.setDate(last90Start.getDate() - 90)
        const last90Str = last90Start.toISOString().split('T')[0]
        const last90 = transactions.filter(t => t.date >= last90Str)
        const dailyE = last90.filter(t => t.type === 'entree').reduce((s, t) => s + t.montant, 0) / 90
        const dailyS = last90.filter(t => t.type === 'sortie').reduce((s, t) => s + t.montant, 0) / 90
        let cumul = tresorerieGlobale
        const forecast = Array.from({ length: previsionDays }, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() + i + 1)
          cumul += dailyE - dailyS
          return {
            day: (i === 0 || i === Math.floor(previsionDays / 4) || i === Math.floor(previsionDays / 2) || i === Math.floor(3 * previsionDays / 4) || i === previsionDays - 1)
              ? `J+${i + 1}` : '',
            entrees: Math.round(dailyE),
            sorties: Math.round(dailyS),
            solde: Math.round(cumul),
          }
        })
        const endSolde = forecast[forecast.length - 1]?.solde ?? tresorerieGlobale
        const trend = endSolde - tresorerieGlobale

        return (
          <div className="space-y-5">
            {/* Sélecteur de période */}
            <div className="flex items-center gap-3">
              <p className="text-xs text-[#8B949E]">Horizon de prévision :</p>
              <div className="flex gap-1 p-1 bg-[#142850] border border-[#30363D] rounded-xl">
                {[30, 60, 90].map(d => (
                  <button key={d} onClick={() => setPrevisionDays(d)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${previsionDays === d ? 'bg-[#F08900] text-white' : 'text-[#8B949E] hover:text-[#FFFFFF]'}`}>
                    {d} jours
                  </button>
                ))}
              </div>
            </div>

            {/* KPI Prévisions */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl p-4">
                <p className="text-[10px] text-[#484F58] uppercase tracking-wider mb-1">Solde actuel</p>
                <p className="text-lg font-bold text-[#FFFFFF]">{fmtFCFA(tresorerieGlobale)}</p>
              </div>
              <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl p-4">
                <p className="text-[10px] text-[#484F58] uppercase tracking-wider mb-1">Solde prévu J+{previsionDays}</p>
                <p className={`text-lg font-bold ${endSolde >= 0 ? 'text-[#142850]' : 'text-[#F51E33]'}`}>{fmtFCFA(endSolde)}</p>
              </div>
              <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl p-4">
                <p className="text-[10px] text-[#484F58] uppercase tracking-wider mb-1">Entrées/jour (moy.)</p>
                <p className="text-lg font-bold text-[#142850]">{fmtFCFA(Math.round(dailyE))}</p>
              </div>
              <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl p-4">
                <p className="text-[10px] text-[#484F58] uppercase tracking-wider mb-1">Sorties/jour (moy.)</p>
                <p className="text-lg font-bold text-[#F51E33]">{fmtFCFA(Math.round(dailyS))}</p>
              </div>
            </div>

            {/* Alerte si tendance négative */}
            {trend < 0 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#F51E33]/10 border border-[#F51E33]/20">
                <AlertTriangle size={16} className="text-[#F51E33] shrink-0" />
                <p className="text-xs text-[#F51E33]">
                  Tendance négative — votre trésorerie devrait baisser de <strong>{fmtFCFA(Math.abs(trend))}</strong> sur {previsionDays} jours au rythme actuel.
                </p>
              </div>
            )}
            {trend > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#142850]/10 border border-[#142850]/20">
                <TrendingUp size={16} className="text-[#142850] shrink-0" />
                <p className="text-xs text-[#142850]">
                  Tendance positive — votre trésorerie devrait augmenter de <strong>{fmtFCFA(trend)}</strong> sur {previsionDays} jours.
                </p>
              </div>
            )}

            {/* Graphique prévisionnel */}
            <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl p-5">
              <h2 className="text-xs font-semibold text-[#FFFFFF] mb-1">Solde prévisionnel — {previsionDays} jours</h2>
              <p className="text-[10px] text-[#484F58] mb-4">Basé sur la moyenne des 90 derniers jours d'activité</p>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={forecast} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2d50" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#8B949E', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8B949E', fontSize: 9 }} axisLine={false} tickLine={false} width={40}
                    tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                  <Tooltip contentStyle={{ background: '#0f1e3d', border: '1px solid #30363D', borderRadius: 8, fontSize: 11 }}
                    formatter={(v: any, n: any) => [fmtFCFA(Number(v ?? 0)), n]} />
                  <Bar dataKey="entrees" name="Entrées" fill="#14285040" radius={[2,2,0,0]} maxBarSize={8} />
                  <Bar dataKey="sorties" name="Sorties" fill="#F51E3340" radius={[2,2,0,0]} maxBarSize={8} />
                  <Line type="monotone" dataKey="solde" name="Solde prévu" stroke="#F08900" strokeWidth={2}
                    strokeDasharray="6 3" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {last90.length === 0 && (
              <div className="bg-[#0f1e3d] border border-[#F08900]/20 rounded-xl p-4">
                <p className="text-xs text-[#F08900]">Aucune transaction des 90 derniers jours — les prévisions sont basées sur des données insuffisantes.</p>
              </div>
            )}
          </div>
        )
      })()}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL ENCAISSER                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {modal === 'encaisser' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70" onClick={() => setModal(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-[#0f1e3d] border border-[#142850]/30 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[#142850]/20 flex items-center justify-center">
                  <ArrowUpCircle size={20} className="text-[#142850]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#FFFFFF]">Encaisser</h3>
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
                          style={{ borderColor: sel ? m.color : '#30363D', background: sel ? `${m.color}18` : '#142850', color: sel ? m.color : '#484F58' }}>
                          <Icon size={16} />{m.label.split(' ')[0]}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Catégorie</label>
                  <select value={fEnc.categorie} onChange={e => setFEnc(f => ({ ...f, categorie: e.target.value }))}
                    className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] outline-none focus:border-[#142850]/50">
                    {CATS_ENTREE.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Description</label>
                  <input value={fEnc.description} onChange={e => setFEnc(f => ({ ...f, description: e.target.value }))}
                    placeholder="Ex: Paiement client KALALA…"
                    className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none focus:border-[#142850]/50" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Montant (FCFA)</label>
                    <input type="number" value={fEnc.montant} onChange={e => setFEnc(f => ({ ...f, montant: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none focus:border-[#142850]/50" />
                  </div>
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Date</label>
                    <input type="date" value={fEnc.date} onChange={e => setFEnc(f => ({ ...f, date: e.target.value }))}
                      className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] outline-none focus:border-[#142850]/50" />
                  </div>
                </div>
                {fEnc.montant && parseInt(fEnc.montant) > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#142850]/10 border border-[#142850]/20">
                    <ArrowUpCircle size={14} className="text-[#142850]" />
                    <span className="text-[#142850] text-sm font-bold">+ {fmtFCFA(parseInt(fEnc.montant))}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setModal(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-[#1a2d50] border border-[#30363D] text-[#8B949E]">Annuler</button>
                <button onClick={saveEncaisser} disabled={saving || !fEnc.description || !fEnc.montant}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 bg-[#142850] text-white">
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
              className="relative bg-[#0f1e3d] border border-[#F51E33]/30 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[#F51E33]/20 flex items-center justify-center">
                  <ArrowDownCircle size={20} className="text-[#F51E33]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#FFFFFF]">Décaisser</h3>
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
                          style={{ borderColor: sel ? m.color : '#30363D', background: sel ? `${m.color}18` : '#142850', color: sel ? m.color : '#484F58' }}>
                          <Icon size={16} />{m.label.split(' ')[0]}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Catégorie</label>
                  <select value={fDec.categorie} onChange={e => setFDec(f => ({ ...f, categorie: e.target.value }))}
                    className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] outline-none focus:border-[#F51E33]/50">
                    {CATS_SORTIE.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Description</label>
                  <input value={fDec.description} onChange={e => setFDec(f => ({ ...f, description: e.target.value }))}
                    placeholder="Ex: Loyer bureau janvier…"
                    className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none focus:border-[#F51E33]/50" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Montant (FCFA)</label>
                    <input type="number" value={fDec.montant} onChange={e => setFDec(f => ({ ...f, montant: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none focus:border-[#F51E33]/50" />
                  </div>
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Date</label>
                    <input type="date" value={fDec.date} onChange={e => setFDec(f => ({ ...f, date: e.target.value }))}
                      className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] outline-none focus:border-[#F51E33]/50" />
                  </div>
                </div>
                {fDec.montant && parseInt(fDec.montant) > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F51E33]/10 border border-[#F51E33]/20">
                    <ArrowDownCircle size={14} className="text-[#F51E33]" />
                    <span className="text-[#F51E33] text-sm font-bold">− {fmtFCFA(parseInt(fDec.montant))}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setModal(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-[#1a2d50] border border-[#30363D] text-[#8B949E]">Annuler</button>
                <button onClick={saveDecaisser} disabled={saving || !fDec.description || !fDec.montant}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 bg-[#F51E33] text-white">
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
              className="relative bg-[#0f1e3d] border border-[#F08900]/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[#F08900]/20 flex items-center justify-center">
                  <Landmark size={20} className="text-[#F08900]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#FFFFFF]">Ajouter un compte</h3>
                  <p className="text-[11px] text-[#484F58]">Compte bancaire de l'entreprise</p>
                </div>
                <button onClick={() => setModal(null)} className="ml-auto text-[#484F58] hover:text-[#8B949E]"><X size={16} /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Banque</label>
                  <select value={fBanque.banque} onChange={e => setFBanque(f => ({ ...f, banque: e.target.value }))}
                    className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] outline-none focus:border-[#F08900]/50">
                    {BANQUES_CONGO.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Intitulé du compte</label>
                  <input value={fBanque.intitule} onChange={e => setFBanque(f => ({ ...f, intitule: e.target.value }))}
                    placeholder="Ex: Compte courant entreprise"
                    className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none focus:border-[#F08900]/50" />
                </div>
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Numéro de compte</label>
                  <input value={fBanque.numero_compte} onChange={e => setFBanque(f => ({ ...f, numero_compte: e.target.value }))}
                    placeholder="Ex: 001-12345678-01"
                    className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none focus:border-[#F08900]/50" />
                </div>
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Solde initial (FCFA)</label>
                  <input type="number" value={fBanque.solde} onChange={e => setFBanque(f => ({ ...f, solde: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none focus:border-[#F08900]/50" />
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setModal(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-[#1a2d50] border border-[#30363D] text-[#8B949E]">Annuler</button>
                <button onClick={saveBanque} disabled={saving || !fBanque.intitule}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 bg-[#F08900] text-white">
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
