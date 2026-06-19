'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Briefcase, Loader2, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

const TYPES_CONTRAT = [
  { value: 'cdi',        label: 'CDI — Contrat à durée indéterminée' },
  { value: 'cdd',        label: 'CDD — Contrat à durée déterminée' },
  { value: 'stage',      label: 'Stage' },
  { value: 'interim',    label: "Intérim" },
  { value: 'freelance',  label: 'Freelance / Consultant' },
  { value: 'alternance', label: 'Alternance / Apprentissage' },
  { value: 'vacation',   label: 'Vacation' },
]

export default function NouvelleOffre() {
  const router = useRouter()
  const { tenantId } = useTenant()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    titre: '', description: '', localisation: '', type_contrat: 'cdi',
    nombre_postes: '1', salaire_min: '', salaire_max: '',
    date_fermeture_prevue: '', competences_requises: '',
    niveau_etudes: '', experience_requise: '',
  })

  function update(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSave() {
    if (!tenantId || !form.titre.trim()) return
    setSaving(true)
    await supabase.from('offres_emploi').insert({
      tenant_id:              tenantId,
      titre:                  form.titre.trim(),
      description:            form.description.trim() || null,
      localisation:           form.localisation.trim() || null,
      type_contrat:           form.type_contrat,
      nombre_postes:          parseInt(form.nombre_postes) || 1,
      salaire_min:            form.salaire_min ? parseFloat(form.salaire_min) : null,
      salaire_max:            form.salaire_max ? parseFloat(form.salaire_max) : null,
      date_fermeture_prevue:  form.date_fermeture_prevue || null,
      statut:                 'active',
    })
    setSaving(false)
    router.push('/dashboard/recrutement/offres')
  }

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-xs font-semibold text-[#374151] mb-1">{children}</label>
  )
  const Input = ({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) => (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
    />
  )

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-[18px] font-bold text-[#0F172A]">Nouvelle offre d&apos;emploi</h1>
          <p className="text-[11px] text-[#64748B]">Remplissez les informations du poste</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm space-y-4">

        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] flex items-center justify-center">
            <Briefcase size={15} className="text-[#F59E0B]" />
          </div>
          <p className="text-sm font-bold text-[#0F172A]">Informations du poste</p>
        </div>

        <div>
          <Label>Intitulé du poste *</Label>
          <Input value={form.titre} onChange={v => update('titre', v)} placeholder="Ex. : Comptable Senior, Développeur React..." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type de contrat</Label>
            <select
              value={form.type_contrat}
              onChange={e => update('type_contrat', e.target.value)}
              className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
            >
              {TYPES_CONTRAT.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Nombre de postes</Label>
            <Input value={form.nombre_postes} onChange={v => update('nombre_postes', v)} type="number" placeholder="1" />
          </div>
        </div>

        <div>
          <Label>Localisation</Label>
          <Input value={form.localisation} onChange={v => update('localisation', v)} placeholder="Ex. : Brazzaville, Congo" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Salaire minimum (FCFA)</Label>
            <Input value={form.salaire_min} onChange={v => update('salaire_min', v)} type="number" placeholder="Ex. : 150000" />
          </div>
          <div>
            <Label>Salaire maximum (FCFA)</Label>
            <Input value={form.salaire_max} onChange={v => update('salaire_max', v)} type="number" placeholder="Ex. : 300000" />
          </div>
        </div>

        <div>
          <Label>Date de clôture prévue</Label>
          <Input value={form.date_fermeture_prevue} onChange={v => update('date_fermeture_prevue', v)} type="date" />
        </div>

        <div>
          <Label>Description du poste</Label>
          <textarea
            value={form.description}
            onChange={e => update('description', e.target.value)}
            rows={5}
            placeholder="Décrivez les missions, responsabilités et contexte du poste..."
            className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30 resize-none"
          />
        </div>

        <div>
          <Label>Compétences requises</Label>
          <Input value={form.competences_requises} onChange={v => update('competences_requises', v)} placeholder="Ex. : Excel, SAP, Comptabilité OHADA (séparées par des virgules)" />
        </div>

      </div>

      <div className="flex gap-3 justify-end">
        <button
          onClick={() => router.back()}
          className="px-4 py-2.5 text-[13px] font-semibold text-[#64748B] bg-white border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]"
        >
          Annuler
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !form.titre.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#F59E0B] text-white rounded-xl text-[13px] font-bold hover:bg-[#D97706] disabled:opacity-50 shadow-sm transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Publier l&apos;offre
        </button>
      </div>

    </div>
  )
}
