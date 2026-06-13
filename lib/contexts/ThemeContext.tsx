'use client'
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

// Palette officielle Oraforme
export const THEMES = [
  { id: 'teal',   nom: 'Teal Oraforme',  primary: '#258571', hover: '#1a6559', light: '#e8f5f2' },
  { id: 'marine', nom: 'Bleu Marine',    primary: '#042654', hover: '#021840', light: '#e6eef8' },
  { id: 'vert',   nom: 'Vert Émeraude', primary: '#04a269', hover: '#037a50', light: '#e6f7ef' },
  { id: 'rouge',  nom: 'Rouge Oraforme', primary: '#f61c37', hover: '#d4162f', light: '#fee6e8' },
  { id: 'orange', nom: 'Orange Soleil',  primary: '#f38604', hover: '#d97203', light: '#fef3e6' },
  { id: 'violet', nom: 'Violet Royal',   primary: '#830a65', hover: '#6a0853', light: '#f5e6f1' },
  { id: 'bleu',   nom: 'Bleu Oraforme', primary: '#0148b7', hover: '#013a93', light: '#e6eef8' },
  { id: 'cyan',   nom: 'Cyan Atlantique',primary: '#268d82', hover: '#1e7169', light: '#e8f5f4' },
] as const

export type Theme = typeof THEMES[number]

interface ThemeCtx {
  theme:      Theme
  isExplicit: boolean   // true = user picked a color → banner uses theme.primary
  changerTheme:  (id: string) => void
  resetTheme:    () => void
}
const Ctx = createContext<ThemeCtx | null>(null)

function apply(t: Theme) {
  const r = document.documentElement
  r.style.setProperty('--primary',             t.primary)
  r.style.setProperty('--primary-hover',       t.hover)
  r.style.setProperty('--primary-light',       t.light)
  r.style.setProperty('--color-primary',       t.primary)
  r.style.setProperty('--color-primary-hover', t.hover)
  r.style.setProperty('--color-primary-light', t.light)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme,      setTheme]      = useState<Theme>(THEMES[0])
  const [isExplicit, setIsExplicit] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('oraforme_theme')
    const found = THEMES.find(t => t.id === saved)
    if (found) { setTheme(found); setIsExplicit(true); apply(found) }
  }, [])

  function changerTheme(id: string) {
    const next = THEMES.find(t => t.id === id) ?? THEMES[0]
    setTheme(next); setIsExplicit(true); apply(next)
    localStorage.setItem('oraforme_theme', id)
  }

  function resetTheme() {
    localStorage.removeItem('oraforme_theme')
    setIsExplicit(false)
    setTheme(THEMES[0])
  }

  return (
    <Ctx.Provider value={{ theme, isExplicit, changerTheme, resetTheme }}>
      {children}
    </Ctx.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider')
  return ctx
}
