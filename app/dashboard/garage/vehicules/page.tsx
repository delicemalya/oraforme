'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Car, Plus, X, Loader2, Search } from 'lucide-react'
import { CARBURANTS } from '@/lib/garage/ordres'
import { INPUT_CLS, LABEL_CLS } from '../_lib/ui'

interface Vehicule {
  id: string; immatriculation: string; marque: string | null; modele: string | null; annee: number | null
  proprietaire_nom: string; proprietaire_telephone: string | null; kilometrage: number | null; carburant: string | null
}

const INIT_FORM = {
  immatriculation: '', proprietaire_nom: '', proprietaire_telephone: '', marque: '', modele: '',
  annee: '', vin: '', couleur: '', carburant: '', kilometrage: '', notes: '',
}

export default function GarageVehiculesPage() {
  const [vehicules, setVehicules] = useState<Vehicule[]>([])
  const [loading,   setLoading]   = useState(true)
  const [recherche, setRecherche] = useState('')
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState(INIT_FORM)
  const [saving,    setSaving]    = useState(false)
  const [erreur,    setErreur]    = useState<string | null>(null)

  const load = useCallback(async (q: string) => {
    setLoading(true)
    const res = await fetch(`/api/garage/vehicules${q ? `?q=${encodeURIComponent(q)}` : ''}`)
    if (res.ok) setVehicules((await res.json()).data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(recherche.trim()), 250)
    return () => clearTimeout(t)
  }, [recherche, load])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErreur(null)
    const res = await fetch('/api/garage/vehicules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setErreur(json.error ?? 'Enregistrement impossible'); return }
    setShowForm(false); setForm(INIT_FORM); load(recherche.trim())
  }

  const champ = (cle: keyof typeof INIT_FORM, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className={LABEL_CLS}>{label}</label>
      <input value={form[cle]} onChange={e => setForm(p => ({ ...p, [cle]: e.target.value }))} className={INPUT_CLS} {...props} />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/garage" className="flex items-center gap-1 text-[#64748B] hover:text-[#0F172A] text-[13px]">
              <ArrowLeft size={14} /> Atelier
            </Link>
            <span className="text-[#E2E8F0]">/</span>
            <h1 className="text-[16px] font-black text-[#0F172A]">Véhicules</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Immatriculation, propriétaire..."
                className="pl-8 pr-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 w-56" />
            </div>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-xl text-[12px] font-bold hover:bg-amber-600">
              <Plus size={12} /> Véhicule
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex justify-center py-16 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /> Chargement...</div>
        ) : vehicules.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <Car size={36} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A]">{recherche ? 'Aucun véhicule trouvé' : 'Aucun véhicule enregistré'}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {vehicules.map(v => (
              <div key={v.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4">
                <span className="text-[12px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg">{v.immatriculation}</span>
                <p className="mt-2 font-bold text-[14px] text-[#0F172A]">
                  {[v.marque, v.modele].filter(Boolean).join(' ') || 'Véhicule'}{v.annee ? ` · ${v.annee}` : ''}
                </p>
                <p className="text-[12px] text-[#475569]">{v.proprietaire_nom}{v.proprietaire_telephone ? ` · ${v.proprietaire_telephone}` : ''}</p>
                <p className="text-[11px] text-[#94A3B8] mt-1">
                  {v.kilometrage != null ? `${new Intl.NumberFormat('fr-FR').format(v.kilometrage)} km` : 'Kilométrage inconnu'}
                  {v.carburant ? ` · ${v.carburant}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[16px] text-[#0F172A]">Nouveau véhicule</h2>
              <button onClick={() => setShowForm(false)} aria-label="Fermer" className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {champ('immatriculation', 'Immatriculation *', { required: true, placeholder: 'AB-123-CD' })}
                {champ('kilometrage', 'Kilométrage', { type: 'number', min: 0 })}
                {champ('proprietaire_nom', 'Propriétaire *', { required: true })}
                {champ('proprietaire_telephone', 'Téléphone', { type: 'tel' })}
                {champ('marque', 'Marque', { placeholder: 'Toyota' })}
                {champ('modele', 'Modèle', { placeholder: 'Hilux' })}
                {champ('annee', 'Année', { type: 'number', min: 1950, max: 2100 })}
                <div>
                  <label className={LABEL_CLS}>Carburant</label>
                  <select value={form.carburant} onChange={e => setForm(p => ({ ...p, carburant: e.target.value }))} className={INPUT_CLS}>
                    <option value="">—</option>
                    {CARBURANTS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {champ('vin', 'N° de châssis (VIN)')}
                {champ('couleur', 'Couleur')}
              </div>
              <div>
                <label className={LABEL_CLS}>Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={`${INPUT_CLS} resize-none`} />
              </div>
              {erreur && <p className="text-[12px] text-[#DC2626]">{erreur}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B]">Annuler</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600 disabled:opacity-50">
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
