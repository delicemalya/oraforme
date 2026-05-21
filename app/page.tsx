'use client'

import Link from 'next/link'
import {
  CheckCircle, ArrowRight, Star, BarChart3, Wallet, Users, Package,
  FileText, GraduationCap, UtensilsCrossed, BookOpen, Truck,
  TrendingUp, Shield, Globe, Zap, Building2, ChevronRight,
  Phone, Mail, MapPin, Bot, Calculator, Clock,
} from 'lucide-react'

// ─── Palette ────────────────────────────────────────────────────────────────
const N  = '#042654'   // navy
const V  = '#830a65'   // violet / accent
const W  = '#fefefd'   // white

// ─── Data ────────────────────────────────────────────────────────────────────

const MODULES = [
  { icon: Calculator, color: '#830a65', title: 'Comptabilité SYSCOHADA', desc: 'Journal OHADA, plan comptable SYSCOHADA rénové, états financiers annuels conformes aux normes africaines.', features: ['Plan SYSCOHADA rénové', 'Journal & grand livre', 'Bilan & compte de résultat'] },
  { icon: Wallet, color: '#1a7f5a', title: 'Trésorerie & Caisse', desc: 'Suivi en temps réel de vos flux financiers, rapprochement bancaire automatisé, prévisions de trésorerie.', features: ['Rapprochement bancaire', 'Flux entrées / sorties', 'Prévisions 30 jours'] },
  { icon: Users, color: '#830a65', title: 'RH & Paie', desc: 'Gestion des salaires, congés, pointage biométrique et bulletins de paie conformes au droit congolais.', features: ['Paie automatique', 'Bulletins PDF', 'Gestion des congés'] },
  { icon: Package, color: '#1a7f5a', title: 'Stock & Inventaire', desc: 'Suivi des stocks en temps réel, alertes de rupture, traçabilité des mouvements et inventaires tournants.', features: ['Alertes de rupture', 'Traçabilité lots', 'Inventaire tournant'] },
  { icon: FileText, color: '#830a65', title: 'Facturation & Devis', desc: 'Créez et envoyez vos factures en quelques clics. PDF professionnel, email intégré, signature électronique.', features: ['Factures & devis PDF', 'Envoi par email', 'Suivi des paiements'] },
  { icon: GraduationCap, color: '#1a7f5a', title: 'Scolarité & École', desc: 'Inscriptions, notes, bulletins, plannings et gestion des frais scolaires pour écoles et universités.', features: ['Bulletins automatiques', 'Gestion des classes', 'Paiements scolarité'] },
  { icon: UtensilsCrossed, color: '#830a65', title: 'Restaurant & POS', desc: 'Point de vente tactile, gestion des tables, commandes en cuisine et rapports de caisse quotidiens.', features: ['POS tactile', 'Gestion des tables', 'Rapport caisse'] },
  { icon: TrendingUp, color: '#1a7f5a', title: 'CRM & Clients', desc: 'Pipeline commercial, gestion des contacts, relances automatiques et historique complet des interactions.', features: ['Pipeline de ventes', 'Relances automatiques', 'Historique clients'] },
  { icon: BarChart3, color: '#830a65', title: 'Rapports & Analytics', desc: 'Tableaux de bord personnalisables, KPIs en temps réel, exports PDF et Excel en un seul clic.', features: ['Tableaux de bord live', 'Export PDF / Excel', 'KPIs métier'] },
  { icon: Bot, color: '#1a7f5a', title: 'MIAA+ — IA Intégrée', desc: 'Votre assistant intelligent intégré. Analysez vos données, générez des rapports et prenez de meilleures décisions.', features: ["Analyse prédictive", 'Rapports auto-générés', 'Décisions assistées'] },
  { icon: BookOpen, color: '#830a65', title: 'Formations & Émargement', desc: 'Gestion des sessions de formation, feuilles de présence digitales, certificats et suivi des compétences.', features: ['Feuilles de présence', 'Certificats PDF', 'Suivi compétences'] },
  { icon: Truck, color: '#1a7f5a', title: 'Transport & Flotte', desc: 'Suivi GPS de vos véhicules, carnet de bord numérique, maintenance préventive et gestion des chauffeurs.', features: ['Suivi temps réel', 'Carnet de bord', 'Maintenance préventive'] },
]

const INDUSTRIES = [
  {
    title: 'PME & Entreprises',
    desc: 'Pilotez votre PME avec un ERP complet : comptabilité, facturation, trésorerie, RH et stock dans une seule plateforme. Gagnez du temps, réduisez les erreurs.',
    features: ['Comptabilité SYSCOHADA conforme', 'Facturation & devis en 2 clics', 'Suivi de trésorerie en temps réel', 'RH et paie automatisés'],
    bg: '#f0f4ff',
    accent: N,
  },
  {
    title: 'Écoles & Universités',
    desc: 'Simplifiez la gestion académique : inscriptions en ligne, notes, bulletins automatiques, plannings et collecte des frais scolaires directement depuis la plateforme.',
    features: ['Inscriptions & dossiers étudiants', 'Bulletins PDF automatiques', 'Gestion des absences', 'Paiements scolarité intégrés'],
    bg: '#f5f0ff',
    accent: V,
  },
  {
    title: 'Restaurants & Hôtels',
    desc: 'Du POS tactile à la gestion des stocks de cuisine, Oraforme couvre l\'ensemble de votre exploitation. Réduisez le gaspillage et augmentez la rentabilité.',
    features: ['POS tactile multi-tables', 'Gestion stock cuisine', 'Rapports caisse quotidiens', 'Commandes en ligne'],
    bg: '#f0f4ff',
    accent: N,
  },
  {
    title: 'Cabinets Comptables',
    desc: 'Gérez plusieurs dossiers clients depuis un seul compte. SYSCOHADA rénové, états financiers, liasse fiscale et synchronisation bancaire automatique.',
    features: ['Multi-dossiers clients', 'SYSCOHADA rénové', 'États financiers en 1 clic', 'Liasse fiscale automatique'],
    bg: '#f5f0ff',
    accent: V,
  },
]

const COMPLIANCE = [
  { icon: '📊', title: 'SYSCOHADA Rénové', desc: 'Plan comptable africain mis à jour, entièrement intégré dans tous les modules de comptabilité.' },
  { icon: '🌍', title: 'Normes IFRS', desc: 'Conforme aux normes internationales d\'information financière pour les groupes et filiales.' },
  { icon: '📋', title: 'États Financiers', desc: 'Bilan, compte de résultat, TAFIRE et notes annexes générés automatiquement selon les normes OHADA.' },
  { icon: '⚖️', title: 'Droit du Travail Congo', desc: 'Paie et contrats conformes au Code du Travail de la RDC et de la République du Congo.' },
  { icon: '🔒', title: 'Sécurité & Conformité', desc: 'Données chiffrées, accès par rôles, sauvegarde automatique et hébergement sécurisé.' },
  { icon: '🛡️', title: 'Protection des Données', desc: 'Vos données restent vôtres. Conformité RGPD appliquée à l\'écosystème africain.' },
]

const TESTIMONIALS = [
  { name: 'Marie Kabila', role: 'Directrice, École Sainte-Marie', stars: 5, quote: 'Oraforme a totalement transformé notre gestion scolaire. Les bulletins, les inscriptions, les frais — tout est centralisé. Nous économisons 2 jours de travail par mois.' },
  { name: 'Patrick Nguesso', role: 'Gérant, Restaurant Le Baobab', stars: 5, quote: 'Le POS et la gestion des tables sont parfaits. On a divisé nos erreurs de caisse par 5 et nos rapports journaliers se génèrent automatiquement.' },
  { name: 'Céline Mbeki', role: 'DG, Pharmacie Centrale Brazza', stars: 5, quote: 'Le stock de médicaments est enfin sous contrôle. Les alertes de péremption automatiques nous ont sauvé plusieurs fois. Outil indispensable.' },
  { name: 'Jean-Pierre Lunda', role: 'Expert-Comptable, Cabinet AUDIT+', stars: 5, quote: "SYSCOHADA rénové parfaitement intégré. Je gère 8 dossiers clients depuis une seule interface. C'est le meilleur outil ERP africain que j'ai utilisé." },
  { name: 'Sophie Masamba', role: 'PDG, Groupe Transport KIMBA', stars: 5, quote: 'Suivi de flotte, RH, paie des chauffeurs — tout dans un seul outil. L\'IA MIAA+ m\'envoie des rapports chaque semaine automatiquement.' },
  { name: 'David Nkosi', role: 'Directeur Financier, SCOFI SA', stars: 4, quote: 'Les états financiers se génèrent en quelques secondes. La conformité SYSCOHADA est irréprochable. Un vrai gain de temps pour notre équipe.' },
]

const PLANS = [
  {
    name: 'Gratuit',
    price: '0',
    desc: 'Pour démarrer et découvrir Oraforme',
    features: ['1 utilisateur', 'Facturation (10 factures/mois)', 'Trésorerie basique', 'Support communauté'],
    cta: 'Commencer gratuitement',
    href: '/register',
    highlight: false,
  },
  {
    name: 'Starter',
    price: '5 000',
    desc: 'Pour les TPE et auto-entrepreneurs',
    features: ['3 utilisateurs', 'Facturation illimitée', 'Stock & Inventaire', 'RH & Paie (5 employés)', 'Support email'],
    cta: 'Choisir Starter',
    href: '/register?plan=starter',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '10 000',
    desc: 'Pour les PME en croissance',
    features: ['10 utilisateurs', 'Tous les modules inclus', 'Comptabilité SYSCOHADA', 'MIAA+ IA Assistant', 'Rapports avancés', 'Support prioritaire'],
    cta: 'Choisir Pro',
    href: '/register?plan=pro',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: '15 000',
    desc: 'Pour les groupes et multi-sites',
    features: ['Utilisateurs illimités', 'Multi-sites & filiales', 'API & intégrations', 'MIAA+ illimité', 'Manager dédié', 'SLA 99.9%'],
    cta: 'Nous contacter',
    href: '/register?plan=enterprise',
    highlight: false,
  },
]

const NAV_LINKS = [
  { label: 'Modules',   href: '#modules' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Conformité',href: '#conformite' },
  { label: 'Tarifs',    href: '#tarifs' },
  { label: 'Contact',   href: '#contact' },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", color: N, overflowX: 'hidden' }}>

      {/* ══════════════════════════════════════════════════════════ NAVBAR */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: `${N}f0`, backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        height: 68,
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Oraforme" style={{ width: 32, height: 32 }} />
            <span style={{ fontSize: 20, fontWeight: 800, color: W, letterSpacing: '-0.5px' }}>oraforme</span>
          </div>

          {/* Nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="hidden md:flex">
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href} style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = W)}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
              >{l.label}</a>
            ))}
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/login" style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontWeight: 500, padding: '8px 16px' }}>
              Connexion
            </Link>
            <Link href="/register" style={{
              fontSize: 14, fontWeight: 600, color: W, textDecoration: 'none',
              background: V, padding: '10px 20px', borderRadius: 8,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              Essai gratuit <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════ HERO */}
      <section style={{ background: N, paddingTop: 140, paddingBottom: 80, position: 'relative', overflow: 'hidden' }}>
        {/* Glow effects */}
        <div style={{ position: 'absolute', top: -100, right: -100, width: 600, height: 600, background: `${V}20`, borderRadius: '50%', filter: 'blur(120px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -50, left: -50, width: 400, height: 400, background: `${V}10`, borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }} className="grid-hero">
          {/* Left */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `${V}20`, border: `1px solid ${V}40`, borderRadius: 100, padding: '6px 14px', marginBottom: 24 }}>
              <Bot size={13} style={{ color: V }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: V, letterSpacing: '0.06em', textTransform: 'uppercase' }}>MIAA+ • IA INTÉGRÉE</span>
            </div>

            <h1 style={{ fontSize: 52, fontWeight: 900, color: W, lineHeight: 1.08, letterSpacing: '-1.5px', marginBottom: 24 }}>
              L&apos;ERP complet<br />
              pour vos <span style={{ color: V }}>PME africaines</span>
            </h1>

            <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.65)', lineHeight: 1.65, marginBottom: 36, maxWidth: 480 }}>
              Comptabilité SYSCOHADA, RH & Paie, Trésorerie, Scolarité, Restaurant — une seule plateforme pensée pour l&apos;Afrique, accessible partout.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 48 }}>
              <Link href="/register" style={{
                background: V, color: W, textDecoration: 'none', fontWeight: 700,
                fontSize: 15, padding: '14px 28px', borderRadius: 10,
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                Démarrer gratuitement <ArrowRight size={16} />
              </Link>
              <a href="#demo" style={{
                color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontWeight: 600,
                fontSize: 15, padding: '14px 24px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.2)',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                Voir la démo →
              </a>
            </div>

            {/* Trust stats */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
              {[
                { label: 'SYSCOHADA', sub: 'Conforme' },
                { label: '99.9%', sub: 'Disponibilité' },
                { label: '50+', sub: 'Entreprises' },
                { label: '12', sub: 'Modules' },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: W }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Dashboard mockup */}
          <div style={{ position: 'relative' }}>
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20, overflow: 'hidden', aspectRatio: '16/10',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Mock header */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F51E33' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
                <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginLeft: 8 }} />
              </div>
              {/* Mock KPI cards */}
              <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, flex: 1 }}>
                {[
                  { label: 'Trésorerie', value: '4 850 000', color: V },
                  { label: 'Factures', value: '127', color: '#10B981' },
                  { label: 'Employés', value: '34', color: '#3B7EC8' },
                ].map(k => (
                  <div key={k.label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 14, border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
                  </div>
                ))}
                <div style={{ gridColumn: '1/-1', background: 'rgba(255,255,255,0.03)', borderRadius: 10, height: 80, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '90%', height: 2, background: 'rgba(255,255,255,0.05)', position: 'relative', borderRadius: 2 }}>
                    {[10, 25, 18, 42, 30, 55, 48, 70, 60, 82, 75, 90].map((h, i) => (
                      <div key={i} style={{ position: 'absolute', bottom: 0, left: `${i * 8.5}%`, width: 6, height: `${h}%`, background: i > 8 ? V : `${V}40`, borderRadius: 2 }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Floating badge */}
            <div style={{ position: 'absolute', bottom: -16, left: -16, background: W, borderRadius: 12, padding: '10px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${V}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={16} style={{ color: V }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: N }}>MIAA+ vient d&apos;analyser</div>
                <div style={{ fontSize: 10, color: 'rgba(4,38,84,0.55)' }}>Rapport trésorerie prêt ✓</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════ CLIENTS STRIP */}
      <div style={{ background: W, borderBottom: '1px solid rgba(4,38,84,0.06)', padding: '20px 0', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(4,38,84,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>ADOPTÉ PAR DES ENTREPRISES COMME</span>
          </div>
          <div style={{ display: 'flex', gap: 40, alignItems: 'center', flexWrap: 'wrap' }}>
            {['ECAM CONGO', 'École Sainte-Marie', 'Restaurant Le Baobab', 'Cabinet AUDIT+', 'SCOFI SA', 'Pharmacie Centrale', 'Groupe KIMBA'].map(c => (
              <span key={c} style={{ fontSize: 13, fontWeight: 700, color: 'rgba(4,38,84,0.3)', whiteSpace: 'nowrap' }}>{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ MODULES */}
      <section id="modules" style={{ background: W, padding: '96px 0' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: V, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 12 }}>12 MODULES COMPLETS</span>
            <h2 style={{ fontSize: 40, fontWeight: 900, color: N, letterSpacing: '-1px', marginBottom: 16 }}>Tout ce dont votre entreprise a besoin,<br />en une seule plateforme</h2>
            <p style={{ fontSize: 17, color: 'rgba(4,38,84,0.55)', maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
              De la comptabilité SYSCOHADA à la gestion scolaire, chaque module est pensé pour les réalités africaines.
            </p>
          </div>

          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 20 }}>
            {MODULES.map(m => {
              const Icon = m.icon
              return (
                <div key={m.title} style={{
                  background: W, border: '1px solid rgba(4,38,84,0.09)',
                  borderRadius: 14, padding: 24,
                  transition: 'box-shadow 0.2s, border-color 0.2s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(131,10,101,0.10)'; (e.currentTarget as HTMLDivElement).style.borderColor = `${V}30` }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(4,38,84,0.09)' }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: `${m.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Icon size={20} style={{ color: m.color }} />
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: N, marginBottom: 8 }}>{m.title}</h3>
                  <p style={{ fontSize: 13, color: 'rgba(4,38,84,0.55)', lineHeight: 1.6, marginBottom: 16 }}>{m.desc}</p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {m.features.map(f => (
                      <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(4,38,84,0.6)', fontWeight: 500 }}>
                        <CheckCircle size={12} style={{ color: m.color, flexShrink: 0 }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>

          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: V, textDecoration: 'none' }}>
              Voir tous les modules en détail <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════ SOLUTIONS */}
      <section id="solutions" style={{ background: '#f7f8fc', padding: '96px 0' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: V, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 12 }}>SOLUTIONS PAR MÉTIER</span>
            <h2 style={{ fontSize: 40, fontWeight: 900, color: N, letterSpacing: '-1px', marginBottom: 16 }}>Adapté à chaque métier</h2>
            <p style={{ fontSize: 17, color: 'rgba(4,38,84,0.55)', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
              Que vous soyez une PME, une école ou un restaurant, Oraforme s&apos;adapte précisément à vos besoins.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {INDUSTRIES.map((ind, i) => (
              <div key={ind.title} style={{
                display: 'grid', gridTemplateColumns: i % 2 === 0 ? '1fr 1fr' : '1fr 1fr',
                gap: 0, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(4,38,84,0.08)',
              }} className="industry-card">
                {/* Text */}
                <div style={{ background: W, padding: '48px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center', order: i % 2 === 0 ? 1 : 2 }}>
                  <h3 style={{ fontSize: 26, fontWeight: 800, color: N, marginBottom: 14 }}>{ind.title}</h3>
                  <p style={{ fontSize: 15, color: 'rgba(4,38,84,0.55)', lineHeight: 1.7, marginBottom: 24 }}>{ind.desc}</p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                    {ind.features.map(f => (
                      <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: N, fontWeight: 500 }}>
                        <CheckCircle size={15} style={{ color: ind.accent, flexShrink: 0 }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: ind.accent, textDecoration: 'none' }}>
                    En savoir plus <ArrowRight size={14} />
                  </Link>
                </div>
                {/* Visual */}
                <div style={{ background: ind.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 280, order: i % 2 === 0 ? 2 : 1, padding: 40 }}>
                  <div style={{ width: '100%', maxWidth: 320, background: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: 24, border: '1px solid rgba(255,255,255,0.8)' }}>
                    <div style={{ height: 10, background: `${ind.accent}20`, borderRadius: 4, marginBottom: 12, width: '60%' }} />
                    <div style={{ height: 8, background: `${ind.accent}10`, borderRadius: 4, marginBottom: 8, width: '80%' }} />
                    <div style={{ height: 8, background: `${ind.accent}10`, borderRadius: 4, marginBottom: 8, width: '70%' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
                      {[0,1,2,3].map(j => (
                        <div key={j} style={{ height: 50, background: `${ind.accent}08`, borderRadius: 8, border: `1px solid ${ind.accent}15` }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════ CONFORMITÉ */}
      <section id="conformite" style={{ background: N, padding: '96px 0' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: V, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 12 }}>NORMES & CONFORMITÉ</span>
            <h2 style={{ fontSize: 38, fontWeight: 900, color: W, letterSpacing: '-1px', marginBottom: 16 }}>Conforme aux référentiels africains<br />et internationaux</h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', maxWidth: 480, margin: '0 auto', lineHeight: 1.65 }}>
              Votre ERP respecte les normes comptables, fiscales et RH en vigueur en Afrique centrale.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 20 }}>
            {COMPLIANCE.map(c => (
              <div key={c.title} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28 }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>{c.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: W, marginBottom: 8 }}>{c.title}</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>{c.desc}</p>
              </div>
            ))}
          </div>

          {/* Certifications bar */}
          <div style={{ marginTop: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
            {['OHADA', 'SYSCOHADA', 'IFRS', 'ISO 27001', 'RGPD', 'SSL/TLS'].map(cert => (
              <div key={cert} style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 20px', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em' }}>
                {cert}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════ TESTIMONIALS */}
      <section style={{ background: W, padding: '96px 0' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: V, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 12 }}>TÉMOIGNAGES</span>
            <h2 style={{ fontSize: 38, fontWeight: 900, color: N, letterSpacing: '-1px', marginBottom: 16 }}>La confiance de nos clients</h2>
            <p style={{ fontSize: 16, color: 'rgba(4,38,84,0.5)', maxWidth: 440, margin: '0 auto' }}>
              Des professionnels et dirigeants à travers l&apos;Afrique font confiance à Oraforme chaque jour.
            </p>
            <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: 13, fontWeight: 700, color: V, textDecoration: 'none', border: `1px solid ${V}30`, borderRadius: 8, padding: '8px 18px', background: `${V}08` }}>
              Rejoindre la communauté <ArrowRight size={13} />
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px,1fr))', gap: 20 }}>
            {TESTIMONIALS.map(t => (
              <div key={t.name} style={{ background: W, border: '1px solid rgba(4,38,84,0.08)', borderRadius: 14, padding: 28 }}>
                {/* Stars */}
                <div style={{ display: 'flex', gap: 3, marginBottom: 16 }}>
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} size={14} style={{ color: '#F59E0B', fill: '#F59E0B' }} />
                  ))}
                </div>
                <p style={{ fontSize: 14, color: 'rgba(4,38,84,0.7)', lineHeight: 1.7, marginBottom: 20, fontStyle: 'italic' }}>&ldquo;{t.quote}&rdquo;</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${V}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: V, fontSize: 14 }}>
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: N }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(4,38,84,0.45)' }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════ PRICING */}
      <section id="tarifs" style={{ background: '#f7f8fc', padding: '96px 0' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: V, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 12 }}>TARIFICATION</span>
            <h2 style={{ fontSize: 38, fontWeight: 900, color: N, letterSpacing: '-1px', marginBottom: 16 }}>Des tarifs transparents et accessibles</h2>
            <p style={{ fontSize: 16, color: 'rgba(4,38,84,0.5)', maxWidth: 440, margin: '0 auto' }}>
              Commencez gratuitement, évoluez selon vos besoins. Aucun frais caché.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 20 }}>
            {PLANS.map(plan => (
              <div key={plan.name} style={{
                background: plan.highlight ? N : W,
                border: plan.highlight ? `2px solid ${V}` : '1px solid rgba(4,38,84,0.09)',
                borderRadius: 16, padding: 32, position: 'relative',
                boxShadow: plan.highlight ? '0 20px 60px rgba(4,38,84,0.2)' : 'none',
              }}>
                {plan.highlight && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: V, color: W, fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 100, whiteSpace: 'nowrap' }}>
                    LE PLUS POPULAIRE
                  </div>
                )}
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: plan.highlight ? W : N, marginBottom: 6 }}>{plan.name}</h3>
                  <p style={{ fontSize: 12, color: plan.highlight ? 'rgba(255,255,255,0.5)' : 'rgba(4,38,84,0.45)' }}>{plan.desc}</p>
                </div>
                <div style={{ marginBottom: 28 }}>
                  <span style={{ fontSize: 38, fontWeight: 900, color: plan.highlight ? W : N }}>{plan.price}</span>
                  {plan.price !== '0' && <span style={{ fontSize: 14, color: plan.highlight ? 'rgba(255,255,255,0.5)' : 'rgba(4,38,84,0.4)', marginLeft: 4 }}>FCFA/mois</span>}
                  {plan.price === '0' && <span style={{ fontSize: 14, color: 'rgba(4,38,84,0.4)', marginLeft: 4 }}>FCFA</span>}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.8)' : 'rgba(4,38,84,0.7)', fontWeight: 500 }}>
                      <CheckCircle size={13} style={{ color: plan.highlight ? V : V, flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href} style={{
                  display: 'block', textAlign: 'center', textDecoration: 'none',
                  padding: '12px', borderRadius: 10, fontWeight: 700, fontSize: 14,
                  background: plan.highlight ? V : 'transparent',
                  color: plan.highlight ? W : V,
                  border: plan.highlight ? 'none' : `2px solid ${V}`,
                  transition: 'opacity 0.15s',
                }}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* Payment methods */}
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <p style={{ fontSize: 13, color: 'rgba(4,38,84,0.4)', marginBottom: 12 }}>Modes de paiement acceptés</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
              {['Airtel Money', 'MTN MoMo', 'Virement bancaire', 'Carte Visa/MasterCard', 'Espèces'].map(m => (
                <span key={m} style={{ fontSize: 12, fontWeight: 600, color: 'rgba(4,38,84,0.5)', border: '1px solid rgba(4,38,84,0.12)', borderRadius: 6, padding: '5px 12px' }}>{m}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════ CTA */}
      <section style={{ background: V, padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontSize: 38, fontWeight: 900, color: W, letterSpacing: '-1px', marginBottom: 16 }}>
            Prêt à transformer la gestion<br />de votre entreprise ?
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.7)', marginBottom: 36, lineHeight: 1.65 }}>
            Rejoignez plus de 50 entreprises africaines qui utilisent Oraforme chaque jour. Démarrez gratuitement, sans carte bancaire.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" style={{
              background: W, color: V, textDecoration: 'none', fontWeight: 800,
              fontSize: 15, padding: '14px 32px', borderRadius: 10,
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              Créer mon compte gratuit <ArrowRight size={16} />
            </Link>
            <a href="mailto:contact@oraforme.com" style={{
              color: W, textDecoration: 'none', fontWeight: 600, fontSize: 15,
              padding: '14px 24px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              Contacter les ventes
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════ FOOTER */}
      <footer id="contact" style={{ background: N, padding: '64px 24px 32px', color: 'rgba(255,255,255,0.55)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 48 }} className="footer-grid">
            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.svg" alt="Oraforme" style={{ width: 28, height: 28 }} />
                <span style={{ fontSize: 18, fontWeight: 800, color: W }}>oraforme</span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 280, marginBottom: 20 }}>
                L&apos;ERP intelligent conçu pour les PME africaines. SYSCOHADA, RH, Trésorerie, Scolarité — tout en un.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <a href="mailto:contact@oraforme.com" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
                  <Mail size={13} /> contact@oraforme.com
                </a>
                <a href="tel:+242000000000" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
                  <Phone size={13} /> +242 00 000 0000
                </a>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <MapPin size={13} /> Brazzaville, Congo
                </span>
              </div>
            </div>

            {/* Produit */}
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: W, marginBottom: 16, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Produit</h4>
              {['Modules', 'Tarifs', 'Nouveautés', 'Feuille de route', 'API'].map(l => (
                <a key={l} href="#" style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', marginBottom: 10, transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = W)}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                >{l}</a>
              ))}
            </div>

            {/* Entreprise */}
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: W, marginBottom: 16, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Entreprise</h4>
              {['À propos', 'Blog', 'Partenaires', 'Carrières', 'Contact'].map(l => (
                <a key={l} href="#" style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', marginBottom: 10, transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = W)}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                >{l}</a>
              ))}
            </div>

            {/* Légal */}
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: W, marginBottom: 16, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Légal</h4>
              {['Confidentialité', 'CGU', 'Cookies', 'Mentions légales', 'RGPD'].map(l => (
                <a key={l} href="#" style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', marginBottom: 10, transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = W)}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                >{l}</a>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 12 }}>© 2025 Oraforme. Tous droits réservés.</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span>Fait avec</span>
              <span style={{ color: '#F51E33' }}>♥</span>
              <span>en Afrique 🌍</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Responsive helpers ── */}
      <style>{`
        @media (max-width: 768px) {
          .grid-hero { grid-template-columns: 1fr !important; }
          .industry-card { grid-template-columns: 1fr !important; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .footer-grid { grid-template-columns: 1fr !important; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
      `}</style>
    </div>
  )
}
