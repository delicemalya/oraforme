'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Users, Download, Loader2, RefreshCw, Info, FileText, CheckCircle, ExternalLink } from 'lucide-react'
import { PAYS_LIST, getPaysConfig } from '@/lib/fiscalite/pays'
import type { PaysFiscal } from '@/lib/fiscalite/types'

const TEXT  = '#0F172A'
const MUTED = '#64748B'
const BORDER= '#E2E8F0'
const CARD  = '#FFFFFF'
const PURPLE= '#7C3AED'
const GREEN = '#16A34A'
const RED   = '#DC2626'

const MOIS_FR = ['Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.']

function fmtN(n: number, devise: string) {
  if (devise === 'EUR') return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' ' + devise
}

interface CnssMois {
  mois: number; annee: number; nb_employes: number
  salaire_brut_total: number; cnss_salarie: number
  cnss_patronal: number; irpp_total: number; total_cnss: number
}

export default function CNSSPage() {
  const [pays, setPays] = useState<PaysFiscal>('CG')
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [declarations, setDeclarations] = useState<CnssMois[]>([])
  const [totaux, setTotaux] = useState<Record<string, number> | null>(null)
  const [config, setConfig]  = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState<number | null>(null)
  const [saved, setSaved]     = useState<Set<number>>(new Set())

  const cfg = getPaysConfig(pays)
  const devise = PAYS_LIST.find(p => p.code === pays)?.devise ?? 'FCFA'

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/fiscalite/cnss?annee=${annee}&pays=${pays}`)
    if (res.ok) {
      const d = await res.json()
      setDeclarations(d.declarations ?? [])
      setTotaux(d.totaux ?? null)
      setConfig(d.config ?? null)
    }
    setLoading(false)
  }, [pays, annee])

  useEffect(() => { load() }, [load])

  const handleBordereau = async (d: CnssMois) => {
    setSaving(d.mois)
    await fetch('/api/fiscalite/declarations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'cnss',
        pays,
        periode_mois: d.mois,
        periode_annee: d.annee,
        montant_base: d.salaire_brut_total,
        montant_du: d.total_cnss,
        statut: 'deposee',
        date_echeance: `${annee}-${String(d.mois + 1).padStart(2, '0')}-${cfg.cnss.echeance_jour}`,
        date_depot: new Date().toISOString().split('T')[0],
      }),
    })
    setSaved(prev => new Set([...prev, d.mois]))
    setSaving(null)
  }

  function exportCSV() {
    const rows = declarations.map(d => ({
      Mois: MOIS_FR[d.mois - 1], Exercice: d.annee, 'Nb. employés': d.nb_employes,
      'Masse salariale brute': d.salaire_brut_total,
      [`${config?.acronyme ?? 'CNSS'} salarié`]: d.cnss_salarie,
      [`${config?.acronyme ?? 'CNSS'} patronal`]: d.cnss_patronal,
      'IRPP': d.irpp_total,
      'Total': d.total_cnss,
    }))
    if (!rows.length) return
    const csv = '﻿' + [Object.keys(rows[0]).join(';'), ...rows.map(r => Object.values(r).join(';'))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `cnss-${pays}-${annee}.csv`
    a.click()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TEXT, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={20} color={PURPLE} /> {String(config?.acronyme ?? 'CNSS')} & Charges sociales
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>
            Déclarations {annee} · {PAYS_LIST.find(p => p.code === pays)?.drapeau} {PAYS_LIST.find(p => p.code === pays)?.nom}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={pays} onChange={e => setPays(e.target.value as PaysFiscal)}
            style={{ border: `1px solid ${BORDER}`, borderRadius: 9, padding: '7px 11px', background: CARD, fontSize: 13 }}>
            {PAYS_LIST.map(p => <option key={p.code} value={p.code}>{p.drapeau} {p.nom}</option>)}
          </select>
          <select value={annee} onChange={e => setAnnee(Number(e.target.value))}
            style={{ border: `1px solid ${BORDER}`, borderRadius: 9, padding: '7px 11px', background: CARD, fontSize: 13 }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
          </select>
          <button onClick={exportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, border: `1px solid ${BORDER}`, background: CARD, cursor: 'pointer', fontSize: 12, color: MUTED }}>
            <Download size={13} /> CSV
          </button>
          <button onClick={load}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, border: `1px solid ${BORDER}`, background: CARD, cursor: 'pointer', fontSize: 12, color: MUTED }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 12, padding: '12px 16px', marginBottom: pays === 'CG' ? 10 : 20, display: 'flex', gap: 10 }}>
        <Info size={15} color={PURPLE} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: '#5B21B6', lineHeight: 1.6 }}>
          <strong>{String(config?.nom ?? cfg.cnss.nom)}</strong> ·
          {pays === 'CG' ? (
            <span>
              {' '}Salarié <strong>4% VID</strong> (plaf. 1 200 000) ·
              Patronal <strong>8% VID</strong> (plaf. 1 200 000) + <strong>10.03% AF</strong> + <strong>2.25% AT</strong> (plaf. 600 000) + <strong>3% TUS</strong> (déplafonné) ·
              Total patronal <strong>23.28%</strong> ·
            </span>
          ) : (
            <span>
              {' '}Salarié <strong>{(cfg.cnss.taux_salarie * 100).toFixed(2)}%</strong> ·
              Patronal <strong>{(cfg.cnss.taux_patronal * 100).toFixed(2)}%</strong>
              {cfg.cnss.plafond_mensuel ? ` · Plafond ${cfg.cnss.plafond_mensuel.toLocaleString('fr-FR')} ${devise}/mois` : ' · Sans plafond'} ·
            </span>
          )}
          {' '}Dépôt avant le <strong>{cfg.cnss.echeance_jour}</strong>{cfg.cnss.echeance_mois_suivant ? ' du mois suivant' : ' du même mois'}
        </div>
      </div>

      {/* Congo — bannière télédéclaration officielle */}
      {pays === 'CG' && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>
            <strong>🇨🇬 CNSS Congo</strong> — Ce tableau affiche un récapitulatif annuel.
            Pour la télédéclaration officielle (formulaires conformes CNSS, PDF + Excel), utilisez le module dédié.
          </div>
          <Link href="/dashboard/declarations/cnss"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: '#F59E0B', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <ExternalLink size={13} /> Télédéclaration officielle
          </Link>
        </div>
      )}

      {/* KPIs */}
      {totaux && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Masse salariale', value: totaux.salaire_brut ?? 0, color: TEXT },
            { label: `${cfg.cnss.acronyme} salarié`, value: totaux.cnss_salarie ?? 0, color: PURPLE },
            { label: `${cfg.cnss.acronyme} patronal`, value: totaux.cnss_patronal ?? 0, color: '#9333EA' },
            { label: 'IRPP retenu', value: totaux.irpp_total ?? 0, color: '#F59E0B' },
            { label: `Total ${cfg.cnss.acronyme}`, value: totaux.total_cnss ?? 0, color: RED },
          ].map(k => (
            <div key={k.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: k.color }}>{fmtN(k.value, devise)}</div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 3, fontWeight: 600, textTransform: 'uppercase' }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: MUTED }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}` }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT }}>Bordereaux mensuels {annee}</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: TEXT, color: '#fff' }}>
                  {['Mois','Nb. employés','Masse salariale',`${cfg.cnss.acronyme} salarié`,`${cfg.cnss.acronyme} patronal`,'IRPP','Total charges','Action'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Mois' ? 'left' : 'right', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {declarations.map(d => {
                  const isEmpty = d.nb_employes === 0
                  const isSaved = saved.has(d.mois)
                  return (
                    <tr key={d.mois} style={{ borderBottom: '1px solid #F8FAFC', opacity: isEmpty ? 0.45 : 1 }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: TEXT }}>{MOIS_FR[d.mois - 1]}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: MUTED }}>
                        {d.nb_employes > 0 ? <span style={{ background: '#F5F3FF', color: PURPLE, padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>{d.nb_employes}</span> : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: MUTED }}>{fmtN(d.salaire_brut_total, devise)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: PURPLE }}>{fmtN(d.cnss_salarie, devise)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#9333EA' }}>{fmtN(d.cnss_patronal, devise)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#F59E0B' }}>{fmtN(d.irpp_total, devise)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: RED }}>{fmtN(d.total_cnss, devise)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        {!isEmpty && (
                          isSaved ? (
                            <span style={{ color: GREEN, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                              <CheckCircle size={12} /> Déposé
                            </span>
                          ) : (
                            <button
                              onClick={() => handleBordereau(d)}
                              disabled={saving === d.mois}
                              style={{ padding: '4px 10px', borderRadius: 7, border: 'none', background: PURPLE, color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              {saving === d.mois ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={11} />}
                              Bordereau
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  )
                })}
                {totaux && (
                  <tr style={{ background: TEXT, color: '#fff' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, fontSize: 12 }}>TOTAL {annee}</td>
                    <td />
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>{fmtN(totaux.salaire_brut ?? 0, devise)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>{fmtN(totaux.cnss_salarie ?? 0, devise)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>{fmtN(totaux.cnss_patronal ?? 0, devise)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>{fmtN(totaux.irpp_total ?? 0, devise)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#FCA5A5' }}>{fmtN(totaux.total_cnss ?? 0, devise)}</td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
