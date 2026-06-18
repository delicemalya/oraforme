'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { usePays } from '@/lib/contexts/PaysContext'

type DeviseItem = {
  devise: string
  symbole: string
  nom: string
  drapeau: string
  defaultPays: string
  paysCompatibles: string[]
  groupe: 'principales' | 'afrique' | 'maghreb' | 'europe'
}

// Une entrée par devise — FCFA = 1 seule ligne, pas 8 drapeaux répétés
const DEVISES: DeviseItem[] = [
  {
    devise: 'FCFA', symbole: '₣', nom: 'Franc CFA',
    drapeau: '🌍', defaultPays: 'CG',
    paysCompatibles: ['CG','CM','GA','TD','CF','GQ','SN','CI','ML','BF','TG','BJ','NE'],
    groupe: 'principales',
  },
  {
    devise: 'CDF', symbole: 'FC', nom: 'Franc Congolais',
    drapeau: '🇨🇩', defaultPays: 'CD',
    paysCompatibles: ['CD'],
    groupe: 'principales',
  },
  {
    devise: 'USD', symbole: '$', nom: 'Dollar américain',
    drapeau: '🇺🇸', defaultPays: 'US',
    paysCompatibles: ['US', 'CD_USD'],
    groupe: 'principales',
  },
  {
    devise: 'EUR', symbole: '€', nom: 'Euro',
    drapeau: '🇫🇷', defaultPays: 'FR',
    paysCompatibles: ['FR', 'BE'],
    groupe: 'europe',
  },
  {
    devise: 'KES', symbole: 'KSh', nom: 'Shilling kényan',
    drapeau: '🇰🇪', defaultPays: 'KE',
    paysCompatibles: ['KE'],
    groupe: 'afrique',
  },
  {
    devise: 'RWF', symbole: 'FRw', nom: 'Franc rwandais',
    drapeau: '🇷🇼', defaultPays: 'RW',
    paysCompatibles: ['RW'],
    groupe: 'afrique',
  },
  {
    devise: 'ZAR', symbole: 'R', nom: 'Rand sud-africain',
    drapeau: '🇿🇦', defaultPays: 'ZA',
    paysCompatibles: ['ZA'],
    groupe: 'afrique',
  },
  {
    devise: 'NGN', symbole: '₦', nom: 'Naira',
    drapeau: '🇳🇬', defaultPays: 'NG',
    paysCompatibles: ['NG'],
    groupe: 'afrique',
  },
  {
    devise: 'AOA', symbole: 'Kz', nom: 'Kwanza angolais',
    drapeau: '🇦🇴', defaultPays: 'AO',
    paysCompatibles: ['AO'],
    groupe: 'afrique',
  },
  {
    devise: 'MAD', symbole: 'DH', nom: 'Dirham marocain',
    drapeau: '🇲🇦', defaultPays: 'MA',
    paysCompatibles: ['MA'],
    groupe: 'maghreb',
  },
  {
    devise: 'DZD', symbole: 'DA', nom: 'Dinar algérien',
    drapeau: '🇩🇿', defaultPays: 'DZ',
    paysCompatibles: ['DZ'],
    groupe: 'maghreb',
  },
  {
    devise: 'TND', symbole: 'DT', nom: 'Dinar tunisien',
    drapeau: '🇹🇳', defaultPays: 'TN',
    paysCompatibles: ['TN'],
    groupe: 'maghreb',
  },
]

const GROUPES = ['principales', 'afrique', 'maghreb', 'europe'] as const
const GROUPE_LABELS: Record<string, string> = {
  principales: 'Principales',
  afrique:     'Afrique',
  maghreb:     'Maghreb',
  europe:      'Europe',
}

export default function DeviseSelector() {
  const { pays, setPays, paysGeo, detected } = usePays()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(item: DeviseItem) {
    if (item.paysCompatibles.includes(pays)) {
      // Déjà sur cette devise — cas spécial : CDF sélectionné depuis CD_USD → retour CD
      if (item.devise === 'CDF' && pays === 'CD_USD') setPays('CD')
    } else {
      // Cas spécial : USD sélectionné depuis RDC → utiliser CD_USD
      if (item.devise === 'USD' && pays === 'CD') setPays('CD_USD')
      else setPays(item.defaultPays)
    }
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      {/* Bouton : [drapeau] | [symbole] — deux zones distinctes */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] transition-colors overflow-hidden"
        title="Changer de devise"
      >
        <span className="flex items-center gap-1 px-2 py-1.5">
          <span className="text-base leading-none">{paysGeo.drapeau}</span>
          {detected && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" title="Détecté automatiquement" />
          )}
        </span>
        <span className="w-px h-5 bg-[#E2E8F0] shrink-0" />
        <span className="flex items-center gap-1 px-2 py-1.5">
          <span className="text-[11px] font-bold text-[#475569] leading-none">{paysGeo.symbole}</span>
          <ChevronDown size={11} className="text-[#94A3B8]" />
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-30 overflow-hidden">
            <div className="px-3 py-2 border-b border-[#F1F5F9]">
              <p className="text-[10px] font-semibold text-[#94A3B8] uppercase">Devise</p>
            </div>
            <div className="overflow-y-auto max-h-72">
              {GROUPES.map(groupe => {
                const items = DEVISES.filter(d => d.groupe === groupe)
                return (
                  <div key={groupe}>
                    <div className="px-3 py-1 text-[9px] font-semibold text-[#CBD5E1] uppercase tracking-wide bg-[#F8FAFC]">
                      {GROUPE_LABELS[groupe]}
                    </div>
                    {items.map(item => {
                      const isActive = item.paysCompatibles.includes(pays)
                      return (
                        <button
                          key={item.devise}
                          onClick={() => handleSelect(item)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 transition-colors ${
                            isActive
                              ? 'bg-amber-50 text-amber-700'
                              : 'text-[#0F172A] hover:bg-[#F8FAFC]'
                          }`}
                        >
                          <span className="text-base w-5 text-center shrink-0">{item.drapeau}</span>
                          <span className="flex-1 text-left text-xs truncate">{item.nom}</span>
                          <span className={`text-[12px] font-bold font-mono shrink-0 ${
                            isActive ? 'text-amber-600' : 'text-[#475569]'
                          }`}>{item.symbole}</span>
                        </button>
                      )
                    })}
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
