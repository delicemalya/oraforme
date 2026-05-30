'use client'

import { useState, useEffect, useCallback } from 'react'
import { Building2, CheckCircle, Clock, AlertTriangle, Loader2, RefreshCw, FileText, Info } from 'lucide-react'
import { PAYS_LIST, getPaysConfig } from '@/lib/fiscalite/pays'
import { fmtMontantPays } from '@/lib/fiscalite/engine'
import type { PaysFiscal, FiscalDeclaration } from '@/lib/fiscalite/types'

const TEXT  = '#0F172A'
const MUTED = '#64748B'
const BORDER= '#E2E8F0'
const CARD  = '#FFFFFF'
const GREEN = '#16A34A'
const AMBER = '#F59E0B'
const RED   = '#DC2626'

const MOIS_LABELS = ['Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.']

interface PatenteTaxe {
  code: string; nom: string; base: string
  taux?: number; montant_fixe?: number
  echeance_mois: number; echeance_jour: number
}

interface TaxeStatus extends PatenteTaxe {
  declaration?: FiscalDeclaration
  statut: 'payee' | 'deposee' | 'a_faire' | 'en_retard'
  jours_restants: number
}

export default function PatentePage() {
  const [pays, setPays] = useState<PaysFiscal>('CG')
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [declarations, setDeclarations] = useState<FiscalDeclaration[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [caAnnuel, setCaAnnuel] = useState<number>(0)

  const cfg = getPaysConfig(pays)
  const devise = PAYS_LIST.find(p => p.code === pays)?.devise ?? 'FCFA'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [declRes, tvaRes] = await Promise.all([
        fetch(`/api/fiscalite/declarations?pays=${pays}&annee=${annee}&type=patente,tvts,contribution_appui`),
        fetch(`/api/fiscalite/tva?annee=${annee}&pays=${pays}`),
      ])
      if (declRes.ok) {
        const d = await declRes.json()
        setDeclarations(d.declarations ?? [])
      }
      if (tvaRes.ok) {
        const d = await tvaRes.json()
        setCaAnnuel(d.totaux?.ca_ht ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [pays, annee])

  useEffect(() => { load() }, [load])

  const taxes: TaxeStatus[] = cfg.taxes_annuelles.map((t: PatenteTaxe) => {
    const now = new Date()
    const echeance = new Date(annee, t.echeance_mois - 1, t.echeance_jour)
    const jours_restants = Math.ceil((echeance.getTime() - now.getTime()) / 86400_000)
    const decl = declarations.find(d => d.type === t.code.toLowerCase() || d.type === 'tvts' && t.code === 'TVTS')
    const statut = decl?.statut === 'payee' ? 'payee'
      : decl?.statut === 'deposee' ? 'deposee'
      : jours_restants < 0 ? 'en_retard'
      : 'a_faire'
    return { ...t, declaration: decl, statut, jours_restants }
  })

  const montantPatente = (t: PatenteTaxe): number => {
    if (t.montant_fixe) return t.montant_fixe
    if (t.taux && caAnnuel) return caAnnuel * t.taux
    return 0
  }

  const handleDeclarer = async (t: PatenteTaxe) => {
    setSaving(t.code)
    await fetch('/api/fiscalite/declarations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: t.code.toLowerCase(),
        pays,
        periode_mois: t.echeance_mois,
        periode_annee: annee,
        montant_base: caAnnuel,
        montant_du: montantPatente(t),
        statut: 'deposee',
        date_echeance: `${annee}-${String(t.echeance_mois).padStart(2, '0')}-${String(t.echeance_jour).padStart(2, '0')}`,
        date_depot: new Date().toISOString().split('T')[0],
      }),
    })
    setSaving(null)
    await load()
  }

  const STATUT_CONFIG = {
    payee:     { label: 'Payée',     color: GREEN, bg: '#F0FDF4', icon: <CheckCircle size={12} /> },
    deposee:   { label: 'Déposée',   color: '#2563EB', bg: '#EFF6FF', icon: <FileText size={12} /> },
    a_faire:   { label: 'À déclarer', color: AMBER, bg: '#FFFBEB', icon: <Clock size={12} /> },
    en_retard: { label: 'En retard', color: RED,   bg: '#FEF2F2', icon: <AlertTriangle size={12} /> },
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TEXT, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={20} color={GREEN} /> Patente & Taxes professionnelles
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>
            Taxes annuelles · {annee} · {PAYS_LIST.find(p => p.code === pays)?.drapeau} {PAYS_LIST.find(p => p.code === pays)?.nom}
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

      {/* Notes importantes */}
      {cfg.notes_importantes.length > 0 && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10 }}>
          <Info size={15} color={GREEN} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: '#15803D', lineHeight: 1.7 }}>
            {cfg.notes_importantes.map((note, i) => (
              <div key={i}>• {note}</div>
            ))}
          </div>
        </div>
      )}

      {/* CA annuel */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, textTransform: 'uppercase' }}>CA HT annuel (base de calcul patente)</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: TEXT, marginTop: 4 }}>{fmtMontantPays(caAnnuel, pays)}</div>
        </div>
        {caAnnuel === 0 && (
          <div style={{ fontSize: 12, color: MUTED, background: '#F8FAFC', padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDER}` }}>
            Aucun CA TVA enregistré — le montant de patente sera calculé dès que vous enregistrez des ventes
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: MUTED }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : cfg.taxes_annuelles.length === 0 ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 48, textAlign: 'center', color: MUTED }}>
          <Building2 size={32} color="#CBD5E1" style={{ marginBottom: 12 }} />
          <div style={{ fontWeight: 600 }}>Aucune taxe annuelle configurée pour ce pays</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Contactez votre conseiller fiscal local</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {taxes.map(t => {
            const sc = STATUT_CONFIG[t.statut]
            const montant = montantPatente(t)
            return (
              <div key={t.code} style={{
                background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14,
                padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16,
                borderLeft: `3px solid ${sc.color}`,
              }}>
                {/* Badge type */}
                <div style={{
                  width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                  background: sc.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800, color: sc.color, textAlign: 'center',
                }}>
                  {t.code.slice(0, 4)}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>{t.nom}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>
                    Échéance : <strong>{t.echeance_jour} {MOIS_LABELS[t.echeance_mois - 1]} {annee}</strong>
                    {t.taux ? ` · ${(t.taux * 100).toFixed(2)}% du CA HT` : t.montant_fixe ? ` · Montant fixe` : ''}
                  </div>
                  {t.declaration?.reference_depot && (
                    <div style={{ fontSize: 11, color: '#2563EB', marginTop: 2 }}>Réf : {t.declaration.reference_depot}</div>
                  )}
                </div>

                {/* Montant */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: sc.color }}>{fmtMontantPays(montant, pays)}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                    {t.base === 'CA' ? 'Sur CA HT' : t.base === 'véhicule' ? 'Par véhicule' : t.base}
                  </div>
                </div>

                {/* Status + action */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 12px', borderRadius: 20, background: sc.bg, color: sc.color,
                    fontWeight: 700, fontSize: 11,
                  }}>
                    {sc.icon} {sc.label}
                    {t.statut === 'a_faire' && t.jours_restants > 0 && ` · J-${t.jours_restants}`}
                    {t.statut === 'en_retard' && ` · J+${Math.abs(t.jours_restants)}`}
                  </div>
                  {(t.statut === 'a_faire' || t.statut === 'en_retard') && (
                    <button
                      onClick={() => handleDeclarer(t)}
                      disabled={saving === t.code}
                      style={{
                        padding: '6px 14px', borderRadius: 8, border: 'none',
                        background: GREEN, color: '#fff', cursor: 'pointer',
                        fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      {saving === t.code ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={11} />}
                      Déclarer
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
