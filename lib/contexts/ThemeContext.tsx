'use client'
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export const THEMES = [
  { id: 'gold',   nom: 'Gold Congo',     primary: '#F0A30A', hover: '#D4890A', light: '#FFF8E7' },
  { id: 'rouge',  nom: 'Rouge Oraforme', primary: '#EF4444', hover: '#DC2626', light: '#FEF2F2' },
  { id: 'bleu',   nom: 'Bleu Océan',    primary: '#3B82F6', hover: '#2563EB', light: '#EFF6FF' },
  { id: 'violet', nom: 'Violet Premium', primary: '#8B5CF6', hover: '#7C3AED', light: '#F5F3FF' },
  { id: 'vert',   nom: 'Vert Afrique',   primary: '#10B981', hover: '#059669', light: '#ECFDF5' },
  { id: 'orange', nom: 'Orange Sunset',  primary: '#F97316', hover: '#EA580C', light: '#FFF7ED' },
  { id: 'rose',   nom: 'Rose Modern',    primary: '#EC4899', hover: '#DB2777', light: '#FDF2F8' },
  { id: 'indigo', nom: 'Indigo Night',   primary: '#6366F1', hover: '#4F46E5', light: '#EEF2FF' },
  { id: 'cyan',   nom: 'Cyan Tech',      primary: '#06B6D4', hover: '#0891B2', light: '#ECFEFF' },
  { id: 'noir',   nom: 'Noir Élégant',   primary: '#1F2937', hover: '#111827', light: '#F9FAFB' },
] as const

export type Theme = typeof THEMES[number]

interface ThemeCtx { theme: Theme; changerTheme: (id: string) => void }
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
  const [theme, setTheme] = useState<Theme>(THEMES[0])

  useEffect(() => {
    const saved = localStorage.getItem('oraforme_theme')
    const found = THEMES.find(t => t.id === saved)
    if (found) { setTheme(found); apply(found) }
  }, [])

  function changerTheme(id: string) {
    const next = THEMES.find(t => t.id === id) ?? THEMES[0]
    setTheme(next); apply(next)
    localStorage.setItem('oraforme_theme', id)
  }

  return <Ctx.Provider value={{ theme, changerTheme }}>{children}</Ctx.Provider>
}

export function useTheme() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider')
  return ctx
}
