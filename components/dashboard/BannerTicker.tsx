'use client'
import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { THEMES, useTheme } from '@/lib/contexts/ThemeContext'

interface Slide { icon: string; text: string }

const CACHE_KEY = 'oraforme_infobande'
const CACHE_TTL = 30 * 60 * 1000

function weatherEmoji(code: number) {
  if (code === 0) return '☀️'
  if (code <= 3)  return '⛅'
  if (code <= 49) return '🌫️'
  if (code <= 69) return '🌧️'
  if (code <= 84) return '🌦️'
  return '⛈️'
}

function getFestif(): { emoji: string; msg: string } | null {
  const d = new Date(); const m = d.getMonth() + 1; const j = d.getDate()
  const list = [
    { m: 1,  j1: 1,  j2: 7,  emoji: '🎆', msg: 'Bonne Année !'          },
    { m: 2,  j1: 13, j2: 15, emoji: '❤️',  msg: 'Bonne Saint-Valentin'  },
    { m: 5,  j1: 1,  j2: 1,  emoji: '⚒️', msg: 'Fête du Travail'        },
    { m: 8,  j1: 15, j2: 16, emoji: '🇨🇬', msg: 'Fête Nationale !'      },
    { m: 12, j1: 24, j2: 26, emoji: '🎄', msg: 'Joyeux Noël !'           },
    { m: 12, j1: 31, j2: 31, emoji: '🥂', msg: 'Bonne Saint-Sylvestre !' },
  ]
  return list.find(f => f.m === m && j >= f.j1 && j <= f.j2) ?? null
}

function getTimeSlide(): Slide {
  const h = new Date().getHours()
  if (h < 12) return { icon: '🌅', text: 'Bonne matinée !' }
  if (h < 17) return { icon: '💼', text: 'Bonne journée !' }
  return { icon: '🌙', text: 'Bonne soirée !' }
}

export function BannerTicker() {
  const { theme, isExplicit, changerTheme, resetTheme } = useTheme()
  const [slides, setSlides] = useState<Slide[]>([getTimeSlide()])
  const [idx,    setIdx]    = useState(0)
  const [show,   setShow]   = useState(true)
  const [picker, setPicker] = useState(false)

  // Fetch météo + construire les slides
  useEffect(() => {
    ;(async () => {
      let weather: { temp: number; emoji: string; ville: string } | null = null
      try {
        const raw = localStorage.getItem(CACHE_KEY)
        if (raw) {
          const c = JSON.parse(raw)
          if (Date.now() - c.ts < CACHE_TTL) weather = { temp: c.temp, emoji: c.emoji, ville: c.ville }
        }
        if (!weather) {
          const geo = await fetch('https://ipapi.co/json/').then(r => r.json())
          const lat = geo.latitude ?? -4.7793, lon = geo.longitude ?? 11.8656
          const ville = geo.city ?? 'Pointe-Noire'
          const w = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
            `&current=temperature_2m,weathercode&timezone=auto`
          ).then(r => r.json())
          const temp  = Math.round(w.current?.temperature_2m ?? 28)
          const emoji = weatherEmoji(w.current?.weathercode ?? 0)
          weather = { temp, emoji, ville }
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ...weather, ts: Date.now() }))
        }
      } catch {
        weather = { temp: 28, emoji: '☀️', ville: 'Pointe-Noire' }
      }
      const built: Slide[] = [
        { icon: weather.emoji, text: `${weather.temp}°C · ${weather.ville}` },
        { icon: '📅', text: new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) },
      ]
      const festif = getFestif()
      if (festif) built.push({ icon: festif.emoji, text: festif.msg })
      built.push(getTimeSlide())
      setSlides(built)
    })()
  }, [])

  // Cycle toutes les 5 s
  useEffect(() => {
    if (slides.length <= 1) return
    const id = setInterval(() => {
      setShow(false)
      setTimeout(() => { setIdx(i => (i + 1) % slides.length); setShow(true) }, 450)
    }, 5000)
    return () => clearInterval(id)
  }, [slides.length])

  const current = slides[idx] ?? slides[0]

  return (
    // Responsive : pleine largeur sur mobile, auto sur desktop
    <div className="flex items-center justify-between sm:justify-start gap-3 w-full lg:w-auto">

      {/* ── Ticker animé ── */}
      <div className="flex-1 lg:flex-none" style={{ minWidth: 0 }}>
        <AnimatePresence mode="wait">
          {show && current && (
            <motion.div key={idx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.38, ease: 'easeInOut' }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.22)' }}
            >
              <span className="text-sm leading-none shrink-0">{current.icon}</span>
              <span className="text-[11px] sm:text-[12px] font-semibold text-white/95 truncate leading-none">
                {current.text}
              </span>
              {/* Dots progression — cachés sur très petit écran */}
              <div className="hidden sm:flex items-center gap-0.5 ml-1 shrink-0">
                {slides.map((_, i) => (
                  <span key={i} className="rounded-full transition-all duration-300"
                    style={{
                      width: i === idx ? 10 : 4, height: 4,
                      background: i === idx ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
                    }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Palette couleurs Oraforme ── */}
      <div className="relative flex items-center gap-1 sm:gap-1.5 shrink-0">
        {THEMES.map(t => (
          <button key={t.id} onClick={() => changerTheme(t.id)} title={t.nom}
            className="rounded-full transition-all hover:scale-125 active:scale-95"
            style={{
              width: 16, height: 16,
              backgroundColor: t.primary,
              border: (isExplicit && theme.id === t.id)
                ? '2.5px solid #fff'
                : '2px solid rgba(255,255,255,0.4)',
              transform: (isExplicit && theme.id === t.id) ? 'scale(1.3)' : undefined,
              boxShadow: (isExplicit && theme.id === t.id) ? '0 0 0 2px rgba(255,255,255,0.25)' : 'none',
            }}
          />
        ))}

        {/* Dropdown tous les thèmes (mobile) */}
        <button onClick={() => setPicker(v => !v)} title="Thèmes"
          className="w-[16px] h-[16px] rounded-full flex items-center justify-center text-white/80 text-[9px] font-bold transition-all hover:scale-110"
          style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.35)' }}>
          ⋯
        </button>

        {/* Reset couleur secteur */}
        {isExplicit && (
          <button onClick={resetTheme} title="Revenir à la couleur secteur"
            className="w-[16px] h-[16px] rounded-full flex items-center justify-center text-white/70 text-[9px] font-bold transition-all hover:scale-110"
            style={{ background: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.25)' }}>
            ↺
          </button>
        )}

        {/* Dropdown palette complète */}
        {picker && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPicker(false)} />
            <div className="absolute right-0 top-8 z-50 bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] p-3 w-52"
              style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.14)' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2.5">
                Couleur de l&apos;interface
              </p>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {THEMES.map(t => (
                  <button key={t.id} onClick={() => { changerTheme(t.id); setPicker(false) }}
                    title={t.nom}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                    style={{
                      backgroundColor: t.primary,
                      outline: (isExplicit && theme.id === t.id) ? '2px solid #0F172A' : 'none',
                      outlineOffset: '2px',
                    }}>
                    {isExplicit && theme.id === t.id && (
                      <span className="text-white text-[11px] font-bold">✓</span>
                    )}
                  </button>
                ))}
              </div>
              {isExplicit ? (
                <button onClick={() => { resetTheme(); setPicker(false) }}
                  className="w-full text-[10px] text-[#94A3B8] hover:text-[#0F172A] py-1 transition-colors text-center">
                  ↺ Revenir à la couleur secteur
                </button>
              ) : (
                <p className="text-[10px] text-[#94A3B8] text-center py-1">Couleur basée sur votre secteur</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
