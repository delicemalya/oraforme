'use client'

import Link from 'next/link'
import { Lock, Zap, ArrowRight } from 'lucide-react'
import { usePlanFeature } from '@/lib/hooks/usePlanFeature'
import type { FeatureId } from '@/lib/feature-access'
import type { ReactNode } from 'react'

// ── Feature labels for display ────────────────────────────────────────────────

const FEATURE_LABELS: Record<string, { title: string; description: string; bullets: string[] }> = {
  'audit-ohada': {
    title:       'Audit OHADA',
    description: 'Vérification de conformité aux 7 Actes Uniformes OHADA.',
    bullets:     ['Contrôle des immatriculations et du RCCM', 'Vérification SYSCOHADA & plan comptable', 'Analyse des sociétés commerciales et gouvernance', 'Rapport de conformité exportable'],
  },
  'audit-controle-interne': {
    title:       'Contrôle Interne',
    description: 'Cartographie et évaluation de vos processus internes.',
    bullets:     ['Cartographie des risques', 'Tests de contrôle', 'Plans d\'action corrective', 'Rapports de conformité interne'],
  },
  'analytics-avances': {
    title:       'Analytics Avancés',
    description: 'Business Intelligence et prévisions IA pour votre activité.',
    bullets:     ['Tableaux de bord multi-indicateurs', 'Prévisions revenus et trésorerie', 'Analyse de tendances et saisonnalité', 'Export PDF et Excel personnalisés'],
  },
  'bi-avancee': {
    title:       'Business Intelligence',
    description: 'Dashboards avancés et analytics multi-entités.',
    bullets:     ['KPIs consolidés toutes entités', 'Graphiques interactifs temps réel', 'Benchmarks sectoriels', 'Alertes automatiques sur seuils'],
  },
  'workflows-avances': {
    title:       'Workflows & Automatisations',
    description: 'Automatisez vos processus métier et gagnez en productivité.',
    bullets:     ['Workflows déclenchés automatiquement', 'Approbations multi-niveaux', 'Intégrations et webhooks', 'Modèles pré-configurés par secteur'],
  },
  'miaa-expert': {
    title:       'MIAA Expert',
    description: 'L\'IA Oraforme en mode expert avec analyses approfondies.',
    bullets:     ['Analyses sectorielles avancées', 'Agent autonome multi-tâches', 'Expertise OHADA et fiscalité', 'Génération de rapports complets'],
  },
  'recrutement-ia': {
    title:       'Recrutement IA',
    description: 'Matching automatique et scoring IA pour vos candidatures.',
    bullets:     ['Scoring automatique des CV', 'Matching poste / candidat', 'Entretiens guidés par l\'IA', 'CVthèque intelligente'],
  },
  'ocr-intelligent': {
    title:       'OCR Intelligent',
    description: 'Extraction automatique des données de vos documents.',
    bullets:     ['Lecture des factures fournisseurs', 'Extraction NIU, RCCM, montants', 'Import automatique en comptabilité', 'Support PDF, image, scan'],
  },
  'previsions-ia': {
    title:       'Prévisions IA',
    description: 'Prévisions automatiques de trésorerie, ventes et charges.',
    bullets:     ['Prévisions trésorerie 30/60/90 jours', 'Projections de ventes', 'Alertes de risque de liquidité', 'Scénarios optimiste / pessimiste'],
  },
  'academy-premium': {
    title:       'Academy Premium',
    description: 'Modules de formation avancés et certifications Oraforme.',
    bullets:     ['Modules OHADA et fiscalité', 'Formations sectorielles', 'Certifications officielles', 'Parcours personnalisés'],
  },
  'automatisations': {
    title:       'Automatisations Avancées',
    description: 'Triggers, webhooks et intégrations avec vos outils.',
    bullets:     ['Triggers sur événements métier', 'Webhooks entrants et sortants', 'Intégrations Mobile Money', 'Automatisations RH et finance'],
  },
}

const DEFAULT_FEATURE = {
  title:       'Fonctionnalité Business',
  description: 'Cette fonctionnalité est disponible avec le plan Business.',
  bullets:     ['Accès complet à cette fonctionnalité', 'Support prioritaire', 'Mises à jour automatiques'],
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  feature:     FeatureId | string
  children?:   ReactNode
  mode?:       'page' | 'section' | 'inline'  // page=plein écran, section=carte, inline=badge
  title?:      string   // override label
  description?: string  // override description
}

export default function PlanFeatureGate({ feature, children, mode = 'page', title, description }: Props) {
  const { allowed } = usePlanFeature(feature)

  if (allowed) {
    return <>{children}</>
  }

  const meta = FEATURE_LABELS[feature] ?? DEFAULT_FEATURE
  const displayTitle       = title       ?? meta.title
  const displayDescription = description ?? meta.description

  // ── Page mode — plein écran centré ────────────────────────────────────────
  if (mode === 'page') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">

          {/* Lock icon */}
          <div className="w-16 h-16 rounded-2xl bg-[#FEF3C7] border border-[#FDE68A] flex items-center justify-center mx-auto mb-6">
            <Lock size={28} className="text-[#F59E0B]" />
          </div>

          {/* Title */}
          <h2 className="text-[22px] font-black text-[#0F172A] mb-2">{displayTitle}</h2>
          <p className="text-[14px] text-[#64748B] mb-6">{displayDescription}</p>

          {/* Benefits */}
          <div className="text-left bg-white border border-[#E2E8F0] rounded-2xl p-4 mb-6 space-y-2.5">
            <p className="text-[11px] font-black text-[#94A3B8] uppercase tracking-widest mb-3">
              Inclus avec Business
            </p>
            {meta.bullets.map((b, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-[#FEF3C7] flex items-center justify-center shrink-0 mt-0.5">
                  <Zap size={9} className="text-[#F59E0B]" />
                </div>
                <p className="text-[13px] text-[#374151]">{b}</p>
              </div>
            ))}
          </div>

          {/* Badge plan */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FEF3C7] border border-[#FDE68A] rounded-full mb-6">
            <span className="text-[12px] font-black text-[#92400E]">Disponible avec Business</span>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-2.5">
            <Link
              href="/dashboard/abonnement"
              className="flex items-center justify-center gap-2 py-3 rounded-2xl text-[14px] font-black text-white bg-[#F59E0B] hover:bg-[#D97706] transition-all">
              <Zap size={15} /> Passer à Business <ArrowRight size={15} />
            </Link>
            <Link
              href="/dashboard"
              className="py-2.5 rounded-2xl text-[13px] font-bold text-[#64748B] border-2 border-[#E2E8F0] hover:bg-[#F8FAFC] transition-all text-center">
              Retour au dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Section mode — carte inline dans une page ──────────────────────────────
  if (mode === 'section') {
    return (
      <div className="relative rounded-2xl border-2 border-dashed border-[#FDE68A] bg-[#FFFBEB] p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-[#FEF3C7] flex items-center justify-center shrink-0">
            <Lock size={16} className="text-[#F59E0B]" />
          </div>
          <div>
            <p className="text-[14px] font-black text-[#92400E]">{displayTitle}</p>
            <p className="text-[12px] text-[#B45309] mt-0.5">{displayDescription}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black text-[#B45309] bg-[#FEF3C7] border border-[#FDE68A] px-2 py-0.5 rounded-full">
            Business requis
          </span>
          <Link href="/dashboard/abonnement"
            className="flex items-center gap-1 text-[12px] font-bold text-[#F59E0B] hover:text-[#D97706] transition-colors">
            Passer à Business <ArrowRight size={11} />
          </Link>
        </div>
      </div>
    )
  }

  // ── Inline mode — petit badge lock ────────────────────────────────────────
  return (
    <Link href="/dashboard/abonnement"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] text-[11px] font-bold text-[#92400E] hover:bg-[#FDE68A] transition-all">
      <Lock size={10} /> Business
    </Link>
  )
}
