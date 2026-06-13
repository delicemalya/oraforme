'use client'
import { useState } from 'react'
import { THEMES, useTheme } from '@/lib/contexts/ThemeContext'

export function ColorPicker() {
  const { theme, isExplicit, changerTheme, resetTheme } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title={`Thème : ${theme.nom}`}
        className="w-7 h-7 rounded-full border-2 border-white/40 shadow-sm transition-transform hover:scale-110"
        style={{ backgroundColor: isExplicit ? theme.primary : '#64748B' }}
      />

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-50 bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] p-3 w-56"
            style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2.5">
              Couleur de l&apos;interface
            </p>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => { changerTheme(t.id); setOpen(false) }}
                  title={t.nom}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
                  style={{
                    backgroundColor: t.primary,
                    outline: (isExplicit && theme.id === t.id) ? `2px solid #0F172A` : 'none',
                    outlineOffset: '2px',
                  }}>
                  {isExplicit && theme.id === t.id && (
                    <span className="text-white text-[11px] font-bold">✓</span>
                  )}
                </button>
              ))}
            </div>
            {isExplicit ? (
              <button onClick={() => { resetTheme(); setOpen(false) }}
                className="w-full text-[10px] text-[#94A3B8] hover:text-[#0F172A] py-1 transition-colors">
                ↺ Revenir à la couleur secteur
              </button>
            ) : (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#F8FAFC]">
                <span className="text-[10px] text-[#94A3B8]">Couleur basée sur votre secteur</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
