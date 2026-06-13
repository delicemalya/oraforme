import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import PWAInstall from '@/components/ui/PWAInstall'
import { LocaleProvider } from '@/lib/contexts/LocaleContext'
import { PaysProvider } from '@/lib/contexts/PaysContext'
import { ThemeProvider } from '@/lib/contexts/ThemeContext'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: "Oraforme — Gestion d'entreprise tout-en-un",
  description: 'Facturation, stock, RH, restaurant — tout en un.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico',  sizes: 'any',     type: 'image/x-icon' },
      { url: '/icon-32.png',  sizes: '32x32',   type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    shortcut: '/favicon.ico',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} h-full`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon-32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#F59E0B" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="h-full bg-[#F5F7FB] text-[#111827] antialiased">
        {/* LocaleProvider enveloppe toute l'app — changement de langue instantané */}
        <ThemeProvider>
          <LocaleProvider>
            <PaysProvider>
              {children}
              <PWAInstall />
            </PaysProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
