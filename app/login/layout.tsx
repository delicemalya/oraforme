import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Connexion — Oraforme',
  description: 'Connectez-vous à votre espace de gestion Oraforme.',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
