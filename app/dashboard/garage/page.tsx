'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Wrench, RefreshCw, Plus, X, Loader2, Car, ChevronRight } from 'lucide-react'
import { STATUTS_ORDRE, type StatutOrdre } from '@/lib/garage/ordres'
import { STATUT_CFG, INPUT_CLS, LABEL_CLS, type VehiculeResume } from './_lib/ui'

interface Ordre {
  id: string; numero: string; statut: StatutOrdre; date_entree: string
  date_sortie_prevue: string | null; symptomes: string | null
  garage_vehicules: VehiculeResume | null
}
interface Vehicule { id: string; immatriculation: string; marque: string | null; modele: string | null; proprietaire_nom: string }

const INIT_FORM = { vehicule_id: '', kilometrage_entree: '', date_sortie_prevue: '', symptomes: '' }

export default function GarageAtelierPage() {
  const [ordres,    setOrdres]    = useState<Ordre[]>([])
  const [vehicules, setVehicules] = useState<Vehicule[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filtre,    setFiltre]    = useState<StatutOrdre | ''>('')
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState(INIT_FORM)
  const [saving,    setSaving]    = useState(false)
  const [erreur,    setErreur]    = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [oRes, vRes] = await Promise.all([fetch('/api/garage/ordres'), fetch('/api/garage/vehicules')])
    if (oRes.ok) setOrdres((await oRes.json()).data ?? [])
    if (vRes.ok) setVehicules((await vRes.json()).data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErreur(null)
    const res = await fetch('/api/garage/ordres', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setErreur(json.error ?? 'Création impossible'); return }
    setShowForm(false); setForm(INIT_FORM); load()
  }

  const visibles = filtre ? ordres.filter(o => o.statut === filtre) : ordres

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-amber-500" />
            <h1 className="text-[16px] font-black text-[#0F172A]">Atelier — Ordres de réparation</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/garage/vehicules"
              className="flex items-center gap-1.5 px-3 py-2 border border-[#E2E8F0] rounded-xl text-[12px] font-semibold text-[#475569] hover:bg-[#F8FAFC]">
              <Car size={12} /> Véhicules
            </Link>
            <button onClick={load} aria-label="Actualiser" className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B] hover:bg-[#F8FAFC]"><RefreshCw size={13} /></button>
            <button onClick={() => setShowForm(true)} disabled={vehicules.length === 0}
              title={vehicules.length === 0 ? 'Enregistrez d\'abord un véhicule' : undefined}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-xl text-[12px] font-bold hover:bg-amber-600 disabled:opacity-50">
              <Plus size={12} /> Nouvel OR
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-5">
          {STATUTS_ORDRE.map(s => {
            const c = STATUT_CFG[s]
            const actif = filtre === s
            return (
              <button key={s} onClick={() => setFiltre(actif ? '' : s)}
                className={`bg-white rounded-2xl p-3 border shadow-sm text-center transition ${actif ? 'border-amber-400 ring-2 ring-amber-200' : 'border-[#E2E8F0]'}`}>
                <p className="text-[22px] font-black" style={{ color: c.color }}>{ordres.filter(o => o.statut === s).length}</p>
                <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide">{c.label}</p>
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-16 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /> Chargement...</div>
        ) : visibles.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <Wrench size={36} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A]">Aucun ordre de réparation</p>
            {vehicules.length === 0 && (
              <Link href="/dashboard/garage/vehicules" className="inline-block mt-3 text-[12px] font-bold text-amber-600 hover:underline">
                Commencez par enregistrer un véhicule →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {visibles.map(o => {
              const sc = STATUT_CFG[o.statut]
              const v = o.garage_vehicules
              return (
                <Link key={o.id} href={`/dashboard/garage/ordres/${o.id}`}
                  className="flex items-center justify-between gap-3 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4 hover:border-amber-300">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[12px] font-black text-[#0F172A]">{o.numero}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                      {v && <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg">{v.immatriculation}</span>}
                    </div>
                    <p className="text-[13px] text-[#0F172A] truncate">
                      {v ? `${[v.marque, v.modele].filter(Boolean).join(' ') || 'Véhicule'} — ${v.proprietaire_nom}` : '—'}
                    </p>
                    {o.symptomes && <p className="text-[12px] text-[#64748B] truncate">{o.symptomes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-[11px] text-[#94A3B8]">
                    <span>Entrée {new Date(o.date_entree).toLocaleDateString('fr-FR')}</span>
                    <ChevronRight size={14} />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[16px] text-[#0F172A]">Nouvel ordre de réparation</h2>
              <button onClick={() => setShowForm(false)} aria-label="Fermer" className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className={LABEL_CLS}>Véhicule *</label>
                <select required value={form.vehicule_id} onChange={e => setForm(p => ({ ...p, vehicule_id: e.target.value }))} className={INPUT_CLS}>
                  <option value="">— Choisir —</option>
                  {vehicules.map(v => (
                    <option key={v.id} value={v.id}>{v.immatriculation} — {[v.marque, v.modele].filter(Boolean).join(' ')} ({v.proprietaire_nom})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Kilométrage</label>
                  <input type="number" min={0} value={form.kilometrage_entree}
                    onChange={e => setForm(p => ({ ...p, kilometrage_entree: e.target.value }))} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Sortie prévue</label>
                  <input type="date" value={form.date_sortie_prevue}
                    onChange={e => setForm(p => ({ ...p, date_sortie_prevue: e.target.value }))} className={INPUT_CLS} />
                </div>
              </div>
              <div>
                <label className={LABEL_CLS}>Symptômes / demande du client</label>
                <textarea rows={3} value={form.symptomes} onChange={e => setForm(p => ({ ...p, symptomes: e.target.value }))}
                  placeholder="Bruit au freinage, vidange..." className={`${INPUT_CLS} resize-none`} />
              </div>
              {erreur && <p className="text-[12px] text-[#DC2626]">{erreur}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B]">Annuler</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600 disabled:opacity-50">
                  {saving ? 'Création...' : 'Ouvrir l\'OR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
