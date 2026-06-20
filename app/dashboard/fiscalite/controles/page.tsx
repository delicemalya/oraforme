'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Shield, CheckCircle, AlertTriangle, XCircle, Loader2, RefreshCw, TrendingUp } from 'lucide-react'
import { PAYS_LIST } from '@/lib/fiscalite/pays'
import { fmtMontantPays } from '@/lib/fiscalite/engine'
import type { PaysFiscal, FiscalDeclaration } from '@/lib/fiscalite/types'

const TEXT  = '#0F172A'
const MUTED = '#64748B'
const BORDER= '#E2E8F0'
const CARD  = '#FFFFFF'
const GREEN = '#16A34A'
const AMBER = '#F59E0B'
const RED   = '#DC2626'
const BLUE  = '#2563EB'

const MOIS_FR = ['Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.']

interface AuditItem {
  id: string
  categorie: 'tva' | 'cnss' | 'irpp' | 'patente' | 'autre'
  niveau: 'ok' | 'attention' | 'critique'
  titre: string
  detail: string
  montant?: number
  action?: string
}

export default function ControlesPage() {
  const [pays, setPays]   = useState<PaysFiscal>('CG')
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [declarations, setDeclarations] = useState<FiscalDeclaration[]>([])
  const [tvaData, setTvaData]   = useState<{ declarations?: { mois: number; tva_collectee: number; total_a_payer: number }[] } | null>(null)
  const [cnssData, setCnssData] = useState<{ declarations?: { mois: number; nb_employes: number; total_cnss: number }[] } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [declRes, tvaRes, cnssRes] = await Promise.all([
        fetch(`/api/fiscalite/declarations?pays=${pays}&annee=${annee}`),
        fetch(`/api/fiscalite/tva?annee=${annee}&pays=${pays}`),
        fetch(`/api/fiscalite/cnss?annee=${annee}&pays=${pays}`),
      ])
      if (declRes.ok) { const d = await declRes.json(); setDeclarations(d.declarations ?? []) }
      if (tvaRes.ok)  { setTvaData(await tvaRes.json()) }
      if (cnssRes.ok) { setCnssData(await cnssRes.json()) }
    } finally {
      setLoading(false)
    }
  }, [pays, annee])

  useEffect(() => { load() }, [load])

  const now = new Date()
  const currentMois = now.getMonth() + 1

  const auditItems: AuditItem[] = useMemo(() => {
    const items: AuditItem[] = []

    // TVA — vérifier les mois passés avec CA mais sans déclaration déposée
    if (tvaData?.declarations) {
      for (const d of tvaData.declarations) {
        if (d.mois >= currentMois) continue
        if (d.tva_collectee === 0) continue
        const decl = declarations.find(dec => dec.type === 'tva' && dec.periode_mois === d.mois && dec.periode_annee === annee)
        if (!decl || decl.statut === 'a_faire' || decl.statut === 'en_cours') {
          items.push({
            id: `tva-manquante-${d.mois}`,
            categorie: 'tva',
            niveau: 'critique',
            titre: `TVA ${MOIS_FR[d.mois - 1]} non déclarée`,
            detail: `TVA collectée de ${fmtMontantPays(d.tva_collectee, pays)} non déposée à la DGI`,
            montant: d.total_a_payer,
            action: 'Aller à TVA → Déposer',
          })
        } else if (decl.statut === 'deposee' && decl.montant_paye === 0) {
          items.push({
            id: `tva-non-payee-${d.mois}`,
            categorie: 'tva',
            niveau: 'attention',
            titre: `TVA ${MOIS_FR[d.mois - 1]} déposée mais non payée`,
            detail: `Montant dû : ${fmtMontantPays(decl.montant_du, pays)}. Pensez à enregistrer le paiement.`,
            montant: decl.montant_du,
            action: 'Historique → Modifier → Payée',
          })
        } else if (decl.statut === 'en_retard') {
          items.push({
            id: `tva-retard-${d.mois}`,
            categorie: 'tva',
            niveau: 'critique',
            titre: `TVA ${MOIS_FR[d.mois - 1]} en retard`,
            detail: `Des pénalités de retard peuvent s'appliquer. Déclarez dès que possible.`,
            montant: decl.montant_du + decl.penalites,
            action: 'Régulariser immédiatement',
          })
        }
      }
    }

    // CNSS — vérifier mois passés avec employés mais sans déclaration
    if (cnssData?.declarations) {
      for (const d of cnssData.declarations) {
        if (d.mois >= currentMois) continue
        if (d.nb_employes === 0) continue
        const decl = declarations.find(dec => dec.type === 'cnss' && dec.periode_mois === d.mois && dec.periode_annee === annee)
        if (!decl || decl.statut === 'a_faire') {
          items.push({
            id: `cnss-manquante-${d.mois}`,
            categorie: 'cnss',
            niveau: 'critique',
            titre: `CNSS ${MOIS_FR[d.mois - 1]} non déclarée`,
            detail: `${d.nb_employes} employé(s) avec charges non déclarées`,
            montant: d.total_cnss,
            action: 'Aller à CNSS → Bordereau',
          })
        }
      }
    }

    // Déclarations en retard dans l'historique
    const retard = declarations.filter(d => d.statut === 'en_retard')
    if (retard.length > 0) {
      const totalPenalites = retard.reduce((s, d) => s + d.penalites, 0)
      items.push({
        id: 'retard-general',
        categorie: 'autre',
        niveau: 'critique',
        titre: `${retard.length} déclaration(s) en retard`,
        detail: `Pénalités cumulées : ${fmtMontantPays(totalPenalites, pays)}. Régularisez pour stopper l'accumulation.`,
        montant: totalPenalites,
        action: 'Voir l\'historique',
      })
    }

    // Bonne nouvelle si rien à signaler
    const passésSansPb = (tvaData?.declarations ?? []).filter(d => {
      if (d.mois >= currentMois || d.tva_collectee === 0) return false
      const decl = declarations.find(dec => dec.type === 'tva' && dec.periode_mois === d.mois)
      return decl?.statut === 'payee' || decl?.statut === 'deposee'
    }).length

    if (passésSansPb > 0 && items.filter(i => i.categorie === 'tva' && i.niveau === 'critique').length === 0) {
      items.push({
        id: 'tva-ok',
        categorie: 'tva',
        niveau: 'ok',
        titre: `TVA — ${passésSansPb} mois déclarés correctement`,
        detail: 'Toutes les déclarations TVA des mois passés sont à jour.',
      })
    }

    return items
  }, [declarations, tvaData, cnssData, pays, annee, currentMois])

  const score = useMemo(() => {
    if (auditItems.length === 0) return 100
    const critiques = auditItems.filter(i => i.niveau === 'critique').length
    const attentions = auditItems.filter(i => i.niveau === 'attention').length
    const ok = auditItems.filter(i => i.niveau === 'ok').length
    const total = critiques + attentions + ok
    if (total === 0) return 100
    return Math.round(((ok * 1 + attentions * 0.5) / total) * 100)
  }, [auditItems])

  const scoreColor = score >= 80 ? GREEN : score >= 50 ? AMBER : RED
  const scoreBg    = score >= 80 ? '#F0FDF4' : score >= 50 ? '#FFFBEB' : '#FEF2F2'

  const NIVEAU_CFG = {
    ok:        { color: GREEN, bg: '#F0FDF4', icon: <CheckCircle size={16} color={GREEN} />, label: 'Conforme' },
    attention: { color: AMBER, bg: '#FFFBEB', icon: <AlertTriangle size={16} color={AMBER} />, label: 'Attention' },
    critique:  { color: RED,   bg: '#FEF2F2', icon: <XCircle size={16} color={RED} />,   label: 'Critique' },
  }

  const CAT_LABELS: Record<string, string> = {
    tva: 'TVA', cnss: 'CNSS', irpp: 'IRPP', patente: 'Patente', autre: 'Autre'
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TEXT, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={20} color={MUTED} /> Contrôles fiscaux
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>
            Audit de conformité · {annee} · {PAYS_LIST.find(p => p.code === pays)?.drapeau} {PAYS_LIST.find(p => p.code === pays)?.nom}
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

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: MUTED }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* Score global */}
          <div style={{ background: scoreBg, border: `1px solid ${scoreColor}40`, borderRadius: 16, padding: '22px 26px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: CARD, border: `3px solid ${scoreColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: scoreColor }}>{score}</span>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: scoreColor }}>
                Score de conformité fiscale : {score}%
              </div>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
                {score >= 80 ? '✓ Situation fiscale saine. Continuez ainsi !'
                  : score >= 50 ? '⚠ Quelques points d\'attention à corriger rapidement.'
                  : '⛔ Situation critique — des pénalités sont en cours d\'accumulation.'}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                {[
                  { label: 'Critiques', count: auditItems.filter(i => i.niveau === 'critique').length, color: RED },
                  { label: 'Attention', count: auditItems.filter(i => i.niveau === 'attention').length, color: AMBER },
                  { label: 'Conformes', count: auditItems.filter(i => i.niveau === 'ok').length, color: GREEN },
                ].map(s => (
                  <span key={s.label} style={{ fontSize: 12, fontWeight: 700, color: s.color }}>
                    {s.count} {s.label}
                  </span>
                ))}
              </div>
            </div>
            <TrendingUp size={40} color={scoreColor} style={{ marginLeft: 'auto', opacity: 0.2 }} />
          </div>

          {/* Audit items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {auditItems.length === 0 ? (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 48, textAlign: 'center', color: MUTED }}>
                <CheckCircle size={36} color={GREEN} style={{ marginBottom: 12 }} />
                <div style={{ fontWeight: 700, fontSize: 15, color: GREEN }}>Aucune anomalie détectée</div>
                <div style={{ fontSize: 13, marginTop: 6 }}>Vos déclarations fiscales sont à jour.</div>
              </div>
            ) : auditItems.map(item => {
              const nc = NIVEAU_CFG[item.niveau]
              return (
                <div key={item.id} style={{
                  background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12,
                  padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 14,
                  borderLeft: `3px solid ${nc.color}`,
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: nc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {nc.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: TEXT }}>{item.titre}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: nc.bg, color: nc.color }}>
                        {CAT_LABELS[item.categorie]}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{item.detail}</div>
                    {item.action && (
                      <div style={{ fontSize: 11, color: BLUE, marginTop: 4, fontWeight: 600 }}>→ {item.action}</div>
                    )}
                  </div>
                  {item.montant !== undefined && item.montant > 0 && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: nc.color }}>
                        {fmtMontantPays(item.montant, pays)}
                      </div>
                      <div style={{ fontSize: 10, color: MUTED }}>En jeu</div>
                    </div>
                  )}
                  <div style={{ padding: '4px 10px', borderRadius: 20, background: nc.bg, color: nc.color, fontWeight: 700, fontSize: 10, flexShrink: 0, alignSelf: 'flex-start' }}>
                    {nc.label}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
