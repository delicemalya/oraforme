'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Receipt, Users, TrendingUp, Calendar, AlertTriangle,
  CheckCircle, Clock, ArrowRight, Loader2, RefreshCw,
  Building2, FileText,
} from 'lucide-react'
import Link from 'next/link'
import { PAYS_LIST } from '@/lib/fiscalite/pays'
import type { PaysFiscal } from '@/lib/fiscalite/types'

// ── Design tokens ─────────────────────────────────────────────────────────────
const CARD  = '#FFFFFF'
const TEXT  = '#0F172A'
const MUTED = '#64748B'
const BORDER= '#E2E8F0'
const BLUE  = '#2563EB'
const GREEN = '#16A34A'
const AMBER = '#F59E0B'
const RED   = '#DC2626'

function fmtN(n: number, devise = 'FCFA') {
  if (devise === 'EUR' || devise === 'CHF') {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: devise === 'CHF' ? 'CHF' : 'EUR' }).format(n)
  }
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' ' + devise
}

interface KpiData {
  tva_collectee: number; tva_deductible: number; tva_a_payer: number
  cnss_salarie: number; cnss_patronal: number; irpp_total: number
  nb_employes: number; ca_ht: number
}

interface EcheanceData {
  type: string; label: string; date_echeance: string
  jours_restants: number; statut: string; montant_estime?: number
}

export default function FiscaledashboardPage() {
  const [pays, setPays] = useState<PaysFiscal>('CG')
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [kpis, setKpis] = useState<KpiData | null>(null)
  const [echeances, setEcheances] = useState<EcheanceData[]>([])
  const [loading, setLoading] = useState(true)

  const paysConfig = PAYS_LIST.find(p => p.code === pays)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tvaRes, cnssRes] = await Promise.all([
        fetch(`/api/fiscalite/tva?annee=${annee}&pays=${pays}`),
        fetch(`/api/fiscalite/cnss?annee=${annee}&pays=${pays}`),
      ])

      const [tvaData, cnssData] = await Promise.all([
        tvaRes.json(),
        cnssRes.json(),
      ])

      setKpis({
        tva_collectee: tvaData.totaux?.tva_collectee ?? 0,
        tva_deductible: tvaData.totaux?.tva_deductible ?? 0,
        tva_a_payer: tvaData.totaux?.total_a_payer ?? 0,
        cnss_salarie: cnssData.totaux?.cnss_salarie ?? 0,
        cnss_patronal: cnssData.totaux?.cnss_patronal ?? 0,
        irpp_total: cnssData.totaux?.irpp_total ?? 0,
        nb_employes: cnssData.declarations?.find((d: { mois: number }) => d.mois === new Date().getMonth() + 1)?.nb_employes ?? 0,
        ca_ht: tvaData.totaux?.ca_ht ?? 0,
      })

      // Compute next deadlines for current year
      const allMonths = tvaData.declarations ?? []
      const now = new Date()
      const currentMois = now.getMonth() + 1

      const upcoming: EcheanceData[] = []
      for (let m = currentMois; m <= Math.min(currentMois + 2, 12); m++) {
        const tvaDecl = allMonths.find((d: { mois: number }) => d.mois === m)
        if (tvaDecl) {
          const echeanceDate = new Date(annee, m, 20) // mois suivant le 20
          upcoming.push({
            type: 'tva',
            label: `TVA ${new Date(annee, m - 1).toLocaleDateString('fr-FR', { month: 'long' })} ${annee}`,
            date_echeance: echeanceDate.toISOString().split('T')[0],
            jours_restants: Math.ceil((echeanceDate.getTime() - now.getTime()) / 86400_000),
            statut: echeanceDate < now ? 'retard' : Math.ceil((echeanceDate.getTime() - now.getTime()) / 86400_000) <= 7 ? 'urgent' : 'ok',
            montant_estime: tvaDecl.total_a_payer,
          })
        }

        const cnssDecl = cnssData.declarations?.find((d: { mois: number }) => d.mois === m)
        if (cnssDecl) {
          const echeanceDate = new Date(annee, m, 15)
          upcoming.push({
            type: 'cnss',
            label: `${cnssData.config?.acronyme ?? 'CNSS'} ${new Date(annee, m - 1).toLocaleDateString('fr-FR', { month: 'long' })} ${annee}`,
            date_echeance: echeanceDate.toISOString().split('T')[0],
            jours_restants: Math.ceil((echeanceDate.getTime() - now.getTime()) / 86400_000),
            statut: echeanceDate < now ? 'retard' : Math.ceil((echeanceDate.getTime() - now.getTime()) / 86400_000) <= 7 ? 'urgent' : 'ok',
            montant_estime: cnssDecl.total_cnss,
          })
        }
      }
      setEcheances(upcoming.sort((a, b) => a.date_echeance.localeCompare(b.date_echeance)))
    } finally {
      setLoading(false)
    }
  }, [pays, annee])

  useEffect(() => { load() }, [load])

  const devise = paysConfig?.devise ?? 'FCFA'

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: TEXT }}>
            Fiscalité & Déclarations
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>
            Tableau de bord fiscal — Exercice {annee}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Country selector */}
          <select
            value={pays}
            onChange={e => setPays(e.target.value as PaysFiscal)}
            style={{
              border: `1px solid ${BORDER}`, borderRadius: 10, padding: '8px 12px',
              background: CARD, fontSize: 13, color: TEXT, cursor: 'pointer',
            }}
          >
            {PAYS_LIST.map(p => (
              <option key={p.code} value={p.code}>{p.drapeau} {p.nom}</option>
            ))}
          </select>
          <select
            value={annee}
            onChange={e => setAnnee(Number(e.target.value))}
            style={{
              border: `1px solid ${BORDER}`, borderRadius: 10, padding: '8px 12px',
              background: CARD, fontSize: 13, color: TEXT,
            }}
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
          </select>
          <button
            onClick={load}
            style={{
              padding: '8px 14px', borderRadius: 10, border: `1px solid ${BORDER}`,
              background: CARD, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, color: MUTED,
            }}
          >
            <RefreshCw size={14} /> Actualiser
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: MUTED }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'CA HT annuel', value: kpis?.ca_ht ?? 0, color: TEXT, icon: <TrendingUp size={16} color={BLUE} />, suffix: '' },
              { label: 'TVA collectée', value: kpis?.tva_collectee ?? 0, color: BLUE, icon: <Receipt size={16} color={BLUE} />, suffix: '' },
              { label: 'TVA déductible', value: kpis?.tva_deductible ?? 0, color: GREEN, icon: <Receipt size={16} color={GREEN} />, suffix: '' },
              { label: 'TVA à payer', value: kpis?.tva_a_payer ?? 0, color: RED, icon: <AlertTriangle size={16} color={RED} />, suffix: '' },
              { label: 'CNSS total', value: (kpis?.cnss_salarie ?? 0) + (kpis?.cnss_patronal ?? 0), color: '#7C3AED', icon: <Users size={16} color="#7C3AED" />, suffix: '' },
              { label: 'IRPP total', value: kpis?.irpp_total ?? 0, color: AMBER, icon: <FileText size={16} color={AMBER} />, suffix: '' },
            ].map(k => (
              <motion.div
                key={k.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  {k.icon}
                  <span style={{ fontSize: 11, color: MUTED, fontWeight: 600, textTransform: 'uppercase' }}>{k.label}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>
                  {fmtN(k.value, devise)}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Two columns: Quick access + Upcoming deadlines */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Quick access modules */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXT }}>Modules déclaratifs</h2>
              </div>
              <div style={{ padding: '8px 0' }}>
                {[
                  { href: '/dashboard/fiscalite/tva', icon: <Receipt size={18} color={BLUE} />, label: 'TVA', sub: 'Déclarations mensuelles', bg: '#EFF6FF' },
                  { href: '/dashboard/fiscalite/cnss', icon: <Users size={18} color="#7C3AED" />, label: 'CNSS / Charges sociales', sub: 'Bordereaux de cotisation', bg: '#F5F3FF' },
                  { href: '/dashboard/fiscalite/irpp', icon: <TrendingUp size={18} color={AMBER} />, label: 'IRPP & Impôts salariés', sub: 'Retenues à la source', bg: '#FFFBEB' },
                  { href: '/dashboard/fiscalite/patente', icon: <Building2 size={18} color={GREEN} />, label: 'Patente & Licences', sub: 'Taxes professionnelles', bg: '#F0FDF4' },
                  { href: '/dashboard/fiscalite/echeancier', icon: <Calendar size={18} color={RED} />, label: 'Échéancier fiscal', sub: 'Calendrier des déclarations', bg: '#FEF2F2' },
                  { href: '/dashboard/fiscalite/controles', icon: <FileText size={18} color="#64748B" />, label: 'Contrôles fiscaux', sub: 'Audit & Conformité', bg: '#F8FAFC' },
                ].map(item => (
                  <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 20px', cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{item.label}</div>
                        <div style={{ fontSize: 11, color: MUTED }}>{item.sub}</div>
                      </div>
                      <ArrowRight size={14} color={MUTED} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Upcoming deadlines */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXT }}>Prochaines échéances</h2>
                <Link href="/dashboard/fiscalite/echeancier" style={{ fontSize: 12, color: BLUE, textDecoration: 'none', fontWeight: 600 }}>
                  Voir tout →
                </Link>
              </div>
              <div style={{ padding: '8px 0' }}>
                {echeances.length === 0 ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center', color: MUTED, fontSize: 13 }}>
                    <CheckCircle size={24} color={GREEN} style={{ marginBottom: 8 }} />
                    <div>Aucune échéance imminente</div>
                  </div>
                ) : echeances.slice(0, 6).map((e, i) => {
                  const statusColor = e.statut === 'retard' ? RED : e.statut === 'urgent' ? AMBER : GREEN
                  const statusBg   = e.statut === 'retard' ? '#FEF2F2' : e.statut === 'urgent' ? '#FFFBEB' : '#F0FDF4'
                  const TypeIcon   = e.type === 'tva' ? Receipt : Users

                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < 5 ? `1px solid #F8FAFC` : 'none' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: statusBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TypeIcon size={16} color={statusColor} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, marginBottom: 2 }}>{e.label}</div>
                        <div style={{ fontSize: 11, color: MUTED }}>
                          Échéance {new Date(e.date_echeance).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                          background: statusBg, color: statusColor,
                        }}>
                          {e.statut === 'retard' ? 'En retard' : e.jours_restants <= 0 ? 'Auj.' : `J-${e.jours_restants}`}
                        </div>
                        {e.montant_estime !== undefined && e.montant_estime > 0 && (
                          <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>
                            {fmtN(e.montant_estime, devise)}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
