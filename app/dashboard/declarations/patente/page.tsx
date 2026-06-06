'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Building2, Save, Send, Loader2, RefreshCw, FileDown,
  ChevronDown, ChevronUp, CheckCircle, AlertCircle, Info,
} from 'lucide-react'
import {
  calculerPatente,
  montantEnLettres,
  initDepartements,
  recalcDepartementPourcentages,
  BAREME_PATENTE_CG,
  MINIMUM_PERCEPTION_FCFA,
  type DepartementRepartition,
} from '@/lib/declarations/patente'

// ─── Tokens ──────────────────────────────────────────────────────────────────
const TEXT   = '#0F172A'
const MUTED  = '#64748B'
const BORDER = '#E2E8F0'
const CARD   = '#FFFFFF'
const GREEN  = '#16A34A'
const AMBER  = '#F59E0B'
const RED    = '#DC2626'
const BLUE   = '#2563EB'
const BG     = '#F5F7FB'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  annee: number
  // Section A
  niu: string; scien: string; rccm: string
  denomination: string; forme_juridique: string
  secteur_activite: string; adresse_siege: string
  telephone: string; email: string
  representant_legal: string; qualite_representant: string
  // Section B
  nature_activite: string; date_debut_activite: string
  nb_etablissements: number
  ca_annuel: number; ca_exonere: number
  est_societe_petroliere: boolean; credit_n1: number
  // Section C
  repartition_departements: DepartementRepartition[]
  // Signature
  lieu_signature: string; date_signature: string
  statut: string
}

function defaultForm(annee: number): FormState {
  return {
    annee,
    niu: '', scien: '', rccm: '',
    denomination: '', forme_juridique: '', secteur_activite: '',
    adresse_siege: '', telephone: '', email: '',
    representant_legal: '', qualite_representant: '',
    nature_activite: '', date_debut_activite: '',
    nb_etablissements: 1,
    ca_annuel: 0, ca_exonere: 0,
    est_societe_petroliere: false, credit_n1: 0,
    repartition_departements: initDepartements(),
    lieu_signature: 'Brazzaville',
    date_signature: new Date().toISOString().split('T')[0],
    statut: 'brouillon',
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title, sub, open, onToggle }: {
  title: string; sub?: string; open: boolean; onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 0', background: 'transparent', border: 'none', cursor: 'pointer',
        borderBottom: `2px solid ${BLUE}`,
      }}
    >
      <span style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 800, color: TEXT }}>
        {title}
        {sub && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: MUTED }}>{sub}</span>}
      </span>
      {open ? <ChevronUp size={15} color={MUTED} /> : <ChevronDown size={15} color={MUTED} />}
    </button>
  )
}

function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}{required && <span style={{ color: RED }}> *</span>}
      </label>
      {children}
    </div>
  )
}

const INPUT_STYLE: React.CSSProperties = {
  border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 11px',
  fontSize: 13, color: TEXT, background: CARD, outline: 'none', width: '100%',
}

function TextInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <input
      type="text" value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} style={INPUT_STYLE}
      onFocus={e => { e.target.style.borderColor = BLUE; e.target.style.boxShadow = `0 0 0 2px rgba(37,99,235,0.1)` }}
      onBlur={e  => { e.target.style.borderColor = BORDER; e.target.style.boxShadow = 'none' }}
    />
  )
}

function NumberInput({ value, onChange, min = 0 }: {
  value: number; onChange: (v: number) => void; min?: number
}) {
  return (
    <input
      type="number" min={min} value={value === 0 ? '' : value}
      onChange={e => onChange(Math.max(min, parseInt(e.target.value || '0', 10)))}
      style={INPUT_STYLE}
      onFocus={e => { e.target.style.borderColor = BLUE; e.target.style.boxShadow = `0 0 0 2px rgba(37,99,235,0.1)` }}
      onBlur={e  => { e.target.style.borderColor = BORDER; e.target.style.boxShadow = 'none' }}
    />
  )
}

function fmtN(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n))
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function PatentePage() {
  const [annee,    setAnnee]    = useState(new Date().getFullYear() - 1)
  const [form,     setForm]     = useState<FormState>(() => defaultForm(new Date().getFullYear() - 1))
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const [secA, setSecA] = useState(true)
  const [secB, setSecB] = useState(true)
  const [secC, setSecC] = useState(false)

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = useCallback(async (yr: number) => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/declarations/patente?annee=${yr}`)
      const data = await res.json()
      if (data.declaration) {
        const d = data.declaration
        setForm({
          annee:             d.annee,
          niu:               d.niu               ?? '',
          scien:             d.scien             ?? '',
          rccm:              d.rccm              ?? '',
          denomination:      d.denomination      ?? '',
          forme_juridique:   d.forme_juridique   ?? '',
          secteur_activite:  d.secteur_activite  ?? '',
          adresse_siege:     d.adresse_siege     ?? '',
          telephone:         d.telephone         ?? '',
          email:             d.email             ?? '',
          representant_legal:   d.representant_legal   ?? '',
          qualite_representant: d.qualite_representant ?? '',
          nature_activite:      d.nature_activite      ?? '',
          date_debut_activite:  d.date_debut_activite  ?? '',
          nb_etablissements:    d.nb_etablissements    ?? 1,
          ca_annuel:            d.ca_annuel            ?? 0,
          ca_exonere:           d.ca_exonere           ?? 0,
          est_societe_petroliere: d.est_societe_petroliere ?? false,
          credit_n1:            d.credit_n1            ?? 0,
          repartition_departements: d.repartition_departements?.length
            ? d.repartition_departements
            : initDepartements(),
          lieu_signature: d.lieu_signature ?? 'Brazzaville',
          date_signature: d.date_signature ?? new Date().toISOString().split('T')[0],
          statut:         d.statut         ?? 'brouillon',
        })
      } else {
        const pf = data.prefill ?? {}
        setForm({
          ...defaultForm(yr),
          denomination:    pf.denomination    ?? '',
          niu:             pf.niu             ?? '',
          scien:           pf.scien           ?? '',
          rccm:            pf.rccm            ?? '',
          adresse_siege:   pf.adresse_siege   ?? '',
          telephone:       pf.telephone       ?? '',
          email:           pf.email           ?? '',
          secteur_activite: pf.secteur_activite ?? '',
          lieu_signature:  pf.lieu_signature  ?? 'Brazzaville',
        })
      }
    } catch {
      setError('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(annee) }, [load, annee])

  // ── Calcul temps réel ───────────────────────────────────────────────────────

  const calcul = useMemo(
    () => calculerPatente(form.ca_annuel, form.ca_exonere, form.est_societe_petroliere, form.credit_n1),
    [form.ca_annuel, form.ca_exonere, form.est_societe_petroliere, form.credit_n1],
  )

  const totalDepts = useMemo(
    () => form.repartition_departements.reduce((s, d) => s + d.ca, 0),
    [form.repartition_departements],
  )

  const setField = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: val }))
    setSaved(false)
  }, [])

  const setDeptCA = useCallback((code: string, ca: number) => {
    setForm(prev => {
      const updated = prev.repartition_departements.map(d =>
        d.code === code ? { ...d, ca } : d,
      )
      return { ...prev, repartition_departements: recalcDepartementPourcentages(updated, calcul.ca_imposable) }
    })
    setSaved(false)
  }, [calcul.ca_imposable])

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async (statut = form.statut) => {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/declarations/patente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          annee,
          statut,
          repartition_departements: recalcDepartementPourcentages(
            form.repartition_departements, calcul.ca_imposable,
          ),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      setForm(prev => ({ ...prev, statut: data.declaration.statut }))
      setSaved(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [form, annee, calcul.ca_imposable])

  // ── PDF 721M officiel ────────────────────────────────────────────────────────

  const [pdfLoading, setPdfLoading] = useState(false)

  const handlePDF = useCallback(async () => {
    setPdfLoading(true)
    try {
      const payload = {
        annee,
        niu: form.niu, scien: form.scien, rccm: form.rccm,
        denomination_sociale: form.denomination,
        adresse: form.adresse_siege,
        telephone: form.telephone, email: form.email,
        forme_juridique: form.forme_juridique,
        nature_activite: form.nature_activite,
        date_debut_activite: form.date_debut_activite,
        nb_etablissements: form.nb_etablissements,
        ca_annuel: form.ca_annuel,
        ca_exonere: form.ca_exonere,
        ca_imposable: calcul.ca_imposable,
        taux_applicable: calcul.taux_applicable,
        patente_brute: calcul.patente_brute,
        patente_liquidee: calcul.patente_liquidee,
        est_societe_petroliere: form.est_societe_petroliere,
        montant_reduction: calcul.montant_reduction,
        patente_apres_reduction: calcul.patente_apres_reduction,
        centimes_additionnels: calcul.centimes_additionnels,
        camu: calcul.camu,
        credit_n1: form.credit_n1,
        patente_nette: calcul.patente_nette,
        departements: recalcDepartementPourcentages(form.repartition_departements, calcul.ca_imposable),
        lieu_signature: form.lieu_signature,
        date_signature: form.date_signature,
      }
      const res = await fetch('/api/declarations/patente/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Erreur génération PDF')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `patente-721M-${annee}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPdfLoading(false)
    }
  }, [form, annee, calcul])

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: MUTED }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ marginLeft: 12, fontSize: 14 }}>Chargement de la déclaration…</span>
      </div>
    )
  }

  const statutBadge = {
    brouillon: { label: 'Brouillon',  color: AMBER, bg: '#FFFBEB' },
    complete:  { label: 'Complète',   color: BLUE,  bg: '#EFF6FF' },
    soumise:   { label: 'Soumise',    color: GREEN, bg: '#F0FDF4' },
  }[form.statut] ?? { label: form.statut, color: MUTED, bg: '#F1F5F9' }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TEXT, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={20} color={GREEN} />
            Déclaration de Patente
            <span style={{ marginLeft: 6, fontSize: 13, fontWeight: 500, color: MUTED }}>· Formulaire 721M</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: MUTED }}>
            Direction Générale des Impôts et des Domaines · Congo-Brazzaville
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Statut */}
          <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: statutBadge.bg, color: statutBadge.color }}>
            {statutBadge.label}
          </span>
          {/* Année */}
          <select value={annee} onChange={e => setAnnee(Number(e.target.value))}
            style={{ ...INPUT_STYLE, width: 'auto', paddingTop: 7, paddingBottom: 7 }}>
            {[annee - 1, annee, annee + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={handlePDF} disabled={pdfLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, border: `1px solid ${AMBER}`, background: pdfLoading ? '#FEF9C3' : '#FFFBEB', cursor: pdfLoading ? 'wait' : 'pointer', fontSize: 12, color: AMBER, fontWeight: 600, opacity: pdfLoading ? 0.7 : 1 }}>
            {pdfLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FileDown size={13} />}
            {pdfLoading ? 'Génération…' : 'Télécharger PDF'}
          </button>
          <button onClick={() => load(annee)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, cursor: 'pointer', fontSize: 12, color: MUTED }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── Erreur ──────────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: RED }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}
      {saved && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: GREEN }}>
          <CheckCircle size={14} /> Déclaration enregistrée avec succès.
        </div>
      )}

      {/* ── Layout deux colonnes ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>

        {/* ── Colonne gauche : formulaire ─────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* SECTION A — Identification */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 22px' }}>
            <SectionHeader
              title="Section A — Identification de l'entreprise"
              sub="Pré-rempli depuis votre profil"
              open={secA} onToggle={() => setSecA(o => !o)}
            />
            {secA && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
                <Field label="NIU (Numéro d'Identifiant Unique)" required>
                  <TextInput value={form.niu} onChange={v => setField('niu', v)} placeholder="Ex : 1234567890A" />
                </Field>
                <Field label="SCIEN">
                  <TextInput value={form.scien} onChange={v => setField('scien', v)} placeholder="Ex : SCIEN00001" />
                </Field>
                <Field label="RCCM" required>
                  <TextInput value={form.rccm} onChange={v => setField('rccm', v)} placeholder="Ex : CG/BZV/25/B/1234" />
                </Field>
                <Field label="Dénomination sociale" required>
                  <TextInput value={form.denomination} onChange={v => setField('denomination', v)} placeholder="Raison sociale" />
                </Field>
                <Field label="Forme juridique" required>
                  <select value={form.forme_juridique} onChange={e => setField('forme_juridique', e.target.value)} style={{ ...INPUT_STYLE }}>
                    <option value="">— Sélectionner —</option>
                    <option>SARL</option>
                    <option>SA</option>
                    <option>SAS</option>
                    <option>EI (Entreprise Individuelle)</option>
                    <option>SNC</option>
                    <option>GIE</option>
                    <option>Autre</option>
                  </select>
                </Field>
                <Field label="Secteur d'activité">
                  <TextInput value={form.secteur_activite} onChange={v => setField('secteur_activite', v)} placeholder="Ex : Commerce général" />
                </Field>
                <Field label="Adresse du siège social" required>
                  <TextInput value={form.adresse_siege} onChange={v => setField('adresse_siege', v)} placeholder="Adresse complète" />
                </Field>
                <Field label="Téléphone">
                  <TextInput value={form.telephone} onChange={v => setField('telephone', v)} placeholder="+242 06 XXX XXXX" />
                </Field>
                <Field label="Email">
                  <TextInput value={form.email} onChange={v => setField('email', v)} placeholder="contact@entreprise.cg" />
                </Field>
                <Field label="Représentant légal" required>
                  <TextInput value={form.representant_legal} onChange={v => setField('representant_legal', v)} placeholder="Nom et prénom" />
                </Field>
                <Field label="Qualité du représentant" required>
                  <TextInput value={form.qualite_representant} onChange={v => setField('qualite_representant', v)} placeholder="Ex : Gérant, Directeur Général" />
                </Field>
              </div>
            )}
          </div>

          {/* SECTION B — Calcul fiscal */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 22px' }}>
            <SectionHeader
              title="Section B — Calcul de la contribution de la patente"
              sub="Exercice fiscal"
              open={secB} onToggle={() => setSecB(o => !o)}
            />
            {secB && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label="Nature de l'activité principale" required>
                    <TextInput value={form.nature_activite} onChange={v => setField('nature_activite', v)} placeholder="Ex : Commerce de détail" />
                  </Field>
                  <Field label="Date de début d'activité">
                    <input type="date" value={form.date_debut_activite} onChange={e => setField('date_debut_activite', e.target.value)}
                      style={INPUT_STYLE} />
                  </Field>
                  <Field label="Nombre d'établissements / succursales" required>
                    <NumberInput value={form.nb_etablissements} onChange={v => setField('nb_etablissements', Math.max(1, v))} min={1} />
                  </Field>
                  <div />
                </div>

                {/* Barème info */}
                <div style={{ background: '#F8FAFC', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 14px', margin: '16px 0', fontSize: 11, color: MUTED }}>
                  <div style={{ fontWeight: 600, color: TEXT, marginBottom: 6 }}>
                    Barème CGI Congo — Taux automatiquement appliqué selon votre CA imposable :
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                    {BAREME_PATENTE_CG.map((t, i) => {
                      const isActive = calcul.taux_applicable === t.taux
                      return (
                        <span key={i} style={{
                          fontSize: 11, fontWeight: isActive ? 700 : 400,
                          color: isActive ? BLUE : MUTED,
                          background: isActive ? '#EFF6FF' : 'transparent',
                          padding: isActive ? '1px 6px' : undefined,
                          borderRadius: 4,
                        }}>
                          {t.seuilMax === Infinity
                            ? `> 500M → ${(t.taux * 100).toFixed(1)}%`
                            : `≤ ${fmtN(t.seuilMax / 1_000_000)}M → ${(t.taux * 100).toFixed(1)}%`}
                        </span>
                      )
                    })}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    Minimum de perception : <strong>{fmtN(MINIMUM_PERCEPTION_FCFA)} FCFA</strong>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label="Chiffre d'affaires annuel brut (FCFA)" required>
                    <NumberInput value={form.ca_annuel} onChange={v => setField('ca_annuel', v)} />
                  </Field>
                  <Field label="CA exonéré (FCFA)">
                    <NumberInput value={form.ca_exonere} onChange={v => setField('ca_exonere', v)} />
                  </Field>

                  {/* CA imposable — readonly */}
                  <Field label="CA imposable (calculé)">
                    <div style={{ ...INPUT_STYLE, background: '#F8FAFC', color: BLUE, fontWeight: 700 }}>
                      {fmtN(calcul.ca_imposable)} FCFA
                    </div>
                  </Field>
                  {/* Taux — readonly */}
                  <Field label="Taux applicable (barème CGI)">
                    <div style={{ ...INPUT_STYLE, background: '#F8FAFC', color: BLUE, fontWeight: 700 }}>
                      {(calcul.taux_applicable * 100).toFixed(1)}%
                    </div>
                  </Field>
                </div>

                {/* Société pétrolière */}
                <div style={{ margin: '16px 0', padding: '12px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Info size={14} color={AMBER} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={form.est_societe_petroliere}
                      onChange={e => setField('est_societe_petroliere', e.target.checked)}
                      style={{ width: 16, height: 16 }}
                    />
                    <span style={{ fontWeight: 600, color: TEXT }}>Société pétrolière</span>
                    <span style={{ color: MUTED }}>— Réduction de 50% sur la patente liquidée</span>
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label="Crédit N-1 (solde exercice précédent, FCFA)">
                    <NumberInput value={form.credit_n1} onChange={v => setField('credit_n1', v)} />
                  </Field>
                </div>
              </div>
            )}
          </div>

          {/* SECTION C — Répartition départements */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 22px' }}>
            <SectionHeader
              title="Section C — Répartition par département"
              sub="12 départements du Congo"
              open={secC} onToggle={() => setSecC(o => !o)}
            />
            {secC && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
                  Indiquez le chiffre d'affaires réalisé dans chaque département.
                  Total à allouer : <strong style={{ color: BLUE }}>{fmtN(calcul.ca_imposable)} FCFA</strong>
                  {totalDepts !== calcul.ca_imposable && calcul.ca_imposable > 0 && (
                    <span style={{ marginLeft: 8, color: RED }}>
                      · Reste : {fmtN(calcul.ca_imposable - totalDepts)} FCFA
                    </span>
                  )}
                  {totalDepts === calcul.ca_imposable && calcul.ca_imposable > 0 && (
                    <span style={{ marginLeft: 8, color: GREEN }}>
                      <CheckCircle size={12} style={{ verticalAlign: 'middle' }} /> Total équilibré
                    </span>
                  )}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: MUTED, fontSize: 11, border: `1px solid ${BORDER}` }}>Département</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: MUTED, fontSize: 11, border: `1px solid ${BORDER}` }}>CA réalisé (FCFA)</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: MUTED, fontSize: 11, border: `1px solid ${BORDER}` }}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.repartition_departements.map(d => {
                        const pct = calcul.ca_imposable > 0
                          ? Math.round((d.ca / calcul.ca_imposable) * 10000) / 100 : 0
                        return (
                          <tr key={d.code}>
                            <td style={{ padding: '6px 12px', border: `1px solid ${BORDER}`, fontWeight: d.ca > 0 ? 600 : 400 }}>{d.nom}</td>
                            <td style={{ padding: '4px 8px', border: `1px solid ${BORDER}` }}>
                              <input
                                type="number" min={0} value={d.ca === 0 ? '' : d.ca}
                                onChange={e => setDeptCA(d.code, Math.max(0, parseInt(e.target.value || '0', 10)))}
                                style={{ ...INPUT_STYLE, textAlign: 'right', padding: '4px 8px' }}
                              />
                            </td>
                            <td style={{ padding: '6px 12px', border: `1px solid ${BORDER}`, textAlign: 'right', fontWeight: 600, color: d.ca > 0 ? BLUE : MUTED }}>
                              {pct.toFixed(2)}%
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#F0F9FF', fontWeight: 700 }}>
                        <td style={{ padding: '8px 12px', border: `1px solid ${BORDER}` }}>TOTAL</td>
                        <td style={{ padding: '8px 12px', border: `1px solid ${BORDER}`, textAlign: 'right', color: totalDepts === calcul.ca_imposable ? GREEN : (totalDepts > calcul.ca_imposable ? RED : TEXT) }}>
                          {fmtN(totalDepts)} FCFA
                        </td>
                        <td style={{ padding: '8px 12px', border: `1px solid ${BORDER}`, textAlign: 'right' }}>
                          {calcul.ca_imposable > 0 ? (totalDepts / calcul.ca_imposable * 100).toFixed(2) : '0.00'}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Signature */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 22px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, borderBottom: `2px solid ${BLUE}`, paddingBottom: 10, marginBottom: 16 }}>
              Signature et certification
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Fait à (ville)" required>
                <TextInput value={form.lieu_signature} onChange={v => setField('lieu_signature', v)} />
              </Field>
              <Field label="Le (date)" required>
                <input type="date" value={form.date_signature} onChange={e => setField('date_signature', e.target.value)}
                  style={INPUT_STYLE} />
              </Field>
            </div>
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#F8FAFC', borderRadius: 10, fontSize: 12, color: MUTED }}>
              Je soussigné(e), <strong style={{ color: TEXT }}>{form.representant_legal || '___________________'}</strong>,
              en qualité de <strong style={{ color: TEXT }}>{form.qualite_representant || '___________________'}</strong>,
              certifie l&apos;exactitude des informations déclarées.
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginBottom: 24 }}>
            <button
              onClick={() => handleSave('brouillon')} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: `1px solid ${BORDER}`, background: CARD, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, color: TEXT, fontWeight: 500 }}>
              {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
              Enregistrer brouillon
            </button>
            <button
              onClick={() => handleSave('complete')} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: 'none', background: BLUE, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, color: '#fff', fontWeight: 600 }}>
              {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={13} />}
              Marquer complète
            </button>
            <button
              onClick={() => handleSave('soumise')} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: 'none', background: GREEN, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, color: '#fff', fontWeight: 600 }}>
              {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
              Soumettre à la DGI
            </button>
          </div>
        </div>

        {/* ── Colonne droite : résumé calcul (sticky) ─────────────────────── */}
        <div style={{ position: 'sticky', top: 24 }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 16, borderBottom: `1px solid ${BORDER}`, paddingBottom: 10 }}>
              Récapitulatif de calcul
            </div>

            {/* Calcul steps */}
            {[
              { label: 'CA annuel brut',          value: calcul.ca_annuel,              highlight: false },
              { label: 'CA exonéré',              value: -calcul.ca_exonere,            highlight: false, sign: '−' },
              { label: 'CA imposable',            value: calcul.ca_imposable,            highlight: true },
              { label: `Taux ${(calcul.taux_applicable * 100).toFixed(1)}% (barème)`,
                                                  value: calcul.patente_brute,           highlight: false },
              { label: `Patente liquidée${calcul.patente_brute < MINIMUM_PERCEPTION_FCFA ? ' (minimum légal)' : ''}`,
                                                  value: calcul.patente_liquidee,        highlight: false },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${row.highlight ? BORDER : 'transparent'}`, marginBottom: row.highlight ? 4 : 0 }}>
                <span style={{ fontSize: 11, color: row.highlight ? TEXT : MUTED, fontWeight: row.highlight ? 600 : 400 }}>
                  {row.sign === '−' ? '− ' : ''}{row.label}
                </span>
                <span style={{ fontSize: 12, fontWeight: row.highlight ? 700 : 400, color: row.highlight ? BLUE : (row.sign === '−' ? RED : TEXT) }}>
                  {fmtN(Math.abs(row.value))}
                </span>
              </div>
            ))}

            {calcul.est_societe_petroliere && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', color: AMBER }}>
                <span style={{ fontSize: 11 }}>Réduction pétrolière (50%)</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>− {fmtN(calcul.montant_reduction)}</span>
              </div>
            )}

            <div style={{ borderTop: `1px dashed ${BORDER}`, margin: '8px 0 6px' }} />

            {[
              { label: 'Patente après réduction', value: calcul.patente_apres_reduction },
              { label: '+ Centimes additionnels (5%)', value: calcul.centimes_additionnels, sign: '+' },
              { label: '+ CAMU (0.5%)',               value: calcul.camu,                  sign: '+' },
              { label: '− Crédit N-1',                value: calcul.credit_n1,             sign: '−' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11 }}>
                <span style={{ color: MUTED }}>{row.label}</span>
                <span style={{ color: row.sign === '−' ? RED : (row.sign === '+' ? GREEN : TEXT), fontWeight: 500 }}>
                  {fmtN(row.value)}
                </span>
              </div>
            ))}

            {/* Total final */}
            <div style={{ marginTop: 12, padding: '12px 14px', background: '#0F172A', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                PATENTE NETTE À PAYER
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                {fmtN(calcul.patente_nette)}
                <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 4, color: '#94A3B8' }}>FCFA</span>
              </div>
              <div style={{ fontSize: 10, color: '#64748B', marginTop: 4, lineHeight: 1.5, fontStyle: 'italic' }}>
                {montantEnLettres(calcul.patente_nette)}
              </div>
            </div>

            {/* Barème actuel */}
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#EFF6FF', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: BLUE, fontWeight: 600 }}>TAUX APPLICABLE</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: BLUE }}>
                {(calcul.taux_applicable * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: 10, color: MUTED }}>
                {calcul.ca_imposable === 0 ? 'Aucun CA saisi' :
                  calcul.ca_imposable <= 5_000_000   ? 'CA ≤ 5M FCFA' :
                  calcul.ca_imposable <= 10_000_000  ? 'CA ≤ 10M FCFA' :
                  calcul.ca_imposable <= 30_000_000  ? 'CA ≤ 30M FCFA' :
                  calcul.ca_imposable <= 50_000_000  ? 'CA ≤ 50M FCFA' :
                  calcul.ca_imposable <= 100_000_000 ? 'CA ≤ 100M FCFA' :
                  calcul.ca_imposable <= 500_000_000 ? 'CA ≤ 500M FCFA' :
                  'CA > 500M FCFA'}
              </div>
            </div>

            {/* Référence légale */}
            <div style={{ marginTop: 12, fontSize: 10, color: MUTED, lineHeight: 1.7 }}>
              <strong>Base légale :</strong> Art. 235 et suivants du CGI Congo<br />
              <strong>Échéance :</strong> 31 janvier de l&apos;année en cours<br />
              <strong>Minimum :</strong> {fmtN(MINIMUM_PERCEPTION_FCFA)} FCFA
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @media print {
          nav, aside, .no-print { display: none !important; }
          body { background: white; }
        }
        @media (max-width: 900px) {
          div[style*="gridTemplateColumns: 1fr 320px"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="position: sticky"] {
            position: static !important;
          }
        }
      `}</style>
    </div>
  )
}
