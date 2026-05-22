'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  FileText, Wallet, Users, Package, ChefHat, GraduationCap,
  Activity, ShoppingCart, Smartphone, Receipt, BarChart2, Bot,
  Building2, Briefcase, CheckCircle2, ArrowRight, Star,
  Shield, X, Menu, Mail, MapPin,
} from 'lucide-react'

// ── Data ─────────────────────────────────────────────────────────────────────

const MODULES = [
  { icon: FileText,      title: 'Facturation',    desc: 'Factures et devis en quelques clics, conformes OHADA' },
  { icon: Wallet,        title: 'Trésorerie',     desc: 'Flux financiers en temps réel, rapprochement bancaire' },
  { icon: Users,         title: 'RH & Paie',      desc: 'Salaires, congés et bulletins conformes droit congolais' },
  { icon: Package,       title: 'Stock',           desc: 'Inventaire temps réel, alertes rupture automatiques' },
  { icon: ChefHat,       title: 'Restaurant',     desc: 'POS tactile, gestion tables, rapports caisse quotidiens' },
  { icon: GraduationCap, title: 'École',           desc: 'Inscriptions, notes, bulletins et frais scolaires' },
  { icon: Activity,      title: 'Santé',           desc: 'Consultations, ordonnances, stock médicaments' },
  { icon: ShoppingCart,  title: 'Achats',          desc: 'Commandes fournisseurs, réception, contrôle qualité' },
  { icon: Smartphone,    title: 'Mobile Money',    desc: 'Airtel Money, MTN MoMo — collecte de paiements intégrée' },
  { icon: Receipt,       title: 'Dépenses',        desc: 'Suivi des charges, notes de frais, justificatifs' },
  { icon: BarChart2,     title: 'Rapports',        desc: 'Tableaux de bord, KPIs, exports PDF et Excel' },
  { icon: Bot,           title: 'MIAA+',           desc: 'Assistant IA — analyse, rapports auto, décisions assistées' },
]

const SECTORS = [
  { icon: Building2,     title: 'PME & Entreprises',    desc: 'Pilotez votre PME avec un ERP complet : comptabilité, facturation, trésorerie et RH dans une seule plateforme SYSCOHADA.', badge: 'Populaire' },
  { icon: GraduationCap, title: 'Écoles & Universités', desc: 'Inscriptions, notes, bulletins automatiques et frais scolaires — solution complète pour établissements d\'enseignement.', badge: '' },
  { icon: ChefHat,       title: 'Restaurants & Hôtels', desc: 'Du POS tactile à la gestion de cuisine. Réduisez le gaspillage et maximisez la rentabilité de votre établissement.', badge: '' },
  { icon: Briefcase,     title: 'Cabinets & Conseils',  desc: 'Gérez vos dossiers clients, honoraires et comptabilité SYSCOHADA depuis une interface unifiée.', badge: '' },
]

const TESTIMONIALS = [
  {
    name: 'Jean-Michel Boukaka',
    role: 'Directeur, PME SOGEC — Pointe-Noire',
    stars: 5,
    quote: 'Oraforme a transformé notre gestion. La comptabilité SYSCOHADA, la paie et la trésorerie — tout centralisé. Nous économisons 3 jours de travail par mois.',
    avatar: 'JB',
  },
  {
    name: 'Sandrine Moukassa',
    role: 'Directrice, Institut Sainte-Famille — Brazzaville',
    stars: 5,
    quote: 'Les bulletins s\'impriment en un clic, les frais se paient par Mobile Money. L\'école tourne maintenant avec deux fois moins d\'erreurs administratives.',
    avatar: 'SM',
  },
  {
    name: 'Patrick Ngoma',
    role: 'Gérant, Restaurant Le Flamboyant — Pointe-Noire',
    stars: 5,
    quote: 'MIAA+ m\'envoie chaque soir un résumé du chiffre d\'affaires du jour. Le POS est simple, les erreurs de caisse ont disparu. Je recommande sans hésiter.',
    avatar: 'PN',
  },
]

const PLANS = [
  {
    name: 'Gratuit',
    price: '0',
    period: 'pour toujours',
    desc: 'Pour découvrir et démarrer',
    features: ['1 utilisateur', '10 factures / mois', 'Trésorerie basique', 'Support communauté'],
    cta: 'Commencer gratuitement',
    href: '/register',
    highlight: false,
  },
  {
    name: 'Starter',
    price: '15 000',
    period: 'FCFA / mois',
    desc: 'TPE et auto-entrepreneurs',
    features: ['3 utilisateurs', 'Facturation illimitée', 'Stock & Inventaire', 'RH — 5 employés', 'Support email'],
    cta: 'Choisir Starter',
    href: '/register?plan=starter',
    highlight: false,
  },
  {
    name: 'Business',
    price: '35 000',
    period: 'FCFA / mois',
    desc: 'PME en croissance',
    features: ['10 utilisateurs', 'Tous les modules', 'SYSCOHADA complet', 'MIAA+ IA intégrée', 'Rapports avancés', 'Support prioritaire'],
    cta: 'Choisir Business',
    href: '/register?plan=business',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Sur devis',
    period: '',
    desc: 'Groupes et multi-sites',
    features: ['Utilisateurs illimités', 'Multi-sites', 'API & intégrations', 'MIAA+ illimité', 'Manager dédié', 'SLA 99.9%'],
    cta: 'Nous contacter',
    href: 'mailto:contact@oraforme.com',
    highlight: false,
  },
]

const NAV_LINKS = [
  { label: 'Modules',  href: '#modules' },
  { label: 'Secteurs', href: '#secteurs' },
  { label: 'Tarifs',   href: '#tarifs' },
  { label: 'À propos', href: '#apropos' },
  { label: 'Contact',  href: '#contact' },
]

const TRUST_BADGES = ['OHADA', 'SYSCOHADA', 'CNSS Congo', 'TVA Congo', 'Airtel Money', 'MTN MoMo']

// ── FadeIn ────────────────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0, className = '' }: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="font-sans bg-white text-[#0F172A] overflow-x-hidden" style={{ scrollBehavior: 'smooth' }}>

      {/* ══ NAVBAR ══════════════════════════════════════════════════════════ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Oraforme" className="h-12 w-auto shrink-0" />

          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href}
                className="text-sm font-semibold text-[#64748B] hover:text-teal-500 transition-colors">
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/login"
              className="text-sm font-semibold text-[#64748B] hover:text-[#0F172A] px-4 py-2.5 border border-gray-200 rounded-xl transition-colors">
              Se connecter
            </Link>
            <Link href="/register"
              className="text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 px-5 py-2.5 rounded-xl transition-colors inline-flex items-center gap-2 shadow-lg shadow-orange-100">
              Démarrer gratuitement <ArrowRight size={14} />
            </Link>
          </div>

          <button className="md:hidden p-2 rounded-lg text-[#64748B] hover:bg-gray-100"
            onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t border-gray-100 overflow-hidden"
            >
              <div className="px-6 py-5 flex flex-col gap-4">
                {NAV_LINKS.map(l => (
                  <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
                    className="text-base font-semibold text-[#0F172A] hover:text-teal-500">
                    {l.label}
                  </a>
                ))}
                <div className="flex flex-col gap-3 pt-4 border-t border-gray-100">
                  <Link href="/login" className="text-center text-sm font-semibold text-[#64748B] border border-gray-200 rounded-xl py-3">
                    Se connecter
                  </Link>
                  <Link href="/register" className="text-center text-sm font-bold text-white bg-orange-500 rounded-xl py-3">
                    Démarrer gratuitement
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <section className="min-h-screen flex items-center pt-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

            {/* Left — text */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="inline-flex items-center gap-3 mb-8"
              >
                <div className="w-1 h-10 bg-teal-500 rounded-full" />
                <span className="text-sm font-bold text-teal-600 uppercase tracking-widest">
                  MIAA+ · ASSISTANT IA INTÉGRÉ
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.05 }}
                className="text-5xl sm:text-6xl lg:text-[64px] font-black text-[#0F172A] leading-[1.05] tracking-tight mb-6"
              >
                L&apos;ERP conçu<br />pour les{' '}
                <span className="text-teal-500">entreprises<br />africaines</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-lg text-[#64748B] leading-relaxed mb-8 max-w-lg"
              >
                Comptabilité SYSCOHADA, RH & Paie, Trésorerie, Scolarité, Restaurant — une seule plateforme pensée pour l&apos;Afrique, accessible depuis votre téléphone.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="flex flex-wrap gap-4 mb-10"
              >
                <Link href="/register"
                  className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-base px-8 py-4 rounded-xl transition-colors shadow-xl shadow-orange-100">
                  Démarrer gratuitement <ArrowRight size={16} />
                </Link>
                <a href="#modules"
                  className="inline-flex items-center gap-2 text-[#0F172A] font-semibold text-base px-8 py-4 rounded-xl border-2 border-gray-200 hover:border-teal-300 hover:text-teal-600 transition-colors">
                  Voir les modules
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.18 }}
                className="flex flex-wrap items-center gap-2 mb-10"
              >
                {TRUST_BADGES.map(b => (
                  <span key={b} className="text-[11px] font-bold text-[#64748B] border border-gray-200 bg-gray-50 rounded-full px-3 py-1">
                    {b}
                  </span>
                ))}
              </motion.div>

              {/* Stats row — James style */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.22 }}
                className="grid grid-cols-3 gap-6 pt-8 border-t border-gray-100"
              >
                {[
                  { value: '50+',   label: 'Entreprises actives' },
                  { value: '12',    label: 'Modules métier' },
                  { value: '99.9%', label: 'Disponibilité' },
                ].map(s => (
                  <div key={s.value} className="text-center">
                    <div className="text-3xl font-black text-teal-500">{s.value}</div>
                    <div className="text-xs text-[#64748B] font-medium mt-1">{s.label}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right — photo */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.65, delay: 0.1 }}
              className="relative"
            >
              {/* Decorative bg square */}
              <div className="absolute -right-4 -bottom-4 w-full h-full rounded-3xl bg-teal-500/10 -z-0" />

              {/* Photo */}
              <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl shadow-teal-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/hero-vr.jpg"
                  alt="Entrepreneur africain avec technologie avancée"
                  className="w-full aspect-[4/5] object-cover"
                />
                {/* Overlay gradient bottom */}
                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="flex items-center gap-3 bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-xl">
                    <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                      <Shield size={18} className="text-teal-600" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#0F172A]">SYSCOHADA Conforme</div>
                      <div className="text-xs text-[#64748B]">Comptabilité officielle Congo</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating MIAA+ badge */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-5 -left-5 z-20 bg-white rounded-2xl p-4 shadow-2xl border border-gray-100 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                  <Bot size={18} className="text-orange-500" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0F172A]">MIAA+ a analysé</div>
                  <div className="text-[10px] text-[#94A3B8]">Rapport trésorerie ✓</div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══ TRUST STRIP ═════════════════════════════════════════════════════ */}
      <div className="bg-gray-50 border-y border-gray-100 py-5 px-4">
        <div className="max-w-7xl mx-auto flex items-center gap-6 flex-wrap justify-center sm:justify-between">
          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest shrink-0 hidden sm:block">NORMES & PAIEMENTS</span>
          <div className="flex items-center gap-8 flex-wrap justify-center">
            {TRUST_BADGES.map(b => (
              <span key={b} className="text-sm font-bold text-gray-300">{b}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ══ MODULES ═════════════════════════════════════════════════════════ */}
      <section id="modules" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-xs font-bold text-teal-500 uppercase tracking-[0.14em]">12 MODULES COMPLETS</span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0F172A] tracking-tight mt-3 mb-4">
              Tout ce dont votre entreprise a besoin
            </h2>
            <p className="text-lg text-[#64748B] max-w-xl mx-auto leading-relaxed">
              De la comptabilité SYSCOHADA à la gestion scolaire, chaque module est pensé pour les réalités africaines.
            </p>
          </FadeIn>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {MODULES.map((m, i) => {
              const Icon = m.icon
              return (
                <FadeIn key={m.title} delay={Math.min(i * 0.04, 0.32)}>
                  <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-50 transition-all duration-200 group cursor-pointer h-full">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mb-3 group-hover:bg-teal-100 transition-colors">
                      <Icon size={18} className="text-teal-500" />
                    </div>
                    <h3 className="text-sm font-bold text-[#0F172A] mb-1">{m.title}</h3>
                    <p className="text-xs text-[#64748B] leading-relaxed">{m.desc}</p>
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══ FEATURE SPLIT — teal background (James "Do Some Awesome Stuff") ══ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-teal-600 relative overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-white/5 pointer-events-none" />
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Image */}
            <FadeIn>
              <div className="relative">
                <div className="absolute -top-4 -left-4 w-full h-full rounded-3xl border-2 border-white/20" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/office-team.jpg"
                  alt="Équipe professionnelle africaine"
                  className="relative z-10 w-full aspect-[4/3] object-cover rounded-3xl shadow-2xl"
                />
                {/* Floating stat card */}
                <div className="absolute z-20 -bottom-6 -right-4 bg-white rounded-2xl p-5 shadow-2xl">
                  <div className="text-4xl font-black text-teal-600">50+</div>
                  <div className="text-sm text-[#64748B] font-medium">Entreprises actives</div>
                </div>
              </div>
            </FadeIn>

            {/* Text */}
            <FadeIn delay={0.12} className="text-white">
              <span className="text-teal-200 text-xs font-bold uppercase tracking-[0.14em]">NOTRE PLATEFORME</span>
              <h2 className="text-4xl sm:text-5xl font-black mt-4 mb-6 leading-tight">
                Gérez toute votre entreprise depuis un seul outil
              </h2>
              <p className="text-teal-100 text-lg leading-relaxed mb-10">
                Comptabilité SYSCOHADA, RH &amp; Paie, Trésorerie, Scolarité, Restaurant — une seule plateforme pensée pour l&apos;Afrique, accessible depuis votre téléphone.
              </p>
              <ul className="space-y-4 mb-10">
                {[
                  'Comptabilité SYSCOHADA certifiée',
                  'Paie et RH conformes au droit congolais',
                  'Mobile Money Airtel & MTN intégré',
                  'Assistant IA MIAA+ inclus dans tous les plans',
                  'Accessible depuis smartphone ou ordinateur',
                ].map(item => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle2 size={18} className="text-teal-200 shrink-0" />
                    <span className="text-white font-medium text-sm">{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/register"
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-4 rounded-xl transition-colors shadow-xl shadow-orange-900/20">
                Démarrer gratuitement <ArrowRight size={16} />
              </Link>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ══ SECTORS ═════════════════════════════════════════════════════════ */}
      <section id="secteurs" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-xs font-bold text-teal-500 uppercase tracking-[0.14em]">SOLUTIONS PAR SECTEUR</span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0F172A] tracking-tight mt-3 mb-4">
              Adapté à chaque métier
            </h2>
            <p className="text-lg text-[#64748B] max-w-xl mx-auto leading-relaxed">
              Que vous soyez une PME, une école ou un restaurant, Oraforme s&apos;adapte précisément à votre secteur.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SECTORS.map((s, i) => {
              const Icon = s.icon
              return (
                <FadeIn key={s.title} delay={i * 0.08}>
                  <div className="relative bg-white rounded-2xl p-6 border border-gray-100 hover:border-teal-200 hover:shadow-xl hover:shadow-teal-50 transition-all duration-200 h-full group">
                    {s.badge && (
                      <span className="absolute top-4 right-4 text-[9px] font-bold text-orange-600 bg-orange-50 border border-orange-100 rounded-full px-2 py-0.5">
                        {s.badge}
                      </span>
                    )}
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center mb-4 group-hover:bg-teal-100 transition-colors">
                      <Icon size={22} className="text-teal-600" />
                    </div>
                    <h3 className="text-base font-bold text-[#0F172A] mb-2">{s.title}</h3>
                    <p className="text-sm text-[#64748B] leading-relaxed">{s.desc}</p>
                  </div>
                </FadeIn>
              )
            })}
          </div>

          {/* Photo showcase — VR futuristic */}
          <FadeIn className="mt-16">
            <div className="relative rounded-3xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/vr-futuristic.jpg"
                alt="Technologie avancée pour entreprises africaines"
                className="w-full h-72 sm:h-96 object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-teal-900/80 via-teal-900/40 to-transparent" />
              <div className="absolute inset-0 flex items-center px-10 sm:px-16">
                <div className="max-w-lg">
                  <span className="text-teal-300 text-xs font-bold uppercase tracking-widest">TECHNOLOGIE AVANCÉE</span>
                  <h3 className="text-3xl sm:text-4xl font-black text-white mt-3 mb-4 leading-tight">
                    L&apos;avenir de la gestion d&apos;entreprise en Afrique
                  </h3>
                  <p className="text-teal-100 text-sm leading-relaxed mb-6">
                    Intelligence artificielle, Mobile Money, comptabilité automatique — Oraforme vous connecte à la technologie de demain.
                  </p>
                  <Link href="/register"
                    className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-xl transition-colors">
                    Découvrir la plateforme <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══ WHY ORAFORME — image cards (portfolio style) ════════════════════ */}
      <section id="apropos" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-xs font-bold text-teal-500 uppercase tracking-[0.14em]">POURQUOI ORAFORME</span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0F172A] tracking-tight mt-3 mb-4">
              Fait pour vous, fait pour l&apos;Afrique
            </h2>
            <p className="text-lg text-[#64748B] max-w-lg mx-auto leading-relaxed">
              Trois piliers qui font d&apos;Oraforme la solution préférée des entrepreneurs africains.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                img: '/images/mobile-payment.jpg',
                accent: 'bg-orange-500',
                tag: 'MOBILE MONEY',
                title: 'Mobile Money natif',
                desc: 'Collectez vos paiements directement via Airtel Money et MTN MoMo. Vos clients paient comme ils le font naturellement, depuis leur téléphone.',
              },
              {
                img: '/images/analytics.jpg',
                accent: 'bg-teal-500',
                tag: 'ANALYTIQUE',
                title: 'Rapports & Tableaux de bord',
                desc: 'KPIs en temps réel, exports PDF et Excel, rapports SYSCOHADA — toutes vos données financières en un coup d\'œil.',
              },
              {
                img: '/images/ai-miaa.jpg',
                accent: 'bg-indigo-500',
                tag: 'INTELLIGENCE ARTIFICIELLE',
                title: 'IA intégrée — MIAA+',
                desc: 'Votre assistant intelligent analyse vos données, génère vos rapports automatiquement et vous aide à prendre de meilleures décisions métier.',
              },
            ].map((item, i) => (
              <FadeIn key={item.title} delay={i * 0.1}>
                <div className="rounded-3xl overflow-hidden border border-gray-100 hover:shadow-2xl hover:shadow-teal-50 transition-all duration-300 group h-full flex flex-col">
                  <div className="relative aspect-[16/10] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.img}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <span className={`absolute top-4 left-4 ${item.accent} text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full`}>
                      {item.tag}
                    </span>
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="text-lg font-bold text-[#0F172A] mb-3">{item.title}</h3>
                    <p className="text-sm text-[#64748B] leading-relaxed flex-1">{item.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* Congo/Afrique card */}
          <FadeIn className="mt-8">
            <div className="bg-gray-50 rounded-3xl p-8 sm:p-12 border border-gray-100 text-center">
              <div className="text-5xl mb-5">🇨🇬</div>
              <h3 className="text-2xl font-bold text-[#0F172A] mb-4">Fait pour le Congo</h3>
              <p className="text-[#64748B] max-w-2xl mx-auto leading-relaxed">
                SYSCOHADA rénové, TVA Congo, CNSS, droit du travail congolais — tout est intégré nativement. Pas besoin d&apos;adapter un outil étranger à vos réalités.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══ TESTIMONIALS ════════════════════════════════════════════════════ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-xs font-bold text-teal-500 uppercase tracking-[0.14em]">TÉMOIGNAGES</span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0F172A] tracking-tight mt-3 mb-4">
              Ce que disent nos clients
            </h2>
            <p className="text-lg text-[#64748B] max-w-lg mx-auto leading-relaxed">
              Des professionnels à travers le Congo font confiance à Oraforme chaque jour.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <FadeIn key={t.name} delay={i * 0.1}>
                <div className="bg-white rounded-3xl p-8 border border-gray-100 hover:border-teal-200 hover:shadow-xl hover:shadow-teal-50 transition-all h-full flex flex-col">
                  {/* Quote mark */}
                  <div className="text-6xl font-black text-teal-100 leading-none mb-2 select-none">&ldquo;</div>
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.stars }).map((_, j) => (
                      <Star key={j} size={14} className="text-orange-400 fill-orange-400" />
                    ))}
                  </div>
                  <p className="text-sm text-[#334155] leading-relaxed flex-1 mb-6">
                    {t.quote}
                  </p>
                  <div className="flex items-center gap-3 pt-5 border-t border-gray-100">
                    <div className="w-11 h-11 rounded-full bg-teal-500 flex items-center justify-center font-bold text-white text-sm shrink-0">
                      {t.avatar}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#0F172A]">{t.name}</div>
                      <div className="text-xs text-[#64748B]">{t.role}</div>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PRICING ═════════════════════════════════════════════════════════ */}
      <section id="tarifs" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-xs font-bold text-teal-500 uppercase tracking-[0.14em]">TARIFICATION</span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0F172A] tracking-tight mt-3 mb-4">
              Des tarifs accessibles, aucun frais caché
            </h2>
            <p className="text-lg text-[#64748B] max-w-lg mx-auto">
              Commencez gratuitement. Évoluez à votre rythme.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
            {PLANS.map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 0.08}>
                <div className={`rounded-3xl p-7 border relative ${
                  plan.highlight
                    ? 'bg-teal-600 border-teal-600 shadow-2xl shadow-teal-200'
                    : 'bg-gray-50 border-gray-100'
                }`}>
                  {plan.highlight && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[10px] font-bold px-4 py-1 rounded-full whitespace-nowrap shadow-lg">
                      LE PLUS POPULAIRE
                    </div>
                  )}
                  <div className={`text-lg font-bold mb-1 ${plan.highlight ? 'text-white' : 'text-[#0F172A]'}`}>{plan.name}</div>
                  <div className={`text-xs mb-5 ${plan.highlight ? 'text-teal-200' : 'text-[#64748B]'}`}>{plan.desc}</div>
                  <div className="mb-6">
                    <span className={`text-3xl font-black ${plan.highlight ? 'text-white' : 'text-[#0F172A]'}`}>{plan.price}</span>
                    {plan.period && <span className={`text-xs ml-1.5 ${plan.highlight ? 'text-teal-200' : 'text-[#64748B]'}`}>{plan.period}</span>}
                  </div>
                  <ul className="space-y-2.5 mb-7">
                    {plan.features.map(f => (
                      <li key={f} className={`flex items-center gap-2 text-xs font-medium ${plan.highlight ? 'text-teal-100' : 'text-[#475569]'}`}>
                        <CheckCircle2 size={13} className={plan.highlight ? 'text-teal-200 shrink-0' : 'text-teal-500 shrink-0'} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href={plan.href}
                    className={`block text-center text-sm font-bold py-3 rounded-xl transition-colors ${
                      plan.highlight
                        ? 'bg-white text-teal-700 hover:bg-teal-50'
                        : 'bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-100'
                    }`}>
                    {plan.cta}
                  </Link>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn className="text-center mt-12">
            <p className="text-xs text-gray-400 mb-3 font-medium">Modes de paiement acceptés</p>
            <div className="flex justify-center gap-3 flex-wrap">
              {['Airtel Money', 'MTN MoMo', 'Virement bancaire', 'Carte Visa / MasterCard'].map(m => (
                <span key={m} className="text-xs font-semibold text-[#64748B] border border-gray-200 bg-gray-50 rounded-lg px-3 py-1.5">{m}</span>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══ CTA BANNER — background image ═══════════════════════════════════ */}
      <section className="relative py-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background photo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/cta-bg.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-teal-900/80 backdrop-blur-[2px]" />

        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-28 -right-16 w-96 h-96 rounded-full bg-white/5 pointer-events-none" />

        <div className="max-w-2xl mx-auto text-center relative z-10">
          <FadeIn>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-5 leading-tight">
              Prêt à transformer<br className="hidden sm:block" /> votre entreprise ?
            </h2>
            <p className="text-lg text-teal-200 mb-10 leading-relaxed">
              Rejoignez plus de 50 entreprises africaines qui utilisent Oraforme chaque jour.<br className="hidden sm:block" />
              Démarrez gratuitement — 30 jours d&apos;essai, sans carte bancaire.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/register"
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-base px-8 py-4 rounded-xl transition-colors shadow-xl shadow-orange-900/30">
                Démarrer gratuitement — 30 jours d&apos;essai <ArrowRight size={16} />
              </Link>
              <a href="mailto:contact@oraforme.com"
                className="inline-flex items-center gap-2 text-white font-semibold text-base px-8 py-4 rounded-xl border-2 border-white/30 hover:border-white/60 transition-colors">
                <Mail size={16} /> Nous contacter
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════════════════════ */}
      <footer id="contact" className="bg-[#0F172A] py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Oraforme" className="h-10 w-auto mb-5" style={{ filter: 'brightness(0) invert(1)' }} />
              <p className="text-sm text-gray-500 leading-relaxed mb-5 max-w-xs">
                L&apos;ERP intelligent conçu pour les PME africaines. SYSCOHADA, RH, Trésorerie, Scolarité — tout en un.
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <MapPin size={13} className="shrink-0" />
                <span>Pointe-Noire, Congo 🇨🇬</span>
              </div>
            </div>

            {[
              { title: 'Produit',    links: ['Modules', 'Tarifs', 'MIAA+', 'API', 'Nouveautés'] },
              { title: 'Entreprise', links: ['À propos', 'Blog', 'Partenaires', 'Carrières'] },
              { title: 'Contact',    links: ['contact@oraforme.com', 'Support', 'Documentation', 'CGU'] },
            ].map(col => (
              <div key={col.title}>
                <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-5">{col.title}</h4>
                <ul className="space-y-3">
                  {col.links.map(l => (
                    <li key={l}>
                      <a href="#" className="text-sm text-gray-500 hover:text-teal-400 transition-colors">{l}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-gray-600">© 2025 Oraforme. Tous droits réservés.</span>
            <span className="text-xs text-gray-600">
              Fait avec <span className="text-red-400">❤️</span> à Pointe-Noire, Congo 🇨🇬
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
