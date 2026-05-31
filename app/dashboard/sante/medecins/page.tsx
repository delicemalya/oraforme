'use client'

import { useLocale } from '@/lib/hooks/useLocale'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { Activity, Plus, X, AlertTriangle, Loader2, ChevronLeft, Phone, Mail } from 'lucide-react'
import Link from 'next/link'

interface Medecin {
  id:          string
  nom:         string
  prenom:      string
  specialite:  string
  telephone:   string | null
  email:       string | null
  numero_ordre:string | null
  actif:       boolean
  created_at:  string
}

const SPECIALITES = [
  'Médecine générale','Pédiatrie','Gynécologie','Chirurgie générale','Cardiologie',
  'Dermatologie','Neurologie','Ophtalmologie','ORL','Orthopédie','Psychiatrie',
  'Radiologie','Urologie','Pneumologie','Gastro-entérologie','Autre',
]

export default function MedecinsPage() {
  const { t } = useLocale()
  const { tenantId, loading: tenantLoading } = useTenant()
  const [medecins, setMedecins] = useState<Medecin[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [selected, setSelected] = useState<Medecin | null>(null)

  const [form, setForm] = useState({ nom: '', prenom: '', specialite: 'Médecine générale', telephone: '', email: '', numero_ordre: '' })
  function set<K extends keyof typeof form>(k: K, v: string) { setForm(p => ({ ...p, [k]: v })) }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase.from('clinique_medecins').select('*').eq('tenant_id', tenantId).eq('actif', true).order('nom').limit(200)
    setMedecins(data ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (!tenantLoading) load() }, [tenantLoading, load])

  function openNew() { setForm({ nom: '', prenom: '', specialite: 'Médecine générale', telephone: '', email: '', numero_ordre: '' }); setSelected(null); setError(''); setShowModal(true) }
  function openEdit(m: Medecin) {
    setForm({ nom: m.nom, prenom: m.prenom, specialite: m.specialite, telephone: m.telephone ?? '', email: m.email ?? '', numero_ordre: m.numero_ordre ?? '' })
    setSelected(m); setError(''); setShowModal(true)
  }

  async function handleSave() {
    if (!tenantId || !form.nom || !form.prenom) { setError('Nom et prénom obligatoires'); return }
    setSaving(true); setError('')
    const payload = { tenant_id: tenantId, ...form, telephone: form.telephone || null, email: form.email || null, numero_ordre: form.numero_ordre || null }
    if (selected) { await supabase.from('clinique_medecins').update(payload).eq('id', selected.id) }
    else { await supabase.from('clinique_medecins').insert(payload) }
    setSaving(false); setShowModal(false); load()
  }

  if (tenantLoading || loading) {
    return <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#DC2626]" /></div>
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/sante" className="p-2 rounded-xl hover:bg-white border border-[#E5E7EB]">
            <ChevronLeft size={16} className="text-[#64748B]" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2"><Activity size={18} className="text-[#D97706]" /> Médecins ({medecins.length})</h1>
            <p className="text-xs text-[#64748B]">Personnel médical & spécialistes</p>
          </div>
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-[#DC2626] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#B91C1C]">
          <Plus size={14} /> Nouveau médecin
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {medecins.length === 0 ? (
          <div className="col-span-3 bg-white rounded-2xl border border-[#E5E7EB] flex flex-col items-center justify-center py-16">
            <Activity size={32} className="text-[#CBD5E1] mb-3" />
            <p className="text-sm text-[#94A3B8]">Aucun médecin enregistré</p>
          </div>
        ) : medecins.map(m => (
          <div key={m.id} className="bg-white rounded-2xl border border-[#E5E7EB] p-5 hover:shadow-md transition-all">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-[#EFF6FF] flex items-center justify-center text-sm font-bold text-[#2563EB]">
                {m.prenom[0]}{m.nom[0]}
              </div>
              <div>
                <p className="text-sm font-bold text-[#0F172A]">Dr {m.prenom} {m.nom}</p>
                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EFF6FF] text-[#2563EB]">{m.specialite}</span>
              </div>
            </div>
            {m.telephone && <p className="text-xs text-[#64748B] flex items-center gap-1.5 mb-1"><Phone size={11} />{m.telephone}</p>}
            {m.email && <p className="text-xs text-[#64748B] flex items-center gap-1.5 mb-1"><Mail size={11} />{m.email}</p>}
            {m.numero_ordre && <p className="text-[10px] text-[#94A3B8] mt-1">N° Ordre : {m.numero_ordre}</p>}
            <div className="flex gap-2 mt-3 pt-3 border-t border-[#F1F5F9]">
              <button onClick={() => openEdit(m)} className="flex-1 text-xs text-[#2563EB] border border-[#BFDBFE] py-1.5 rounded-lg hover:bg-[#EFF6FF]">{t('common.edit')}</button>
              <button onClick={() => supabase.from('clinique_medecins').update({ actif: false }).eq('id', m.id).then(() => load())}
                className="text-xs text-[#94A3B8] border border-[#E5E7EB] px-3 py-1.5 rounded-lg hover:bg-[#F1F5F9]">{t('common.archive')}</button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-[#E5E7EB]">
              <h2 className="text-sm font-bold text-[#0F172A]">{selected ? 'Modifier' : 'Nouveau médecin'}</h2>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-3">
              {error && <div className="bg-[#FEF2F2] text-[#DC2626] text-xs px-3 py-2 rounded-xl flex items-center gap-2"><AlertTriangle size={13} />{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                {([['prenom','Prénom *'],['nom','Nom *'],['telephone','Téléphone'],['email','Email'],['numero_ordre','N° Ordre']] as const).map(([k, label]) => (
                  <div key={k} className={k === 'numero_ordre' ? 'col-span-2' : ''}>
                    <label className="text-[11px] font-semibold text-[#374151] mb-1 block">{label}</label>
                    <input value={form[k]} onChange={e => set(k, e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20" />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Spécialité *</label>
                  <select value={form.specialite} onChange={e => set('specialite', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none bg-white">
                    {SPECIALITES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-semibold text-[#64748B] border border-[#E5E7EB] rounded-xl hover:bg-[#F8FAFC]">{t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-xs font-semibold bg-[#DC2626] text-white rounded-xl hover:bg-[#B91C1C] disabled:opacity-50">
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
