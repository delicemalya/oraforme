'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Calculator, Users, Wallet, Bot, FileText, Package,
  ArrowRight, CheckCircle2, Star, Menu, X, Zap,
  Shield, Clock, Brain, BarChart2,
  ChevronRight, Sparkles, Lock, Globe, Mail,
  Building2, ShoppingCart, School,
} from 'lucide-react'

// ── Data ─────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Modules',   href: '#modules' },
  { label: 'À propos',  href: '#apropos' },
  { label: 'Tarifs',    href: '#tarifs' },
  { label: 'Contact',   href: 'mailto:contact@oraforme.com' },
]

const MODULES = [
  { icon: Calculator,   label: 'Comptabilité' },
  { icon: Users,        label: 'RH & Paie' },
  { icon: Wallet,       label: 'Trésorerie' },
  { icon: FileText,     label: 'Facturation' },
  { icon: Package,      label: 'Stock' },
  { icon: Bot,          label: 'MIAA+ IA' },
  { icon: Building2,    label: 'Hôtellerie' },
  { icon: School,       label: 'Éducation' },
]

const MIAA_POINTS = [
  { icon: Brain,     text: 'Analyse prédictive de votre trésorerie' },
  { icon: BarChart2, text: 'Rapports financiers générés automatiquement' },
  { icon: Zap,       text: 'Alertes intelligentes sur vos anomalies' },
  { icon: Shield,    text: 'Détection des risques comptables en temps réel' },
]

const PLANS = [
  {
    name: 'Starter',
    price: '15 000',
    currency: 'FCFA',
    period: '/ mois',
    desc: 'Pour indépendants et petites structures',
    highlight: false,
    features: [
      'Comptabilité complète',
      'RH & Paie jusqu\'à 10 employés',
      'Facturation illimitée',
      'Trésorerie & rapports',
      'MIAA+ Standard',
      '3 utilisateurs inclus',
    ],
  },
  {
    name: 'Business',
    price: '25 000',
    currency: 'FCFA',
    period: '/ mois',
    desc: 'Pour PME, cabinets et secteurs spécialisés',
    highlight: true,
    features: [
      'Tout Starter inclus',
      'RH & Paie illimitée',
      'Modules secteur activés',
      'Analytics & BI avancés',
      'MIAA+ Premium complet',
      '25 utilisateurs inclus',
    ],
  },
]

const REGIONS = [
  { name: 'Europe',    flag: '🇪🇺', cities: 'France · Portugal · Belgique' },
  { name: 'Afrique',   flag: '🌍', cities: 'Congo · Sénégal · Côte d\'Ivoire' },
  { name: 'Amériques', flag: '🌎', cities: 'Canada · Brésil · USA' },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [email, setEmail] = useState('')

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
            <div className="flex-1 bg-[#111827] flex items-center px-8 sm:px-12 lg:px-16 py-20">
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
                      15 000 <span className="text-sm font-bold">FCFA</span>
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
                  <button className="bt inline-flex items-center gap-2 text-gray-300 hover:text-white font-semibold text-sm px-6 py-4 rounded-xl border border-white/15 hover:border-white/40">
                    ▶ Voir la démo
                  </button>
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
              <div className="absolute inset-0 bg-gradient-to-r from-[#111827]/50 to-transparent" />
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
                className="bt shrink-0 bg-[#111827] hover:bg-black text-white font-bold text-sm px-6 py-3 rounded-xl whitespace-nowrap inline-flex items-center gap-1.5">
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
                Nos Modules de Gestion
              </h2>
              <p className="text-[#6B7280] max-w-md mx-auto text-sm">
                Une solution intégrée qui couvre tous les aspects de votre activité.
              </p>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {MODULES.map(m => {
                const Icon = m.icon
                return (
                  <div key={m.label}
                    className="ch flex flex-col items-center gap-3 py-6 px-3 rounded-2xl border border-gray-100 bg-gray-50 text-center">
                    <div className="w-12 h-12 rounded-xl bg-[#DC2626]/8 border border-[#DC2626]/15 flex items-center justify-center">
                      <Icon size={22} className="text-[#DC2626]" />
                    </div>
                    <span className="text-[11px] font-bold text-[#374151] leading-tight">{m.label}</span>
                  </div>
                )
              })}
            </div>

            <div className="text-center mt-10">
              <Link href="/onboarding"
                className="bt inline-flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-sm px-7 py-3.5 rounded-xl">
                Voir tous les modules <ArrowRight size={14} />
              </Link>
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
              <Link href="/onboarding"
                className="bt inline-flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-sm px-7 py-3.5 rounded-xl w-fit">
                En savoir plus <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>

        {/* ══ IA — texte gauche / image droite (fond sombre) ════════════════════ */}
        <section className="bg-[#0F172A]">
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
              <Link href="/onboarding"
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
              <div className="absolute inset-0 bg-gradient-to-r from-[#0F172A]/60 to-transparent" />
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
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50 border-t border-gray-100">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-10">
              <span className="text-[10px] font-bold text-[#DC2626] uppercase tracking-[0.18em]">ZONES DE SERVICE</span>
              <h2 className="text-2xl sm:text-3xl font-black text-[#111827] mt-2">Notre présence internationale</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-5">
              {REGIONS.map(r => (
                <div key={r.name} className="ch bg-white rounded-2xl p-7 border border-gray-200 text-center">
                  <div className="text-4xl mb-3">{r.flag}</div>
                  <div className="font-black text-[#111827] text-lg mb-1">{r.name}</div>
                  <div className="text-sm text-[#6B7280]">{r.cities}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ CTA FORM — image bg + formulaire ════════════════════════════════ */}
        <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src="/images/office-team.jpg"
              alt="Bureau Oraforme"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[#111827]/85" />
          </div>

          <div className="relative max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">

              <div>
                <span className="text-[10px] font-bold text-[#F87171] uppercase tracking-[0.18em] mb-4 block">
                  COMMENCER MAINTENANT
                </span>
                <h2 className="text-3xl sm:text-4xl font-black text-white mb-5 leading-tight">
                  Obtenez votre<br />accès gratuit
                </h2>
                <p className="text-gray-300 text-sm leading-relaxed mb-7">
                  Créez votre compte en 2 minutes et commencez à piloter votre entreprise avec
                  l&apos;intelligence artificielle MIAA+. Aucune carte bancaire requise.
                </p>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Mail size={13} className="text-[#DC2626]" />
                  <a href="mailto:contact@oraforme.com" className="hover:text-white transition-colors">
                    contact@oraforme.com
                  </a>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-8 shadow-2xl">
                <h3 className="text-sm font-black text-[#111827] mb-6 uppercase tracking-wider">
                  CRÉER MON COMPTE GRATUIT
                </h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Nom de l'entreprise"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#DC2626] transition-colors"
                  />
                  <input
                    type="email"
                    placeholder="Adresse e-mail professionnelle"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#DC2626] transition-colors"
                  />
                  <input
                    type="tel"
                    placeholder="Téléphone (optionnel)"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#DC2626] transition-colors"
                  />
                  <select className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#DC2626] transition-colors text-[#374151]">
                    <option value="">Secteur d&apos;activité</option>
                    <option>Commerce & Distribution</option>
                    <option>Services & Conseil</option>
                    <option>Hôtellerie & Restauration</option>
                    <option>Éducation & Formation</option>
                    <option>Santé & Pharmacie</option>
                    <option>Autre</option>
                  </select>
                  <Link href="/onboarding"
                    className="bt block w-full text-center bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-sm py-4 rounded-xl uppercase tracking-wide">
                    COMMENCER GRATUITEMENT
                  </Link>
                  <p className="text-[10px] text-gray-400 text-center">
                    En créant un compte, vous acceptez nos{' '}
                    <a href="#" className="text-[#DC2626] hover:underline">CGU</a>
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ══ TARIFS ════════════════════════════════════════════════════════════ */}
        <section id="tarifs" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <span className="text-[10px] font-bold text-[#DC2626] uppercase tracking-[0.18em]">TARIFS</span>
              <h2 className="text-3xl sm:text-4xl font-black text-[#111827] tracking-tight mt-3 mb-3">
                Simple, transparent, sans surprise
              </h2>
              <p className="text-[#6B7280] text-sm">30 jours d&apos;essai gratuit · Aucune carte bancaire requise</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              {PLANS.map(plan => (
                <div key={plan.name}
                  className={`ch rounded-2xl p-8 border relative ${
                    plan.highlight
                      ? 'bg-[#111827] border-[#DC2626]/40 shadow-2xl'
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                  {plan.highlight && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#DC2626] text-white text-[9px] font-bold px-4 py-1 rounded-full whitespace-nowrap uppercase tracking-wide">
                      LE PLUS POPULAIRE
                    </div>
                  )}
                  <div className={`text-xl font-black mb-1 ${plan.highlight ? 'text-white' : 'text-[#111827]'}`}>
                    {plan.name}
                  </div>
                  <div className={`text-xs mb-6 ${plan.highlight ? 'text-gray-400' : 'text-[#6B7280]'}`}>
                    {plan.desc}
                  </div>
                  <div className="flex items-baseline gap-1 mb-7">
                    <span className={`text-4xl font-black ${plan.highlight ? 'text-white' : 'text-[#111827]'}`}>
                      {plan.price}
                    </span>
                    <span className={`text-sm ${plan.highlight ? 'text-gray-400' : 'text-[#6B7280]'}`}>
                      {plan.currency} {plan.period}
                    </span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map(f => (
                      <li key={f}
                        className={`flex items-center gap-2.5 text-sm font-medium ${
                          plan.highlight ? 'text-gray-200' : 'text-[#374151]'
                        }`}>
                        <CheckCircle2 size={14} className={`shrink-0 ${plan.highlight ? 'text-[#F87171]' : 'text-[#DC2626]'}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/onboarding"
                    className="bt block text-center text-sm font-bold py-3.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white uppercase tracking-wide">
                    Commencer gratuitement
                  </Link>
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-[#9CA3AF] mt-8">
              Besoin d&apos;une solution sur mesure pour un grand groupe ?{' '}
              <a href="mailto:contact@oraforme.com" className="text-[#DC2626] font-semibold hover:underline">
                Contactez-nous
              </a>
            </p>
          </div>
        </section>

        {/* ══ FOOTER ════════════════════════════════════════════════════════════ */}
        <footer className="bg-[#0D1117] border-t border-white/5 pt-16 pb-8 px-4 sm:px-6 lg:px-8">
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
              <span className="text-xs text-gray-600">© 2026 Oraforme. Tous droits réservés.</span>
              <div className="flex items-center gap-5">
                {['CGU', 'Confidentialité', 'Cookies'].map(l => (
                  <a key={l} href="#"
                    className="text-xs text-gray-600 hover:text-gray-400 transition-colors">{l}</a>
                ))}
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
  )
}
