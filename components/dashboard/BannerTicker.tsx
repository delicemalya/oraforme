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
  const found = list.find(f => f.m === m && j >= f.j1 && j <= f.j2)
  return found ?? null
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
    <div className="hidden lg:flex items-center gap-4 shrink-0">

      {/* ── Ticker animé ── */}
      <div style={{ minWidth: 200 }}>
        <AnimatePresence mode="wait">
          {show && current && (
            <motion.div key={idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.38, ease: 'easeInOut' }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.22)' }}
            >
              <span className="text-base leading-none">{current.icon}</span>
              <span className="text-[12px] font-semibold text-white/95 whitespace-nowrap leading-none">
                {current.text}
              </span>
              {/* Dots progression */}
              <div className="flex items-center gap-0.5 ml-1">
                {slides.map((_, i) => (
                  <span key={i} className="rounded-full transition-all duration-300"
                    style={{
                      width: i === idx ? 12 : 4, height: 4,
                      background: i === idx ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
                    }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Palette couleurs Oraforme ── */}
      <div className="relative flex items-center gap-1.5">
        {THEMES.map(t => (
          <button key={t.id} onClick={() => changerTheme(t.id)} title={t.nom}
            className="rounded-full transition-all hover:scale-125"
            style={{
              width: 18, height: 18,
              backgroundColor: t.primary,
              border: (isExplicit && theme.id === t.id)
                ? '2.5px solid #fff'
                : '2px solid rgba(255,255,255,0.4)',
              transform: (isExplicit && theme.id === t.id) ? 'scale(1.3)' : undefined,
              boxShadow: (isExplicit && theme.id === t.id) ? '0 0 0 2px rgba(255,255,255,0.3)' : 'none',
            }}
          />
        ))}

        {/* Reset = revenir à la couleur secteur */}
        {isExplicit && (
          <button onClick={resetTheme} title="Revenir à la couleur du secteur"
            className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-white/70 text-[10px] font-bold transition-all hover:scale-110 hover:text-white"
            style={{ background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)' }}>
            ↺
          </button>
        )}
      </div>
    </div>
  )
}
