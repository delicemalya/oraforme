import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation — Oraforme",
  description: "Conditions générales d'utilisation de la plateforme Oraforme.",
}

export default function CGUPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 mb-8 inline-block">← Retour à l'accueil</Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Conditions Générales d&apos;Utilisation</h1>
        <p className="text-sm text-gray-500 mb-10">Dernière mise à jour : juin 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Objet</h2>
            <p>Les présentes Conditions Générales d&apos;Utilisation (CGU) régissent l&apos;accès et l&apos;utilisation de la plateforme Oraforme, éditée par POLYVALON TECHNOLOGY, société spécialisée dans les solutions ERP pour l&apos;Afrique centrale.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Accès au service</h2>
            <p>L&apos;accès à Oraforme est réservé aux entreprises et professionnels disposant d&apos;un compte valide. L&apos;utilisateur s&apos;engage à fournir des informations exactes lors de l&apos;inscription et à maintenir la confidentialité de ses identifiants.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Offres et tarification</h2>
            <p>Oraforme propose trois niveaux d&apos;abonnement : Entrepreneur (TPE), Business (PME) et Compagnie. Les tarifs en vigueur sont disponibles sur la <Link href="/pricing" className="text-amber-600 hover:underline">page tarifs</Link>. Un essai gratuit de 30 jours est offert sans engagement.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Données et confidentialité</h2>
            <p>Les données de l&apos;entreprise hébergées sur Oraforme restent la propriété exclusive de l&apos;utilisateur. POLYVALON TECHNOLOGY s&apos;engage à ne pas les céder à des tiers et à les protéger conformément aux lois en vigueur dans les pays CEMAC.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Responsabilités</h2>
            <p>Oraforme est fourni en l&apos;état. POLYVALON TECHNOLOGY ne saurait être tenu responsable des erreurs comptables ou fiscales résultant d&apos;une mauvaise utilisation de la plateforme. L&apos;utilisateur est responsable de la conformité de ses déclarations fiscales et sociales.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Résiliation</h2>
            <p>L&apos;utilisateur peut résilier son abonnement à tout moment depuis la section &quot;Abonnement&quot; de son tableau de bord. Les données sont conservées 90 jours après la résiliation, puis supprimées définitivement.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Contact</h2>
            <p>Pour toute question relative aux présentes CGU : <a href="mailto:contact@oraforme.com" className="text-amber-600 hover:underline">contact@oraforme.com</a></p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 flex gap-6">
          <Link href="/legal/privacy" className="text-sm text-amber-600 hover:underline">Politique de confidentialité</Link>
          <Link href="/legal/cookies" className="text-sm text-amber-600 hover:underline">Politique cookies</Link>
        </div>
      </div>
    </div>
  )
}
