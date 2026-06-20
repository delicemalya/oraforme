import Link from 'next/link'
import { Check, Zap, Users, Globe, Building2, Layers } from 'lucide-react'
import { PLAN_CONFIG, SECTEUR_CONFIG } from '@/lib/plans'

export const metadata = { title: 'Tarifs — Oraforme' }

const PLAN_TARGETS: Record<string, string[]> = {
  tpe: [
    'Auto-entrepreneurs',
    'ETS',
    'TPE',
    'Boutiques & Commerces',
    'Restaurants indépendants',
    'Pharmacies indépendantes',
    'Écoles primaires & Collèges',
    'Petites agences',
  ],
  pme: [
    'PME',
    'Cabinets (compta, audit, fiscal…)',
    'Hôtels & Universités',
    'Cliniques & Hôpitaux',
    'Assurances & Transport',
    'Logistique & ONG',
    'Supermarchés & BTP',
    'Banques & Microfinances',
  ],
  grande: [
    'Groupes internationaux',
    'Holdings & Multinationales',
    'Entreprises multi-pays & multi-filiales',
    'Réseaux de franchises',
    'Banques régionales',
    'Assurances internationales',
    'Grandes ONG internationales',
    'Universités multi-campus',
    'Chaînes hôtelières & Réseaux de cliniques',
  ],
}

const FMT = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
const CURRENCY_TABLE = [
  {
    devise: 'FCFA (XAF/CEMAC)',
    tpe:    FMT(PLAN_CONFIG.tpe.price_fcfa),
    pme:    FMT(PLAN_CONFIG.pme.price_fcfa),
    grande: FMT(PLAN_CONFIG.grande.price_fcfa),
  },
  { devise: 'FC (Congo-RDC)',    tpe: '47 000',  pme: '117 500', grande: '216 200' },
  { devise: 'EUR (€)',           tpe: '15',      pme: '38',      grande: '70'      },
  { devise: 'USD ($)',           tpe: '17',      pme: '42',      grande: '77'      },
]

const FAQ = [
  {
    q: "Puis-je changer de plan après l'inscription ?",
    a: "Oui. Vous pouvez upgrader à tout moment depuis votre espace abonnement.",
  },
  {
    q: "Les modules s'adaptent automatiquement à mon secteur ?",
    a: "Absolument. Oraforme génère votre espace de travail selon votre secteur d'activité et votre plan. Un restaurant n'a jamais accès aux modules d'une école.",
  },
  {
    q: "Y a-t-il une période d'essai gratuite ?",
    a: "Oui. 30 jours gratuits sur tous les plans, sans carte bancaire.",
  },
  {
    q: "Le prix inclut combien d'utilisateurs ?",
    a: "Entrepreneur : 5 utilisateurs. Business : 25 utilisateurs. Compagnie : utilisateurs illimités.",
  },
  {
    q: "Qu'est-ce que le plan Compagnie apporte en plus ?",
    a: "Le plan Compagnie débloque la gestion multi-entités (groupe, filiales, agences), la vue consolidée groupe, la gestion d'emails d'entreprise et les réseaux sociaux depuis Oraforme.",
  },
  {
    q: "Quels modes de paiement acceptez-vous ?",
    a: "Mobile Money (Airtel, MTN, Orange), virement bancaire, et paiement en espèces via nos partenaires.",
  },
  {
    q: "Oraforme fonctionne-t-il sans connexion internet ?",
    a: "Oui. Le mode hors-ligne est disponible pour les opérations courantes (facturation, caisse, saisie), avec synchronisation automatique dès le retour de la connexion.",
  },
]

export default function PricingPage() {
  const plans = (['tpe', 'pme', 'grande'] as const).map(key => [key, PLAN_CONFIG[key]] as const)
  const sectors = Object.entries(SECTEUR_CONFIG)

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">

      {/* ── Nav ────────────────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          { }
          <img src="/logo-white.png" alt="Oraforme" className="h-8 w-auto" />
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-white/50 text-sm hover:text-white transition-colors">Se connecter</Link>
          <Link
            href="/onboarding"
            className="px-4 py-2 rounded-xl text-sm font-bold bg-[#F59E0B] text-black hover:bg-[#F59E0B]/90 transition-colors"
          >
            Commencer gratuitement
          </Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────────── */}
      <section className="text-center px-4 pt-20 pb-14">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-full text-[#F59E0B] text-xs font-semibold mb-6">
          <Zap size={11} /> 30 jours gratuits · Sans carte bancaire
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-4 max-w-3xl mx-auto">
          Trois offres claires<br />
          <span className="text-[#F59E0B]">adaptées à votre structure</span>
        </h1>
        <p className="text-white/40 text-lg max-w-xl mx-auto">
          De la petite entreprise au groupe international, Oraforme grandit avec vous.
        </p>
      </section>

      {/* ── Plans ──────────────────────────────────────────────────────────────── */}
      <section className="px-4 pb-20 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {plans.map(([key, cfg]) => {
            const isPopular  = cfg.badge === 'Populaire'
            const isCompany  = key === 'grande'
            const glowColor  = isPopular ? cfg.color : isCompany ? cfg.color : null
            return (
              <div
                key={key}
                className="relative rounded-2xl p-6 border transition-all flex flex-col"
                style={{
                  border:     glowColor ? `1.5px solid ${glowColor}` : '1px solid rgba(255,255,255,0.08)',
                  background: glowColor ? `${glowColor}08` : 'rgba(255,255,255,0.02)',
                  boxShadow:  glowColor ? `0 0 40px ${glowColor}20` : 'none',
                }}
              >
                {cfg.badge && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
                    style={{ background: cfg.color, color: '#fff' }}
                  >
                    {isCompany ? '🏢 ' : ''}{cfg.badge}
                  </div>
                )}

                {/* Plan icon */}
                <div className="mb-4">
                  <span
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${cfg.color}18`, color: cfg.color }}
                  >
                    {key === 'tpe'    ? <Users     size={18} /> :
                     key === 'pme'    ? <Building2 size={18} /> :
                                        <Globe     size={18} />}
                  </span>
                </div>

                {/* Header */}
                <div className="mb-5">
                  <h3 className="text-xl font-bold text-white mb-0.5">{cfg.label}</h3>
                  <p className="text-white/40 text-sm mb-3">{cfg.subtitle}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold" style={{ color: cfg.color }}>
                      {new Intl.NumberFormat('fr-FR').format(cfg.price_fcfa)}
                    </span>
                    <span className="text-white/40 text-sm">FCFA/mois</span>
                  </div>
                  <p className="text-white/25 text-xs mt-1 flex items-center gap-1">
                    <Users size={10} />
                    {cfg.max_users === -1 ? 'Utilisateurs illimités' : `${cfg.max_users} utilisateurs inclus`}
                  </p>
                </div>

                {/* ── Pour ─────────────────────────────────────────── */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-full"
                      style={{ background: `${cfg.color}20`, color: cfg.color }}
                    >
                      POUR
                    </span>
                    <div className="h-px flex-1 bg-white/8" />
                  </div>
                  <ul className="space-y-1 mb-1">
                    {(PLAN_TARGETS[key] ?? []).map(t => (
                      <li key={t} className="flex items-center gap-2 text-[12px] text-white/60">
                        <span className="w-1 h-1 rounded-full shrink-0" style={{ background: cfg.color }} />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* ── Inclus ───────────────────────────────────────── */}
                <div className="mb-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full bg-white/5 text-white/30">
                      INCLUS
                    </span>
                    <div className="h-px flex-1 bg-white/8" />
                  </div>
                </div>
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
                  href="/onboarding"
                  className="block text-center py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                  style={{
                    background: (isPopular || isCompany) ? cfg.color : `${cfg.color}15`,
                    color:      (isPopular || isCompany) ? '#fff'     : cfg.color,
                    border:     (isPopular || isCompany) ? 'none'     : `1px solid ${cfg.color}30`,
                  }}
                >
                  Démarrer gratuitement
                </Link>
              </div>
            )
          })}
        </div>

        {/* Devise equivalences */}
        <div className="mt-8 rounded-2xl border border-white/6 bg-white/2 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
            <Globe size={13} className="text-white/30" />
            <p className="text-white/40 text-xs font-medium">Équivalences indicatives par devise</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-2.5 px-5 text-white/30 font-normal">Devise</th>
                  <th className="text-center py-2.5 px-3 font-medium" style={{ color: PLAN_CONFIG.tpe.color }}>Entrepreneur</th>
                  <th className="text-center py-2.5 px-3 font-medium" style={{ color: PLAN_CONFIG.pme.color }}>Business</th>
                  <th className="text-center py-2.5 px-3 font-medium" style={{ color: PLAN_CONFIG.grande.color }}>Compagnie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {CURRENCY_TABLE.map(row => (
                  <tr key={row.devise}>
                    <td className="py-2.5 px-5 text-white/40">{row.devise}</td>
                    <td className="py-2.5 px-3 text-center text-white/60">{row.tpe}</td>
                    <td className="py-2.5 px-3 text-center text-white/60">{row.pme}</td>
                    <td className="py-2.5 px-3 text-center text-white/60">{row.grande}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-center text-white/25 text-sm mt-5">
          Paiement en FCFA · Mobile Money accepté · Facturation mensuelle sans engagement
        </p>
      </section>

      {/* ── Secteurs ───────────────────────────────────────────────────────────── */}
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
              href="/onboarding"
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

      {/* ── Comparison table ────────────────────────────────────────────────────── */}
      <section className="px-4 pb-20 max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-white mb-2">Comparaison des offres</h2>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-white/6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/2">
                <th className="text-left py-3.5 px-5 text-white/40 font-medium">Fonctionnalité</th>
                <th className="text-center py-3.5 px-4 font-bold" style={{ color: PLAN_CONFIG.tpe.color }}>
                  Entrepreneur
                </th>
                <th className="text-center py-3.5 px-4 font-bold" style={{ color: PLAN_CONFIG.pme.color }}>
                  Business
                </th>
                <th className="text-center py-3.5 px-4 font-bold" style={{ color: PLAN_CONFIG.grande.color }}>
                  Compagnie
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {([
                ['Facturation & Devis',              true,  true,  true  ],
                ['CRM & Clients',                    true,  true,  true  ],
                ['Trésorerie & Caisse',               true,  true,  true  ],
                ['RH & Paie',                        true,  true,  true  ],
                ['Mode hors-ligne',                  true,  true,  true  ],
                ['Comptabilité OHADA',                false, true,  true  ],
                ['Déclarations fiscales',             false, true,  true  ],
                ['Gestion des stocks',                false, true,  true  ],
                ['MIAA+ Intelligence Artificielle',   false, true,  true  ],
                ['Workflows & Automatisation',        false, true,  true  ],
                ['Business Intelligence',             false, true,  true  ],
                ['Audit & Conformité',                false, true,  true  ],
                ['API Publique',                      false, true,  true  ],
                ['Groupe & Filiales',                 false, false, true  ],
                ['Vue consolidée multi-entités',      false, false, true  ],
                ['Gestion emails d\'entreprise',      false, false, true  ],
                ['Gestion réseaux sociaux',           false, false, true  ],
                ['Support dédié prioritaire',         false, false, true  ],
              ] as [string, boolean, boolean, boolean][]).map(([feature, entrepreneur, business, compagnie]) => (
                <tr key={feature} className="hover:bg-white/2 transition-colors">
                  <td className="py-3 px-5 text-white/60">{feature}</td>
                  <td className="py-3 px-4 text-center">
                    {entrepreneur
                      ? <Check size={15} className="mx-auto" style={{ color: PLAN_CONFIG.tpe.color }} />
                      : <span className="text-white/15 text-lg leading-none">—</span>
                    }
                  </td>
                  <td className="py-3 px-4 text-center">
                    {business
                      ? <Check size={15} className="mx-auto" style={{ color: PLAN_CONFIG.pme.color }} />
                      : <span className="text-white/15 text-lg leading-none">—</span>
                    }
                  </td>
                  <td className="py-3 px-4 text-center">
                    {compagnie
                      ? <Check size={15} className="mx-auto" style={{ color: PLAN_CONFIG.grande.color }} />
                      : <span className="text-white/15 text-lg leading-none">—</span>
                    }
                  </td>
                </tr>
              ))}
              <tr className="border-t border-white/8 bg-white/2">
                <td className="py-3 px-5 text-white/60 font-medium">Utilisateurs inclus</td>
                <td className="py-3 px-4 text-center text-white/60 text-xs font-semibold">5</td>
                <td className="py-3 px-4 text-center text-white/60 text-xs font-semibold">25</td>
                <td className="py-3 px-4 text-center text-xs font-bold" style={{ color: PLAN_CONFIG.grande.color }}>
                  Illimités
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Compagnie highlight ─────────────────────────────────────────────────── */}
      <section className="px-4 pb-20 max-w-3xl mx-auto">
        <div className="rounded-3xl border border-[#7C3AED]/25 bg-gradient-to-br from-[#7C3AED]/8 to-[#7C3AED]/2 p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#7C3AED]/15 text-[#7C3AED]">
              <Globe size={20} />
            </span>
            <div>
              <h3 className="text-lg font-bold text-white">Plan Compagnie</h3>
              <p className="text-white/40 text-sm">Pour les groupes et structures multi-entités</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: <Layers size={14} />, title: 'Groupe & Filiales', desc: "Gérez toutes vos filiales, sociétés et agences depuis un seul tableau de bord consolidé." },
              { icon: <Building2 size={14} />, title: 'Vue consolidée', desc: "KPIs agrégés sur l'ensemble du groupe : CA, trésorerie, effectifs, score audit." },
              { icon: <Zap size={14} />, title: 'Email d\'entreprise', desc: "Gérez vos boîtes email professionnelles directement depuis Oraforme." },
              { icon: <Globe size={14} />, title: 'Réseaux sociaux', desc: "Planifiez et publiez sur vos réseaux depuis votre ERP. Tout au même endroit." },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[#7C3AED]/15 text-[#7C3AED] mt-0.5">
                  {item.icon}
                </span>
                <div>
                  <p className="text-white/90 text-sm font-semibold">{item.title}</p>
                  <p className="text-white/40 text-xs mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────────── */}
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

      {/* ── CTA bottom ─────────────────────────────────────────────────────────── */}
      <section className="px-4 pb-20 text-center">
        <div className="max-w-xl mx-auto p-8 bg-gradient-to-br from-[#F59E0B]/10 to-[#F59E0B]/3 border border-[#F59E0B]/20 rounded-3xl">
          <h2 className="text-2xl font-bold text-white mb-3">Prêt à transformer votre entreprise ?</h2>
          <p className="text-white/40 text-sm mb-6">
            Rejoignez des centaines d&apos;entreprises africaines qui font confiance à Oraforme.
          </p>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm bg-[#F59E0B] text-black hover:bg-[#F59E0B]/90 transition-all"
          >
            <Zap size={15} /> Essai gratuit 30 jours
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 px-8 py-6 text-center text-white/20 text-xs">
        © 2026 Oraforme. Tous droits réservés. · by POLYVALON TECHNOLOGY
      </footer>
    </div>
  )
}
