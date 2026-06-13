'use client'
import { useState, useEffect } from 'react'

interface MeteoState {
  ville: string
  temp:  number
  emoji: string
}

interface InfoCache {
  ville: string
  temp:  number
  emoji: string
  ts:    number
}

const CACHE_KEY = 'oraforme_infobande'
const CACHE_TTL = 30 * 60 * 1000 // 30 min

function weatherEmoji(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 3)  return '⛅'
  if (code <= 49) return '🌫️'
  if (code <= 69) return '🌧️'
  if (code <= 84) return '🌦️'
  if (code <= 99) return '⛈️'
  return '🌤️'
}

function messageFestif(): { msg: string; emoji: string } | null {
  const d = new Date()
  const m = d.getMonth() + 1
  const j = d.getDate()
  const festifs = [
    { m: 1,  j1: 1,  j2: 7,  msg: 'Bonne Année',           emoji: '🎆' },
    { m: 2,  j1: 13, j2: 15, msg: 'Bonne Saint-Valentin',  emoji: '❤️'  },
    { m: 5,  j1: 1,  j2: 1,  msg: 'Fête du Travail',        emoji: '⚒️' },
    { m: 8,  j1: 15, j2: 16, msg: 'Fête Nationale 🇨🇬',     emoji: '🇨🇬' },
    { m: 12, j1: 24, j2: 26, msg: 'Joyeux Noël',            emoji: '🎄' },
    { m: 12, j1: 31, j2: 31, msg: 'Bonne Saint-Sylvestre',  emoji: '🥂' },
  ]
  const found = festifs.find(f => f.m === m && j >= f.j1 && j <= f.j2)
  return found ? { msg: found.msg, emoji: found.emoji } : null
}

export function InfoBande() {
  const [meteo,   setMeteo]   = useState<MeteoState | null>(null)
  const [visible, setVisible] = useState(true)

  const dateStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const festif = messageFestif()

  useEffect(() => {
    // Vérifier cache localStorage
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const cached: InfoCache = JSON.parse(raw)
        if (Date.now() - cached.ts < CACHE_TTL) {
          setMeteo({ ville: cached.ville, temp: cached.temp, emoji: cached.emoji })
          return
        }
      }
    } catch { /* cache corrompu, on refetch */ }

    // Fetch géo + météo
    ;(async () => {
      try {
        const geo = await fetch('https://ipapi.co/json/').then(r => r.json())
        const ville = geo.city ?? 'Pointe-Noire'
        const lat   = geo.latitude  ?? -4.7793
        const lon   = geo.longitude ?? 11.8656

        const w = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,weathercode&timezone=auto`
        ).then(r => r.json())

        const temp  = Math.round(w.current?.temperature_2m ?? 28)
        const emoji = weatherEmoji(w.current?.weathercode ?? 0)

        const result: MeteoState = { ville, temp, emoji }
        setMeteo(result)
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ...result, ts: Date.now() }))
      } catch {
        setMeteo({ ville: 'Pointe-Noire', temp: 28, emoji: '☀️' })
      }
    })()
  }, [])

  if (!visible) return null

  return (
    <div className="w-full shrink-0 flex items-center justify-between gap-2 px-4 lg:px-6 h-7
                    bg-[#0F172A] text-white/80 text-[10px] font-medium select-none overflow-hidden">

      <div className="flex items-center gap-3 min-w-0">
        {/* Météo */}
        {meteo && (
          <span className="flex items-center gap-1 shrink-0">
            <span>{meteo.emoji}</span>
            <span className="font-semibold text-white">{meteo.temp}°C</span>
            <span className="hidden sm:inline opacity-70">· {meteo.ville}</span>
          </span>
        )}

        {/* Séparateur */}
        {meteo && <span className="opacity-30 hidden sm:inline">|</span>}

        {/* Date */}
        <span className="capitalize hidden sm:inline opacity-80">{dateStr}</span>

        {/* Message festif */}
        {festif && (
          <>
            <span className="opacity-30">|</span>
            <span className="flex items-center gap-1 text-yellow-300 font-semibold animate-pulse">
              <span>{festif.emoji}</span>
              <span>{festif.msg}</span>
            </span>
          </>
        )}
      </div>

      {/* Fermer */}
      <button
        onClick={() => setVisible(false)}
        className="shrink-0 opacity-40 hover:opacity-80 transition-opacity text-[11px] leading-none"
        title="Masquer"
      >
        ✕
      </button>
    </div>
  )
}
