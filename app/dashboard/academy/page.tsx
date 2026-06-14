'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GraduationCap, BookOpen, Award, RotateCcw, ChevronLeft,
  Send, Loader2, CheckCircle2, Trophy, Sparkles, Download,
  Search, Star, TrendingUp, Clock, Users,
  FileText, FileSpreadsheet, FileType2, Zap, Target, Medal,
  ChevronRight, Play, Lock, CheckSquare,
} from 'lucide-react'
import { useTenant } from '@/lib/hooks/useTenant'
import { usePlanFeature } from '@/lib/hooks/usePlanFeature'

// ── Palette ───────────────────────────────────────────────────────────────────
const GC  = '#2563EB'
const GD  = '#1D4ED8'
const GL  = '#EFF6FF'
const GGR = 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)'

// ── Types ─────────────────────────────────────────────────────────────────────
type Level   = 'debutant' | 'intermediaire' | 'avance' | 'expert'
type Screen  = 'home' | 'category' | 'level' | 'learning' | 'lesson' | 'quiz' | 'result' | 'certificates' | 'badges' | 'parcours'
interface ChatMsg  { role: 'user' | 'assistant'; content: string; timestamp: string }
interface QuizQ    { id?: string; q: string; question?: string; opts?: string[]; options?: string[]; ans?: number; answer_idx?: number; explication?: string }
interface Lesson   { id: string; titre: string; objectifs: string[]; content_md: string; duree_min: number; sequence: number; tags: string[] }
interface Badge    { id: string; code: string; nom: string; description: string; icone: string; couleur: string; earned: boolean; obtenu_le: string | null }
interface Parcours { id: string; code: string; titre: string; description: string; metier: string; icone: string; couleur: string; domaines: string[]; duree_totale_h: number; niveau_min: string; enrolled: boolean; progression: number; statut: string | null }

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

// Hardcoded quiz fallback (used when DB has no questions)
const QUIZ_FALLBACK: Record<string, QuizQ[]> = {
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
    { q: 'NIU = ?', opts: ["N° Interne Unique","N° d'Identification Unique","N° Informatique Unifié","N° Indirect Usuel"], ans: 1 },
    { q: 'DGI = ?', opts: ['Direction Générale des Impôts','Déclaration Générale des Investissements','Direction Gestion Interne','Division des Gains Imposables'], ans: 0 },
    { q: 'Délai conservation documents fiscaux :', opts: ['3 ans','5 ans','10 ans','15 ans'], ans: 2 },
  ],
  'rh-paie': [
    { q: 'CNSS salarié Congo :', opts: ['4%','4,5%','5,04%','6%'], ans: 2 },
    { q: 'Plafond CNSS Congo :', opts: ['1 000 000','1 500 000','2 000 000','3 000 000'], ans: 1 },
    { q: 'CNSS patronal Congo :', opts: ['10%','12%','14,36%','16%'], ans: 2 },
    { q: 'Préavis cadre Congo :', opts: ['15 jours','1 mois','3 mois','6 mois'], ans: 2 },
    { q: 'NET = Brut − CNSS salarié − ?', opts: ['CNSS patronal','IRPP','IS','CA'], ans: 1 },
  ],
  default: [
    { q: 'OHADA signifie :', opts: ["Organisation pour l'Harmonisation en Afrique du Droit des Affaires","Office des Affaires Dominicales en Afrique","Organisation des Hommes d'Affaires","Ordre des Hommes d'Affaires d'Afrique"], ans: 0 },
    { q: 'Combien de pays membres OHADA ?', opts: ['12','14','17','20'], ans: 2 },
    { q: 'SYSCOHADA est :', opts: ['Un logiciel','Le Système Comptable OHADA','Un règlement bancaire','Une directive fiscale'], ans: 1 },
    { q: 'Capital minimum SARL Congo :', opts: ['50 000','100 000','500 000','1 000 000'], ans: 1 },
    { q: 'Durée d\'un exercice comptable OHADA :', opts: ['6 mois','9 mois','12 mois','18 mois'], ans: 2 },
  ],
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

// ── Markdown simple renderer ──────────────────────────────────────────────────
function MarkdownContent({ content }: { content: string }) {
  const html = content
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-[#0F172A] mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-[#1D4ED8] mt-5 mb-2 border-b border-[#E2E8F0] pb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-[#0F172A] mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-[#0F172A]">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="bg-[#F1F5F9] text-[#DC2626] px-1 py-0.5 rounded text-[13px] font-mono">$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-[#2563EB] pl-3 py-1 my-2 bg-[#EFF6FF] text-sm text-[#1D4ED8] rounded-r-lg">$1</blockquote>')
    .replace(/^```([\s\S]*?)```$/gm, (_: string, c: string) => `<pre class="bg-[#0F172A] text-[#E2E8F0] p-3 rounded-xl text-xs font-mono overflow-x-auto my-3 leading-relaxed">${c.trim()}</pre>`)
    .replace(/^\| (.+) \|$/gm, (line: string) => {
      const cells = line.split('|').filter(Boolean).map((c: string) => c.trim())
      return `<tr>${cells.map((c: string) => `<td class="border border-[#E2E8F0] px-2 py-1.5 text-sm">${c}</td>`).join('')}</tr>`
    })
    .replace(/^- (.+)$/gm, '<li class="text-sm text-[#374151] ml-4 mb-1">• $1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="text-sm text-[#374151] ml-4 mb-1 list-decimal">$1</li>')
    .replace(/\n\n/g, '</p><p class="mb-2">')

  return (
    <div
      className="prose prose-sm max-w-none text-[#374151] leading-relaxed"
      dangerouslySetInnerHTML={{ __html: `<p class="mb-2">${html}</p>` }}
    />
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
  const lines = doc.splitTextToSize(content.replace(/[#*`>]/g, ''), 180)
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
  const { allowed: canAcademyPremium } = usePlanFeature('academy-premium')

  const [screen,      setScreen]      = useState<Screen>('home')
  const [search,      setSearch]      = useState('')
  const [selCat,      setSelCat]      = useState('')
  const [selLevel,    setSelLevel]    = useState<Level>('debutant')
  const [activeTab,   setActiveTab]   = useState<'cours' | 'parcours'>('cours')

  // Chat formateur
  const [messages,  setMessages]  = useState<ChatMsg[]>([])
  const [input,     setInput]     = useState('')
  const [sending,   setSending]   = useState(false)
  const chatBottom = useRef<HTMLDivElement>(null)

  // Lesson reader
  const [lessons,      setLessons]      = useState<Lesson[]>([])
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null)
  const [lessonsLoading, setLessonsLoading] = useState(false)

  // Quiz
  const [quizQuestions, setQuizQuestions] = useState<QuizQ[]>([])
  const [quizIdx,      setQuizIdx]      = useState(0)
  const [quizSel,      setQuizSel]      = useState<number | null>(null)
  const [quizScore,    setQuizScore]    = useState(0)
  const [quizDone,     setQuizDone]     = useState(false)
  const [quizMode,     setQuizMode]     = useState<'quiz' | 'exam'>('quiz')
  const [quizFromDb,   setQuizFromDb]   = useState(false)

  // Progression / stats
  const [stats, setStats]       = useState({ total_cours: 0, total_quiz: 0, taux_reussite: 0, nb_certificats: 0, categories_vues: 0 })
  const [certs, setCerts]       = useState<{ categorie: string; niveau: string; pourcentage: number; delivre_le: string }[]>([])
  const [badges, setBadges]     = useState<Badge[]>([])
  const [parcours, setParcours] = useState<Parcours[]>([])
  const [statsLoaded, setStatsLoaded] = useState(false)

  useEffect(() => { chatBottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Charger les données ─────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    if (!tenantId || statsLoaded) return
    try {
      const [statsRes, badgesRes, parcoursRes] = await Promise.all([
        fetch(`/api/miaa/academy?tenant_id=${tenantId}`),
        fetch(`/api/miaa/academy/badges?tenant_id=${tenantId}`),
        fetch(`/api/miaa/academy/parcours?tenant_id=${tenantId}`),
      ])
      const [statsData, badgesData, parcoursData] = await Promise.all([
        statsRes.json(), badgesRes.json(), parcoursRes.json(),
      ])
      setStats(statsData.stats ?? stats)
      setCerts(statsData.certificates ?? [])
      setBadges(badgesData.badges ?? [])
      setParcours(parcoursData.parcours ?? [])
      setStatsLoaded(true)
    } catch { /* silencieux */ }
  }, [tenantId, statsLoaded, stats])

  useEffect(() => { loadStats() }, [loadStats])

  // ── Charger les leçons ──────────────────────────────────────────────────────
  const loadLessons = useCallback(async (domaine: string, niveau: string) => {
    setLessonsLoading(true)
    try {
      const res  = await fetch(`/api/miaa/academy/lessons?domaine=${domaine}&niveau=${niveau}`)
      const data = await res.json()
      setLessons(data.lessons ?? [])
    } catch { setLessons([]) }
    finally   { setLessonsLoading(false) }
  }, [])

  // ── Charger les questions quiz depuis la DB ─────────────────────────────────
  const loadQuizQuestions = useCallback(async (domaine: string, niveau: string, count: number, mode: 'quiz' | 'exam') => {
    try {
      const res  = await fetch(`/api/miaa/academy/quiz?domaine=${domaine}&niveau=${niveau}&count=${count}&mode=${mode}`)
      const data = await res.json()
      if (data.from_db && data.questions?.length) {
        // Normaliser format DB → format unifié
        const normalized: QuizQ[] = data.questions.map((q: { id: string; question: string; options: string[]; answer_idx: number; explication?: string }) => ({
          id: q.id, q: q.question, opts: q.options, ans: q.answer_idx, explication: q.explication,
        }))
        setQuizQuestions(normalized)
        setQuizFromDb(true)
        return true
      }
    } catch { /* fallback */ }
    // Fallback sur questions codées en dur
    const fallback = QUIZ_FALLBACK[domaine] ?? QUIZ_FALLBACK.default
    setQuizQuestions(fallback.slice(0, count))
    setQuizFromDb(false)
    return false
  }, [])

  // ── Démarrer une formation ──────────────────────────────────────────────────
  const startLearning = async () => {
    const cat = ACADEMY_CATS.find(c => c.id === selCat)
    const lvl = LEVELS.find(l => l.id === selLevel)
    setMessages([{
      role: 'assistant',
      content: `Bienvenue ! Je suis votre formateur MIAA+ Academy.\n\nDomaine : ${cat?.label}\nVotre niveau : ${lvl?.label} ${lvl?.icon}\n\nJe vais vous enseigner ce sujet avec des exemples concrets adaptés au contexte Congo-Brazzaville / OHADA / CEMAC.\n\nTapez "Commence la leçon" pour démarrer, ou posez directement une question !`,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    }])
    setScreen('learning')
    if (tenantId) {
      await fetch('/api/miaa/academy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_progress', tenant_id: tenantId, categorie: selCat, niveau: selLevel }),
      }).catch(() => {})
      // Vérifier badges
      fetch('/api/miaa/academy/badges', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, event: 'cours', domaine: selCat }),
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
          message: `MODE FORMATEUR ACADEMY. Catégorie : ${cat?.label}. Niveau : ${lvl?.label} (${lvl?.desc}). Adapte le niveau de complexité à ${lvl?.id === 'debutant' ? 'un débutant — explications simples, beaucoup d\'exemples concrets' : lvl?.id === 'intermediaire' ? 'un intermédiaire — concepts techniques, cas pratiques' : lvl?.id === 'avance' ? 'un professionnel avancé — techniques expertes, cas complexes' : 'un expert — niveau master, nuances et edge cases'}. Contexte Congo/OHADA/CEMAC. Sois pédagogue, structuré, avec des tableaux et exemples chiffrés. Question : ${userMsg}`,
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

  // ── Quiz / Examen ────────────────────────────────────────────────────────────
  const startQuiz = async (mode: 'quiz' | 'exam' = 'quiz') => {
    const count = mode === 'exam' ? 10 : 5
    setQuizIdx(0); setQuizScore(0); setQuizSel(null); setQuizDone(false); setQuizMode(mode)
    await loadQuizQuestions(selCat, selLevel, count, mode)
    setScreen('quiz')
  }

  const answerQuiz = (idx: number) => {
    if (quizSel !== null || !quizQuestions[quizIdx]) return
    setQuizSel(idx)
    const correct = (quizQuestions[quizIdx].ans ?? quizQuestions[quizIdx].answer_idx) === idx
    setTimeout(async () => {
      if (correct) setQuizScore(s => s + 1)
      if (quizIdx + 1 >= quizQuestions.length) {
        const finalScore = quizScore + (correct ? 1 : 0)
        setQuizDone(true)
        setScreen('result')
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
          if (quizFromDb) {
            await fetch('/api/miaa/academy/quiz', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tenant_id: tenantId, domaine: selCat, niveau: selLevel,
                score: finalScore, score_max: quizQuestions.length,
              }),
            }).catch(() => {})
          }
          fetch('/api/miaa/academy/badges', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenant_id: tenantId, event: 'quiz', domaine: selCat,
              score: finalScore, score_max: quizQuestions.length,
            }),
          }).catch(() => {})
          setStatsLoaded(false)
        }
      } else {
        setQuizIdx(q => q + 1); setQuizSel(null)
      }
    }, 900)
  }

  // ── Navigation catégorie ───────────────────────────────────────────────────
  const openCategory = async (catId: string) => {
    setSelCat(catId)
    setLessons([])
    setCurrentLesson(null)
    setScreen('category')
    await loadLessons(catId, selLevel)
  }

  // ── Filtrage ─────────────────────────────────────────────────────────────────
  const filteredCats = search.trim()
    ? ACADEMY_CATS.filter(c => c.label.toLowerCase().includes(search.toLowerCase()) || c.desc.toLowerCase().includes(search.toLowerCase()))
    : ACADEMY_CATS

  const catInfo   = ACADEMY_CATS.find(c => c.id === selCat)
  const levelInfo = LEVELS.find(l => l.id === selLevel)
  const earnedBadges = badges.filter(b => b.earned)

  // ── Rendu ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-[#E2E8F0] px-4 sm:px-6 py-4" style={{ background: 'white' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {(screen !== 'home' && screen !== 'certificates' && screen !== 'badges' && screen !== 'parcours') && (
              <button onClick={() => {
                if (screen === 'lesson')   setScreen('category')
                else if (screen === 'learning' || screen === 'quiz') setScreen('level')
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
                <p className="text-base font-bold text-[#0F172A]">MIAA+ Academy Pro</p>
                <p className="text-xs text-[#64748B]">
                  {screen === 'home'         ? 'Votre université intelligente'
                    : screen === 'certificates' ? 'Mes certificats'
                    : screen === 'badges'       ? 'Mes badges'
                    : screen === 'parcours'     ? 'Parcours métiers'
                    : screen === 'lesson'       ? `Leçon — ${catInfo?.label}`
                    : screen === 'category'   ? catInfo?.label
                    : screen === 'level'      ? `Sélection niveau — ${catInfo?.label}`
                    : screen === 'learning'   ? `Cours — ${catInfo?.label} · ${levelInfo?.label}`
                    : screen === 'quiz'       ? `${quizMode === 'exam' ? 'Examen' : 'Quiz'} — ${catInfo?.label}`
                    : `Résultat — ${catInfo?.label}`}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => { setScreen('badges'); loadStats() }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm font-medium text-[#64748B] hover:text-[#0F172A] transition-all">
              <Medal size={15} style={{ color: '#F59E0B' }} />
              <span className="hidden sm:inline">Badges</span>
              {earnedBadges.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: '#F59E0B' }}>{earnedBadges.length}</span>
              )}
            </button>
            <button onClick={() => { setScreen('certificates'); loadStats() }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm font-medium text-[#64748B] hover:text-[#0F172A] transition-all">
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
                <StatCard icon={<BookOpen size={18} />} value={stats.total_cours}      label="Cours suivis"     color={GC} />
                <StatCard icon={<Trophy size={18} />}   value={`${stats.taux_reussite}%`} label="Taux réussite" color="#16A34A" />
                <StatCard icon={<Award size={18} />}    value={stats.nb_certificats}    label="Certificats"      color="#F59E0B" />
                <StatCard icon={<Medal size={18} />}    value={earnedBadges.length}     label="Badges gagnés"    color="#7C3AED" />
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-5 border-b border-[#E2E8F0]">
                {(['cours', 'parcours'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`pb-2 px-1 text-sm font-semibold capitalize transition-colors ${activeTab === tab ? 'border-b-2 text-[#2563EB]' : 'text-[#64748B]'}`}
                    style={activeTab === tab ? { borderBottomColor: GC } : {}}>
                    {tab === 'cours' ? '📚 Formations' : '🎯 Parcours Métiers'}
                  </button>
                ))}
              </div>

              {activeTab === 'parcours' && (
                <div className="space-y-3 mb-6">
                  {parcours.length === 0 ? (
                    <div className="text-center py-8 bg-white rounded-2xl border border-[#E2E8F0]">
                      <Target size={32} className="mx-auto mb-2 text-[#CBD5E1]" />
                      <p className="text-sm text-[#64748B]">Chargement des parcours…</p>
                    </div>
                  ) : parcours.map(p => (
                    <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-2xl border-2 border-[#E2E8F0] p-4 hover:border-[#2563EB] transition-all cursor-pointer"
                      onClick={async () => {
                        if (!p.enrolled && tenantId) {
                          await fetch('/api/miaa/academy/parcours', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'enroll', tenant_id: tenantId, parcours_id: p.id }),
                          })
                          setStatsLoaded(false)
                        }
                        openCategory(p.domaines[0])
                      }}>
                      <div className="flex items-start gap-4">
                        <span className="text-3xl">{p.icone}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-bold text-[#0F172A]">{p.titre}</p>
                            {p.enrolled && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: p.couleur }}>
                                {p.statut === 'termine' ? '✅ Terminé' : `${p.progression}%`}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#64748B] mb-2">{p.description}</p>
                          <div className="flex items-center gap-3 text-[10px] text-[#94A3B8]">
                            <span><Clock size={10} className="inline mr-0.5" />{p.duree_totale_h}h</span>
                            <span><BookOpen size={10} className="inline mr-0.5" />{p.domaines.length} domaines</span>
                            <span className="capitalize">{p.niveau_min}</span>
                          </div>
                          {p.enrolled && p.progression > 0 && (
                            <div className="mt-2 h-1.5 rounded-full bg-[#F1F5F9]">
                              <div className="h-full rounded-full transition-all" style={{ width: `${p.progression}%`, background: p.couleur }} />
                            </div>
                          )}
                        </div>
                        <ChevronRight size={16} className="text-[#CBD5E1] shrink-0 mt-1" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {activeTab === 'cours' && (
                <>
                  {/* Hero cours du jour */}
                  <div className="mb-5 p-4 rounded-2xl text-white" style={{ background: GGR }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={16} />
                      <p className="text-sm font-bold">Cours recommandé du jour</p>
                    </div>
                    <p className="text-xs text-white/80 mb-3">Comptabilité OHADA — SYSCOHADA Révisé 2017</p>
                    <button onClick={() => openCategory('comptabilite-ohada')}
                      className="px-4 py-2 rounded-xl bg-white text-sm font-bold" style={{ color: GD }}>
                      Commencer ce cours →
                    </button>
                  </div>

                  {/* Recherche */}
                  <div className="relative mb-4">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Rechercher un domaine (fiscalité, RH, restaurant…)"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm bg-white focus:outline-none focus:border-[#2563EB]" />
                  </div>

                  <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">
                    {search ? `${filteredCats.length} résultat(s)` : `${ACADEMY_CATS.length} domaines disponibles`}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredCats.map((cat, i) => {
                      const catCerts = certs.filter(c => c.categorie === cat.id)
                      return (
                        <motion.button key={cat.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}
                          onClick={() => openCategory(cat.id)}
                          className="flex items-start gap-3 p-4 rounded-2xl border-2 border-[#E2E8F0] bg-white text-left transition-all hover:shadow-md hover:-translate-y-0.5"
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = cat.color }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0' }}>
                          <span className="text-3xl leading-none shrink-0 mt-0.5">{cat.icon}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#0F172A] leading-tight mb-1">{cat.label}</p>
                            <p className="text-xs text-[#64748B] leading-relaxed line-clamp-2">{cat.desc}</p>
                            {catCerts.length > 0 && (
                              <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold" style={{ color: cat.color }}>
                                <Award size={10} /> {catCerts.length} certificat(s)
                              </span>
                            )}
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ══════════════════════════════ CATEGORY ═══════════════════════ */}
          {screen === 'category' && catInfo && (
            <motion.div key="category" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {/* Hero */}
              <div className="rounded-2xl p-6 mb-5 text-white" style={{ background: `linear-gradient(135deg, ${catInfo.color} 0%, ${catInfo.color}CC 100%)` }}>
                <span className="text-5xl">{catInfo.icon}</span>
                <h1 className="text-xl font-bold mt-3 mb-1">{catInfo.label}</h1>
                <p className="text-white/80 text-sm">{catInfo.desc}</p>
              </div>

              {/* Leçons disponibles */}
              {lessonsLoading ? (
                <div className="flex items-center gap-2 py-4 text-[#64748B] text-sm">
                  <Loader2 size={16} className="animate-spin" />
                  Chargement des leçons…
                </div>
              ) : lessons.length > 0 ? (
                <div className="mb-5">
                  <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">
                    📖 {lessons.length} leçon(s) disponible(s)
                  </p>
                  <div className="space-y-2">
                    {lessons.map((lesson, i) => (
                      <button key={lesson.id} onClick={() => { setCurrentLesson(lesson); setScreen('lesson') }}
                        className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-[#E2E8F0] bg-white text-left hover:border-[#2563EB] transition-all group">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold text-white" style={{ background: catInfo.color }}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">{lesson.titre}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-[#94A3B8]"><Clock size={10} className="inline mr-0.5" />{lesson.duree_min} min</span>
                            {lesson.objectifs?.length > 0 && (
                              <span className="text-xs text-[#94A3B8]">• {lesson.objectifs.length} objectif(s)</span>
                            )}
                          </div>
                        </div>
                        <Play size={14} className="text-[#CBD5E1] group-hover:text-[#2563EB] transition-colors shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
                  Les leçons structurées pour ce niveau sont en cours de préparation. Utilisez le formateur IA pour apprendre ce sujet.
                </div>
              )}

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
                Choisir mon niveau et commencer →
              </button>
            </motion.div>
          )}

          {/* ═══════════════════════════════════ LESSON ════════════════════ */}
          {screen === 'lesson' && currentLesson && (
            <motion.div key="lesson" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Infos leçon */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 mb-4">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg" style={{ background: `${catInfo?.color}20` }}>
                    {catInfo?.icon}
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-[#0F172A]">{currentLesson.titre}</h1>
                    <p className="text-xs text-[#64748B] mt-0.5"><Clock size={10} className="inline mr-1" />{currentLesson.duree_min} min</p>
                  </div>
                </div>
                {currentLesson.objectifs?.length > 0 && (
                  <div className="bg-[#F8FAFC] rounded-xl p-3 mb-4">
                    <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Objectifs de la leçon</p>
                    <ul className="space-y-1">
                      {currentLesson.objectifs.map((obj, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-[#374151]">
                          <CheckSquare size={12} className="mt-0.5 shrink-0" style={{ color: catInfo?.color }} />
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="prose-lesson border-t border-[#F1F5F9] pt-4">
                  <MarkdownContent content={currentLesson.content_md} />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setScreen('learning'); startLearning() }}
                  className="flex-1 py-3 rounded-xl text-white text-sm font-medium" style={{ background: GGR }}>
                  <BookOpen size={14} className="inline mr-2" />
                  Poser des questions au formateur
                </button>
                <button onClick={() => startQuiz('quiz')}
                  className="px-4 py-3 rounded-xl text-sm font-medium border-2" style={{ borderColor: GC, color: GC, background: GL }}>
                  <Trophy size={14} className="inline mr-1" />
                  Quiz
                </button>
                <button onClick={() => exportCoursAsPDF(currentLesson.content_md, currentLesson.titre)}
                  className="px-3 py-3 rounded-xl border border-[#E2E8F0]" title="Télécharger PDF">
                  <Download size={14} className="text-[#64748B]" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════ LEVEL ════════════════════════ */}
          {screen === 'level' && catInfo && (
            <motion.div key="level" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="mb-6">
                <p className="text-xs text-[#64748B] mb-1">{catInfo.icon} {catInfo.label}</p>
                <h2 className="text-xl font-bold text-[#0F172A]">Choisissez votre niveau</h2>
                <p className="text-sm text-[#64748B] mt-1">Le cours et les questions s&apos;adaptent à votre niveau.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {LEVELS.map(lvl => {
                  const locked = lvl.id === 'expert' && !canAcademyPremium
                  return (
                    <button key={lvl.id}
                      onClick={() => {
                        if (!locked) {
                          setSelLevel(lvl.id)
                          loadLessons(selCat, lvl.id)
                        }
                      }}
                      disabled={locked}
                      className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}
                      style={selLevel === lvl.id && !locked ? { borderColor: lvl.color, background: `${lvl.color}10` } : { borderColor: '#E2E8F0', background: 'white' }}>
                      <span className="text-3xl">{locked ? '🔒' : lvl.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-[#0F172A]">{lvl.label}</p>
                          {locked && <span className="text-[10px] font-semibold text-[#F59E0B] bg-[#FEF3C7] px-1.5 py-0.5 rounded-full">Business</span>}
                        </div>
                        <p className="text-xs text-[#64748B]">{lvl.desc}</p>
                      </div>
                      {selLevel === lvl.id && !locked && <CheckCircle2 size={18} style={{ color: lvl.color }} />}
                    </button>
                  )
                })}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={startLearning}
                  className="py-3.5 rounded-2xl text-white font-bold text-sm" style={{ background: GGR }}>
                  <BookOpen size={15} className="inline mr-2" />
                  Formateur
                </button>
                <button onClick={() => startQuiz('quiz')}
                  className="py-3.5 rounded-2xl font-bold text-sm border-2 transition-all"
                  style={{ borderColor: GC, color: GC, background: GL }}>
                  <Trophy size={15} className="inline mr-2" />
                  Quiz (5 Q)
                </button>
                <button onClick={() => startQuiz('exam')}
                  className="py-3.5 rounded-2xl font-bold text-sm border-2 transition-all"
                  style={{ borderColor: '#7C3AED', color: '#7C3AED', background: '#F5F3FF' }}>
                  <Zap size={15} className="inline mr-2" />
                  Examen (10 Q)
                </button>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════ LEARNING ═══════════════════════ */}
          {screen === 'learning' && (
            <motion.div key="learning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col" style={{ height: 'calc(100vh - 140px)' }}>
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
                      <button onClick={() => exportCoursAsPDF(messages.filter(m => m.role === 'assistant').map(m => m.content).join('\n\n'), catInfo?.label ?? '')}
                        title="PDF" className="p-2 rounded-xl border border-[#E2E8F0] hover:border-[#DC2626] transition-colors">
                        <FileType2 size={14} style={{ color: '#DC2626' }} />
                      </button>
                      <button onClick={() => exportCoursAsDOCX(messages.filter(m => m.role === 'assistant').map(m => m.content).join('\n\n'), catInfo?.label ?? '')}
                        title="DOC" className="p-2 rounded-xl border border-[#E2E8F0] hover:border-[#2563EB] transition-colors">
                        <FileText size={14} style={{ color: GC }} />
                      </button>
                    </>
                  )}
                  <button onClick={() => startQuiz('quiz')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-medium" style={{ background: GGR }}>
                    <Trophy size={13} /> Quiz
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-4">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2 mt-1" style={{ background: GGR }}>
                        <GraduationCap size={13} className="text-white" />
                      </div>
                    )}
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      m.role === 'user' ? 'text-white rounded-br-sm' : 'text-[#0F172A] rounded-bl-sm bg-[#F8FAFC] border border-[#E2E8F0]'
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

              <div className="shrink-0 mt-3">
                <div className="flex gap-2">
                  <input value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
                    placeholder="Posez une question au formateur…"
                    className="flex-1 rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm focus:outline-none focus:border-[#2563EB] bg-white" />
                  <button onClick={sendMessage} disabled={!input.trim() || sending}
                    className="px-4 rounded-xl text-white transition-all disabled:opacity-40" style={{ background: GC }}>
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
                <p className="text-[10px] text-center mt-1.5" style={{ color: GD }}>
                  MIAA+ enseigne en mode formateur expert certifié — Niveau : {levelInfo?.label}
                </p>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════ QUIZ ═════════════════════════ */}
          {screen === 'quiz' && quizQuestions.length > 0 && !quizDone && (
            <motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-[#0F172A]">
                      {quizMode === 'exam' ? '📝 Examen' : '🏆 Quiz'} — {catInfo?.label}
                    </p>
                    <p className="text-xs text-[#94A3B8]">{quizFromDb ? 'Questions depuis la base de données' : 'Questions standards'}</p>
                  </div>
                  <span className="text-sm font-bold" style={{ color: GC }}>{quizIdx + 1} / {quizQuestions.length}</span>
                </div>
                <div className="h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                  <motion.div className="h-full rounded-full" style={{ background: GGR }}
                    animate={{ width: `${((quizIdx + 1) / quizQuestions.length) * 100}%` }} transition={{ duration: 0.4 }} />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
                <p className="text-base font-semibold text-[#0F172A] leading-snug mb-5">
                  {quizQuestions[quizIdx]?.q ?? quizQuestions[quizIdx]?.question}
                </p>
                <div className="space-y-3">
                  {(quizQuestions[quizIdx]?.opts ?? quizQuestions[quizIdx]?.options ?? []).map((opt: string, i: number) => {
                    const correct  = (quizQuestions[quizIdx].ans ?? quizQuestions[quizIdx].answer_idx) === i
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
                {quizSel !== null && quizQuestions[quizIdx]?.explication && (
                  <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800">
                    <span className="font-bold">Explication : </span>{quizQuestions[quizIdx].explication}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════ RESULT ═════════════════════════ */}
          {screen === 'result' && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-lg mx-auto">
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
                    <span className="text-xs font-bold">Délivré par MIAA+ Academy Pro · {new Date().toLocaleDateString('fr-FR')}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => exportCoursAsPDF(`CERTIFICAT D'ACCOMPLISSEMENT\n\nDomaine : ${catInfo?.label}\nNiveau : ${levelInfo?.label}\nScore : ${quizScore}/${quizQuestions.length} (${Math.round((quizScore / quizQuestions.length) * 100)}%)\nDélivré par MIAA+ Academy Pro — Oraforme\nDate : ${new Date().toLocaleDateString('fr-FR')}`, `Certificat_${catInfo?.label ?? ''}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border-2 transition-all"
                      style={{ borderColor: '#DC2626', color: '#DC2626' }}>
                      <FileType2 size={13} /> PDF
                    </button>
                    <button
                      onClick={() => exportCoursAsDOCX(`CERTIFICAT D'ACCOMPLISSEMENT\n\nDomaine : ${catInfo?.label}\nNiveau : ${levelInfo?.label}\nScore : ${quizScore}/${quizQuestions.length} (${Math.round((quizScore / quizQuestions.length) * 100)}%)\nDélivré par MIAA+ Academy Pro — Oraforme\nDate : ${new Date().toLocaleDateString('fr-FR')}`, `Certificat_${catInfo?.label ?? ''}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border-2 transition-all"
                      style={{ borderColor: GC, color: GC }}>
                      <FileText size={13} /> DOC
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <button onClick={() => setScreen('learning')}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white font-bold text-sm" style={{ background: GGR }}>
                  <BookOpen size={15} /> Continuer la formation
                </button>
                <button onClick={() => startQuiz('quiz')}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-medium text-sm border-2 transition-all"
                  style={{ borderColor: GC, color: GC, background: GL }}>
                  <RotateCcw size={15} /> Refaire le quiz
                </button>
                <button onClick={() => startQuiz('exam')}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-medium text-sm border-2 transition-all"
                  style={{ borderColor: '#7C3AED', color: '#7C3AED', background: '#F5F3FF' }}>
                  <Zap size={15} /> Examen complet (10 questions)
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
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setScreen('home')} className="p-2 rounded-xl border border-[#E2E8F0]">
                  <ChevronLeft size={16} className="text-[#64748B]" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-[#0F172A]">Mes Certificats</h2>
                  <p className="text-sm text-[#64748B]">{certs.length} certificat(s) obtenus</p>
                </div>
              </div>
              {certs.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-[#E2E8F0]">
                  <Award size={40} className="mx-auto mb-3 text-[#CBD5E1]" />
                  <p className="text-sm font-medium text-[#64748B]">Aucun certificat pour l&apos;instant</p>
                  <p className="text-xs text-[#94A3B8] mt-1">Complétez un quiz avec 80%+ pour obtenir un certificat</p>
                  <button onClick={() => setScreen('home')} className="mt-4 px-5 py-2.5 rounded-xl text-white text-sm font-medium" style={{ background: GGR }}>
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
                          Délivré le {new Date(cert.delivre_le).toLocaleDateString('fr-FR')} · MIAA+ Academy Pro
                        </p>
                        <button
                          onClick={() => exportCoursAsPDF(`CERTIFICAT D'ACCOMPLISSEMENT\n\nDomaine : ${catData?.label}\nNiveau : ${cert.niveau}\nScore : ${cert.pourcentage}%\nDélivré par MIAA+ Academy Pro — Oraforme\nDate : ${new Date(cert.delivre_le).toLocaleDateString('fr-FR')}`, `Certificat_${catData?.label ?? cert.categorie}`)}
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

          {/* ═══════════════════════════════ BADGES ════════════════════════ */}
          {screen === 'badges' && (
            <motion.div key="badges" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setScreen('home')} className="p-2 rounded-xl border border-[#E2E8F0]">
                  <ChevronLeft size={16} className="text-[#64748B]" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-[#0F172A]">Mes Badges</h2>
                  <p className="text-sm text-[#64748B]">{earnedBadges.length}/{badges.length} badges obtenus</p>
                </div>
              </div>

              {earnedBadges.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">Badges obtenus</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {earnedBadges.map(badge => (
                      <motion.div key={badge.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-2xl border-2 p-4 text-center"
                        style={{ borderColor: badge.couleur }}>
                        <span className="text-3xl block mb-2">{badge.icone}</span>
                        <p className="text-xs font-bold text-[#0F172A]">{badge.nom}</p>
                        <p className="text-[10px] text-[#64748B] mt-1">{badge.description}</p>
                        {badge.obtenu_le && (
                          <p className="text-[9px] text-[#94A3B8] mt-1">{new Date(badge.obtenu_le).toLocaleDateString('fr-FR')}</p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">Badges à débloquer</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {badges.filter(b => !b.earned).map(badge => (
                    <div key={badge.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 text-center opacity-50">
                      <span className="text-3xl block mb-2 grayscale">{badge.icone}</span>
                      <p className="text-xs font-bold text-[#64748B]">{badge.nom}</p>
                      <p className="text-[10px] text-[#94A3B8] mt-1">{badge.description}</p>
                      <div className="mt-2 flex items-center justify-center gap-1">
                        <Lock size={10} className="text-[#CBD5E1]" />
                        <span className="text-[9px] text-[#CBD5E1]">Non débloqué</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
