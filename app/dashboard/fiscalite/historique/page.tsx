'use client'

import { useState, useEffect, useCallback } from 'react'
import { History, Download, Loader2, RefreshCw, CheckCircle, Clock, AlertTriangle, XCircle, Edit3, FileText, X } from 'lucide-react'
import { PAYS_LIST } from '@/lib/fiscalite/pays'
import { fmtMontantPays } from '@/lib/fiscalite/engine'
import type { PaysFiscal, FiscalDeclaration, TypeDeclaration, StatutDeclaration } from '@/lib/fiscalite/types'

const TEXT  = '#0F172A'
const MUTED = '#64748B'
const BORDER= '#E2E8F0'
const CARD  = '#FFFFFF'
const GREEN = '#16A34A'
const AMBER = '#F59E0B'
const RED   = '#DC2626'
const BLUE  = '#2563EB'

const TYPE_LABELS: Record<string, string> = {
  tva: 'TVA', cnss: 'CNSS/Charges', irpp: 'IRPP',
  is: 'Impôt sociétés', patente: 'Patente', tvts: 'TVTS',
  contribution_appui: "Contrib. d'Appui", declaration_annuelle: 'Décl. annuelle', autre: 'Autre',
}
const MOIS_FR = ['Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.']

const STATUT_CFG: Record<StatutDeclaration, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  payee:       { label: 'Payée',      color: GREEN,  bg: '#F0FDF4', icon: <CheckCircle size={11} /> },
  deposee:     { label: 'Déposée',    color: BLUE,   bg: '#EFF6FF', icon: <FileText size={11} /> },
  a_faire:     { label: 'À faire',    color: AMBER,  bg: '#FFFBEB', icon: <Clock size={11} /> },
  en_cours:    { label: 'En cours',   color: BLUE,   bg: '#EFF6FF', icon: <Clock size={11} /> },
  en_retard:   { label: 'En retard',  color: RED,    bg: '#FEF2F2', icon: <AlertTriangle size={11} /> },
  contestee:   { label: 'Contestée',  color: '#7C3AED', bg: '#F5F3FF', icon: <XCircle size={11} /> },
}

export default function HistoriquePage() {
  const [pays, setPays]     = useState<PaysFiscal | 'tous'>('tous')
  const [annee, setAnnee]   = useState(new Date().getFullYear())
  const [typeF, setTypeF]   = useState<TypeDeclaration | 'tous'>('tous')
  const [statF, setStatF]   = useState<StatutDeclaration | 'tous'>('tous')
  const [declarations, setDeclarations] = useState<FiscalDeclaration[]>([])
  const [loading, setLoading] = useState(true)
  const [editDecl, setEditDecl] = useState<FiscalDeclaration | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ annee: String(annee) })
    if (pays !== 'tous') params.set('pays', pays)
    if (typeF !== 'tous') params.set('type', typeF)
    if (statF !== 'tous') params.set('statut', statF)
    const res = await fetch(`/api/fiscalite/declarations?${params}`)
    if (res.ok) {
      const d = await res.json()
      setDeclarations(d.declarations ?? [])
    }
    setLoading(false)
  }, [pays, annee, typeF, statF])

  useEffect(() => { load() }, [load])

  const exportCSV = () => {
    const rows = declarations.map(d => ({
      Type: TYPE_LABELS[d.type] ?? d.type,
      Pays: d.pays,
      Période: d.periode_mois ? `${MOIS_FR[d.periode_mois - 1]} ${d.periode_annee}` : String(d.periode_annee),
      Statut: STATUT_CFG[d.statut]?.label ?? d.statut,
      'Montant base': d.montant_base,
      'Montant dû': d.montant_du,
      'Montant payé': d.montant_paye,
      Pénalités: d.penalites,
      Échéance: d.date_echeance ?? '',
      Dépôt: d.date_depot ?? '',
      Paiement: d.date_paiement ?? '',
      Référence: d.reference_depot ?? '',
    }))
    if (!rows.length) return
    const csv = '﻿' + [Object.keys(rows[0]).join(';'), ...rows.map(r => Object.values(r).join(';'))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `declarations-${annee}.csv`
    a.click()
  }

  const handleSaveEdit = async () => {
    if (!editDecl) return
    setSaving(true)
    await fetch(`/api/fiscalite/declarations/${editDecl.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        statut: editDecl.statut,
        montant_paye: editDecl.montant_paye,
        date_paiement: editDecl.date_paiement,
        reference_depot: editDecl.reference_depot,
        notes: editDecl.notes,
      }),
    })
    setSaving(false)
    setEditDecl(null)
    await load()
  }

  const totalDu   = declarations.reduce((s, d) => s + d.montant_du, 0)
  const totalPaye = declarations.reduce((s, d) => s + d.montant_paye, 0)
  const totalReste = Math.max(0, totalDu - totalPaye)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TEXT, display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={20} color={MUTED} /> Historique des déclarations
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>
            {declarations.length} déclaration{declarations.length !== 1 ? 's' : ''} trouvée{declarations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={pays} onChange={e => setPays(e.target.value as PaysFiscal | 'tous')}
            style={{ border: `1px solid ${BORDER}`, borderRadius: 9, padding: '7px 11px', background: CARD, fontSize: 13 }}>
            <option value="tous">Tous les pays</option>
            {PAYS_LIST.map(p => <option key={p.code} value={p.code}>{p.drapeau} {p.nom}</option>)}
          </select>
          <select value={annee} onChange={e => setAnnee(Number(e.target.value))}
            style={{ border: `1px solid ${BORDER}`, borderRadius: 9, padding: '7px 11px', background: CARD, fontSize: 13 }}>
            {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
          </select>
          <select value={typeF} onChange={e => setTypeF(e.target.value as TypeDeclaration | 'tous')}
            style={{ border: `1px solid ${BORDER}`, borderRadius: 9, padding: '7px 11px', background: CARD, fontSize: 13 }}>
            <option value="tous">Tous types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={statF} onChange={e => setStatF(e.target.value as StatutDeclaration | 'tous')}
            style={{ border: `1px solid ${BORDER}`, borderRadius: 9, padding: '7px 11px', background: CARD, fontSize: 13 }}>
            <option value="tous">Tous statuts</option>
            {(Object.keys(STATUT_CFG) as StatutDeclaration[]).map(s => (
              <option key={s} value={s}>{STATUT_CFG[s].label}</option>
            ))}
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

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total dû', value: totalDu, color: RED },
          { label: 'Total payé', value: totalPaye, color: GREEN },
          { label: 'Reste à payer', value: totalReste, color: totalReste > 0 ? AMBER : GREEN },
        ].map(k => (
          <div key={k.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>
              {pays !== 'tous' ? fmtMontantPays(k.value, pays as PaysFiscal) : new Intl.NumberFormat('fr-FR').format(Math.round(k.value))}
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 3, fontWeight: 600, textTransform: 'uppercase' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: MUTED }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
          {declarations.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: MUTED }}>
              <History size={32} color="#CBD5E1" style={{ marginBottom: 12 }} />
              <div style={{ fontWeight: 600 }}>Aucune déclaration trouvée</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Modifiez les filtres ou commencez à enregistrer des déclarations</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: TEXT, color: '#fff' }}>
                    {['Type','Pays','Période','Base imposable','Montant dû','Montant payé','Pénalités','Échéance','Statut',''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Type' || h === 'Pays' || h === 'Période' || h === '' ? 'left' : 'right', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {declarations.map(d => {
                    const sc = STATUT_CFG[d.statut] ?? STATUT_CFG.a_faire
                    const declPays = PAYS_LIST.find(p => p.code === d.pays)
                    return (
                      <tr key={d.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: TEXT }}>
                          <span style={{ background: '#F8FAFC', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>
                            {TYPE_LABELS[d.type] ?? d.type}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: MUTED }}>
                          {declPays?.drapeau} {d.pays}
                        </td>
                        <td style={{ padding: '10px 14px', color: TEXT, fontWeight: 600 }}>
                          {d.periode_mois ? `${MOIS_FR[d.periode_mois - 1]} ${d.periode_annee}` : d.periode_annee}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: MUTED }}>
                          {declPays ? fmtMontantPays(d.montant_base, d.pays as PaysFiscal) : new Intl.NumberFormat('fr-FR').format(Math.round(d.montant_base))}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: RED }}>
                          {declPays ? fmtMontantPays(d.montant_du, d.pays as PaysFiscal) : new Intl.NumberFormat('fr-FR').format(Math.round(d.montant_du))}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: GREEN }}>
                          {d.montant_paye > 0 ? (declPays ? fmtMontantPays(d.montant_paye, d.pays as PaysFiscal) : new Intl.NumberFormat('fr-FR').format(Math.round(d.montant_paye))) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: d.penalites > 0 ? RED : MUTED }}>
                          {d.penalites > 0 ? `+${new Intl.NumberFormat('fr-FR').format(Math.round(d.penalites))}` : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', color: MUTED, whiteSpace: 'nowrap' }}>
                          {d.date_echeance ? new Date(d.date_echeance).toLocaleDateString('fr-FR') : '—'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 700, fontSize: 10 }}>
                            {sc.icon} {sc.label}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <button onClick={() => setEditDecl(d)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, display: 'flex', alignItems: 'center' }}>
                            <Edit3 size={13} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit modal */}
      {editDecl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: CARD, borderRadius: 16, width: '100%', maxWidth: 480, overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEXT }}>
                Modifier — {TYPE_LABELS[editDecl.type]} {editDecl.periode_mois ? `${MOIS_FR[editDecl.periode_mois - 1]} ` : ''}{editDecl.periode_annee}
              </h2>
              <button onClick={() => setEditDecl(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'block' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 5 }}>STATUT</span>
                <select value={editDecl.statut} onChange={e => setEditDecl({ ...editDecl, statut: e.target.value as StatutDeclaration })}
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 13 }}>
                  {(Object.keys(STATUT_CFG) as StatutDeclaration[]).map(s => (
                    <option key={s} value={s}>{STATUT_CFG[s].label}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'block' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 5 }}>MONTANT PAYÉ</span>
                <input type="number" value={editDecl.montant_paye} onChange={e => setEditDecl({ ...editDecl, montant_paye: Number(e.target.value) })}
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 13, boxSizing: 'border-box' }} />
              </label>
              <label style={{ display: 'block' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 5 }}>DATE DE PAIEMENT</span>
                <input type="date" value={editDecl.date_paiement ?? ''} onChange={e => setEditDecl({ ...editDecl, date_paiement: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 13, boxSizing: 'border-box' }} />
              </label>
              <label style={{ display: 'block' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 5 }}>RÉFÉRENCE DÉPÔT</span>
                <input type="text" value={editDecl.reference_depot ?? ''} onChange={e => setEditDecl({ ...editDecl, reference_depot: e.target.value })}
                  placeholder="Ex : DGI-2025-001234"
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 13, boxSizing: 'border-box' }} />
              </label>
              <label style={{ display: 'block' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 5 }}>NOTES</span>
                <textarea value={editDecl.notes ?? ''} onChange={e => setEditDecl({ ...editDecl, notes: e.target.value })}
                  rows={2} placeholder="Remarques ou observations..."
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
              </label>
            </div>
            <div style={{ padding: '14px 22px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditDecl(null)}
                style={{ padding: '8px 18px', borderRadius: 9, border: `1px solid ${BORDER}`, background: CARD, cursor: 'pointer', fontSize: 13, color: MUTED }}>
                Annuler
              </button>
              <button onClick={handleSaveEdit} disabled={saving}
                style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: BLUE, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
