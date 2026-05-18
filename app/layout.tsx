import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import PWAInstall from '@/components/ui/PWAInstall'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

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
    <html lang="fr" className={`${geist.variable} h-full`}>
      <head>
        <meta name="theme-color" content="#F0A30A" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="h-full bg-white text-[#111827] antialiased">
        {children}
        <PWAInstall />
      </body>
    </html>
  )
}
