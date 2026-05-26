import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import PWAInstall from '@/components/ui/PWAInstall'
import { LocaleProvider } from '@/lib/contexts/LocaleContext'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: "Oraforme — Gestion d'entreprise tout-en-un",
  description: 'Facturation, stock, RH, restaurant — tout en un.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    shortcut: '/icon-192.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} h-full`}>
      <head>
        <meta name="theme-color" content="#F59E0B" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="h-full bg-[#F5F7FB] text-[#111827] antialiased">
        {/* LocaleProvider enveloppe toute l'app — changement de langue instantané */}
        <LocaleProvider>
          {children}
          <PWAInstall />
        </LocaleProvider>
      </body>
    </html>
  )
}
