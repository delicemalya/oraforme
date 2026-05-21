'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  CheckCircle, ArrowRight, Star, BarChart3, Wallet, Users, Package,
  FileText, GraduationCap, UtensilsCrossed, BookOpen, Truck,
  TrendingUp, Shield, Globe, Zap, Building2, ChevronRight,
  Phone, Mail, MapPin, Bot, Calculator, Clock, Menu, X,
} from 'lucide-react'

// ─── Palette ─────────────────────────────────────────────────────────────────
const R  = '#F51E33'   // red primary
const N  = '#042654'   // navy dark
const V  = '#830a65'   // violet accent
const W  = '#ffffff'   // white

// ─── Data ─────────────────────────────────────────────────────────────────────

const MODULES = [
  { icon: Calculator,      color: R, title: 'Comptabilité SYSCOHADA',  desc: 'Journal OHADA, plan comptable rénové, états financiers conformes aux normes africaines.', features: ['Plan SYSCOHADA rénové', 'Journal & grand livre', 'Bilan & compte de résultat'] },
  { icon: Wallet,          color: N, title: 'Trésorerie & Caisse',     desc: 'Suivi en temps réel des flux financiers, rapprochement bancaire, prévisions 30 jours.', features: ['Rapprochement bancaire', 'Flux entrées / sorties', 'Prévisions 30 jours'] },
  { icon: Users,           color: V, title: 'RH & Paie',               desc: 'Salaires, congés, pointage biométrique et bulletins conformes au droit congolais.', features: ['Paie automatique', 'Bulletins PDF', 'Gestion des congés'] },
  { icon: Package,         color: R, title: 'Stock & Inventaire',      desc: 'Stocks en temps réel, alertes de rupture, traçabilité des mouvements.', features: ['Alertes de rupture', 'Traçabilité lots', 'Inventaire tournant'] },
  { icon: FileText,        color: N, title: 'Facturation & Devis',     desc: 'Factures en quelques clics. PDF professionnel, email intégré, signature électronique.', features: ['Factures & devis PDF', 'Envoi par email', 'Suivi des paiements'] },
  { icon: GraduationCap,   color: V, title: 'Scolarité & École',       desc: 'Inscriptions, notes, bulletins, plannings et frais scolaires pour écoles et universités.', features: ['Bulletins automatiques', 'Gestion des classes', 'Paiements scolarité'] },
  { icon: UtensilsCrossed, color: R, title: 'Restaurant & POS',        desc: 'POS tactile, gestion des tables, commandes en cuisine, rapports de caisse quotidiens.', features: ['POS tactile', 'Gestion des tables', 'Rapport caisse'] },
  { icon: TrendingUp,      color: N, title: 'CRM & Clients',           desc: 'Pipeline commercial, contacts, relances automatiques, historique des interactions.', features: ['Pipeline de ventes', 'Relances automatiques', 'Historique clients'] },
  { icon: BarChart3,       color: V, title: 'Rapports & Analytics',    desc: 'Tableaux de bord personnalisables, KPIs en temps réel, exports PDF et Excel.', features: ['Tableaux de bord live', 'Export PDF / Excel', 'KPIs métier'] },
  { icon: Bot,             color: R, title: 'MIAA+ — IA Intégrée',     desc: 'Votre assistant intelligent. Analysez vos données, générez des rapports automatiquement.', features: ['Analyse prédictive', 'Rapports auto-générés', 'Décisions assistées'] },
  { icon: BookOpen,        color: N, title: 'Formations & Émargement', desc: 'Sessions de formation, présence digitales, certificats et suivi des compétences.', features: ['Feuilles de présence', 'Certificats PDF', 'Suivi compétences'] },
  { icon: Truck,           color: V, title: 'Transport & Flotte',      desc: 'Suivi GPS, carnet de bord numérique, maintenance préventive, gestion des chauffeurs.', features: ['Suivi temps réel', 'Carnet de bord', 'Maintenance préventive'] },
]

const INDUSTRIES = [
  { icon: Building2,    title: 'PME & Entreprises',    desc: 'Pilotez votre PME avec un ERP complet : comptabilité, facturation, trésorerie, RH et stock dans une seule plateforme.', features: ['Comptabilité SYSCOHADA conforme', 'Facturation & devis en 2 clics', 'Trésorerie en temps réel', 'RH et paie automatisés'], color: R },
  { icon: GraduationCap,title: 'Écoles & Universités', desc: 'Inscriptions en ligne, notes, bulletins automatiques, plannings et collecte des frais scolaires directement depuis la plateforme.', features: ['Inscriptions & dossiers', 'Bulletins PDF automatiques', 'Gestion des absences', 'Paiements intégrés'], color: V },
  { icon: UtensilsCrossed,title:'Restaurants & Hôtels',desc: 'Du POS tactile à la gestion des stocks de cuisine. Réduisez le gaspillage et augmentez la rentabilité de votre établissement.', features: ['POS tactile multi-tables', 'Stock cuisine', 'Rapports caisse quotidiens', 'Commandes en ligne'], color: R },
  { icon: Calculator,   title: 'Cabinets Comptables',  desc: 'Gérez plusieurs dossiers clients depuis un seul compte. SYSCOHADA rénové, états financiers et liasse fiscale automatique.', features: ['Multi-dossiers clients', 'SYSCOHADA rénové', 'États financiers en 1 clic', 'Liasse fiscale automatique'], color: V },
]

const COMPLIANCE = [
  { icon: '📊', title: 'SYSCOHADA Rénové',        desc: 'Plan comptable africain mis à jour, intégré dans tous les modules comptables.' },
  { icon: '🌍', title: 'Normes IFRS',              desc: 'Conforme aux normes internationales pour les groupes et filiales.' },
  { icon: '📋', title: 'États Financiers',         desc: 'Bilan, compte de résultat, TAFIRE et notes annexes générés automatiquement.' },
  { icon: '⚖️', title: 'Droit du Travail Congo',  desc: 'Paie et contrats conformes au Code du Travail RDC et République du Congo.' },
  { icon: '🔒', title: 'Sécurité & Conformité',   desc: 'Données chiffrées, accès par rôles, sauvegarde automatique, hébergement sécurisé.' },
  { icon: '🛡️', title: 'Protection des Données', desc: 'Vos données restent vôtres. Conformité RGPD appliquée à l\'écosystème africain.' },
]

const TESTIMONIALS = [
  { name: 'Marie Kabila',      role: 'Directrice, École Sainte-Marie',         stars: 5, quote: 'Oraforme a totalement transformé notre gestion scolaire. Bulletins, inscriptions, frais — tout est centralisé. 2 jours de travail économisés par mois.' },
  { name: 'Patrick Nguesso',   role: 'Gérant, Restaurant Le Baobab',           stars: 5, quote: 'Le POS et la gestion des tables sont parfaits. Nos erreurs de caisse ont été divisées par 5 et les rapports se génèrent automatiquement.' },
  { name: 'Céline Mbeki',      role: 'DG, Pharmacie Centrale Brazza',          stars: 5, quote: 'Le stock de médicaments est enfin sous contrôle. Les alertes de péremption automatiques nous ont sauvé plusieurs fois. Outil indispensable.' },
  { name: 'Jean-Pierre Lunda', role: 'Expert-Comptable, Cabinet AUDIT+',       stars: 5, quote: 'SYSCOHADA rénové parfaitement intégré. Je gère 8 dossiers clients depuis une seule interface. Le meilleur ERP africain que j\'ai utilisé.' },
  { name: 'Sophie Masamba',    role: 'PDG, Groupe Transport KIMBA',            stars: 5, quote: 'Suivi de flotte, RH, paie des chauffeurs — tout dans un seul outil. MIAA+ m\'envoie des rapports chaque semaine automatiquement.' },
  { name: 'David Nkosi',       role: 'Directeur Financier, SCOFI SA',          stars: 4, quote: 'Les états financiers se génèrent en quelques secondes. La conformité SYSCOHADA est irréprochable. Un vrai gain de temps.' },
]

const PLANS = [
  { name: 'Gratuit',    price: '0',      desc: 'Pour démarrer et découvrir',         features: ['1 utilisateur', '10 factures/mois', 'Trésorerie basique', 'Support communauté'],                                                         cta: 'Commencer gratuitement', href: '/register',                highlight: false },
  { name: 'Starter',   price: '5 000',  desc: 'TPE et auto-entrepreneurs',           features: ['3 utilisateurs', 'Facturation illimitée', 'Stock & Inventaire', 'RH (5 employés)', 'Support email'],                                    cta: 'Choisir Starter',        href: '/register?plan=starter', highlight: false },
  { name: 'Pro',        price: '10 000', desc: 'Pour les PME en croissance',          features: ['10 utilisateurs', 'Tous les modules', 'Comptabilité SYSCOHADA', 'MIAA+ IA', 'Rapports avancés', 'Support prioritaire'],                 cta: 'Choisir Pro',            href: '/register?plan=pro',     highlight: true  },
  { name: 'Enterprise', price: '15 000', desc: 'Groupes et multi-sites',              features: ['Utilisateurs illimités', 'Multi-sites', 'API & intégrations', 'MIAA+ illimité', 'Manager dédié', 'SLA 99.9%'],                          cta: 'Nous contacter',         href: '/register?plan=enterprise', highlight: false },
]

const NAV_LINKS = [
  { label: 'Modules',    href: '#modules' },
  { label: 'Solutions',  href: '#solutions' },
  { label: 'Conformité', href: '#conformite' },
  { label: 'Tarifs',     href: '#tarifs' },
  { label: 'Contact',    href: '#contact' },
]

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: W, color: N, overflowX: 'hidden' }}>

      {/* ══════════════════════════════════════ NAVBAR */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #eef0f5',
        height: 100, display: 'flex', alignItems: 'center',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Oraforme" style={{ height: 64, width: 'auto' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 36 }} className="nav-links">
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href} style={{ fontSize: 14, color: '#4a5568', textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = R)}
                onMouseLeave={e => (e.currentTarget.style.color = '#4a5568')}
              >{l.label}</a>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="nav-ctas">
            <Link href="/login" style={{ fontSize: 14, color: '#4a5568', textDecoration: 'none', fontWeight: 500, padding: '10px 16px' }}>
              Connexion
            </Link>
            <Link href="/register" style={{
              fontSize: 14, fontWeight: 700, color: W, textDecoration: 'none',
              background: R, padding: '12px 24px', borderRadius: 8,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              Essai gratuit <ArrowRight size={14} />
            </Link>
          </div>

          <button onClick={() => setMenuOpen(!menuOpen)} className="nav-burger"
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>
            {menuOpen ? <X size={22} color={N} /> : <Menu size={22} color={N} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: W, borderBottom: '1px solid #eef0f5', padding: '20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} style={{ fontSize: 15, color: N, textDecoration: 'none', fontWeight: 600 }}>{l.label}</a>
            ))}
            <Link href="/login" style={{ fontSize: 14, color: '#4a5568', textDecoration: 'none' }}>Connexion</Link>
            <Link href="/register" style={{ fontSize: 14, fontWeight: 700, color: W, textDecoration: 'none', background: R, padding: '12px 20px', borderRadius: 8, textAlign: 'center' }}>
              Essai gratuit →
            </Link>
          </div>
        )}
      </nav>

      {/* ══════════════════════════════════════ HERO */}
      <section style={{ paddingTop: 120, paddingBottom: 0, background: W, position: 'relative', overflow: 'hidden' }}>
        {/* Background shape */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: '55%', height: '100%', background: '#fef2f4', clipPath: 'polygon(8% 0, 100% 0, 100% 100%, 0% 100%)', zIndex: 0 }} />

        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center', position: 'relative', zIndex: 1 }} className="grid-hero">
          {/* Left */}
          <div style={{ paddingBottom: 80 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fef2f4', border: `1px solid ${R}30`, borderRadius: 100, padding: '6px 16px', marginBottom: 28 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: R }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: R, letterSpacing: '0.06em' }}>MIAA+ • IA INTÉGRÉE</span>
            </div>

            <p style={{ fontSize: 15, color: '#64748b', marginBottom: 12, fontWeight: 500 }}>
              Bonjour ! Je suis <strong style={{ color: R }}>Oraforme</strong>,
            </p>
            <h1 style={{ fontSize: 52, fontWeight: 900, color: N, lineHeight: 1.1, letterSpacing: '-1.5px', marginBottom: 24 }}>
              L&apos;ERP complet pour<br />
              <span style={{ color: R }}>vos PME africaines.</span>
            </h1>
            <p style={{ fontSize: 17, color: '#475569', lineHeight: 1.75, marginBottom: 40, maxWidth: 460 }}>
              Comptabilité SYSCOHADA, RH & Paie, Trésorerie, Scolarité, Restaurant — une seule plateforme pensée pour l&apos;Afrique, accessible partout.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 56 }}>
              <Link href="/register" style={{
                background: R, color: W, textDecoration: 'none', fontWeight: 700,
                fontSize: 15, padding: '14px 32px', borderRadius: 10,
                display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: `0 8px 24px ${R}40`,
              }}>
                Démarrer gratuitement <ArrowRight size={16} />
              </Link>
              <a href="#solutions" style={{
                color: N, textDecoration: 'none', fontWeight: 600, fontSize: 15,
                padding: '14px 24px', borderRadius: 10, border: '2px solid #e2e8f0',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                Voir la démo →
              </a>
            </div>

            {/* Social proof */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex' }}>
                {['MK', 'PN', 'CM', 'JL', 'SM'].map((init, i) => (
                  <div key={init} style={{ width: 32, height: 32, borderRadius: '50%', background: [R, N, V, R, N][i], border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: W, marginLeft: i > 0 ? -8 : 0 }}>{init}</div>
                ))}
              </div>
              <div style={{ marginLeft: 8 }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {[1,2,3,4,5].map(i => <Star key={i} size={12} style={{ color: '#f59e0b', fill: '#f59e0b' }} />)}
                </div>
                <span style={{ fontSize: 12, color: '#64748b' }}>50+ entreprises nous font confiance</span>
              </div>
            </div>
          </div>

          {/* Right — mockup */}
          <div style={{ position: 'relative', paddingTop: 40, paddingBottom: 40 }}>
            {/* Main card */}
            <div style={{
              background: W, borderRadius: 20, padding: 24,
              boxShadow: '0 32px 80px rgba(4,38,84,0.12), 0 4px 16px rgba(4,38,84,0.06)',
              border: '1px solid #e8ecf4',
            }}>
              {/* Browser bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
                <div style={{ flex: 1, height: 22, background: '#f1f5f9', borderRadius: 6, marginLeft: 8, display: 'flex', alignItems: 'center', paddingLeft: 12 }}>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>app.oraforme.com/dashboard</span>
                </div>
              </div>

              {/* KPI row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Trésorerie', value: '4 850 000', unit: 'FCFA', color: R },
                  { label: 'Factures',   value: '127',        unit: 'ce mois', color: N },
                  { label: 'Employés',   value: '34',         unit: 'actifs',  color: V },
                ].map(k => (
                  <div key={k.label} style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{k.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{k.unit}</div>
                  </div>
                ))}
              </div>

              {/* Mini chart */}
              <div style={{ background: '#f8fafc', borderRadius: 12, padding: '16px', border: '1px solid #e2e8f0', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 12 }}>Chiffre d&apos;affaires — 12 derniers mois</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 56 }}>
                  {[30, 45, 38, 60, 52, 70, 65, 80, 72, 88, 82, 95].map((h, i) => (
                    <div key={i} style={{ flex: 1, height: `${h}%`, background: i >= 9 ? R : `${R}30`, borderRadius: '3px 3px 0 0', transition: 'height 0.3s' }} />
                  ))}
                </div>
              </div>

              {/* Bottom row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: `${R}08`, borderRadius: 10, padding: '12px 14px', border: `1px solid ${R}20` }}>
                  <div style={{ fontSize: 10, color: R, fontWeight: 600, marginBottom: 4 }}>MIAA+ Analyse</div>
                  <div style={{ fontSize: 12, color: N, fontWeight: 600 }}>Rapport prêt ✓</div>
                </div>
                <div style={{ background: `${N}06`, borderRadius: 10, padding: '12px 14px', border: `1px solid ${N}15` }}>
                  <div style={{ fontSize: 10, color: N, fontWeight: 600, marginBottom: 4, opacity: 0.6 }}>SYSCOHADA</div>
                  <div style={{ fontSize: 12, color: N, fontWeight: 600 }}>Conforme ✓</div>
                </div>
              </div>
            </div>

            {/* Floating notification */}
            <div style={{ position: 'absolute', top: 24, right: -20, background: W, borderRadius: 12, padding: '12px 16px', boxShadow: '0 8px 32px rgba(4,38,84,0.15)', border: '1px solid #eef0f5', display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${V}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bot size={18} style={{ color: V }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: N }}>MIAA+ vient d&apos;analyser</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Rapport trésorerie prêt ✓</div>
              </div>
            </div>

            {/* Floating badge bottom */}
            <div style={{ position: 'absolute', bottom: 24, left: -20, background: N, borderRadius: 12, padding: '10px 16px', boxShadow: '0 8px 24px rgba(4,38,84,0.25)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Shield size={16} style={{ color: W }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: W }}>SYSCOHADA Conforme</div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════ STATS */}
      <section style={{ background: R, padding: '56px 32px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24, textAlign: 'center' }} className="stats-grid">
          {[
            { num: '50+',    label: 'Entreprises actives',      sub: 'en Afrique centrale' },
            { num: '12',     label: 'Modules métier',           sub: 'dans une seule plateforme' },
            { num: '99.9%',  label: 'Disponibilité garantie',   sub: 'SLA enterprise' },
            { num: 'OHADA',  label: 'Conformité totale',        sub: 'SYSCOHADA rénové' },
          ].map(s => (
            <div key={s.num} style={{ padding: '16px 0' }}>
              <div style={{ fontSize: 44, fontWeight: 900, color: W, lineHeight: 1, marginBottom: 8 }}>{s.num}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════ CLIENTS STRIP */}
      <div style={{ background: '#f8fafc', borderBottom: '1px solid #eef0f5', padding: '24px 32px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0 }}>ILS NOUS FONT CONFIANCE</span>
            {['ECAM Congo', 'École Sainte-Marie', 'Le Baobab', 'Cabinet AUDIT+', 'SCOFI SA', 'Pharmacie Centrale', 'Groupe KIMBA'].map(c => (
              <span key={c} style={{ fontSize: 13, fontWeight: 700, color: '#cbd5e1', whiteSpace: 'nowrap' }}>{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════ MODULES */}
      <section id="modules" style={{ background: W, padding: '100px 32px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center', marginBottom: 80 }} className="grid-hero">
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: R, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 16 }}>12 MODULES COMPLETS</span>
              <h2 style={{ fontSize: 42, fontWeight: 900, color: N, letterSpacing: '-1.2px', lineHeight: 1.1, marginBottom: 20 }}>
                Tout ce dont votre<br />entreprise a besoin,<br /><span style={{ color: R }}>en une seule plateforme</span>
              </h2>
              <p style={{ fontSize: 16, color: '#475569', lineHeight: 1.75, marginBottom: 32, maxWidth: 440 }}>
                De la comptabilité SYSCOHADA à la gestion scolaire, chaque module est pensé pour les réalités africaines.
              </p>
              <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: W, textDecoration: 'none', background: R, padding: '13px 28px', borderRadius: 9, boxShadow: `0 6px 20px ${R}40` }}>
                Accéder à tous les modules <ArrowRight size={15} />
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {MODULES.slice(0, 4).map(m => {
                const Icon = m.icon
                return (
                  <div key={m.title} style={{ background: '#f8fafc', borderRadius: 16, padding: 20, border: '1px solid #e2e8f0' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${m.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                      <Icon size={18} style={{ color: m.color }} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: N, marginBottom: 4 }}>{m.title}</div>
                    <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>{m.features[0]}, {m.features[1]}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Full grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 16 }}>
            {MODULES.map(m => {
              const Icon = m.icon
              return (
                <div key={m.title}
                  style={{ background: W, border: '1px solid #e8ecf4', borderRadius: 14, padding: 24, transition: 'all 0.2s', cursor: 'pointer' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = `${m.color}40`; el.style.boxShadow = `0 8px 32px ${m.color}15`; el.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = '#e8ecf4'; el.style.boxShadow = 'none'; el.style.transform = 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${m.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={18} style={{ color: m.color }} />
                    </div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: N }}>{m.title}</h3>
                  </div>
                  <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, marginBottom: 14 }}>{m.desc}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {m.features.map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#475569', fontWeight: 500 }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════ SOLUTIONS */}
      <section id="solutions" style={{ background: '#f8fafc', padding: '100px 32px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: R, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 16 }}>SOLUTIONS PAR MÉTIER</span>
            <h2 style={{ fontSize: 40, fontWeight: 900, color: N, letterSpacing: '-1px', marginBottom: 16 }}>Adapté à chaque métier</h2>
            <p style={{ fontSize: 16, color: '#475569', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
              Que vous soyez une PME, une école ou un restaurant, Oraforme s&apos;adapte précisément à vos besoins.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 24 }}>
            {INDUSTRIES.map((ind, i) => {
              const Icon = ind.icon
              return (
                <div key={ind.title} style={{ background: W, borderRadius: 20, overflow: 'hidden', border: '1px solid #e8ecf4', transition: 'all 0.2s' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = `0 16px 48px ${ind.color}15`; el.style.transform = 'translateY(-4px)' }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = 'none'; el.style.transform = 'none' }}
                >
                  {/* Color header */}
                  <div style={{ background: i % 2 === 0 ? `${R}08` : `${V}08`, borderBottom: `1px solid ${ind.color}15`, padding: '24px 24px 20px' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: `${ind.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                      <Icon size={22} style={{ color: ind.color }} />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: N }}>{ind.title}</h3>
                  </div>
                  {/* Content */}
                  <div style={{ padding: 24 }}>
                    <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, marginBottom: 20 }}>{ind.desc}</p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {ind.features.map(f => (
                        <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: N, fontWeight: 500 }}>
                          <CheckCircle size={14} style={{ color: ind.color, flexShrink: 0 }} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: ind.color, textDecoration: 'none' }}>
                      En savoir plus <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════ CONFORMITÉ */}
      <section id="conformite" style={{ background: N, padding: '100px 32px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 400, height: 400, background: `${R}12`, borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center', marginBottom: 64 }} className="grid-hero">
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: R, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 16 }}>NORMES & CONFORMITÉ</span>
              <h2 style={{ fontSize: 40, fontWeight: 900, color: W, letterSpacing: '-1px', lineHeight: 1.15, marginBottom: 20 }}>
                Conforme aux référentiels<br />africains et internationaux
              </h2>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75, marginBottom: 32 }}>
                Votre ERP respecte les normes comptables, fiscales et RH en vigueur en Afrique centrale.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {['OHADA', 'SYSCOHADA', 'IFRS', 'ISO 27001', 'RGPD', 'SSL/TLS'].map(cert => (
                  <span key={cert} style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '7px 16px' }}>{cert}</span>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {COMPLIANCE.map(c => (
                <div key={c.title} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{c.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: W, marginBottom: 6 }}>{c.title}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{c.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════ TESTIMONIALS */}
      <section style={{ background: '#f8fafc', padding: '100px 32px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: R, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 16 }}>TÉMOIGNAGES</span>
            <h2 style={{ fontSize: 40, fontWeight: 900, color: N, letterSpacing: '-1px', marginBottom: 16 }}>Ce que disent nos clients</h2>
            <p style={{ fontSize: 16, color: '#475569', maxWidth: 440, margin: '0 auto', lineHeight: 1.65 }}>
              Des professionnels à travers l&apos;Afrique font confiance à Oraforme chaque jour.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px,1fr))', gap: 20 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={t.name} style={{
                background: W, border: '1px solid #e8ecf4', borderRadius: 16, padding: 28,
                borderTop: `3px solid ${i % 3 === 0 ? R : i % 3 === 1 ? N : V}`,
              }}>
                <div style={{ display: 'flex', gap: 3, marginBottom: 16 }}>
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} size={14} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
                  ))}
                </div>
                <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.75, marginBottom: 24, fontStyle: 'italic' }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: [R, N, V, R, N, V][i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: W, fontSize: 14, flexShrink: 0 }}>
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: N }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════ PRICING */}
      <section id="tarifs" style={{ background: W, padding: '100px 32px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: R, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 16 }}>TARIFICATION</span>
            <h2 style={{ fontSize: 40, fontWeight: 900, color: N, letterSpacing: '-1px', marginBottom: 16 }}>Des tarifs transparents et accessibles</h2>
            <p style={{ fontSize: 16, color: '#475569', maxWidth: 440, margin: '0 auto' }}>
              Commencez gratuitement, évoluez selon vos besoins. Aucun frais caché.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 20, alignItems: 'start' }}>
            {PLANS.map(plan => (
              <div key={plan.name} style={{
                background: plan.highlight ? N : W,
                border: plan.highlight ? `2px solid ${R}` : '1px solid #e8ecf4',
                borderRadius: 18, padding: 32, position: 'relative',
                boxShadow: plan.highlight ? '0 24px 64px rgba(4,38,84,0.2)' : 'none',
                transform: plan.highlight ? 'scale(1.03)' : 'none',
              }}>
                {plan.highlight && (
                  <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: R, color: W, fontSize: 11, fontWeight: 700, padding: '4px 16px', borderRadius: 100, whiteSpace: 'nowrap' }}>
                    LE PLUS POPULAIRE
                  </div>
                )}
                <h3 style={{ fontSize: 18, fontWeight: 800, color: plan.highlight ? W : N, marginBottom: 4 }}>{plan.name}</h3>
                <p style={{ fontSize: 12, color: plan.highlight ? 'rgba(255,255,255,0.5)' : '#94a3b8', marginBottom: 24 }}>{plan.desc}</p>
                <div style={{ marginBottom: 28 }}>
                  <span style={{ fontSize: 42, fontWeight: 900, color: plan.highlight ? W : N }}>{plan.price}</span>
                  {plan.price !== '0' && <span style={{ fontSize: 14, color: plan.highlight ? 'rgba(255,255,255,0.45)' : '#94a3b8', marginLeft: 6 }}>FCFA/mois</span>}
                  {plan.price === '0' && <span style={{ fontSize: 14, color: '#94a3b8', marginLeft: 6 }}>Gratuit</span>}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.8)' : '#475569', fontWeight: 500 }}>
                      <CheckCircle size={14} style={{ color: plan.highlight ? R : R, flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href} style={{
                  display: 'block', textAlign: 'center', textDecoration: 'none',
                  padding: '13px', borderRadius: 10, fontWeight: 700, fontSize: 14,
                  background: plan.highlight ? R : 'transparent',
                  color: plan.highlight ? W : R,
                  border: plan.highlight ? 'none' : `2px solid ${R}`,
                }}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 48 }}>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>Modes de paiement acceptés</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              {['Airtel Money', 'MTN MoMo', 'Virement bancaire', 'Carte Visa/MasterCard', 'Espèces'].map(m => (
                <span key={m} style={{ fontSize: 12, fontWeight: 600, color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 14px' }}>{m}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════ CTA */}
      <section style={{ background: R, padding: '96px 32px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -60, left: -60, width: 300, height: 300, background: 'rgba(255,255,255,0.06)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -80, right: -40, width: 400, height: 400, background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }} />
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 42, fontWeight: 900, color: W, letterSpacing: '-1.2px', marginBottom: 20, lineHeight: 1.15 }}>
            Ne pas hésiter à nous<br />contacter pour en savoir plus
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.75)', marginBottom: 40, lineHeight: 1.7 }}>
            Rejoignez plus de 50 entreprises africaines qui utilisent Oraforme chaque jour.<br />Démarrez gratuitement, sans carte bancaire.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
            <Link href="/register" style={{
              background: W, color: R, textDecoration: 'none', fontWeight: 800,
              fontSize: 15, padding: '16px 36px', borderRadius: 10,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}>
              Créer mon compte gratuit <ArrowRight size={16} />
            </Link>
            <a href="mailto:contact@oraforme.com" style={{
              color: W, textDecoration: 'none', fontWeight: 600, fontSize: 15,
              padding: '16px 28px', borderRadius: 10, border: '2px solid rgba(255,255,255,0.35)',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              <Mail size={16} /> Nous écrire
            </a>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
              <Mail size={14} /> contact@oraforme.com
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
              <Phone size={14} /> +242 00 000 0000
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
              <MapPin size={14} /> Brazzaville, Congo
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════ FOOTER */}
      <footer id="contact" style={{ background: N, padding: '72px 32px 32px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 56 }} className="footer-grid">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Oraforme" style={{ height: 48, width: 'auto', marginBottom: 20 }} />
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75, maxWidth: 280, marginBottom: 24 }}>
                L&apos;ERP intelligent conçu pour les PME africaines. SYSCOHADA, RH, Trésorerie, Scolarité — tout en un.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                {['f', 'in', '𝕏', '▶'].map(s => (
                  <a key={s} href="#" style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>{s}</a>
                ))}
              </div>
            </div>
            {[
              { title: 'Produit',    links: ['Modules', 'Tarifs', 'Nouveautés', 'Feuille de route', 'API'] },
              { title: 'Entreprise', links: ['À propos', 'Blog', 'Partenaires', 'Carrières', 'Contact'] },
              { title: 'Légal',      links: ['Confidentialité', 'CGU', 'Cookies', 'Mentions légales', 'RGPD'] },
            ].map(col => (
              <div key={col.title}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: W, marginBottom: 20, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{col.title}</h4>
                {col.links.map(l => (
                  <a key={l} href="#" style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', marginBottom: 12, transition: 'color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = W)}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
                  >{l}</a>
                ))}
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>© 2025 Oraforme. Tous droits réservés.</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
              <span>Fait avec</span>
              <span style={{ color: R }}>♥</span>
              <span>en Afrique 🌍</span>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 900px) {
          .grid-hero { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: repeat(2,1fr) !important; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .footer-grid { grid-template-columns: 1fr !important; }
          .nav-links { display: none !important; }
          .nav-ctas { display: none !important; }
          .nav-burger { display: flex !important; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
      `}</style>
    </div>
  )
}
