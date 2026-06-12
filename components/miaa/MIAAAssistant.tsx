'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, MessageCircle, Bell, FileText, BarChart2, GraduationCap,
  Send, Upload, Download, RefreshCw, Loader2,
  CheckCircle2, ChevronRight, Sparkles, Minimize2, Maximize2,
  FileUp, Trash2, ExternalLink, Bot,
} from 'lucide-react'
import Link from 'next/link'
import { useLocale } from '@/lib/hooks/useLocale'
import type { MIAANotification } from '@/lib/miaa/notifications'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role:      'user' | 'assistant'
  content:   string
  timestamp: string
  model?:    string
  agent?:    string
}

interface TenantData {
  tenant_id?: string
  secteur?:   string
}

interface Props {
  tenantData?: TenantData
  module?:     string
  langue?:     string
}

type Tab = 'chat' | 'alertes' | 'documents' | 'rapports' | 'formation'

// ── Formations / tutoriels ─────────────────────────────────────────────────────

const FORMATIONS = [
  {
    id: 'tva-congo',
    titre: 'TVA Congo-Brazzaville',
    sousTitre: 'TVA 18% + Centime Additionnel 5%',
    icon: '💰',
    contenu: `La TVA au Congo-Brazzaville se calcule ainsi :

1. TVA = Montant HT × 18%
2. CA (Centime Additionnel) = TVA × 5%  ← 5% DE LA TVA, jamais du HT
3. TTC = HT + TVA + CA

Exemple sur 100 000 FCFA HT :
• TVA (18%) = 18 000 FCFA
• CA (5% de la TVA) = 900 FCFA
• TOTAL TTC = 118 900 FCFA

Déclaration : trimestrielle, avant le 15 du mois suivant.`,
  },
  {
    id: 'salaire-net',
    titre: 'Calcul Salaire Net Congo',
    sousTitre: 'CNSS + IRPP progressif',
    icon: '👥',
    contenu: `Calcul du salaire net au Congo-Brazzaville :

1. CNSS salarié = Brut × 5,04% (plafond : 1 500 000 FCFA)
2. Revenu imposable = Brut − CNSS salarié
3. IRPP progressif :
   • 0 à 464 000 : 0%
   • 464 001 à 1 000 000 : 1%
   • 1 000 001 à 3 000 000 : 10%
   • 3 000 001 à 8 000 000 : 25%
   • Au-delà de 8 000 000 : 40%
4. NET = Revenu imposable − IRPP

Charges patronales :
• CNSS patronal = Brut × 14,36%
• Médecine du travail = Brut × 0,5%`,
  },
  {
    id: 'ohada-plan',
    titre: 'Plan Comptable OHADA',
    sousTitre: 'SYSCOHADA révisé — classes 1 à 9',
    icon: '📒',
    contenu: `Classe 1 — Ressources durables : capital, réserves, dettes LT
Classe 2 — Actif immobilisé : terrains, bâtiments, matériel, incorporels
Classe 3 — Stocks : marchandises, matières premières, en-cours
Classe 4 — Tiers : fournisseurs (40), clients (41), État TVA (44)
Classe 5 — Trésorerie : banques (51), caisse (57), virements (58)
Classe 6 — Charges : achats (60), services (62), personnel (64)
Classe 7 — Produits : ventes (70), prestations (71), autres (75)

Règle d'or : Débit = Crédit à chaque écriture.`,
  },
  {
    id: 'facture-ohada',
    titre: 'Facture OHADA conforme',
    sousTitre: 'Mentions obligatoires',
    icon: '📄',
    contenu: `Mentions obligatoires sur une facture OHADA :

1. Numéro unique et chronologique
2. Date d'émission
3. Nom, adresse, RCCM, NIU du vendeur
4. Nom et adresse de l'acheteur
5. Description des biens/services
6. Quantité et prix unitaire HT
7. Taux de TVA applicable
8. Montant TVA (+ CA si Congo)
9. Total TTC
10. Conditions et délais de paiement
11. Pénalités de retard

Délais légaux : 30 jours standard, 60 jours maximum.`,
  },
  {
    id: 'tresorerie-bfr',
    titre: 'Trésorerie & BFR',
    sousTitre: 'Ratios et indicateurs clés',
    icon: '💵',
    contenu: `BFR = (Stocks + Créances clients) − Dettes fournisseurs
FRNG = Capitaux permanents − Actif immobilisé
Trésorerie nette = FRNG − BFR

Ratios de liquidité :
• Générale = Actif CT / Passif CT → idéal > 1,5
• Immédiate = Trésorerie / Passif CT → idéal > 0,5

Délais de rotation :
• Clients = (Créances / CA TTC) × 365 → < 30 jours
• Fournisseurs = (Dettes / Achats TTC) × 365 → > 30 jours

Seuil d'alerte minimum = Charges fixes mensuelles × 1,5`,
  },
]

// ── Suggestions par module (FR / EN) ─────────────────────────────────────────

const MODULE_SUGGESTIONS_FR: Record<string, string[]> = {
  comptabilite: ['Passer une écriture OHADA', 'Vérifier ma balance comptable', 'Calculer la TVA sur 500 000 FCFA'],
  rh:           ['Calculer le salaire net de 450 000 FCFA', 'Obligations CNSS employeur', 'Rédiger un contrat CDI'],
  recrutement:  ['Analyser les candidatures en cours', 'Générer une fiche d\'entretien', 'Meilleurs profils pour ce poste'],
  tresorerie:   ['Quel est mon solde de trésorerie ?', 'Analyser mes flux du mois', 'Prévision à 30 jours'],
  facturation:  ['Créer une facture OHADA conforme', 'Relancer un client impayé', 'Calculer les pénalités de retard'],
  stock:        ['Articles en rupture de stock', 'Valoriser mon inventaire OHADA', 'Optimiser mes commandes'],
  crm:          ['Analyser mes clients actifs', 'Pipeline commercial du mois', 'Stratégie de fidélisation'],
  fiscalite:    ['Calculer la TVA trimestrielle', 'Déclaration DGI Congo', 'Optimiser mon IS 30%'],
  audit:        ['Lancer un audit OHADA complet', 'Analyser les risques détectés', 'Plan d\'action correctif'],
  ecole:        ['Calculer les moyennes des élèves', 'Gestion des frais de scolarité', 'Rapport de résultats'],
  restaurant:   ['Analyser le food cost', 'Calculer la marge d\'un plat', 'Rapport de vente du jour'],
  hotel:        ['Taux d\'occupation du mois', 'Revenu par chambre (RevPAR)', 'Rapport housekeeping'],
  sante:        ['Patients du jour', 'Relance consultations impayées', 'Rapport médecin mensuel'],
  depenses:     ['Mes dépenses du mois', 'Quelles charges déduire ?', 'Budget prévisionnel'],
  auto:         ['Calculer la TVA sur 500 000 FCFA', 'Quel est mon solde de trésorerie ?', 'Comment calculer le salaire net ?'],
}

const MODULE_SUGGESTIONS_EN: Record<string, string[]> = {
  comptabilite: ['Post an OHADA journal entry', 'Check my trial balance', 'Calculate VAT on 500,000 FCFA'],
  rh:           ['Calculate net salary for 450,000 FCFA gross', 'Employer CNSS obligations', 'Draft a permanent contract'],
  recrutement:  ['Analyze ongoing applications', 'Generate an interview sheet', 'Best profiles for this position'],
  tresorerie:   ['What is my cash balance?', 'Analyze my monthly cash flows', 'Cash forecast for 30 days'],
  facturation:  ['Create a compliant OHADA invoice', 'Follow up on unpaid client', 'Calculate late payment penalties'],
  stock:        ['Articles out of stock', 'Value my OHADA inventory', 'Optimize my purchase orders'],
  crm:          ['Analyze my active clients', 'Monthly sales pipeline', 'Customer retention strategy'],
  fiscalite:    ['Calculate quarterly VAT', 'DGI Congo tax declaration', 'Optimize my 30% corporate tax'],
  audit:        ['Launch a full OHADA audit', 'Analyze detected risks', 'Corrective action plan'],
  ecole:        ['Calculate student averages', 'Manage tuition fees', 'Grade results report'],
  restaurant:   ['Analyze food cost', 'Calculate a dish margin', 'Daily sales report'],
  hotel:        ['Monthly occupancy rate', 'Revenue per room (RevPAR)', 'Housekeeping report'],
  sante:        ['Patients today', 'Follow up unpaid consultations', 'Monthly doctor report'],
  depenses:     ['My expenses this month', 'Which charges to deduct?', 'Budget forecast'],
  auto:         ['Calculate VAT on 500,000 FCFA', 'What is my cash balance?', 'How to calculate net salary?'],
}

const MODULE_EXPERT_LABELS_FR: Record<string, string> = {
  comptabilite: 'Expert Comptabilité · OHADA',
  rh:           'Expert RH · Droit social',
  recrutement:  'Expert Recrutement',
  tresorerie:   'Expert Trésorerie',
  facturation:  'Expert Facturation',
  stock:        'Expert Inventaire',
  crm:          'Expert Commercial',
  fiscalite:    'Expert Fiscalité',
  audit:        'Expert Audit · OHADA',
  ecole:        'Expert Éducation',
  restaurant:   'Expert Restauration',
  hotel:        'Expert Hôtellerie',
  sante:        'Expert Clinique',
  depenses:     'Expert Dépenses',
  auto:         'Expert IA · Oraforme ERP',
}

const MODULE_EXPERT_LABELS_EN: Record<string, string> = {
  comptabilite: 'Accounting Expert · OHADA',
  rh:           'HR Expert · Labor Law',
  recrutement:  'Recruitment Expert',
  tresorerie:   'Treasury Expert',
  facturation:  'Invoicing Expert',
  stock:        'Inventory Expert',
  crm:          'Sales Expert',
  fiscalite:    'Tax Expert',
  audit:        'Audit Expert · OHADA',
  ecole:        'Education Expert',
  restaurant:   'Restaurant Expert',
  hotel:        'Hospitality Expert',
  sante:        'Medical Expert',
  depenses:     'Expenses Expert',
  auto:         'AI Expert · Oraforme ERP',
}

// ── Types de documents générables (FR / EN) ───────────────────────────────────

const DOC_TYPES_FR = [
  { id: 'rapport_mensuel',    label: 'Rapport mensuel',    icon: '📊', desc: 'Analyse complète du mois' },
  { id: 'rapport_tresorerie', label: 'Analyse trésorerie', icon: '💵', desc: 'Flux et prévisions' },
  { id: 'rapport_stock',      label: 'Rapport stock',      icon: '📦', desc: 'Rotations et ruptures' },
  { id: 'relance_facture',    label: 'Lettre de relance',  icon: '📨', desc: 'Recouvrement client' },
  { id: 'contrat_travail',    label: 'Contrat de travail', icon: '📋', desc: 'CDI/CDD conforme' },
  { id: 'bulletin_paie',      label: 'Résumé paie',        icon: '💰', desc: 'Synthèse masse salariale' },
  { id: 'bilan_simplifie',    label: 'Bilan simplifié',    icon: '📒', desc: 'Actif/Passif OHADA' },
]

const DOC_TYPES_EN = [
  { id: 'rapport_mensuel',    label: 'Monthly Report',     icon: '📊', desc: 'Full month analysis' },
  { id: 'rapport_tresorerie', label: 'Cash Analysis',      icon: '💵', desc: 'Flows & forecasts' },
  { id: 'rapport_stock',      label: 'Stock Report',       icon: '📦', desc: 'Rotations & shortages' },
  { id: 'relance_facture',    label: 'Follow-up Letter',   icon: '📨', desc: 'Client debt recovery' },
  { id: 'contrat_travail',    label: 'Employment Contract',icon: '📋', desc: 'Compliant CDI/CDD' },
  { id: 'bulletin_paie',      label: 'Payroll Summary',    icon: '💰', desc: 'Payroll mass synthesis' },
  { id: 'bilan_simplifie',    label: 'Simplified Balance', icon: '📒', desc: 'Assets/Liabilities OHADA' },
]

// ── Couleurs priorité ──────────────────────────────────────────────────────────

const PRIORITY_STYLES_FR: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  critical: { bg: '#FEF2F2', border: '#FECACA', dot: '#DC2626', label: 'Urgent' },
  high:     { bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B', label: 'Important' },
  medium:   { bg: '#EFF6FF', border: '#BFDBFE', dot: '#2563EB', label: 'Info' },
  low:      { bg: 'var(--surface)', border: 'var(--border)', dot: '#94A3B8', label: '' },
}

const PRIORITY_STYLES_EN: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  critical: { bg: '#FEF2F2', border: '#FECACA', dot: '#DC2626', label: 'Urgent' },
  high:     { bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B', label: 'Important' },
  medium:   { bg: '#EFF6FF', border: '#BFDBFE', dot: '#2563EB', label: 'Info' },
  low:      { bg: 'var(--surface)', border: 'var(--border)', dot: '#94A3B8', label: '' },
}

// ══════════════════════════════════════════════════════════════════════════════
// Composant principal
// ══════════════════════════════════════════════════════════════════════════════

export default function MIAAAssistant({ tenantData, module = 'auto', langue }: Props) {
  const { t, locale } = useLocale()
  const currentLang = langue || locale || 'fr'
  const isEn = currentLang === 'en'

  const MODULE_SUGGESTIONS = isEn ? MODULE_SUGGESTIONS_EN : MODULE_SUGGESTIONS_FR
  const MODULE_EXPERT_LABELS = isEn ? MODULE_EXPERT_LABELS_EN : MODULE_EXPERT_LABELS_FR
  const DOC_TYPES = isEn ? DOC_TYPES_EN : DOC_TYPES_FR
  const PRIORITY_STYLES = isEn ? PRIORITY_STYLES_EN : PRIORITY_STYLES_FR

  const [open,      setOpen]      = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('chat')

  // Chat
  const [messages,  setMessages]  = useState<ChatMessage[]>([])
  const [input,     setInput]     = useState('')
  const [sending,   setSending]   = useState(false)
  const [streaming, setStreaming] = useState('')

  // Alertes
  const [notifs,    setNotifs]    = useState<MIAANotification[]>([])
  const [loadNotifs, setLoadNotifs] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Documents
  const [docType,   setDocType]   = useState<string>('')
  const [docCtx,    setDocCtx]    = useState('')
  const [docResult, setDocResult] = useState('')
  const [genDoc,    setGenDoc]    = useState(false)

  // Upload
  const [uploadFile,    setUploadFile]    = useState<File | null>(null)
  const [uploadQ,       setUploadQ]       = useState(() => t('miaa.widget.uploadQ'))
  const [uploadResult,  setUploadResult]  = useState('')
  const [uploadLoading, setUploadLoading] = useState(false)

  // Rapports
  const [rapports, setRapports]   = useState<{ type: string; contenu: string; created_at: string }[]>([])
  const [selRapport, setSelRapport] = useState<number | null>(null)

  // Formation
  const [selFormation, setSelFormation] = useState<number | null>(null)

  const chatBottom = useRef<HTMLDivElement>(null)
  const fileInput  = useRef<HTMLInputElement>(null)

  // Auto-scroll chat
  useEffect(() => {
    chatBottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  // Charger notifs quand onglet alertes actif
  useEffect(() => {
    if (activeTab === 'alertes' && open) loadNotifications()
  }, [activeTab, open])

  // Compter non-lus au chargement
  useEffect(() => {
    if (open && tenantData?.tenant_id) {
      fetch(`/api/miaa/notifications?tenant_id=${tenantData.tenant_id}`)
        .then(r => r.json())
        .then(d => setUnreadCount(d.count ?? 0))
        .catch(() => {})
    }
  }, [open, tenantData?.tenant_id])

  const loadNotifications = useCallback(async () => {
    if (!tenantData?.tenant_id) return
    setLoadNotifs(true)
    try {
      const r = await fetch(`/api/miaa/notifications?tenant_id=${tenantData.tenant_id}`)
      const d = await r.json()
      setNotifs(d.notifications ?? [])
      setUnreadCount(d.count ?? 0)
    } finally {
      setLoadNotifs(false)
    }
  }, [tenantData?.tenant_id])

  // ── Chat ───────────────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    const userMsg = input.trim()
    setInput('')
    setSending(true)
    setStreaming('')

    const nowTime = () => new Date().toLocaleTimeString(currentLang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })

    const newMsg: ChatMessage = {
      role: 'user', content: userMsg,
      timestamp: nowTime(),
    }
    setMessages(prev => [...prev, newMsg])

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/miaa/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ module, message: userMsg, history, tenantData, langue: currentLang }),
      })
      const data: Record<string, unknown> = await res.json().catch(() => ({}))

      setMessages(prev => [...prev, {
        role:      'assistant',
        content:   (data.response as string | undefined) ?? t('miaa.widget.errorReply'),
        timestamp: nowTime(),
        model:     data.model_used as string | undefined,
        agent:     data.agent_nom as string | undefined,
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant', content: t('miaa.widget.errorConn'),
        timestamp: new Date().toLocaleTimeString(currentLang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
      }])
    } finally {
      setSending(false)
    }
  }

  // ── Document ───────────────────────────────────────────────────────────────

  const generateDocument = async () => {
    if (!docType || genDoc) return
    setGenDoc(true)
    setDocResult('')
    try {
      const res = await fetch('/api/miaa/generer-document', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: docType, context: docCtx, tenant_id: tenantData?.tenant_id }),
      })
      const data = await res.json()
      setDocResult((data.content ?? data.error ?? t('miaa.widget.errorGenDoc')) as string)
    } finally {
      setGenDoc(false)
    }
  }

  const downloadDocument = () => {
    if (!docResult) return
    const blob = new Blob([docResult], { type: 'text/plain;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${docType}_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Upload ─────────────────────────────────────────────────────────────────

  const analyzeFile = async () => {
    if (!uploadFile || uploadLoading) return
    setUploadLoading(true)
    setUploadResult('')
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('question', uploadQ)
      fd.append('module', module)
      const res  = await fetch('/api/miaa/upload-analyze', { method: 'POST', body: fd })
      const data = await res.json()
      setUploadResult((data.analysis ?? data.error ?? t('miaa.widget.errorAnalysis')) as string)
    } finally {
      setUploadLoading(false)
    }
  }

  // ── Marquer notif lue ──────────────────────────────────────────────────────

  const markRead = async (id: string) => {
    if (!tenantData?.tenant_id) return
    await fetch('/api/miaa/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantData.tenant_id, notification_id: id, action: 'marquer_lu' }),
    })
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  // ── Dimensions ─────────────────────────────────────────────────────────────

  const panelW  = maximized
    ? 'w-[calc(100vw-16px)] max-w-[700px]'
    : 'w-[calc(100vw-16px)] max-w-[400px]'
  const panelH  = maximized ? 'h-[90dvh] sm:h-[85vh]' : 'h-[90dvh] sm:h-[600px]'

  const TABS: { id: Tab; label: string; Icon: React.ElementType; badge?: number }[] = [
    { id: 'chat',      label: 'Chat',                          Icon: MessageCircle },
    { id: 'alertes',   label: t('miaa.widget.tabAlertes'),     Icon: Bell,         badge: unreadCount > 0 ? unreadCount : undefined },
    { id: 'documents', label: t('miaa.widget.tabDocs'),        Icon: FileText },
    { id: 'rapports',  label: t('miaa.widget.tabRapports'),    Icon: BarChart2 },
    { id: 'formation', label: t('miaa.widget.tabFormation'),   Icon: GraduationCap },
  ]

  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <>
      {/* Bouton flottant — Logo MIAA+ animé */}
      <AnimatePresence>
        {!open && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            className="fixed bottom-4 right-2 sm:bottom-6 sm:right-6 z-[9999] flex flex-col items-center gap-1"
          >
            <motion.button
              whileHover={{ scale: 1.10 }}
              whileTap={{ scale: 0.88 }}
              onClick={() => setOpen(true)}
              className="relative w-[64px] h-[64px] flex items-center justify-center"
              title="MIAA+ — Expert IA Oraforme"
            >
              {/* Anneau conic rotatif */}
              <motion.div
                className="absolute inset-[-6px] rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                style={{
                  background: 'conic-gradient(from 0deg, transparent 55%, #DC2626 75%, #FF4444 88%, transparent 100%)',
                  borderRadius: '50%',
                }}
              />
              {/* Halo pulsé */}
              <motion.div
                className="absolute inset-[-2px] rounded-full"
                animate={{ scale: [1, 1.30, 1], opacity: [0.45, 0, 0.45] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                style={{ background: 'radial-gradient(circle, #DC262660 0%, transparent 70%)' }}
              />
              {/* Logo */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/miaa-logo.png"
                alt="MIAA+"
                className="relative z-10 rounded-full object-cover shadow-xl"
                style={{ width: 64, height: 64, filter: 'drop-shadow(0 4px 14px rgba(220,38,38,0.65))' }}
              />
              {/* Badge non-lus */}
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 z-20 flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold shadow-md"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </motion.span>
              )}
            </motion.button>
            {/* Label pulsé */}
            <motion.span
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              className="text-[10px] font-bold tracking-wide select-none"
              style={{ color: '#DC2626', textShadow: '0 1px 4px rgba(220,38,38,0.4)' }}
            >
              MIAA+
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panel principal */}
      {open && (
        <div className={`fixed bottom-4 right-2 sm:bottom-6 sm:right-6 z-[9999] flex flex-col rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden transition-all duration-200 ${panelW} ${panelH}`}
          style={{ background: '#FFFFFF', boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' }}>
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/miaa-logo.png"
                alt="MIAA+"
                className="w-9 h-9 rounded-full object-cover shadow-md ring-2 ring-white/30"
              />
              <div>
                <p className="text-white font-bold text-sm leading-none">MIAA+</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                  <p className="text-white/75 text-[10px]">{MODULE_EXPERT_LABELS[module ?? 'auto'] ?? MODULE_EXPERT_LABELS.auto}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setMaximized(v => !v)} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
                {maximized ? <Minimize2 size={14} className="text-white" /> : <Maximize2 size={14} className="text-white" />}
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
                <X size={14} className="text-white" />
              </button>
            </div>
          </div>

          {/* Onglets */}
          <div className="flex border-b border-[var(--border)] shrink-0 bg-[var(--surface)]">
            {TABS.map(({ id, label, Icon, badge }) => (
              <button key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors relative ${
                  activeTab === id
                    ? 'text-[#F59E0B] border-b-2 border-[#F59E0B]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                }`}>
                <div className="relative">
                  <Icon size={14} />
                  {badge ? (
                    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-red-600 text-white text-[8px] font-bold">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  ) : null}
                </div>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Contenu */}
          <div className="flex-1 overflow-hidden">

            {/* ── CHAT ─────────────────────────────────────────────────────── */}
            {activeTab === 'chat' && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                  {messages.length === 0 && (
                    <div className="text-center py-6">
                      <div className="mx-auto mb-3 w-14 h-14 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/miaa-logo.png" alt="MIAA+" className="w-14 h-14 rounded-full object-cover shadow-lg" />
                        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-400 border-2 border-white" />
                      </div>
                      <p className="text-sm font-semibold text-[var(--text)]">{t('miaa.widget.greeting')}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-[260px] mx-auto">
                        {t('miaa.widget.desc')}
                      </p>
                      <div className="mt-4 space-y-1.5">
                        {(MODULE_SUGGESTIONS[module ?? 'auto'] ?? MODULE_SUGGESTIONS.auto).map(q => (
                          <button key={q}
                            onClick={() => { setInput(q) }}
                            className="w-full text-left text-xs px-3 py-2 rounded-lg border border-[var(--border)] hover:border-[#F59E0B] hover:bg-[#FFFBEB] transition-all text-[var(--text-secondary)]">
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                        m.role === 'user'
                          ? 'text-white rounded-br-sm'
                          : 'text-[var(--text)] border border-[var(--border)] rounded-bl-sm bg-[var(--surface)]'
                      }`} style={m.role === 'user' ? { background: '#F59E0B' } : {}}>
                        <p className="whitespace-pre-wrap">{m.content}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[9px] opacity-60">{m.timestamp}</span>
                          {m.agent && <span className="text-[9px] opacity-60">· {m.agent}</span>}
                          {m.model && <span className="text-[9px] opacity-50">· {m.model.includes('haiku') ? 'Haiku' : m.model.includes('sonnet') ? 'Sonnet' : m.model.includes('opus') ? 'Opus' : m.model}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {sending && (
                    <div className="flex justify-start items-end gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/miaa-logo.png" alt="MIAA+" className="w-6 h-6 rounded-full object-cover shrink-0" />
                      <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl rounded-bl-sm border border-[var(--border)] bg-[var(--surface)]">
                        {[0,1,2].map(i => (
                          <motion.span key={i}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: '#F59E0B' }}
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22 }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={chatBottom} />
                </div>

                {/* Upload zone dans le chat */}
                <div className="shrink-0 border-t border-[var(--border)] px-3 py-2">
                  <div className="flex items-end gap-2">
                    <button
                      onClick={() => fileInput.current?.click()}
                      className="p-2 rounded-xl border border-[var(--border)] hover:border-[#F59E0B] transition-colors shrink-0"
                      title="Analyser un fichier">
                      <FileUp size={14} style={{ color: '#F59E0B' }} />
                    </button>
                    <input ref={fileInput} type="file" className="hidden"
                      accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.txt,image/*"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) {
                          setUploadFile(f)
                          setActiveTab('documents')
                        }
                      }} />
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                      placeholder="Posez votre question…"
                      rows={1}
                      className="flex-1 resize-none rounded-xl border border-[var(--border)] px-3 py-2 text-xs bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[#F59E0B] transition-colors"
                      style={{ maxHeight: '80px' }}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!input.trim() || sending}
                      className="p-2 rounded-xl text-white shrink-0 transition-all disabled:opacity-40"
                      style={{ background: '#F59E0B' }}>
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── ALERTES ──────────────────────────────────────────────────── */}
            {activeTab === 'alertes' && (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] shrink-0">
                  <p className="text-xs font-bold text-[var(--text)]">
                    {notifs.length} alerte{notifs.length !== 1 ? 's' : ''}
                  </p>
                  <button onClick={loadNotifications} disabled={loadNotifs}
                    className="p-1.5 rounded-lg hover:bg-[var(--surface)] transition-colors">
                    <RefreshCw size={12} className={loadNotifs ? 'animate-spin text-[#F59E0B]' : 'text-[var(--text-secondary)]'} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {notifs.length === 0 && (
                    <div className="text-center py-8">
                      <CheckCircle2 size={24} className="mx-auto mb-2" style={{ color: '#16A34A' }} />
                      <p className="text-xs text-[var(--text-secondary)]">Aucune alerte active.</p>
                    </div>
                  )}
                  {notifs.map(n => {
                    const s = PRIORITY_STYLES[n.priority] ?? PRIORITY_STYLES.low
                    return (
                      <div key={n.id}
                        className={`p-3 rounded-xl border ${n.lu ? 'opacity-60' : ''}`}
                        style={{ background: s.bg, borderColor: s.border }}>
                        <div className="flex items-start gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: s.dot }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-[var(--text)] leading-tight">{n.titre}</p>
                              {s.label && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0"
                                  style={{ background: s.dot }}>{s.label}</span>
                              )}
                            </div>
                            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">{n.message}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              {n.action_url && (
                                <Link href={n.action_url}
                                  className="text-[10px] font-medium flex items-center gap-0.5"
                                  style={{ color: '#F59E0B' }}>
                                  {n.action_label ?? 'Voir'} <ChevronRight size={10} />
                                </Link>
                              )}
                              {!n.lu && (
                                <button onClick={() => markRead(n.id)}
                                  className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text)] ml-auto">
                                  Marquer lu
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── DOCUMENTS ────────────────────────────────────────────────── */}
            {activeTab === 'documents' && (
              <div className="flex flex-col h-full overflow-y-auto">
                {/* Génération de document */}
                <div className="p-3 border-b border-[var(--border)]">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Générer un document</p>
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    {DOC_TYPES.map(dt => (
                      <button key={dt.id}
                        onClick={() => setDocType(dt.id)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-left transition-all ${
                          docType === dt.id ? 'border-[#F59E0B] bg-[#FFFBEB]' : 'border-[var(--border)] hover:border-[#F59E0B]'
                        }`}>
                        <span className="text-base">{dt.icon}</span>
                        <div>
                          <p className="text-[10px] font-medium text-[var(--text)]">{dt.label}</p>
                          <p className="text-[9px] text-[var(--text-secondary)]">{dt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  {docType && (
                    <>
                      <textarea value={docCtx} onChange={e => setDocCtx(e.target.value)}
                        placeholder="Contexte supplémentaire (optionnel)…"
                        rows={2}
                        className="w-full text-xs rounded-lg border border-[var(--border)] px-2 py-1.5 bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[#F59E0B] resize-none mb-2" />
                      <div className="flex gap-2">
                        <button onClick={generateDocument} disabled={genDoc}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-white text-xs font-medium transition-all disabled:opacity-50"
                          style={{ background: '#F59E0B' }}>
                          {genDoc ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                          {genDoc ? 'Génération…' : 'Générer'}
                        </button>
                        {docResult && (
                          <button onClick={downloadDocument}
                            className="p-2 rounded-lg border border-[var(--border)] hover:border-[#F59E0B] transition-colors"
                            title="Télécharger">
                            <Download size={14} style={{ color: '#F59E0B' }} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                  {docResult && (
                    <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 max-h-40 overflow-y-auto">
                      <pre className="text-[10px] text-[var(--text)] whitespace-pre-wrap font-sans leading-relaxed">{docResult}</pre>
                    </div>
                  )}
                </div>

                {/* Analyser un fichier */}
                <div className="p-3">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Analyser un fichier</p>
                  <div
                    onClick={() => fileInput.current?.click()}
                    className="border-2 border-dashed border-[var(--border)] rounded-xl p-4 text-center cursor-pointer hover:border-[#F59E0B] hover:bg-[#FFFBEB] transition-all">
                    <Upload size={18} className="mx-auto mb-1" style={{ color: '#F59E0B' }} />
                    <p className="text-xs font-medium text-[var(--text)]">
                      {uploadFile ? uploadFile.name : 'Glisser ou cliquer'}
                    </p>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">PDF, Excel, Word, Image</p>
                    {uploadFile && (
                      <button onClick={e => { e.stopPropagation(); setUploadFile(null); setUploadResult('') }}
                        className="mt-1 text-[10px] text-red-500 flex items-center gap-0.5 mx-auto">
                        <Trash2 size={10} /> Supprimer
                      </button>
                    )}
                  </div>
                  {uploadFile && (
                    <>
                      <textarea value={uploadQ} onChange={e => setUploadQ(e.target.value)}
                        rows={2} placeholder="Question sur le fichier…"
                        className="w-full mt-2 text-xs rounded-lg border border-[var(--border)] px-2 py-1.5 bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[#F59E0B] resize-none" />
                      <button onClick={analyzeFile} disabled={uploadLoading}
                        className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 rounded-lg text-white text-xs font-medium transition-all disabled:opacity-50"
                        style={{ background: '#F59E0B' }}>
                        {uploadLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        {uploadLoading ? 'Analyse en cours…' : 'Analyser avec MIAA+'}
                      </button>
                    </>
                  )}
                  {uploadResult && (
                    <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 max-h-48 overflow-y-auto">
                      <pre className="text-[10px] text-[var(--text)] whitespace-pre-wrap font-sans leading-relaxed">{uploadResult}</pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── RAPPORTS ─────────────────────────────────────────────────── */}
            {activeTab === 'rapports' && (
              <div className="flex flex-col h-full overflow-y-auto p-3 space-y-2">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Rapports générés</p>
                {rapports.length === 0 ? (
                  <div className="text-center py-8">
                    <BarChart2 size={24} className="mx-auto mb-2 text-[var(--text-secondary)]" />
                    <p className="text-xs text-[var(--text-secondary)]">Aucun rapport disponible.</p>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-1">Générez votre premier rapport dans l&apos;onglet Documents.</p>
                    <button
                      onClick={() => setActiveTab('documents')}
                      className="mt-3 text-xs font-medium px-3 py-1.5 rounded-lg text-white"
                      style={{ background: '#F59E0B' }}>
                      Générer un rapport
                    </button>
                  </div>
                ) : rapports.map((r, i) => (
                  <div key={i}
                    onClick={() => setSelRapport(selRapport === i ? null : i)}
                    className="p-3 rounded-xl border border-[var(--border)] cursor-pointer hover:border-[#F59E0B] transition-all">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-[var(--text)]">{r.type}</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">{new Date(r.created_at).toLocaleDateString('fr-FR')}</p>
                      </div>
                      <ExternalLink size={12} className="text-[var(--text-secondary)]" />
                    </div>
                    {selRapport === i && (
                      <pre className="mt-2 text-[10px] text-[var(--text)] whitespace-pre-wrap font-sans max-h-40 overflow-y-auto">{r.contenu}</pre>
                    )}
                  </div>
                ))}
                <div className="pt-2 border-t border-[var(--border)]">
                  <Link href="/dashboard/miaa"
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[var(--border)] text-xs font-medium text-[var(--text)] hover:border-[#F59E0B] transition-all">
                    <ExternalLink size={12} /> Voir tous les rapports MIAA+
                  </Link>
                </div>
              </div>
            )}

            {/* ── FORMATION ────────────────────────────────────────────────── */}
            {activeTab === 'formation' && (
              <div className="flex flex-col h-full overflow-y-auto p-3 space-y-2">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Guides pratiques OHADA</p>
                {FORMATIONS.map((f, i) => (
                  <div key={f.id}
                    className="rounded-xl border border-[var(--border)] overflow-hidden">
                    <button
                      onClick={() => setSelFormation(selFormation === i ? null : i)}
                      className="w-full flex items-center gap-2.5 p-3 text-left hover:bg-[var(--surface)] transition-colors">
                      <span className="text-xl">{f.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[var(--text)]">{f.titre}</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">{f.sousTitre}</p>
                      </div>
                      <ChevronRight size={12} className={`text-[var(--text-secondary)] transition-transform ${selFormation === i ? 'rotate-90' : ''}`} />
                    </button>
                    {selFormation === i && (
                      <div className="px-3 pb-3 border-t border-[var(--border)] bg-[var(--surface)]">
                        <pre className="text-[11px] text-[var(--text)] whitespace-pre-wrap font-sans leading-relaxed pt-2">{f.contenu}</pre>
                        <button
                          onClick={() => {
                            setActiveTab('chat')
                            setInput(`Explique-moi en détail : ${f.titre}`)
                          }}
                          className="mt-2 text-[10px] flex items-center gap-1 font-medium"
                          style={{ color: '#F59E0B' }}>
                          <MessageCircle size={10} /> Poser une question à MIAA+
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
