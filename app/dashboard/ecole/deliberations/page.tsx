'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { CheckSquare, Loader2, RefreshCw, Download, Check, X, Play } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

type Statut = 'en_cours' | 'admis' | 'ajourne' | 'rattrapage' | 'abandonne'

interface Deliberation {
  id: string
  tenant_id: string
  etudiant_id: string | null
  annee_universitaire: string
  session: string
  credits_obtenus: number
  credits_requis: number
  moyenne_generale: number | null
  nb_semestres_valides: number
  statut: Statut
  mention: string | null
  date_deliberation: string | null
  president_jury: string | null
  observations: string | null
  etudiants?: { numero_id: string; nom: string; prenom: string } | null
}

interface AnneeAcademique { id: string; libelle: string; session_active: string; statut: string }

interface Parcours { id: string; libelle: string; niveau: string; credits_requis: number }

const STATUT_CFG: Record<Statut, { label: string; color: string; bg: string }> = {
  en_cours:  { label: 'En cours',   color: '#D97706', bg: 'rgba(217,119,6,0.08)'  },
  admis:     { label: 'Admis',      color: '#16A34A', bg: 'rgba(22,163,74,0.08)'  },
  ajourne:   { label: 'Ajourné',    color: '#DC2626', bg: 'rgba(220,38,38,0.08)'  },
  rattrapage:{ label: 'Rattrapage', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
  abandonne: { label: 'Abandonné',  color: '#6B7280', bg: 'rgba(107,114,128,0.08)'},
}

function exportCSV(rows: Deliberation[]) {
  const header = ['Étudiant', 'N° Étudiant', 'Année', 'Session', 'Crédits obtenus', 'Crédits requis', 'Moyenne', 'Semestres validés', 'Statut', 'Mention', 'Date délibération']
  const lines = rows.map(r => [
    r.etudiants ? `${r.etudiants.nom} ${r.etudiants.prenom}` : r.etudiant_id ?? '—',
    r.etudiants?.numero_id ?? '—',
    r.annee_universitaire,
    r.session,
    r.credits_obtenus,
    r.credits_requis,
    r.moyenne_generale ?? '—',
    r.nb_semestres_valides,
    STATUT_CFG[r.statut]?.label ?? r.statut,
    r.mention ?? '—',
    r.date_deliberation ?? '—',
  ])
  const csv = [header, ...lines].map(l => l.join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url
  a.download = `deliberations_${rows[0]?.annee_universitaire ?? 'export'}.csv`
  a.click(); URL.revokeObjectURL(url)
}

export default function DeliberationsPage() {
  const { tenantId, sousType } = useTenant()

  const [delibs,          setDelibs]          = useState<Deliberation[]>([])
  const [annees,          setAnnees]          = useState<AnneeAcademique[]>([])
  const [parcours,        setParcours]        = useState<Parcours[]>([])
  const [loading,         setLoading]         = useState(true)
  const [generating,      setGenerating]      = useState(false)
  const [selectedAnnee,   setSelectedAnnee]   = useState('')
  const [selectedParcours, setSelectedParcours] = useState<Parcours | null>(null)
  const [filterStatut,    setFilterStatut]    = useState<Statut | ''>('')
  const [toast,           setToast]           = useState<{ ok: boolean; msg: string } | null>(null)

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg }); setTimeout(() => setToast(null), 4000)
  }

  const loadAnnees = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('annees_academiques')
      .select('id,libelle,session_active,statut')
      .eq('tenant_id', tenantId)
      .order('annee_debut', { ascending: false })
    const rows = (data ?? []) as AnneeAcademique[]
    setAnnees(rows)
    // Pré-sélectionner l'année en cours (statut = 'en_cours')
    const active = rows.find(r => r.statut === 'en_cours') ?? rows[0]
    if (active && !selectedAnnee) setSelectedAnnee(active.libelle)
  }, [tenantId, selectedAnnee])

  const loadParcours = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('parcours_universite')
      .select('id,libelle,niveau,credits_requis')
      .eq('tenant_id', tenantId)
      .order('niveau')
    setParcours((data ?? []) as Parcours[])
  }, [tenantId])

  const loadDelibs = useCallback(async () => {
    if (!tenantId || !selectedAnnee) { setDelibs([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('deliberations_universite')
      .select('*, etudiants(numero_id, nom, prenom)')
      .eq('tenant_id', tenantId)
      .eq('annee_universitaire', selectedAnnee)
      .order('statut')
      .order('moyenne_generale', { ascending: false })
    setDelibs((data ?? []) as Deliberation[])
    setLoading(false)
  }, [tenantId, selectedAnnee])

  useEffect(() => { loadAnnees() }, [loadAnnees])
  useEffect(() => { loadDelibs() }, [loadDelibs])
  useEffect(() => { loadParcours() }, [loadParcours])

  async function generer() {
    if (!tenantId || !selectedAnnee) return
    setGenerating(true)
    const anneeObj = annees.find(a => a.libelle === selectedAnnee)
    const session = anneeObj?.session_active ?? 'normale'
    const creditsRequis = selectedParcours?.credits_requis ?? 180
    const { error } = await supabase.rpc('fn_deliberer_annee', {
      p_tenant_id: tenantId,
      p_annee: selectedAnnee,
      p_session: session,
      p_credits_requis: creditsRequis,
    })
    if (error) showToast(false, error.message)
    else { showToast(true, 'Délibérations générées automatiquement.'); loadDelibs() }
    setGenerating(false)
  }

  const displayed = filterStatut ? delibs.filter(d => d.statut === filterStatut) : delibs

  // KPIs
  const kpis = {
    total:      delibs.length,
    admis:      delibs.filter(d => d.statut === 'admis').length,
    ajourne:    delibs.filter(d => d.statut === 'ajourne').length,
    rattrapage: delibs.filter(d => d.statut === 'rattrapage').length,
  }
  const tauxReussite = kpis.total > 0 ? Math.round((kpis.admis / kpis.total) * 100) : 0

  if (sousType && sousType !== 'universite') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <CheckSquare size={40} style={{ color: 'var(--border)' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Les délibérations sont réservées aux établissements de type Université.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Délibérations</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            Résultats annuels calculés automatiquement depuis les semestres validés.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {delibs.length > 0 && (
            <button onClick={() => exportCSV(delibs)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              <Download size={13} /> CSV
            </button>
          )}
          <button onClick={generer} disabled={generating || !selectedAnnee}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: '#2563EB' }}>
            {generating ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            Générer les délibérations
          </button>
        </div>
      </motion.div>

      {/* Sélecteurs année + parcours */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-3 flex-wrap items-center">
          <label style={{ fontSize: 13, color: 'var(--text-secondary)', minWidth: 60 }}>Année :</label>
          {annees.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Aucune année académique — créez-en une d'abord.
            </p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {annees.map(a => (
                <button key={a.libelle} onClick={() => setSelectedAnnee(a.libelle)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={selectedAnnee === a.libelle
                    ? { background: '#2563EB', color: '#fff' }
                    : { background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                  {a.libelle}
                </button>
              ))}
            </div>
          )}
        </div>
        {parcours.length > 0 && (
          <div className="flex gap-3 flex-wrap items-center">
            <label style={{ fontSize: 13, color: 'var(--text-secondary)', minWidth: 60 }}>Parcours :</label>
            <select
              value={selectedParcours?.id ?? ''}
              onChange={e => {
                const p = parcours.find(x => x.id === e.target.value) ?? null
                setSelectedParcours(p)
              }}
              className="px-3 py-1.5 rounded-lg text-xs border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
              <option value=''>Tous parcours (180 cr.)</option>
              {parcours.map(p => (
                <option key={p.id} value={p.id}>
                  {p.libelle} — {p.niveau} ({p.credits_requis} cr.)
                </option>
              ))}
            </select>
            {selectedParcours && (
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Seuil : <strong>{selectedParcours.credits_requis} crédits</strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* KPIs */}
      {delibs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total',      value: kpis.total,      color: 'var(--text-primary)' },
            { label: 'Admis',      value: kpis.admis,      color: '#16A34A' },
            { label: 'Ajournés',   value: kpis.ajourne,    color: '#DC2626' },
            { label: 'Rattrapage', value: kpis.rattrapage, color: '#7C3AED' },
            { label: 'Taux réussite', value: `${tauxReussite}%`, color: tauxReussite >= 70 ? '#16A34A' : '#D97706' },
          ].map(k => (
            <div key={k.label} className="rounded-xl border p-4"
              style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</p>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtre statut */}
      {delibs.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterStatut('')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={!filterStatut
              ? { background: '#2563EB', color: '#fff' }
              : { background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            Tous ({delibs.length})
          </button>
          {(Object.keys(STATUT_CFG) as Statut[]).map(s => {
            const cnt = delibs.filter(d => d.statut === s).length
            if (!cnt) return null
            const cfg = STATUT_CFG[s]
            return (
              <button key={s} onClick={() => setFilterStatut(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={filterStatut === s
                  ? { background: cfg.color, color: '#fff' }
                  : { background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                {cfg.label} ({cnt})
              </button>
            )
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${
          toast.ok ? 'bg-[#16A34A]/10 border-[#16A34A]/25 text-[#16A34A]' : 'bg-[#DC2626]/10 border-[#DC2626]/25 text-[#DC2626]'
        }`}>
          {toast.ok ? <Check size={14} /> : <X size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-secondary)' }} />
        </div>
      ) : !selectedAnnee ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border border-dashed"
          style={{ borderColor: 'var(--border)' }}>
          <CheckSquare size={32} style={{ color: 'var(--border)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Sélectionnez une année académique.
          </p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border border-dashed"
          style={{ borderColor: 'var(--border)' }}>
          <CheckSquare size={32} style={{ color: 'var(--border)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Aucune délibération pour {selectedAnnee}. Cliquez sur "Générer les délibérations".
          </p>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden sm:block rounded-xl border overflow-hidden"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[700px]">
                <thead style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  <tr>
                    <th className="text-left px-4 py-2.5" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Étudiant</th>
                    <th className="text-left px-4 py-2.5" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Crédits</th>
                    <th className="text-center px-4 py-2.5" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Moyenne</th>
                    <th className="text-center px-4 py-2.5" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Sem. validés</th>
                    <th className="text-left px-4 py-2.5" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Statut</th>
                    <th className="text-left px-4 py-2.5" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Mention</th>
                    <th className="text-left px-4 py-2.5" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Date délib.</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((d, i) => {
                    const sc = STATUT_CFG[d.statut]
                    const nom = d.etudiants ? `${d.etudiants.nom} ${d.etudiants.prenom}` : d.etudiant_id?.slice(0, 8) ?? '—'
                    return (
                      <motion.tr key={d.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.01 }}
                        style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="px-4 py-2.5">
                          <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{nom}</p>
                          {d.etudiants?.numero_id && (
                            <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{d.etudiants.numero_id}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.credits_obtenus}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>/{d.credits_requis}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {d.moyenne_generale != null ? `${d.moyenne_generale}/20` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center" style={{ color: 'var(--text-secondary)' }}>
                          {d.nb_semestres_valides}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                        </td>
                        <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>
                          {d.mention ?? '—'}
                        </td>
                        <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>
                          {d.date_deliberation ? new Date(d.date_deliberation).toLocaleDateString('fr-FR') : '—'}
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile */}
          <div className="sm:hidden space-y-2">
            {displayed.map(d => {
              const sc = STATUT_CFG[d.statut]
              const nom = d.etudiants ? `${d.etudiants.nom} ${d.etudiants.prenom}` : '—'
              return (
                <div key={d.id} className="rounded-xl border px-4 py-3"
                  style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{nom}</p>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
                      style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                  </div>
                  <div className="flex gap-4 mt-1.5" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    <span>{d.credits_obtenus}/{d.credits_requis} crédits</span>
                    {d.moyenne_generale != null && <span>{d.moyenne_generale}/20</span>}
                    {d.mention && <span>{d.mention}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
