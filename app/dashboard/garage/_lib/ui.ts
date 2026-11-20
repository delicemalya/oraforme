import type { StatutOrdre } from '@/lib/garage/ordres'

export const STATUT_CFG: Record<StatutOrdre, { label: string; color: string; bg: string }> = {
  ouvert:   { label: 'Ouvert',   color: '#2563EB', bg: '#EFF6FF' },
  en_cours: { label: 'En cours', color: '#D97706', bg: '#FFFBEB' },
  termine:  { label: 'Terminé',  color: '#7C3AED', bg: '#F5F3FF' },
  facture:  { label: 'Facturé',  color: '#16A34A', bg: '#F0FDF4' },
  livre:    { label: 'Livré',    color: '#475569', bg: '#F1F5F9' },
  annule:   { label: 'Annulé',   color: '#94A3B8', bg: '#F8FAFC' },
}

export const fcfa = (n: number | null | undefined) =>
  `${new Intl.NumberFormat('fr-FR').format(Math.round(Number(n ?? 0)))} FCFA`

export const INPUT_CLS =
  'mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white'

export const LABEL_CLS = 'text-[11px] font-bold text-[#64748B] uppercase tracking-wide'

export type VehiculeResume = {
  immatriculation: string
  marque: string | null
  modele: string | null
  proprietaire_nom: string
  proprietaire_telephone: string | null
}
