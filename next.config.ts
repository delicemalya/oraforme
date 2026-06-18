import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'mammoth', '@react-pdf/renderer', 'tesseract.js'],

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
