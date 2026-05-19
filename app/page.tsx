import Link from 'next/link'
import { SECTOR_CONFIG, MODULE_META } from '@/lib/modules'

const FEATURED_SECTORS = [
  'ecole', 'restaurant', 'commerce', 'sante',
  'transport', 'btp', 'pharmacie', 'agriculture',
]

const FEATURES = [
  { icon: '🧾', title: 'Facturation & Devis',     desc: 'Créez et envoyez vos factures en quelques clics. PDF, email, signature électronique.' },
  { icon: '📦', title: 'Stock & Inventaire',       desc: 'Gérez vos stocks en temps réel. Alertes de rupture, mouvements, traçabilité.' },
  { icon: '👔', title: 'RH & Paie',               desc: 'Paie automatique, congés, pointage, bulletins de salaire conformes.' },
  { icon: '💰', title: 'Trésorerie',               desc: 'Suivi des entrées et sorties. Rapprochement bancaire, solde en temps réel.' },
  { icon: '✨', title: 'MIAA+ IA Assistant',       desc: 'IA intégrée pour analyser vos données, rédiger des rapports et prendre des décisions.' },
  { icon: '📊', title: 'Rapports & Tableaux',      desc: 'Tableaux de bord personnalisables. Exportez en PDF ou Excel en un clic.' },
]

const TESTIMONIALS = [
  { name: 'Marie K.', role: 'Directrice, École Saint-Joseph', quote: 'Oraforme a transformé notre gestion scolaire. Les bulletins, les examens, tout est centralisé.' },
  { name: 'Patrick N.', role: 'Gérant, Restaurant Le Baobab', quote: 'Le POS et la gestion des tables sont parfaits. On a divisé nos erreurs de caisse par 5.' },
  { name: 'Céline M.', role: 'DG, Pharmacie Centrale', quote: 'Stock de médicaments sous contrôle, alertes de péremption automatiques. Indispensable.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#142850] text-[#FFFFFF]">

      {/* ── NAVBAR ─────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#1a2d50]/80 bg-[#142850]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="oraforme" className="w-7 h-7" />
            <span className="text-lg font-bold text-[#FFFFFF] tracking-tight">oraforme</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm text-[#8B949E]">
            <a href="#secteurs" className="hover:text-[#FFFFFF] transition-colors">Secteurs</a>
            <a href="#modules"  className="hover:text-[#FFFFFF] transition-colors">Modules</a>
            <a href="#tarifs"   className="hover:text-[#FFFFFF] transition-colors">Tarifs</a>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login"
              className="px-4 py-2 text-sm text-[#8B949E] hover:text-[#FFFFFF] transition-colors">
              Connexion
            </Link>
            <Link href="/register"
              className="px-4 py-2 rounded-lg bg-[#F08900] text-[#142850] text-sm font-semibold hover:bg-[#D4910A] transition-colors">
              Créer un compte
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────────── */}
      <section className="relative pt-40 pb-28 px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#F08900]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 left-1/4 w-[300px] h-[300px] bg-[#F08900]/3 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#F08900]/30 bg-[#F08900]/5 text-[#F08900] text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F08900] animate-pulse" />
            ERP nouvelle génération pour l&apos;Afrique francophone
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-[#FFFFFF] leading-tight mb-6 tracking-tight">
            Gérez votre entreprise<br />
            <span className="text-[#F08900]">comme un pro</span>
          </h1>

          <p className="text-xl text-[#8B949E] max-w-2xl mx-auto mb-10 leading-relaxed">
            Facturation, stock, RH, trésorerie — tout en un. Oraforme s&apos;adapte à votre secteur
            en quelques minutes et vous donne le contrôle total de votre activité.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#F08900] text-[#142850] text-base font-bold hover:bg-[#D4910A] transition-all shadow-lg shadow-[#F08900]/20 hover:shadow-[#F08900]/30">
              Commencer gratuitement →
            </Link>
            <Link href="/login"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-[#30363D] text-[#8B949E] text-base hover:border-[#484F58] hover:text-[#FFFFFF] transition-all">
              Se connecter
            </Link>
          </div>

          <p className="text-xs text-[#484F58] mt-5">
            Aucune carte bancaire requise • 14 jours d&apos;essai gratuit • Annulation à tout moment
          </p>
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────────────────────── */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: '16',     label: 'Secteurs couverts' },
              { value: '2 000+', label: 'Entreprises clientes' },
              { value: '99.9%',  label: 'Disponibilité' },
              { value: '< 2min', label: 'Mise en route' },
            ].map(s => (
              <div key={s.label}
                className="bg-[#0f1e3d] border border-[#1a2d50] rounded-xl p-5 text-center">
                <div className="text-2xl font-bold text-[#F08900] mb-1">{s.value}</div>
                <div className="text-xs text-[#8B949E]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTORS ────────────────────────────────────────────────── */}
      <section id="secteurs" className="px-6 py-20 border-t border-[#1a2d50]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#FFFFFF] mb-3">Adapté à votre secteur</h2>
            <p className="text-[#8B949E] max-w-xl mx-auto">
              Oraforme configure automatiquement les modules dont vous avez besoin.
              Pas de superflu, juste l&apos;essentiel de votre métier.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(SECTOR_CONFIG).map(([id, cfg]) => (
              <div key={id}
                className="group bg-[#0f1e3d] border border-[#1a2d50] hover:border-[#F08900]/40 rounded-xl p-4 transition-all cursor-default">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl">{cfg.emoji}</span>
                  <div>
                    <div className="text-sm font-semibold text-[#FFFFFF] group-hover:text-[#F08900] transition-colors leading-tight">
                      {cfg.label}
                    </div>
                    <div className="text-xs text-[#484F58] mt-0.5">{cfg.dbModules.length} modules</div>
                  </div>
                </div>
                <p className="text-xs text-[#8B949E] leading-relaxed">{cfg.description}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link href="/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#F08900]/10 border border-[#F08900]/20 text-[#F08900] text-sm font-medium hover:bg-[#F08900]/15 transition-all">
              Choisir mon secteur →
            </Link>
          </div>
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────────── */}
      <section id="modules" className="px-6 py-20 border-t border-[#1a2d50]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#FFFFFF] mb-3">Tout ce dont vous avez besoin</h2>
            <p className="text-[#8B949E] max-w-xl mx-auto">
              Des modules puissants, connectés entre eux, pensés pour la réalité des entreprises africaines.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(f => (
              <div key={f.title}
                className="bg-[#0f1e3d] border border-[#1a2d50] rounded-xl p-6 hover:border-[#30363D] transition-all group">
                <div className="w-10 h-10 rounded-lg bg-[#F08900]/10 flex items-center justify-center text-xl mb-4 group-hover:bg-[#F08900]/15 transition-colors">
                  {f.icon}
                </div>
                <h3 className="text-sm font-semibold text-[#FFFFFF] mb-2">{f.title}</h3>
                <p className="text-xs text-[#8B949E] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MODULE PRICING PREVIEW ─────────────────────────────────── */}
      <section id="tarifs" className="px-6 py-20 border-t border-[#1a2d50]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#FFFFFF] mb-3">Tarification transparente</h2>
            <p className="text-[#8B949E] max-w-xl mx-auto">
              Payez uniquement les modules dont vous avez besoin. Aucun frais caché.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {Object.entries(MODULE_META).slice(0, 9).map(([key, m]) => (
              <div key={key}
                className="flex items-center justify-between p-4 bg-[#0f1e3d] border border-[#1a2d50] rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{m.emoji}</span>
                  <span className="text-sm text-[#FFFFFF]">{m.label}</span>
                </div>
                <span className="text-sm font-semibold text-[#F08900] whitespace-nowrap">
                  {m.prix.toLocaleString()} F/mois
                </span>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-[#F08900]/10 to-[#F08900]/5 border border-[#F08900]/20 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-base font-semibold text-[#FFFFFF] mb-1">Prêt à démarrer ?</div>
              <p className="text-sm text-[#8B949E]">Commencez avec les modules de votre secteur. Évoluez à votre rythme.</p>
            </div>
            <Link href="/register"
              className="shrink-0 px-6 py-3 rounded-xl bg-[#F08900] text-[#142850] text-sm font-bold hover:bg-[#D4910A] transition-all shadow-md shadow-[#F08900]/20">
              Essai gratuit 14 jours →
            </Link>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ───────────────────────────────────────────── */}
      <section className="px-6 py-20 border-t border-[#1a2d50]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#FFFFFF] mb-3">Ils nous font confiance</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {TESTIMONIALS.map(t => (
              <div key={t.name}
                className="bg-[#0f1e3d] border border-[#1a2d50] rounded-xl p-6">
                <p className="text-sm text-[#8B949E] leading-relaxed mb-4 italic">&ldquo;{t.quote}&rdquo;</p>
                <div>
                  <div className="text-sm font-semibold text-[#FFFFFF]">{t.name}</div>
                  <div className="text-xs text-[#484F58]">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ──────────────────────────────────────────────── */}
      <section className="px-6 py-20 border-t border-[#1a2d50]">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-[#0f1e3d] border border-[#1a2d50] rounded-2xl p-12 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#F08900]/5 to-transparent pointer-events-none" />
            <div className="relative">
              <h2 className="text-3xl font-bold text-[#FFFFFF] mb-4">
                Lancez votre ERP aujourd&apos;hui
              </h2>
              <p className="text-[#8B949E] mb-8 leading-relaxed">
                Configuration en moins de 2 minutes. Aucune installation, aucune infrastructure.
                Oraforme tourne dans le cloud, accessible partout, même sur mobile.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/register"
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#F08900] text-[#142850] font-bold hover:bg-[#D4910A] transition-all shadow-lg shadow-[#F08900]/20">
                  Créer mon compte gratuit
                </Link>
                <Link href="/login"
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-[#30363D] text-[#8B949E] hover:border-[#484F58] hover:text-[#FFFFFF] transition-all">
                  J&apos;ai déjà un compte
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────── */}
      <footer className="border-t border-[#1a2d50] px-6 py-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="oraforme" className="w-6 h-6 opacity-70" />
            <span className="text-sm text-[#484F58]">© {new Date().getFullYear()} Oraforme. Tous droits réservés.</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-[#484F58]">
            <a href="#" className="hover:text-[#8B949E] transition-colors">Confidentialité</a>
            <a href="#" className="hover:text-[#8B949E] transition-colors">Conditions</a>
            <a href="mailto:support@oraforme.com" className="hover:text-[#8B949E] transition-colors">Contact</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
