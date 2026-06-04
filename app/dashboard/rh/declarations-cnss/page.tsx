'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  FileText, AlertTriangle, Check, Loader2, Download,
  ChevronLeft, ChevronRight, Calendar, CheckCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  calculerBulletinPaie, calculerBordereauCNSS, calculerListeNominative, fmt,
} from '@/lib/fiscal/congo-calculs'

const MOIS_LABELS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

interface Employe {
  id: string; nom: string; prenom: string; poste: string
  salaire_base: number; cnss: string; matricule: string
  situation_familiale: string; nombre_enfants: number; prime_transport: number
}

export default function DeclarationsCNSSPage() {
  const { tenantId, loading: tLoading, nomEntreprise } = useTenant()
  const now = new Date()
  const [mois,   setMois]   = useState(now.getMonth() + 1)
  const [annee,  setAnnee]  = useState(now.getFullYear())
  const [employes, setEmployes] = useState<Employe[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [toast,   setToast]   = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase.from('employes').select('*')
      .eq('tenant_id', tenantId).eq('statut', 'actif').order('nom')
    setEmployes((data ?? []) as Employe[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (!tLoading && tenantId) load() }, [tLoading, tenantId, load])

  // Calculer tous les bulletins
  const bulletins = employes.map(e => ({
    employe: e,
    calcul: calculerBulletinPaie({
      salaire_base:        e.salaire_base || 0,
      prime_transport:     e.prime_transport || 0,
      situation_familiale: (e.situation_familiale as 'celibataire' | 'marie') || 'celibataire',
      nombre_enfants:      e.nombre_enfants || 0,
    }),
  }))

  const bordereau = calculerBordereauCNSS(bulletins.map(b => b.calcul))

  // Date limite : 15 du mois suivant
  const dateLimite = new Date(annee, mois, 15)
  const estEnRetard = new Date() > dateLimite
  const joursRestants = Math.ceil((dateLimite.getTime() - Date.now()) / 86_400_000)

  async function marquerPayee() {
    if (!tenantId) return
    setSaving(true)
    const { error } = await supabase.from('declarations_cnss').upsert({
      tenant_id:    tenantId,
      periode_mois: mois,
      periode_annee: annee,
      statut:       'payee',
      date_declaration: new Date().toISOString(),
      total_a_verser: bordereau.total_a_verser,
      total_irpp:     bordereau.total_irpp,
      total_tol:      bordereau.total_tol,
    }, { onConflict: 'tenant_id,periode_mois,periode_annee' })
    setSaving(false)
    if (error) { showToast('Erreur : ' + error.message, false); return }
    showToast('Déclaration marquée comme payée ✓')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">
      <Loader2 className="animate-spin mr-2" size={18} /> Chargement...
    </div>
  )

  return (
    <div className="space-y-6 pb-12">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold ${toast.ok ? 'bg-green-600' : 'bg-red-600'} text-white`}>
          {toast.ok ? <Check size={14} /> : <AlertTriangle size={14} />} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
            <FileText size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">Déclarations CNSS</h1>
            <p className="text-xs text-[var(--text-secondary)]">Bordereau mensuel + liste nominative · Congo-Brazzaville</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl px-3 py-2">
            <button onClick={() => setMois(m => m === 1 ? 12 : m - 1)} className="p-0.5 hover:bg-gray-100 rounded"><ChevronLeft size={14} /></button>
            <span className="text-sm font-semibold text-[var(--text)] w-20 text-center">{MOIS_LABELS[mois]}</span>
            <button onClick={() => setMois(m => m === 12 ? 1 : m + 1)} className="p-0.5 hover:bg-gray-100 rounded"><ChevronRight size={14} /></button>
          </div>
          <select value={annee} onChange={e => setAnnee(Number(e.target.value))}
            className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none">
            {[now.getFullYear(), now.getFullYear() - 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Alerte délai */}
      {estEnRetard ? (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={16} className="text-red-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-700">RETARD — Déclaration CNSS {MOIS_LABELS[mois]} {annee}</p>
            <p className="text-xs text-red-600">La date limite du 15/{mois < 12 ? mois + 1 : 1}/{annee} est dépassée. Des majorations peuvent s'appliquer.</p>
          </div>
        </div>
      ) : joursRestants <= 5 ? (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <Calendar size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm font-semibold text-amber-700">
            Déclaration à soumettre dans {joursRestants} jour(s) — avant le 15/{mois < 12 ? mois + 1 : 1}/{annee}
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle size={16} className="text-green-600 shrink-0" />
          <p className="text-sm text-green-700">Date limite : <strong>15/{mois < 12 ? mois + 1 : 1}/{annee}</strong> ({joursRestants} jours restants)</p>
        </div>
      )}

      {/* Bordereau CNSS */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <p className="font-bold text-[var(--text)]">BORDEREAU DE VERSEMENT CNSS</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{nomEntreprise} · {MOIS_LABELS[mois]} {annee}</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">Officiel</span>
        </div>

        <div className="p-5 space-y-1">
          {[
            { label: 'A. Salaires bruts déclarés',                   value: bordereau.total_salaires_bruts,   bold: false },
            { label: 'B. Cotisation vieillesse (8% plafonné 1,2M)',  value: bordereau.cotisation_vieillesse_8, bold: false },
            { label: 'C. Autres régimes (12.28% plafonné 600K)',     value: bordereau.cotisation_autres_1228,  bold: false },
            { label: 'D. TUS CNSS (3% sur brut)',                    value: bordereau.tus_cnss_3pct,           bold: false },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between py-2 border-b border-[var(--border)]/50 last:border-0">
              <span className="text-sm text-[var(--text-secondary)]">{row.label}</span>
              <span className={`text-sm font-semibold text-[var(--text)]`}>{fmt(row.value)}</span>
            </div>
          ))}

          {/* TOTAL */}
          <div className="flex items-center justify-between py-3 px-4 bg-blue-600 rounded-xl mt-3">
            <span className="text-white font-bold">TOTAL À VERSER CNSS</span>
            <span className="text-white font-black text-lg">{fmt(bordereau.total_a_verser)}</span>
          </div>
        </div>

        {/* Récapitulatif fiscal */}
        <div className="px-5 pb-5">
          <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Récapitulatif fiscal à reverser au Trésor</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'IRPP total',     value: bordereau.total_irpp,   color: '#DC2626' },
              { label: 'TUS Fiscale 4.5%', value: bordereau.tus_fisc_45, color: '#7C3AED' },
              { label: 'TUS CNSS 3%',   value: bordereau.tus_cnss_3pct, color: '#2563EB' },
              { label: 'TOL total',      value: bordereau.total_tol,    color: '#64748B' },
            ].map(k => (
              <div key={k.label} className="p-3 bg-[var(--surface-alt)] rounded-xl">
                <p className="text-[10px] text-[var(--text-secondary)] mb-1">{k.label}</p>
                <p className="font-bold text-sm" style={{ color: k.color }}>{fmt(k.value)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Liste nominative */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <p className="font-bold text-[var(--text)]">LISTE NOMINATIVE DES ASSURÉS</p>
          <p className="text-xs text-[var(--text-secondary)]">{employes.length} employé(s) · {MOIS_LABELS[mois]} {annee}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--surface-alt)] text-[var(--text-secondary)]">
                {['MAT', 'Noms & Prénoms', 'Fonction', 'Brut', 'VID 8%', 'Alloc 10.03%', 'AT 2.25%', 'Part agent 4%', 'TOTAL'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-bold uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {bulletins.map(b => {
                const ln = calculerListeNominative(b.calcul.brut_imposable)
                return (
                  <tr key={b.employe.id} className="hover:bg-[var(--surface-alt)]/50 transition-colors">
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{b.employe.matricule || '—'}</td>
                    <td className="px-3 py-2 font-medium text-[var(--text)]">{b.employe.nom} {b.employe.prenom}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{b.employe.poste || '—'}</td>
                    <td className="px-3 py-2 font-medium">{fmt(ln.salaire_brut)}</td>
                    <td className="px-3 py-2">{fmt(ln.vid_8)}</td>
                    <td className="px-3 py-2">{fmt(ln.alloc_familiales)}</td>
                    <td className="px-3 py-2">{fmt(ln.at_maladie)}</td>
                    <td className="px-3 py-2">{fmt(ln.part_agent)}</td>
                    <td className="px-3 py-2 font-bold text-blue-700">{fmt(ln.total)}</td>
                  </tr>
                )
              })}
            </tbody>
            {/* Totaux */}
            <tfoot>
              <tr className="bg-blue-600 text-white">
                <td colSpan={3} className="px-3 py-2.5 font-bold">TOTAUX</td>
                {(() => {
                  const tots = bulletins.reduce((acc, b) => {
                    const ln = calculerListeNominative(b.calcul.brut_imposable)
                    return { brut: acc.brut + ln.salaire_brut, vid: acc.vid + ln.vid_8, alloc: acc.alloc + ln.alloc_familiales, at: acc.at + ln.at_maladie, part: acc.part + ln.part_agent, total: acc.total + ln.total }
                  }, { brut: 0, vid: 0, alloc: 0, at: 0, part: 0, total: 0 })
                  return [tots.brut, tots.vid, tots.alloc, tots.at, tots.part, tots.total].map((v, i) => (
                    <td key={i} className="px-3 py-2.5 font-bold">{fmt(v)}</td>
                  ))
                })()}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-[var(--border)] flex items-center gap-3 flex-wrap">
          <button
            onClick={marquerPayee}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Marquer comme payée
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] text-sm hover:bg-[var(--surface-alt)] transition-colors"
          >
            <Download size={13} /> Imprimer / PDF
          </button>
        </div>
      </div>
    </div>
  )
}
