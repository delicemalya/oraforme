'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GraduationCap, BookOpen, Award, RotateCcw, ChevronLeft,
  Send, Loader2, CheckCircle2, Trophy, Sparkles, Download,
  Search, Filter, Star, TrendingUp, Clock, Users,
  FileText, FileSpreadsheet, FileType2,
} from 'lucide-react'
import { useTenant } from '@/lib/hooks/useTenant'

// ── Palette ───────────────────────────────────────────────────────────────────
const GC  = '#2563EB'
const GD  = '#1D4ED8'
const GL  = '#EFF6FF'
const GGR = 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)'

// ── Types ─────────────────────────────────────────────────────────────────────
type Level   = 'debutant' | 'intermediaire' | 'avance' | 'expert'
type Screen  = 'home' | 'category' | 'level' | 'learning' | 'quiz' | 'result' | 'certificates'
interface ChatMsg { role: 'user' | 'assistant'; content: string; timestamp: string }
interface QuizQ   { q: string; opts: string[]; ans: number }

// ── Données Academy ───────────────────────────────────────────────────────────
const ACADEMY_CATS = [
  { id: 'comptabilite-ohada',  label: 'Comptabilité OHADA',       icon: '📒', color: '#2563EB', desc: 'SYSCOHADA révisé, bilan, compte de résultat, TVA' },
  { id: 'fiscalite',           label: 'Fiscalité Congo',           icon: '🏛️', color: '#7C3AED', desc: 'TVA 18%+CA, IS 30%, IRPP, patente, DGI' },
  { id: 'audit',               label: 'Audit & Contrôle Interne',  icon: '🔍', color: '#DC2626', desc: 'COSO, scoring risques, conformité OHADA' },
  { id: 'rh-paie',             label: 'RH & Paie',                 icon: '👥', color: '#16A34A', desc: 'CNSS 5.04%/14.36%, IRPP, CDI/CDD, droit travail' },
  { id: 'controle-gestion',    label: 'Contrôle de Gestion',      icon: '📊', color: '#F59E0B', desc: 'Tableaux de bord, KPIs, budgets, écarts' },
  { id: 'finance',             label: 'Finance',                   icon: '💹', color: '#0891B2', desc: 'Évaluation, investissements, levée de fonds' },
  { id: 'tresorerie',          label: 'Trésorerie & BFR',          icon: '💵', color: '#059669', desc: 'Cash flow, BFR, FRNG, mobile money' },
  { id: 'entrepreneuriat',     label: 'Entrepreneuriat',           icon: '🚀', color: '#EA580C', desc: 'Business plan, SARL Congo, MVP, croissance' },
  { id: 'genie-civil-btp',     label: 'Génie Civil & BTP',        icon: '🏗️', color: '#78716C', desc: 'Métrés, devis BTP, Gantt, marchés publics ARMP' },
  { id: 'gestion-hoteliere',   label: 'Gestion Hôtelière',        icon: '🏨', color: '#0369A1', desc: 'RevPAR, yield management, channel manager' },
  { id: 'gestion-restaurant',  label: 'Gestion Restaurant',       icon: '🍽️', color: '#D97706', desc: 'Food cost, HACCP, ingénierie menu, caisse' },
  { id: 'gestion-pharmacie',   label: 'Gestion Pharmacie',        icon: '💊', color: '#9333EA', desc: 'FEFO, BPD, ordonnances, stupéfiants, prix' },
  { id: 'gestion-clinique',    label: 'Gestion Clinique',         icon: '🏥', color: '#DC2626', desc: 'Patients, CIM-10, CAMU 80%, facturation médicale' },
  { id: 'gestion-ecole',       label: 'Gestion École',            icon: '🎓', color: '#2563EB', desc: 'Scolarité, bulletins, recouvrement frais, CRE' },
  { id: 'cabinet-comptable',   label: 'Cabinet Comptable',        icon: '⚖️', color: '#64748B', desc: 'Multi-clients, liasses fiscales, CAC' },
  { id: 'agriculture-elevage', label: 'Agriculture & Élevage',    icon: '🌾', color: '#65A30D', desc: 'Cultures tropicales, NPK, CAFI, certifications' },
  { id: 'gestion-stock',       label: 'Gestion de Stock',         icon: '📦', color: '#16A34A', desc: 'FIFO/FEFO, Wilson, ABC, inventaire OHADA' },
  { id: 'crm-vente',           label: 'CRM & Vente',              icon: '🤝', color: '#F59E0B', desc: 'Pipeline, scoring leads, LTV client, KPIs commerciaux' },
  { id: 'leadership',          label: 'Leadership',               icon: '⭐', color: '#B45309', desc: 'Management situationnel, délégation, conflits' },
  { id: 'management',          label: 'Management',               icon: '🎯', color: '#7C3AED', desc: 'MBO, planification SMART, gestion du temps' },
  { id: 'banque-microfinance',  label: 'Banque & Microfinance',   icon: '🏦', color: '#0891B2', desc: 'COBAC, KYC, LAB/FT, microcrédit solidaire' },
  { id: 'ong-associations',    label: 'ONG & Associations',       icon: '🤲', color: '#16A34A', desc: 'Cadre logique, rapport bailleur, gouvernance' },
]

const LEVELS: { id: Level; label: string; desc: string; icon: string; color: string }[] = [
  { id: 'debutant',      label: 'Débutant',      desc: 'Je découvre le sujet',            icon: '🌱', color: '#16A34A' },
  { id: 'intermediaire', label: 'Intermédiaire', desc: "J'ai des bases solides",           icon: '📈', color: '#2563EB' },
  { id: 'avance',        label: 'Avancé',         desc: 'Je maîtrise les concepts clés',   icon: '🔥', color: '#F59E0B' },
  { id: 'expert',        label: 'Expert',         desc: 'Je veux me perfectionner',        icon: '⚡', color: '#7C3AED' },
]

const QUIZ: Record<string, QuizQ[]> = {
  'comptabilite-ohada': [
    { q: 'Le SYSCOHADA révisé comporte combien de classes de comptes ?', opts: ['7','8','9','10'], ans: 2 },
    { q: 'La règle fondamentale : Débit = ?', opts: ['Capital','Actif','Crédit','Résultat'], ans: 2 },
    { q: 'Le compte 411 correspond à :', opts: ['Fournisseurs','Clients','Banque','Caisse'], ans: 1 },
    { q: 'La TVA au Congo est de :', opts: ['15%','18%','20%','25%'], ans: 1 },
    { q: 'Le CA (Centime Additionnel) est de :', opts: ['5% du HT','5% de la TVA','18% du TTC','2% du HT'], ans: 1 },
  ],
  'fiscalite': [
    { q: 'Taux IS Congo :', opts: ['25%','28%','30%','33%'], ans: 2 },
    { q: 'Déclaration TVA Congo :', opts: ['Mensuelle','Trimestrielle','Annuelle','Semestrielle'], ans: 1 },
    { q: '1er taux IRPP Congo s\'applique à partir de :', opts: ['100 000','250 000','464 001','1 000 000'], ans: 2 },
    { q: 'NIU = ?', opts: ["N° Interne Unique","N° d'Identification Unique","N° Informatique Unifié","N° Indirect Usuel"], ans: 1 },
    { q: 'DGI = ?', opts: ['Direction Générale des Impôts','Déclaration Générale des Investissements','Direction Gestion Interne','Division des Gains Imposables'], ans: 0 },
  ],
  'rh-paie': [
    { q: 'CNSS salarié Congo :', opts: ['4%','4,5%','5,04%','6%'], ans: 2 },
    { q: 'Plafond CNSS Congo :', opts: ['1 000 000','1 500 000','2 000 000','3 000 000'], ans: 1 },
    { q: 'CNSS patronal Congo :', opts: ['10%','12%','14,36%','16%'], ans: 2 },
    { q: 'Médecine du travail (patronal) :', opts: ['0,25%','0,5%','1%','2%'], ans: 1 },
    { q: 'NET = Revenu imposable − ?', opts: ['CNSS','IRPP','IS','CA'], ans: 1 },
  ],
  'tresorerie': [
    { q: 'BFR = ?', opts: ['FRNG − Trésorerie','(Stocks+Créances) − Dettes fourn.','Actif − Passif','Capital − Immobil.'], ans: 1 },
    { q: 'Liquidité générale idéale :', opts: ['> 0,5','> 1','> 1,5','> 2'], ans: 2 },
    { q: 'FRNG = ?', opts: ['Capitaux permanents − Actif immo.','Actif CT − Passif CT','BFR + Trésorerie','CA − Charges'], ans: 0 },
    { q: 'Délai clients idéal :', opts: ['< 30 j','< 60 j','< 90 j','< 120 j'], ans: 0 },
    { q: 'Trésorerie nette = ?', opts: ['FRNG − BFR','BFR − FRNG','Actif − Passif','CA − Charges'], ans: 0 },
  ],
  'gestion-clinique': [
    { q: 'Le dossier médical doit être conservé pendant :', opts: ['5 ans','10 ans','20 ans','Toute la vie du patient'], ans: 2 },
    { q: 'CAMU couvre quelle proportion des soins au Congo ?', opts: ['50%','70%','80%','100%'], ans: 2 },
    { q: 'CIM-10 est :', opts: ['Classification Internationale des Maladies','Contrôle Interne Médical','Code International des Médicaments','Certificat Infirmier Médical'], ans: 0 },
    { q: 'Le triage aux urgences classe les patients selon :', opts: ["L'ordre d'arrivée","La priorité médicale","L'assurance","L'âge"], ans: 1 },
    { q: 'La facturation des soins médicaux au Congo est :', opts: ['Exonérée de TVA','Soumise à TVA 18%','Soumise à IS','Soumise à patente'], ans: 0 },
  ],
  'gestion-restaurant': [
    { q: 'Le food cost idéal en restauration est :', opts: ['< 10%','28-35%','50-60%','70-80%'], ans: 1 },
    { q: 'Un plat vendu 8 000 FCFA avec food cost 30% a un coût matière de :', opts: ['2 400 FCFA','800 FCFA','4 000 FCFA','1 600 FCFA'], ans: 0 },
    { q: 'HACCP est :', opts: ["Un label de qualité","Une méthode d'analyse des risques alimentaires","Un logiciel de caisse","Un ratio de rentabilité"], ans: 1 },
    { q: 'Le ticket moyen s\'obtient par :', opts: ['CA / Nombre de couverts','CA / Nombre de plats','Charges / CA','CA − Charges'], ans: 0 },
    { q: 'La DLC signifie :', opts: ['Date Limite de Commercialisation','Date Limite de Consommation','Délai Legal de Conservation','Date de Livraison Confirmée'], ans: 1 },
  ],
  'gestion-hoteliere': [
    { q: 'RevPAR se calcule par :', opts: ['CA / Chambres disponibles','CA / Chambres occupées','Tarif moyen × Taux occupation','A et C sont identiques'], ans: 2 },
    { q: 'Le taux d\'occupation cible en hôtellerie est :', opts: ['30-40%','50-60%','65-80%','95-100%'], ans: 2 },
    { q: 'OTA signifie :', opts: ['Online Travel Agency','Official Tourism Authority','Open Travel Account','Outbound Tourism Association'], ans: 0 },
    { q: 'Le check-in standard est généralement à :', opts: ['10h','12h','14h','18h'], ans: 2 },
    { q: 'Un client no-show engendre :', opts: ['Un remboursement automatique','Des pénalités selon la politique','Rien','Un upgrade automatique'], ans: 1 },
  ],
  default: [
    { q: 'OHADA signifie :', opts: ["Organisation pour l'Harmonisation en Afrique du Droit des Affaires","Office des Affaires Dominicales en Afrique","Organisation des Hommes d'Affaires","Ordre des Hommes d'Affaires d'Afrique"], ans: 0 },
    { q: 'Combien de pays membres l\'OHADA compte-t-elle ?', opts: ['12','14','17','20'], ans: 2 },
    { q: 'SYSCOHADA est :', opts: ['Un logiciel','Le Système Comptable OHADA','Un règlement bancaire','Une directive fiscale'], ans: 1 },
    { q: 'Durée d\'un exercice comptable OHADA :', opts: ['6 mois','9 mois','12 mois','18 mois'], ans: 2 },
    { q: 'Capital minimum d\'une SARL au Congo :', opts: ['100 000','500 000','1 000 000','5 000 000'], ans: 0 },
  ],
}

const DAILY_TOPICS: Record<string, string[]> = {
  'comptabilite-ohada': ['Écritures de base OHADA — Débit, Crédit, Journal','La balance et le grand livre','Bilan SYSCOHADA : actif et passif','Compte de résultat et soldes','Amortissements et provisions OHADA','Clôture annuelle et états financiers','TVA 18% + Centime Additionnel 5% Congo'],
  'fiscalite': ["IS 30% Congo — Base et calcul","TVA 18%+CA 5% — Déclaration trimestrielle","IRPP progressif — Barème Congo 2024","Patente et taxes locales","Obligations déclaratives DGI Congo","Optimisation fiscale légale OHADA","Contrôles fiscaux : droits et recours"],
  'rh-paie': ['Contrat CDI/CDD Congo — Clauses obligatoires','Calcul salaire net — CNSS 5,04% + IRPP','Cotisations patronales CNSS 14,36%','Congés annuels et absences légales','Procédures de licenciement au Congo','Avantages en nature et primes','Stagiaires et apprentis — Cadre légal'],
  'tresorerie': ['BFR et FRNG — Formules fondamentales','Prévisions de trésorerie à 30 jours','Ratios de liquidité','Délais de rotation clients/fournisseurs','Mobile Money pro — Airtel, MTN, Orange','Plan de financement court terme','Gestion de crise de liquidité'],
  'gestion-clinique': ['Organisation cabinet médical','Dossier patient informatisé — CIM-10','Facturation médicale et assurances','Protocoles urgences de base','Gestion stock pharmacie','CAMU 80% — Remboursements','Indicateurs qualité clinique'],
  'gestion-restaurant': ['Food cost et prix de revient','Gestion des stocks FIFO','Ingénierie du menu — Stars & Dogs','Ratios de rentabilité','Hygiène HACCP — Obligations','Recrutement personnel','Caisse journalière et réconciliation'],
  'gestion-hoteliere': ["Taux d'occupation et RevPAR","Channel manager et distribution","Gestion housekeeping","Yield management","Accueil client 5 étoiles","Revenue Management — KPIs","Maintenance préventive"],
  'gestion-pharmacie': ['Réception et contrôle médicaments','Gestion FEFO stocks','Dispensation sur ordonnance','Stupéfiants — Réglementation Congo','Calcul prix de vente officine','Ruptures de stock — Prévention','Pharmacovigilance'],
  'audit': ['Audit interne OHADA — Périmètre','Scoring risques (grille 100 pts)','Contrôle interne COSO','Tests de conformité','Rapport audit — Rédaction','Plan d\'action correctif','Audit fiscal et contrôle DGI'],
  'gestion-ecole': ['Organisation pédagogique','Gestion des inscriptions et frais','Emploi du temps et salles','Bulletins scolaires et moyennes','Recouvrement des frais de scolarité','Rapports DPEI et statistiques','Gestion du personnel enseignant'],
  default: ['Les fondamentaux de la gestion','Lire un bilan simplifié','Calculer sa rentabilité','Gérer sa trésorerie','Obligations légales Congo','Développer ses ventes','Manager son équipe'],
}

// ── Composant Stat Card ───────────────────────────────────────────────────────
function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: string | number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E8F0] bg-white">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p className="text-lg font-bold text-[#0F172A] leading-none">{value}</p>
        <p className="text-xs text-[#64748B] mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ── Export helpers ─────────────────────────────────────────────────────────────

async function exportCoursAsPDF(content: string, catLabel: string) {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
  doc.text(`MIAA+ Academy — ${catLabel}`, 15, 15)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  doc.text(new Date().toLocaleDateString('fr-FR'), 15, 22)
  doc.setDrawColor(37, 99, 235); doc.line(15, 25, 195, 25)
  doc.setFontSize(11)
  const lines = doc.splitTextToSize(content, 180)
  let y = 33
  for (const line of lines) {
    if (y > 280) { doc.addPage(); y = 20 }
    doc.text(line, 15, y); y += 5.5
  }
  doc.save(`Academy_${catLabel.replace(/\s/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`)
}

function exportCoursAsDOCX(content: string, catLabel: string) {
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'><style>body{font-family:Calibri,Arial;font-size:11pt}h1{font-size:14pt;color:#1D4ED8}pre{white-space:pre-wrap;font-family:Calibri}</style></head><body><h1>MIAA+ Academy — ${catLabel}</h1><p style="color:#666;font-size:9pt">${new Date().toLocaleDateString('fr-FR')}</p><hr/><pre>${content.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre></body></html>`
  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = `Academy_${catLabel.replace(/\s/g, '_')}.doc`; a.click()
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function AcademyPage() {
  const { tenantId } = useTenant()

  const [screen,   setScreen]   = useState<Screen>('home')
  const [search,   setSearch]   = useState('')
  const [selCat,   setSelCat]   = useState('')
  const [selLevel, setSelLevel] = useState<Level>('debutant')

  // Chat formateur
  const [messages,  setMessages]  = useState<ChatMsg[]>([])
  const [input,     setInput]     = useState('')
  const [sending,   setSending]   = useState(false)
  const chatBottom = useRef<HTMLDivElement>(null)

  // Quiz
  const [quizIdx,  setQuizIdx]  = useState(0)
  const [quizSel,  setQuizSel]  = useState<number | null>(null)
  const [quizScore, setQuizScore] = useState(0)
  const [quizDone,  setQuizDone]  = useState(false)

  // Progression / stats
  const [stats, setStats]   = useState({ total_cours: 0, total_quiz: 0, taux_reussite: 0, nb_certificats: 0, categories_vues: 0 })
  const [certs, setCerts]   = useState<{ categorie: string; niveau: string; pourcentage: number; delivre_le: string }[]>([])
  const [statsLoaded, setStatsLoaded] = useState(false)

  // Auto-scroll
  useEffect(() => { chatBottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Charger les stats
  const loadStats = useCallback(async () => {
    if (!tenantId || statsLoaded) return
    try {
      const res  = await fetch(`/api/miaa/academy?tenant_id=${tenantId}`)
      const data = await res.json()
      setStats(data.stats ?? stats)
      setCerts(data.certificates ?? [])
      setStatsLoaded(true)
    } catch { /* silencieux */ }
  }, [tenantId, statsLoaded, stats])

  useEffect(() => { loadStats() }, [loadStats])

  // ── Démarrer une formation ──────────────────────────────────────────────────
  const startLearning = async () => {
    const cat   = ACADEMY_CATS.find(c => c.id === selCat)
    const lvl   = LEVELS.find(l => l.id === selLevel)
    const topic = (() => { const topics = DAILY_TOPICS[selCat] ?? DAILY_TOPICS.default; return topics[new Date().getDay() % topics.length] })()
    const date  = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

    setMessages([{
      role: 'assistant',
      content: `Bienvenue dans votre cours du ${date} !\n\nSujet du jour : ${topic}\nDomaine : ${cat?.label}\nVotre niveau : ${lvl?.label} ${lvl?.icon}\n\nJe suis votre formateur MIAA+ Academy. Je vais vous enseigner ce sujet étape par étape avec des exemples concrets adaptés au contexte Congo-Brazzaville / OHADA / CEMAC.\n\nTapez "Commence la leçon" pour démarrer, ou posez directement une question !`,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    }])
    setScreen('learning')

    // Sauvegarder la progression
    if (tenantId) {
      await fetch('/api/miaa/academy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_progress', tenant_id: tenantId, categorie: selCat, niveau: selLevel }),
      }).catch(() => {})
    }
  }

  // ── Envoyer un message au formateur ────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || sending) return
    const userMsg = input.trim(); setInput(''); setSending(true)
    const now = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: now() }])

    const cat = ACADEMY_CATS.find(c => c.id === selCat)
    const lvl = LEVELS.find(l => l.id === selLevel)

    try {
      const res  = await fetch('/api/miaa/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'formation',
          message: `MODE FORMATEUR ACADEMY. Catégorie : ${cat?.label}. Niveau : ${lvl?.label}. Contexte Congo/OHADA/CEMAC. Enseigne comme un professeur expert certifié avec des exemples concrets. Sois pédagogue et structuré. Question : ${userMsg}`,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          tenantData: tenantId ? { tenant_id: tenantId } : undefined,
          langue: 'fr',
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: (data.response as string) ?? 'Erreur de réponse.',
        timestamp: now(),
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connexion impossible.', timestamp: now() }])
    } finally { setSending(false) }
  }

  // ── Quiz ────────────────────────────────────────────────────────────────────
  const quizQuestions = QUIZ[selCat] ?? QUIZ.default

  const startQuiz = () => {
    setQuizIdx(0); setQuizScore(0); setQuizSel(null); setQuizDone(false)
    setScreen('quiz')
  }

  const answerQuiz = (idx: number) => {
    if (quizSel !== null) return
    setQuizSel(idx)
    const correct = quizQuestions[quizIdx].ans === idx
    setTimeout(async () => {
      if (correct) setQuizScore(s => s + 1)
      if (quizIdx + 1 >= quizQuestions.length) {
        const finalScore = quizScore + (correct ? 1 : 0)
        setQuizDone(true)
        setScreen('result')
        // Sauvegarder le résultat
        if (tenantId) {
          await fetch('/api/miaa/academy', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save_quiz', tenant_id: tenantId,
              categorie: selCat, niveau: selLevel,
              score: finalScore, score_max: quizQuestions.length,
              user_name: 'Apprenant',
            }),
          }).catch(() => {})
          setStatsLoaded(false) // force reload stats
        }
      } else {
        setQuizIdx(q => q + 1); setQuizSel(null)
      }
    }, 900)
  }

  // ── Filtrage catégories ─────────────────────────────────────────────────────
  const filteredCats = search.trim()
    ? ACADEMY_CATS.filter(c => c.label.toLowerCase().includes(search.toLowerCase()) || c.desc.toLowerCase().includes(search.toLowerCase()))
    : ACADEMY_CATS

  const catInfo   = ACADEMY_CATS.find(c => c.id === selCat)
  const levelInfo = LEVELS.find(l => l.id === selLevel)
  const todayIdx  = new Date().getDay()
  const todayTopic = (catId: string) => {
    const topics = DAILY_TOPICS[catId] ?? DAILY_TOPICS.default
    return topics[todayIdx % topics.length]
  }

  // ── Rendu ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-[#E2E8F0] px-4 sm:px-6 py-4" style={{ background: 'white' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {screen !== 'home' && screen !== 'certificates' && (
              <button onClick={() => {
                if (screen === 'learning' || screen === 'quiz') setScreen('level')
                else if (screen === 'level') setScreen('category')
                else if (screen === 'category') setScreen('home')
                else setScreen('home')
              }} className="p-2 rounded-xl border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">
                <ChevronLeft size={18} className="text-[#64748B]" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: GGR }}>
                <GraduationCap size={20} className="text-white" />
              </div>
              <div>
                <p className="text-base font-bold text-[#0F172A]">MIAA+ Academy</p>
                <p className="text-xs text-[#64748B]">
                  {screen === 'home'         ? 'Votre université intelligente'
                    : screen === 'certificates' ? 'Mes certificats'
                    : screen === 'category'   ? catInfo?.label
                    : screen === 'level'      ? `Sélection niveau — ${catInfo?.label}`
                    : screen === 'learning'   ? `Cours — ${catInfo?.label} · ${levelInfo?.label}`
                    : screen === 'quiz'       ? `Quiz — ${catInfo?.label}`
                    : `Résultat — ${catInfo?.label}`}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setScreen('certificates'); loadStats() }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm font-medium text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-all">
              <Award size={15} style={{ color: GC }} />
              <span className="hidden sm:inline">Certificats</span>
              {certs.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: GC }}>{certs.length}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <AnimatePresence mode="wait">

          {/* ═══════════════════════════════════ HOME ══════════════════════ */}
          {screen === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <StatCard icon={<BookOpen size={18} />} value={stats.total_cours}      label="Cours suivis"    color={GC} />
                <StatCard icon={<Trophy size={18} />}   value={`${stats.taux_reussite}%`} label="Taux réussite"  color="#16A34A" />
                <StatCard icon={<Award size={18} />}    value={stats.nb_certificats}    label="Certificats"     color="#F59E0B" />
                <StatCard icon={<Star size={18} />}     value={stats.categories_vues}   label="Domaines explorés" color="#7C3AED" />
              </div>

              {/* Cours du jour */}
              <div className="mb-6 p-4 rounded-2xl border-2 text-white" style={{ background: GGR, borderColor: GD }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">⭐</span>
                  <p className="text-sm font-bold">Cours du jour recommandé</p>
                </div>
                <p className="text-xs text-white/80 mb-3">{todayTopic('comptabilite-ohada')}</p>
                <button
                  onClick={() => { setSelCat('comptabilite-ohada'); setScreen('level') }}
                  className="px-4 py-2 rounded-xl bg-white text-sm font-bold transition-all hover:bg-white/90"
                  style={{ color: GD }}>
                  Commencer ce cours →
                </button>
              </div>

              {/* Recherche */}
              <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un domaine (fiscalité, RH, restaurant…)"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              {/* Grille des formations */}
              <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">
                {search ? `${filteredCats.length} résultat(s) pour "${search}"` : `${ACADEMY_CATS.length} domaines disponibles`}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredCats.map((cat, i) => (
                  <motion.button
                    key={cat.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    onClick={() => { setSelCat(cat.id); setScreen('category') }}
                    className="flex items-start gap-3 p-4 rounded-2xl border-2 border-[#E2E8F0] bg-white text-left transition-all hover:shadow-md hover:-translate-y-0.5 group"
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = cat.color }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0' }}>
                    <span className="text-3xl leading-none shrink-0 mt-0.5">{cat.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0F172A] leading-tight mb-1">{cat.label}</p>
                      <p className="text-xs text-[#64748B] leading-relaxed line-clamp-2">{cat.desc}</p>
                      <p className="text-[10px] font-medium mt-2" style={{ color: cat.color }}>
                        Sujet du jour : {todayTopic(cat.id).slice(0, 40)}{todayTopic(cat.id).length > 40 ? '…' : ''}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════ CATEGORY ═══════════════════════ */}
          {screen === 'category' && catInfo && (
            <motion.div key="category" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {/* Hero */}
              <div className="rounded-2xl p-6 mb-6 text-white" style={{ background: `linear-gradient(135deg, ${catInfo.color} 0%, ${catInfo.color}CC 100%)` }}>
                <span className="text-5xl">{catInfo.icon}</span>
                <h1 className="text-xl font-bold mt-3 mb-1">{catInfo.label}</h1>
                <p className="text-white/80 text-sm">{catInfo.desc}</p>
              </div>

              {/* Sujets de la semaine */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 mb-4">
                <p className="text-sm font-bold text-[#0F172A] mb-3">📅 Programme de la semaine</p>
                <div className="space-y-2">
                  {(DAILY_TOPICS[selCat] ?? DAILY_TOPICS.default).map((topic, i) => {
                    const days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
                    const isToday = i === todayIdx % 7
                    return (
                      <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl text-sm ${isToday ? 'font-bold border-2' : 'border border-[#F1F5F9]'}`}
                        style={isToday ? { borderColor: catInfo.color, background: `${catInfo.color}10`, color: catInfo.color } : { color: '#64748B' }}>
                        <span className="text-xs font-medium w-20 shrink-0">{days[i % 7]}</span>
                        <span className="truncate text-xs">{topic}</span>
                        {isToday && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white shrink-0" style={{ background: catInfo.color }}>AUJOURD&apos;HUI</span>}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Certificats obtenus dans cette catégorie */}
              {certs.filter(c => c.categorie === selCat).length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 mb-4">
                  <p className="text-sm font-bold text-[#0F172A] mb-2">🏆 Certificats obtenus</p>
                  {certs.filter(c => c.categorie === selCat).map((cert, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-[#64748B]">
                      <Award size={13} style={{ color: GC }} />
                      <span>{cert.niveau} — {cert.pourcentage}% — {new Date(cert.delivre_le).toLocaleDateString('fr-FR')}</span>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => setScreen('level')}
                className="w-full py-3.5 rounded-2xl text-white font-bold text-sm transition-all hover:opacity-90"
                style={{ background: `linear-gradient(135deg, ${catInfo.color} 0%, ${catInfo.color}CC 100%)` }}>
                Commencer la formation →
              </button>
            </motion.div>
          )}

          {/* ════════════════════════════════ LEVEL ════════════════════════ */}
          {screen === 'level' && catInfo && (
            <motion.div key="level" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="mb-6">
                <p className="text-xs text-[#64748B] mb-1">{catInfo.icon} {catInfo.label}</p>
                <h2 className="text-xl font-bold text-[#0F172A]">Choisissez votre niveau</h2>
                <p className="text-sm text-[#64748B] mt-1">Le cours s&apos;adapte automatiquement à votre niveau.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {LEVELS.map(lvl => (
                  <button key={lvl.id} onClick={() => setSelLevel(lvl.id)}
                    className="flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all"
                    style={selLevel === lvl.id ? { borderColor: lvl.color, background: `${lvl.color}10` } : { borderColor: '#E2E8F0', background: 'white' }}>
                    <span className="text-3xl">{lvl.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-[#0F172A]">{lvl.label}</p>
                      <p className="text-xs text-[#64748B]">{lvl.desc}</p>
                    </div>
                    {selLevel === lvl.id && <CheckCircle2 size={18} className="ml-auto" style={{ color: lvl.color }} />}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={startLearning}
                  className="py-3.5 rounded-2xl text-white font-bold text-sm"
                  style={{ background: GGR }}>
                  <BookOpen size={15} className="inline mr-2" />
                  Commencer le cours
                </button>
                <button onClick={startQuiz}
                  className="py-3.5 rounded-2xl font-bold text-sm border-2 transition-all"
                  style={{ borderColor: GC, color: GC, background: GL }}>
                  <Trophy size={15} className="inline mr-2" />
                  Passer le quiz
                </button>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════ LEARNING ═══════════════════════ */}
          {screen === 'learning' && (
            <motion.div key="learning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col" style={{ height: 'calc(100vh - 140px)' }}>
              {/* Actions bar */}
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{catInfo?.icon}</span>
                  <div>
                    <p className="text-sm font-bold text-[#0F172A]">{catInfo?.label}</p>
                    <p className="text-xs text-[#64748B]">{levelInfo?.label} {levelInfo?.icon}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {messages.some(m => m.role === 'assistant' && m.content.length > 100) && (
                    <>
                      <button
                        onClick={() => exportCoursAsPDF(messages.filter(m => m.role === 'assistant').map(m => m.content).join('\n\n'), catInfo?.label ?? '')}
                        title="Télécharger PDF"
                        className="p-2 rounded-xl border border-[#E2E8F0] hover:border-[#DC2626] transition-colors">
                        <FileType2 size={14} style={{ color: '#DC2626' }} />
                      </button>
                      <button
                        onClick={() => exportCoursAsDOCX(messages.filter(m => m.role === 'assistant').map(m => m.content).join('\n\n'), catInfo?.label ?? '')}
                        title="Télécharger DOCX"
                        className="p-2 rounded-xl border border-[#E2E8F0] hover:border-[#2563EB] transition-colors">
                        <FileText size={14} style={{ color: GC }} />
                      </button>
                    </>
                  )}
                  <button onClick={startQuiz}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-medium"
                    style={{ background: GGR }}>
                    <Trophy size={13} /> Quiz
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-4">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2 mt-1" style={{ background: GGR }}>
                        <GraduationCap size={13} className="text-white" />
                      </div>
                    )}
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'text-white rounded-br-sm'
                        : 'text-[#0F172A] rounded-bl-sm bg-[#F8FAFC] border border-[#E2E8F0]'
                    }`} style={m.role === 'user' ? { background: GC } : {}}>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                      <p className="text-[10px] opacity-50 mt-1">{m.timestamp}</p>
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex items-end gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: GGR }}>
                      <GraduationCap size={13} className="text-white" />
                    </div>
                    <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-bl-sm bg-[#F8FAFC] border border-[#E2E8F0]">
                      {[0,1,2].map(i => (
                        <motion.span key={i} className="w-2 h-2 rounded-full" style={{ background: GC }}
                          animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22 }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={chatBottom} />
              </div>

              {/* Input */}
              <div className="shrink-0 mt-3">
                <div className="flex gap-2">
                  <input
                    value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
                    placeholder="Posez une question au formateur…"
                    className="flex-1 rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm focus:outline-none focus:border-[#2563EB] bg-white"
                  />
                  <button onClick={sendMessage} disabled={!input.trim() || sending}
                    className="px-4 rounded-xl text-white transition-all disabled:opacity-40"
                    style={{ background: GC }}>
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
                <p className="text-[10px] text-center text-[#94A3B8] mt-1.5" style={{ color: GD }}>
                  MIAA+ enseigne en mode formateur expert certifié
                </p>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════ QUIZ ═════════════════════════ */}
          {screen === 'quiz' && !quizDone && (
            <motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-[#0F172A]">Quiz — {catInfo?.label}</p>
                  <span className="text-sm font-bold" style={{ color: GC }}>{quizIdx + 1} / {quizQuestions.length}</span>
                </div>
                <div className="h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                  <motion.div className="h-full rounded-full" style={{ background: GGR }}
                    animate={{ width: `${((quizIdx + 1) / quizQuestions.length) * 100}%` }}
                    transition={{ duration: 0.4 }} />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
                <p className="text-base font-semibold text-[#0F172A] leading-snug mb-5">{quizQuestions[quizIdx].q}</p>
                <div className="space-y-3">
                  {quizQuestions[quizIdx].opts.map((opt, i) => {
                    const correct  = quizQuestions[quizIdx].ans === i
                    const selected = quizSel === i
                    const show     = quizSel !== null
                    return (
                      <button key={i} onClick={() => answerQuiz(i)} disabled={quizSel !== null}
                        className="w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left text-sm font-medium transition-all"
                        style={{
                          borderColor: show ? (correct ? GC : selected ? '#DC2626' : '#E2E8F0') : '#E2E8F0',
                          background:  show ? (correct ? GL : selected ? '#FEF2F2' : 'white') : 'white',
                          color: '#0F172A',
                        }}>
                        <span className="w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold"
                          style={{ borderColor: show && correct ? GC : show && selected ? '#DC2626' : '#E2E8F0' }}>
                          {show && correct ? '✓' : show && selected && !correct ? '✗' : String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════ RESULT ═════════════════════════ */}
          {screen === 'result' && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-lg mx-auto">
              {/* Score */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 text-center mb-4">
                {quizScore >= Math.ceil(quizQuestions.length * 0.8) ? (
                  <>
                    <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: GGR }}>
                      <Award size={36} className="text-white" />
                    </div>
                    <p className="text-2xl font-bold text-[#0F172A]">Félicitations !</p>
                    <p className="text-[#64748B] mt-1">{quizScore}/{quizQuestions.length} bonnes réponses</p>
                    <p className="text-3xl font-bold mt-2" style={{ color: GC }}>{Math.round((quizScore / quizQuestions.length) * 100)}%</p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 bg-amber-100">
                      <RotateCcw size={36} className="text-amber-600" />
                    </div>
                    <p className="text-2xl font-bold text-[#0F172A]">Continue tes efforts !</p>
                    <p className="text-[#64748B] mt-1">{quizScore}/{quizQuestions.length} bonnes réponses</p>
                    <p className="text-xl font-bold mt-2 text-amber-500">{Math.round((quizScore / quizQuestions.length) * 100)}%</p>
                  </>
                )}
              </div>

              {/* Certificat */}
              {quizScore >= Math.ceil(quizQuestions.length * 0.8) && (
                <div className="rounded-2xl border-2 p-5 mb-4" style={{ borderColor: GC, background: GL }}>
                  <div className="flex justify-center gap-1 mb-2">
                    {[...Array(quizScore)].map((_, i) => <Star key={i} size={16} className="fill-amber-400 text-amber-400" />)}
                    {[...Array(quizQuestions.length - quizScore)].map((_, i) => <Star key={i} size={16} className="text-gray-300" />)}
                  </div>
                  <p className="text-[11px] uppercase tracking-widest font-bold text-center mb-2" style={{ color: GD }}>Certificat d&apos;Accomplissement</p>
                  <p className="text-base font-bold text-[#0F172A] text-center">{catInfo?.label}</p>
                  <p className="text-xs text-[#64748B] text-center">Niveau : {levelInfo?.label} — {Math.round((quizScore / quizQuestions.length) * 100)}%</p>
                  <div className="flex items-center justify-center gap-1 mt-2" style={{ color: GC }}>
                    <CheckCircle2 size={14} />
                    <span className="text-xs font-bold">Délivré par MIAA+ Academy · {new Date().toLocaleDateString('fr-FR')}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => exportCoursAsPDF(`CERTIFICAT D'ACCOMPLISSEMENT\n\nDomaine : ${catInfo?.label}\nNiveau : ${levelInfo?.label}\nScore : ${quizScore}/${quizQuestions.length} (${Math.round((quizScore / quizQuestions.length) * 100)}%)\nDélivré par MIAA+ Academy — Oraforme\nDate : ${new Date().toLocaleDateString('fr-FR')}`, `Certificat_${catInfo?.label ?? ''}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border-2 transition-all"
                      style={{ borderColor: '#DC2626', color: '#DC2626' }}>
                      <FileType2 size={13} /> PDF
                    </button>
                    <button
                      onClick={() => exportCoursAsDOCX(`CERTIFICAT D'ACCOMPLISSEMENT\n\nDomaine : ${catInfo?.label}\nNiveau : ${levelInfo?.label}\nScore : ${quizScore}/${quizQuestions.length} (${Math.round((quizScore / quizQuestions.length) * 100)}%)\nDélivré par MIAA+ Academy — Oraforme\nDate : ${new Date().toLocaleDateString('fr-FR')}`, `Certificat_${catInfo?.label ?? ''}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border-2 transition-all"
                      style={{ borderColor: GC, color: GC }}>
                      <FileText size={13} /> DOC
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2">
                <button onClick={() => setScreen('learning')}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white font-bold text-sm"
                  style={{ background: GGR }}>
                  <BookOpen size={15} /> Continuer la formation
                </button>
                <button onClick={startQuiz}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-medium text-sm border-2 transition-all"
                  style={{ borderColor: GC, color: GC, background: GL }}>
                  <RotateCcw size={15} /> Refaire le quiz
                </button>
                <button onClick={() => { setScreen('home'); setSelCat(''); setMessages([]) }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm border border-[#E2E8F0] text-[#64748B]">
                  Choisir une autre formation
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════ CERTIFICATES ══════════════════════ */}
          {screen === 'certificates' && (
            <motion.div key="certificates" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-[#0F172A]">Mes Certificats</h2>
                <p className="text-sm text-[#64748B] mt-1">{certs.length} certificat(s) obtenus</p>
              </div>

              {certs.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-[#E2E8F0]">
                  <Award size={40} className="mx-auto mb-3 text-[#CBD5E1]" />
                  <p className="text-sm font-medium text-[#64748B]">Aucun certificat pour l&apos;instant</p>
                  <p className="text-xs text-[#94A3B8] mt-1">Complétez un quiz avec 80%+ pour obtenir un certificat</p>
                  <button onClick={() => setScreen('home')}
                    className="mt-4 px-5 py-2.5 rounded-xl text-white text-sm font-medium"
                    style={{ background: GGR }}>
                    Commencer une formation
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {certs.map((cert, i) => {
                    const catData = ACADEMY_CATS.find(c => c.id === cert.categorie)
                    return (
                      <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        className="bg-white rounded-2xl border-2 p-5" style={{ borderColor: catData?.color ?? GC }}>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-3xl">{catData?.icon ?? '🎓'}</span>
                          <div>
                            <p className="text-sm font-bold text-[#0F172A]">{catData?.label ?? cert.categorie}</p>
                            <p className="text-xs text-[#64748B]">{cert.niveau} — {cert.pourcentage}%</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mb-3">
                          {[...Array(5)].map((_, j) => (
                            <Star key={j} size={14} className={j < Math.round((cert.pourcentage / 100) * 5) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                          ))}
                        </div>
                        <p className="text-[10px] text-[#94A3B8] mb-3">
                          Délivré le {new Date(cert.delivre_le).toLocaleDateString('fr-FR')} · MIAA+ Academy
                        </p>
                        <button
                          onClick={() => exportCoursAsPDF(`CERTIFICAT D'ACCOMPLISSEMENT\n\nDomaine : ${catData?.label}\nNiveau : ${cert.niveau}\nScore : ${cert.pourcentage}%\nDélivré par MIAA+ Academy — Oraforme\nDate : ${new Date(cert.delivre_le).toLocaleDateString('fr-FR')}`, `Certificat_${catData?.label ?? cert.categorie}`)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition-all"
                          style={{ borderColor: catData?.color ?? GC, color: catData?.color ?? GC }}>
                          <Download size={12} /> Télécharger le certificat
                        </button>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
