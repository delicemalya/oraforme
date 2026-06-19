import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Politique de Cookies — Oraforme',
  description: 'Utilisation des cookies sur la plateforme Oraforme.',
}

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 mb-8 inline-block">← Retour à l&apos;accueil</Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Politique de Cookies</h1>
        <p className="text-sm text-gray-500 mb-10">Dernière mise à jour : juin 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Qu&apos;est-ce qu&apos;un cookie ?</h2>
            <p>Un cookie est un petit fichier texte stocké sur votre appareil lors de la visite d&apos;un site web. Il permet de mémoriser vos préférences et d&apos;améliorer votre expérience.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Cookies utilisés par Oraforme</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-3 border border-gray-200 font-semibold">Cookie</th>
                    <th className="text-left px-4 py-3 border border-gray-200 font-semibold">Type</th>
                    <th className="text-left px-4 py-3 border border-gray-200 font-semibold">Durée</th>
                    <th className="text-left px-4 py-3 border border-gray-200 font-semibold">Finalité</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3 border border-gray-200"><code>sb-*</code></td>
                    <td className="px-4 py-3 border border-gray-200">Essentiel</td>
                    <td className="px-4 py-3 border border-gray-200">Session</td>
                    <td className="px-4 py-3 border border-gray-200">Authentification Supabase</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 border border-gray-200"><code>oraforme_onb_v5</code></td>
                    <td className="px-4 py-3 border border-gray-200">Fonctionnel</td>
                    <td className="px-4 py-3 border border-gray-200">7 jours</td>
                    <td className="px-4 py-3 border border-gray-200">Mémorisation du parcours d&apos;onboarding</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 border border-gray-200"><code>theme</code></td>
                    <td className="px-4 py-3 border border-gray-200">Préférence</td>
                    <td className="px-4 py-3 border border-gray-200">1 an</td>
                    <td className="px-4 py-3 border border-gray-200">Préférence de thème (clair/sombre)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Cookies tiers</h2>
            <p>Oraforme n&apos;utilise pas de cookies publicitaires ni de trackers tiers (Google Analytics, Facebook Pixel, etc.). Seuls les cookies techniques nécessaires au fonctionnement de la plateforme sont déposés.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Gestion des cookies</h2>
            <p>Les cookies essentiels ne peuvent pas être désactivés car ils sont nécessaires au fonctionnement de la plateforme. Vous pouvez supprimer les cookies depuis les paramètres de votre navigateur, ce qui entraînera une déconnexion de votre session.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact</h2>
            <p>Pour toute question : <a href="mailto:contact@oraforme.com" className="text-amber-600 hover:underline">contact@oraforme.com</a></p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 flex gap-6">
          <Link href="/legal/cgu" className="text-sm text-amber-600 hover:underline">CGU</Link>
          <Link href="/legal/privacy" className="text-sm text-amber-600 hover:underline">Politique de confidentialité</Link>
        </div>
      </div>
    </div>
  )
}
