'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Receipt, Download, Calendar,
  RefreshCw, Loader2, Info, FileText,
} from 'lucide-react'
import { PAYS_LIST, getPaysConfig } from '@/lib/fiscalite/pays'
import type { PaysFiscal } from '@/lib/fiscalite/types'

const TEXT  = '#0F172A'
const MUTED = '#64748B'
const BORDER= '#E2E8F0'
const CARD  = '#FFFFFF'
const BLUE  = '#2563EB'
const GREEN = '#16A34A'
const RED   = '#DC2626'
const AMBER = '#F59E0B'

const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

interface TvaMois {
  mois: number; annee: number
  tva_collectee: number; tva_deductible: number; tva_nette: number
  taxes_additionnelles: Record<string, number>
  total_a_payer: number; credit_tva: number; ca_ht: number
}

interface Totaux {
  tva_collectee: number; tva_deductible: number; total_a_payer: number
  credit_tva: number; ca_ht: number
}

function fmtN(n: number, devise: string) {
  if (devise === 'EUR') return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
  if (devise === 'CHF') return new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(n)
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' ' + devise
}

export default function TVAFiscalPage() {
  const [pays, setPays] = useState<PaysFiscal>('CG')
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [declarations, setDeclarations] = useState<TvaMois[]>([])
  const [totaux, setTotaux] = useState<Totaux | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded] = useState<number | null>(null)
  const [saving, setSaving] = useState<number | null>(null)

  const cfg = getPaysConfig(pays)
  const devise = PAYS_LIST.find(p => p.code === pays)?.devise ?? 'FCFA'

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/fiscalite/tva?annee=${annee}&pays=${pays}`)
    if (res.ok) {
      const d = await res.json()
      setDeclarations(d.declarations ?? [])
      setTotaux(d.totaux ?? null)
    }
    setLoading(false)
  }, [pays, annee])

  useEffect(() => { load() }, [load])

  const handleDeposer = async (decl: TvaMois) => {
    setSaving(decl.mois)
    await fetch('/api/fiscalite/declarations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'tva',
        pays,
        periode_mois: decl.mois,
        periode_annee: decl.annee,
        montant_base: decl.ca_ht,
        montant_du: decl.total_a_payer,
        statut: 'deposee',
        date_echeance: `${annee}-${String(decl.mois + 1).padStart(2,'0')}-${cfg.tva.echeance_jour}`,
        date_depot: new Date().toISOString().split('T')[0],
      }),
    })
    setSaving(null)
  }

  function exportCSV() {
    const rows = declarations.map(d => ({
      Mois: MOIS_FR[d.mois - 1], Exercice: d.annee, Pays: pays,
      'CA HT': d.ca_ht, [`TVA collectée (${(cfg.tva.taux_normal * 100).toFixed(1)}%)`]: d.tva_collectee,
      'TVA déductible': d.tva_deductible, 'TVA nette': d.tva_nette,
      ...Object.fromEntries(cfg.tva.taxes_additionnelles.map(t => [`${t.nom}`, d.taxes_additionnelles[t.code] ?? 0])),
      'Total à payer': d.total_a_payer, 'Crédit TVA': d.credit_tva,
    }))
    if (!rows.length) return
    const csv = '﻿' + [Object.keys(rows[0]).join(';'), ...rows.map(r => Object.values(r).join(';'))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `tva-${pays}-${annee}.csv`
    a.click()
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TEXT, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt size={20} color={BLUE} /> TVA — Déclarations mensuelles
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>Exercice {annee} · {PAYS_LIST.find(p => p.code === pays)?.drapeau} {PAYS_LIST.find(p => p.code === pays)?.nom}</p>
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
            <Download size={13} /> Export CSV
          </button>
          <button onClick={load}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, border: `1px solid ${BORDER}`, background: CARD, cursor: 'pointer', fontSize: 12, color: MUTED }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Info banner — règles pays */}
      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Info size={15} color={BLUE} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: '#1E40AF', lineHeight: 1.6 }}>
          <strong>Régime TVA · {PAYS_LIST.find(p => p.code === pays)?.nom}</strong><br />
          TVA <strong>{(cfg.tva.taux_normal * 100).toFixed(1)}%</strong>
          {cfg.tva.taux_reduit ? ` · Réduit ${(cfg.tva.taux_reduit * 100).toFixed(1)}%` : ''}
          {cfg.tva.taxes_additionnelles.map(t => ` · ${t.nom} ${(t.taux * 100).toFixed(0)}%`).join('')}
          {' · Déclaration avant le '}<strong>{cfg.tva.echeance_jour}</strong>
          {cfg.tva.echeance_mois_suivant ? ' du mois suivant' : ' du même mois'}
          {' · Seuil assujettissement : '}<strong>{cfg.tva.seuil_assujettissement.toLocaleString('fr-FR')} {devise}</strong>
        </div>
      </div>

      {/* KPIs annuels */}
      {totaux && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'CA HT annuel',    value: totaux.ca_ht,         color: TEXT },
            { label: 'TVA collectée',   value: totaux.tva_collectee,  color: BLUE },
            { label: 'TVA déductible',  value: totaux.tva_deductible, color: GREEN },
            { label: 'Total à payer',   value: totaux.total_a_payer,  color: RED },
            { label: 'Crédit TVA',      value: totaux.credit_tva,     color: GREEN },
          ].map(k => (
            <div key={k.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: k.color }}>{fmtN(k.value, devise)}</div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 3, fontWeight: 600, textTransform: 'uppercase' }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Monthly table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: MUTED }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}` }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT }}>Déclarations mensuelles {annee}</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: TEXT, color: '#fff' }}>
                  {['Mois','CA HT','TVA Collectée','TVA Déductible','TVA Nette','Taxes additionnelles','Total à payer','Statut','Action'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Mois' ? 'left' : 'right', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {declarations.map(d => {
                  const isEmpty   = d.tva_collectee === 0 && d.tva_deductible === 0
                  const isCredit  = d.tva_nette < 0
                  const taxesAdd  = Object.values(d.taxes_additionnelles).reduce((a, b) => a + b, 0)

                  return (
                    <tr key={d.mois} style={{
                      borderBottom: `1px solid #F8FAFC`,
                      background: expanded === d.mois ? '#F8FAFC' : '#fff',
                      opacity: isEmpty ? 0.45 : 1,
                    }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: TEXT, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Calendar size={12} color="#94A3B8" />
                        {MOIS_FR[d.mois - 1]}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: MUTED }}>{fmtN(d.ca_ht, devise)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: BLUE }}>{fmtN(d.tva_collectee, devise)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: GREEN }}>{fmtN(d.tva_deductible, devise)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: isCredit ? GREEN : RED }}>
                        {fmtN(Math.abs(d.tva_nette), devise)}
                        <span style={{ marginLeft: 4, fontSize: 9 }}>{isCredit ? '↓ Crédit' : d.tva_nette > 0 ? '↑ Dû' : ''}</span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: AMBER, fontWeight: 600 }}>{fmtN(taxesAdd, devise)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: d.total_a_payer > 0 ? RED : GREEN }}>
                        {fmtN(d.total_a_payer, devise)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        {isEmpty ? (
                          <span style={{ color: MUTED, fontSize: 10 }}>—</span>
                        ) : isCredit ? (
                          <span style={{ background: '#F0FDF4', color: GREEN, padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>Crédit</span>
                        ) : (
                          <span style={{ background: '#FEF2F2', color: RED, padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>À déclarer</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        {!isEmpty && d.total_a_payer > 0 && (
                          <button
                            onClick={() => handleDeposer(d)}
                            disabled={saving === d.mois}
                            style={{
                              padding: '4px 10px', borderRadius: 7, border: 'none',
                              background: BLUE, color: '#fff', cursor: 'pointer',
                              fontSize: 11, fontWeight: 600,
                              display: 'flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            {saving === d.mois ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={11} />}
                            Déposer
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {/* TOTAL */}
                {totaux && (
                  <tr style={{ background: TEXT, color: '#fff' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, fontSize: 12 }}>TOTAL {annee}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>{fmtN(totaux.ca_ht, devise)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>{fmtN(totaux.tva_collectee, devise)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>{fmtN(totaux.tva_deductible, devise)}</td>
                    <td colSpan={2} />
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#FCD34D' }}>{fmtN(totaux.total_a_payer, devise)}</td>
                    <td colSpan={2} />
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
