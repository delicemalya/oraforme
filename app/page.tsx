'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Calculator, Users, Wallet, Bot, FileText, Package,
  ArrowRight, CheckCircle2, Star, Menu, X, Zap,
  Shield, Clock, TrendingUp, Brain, BarChart2,
  ChevronRight, Sparkles, Lock, Globe,
} from 'lucide-react'

// ── Data ──────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Modules',  href: '#modules' },
  { label: 'Tarifs',   href: '#tarifs' },
  { label: 'À propos', href: '#apropos' },
]

const FEATURES = [
  {
    icon: Calculator,
    title: 'Comptabilité',
    desc: 'Plan comptable automatique, bilan, compte de résultat et grand livre générés en temps réel.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Users,
    title: 'RH & Paie',
    desc: 'Bulletins de salaire, congés, contrats et déclarations sociales en quelques clics.',
    color: 'bg-green-50 text-green-600',
  },
  {
    icon: Wallet,
    title: 'Trésorerie',
    desc: 'Suivi des flux financiers en temps réel, prévisions et rapprochement bancaire automatique.',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    icon: Bot,
    title: 'MIAA+ Intelligence IA',
    desc: 'Votre assistant IA analyse vos données, génère des rapports et prédit vos besoins.',
    color: 'bg-red-50 text-red-600',
  },
  {
    icon: FileText,
    title: 'Facturation',
    desc: 'Devis, factures et avoirs professionnels envoyés en un clic, relances automatiques.',
    color: 'bg-orange-50 text-orange-600',
  },
  {
    icon: Package,
    title: 'Stock & Inventaire',
    desc: 'Gestion des articles, alertes de rupture automatiques et valorisation du stock.',
    color: 'bg-teal-50 text-teal-600',
  },
]

const MIAA_FEATURES = [
  { icon: Brain,     text: 'Analyse prédictive de votre trésorerie' },
  { icon: BarChart2, text: 'Rapports financiers générés automatiquement' },
  { icon: Zap,       text: 'Alertes intelligentes sur vos anomalies' },
  { icon: Shield,    text: 'Détection des risques comptables en temps réel' },
  { icon: Globe,     text: 'Conformité fiscale et réglementaire assurée' },
  { icon: Clock,     text: 'Disponible 24h/24 — réponses instantanées' },
]

const TESTIMONIALS = [
  {
    name: 'Marc Dubois',
    role: 'Directeur Financier · Paris, France',
    avatar: 'MD',
    stars: 5,
    quote: 'Oraforme a réduit notre temps de clôture mensuelle de 3 jours à quelques heures. MIAA+ identifie des anomalies que nos équipes auraient manqué.',
  },
  {
    name: 'Amara Sow',
    role: 'Fondatrice & CEO · Dakar, Sénégal',
    avatar: 'AS',
    stars: 5,
    quote: 'La plateforme tout-en-un dont j\'avais besoin. Comptabilité, paie et trésorerie enfin centralisées. Mon équipe gagne 2 heures par jour.',
  },
  {
    name: 'Ricardo Mendes',
    role: 'Gérant · Lisbonne, Portugal',
    avatar: 'RM',
    stars: 5,
    quote: 'L\'assistant IA répond à mes questions comptables instantanément. C\'est comme avoir un expert-comptable disponible en permanence.',
  },
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
    cta: 'Commencer gratuitement',
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
    cta: 'Commencer gratuitement',
  },
]

const STATS = [
  { value: '12+',   label: 'Modules métier' },
  { value: '99.9%', label: 'Disponibilité' },
  { value: '24/7',  label: 'Support & IA' },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      {/* Keyframe animations CSS */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .anim-1 { animation: fadeUp 0.55s ease both; }
        .anim-2 { animation: fadeUp 0.55s ease 0.1s both; }
        .anim-3 { animation: fadeUp 0.55s ease 0.2s both; }
        .anim-4 { animation: fadeUp 0.55s ease 0.3s both; }
        .anim-fade { animation: fadeIn 0.7s ease both; }
        .card-hover {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.08);
        }
        .btn-transition { transition: background-color 0.18s ease, transform 0.15s ease; }
        .btn-transition:hover { transform: translateY(-1px); }
        .btn-transition:active { transform: translateY(0); }
      `}</style>

      <div className="font-sans bg-white text-[#111827] overflow-x-hidden">

        {/* ══ 1. NAVBAR ══════════════════════════════════════════════════════ */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/96 backdrop-blur-md border-b border-gray-100 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-6" style={{ height: 68 }}>

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-[#DC2626] flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
              </div>
              <span className="text-lg font-black text-[#111827] tracking-tight">oraforme</span>
            </Link>

            {/* Nav links — desktop */}
            <div className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map(l => (
                <a key={l.href} href={l.href}
                  className="text-sm font-semibold text-[#6B7280] hover:text-[#111827] transition-colors">
                  {l.label}
                </a>
              ))}
            </div>

            {/* CTA — desktop */}
            <div className="hidden md:flex items-center gap-3">
              <Link href="/login"
                className="text-sm font-semibold text-[#374151] hover:text-[#111827] px-4 py-2.5 border border-gray-200 rounded-xl transition-colors">
                Se connecter
              </Link>
              <Link href="/onboarding"
                className="btn-transition text-sm font-bold text-white bg-[#DC2626] hover:bg-[#B91C1C] px-5 py-2.5 rounded-xl inline-flex items-center gap-2">
                Commencer gratuitement <ArrowRight size={14} />
              </Link>
            </div>

            {/* Hamburger — mobile */}
            <button
              className="md:hidden p-2 rounded-lg text-[#6B7280] hover:bg-gray-100 transition-colors"
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Menu">
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {/* Mobile menu */}
          {menuOpen && (
            <div className="md:hidden bg-white border-t border-gray-100 px-6 py-5 flex flex-col gap-4 anim-fade">
              {NAV_LINKS.map(l => (
                <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
                  className="text-base font-semibold text-[#111827] hover:text-[#DC2626] transition-colors">
                  {l.label}
                </a>
              ))}
              <div className="flex flex-col gap-3 pt-4 border-t border-gray-100">
                <Link href="/login" onClick={() => setMenuOpen(false)}
                  className="text-center text-sm font-semibold text-[#374151] border border-gray-200 rounded-xl py-3">
                  Se connecter
                </Link>
                <Link href="/onboarding" onClick={() => setMenuOpen(false)}
                  className="text-center text-sm font-bold text-white bg-[#DC2626] rounded-xl py-3">
                  Commencer gratuitement
                </Link>
              </div>
            </div>
          )}
        </nav>

        {/* ══ 2. HERO (sombre) ═══════════════════════════════════════════════ */}
        <section className="bg-[#111827] min-h-screen flex items-center pt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 w-full">
            <div className="max-w-4xl mx-auto text-center">

              {/* Badge */}
              <div className="anim-1 inline-flex items-center gap-2 bg-[#DC2626]/10 border border-[#DC2626]/20 text-[#F87171] text-xs font-bold uppercase tracking-widest rounded-full px-4 py-2 mb-8">
                <Sparkles size={12} className="shrink-0" />
                Propulsé par MIAA+ — Intelligence IA Métier
              </div>

              {/* Titre */}
              <h1 className="anim-2 text-4xl sm:text-5xl lg:text-[62px] font-black text-white leading-[1.08] tracking-tight mb-6">
                Gérez votre entreprise<br />
                avec{' '}
                <span className="text-[#DC2626]">l&apos;intelligence artificielle</span>
              </h1>

              {/* Sous-titre */}
              <p className="anim-3 text-lg sm:text-xl text-gray-300 leading-relaxed max-w-2xl mx-auto mb-10">
                La plateforme tout-en-un qui automatise votre comptabilité, RH, trésorerie et bien plus — propulsée par MIAA+
              </p>

              {/* CTAs */}
              <div className="anim-4 flex flex-wrap items-center justify-center gap-4 mb-16">
                <Link href="/onboarding"
                  className="btn-transition inline-flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-base px-8 py-4 rounded-xl shadow-xl shadow-red-900/30">
                  Commencer gratuitement — 30 jours <ArrowRight size={16} />
                </Link>
                <Link href="/login"
                  className="btn-transition inline-flex items-center gap-2 text-gray-300 hover:text-white font-semibold text-base px-7 py-4 rounded-xl border border-white/15 hover:border-white/40">
                  Se connecter <ChevronRight size={16} />
                </Link>
              </div>

              {/* Stats */}
              <div className="anim-4 grid grid-cols-3 gap-8 max-w-xl mx-auto pt-12 border-t border-white/10">
                {STATS.map(s => (
                  <div key={s.label} className="text-center">
                    <div className="text-3xl sm:text-4xl font-black text-white mb-1">{s.value}</div>
                    <div className="text-xs sm:text-sm text-gray-400 font-medium">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══ 3. FEATURES (clair) ════════════════════════════════════════════ */}
        <section id="modules" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-xs font-bold text-[#DC2626] uppercase tracking-[0.16em]">MODULES INTÉGRÉS</span>
              <h2 className="text-3xl sm:text-4xl font-black text-[#111827] tracking-tight mt-3 mb-4">
                Tout ce dont votre équipe a besoin
              </h2>
              <p className="text-lg text-[#6B7280] max-w-xl mx-auto leading-relaxed">
                Une solution de gestion complète, pensée pour simplifier chaque aspect de votre activité.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f) => {
                const Icon = f.icon
                return (
                  <div key={f.title} className="card-hover bg-gray-50 rounded-2xl p-6 border border-gray-100">
                    <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center mb-4`}>
                      <Icon size={22} />
                    </div>
                    <h3 className="text-base font-bold text-[#111827] mb-2">{f.title}</h3>
                    <p className="text-sm text-[#6B7280] leading-relaxed">{f.desc}</p>
                  </div>
                )
              })}
            </div>

            <div className="text-center mt-12">
              <Link href="/onboarding"
                className="btn-transition inline-flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold px-7 py-3.5 rounded-xl">
                Découvrir tous les modules <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>

        {/* ══ 4. SECTION IA (sombre) ═════════════════════════════════════════ */}
        <section id="apropos" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#111827]">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">

              {/* Texte gauche */}
              <div>
                <span className="text-xs font-bold text-[#F87171] uppercase tracking-[0.16em]">INTELLIGENCE ARTIFICIELLE</span>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-4 mb-6 leading-tight">
                  Votre assistant IA métier<br />
                  <span className="text-[#DC2626]">intégré nativement</span>
                </h2>
                <p className="text-gray-300 text-lg leading-relaxed mb-10">
                  MIAA+ analyse vos données en temps réel, génère vos rapports automatiquement et vous aide à prendre de meilleures décisions — sans aucune expertise technique requise.
                </p>
                <Link href="/onboarding"
                  className="btn-transition inline-flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold px-7 py-3.5 rounded-xl">
                  Essayer MIAA+ gratuitement <ArrowRight size={15} />
                </Link>
              </div>

              {/* Grille features IA droite */}
              <div className="grid grid-cols-2 gap-4">
                {MIAA_FEATURES.map((f) => {
                  const Icon = f.icon
                  return (
                    <div key={f.text}
                      className="card-hover bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#DC2626]/15 flex items-center justify-center">
                        <Icon size={18} className="text-[#F87171]" />
                      </div>
                      <p className="text-sm text-gray-300 font-medium leading-snug">{f.text}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ══ 5. TÉMOIGNAGES (clair) ═════════════════════════════════════════ */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-xs font-bold text-[#DC2626] uppercase tracking-[0.16em]">TÉMOIGNAGES</span>
              <h2 className="text-3xl sm:text-4xl font-black text-[#111827] tracking-tight mt-3 mb-4">
                Ils ont transformé leur gestion
              </h2>
              <div className="flex items-center justify-center gap-1 mt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={16} className="text-yellow-400 fill-yellow-400" />
                ))}
                <span className="ml-2 text-sm text-[#6B7280] font-medium">4.9 / 5 — Plus de 200 avis</span>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-6">
              {TESTIMONIALS.map((t) => (
                <div key={t.name} className="card-hover bg-white rounded-2xl p-7 border border-gray-100 flex flex-col">
                  <div className="flex gap-1 mb-5">
                    {Array.from({ length: t.stars }).map((_, j) => (
                      <Star key={j} size={13} className="text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm text-[#374151] leading-relaxed flex-1 mb-6">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="flex items-center gap-3 pt-5 border-t border-gray-100">
                    <div className="w-10 h-10 rounded-full bg-[#DC2626] flex items-center justify-center font-bold text-white text-sm shrink-0">
                      {t.avatar}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#111827]">{t.name}</div>
                      <div className="text-xs text-[#9CA3AF]">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ 6. TARIFS (clair) ══════════════════════════════════════════════ */}
        <section id="tarifs" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-xs font-bold text-[#DC2626] uppercase tracking-[0.16em]">TARIFS</span>
              <h2 className="text-3xl sm:text-4xl font-black text-[#111827] tracking-tight mt-3 mb-4">
                Simple, transparent, sans surprise
              </h2>
              <p className="text-lg text-[#6B7280]">30 jours d&apos;essai gratuit · Aucune carte bancaire requise</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              {PLANS.map((plan) => (
                <div key={plan.name}
                  className={`card-hover rounded-2xl p-8 border relative ${
                    plan.highlight
                      ? 'bg-[#111827] border-[#DC2626]/40 shadow-2xl'
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                  {plan.highlight && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#DC2626] text-white text-[10px] font-bold px-4 py-1 rounded-full whitespace-nowrap">
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
                      <li key={f} className={`flex items-center gap-2.5 text-sm font-medium ${plan.highlight ? 'text-gray-200' : 'text-[#374151]'}`}>
                        <CheckCircle2 size={14} className={`shrink-0 ${plan.highlight ? 'text-[#F87171]' : 'text-[#DC2626]'}`} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link href="/onboarding"
                    className={`btn-transition block text-center text-sm font-bold py-3.5 rounded-xl ${
                      plan.highlight
                        ? 'bg-[#DC2626] hover:bg-[#B91C1C] text-white'
                        : 'bg-[#DC2626] hover:bg-[#B91C1C] text-white'
                    }`}>
                    {plan.cta}
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

        {/* ══ 7. CTA FINAL (sombre) ══════════════════════════════════════════ */}
        <section className="py-28 px-4 sm:px-6 lg:px-8 bg-[#111827]">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-[#DC2626]/10 border border-[#DC2626]/20 text-[#F87171] text-xs font-bold uppercase tracking-widest rounded-full px-4 py-2 mb-8">
              <TrendingUp size={12} />
              Résultats mesurables dès le premier mois
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-5 leading-tight">
              Prêt à transformer<br />votre gestion ?
            </h2>
            <p className="text-lg text-gray-300 leading-relaxed mb-10">
              Rejoignez des centaines d&apos;entreprises qui ont choisi l&apos;intelligence artificielle pour piloter leur activité.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/onboarding"
                className="btn-transition inline-flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-base px-8 py-4 rounded-xl shadow-xl shadow-red-900/30">
                Démarrer gratuitement — 30 jours <ArrowRight size={16} />
              </Link>
              <Link href="/login"
                className="btn-transition inline-flex items-center gap-2 text-gray-300 hover:text-white font-semibold text-base px-7 py-4 rounded-xl border border-white/20 hover:border-white/50">
                J&apos;ai déjà un compte
              </Link>
            </div>
          </div>
        </section>

        {/* ══ FOOTER ═════════════════════════════════════════════════════════ */}
        <footer className="bg-[#0D1117] py-12 px-4 sm:px-6 lg:px-8 border-t border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
              <Link href="/" className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#DC2626] flex items-center justify-center">
                  <Sparkles size={13} className="text-white" />
                </div>
                <span className="text-base font-black text-white tracking-tight">oraforme</span>
              </Link>
              <div className="flex items-center gap-8">
                {[
                  { label: 'Modules',  href: '#modules' },
                  { label: 'Tarifs',   href: '#tarifs' },
                  { label: 'Contact',  href: 'mailto:contact@oraforme.com' },
                  { label: 'CGU',      href: '#' },
                ].map(l => (
                  <a key={l.label} href={l.href}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors font-medium">
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
            <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-gray-600">© 2026 Oraforme. Tous droits réservés.</span>
              <div className="flex items-center gap-2">
                <Lock size={11} className="text-gray-600" />
                <span className="text-xs text-gray-600">Données chiffrées · Hébergement sécurisé</span>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
  )
}
