'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import Link from 'next/link'
import {
  Truck, Plus, Search, RefreshCw, Loader2, X,
  Wrench, CheckCircle, Fuel,
  Phone, Edit3, Gauge,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Vehicule {
  id:           string
  immatriculation: string
  marque:       string
  modele:       string
  annee:        number | null
  type:         string | null
  chauffeur_id: string | null
  chauffeur_nom: string | null
  km_actuel:    number
  km_vidange:   number | null
  km_revision:  number | null
  statut:       'actif' | 'maintenance' | 'hors_service' | 'vendu'
  notes:        string | null
  created_at:   string
}

interface Chauffeur { id: string; nom: string; telephone: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUT_CFG: Record<Vehicule['statut'], { label: string; color: string; bg: string }> = {
  actif:       { label: 'En service',  color: '#16A34A', bg: '#F0FDF4' },
  maintenance: { label: 'Maintenance', color: '#D97706', bg: '#FFFBEB' },
  hors_service:{ label: 'Hors service',color: '#DC2626', bg: '#FEF2F2' },
  vendu:       { label: 'Vendu',       color: '#94A3B8', bg: '#F8FAFC' },
}

const TYPE_VEHICULE = ['Berline', 'SUV', 'Minivan', 'Bus', 'Camion', 'Moto', 'Pickup', 'Autre']

// ── Modal ─────────────────────────────────────────────────────────────────────

function ModalVehicule({
  vehicule, chauffeurs, onClose, onSaved,
}: {
  vehicule: Vehicule | null
  chauffeurs: Chauffeur[]
  onClose: () => void
  onSaved: () => void
}) {
  const { tenant } = useTenantContext()
  const [form, setForm] = useState({
    immatriculation: vehicule?.immatriculation ?? '',
    marque:          vehicule?.marque          ?? '',
    modele:          vehicule?.modele          ?? '',
    annee:           vehicule?.annee?.toString() ?? new Date().getFullYear().toString(),
    type:            vehicule?.type            ?? 'Berline',
    chauffeur_id:    vehicule?.chauffeur_id    ?? '',
    km_actuel:       vehicule?.km_actuel?.toString()    ?? '0',
    km_vidange:      vehicule?.km_vidange?.toString()   ?? '',
    km_revision:     vehicule?.km_revision?.toString()  ?? '',
    statut:          vehicule?.statut          ?? 'actif' as Vehicule['statut'],
    notes:           vehicule?.notes           ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.immatriculation || !form.marque) return
    setSaving(true)
    const data = {
      immatriculation: form.immatriculation,
      marque:          form.marque,
      modele:          form.modele,
      annee:           parseInt(form.annee) || null,
      type:            form.type || null,
      chauffeur_id:    form.chauffeur_id || null,
      chauffeur_nom:   chauffeurs.find(c => c.id === form.chauffeur_id)?.nom ?? null,
      km_actuel:       parseInt(form.km_actuel) || 0,
      km_vidange:      form.km_vidange ? parseInt(form.km_vidange) : null,
      km_revision:     form.km_revision ? parseInt(form.km_revision) : null,
      statut:          form.statut,
      notes:           form.notes || null,
    }
    if (vehicule) {
      await supabase.from('transport_vehicules').update(data).eq('id', vehicule.id).eq('tenant_id', tenant?.tenantId)
    } else {
      await supabase.from('transport_vehicules').insert({ ...data, tenant_id: tenant?.tenantId })
    }
    setSaving(false)
    onSaved()
  }

  const I = 'w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white">
          <h2 className="font-black text-[15px]">{vehicule ? 'Modifier véhicule' : 'Nouveau véhicule'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B]"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Immatriculation *</label>
            <input value={form.immatriculation} onChange={e => setForm(f => ({ ...f, immatriculation: e.target.value.toUpperCase() }))}
              className={I} placeholder="CG-1234-A" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Marque *</label>
              <input value={form.marque} onChange={e => setForm(f => ({ ...f, marque: e.target.value }))} className={I} placeholder="Toyota" />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Modèle</label>
              <input value={form.modele} onChange={e => setForm(f => ({ ...f, modele: e.target.value }))} className={I} placeholder="Corolla" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={I}>
                {TYPE_VEHICULE.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Année</label>
              <input type="number" value={form.annee} onChange={e => setForm(f => ({ ...f, annee: e.target.value }))} className={I} min={2000} max={2030} />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Chauffeur assigné</label>
            <select value={form.chauffeur_id} onChange={e => setForm(f => ({ ...f, chauffeur_id: e.target.value }))} className={I}>
              <option value="">Non assigné</option>
              {chauffeurs.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">KM actuels</label>
              <input type="number" value={form.km_actuel} onChange={e => setForm(f => ({ ...f, km_actuel: e.target.value }))} className={I} />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">KM vidange</label>
              <input type="number" value={form.km_vidange} onChange={e => setForm(f => ({ ...f, km_vidange: e.target.value }))} className={I} placeholder="20000" />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">KM révision</label>
              <input type="number" value={form.km_revision} onChange={e => setForm(f => ({ ...f, km_revision: e.target.value }))} className={I} placeholder="50000" />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Statut</label>
            <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as Vehicule['statut'] }))} className={I}>
              {Object.entries(STATUT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} className={`${I} resize-none`} />
          </div>
          <button onClick={handleSave} disabled={!form.immatriculation || !form.marque || saving}
            className="w-full py-2.5 bg-red-600 text-white rounded-xl text-[13px] font-bold hover:bg-red-700 disabled:opacity-40 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            {vehicule ? 'Enregistrer' : 'Ajouter le véhicule'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TransportFlottePage() {
  const { tenant } = useTenantContext()
  const tid = tenant?.tenantId

  const [vehicules,  setVehicules]  = useState<Vehicule[]>([])
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [filterStatut, setFilterStatut] = useState('tous')
  const [showModal,  setShowModal]  = useState(false)
  const [editVehicule, setEditVehicule] = useState<Vehicule | null>(null)

  const load = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    const [{ data: v }, { data: c }] = await Promise.all([
      supabase.from('transport_vehicules').select('*').eq('tenant_id', tid).order('created_at', { ascending: false }),
      supabase.from('chauffeurs').select('id, nom, telephone').eq('tenant_id', tid).eq('statut', 'actif'),
    ])
    setVehicules((v ?? []) as Vehicule[])
    setChauffeurs((c ?? []) as Chauffeur[])
    setLoading(false)
  }, [tid])

  useEffect(() => { load() }, [load])

  const filtered = vehicules.filter(v => {
    const q = search.toLowerCase()
    const matchQ = !q || v.immatriculation.toLowerCase().includes(q) || v.marque.toLowerCase().includes(q) || v.modele?.toLowerCase().includes(q)
    const matchS = filterStatut === 'tous' || v.statut === filterStatut
    return matchQ && matchS
  })

  const total     = vehicules.length
  const actifs    = vehicules.filter(v => v.statut === 'actif').length
  const maintenances = vehicules.filter(v => v.statut === 'maintenance').length

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">

      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/transport" className="text-[#64748B] hover:text-[#0F172A] text-[13px]">← Transport</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-red-600" />
              <h1 className="text-[16px] font-black text-[#0F172A]">Gestion de la flotte</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]"><RefreshCw size={13} /></button>
            <button onClick={() => { setEditVehicule(null); setShowModal(true) }}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl text-[13px] font-bold hover:bg-red-700">
              <Plus size={14} /> Ajouter véhicule
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total flotte',   value: total,       color: '#0F172A' },
            { label: 'En service',     value: actifs,      color: '#16A34A' },
            { label: 'Maintenance',    value: maintenances,color: '#D97706' },
            { label: 'Hors service',   value: vehicules.filter(v => v.statut === 'hors_service').length, color: '#DC2626' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
              <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide mb-1">{k.label}</p>
              <p className="text-[22px] font-black" style={{ color: k.color }}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher immat, marque..."
              className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-white" />
          </div>
          <div className="flex gap-1 bg-[#F1F5F9] rounded-xl p-1">
            {[['tous', 'Tous'], ...Object.entries(STATUT_CFG).map(([k, v]) => [k, v.label])].map(([k, label]) => (
              <button key={k} onClick={() => setFilterStatut(k)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${filterStatut === k ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B]'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Grille véhicules */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-[#94A3B8]">
            <Loader2 size={18} className="animate-spin" /> Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <Truck size={40} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A] mb-1">Aucun véhicule</p>
            <button onClick={() => { setEditVehicule(null); setShowModal(true) }}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-600 text-white rounded-xl text-[13px] font-bold">
              <Plus size={13} /> Ajouter un véhicule
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(v => {
              const sc = STATUT_CFG[v.statut]
              const alertVidange  = v.km_vidange  && v.km_actuel >= v.km_vidange - 2000
              const alertRevision = v.km_revision && v.km_actuel >= v.km_revision - 5000
              const assignedChauffeur = chauffeurs.find(c => c.id === v.chauffeur_id)

              return (
                <div key={v.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden hover:shadow-md transition-all group">
                  <div className="h-1.5" style={{ background: sc.color }} />
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                          <Truck size={18} className="text-red-600" />
                        </div>
                        <div>
                          <p className="font-black text-[14px] text-[#0F172A]">{v.immatriculation}</p>
                          <p className="text-[11px] text-[#64748B]">{v.marque} {v.modele}{v.annee ? ` · ${v.annee}` : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                        <button onClick={() => { setEditVehicule(v); setShowModal(true) }}
                          className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit3 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Chauffeur */}
                    {assignedChauffeur && (
                      <div className="flex items-center gap-2 mb-3 py-2 px-3 bg-[#F8FAFC] rounded-xl">
                        <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-[10px] font-bold text-red-700">
                          {assignedChauffeur.nom.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-[#0F172A]">{assignedChauffeur.nom}</p>
                          {assignedChauffeur.telephone && (
                            <p className="text-[10px] text-[#64748B] flex items-center gap-0.5">
                              <Phone size={9} /> {assignedChauffeur.telephone}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* KM */}
                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-[#64748B] flex items-center gap-1"><Gauge size={11} /> Kilométrage</span>
                        <span className="font-bold text-[#0F172A]">{v.km_actuel.toLocaleString('fr-FR')} km</span>
                      </div>
                      {alertVidange && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg">
                          <Fuel size={11} /> Vidange requise ({(v.km_vidange! - v.km_actuel).toLocaleString()} km)
                        </div>
                      )}
                      {alertRevision && (
                        <div className="flex items-center gap-1.5 text-[11px] text-red-700 bg-red-50 px-2.5 py-1.5 rounded-lg">
                          <Wrench size={11} /> Révision imminente ({(v.km_revision! - v.km_actuel).toLocaleString()} km)
                        </div>
                      )}
                    </div>

                    {v.type && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B] font-semibold">{v.type}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <ModalVehicule
          vehicule={editVehicule}
          chauffeurs={chauffeurs}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
