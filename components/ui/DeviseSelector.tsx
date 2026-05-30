'use client'

import { useState, useRef, useEffect } from 'react'
import { Globe, ChevronDown } from 'lucide-react'
import { usePays } from '@/lib/contexts/PaysContext'

const ZONES = ['CEMAC', 'UEMOA', 'maghreb', 'anglophone', 'UE', 'autre'] as const
const ZONE_LABELS: Record<string, string> = {
  CEMAC: 'Afrique Centrale (CEMAC)',
  UEMOA: 'Afrique de l\'Ouest (UEMOA)',
  maghreb: 'Maghreb',
  anglophone: 'Afrique Anglophone',
  UE: 'Europe',
  autre: 'Autres',
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
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] transition-colors text-sm"
        title="Changer de pays / devise"
      >
        <Globe size={13} className="text-[#64748B]" />
        <span className="text-base leading-none">{paysGeo.drapeau}</span>
        <span className="text-xs font-semibold text-[#64748B] hidden sm:block">{paysGeo.devise}</span>
        {detected && (
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" title="Détecté automatiquement" />
        )}
        <ChevronDown size={11} className="text-[#94A3B8]" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-30 overflow-hidden">
            <div className="p-2 border-b border-[#F1F5F9]">
              <p className="text-[10px] font-semibold text-[#94A3B8] uppercase px-2">Pays / Devise</p>
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
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-amber-50 transition-colors ${pays === p.code ? 'bg-amber-50 text-amber-700 font-semibold' : 'text-[#0F172A]'}`}
                      >
                        <span className="text-base w-5 text-center">{p.drapeau}</span>
                        <span className="flex-1 text-left text-xs">{p.nom}</span>
                        <span className="text-[10px] text-[#64748B] font-mono">{p.devise}</span>
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
