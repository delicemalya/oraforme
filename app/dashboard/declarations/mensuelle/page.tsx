'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  FileText, Save, RefreshCw, Loader2, CheckCircle,
  AlertTriangle, ChevronDown, ChevronUp, FileDown, Send,
} from 'lucide-react'
import { montantEnLettres, getJoursRestants } from '@/lib/declarations/declaration-generale'

// ─── Tokens ──────────────────────────────────────────────────────────────────

const TEXT   = '#0F172A'
const MUTED  = '#64748B'
const BORDER = '#E2E8F0'
const CARD   = '#FFFFFF'
const BG     = '#F5F7FB'
const GREEN  = '#16A34A'
const AMBER  = '#F59E0B'
const RED    = '#DC2626'
const BLUE   = '#2563EB'
const NAVY   = '#1E3A5F'

// ─── Lignes DGI (27 lignes officielles) ──────────────────────────────────────

interface LigneDGI {
  num: number
  label: string
  mainKey: keyof FormState
  centimesKey?: keyof FormState
  source?: string        // 'factures' | 'paie' | null
  important?: boolean
  subLabel?: string
}

const LIGNES: LigneDGI[] = [
  { num: 1,  label: "Droits d'accises",                          mainKey: 'l1_droits_accises' },
  { num: 2,  label: 'Taxe sur boissons et tabac',                mainKey: 'l2_taxe_boissons_tabac' },
  { num: 3,  label: 'TVA — Taxe sur valeur ajoutée (18%)',       mainKey: 'l3_tva', centimesKey: 'l3_tva_centimes', source: 'factures', important: true, subLabel: 'Centimes add. (5% TVA)' },
  { num: 4,  label: 'TVA tiers (retenue à la source)',           mainKey: 'l4_tva_tiers', centimesKey: 'l4_tva_tiers_centimes', subLabel: 'Centimes add.' },
  { num: 5,  label: 'Taxe transferts de fonds (1,5%)',          mainKey: 'l5_taxe_transferts_fonds' },
  { num: 6,  label: 'Taxe sur jeux de hasard',                   mainKey: 'l6_taxe_jeux_hasard' },
  { num: 7,  label: 'IRPP — BIC/BNC',                            mainKey: 'l7_irpp_bic_bnc' },
  { num: 8,  label: 'IRPP sur salaires',                         mainKey: 'l8_irpp_salaires', source: 'paie', important: true },
  { num: 9,  label: 'TUS — Taxe unique sur les salaires (4,5%)', mainKey: 'l9_tus', source: 'paie', important: true },
  { num: 10, label: 'IS — Impôt sur les sociétés (30%)',         mainKey: 'l10_is' },
  { num: 11, label: 'ISF — Impôt sur les sociétés financières',  mainKey: 'l11_isf' },
  { num: 12, label: 'TSS — Taxe sur les services spéciaux',      mainKey: 'l12_tss' },
  { num: 13, label: 'TVTS — Taxe véhicules de tourisme',         mainKey: 'l13_tvts' },
  { num: 14, label: 'IRVM — Revenus des valeurs mobilières',     mainKey: 'l14_irvm' },
  { num: 15, label: 'Retenue à la source — 20%',                 mainKey: 'l15_ras_20pct' },
  { num: 16, label: 'Retenue à la source — 5%',                  mainKey: 'l16_ras_5pct' },
  { num: 17, label: 'Retenue BTP',                               mainKey: 'l17_ras_btp' },
  { num: 18, label: 'ASDI — Aide sociale et développement',      mainKey: 'l18_asdi' },
  { num: 19, label: 'Taxe sur appareils',                        mainKey: 'l19_taxe_appareils' },
  { num: 20, label: 'RAV — Redevance audiovisuelle',             mainKey: 'l20_rav' },
  { num: 21, label: 'Redevances diverses',                       mainKey: 'l21_redevances' },
  { num: 22, label: 'Taxe sur assurances',                       mainKey: 'l22_taxe_assurance' },
  { num: 23, label: 'Taxe immobilière',                          mainKey: 'l23_taxe_immobiliere' },
  { num: 24, label: 'TOL — Taxe occupation des locaux',          mainKey: 'l24_tol' },
  { num: 25, label: 'Taxe régionale',                            mainKey: 'l25_taxe_regionale' },
  { num: 26, label: 'Contribution foncière — propriétés bâties', mainKey: 'l26_contrib_fonciere_baties' },
  { num: 27, label: 'Contribution foncière — non bâties',        mainKey: 'l27_contrib_fonciere_non_baties' },
]

// ─── FormState ────────────────────────────────────────────────────────────────

interface FormState {
  // Identification
  niu: string; denomination_sociale: string; adresse: string
  telephone: string; email: string; ville: string; residence_fiscale: string
  // Tax lines
  l1_droits_accises: number; l2_taxe_boissons_tabac: number
  l3_tva: number; l3_tva_centimes: number
  l4_tva_tiers: number; l4_tva_tiers_centimes: number
  l5_taxe_transferts_fonds: number; l6_taxe_jeux_hasard: number
  l7_irpp_bic_bnc: number
  l8_irpp_salaires: number; l8_nb_employes: number; l8_salaires_bruts: number
  l9_tus: number; l9_salaires_bruts: number
  l10_is: number; l11_isf: number; l12_tss: number; l13_tvts: number
  l14_irvm: number; l15_ras_20pct: number; l16_ras_5pct: number
  l17_ras_btp: number; l18_asdi: number; l19_taxe_appareils: number
  l20_rav: number; l21_redevances: number; l22_taxe_assurance: number
  l23_taxe_immobiliere: number; l24_tol: number; l25_taxe_regionale: number
  l26_contrib_fonciere_baties: number; l27_contrib_fonciere_non_baties: number
  // Totals
  total_penalites: number
  // Payment
  mode_paiement: string; reference_cheque: string
  lieu_signature: string; date_signature: string
  statut: string; pre_rempli: boolean
}

function defaultForm(): FormState {
  return {
    niu: '', denomination_sociale: '', adresse: '',
    telephone: '', email: '', ville: 'Brazzaville', residence_fiscale: 'Congo-Brazzaville',
    l1_droits_accises: 0, l2_taxe_boissons_tabac: 0,
    l3_tva: 0, l3_tva_centimes: 0,
    l4_tva_tiers: 0, l4_tva_tiers_centimes: 0,
    l5_taxe_transferts_fonds: 0, l6_taxe_jeux_hasard: 0,
    l7_irpp_bic_bnc: 0,
    l8_irpp_salaires: 0, l8_nb_employes: 0, l8_salaires_bruts: 0,
    l9_tus: 0, l9_salaires_bruts: 0,
    l10_is: 0, l11_isf: 0, l12_tss: 0, l13_tvts: 0,
    l14_irvm: 0, l15_ras_20pct: 0, l16_ras_5pct: 0,
    l17_ras_btp: 0, l18_asdi: 0, l19_taxe_appareils: 0,
    l20_rav: 0, l21_redevances: 0, l22_taxe_assurance: 0,
    l23_taxe_immobiliere: 0, l24_tol: 0, l25_taxe_regionale: 0,
    l26_contrib_fonciere_baties: 0, l27_contrib_fonciere_non_baties: 0,
    total_penalites: 0,
    mode_paiement: 'especes', reference_cheque: '',
    lieu_signature: 'Brazzaville',
    date_signature: new Date().toISOString().split('T')[0],
    statut: 'brouillon', pre_rempli: false,
  }
}

// ─── Styles partagés ──────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%', padding: '6px 8px', border: `1px solid ${BORDER}`,
  borderRadius: 6, fontSize: 12, color: TEXT, background: '#FAFAFA',
  outline: 'none', boxSizing: 'border-box',
}

const INPUT_NUM: React.CSSProperties = {
  ...INPUT, textAlign: 'right', fontFamily: 'monospace', fontSize: 11,
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (!n) return '—'
  return new Intl.NumberFormat('fr-FR').format(Math.round(n))
}

const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre']

// ─── Component ────────────────────────────────────────────────────────────────

export default function DeclarationMensuellePage() {
  const now  = new Date()
  const [mois,  setMois]  = useState(now.getMonth() + 1)
  const [annee, setAnnee] = useState(now.getFullYear())
  const [form,  setForm]  = useState<FormState>(defaultForm)
  const [autoFields, setAutoFields] = useState<Set<keyof FormState>>(new Set())

  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [preFilling,  setPreFilling]  = useState(false)
  const [pdfLoading,  setPdfLoading]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [success,     setSuccess]     = useState<string | null>(null)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['identification', 'taxes']))

  // ── Totaux calculés en temps réel ──────────────────────────────────────────

  const totalPrincipal = useMemo(() =>
    LIGNES.reduce((s, l) => s + (form[l.mainKey] as number || 0), 0)
  , [form])

  const totalCentimes = useMemo(() =>
    (form.l3_tva_centimes || 0) + (form.l4_tva_tiers_centimes || 0)
  , [form])

  const totalGeneral = useMemo(() =>
    totalPrincipal + totalCentimes + (form.total_penalites || 0)
  , [totalPrincipal, totalCentimes, form.total_penalites])

  const joursRestants = useMemo(() => getJoursRestants(mois, annee), [mois, annee])

  // ── Chargement depuis la DB ────────────────────────────────────────────────

  const load = useCallback(async (m: number, a: number) => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/declarations/mensuelle?mois=${m}&annee=${a}`)
      const data = await res.json()
      if (data.declaration) {
        const d = data.declaration
        setForm(prev => ({ ...prev, ...d }))
      } else {
        setForm(defaultForm())
        setAutoFields(new Set())
      }
    } catch {
      setError('Erreur chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(mois, annee) }, [mois, annee, load])

  // ── Pré-remplissage automatique ────────────────────────────────────────────

  const handlePreRemplir = useCallback(async () => {
    setPreFilling(true); setError(null)
    try {
      const res  = await fetch(`/api/declarations/mensuelle?mois=${mois}&annee=${annee}&preRemplir=true`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur pré-remplissage')
      const pr = data.preRemplissage
      setForm(prev => ({ ...prev, ...pr }))
      const autoSet = new Set<keyof FormState>()
      if (pr.l3_tva)           autoSet.add('l3_tva')
      if (pr.l3_tva_centimes)  autoSet.add('l3_tva_centimes')
      if (pr.l8_irpp_salaires) autoSet.add('l8_irpp_salaires')
      if (pr.l9_tus)           autoSet.add('l9_tus')
      setAutoFields(autoSet)
      setSuccess('Formulaire pré-rempli depuis vos données')
      setTimeout(() => setSuccess(null), 4000)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPreFilling(false)
    }
  }, [mois, annee])

  // ── Auto-calcul TUS quand salaires_bruts L9 change ─────────────────────────

  function setField(key: keyof FormState, value: string | number | boolean) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      // Auto: centimes TVA = 5% de la TVA
      if (key === 'l3_tva') {
        next.l3_tva_centimes = Math.round(Number(value) * 0.05)
      }
      // Auto: TUS = 4,5% des salaires bruts L9
      if (key === 'l9_salaires_bruts') {
        next.l9_tus = Math.round(Number(value) * 0.045)
        next.l8_salaires_bruts = Number(value) // L8 et L9 partagent les mêmes bruts
      }
      // Auto: L8 salaires bruts → synchro L9
      if (key === 'l8_salaires_bruts') {
        next.l9_salaires_bruts = Number(value)
        next.l9_tus = Math.round(Number(value) * 0.045)
      }
      return next
    })
    // Retirer du jeu auto si l'utilisateur modifie manuellement
    setAutoFields(prev => { const s = new Set(prev); s.delete(key); return s })
  }

  // ── Sauvegarde ─────────────────────────────────────────────────────────────

  const handleSave = useCallback(async (statut: string) => {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/declarations/mensuelle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mois, annee,
          ...form,
          total_principal: totalPrincipal,
          total_centimes:  totalCentimes,
          total_droits_payes: totalGeneral,
          statut,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setForm(prev => ({ ...prev, statut }))
      setSuccess(statut === 'soumise' ? 'Déclaration soumise !' : 'Sauvegarde réussie')
      setTimeout(() => setSuccess(null), 3000)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [form, mois, annee, totalPrincipal, totalCentimes, totalGeneral])

  // ── Téléchargement PDF ─────────────────────────────────────────────────────

  const handlePDF = useCallback(async () => {
    setPdfLoading(true)
    try {
      const res = await fetch('/api/declarations/mensuelle/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mois, annee, ...form,
          total_principal: totalPrincipal,
          total_centimes: totalCentimes,
          total_droits_payes: totalGeneral,
        }),
      })
      if (!res.ok) throw new Error('Erreur génération PDF')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `declaration-dgi-${mois}-${annee}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPdfLoading(false)
    }
  }, [form, mois, annee, totalPrincipal, totalCentimes, totalGeneral])

  // ── Toggle section ─────────────────────────────────────────────────────────

  function toggle(id: string) {
    setOpenSections(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const periodeLabel = `${MOIS_FR[mois - 1]} ${annee}`
  const dateLimite   = `20/${String(mois === 12 ? 1 : mois + 1).padStart(2,'0')}/${mois === 12 ? annee + 1 : annee}`

  const statutConfig = {
    brouillon: { label: 'Brouillon',  color: AMBER, bg: '#FFFBEB' },
    complete:  { label: 'Complète',   color: BLUE,  bg: '#EFF6FF' },
    soumise:   { label: 'Soumise',    color: GREEN, bg: '#F0FDF4' },
    validee:   { label: 'Validée',    color: GREEN, bg: '#F0FDF4' },
  }
  const sc = statutConfig[form.statut as keyof typeof statutConfig] ?? statutConfig.brouillon

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: MUTED }}>
      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ marginLeft: 10, fontSize: 13 }}>Chargement…</span>
    </div>
  )

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 60 }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TEXT, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={22} color={NAVY} />
              Déclaration Générale des Impôts et Taxes
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: MUTED }}>
              Direction Générale des Impôts et des Domaines · République du Congo
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Sélecteur mois/année */}
            <select value={mois} onChange={e => setMois(Number(e.target.value))}
              style={{ ...INPUT, width: 'auto', paddingTop: 7, paddingBottom: 7, fontSize: 12 }}>
              {MOIS_FR.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <select value={annee} onChange={e => setAnnee(Number(e.target.value))}
              style={{ ...INPUT, width: 80, paddingTop: 7, paddingBottom: 7, fontSize: 12 }}>
              {[annee - 1, annee, annee + 1].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            {/* Badge statut */}
            <span style={{ padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color }}>
              {sc.label}
            </span>
            {/* Refresh */}
            <button onClick={() => load(mois, annee)}
              style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, cursor: 'pointer', color: MUTED }}>
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Alerte deadline ──────────────────────────────────────────────── */}
      {(() => {
        const urgent = joursRestants < 5
        const warning = joursRestants < 15
        return (
          <div style={{
            background: urgent ? '#FEF2F2' : warning ? '#FFFBEB' : '#F0FDF4',
            border: `1px solid ${urgent ? '#FECACA' : warning ? '#FDE68A' : '#BBF7D0'}`,
            borderRadius: 10, padding: '10px 16px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <AlertTriangle size={15} color={urgent ? RED : warning ? AMBER : GREEN} />
            <span style={{ fontSize: 12.5, color: urgent ? RED : '#92400E', fontWeight: 500 }}>
              {joursRestants < 0
                ? `Déclaration en retard de ${Math.abs(joursRestants)} jours — pénalités applicables (1,5%/mois)`
                : `Période : ${periodeLabel} · Échéance : ${dateLimite} · J-${joursRestants}`}
            </span>
            {form.pre_rempli && (
              <span style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 8px', background: BLUE, color: '#fff', borderRadius: 12, fontWeight: 600 }}>
                Pré-rempli Auto
              </span>
            )}
          </div>
        )
      })()}

      {/* ── Messages ─────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: RED, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}
      {success && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: GREEN, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={14} /> {success}
        </div>
      )}

      {/* ── Boutons d'action ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={handlePreRemplir} disabled={preFilling}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: `1px solid ${BLUE}`, background: preFilling ? '#EFF6FF' : BLUE, color: '#fff', cursor: preFilling ? 'wait' : 'pointer', fontSize: 12, fontWeight: 600, opacity: preFilling ? 0.8 : 1 }}>
          {preFilling ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
          {preFilling ? 'Pré-remplissage…' : '🔄 Pré-remplir depuis mes données'}
        </button>
        <button onClick={() => handleSave('brouillon')} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, cursor: 'pointer', fontSize: 12, color: TEXT }}>
          {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
          Sauvegarder
        </button>
        <button onClick={() => handleSave('soumise')} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: `1px solid ${GREEN}`, background: '#F0FDF4', cursor: 'pointer', fontSize: 12, color: GREEN, fontWeight: 600 }}>
          <Send size={13} /> Soumettre
        </button>
        <button onClick={handlePDF} disabled={pdfLoading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: `1px solid ${AMBER}`, background: '#FFFBEB', cursor: pdfLoading ? 'wait' : 'pointer', fontSize: 12, color: AMBER, fontWeight: 600 }}>
          {pdfLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FileDown size={13} />}
          {pdfLoading ? 'Génération…' : 'Télécharger PDF'}
        </button>
      </div>

      {/* ── SECTION I — IDENTIFICATION ───────────────────────────────────── */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
        <button type="button" onClick={() => toggle('identification')}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Section I — Identification du contribuable
          </span>
          <span style={{ marginLeft: 'auto', color: MUTED }}>
            {openSections.has('identification') ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>
        {openSections.has('identification') && (
          <div style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {([
              { key: 'niu' as const,                 label: 'NIU' },
              { key: 'denomination_sociale' as const, label: 'Dénomination sociale' },
              { key: 'residence_fiscale' as const,    label: 'Résidence fiscale' },
              { key: 'adresse' as const,              label: 'Adresse siège' },
              { key: 'ville' as const,                label: 'Ville' },
              { key: 'telephone' as const,            label: 'Téléphone' },
              { key: 'email' as const,                label: 'Email' },
            ] as Array<{ key: keyof FormState; label: string }>).map(({ key, label }) => (
              <div key={key}>
                <label style={{ fontSize: 10, color: MUTED, display: 'block', marginBottom: 3 }}>{label}</label>
                <input
                  value={form[key] as string}
                  onChange={e => setField(key, e.target.value)}
                  style={INPUT}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SECTION II — TABLEAU RÉCAPITULATIF ───────────────────────────── */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
        <button type="button" onClick={() => toggle('taxes')}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Section II — Récapitulatif des droits et taxes
          </span>
          <span style={{ marginLeft: 'auto', color: MUTED }}>
            {openSections.has('taxes') ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>
        {openSections.has('taxes') && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
              <thead>
                <tr style={{ background: NAVY }}>
                  <th style={{ width: 32, padding: '8px 10px', color: '#fff', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>N°</th>
                  <th style={{ padding: '8px 12px', color: '#fff', fontSize: 10, fontWeight: 700, textAlign: 'left' }}>Nature des impôts et taxes</th>
                  <th style={{ width: 130, padding: '8px 10px', color: '#fff', fontSize: 10, fontWeight: 700, textAlign: 'right' }}>Montant principal</th>
                  <th style={{ width: 110, padding: '8px 10px', color: '#fff', fontSize: 10, fontWeight: 700, textAlign: 'right' }}>Centimes</th>
                  <th style={{ width: 100, padding: '8px 10px', color: '#fff', fontSize: 10, fontWeight: 700, textAlign: 'right' }}>Pénalités</th>
                  <th style={{ width: 110, padding: '8px 10px', color: '#FCD34D', fontSize: 10, fontWeight: 700, textAlign: 'right' }}>Total payé</th>
                </tr>
              </thead>
              <tbody>
                {LIGNES.map((ligne, i) => {
                  const principal = form[ligne.mainKey] as number || 0
                  const centimes  = ligne.centimesKey ? form[ligne.centimesKey] as number || 0 : 0
                  const total     = principal + centimes
                  const isAuto    = autoFields.has(ligne.mainKey)
                  const hasValue  = principal > 0 || centimes > 0
                  const bgColor   = ligne.important
                    ? hasValue ? '#FFFBEB' : '#FAFAFA'
                    : i % 2 === 0 ? '#FFFFFF' : '#FAFAFA'

                  return (
                    <tr key={ligne.num} style={{ background: bgColor, borderBottom: `1px solid ${BORDER}` }}>
                      {/* Numéro */}
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: ligne.important ? NAVY : MUTED }}>
                        {ligne.num}
                      </td>
                      {/* Nature */}
                      <td style={{ padding: '6px 12px', fontSize: 11, color: hasValue ? TEXT : MUTED }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {ligne.label}
                          {isAuto && (
                            <span style={{ fontSize: 9, padding: '1px 5px', background: BLUE, color: '#fff', borderRadius: 10, fontWeight: 700 }}>Auto</span>
                          )}
                          {ligne.source === 'factures' && (
                            <span style={{ fontSize: 9, color: BLUE }}>• depuis factures</span>
                          )}
                          {ligne.source === 'paie' && (
                            <span style={{ fontSize: 9, color: '#7C3AED' }}>• depuis paie</span>
                          )}
                        </div>
                        {/* Champs spéciaux L8 */}
                        {ligne.num === 8 && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                            <input type="number" placeholder="Nb employés"
                              value={form.l8_nb_employes || ''}
                              onChange={e => setField('l8_nb_employes', Number(e.target.value))}
                              style={{ ...INPUT_NUM, width: 80, fontSize: 10 }}
                            />
                            <input type="number" placeholder="Salaires bruts"
                              value={form.l8_salaires_bruts || ''}
                              onChange={e => setField('l8_salaires_bruts', Number(e.target.value))}
                              style={{ ...INPUT_NUM, width: 120, fontSize: 10 }}
                            />
                          </div>
                        )}
                        {/* Champs spéciaux L9 */}
                        {ligne.num === 9 && (
                          <div style={{ marginTop: 4 }}>
                            <input type="number" placeholder="Salaires bruts (auto TUS 4,5%)"
                              value={form.l9_salaires_bruts || ''}
                              onChange={e => setField('l9_salaires_bruts', Number(e.target.value))}
                              style={{ ...INPUT_NUM, width: 180, fontSize: 10 }}
                            />
                          </div>
                        )}
                        {/* Sous-label centimes */}
                        {ligne.centimesKey && (
                          <div style={{ fontSize: 9, color: MUTED, marginTop: 2 }}>{ligne.subLabel}</div>
                        )}
                      </td>
                      {/* Principal */}
                      <td style={{ padding: '4px 8px' }}>
                        <input
                          type="number" min={0}
                          value={form[ligne.mainKey] as number || ''}
                          onChange={e => setField(ligne.mainKey, Number(e.target.value))}
                          style={{ ...INPUT_NUM, background: hasValue ? '#FFFBEB' : '#FAFAFA' }}
                          placeholder="0"
                        />
                      </td>
                      {/* Centimes */}
                      <td style={{ padding: '4px 8px' }}>
                        {ligne.centimesKey ? (
                          <input
                            type="number" min={0}
                            value={form[ligne.centimesKey] as number || ''}
                            onChange={e => setField(ligne.centimesKey!, Number(e.target.value))}
                            style={{ ...INPUT_NUM, background: (form[ligne.centimesKey] as number) > 0 ? '#EFF6FF' : '#FAFAFA' }}
                            placeholder="0"
                          />
                        ) : (
                          <div style={{ textAlign: 'right', fontSize: 11, color: '#CBD5E1', padding: '6px 8px' }}>—</div>
                        )}
                      </td>
                      {/* Pénalités (toujours 0 par défaut, saisie manuelle exceptionnelle) */}
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: 11, color: '#CBD5E1' }}>—</td>
                      {/* Total */}
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: total > 0 ? NAVY : '#CBD5E1' }}>
                        {total > 0 ? fmt(total) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {/* Total général */}
              <tfoot>
                <tr style={{ background: NAVY }}>
                  <td colSpan={2} style={{ padding: '10px 14px', fontSize: 12, fontWeight: 800, color: '#fff' }}>
                    TOTAL GÉNÉRAL
                  </td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#FCD34D' }}>
                    {fmt(totalPrincipal)}
                  </td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#FCD34D' }}>
                    {totalCentimes > 0 ? fmt(totalCentimes) : '—'}
                  </td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 11, color: '#FCD34D' }}>—</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: '#FCD34D' }}>
                    {fmt(totalGeneral)} FCFA
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── SECTION III — PAIEMENT ───────────────────────────────────────── */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
        <button type="button" onClick={() => toggle('paiement')}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Section III — Modalités de paiement
          </span>
          <span style={{ marginLeft: 'auto', color: MUTED }}>
            {openSections.has('paiement') ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>
        {openSections.has('paiement') && (
          <div style={{ padding: '0 20px 20px' }}>
            {/* Montant */}
            <div style={{ background: BG, borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>Montant total à payer</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: RED }}>{fmt(totalGeneral)} FCFA</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 4, fontStyle: 'italic' }}>
                {montantEnLettres(totalGeneral)}
              </div>
            </div>
            {/* Mode */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, color: MUTED, display: 'block', marginBottom: 6 }}>Mode de paiement</label>
              <div style={{ display: 'flex', gap: 12 }}>
                {[{ v: 'especes', l: 'Espèces' }, { v: 'cheque', l: 'Chèque' }, { v: 'virement', l: 'Virement' }].map(m => (
                  <label key={m.v} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                    <input type="radio" name="mode_paiement" value={m.v}
                      checked={form.mode_paiement === m.v}
                      onChange={() => setField('mode_paiement', m.v)} />
                    {m.l}
                  </label>
                ))}
              </div>
            </div>
            {form.mode_paiement !== 'especes' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, color: MUTED, display: 'block', marginBottom: 4 }}>
                  Référence {form.mode_paiement === 'cheque' ? 'chèque' : 'virement'}
                </label>
                <input value={form.reference_cheque}
                  onChange={e => setField('reference_cheque', e.target.value)}
                  style={{ ...INPUT, maxWidth: 320 }} placeholder="Numéro de référence" />
              </div>
            )}
            {/* Signature */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={{ fontSize: 10, color: MUTED, display: 'block', marginBottom: 4 }}>Fait à</label>
                <input value={form.lieu_signature}
                  onChange={e => setField('lieu_signature', e.target.value)}
                  style={INPUT} />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={{ fontSize: 10, color: MUTED, display: 'block', marginBottom: 4 }}>Le</label>
                <input type="date" value={form.date_signature}
                  onChange={e => setField('date_signature', e.target.value)}
                  style={INPUT} />
              </div>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label style={{ fontSize: 10, color: MUTED, display: 'block', marginBottom: 4 }}>Zone signature</label>
                <div style={{ border: `1px dashed ${BORDER}`, borderRadius: 8, height: 48,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#CBD5E1' }}>
                  Signature du représentant légal
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── SECTION IV — LIQUIDATIONS DÉTAILLÉES ────────────────────────── */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
        <button type="button" onClick={() => toggle('detail')}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Section IV — Liquidations détaillées
          </span>
          <span style={{ marginLeft: 'auto', color: MUTED }}>
            {openSections.has('detail') ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>
        {openSections.has('detail') && (
          <div style={{ padding: '0 20px 20px' }}>
            {/* TVA */}
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
              <div style={{ background: '#EFF6FF', padding: '8px 14px', fontWeight: 700, fontSize: 11, color: BLUE }}>
                Ligne 3 — TVA détaillée (18% + Centimes 5%)
              </div>
              <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: MUTED }}>TVA collectée (18%)</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{fmt(form.l3_tva)} FCFA</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: MUTED }}>Centimes additionnels (5% TVA)</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{fmt(form.l3_tva_centimes)} FCFA</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: MUTED }}>Total TVA ligne 3</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: BLUE }}>{fmt((form.l3_tva || 0) + (form.l3_tva_centimes || 0))} FCFA</div>
                </div>
              </div>
            </div>
            {/* IRPP */}
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
              <div style={{ background: '#F5F3FF', padding: '8px 14px', fontWeight: 700, fontSize: 11, color: '#7C3AED' }}>
                Ligne 8 — IRPP sur salaires
              </div>
              <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: MUTED }}>Nombre d&apos;employés</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{form.l8_nb_employes}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: MUTED }}>Salaires bruts totaux</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{fmt(form.l8_salaires_bruts)} FCFA</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: MUTED }}>IRPP total retenu</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#7C3AED' }}>{fmt(form.l8_irpp_salaires)} FCFA</div>
                </div>
              </div>
            </div>
            {/* TUS */}
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ background: '#FFF7ED', padding: '8px 14px', fontWeight: 700, fontSize: 11, color: AMBER }}>
                Ligne 9 — TUS (Taxe unique sur les salaires · 4,5%)
              </div>
              <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: MUTED }}>Base (salaires bruts)</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{fmt(form.l9_salaires_bruts)} FCFA</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: MUTED }}>Taux TUS</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>4,5 %</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: MUTED }}>TUS à payer</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: AMBER }}>{fmt(form.l9_tus)} FCFA</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Récap final ──────────────────────────────────────────────────── */}
      <div style={{
        background: NAVY, borderRadius: 14, padding: '20px 24px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16,
      }}>
        {[
          { label: 'Total principal',    value: fmt(totalPrincipal),      color: '#93C5FD' },
          { label: 'Centimes add.',      value: fmt(totalCentimes),        color: '#93C5FD' },
          { label: 'Pénalités',          value: '—',                       color: '#FCA5A5' },
          { label: 'TOTAL À PAYER',      value: `${fmt(totalGeneral)} F`,  color: '#FCD34D', large: true },
        ].map(item => (
          <div key={item.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: item.large ? 18 : 14, fontWeight: item.large ? 800 : 600, color: item.color }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Mention légale */}
      <p style={{ fontSize: 10, color: MUTED, textAlign: 'center', marginTop: 16 }}>
        Je soussigné(e) déclare que les renseignements ci-dessus sont exacts et sincères. · Pénalités de retard : 1,5% par mois · DGID Congo
      </p>

    </div>
  )
}
