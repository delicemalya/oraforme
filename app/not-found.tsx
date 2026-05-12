import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0D1117] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="w-9 h-9 rounded-xl bg-[#F0A30A] flex items-center justify-center shrink-0">
            <span className="text-[#0D1117] font-bold text-base">O</span>
          </div>
          <span className="text-xl font-bold text-[#E6EDF3]">oraforme</span>
        </div>

        {/* 404 */}
        <p className="text-[120px] font-black text-[#F0A30A] leading-none tracking-tight select-none">
          404
        </p>

        <h1 className="text-2xl font-bold text-[#E6EDF3] mt-4 mb-3">
          Page introuvable
        </h1>
        <p className="text-[#8B949E] text-sm leading-relaxed mb-8">
          Cette page n&apos;existe pas ou a été déplacée.<br />
          Revenez au tableau de bord pour continuer.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-lg bg-[#F0A30A] text-[#0D1117] text-sm font-semibold hover:bg-[#D4920A] transition-colors"
          >
            Tableau de bord
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-lg border border-[#30363D] text-[#8B949E] text-sm font-medium hover:text-[#E6EDF3] hover:border-[#484F58] transition-colors"
          >
            Accueil
          </Link>
        </div>

        <p className="text-[#484F58] text-xs mt-12">
          oraforme &copy; {new Date().getFullYear()} · Tous droits réservés
        </p>
      </div>
    </div>
  )
}
