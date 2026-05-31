import Link from 'next/link'
import { Check, Zap, Building2, Users } from 'lucide-react'
import { PLAN_CONFIG, SECTEUR_CONFIG } from '@/lib/plans'

export const metadata = { title: 'Tarifs — Oraforme' }

const FAQ = [
  {
    q: "Puis-je changer de plan après l'inscription ?",
    a: "Oui. Vous pouvez upgrader ou downgrader à tout moment depuis votre espace abonnement.",
  },
  {
    q: "Les modules s'adaptent automatiquement à mon secteur ?",
    a: "Absolument. Oraforme génère votre espace de travail selon votre secteur d'activité et votre pack. Un restaurant n'a jamais accès aux modules d'une école.",
  },
  {
    q: "Y a-t-il une période d'essai gratuite ?",
    a: "Oui. 14 jours gratuits sur tous les plans, sans carte bancaire.",
  },
  {
    q: "Le prix inclut combien d'utilisateurs ?",
    a: "TPE : 5 utilisateurs. PME : 25 utilisateurs. Grande entreprise : illimité.",
  },
  {
    q: "Quels modes de paiement acceptez-vous ?",
    a: "Mobile Money (Airtel, MTN, Orange), virement bancaire, et paiement en espèces via nos partenaires.",
  },
]

export default function PricingPage() {
  const plans = Object.entries(PLAN_CONFIG) as [keyof typeof PLAN_CONFIG, typeof PLAN_CONFIG[keyof typeof PLAN_CONFIG]][]
  const sectors = Object.entries(SECTEUR_CONFIG)

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="oraforme" className="w-7 h-7" />
          oraforme
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-white/50 text-sm hover:text-white transition-colors">Se connecter</Link>
          <Link href="/register"
            className="px-4 py-2 rounded-xl text-sm font-bold bg-[#F59E0B] text-black hover:bg-[#F59E0B]/90 transition-colors">
            Commencer gratuitement
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="text-center px-4 pt-20 pb-14">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-full text-[#F59E0B] text-xs font-semibold mb-6">
          <Zap size={11} /> 14 jours gratuits · Sans carte bancaire
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-4 max-w-2xl mx-auto">
          Des packs intelligents<br />
          <span className="text-[#F59E0B]">adaptés à votre entreprise</span>
        </h1>
        <p className="text-white/40 text-lg max-w-xl mx-auto">
          Oraforme comprend automatiquement votre activité et génère votre ERP en quelques secondes.
        </p>
      </section>

      {/* ── Plans ─────────────────────────────────────────────────────────────── */}
      <section className="px-4 pb-20 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-3 gap-5">
          {plans.map(([key, cfg]) => {
            const isPopular = cfg.badge === 'Populaire'
            return (
              <div
                key={key}
                className="relative rounded-2xl p-6 border transition-all flex flex-col"
                style={{
                  border:     isPopular ? `1.5px solid ${cfg.color}` : '1px solid rgba(255,255,255,0.08)',
                  background: isPopular ? `${cfg.color}08` : 'rgba(255,255,255,0.02)',
                  boxShadow:  isPopular ? `0 0 40px ${cfg.color}20` : 'none',
                }}
              >
                {cfg.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-bold"
                    style={{ background: cfg.color, color: '#000' }}>
                    {cfg.badge}
                  </div>
                )}

                {/* Header */}
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-white mb-0.5">{cfg.label}</h3>
                  <p className="text-white/40 text-sm mb-4">{cfg.subtitle}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold" style={{ color: cfg.color }}>
                      {new Intl.NumberFormat('fr-FR').format(cfg.price_fcfa)}
                    </span>
                    <span className="text-white/40 text-sm">FCFA/mois</span>
                  </div>
                  <p className="text-white/25 text-xs mt-1">
                    {cfg.max_users === -1 ? 'Utilisateurs illimités' : `${cfg.max_users} utilisateurs inclus`}
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 flex-1 mb-6">
                  {cfg.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check size={14} className="flex-shrink-0 mt-0.5" style={{ color: cfg.color }} />
                      <span className="text-white/70">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href="/register"
                  className="block text-center py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                  style={{
                    background: isPopular ? cfg.color : `${cfg.color}15`,
                    color:      isPopular ? '#000' : cfg.color,
                    border:     isPopular ? 'none' : `1px solid ${cfg.color}30`,
                  }}
                >
                  Démarrer gratuitement
                </Link>
              </div>
            )
          })}
        </div>

        <p className="text-center text-white/25 text-sm mt-6">
          Paiement en FCFA · Mobile Money accepté · Facturation mensuelle sans engagement
        </p>
      </section>

      {/* ── Secteurs ─────────────────────────────────────────────────────────── */}
      <section className="px-4 pb-20 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-white mb-2">
            Adapté à <span className="text-[#F59E0B]">votre secteur</span>
          </h2>
          <p className="text-white/40 text-sm">Modules générés automatiquement selon votre activité.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {sectors.map(([key, cfg]) => (
            <Link
              key={key}
              href={`/register`}
              className="p-4 rounded-xl border border-white/6 bg-white/2 hover:bg-white/5 hover:border-white/15 transition-all group"
            >
              <span className="text-2xl block mb-2">{cfg.emoji}</span>
              <p className="text-white/70 text-sm font-semibold group-hover:text-white transition-colors leading-snug">
                {cfg.label}
              </p>
              <p className="text-white/30 text-[11px] mt-0.5">{cfg.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Comparison table ──────────────────────────────────────────────────── */}
      <section className="px-4 pb-20 max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-white mb-2">Comparaison des packs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left py-3 text-white/40 font-medium">Fonctionnalité</th>
                {plans.map(([key, cfg]) => (
                  <th key={key} className="text-center py-3 font-bold" style={{ color: cfg.color }}>{cfg.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                ['Facturation & Devis',             true, true, true],
                ['CRM & Clients',                   true, true, true],
                ['Trésorerie & Caisse',              true, true, true],
                ['RH & Paie',                       true, true, true],
                ['Comptabilité OHADA',               false, true, true],
                ['Déclarations fiscales',            false, true, true],
                ['Gestion des stocks',               false, true, true],
                ['MIAA+ Intelligence Artificielle',  false, true, true],
                ['Workflows & Automatisation',       false, true, true],
                ['Business Intelligence',            false, false, true],
                ['Audit & Conformité',               false, false, true],
                ['API Publique',                     false, false, true],
                ['Multi-branches',                   false, false, true],
                ['Support prioritaire',              false, false, true],
              ].map(([feature, tpe, pme, grande]) => (
                <tr key={feature as string}>
                  <td className="py-3 text-white/60">{feature as string}</td>
                  {[tpe, pme, grande].map((has, i) => (
                    <td key={i} className="py-3 text-center">
                      {has
                        ? <Check size={15} className="mx-auto text-[#16A34A]" />
                        : <span className="text-white/15 text-lg">—</span>
                      }
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-white/8">
                <td className="py-3 text-white/60">Utilisateurs inclus</td>
                <td className="py-3 text-center text-white/60 text-xs">5</td>
                <td className="py-3 text-center text-white/60 text-xs">25</td>
                <td className="py-3 text-center text-white/60 text-xs">∞</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section className="px-4 pb-20 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-white text-center mb-10">Questions fréquentes</h2>
        <div className="space-y-4">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="p-5 bg-white/2 border border-white/6 rounded-2xl">
              <p className="font-semibold text-white mb-2">{q}</p>
              <p className="text-white/50 text-sm leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA bottom ───────────────────────────────────────────────────────── */}
      <section className="px-4 pb-20 text-center">
        <div className="max-w-xl mx-auto p-8 bg-gradient-to-br from-[#F59E0B]/10 to-[#F59E0B]/3 border border-[#F59E0B]/20 rounded-3xl">
          <h2 className="text-2xl font-bold text-white mb-3">Prêt à transformer votre entreprise ?</h2>
          <p className="text-white/40 text-sm mb-6">
            Rejoignez des centaines d'entreprises africaines qui font confiance à Oraforme.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm bg-[#F59E0B] text-black hover:bg-[#F59E0B]/90 transition-all"
          >
            <Zap size={15} /> Essai gratuit 14 jours
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 px-8 py-6 text-center text-white/20 text-xs">
        © 2025 Oraforme · SaaS ERP africain · oraforms.com
      </footer>
    </div>
  )
}
