'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Plus, X, Loader2, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

const TYPES_CONTRAT = ['CDI', 'CDD', 'Stage', 'Alternance', 'Freelance', 'Temps partiel', 'Consultant']
const DIPLOMES = ['Sans diplôme requis', 'CAP/BEP', 'BAC', 'BTS/DUT', 'Licence', 'Master', 'MBA', 'Doctorat']

function TagInput({ label, values, onChange, placeholder }: {
  label: string
  values: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')

  function add() {
    const v = input.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setInput('')
  }

  return (
    <div>
      <label className="text-xs font-semibold text-[#64748B] mb-1.5 block">{label}</label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {values.map(v => (
            <span key={v} className="flex items-center gap-1 text-xs bg-[#FEF3C7] text-[#92400E] px-2 py-0.5 rounded-full border border-[#F59E0B]/30">
              {v}
              <button onClick={() => onChange(values.filter(x => x !== v))} className="text-[#92400E]/60 hover:text-[#DC2626] transition-colors">
                <X size={9} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder ?? 'Ajouter et appuyer Entrée...'}
          className="flex-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] outline-none focus:border-[#F59E0B]/60 transition-colors"
        />
        <button
          onClick={add}
          disabled={!input.trim()}
          className="px-3 py-1.5 bg-[#F59E0B] text-white rounded-lg text-xs font-bold disabled:opacity-40 hover:bg-[#E09000] transition-colors"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}

export default function NouvelleOffrePage() {
  const router = useRouter()
  const { tenantId, loading } = useTenant()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    titre: '',
    departement: '',
    localisation: '',
    nombre_postes: 1,
    type_contrat: '',
    salaire_min: '',
    salaire_max: '',
    date_limite: '',
    diplome_requis: '',
    experience_min: 0,
    competences_obligatoires: [] as string[],
    competences_souhaitees: [] as string[],
    langues: [] as string[],
    certifications: [] as string[],
    logiciels: [] as string[],
    description: '',
  })

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit() {
    if (!tenantId || !form.titre.trim()) return
    setSaving(true)
    const { error } = await supabase.from('offres_emploi').insert({
      tenant_id: tenantId,
      titre: form.titre.trim(),
      departement: form.departement.trim() || null,
      localisation: form.localisation.trim() || null,
      nombre_postes: form.nombre_postes,
      type_contrat: form.type_contrat || null,
      salaire_min: form.salaire_min ? Number(form.salaire_min) : null,
      salaire_max: form.salaire_max ? Number(form.salaire_max) : null,
      date_limite: form.date_limite || null,
      diplome_requis: form.diplome_requis || null,
      experience_min: form.experience_min,
      competences_obligatoires: form.competences_obligatoires,
      competences_souhaitees: form.competences_souhaitees,
      langues: form.langues,
      certifications: form.certifications,
      logiciels: form.logiciels,
      description: form.description.trim() || null,
      statut: 'active',
    })
    setSaving(false)
    if (error) { alert('Erreur création offre : ' + error.message); return }
    router.push('/dashboard/rh/recrutement/offres')
  }

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 size={28} className="text-[#F59E0B] animate-spin" />
    </div>
  )

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-[#64748B] hover:text-[#0F172A] transition-colors p-1">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-[#0F172A]">Nouvelle offre d&apos;emploi</h1>
          <p className="text-xs text-[#64748B]">Remplissez les critères pour le matching IA MIAA Job</p>
        </div>
      </div>

      {/* Section générale */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-bold text-[#0F172A] pb-2 border-b border-[#F1F5F9]">Informations générales</h2>

        <div>
          <label className="text-xs font-semibold text-[#64748B] mb-1.5 block">Intitulé du poste <span className="text-[#DC2626]">*</span></label>
          <input
            value={form.titre}
            onChange={e => set('titre', e.target.value)}
            placeholder="Ex: Directeur Financier, Développeur Full Stack..."
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#F59E0B]/60 transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-[#64748B] mb-1.5 block">Département</label>
            <input value={form.departement} onChange={e => set('departement', e.target.value)}
              placeholder="Finance, RH, IT, Direction..."
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#F59E0B]/60 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#64748B] mb-1.5 block">Localisation</label>
            <input value={form.localisation} onChange={e => set('localisation', e.target.value)}
              placeholder="Brazzaville, Pointe-Noire..."
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#F59E0B]/60 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#64748B] mb-1.5 block">Type de contrat</label>
            <select value={form.type_contrat} onChange={e => set('type_contrat', e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#F59E0B]/60 transition-colors"
            >
              <option value="">Choisir...</option>
              {TYPES_CONTRAT.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#64748B] mb-1.5 block">Nombre de postes</label>
            <input type="number" min={1} value={form.nombre_postes} onChange={e => set('nombre_postes', Number(e.target.value))}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#F59E0B]/60 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#64748B] mb-1.5 block">Salaire min (FCFA)</label>
            <input type="number" value={form.salaire_min} onChange={e => set('salaire_min', e.target.value)}
              placeholder="Ex: 300000"
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#F59E0B]/60 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#64748B] mb-1.5 block">Salaire max (FCFA)</label>
            <input type="number" value={form.salaire_max} onChange={e => set('salaire_max', e.target.value)}
              placeholder="Ex: 800000"
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#F59E0B]/60 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#64748B] mb-1.5 block">Date limite de candidature</label>
            <input type="date" value={form.date_limite} onChange={e => set('date_limite', e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#F59E0B]/60 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Critères IA */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-bold text-[#0F172A] pb-2 border-b border-[#F1F5F9]">Critères de matching IA</h2>
        <p className="text-xs text-[#64748B] -mt-2">Ces critères sont utilisés par MIAA Job pour scorer automatiquement les CVs</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-[#64748B] mb-1.5 block">Diplôme requis</label>
            <select value={form.diplome_requis} onChange={e => set('diplome_requis', e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#F59E0B]/60 transition-colors"
            >
              <option value="">Non spécifié</option>
              {DIPLOMES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#64748B] mb-1.5 block">
              Expérience minimum : <span className="text-[#F59E0B] font-bold">{form.experience_min} an{form.experience_min !== 1 ? 's' : ''}</span>
            </label>
            <input
              type="range" min={0} max={20} value={form.experience_min}
              onChange={e => set('experience_min', Number(e.target.value))}
              className="w-full accent-[#F59E0B] mt-2"
            />
            <div className="flex justify-between text-[10px] text-[#94A3B8] mt-1">
              <span>0</span><span>10</span><span>20 ans</span>
            </div>
          </div>
        </div>

        <TagInput label="Compétences obligatoires" values={form.competences_obligatoires}
          onChange={v => set('competences_obligatoires', v)}
          placeholder="Ex: Comptabilité OHADA, Excel avancé..." />

        <TagInput label="Compétences souhaitées" values={form.competences_souhaitees}
          onChange={v => set('competences_souhaitees', v)}
          placeholder="Ex: Sage Comptabilité, Power BI..." />

        <TagInput label="Langues requises" values={form.langues}
          onChange={v => set('langues', v)}
          placeholder="Ex: Français courant, Anglais professionnel..." />

        <TagInput label="Certifications valorisées" values={form.certifications}
          onChange={v => set('certifications', v)}
          placeholder="Ex: CPA, ACCA, PMP, CFA..." />

        <TagInput label="Logiciels maîtrisés" values={form.logiciels}
          onChange={v => set('logiciels', v)}
          placeholder="Ex: SAP, Sage, Microsoft 365, QuickBooks..." />
      </div>

      {/* Description */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
        <label className="text-xs font-semibold text-[#64748B] mb-1.5 block">Description du poste</label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          rows={6}
          placeholder="Décrivez les missions, responsabilités, l'environnement de travail, les avantages..."
          className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#F59E0B]/60 transition-colors resize-none"
        />
      </div>

      <div className="flex justify-end gap-3 pb-6">
        <button onClick={() => router.back()} className="px-4 py-2 text-xs text-[#64748B] hover:text-[#0F172A] transition-colors">
          Annuler
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !form.titre.trim()}
          className="flex items-center gap-2 px-6 py-2 bg-[#F59E0B] text-white rounded-lg text-xs font-bold hover:bg-[#E09000] transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {saving ? 'Création...' : 'Publier l\'offre'}
        </button>
      </div>
    </div>
  )
}
