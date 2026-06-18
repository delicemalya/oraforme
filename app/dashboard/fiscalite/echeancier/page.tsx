'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, AlertTriangle, CheckCircle, Clock, Bell, Filter } from 'lucide-react'
import { PAYS_LIST } from '@/lib/fiscalite/pays'
import { calculerEcheancier } from '@/lib/fiscalite/engine'
import type { PaysFiscal, EcheanceFiscale } from '@/lib/fiscalite/types'
import { usePays } from '@/lib/contexts/PaysContext'

const TEXT  = '#0F172A'
const MUTED = '#64748B'
const BORDER= '#E2E8F0'
const CARD  = '#FFFFFF'
const RED   = '#DC2626'
const AMBER = '#F59E0B'
const GREEN = '#16A34A'
const BLUE  = '#2563EB'

const TYPE_LABELS: Record<string, string> = {
  tva: 'TVA', cnss: 'CNSS/Charges', irpp: 'IRPP',
  is: 'Impôt sur sociétés', patente: 'Patente',
  tvts: 'TVTS', contribution_appui: "Contrib. d'Appui",
  declaration_annuelle: 'Déclaration annuelle',
}

const TYPE_COLORS: Record<string, string> = {
  tva: BLUE, cnss: '#7C3AED', irpp: AMBER,
  is: RED, patente: GREEN, tvts: '#0891B2',
}

export default function EcheancierPage() {
  const { pays: paysDétecté } = usePays()
  const [pays, setPays] = useState<PaysFiscal>(() => paysDétecté as PaysFiscal || 'CG')
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [filter, setFilter] = useState<'tous' | 'urgent' | 'retard' | 'ok'>('tous')

  // Sync when tenant/geolocation resolves to a different country
  useEffect(() => {
    if (paysDétecté && paysDétecté !== pays) {
      setPays(paysDétecté as PaysFiscal)
    }
  }, [paysDétecté]) // eslint-disable-line react-hooks/exhaustive-deps

  const echeances = useMemo<EcheanceFiscale[]>(() => calculerEcheancier(pays, annee), [pays, annee])

  const filtered = useMemo(() =>
    filter === 'tous' ? echeances : echeances.filter(e => e.statut === filter),
    [echeances, filter],
  )

  const counts = useMemo(() => ({
    retard: echeances.filter(e => e.statut === 'retard').length,
    urgent: echeances.filter(e => e.statut === 'urgent').length,
    ok:     echeances.filter(e => e.statut === 'ok').length,
  }), [echeances])

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TEXT, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={20} color={RED} /> Échéancier fiscal
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>
            Calendrier des obligations fiscales · {annee}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={pays} onChange={e => setPays(e.target.value as PaysFiscal)}
            style={{ border: `1px solid ${BORDER}`, borderRadius: 9, padding: '7px 11px', background: CARD, fontSize: 13 }}>
            {PAYS_LIST.map(p => <option key={p.code} value={p.code}>{p.drapeau} {p.nom}</option>)}
          </select>
          <select value={annee} onChange={e => setAnnee(Number(e.target.value))}
            style={{ border: `1px solid ${BORDER}`, borderRadius: 9, padding: '7px 11px', background: CARD, fontSize: 13 }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Status summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { key: 'retard', label: 'En retard', count: counts.retard, color: RED, bg: '#FEF2F2', icon: <AlertTriangle size={18} color={RED} /> },
          { key: 'urgent', label: 'Urgent (< 7j)', count: counts.urgent, color: AMBER, bg: '#FFFBEB', icon: <Clock size={18} color={AMBER} /> },
          { key: 'ok', label: 'À venir', count: counts.ok, color: GREEN, bg: '#F0FDF4', icon: <CheckCircle size={18} color={GREEN} /> },
        ].map(s => (
          <motion.div
            key={s.key}
            whileHover={{ scale: 1.01 }}
            onClick={() => setFilter(filter === s.key ? 'tous' : s.key as 'tous' | 'urgent' | 'retard' | 'ok')}
            style={{
              background: filter === s.key ? s.bg : CARD,
              border: `1px solid ${filter === s.key ? s.color + '40' : BORDER}`,
              borderRadius: 14, padding: '16px 18px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12,
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <Filter size={14} color={MUTED} style={{ alignSelf: 'center', marginRight: 4 }} />
        {[{ key: 'tous', label: 'Toutes' }, { key: 'retard', label: '⚠ Retard' }, { key: 'urgent', label: '⏰ Urgent' }, { key: 'ok', label: '✓ À venir' }].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as typeof filter)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: `1px solid ${BORDER}`,
              background: filter === f.key ? TEXT : CARD,
              color: filter === f.key ? '#fff' : MUTED,
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 48, textAlign: 'center', color: MUTED }}>
            <CheckCircle size={32} color={GREEN} style={{ marginBottom: 12 }} />
            <div style={{ fontWeight: 600 }}>Aucune échéance dans cette catégorie</div>
          </div>
        ) : filtered.map((e, i) => {
          const sColor = e.statut === 'retard' ? RED : e.statut === 'urgent' ? AMBER : GREEN
          const sBg    = e.statut === 'retard' ? '#FEF2F2' : e.statut === 'urgent' ? '#FFFBEB' : '#F0FDF4'
          const typeColor = TYPE_COLORS[e.type] ?? BLUE

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              style={{
                background: CARD, border: `1px solid ${BORDER}`,
                borderRadius: 12, padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: 14,
                borderLeft: `3px solid ${sColor}`,
              }}
            >
              {/* Type badge */}
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: typeColor + '15',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 800, color: typeColor,
                textAlign: 'center', lineHeight: 1.2,
              }}>
                {e.type.toUpperCase().slice(0, 3)}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: TEXT }}>{e.label}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                  {TYPE_LABELS[e.type] ?? e.type} · Échéance : <strong>{new Date(e.date_echeance).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
                </div>
              </div>

              {/* Status pill */}
              <div style={{
                padding: '6px 12px', borderRadius: 20, background: sBg,
                color: sColor, fontWeight: 700, fontSize: 11, flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                {e.statut === 'retard' ? <AlertTriangle size={12} /> : e.statut === 'urgent' ? <Clock size={12} /> : <CheckCircle size={12} />}
                {e.statut === 'retard' ? `J+${Math.abs(e.jours_restants)}` : e.jours_restants === 0 ? "Aujourd'hui" : `J-${e.jours_restants}`}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
