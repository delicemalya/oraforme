import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'mammoth', '@react-pdf/renderer'],

  experimental: {
    optimizePackageImports: ['recharts', 'lucide-react', 'framer-motion'],
  },

  // Turbopack (default in Next.js 16) — empty config suppresses the webpack warning
  turbopack: {},
};

export default nextConfig;
