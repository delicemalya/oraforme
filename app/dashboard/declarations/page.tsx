'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  FileText, CheckCircle, Clock, AlertTriangle,
  ChevronRight, Building2, Receipt, Users, TrendingUp,
} from 'lucide-react'

const TEXT  = '#0F172A'
const MUTED = '#64748B'
const BORDER= '#E2E8F0'
const CARD  = '#FFFFFF'
const GREEN = '#16A34A'
const AMBER = '#F59E0B'
const RED   = '#DC2626'
const BLUE  = '#2563EB'
const BG    = '#F5F7FB'

const ANNEE = new Date().getFullYear()
const MOIS  = new Date().getMonth() + 1

interface PatenteInfo {
  statut: string
  patente_nette: number
  denomination: string
}

export default function DeclarationsPage() {
  const [patente, setPatente] = useState<PatenteInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/declarations/patente?annee=${ANNEE}`)
      .then(r => r.json())
      .then(d => setPatente(d.declaration ?? null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const echeancePatente = new Date(ANNEE, 0, 31)  // 31 janvier
  const joursPatente    = Math.ceil((echeancePatente.getTime() - Date.now()) / 86400_000)

  type Statut = 'soumise' | 'complete' | 'brouillon' | 'a_faire' | 'en_retard'

  const statutConfig: Record<Statut, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    soumise:   { label: 'Soumise',    color: GREEN, bg: '#F0FDF4', icon: <CheckCircle size={13} /> },
    complete:  { label: 'Complète',   color: BLUE,  bg: '#EFF6FF', icon: <CheckCircle size={13} /> },
    brouillon: { label: 'Brouillon',  color: AMBER, bg: '#FFFBEB', icon: <Clock       size={13} /> },
    a_faire:   { label: 'À déclarer', color: AMBER, bg: '#FFFBEB', icon: <Clock       size={13} /> },
    en_retard: { label: 'En retard',  color: RED,   bg: '#FEF2F2', icon: <AlertTriangle size={13} /> },
  }

  function getPatenteStatut(): Statut {
    if (!patente) return joursPatente < 0 ? 'en_retard' : 'a_faire'
    return (patente.statut as Statut) ?? 'brouillon'
  }

  const patenteStatut = getPatenteStatut()
  const psc = statutConfig[patenteStatut]

  const DECLARATIONS = [
    {
      id:          'patente',
      titre:       'Contribution de la Patente',
      reference:   'Formulaire 721M',
      periodicite: 'Annuelle',
      echeance:    `31 janvier ${ANNEE}`,
      icon:        <Building2 size={20} color={GREEN} />,
      href:        '/dashboard/declarations/patente',
      statut:      patenteStatut,
      montant:     patente?.patente_nette,
      note:        `Exercice ${ANNEE - 1}/${ANNEE}`,
    },
    {
      id:          'tva',
      titre:       'Déclaration TVA',
      reference:   'TVA 18% + CA 5%',
      periodicite: 'Mensuelle',
      echeance:    `20/${MOIS < 10 ? '0' : ''}${MOIS + 1 > 12 ? 1 : MOIS + 1}/${ANNEE}`,
      icon:        <Receipt size={20} color={BLUE} />,
      href:        '/dashboard/fiscalite/tva',
      statut:      'a_faire' as Statut,
      montant:     undefined,
      note:        'Via module Fiscalité',
    },
    {
      id:          'irpp',
      titre:       'IRPP & Charges salariales',
      reference:   'IRPP Congo',
      periodicite: 'Mensuelle',
      echeance:    `20/${MOIS < 10 ? '0' : ''}${MOIS + 1 > 12 ? 1 : MOIS + 1}/${ANNEE}`,
      icon:        <TrendingUp size={20} color="#8B5CF6" />,
      href:        '/dashboard/fiscalite/irpp',
      statut:      'a_faire' as Statut,
      montant:     undefined,
      note:        'Via module Fiscalité',
    },
    {
      id:          'cnss',
      titre:       'Cotisations CNSS',
      reference:   'CNSS Congo',
      periodicite: 'Mensuelle',
      echeance:    `15/${MOIS < 10 ? '0' : ''}${MOIS + 1 > 12 ? 1 : MOIS + 1}/${ANNEE}`,
      icon:        <Users size={20} color="#F59E0B" />,
      href:        '/dashboard/fiscalite/cnss',
      statut:      'a_faire' as Statut,
      montant:     undefined,
      note:        'Via module Fiscalité',
    },
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: TEXT, display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={22} color={RED} />
          Déclarations fiscales
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: MUTED }}>
          Congo-Brazzaville · DGI · Exercice {ANNEE}
        </p>
      </div>

      {/* Alerte patente */}
      {!loading && patenteStatut !== 'soumise' && patenteStatut !== 'complete' && (
        <div style={{
          background: joursPatente < 0 ? '#FEF2F2' : joursPatente < 30 ? '#FFFBEB' : '#F0FDF4',
          border: `1px solid ${joursPatente < 0 ? '#FECACA' : joursPatente < 30 ? '#FDE68A' : '#BBF7D0'}`,
          borderRadius: 12, padding: '12px 16px', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertTriangle size={16} color={joursPatente < 0 ? RED : AMBER} />
          <span style={{ fontSize: 13, color: joursPatente < 0 ? RED : '#92400E', fontWeight: 500 }}>
            {joursPatente < 0
              ? `Déclaration de patente en retard de ${Math.abs(joursPatente)} jours — pénalités applicables`
              : `Déclaration de patente à soumettre avant le 31 janvier ${ANNEE} · J-${joursPatente}`}
          </span>
          <Link href="/dashboard/declarations/patente"
            style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: BLUE, textDecoration: 'none' }}>
            Déclarer →
          </Link>
        </div>
      )}

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {DECLARATIONS.map(d => {
          const sc = statutConfig[d.statut]
          return (
            <Link key={d.id} href={d.href} style={{ textDecoration: 'none' }}>
              <div style={{
                background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14,
                padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16,
                borderLeft: `3px solid ${sc.color}`,
                transition: 'box-shadow 0.15s',
                cursor: 'pointer',
              }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
              >
                {/* Icon */}
                <div style={{
                  width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                  background: sc.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {d.icon}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>{d.titre}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>
                    {d.reference} · {d.periodicite} · Échéance : <strong>{d.echeance}</strong>
                  </div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{d.note}</div>
                </div>

                {/* Montant */}
                {d.montant !== undefined && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: sc.color }}>
                      {new Intl.NumberFormat('fr-CG').format(d.montant)} FCFA
                    </div>
                    <div style={{ fontSize: 10, color: MUTED }}>Patente nette</div>
                  </div>
                )}

                {/* Badge statut */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 12px', borderRadius: 20, background: sc.bg, color: sc.color,
                  fontWeight: 700, fontSize: 11, flexShrink: 0,
                }}>
                  {sc.icon} {sc.label}
                </div>

                <ChevronRight size={14} color="#CBD5E1" style={{ flexShrink: 0 }} />
              </div>
            </Link>
          )
        })}
      </div>

      {/* Informations légales */}
      <div style={{
        marginTop: 32, background: '#F8FAFC', border: `1px solid ${BORDER}`,
        borderRadius: 12, padding: '14px 18px',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, marginBottom: 8 }}>
          Obligations fiscales — Congo-Brazzaville
        </div>
        <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
          • <strong>Patente 721M</strong> : déclaration annuelle, échéance 31 janvier, base = CA HT exercice précédent<br />
          • <strong>TVA 18%</strong> + Centime Additionnel 5% : déclaration mensuelle avant le 20 du mois suivant<br />
          • <strong>IRPP</strong> : retenue à la source sur salaires, reversement mensuel avant le 20<br />
          • <strong>CNSS</strong> (cotisations sociales) : déclaration mensuelle avant le 15, taux salarial 5.04%, patronal 14.16%
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        body { background: ${BG}; }
      `}</style>
    </div>
  )
}
