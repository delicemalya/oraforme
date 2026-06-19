import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Politique de Confidentialité — Oraforme',
  description: 'Comment Oraforme collecte, utilise et protège vos données personnelles.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 mb-8 inline-block">← Retour à l&apos;accueil</Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Politique de Confidentialité</h1>
        <p className="text-sm text-gray-500 mb-10">Dernière mise à jour : juin 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Responsable du traitement</h2>
            <p>POLYVALON TECHNOLOGY, éditeur d&apos;Oraforme, est responsable du traitement des données personnelles collectées via la plateforme. Contact : <a href="mailto:contact@oraforme.com" className="text-amber-600 hover:underline">contact@oraforme.com</a></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Données collectées</h2>
            <p>Nous collectons :</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Informations d&apos;identification (nom, email, téléphone, entreprise)</li>
              <li>Données de facturation et de paie (pour les fonctionnalités ERP)</li>
              <li>Données d&apos;utilisation (logs de connexion, actions sur la plateforme)</li>
              <li>Données générées via MIAA+ (conversations, analyses IA)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Finalités du traitement</h2>
            <p>Vos données sont utilisées pour :</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Fournir les services ERP (comptabilité, RH, facturation, etc.)</li>
              <li>Personnaliser l&apos;expérience via MIAA+ (assistant IA)</li>
              <li>Améliorer la plateforme (analyses d&apos;usage agrégées)</li>
              <li>Satisfaire aux obligations légales et fiscales</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Hébergement et sécurité</h2>
            <p>Les données sont hébergées sur Supabase (infrastructure AWS) avec chiffrement AES-256 au repos et TLS en transit. L&apos;accès est strictement limité par tenant via Row Level Security (RLS).</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Partage des données</h2>
            <p>Nous ne vendons ni ne louons vos données. Les sous-traitants (Supabase, Anthropic pour MIAA+, Vercel pour l&apos;hébergement) sont soumis à des accords de confidentialité stricts.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Vos droits</h2>
            <p>Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement et de portabilité de vos données. Pour exercer ces droits : <a href="mailto:contact@oraforme.com" className="text-amber-600 hover:underline">contact@oraforme.com</a></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Conservation</h2>
            <p>Les données sont conservées pendant la durée de l&apos;abonnement + 90 jours. Les données comptables légales sont conservées 10 ans conformément à la réglementation OHADA.</p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 flex gap-6">
          <Link href="/legal/cgu" className="text-sm text-amber-600 hover:underline">CGU</Link>
          <Link href="/legal/cookies" className="text-sm text-amber-600 hover:underline">Politique cookies</Link>
        </div>
      </div>
    </div>
  )
}
