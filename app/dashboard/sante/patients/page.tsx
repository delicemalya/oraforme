'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  Users, Plus, Search, X, AlertTriangle,
  User, Phone, Calendar, Droplets, FileText,
  Loader2, ChevronLeft,
} from 'lucide-react'
import Link from 'next/link'

interface Patient {
  id:              string
  numero_dossier:  string | null
  nom:             string
  prenom:          string
  date_naissance:  string | null
  sexe:            string | null
  telephone:       string | null
  email:           string | null
  adresse:         string | null
  groupe_sanguin:  string | null
  antecedents:     string | null
  allergies:       string | null
  assurance:       string | null
  numero_assurance:string | null
  actif:           boolean
  created_at:      string
}

const BLANK: Omit<Patient, 'id' | 'numero_dossier' | 'actif' | 'created_at'> = {
  nom: '', prenom: '', date_naissance: '', sexe: 'M', telephone: '', email: '',
  adresse: '', groupe_sanguin: '', antecedents: '', allergies: '', assurance: '', numero_assurance: '',
}

const GROUPES = ['A+','A-','B+','B-','AB+','AB-','O+','O-']

function age(dob: string | null): string {
  if (!dob) return '—'
  const y = Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000)
  return `${y} ans`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PatientsPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const [patients, setPatients]   = useState<Patient[]>([])
  const [loading,  setLoading]    = useState(true)
  const [search,   setSearch]     = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selected,  setSelected]  = useState<Patient | null>(null)
  const [form, setForm]           = useState({ ...BLANK })
  const [saving, setSaving]       = useState(false)
  const [error,  setError]        = useState('')

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(p => ({ ...p, [k]: v }))
  }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase
      .from('clinique_patients')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('actif', true)
      .order('created_at', { ascending: false })
      .limit(200)
    setPatients(data ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (!tenantLoading) load() }, [tenantLoading, load])

  function openNew() {
    setForm({ ...BLANK }); setSelected(null); setError(''); setShowModal(true)
  }

  function openEdit(p: Patient) {
    setForm({
      nom: p.nom, prenom: p.prenom, date_naissance: p.date_naissance ?? '',
      sexe: p.sexe ?? 'M', telephone: p.telephone ?? '', email: p.email ?? '',
      adresse: p.adresse ?? '', groupe_sanguin: p.groupe_sanguin ?? '',
      antecedents: p.antecedents ?? '', allergies: p.allergies ?? '',
      assurance: p.assurance ?? '', numero_assurance: p.numero_assurance ?? '',
    })
    setSelected(p); setError(''); setShowModal(true)
  }

  async function handleSave() {
    if (!tenantId || !form.nom.trim() || !form.prenom.trim()) {
      setError('Nom et prénom obligatoires'); return
    }
    setSaving(true); setError('')
    const payload = {
      tenant_id: tenantId,
      nom:       form.nom.trim(),
      prenom:    form.prenom.trim(),
      date_naissance:   form.date_naissance || null,
      sexe:             form.sexe || null,
      telephone:        form.telephone || null,
      email:            form.email || null,
      adresse:          form.adresse || null,
      groupe_sanguin:   form.groupe_sanguin || null,
      antecedents:      form.antecedents || null,
      allergies:        form.allergies || null,
      assurance:        form.assurance || null,
      numero_assurance: form.numero_assurance || null,
    }

    if (selected) {
      await supabase.from('clinique_patients').update(payload).eq('id', selected.id)
    } else {
      await supabase.from('clinique_patients').insert(payload)
    }
    setSaving(false); setShowModal(false); load()
  }

  async function handleArchive(id: string) {
    if (!confirm('Archiver ce patient ?')) return
    await supabase.from('clinique_patients').update({ actif: false }).eq('id', id)
    load()
  }

  const filtered = patients.filter(p =>
    !search || `${p.nom} ${p.prenom} ${p.numero_dossier ?? ''}`.toLowerCase().includes(search.toLowerCase())
  )

  if (tenantLoading || loading) {
    return <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#DC2626]" /></div>
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/sante" className="p-2 rounded-xl hover:bg-white border border-[#E5E7EB] transition-colors">
            <ChevronLeft size={16} className="text-[#64748B]" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
              <Users size={18} className="text-[#2563EB]" /> Patients ({patients.length})
            </h1>
            <p className="text-xs text-[#64748B]">Dossiers médicaux · Gestion patients</p>
          </div>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 bg-[#DC2626] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#B91C1C] transition-colors">
          <Plus size={14} /> Nouveau patient
        </button>
      </div>

      {/* Recherche */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, prénom, numéro dossier…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20" />
        </div>
      </div>

      {/* Liste */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users size={32} className="text-[#CBD5E1] mb-3" />
            <p className="text-sm text-[#94A3B8]">Aucun patient trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                  {['Dossier', 'Patient', 'Âge / Sexe', 'Contact', 'Groupe', 'Assurance', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8FAFC]">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono font-semibold text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded">
                        {p.numero_dossier ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center text-xs font-bold text-[#2563EB]">
                          {p.prenom[0]}{p.nom[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#0F172A]">{p.prenom} {p.nom}</p>
                          <p className="text-[10px] text-[#94A3B8]">Enregistré le {fmtDate(p.created_at)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-[#374151]">{age(p.date_naissance)}</p>
                      <p className="text-[10px] text-[#94A3B8]">{p.sexe === 'M' ? 'Masculin' : p.sexe === 'F' ? 'Féminin' : p.sexe ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-[#374151] flex items-center gap-1">
                        <Phone size={10} /> {p.telephone ?? '—'}
                      </p>
                      {p.email && <p className="text-[10px] text-[#94A3B8]">{p.email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {p.groupe_sanguin ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#DC2626]">
                          <Droplets size={10} /> {p.groupe_sanguin}
                        </span>
                      ) : <span className="text-xs text-[#94A3B8]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#374151]">
                      {p.assurance || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(p)}
                          className="text-xs text-[#2563EB] border border-[#BFDBFE] px-2.5 py-1 rounded-lg hover:bg-[#EFF6FF] transition-colors">
                          Modifier
                        </button>
                        <button onClick={() => handleArchive(p.id)}
                          className="text-xs text-[#94A3B8] border border-[#E5E7EB] px-2.5 py-1 rounded-lg hover:bg-[#F1F5F9] transition-colors">
                          Archiver
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#E5E7EB] sticky top-0 bg-white z-10">
              <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <User size={15} className="text-[#DC2626]" />
                {selected ? 'Modifier le patient' : 'Nouveau patient'}
              </h2>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && (
                <div className="bg-[#FEF2F2] text-[#DC2626] text-xs px-3 py-2 rounded-xl flex items-center gap-2">
                  <AlertTriangle size={13} />{error}
                </div>
              )}

              {/* Identité */}
              <div>
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2">Identité</p>
                <div className="grid grid-cols-2 gap-3">
                  {([['prenom','Prénom *','text'],['nom','Nom *','text'],['date_naissance','Date de naissance','date'],['telephone','Téléphone','text'],['email','Email','email'],['adresse','Adresse','text']] as const).map(([k, label, type]) => (
                    <div key={k} className={k === 'adresse' ? 'col-span-2' : ''}>
                      <label className="text-[11px] font-semibold text-[#374151] mb-1 block">{label}</label>
                      <input type={type} value={form[k] ?? ''} onChange={e => set(k, e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20" />
                    </div>
                  ))}
                  <div>
                    <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Sexe</label>
                    <select value={form.sexe ?? 'M'} onChange={e => set('sexe', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none bg-white">
                      <option value="M">Masculin</option>
                      <option value="F">Féminin</option>
                      <option value="autre">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Groupe sanguin</label>
                    <select value={form.groupe_sanguin ?? ''} onChange={e => set('groupe_sanguin', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none bg-white">
                      <option value="">— Non renseigné</option>
                      {GROUPES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Médical */}
              <div>
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2">Informations médicales</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Antécédents médicaux</label>
                    <textarea value={form.antecedents ?? ''} onChange={e => set('antecedents', e.target.value)} rows={2}
                      placeholder="Diabète, hypertension, chirurgies antérieures…"
                      className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none resize-none" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Allergies</label>
                    <input value={form.allergies ?? ''} onChange={e => set('allergies', e.target.value)}
                      placeholder="Pénicilline, aspirine, latex…"
                      className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20" />
                  </div>
                </div>
              </div>

              {/* Assurance */}
              <div>
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2">Assurance</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Organisme assureur</label>
                    <input value={form.assurance ?? ''} onChange={e => set('assurance', e.target.value)}
                      placeholder="CAMU, AXA, NSIA…"
                      className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#374151] mb-1 block">N° police / adhérent</label>
                    <input value={form.numero_assurance ?? ''} onChange={e => set('numero_assurance', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 pb-5">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] border border-[#E5E7EB] rounded-xl hover:bg-[#F8FAFC]">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-xs font-semibold bg-[#DC2626] text-white rounded-xl hover:bg-[#B91C1C] disabled:opacity-50">
                {saving ? 'Enregistrement…' : selected ? 'Mettre à jour' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
