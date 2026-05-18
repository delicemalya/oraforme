'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users2, Plus, Trash2, Check, Search, Phone, Mail,
  FileText, CalendarOff, Loader2, RefreshCw, DollarSign,
  UserPlus, AlertCircle, Camera, Upload, Smartphone,
  Building2, CreditCard, Shield, Clock, X, Printer,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useRoleGuard } from '@/lib/hooks/useRoleGuard'
import { writeComptaEntry, modeToAccount } from '@/lib/compta-sync-client'
import { type Enseignant, type StatutEnseignant, STATUT_ENS, fmt, Avatar, FI, KpiCard } from '../_lib/shared'
import { CreateEmployeeWizard } from './_components/CreateEmployeeWizard'
import { ProfilDrawer, type ProfilPerson, type EmployeFull, type StaffFull } from './_components/ProfilDrawer'

type SubTab = 'employes' | 'enseignants' | 'staff' | 'conges' | 'paie' | 'recrutement' | 'heures'

const SUB_TABS = [
  { id: 'employes'     as SubTab, label: 'Employés',          icon: UserPlus   },
  { id: 'enseignants'  as SubTab, label: 'Enseignants',       icon: Users2     },
  { id: 'staff'        as SubTab, label: 'Staff',             icon: AlertCircle},
  { id: 'conges'       as SubTab, label: 'Congés',            icon: CalendarOff},
  { id: 'paie'         as SubTab, label: 'Paie',              icon: DollarSign },
  { id: 'heures'       as SubTab, label: 'Heures Formateurs', icon: Clock      },
  { id: 'recrutement'  as SubTab, label: 'Recrutement',       icon: FileText   },
]

// ── Employés (dossier RH complet) ────────────────────────────────────────────

type Employe = {
  id: string; nom: string; postnom: string | null; prenom: string
  poste: string; departement: string | null; type_employe: string; statut: string
  salaire_base: number; prime_logement: number; prime_transport: number
  prime_risque: number; prime_rendement: number
  photo_url: string | null; email_pro: string | null; telephone: string | null
  date_debut_contrat: string | null; created_at: string
}

function SectionEmployes({ tenantId }: { tenantId: string }) {
  const [employes,   setEmployes]   = useState<Employe[]>([])
  const [loading,    setLoading]    = useState(false)
  const [search,     setSearch]     = useState('')
  const [showWizard, setShowWizard] = useState(false)
  const [profil,     setProfil]     = useState<ProfilPerson | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('employes').select('*').eq('tenant_id', tenantId).order('nom')
    setEmployes((data ?? []) as Employe[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const displayed = employes.filter(e => {
    const q = search.toLowerCase()
    return !q || (e.nom + ' ' + (e.postnom ?? '') + ' ' + e.prenom + ' ' + e.poste).toLowerCase().includes(q)
  })

  const kpis = [
    { label: 'Total',       value: employes.length,                                              color: '#F07900' },
    { label: 'Actifs',      value: employes.filter(e => e.statut === 'actif').length,            color: '#2EA043' },
    { label: 'Formateurs',  value: employes.filter(e => e.type_employe === 'formateur').length,  color: '#8B0073' },
    { label: 'Temporaires', value: employes.filter(e => e.type_employe === 'temporaire').length, color: '#F0A30A' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {kpis.map(k => <KpiCard key={k.label} label={k.label} value={k.value} color={k.color} />)}
      </div>

      <div className="flex items-center gap-2 justify-between">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8B949E]" />
          <input className="pl-7 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-white placeholder-[#484F58] focus:outline-none w-52"
            placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setShowWizard(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
          style={{ background: 'linear-gradient(135deg,#2EA043,#22863a)', color: '#fff' }}>
          <Plus size={13} /> Nouvel employé
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#8B949E]" size={18} /></div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 text-[#8B949E] text-xs space-y-2">
          <Users2 size={32} className="mx-auto opacity-20" />
          <p className="font-medium">Aucun employé enregistré</p>
          <p className="text-[#484F58]">Créez un dossier complet avec le formulaire intelligent multi-étapes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayed.map(e => {
            const brut = (e.salaire_base || 0) + (e.prime_logement || 0) + (e.prime_transport || 0) + (e.prime_risque || 0) + (e.prime_rendement || 0)
            const sc = e.statut === 'actif'
              ? { color: '#2EA043', bg: '#2EA04318', label: 'ACTIF' }
              : e.statut === 'suspendu'
              ? { color: '#F0A30A', bg: '#F0A30A18', label: 'SUSPENDU' }
              : { color: '#8B949E', bg: '#8B949E18', label: (e.statut ?? 'INACTIF').toUpperCase() }
            return (
              <motion.div key={e.id} layout
                className="rounded-xl border border-white/[0.07] p-5 relative flex flex-col gap-3 hover:border-white/[0.18] transition-all"
                style={{ background: 'rgba(255,255,255,0.025)' }}>

                {/* Status */}
                <span className="absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wide"
                  style={{ color: sc.color, background: sc.bg }}>{sc.label}</span>

                {/* Avatar + Nom */}
                <div className="flex flex-col items-center text-center pt-1">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/[0.1] mb-2 shrink-0">
                    {e.photo_url
                      ? <img src={e.photo_url} alt="" className="w-full h-full object-cover" />
                      : <Avatar nom={e.nom} prenom={e.prenom} photoUrl={null} size={64} />}
                  </div>
                  <p className="text-sm font-bold text-white leading-tight">{e.prenom} {e.postnom ? e.postnom + ' ' : ''}{e.nom}</p>
                  <p className="text-[11px] text-[#8B949E] mt-0.5 capitalize">{e.poste}</p>
                </div>

                {/* Département + Contrat */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06] text-center">
                  <div>
                    <p className="text-[9px] text-[#484F58] uppercase tracking-wide">Département</p>
                    <p className="text-[10px] text-white mt-0.5 truncate">{e.departement ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-[#484F58] uppercase tracking-wide">Depuis</p>
                    <p className="text-[10px] text-white mt-0.5">
                      {e.date_debut_contrat ? new Date(e.date_debut_contrat + 'T00:00:00').toLocaleDateString('fr-FR') : '—'}
                    </p>
                  </div>
                </div>

                {/* Contact + Salaire */}
                <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
                  {e.email_pro && (
                    <div className="flex items-center gap-2">
                      <Mail size={11} className="text-[#484F58] shrink-0" />
                      <p className="text-[11px] text-[#8B949E] truncate">{e.email_pro}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <DollarSign size={11} className="text-[#2EA043] shrink-0" />
                    <p className="text-[11px] font-semibold" style={{ color: '#2EA043' }}>{fmt(brut)} FCFA/mois</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1 mt-auto">
                  <span className="text-[9px] font-medium capitalize px-2 py-1 rounded-lg border border-white/[0.06] text-[#8B949E]">{e.type_employe}</span>
                  <button
                    onClick={() => setProfil({ type: 'employe', data: e as unknown as EmployeFull })}
                    className="flex-1 py-1.5 text-[11px] font-semibold rounded-lg text-white transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #F07900, #1a6fd4)' }}>
                    Voir le profil
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {showWizard && (
          <CreateEmployeeWizard tenantId={tenantId} onClose={() => setShowWizard(false)} onSuccess={load} />
        )}
        {profil && <ProfilDrawer person={profil} onClose={() => setProfil(null)} />}
      </AnimatePresence>
    </div>
  )
}

// ── Info item helper ─────────────────────────────────────────────────────────

function InfoItem({ icon: Icon, label, value, color = '#8B949E' }: { icon: React.ElementType; label: string; value: string; color?: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}18` }}>
        <Icon size={11} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-[#484F58] uppercase tracking-wider">{label}</p>
        <p className="text-xs font-medium text-white mt-0.5 break-all">{value}</p>
      </div>
    </div>
  )
}

// ── Enseignants ───────────────────────────────────────────────────────────────

const TAUX_HORAIRES = [1000,2000,3000,4000,5000,6000,7000,8000,9000,10000,11000,12000,13000,14000,15000]
const MOBILE_MONEY_TYPES = ['MTN Money', 'Airtel Money', 'Moov Money']
const BANQUES = ['BGFI Bank', 'LCB Bank', 'Banque Postale', 'UCB', 'Crédit du Congo', 'Ecobank Congo', 'Société Générale Congo', 'Autre']

const CONTRATS_ENS = ['CDI', 'CDD', 'vacataire', 'stagiaire']

const EMPTY_ENS_FORM = {
  prenom: '', nom: '', matiere: '', telephone: '', email: '',
  statut: 'actif' as StatutEnseignant,
  type_enseignant: 'employe' as 'employe' | 'prestataire',
  type_contrat: '' as string,
  salaire: '', taux_horaire: '',
  mobile_money_type: '', mobile_money_numero: '',
  banque: '', rib: '',
  numero_cnss: '',
}

function SectionEnseignants({ tenantId, enseignants, onRefresh }: {
  tenantId: string; enseignants: Enseignant[]; onRefresh: () => void
}) {
  const [showForm,     setShowForm]     = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [search,       setSearch]       = useState('')
  const [filterType,   setFilterType]   = useState<'tous' | 'employe' | 'prestataire'>('tous')
  const [selected,     setSelected]     = useState<Enseignant | null>(null)
  const [form,         setForm]         = useState(EMPTY_ENS_FORM)
  const [photoFile,    setPhotoFile]    = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [profil,       setProfil]       = useState<ProfilPerson | null>(null)

  const displayed = enseignants.filter(e => {
    const q = search.toLowerCase()
    const matchSearch = !q || (e.nom + ' ' + e.prenom + ' ' + (e.matiere ?? '')).toLowerCase().includes(q)
    const te = (e as any).type_enseignant ?? 'employe'
    const matchType = filterType === 'tous' || te === filterType
    return matchSearch && matchType
  })

  function handlePhotoChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function uploadPhoto(file: File, id: string): Promise<string | null> {
    try {
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `enseignants/${id}.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) return null
      return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
    } catch { return null }
  }

  async function save() {
    if (!form.nom.trim() || !form.prenom.trim()) return
    if (form.type_enseignant === 'prestataire' && !form.taux_horaire) return
    setSaving(true)
    const { data: ins } = await supabase.from('enseignants').insert({
      tenant_id: tenantId,
      nom: form.nom.trim(), prenom: form.prenom.trim(),
      matiere: form.matiere || null,
      telephone: form.telephone || null,
      email: form.email || null,
      statut: form.statut,
      type_enseignant: form.type_enseignant,
      type_contrat:    form.type_enseignant === 'employe' ? (form.type_contrat || null) : null,
      salaire_mensuel: form.type_enseignant === 'employe' && form.salaire ? Number(form.salaire) : null,
      taux_horaire:    form.taux_horaire ? Number(form.taux_horaire) : null,
      mobile_money_type:   form.mobile_money_type  || null,
      mobile_money_numero: form.mobile_money_numero || null,
      banque:              form.banque              || null,
      rib:                 form.rib                 || null,
      numero_cnss:         form.numero_cnss         || null,
    }).select().single()

    if (photoFile && ins) {
      const url = await uploadPhoto(photoFile, ins.id)
      if (url) await supabase.from('enseignants').update({ photo_url: url }).eq('id', ins.id)
    }

    onRefresh()
    setShowForm(false)
    setForm(EMPTY_ENS_FORM)
    setPhotoFile(null)
    setPhotoPreview(null)
    setSaving(false)
  }

  async function del(id: string) {
    await supabase.from('enseignants').delete().eq('id', id)
    if (selected?.id === id) setSelected(null)
    onRefresh()
  }

  const kpis = [
    { label: 'Total',        value: enseignants.length,                                                                  color: '#F07900' },
    { label: 'Employés',     value: enseignants.filter(e => ((e as any).type_enseignant ?? 'employe') === 'employe').length,  color: '#2EA043' },
    { label: 'Prestataires', value: enseignants.filter(e => (e as any).type_enseignant === 'prestataire').length,        color: '#F97316' },
    { label: 'En congé',     value: enseignants.filter(e => e.statut === 'conge').length,                               color: '#F0A30A' },
  ]

  const SEL = 'w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none'
  const SEC = 'text-[10px] font-semibold text-[#484F58] uppercase tracking-wider mb-2 mt-1'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {kpis.map(k => <KpiCard key={k.label} label={k.label} value={k.value} color={k.color} />)}
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-1">
            {([['tous', 'Tous'], ['employe', 'Employés'], ['prestataire', 'Prestataires']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFilterType(k)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{ background: filterType === k ? (k === 'prestataire' ? '#F97316' : '#2EA043') : 'transparent',
                         color: filterType === k ? '#fff' : '#8B949E' }}>
                {l}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8B949E]" />
            <input className="pl-7 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-white placeholder-[#484F58] focus:outline-none w-44" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: 'linear-gradient(135deg,#2EA043,#22863a)', color: '#fff' }}>
          <Plus size={13} /> Ajouter
        </button>
      </div>

      {/* ── Form ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-[#2EA043]/30 p-5 space-y-4"
            style={{ background: 'rgba(46,160,67,0.04)' }}>

            <p className="text-sm font-bold text-[#2EA043]">Nouvel enseignant / formateur</p>

            {/* Type : Employé ou Prestataire */}
            <div>
              <p className={SEC}>Type de relation</p>
              <div className="flex gap-2">
                {([['employe', 'Enseignant Employé', 'CDI/CDD/Vacataire/Stagiaire — paie mensuelle', '#2EA043'],
                   ['prestataire', 'Prestataire', 'Payé à l\'heure via Trésorerie', '#F97316']] as const).map(([val, label, desc, color]) => (
                  <button key={val} type="button" onClick={() => setForm(p => ({ ...p, type_enseignant: val, type_contrat: '', salaire: '' }))}
                    className="flex-1 rounded-xl border p-3 text-left transition-all"
                    style={{ borderColor: form.type_enseignant === val ? color : 'rgba(255,255,255,0.08)',
                             background: form.type_enseignant === val ? `${color}12` : 'transparent' }}>
                    <p className="text-xs font-bold" style={{ color: form.type_enseignant === val ? color : '#8B949E' }}>{label}</p>
                    <p className="text-[10px] text-[#484F58] mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Photo */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/[0.08] bg-white/[0.04] flex items-center justify-center shrink-0">
                {photoPreview
                  ? <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                  : <Camera size={22} className="text-[#484F58]" />}
              </div>
              <div>
                <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.08] text-xs text-[#8B949E] hover:text-white hover:border-white/[0.15] transition-all">
                  <Upload size={12} />
                  {photoPreview ? 'Changer' : 'Ajouter une photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
                <p className="text-[10px] text-[#484F58] mt-1">JPG, PNG · max 2 Mo</p>
              </div>
            </div>

            {/* Identité */}
            <div>
              <p className={SEC}>Identité</p>
              <div className="grid grid-cols-2 gap-3">
                <FI label="Prénom *"          value={form.prenom}  onChange={v => setForm(p => ({ ...p, prenom: v }))} />
                <FI label="Nom *"             value={form.nom}     onChange={v => setForm(p => ({ ...p, nom: v }))} />
                <FI label="Matière enseignée" value={form.matiere} onChange={v => setForm(p => ({ ...p, matiere: v }))} placeholder="Mathématiques…" />
                <div>
                  <label className="block text-xs text-[#8B949E] mb-1">Statut</label>
                  <select value={form.statut} onChange={e => setForm(p => ({ ...p, statut: e.target.value as StatutEnseignant }))} className={SEL}>
                    <option value="actif">Actif</option>
                    <option value="conge">En congé</option>
                    <option value="inactif">Inactif</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div>
              <p className={SEC}>Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <FI label="Téléphone" value={form.telephone} onChange={v => setForm(p => ({ ...p, telephone: v }))} />
                <FI label="Email"     value={form.email}     onChange={v => setForm(p => ({ ...p, email: v }))} />
              </div>
            </div>

            {/* Rémunération — varie selon le type */}
            <div>
              <p className={SEC}>Rémunération</p>
              {form.type_enseignant === 'employe' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#8B949E] mb-1">Type de contrat</label>
                    <select value={form.type_contrat} onChange={e => setForm(p => ({ ...p, type_contrat: e.target.value }))} className={SEL}>
                      <option value="">— Choisir —</option>
                      {CONTRATS_ENS.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <FI label="Salaire mensuel (FCFA)" value={form.salaire} onChange={v => setForm(p => ({ ...p, salaire: v }))} type="number" placeholder="0" />
                  <div>
                    <label className="block text-xs text-[#8B949E] mb-1">Taux horaire (optionnel)</label>
                    <select value={form.taux_horaire} onChange={e => setForm(p => ({ ...p, taux_horaire: e.target.value }))} className={SEL}>
                      <option value="">— Non rémunéré à l&apos;heure —</option>
                      {TAUX_HORAIRES.map(t => <option key={t} value={t}>{new Intl.NumberFormat('fr-FR').format(t)} FCFA/h</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#8B949E] mb-1">Taux horaire (FCFA/h) *</label>
                    <select value={form.taux_horaire} onChange={e => setForm(p => ({ ...p, taux_horaire: e.target.value }))} className={SEL}>
                      <option value="">— Obligatoire —</option>
                      {TAUX_HORAIRES.map(t => <option key={t} value={t}>{new Intl.NumberFormat('fr-FR').format(t)} FCFA/h</option>)}
                    </select>
                  </div>
                  <div className="flex items-end pb-1">
                    <p className="text-[11px] text-[#F97316] bg-[#F97316]/10 rounded-lg px-3 py-2">
                      Payé via Trésorerie → Prestataire
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Money */}
            <div>
              <p className={SEC}>Mobile Money</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#8B949E] mb-1">Opérateur</label>
                  <select value={form.mobile_money_type} onChange={e => setForm(p => ({ ...p, mobile_money_type: e.target.value }))} className={SEL}>
                    <option value="">— Aucun —</option>
                    {MOBILE_MONEY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <FI label="Numéro" value={form.mobile_money_numero} onChange={v => setForm(p => ({ ...p, mobile_money_numero: v }))} placeholder="06XXXXXXXX" />
              </div>
            </div>

            {/* Banque & RIB */}
            <div>
              <p className={SEC}>Informations bancaires</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#8B949E] mb-1">Banque</label>
                  <select value={form.banque} onChange={e => setForm(p => ({ ...p, banque: e.target.value }))} className={SEL}>
                    <option value="">— Aucune —</option>
                    {BANQUES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <FI label="RIB" value={form.rib} onChange={v => setForm(p => ({ ...p, rib: v }))} placeholder="00000 00000 0000000000 00" />
              </div>
            </div>

            {/* CNSS */}
            <div>
              <p className={SEC}>Protection sociale</p>
              <div className="grid grid-cols-2 gap-3">
                <FI label="Numéro CNSS" value={form.numero_cnss} onChange={v => setForm(p => ({ ...p, numero_cnss: v }))} placeholder="XXXXXXXXXX" />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={save} disabled={saving || !form.nom || !form.prenom} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#2EA043', color: '#fff' }}>
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} Enregistrer
              </button>
              <button onClick={() => { setShowForm(false); setForm(EMPTY_ENS_FORM); setPhotoFile(null); setPhotoPreview(null) }} className="px-4 py-2 rounded-lg text-xs text-[#8B949E] border border-white/[0.06]">Annuler</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Grille de cartes Enseignants ──────────────────────────────────── */}
      {displayed.length === 0 ? (
        <div className="text-center py-12 text-[#8B949E] text-xs">Aucun enseignant enregistré.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayed.map(e => {
            const s = STATUT_ENS[e.statut] ?? STATUT_ENS.actif
            const te = (e as any).type_enseignant ?? 'employe'
            const isPresta = te === 'prestataire'
            const tc = (e as any).type_contrat as string | null
            return (
              <motion.div key={e.id} layout
                className="rounded-xl border p-5 relative flex flex-col gap-3 transition-all"
                style={{
                  background: isPresta ? 'rgba(249,115,22,0.04)' : 'rgba(255,255,255,0.025)',
                  borderColor: isPresta ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.07)',
                }}>

                {/* Type badge */}
                <span className="absolute top-3 left-3 text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wide uppercase"
                  style={isPresta
                    ? { color: '#F97316', background: 'rgba(249,115,22,0.15)' }
                    : { color: '#F07900', background: 'rgba(56,139,253,0.12)' }}>
                  {isPresta ? 'Prestataire' : tc ? tc.toUpperCase() : 'Employé'}
                </span>

                {/* Status badge */}
                <span className="absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wide uppercase"
                  style={{ color: s.color, background: s.bg }}>{s.label}</span>

                {/* Avatar + Nom */}
                <div className="flex flex-col items-center text-center pt-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 mb-2 shrink-0"
                    style={{ borderColor: isPresta ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.1)' }}>
                    {e.photo_url
                      ? <img src={e.photo_url} alt="" className="w-full h-full object-cover" />
                      : <Avatar nom={e.nom} prenom={e.prenom} photoUrl={null} size={64} />}
                  </div>
                  <p className="text-sm font-bold text-white leading-tight">{e.prenom} {e.nom}</p>
                  <p className="text-[11px] text-[#8B949E] mt-0.5">{e.matiere ?? 'Matière non définie'}</p>
                </div>

                {/* Rémunération */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06] text-center">
                  {isPresta ? (
                    <div className="col-span-2">
                      <p className="text-[9px] text-[#484F58] uppercase tracking-wide">Taux horaire</p>
                      <p className="text-sm mt-0.5 font-bold" style={{ color: '#F97316' }}>
                        {e.taux_horaire ? `${fmt(e.taux_horaire)} FCFA/h` : '—'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-[9px] text-[#484F58] uppercase tracking-wide">Mensuel</p>
                        <p className="text-[10px] mt-0.5 font-semibold" style={{ color: '#2EA043' }}>
                          {e.salaire_mensuel ? `${fmt(e.salaire_mensuel)} F` : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[#484F58] uppercase tracking-wide">Horaire</p>
                        <p className="text-[10px] mt-0.5 font-semibold" style={{ color: '#F07900' }}>
                          {e.taux_horaire ? `${fmt(e.taux_horaire)} F/h` : '—'}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Contact */}
                <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <Mail size={11} className="text-[#484F58] shrink-0" />
                    <p className="text-[11px] text-[#8B949E] truncate">{e.email ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={11} className="text-[#484F58] shrink-0" />
                    <p className="text-[11px] text-[#8B949E]">{e.telephone ?? '—'}</p>
                  </div>
                  {e.mobile_money_type && e.mobile_money_numero && (
                    <div className="flex items-center gap-2">
                      <Smartphone size={11} className="shrink-0" style={{ color: '#F97316' }} />
                      <p className="text-[11px] truncate" style={{ color: '#F97316' }}>{e.mobile_money_type} · {e.mobile_money_numero}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1 mt-auto">
                  <button onClick={() => del(e.id)}
                    className="p-2 rounded-lg border border-white/[0.06] text-[#484F58] hover:text-red-400 hover:border-red-400/30 transition-all"
                    title="Supprimer">
                    <Trash2 size={12} />
                  </button>
                  <button
                    onClick={() => setProfil({ type: 'enseignant', data: e })}
                    className="flex-1 py-1.5 text-[11px] font-semibold rounded-lg text-white transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #F07900, #1a6fd4)' }}>
                    Voir le profil
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {profil && <ProfilDrawer person={profil} onClose={() => { setProfil(null); setSelected(null) }} />}
      </AnimatePresence>
    </div>
  )
}

// ── Staff ─────────────────────────────────────────────────────────────────────

type StaffAgent = {
  id: string; nom: string; prenom: string; poste: string
  telephone: string | null; email: string | null; salaire: number
  statut: string; created_at: string
  photo_url: string | null
  mobile_money_type: string | null; mobile_money_numero: string | null
  banque: string | null; rib: string | null; numero_cnss: string | null
}

const EMPTY_STAFF = {
  prenom: '', nom: '', poste: '', telephone: '', email: '', salaire: '', statut: 'actif',
  mobile_money_type: '', mobile_money_numero: '', banque: '', rib: '', numero_cnss: '',
}

function SectionStaff({ tenantId }: { tenantId: string }) {
  const [staff,        setStaff]        = useState<StaffAgent[]>([])
  const [showForm,     setShowForm]     = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [search,       setSearch]       = useState('')
  const [selected,     setSelected]     = useState<StaffAgent | null>(null)
  const [photoFile,    setPhotoFile]    = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [form,         setForm]         = useState(EMPTY_STAFF)
  const [profil,       setProfil]       = useState<ProfilPerson | null>(null)

  const POSTES = [
    'Promoteur / Fondateur',
    'Directeur Général',
    'Directeur Général Adjoint',
    'RAF — Responsable Administratif et Financier',
    'DAAC — Dir. des Affaires Académiques et Culturelles',
    'Directeur Pédagogique',
    'Directeur des Études',
    'Secrétaire Général',
    'Secrétaire de Direction',
    'Responsable RH',
    'Comptable',
    'Agent Administratif',
    'Autre',
  ]
  const SEL = 'w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none'
  const SEC = 'text-[10px] font-semibold text-[#484F58] uppercase tracking-wider mb-2 mt-1'

  const load = useCallback(async () => {
    const { data } = await supabase.from('staff_ecole').select('*').eq('tenant_id', tenantId).order('nom')
    setStaff((data ?? []) as StaffAgent[])
  }, [tenantId])

  useEffect(() => { load() }, [load])

  function handlePhotoChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function uploadStaffPhoto(file: File, id: string): Promise<string | null> {
    try {
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `staff/${id}.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) return null
      return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
    } catch { return null }
  }

  async function save() {
    if (!form.nom.trim() || !form.poste) return
    setSaving(true)
    const { data: ins } = await supabase.from('staff_ecole').insert({
      tenant_id: tenantId,
      nom: form.nom.trim(), prenom: form.prenom.trim(),
      poste: form.poste,
      telephone:           form.telephone            || null,
      email:               form.email                || null,
      salaire:             Number(form.salaire)      || 0,
      statut:              form.statut,
      mobile_money_type:   form.mobile_money_type    || null,
      mobile_money_numero: form.mobile_money_numero  || null,
      banque:              form.banque               || null,
      rib:                 form.rib                  || null,
      numero_cnss:         form.numero_cnss          || null,
    }).select().single()

    if (photoFile && ins) {
      const url = await uploadStaffPhoto(photoFile, ins.id)
      if (url) await supabase.from('staff_ecole').update({ photo_url: url }).eq('id', ins.id)
    }

    load(); setShowForm(false); setForm(EMPTY_STAFF)
    setPhotoFile(null); setPhotoPreview(null); setSaving(false)
  }

  async function del(id: string) {
    await supabase.from('staff_ecole').delete().eq('id', id)
    if (selected?.id === id) setSelected(null)
    load()
  }

  const displayed = staff.filter(s => {
    const q = search.toLowerCase()
    return !q || (s.nom + ' ' + s.prenom + ' ' + s.poste).toLowerCase().includes(q)
  })

  const kpis = [
    { label: 'Total',    value: staff.length,                                    color: '#F07900' },
    { label: 'Actifs',   value: staff.filter(s => s.statut === 'actif').length,  color: '#2EA043' },
    { label: 'Inactifs', value: staff.filter(s => s.statut === 'inactif').length,color: '#8B949E' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {kpis.map(k => <KpiCard key={k.label} label={k.label} value={k.value} color={k.color} />)}
      </div>

      <div className="flex items-center gap-2 justify-between">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8B949E]" />
          <input className="pl-7 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-white placeholder-[#484F58] focus:outline-none w-52" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: 'linear-gradient(135deg,#2EA043,#22863a)', color: '#fff' }}>
          <Plus size={13} /> Ajouter un agent
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-[#2EA043]/30 p-5 space-y-4"
            style={{ background: 'rgba(46,160,67,0.04)' }}>

            <p className="text-sm font-bold text-[#2EA043]">Nouvel agent</p>

            {/* Photo */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/[0.08] bg-white/[0.04] flex items-center justify-center shrink-0">
                {photoPreview
                  ? <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                  : <Camera size={22} className="text-[#484F58]" />}
              </div>
              <div>
                <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.08] text-xs text-[#8B949E] hover:text-white hover:border-white/[0.15] transition-all">
                  <Upload size={12} />
                  {photoPreview ? 'Changer' : 'Ajouter une photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
                <p className="text-[10px] text-[#484F58] mt-1">JPG, PNG · max 2 Mo</p>
              </div>
            </div>

            {/* Identité */}
            <div>
              <p className={SEC}>Identité</p>
              <div className="grid grid-cols-2 gap-3">
                <FI label="Prénom" value={form.prenom} onChange={v => setForm(p => ({ ...p, prenom: v }))} />
                <FI label="Nom *"  value={form.nom}    onChange={v => setForm(p => ({ ...p, nom: v }))} />
                <div>
                  <label className="block text-xs text-[#8B949E] mb-1">Poste *</label>
                  <select value={form.poste} onChange={e => setForm(p => ({ ...p, poste: e.target.value }))} className={SEL}>
                    <option value="">— Choisir —</option>
                    {POSTES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#8B949E] mb-1">Statut</label>
                  <select value={form.statut} onChange={e => setForm(p => ({ ...p, statut: e.target.value }))} className={SEL}>
                    <option value="actif">Actif</option>
                    <option value="inactif">Inactif</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div>
              <p className={SEC}>Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <FI label="Téléphone" value={form.telephone} onChange={v => setForm(p => ({ ...p, telephone: v }))} />
                <FI label="Email"     value={form.email}     onChange={v => setForm(p => ({ ...p, email: v }))} />
              </div>
            </div>

            {/* Rémunération — salaire mensuel uniquement (pas de taux horaire pour le staff) */}
            <div>
              <p className={SEC}>Rémunération</p>
              <div className="grid grid-cols-2 gap-3">
                <FI label="Salaire mensuel (FCFA)" value={form.salaire} onChange={v => setForm(p => ({ ...p, salaire: v }))} type="number" placeholder="0" />
              </div>
            </div>

            {/* Mobile Money */}
            <div>
              <p className={SEC}>Mobile Money</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#8B949E] mb-1">Opérateur</label>
                  <select value={form.mobile_money_type} onChange={e => setForm(p => ({ ...p, mobile_money_type: e.target.value }))} className={SEL}>
                    <option value="">— Aucun —</option>
                    {MOBILE_MONEY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <FI label="Numéro" value={form.mobile_money_numero} onChange={v => setForm(p => ({ ...p, mobile_money_numero: v }))} placeholder="06XXXXXXXX" />
              </div>
            </div>

            {/* Banque & RIB */}
            <div>
              <p className={SEC}>Informations bancaires</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#8B949E] mb-1">Banque</label>
                  <select value={form.banque} onChange={e => setForm(p => ({ ...p, banque: e.target.value }))} className={SEL}>
                    <option value="">— Aucune —</option>
                    {BANQUES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <FI label="RIB" value={form.rib} onChange={v => setForm(p => ({ ...p, rib: v }))} placeholder="00000 00000 0000000000 00" />
              </div>
            </div>

            {/* CNSS */}
            <div>
              <p className={SEC}>Protection sociale</p>
              <div className="grid grid-cols-2 gap-3">
                <FI label="Numéro CNSS" value={form.numero_cnss} onChange={v => setForm(p => ({ ...p, numero_cnss: v }))} placeholder="XXXXXXXXXX" />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={save} disabled={saving || !form.nom || !form.poste} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#2EA043', color: '#fff' }}>
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} Enregistrer
              </button>
              <button onClick={() => { setShowForm(false); setForm(EMPTY_STAFF); setPhotoFile(null); setPhotoPreview(null) }} className="px-4 py-2 rounded-lg text-xs text-[#8B949E] border border-white/[0.06]">Annuler</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Grille de cartes Staff ────────────────────────────────────────── */}
      {displayed.length === 0 ? (
        <div className="text-center py-12 text-[#8B949E] text-xs">Aucun agent enregistré.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayed.map(s => {
            const sc = s.statut === 'actif'
              ? { color: '#2EA043', bg: '#2EA04318', label: 'ACTIF' }
              : { color: '#8B949E', bg: '#8B949E18', label: 'INACTIF' }
            return (
              <motion.div key={s.id} layout
                className="rounded-xl border border-white/[0.07] p-5 relative flex flex-col gap-3 hover:border-white/[0.18] transition-all"
                style={{ background: 'rgba(255,255,255,0.025)' }}>

                {/* Status badge */}
                <span className="absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wide"
                  style={{ color: sc.color, background: sc.bg }}>{sc.label}</span>

                {/* Avatar + Nom */}
                <div className="flex flex-col items-center text-center pt-1">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/[0.1] mb-2 shrink-0">
                    {s.photo_url
                      ? <img src={s.photo_url} alt="" className="w-full h-full object-cover" />
                      : <Avatar nom={s.nom} prenom={s.prenom || '?'} photoUrl={null} size={64} />}
                  </div>
                  <p className="text-sm font-bold text-white leading-tight">{s.prenom} {s.nom}</p>
                  <p className="text-[11px] text-[#8B949E] mt-0.5">{s.poste}</p>
                </div>

                {/* Salaire */}
                <div className="pt-2 border-t border-white/[0.06] text-center">
                  <p className="text-[9px] text-[#484F58] uppercase tracking-wide">Salaire mensuel</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: '#2EA043' }}>{fmt(s.salaire)} FCFA</p>
                </div>

                {/* Contact */}
                <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <Mail size={11} className="text-[#484F58] shrink-0" />
                    <p className="text-[11px] text-[#8B949E] truncate">{s.email ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={11} className="text-[#484F58] shrink-0" />
                    <p className="text-[11px] text-[#8B949E]">{s.telephone ?? '—'}</p>
                  </div>
                  {s.mobile_money_type && s.mobile_money_numero && (
                    <div className="flex items-center gap-2">
                      <Smartphone size={11} className="shrink-0" style={{ color: '#F97316' }} />
                      <p className="text-[11px] truncate" style={{ color: '#F97316' }}>{s.mobile_money_type} · {s.mobile_money_numero}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1 mt-auto">
                  <button onClick={() => del(s.id)}
                    className="p-2 rounded-lg border border-white/[0.06] text-[#484F58] hover:text-red-400 hover:border-red-400/30 transition-all"
                    title="Supprimer">
                    <Trash2 size={12} />
                  </button>
                  <button
                    onClick={() => setProfil({ type: 'staff', data: s as unknown as StaffFull })}
                    className="flex-1 py-1.5 text-[11px] font-semibold rounded-lg text-white transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #F07900, #1a6fd4)' }}>
                    Voir le profil
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {profil && <ProfilDrawer person={profil} onClose={() => { setProfil(null); setSelected(null) }} />}
      </AnimatePresence>
    </div>
  )
}

// ── Congés ────────────────────────────────────────────────────────────────────

function SectionConges({ tenantId, enseignants }: { tenantId: string; enseignants: Enseignant[] }) {
  const [conges, setConges] = useState<{ id: string; employe_id: string; type_conge: string; date_debut: string; date_fin: string; statut: string; motif: string | null; created_at: string }[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({ employe_id: '', type_conge: 'annuel', date_debut: '', date_fin: '', motif: '' })

  const load = useCallback(async () => {
    const { data } = await supabase.from('conges_ecole').select('*').eq('tenant_id', tenantId).order('date_debut', { ascending: false })
    setConges((data ?? []) as typeof conges)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function add() {
    if (!form.employe_id || !form.date_debut || !form.date_fin) return
    setSaving(true)
    await supabase.from('conges_ecole').insert({ tenant_id: tenantId, employe_id: form.employe_id, type_conge: form.type_conge, date_debut: form.date_debut, date_fin: form.date_fin, statut: 'en_attente', motif: form.motif || null })
    setForm({ employe_id: '', type_conge: 'annuel', date_debut: '', date_fin: '', motif: '' })
    setShowForm(false); load(); setSaving(false)
  }

  async function updateStatut(id: string, statut: string) {
    await supabase.from('conges_ecole').update({ statut }).eq('id', id)
    setConges(p => p.map(c => c.id === id ? { ...c, statut } : c))
  }

  const STATUT_COLORS: Record<string, { color: string; bg: string }> = {
    en_attente: { color: '#F0A30A', bg: '#F0A30A18' },
    approuve:   { color: '#2EA043', bg: '#2EA04318' },
    refuse:     { color: '#F01F38', bg: '#F01F3818' },
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: 'linear-gradient(135deg,#F0A30A,#d4880a)', color: '#0D1117' }}>
          <Plus size={13} /> Demande de congé
        </button>
      </div>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-xl border border-[#F0A30A]/30 p-4 space-y-3" style={{ background: 'rgba(240,163,10,0.04)' }}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#8B949E] mb-1">Employé *</label>
                <select value={form.employe_id} onChange={e => setForm(p => ({ ...p, employe_id: e.target.value }))} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none">
                  <option value="">— Choisir —</option>
                  {enseignants.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#8B949E] mb-1">Type</label>
                <select value={form.type_conge} onChange={e => setForm(p => ({ ...p, type_conge: e.target.value }))} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none">
                  {['annuel', 'maladie', 'maternite', 'paternite', 'sans_solde'].map(t => <option key={t} value={t} className="capitalize">{t.replace('_', ' ')}</option>)}
                </select>
              </div>
              <FI label="Date début *" value={form.date_debut} onChange={v => setForm(p => ({ ...p, date_debut: v }))} type="date" />
              <FI label="Date fin *"   value={form.date_fin}   onChange={v => setForm(p => ({ ...p, date_fin: v }))}   type="date" />
              <div className="col-span-2">
                <FI label="Motif" value={form.motif} onChange={v => setForm(p => ({ ...p, motif: v }))} placeholder="Raison du congé…" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={add} disabled={saving || !form.employe_id || !form.date_debut || !form.date_fin} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#F0A30A', color: '#0D1117' }}>
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} Soumettre
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-[#8B949E] border border-white/[0.06]">Annuler</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {conges.length === 0 ? (
        <div className="text-center py-12 text-[#8B949E] text-xs">Aucune demande de congé.</div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr style={{ background: 'rgba(255,255,255,0.02)' }}>{['Employé', 'Type', 'Période', 'Motif', 'Statut', 'Actions'].map(h => <th key={h} className="text-left px-4 py-2.5 text-[10px] text-[#8B949E]">{h}</th>)}</tr></thead>
            <tbody>
              {conges.map(c => {
                const ens = enseignants.find(e => e.id === c.employe_id)
                const sc  = STATUT_COLORS[c.statut] ?? STATUT_COLORS.en_attente
                return (
                  <tr key={c.id} className="border-t border-white/[0.04]">
                    <td className="px-4 py-2.5 text-white">{ens ? `${ens.prenom} ${ens.nom}` : '—'}</td>
                    <td className="px-4 py-2.5 text-[#8B949E] capitalize">{c.type_conge.replace('_', ' ')}</td>
                    <td className="px-4 py-2.5 text-[#8B949E]">{new Date(c.date_debut + 'T00:00:00').toLocaleDateString('fr-FR')} → {new Date(c.date_fin + 'T00:00:00').toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-2.5 text-[#8B949E]">{c.motif ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: sc.color, background: sc.bg }}>{c.statut.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {c.statut === 'en_attente' && (
                        <div className="flex gap-1">
                          <button onClick={() => updateStatut(c.id, 'approuve')} className="px-2 py-1 rounded text-[10px] font-semibold" style={{ background: '#2EA04318', color: '#2EA043' }}>Approuver</button>
                          <button onClick={() => updateStatut(c.id, 'refuse')}   className="px-2 py-1 rounded text-[10px] font-semibold" style={{ background: '#F01F3818', color: '#F01F38' }}>Refuser</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Bulletin HTML generator ───────────────────────────────────────────────────

function buildBulletinHTML(opts: {
  employe: string; poste: string; cnss: string; periode: string
  salaire_base: number; primes: number; retenues: number; net: number
  prime_logement?: number; prime_transport?: number
  prime_risque?: number; prime_rendement?: number
  nomEcole: string; logoUrl: string
  mode_paiement?: string; date_recrutement?: string
}) {
  const {
    employe, poste, cnss, periode, salaire_base, primes, retenues, net,
    prime_logement = 0, prime_transport = 0, prime_risque = 0, prime_rendement = 0,
    nomEcole, logoUrl, mode_paiement = 'virement', date_recrutement,
  } = opts
  const fmtN    = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))
  const pdfName = `bulletin_${employe.replace(/\s+/g, '_')}_${periode.replace(/\s+/g, '_')}.pdf`
  const brut  = salaire_base + primes
  const cnss_sal   = Math.round(brut * 0.04)
  const irpp       = retenues - cnss_sal > 0 ? retenues - cnss_sal : 0
  const cnss_pf    = Math.round(brut * 0.08)
  const cnss_at    = Math.round(brut * 0.1228)
  const tus        = Math.round(brut * 0.075)
  const tol        = 1000
  const pat_total  = cnss_pf + cnss_at + tus + tol
  const today      = new Date().toLocaleDateString('fr-FR')
  const modeLabel  = mode_paiement.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())

  let rowIdx = 2
  const primeRows = [
    prime_logement  > 0 ? `<tr><td>${String(rowIdx++).padStart(2,'0')}</td><td>Prime de logement</td><td>—</td><td class="gain">${fmtN(prime_logement)}</td><td>—</td></tr>`  : '',
    prime_transport > 0 ? `<tr><td>${String(rowIdx++).padStart(2,'0')}</td><td>Prime de transport</td><td>Forfait mensuel</td><td class="gain">${fmtN(prime_transport)}</td><td>—</td></tr>` : '',
    prime_risque    > 0 ? `<tr><td>${String(rowIdx++).padStart(2,'0')}</td><td>Prime de risque</td><td>—</td><td class="gain">${fmtN(prime_risque)}</td><td>—</td></tr>`    : '',
    prime_rendement > 0 ? `<tr><td>${String(rowIdx++).padStart(2,'0')}</td><td>Prime de rendement</td><td>—</td><td class="gain">${fmtN(prime_rendement)}</td><td>—</td></tr>` : '',
  ].join('')
  const cnssRowN = String(rowIdx++).padStart(2,'0')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bulletin de Paie — ${employe} — ${periode}</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{--orange:#F16A1B;--dark:#2B2B2B;--mid:#3D3D3D;--light:#F5F5F5;--white:#FFFFFF;--stripe:#F9E8DA}
  body{background:#D0D0D0;font-family:'Barlow',sans-serif;display:flex;justify-content:center;align-items:flex-start;min-height:100vh;padding:32px 16px}
  .page{width:794px;background:var(--white);box-shadow:0 8px 40px rgba(0,0,0,0.28);overflow:hidden}
  .header{display:grid;grid-template-columns:260px 1fr;min-height:130px}
  .header-left{background:var(--dark);padding:28px 28px 22px;display:flex;flex-direction:column;justify-content:center}
  .doc-type{font-family:'Barlow Condensed',sans-serif;font-size:34px;font-weight:800;color:var(--white);letter-spacing:1px;line-height:1}
  .doc-sub{font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:600;color:var(--orange);letter-spacing:3px;margin-top:4px;text-transform:uppercase}
  .header-meta{margin-top:14px;display:flex;flex-direction:column;gap:3px}
  .header-meta span{font-size:10.5px;color:#AAAAAA;font-weight:400}
  .header-meta span b{color:var(--white);font-weight:600}
  .header-right{background:var(--white);padding:22px 28px;display:flex;justify-content:space-between;align-items:flex-start}
  .company-contact{display:flex;flex-direction:column;gap:4px}
  .company-contact .item{display:flex;align-items:center;gap:8px;font-size:10.5px;color:#555}
  .company-contact .item .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
  .dot-orange{background:var(--orange)}.dot-dark{background:var(--dark)}.dot-mid{background:#888}
  .company-brand{text-align:right}
  .logo-box{width:46px;height:46px;background:var(--orange);display:inline-flex;align-items:center;justify-content:center;margin-bottom:6px;position:relative;overflow:hidden}
  .logo-box::after{content:'';position:absolute;bottom:-4px;right:-4px;width:20px;height:20px;background:var(--dark)}
  .logo-inner{width:24px;height:24px;border:3px solid var(--white);position:relative;z-index:1}
  .brand-name{font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:800;color:var(--dark);letter-spacing:1px;display:block}
  .brand-tag{font-size:9px;color:#999;letter-spacing:2px;text-transform:uppercase}
  .employee-band{display:grid;grid-template-columns:260px 1fr}
  .emp-label{background:var(--orange);padding:9px 28px;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:var(--white);letter-spacing:2px;text-transform:uppercase;display:flex;align-items:center}
  .emp-info{background:var(--dark);padding:9px 28px;display:flex;gap:32px;align-items:center;flex-wrap:wrap}
  .emp-field{display:flex;flex-direction:column}
  .emp-field label{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:1.5px}
  .emp-field span{font-size:12px;color:var(--white);font-weight:600;margin-top:1px}
  .name-row{display:grid;grid-template-columns:260px 1fr}
  .name-left{background:var(--light);padding:18px 28px;border-right:3px solid var(--orange)}
  .name-left .label-sm{font-size:9px;color:var(--orange);font-weight:700;text-transform:uppercase;letter-spacing:2px}
  .name-left .name-big{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:800;color:var(--dark);line-height:1.1;margin-top:4px}
  .name-left .name-sub{font-size:11px;color:#666;margin-top:2px}
  .name-right{background:var(--white);padding:18px 28px;display:flex;gap:24px;flex-wrap:wrap;align-items:center}
  .info-chip{display:flex;flex-direction:column}
  .info-chip label{font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:1.5px}
  .info-chip span{font-size:13px;font-weight:600;color:var(--dark);margin-top:2px}
  table{width:100%;border-collapse:collapse}
  thead tr{background:var(--dark)}
  thead th{font-family:'Barlow Condensed',sans-serif;font-size:10.5px;font-weight:700;color:var(--white);letter-spacing:1.5px;text-transform:uppercase;padding:10px 14px;text-align:left}
  thead th:nth-child(3),thead th:nth-child(4),thead th:nth-child(5){text-align:right}
  thead th:nth-child(3){background:var(--orange)}
  tbody tr:nth-child(odd){background:var(--white)}
  tbody tr:nth-child(even){background:var(--stripe)}
  tbody tr.section-header td{background:var(--mid);color:var(--orange);font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:6px 14px}
  tbody td{font-size:11.5px;color:var(--dark);padding:8px 14px}
  tbody td:nth-child(3),tbody td:nth-child(4),tbody td:nth-child(5){text-align:right;font-weight:500;font-family:'Barlow Condensed',sans-serif;font-size:13px}
  td.gain{color:#1a7a3c;font-weight:700}
  td.ret{color:#b83c2a;font-weight:700}
  td.pat{color:#555;font-weight:600}
  tr.brut td{background:var(--dark)!important;color:var(--white)!important;font-weight:700;border-top:2px solid var(--orange)}
  tr.brut td:nth-child(3){background:var(--orange)!important;color:var(--white)!important}
  .totals-area{display:grid;grid-template-columns:1fr 220px;border-top:3px solid var(--orange)}
  .payment-info{background:var(--dark);padding:22px 28px}
  .payment-info h4{font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:var(--orange);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px}
  .payment-info p{font-size:10.5px;color:#ccc;line-height:1.7}
  .payment-info p b{color:var(--white)}
  .totals-box{background:var(--light)}
  .total-row{display:flex;justify-content:space-between;align-items:center;padding:9px 20px;border-bottom:1px solid #e0e0e0;font-size:11.5px;color:var(--dark)}
  .total-row .lbl{color:#666;font-size:10.5px;text-transform:uppercase;letter-spacing:1px}
  .total-row .val{font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700}
  .total-row.gain-row .val{color:#1a7a3c}
  .total-row.ret-row .val{color:#b83c2a}
  .net-row{background:var(--orange);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px 20px}
  .net-row .net-label{font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:rgba(255,255,255,0.8);letter-spacing:2px;text-transform:uppercase}
  .net-row .net-value{font-family:'Barlow Condensed',sans-serif;font-size:30px;font-weight:800;color:var(--white);letter-spacing:1px}
  .net-row .net-currency{font-size:12px;color:rgba(255,255,255,0.75);margin-top:2px}
  .footer-band{display:grid;grid-template-columns:260px 1fr}
  .footer-left{background:var(--dark);padding:18px 28px}
  .footer-left h4{font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:var(--orange);letter-spacing:2px;text-transform:uppercase;margin-bottom:8px}
  .footer-left p{font-size:9.5px;color:#aaa;line-height:1.7}
  .footer-right{background:var(--white);padding:18px 28px;display:flex;justify-content:space-between;align-items:flex-end}
  .sig-block{display:flex;flex-direction:column;align-items:center;gap:6px}
  .sig-line{width:130px;height:1px;background:var(--dark);margin-top:28px}
  .sig-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1.5px}
  .thank-you{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;color:var(--orange);letter-spacing:2px;text-transform:uppercase}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    body{background:white!important;padding:0;margin:0}
    .page{box-shadow:none;width:794px;margin:0 auto}
    .no-print{display:none!important}
  }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<script>
function downloadPDF() {
  var btn = document.getElementById('pdf-btn');
  btn.textContent = 'Génération…';
  btn.disabled = true;
  var element = document.querySelector('.page');
  html2pdf().set({
    margin: 0,
    filename: '${pdfName}',
    image: { type: 'jpeg', quality: 1 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'px', format: [794, 1200], orientation: 'portrait', hotfixes: ['px_scaling'] }
  }).from(element).save().then(function() {
    btn.textContent = '⬇ Télécharger PDF';
    btn.disabled = false;
  });
}
</script>
</head>
<body>
<div class="no-print" style="position:fixed;top:16px;right:16px;z-index:9999;display:flex;gap:8px;">
  <button id="pdf-btn" onclick="downloadPDF()" style="background:#F16A1B;color:#fff;border:none;padding:10px 20px;border-radius:6px;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;letter-spacing:1px;cursor:pointer;box-shadow:0 2px 12px rgba(241,106,27,0.4);">
    ⬇ Télécharger PDF
  </button>
  <button onclick="window.print()" style="background:#3D3D3D;color:#ccc;border:none;padding:10px 16px;border-radius:6px;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">
    🖨 Imprimer
  </button>
  <button onclick="window.close()" style="background:#2B2B2B;color:#aaa;border:1px solid #444;padding:10px 16px;border-radius:6px;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">
    ✕ Fermer
  </button>
</div>
<div class="page">

  <div class="header">
    <div class="header-left">
      <div class="doc-type">BULLETIN</div>
      <div class="doc-sub">DE SALAIRE</div>
      <div class="header-meta">
        <span>Période : <b>${periode}</b></span>
        <span>Payé le : <b>${today}</b></span>
        <span>Mode : <b>${modeLabel}</b></span>
      </div>
    </div>
    <div class="header-right">
      <div class="company-contact">
        <div class="item"><span class="dot dot-orange"></span> ${nomEcole}</div>
        <div class="item"><span class="dot dot-dark"></span> Bulletin officiel de rémunération</div>
        <div class="item"><span class="dot dot-mid"></span> Émis le ${today}</div>
      </div>
      <div class="company-brand">
        ${logoUrl
          ? `<div class="logo-box" style="background:transparent;border:2px solid var(--orange);"><img src="${logoUrl}" style="width:100%;height:100%;object-fit:contain;position:relative;z-index:2;" /></div><br>`
          : `<div class="logo-box"><div class="logo-inner"></div></div><br>`}
        <span class="brand-name">${nomEcole}</span>
        <span class="brand-tag">Établissement d'enseignement</span>
      </div>
    </div>
  </div>

  <div class="employee-band">
    <div class="emp-label">Informations Employé</div>
    <div class="emp-info">
      <div class="emp-field"><label>Emploi / Poste</label><span>${poste}</span></div>
      <div class="emp-field"><label>N° CNSS</label><span>${cnss || '—'}</span></div>
      <div class="emp-field"><label>Période</label><span>${periode}</span></div>
      <div class="emp-field"><label>Date d'émission</label><span>${today}</span></div>
    </div>
  </div>

  <div class="name-row">
    <div class="name-left">
      <div class="label-sm">Nom &amp; Prénom</div>
      <div class="name-big">${employe}</div>
      <div class="name-sub">${poste} · ${nomEcole}</div>
    </div>
    <div class="name-right">
      <div class="info-chip"><label>N° CNSS</label><span>${cnss || '—'}</span></div>
      <div class="info-chip"><label>Date de recrutement</label><span>${date_recrutement || '—'}</span></div>
      <div class="info-chip"><label>Mode de règlement</label><span>${modeLabel}</span></div>
      <div class="info-chip"><label>Salaire brut</label><span>${fmtN(brut)} XAF</span></div>
    </div>
  </div>

  <div class="table-section">
    <table>
      <thead>
        <tr>
          <th style="width:34px">N°</th>
          <th>Libellé</th>
          <th style="width:120px">Base / Taux</th>
          <th style="width:120px">Gains (XAF)</th>
          <th style="width:130px">Retenues (XAF)</th>
        </tr>
      </thead>
      <tbody>
        <tr class="section-header"><td colspan="5">Rémunérations</td></tr>
        <tr><td>01</td><td>Salaire de base</td><td>Mensuel</td><td class="gain">${fmtN(salaire_base)}</td><td>—</td></tr>
        ${primeRows}
        <tr class="brut">
          <td colspan="3" style="font-family:'Barlow Condensed',sans-serif;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">Brut Imposable</td>
          <td style="font-size:15px;color:var(--white);font-weight:800;text-align:right;">${fmtN(brut)}</td>
          <td style="text-align:right;">—</td>
        </tr>
        <tr class="section-header"><td colspan="5">Cotisations sociales</td></tr>
        <tr><td>${cnssRowN}</td><td>Retenue CNSS salariale</td><td style="text-align:right">${fmtN(brut)} × 4 %</td><td>—</td><td class="ret">${fmtN(cnss_sal)}</td></tr>
        <tr><td></td><td>CNSS patronale — Prestations familiales</td><td style="text-align:right">${fmtN(brut)} × 8 %</td><td>—</td><td class="pat">${fmtN(cnss_pf)} *</td></tr>
        <tr><td></td><td>CNSS patronale — Accidents du travail</td><td style="text-align:right">${fmtN(brut)} × 12,28 %</td><td>—</td><td class="pat">${fmtN(cnss_at)} *</td></tr>
        <tr class="section-header"><td colspan="5">Cotisations fiscales</td></tr>
        <tr><td></td><td>IRPP (Impôt sur le Revenu des Personnes Physiques)</td><td style="text-align:right">Barème progressif</td><td>—</td><td class="ret">${fmtN(irpp)}</td></tr>
        <tr><td></td><td>TUS (Taxe Unique sur les Salaires)</td><td style="text-align:right">${fmtN(brut)} × 7,5 %</td><td>—</td><td class="pat">${fmtN(tus)} *</td></tr>
        <tr><td></td><td>TOL à usage d'habitation</td><td style="text-align:right">Forfait</td><td>—</td><td class="pat">${fmtN(tol)} *</td></tr>
      </tbody>
    </table>
  </div>

  <div class="totals-area">
    <div class="payment-info">
      <h4>Récapitulatif</h4>
      <p>
        <b>Total brut mensuel :</b> ${fmtN(brut)} XAF<br>
        <b>Salaire de base :</b> ${fmtN(salaire_base)} XAF<br>
        <b>Total primes :</b> ${fmtN(primes)} XAF<br><br>
        <b>Retenues salariales :</b> ${fmtN(retenues)} XAF<br>
        <b>Charges patronales :</b> ${fmtN(pat_total)} XAF<br><br>
        <b>Mode de règlement :</b> ${modeLabel}<br>
        <span style="font-size:9px;color:#888;">* Charges à la charge de l'employeur.</span>
      </p>
    </div>
    <div class="totals-box">
      <div class="total-row gain-row"><span class="lbl">Total gains</span><span class="val">${fmtN(brut)}</span></div>
      <div class="total-row ret-row"><span class="lbl">Retenues salariales</span><span class="val">${fmtN(retenues)}</span></div>
      <div class="total-row"><span class="lbl">Charges patronales</span><span class="val" style="color:#555;">${fmtN(pat_total)}</span></div>
      <div class="net-row">
        <div class="net-label">Net à Payer</div>
        <div class="net-value">${fmtN(net)}</div>
        <div class="net-currency">Francs CFA (XAF)</div>
      </div>
    </div>
  </div>

  <div class="footer-band">
    <div class="footer-left">
      <h4>Mentions légales</h4>
      <p>Ce bulletin de paie est à conserver<br>sans limitation de durée.<br><br>En cas de rupture du contrat, la remise<br>de ce bulletin est obligatoire.</p>
    </div>
    <div class="footer-right">
      <div class="sig-block"><div class="sig-line"></div><div class="sig-label">Signature de l'employé</div></div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
        <div class="thank-you">Merci pour votre travail</div>
      </div>
      <div class="sig-block"><div class="sig-line"></div><div class="sig-label">Signature de l'employeur</div></div>
    </div>
  </div>

</div>
</body>
</html>`
}

// ── Paie ──────────────────────────────────────────────────────────────────────

type AgentPaie = {
  id: string; nom: string; prenom: string; postnom: string | null
  poste: string; type_agent: 'employe' | 'staff' | 'enseignant'
  salaire_base: number; prime_logement: number; prime_transport: number
  prime_risque: number; prime_rendement: number
  mode_paiement: string; banque: string | null; rib: string | null
  mobile_money_type: string | null; mobile_money_numero: string | null
  numero_cnss: string | null; email: string | null
}

type PaieRecord = {
  id: string; employe_id: string; mois: number; annee: number
  salaire_base: number; primes: number; retenues: number; net: number
  statut: string; mode_paiement: string | null; type_agent: string | null; created_at: string
}

function SectionPaie({ tenantId, nomEcole }: { tenantId: string; nomEcole: string }) {
  const [agents,     setAgents]     = useState<AgentPaie[]>([])
  const [paies, setPaies] = useState<PaieRecord[]>([])
  const [loading,    setLoading]    = useState(false)
  const [agent,      setAgent]      = useState<AgentPaie | null>(null)
  const [paying,     setPaying]     = useState(false)
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null)
  const [justPaidId, setJustPaidId] = useState<string | null>(null)
  const [showLogo,   setShowLogo]   = useState(false)
  const [logoUrl,    setLogoUrl]    = useState('')
  const [logoInput,  setLogoInput]  = useState('')
  const [form, setForm] = useState({
    mois: new Date().getMonth() + 1,
    annee: new Date().getFullYear(),
    salaire_base: 0, prime_logement: 0, prime_transport: 0,
    prime_risque: 0, prime_rendement: 0,
  })

  const MOIS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

  const MODES_PAIE = [
    { id: 'virement'     as const, label: 'Virement',     icon: Building2  },
    { id: 'cheque'       as const, label: 'Chèque',       icon: CreditCard },
    { id: 'mobile_money' as const, label: 'Mobile Money', icon: Smartphone },
    { id: 'especes'      as const, label: 'Espèces',      icon: DollarSign },
  ]

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: emp }, { data: ens }, { data: stf }, { data: pai }] = await Promise.all([
      supabase.from('employes').select('*').eq('tenant_id', tenantId).eq('statut', 'actif').order('nom'),
      supabase.from('enseignants').select('*').eq('tenant_id', tenantId).eq('statut', 'actif').eq('type_enseignant', 'employe').order('nom'),
      supabase.from('staff_ecole').select('*').eq('tenant_id', tenantId).eq('statut', 'actif').order('nom'),
      supabase.from('paie_ecole').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    ])
    const empA: AgentPaie[] = (emp ?? []).map((e: any) => ({
      id: e.id, nom: e.nom, prenom: e.prenom, postnom: e.postnom ?? null,
      poste: e.poste, type_agent: 'employe' as const,
      salaire_base: e.salaire_base ?? 0, prime_logement: e.prime_logement ?? 0,
      prime_transport: e.prime_transport ?? 0, prime_risque: e.prime_risque ?? 0,
      prime_rendement: e.prime_rendement ?? 0,
      mode_paiement: e.mode_paiement ?? 'banque', banque: e.banque, rib: e.rib,
      mobile_money_type: e.mobile_money_type, mobile_money_numero: e.mobile_money_numero,
      numero_cnss: e.numero_cnss, email: e.email_pro,
    }))
    const ensA: AgentPaie[] = (ens ?? []).map((e: any) => ({
      id: e.id, nom: e.nom, prenom: e.prenom, postnom: null,
      poste: e.matiere ? `Enseignant — ${e.matiere}` : 'Enseignant',
      type_agent: 'enseignant' as const,
      salaire_base: e.salaire_mensuel ?? 0, prime_logement: 0, prime_transport: 0,
      prime_risque: 0, prime_rendement: 0,
      mode_paiement: e.banque ? 'banque' : e.mobile_money_type ? 'mobile_money' : 'especes',
      banque: e.banque, rib: e.rib,
      mobile_money_type: e.mobile_money_type, mobile_money_numero: e.mobile_money_numero,
      numero_cnss: e.numero_cnss, email: e.email,
    }))
    const stfA: AgentPaie[] = (stf ?? []).map((s: any) => ({
      id: s.id, nom: s.nom, prenom: s.prenom, postnom: null,
      poste: s.poste, type_agent: 'staff' as const,
      salaire_base: s.salaire ?? 0, prime_logement: 0, prime_transport: 0,
      prime_risque: 0, prime_rendement: 0,
      mode_paiement: s.banque ? 'banque' : s.mobile_money_type ? 'mobile_money' : 'especes',
      banque: s.banque, rib: s.rib,
      mobile_money_type: s.mobile_money_type, mobile_money_numero: s.mobile_money_numero,
      numero_cnss: s.numero_cnss, email: s.email,
    }))
    setAgents([...empA, ...ensA, ...stfA])
    setPaies((pai ?? []) as PaieRecord[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const saved = localStorage.getItem(`logo_${tenantId}`)
    if (saved) { setLogoUrl(saved); setLogoInput(saved) }
  }, [tenantId])

  function handleAgentSelect(id: string) {
    const a = agents.find(x => x.id === id) ?? null
    setAgent(a)
    setJustPaidId(null)
    if (a) {
      setForm(f => ({
        ...f,
        salaire_base:    a.salaire_base,
        prime_logement:  a.prime_logement,
        prime_transport: a.prime_transport,
        prime_risque:    a.prime_risque,
        prime_rendement: a.prime_rendement,
      }))
    }
  }

  async function payer(mode: 'virement' | 'cheque' | 'mobile_money' | 'especes') {
    if (!agent) return
    setPaying(true)
    try {
      const primes   = form.prime_logement + form.prime_transport + form.prime_risque + form.prime_rendement
      const brut     = form.salaire_base + primes
      const retenues = Math.round(brut * 0.08)
      const net      = brut - retenues
      const today    = new Date().toISOString().split('T')[0]
      const nomC     = `${agent.prenom}${agent.postnom ? ' ' + agent.postnom : ''} ${agent.nom}`

      const { data: paie, error } = await supabase.from('paie_ecole').insert({
        tenant_id: tenantId, employe_id: agent.id,
        mois: form.mois, annee: form.annee,
        salaire_base: form.salaire_base, primes, retenues, net,
        statut: 'paye', mode_paiement: mode, type_agent: agent.type_agent,
      }).select().single()

      if (error) { showToast(error.message, false); setPaying(false); return }

      const creditAccount = modeToAccount(mode)
      const libelleCompta = `Salaire ${MOIS[form.mois]} ${form.annee} — ${nomC}`

      await Promise.allSettled([
        // Trésorerie
        supabase.from('transactions').insert({
          tenant_id: tenantId, type: 'sortie', categorie: 'Salaires',
          description: libelleCompta, montant: net,
          date: today, mode_paiement: mode,
          source: 'paie', source_id: paie.id,
          debit_account: '641000', credit_account: creditAccount,
        }),

        // Comptabilité — journal_comptable + journal_entries (via utility)
        writeComptaEntry({
          tenantId, date: today, libelle: libelleCompta,
          type: 'depense', montant: net, categorie: 'Salaires',
          debitAccount: '641000',   // Charges de personnel
          creditAccount: creditAccount,
          source: 'paie', sourceId: paie.id,
        }),

        // Charges CNSS patronales (8%) → écriture distincte
        writeComptaEntry({
          tenantId, date: today,
          libelle: `CNSS patronale ${MOIS[form.mois]} ${form.annee} — ${nomC}`,
          type: 'depense', montant: Math.round(brut * 0.08),
          categorie: 'CNSS',
          debitAccount: '644000',   // Charges sociales
          creditAccount: '431000',  // Organismes sociaux
          source: 'paie', sourceId: paie.id,
        }),

        // Notifications
        supabase.from('notifications').insert([
          { tenant_id: tenantId, role: 'RH_PAIE',
            title: 'Salaire versé', body: `${nomC} — Net: ${fmt(net)} FCFA (${mode})`,
            link: '/dashboard/ecole/rh', lu: false },
          { tenant_id: tenantId, role: 'DIRECTION_GENERALE',
            title: 'Salaire versé', body: `${nomC} — Net: ${fmt(net)} FCFA`,
            link: '/dashboard/ecole/rh', lu: false },
          { tenant_id: tenantId, role: 'COMPTABILITE',
            title: `Écriture paie — ${nomC}`,
            body: `D:641000 / C:${creditAccount} — ${fmt(net)} FCFA`,
            link: '/dashboard/comptabilite', lu: false },
        ]),
      ])

      setJustPaidId(paie.id)
      showToast(`Salaire de ${nomC} versé — ${fmt(net)} FCFA`)
      setAgent(null)
      load()
    } catch (e: any) {
      showToast(e?.message ?? 'Erreur', false)
    }
    setPaying(false)
  }

  function downloadBulletin(p: PaieRecord) {
    const a   = agents.find(x => x.id === p.employe_id)
    const nom = a ? `${a.prenom}${a.postnom ? ' ' + a.postnom : ''} ${a.nom}` : '—'
    const html = buildBulletinHTML({
      employe: nom, poste: a?.poste ?? '—', cnss: a?.numero_cnss ?? '',
      periode: `${MOIS[p.mois]} ${p.annee}`,
      salaire_base: p.salaire_base, primes: p.primes, retenues: p.retenues, net: p.net,
      prime_logement:  a?.prime_logement  ?? 0,
      prime_transport: a?.prime_transport ?? 0,
      prime_risque:    a?.prime_risque    ?? 0,
      prime_rendement: a?.prime_rendement ?? 0,
      mode_paiement: p.mode_paiement ?? 'virement',
      nomEcole, logoUrl,
    })
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
  }

  const brut     = form.salaire_base + form.prime_logement + form.prime_transport + form.prime_risque + form.prime_rendement
  const retenues = Math.round(brut * 0.08)
  const net      = brut - retenues
  const totalNet = paies.reduce((s, p) => s + p.net, 0)

  return (
    <div className="space-y-5">

      {/* KPIs + logo */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-3 flex-wrap">
          <KpiCard label="Total salaires payés" value={fmt(totalNet) + ' FCFA'} color="#2EA043" />
          <KpiCard label="Bulletins émis" value={paies.length} color="#F07900" />
        </div>
        <button onClick={() => setShowLogo(!showLogo)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-white/[0.08] text-[#8B949E] hover:text-white transition-colors">
          <Upload size={12} /> Logo bulletin
        </button>
      </div>

      {showLogo && (
        <div className="flex items-end gap-2 p-3 rounded-xl border border-white/[0.08]" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex-1">
            <label className="block text-xs text-[#8B949E] mb-1">URL du logo (bulletins de paie)</label>
            <input className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder-[#484F58] focus:outline-none"
              placeholder="https://…" value={logoInput} onChange={e => setLogoInput(e.target.value)} />
          </div>
          <button onClick={() => { setLogoUrl(logoInput); localStorage.setItem(`logo_${tenantId}`, logoInput); setShowLogo(false) }}
            className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1" style={{ background: '#2EA043', color: '#fff' }}>
            <Check size={12} /> OK
          </button>
        </div>
      )}

      {/* ── PANNEAU DE PAIE ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.08] p-5 space-y-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <p className="text-sm font-bold text-white">Payer un agent</p>

        {/* Sélection agent + période */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-[#8B949E] mb-1">Agent *</label>
            <select value={agent?.id ?? ''} onChange={e => handleAgentSelect(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none">
              <option value="">— Sélectionner —</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>
                  {a.prenom}{a.postnom ? ' ' + a.postnom : ''} {a.nom} · {a.poste}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#8B949E] mb-1">Mois</label>
            <select value={form.mois} onChange={e => setForm(p => ({ ...p, mois: Number(e.target.value) }))}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none">
              {MOIS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>
          <FI label="Année" value={form.annee.toString()} onChange={v => setForm(p => ({ ...p, annee: Number(v) }))} type="number" />
        </div>

        {/* Fiche agent sélectionné */}
        <AnimatePresence>
          {agent && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">

              {/* Identité */}
              <div className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(244,180,0,0.05)', border: '1px solid rgba(244,180,0,0.15)' }}>
                <Avatar nom={agent.nom} prenom={agent.prenom} photoUrl={null} size={40} />
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">
                    {agent.prenom}{agent.postnom ? ' ' + agent.postnom : ''} {agent.nom}
                  </p>
                  <p className="text-[10px] text-[#8B949E]">
                    {agent.poste} · {agent.type_agent === 'employe' ? 'Employé' : 'Staff'}
                  </p>
                </div>
                <div className="text-right text-[10px] text-[#484F58]">
                  {agent.banque && <p>{agent.banque} — {agent.rib ?? '—'}</p>}
                  {!agent.banque && agent.mobile_money_type && (
                    <p style={{ color: '#F97316' }}>{agent.mobile_money_type} · {agent.mobile_money_numero}</p>
                  )}
                  {agent.numero_cnss && <p className="mt-0.5">CNSS: {agent.numero_cnss}</p>}
                </div>
              </div>

              {/* Rémunération modifiable */}
              <div className="grid grid-cols-2 gap-3">
                <FI label="Salaire de base (FCFA)" value={form.salaire_base.toString()}
                  onChange={v => setForm(p => ({ ...p, salaire_base: Number(v) || 0 }))} type="number" />
                {agent.type_agent === 'employe' && <>
                  <FI label="Prime logement (FCFA)" value={form.prime_logement.toString()}
                    onChange={v => setForm(p => ({ ...p, prime_logement: Number(v) || 0 }))} type="number" />
                  <FI label="Prime transport (FCFA)" value={form.prime_transport.toString()}
                    onChange={v => setForm(p => ({ ...p, prime_transport: Number(v) || 0 }))} type="number" />
                  <FI label="Prime risque (FCFA)" value={form.prime_risque.toString()}
                    onChange={v => setForm(p => ({ ...p, prime_risque: Number(v) || 0 }))} type="number" />
                  <FI label="Prime rendement (FCFA)" value={form.prime_rendement.toString()}
                    onChange={v => setForm(p => ({ ...p, prime_rendement: Number(v) || 0 }))} type="number" />
                </>}
              </div>

              {/* Récapitulatif calcul */}
              <div className="rounded-xl overflow-hidden border border-white/[0.06] grid grid-cols-3 divide-x divide-white/[0.06]">
                <div className="p-3 text-center">
                  <p className="text-[10px] text-[#8B949E] uppercase tracking-wider">Salaire brut</p>
                  <p className="text-base font-bold text-white mt-0.5">{fmt(brut)} <span className="text-[9px] text-[#484F58]">FCFA</span></p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-[10px] text-[#8B949E] uppercase tracking-wider">CNSS 8%</p>
                  <p className="text-base font-bold mt-0.5" style={{ color: '#F01F38' }}>−{fmt(retenues)} <span className="text-[9px] text-[#484F58]">FCFA</span></p>
                </div>
                <div className="p-3 text-center" style={{ background: 'rgba(46,160,67,0.06)' }}>
                  <p className="text-[10px] text-[#8B949E] uppercase tracking-wider">Net à payer</p>
                  <p className="text-base font-bold mt-0.5" style={{ color: '#2EA043' }}>{fmt(net)} <span className="text-[9px] text-[#484F58]">FCFA</span></p>
                </div>
              </div>

              {/* Boutons de paiement */}
              <div>
                <p className="text-[10px] text-[#8B949E] uppercase tracking-wider mb-2">Payer via</p>
                <div className="grid grid-cols-4 gap-2">
                  {MODES_PAIE.map(m => {
                    const Icon = m.icon
                    return (
                      <button key={m.id} onClick={() => payer(m.id)} disabled={paying}
                        className="flex flex-col items-center gap-1.5 py-4 rounded-xl border font-semibold transition-all disabled:opacity-40 text-[11px]"
                        style={{ background: 'rgba(46,160,67,0.08)', borderColor: 'rgba(46,160,67,0.3)', color: '#2EA043' }}>
                        {paying ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
                        {m.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!agent && (
          <div className="text-center py-8 text-[#484F58] text-xs">
            Sélectionnez un agent pour accéder à sa fiche de paie
          </div>
        )}
      </div>

      {/* ── Historique ──────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider">Historique des paiements</p>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[#8B949E]" size={16} /></div>
        ) : paies.length === 0 ? (
          <div className="text-center py-10 text-[#8B949E] text-xs">Aucun bulletin émis.</div>
        ) : (
          <div className="rounded-xl border border-white/[0.06] overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {['Agent', 'Période', 'Brut', 'Retenues', 'Net', 'Mode', 'Statut', ''].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] text-[#8B949E] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paies.map(p => {
                  const a    = agents.find(x => x.id === p.employe_id)
                  const nom  = a ? `${a.prenom}${a.postnom ? ' ' + a.postnom : ''} ${a.nom}` : '—'
                  const isJ  = p.id === justPaidId
                  return (
                    <tr key={p.id} className="border-t border-white/[0.04] hover:bg-white/[0.01]"
                      style={isJ ? { background: 'rgba(46,160,67,0.05)' } : {}}>
                      <td className="px-4 py-2.5">
                        <p className="text-white font-medium">{nom}</p>
                        {a && <p className="text-[9px] text-[#484F58]">{a.poste}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-[#8B949E]">{MOIS[p.mois]} {p.annee}</td>
                      <td className="px-4 py-2.5 text-[#8B949E]">{fmt(p.salaire_base + p.primes)}</td>
                      <td className="px-4 py-2.5 text-[#F01F38]">−{fmt(p.retenues)}</td>
                      <td className="px-4 py-2.5 font-bold text-white">{fmt(p.net)} FCFA</td>
                      <td className="px-4 py-2.5 text-[#484F58] capitalize">{(p.mode_paiement ?? '—').replace('_', ' ')}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: '#2EA043', background: '#2EA04318' }}>Payé</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => downloadBulletin(p)} title="Télécharger bulletin"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/[0.08] text-[#8B949E] hover:text-white transition-all text-[10px]">
                          <Printer size={10} /> Bulletin
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white"
            style={{ background: toast.ok ? 'linear-gradient(135deg,#065F46,#059669)' : 'linear-gradient(135deg,#7f1d1d,#dc2626)' }}>
            {toast.ok ? <Check size={14} /> : <AlertCircle size={14} />} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Recrutement ───────────────────────────────────────────────────────────────

function SectionRecrutement({ tenantId }: { tenantId: string }) {
  const [postes, setPostes] = useState<{ id: string; titre: string; departement: string; description: string | null; statut: string; created_at: string }[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({ titre: '', departement: 'Enseignement', description: '' })

  const load = useCallback(async () => {
    const { data } = await supabase.from('recrutements_ecole').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
    setPostes((data ?? []) as typeof postes)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function add() {
    if (!form.titre) return
    setSaving(true)
    await supabase.from('recrutements_ecole').insert({ tenant_id: tenantId, titre: form.titre, departement: form.departement, description: form.description || null, statut: 'ouvert' })
    setForm({ titre: '', departement: 'Enseignement', description: '' })
    setShowForm(false); load(); setSaving(false)
  }

  async function toggleStatut(id: string, statut: string) {
    const next = statut === 'ouvert' ? 'ferme' : 'ouvert'
    await supabase.from('recrutements_ecole').update({ statut: next }).eq('id', id)
    setPostes(p => p.map(x => x.id === id ? { ...x, statut: next } : x))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <KpiCard label="Postes ouverts" value={postes.filter(p => p.statut === 'ouvert').length} color="#2EA043" />
          <KpiCard label="Postes fermés"  value={postes.filter(p => p.statut === 'ferme').length}  color="#8B949E" />
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: 'linear-gradient(135deg,#F07900,#1a6fd4)', color: '#fff' }}>
          <Plus size={13} /> Ouvrir un poste
        </button>
      </div>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-xl border border-[#F07900]/30 p-4 space-y-3" style={{ background: 'rgba(56,139,253,0.04)' }}>
            <div className="grid grid-cols-2 gap-3">
              <FI label="Titre du poste *" value={form.titre} onChange={v => setForm(p => ({ ...p, titre: v }))} placeholder="Prof de Mathématiques…" />
              <div>
                <label className="block text-xs text-[#8B949E] mb-1">Département</label>
                <select value={form.departement} onChange={e => setForm(p => ({ ...p, departement: e.target.value }))} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none">
                  {['Enseignement', 'Administration', 'Maintenance', 'Sécurité', 'Autre'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-[#8B949E] mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none" placeholder="Profil recherché, qualifications…" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={add} disabled={saving || !form.titre} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#F07900', color: '#fff' }}>
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} Créer
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-[#8B949E] border border-white/[0.06]">Annuler</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {postes.length === 0 ? (
        <div className="text-center py-12 text-[#8B949E] text-xs">Aucun poste de recrutement.</div>
      ) : (
        <div className="space-y-2">
          {postes.map(p => (
            <div key={p.id} className="rounded-xl border border-white/[0.06] p-4 flex items-start gap-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <AlertCircle size={14} className="mt-0.5 shrink-0" style={{ color: p.statut === 'ouvert' ? '#2EA043' : '#484F58' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">{p.titre}</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={p.statut === 'ouvert' ? { color: '#2EA043', background: '#2EA04318' } : { color: '#8B949E', background: '#8B949E18' }}>
                    {p.statut === 'ouvert' ? 'Ouvert' : 'Fermé'}
                  </span>
                </div>
                <p className="text-[10px] text-[#8B949E] mt-0.5">{p.departement}</p>
                {p.description && <p className="text-[11px] text-[#8B949E] mt-1">{p.description}</p>}
              </div>
              <button onClick={() => toggleStatut(p.id, p.statut)} className="text-[10px] px-3 py-1.5 rounded-lg border border-white/[0.08] text-[#8B949E] hover:text-white transition-colors">
                {p.statut === 'ouvert' ? 'Fermer' : 'Rouvrir'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Heures Formateurs ─────────────────────────────────────────────────────────

interface TeacherHour {
  id: string; enseignant_id: string; tenant_id: string
  heures: number; matiere: string | null; date_declaration: string
  periode: string | null; description: string | null
  statut: 'declare' | 'validated' | 'paye'; created_at: string
}

function SectionHeuresFormateurs({ tenantId, enseignants }: { tenantId: string; enseignants: Enseignant[] }) {
  const [heures,   setHeures]   = useState<TeacherHour[]>([])
  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState<string | null>(null)
  const [filter,   setFilter]   = useState<'declare' | 'validated' | 'paye' | 'tous'>('tous')
  const [toast,    setToast]    = useState<string | null>(null)

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('teacher_hours').select('*').eq('tenant_id', tenantId).order('date_declaration', { ascending: false })
    setHeures((data ?? []) as TeacherHour[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function valider(h: TeacherHour) {
    setSaving(h.id)
    await supabase.from('teacher_hours').update({ statut: 'validated' }).eq('id', h.id)
    const ens = enseignants.find(e => e.id === h.enseignant_id)
    // Notify formateur that their hours are validated
    try {
      await supabase.from('notifications').insert({
        tenant_id: tenantId,
        type: 'heures_validees',
        titre: `Heures validées — ${ens ? `${ens.prenom} ${ens.nom}` : 'Formateur'}`,
        message: `Vos ${h.heures}h du ${new Date(h.date_declaration).toLocaleDateString('fr-FR')} ont été validées par le RH.`,
        destinataire_role: 'FORMATEUR',
        enseignant_id: h.enseignant_id,
        read: false,
      })
    } catch {}
    showToast('Heures validées')
    setSaving(null); load()
  }

  async function marquerPaye(h: TeacherHour) {
    if (h.statut !== 'validated') return
    setSaving(h.id)
    const ens      = enseignants.find(e => e.id === h.enseignant_id)
    const taux     = ens?.taux_horaire ?? 5000
    const montant  = h.heures * taux
    const today    = new Date().toISOString().split('T')[0]
    const nomEns   = ens ? `${ens.prenom} ${ens.nom}` : 'Formateur'
    const fmtN     = (n: number) => new Intl.NumberFormat('fr-FR').format(n)

    await supabase.from('teacher_hours').update({ statut: 'paye' }).eq('id', h.id)

    // Trésorerie (sortie d'argent)
    try {
      await supabase.from('transactions').insert({
        tenant_id: tenantId, type: 'sortie',
        categorie: 'Émoluments Formateurs',
        description: `Paiement heures — ${nomEns} (${h.heures}h · ${h.matiere ?? ''} · ${fmtN(taux)} FCFA/h)`,
        montant, date: today, mode_paiement: 'virement', source: 'teacher_hours', source_id: h.id,
      })
    } catch {}

    // Comptabilité (journal)
    try {
      await supabase.from('journal_comptable').insert({
        tenant_id: tenantId, date: today,
        libelle: `Émoluments formateur — ${nomEns} — ${h.heures}h`,
        type: 'charge', montant_ht: montant, tva: 0, ca: 0, montant_ttc: montant,
        categorie: '641 — Rémunérations du personnel',
      })
    } catch {}

    // Notifications : Formateur + RH + Direction + Comptabilité
    try {
      await supabase.from('notifications').insert([
        { tenant_id: tenantId, type: 'heures_payees',
          titre: "Paiement d'heures effectué",
          message: `Vos ${h.heures}h (${h.matiere ?? ''}) ont été payées — ${fmtN(montant)} FCFA.`,
          destinataire_role: 'FORMATEUR', enseignant_id: h.enseignant_id, read: false },
        { tenant_id: tenantId, type: 'heures_payees',
          titre: 'Émoluments formateur versés',
          message: `${nomEns} — ${h.heures}h · ${fmtN(montant)} FCFA sortis de trésorerie.`,
          destinataire_role: 'RH_PAIE', read: false },
        { tenant_id: tenantId, type: 'heures_payees',
          titre: 'Émoluments formateur versés',
          message: `${nomEns} — ${h.heures}h · ${fmtN(montant)} FCFA.`,
          destinataire_role: 'DIRECTION_GENERALE', read: false },
        { tenant_id: tenantId, type: 'heures_payees',
          titre: 'Écriture comptable générée',
          message: `Charge 641 — ${nomEns} — ${fmtN(montant)} FCFA.`,
          destinataire_role: 'RAF', read: false },
      ])
    } catch {}

    showToast(`Payé — ${fmtN(montant)} FCFA · trésorerie & comptabilité mises à jour`)
    setSaving(null); load()
  }

  const displayed = filter === 'tous' ? heures : heures.filter(h => h.statut === filter)
  const STATUT_CFG: Record<string, { label: string; color: string; bg: string }> = {
    declare:   { label: 'Déclaré',  color: '#F0A30A', bg: '#F0A30A18' },
    validated: { label: 'Validé',   color: '#F07900', bg: '#F0790018' },
    paye:      { label: 'Payé',     color: '#2EA043', bg: '#2EA04318' },
  }

  const kpis = [
    { label: 'En attente', value: heures.filter(h => h.statut === 'declare').length,   color: '#F0A30A' },
    { label: 'Validées',   value: heures.filter(h => h.statut === 'validated').length, color: '#F07900' },
    { label: 'Payées',     value: heures.filter(h => h.statut === 'paye').length,      color: '#2EA043' },
    { label: 'Total heures', value: heures.reduce((s, h) => s + h.heures, 0),          color: '#8B0073' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {kpis.map(k => <KpiCard key={k.label} label={k.label} value={k.value} color={k.color} />)}
      </div>

      {/* Filter */}
      <div className="flex gap-1">
        {(['tous', 'declare', 'validated', 'paye'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? 'text-white' : 'text-[#8B949E] hover:text-white border border-white/[0.06]'}`}
            style={filter === f ? { background: f === 'tous' ? '#30363D' : STATUT_CFG[f]?.color ?? '#30363D' } : {}}>
            {f === 'tous' ? 'Toutes' : STATUT_CFG[f]?.label}
          </button>
        ))}
        <button onClick={load} className="ml-auto p-2 rounded-lg border border-white/[0.06] text-[#8B949E] hover:text-white">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <div className="text-center py-12 text-[#8B949E] text-xs">Aucune déclaration{filter !== 'tous' ? ` avec ce statut` : ''}.</div>
      ) : (
        <div className="space-y-2">
          {displayed.map(h => {
            const ens = enseignants.find(e => e.id === h.enseignant_id)
            const cfg = STATUT_CFG[h.statut]
            return (
              <div key={h.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                  <Avatar nom={ens?.nom ?? '?'} prenom={ens?.prenom ?? ''} photoUrl={null} size={32} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white">{ens ? `${ens.prenom} ${ens.nom}` : 'Formateur inconnu'}</p>
                  <p className="text-[10px] text-[#8B949E]">
                    {h.heures}h · {h.matiere ?? '—'} · {new Date(h.date_declaration).toLocaleDateString('fr-FR')}
                    {h.periode ? ` · ${h.periode}` : ''}
                    {' · '}<span style={{ color: '#2EA043' }}>{new Intl.NumberFormat('fr-FR').format(h.heures * (ens?.taux_horaire ?? 5000))} FCFA</span>
                  </p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                <div className="flex gap-1.5">
                  {h.statut === 'declare' && (
                    <button onClick={() => valider(h)} disabled={saving === h.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#1E3A5F,#1D4ED8)', color: '#fff' }}>
                      {saving === h.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Valider
                    </button>
                  )}
                  {h.statut === 'validated' && (
                    <button onClick={() => marquerPaye(h)} disabled={saving === h.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#065F46,#059669)', color: '#fff' }}>
                      {saving === h.id ? <Loader2 size={10} className="animate-spin" /> : <DollarSign size={10} />} Payer
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {toast && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg,#065F46,#059669)' }}>
          <Check size={14} /> {toast}
        </motion.div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RhPage() {
  useRoleGuard(['DIRECTION_GENERALE', 'RAF', 'RH_PAIE'])
  const { tenantId, loading: tenantLoading } = useTenant()
  const [subTab,     setSubTab]     = useState<SubTab>('employes')
  const [enseignants,setEnseignants]= useState<Enseignant[]>([])
  const [loading,    setLoading]    = useState(true)
  const [nomEcole,   setNomEcole]   = useState('Mon École')

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [{ data: ens }, { data: tenant }] = await Promise.all([
      supabase.from('enseignants').select('*').eq('tenant_id', tenantId).order('nom'),
      supabase.from('tenants').select('nom_entreprise').eq('id', tenantId).maybeSingle(),
    ])
    setEnseignants((ens ?? []) as Enseignant[])
    if (tenant?.nom_entreprise) setNomEcole(tenant.nom_entreprise)
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  if (tenantLoading || loading) return (
    <div className="flex items-center justify-center h-64 text-[#8B949E]">
      <Loader2 className="animate-spin mr-2" size={18} /> Chargement…
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">RH & Paie</h1>
          <p className="text-xs text-[#8B949E] mt-0.5">{nomEcole} · {enseignants.length} enseignant(s)</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-white/[0.08] text-[#8B949E] hover:text-white transition-colors"><RefreshCw size={14} /></button>
      </div>

      <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit flex-wrap">
        {SUB_TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setSubTab(t.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
              style={{ background: subTab === t.id ? '#2EA043' : 'transparent', color: subTab === t.id ? '#fff' : '#8B949E' }}>
              <Icon size={12} /> {t.label}
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={subTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
          {subTab === 'employes'    && tenantId && <SectionEmployes           tenantId={tenantId} />}
          {subTab === 'enseignants' && tenantId && <SectionEnseignants       tenantId={tenantId} enseignants={enseignants} onRefresh={load} />}
          {subTab === 'staff'       && tenantId && <SectionStaff             tenantId={tenantId} />}
          {subTab === 'conges'      && tenantId && <SectionConges            tenantId={tenantId} enseignants={enseignants} />}
          {subTab === 'paie'        && tenantId && <SectionPaie              tenantId={tenantId} nomEcole={nomEcole} />}
          {subTab === 'heures'      && tenantId && <SectionHeuresFormateurs  tenantId={tenantId} enseignants={enseignants} />}
          {subTab === 'recrutement' && tenantId && <SectionRecrutement       tenantId={tenantId} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
