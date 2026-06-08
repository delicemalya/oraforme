'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

const SEGMENT_LABELS: Record<string, string> = {
  dashboard:       'Tableau de bord',
  fiscalite:       'Fiscalité & Déclarations',
  comptabilite:    'Comptabilité',
  tresorerie:      'Trésorerie',
  facturation:     'Facturation',
  depenses:        'Dépenses',
  rh:              'Ressources Humaines',
  paie:            'Paie & Bulletins',
  declarations:    'Déclarations',
  cnss:            'CNSS Congo',
  crm:             'CRM',
  stock:           'Stock',
  achats:          'Achats',
  recouvrement:    'Recouvrement',
  ged:             'Documents',
  bi:              'Analytics',
  profil:          'Mon profil',
  parametres:      'Paramètres',
  equipe:          'Équipe',
  abonnement:      'Abonnement',
  calendrier:      'Calendrier',
  taches:          'Tâches',
  ecole:           'École',
  restaurant:      'Restaurant',
  hotel:           'Hôtel',
  housekeeping:    'Housekeeping',
  transport:       'Transport',
  sante:           'Santé',
  pharmacie:       'Pharmacie',
  cabinet:         'Cabinet',
  btp:             'BTP',
  banque:          'Banque',
  agriculture:     'Agriculture',
  petrole:         'Pétrole',
  ong:             'ONG',
  boisson:         'Boissons',
  recrutement:     'Recrutement',
  tva:             'TVA',
  irpp:            'IRPP',
  das:             'DAS',
  patente:         'Patente 721M',
  is:              'Impôt Société',
  'liasse-fiscale':'Liasse Fiscale',
  'taxe-apprentissage': 'Taxe Apprentissage',
  historique:      'Historique',
  workflows:       'Workflows',
  'api-keys':      'Clés API',
  clients:         'Clients',
  documents:       'Documents',
  taches_cabinet:  'Tâches',
  projets:         'Projets',
  salaires:        'Salaires',
  patients:        'Patients',
  consultations:   'Consultations',
  medecins:        'Médecins',
  nouveau:         'Nouveau',
}

function getLabel(segment: string): string {
  return SEGMENT_LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
}

export default function BackButtonBar() {
  const pathname = usePathname()
  const router   = useRouter()

  const segments = pathname.split('/').filter(Boolean)

  // Pas de bouton sur /dashboard (racine)
  if (segments.length <= 1) return null

  // Label de la page parente = avant-dernier segment
  const parentSeg   = segments[segments.length - 2]
  const parentLabel = getLabel(parentSeg)

  return (
    <div className="mb-4 sm:mb-5 -mt-1">
      <button
        onClick={() => router.back()}
        aria-label="Retour à la page précédente"
        className="
          group inline-flex items-center gap-2
          rounded-xl px-3 py-2 -ml-3
          text-[13px] font-medium text-[#64748B]
          hover:text-[#0F172A] hover:bg-[#F1F5F9]
          border border-transparent hover:border-[#E2E8F0]
          transition-all duration-150 active:scale-[0.98]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]/50
        "
      >
        <ArrowLeft
          size={15}
          className="shrink-0 group-hover:-translate-x-0.5 transition-transform duration-150"
        />
        {/* Sur mobile : "Retour" · Sur desktop : nom de la page parente */}
        <span className="sm:hidden">Retour</span>
        <span className="hidden sm:inline">{parentLabel}</span>
      </button>
    </div>
  )
}
