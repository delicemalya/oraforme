import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Créer mon espace — Oraforme',
  description: 'Créez votre espace de gestion en 2 minutes. 30 jours gratuits, sans carte bancaire.',
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children
}
