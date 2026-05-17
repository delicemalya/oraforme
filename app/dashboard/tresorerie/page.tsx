'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Plus, Minus, TrendingUp, TrendingDown, Wallet, X, Loader2,
  Settings2, Smartphone, CreditCard, Banknote, Building2,
  UserCheck, Search, CheckCircle, AlertCircle, FileText,
  ArrowUpCircle, ArrowDownCircle, Users, RefreshCw,
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

type Prestataire = {
  id: string
  nom: string
  prenom: string
  type: string   // 'enseignant' | 'formateur' | 'ouvrier' | 'autre'
  taux_horaire?: number | null
  telephone?: string | null
  email?: string | null
}

type ModalType = 'encaisser' | 'decaisser' | 'prestataire' | null

// ─── Constantes ──────────────────────────────────────────────────────────────

const CATS_ENTREE = [
  'Vente / Chiffre d\'affaires',
  'Frais de scolarité',
  'Facture payée',
  'Prestation de services',
  'Avance client',
  'Virement reçu',
  'Remboursement',
  'Subvention / Don',
  'Autre recette',
]

const CATS_SORTIE = [
  'Achats / Fournisseur',
  'Loyer',
  'Carburant / Transport',
  'Charges diverses',
  'Impôts / Taxes',
  'CNSS',
  'Frais bancaires',
  'Remboursement client',
  'Autre dépense',
]

const MODES = [
  { value: 'especes',      label: 'Espèces',      icon: Banknote,   color: '#2EA043' },
  { value: 'virement',     label: 'Virement',     icon: Building2,  color: '#388BFD' },
  { value: 'cheque',       label: 'Chèque',       icon: FileText,   color: '#8B5CF6' },
  { value: 'airtel_money', label: 'Airtel Money', icon: Smartphone, color: '#F97316' },
  { value: 'mtn_momo',     label: 'MTN MoMo',     icon: Smartphone, color: '#F0A30A' },
]

const PERIODES = [
  { label: 'Aujourd\'hui', days: 0 },
  { label: 'Semaine',      days: 7 },
  { label: 'Mois',         days: 30 },
  { label: 'Tout',         days: 365 },
]

const MM_MODES = ['airtel_money', 'mtn_momo', 'Mobile Money']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function modeLabel(m: string) {
  return MODES.find(x => x.value === m)?.label ?? m
}

async function sendNotif(
  tenantId: string,
  role: string,
  title: string,
  body: string,
  link = '/dashboard/tresorerie',
) {
  await supabase.from('notifications').insert({
    tenant_id: tenantId, role, title, body, link, lu: false,
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TresoreriePage() {
  const { tenantId, loading: tLoading } = useTenant()

  const [transactions,  setTransactions]  = useState<Transaction[]>([])
  const [prestataires,  setPrestataires]  = useState<Prestataire[]>([])
  const [loading,       setLoading]       = useState(true)
  const [periode,       setPeriode]       = useState(30)
  const [modal,         setModal]         = useState<ModalType>(null)
  const [saving,        setSaving]        = useState(false)
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null)
  const [filterType,    setFilterType]    = useState<'tout' | 'entree' | 'sortie' | 'prestataire'>('tout')
  const [secteur,       setSecteur]       = useState<string | null>(null)
  const [nomEntreprise, setNomEntreprise] = useState('Mon entreprise')
  const [openingBal,    setOpeningBal]    = useState(0)
  const [showOB,        setShowOB]        = useState(false)
  const [savingOB,      setSavingOB]      = useState(false)

  // Encaisser form
  const [fEnc, setFEnc] = useState({
    categorie: 'Vente / Chiffre d\'affaires',
    description: '',
    montant: '',
    date: today(),
    mode: 'especes',
  })

  // Décaisser form
  const [fDec, setFDec] = useState({
    categorie: 'Achats / Fournisseur',
    description: '',
    montant: '',
    date: today(),
    mode: 'especes',
  })

  // Prestataire form
  const [selPresta,      setSelPresta]      = useState<Prestataire | null>(null)
  const [searchPresta,   setSearchPresta]   = useState('')
  const [fPresta, setFPresta] = useState({
    nom: '', type: 'formateur', montant: '', date: today(), mode: 'especes', motif: '',
  })

  function today() { return new Date().toISOString().split('T')[0] }

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    // Fetch tenant info
    const { data: tenant } = await supabase
      .from('tenants')
      .select('nom_entreprise, secteur_activite')
      .eq('id', tenantId)
      .maybeSingle()
    if (tenant) {
      setSecteur(tenant.secteur_activite ?? null)
      setNomEntreprise(tenant.nom_entreprise ?? 'Mon entreprise')
    }

    // Fetch transactions (1 an)
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 1)
    const { data: txs } = await supabase
      .from('transactions')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('date', cutoff.toISOString().split('T')[0])
      .order('date', { ascending: false })
    setTransactions((txs ?? []) as Transaction[])

    // Fetch opening balance
    const { data: ob } = await supabase
      .from('opening_balances')
      .select('solde_ouverture')
      .eq('tenant_id', tenantId)
      .eq('annee', new Date().getFullYear())
      .maybeSingle()
    setOpeningBal(ob?.solde_ouverture ?? 0)

    // Fetch prestataires — uniquement enseignants avec type_enseignant = 'prestataire'
    const { data: ens } = await supabase
      .from('enseignants')
      .select('id, nom, prenom, matiere, taux_horaire, telephone, email')
      .eq('tenant_id', tenantId)
      .eq('statut', 'actif')
      .eq('type_enseignant', 'prestataire')
    const mapped: Prestataire[] = (ens ?? []).map((e: any) => ({
      id: e.id, nom: e.nom, prenom: e.prenom,
      type: 'prestataire', taux_horaire: e.taux_horaire,
      telephone: e.telephone, email: e.email,
    }))
    setPrestataires(mapped)

    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    if (!tLoading && tenantId) load()
  }, [tLoading, tenantId, load])

  // ── Computed ───────────────────────────────────────────────────────────────

  const cutoffStr = (() => {
    if (periode === 365) return ''
    if (periode === 0) return today()
    const d = new Date()
    d.setDate(d.getDate() - periode)
    return d.toISOString().split('T')[0]
  })()

  const filtered = transactions.filter(t => {
    const inPeriode = periode === 365 ? true : t.date >= cutoffStr
    const inType =
      filterType === 'tout'         ? true :
      filterType === 'prestataire'  ? t.source === 'prestataire' :
      t.type === filterType
    return inPeriode && inType
  })

  const totalEntrees  = transactions.filter(t => periode === 365 ? true : t.date >= cutoffStr).filter(t => t.type === 'entree').reduce((s, t) => s + t.montant, 0)
  const totalSorties  = transactions.filter(t => periode === 365 ? true : t.date >= cutoffStr).filter(t => t.type === 'sortie').reduce((s, t) => s + t.montant, 0)
  const solde         = openingBal + totalEntrees - totalSorties

  const mmIn  = filtered.filter(t => t.type === 'entree' && MM_MODES.includes(t.mode_paiement)).reduce((s, t) => s + t.montant, 0)
  const mmOut = filtered.filter(t => t.type === 'sortie' && MM_MODES.includes(t.mode_paiement)).reduce((s, t) => s + t.montant, 0)
  const mmCount = filtered.filter(t => MM_MODES.includes(t.mode_paiement)).length

  const chartData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    const ds = d.toISOString().split('T')[0]
    const e = transactions.filter(t => t.type === 'entree' && t.date === ds).reduce((s, t) => s + t.montant, 0)
    const s = transactions.filter(t => t.type === 'sortie' && t.date === ds).reduce((s, t) => s + t.montant, 0)
    return { day: i % 5 === 0 ? `${d.getDate()}/${d.getMonth() + 1}` : '', entrées: e, sorties: s }
  })
  let cumul = openingBal
  const chartWithCumul = chartData.map(d => { cumul += d.entrées - d.sorties; return { ...d, solde: cumul } })

  const prestasFiltered = prestataires.filter(p => {
    if (!searchPresta) return true
    const q = searchPresta.toLowerCase()
    return (p.nom + ' ' + p.prenom).toLowerCase().includes(q)
  })

  // ── Save Encaisser ─────────────────────────────────────────────────────────

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

      // Sync comptabilité (journal_comptable + journal_entries)
      await writeComptaEntry({
        tenantId, date: fEnc.date, libelle: fEnc.description,
        type: 'recette', montant, categorie: fEnc.categorie,
        debitAccount: debit, creditAccount: credit,
        source: 'tresorerie', sourceId: tx?.id, createdBy: user?.id,
      })

      await sendNotif(tenantId, 'DIRECTION_GENERALE',
        `Encaissement — ${fmtFCFA(montant)}`,
        `${fEnc.categorie} · ${fEnc.description} · ${modeLabel(fEnc.mode)}`,
      )

      showToast(`Encaissement de ${fmtFCFA(montant)} enregistré`)
      setModal(null)
      setFEnc({ categorie: 'Vente / Chiffre d\'affaires', description: '', montant: '', date: today(), mode: 'especes' })
      load()
    } catch (e: any) { showToast(e?.message ?? 'Erreur', false) }
    setSaving(false)
  }

  // ── Save Décaisser ─────────────────────────────────────────────────────────

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

      // Sync comptabilité
      await writeComptaEntry({
        tenantId, date: fDec.date, libelle: fDec.description,
        type: 'depense', montant, categorie: fDec.categorie,
        debitAccount: debit, creditAccount: credit,
        source: 'tresorerie', sourceId: tx?.id, createdBy: user?.id,
      })

      await Promise.all([
        sendNotif(tenantId, 'DIRECTION_GENERALE',
          `Décaissement — ${fmtFCFA(montant)}`,
          `${fDec.categorie} · ${fDec.description} · ${modeLabel(fDec.mode)}`,
        ),
        sendNotif(tenantId, 'RAF',
          `Sortie trésorerie — ${fmtFCFA(montant)}`,
          `${fDec.categorie} · ${fDec.description}`,
        ),
        sendNotif(tenantId, 'COMPTABILITE',
          `Écriture comptable — ${fmtFCFA(montant)}`,
          `D:${debit} / C:${credit} — ${fDec.description}`,
          '/dashboard/comptabilite',
        ),
      ])

      showToast(`Décaissement de ${fmtFCFA(montant)} enregistré`)
      setModal(null)
      setFDec({ categorie: 'Achats / Fournisseur', description: '', montant: '', date: today(), mode: 'especes' })
      load()
    } catch (e: any) { showToast(e?.message ?? 'Erreur', false) }
    setSaving(false)
  }

  // ── Save Prestataire ───────────────────────────────────────────────────────

  async function savePrestataire() {
    const nom     = selPresta ? `${selPresta.prenom} ${selPresta.nom}` : fPresta.nom
    const montant = parseInt(fPresta.montant)
    if (!tenantId || !nom || !montant || !fPresta.motif) return
    setSaving(true)
    try {
      const creditAccount = modeToAccount(fPresta.mode)
      const { data: { user } } = await supabase.auth.getUser()
      const libelle = `${nom} — ${fPresta.motif}`

      const { data: tx } = await supabase.from('transactions').insert({
        tenant_id: tenantId, type: 'sortie',
        categorie: 'Paiement prestataire', description: libelle,
        montant, date: fPresta.date, mode_paiement: fPresta.mode,
        source: 'prestataire', reference: selPresta?.id ?? null,
        debit_account: '621000', credit_account: creditAccount,
        created_by: user?.id,
      }).select('id').single()

      // Sync comptabilité — 2 écritures OHADA
      await Promise.all([
        // Charge prestataire (621 — Honoraires)
        writeComptaEntry({
          tenantId, date: fPresta.date, libelle,
          type: 'depense', montant, categorie: 'Paiement prestataire',
          debitAccount: '621000',    // Honoraires et commissions
          creditAccount: creditAccount,
          source: 'prestataire', sourceId: tx?.id, createdBy: user?.id,
        }),

        // 4 notifications
        sendNotif(tenantId, 'DIRECTION_GENERALE',
          `Paiement prestataire — ${fmtFCFA(montant)}`,
          `${nom} · ${fPresta.motif} · ${modeLabel(fPresta.mode)}`,
        ),
        sendNotif(tenantId, 'COMPTABILITE',
          `Écriture prestataire — ${fmtFCFA(montant)}`,
          `D:621000 / C:${creditAccount} · ${nom} · ${fPresta.motif}`,
          '/dashboard/comptabilite',
        ),
        sendNotif(tenantId, 'RH_PAIE',
          `Prestataire payé — ${nom}`,
          `Montant: ${fmtFCFA(montant)} · ${fPresta.motif}`,
        ),
        sendNotif(tenantId, 'RAF',
          `Décaissement prestataire — ${fmtFCFA(montant)}`,
          `${nom} · ${modeLabel(fPresta.mode)}`,
        ),
      ])

      showToast(`${nom} payé — ${fmtFCFA(montant)}`)
      setModal(null)
      setSelPresta(null)
      setSearchPresta('')
      setFPresta({ nom: '', type: 'formateur', montant: '', date: today(), mode: 'especes', motif: '' })
      load()
    } catch (e: any) { showToast(e?.message ?? 'Erreur', false) }
    setSaving(false)
  }

  // ── Save Opening Balance ───────────────────────────────────────────────────

  async function saveOpeningBalance() {
    if (!tenantId) return
    setSavingOB(true)
    await supabase.from('opening_balances').upsert({
      tenant_id: tenantId, annee: new Date().getFullYear(), solde_ouverture: openingBal,
    }, { onConflict: 'tenant_id,annee' })
    setSavingOB(false)
    setShowOB(false)
    load()
  }

  // ── UI ─────────────────────────────────────────────────────────────────────

  if (tLoading || loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-[#484F58]" size={24} />
      </div>
    )
  }

  return (
    <div className="space-y-5">

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

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Solde */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}
          className="relative rounded-2xl p-5 overflow-hidden"
          style={{ background: solde >= 0 ? 'linear-gradient(135deg,#1a4731 0%,#166534 50%,#15803d 100%)' : 'linear-gradient(135deg,#450a0a 0%,#7f1d1d 50%,#991b1b 100%)' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 80% 10%,rgba(255,255,255,0.1) 0%,transparent 60%)' }} />
          <div className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <Wallet size={16} className="text-white" />
          </div>
          <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-2">Solde actuel</p>
          <p className="text-white text-3xl font-bold leading-none mb-1">{fmtFCFA(solde)}</p>
          {openingBal !== 0 && <p className="text-white/40 text-[10px]">Report N-1 : {fmtFCFA(openingBal)}</p>}
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 mt-1">
            {solde >= 0 ? <TrendingUp size={10} className="text-white" /> : <TrendingDown size={10} className="text-white" />}
            <span className="text-white text-[10px] font-bold">{solde >= 0 ? 'Positif' : 'Déficit'}</span>
          </div>
        </motion.div>

        {/* Entrées */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
          className="relative rounded-2xl p-5 overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#14532d 0%,#166534 50%,#16a34a 100%)' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 80% 10%,rgba(255,255,255,0.1) 0%,transparent 60%)' }} />
          <div className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <ArrowUpCircle size={16} className="text-white" />
          </div>
          <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-2">Entrées</p>
          <p className="text-white text-2xl font-bold leading-none mb-1">{fmtFCFA(totalEntrees)}</p>
          <p className="text-white/50 text-[10px]">{transactions.filter(t => (periode === 365 ? true : t.date >= cutoffStr) && t.type === 'entree').length} opérations</p>
        </motion.div>

        {/* Sorties */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          className="relative rounded-2xl p-5 overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#450a0a 0%,#7f1d1d 50%,#b91c1c 100%)' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 80% 10%,rgba(255,255,255,0.1) 0%,transparent 60%)' }} />
          <div className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <ArrowDownCircle size={16} className="text-white" />
          </div>
          <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-2">Sorties</p>
          <p className="text-white text-2xl font-bold leading-none mb-1">{fmtFCFA(totalSorties)}</p>
          <p className="text-white/50 text-[10px]">{transactions.filter(t => (periode === 365 ? true : t.date >= cutoffStr) && t.type === 'sortie').length} opérations</p>
        </motion.div>
      </div>

      {/* ── Mobile Money Summary ───────────────────────────────────────────── */}
      {mmCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#161B22] border border-[#F97316]/20 rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-[#F97316]/10 flex items-center justify-center shrink-0">
            <Smartphone size={15} className="text-[#F97316]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#E6EDF3]">Mobile Money</p>
            <p className="text-[10px] text-[#484F58]">{mmCount} transaction{mmCount > 1 ? 's' : ''} via Airtel Money / MTN MoMo</p>
          </div>
          <div className="flex gap-4 text-xs">
            {mmIn  > 0 && <span className="text-[#2EA043] font-semibold">+{fmtFCFA(mmIn)}</span>}
            {mmOut > 0 && <span className="text-[#F85149] font-semibold">-{fmtFCFA(mmOut)}</span>}
          </div>
        </div>
      )}

      {/* ── Actions principales ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Encaisser */}
        <button onClick={() => setModal('encaisser')}
          className="group relative flex flex-col items-center gap-2 py-5 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg,#0d2818,#14532d)', borderColor: '#2EA043' }}>
          <div className="w-12 h-12 rounded-xl bg-[#2EA043]/20 flex items-center justify-center">
            <Plus size={22} className="text-[#2EA043]" />
          </div>
          <span className="text-[#2EA043] font-bold text-sm">Encaisser</span>
          <span className="text-[#2EA043]/50 text-[10px]">Entrée d'argent</span>
        </button>

        {/* Décaisser */}
        <button onClick={() => setModal('decaisser')}
          className="group relative flex flex-col items-center gap-2 py-5 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg,#2d0a0a,#7f1d1d)', borderColor: '#F85149' }}>
          <div className="w-12 h-12 rounded-xl bg-[#F85149]/20 flex items-center justify-center">
            <Minus size={22} className="text-[#F85149]" />
          </div>
          <span className="text-[#F85149] font-bold text-sm">Décaisser</span>
          <span className="text-[#F85149]/50 text-[10px]">Sortie d'argent</span>
        </button>

        {/* Payer prestataire */}
        <button onClick={() => setModal('prestataire')}
          className="group relative flex flex-col items-center gap-2 py-5 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg,#1c1007,#78350f)', borderColor: '#F97316' }}>
          <div className="w-12 h-12 rounded-xl bg-[#F97316]/20 flex items-center justify-center">
            <UserCheck size={22} className="text-[#F97316]" />
          </div>
          <span className="text-[#F97316] font-bold text-sm">Prestataire</span>
          <span className="text-[#F97316]/50 text-[10px]">Formateur / Ouvrier</span>
        </button>

        {/* Solde N-1 */}
        <button onClick={() => setShowOB(v => !v)}
          className="group relative flex flex-col items-center gap-2 py-5 rounded-2xl border border-[#30363D] bg-[#161B22] transition-all hover:border-[#8B949E] hover:scale-[1.02] active:scale-[0.98]">
          <div className="w-12 h-12 rounded-xl bg-[#21262D] flex items-center justify-center">
            <Settings2 size={22} className="text-[#8B949E]" />
          </div>
          <span className="text-[#8B949E] font-bold text-sm">Solde N-1</span>
          <span className="text-[#484F58] text-[10px]">
            {openingBal ? fmtFCFA(openingBal) : 'Non défini'}
          </span>
        </button>
      </div>

      {/* Opening balance panel */}
      <AnimatePresence>
        {showOB && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-[#161B22] border border-[#F0A30A]/30 rounded-xl p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#E6EDF3]">Solde d'ouverture — {new Date().getFullYear()}</h3>
              <button onClick={() => setShowOB(false)} className="text-[#484F58] hover:text-[#8B949E]"><X size={16} /></button>
            </div>
            <p className="text-xs text-[#8B949E] mb-4">Report de trésorerie de l'exercice précédent (N-1). Ce montant s'ajoute aux flux pour calculer le solde réel.</p>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs text-[#8B949E] mb-1 block">Montant (FCFA)</label>
                <input type="number" value={openingBal}
                  onChange={e => setOpeningBal(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] outline-none focus:border-[#F0A30A]/50" />
              </div>
              <button onClick={saveOpeningBalance} disabled={savingOB}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#F0A30A] text-[#0D1117] disabled:opacity-50 flex items-center gap-2">
                {savingOB && <Loader2 size={13} className="animate-spin" />}
                Enregistrer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Graphique ─────────────────────────────────────────────────────── */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#E6EDF3]">Flux de trésorerie — 30 jours</h2>
          <button onClick={load} className="text-[#484F58] hover:text-[#8B949E] transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartWithCumul} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262D" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: '#8B949E', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#8B949E', fontSize: 10 }} axisLine={false} tickLine={false} width={40}
              tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
            <Tooltip contentStyle={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 8, fontSize: 11 }}
              formatter={(v: any, n: any) => [fmtFCFA(Number(v ?? 0)), n]} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#8B949E' }} />
            <Bar dataKey="entrées" fill="#2EA043" radius={[2, 2, 0, 0]} maxBarSize={14} />
            <Bar dataKey="sorties" fill="#F85149" radius={[2, 2, 0, 0]} maxBarSize={14} />
            <Line type="monotone" dataKey="solde" name="Solde cumulé" stroke="#388BFD" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Transactions ──────────────────────────────────────────────────── */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl">
        {/* Header + filtres */}
        <div className="px-5 py-4 border-b border-[#30363D] flex flex-wrap items-center gap-3 justify-between">
          <h2 className="text-sm font-semibold text-[#E6EDF3]">Transactions</h2>
          <div className="flex gap-1 flex-wrap">
            {([
              { id: 'tout',        label: 'Tout'         },
              { id: 'entree',      label: 'Entrées'      },
              { id: 'sortie',      label: 'Sorties'      },
              { id: 'prestataire', label: 'Prestataires' },
            ] as const).map(f => (
              <button key={f.id} onClick={() => setFilterType(f.id)}
                className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  filterType === f.id
                    ? 'bg-[#388BFD]/15 text-[#388BFD] border border-[#388BFD]/30'
                    : 'text-[#484F58] hover:text-[#8B949E]'
                }`}>
                {f.label}
              </button>
            ))}
            <div className="ml-2 flex gap-1">
              {PERIODES.map(p => (
                <button key={p.days} onClick={() => setPeriode(p.days)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] transition-colors ${
                    periode === p.days
                      ? 'bg-[#F0A30A]/10 text-[#F0A30A] border border-[#F0A30A]/30'
                      : 'text-[#484F58] hover:text-[#8B949E]'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <span className="text-[10px] text-[#484F58]">{filtered.length} opération{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Wallet size={28} className="mx-auto mb-3 text-[#30363D]" />
            <p className="text-[#484F58] text-sm">Aucune transaction</p>
            <p className="text-[#30363D] text-xs mt-1">Utilisez les boutons ci-dessus pour enregistrer des mouvements.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#21262D]">
            {filtered.slice(0, 60).map(t => {
              const isPresta = t.source === 'prestataire'
              const icon = t.type === 'entree'
                ? <ArrowUpCircle size={15} className="text-[#2EA043]" />
                : isPresta
                  ? <Users size={15} className="text-[#F97316]" />
                  : <ArrowDownCircle size={15} className="text-[#F85149]" />
              const bg = t.type === 'entree' ? 'bg-[#2EA043]/10' : isPresta ? 'bg-[#F97316]/10' : 'bg-[#F85149]/10'
              const col = t.type === 'entree' ? 'text-[#2EA043]' : 'text-[#F85149]'
              return (
                <div key={t.id} className="flex items-start gap-3 px-5 py-3 hover:bg-[#21262D]/30 transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${bg}`}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#E6EDF3] truncate">{t.description}</p>
                    <div className="flex flex-wrap gap-2 items-center mt-0.5">
                      <span className="text-[10px] text-[#484F58]">{t.categorie}</span>
                      <span className="text-[10px] text-[#484F58]">·</span>
                      <span className="text-[10px] text-[#484F58]">{modeLabel(t.mode_paiement)}</span>
                      {isPresta && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#F97316]/10 text-[#F97316]">Prestataire</span>
                      )}
                      {t.source && t.source !== 'tresorerie' && t.source !== 'prestataire' && (
                        <span className="text-[10px] text-[#388BFD]">{t.source}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${col}`}>
                      {t.type === 'entree' ? '+' : '−'}{fmtFCFA(t.montant)}
                    </p>
                    <p className="text-[10px] text-[#484F58]">
                      {new Date(t.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

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
                {/* Mode de paiement — boutons visuels */}
                <div>
                  <label className="text-xs text-[#8B949E] mb-2 block font-medium">Mode de réception</label>
                  <div className="grid grid-cols-5 gap-2">
                    {MODES.map(m => {
                      const Icon = m.icon
                      const sel = fEnc.mode === m.value
                      return (
                        <button key={m.value} onClick={() => setFEnc(f => ({ ...f, mode: m.value }))}
                          className="flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[10px] font-medium transition-all"
                          style={{
                            borderColor: sel ? m.color : '#30363D',
                            background: sel ? `${m.color}18` : '#0D1117',
                            color: sel ? m.color : '#484F58',
                          }}>
                          <Icon size={16} />
                          {m.label.split(' ')[0]}
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
                    placeholder="Ex: Paiement frais Jonathan KALALA…"
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

                {/* Preview montant */}
                {fEnc.montant && parseInt(fEnc.montant) > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2EA043]/10 border border-[#2EA043]/20">
                    <ArrowUpCircle size={14} className="text-[#2EA043]" />
                    <span className="text-[#2EA043] text-sm font-bold">+ {fmtFCFA(parseInt(fEnc.montant))}</span>
                    <span className="text-[#2EA043]/60 text-xs ml-auto">{MODES.find(m => m.value === fEnc.mode)?.label}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setModal(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-[#21262D] border border-[#30363D] text-[#8B949E]">
                  Annuler
                </button>
                <button onClick={saveEncaisser} disabled={saving || !fEnc.description || !fEnc.montant}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: '#2EA043', color: '#fff' }}>
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  Enregistrer l'entrée
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
                {/* Mode */}
                <div>
                  <label className="text-xs text-[#8B949E] mb-2 block font-medium">Mode de paiement</label>
                  <div className="grid grid-cols-5 gap-2">
                    {MODES.map(m => {
                      const Icon = m.icon
                      const sel = fDec.mode === m.value
                      return (
                        <button key={m.value} onClick={() => setFDec(f => ({ ...f, mode: m.value }))}
                          className="flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[10px] font-medium transition-all"
                          style={{
                            borderColor: sel ? m.color : '#30363D',
                            background: sel ? `${m.color}18` : '#0D1117',
                            color: sel ? m.color : '#484F58',
                          }}>
                          <Icon size={16} />
                          {m.label.split(' ')[0]}
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
                    <span className="text-[#F85149]/60 text-xs ml-auto">{MODES.find(m => m.value === fDec.mode)?.label}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setModal(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-[#21262D] border border-[#30363D] text-[#8B949E]">
                  Annuler
                </button>
                <button onClick={saveDecaisser} disabled={saving || !fDec.description || !fDec.montant}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: '#F85149', color: '#fff' }}>
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  Enregistrer la sortie
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL PAYER PRESTATAIRE                                               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {modal === 'prestataire' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70" onClick={() => setModal(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-[#161B22] border border-[#F97316]/30 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[#F97316]/20 flex items-center justify-center">
                  <UserCheck size={20} className="text-[#F97316]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#E6EDF3]">Payer un prestataire</h3>
                  <p className="text-[11px] text-[#484F58]">Formateur · Ouvrier · Consultant · Intervenant</p>
                </div>
                <button onClick={() => setModal(null)} className="ml-auto text-[#484F58] hover:text-[#8B949E]"><X size={16} /></button>
              </div>

              {/* Sélection prestataire */}
              {!selPresta ? (
                <div className="space-y-3">
                  {prestataires.length > 0 && (
                    <>
                      <div className="relative">
                        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#484F58]" />
                        <input value={searchPresta} onChange={e => setSearchPresta(e.target.value)}
                          placeholder="Rechercher un prestataire enregistré…"
                          className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg pl-8 pr-3 py-2 text-sm text-[#E6EDF3] placeholder-[#484F58] outline-none focus:border-[#F97316]/50" />
                      </div>
                      <div className="max-h-52 overflow-y-auto divide-y divide-[#21262D] rounded-xl border border-[#30363D] bg-[#0D1117]">
                        {prestasFiltered.map(p => (
                          <button key={p.id} onClick={() => {
                            setSelPresta(p)
                            if (p.taux_horaire) setFPresta(f => ({ ...f, montant: String(p.taux_horaire) }))
                          }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#21262D] transition-colors text-left">
                            <div className="w-8 h-8 rounded-lg bg-[#F97316]/10 flex items-center justify-center shrink-0">
                              <UserCheck size={14} className="text-[#F97316]" />
                            </div>
                            <div>
                              <p className="text-sm text-[#E6EDF3] font-medium">{p.prenom} {p.nom}</p>
                              <p className="text-[10px] text-[#484F58]">{p.type}{p.taux_horaire ? ` · ${fmtFCFA(p.taux_horaire)}/h` : ''}</p>
                            </div>
                          </button>
                        ))}
                        {prestasFiltered.length === 0 && (
                          <p className="text-center py-6 text-[10px] text-[#484F58]">Aucun résultat</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-[#30363D]" />
                        <span className="text-[10px] text-[#484F58]">ou saisie manuelle</span>
                        <div className="flex-1 h-px bg-[#30363D]" />
                      </div>
                    </>
                  )}

                  {/* Saisie manuelle */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#8B949E] mb-1 block">Nom complet</label>
                      <input value={fPresta.nom} onChange={e => setFPresta(f => ({ ...f, nom: e.target.value }))}
                        placeholder="Ex: Jean MOBUTU"
                        className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] placeholder-[#484F58] outline-none focus:border-[#F97316]/50" />
                    </div>
                    <div>
                      <label className="text-xs text-[#8B949E] mb-1 block">Type</label>
                      <select value={fPresta.type} onChange={e => setFPresta(f => ({ ...f, type: e.target.value }))}
                        className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] outline-none">
                        <option value="formateur">Formateur</option>
                        <option value="enseignant">Enseignant</option>
                        <option value="ouvrier">Ouvrier</option>
                        <option value="consultant">Consultant</option>
                        <option value="autre">Autre</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                /* Prestataire sélectionné — badge */
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#F97316]/10 border border-[#F97316]/30 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-[#F97316]/20 flex items-center justify-center">
                    <UserCheck size={16} className="text-[#F97316]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#E6EDF3]">{selPresta.prenom} {selPresta.nom}</p>
                    <p className="text-[10px] text-[#F97316]">{selPresta.type}{selPresta.taux_horaire ? ` · Taux: ${fmtFCFA(selPresta.taux_horaire)}/h` : ''}</p>
                  </div>
                  <button onClick={() => { setSelPresta(null); setFPresta(f => ({ ...f, montant: '' })) }}
                    className="text-[#484F58] hover:text-[#8B949E]"><X size={14} /></button>
                </div>
              )}

              {/* Champs communs */}
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-xs text-[#8B949E] mb-1 block">Motif / Prestation</label>
                  <input value={fPresta.motif} onChange={e => setFPresta(f => ({ ...f, motif: e.target.value }))}
                    placeholder="Ex: Cours Mathématiques — Mai 2026…"
                    className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] placeholder-[#484F58] outline-none focus:border-[#F97316]/50" />
                </div>

                {/* Mode paiement */}
                <div>
                  <label className="text-xs text-[#8B949E] mb-2 block font-medium">Mode de paiement</label>
                  <div className="grid grid-cols-5 gap-2">
                    {MODES.map(m => {
                      const Icon = m.icon
                      const sel = fPresta.mode === m.value
                      return (
                        <button key={m.value} onClick={() => setFPresta(f => ({ ...f, mode: m.value }))}
                          className="flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[10px] font-medium transition-all"
                          style={{
                            borderColor: sel ? m.color : '#30363D',
                            background: sel ? `${m.color}18` : '#0D1117',
                            color: sel ? m.color : '#484F58',
                          }}>
                          <Icon size={16} />
                          {m.label.split(' ')[0]}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Montant (FCFA)</label>
                    <input type="number" value={fPresta.montant} onChange={e => setFPresta(f => ({ ...f, montant: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] placeholder-[#484F58] outline-none focus:border-[#F97316]/50" />
                  </div>
                  <div>
                    <label className="text-xs text-[#8B949E] mb-1 block">Date</label>
                    <input type="date" value={fPresta.date} onChange={e => setFPresta(f => ({ ...f, date: e.target.value }))}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#E6EDF3] outline-none focus:border-[#F97316]/50" />
                  </div>
                </div>

                {fPresta.montant && parseInt(fPresta.montant) > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F97316]/10 border border-[#F97316]/20">
                    <UserCheck size={14} className="text-[#F97316]" />
                    <span className="text-[#F97316] text-sm font-bold">{fmtFCFA(parseInt(fPresta.montant))}</span>
                    <span className="text-[#F97316]/50 text-[10px] ml-auto">4 notifications envoyées</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setModal(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-[#21262D] border border-[#30363D] text-[#8B949E]">
                  Annuler
                </button>
                <button onClick={savePrestataire}
                  disabled={saving || (!selPresta && !fPresta.nom) || !fPresta.montant || !fPresta.motif}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: '#F97316', color: '#fff' }}>
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  Payer le prestataire
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
