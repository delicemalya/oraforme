'use client'

import Link from 'next/link'

const EXPERT_LABELS: Record<string, string> = {
  comptabilite: 'Expert Comptabilité',
  rh:           'Expert RH',
  recrutement:  'Expert Recrutement',
  tresorerie:   'Expert Trésorerie',
  facturation:  'Expert Facturation',
  stock:        'Expert Inventaire',
  crm:          'Expert Commercial',
  fiscalite:    'Expert Fiscalité',
  audit:        'Expert Audit',
  ecole:        'Expert Éducation',
  restaurant:   'Expert Restauration',
  hotel:        'Expert Hôtellerie',
  sante:        'Expert Clinique',
  depenses:     'Expert Dépenses',
}

const DEFAULT_QUESTIONS: Record<string, string> = {
  comptabilite: 'Analyse ma comptabilité et donne-moi les points d\'attention OHADA.',
  rh:           'Analyse les obligations sociales et la masse salariale.',
  recrutement:  'Analyse les candidatures en cours et donne-moi les meilleurs profils.',
  tresorerie:   'Analyse ma trésorerie et identifie les risques de liquidité.',
  facturation:  'Analyse mes factures impayées et propose une stratégie de recouvrement.',
  stock:        'Analyse mon stock et identifie les ruptures et surstocks.',
  crm:          'Analyse mon pipeline commercial et donne des recommandations.',
  fiscalite:    'Vérifie mes obligations fiscales et les échéances DGI.',
  audit:        'Lance un audit OHADA complet et donne le plan d\'action.',
  ecole:        'Analyse les résultats scolaires et les impayés de frais.',
  restaurant:   'Analyse les performances du restaurant et le food cost.',
  hotel:        'Analyse les performances de l\'hôtel et le taux d\'occupation.',
  sante:        'Analyse les données patients et les consultations impayées.',
  depenses:     'Analyse mes dépenses du mois et les charges déductibles.',
}

interface Props {
  module: string
  question?: string
  size?: 'sm' | 'md'
  variant?: 'primary' | 'ghost'
  className?: string
}

export default function MIAAContextButton({
  module,
  question,
  size = 'sm',
  variant = 'ghost',
  className = '',
}: Props) {
  const label = EXPERT_LABELS[module] ?? 'Expert IA'
  const q     = question ?? DEFAULT_QUESTIONS[module] ?? ''
  const href  = `/dashboard/miaa?context=${module}${q ? `&q=${encodeURIComponent(q)}` : ''}`

  const isPrimary = variant === 'primary'

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 font-medium transition-all rounded-xl shrink-0 ${
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
      } ${
        isPrimary
          ? 'text-white shadow-sm hover:shadow-md hover:opacity-90'
          : 'border hover:shadow-sm hover:opacity-90'
      } ${className}`}
      style={
        isPrimary
          ? { background: 'linear-gradient(135deg, #F59E0B, #D97706)' }
          : { borderColor: '#FDE68A', color: '#D97706', background: '#FFFBEB' }
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/miaa-logo.png"
        alt="MIAA+"
        width={14}
        height={14}
        className="rounded-full object-cover shrink-0"
      />
      MIAA+ {label}
    </Link>
  )
}
