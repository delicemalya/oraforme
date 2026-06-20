'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Download, Loader2, RefreshCw, FileText, CheckCircle,
  AlertTriangle, Plus, Trash2, Edit3, Save, BarChart3, Shield,
  X, FileSpreadsheet
} from 'lucide-react'
import {
  calculerCNSSEmploye, calculerDeclarationGlobale, fmtCNSS, MOIS_LABELS,
  type EmployeDeclaration, type EmployeInput, type DeclarationCNSS,
} from '@/lib/declarations/cnss-congo'

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  text:    '#0F172A',
  muted:   '#64748B',
  border:  '#E2E8F0',
  card:    '#FFFFFF',
  primary: '#F59E0B',
  purple:  '#7C3AED',
  blue:    '#2563EB',
  green:   '#16A34A',
  red:     '#DC2626',
  bg:      '#F8FAFC',
}

// ── Types locaux ──────────────────────────────────────────────────────────────

type Statut = 'brouillon' | 'validee' | 'deposee' | 'payee' | 'annulee'

interface LigneEditable {
  key: string
  employe_id?: string
  nom: string
  postnom: string
  prenom: string
  numero_cnss: string
  matricule: string
  poste: string
  salaire_brut: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statutBadge(s: Statut) {
  const map: Record<Statut, { label: string; bg: string; color: string }> = {
    brouillon: { label: 'Brouillon',   bg: '#F1F5F9', color: C.muted },
    validee:   { label: 'Validée',     bg: '#EFF6FF', color: C.blue },
    deposee:   { label: 'Déposée',     bg: '#F0FDF4', color: C.green },
    payee:     { label: 'Payée',       bg: '#F0FDF4', color: C.green },
    annulee:   { label: 'Annulée',     bg: '#FEF2F2', color: C.red },
  }
  const { label, bg, color } = map[s]
  return (
    <span style={{ background: bg, color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
      {label}
    </span>
  )
}

function kpi(label: string, value: string, color: string, sub?: string) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 3, fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

const VIDE: LigneEditable = {
  key: '', employe_id: undefined, nom: '', postnom: '', prenom: '',
  numero_cnss: '', matricule: '', poste: '', salaire_brut: '',
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function CNSSDeclarationPage() {
  const now = new Date()
  const [mois, setMois]     = useState(now.getMonth() + 1)
  const [annee, setAnnee]   = useState(now.getFullYear())
  const [tab, setTab]       = useState<'global' | 'liste' | 'actions'>('global')
  const [decl, setDecl]     = useState<DeclarationCNSS | null>(null)
  const [lignes, setLignes] = useState<LigneEditable[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [prefilling, setPrefilling] = useState(false)
  const [editIdx, setEditIdx]   = useState<number | null>(null)
  const [editRow, setEditRow]   = useState<LigneEditable>(VIDE)
  const [showAdd, setShowAdd]   = useState(false)
  const [newRow, setNewRow]     = useState<LigneEditable>(VIDE)
  const [toast, setToast]       = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  // ── Calcul en temps réel ─────────────────────────────────────────────────────

  const computedEmployes: EmployeDeclaration[] = lignes.map((l, i) =>
    calculerCNSSEmploye(i + 1, {
      employe_id: l.employe_id,
      nom: l.nom, postnom: l.postnom || null, prenom: l.prenom,
      numero_cnss: l.numero_cnss || null, matricule: l.matricule || null, poste: l.poste || null,
      salaire_brut: parseFloat(l.salaire_brut) || 0,
    })
  )
  const recap = calculerDeclarationGlobale(computedEmployes)

  // ── Chargement ───────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/declarations/cnss?mois=${mois}&annee=${annee}`)
    if (res.ok) {
      const d: DeclarationCNSS | null = await res.json()
      setDecl(d)
      setLignes((d?.employes ?? []).map((e, i) => ({
        key:        `${i}`,
        employe_id: e.employe_id,
        nom:        e.nom,
        postnom:    e.postnom ?? '',
        prenom:     e.prenom,
        numero_cnss: e.numero_cnss === '—' ? '' : (e.numero_cnss ?? ''),
        matricule:  e.matricule ?? '',
        poste:      e.poste ?? '',
        salaire_brut: String(e.salaire_brut),
      })))
    } else {
      setDecl(null)
      setLignes([])
    }
    setLoading(false)
  }, [mois, annee])

  useEffect(() => { load() }, [load])

  // ── Toast ────────────────────────────────────────────────────────────────────

  function showToast(msg: string, type: 'ok' | 'err') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Pré-remplir depuis la paie ────────────────────────────────────────────────

  async function preremplir() {
    setPrefilling(true)
    const res = await fetch(`/api/declarations/cnss/preremplir?mois=${mois}&annee=${annee}`)
    if (res.ok) {
      const { employes } = await res.json() as { employes: EmployeInput[] }
      setLignes(employes.map((e, i) => ({
        key:         String(i),
        employe_id:  e.employe_id,
        nom:         e.nom,
        postnom:     e.postnom ?? '',
        prenom:      e.prenom,
        numero_cnss: e.numero_cnss ?? '',
        matricule:   e.matricule ?? '',
        poste:       e.poste ?? '',
        salaire_brut: String(e.salaire_brut),
      })))
      showToast(`${employes.length} employé(s) chargés depuis les bulletins de paie`, 'ok')
    } else {
      showToast('Aucun bulletin de paie trouvé pour cette période', 'err')
    }
    setPrefilling(false)
  }

  // ── Sauvegarde ───────────────────────────────────────────────────────────────

  async function sauvegarder(statut?: Statut) {
    setSaving(true)
    const body = {
      mois, annee,
      statut:   statut ?? decl?.statut ?? 'brouillon',
      employes: computedEmployes,
      recap,
      pre_rempli_depuis_paie: decl?.pre_rempli_depuis_paie ?? false,
    }
    const res = await fetch('/api/declarations/cnss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const d = await res.json()
      setDecl(d)
      showToast('Déclaration sauvegardée', 'ok')
    } else {
      showToast('Erreur lors de la sauvegarde', 'err')
    }
    setSaving(false)
  }

  // ── Export PDF / Excel ────────────────────────────────────────────────────────

  async function exportPDF(type: 'globale' | 'nominative') {
    if (!decl?.id) { showToast('Sauvegardez d\'abord la déclaration', 'err'); return }
    const res = await fetch(`/api/declarations/cnss/${decl.id}/pdf?type=${type}`)
    if (res.ok) {
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `CNSS_${type}_${annee}_${String(mois).padStart(2,'0')}.pdf`
      a.click()
    } else {
      showToast('Erreur génération PDF', 'err')
    }
  }

  async function exportExcel(type: 'cnss' | 'cnss-tus') {
    if (!decl?.id) { showToast('Sauvegardez d\'abord la déclaration', 'err'); return }
    const res = await fetch(`/api/declarations/cnss/${decl.id}/excel?type=${type}`)
    if (res.ok) {
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = type === 'cnss'
        ? `CNSS_${annee}_${String(mois).padStart(2,'0')}.xlsx`
        : `CNSS_TUS_${annee}_${String(mois).padStart(2,'0')}.xlsx`
      a.click()
    } else {
      showToast('Erreur génération Excel', 'err')
    }
  }

  // ── Gestion lignes ─────────────────────────────────────────────────────────────

  function addLigne() {
    if (!newRow.nom || !newRow.prenom || !newRow.salaire_brut) return
    setLignes(prev => [...prev, { ...newRow, key: Date.now().toString() }])
    setNewRow(VIDE)
    setShowAdd(false)
  }

  function deleteLigne(idx: number) {
    setLignes(prev => prev.filter((_, i) => i !== idx))
  }

  function startEdit(idx: number) {
    setEditIdx(idx)
    setEditRow({ ...lignes[idx] })
  }

  function saveEdit() {
    if (editIdx === null) return
    setLignes(prev => prev.map((l, i) => i === editIdx ? editRow : l))
    setEditIdx(null)
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  const inputStyle = {
    border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 9px',
    fontSize: 12, background: C.card, width: '100%', outline: 'none',
  }

  const btnPrimary = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
    borderRadius: 9, border: 'none', background: C.primary, color: C.text,
    cursor: 'pointer', fontSize: 12, fontWeight: 700,
  }

  const btnSecondary = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
    borderRadius: 9, border: `1px solid ${C.border}`, background: C.card,
    cursor: 'pointer', fontSize: 12, color: C.muted, fontWeight: 600,
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '20px 0' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px' }}>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                position: 'fixed', top: 20, right: 20, zIndex: 999,
                background: toast.type === 'ok' ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${toast.type === 'ok' ? '#86EFAC' : '#FECACA'}`,
                color: toast.type === 'ok' ? C.green : C.red,
                padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 8, maxWidth: 360,
              }}>
              {toast.type === 'ok' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Shield size={22} color={C.primary} /> CNSS Congo — Télédéclaration Officielle
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted }}>
              Cotisations sociales mensuelles — Déclaration légale CNSS Congo-Brazzaville
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {decl && statutBadge(decl.statut)}
            <select value={mois} onChange={e => setMois(Number(e.target.value))}
              style={{ border: `1px solid ${C.border}`, borderRadius: 9, padding: '7px 11px', background: C.card, fontSize: 13 }}>
              {MOIS_LABELS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <select value={annee} onChange={e => setAnnee(Number(e.target.value))}
              style={{ border: `1px solid ${C.border}`, borderRadius: 9, padding: '7px 11px', background: C.card, fontSize: 13 }}>
              {[2023,2024,2025,2026,2027].map(y => <option key={y}>{y}</option>)}
            </select>
            <button onClick={load} style={btnSecondary}><RefreshCw size={13} /></button>
            <button onClick={preremplir} disabled={prefilling} style={btnSecondary}>
              {prefilling ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Users size={13} />}
              Pré-remplir depuis la paie
            </button>
            <button onClick={() => sauvegarder()} disabled={saving} style={btnPrimary}>
              {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
              Sauvegarder
            </button>
          </div>
        </div>

        {/* Bandeau taux officiels */}
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '10px 16px', marginBottom: 18, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Shield size={14} color={C.primary} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 11, color: '#92400E', lineHeight: 1.7 }}>
            <strong>Taux CNSS Congo officiels 2024 :</strong>
            &nbsp; Vieillesse : <strong>4% salarié + 8% patronal</strong> (plaf. 1 200 000 FCFA/agent)
            &nbsp;·&nbsp; Allocations Familiales : <strong>10.03%</strong> + AT-Maladie : <strong>2.25%</strong> (plaf. 600 000 FCFA/agent)
            &nbsp;·&nbsp; TUS : <strong>3%</strong> déplafonné
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          {kpi('Masse salariale', fmtCNSS(recap.masse_salariale), C.text, `${recap.nb_employes} employé(s)`)}
          {kpi('Part salarié (4%)', fmtCNSS(recap.cotisation_vieillesse_employe), C.purple, 'Vieillesse retenue')}
          {kpi('VID Patronal (8%)', fmtCNSS(recap.cotisation_vieillesse_patronal), C.blue, 'Vieillesse patronal')}
          {kpi('AF + AT (12.28%)', fmtCNSS(recap.cotisation_at_mp_pf_total), '#0891B2', 'Plafonné 600 000')}
          {kpi('TUS (3%)', fmtCNSS(recap.cotisation_tus_total), C.primary, 'Déplafonné')}
          {kpi('TOTAL À VERSER', fmtCNSS(recap.total_a_verser), C.red, 'Part salarié + patronal')}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 4, width: 'fit-content' }}>
          {([
            { id: 'global',  label: 'Vue globale',      icon: BarChart3 },
            { id: 'liste',   label: 'Liste nominative', icon: Users },
            { id: 'actions', label: 'Export & Actions', icon: Download },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7,
                border: 'none', background: tab === t.id ? C.primary : 'transparent',
                color: tab === t.id ? C.text : C.muted, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ marginTop: 10, fontSize: 13 }}>Chargement...</div>
          </div>
        ) : (
          <>
            {/* ── Vue globale ──────────────────────────────────────────────── */}
            {tab === 'global' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
                    <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>
                      Récapitulatif des cotisations — {MOIS_LABELS[mois-1]} {annee}
                    </h2>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: C.text, color: '#fff' }}>
                        {['Nature de la cotisation','Base de calcul','Taux','Montant FCFA','Qui paie'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Nature de la cotisation' ? 'left' : 'right', fontSize: 11, fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { nature: 'Vieillesse — Part salarié',     base: recap.base_vieillesse_total,   taux: '4%',     montant: recap.cotisation_vieillesse_employe,  qui: 'Employé', color: C.purple },
                        { nature: 'Vieillesse — Part patronale (VID)', base: recap.base_vieillesse_total, taux: '8%',  montant: recap.cotisation_vieillesse_patronal, qui: 'Patronal', color: C.blue },
                        { nature: 'Allocations Familiales (AF)',    base: recap.base_at_mp_pf_total,     taux: '10.03%', montant: recap.allocations_familiales_total,   qui: 'Patronal', color: '#0891B2' },
                        { nature: 'Accidents du Travail (AT)',      base: recap.base_at_mp_pf_total,     taux: '2.25%',  montant: recap.accidents_travail_total,        qui: 'Patronal', color: '#0891B2' },
                        { nature: 'Taxe Unique sur Salaires (TUS)', base: recap.masse_salariale,         taux: '3%',     montant: recap.cotisation_tus_total,           qui: 'Patronal', color: C.primary },
                      ].map((row, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.card : '#FAFAFA' }}>
                          <td style={{ padding: '11px 16px', fontWeight: 600, color: C.text }}>{row.nature}</td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', color: C.muted }}>{fmtCNSS(row.base)}</td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', color: C.muted }}>{row.taux}</td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 700, color: row.color }}>{fmtCNSS(row.montant)}</td>
                          <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                            <span style={{ background: row.qui === 'Employé' ? '#F5F3FF' : '#EFF6FF', color: row.qui === 'Employé' ? C.purple : C.blue, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{row.qui}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#1E293B', color: '#fff' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 800 }}>TOTAL PATRONAL</td>
                        <td colSpan={2} />
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800 }}>{fmtCNSS(recap.total_cotisations_patronales)}</td>
                        <td />
                      </tr>
                      <tr style={{ background: C.text, color: '#fff' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 800, fontSize: 14 }}>TOTAL À VERSER À LA CNSS</td>
                        <td colSpan={2} />
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#FCA5A5' }}>{fmtCNSS(recap.total_a_verser)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </motion.div>
            )}

            {/* ── Liste nominative ─────────────────────────────────────────── */}
            {tab === 'liste' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>
                      Liste nominative — {lignes.length} employé(s)
                    </h2>
                    <button onClick={() => setShowAdd(true)} style={btnPrimary}>
                      <Plus size={13} /> Ajouter un employé
                    </button>
                  </div>

                  {/* Formulaire ajout */}
                  <AnimatePresence>
                    {showAdd && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px', background: '#FFFBEB', borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 10 }}>
                            {([
                              ['nom',          'Nom *'],
                              ['postnom',      'Post-nom'],
                              ['prenom',       'Prénom *'],
                              ['numero_cnss',  'N° CNSS'],
                              ['matricule',    'Matricule'],
                              ['poste',        'Poste'],
                              ['salaire_brut', 'Salaire brut *'],
                            ] as [keyof LigneEditable, string][]).map(([k, label]) => (
                              <div key={k}>
                                <label style={{ fontSize: 10, color: C.muted, display: 'block', marginBottom: 3 }}>{label}</label>
                                <input
                                  type={k === 'salaire_brut' ? 'number' : 'text'}
                                  value={newRow[k] as string}
                                  onChange={e => setNewRow(p => ({ ...p, [k]: e.target.value }))}
                                  style={inputStyle} placeholder={label}
                                />
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={addLigne} style={btnPrimary}><Plus size={12} /> Ajouter</button>
                            <button onClick={() => { setShowAdd(false); setNewRow(VIDE) }} style={btnSecondary}><X size={12} /> Annuler</button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: C.text, color: '#fff' }}>
                          {['N°','Nom Prénom','N° CNSS','Sal. Brut','Part Agent 4%','VID 8%','AF 10.03%','AT 2.25%','TUS 3%','Total à Verser','Actions'].map(h => (
                            <th key={h} style={{ padding: '9px 10px', textAlign: h === 'N°' || h === 'Nom Prénom' || h === 'Actions' ? 'left' : 'right', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {computedEmployes.map((e, i) => (
                          <tr key={lignes[i]?.key ?? i} style={{ borderBottom: `1px solid #F8FAFC`, background: i % 2 === 0 ? C.card : '#FAFAFA' }}>
                            <td style={{ padding: '8px 10px', color: C.muted, fontSize: 10 }}>{e.numero_ordre}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: C.text, whiteSpace: 'nowrap' }}>
                              {editIdx === i ? (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <input value={editRow.nom} onChange={ev => setEditRow(p => ({ ...p, nom: ev.target.value }))} style={{ ...inputStyle, width: 80 }} placeholder="Nom" />
                                  <input value={editRow.prenom} onChange={ev => setEditRow(p => ({ ...p, prenom: ev.target.value }))} style={{ ...inputStyle, width: 80 }} placeholder="Prénom" />
                                </div>
                              ) : (
                                [e.nom, e.postnom, e.prenom].filter(Boolean).join(' ')
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: C.muted }}>
                              {editIdx === i
                                ? <input value={editRow.numero_cnss} onChange={ev => setEditRow(p => ({ ...p, numero_cnss: ev.target.value }))} style={{ ...inputStyle, width: 100 }} />
                                : e.numero_cnss}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: C.text }}>
                              {editIdx === i
                                ? <input type="number" value={editRow.salaire_brut} onChange={ev => setEditRow(p => ({ ...p, salaire_brut: ev.target.value }))} style={{ ...inputStyle, width: 110 }} />
                                : fmtCNSS(e.salaire_brut)}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: C.purple, fontWeight: 700 }}>{fmtCNSS(e.cotisation_employe)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: C.blue, fontWeight: 700 }}>{fmtCNSS(e.cotisation_vieillesse)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#0891B2' }}>{fmtCNSS(e.allocations_familiales)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#0891B2' }}>{fmtCNSS(e.accidents_travail)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: C.primary, fontWeight: 600 }}>{fmtCNSS(e.cotisation_tus)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: C.red }}>{fmtCNSS(e.total_a_verser)}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <div style={{ display: 'flex', gap: 4 }}>
                                {editIdx === i ? (
                                  <button onClick={saveEdit} style={{ ...btnPrimary, padding: '4px 8px', fontSize: 10 }}><Save size={11} /></button>
                                ) : (
                                  <button onClick={() => startEdit(i)} style={{ ...btnSecondary, padding: '4px 8px', fontSize: 10 }}><Edit3 size={11} /></button>
                                )}
                                <button onClick={() => deleteLigne(i)} style={{ ...btnSecondary, padding: '4px 8px', color: C.red, fontSize: 10 }}><Trash2 size={11} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {/* Ligne totaux */}
                        {computedEmployes.length > 0 && (
                          <tr style={{ background: C.text, color: '#fff' }}>
                            <td colSpan={3} style={{ padding: '10px 10px', fontWeight: 800 }}>TOTAL</td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700 }}>{fmtCNSS(recap.masse_salariale)}</td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700 }}>{fmtCNSS(recap.cotisation_vieillesse_employe)}</td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700 }}>{fmtCNSS(recap.cotisation_vieillesse_patronal)}</td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700 }}>{fmtCNSS(recap.allocations_familiales_total)}</td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700 }}>{fmtCNSS(recap.accidents_travail_total)}</td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700 }}>{fmtCNSS(recap.cotisation_tus_total)}</td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: '#FCA5A5' }}>{fmtCNSS(recap.total_a_verser)}</td>
                            <td />
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {lignes.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
                      <Users size={32} color={C.border} style={{ marginBottom: 8 }} />
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Aucun employé</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>Pré-remplissez depuis la paie ou ajoutez manuellement</div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Export & Actions ─────────────────────────────────────────── */}
            {tab === 'actions' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>

                  {/* Téléchargements PDF */}
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 20px' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={14} color={C.red} /> Documents PDF officiels
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button onClick={() => exportPDF('globale')} style={{ ...btnSecondary, justifyContent: 'flex-start' }}>
                        <FileText size={14} color={C.red} />
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 700, color: C.text }}>Déclaration Globale (A4 portrait)</div>
                          <div style={{ fontSize: 10, color: C.muted }}>Bordereau de versement mensuel</div>
                        </div>
                      </button>
                      <button onClick={() => exportPDF('nominative')} style={{ ...btnSecondary, justifyContent: 'flex-start' }}>
                        <FileText size={14} color={C.blue} />
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 700, color: C.text }}>Liste Nominative (A4 paysage)</div>
                          <div style={{ fontSize: 10, color: C.muted }}>Détail par employé — tous les taux</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Téléchargements Excel */}
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 20px' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileSpreadsheet size={14} color={C.green} /> Fichiers Excel télédéclaration
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button onClick={() => exportExcel('cnss')} style={{ ...btnSecondary, justifyContent: 'flex-start' }}>
                        <FileSpreadsheet size={14} color={C.green} />
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 700, color: C.text }}>CNSS.xlsx</div>
                          <div style={{ fontSize: 10, color: C.muted }}>Cotisations sans TUS (format CNSS)</div>
                        </div>
                      </button>
                      <button onClick={() => exportExcel('cnss-tus')} style={{ ...btnSecondary, justifyContent: 'flex-start' }}>
                        <FileSpreadsheet size={14} color='#0891B2' />
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 700, color: C.text }}>CNSS_TUS.xlsx</div>
                          <div style={{ fontSize: 10, color: C.muted }}>Cotisations avec TUS (format complet)</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Workflow statut */}
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 20px' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle size={14} color={C.green} /> Workflow déclaration
                    </h3>
                    {decl && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Statut actuel :</div>
                        {statutBadge(decl.statut)}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button onClick={() => sauvegarder('validee')} style={{ ...btnPrimary, justifyContent: 'flex-start', background: C.blue, color: '#fff' }}>
                        <CheckCircle size={13} /> Valider la déclaration
                      </button>
                      <button onClick={() => sauvegarder('deposee')} style={{ ...btnPrimary, justifyContent: 'flex-start', background: C.green, color: '#fff' }}>
                        <CheckCircle size={13} /> Marquer comme déposée
                      </button>
                      <button onClick={() => sauvegarder('payee')} style={{ ...btnPrimary, justifyContent: 'flex-start', background: '#0891B2', color: '#fff' }}>
                        <CheckCircle size={13} /> Marquer comme payée
                      </button>
                    </div>
                  </div>

                </div>
              </motion.div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
