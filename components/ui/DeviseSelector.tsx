'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { usePays } from '@/lib/contexts/PaysContext'

const ZONES = ['CEMAC', 'UEMOA', 'maghreb', 'anglophone', 'UE', 'autre'] as const
const ZONE_LABELS: Record<string, string> = {
  CEMAC:      'Afrique Centrale',
  UEMOA:      'Afrique de l\'Ouest',
  maghreb:    'Maghreb',
  anglophone: 'Afrique Anglophone',
  UE:         'Europe',
  autre:      'Autres',
}

export default function DeviseSelector() {
  const { pays, setPays, paysGeo, liste, detected } = usePays()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      {/* Bouton : [drapeau] | [symbole devise] — deux zones visuelles distinctes */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] transition-colors overflow-hidden"
        title="Changer de pays / devise"
      >
        {/* Zone pays — drapeau uniquement */}
        <span className="flex items-center gap-1 px-2 py-1.5">
          <span className="text-base leading-none">{paysGeo.drapeau}</span>
          {detected && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" title="Détecté automatiquement" />
          )}
        </span>

        {/* Séparateur vertical */}
        <span className="w-px h-5 bg-[#E2E8F0] shrink-0" />

        {/* Zone devise — symbole uniquement */}
        <span className="flex items-center gap-1 px-2 py-1.5">
          <span className="text-[11px] font-bold text-[#475569] leading-none">{paysGeo.symbole}</span>
          <ChevronDown size={11} className="text-[#94A3B8]" />
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-60 bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-30 overflow-hidden">

            <div className="px-3 py-2 border-b border-[#F1F5F9] flex items-center gap-2">
              <span className="text-[10px] font-semibold text-[#94A3B8] uppercase flex-1">Pays & Devise</span>
              <span className="text-[9px] text-[#CBD5E1]">drapeau · symbole</span>
            </div>

            <div className="overflow-y-auto max-h-80">
              {ZONES.map(zone => {
                const countriesInZone = liste.filter(p => p.zone === zone)
                if (!countriesInZone.length) return null
                return (
                  <div key={zone}>
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-[#94A3B8] uppercase bg-[#F8FAFC]">
                      {ZONE_LABELS[zone]}
                    </div>
                    {countriesInZone.map(p => (
                      <button
                        key={p.code}
                        onClick={() => { setPays(p.code); setOpen(false) }}
                        className={`w-full flex items-center gap-2 px-3 py-2 transition-colors ${
                          pays === p.code
                            ? 'bg-amber-50 text-amber-700'
                            : 'text-[#0F172A] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        {/* Drapeau */}
                        <span className="text-base w-5 text-center shrink-0">{p.drapeau}</span>
                        {/* Nom pays */}
                        <span className="flex-1 text-left text-xs truncate">{p.nom}</span>
                        {/* Symbole devise */}
                        <span className={`text-[11px] font-bold font-mono shrink-0 min-w-[28px] text-right ${
                          pays === p.code ? 'text-amber-600' : 'text-[#64748B]'
                        }`}>{p.symbole}</span>
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
