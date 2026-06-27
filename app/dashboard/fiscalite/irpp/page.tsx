'use client'

import { useState, useCallback, useEffect } from 'react'
import { TrendingUp, Calculator, Info, Loader2, RefreshCw } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { PAYS_LIST, getPaysConfig } from '@/lib/fiscalite/pays'
import { calculerIRPP, calculerCNSS, fmtMontantPays } from '@/lib/fiscalite/engine'
import type { PaysFiscal } from '@/lib/fiscalite/types'

const TEXT  = '#0F172A'
const MUTED = '#64748B'
const BORDER= '#E2E8F0'
const CARD  = '#FFFFFF'
const AMBER = '#F59E0B'
const RED   = '#DC2626'
const GREEN = '#16A34A'

const MOIS_FR = ['Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.']

interface IrppMois {
  mois: number; annee: number; nb_employes: number
  revenu_brut: number; irpp_total: number; cnss_salarie: number; salaire_net: number
}

export default function IRPPPage() {
  const [pays, setPays] = useState<PaysFiscal>('CG')
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [declarations, setDeclarations] = useState<IrppMois[]>([])
  const [loading, setLoading] = useState(true)

  // Simulator state
  const [simBrut, setSimBrut] = useState('')
  const simResult = simBrut ? (() => {
    const brut = Number(simBrut.replace(/\s/g, ''))
    const cnss = calculerCNSS(brut, pays)
    const irpp = calculerIRPP(brut, pays)
    const net  = brut - cnss.salarie - irpp.irpp
    return { brut, cnss, irpp, net }
  })() : null

  const cfg = getPaysConfig(pays)
  const devise = PAYS_LIST.find(p => p.code === pays)?.devise ?? 'FCFA'

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/fiscalite/cnss?annee=${annee}&pays=${pays}`)
    if (res.ok) {
      const d = await res.json()
      setDeclarations((d.declarations ?? []).map((m: Record<string, number>) => ({
        mois: m.mois, annee: m.annee ?? annee,
        nb_employes: m.nb_employes ?? 0,
        revenu_brut: m.salaire_brut_total ?? 0,
        irpp_total: m.irpp_total ?? 0,
        cnss_salarie: m.cnss_salarie ?? 0,
        salaire_net: (m.salaire_brut_total ?? 0) - (m.cnss_salarie ?? 0) - (m.irpp_total ?? 0),
      })))
    }
    setLoading(false)
  }, [pays, annee])

  useEffect(() => { load() }, [load])

  const totaux = {
    revenu_brut: declarations.reduce((s, d) => s + d.revenu_brut, 0),
    irpp_total:  declarations.reduce((s, d) => s + d.irpp_total, 0),
    cnss_salarie:declarations.reduce((s, d) => s + d.cnss_salarie, 0),
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TEXT, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={20} color={AMBER} /> {cfg.irpp.nom} — Impôts sur salaires
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>
            Retenues à la source · {annee} · {PAYS_LIST.find(p => p.code === pays)?.drapeau} {PAYS_LIST.find(p => p.code === pays)?.nom}
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
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, border: `1px solid ${BORDER}`, background: CARD, cursor: 'pointer', fontSize: 12, color: MUTED }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Grid: tranches + simulator */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Tranches IRPP */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={14} color={AMBER} />
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT }}>Barème {cfg.irpp.nom}</h2>
          </div>
          <div style={{ padding: '8px 0' }}>
            <div style={{ padding: '8px 18px 4px', fontSize: 11, color: MUTED, fontWeight: 600 }}>
              Abattement forfaitaire : {(cfg.irpp.abattement_pct * 100).toFixed(0)}%
            </div>
            {cfg.irpp.tranches.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 18px', borderTop: i > 0 ? `1px solid #F8FAFC` : undefined }}>
                <div style={{ flex: 1, fontSize: 12, color: TEXT }}>
                  {t.min.toLocaleString('fr-FR')} — {t.max === Infinity ? '∞' : t.max.toLocaleString('fr-FR')} {devise}
                </div>
                <div style={{
                  padding: '3px 10px', borderRadius: 20, fontWeight: 700, fontSize: 12,
                  background: t.taux === 0 ? '#F0FDF4' : t.taux < 0.20 ? '#FFFBEB' : '#FEF2F2',
                  color: t.taux === 0 ? GREEN : t.taux < 0.20 ? AMBER : RED,
                }}>
                  {(t.taux * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Simulateur */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calculator size={14} color={AMBER} />
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT }}>Simulateur bulletinde paie</h2>
          </div>
          <div style={{ padding: 18 }}>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 6 }}>SALAIRE BRUT</span>
              <input
                type="text"
                value={simBrut}
                onChange={e => setSimBrut(e.target.value.replace(/[^0-9\s]/g, ''))}
                placeholder={`Ex: 500 000 ${devise}`}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${BORDER}`,
                  fontSize: 14, color: TEXT, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </label>
            {simResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Salaire brut', value: simResult.brut, color: TEXT },
                  { label: `${cfg.cnss.acronyme} salarié (${(cfg.cnss.taux_salarie * 100).toFixed(2)}%)`, value: -simResult.cnss.salarie, color: RED },
                  { label: `${cfg.irpp.nom}`, value: -simResult.irpp.irpp, color: AMBER },
                  { label: '= Salaire net', value: simResult.net, color: GREEN, bold: true },
                  { label: `${cfg.cnss.acronyme} patronal (${(cfg.cnss.taux_patronal * 100).toFixed(2)}%)`, value: simResult.cnss.patronal, color: '#7C3AED', hr: true },
                  { label: 'Coût total employeur', value: simResult.brut + simResult.cnss.patronal, color: RED },
                ].map((item, i) => (
                  <div key={i}>
                    {(item as { hr?: boolean }).hr && <div style={{ height: 1, background: BORDER, margin: '4px 0' }} />}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: (item as { bold?: boolean }).bold ? TEXT : MUTED, fontWeight: (item as { bold?: boolean }).bold ? 700 : 400 }}>{item.label}</span>
                      <span style={{ fontSize: 13, fontWeight: (item as { bold?: boolean }).bold ? 800 : 600, color: item.color }}>
                        {item.value < 0 ? '- ' : ''}{fmtMontantPays(Math.abs(item.value), pays)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPIs annuels IRPP */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Masse salariale', value: totaux.revenu_brut, color: TEXT },
          { label: `${cfg.cnss.acronyme} salarié`, value: totaux.cnss_salarie, color: '#7C3AED' },
          { label: cfg.irpp.nom, value: totaux.irpp_total, color: AMBER },
          { label: 'Net total versé', value: totaux.revenu_brut - totaux.irpp_total - totaux.cnss_salarie, color: GREEN },
        ].map(k => (
          <div key={k.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: k.color }}>{fmtMontantPays(k.value, pays)}</div>
            <div style={{ fontSize: 10, color: MUTED, marginTop: 3, fontWeight: 600, textTransform: 'uppercase' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Chart IRPP mensuel */}
      {!loading && declarations.some(d => d.irpp_total > 0) && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: TEXT }}>{cfg.irpp.nom} et {cfg.cnss.acronyme} retenus — {annee}</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={declarations.map(d => ({
              mois: MOIS_FR[d.mois - 1],
              irpp: d.irpp_total,
              cnss: d.cnss_salarie,
            }))} margin={{ top: 4, right: 12, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
              <XAxis dataKey="mois" tick={{ fontSize: 10, fill: MUTED }} />
              <YAxis tick={{ fontSize: 10, fill: MUTED }} width={72}
                tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v/1000)}k` : String(v)} />
              <Tooltip
                formatter={(v: unknown, name: unknown) => [fmtMontantPays(Number(v ?? 0), pays), name === 'irpp' ? cfg.irpp.nom : `${cfg.cnss.acronyme} salarié`]}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${BORDER}` }}
              />
              <Bar dataKey="irpp" fill={AMBER}    radius={[4,4,0,0]} maxBarSize={20} name="irpp" />
              <Bar dataKey="cnss" fill="#7C3AED"  radius={[4,4,0,0]} maxBarSize={20} name="cnss" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly IRPP table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: MUTED }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}` }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT }}>IRPP retenu à la source — {annee}</h2>
          </div>
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
            <thead>
              <tr style={{ background: TEXT, color: '#fff' }}>
                {['Mois','Employés','Masse salariale','CNSS salarié','IRPP retenu','Salaire net total'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Mois' ? 'left' : 'right', fontSize: 11, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {declarations.map(d => (
                <tr key={d.mois} style={{ borderBottom: '1px solid #F8FAFC', opacity: d.nb_employes === 0 ? 0.4 : 1 }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: TEXT }}>{MOIS_FR[d.mois - 1]}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: MUTED }}>{d.nb_employes || '—'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: MUTED }}>{fmtMontantPays(d.revenu_brut, pays)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#7C3AED', fontWeight: 700 }}>{fmtMontantPays(d.cnss_salarie, pays)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: AMBER, fontWeight: 800 }}>{fmtMontantPays(d.irpp_total, pays)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: GREEN, fontWeight: 700 }}>{fmtMontantPays(d.salaire_net, pays)}</td>
                </tr>
              ))}
              <tr style={{ background: TEXT, color: '#fff' }}>
                <td style={{ padding: '12px 14px', fontWeight: 800 }}>TOTAL {annee}</td>
                <td />
                <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>{fmtMontantPays(totaux.revenu_brut, pays)}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>{fmtMontantPays(totaux.cnss_salarie, pays)}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#FCD34D' }}>{fmtMontantPays(totaux.irpp_total, pays)}</td>
                <td />
              </tr>
            </tbody>
          </table></div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
