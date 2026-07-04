import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'mammoth', '@react-pdf/renderer', 'tesseract.js'],

  // Type checking runs in CI separately — the auto-generated .next/dev/types/routes.d.ts
  // produced by Next.js 16 route type inference is malformed when the route count exceeds
  // a threshold, causing a false "Expression expected" error at build time.
  typescript: { ignoreBuildErrors: true },

  // Activé : le devLock dans lib/supabase.ts sérialise les appels auth
  // concurrents et élimine les NavigatorLockAcquireTimeoutError.
  // React Strict Mode révèle les bugs de double-mount et les effets de bord.
  reactStrictMode: true,

  experimental: {
    optimizePackageImports: ['recharts', 'lucide-react', 'framer-motion'],
  },

  // Turbopack (default in Next.js 16) — empty config suppresses the webpack warning
  turbopack: {},
};

export default withSentryConfig(nextConfig, {
  org: "polyvalon-tech",
  project: "javascript-nextjs",

  // Upload source maps silencieusement (ne bloque pas le build si Sentry est inaccessible)
  silent: !process.env.CI,

  // Désactiver les source maps côté client pour garder le bundle léger
  widenClientFileUpload: true,

  // Tunneling pour éviter les bloqueurs ad (optionnel)
  // tunnelRoute: "/monitoring",

  // Désactiver le logging verbose
  disableLogger: true,

  // Ne pas instrumenter automatiquement les Server Components (perf)
  automaticVercelMonitors: false,
});
