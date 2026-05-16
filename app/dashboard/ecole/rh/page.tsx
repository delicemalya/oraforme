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
    { label: 'Total',       value: employes.length,                                              color: '#388BFD' },
    { label: 'Actifs',      value: employes.filter(e => e.statut === 'actif').length,            color: '#2EA043' },
    { label: 'Formateurs',  value: employes.filter(e => e.type_employe === 'formateur').length,  color: '#8B5CF6' },
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
        <div className="rounded-xl border border-white/[0.06] overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Employé', 'Poste', 'Type', 'Salaire brut', 'Statut', 'Contrat'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] text-[#8B949E] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(e => {
                const brut = (e.salaire_base || 0) + (e.prime_logement || 0) + (e.prime_transport || 0) + (e.prime_risque || 0) + (e.prime_rendement || 0)
                const sc = e.statut === 'actif'
                  ? { color: '#2EA043', bg: '#2EA04318', label: 'Actif' }
                  : e.statut === 'suspendu'
                  ? { color: '#F0A30A', bg: '#F0A30A18', label: 'Suspendu' }
                  : { color: '#8B949E', bg: '#8B949E18', label: e.statut }
                return (
                  <tr key={e.id} className="border-t border-white/[0.04] hover:bg-white/[0.02] cursor-pointer" onClick={() => setProfil({ type: 'employe', data: e as unknown as EmployeFull })}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                          {e.photo_url
                            ? <img src={e.photo_url} alt="" className="w-full h-full object-cover" />
                            : <Avatar nom={e.nom} prenom={e.prenom} photoUrl={null} size={32} />}
                        </div>
                        <div>
                          <p className="font-medium text-white whitespace-nowrap">
                            {e.prenom} {e.postnom ? e.postnom + ' ' : ''}{e.nom}
                          </p>
                          {e.email_pro && <p className="text-[10px] text-[#484F58]">{e.email_pro}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white">{e.poste}</p>
                      {e.departement && <p className="text-[10px] text-[#484F58]">{e.departement}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-medium capitalize text-[#8B949E]">{e.type_employe}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: '#2EA043' }}>{fmt(brut)} F</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: sc.color, background: sc.bg }}>{sc.label}</span>
                    </td>
                    <td className="px-4 py-3 text-[#484F58]">
                      {e.date_debut_contrat
                        ? new Date(e.date_debut_contrat + 'T00:00:00').toLocaleDateString('fr-FR')
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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

const EMPTY_ENS_FORM = {
  prenom: '', nom: '', matiere: '', telephone: '', email: '',
  statut: 'actif' as StatutEnseignant,
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
  const [selected,     setSelected]     = useState<Enseignant | null>(null)
  const [form,         setForm]         = useState(EMPTY_ENS_FORM)
  const [photoFile,    setPhotoFile]    = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [profil,       setProfil]       = useState<ProfilPerson | null>(null)

  const displayed = enseignants.filter(e => {
    const q = search.toLowerCase()
    return !q || (e.nom + ' ' + e.prenom + ' ' + (e.matiere ?? '')).toLowerCase().includes(q)
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
    setSaving(true)
    const { data: ins } = await supabase.from('enseignants').insert({
      tenant_id: tenantId,
      nom: form.nom.trim(), prenom: form.prenom.trim(),
      matiere: form.matiere || null,
      telephone: form.telephone || null,
      email: form.email || null,
      statut: form.statut,
      salaire_mensuel:     form.salaire           ? Number(form.salaire)          : null,
      taux_horaire:        form.taux_horaire       ? Number(form.taux_horaire)     : null,
      mobile_money_type:   form.mobile_money_type  || null,
      mobile_money_numero: form.mobile_money_numero|| null,
      banque:              form.banque             || null,
      rib:                 form.rib                || null,
      numero_cnss:         form.numero_cnss        || null,
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
    { label: 'Total',    value: enseignants.length,                                    color: '#388BFD' },
    { label: 'Actifs',   value: enseignants.filter(e => e.statut === 'actif').length,  color: '#2EA043' },
    { label: 'En congé', value: enseignants.filter(e => e.statut === 'conge').length,  color: '#F0A30A' },
    { label: 'Inactifs', value: enseignants.filter(e => e.statut === 'inactif').length,color: '#8B949E' },
  ]

  const SEL = 'w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none'
  const SEC = 'text-[10px] font-semibold text-[#484F58] uppercase tracking-wider mb-2 mt-1'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {kpis.map(k => <KpiCard key={k.label} label={k.label} value={k.value} color={k.color} />)}
      </div>

      <div className="flex items-center gap-2 justify-between">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8B949E]" />
          <input className="pl-7 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-white placeholder-[#484F58] focus:outline-none w-52" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
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

            <p className="text-sm font-bold text-[#2EA043]">Nouvel enseignant</p>

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

            {/* Rémunération */}
            <div>
              <p className={SEC}>Rémunération</p>
              <div className="grid grid-cols-2 gap-3">
                <FI label="Salaire mensuel (FCFA)" value={form.salaire} onChange={v => setForm(p => ({ ...p, salaire: v }))} type="number" placeholder="0" />
                <div>
                  <label className="block text-xs text-[#8B949E] mb-1">Taux horaire (FCFA/h)</label>
                  <select value={form.taux_horaire} onChange={e => setForm(p => ({ ...p, taux_horaire: e.target.value }))} className={SEL}>
                    <option value="">— Non rémunéré à l&apos;heure —</option>
                    {TAUX_HORAIRES.map(t => <option key={t} value={t}>{new Intl.NumberFormat('fr-FR').format(t)} FCFA/h</option>)}
                  </select>
                </div>
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
              <button onClick={save} disabled={saving || !form.nom || !form.prenom} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#2EA043', color: '#fff' }}>
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} Enregistrer
              </button>
              <button onClick={() => { setShowForm(false); setForm(EMPTY_ENS_FORM); setPhotoFile(null); setPhotoPreview(null) }} className="px-4 py-2 rounded-lg text-xs text-[#8B949E] border border-white/[0.06]">Annuler</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {displayed.length === 0 ? (
        <div className="text-center py-12 text-[#8B949E] text-xs">Aucun enseignant enregistré.</div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Enseignant', 'Matière', 'Contact & Mobile Money', 'Rémunération', 'Statut', ''].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] text-[#8B949E] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(e => {
                const s   = STATUT_ENS[e.statut] ?? STATUT_ENS.actif
                const sel = selected?.id === e.id
                return (
                  <tr key={e.id} onClick={() => { setSelected(sel ? null : e); if (!sel) setProfil({ type: 'enseignant', data: e }) }}
                    className="border-t border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors"
                    style={sel ? { background: 'rgba(46,160,67,0.06)' } : {}}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                          {e.photo_url
                            ? <img src={e.photo_url} alt="" className="w-full h-full object-cover" />
                            : <Avatar nom={e.nom} prenom={e.prenom} photoUrl={null} size={32} />}
                        </div>
                        <p className="font-medium text-white whitespace-nowrap">{e.prenom} {e.nom}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#8B949E]">{e.matiere ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {e.telephone && <p className="text-[#8B949E] flex items-center gap-1"><Phone size={10} /> {e.telephone}</p>}
                        {e.mobile_money_type && e.mobile_money_numero && (
                          <p className="flex items-center gap-1 text-[10px]" style={{ color: '#F97316' }}>
                            <Smartphone size={10} /> {e.mobile_money_type} · {e.mobile_money_numero}
                          </p>
                        )}
                        {!e.telephone && !e.mobile_money_numero && <span className="text-[#484F58]">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {e.salaire_mensuel ? <p className="text-[#2EA043] font-semibold text-[10px]">{fmt(e.salaire_mensuel)} F/mois</p> : null}
                        {e.taux_horaire ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: '#388BFD18', color: '#388BFD' }}>
                            <Clock size={8} /> {new Intl.NumberFormat('fr-FR').format(e.taux_horaire)} F/h
                          </span>
                        ) : null}
                        {!e.salaire_mensuel && !e.taux_horaire && <span className="text-[#484F58]">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color: s.color, background: s.bg }}>{s.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={ev => { ev.stopPropagation(); del(e.id) }} className="text-[#484F58] hover:text-red-400 transition-colors">
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Detail panel ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="rounded-xl border border-white/[0.08] p-5"
            style={{ background: 'rgba(255,255,255,0.015)' }}>
            <div className="flex items-start gap-4 mb-5">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/[0.08] shrink-0">
                {selected.photo_url
                  ? <img src={selected.photo_url} alt="" className="w-full h-full object-cover" />
                  : <Avatar nom={selected.nom} prenom={selected.prenom} photoUrl={null} size={56} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-white">{selected.prenom} {selected.nom}</p>
                <p className="text-xs text-[#8B949E]">{selected.matiere ?? 'Matière non définie'}</p>
                <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ color: (STATUT_ENS[selected.statut] ?? STATUT_ENS.actif).color, background: (STATUT_ENS[selected.statut] ?? STATUT_ENS.actif).bg }}>
                  {(STATUT_ENS[selected.statut] ?? STATUT_ENS.actif).label}
                </span>
              </div>
              <button onClick={() => setSelected(null)} className="text-[#484F58] hover:text-white transition-colors p-1">
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {selected.telephone        && <InfoItem icon={Phone}      label="Téléphone"       value={selected.telephone} />}
              {selected.email            && <InfoItem icon={Mail}       label="Email"            value={selected.email} />}
              {selected.salaire_mensuel  ? <InfoItem icon={DollarSign}  label="Salaire mensuel"  value={`${fmt(selected.salaire_mensuel)} FCFA`} color="#2EA043" /> : null}
              {selected.taux_horaire     ? <InfoItem icon={Clock}       label="Taux horaire"     value={`${new Intl.NumberFormat('fr-FR').format(selected.taux_horaire)} FCFA/h`} color="#388BFD" /> : null}
              {selected.mobile_money_type && selected.mobile_money_numero && (
                <InfoItem icon={Smartphone} label={selected.mobile_money_type} value={selected.mobile_money_numero} color="#F97316" />
              )}
              {selected.banque           && <InfoItem icon={Building2}  label="Banque"           value={selected.banque} />}
              {selected.rib              && <InfoItem icon={CreditCard}  label="RIB"              value={selected.rib} />}
              {selected.numero_cnss      && <InfoItem icon={Shield}      label="N° CNSS"          value={selected.numero_cnss} color="#8B5CF6" />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

  const POSTES = ['Gardien', 'Secrétaire', 'Comptable', 'Agent de nettoyage', 'Informaticien', 'Bibliothécaire', 'Infirmier(ère)', 'Cuisinier(ère)', 'Chauffeur', 'Autre']
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
    { label: 'Total',    value: staff.length,                                    color: '#388BFD' },
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

      {/* Table */}
      {displayed.length === 0 ? (
        <div className="text-center py-12 text-[#8B949E] text-xs">Aucun agent enregistré.</div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Agent', 'Poste', 'Contact & Mobile Money', 'Salaire', 'Statut', ''].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] text-[#8B949E] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(s => {
                const sel = selected?.id === s.id
                const sc = s.statut === 'actif'
                  ? { color: '#2EA043', bg: '#2EA04318', label: 'Actif' }
                  : { color: '#8B949E', bg: '#8B949E18', label: 'Inactif' }
                return (
                  <tr key={s.id} onClick={() => { setSelected(sel ? null : s); if (!sel) setProfil({ type: 'staff', data: s as unknown as StaffFull }) }}
                    className="border-t border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors"
                    style={sel ? { background: 'rgba(46,160,67,0.06)' } : {}}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                          {s.photo_url
                            ? <img src={s.photo_url} alt="" className="w-full h-full object-cover" />
                            : <Avatar nom={s.nom} prenom={s.prenom || '?'} photoUrl={null} size={32} />}
                        </div>
                        <p className="font-medium text-white whitespace-nowrap">{s.prenom} {s.nom}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#8B949E]">{s.poste}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {s.telephone && <p className="text-[#8B949E] flex items-center gap-1"><Phone size={10} /> {s.telephone}</p>}
                        {s.mobile_money_type && s.mobile_money_numero && (
                          <p className="flex items-center gap-1 text-[10px]" style={{ color: '#F97316' }}>
                            <Smartphone size={10} /> {s.mobile_money_type} · {s.mobile_money_numero}
                          </p>
                        )}
                        {!s.telephone && !s.mobile_money_numero && <span className="text-[#484F58]">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: '#2EA043' }}>{fmt(s.salaire)} F/mois</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: sc.color, background: sc.bg }}>{sc.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={ev => { ev.stopPropagation(); del(s.id) }} className="text-[#484F58] hover:text-red-400 transition-colors">
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="rounded-xl border border-white/[0.08] p-5"
            style={{ background: 'rgba(255,255,255,0.015)' }}>
            <div className="flex items-start gap-4 mb-5">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/[0.08] shrink-0">
                {selected.photo_url
                  ? <img src={selected.photo_url} alt="" className="w-full h-full object-cover" />
                  : <Avatar nom={selected.nom} prenom={selected.prenom || '?'} photoUrl={null} size={56} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-white">{selected.prenom} {selected.nom}</p>
                <p className="text-xs text-[#8B949E]">{selected.poste}</p>
                <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={selected.statut === 'actif'
                    ? { color: '#2EA043', background: '#2EA04318' }
                    : { color: '#8B949E', background: '#8B949E18' }}>
                  {selected.statut === 'actif' ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <button onClick={() => setSelected(null)} className="text-[#484F58] hover:text-white transition-colors p-1">
                <X size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {selected.telephone         && <InfoItem icon={Phone}      label="Téléphone"      value={selected.telephone} />}
              {selected.email             && <InfoItem icon={Mail}       label="Email"           value={selected.email} />}
              {selected.salaire           ?  <InfoItem icon={DollarSign} label="Salaire mensuel" value={`${fmt(selected.salaire)} FCFA`} color="#2EA043" /> : null}
              {selected.mobile_money_type && selected.mobile_money_numero && (
                <InfoItem icon={Smartphone} label={selected.mobile_money_type} value={selected.mobile_money_numero} color="#F97316" />
              )}
              {selected.banque            && <InfoItem icon={Building2}  label="Banque"          value={selected.banque} />}
              {selected.rib               && <InfoItem icon={CreditCard} label="RIB"             value={selected.rib} />}
              {selected.numero_cnss       && <InfoItem icon={Shield}     label="N° CNSS"         value={selected.numero_cnss} color="#8B5CF6" />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
    refuse:     { color: '#F85149', bg: '#F8514918' },
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
                          <button onClick={() => updateStatut(c.id, 'refuse')}   className="px-2 py-1 rounded text-[10px] font-semibold" style={{ background: '#F8514918', color: '#F85149' }}>Refuser</button>
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
  nomEcole: string; logoUrl: string
}) {
  const { employe, poste, cnss, periode, salaire_base, primes, retenues, net, nomEcole, logoUrl } = opts
  const fmtN = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
  const brut  = salaire_base + primes
  const cnssS = retenues > 0 ? Math.round(retenues * 0.55) : 0
  const impot = retenues > 0 ? retenues - cnssS : 0

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Bulletin — ${employe} — ${periode}</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Barlow Condensed',sans-serif;color:#2B2B2B;background:#fff;font-size:13px}
.page{width:210mm;min-height:280mm;margin:0 auto;padding:10mm 12mm}
.hdr{background:#2B2B2B;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-radius:4px 4px 0 0}
.hdr-l{display:flex;align-items:center;gap:12px}
.logo{width:54px;height:54px;background:rgba(255,255,255,.1);border-radius:4px;display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:9px;color:rgba(255,255,255,.4);text-align:center;line-height:1.2;padding:4px}
.logo img{width:100%;height:100%;object-fit:contain}
.co-name{font-size:18px;font-weight:800;letter-spacing:.5px}
.co-sub{font-size:10px;color:rgba(255,255,255,.5);margin-top:2px}
.hdr-r{text-align:right}
.bul-title{font-size:22px;font-weight:800;letter-spacing:2px;text-transform:uppercase}
.bul-period{font-size:12px;color:rgba(255,255,255,.6);margin-top:3px;letter-spacing:1px}
.band{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #ddd;border-top:none}
.band-cell{padding:8px 12px;border-right:1px solid #ddd}.band-cell:last-child{border-right:none}
.bc-label{font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#999;margin-bottom:2px}
.bc-value{font-size:13px;font-weight:700}
table{width:100%;border-collapse:collapse;margin-top:14px}
thead tr{background:#2B2B2B;color:#fff}
thead th{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:8px 12px;text-align:left}
thead th:last-child{text-align:right}
.sec-row td{background:#F5F5F5;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#777;padding:5px 12px;border-top:2px solid #E0E0E0}
tbody tr td{padding:7px 12px;border-bottom:1px solid #F0F0F0}
tbody tr td:last-child{text-align:right;font-weight:600}
.neg{color:#C53030}.pos{color:#276749}
.subtotal td{font-weight:700;background:#FAFAFA;border-top:1px solid #DDD}
.totals{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.tot-box{border:1px solid #ddd;padding:10px 14px;border-radius:3px}
.tot-lbl{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#888}
.tot-val{font-size:20px;font-weight:800;margin-top:2px}
.net-box{border:2px solid #F16A1B;padding:12px 18px;margin-top:10px;border-radius:3px;background:#FFF5EF;display:flex;align-items:center;justify-content:space-between}
.net-lbl{font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#F16A1B}
.net-val{font-size:28px;font-weight:800;color:#F16A1B}
.ftr{margin-top:28px}
.ftr-date{font-size:11px;color:#666;margin-bottom:22px}
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:50px}
.sig{text-align:center}
.sig-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #2B2B2B;padding-bottom:3px;margin-bottom:44px}
.sig-name{font-size:10px;color:#666}
@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page{width:100%;padding:6mm}}
</style>
</head>
<body>
<div class="page">
<div class="hdr">
  <div class="hdr-l">
    <div class="logo">${logoUrl ? `<img src="${logoUrl}" alt="logo"/>` : 'LOGO'}</div>
    <div><div class="co-name">${nomEcole}</div><div class="co-sub">Bulletin de rémunération officiel</div></div>
  </div>
  <div class="hdr-r">
    <div class="bul-title">Bulletin de Salaire</div>
    <div class="bul-period">${periode}</div>
  </div>
</div>
<div class="band">
  <div class="band-cell"><div class="bc-label">Nom complet</div><div class="bc-value">${employe}</div></div>
  <div class="band-cell"><div class="bc-label">Poste</div><div class="bc-value">${poste || '—'}</div></div>
  <div class="band-cell"><div class="bc-label">N° CNSS</div><div class="bc-value">${cnss || '—'}</div></div>
</div>
<div class="band" style="border-top:none">
  <div class="band-cell"><div class="bc-label">Période</div><div class="bc-value">${periode}</div></div>
  <div class="band-cell"><div class="bc-label">Date d'émission</div><div class="bc-value">${new Date().toLocaleDateString('fr-FR')}</div></div>
  <div class="band-cell"><div class="bc-label">Établissement</div><div class="bc-value">${nomEcole}</div></div>
</div>
<table>
  <thead><tr><th>Désignation</th><th>Montant (FCFA)</th></tr></thead>
  <tbody>
    <tr class="sec-row"><td colspan="2">Rémunérations</td></tr>
    <tr><td>Salaire de base</td><td class="pos">${fmtN(salaire_base)}</td></tr>
    ${primes > 0 ? `<tr><td>Primes et indemnités</td><td class="pos">${fmtN(primes)}</td></tr>` : ''}
    <tr class="subtotal"><td>Salaire brut</td><td>${fmtN(brut)}</td></tr>
    ${retenues > 0 ? `
    <tr class="sec-row"><td colspan="2">Cotisations sociales</td></tr>
    <tr><td>CNSS — part salarié (8%)</td><td class="neg">- ${fmtN(cnssS)}</td></tr>
    <tr class="sec-row"><td colspan="2">Cotisations fiscales</td></tr>
    <tr><td>Impôt sur le revenu (IRPP)</td><td class="neg">- ${fmtN(impot)}</td></tr>
    <tr class="subtotal"><td>Total des retenues</td><td class="neg">- ${fmtN(retenues)}</td></tr>
    ` : ''}
  </tbody>
</table>
<div class="totals">
  <div class="tot-box"><div class="tot-lbl">Salaire brut</div><div class="tot-val">${fmtN(brut)} <span style="font-size:12px;font-weight:600">FCFA</span></div></div>
  <div class="tot-box"><div class="tot-lbl">Total retenues</div><div class="tot-val" style="color:#C53030">- ${fmtN(retenues)} <span style="font-size:12px;font-weight:600">FCFA</span></div></div>
</div>
<div class="net-box">
  <div class="net-lbl">Net à Payer</div>
  <div class="net-val">${fmtN(net)} <span style="font-size:14px;font-weight:700">FCFA</span></div>
</div>
<div class="ftr">
  <div class="ftr-date">Fait à _________________________, le ${new Date().toLocaleDateString('fr-FR')}</div>
  <div class="sigs">
    <div class="sig"><div class="sig-title">Signature de l'employeur</div><div class="sig-name">Cachet &amp; signature</div></div>
    <div class="sig"><div class="sig-title">Signature de l'employé(e)</div><div class="sig-name">${employe}</div></div>
  </div>
</div>
</div>
</body>
</html>`
}

// ── Paie ──────────────────────────────────────────────────────────────────────

function SectionPaie({ tenantId, enseignants, nomEcole }: { tenantId: string; enseignants: Enseignant[]; nomEcole: string }) {
  const [paies, setPaies] = useState<{ id: string; employe_id: string; mois: number; annee: number; salaire_base: number; primes: number; retenues: number; net: number; statut: string; created_at: string }[]>([])
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [showLogo,  setShowLogo]  = useState(false)
  const [logoUrl,   setLogoUrl]   = useState('')
  const [logoInput, setLogoInput] = useState('')
  const [form, setForm] = useState({ employe_id: '', mois: new Date().getMonth() + 1, annee: new Date().getFullYear(), salaire_base: '', primes: '0', retenues: '0' })

  const MOIS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

  const load = useCallback(async () => {
    const { data } = await supabase.from('paie_ecole').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
    setPaies((data ?? []) as typeof paies)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const saved = localStorage.getItem(`logo_${tenantId}`)
    if (saved) { setLogoUrl(saved); setLogoInput(saved) }
  }, [tenantId])

  function saveLogo() {
    setLogoUrl(logoInput)
    localStorage.setItem(`logo_${tenantId}`, logoInput)
    setShowLogo(false)
  }

  async function add() {
    if (!form.employe_id || !form.salaire_base) return
    setSaving(true)
    const base = Number(form.salaire_base), primes = Number(form.primes), retenues = Number(form.retenues)
    const net = base + primes - retenues
    await supabase.from('paie_ecole').insert({ tenant_id: tenantId, employe_id: form.employe_id, mois: form.mois, annee: form.annee, salaire_base: base, primes, retenues, net, statut: 'paye' })
    await supabase.from('transactions').insert({ tenant_id: tenantId, type: 'sortie', categorie: 'Salaires', description: `Salaire ${form.mois}/${form.annee}`, montant: net, date: new Date().toISOString().split('T')[0] })
    setForm(p => ({ ...p, employe_id: '', salaire_base: '', primes: '0', retenues: '0' }))
    setShowForm(false); load(); setSaving(false)
  }

  function printBulletin(p: typeof paies[0]) {
    const ens = enseignants.find(e => e.id === p.employe_id)
    const html = buildBulletinHTML({
      employe:      ens ? `${ens.prenom} ${ens.nom}` : '—',
      poste:        ens?.matiere ?? '—',
      cnss:         ens?.numero_cnss ?? '',
      periode:      `${MOIS[p.mois]} ${p.annee}`,
      salaire_base: p.salaire_base,
      primes:       p.primes,
      retenues:     p.retenues,
      net:          p.net,
      nomEcole,
      logoUrl,
    })
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    setTimeout(() => { w.focus(); w.print() }, 800)
  }

  const totalNet = paies.reduce((s, p) => s + p.net, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <KpiCard label="Total salaires payés" value={fmt(totalNet) + ' FCFA'} color="#2EA043" />
        <div className="flex items-center gap-2">
          <button onClick={() => setShowLogo(!showLogo)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-white/[0.08] text-[#8B949E] hover:text-white transition-colors">
            <Upload size={12} /> Logo société
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: 'linear-gradient(135deg,#2EA043,#22863a)', color: '#fff' }}>
            <Plus size={13} /> Générer bulletin
          </button>
        </div>
      </div>

      {showLogo && (
        <div className="flex items-end gap-2 p-3 rounded-xl border border-white/[0.08]" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex-1">
            <label className="block text-xs text-[#8B949E] mb-1">URL du logo (apparaîtra sur les bulletins)</label>
            <input className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder-[#484F58] focus:outline-none" placeholder="https://…" value={logoInput} onChange={e => setLogoInput(e.target.value)} />
          </div>
          <button onClick={saveLogo} className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1" style={{ background: '#2EA043', color: '#fff' }}>
            <Check size={12} /> Appliquer
          </button>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-xl border border-[#2EA043]/30 p-4 space-y-3" style={{ background: 'rgba(46,160,67,0.04)' }}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#8B949E] mb-1">Employé *</label>
                <select value={form.employe_id} onChange={e => setForm(p => ({ ...p, employe_id: e.target.value }))} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none">
                  <option value="">— Choisir —</option>
                  {enseignants.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-[#8B949E] mb-1">Mois</label>
                  <select value={form.mois} onChange={e => setForm(p => ({ ...p, mois: Number(e.target.value) }))} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none">
                    {MOIS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <FI label="Année" value={form.annee.toString()} onChange={v => setForm(p => ({ ...p, annee: Number(v) }))} type="number" />
              </div>
              <FI label="Salaire de base (FCFA) *" value={form.salaire_base} onChange={v => setForm(p => ({ ...p, salaire_base: v }))} type="number" />
              <FI label="Primes (FCFA)"   value={form.primes}   onChange={v => setForm(p => ({ ...p, primes: v }))}   type="number" />
              <FI label="Retenues (FCFA)" value={form.retenues} onChange={v => setForm(p => ({ ...p, retenues: v }))} type="number" />
              <div className="flex items-end pb-1">
                <p className="text-sm font-bold" style={{ color: '#2EA043' }}>
                  Net : {fmt((Number(form.salaire_base) || 0) + (Number(form.primes) || 0) - (Number(form.retenues) || 0))} FCFA
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={add} disabled={saving || !form.employe_id || !form.salaire_base} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#2EA043', color: '#fff' }}>
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} Payer
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-[#8B949E] border border-white/[0.06]">Annuler</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {paies.length === 0 ? (
        <div className="text-center py-12 text-[#8B949E] text-xs">Aucun bulletin de paie généré.</div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr style={{ background: 'rgba(255,255,255,0.02)' }}>{['Employé', 'Période', 'Base', 'Primes', 'Retenues', 'Net', 'Statut', ''].map(h => <th key={h} className="text-left px-4 py-2.5 text-[10px] text-[#8B949E]">{h}</th>)}</tr></thead>
            <tbody>
              {paies.map(p => {
                const ens = enseignants.find(e => e.id === p.employe_id)
                return (
                  <tr key={p.id} className="border-t border-white/[0.04] hover:bg-white/[0.01]">
                    <td className="px-4 py-2.5 text-white">{ens ? `${ens.prenom} ${ens.nom}` : '—'}</td>
                    <td className="px-4 py-2.5 text-[#8B949E]">{MOIS[p.mois]} {p.annee}</td>
                    <td className="px-4 py-2.5 text-[#8B949E]">{fmt(p.salaire_base)}</td>
                    <td className="px-4 py-2.5 text-[#2EA043]">+{fmt(p.primes)}</td>
                    <td className="px-4 py-2.5 text-[#F85149]">-{fmt(p.retenues)}</td>
                    <td className="px-4 py-2.5 font-bold text-white">{fmt(p.net)} FCFA</td>
                    <td className="px-4 py-2.5"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2EA04318] text-[#2EA043]">Payé</span></td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => printBulletin(p)} title="Imprimer le bulletin"
                        className="p-1.5 rounded-lg border border-white/[0.08] text-[#8B949E] hover:text-white hover:border-white/[0.15] transition-all">
                        <Printer size={11} />
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
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: 'linear-gradient(135deg,#388BFD,#1a6fd4)', color: '#fff' }}>
          <Plus size={13} /> Ouvrir un poste
        </button>
      </div>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-xl border border-[#388BFD]/30 p-4 space-y-3" style={{ background: 'rgba(56,139,253,0.04)' }}>
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
              <button onClick={add} disabled={saving || !form.titre} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: '#388BFD', color: '#fff' }}>
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
    await supabase.from('teacher_hours').update({ statut: 'paye' }).eq('id', h.id)
    const ens = enseignants.find(e => e.id === h.enseignant_id)
    const today = new Date().toISOString().split('T')[0]

    // Sync to trésorerie
    try {
      await supabase.from('transactions').insert({
        tenant_id: tenantId,
        type: 'sortie',
        categorie: 'Émoluments Formateurs',
        description: `Paiement heures — ${ens ? `${ens.prenom} ${ens.nom}` : 'Formateur'} (${h.heures}h · ${h.matiere ?? ''})`,
        montant: h.heures * 5000,
        date: today,
        mode_paiement: 'virement',
        source: 'teacher_hours',
        source_id: h.id,
      })
    } catch {}

    // Sync to journal comptable
    try {
      await supabase.from('journal_comptable').insert({
        tenant_id: tenantId, date: today,
        libelle: `Émoluments formateur — ${ens ? `${ens.prenom} ${ens.nom}` : ''} ${h.heures}h`,
        type: 'charge', montant_ht: h.heures * 5000, tva: 0, ca: 0,
        montant_ttc: h.heures * 5000, categorie: '641 — Rémunérations du personnel',
      })
    } catch {}

    // Notify formateur of payment
    try {
      await supabase.from('notifications').insert({
        tenant_id: tenantId,
        type: 'heures_payees',
        titre: "Paiement d'heures effectué",
        message: `Vos ${h.heures}h (${h.matiere ?? ''}) ont été payées.`,
        destinataire_role: 'FORMATEUR',
        enseignant_id: h.enseignant_id,
        read: false,
      })
    } catch {}

    showToast('Marqué payé — trésorerie mise à jour')
    setSaving(null); load()
  }

  const displayed = filter === 'tous' ? heures : heures.filter(h => h.statut === filter)
  const STATUT_CFG: Record<string, { label: string; color: string; bg: string }> = {
    declare:   { label: 'Déclaré',  color: '#F0A30A', bg: '#F0A30A18' },
    validated: { label: 'Validé',   color: '#388BFD', bg: '#388BFD18' },
    paye:      { label: 'Payé',     color: '#2EA043', bg: '#2EA04318' },
  }

  const kpis = [
    { label: 'En attente', value: heures.filter(h => h.statut === 'declare').length,   color: '#F0A30A' },
    { label: 'Validées',   value: heures.filter(h => h.statut === 'validated').length, color: '#388BFD' },
    { label: 'Payées',     value: heures.filter(h => h.statut === 'paye').length,      color: '#2EA043' },
    { label: 'Total heures', value: heures.reduce((s, h) => s + h.heures, 0),          color: '#8B5CF6' },
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
          {subTab === 'paie'        && tenantId && <SectionPaie              tenantId={tenantId} enseignants={enseignants} nomEcole={nomEcole} />}
          {subTab === 'heures'      && tenantId && <SectionHeuresFormateurs  tenantId={tenantId} enseignants={enseignants} />}
          {subTab === 'recrutement' && tenantId && <SectionRecrutement       tenantId={tenantId} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
