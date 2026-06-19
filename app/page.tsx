'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  // modules phares
  BookOpen, Layers, Users, Wallet, FileText, Package, Receipt,
  UserCheck, ShoppingCart, CreditCard, Brain, ClipboardCheck,
  TrendingUp, Calculator, UserCog, Shield, AlertTriangle, Scale,
  // modules sectoriels
  Building2, School, Heart, Pill, Utensils, Truck,
  HardHat, Leaf, GraduationCap, ShoppingBag, Briefcase,
  // cabinets professionnels
  BookMarked, FileSearch, Microscope, Lightbulb, Gavel,
  // layout / ui
  ArrowRight, CheckCircle2, Star, Menu, X, Zap,
  ChevronDown, BarChart2, Sparkles, Lock, Globe, Mail,
} from 'lucide-react'

import { PLAN_CONFIG } from '@/lib/plans'

// ── Data ─────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Modules',   href: '#modules' },
  { label: 'À propos',  href: '#apropos' },
  { label: 'Tarifs',    href: '#tarifs' },
  { label: 'Contact',   href: 'mailto:contact@oraforme.com' },
]

const MODULES_PHARES = [
  { icon: BookOpen,       label: 'Comptabilité SYSCOHADA',      badge: 'OHADA' },
  { icon: Layers,         label: 'IFRS & Consolidation',        badge: 'International' },
  { icon: Users,          label: 'RH & Paie',                   badge: null },
  { icon: Wallet,         label: 'Trésorerie',                  badge: null },
  { icon: FileText,       label: 'Facturation',                 badge: null },
  { icon: Receipt,        label: 'Fiscalité & Déclarations',    badge: null },
  { icon: Package,        label: 'Stock & Inventaire',          badge: null },
  { icon: UserCheck,      label: 'Recrutement Premium',         badge: 'IA' },
  { icon: ShoppingCart,   label: 'CRM',                         badge: null },
  { icon: CreditCard,     label: 'Recouvrement',                badge: null },
  { icon: Brain,          label: 'MIAA+',                       badge: 'IA Métier' },
  { icon: ClipboardCheck, label: 'Audit Comptable',             badge: null },
  { icon: TrendingUp,     label: 'Audit Financier',             badge: null },
  { icon: Calculator,     label: 'Audit Fiscal',                badge: null },
  { icon: UserCog,        label: 'Audit RH',                    badge: null },
  { icon: Shield,         label: 'Contrôle Interne',            badge: null },
  { icon: AlertTriangle,  label: 'Gestion des Risques',         badge: null },
  { icon: Scale,          label: 'Conformité OHADA',            badge: null },
]

const MODULES_SECTEURS = [
  // Secteurs métier
  { icon: Building2,    label: 'Hôtellerie & Resort',            badge: null,     isCabinet: false },
  { icon: School,       label: 'Éducation & Scolarité',          badge: null,     isCabinet: false },
  { icon: Heart,        label: 'Santé & Clinique',               badge: null,     isCabinet: false },
  { icon: Pill,         label: 'Pharmacie',                      badge: null,     isCabinet: false },
  { icon: Utensils,     label: 'Restaurant & POS',               badge: null,     isCabinet: false },
  { icon: Truck,        label: 'Transport & Logistique',         badge: null,     isCabinet: false },
  { icon: HardHat,      label: 'BTP & Construction',             badge: null,     isCabinet: false },
  { icon: Leaf,         label: 'Agriculture',                    badge: null,     isCabinet: false },
  { icon: ShoppingBag,  label: 'Achats & Fournisseurs',          badge: null,     isCabinet: false },
  { icon: Briefcase,    label: 'Recrutement & Placement RH',     badge: 'MIAA',   isCabinet: false },
  { icon: GraduationCap,label: 'Formation Academy',              badge: 'IA',     isCabinet: false },
  // Cabinets professionnels
  { icon: BookMarked,   label: 'Cabinet Comptable',              badge: 'OHADA',  isCabinet: true },
  { icon: FileSearch,   label: 'Cabinet Fiscal',                 badge: null,     isCabinet: true },
  { icon: Microscope,   label: "Cabinet d'Audit",                badge: null,     isCabinet: true },
  { icon: Lightbulb,    label: 'Cabinet Conseil',                badge: null,     isCabinet: true },
  { icon: Scale,        label: 'Cabinet Juridique',              badge: null,     isCabinet: true },
  { icon: Gavel,        label: "Cabinet d'Avocats",              badge: null,     isCabinet: true },
]

const MIAA_POINTS = [
  { icon: Brain,     text: 'Analyse prédictive de votre trésorerie' },
  { icon: BarChart2, text: 'Rapports financiers générés automatiquement' },
  { icon: Zap,       text: 'Alertes intelligentes sur vos anomalies' },
  { icon: Shield,    text: 'Détection des risques comptables en temps réel' },
]

const FMT = (n: number) => new Intl.NumberFormat('fr-FR').format(n)

const PLANS = [
  {
    name:        PLAN_CONFIG.tpe.label,
    price:       FMT(PLAN_CONFIG.tpe.price_fcfa),
    currency:    'FCFA',
    period:      '/ mois',
    benefit:     'Lancez votre activité sans vous perdre dans la gestion',
    desc:        'Pour indépendants, ETS et petites structures',
    highlight:   false,
    isCompagnie: false,
    color:       '#DC2626',
    features:    PLAN_CONFIG.tpe.features,
    targets: [
      'Auto-entrepreneurs',
      'ETS · TPE',
      'Boutiques & Commerces',
      'Restaurants indépendants',
      'Pharmacies indépendantes',
      'Écoles primaires & Collèges',
    ],
  },
  {
    name:        PLAN_CONFIG.pme.label,
    price:       FMT(PLAN_CONFIG.pme.price_fcfa),
    currency:    'FCFA',
    period:      '/ mois',
    benefit:     'Pilotez votre PME avec la puissance de l\'IA',
    desc:        'Pour PME, cabinets et secteurs spécialisés',
    highlight:   true,
    isCompagnie: false,
    color:       '#D97706',
    features:    PLAN_CONFIG.pme.features,
    targets: [
      'PME',
      'Cabinets (compta, fiscal, audit…)',
      'Hôtels & Universités',
      'Cliniques & Hôpitaux',
      'Assurances & Transport',
      'Recrutement & Placement RH',
    ],
  },
  {
    name:        PLAN_CONFIG.grande.label,
    price:       FMT(PLAN_CONFIG.grande.price_fcfa),
    currency:    'FCFA',
    period:      '/ mois',
    benefit:     'Gérez votre groupe international depuis une seule plateforme',
    desc:        'Groupes, filiales et structures multi-entités',
    highlight:   false,
    isCompagnie: true,
    color:       '#7C3AED',
    features:    PLAN_CONFIG.grande.features,
    targets: [
      'Groupes internationaux & Holdings',
      'Multinationales multi-pays',
      'Réseaux de franchises',
      'Banques régionales & Assurances int.',
      'Chaînes hôtelières & Réseaux de cliniques',
    ],
  },
]

// Sectors compatible with onboarding sector IDs (direct match for pre-fill)
const LANDING_SECTORS = [
  { id: 'restaurant',          label: 'Restaurant / Fast-food'       },
  { id: 'commerce',            label: 'Commerce & Boutique'           },
  { id: 'pharmacie',           label: 'Pharmacie'                     },
  { id: 'agriculture',         label: 'Agriculture & Élevage'        },
  { id: 'boisson',             label: 'Distribution Boissons'         },
  { id: 'boulangerie',         label: 'Boulangerie / Pâtisserie'     },
  { id: 'hotel',               label: 'Hôtel & Hébergement'          },
  { id: 'clinique',            label: 'Clinique / Santé'              },
  { id: 'hopital',             label: 'Hôpital'                       },
  { id: 'btp',                 label: 'BTP & Construction'            },
  { id: 'transport',           label: 'Transport & Logistique'        },
  { id: 'logistique',          label: 'Logistique'                    },
  { id: 'banque',              label: 'Banque & Finance'              },
  { id: 'microfinance',        label: 'Microfinance'                  },
  { id: 'supermarche',         label: 'Supermarché / GMS'            },
  { id: 'ong',                 label: 'ONG & Association'             },
  { id: 'petrole',             label: 'Pétrole & Énergie'            },
  { id: 'industrie',           label: 'Industrie'                     },
  { id: 'cabinet-comptable',   label: 'Cabinet Comptable'             },
  { id: 'cabinet-fiscal',      label: 'Cabinet Fiscal'                },
  { id: 'cabinet-audit',       label: "Cabinet d'Audit"               },
  { id: 'cabinet-conseil',     label: 'Cabinet Conseil'               },
  { id: 'universite',          label: 'Université'                    },
  { id: 'lycee',               label: 'Lycée'                         },
  { id: 'compagnie_assurance', label: "Compagnie d'Assurance"        },
  { id: 'cabinet-recrutement', label: 'Recrutement & Placement RH'   },
  { id: 'interim',             label: 'Intérim & Staffing'            },
  { id: 'chasseur-tetes',      label: 'Executive Search'              },
  { id: 'autre_business',      label: 'Autre activité'                },
]

const PLAN_PILLS = [
  { key: 'tpe' as const,    label: PLAN_CONFIG.tpe.label,    price: FMT(PLAN_CONFIG.tpe.price_fcfa),    color: '#DC2626', bg: '#FEF2F2'  },
  { key: 'pme' as const,    label: PLAN_CONFIG.pme.label,    price: FMT(PLAN_CONFIG.pme.price_fcfa),    color: '#D97706', bg: '#FFFBEB'  },
  { key: 'grande' as const, label: PLAN_CONFIG.grande.label, price: FMT(PLAN_CONFIG.grande.price_fcfa), color: '#7C3AED', bg: '#F5F3FF'  },
]

// 10 pays avec support fiscal ou présence confirmée
const FLAG_COUNTRIES: { code: string; nom: string }[] = [
  { code: 'cg', nom: 'Congo' },
  { code: 'cm', nom: 'Cameroun' },
  { code: 'ga', nom: 'Gabon' },
  { code: 'cd', nom: 'RD Congo' },
  { code: 'td', nom: 'Tchad' },
  { code: 'cf', nom: 'RCA' },
  { code: 'gq', nom: 'Guinée Éq.' },
  { code: 'sn', nom: 'Sénégal' },
  { code: 'ci', nom: "Côte d'Ivoire" },
  { code: 'rw', nom: 'Rwanda' },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [showAllModules, setShowAllModules] = useState(false)

  // ── CTA form state ──────────────────────────────────────────────────────────
  const [ctaNom,     setCtaNom]     = useState('')
  const [ctaTel,     setCtaTel]     = useState('')
  const [ctaPlan,    setCtaPlan]    = useState<'tpe' | 'pme' | 'grande'>('pme')
  const [ctaSecteur, setCtaSecteur] = useState('')

  function handleCtaStart() {
    // Save to localStorage — onboarding reads this draft on load
    try {
      localStorage.setItem('oraforme_onb_v5', JSON.stringify({
        plan:          ctaPlan,
        sectorId:      ctaSecteur || undefined,
        nomEntreprise: ctaNom.trim()  || undefined,
        telephone:     ctaTel.trim()  || undefined,
      }))
    } catch { /* localStorage unavailable */ }
    router.push('/onboarding')
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .a1 { animation: fadeUp 0.55s ease both; }
        .a2 { animation: fadeUp 0.55s ease 0.1s both; }
        .a3 { animation: fadeUp 0.55s ease 0.2s both; }
        .a4 { animation: fadeUp 0.55s ease 0.3s both; }
        .af { animation: fadeIn 0.7s ease both; }
        .ch { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .ch:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
        .bt { transition: background-color 0.18s ease, transform 0.15s ease; }
        .bt:hover { transform: translateY(-1px); }
        .bt:active { transform: translateY(0); }
      `}</style>

      <div className="font-sans bg-white text-[#111827] overflow-x-hidden">

        {/* ══ NAVBAR ════════════════════════════════════════════════════════════ */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-6"
            style={{ height: 70 }}>

            <Link href="/" className="shrink-0">
              <img src="/logo.png" alt="Oraforme" style={{ height: 40, width: 'auto' }} />
            </Link>

            <div className="hidden lg:flex items-center gap-8">
              {NAV_LINKS.map(l => (
                <a key={l.href} href={l.href}
                  className="text-sm font-semibold text-[#374151] hover:text-[#DC2626] transition-colors">
                  {l.label}
                </a>
              ))}
            </div>

            <div className="hidden lg:flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-[#374151] mr-1">
                <Mail size={13} className="text-[#DC2626]" />
                contact@oraforme.com
              </div>
              <Link href="/login"
                className="text-sm font-semibold text-[#374151] hover:text-[#DC2626] px-4 py-2 border border-gray-200 rounded-lg transition-colors">
                Se connecter
              </Link>
              <Link href="/onboarding"
                className="bt text-sm font-bold text-white bg-[#DC2626] hover:bg-[#B91C1C] px-5 py-2.5 rounded-lg inline-flex items-center gap-1.5">
                Démarrer gratuitement <ArrowRight size={13} />
              </Link>
            </div>

            <button className="lg:hidden p-2 rounded-lg text-[#6B7280] hover:bg-gray-100 transition-colors"
              onClick={() => setMenuOpen(v => !v)} aria-label="Menu">
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {menuOpen && (
            <div className="lg:hidden bg-white border-t border-gray-100 px-6 py-5 flex flex-col gap-4 af">
              {NAV_LINKS.map(l => (
                <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
                  className="text-base font-semibold text-[#111827] hover:text-[#DC2626] transition-colors">
                  {l.label}
                </a>
              ))}
              <div className="flex flex-col gap-3 pt-4 border-t border-gray-100">
                <Link href="/login" onClick={() => setMenuOpen(false)}
                  className="text-center text-sm font-semibold border border-gray-200 rounded-lg py-3">
                  Se connecter
                </Link>
                <Link href="/onboarding" onClick={() => setMenuOpen(false)}
                  className="text-center text-sm font-bold text-white bg-[#DC2626] rounded-lg py-3">
                  Démarrer gratuitement
                </Link>
              </div>
            </div>
          )}
        </nav>

        {/* ══ HERO — split gauche texte / droite image ══════════════════════════ */}
        <section className="pt-[70px]">
          <div style={{ minHeight: '100vh', display: 'flex' }}>

            {/* Gauche — texte sombre */}
            <div className="flex-1 bg-[#00454c] flex items-center px-8 sm:px-12 lg:px-16 py-20">
              <div className="max-w-xl w-full">
                <div className="a1 inline-flex items-center gap-2 bg-[#DC2626]/10 border border-[#DC2626]/25 text-[#F87171] text-[10px] font-bold uppercase tracking-[0.18em] rounded-full px-4 py-1.5 mb-7">
                  <Sparkles size={10} />
                  EXPERTS QUI PRENNENT SOIN DE VOUS
                </div>

                <h1 className="a2 text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.0] tracking-tight uppercase mb-6">
                  GÉREZ MIEUX.<br />
                  <span className="text-[#DC2626]">GÉREZ AVEC L&apos;IA.</span>
                </h1>

                <p className="a3 text-base text-gray-300 leading-relaxed mb-8 max-w-md">
                  Nous voulons libérer votre entreprise des tâches répétitives afin que vous puissiez vous concentrer sur ce qui compte vraiment — développer votre activité.
                </p>

                {/* Badge prix — style Vinx "$39/mois" */}
                <div className="a3 flex items-center gap-5 mb-9">
                  <div className="bg-white rounded-2xl px-5 py-3 text-center shadow-lg">
                    <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">à partir de</div>
                    <div className="text-2xl font-black text-[#111827] leading-none">
                      10 000 <span className="text-sm font-bold">FCFA</span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">/mois · 30j gratuits</div>
                  </div>
                  <div className="text-gray-400 text-sm leading-relaxed">
                    Aucune carte<br />bancaire requise
                  </div>
                </div>

                <div className="a4 flex flex-wrap gap-3">
                  <Link href="/onboarding"
                    className="bt inline-flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-sm px-7 py-4 rounded-xl shadow-xl shadow-red-900/30 uppercase tracking-wide">
                    COMMENCER GRATUITEMENT <ArrowRight size={15} />
                  </Link>
                  <a href="#modules" className="bt inline-flex items-center gap-2 text-gray-300 hover:text-white font-semibold text-sm px-6 py-4 rounded-xl border border-white/15 hover:border-white/40">
                    ▶ Voir les modules
                  </a>
                </div>
              </div>
            </div>

            {/* Droite — image plein cadre */}
            <div className="hidden lg:block" style={{ width: '44%', position: 'relative' }}>
              <Image
                src="/images/hero.jpg"
                alt="Équipe professionnelle Oraforme"
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#00454c]/50 to-transparent" />
            </div>

          </div>
        </section>

        {/* ══ LEAD BAR ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#DC2626] py-5 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center gap-4">
            <div className="shrink-0 text-white">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-200 mb-0.5">DÉMARREZ EN 2 MINUTES</div>
              <div className="text-lg font-black uppercase leading-tight">Commencez votre essai gratuit</div>
            </div>
            <div className="flex-1 flex gap-2 w-full sm:w-auto">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Votre adresse e-mail professionnelle"
                className="flex-1 min-w-0 px-4 py-3 rounded-xl text-sm font-medium text-[#111827] placeholder-gray-400 outline-none"
              />
              <Link href="/onboarding"
                className="bt shrink-0 bg-[#00454c] hover:bg-[#003438] text-white font-bold text-sm px-6 py-3 rounded-xl whitespace-nowrap inline-flex items-center gap-1.5">
                COMMENCER <ArrowRight size={13} />
              </Link>
            </div>
            <div className="shrink-0 flex items-center gap-2 text-white/70 text-[11px] font-medium">
              <CheckCircle2 size={13} className="text-white/80" />
              Sans carte bancaire
            </div>
          </div>
        </section>

        {/* ══ MODULES ═══════════════════════════════════════════════════════════ */}
        <section id="modules" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">

            <div className="text-center mb-12">
              <span className="text-[10px] font-bold text-[#DC2626] uppercase tracking-[0.18em]">CE QUE NOUS OFFRONS</span>
              <h2 className="text-3xl sm:text-4xl font-black text-[#111827] tracking-tight mt-3 mb-3">
                Nos Modules Phares
              </h2>
              <p className="text-[#6B7280] max-w-lg mx-auto text-sm">
                Suite complète pensée pour les entreprises africaines — OHADA, IFRS, paie, fiscalité,
                audit et intelligence artificielle intégrée.
              </p>
            </div>

            {/* Modules phares — toujours visibles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {MODULES_PHARES.map(m => {
                const Icon = m.icon
                return (
                  <div key={m.label}
                    className="ch flex flex-col items-center gap-2.5 py-5 px-3 rounded-2xl border border-gray-100 bg-gray-50 text-center">
                    <div className="w-11 h-11 rounded-xl bg-[#DC2626]/8 border border-[#DC2626]/15 flex items-center justify-center">
                      <Icon size={20} className="text-[#DC2626]" />
                    </div>
                    <span className="text-[11px] font-bold text-[#374151] leading-tight">{m.label}</span>
                    {m.badge && (
                      <span className="text-[9px] font-bold bg-[#DC2626]/10 text-[#DC2626] px-2 py-0.5 rounded-full uppercase tracking-wide leading-none">
                        {m.badge}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Modules sectoriels — dépliables */}
            {showAllModules && (
              <div className="mt-10 pt-10 border-t border-gray-100">

                {/* Secteurs métier */}
                <div className="text-center mb-8">
                  <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-[0.18em]">MODULES SECTORIELS</span>
                  <h3 className="text-xl font-black text-[#111827] mt-2 mb-1">Solutions spécialisées par secteur</h3>
                  <p className="text-[#6B7280] text-sm">Hôtellerie, éducation, santé, BTP, transport, agriculture et plus encore.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-10">
                  {MODULES_SECTEURS.filter(m => !m.isCabinet).map(m => {
                    const Icon = m.icon
                    return (
                      <div key={m.label}
                        className="ch flex flex-col items-center gap-2.5 py-5 px-3 rounded-2xl border border-gray-100 bg-[#F8FAFC] text-center">
                        <div className="w-11 h-11 rounded-xl bg-[#00454c]/8 border border-[#00454c]/15 flex items-center justify-center">
                          <Icon size={20} className="text-[#00454c]" />
                        </div>
                        <span className="text-[11px] font-bold text-[#374151] leading-tight">{m.label}</span>
                        {m.badge && (
                          <span className="text-[9px] font-bold bg-[#00454c]/10 text-[#00454c] px-2 py-0.5 rounded-full uppercase tracking-wide leading-none">
                            {m.badge}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Cabinets professionnels */}
                <div className="border-t border-gray-100 pt-8 mb-8">
                  <div className="text-center mb-7">
                    <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-[0.18em]">CABINETS PROFESSIONNELS</span>
                    <h3 className="text-xl font-black text-[#111827] mt-2 mb-1">Suite dédiée aux cabinets & conseils</h3>
                    <p className="text-[#6B7280] text-sm max-w-lg mx-auto">
                      Gestion multi-clients, honoraires, missions, Mode Expert, agenda fiscal & social,
                      conformité OHADA, dossiers judiciaires — uniquement disponible en plan Business.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {MODULES_SECTEURS.filter(m => m.isCabinet).map(m => {
                      const Icon = m.icon
                      return (
                        <div key={m.label}
                          className="ch flex flex-col items-center gap-2.5 py-5 px-3 rounded-2xl border border-[#00454c]/20 bg-[#00454c]/4 text-center">
                          <div className="w-11 h-11 rounded-xl bg-[#00454c]/12 border border-[#00454c]/20 flex items-center justify-center">
                            <Icon size={20} className="text-[#00454c]" />
                          </div>
                          <span className="text-[11px] font-bold text-[#374151] leading-tight">{m.label}</span>
                          {m.badge && (
                            <span className="text-[9px] font-bold bg-[#00454c]/10 text-[#00454c] px-2 py-0.5 rounded-full uppercase tracking-wide leading-none">
                              {m.badge}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

              </div>
            )}

            <div className="text-center mt-10">
              <button
                onClick={() => setShowAllModules(v => !v)}
                className="bt inline-flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-sm px-7 py-3.5 rounded-xl"
              >
                {showAllModules ? (
                  <><ChevronDown size={14} style={{ transform: 'rotate(180deg)' }} /> Masquer les modules</>
                ) : (
                  <>Voir tous les modules <ChevronDown size={14} /></>
                )}
              </button>
            </div>

          </div>
        </section>

        {/* ══ ABOUT — image gauche / texte droite ═══════════════════════════════ */}
        <section id="apropos" className="bg-white">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2">

            {/* Image */}
            <div className="relative" style={{ minHeight: 500 }}>
              <Image
                src="/images/analytics.jpg"
                alt="Présentation Oraforme"
                fill
                className="object-cover"
              />
              {/* Badge overlay rond — style Vinx */}
              <div className="absolute bottom-8 right-8 w-28 h-28 rounded-full bg-[#DC2626] flex flex-col items-center justify-center text-white text-center shadow-2xl">
                <div className="text-[9px] font-black uppercase tracking-wide">SERVICE</div>
                <div className="text-[9px] font-black uppercase tracking-wide">100%</div>
                <div className="text-[9px] font-black uppercase tracking-wide">SÉCURISÉ</div>
              </div>
            </div>

            {/* Texte */}
            <div className="flex flex-col justify-center px-8 sm:px-12 lg:px-16 py-16 lg:py-20">
              <span className="text-[10px] font-bold text-[#DC2626] uppercase tracking-[0.18em] mb-5">
                NOTRE MISSION
              </span>
              <h2 className="text-3xl sm:text-[38px] font-black text-[#111827] tracking-tight mb-5 leading-tight">
                Présents pour réussir<br />ensemble
              </h2>
              <p className="text-[#6B7280] leading-relaxed mb-4 text-sm">
                Faisons face à la réalité : gérer une entreprise est complexe et chronophage. Les
                tâches administratives consomment un temps précieux qui pourrait être consacré à la
                croissance. C&apos;est pour cela qu&apos;Oraforme existe.
              </p>
              <p className="text-[#6B7280] leading-relaxed mb-8 text-sm">
                <strong className="text-[#111827]">Notre mission :</strong> chez Oraforme, nous voulons
                voir votre entreprise prospérer. Nous nous y engageons en automatisant vos tâches
                répétitives, en protégeant vos données et en vous donnant une vision claire et en
                temps réel de votre activité. Ça, on fait.
              </p>
              <a href="#tarifs"
                className="bt inline-flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-sm px-7 py-3.5 rounded-xl w-fit">
                Voir nos tarifs <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </section>

        {/* ══ IA — texte gauche / image droite (fond sombre) ════════════════════ */}
        <section className="bg-[#00454c]">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2">

            {/* Texte */}
            <div className="flex flex-col justify-center px-8 sm:px-12 lg:px-16 py-16 lg:py-24">
              <span className="text-[10px] font-bold text-[#F87171] uppercase tracking-[0.18em] mb-5">
                INTELLIGENCE ARTIFICIELLE
              </span>
              <h2 className="text-3xl sm:text-[38px] font-black text-white tracking-tight mb-5 leading-tight">
                Les meilleurs outils<br />
                <span className="text-[#DC2626]">de gestion propulsés par l&apos;IA</span>
              </h2>
              <p className="text-gray-300 leading-relaxed mb-8 text-sm">
                Il existe un système moderne que vous pouvez utiliser pour gérer votre entreprise,
                vos équipes et vos finances sans erreur et sans effort. Les fonctionnalités comprennent
                la comptabilité automatisée, la gestion des employés, les relevés bancaires et plus
                encore. Même si nous facturerons légèrement plus pour certains services, la valeur
                ajoutée par MIAA+ justifie largement cet investissement.
              </p>
              <ul className="space-y-3 mb-9">
                {MIAA_POINTS.map(p => {
                  const Icon = p.icon
                  return (
                    <li key={p.text} className="flex items-center gap-3 text-gray-300 text-sm">
                      <div className="w-8 h-8 rounded-xl bg-[#DC2626]/20 flex items-center justify-center shrink-0">
                        <Icon size={14} className="text-[#F87171]" />
                      </div>
                      {p.text}
                    </li>
                  )
                })}
              </ul>
              <Link href="/onboarding?ref=miaa"
                className="bt inline-flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-sm px-7 py-3.5 rounded-xl w-fit">
                Essayer MIAA+ gratuitement <ArrowRight size={14} />
              </Link>
            </div>

            {/* Image */}
            <div className="relative hidden lg:block" style={{ minHeight: 540 }}>
              <Image
                src="/images/ai-miaa.jpg"
                alt="MIAA+ Intelligence Artificielle"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#00454c]/60 to-transparent" />
            </div>

          </div>
        </section>

        {/* ══ WHY US ════════════════════════════════════════════════════════════ */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-start">

              {/* Gauche */}
              <div>
                <span className="text-[10px] font-bold text-[#DC2626] uppercase tracking-[0.18em]">POURQUOI NOUS CHOISIR</span>
                <h2 className="text-3xl sm:text-[38px] font-black text-[#111827] tracking-tight mt-3 mb-5 leading-tight">
                  La meilleure solution<br />de gestion du marché
                </h2>
                <p className="text-[#6B7280] leading-relaxed mb-4 text-sm">
                  Tous nos outils ont été conçus pour que vous preniez de meilleures décisions.
                  Savoir d&apos;où vient votre argent, où il va, et comment il peut travailler pour vous
                  — c&apos;est ce que fait Oraforme.
                </p>
                <p className="text-[#6B7280] leading-relaxed mb-9 text-sm">
                  Nous proposons des services complets incluant la comptabilité automatisée, la gestion
                  des ressources humaines, la trésorerie et la facturation. Parce que nous faisons
                  confiance à notre produit, nous vous offrons 30 jours gratuits sans carte bancaire.
                </p>

                {/* Badge garantie rond — style Vinx "30 DAY GUARANTEED" */}
                <div className="flex items-center gap-7">
                  <div className="w-32 h-32 rounded-full bg-[#DC2626] flex flex-col items-center justify-center text-white text-center shrink-0 shadow-lg shadow-red-200">
                    <div className="text-[9px] font-black uppercase tracking-wide">ESSAI</div>
                    <div className="text-3xl font-black leading-none my-0.5">30</div>
                    <div className="text-[9px] font-black uppercase tracking-wide">JOURS</div>
                    <div className="text-[9px] font-black uppercase tracking-wide">GRATUIT</div>
                  </div>
                  <div>
                    <div className="text-sm font-black text-[#111827] uppercase mb-2 tracking-wide">100% SANS RISQUE</div>
                    <p className="text-sm text-[#6B7280] leading-relaxed">
                      Nous sommes tellement confiants dans notre solution que nous vous offrons 30 jours
                      complets sans aucun engagement. Si Oraforme ne vous convient pas, vous ne payez rien.
                    </p>
                  </div>
                </div>
              </div>

              {/* Droite — témoignage avec quotes géantes */}
              <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
                <div className="text-7xl text-[#DC2626] font-black leading-none select-none mb-4">&ldquo;</div>
                <p className="text-[#374151] text-lg leading-relaxed mb-8 font-medium italic">
                  Oraforme a transformé notre façon de gérer l&apos;entreprise. MIAA+ identifie des
                  opportunités que nous aurions manquées. Notre productivité a augmenté de 40%
                  en trois mois seulement.
                </p>
                <div className="flex items-center gap-4 mb-7">
                  <div className="w-12 h-12 rounded-full bg-[#DC2626] flex items-center justify-center font-bold text-white text-sm shrink-0">
                    MD
                  </div>
                  <div>
                    <div className="font-bold text-[#111827] text-sm">Marc Dubois</div>
                    <div className="text-xs text-[#9CA3AF]">Directeur Financier · Paris, France</div>
                  </div>
                  <div className="ml-auto flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={13} className="text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                </div>
                {/* Logos plateformes */}
                <div className="flex items-center gap-3 pt-5 border-t border-gray-200">
                  <span className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wide mr-1">Noté sur</span>
                  {['Google', 'Capterra', 'G2'].map(p => (
                    <span key={p}
                      className="text-[11px] font-bold text-[#374151] bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                      {p}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ══ REGIONS DE SERVICE ════════════════════════════════════════════════ */}
        <section className="py-16 bg-gray-50 border-t border-gray-100 overflow-hidden">
          <div className="text-center mb-10 px-4">
            <span className="text-[10px] font-bold text-[#DC2626] uppercase tracking-[0.18em]">ZONES DE SERVICE</span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#111827] mt-2">Notre présence internationale</h2>
            <p className="text-sm text-[#6B7280] mt-2">10 pays · 3 continents · moteur fiscal intégré</p>
          </div>
          {/* Carousel infini */}
          <div className="overflow-hidden">
            <div className="flags-track">
              {[...FLAG_COUNTRIES, ...FLAG_COUNTRIES].map((c, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 mx-4 shrink-0">
                  <img
                    src={`https://flagcdn.com/w80/${c.code}.png`}
                    alt={c.nom}
                    width={56}
                    height={42}
                    className="rounded-md shadow-sm object-cover"
                    loading="lazy"
                  />
                  <span className="text-[10px] text-[#6B7280] whitespace-nowrap">{c.nom}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ CTA FORM — image bg + formulaire fonctionnel ════════════════════ */}
        <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src="/images/oraforme-cta.jpg"
              alt="Oraforme — Démarrer"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[#00454c]/82" />
          </div>

          <div className="relative max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">

              {/* Gauche — pitch */}
              <div>
                <span className="text-[10px] font-bold text-[#F87171] uppercase tracking-[0.18em] mb-4 block">
                  COMMENCER MAINTENANT
                </span>
                <h2 className="text-3xl sm:text-4xl font-black text-white mb-5 leading-tight">
                  Obtenez votre<br />accès gratuit
                </h2>
                <p className="text-gray-300 text-sm leading-relaxed mb-6">
                  Choisissez votre offre, sélectionnez votre secteur et créez votre entreprise en 2 minutes.
                  MIAA+ active vos modules automatiquement. Aucune carte bancaire requise.
                </p>
                <ul className="space-y-2 mb-7">
                  {[
                    '✓ 30 jours gratuits sans engagement',
                    '✓ Modules activés selon votre secteur',
                    '✓ Fonctionne hors-ligne en Afrique',
                    '✓ Mobile Money accepté',
                  ].map(t => (
                    <li key={t} className="text-gray-300 text-sm">{t}</li>
                  ))}
                </ul>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Mail size={13} className="text-[#DC2626]" />
                  <a href="mailto:contact@oraforme.com" className="hover:text-white transition-colors">
                    contact@oraforme.com
                  </a>
                </div>
              </div>

              {/* Droite — formulaire fonctionnel */}
              <div className="bg-white rounded-2xl p-7 shadow-2xl">
                <h3 className="text-sm font-black text-[#111827] mb-1 uppercase tracking-wider">
                  CRÉER MON ENTREPRISE
                </h3>
                <p className="text-[11px] text-gray-400 mb-5">Sélectionnez votre offre et secteur pour démarrer</p>

                {/* Plan pills */}
                <div className="grid grid-cols-3 gap-1.5 mb-4">
                  {PLAN_PILLS.map(p => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setCtaPlan(p.key)}
                      className="py-2 px-1 rounded-xl border-2 text-center transition-all"
                      style={{
                        borderColor: ctaPlan === p.key ? p.color : '#E5E7EB',
                        background:  ctaPlan === p.key ? p.bg  : 'white',
                      }}
                    >
                      <p className="text-[11px] font-black leading-none" style={{ color: ctaPlan === p.key ? p.color : '#374151' }}>
                        {p.label}
                      </p>
                      <p className="text-[9px] mt-0.5" style={{ color: ctaPlan === p.key ? p.color : '#9CA3AF' }}>
                        {p.price} FCFA
                      </p>
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    value={ctaNom}
                    onChange={e => setCtaNom(e.target.value)}
                    placeholder="Nom de l'entreprise *"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#DC2626] transition-colors"
                  />
                  <input
                    type="tel"
                    value={ctaTel}
                    onChange={e => setCtaTel(e.target.value)}
                    placeholder="Téléphone (ex: +242 06 xxx xxxx)"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#DC2626] transition-colors"
                  />
                  <select
                    value={ctaSecteur}
                    onChange={e => setCtaSecteur(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#DC2626] transition-colors text-[#374151]"
                  >
                    <option value="">Secteur d&apos;activité *</option>
                    {LANDING_SECTORS.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleCtaStart}
                    disabled={!ctaNom.trim() || !ctaSecteur}
                    className="bt block w-full text-center text-white font-bold text-sm py-4 rounded-xl uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    style={{ background: PLAN_PILLS.find(p => p.key === ctaPlan)?.color ?? '#DC2626' }}
                  >
                    CRÉER MON ESPACE — {PLAN_PILLS.find(p => p.key === ctaPlan)?.label}
                  </button>
                  <p className="text-[10px] text-gray-400 text-center">
                    Gratuit 30 jours · Vous créerez votre mot de passe à l&apos;étape suivante ·{' '}
                    <a href="/legal/cgu" className="text-[#DC2626] hover:underline">CGU</a>
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ══ TARIFS ════════════════════════════════════════════════════════════ */}
        <section id="tarifs" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <span className="text-[10px] font-bold text-[#DC2626] uppercase tracking-[0.18em]">TARIFS</span>
              <h2 className="text-3xl sm:text-4xl font-black text-[#111827] tracking-tight mt-3 mb-3">
                Trois offres, une seule plateforme
              </h2>
              <p className="text-[#6B7280] text-sm">30 jours d&apos;essai gratuit · Aucune carte bancaire requise</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PLANS.map(plan => {
                const isDark = plan.highlight || plan.isCompagnie
                const darkBg = plan.isCompagnie ? '#1e0a3c' : '#00454c'
                const darkBorder = plan.isCompagnie ? 'rgba(124,58,237,0.4)' : 'rgba(220,38,38,0.4)'
                return (
                  <div key={plan.name}
                    className="ch rounded-2xl p-7 border relative flex flex-col"
                    style={{
                      background:   isDark ? darkBg : '#F9FAFB',
                      border:       `1px solid ${isDark ? darkBorder : '#E5E7EB'}`,
                      boxShadow:    isDark ? '0 20px 60px rgba(0,0,0,0.3)' : 'none',
                    }}>
                    {plan.highlight && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#DC2626] text-white text-[9px] font-bold px-4 py-1 rounded-full whitespace-nowrap uppercase tracking-wide">
                        LE PLUS POPULAIRE
                      </div>
                    )}
                    {plan.isCompagnie && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#7C3AED] text-white text-[9px] font-bold px-4 py-1 rounded-full whitespace-nowrap uppercase tracking-wide">
                        🏢 COMPAGNIE
                      </div>
                    )}

                    {/* Plan name + benefit */}
                    <div className="mb-4">
                      <div className={`text-xl font-black mb-1 ${isDark ? 'text-white' : 'text-[#111827]'}`}>
                        {plan.name}
                      </div>
                      <p className={`text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-[#374151]'}`}>
                        {plan.benefit}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="flex items-baseline gap-1 mb-5">
                      <span className="text-4xl font-black" style={{ color: isDark ? '#fff' : plan.color }}>
                        {plan.price}
                      </span>
                      <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-[#6B7280]'}`}>
                        {plan.currency} {plan.period}
                      </span>
                    </div>

                    {/* ── Pour : section ── */}
                    <div className="mb-5">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span
                          className="text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-full"
                          style={{
                            background: isDark ? (plan.isCompagnie ? 'rgba(167,139,250,0.2)' : 'rgba(248,113,113,0.15)') : plan.color + '15',
                            color: isDark ? (plan.isCompagnie ? '#C4B5FD' : '#FCA5A5') : plan.color,
                          }}
                        >
                          POUR
                        </span>
                        <div className={`h-px flex-1 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                      </div>
                      <ul className="space-y-1">
                        {(plan as typeof plan & { targets: string[] }).targets.map(t => (
                          <li key={t}
                            className={`flex items-center gap-2 text-[12px] font-medium ${
                              isDark ? 'text-gray-300' : 'text-[#374151]'
                            }`}>
                            <span className="w-1 h-1 rounded-full shrink-0" style={{ background: isDark ? (plan.isCompagnie ? '#A78BFA' : '#F87171') : plan.color }} />
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* ── Inclus : section ── */}
                    <div className="mb-6">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span
                          className="text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-full"
                          style={{
                            background: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                            color: isDark ? '#94A3B8' : '#64748B',
                          }}
                        >
                          INCLUS
                        </span>
                        <div className={`h-px flex-1 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                      </div>
                      <ul className="space-y-2 flex-1">
                        {plan.features.map(f => (
                          <li key={f}
                            className={`flex items-start gap-2.5 text-sm font-medium ${
                              isDark ? 'text-gray-200' : 'text-[#374151]'
                            }`}>
                            <CheckCircle2 size={13} className="shrink-0 mt-0.5" style={{ color: isDark ? (plan.isCompagnie ? '#A78BFA' : '#F87171') : plan.color }} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Link href="/onboarding"
                      className="bt block text-center text-sm font-bold py-3.5 rounded-xl text-white uppercase tracking-wide"
                      style={{ background: plan.color }}>
                      Commencer gratuitement
                    </Link>
                  </div>
                )
              })}
            </div>

            <p className="text-center text-xs text-[#9CA3AF] mt-8">
              Paiement Mobile Money · Virement bancaire · Tarification selon votre devise
            </p>
          </div>
        </section>

        {/* ══ FOOTER ════════════════════════════════════════════════════════════ */}
        <footer className="bg-[#002d33] border-t border-white/5 pt-16 pb-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-14">

              {/* Brand */}
              <div>
                <Link href="/" className="flex items-center mb-5">
                  <img src="/logo-white.png" alt="Oraforme" style={{ height: 32, width: 'auto' }} />
                </Link>
                <p className="text-sm text-gray-500 leading-relaxed mb-5">
                  La plateforme de gestion propulsée par l&apos;intelligence artificielle MIAA+.
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Lock size={11} className="shrink-0" />
                  Données chiffrées · Hébergement sécurisé
                </div>
              </div>

              {/* Solutions */}
              <div>
                <div className="text-[10px] font-bold text-white uppercase tracking-[0.18em] mb-5">Solutions</div>
                <ul className="space-y-2.5">
                  {['Comptabilité', 'RH & Paie', 'Trésorerie', 'Facturation', 'MIAA+ IA'].map(l => (
                    <li key={l}>
                      <a href="#modules" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">{l}</a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Secteurs */}
              <div>
                <div className="text-[10px] font-bold text-white uppercase tracking-[0.18em] mb-5">Secteurs</div>
                <ul className="space-y-2.5">
                  {['PME & Startups', 'Hôtellerie', 'Éducation', 'Santé', 'Commerce'].map(l => (
                    <li key={l}>
                      <a href="#modules" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">{l}</a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Contact × 3 offices — style Vinx footer */}
              <div>
                <div className="text-[10px] font-bold text-white uppercase tracking-[0.18em] mb-5">Contact</div>
                <ul className="space-y-4">
                  <li>
                    <div className="flex items-center gap-2 mb-1">
                      <Globe size={12} className="text-[#DC2626]" />
                      <span className="text-[10px] font-bold text-white uppercase tracking-wide">International</span>
                    </div>
                    <div className="text-xs text-gray-500">www.oraforms.com</div>
                    <div className="text-xs text-gray-500">contact@oraforme.com</div>
                  </li>
                  <li>
                    <div className="flex items-center gap-2 mb-1">
                      <Globe size={12} className="text-[#DC2626]" />
                      <span className="text-[10px] font-bold text-white uppercase tracking-wide">Support</span>
                    </div>
                    <div className="text-xs text-gray-500">support@oraforme.com</div>
                    <div className="text-xs text-gray-500">Lun–Ven · 8h–18h</div>
                  </li>
                </ul>
              </div>

            </div>

            <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-gray-600">© 2026 Oraforme. Tous droits réservés. · by POLYVALON TECHNOLOGY</span>
              <div className="flex items-center gap-5">
                <a href="/legal/cgu" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">CGU</a>
                <a href="/legal/privacy" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">Confidentialité</a>
                <a href="/legal/cookies" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">Cookies</a>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
  )
}
