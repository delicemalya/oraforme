'use client'

import { useState, useRef, useEffect } from 'react'
import { MapPin, ChevronDown, Search, Loader2 } from 'lucide-react'
import { PAYS_DISPONIBLES } from '@/lib/pays-config'
import { detecterPaysParGPS } from '@/lib/geolocation'

interface Props {
  value:    string
  onChange: (code: string) => void
  accent?:  string
}

export default function PaysSelector({ value, onChange, accent = '#16A34A' }: Props) {
  const [open,       setOpen]       = useState(false)
  const [search,     setSearch]     = useState('')
  const [gpsLoading, setGpsLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = PAYS_DISPONIBLES.find(p => p.code === value) ?? PAYS_DISPONIBLES[0]

  const filtered = search.trim()
    ? PAYS_DISPONIBLES.filter(p =>
        p.nom.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase())
      )
    : PAYS_DISPONIBLES

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  async function handleGPS() {
    setGpsLoading(true)
    const code = await detecterPaysParGPS()
    if (code) {
      onChange(code)
      setOpen(false)
      setSearch('')
    }
    setGpsLoading(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>

      {/* ── Trigger ──────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          border: open ? `2px solid ${accent}` : '1px solid #E2E8F0',
          borderRadius: 12,
          background: 'white',
          cursor: 'pointer',
          fontSize: 13,
          outline: 'none',
          transition: 'border-color 0.15s',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20, lineHeight: 1 }}>{selected.drapeau}</span>
          <span style={{ color: '#0F172A', fontWeight: 500 }}>{selected.nom}</span>
          {!selected.fiscaliteDisponible && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#94A3B8',
              background: '#F1F5F9', padding: '2px 7px', borderRadius: 99,
              letterSpacing: '0.02em',
            }}>
              Bientôt disponible
            </span>
          )}
        </span>
        <ChevronDown
          size={14}
          style={{
            color: '#94A3B8',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
            flexShrink: 0,
          }}
        />
      </button>

      {/* ── Dropdown ─────────────────────────────────────────────────────── */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          zIndex: 100,
          background: 'white',
          border: '1px solid #E2E8F0',
          borderRadius: 12,
          boxShadow: '0 8px 28px rgba(0,0,0,0.13)',
          maxHeight: 320,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>

          {/* Search */}
          <div style={{
            padding: '10px 12px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex', alignItems: 'center', gap: 8,
            flexShrink: 0,
          }}>
            <Search size={13} style={{ color: '#94A3B8', flexShrink: 0 }} />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un pays…"
              style={{
                flex: 1, border: 'none', outline: 'none',
                fontSize: 13, color: '#0F172A', background: 'transparent',
              }}
            />
          </div>

          {/* GPS button */}
          <button
            type="button"
            onClick={handleGPS}
            disabled={gpsLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px',
              borderBottom: '1px solid #F1F5F9',
              background: 'transparent', border: 'none',
              cursor: gpsLoading ? 'wait' : 'pointer',
              fontSize: 12, color: '#2563EB', fontWeight: 600,
              textAlign: 'left', width: '100%',
              opacity: gpsLoading ? 0.7 : 1,
              flexShrink: 0,
            }}
          >
            {gpsLoading
              ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              : <MapPin size={13} />}
            📍 Utiliser ma position GPS
          </button>

          {/* Country list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 && (
              <p style={{ padding: '14px 16px', fontSize: 13, color: '#94A3B8', textAlign: 'center' }}>
                Aucun pays trouvé
              </p>
            )}
            {filtered.map(p => (
              <button
                key={p.code}
                type="button"
                onClick={() => { onChange(p.code); setOpen(false); setSearch('') }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px',
                  border: 'none',
                  background: p.code === value ? '#F0FDF4' : 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>{p.drapeau}</span>
                <span style={{
                  fontSize: 13, flex: 1,
                  color: p.code === value ? '#14532D' : '#0F172A',
                  fontWeight: p.code === value ? 600 : 400,
                }}>
                  {p.nom}
                </span>
                {!p.fiscaliteDisponible && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: '#94A3B8',
                    background: '#F1F5F9', padding: '1px 6px', borderRadius: 99,
                    flexShrink: 0,
                  }}>
                    Bientôt
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
