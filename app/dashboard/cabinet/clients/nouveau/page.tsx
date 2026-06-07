'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, CheckCircle, Building2, User, FileText, Settings, Loader2 } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Form {
  // Étape 1 : Entreprise
  nom_entreprise: string; forme_juridique: string; secteur_activite: string
  pays: string; ville: string; adresse: string; telephone: string; email: string; site_web: string
  niu: string; rccm: string; sciet: string; scien: string; date_creation_entreprise: string
  // Étape 2 : Contact
  contact_prenom: string; contact_nom: string; contact_telephone: string; contact_email: string; contact_poste: string
  // Étape 3 : Mission
  types_mission: string[]; date_debut_mission: string; honoraires_mensuel: string
  periodicite: string; frais_oraforme: string; notes: string
  // Étape 4 : Accès
  acces_actif: boolean; statut: string
}

const INIT: Form = {
  nom_entreprise: '', forme_juridique: 'SARL', secteur_activite: '', pays: 'CG', ville: 'Brazzaville',
  adresse: '', telephone: '', email: '', site_web: '', niu: '', rccm: '', sciet: '', scien: '',
  date_creation_entreprise: '', contact_prenom: '', contact_nom: '', contact_telephone: '',
  contact_email: '', contact_poste: 'Directeur Général', types_mission: ['comptabilite'],
  date_debut_mission: new Date().toISOString().split('T')[0],
  honoraires_mensuel: '', periodicite: 'mensuel', frais_oraforme: '5000', notes: '',
  acces_actif: true, statut: 'actif',
}

const TYPES_MISSION = [
  { value: 'comptabilite', label: 'Comptabilité SYSCOHADA' },
  { value: 'paie_rh', label: 'Paie & RH' },
  { value: 'tva', label: 'Déclarations TVA' },
  { value: 'cnss', label: 'Déclarations CNSS' },
  { value: 'patente', label: 'Déclaration Patente' },
  { value: 'is', label: 'Déclaration IS' },
  { value: 'audit', label: 'Audit' },
  { value: 'conseil', label: 'Conseil fiscal' },
  { value: 'formation', label: 'Formation' },
]

const SECTEURS = [
  'Commerce','Industrie','Agriculture','BTP','Transport','Hôtellerie','Restauration',
  'TIC','Finance','Santé','Éducation','Services','Mines','Énergie','Autre',
]

const FORMES = ['SARL','SA','SNC','SCS','SASU','SAS','GIE','Association','Coopérative','EI','Autre']

// ── Composants étape ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white'

// ── Page ─────────────────────────────────────────────────────────────────────────

export default function NouveauClientPage() {
  const router = useRouter()
  const { tenant } = useTenantContext()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<Form>(INIT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof Form>(k: K, v: Form[K]) { setForm(p => ({ ...p, [k]: v })) }

  function toggleMission(v: string) {
    setForm(p => ({
      ...p,
      types_mission: p.types_mission.includes(v)
        ? p.types_mission.filter(x => x !== v)
        : [...p.types_mission, v],
    }))
  }

  async function submit() {
    if (!tenant?.tenantId) return
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/cabinet/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          honoraires_mensuel: Number(form.honoraires_mensuel) || 0,
          frais_oraforme: Number(form.frais_oraforme) || 5000,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Erreur création') }
      const { id } = await res.json()
      router.push(`/dashboard/cabinet/clients/${id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const STEPS = [
    { n: 1, label: 'Entreprise', icon: Building2 },
    { n: 2, label: 'Contact', icon: User },
    { n: 3, label: 'Mission', icon: FileText },
    { n: 4, label: 'Finaliser', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/dashboard/cabinet/clients" className="flex items-center gap-1 text-[#64748B] hover:text-[#0F172A] text-[13px]">
              <ArrowLeft size={14} /> Clients
            </Link>
            <span className="text-[#E2E8F0]">/</span>
            <span className="text-[14px] font-bold text-[#0F172A]">Nouveau client</span>
          </div>

          {/* Indicateur étapes */}
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const done = step > s.n
              const active = step === s.n
              return (
                <div key={s.n} className="flex items-center">
                  <button onClick={() => step > s.n && setStep(s.n)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${active ? 'bg-amber-100 text-amber-700' : done ? 'text-green-700 cursor-pointer hover:bg-green-50' : 'text-[#94A3B8]'}`}>
                    {done ? <CheckCircle size={13} /> : <Icon size={13} />}
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                  {i < STEPS.length - 1 && <div className={`w-6 h-px mx-0.5 ${step > s.n ? 'bg-green-300' : 'bg-[#E2E8F0]'}`} />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700 font-semibold">{error}</div>
        )}

        {/* ── Étape 1 : Informations entreprise ── */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-[16px] font-black text-[#0F172A]">Informations de l'entreprise</h2>
              <p className="text-[12px] text-[#64748B] mt-0.5">Renseignez les informations légales et de contact de l'entreprise cliente.</p>
            </div>

            <Field label="Nom de l'entreprise *">
              <input required value={form.nom_entreprise} onChange={e => set('nom_entreprise', e.target.value)}
                className={inputCls} placeholder="SARL Congo Négoce..." />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Forme juridique">
                <select value={form.forme_juridique} onChange={e => set('forme_juridique', e.target.value)} className={inputCls}>
                  {FORMES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Secteur d'activité">
                <select value={form.secteur_activite} onChange={e => set('secteur_activite', e.target.value)} className={inputCls}>
                  <option value="">— Choisir —</option>
                  {SECTEURS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Pays">
                <select value={form.pays} onChange={e => set('pays', e.target.value)} className={inputCls}>
                  {[['CG','Congo Brazzaville'],['CD','Congo Kinshasa'],['CM','Cameroun'],['GA','Gabon'],['CI','Côte d\'Ivoire'],['SN','Sénégal'],['FR','France']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Ville">
                <input value={form.ville} onChange={e => set('ville', e.target.value)} className={inputCls} placeholder="Brazzaville" />
              </Field>
            </div>

            <Field label="Adresse">
              <input value={form.adresse} onChange={e => set('adresse', e.target.value)} className={inputCls} placeholder="Av. de l'Indépendance, Centre-ville..." />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Téléphone">
                <input value={form.telephone} onChange={e => set('telephone', e.target.value)} className={inputCls} placeholder="+242 06 ..." />
              </Field>
              <Field label="Email entreprise">
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} placeholder="contact@..." />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="NIU">
                <input value={form.niu} onChange={e => set('niu', e.target.value)} className={inputCls} placeholder="M202..." />
              </Field>
              <Field label="RCCM">
                <input value={form.rccm} onChange={e => set('rccm', e.target.value)} className={inputCls} placeholder="BZV-..." />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="SCIET">
                <input value={form.sciet} onChange={e => set('sciet', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Date création">
                <input type="date" value={form.date_creation_entreprise} onChange={e => set('date_creation_entreprise', e.target.value)} className={inputCls} />
              </Field>
            </div>
          </div>
        )}

        {/* ── Étape 2 : Contact principal ── */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-[16px] font-black text-[#0F172A]">Contact principal</h2>
              <p className="text-[12px] text-[#64748B] mt-0.5">Personne référente au sein de l'entreprise cliente.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom *">
                <input required value={form.contact_prenom} onChange={e => set('contact_prenom', e.target.value)} className={inputCls} placeholder="Jean-Baptiste..." />
              </Field>
              <Field label="Nom *">
                <input required value={form.contact_nom} onChange={e => set('contact_nom', e.target.value)} className={inputCls} placeholder="MOUKOUAMOU..." />
              </Field>
            </div>

            <Field label="Poste">
              <select value={form.contact_poste} onChange={e => set('contact_poste', e.target.value)} className={inputCls}>
                {['Directeur Général','Directeur Administratif et Financier','Responsable Comptable','Gérant','Propriétaire','Secrétaire de Direction','Autre'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Téléphone direct">
                <input value={form.contact_telephone} onChange={e => set('contact_telephone', e.target.value)} className={inputCls} placeholder="+242 06 ..." />
              </Field>
              <Field label="Email direct *">
                <input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} className={inputCls} placeholder="jean@..." />
              </Field>
            </div>

            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-[12px] text-blue-700">
              <strong>Invitation portail client :</strong> Un email d'invitation sera envoyé à cette adresse pour accéder au portail client sécurisé.
            </div>
          </div>
        )}

        {/* ── Étape 3 : Mission & Honoraires ── */}
        {step === 3 && (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-[16px] font-black text-[#0F172A]">Mission & Honoraires</h2>
              <p className="text-[12px] text-[#64748B] mt-0.5">Définissez le périmètre de la mission et les conditions financières.</p>
            </div>

            <div>
              <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-2">Missions confiées *</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TYPES_MISSION.map(m => {
                  const selected = form.types_mission.includes(m.value)
                  return (
                    <button key={m.value} type="button" onClick={() => toggleMission(m.value)}
                      className={`px-2.5 py-2 rounded-xl text-[12px] font-semibold border transition-all ${selected ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-white text-[#64748B] border-[#E2E8F0] hover:bg-[#F8FAFC]'}`}>
                      {selected ? '✓ ' : ''}{m.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Date début mission">
                <input type="date" value={form.date_debut_mission} onChange={e => set('date_debut_mission', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Périodicité honoraires">
                <select value={form.periodicite} onChange={e => set('periodicite', e.target.value)} className={inputCls}>
                  {[['mensuel','Mensuel'],['trimestriel','Trimestriel'],['semestriel','Semestriel'],['annuel','Annuel']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </div>

            <Field label={`Honoraires (FCFA/${form.periodicite})`}>
              <input type="number" min="0" value={form.honoraires_mensuel} onChange={e => set('honoraires_mensuel', e.target.value)}
                className={inputCls} placeholder="150 000" />
            </Field>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-bold text-amber-800">Frais Oraforme</p>
                  <p className="text-[11px] text-amber-700">Inclus automatiquement dans vos factures</p>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" value={form.frais_oraforme} onChange={e => set('frais_oraforme', e.target.value)}
                    className="w-24 px-2 py-1.5 text-[13px] font-bold text-amber-800 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white text-right" />
                  <span className="text-[11px] font-semibold text-amber-700">FCFA/mois</span>
                </div>
              </div>
            </div>

            <Field label="Notes internes">
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
                className={inputCls + ' resize-none'} placeholder="Spécificités du dossier, contexte particulier..." />
            </Field>
          </div>
        )}

        {/* ── Étape 4 : Finaliser ── */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6">
              <h2 className="text-[16px] font-black text-[#0F172A] mb-4">Récapitulatif</h2>

              <div className="space-y-4">
                <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                  <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-2">Entreprise</p>
                  <p className="font-bold text-[14px] text-[#0F172A]">{form.nom_entreprise || '—'}</p>
                  <p className="text-[12px] text-[#64748B]">{form.forme_juridique} · {form.secteur_activite || '—'} · {form.ville}, {form.pays}</p>
                  {form.niu && <p className="text-[11px] text-[#94A3B8] mt-1">NIU: {form.niu}</p>}
                </div>

                <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                  <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-2">Contact principal</p>
                  <p className="font-bold text-[13px] text-[#0F172A]">{form.contact_prenom} {form.contact_nom} — {form.contact_poste}</p>
                  <p className="text-[12px] text-[#64748B]">{form.contact_email || '—'} · {form.contact_telephone || '—'}</p>
                </div>

                <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                  <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-2">Mission & honoraires</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {form.types_mission.map(m => (
                      <span key={m} className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[11px] font-semibold">
                        {TYPES_MISSION.find(t => t.value === m)?.label ?? m}
                      </span>
                    ))}
                  </div>
                  <p className="text-[12px] text-[#64748B]">
                    Honoraires : <strong>{form.honoraires_mensuel || 0} FCFA/{form.periodicite}</strong>
                  </p>
                  <p className="text-[12px] text-[#64748B]">Frais Oraforme : <strong>{form.frais_oraforme} FCFA/mois</strong></p>
                </div>
              </div>

              {/* Accès portail */}
              <div className="mt-4 flex items-center justify-between p-3 border border-[#E2E8F0] rounded-xl">
                <div>
                  <p className="text-[13px] font-semibold text-[#0F172A]">Accès portail client</p>
                  <p className="text-[11px] text-[#64748B]">Invitation envoyée à {form.contact_email || '—'}</p>
                </div>
                <button type="button" onClick={() => set('acces_actif', !form.acces_actif)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${form.acces_actif ? 'bg-amber-500' : 'bg-[#CBD5E1]'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.acces_actif ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Statut initial */}
              <div className="mt-3">
                <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-2">Statut initial</p>
                <div className="flex gap-2">
                  {[['actif','Actif','#16A34A'],['prospect','Prospect','#F59E0B']].map(([v,l,c]) => (
                    <button key={v} type="button" onClick={() => set('statut', v)}
                      className={`px-4 py-2 rounded-xl text-[12px] font-bold border transition-all ${form.statut === v ? 'border-transparent text-white' : 'bg-white text-[#64748B] border-[#E2E8F0]'}`}
                      style={form.statut === v ? { background: c } : {}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button onClick={() => step > 1 ? setStep(p => p - 1) : router.push('/dashboard/cabinet/clients')}
            className="flex items-center gap-2 px-4 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B] hover:bg-white">
            <ArrowLeft size={14} /> {step === 1 ? 'Annuler' : 'Précédent'}
          </button>

          {step < 4 ? (
            <button onClick={() => {
              if (step === 1 && !form.nom_entreprise.trim()) return
              setStep(p => p + 1)
            }}
              disabled={step === 1 && !form.nom_entreprise.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600 disabled:opacity-40">
              Suivant <ArrowRight size={14} />
            </button>
          ) : (
            <button onClick={submit} disabled={saving || !form.nom_entreprise.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#0F172A] text-white rounded-xl text-[13px] font-bold hover:bg-[#1E293B] disabled:opacity-40">
              {saving ? <><Loader2 size={13} className="animate-spin" /> Création...</> : <><CheckCircle size={13} /> Créer le client</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
