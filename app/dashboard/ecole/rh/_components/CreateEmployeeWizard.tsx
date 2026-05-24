'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Check, ChevronRight, ChevronLeft, User, Briefcase,
  Shield, DollarSign, FileText, CheckCircle2, Camera,
  Upload, Loader2, UserCheck,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Field helpers ─────────────────────────────────────────────────────────────

function WFI({
  label, value, onChange, type = 'text', placeholder = '',
  required = false, className = '',
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; required?: boolean; className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-xs text-[var(--text-secondary)] mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[#00b9a7] transition-colors" />
    </div>
  )
}

function WSel({
  label, value, onChange, options, required = false, className = '',
}: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; required?: boolean; className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-xs text-[var(--text-secondary)] mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[#101729] focus:outline-none focus:border-[#00b9a7] transition-colors">
        <option value="">— Choisir —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ── Config ────────────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Identité',   icon: User         },
  { label: 'Poste',      icon: Briefcase    },
  { label: 'Accès',      icon: Shield       },
  { label: 'Salaire',    icon: DollarSign   },
  { label: 'Documents',  icon: FileText     },
  { label: 'Validation', icon: CheckCircle2 },
]

const ROLES_LIST = [
  { id: 'DIRECTION_GENERALE', label: 'Direction Générale' },
  { id: 'RAF',                label: 'RAF / Finance'      },
  { id: 'RH_PAIE',            label: 'RH & Paie'         },
  { id: 'DAAC',               label: 'DAAC'               },
  { id: 'SCOLARITE',          label: 'Scolarité'          },
  { id: 'FORMATEUR',          label: 'Formateur'          },
  { id: 'DTI',                label: 'DTI / Informatique' },
]

const PERMS_LIST = [
  { id: 'voir_finances',        label: 'Voir les finances'     },
  { id: 'modifier_finances',    label: 'Modifier finances'     },
  { id: 'valider_paiements',    label: 'Valider paiements'    },
  { id: 'modifier_notes',       label: 'Modifier notes'       },
  { id: 'deliberation',         label: 'Délibération'         },
  { id: 'telecharger_rapports', label: 'Télécharger rapports' },
  { id: 'gerer_utilisateurs',   label: 'Gérer utilisateurs'   },
  { id: 'creer_employes',       label: 'Créer employés'       },
  { id: 'supprimer_employes',   label: 'Supprimer employés'   },
  { id: 'voir_tresorerie',      label: 'Voir trésorerie'      },
  { id: 'retrait_argent',       label: "Retrait d'argent"     },
]

const BANQUES     = ['BGFI Bank', 'LCB Bank', 'Banque Postale', 'UCB', 'Crédit du Congo', 'Ecobank Congo', 'Société Générale Congo', 'Autre']
const MM_TYPES    = ['MTN Money', 'Airtel Money', 'Moov Money']
const MODES_PAIE  = ['banque', 'mobile_money', 'especes', 'cheque', 'virement'] as const

const INIT_ROLES  = Object.fromEntries(ROLES_LIST.map(r => [r.id, false]))
const INIT_PERMS  = Object.fromEntries(PERMS_LIST.map(p => [p.id, false]))

// ── Main component ────────────────────────────────────────────────────────────

export function CreateEmployeeWizard({
  tenantId, onClose, onSuccess,
}: {
  tenantId: string; onClose: () => void; onSuccess: () => void
}) {
  const [step,   setStep]   = useState(1)
  const [saving, setSaving] = useState(false)
  const [done,   setDone]   = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  // Photo (kept outside form to avoid File serialisation issues)
  const [photoFile,    setPhotoFile]    = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  // Form state grouped by step
  const [id_,   setId]   = useState({ nom: '', postnom: '', prenom: '', sexe: '', date_naissance: '', nationalite: 'Congolaise', situation_matrimoniale: '', nb_enfants: '0', telephone: '', telephone2: '', email_pro: '', adresse: '', ville: '', pays: 'Congo' })
  const [post_,  setPost]  = useState({ poste: '', departement: '', type_employe: 'permanent', statut: 'actif', date_recrutement: '', date_debut_contrat: '', date_fin_contrat: '', periode_essai: '3', matieres: '', filieres: '', heures_prevues: '' })
  const [acc_,   setAcc]   = useState({ email_connexion: '', roles: { ...INIT_ROLES } as Record<string, boolean>, permissions: { ...INIT_PERMS } as Record<string, boolean> })
  const [sal_,   setSal]   = useState({ salaire_base: '', taux_horaire: '', prime_logement: '0', prime_transport: '0', prime_risque: '0', prime_rendement: '0', numero_cnss: '', numero_fiscal: '', mode_paiement: 'banque', banque: '', rib: '', mobile_money_type: '', mobile_money_numero: '' })

  const pct = ((step - 1) / (STEPS.length - 1)) * 100

  const salaireBrut = (Number(sal_.salaire_base) || 0)
    + (Number(sal_.prime_logement) || 0) + (Number(sal_.prime_transport) || 0)
    + (Number(sal_.prime_risque) || 0)   + (Number(sal_.prime_rendement) || 0)
  const fmtN = (n: number) => new Intl.NumberFormat('fr-FR').format(n)

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function toggleRole(id: string) { setAcc(p => ({ ...p, roles: { ...p.roles, [id]: !p.roles[id] } })) }
  function togglePerm(id: string) { setAcc(p => ({ ...p, permissions: { ...p.permissions, [id]: !p.permissions[id] } })) }

  async function submit() {
    if (!id_.nom || !id_.prenom || !post_.poste) return
    setSaving(true)
    setErrMsg(null)

    // Upload photo
    let photoUrl: string | null = null
    if (photoFile) {
      const ext  = photoFile.name.split('.').pop() ?? 'jpg'
      const path = `employes/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, photoFile, { upsert: true })
      if (!error) photoUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
    }

    // Insert employee
    const { data: emp, error: empErr } = await supabase.from('employes').insert({
      tenant_id:              tenantId,
      nom:                    id_.nom.trim(),
      postnom:                id_.postnom.trim()   || null,
      prenom:                 id_.prenom.trim(),
      sexe:                   id_.sexe             || null,
      date_naissance:         id_.date_naissance   || null,
      nationalite:            id_.nationalite       || null,
      situation_matrimoniale: id_.situation_matrimoniale || null,
      nb_enfants:             Number(id_.nb_enfants) || 0,
      telephone:              id_.telephone         || null,
      telephone2:             id_.telephone2        || null,
      email_pro:              id_.email_pro         || null,
      adresse:                id_.adresse           || null,
      ville:                  id_.ville             || null,
      pays:                   id_.pays              || null,
      photo_url:              photoUrl,
      poste:                  post_.poste.trim(),
      departement:            post_.departement     || null,
      type_employe:           post_.type_employe,
      statut:                 post_.statut,
      date_recrutement:       post_.date_recrutement    || null,
      date_debut_contrat:     post_.date_debut_contrat  || null,
      date_fin_contrat:       post_.date_fin_contrat    || null,
      periode_essai:          Number(post_.periode_essai) || null,
      matieres:               post_.matieres ? post_.matieres.split(',').map(s => s.trim()).filter(Boolean) : null,
      filieres:               post_.filieres ? post_.filieres.split(',').map(s => s.trim()).filter(Boolean) : null,
      heures_prevues:         post_.heures_prevues ? Number(post_.heures_prevues) : null,
      email_connexion:        acc_.email_connexion  || null,
      roles_systeme:          acc_.roles,
      permissions:            acc_.permissions,
      salaire_base:           Number(sal_.salaire_base) || 0,
      taux_horaire:           sal_.taux_horaire ? Number(sal_.taux_horaire) : null,
      prime_logement:         Number(sal_.prime_logement)  || 0,
      prime_transport:        Number(sal_.prime_transport) || 0,
      prime_risque:           Number(sal_.prime_risque)    || 0,
      prime_rendement:        Number(sal_.prime_rendement) || 0,
      numero_cnss:            sal_.numero_cnss       || null,
      numero_fiscal:          sal_.numero_fiscal     || null,
      mode_paiement:          sal_.mode_paiement,
      banque:                 sal_.banque            || null,
      rib:                    sal_.rib               || null,
      mobile_money_type:      sal_.mobile_money_type  || null,
      mobile_money_numero:    sal_.mobile_money_numero || null,
    }).select().single()

    if (empErr || !emp) {
      setSaving(false)
      setErrMsg(empErr?.message ?? 'Erreur lors de la création. Vérifiez que la migration 038 a été exécutée dans Supabase.')
      return
    }

    const today = new Date().toISOString().split('T')[0]

    // Auto-link: journal comptable (compte tiers RH)
    try {
      await supabase.from('journal_comptable').insert({
        tenant_id:   tenantId,
        date:        today,
        libelle:     `Création compte tiers RH — ${id_.prenom} ${id_.nom} (${post_.poste})`,
        type:        'charge',
        montant_ht:  salaireBrut,
        tva:         0, ca: 0,
        montant_ttc: salaireBrut,
        categorie:   '641 — Rémunérations du personnel',
      })
    } catch {}

    // Notification direction générale
    try {
      await supabase.from('notifications').insert({
        tenant_id:         tenantId,
        type:              'nouvel_employe',
        titre:             `Nouvel employé — ${id_.prenom} ${id_.nom}`,
        message:           `${post_.poste} · ${post_.departement || 'N/A'} · Brut : ${fmtN(salaireBrut)} FCFA/mois`,
        destinataire_role: 'DIRECTION_GENERALE',
        read:              false,
      })
    } catch {}

    setSaving(false)
    setDone(true)
    setTimeout(() => { onSuccess(); onClose() }, 2000)
  }

  const SEC = 'text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3'
  const isFormateur = post_.type_employe === 'formateur' || post_.type_employe === 'vacation'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="relative w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', maxHeight: '92vh' }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="shrink-0 px-6 pt-5 pb-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-[#101729]">Créer un employé</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">Étape {step} / {STEPS.length} — {STEPS[step - 1].label}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[#101729] transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 rounded-full overflow-hidden" style={{ background: '#E5E7EB' }}>
            <motion.div className="h-full rounded-full"
              style={{ background: '#00b9a7' }}
              animate={{ width: `${pct}%` }} transition={{ duration: 0.3 }} />
          </div>

          {/* Step indicators */}
          <div className="flex items-start justify-between mt-3 px-1">
            {STEPS.map((s, i) => {
              const n = i + 1; const Icon = s.icon
              const past = n < step; const active = n === step
              return (
                <div key={n} className="flex flex-col items-center gap-1">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
                    style={{
                      background: past ? '#2EA043' : active ? 'rgba(46,160,67,0.12)' : '#F3F4F6',
                      border: `2px solid ${past || active ? '#2EA043' : 'transparent'}`,
                    }}>
                    {past ? <Check size={12} className="text-white" />
                           : <Icon size={11} style={{ color: active ? '#2EA043' : '#64748B' }} />}
                  </div>
                  <span className="text-[9px] hidden sm:block text-center leading-tight max-w-[52px]"
                    style={{ color: active ? '#2EA043' : past ? '#8B949E' : '#64748B' }}>
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div key={step}
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>

              {/* STEP 1 — Identité ─────────────────────────────────────────── */}
              {step === 1 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full overflow-hidden shrink-0 border-2 border-[var(--border)] bg-gray-100 flex items-center justify-center">
                      {photoPreview
                        ? <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                        : <Camera size={24} className="text-[var(--text-secondary)]" />}
                    </div>
                    <div>
                      <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[#101729] hover:border-[#00b9a7]/40 transition-all">
                        <Upload size={12} /> {photoPreview ? 'Changer la photo' : 'Ajouter une photo'}
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                      </label>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-1">JPG, PNG · max 2 Mo</p>
                    </div>
                  </div>

                  <div>
                    <p className={SEC}>Identité civile</p>
                    <div className="grid grid-cols-3 gap-3">
                      <WFI label="Prénom"        value={id_.prenom}  onChange={v => setId(p => ({ ...p, prenom: v }))}  required />
                      <WFI label="Postnom"        value={id_.postnom} onChange={v => setId(p => ({ ...p, postnom: v }))} />
                      <WFI label="Nom de famille" value={id_.nom}     onChange={v => setId(p => ({ ...p, nom: v }))}     required />
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <WSel label="Sexe" value={id_.sexe} onChange={v => setId(p => ({ ...p, sexe: v }))}
                        options={[{ value: 'M', label: 'Masculin' }, { value: 'F', label: 'Féminin' }]} />
                      <WFI label="Date de naissance" value={id_.date_naissance} onChange={v => setId(p => ({ ...p, date_naissance: v }))} type="date" />
                      <WFI label="Nationalité" value={id_.nationalite} onChange={v => setId(p => ({ ...p, nationalite: v }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <WSel label="Situation matrimoniale" value={id_.situation_matrimoniale}
                        onChange={v => setId(p => ({ ...p, situation_matrimoniale: v }))}
                        options={[
                          { value: 'celibataire', label: 'Célibataire' },
                          { value: 'marie',       label: 'Marié(e)'    },
                          { value: 'divorce',     label: 'Divorcé(e)'  },
                          { value: 'veuf',        label: 'Veuf/Veuve'  },
                        ]} />
                      <WFI label="Nombre d'enfants" value={id_.nb_enfants} onChange={v => setId(p => ({ ...p, nb_enfants: v }))} type="number" />
                    </div>
                  </div>

                  <div>
                    <p className={SEC}>Coordonnées</p>
                    <div className="grid grid-cols-2 gap-3">
                      <WFI label="Téléphone principal"  value={id_.telephone}  onChange={v => setId(p => ({ ...p, telephone: v }))}  placeholder="+243 …" />
                      <WFI label="Téléphone secondaire" value={id_.telephone2} onChange={v => setId(p => ({ ...p, telephone2: v }))} />
                      <WFI label="Email professionnel"  value={id_.email_pro}  onChange={v => setId(p => ({ ...p, email_pro: v }))}  type="email" className="col-span-2" />
                      <WFI label="Adresse" value={id_.adresse} onChange={v => setId(p => ({ ...p, adresse: v }))} className="col-span-2" />
                      <WFI label="Ville"   value={id_.ville}   onChange={v => setId(p => ({ ...p, ville: v }))} />
                      <WFI label="Pays"    value={id_.pays}    onChange={v => setId(p => ({ ...p, pays: v }))} />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 — Poste ────────────────────────────────────────────── */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <p className={SEC}>Fonction</p>
                    <div className="grid grid-cols-2 gap-3">
                      <WFI label="Poste / Fonction"      value={post_.poste}       onChange={v => setPost(p => ({ ...p, poste: v }))}       required />
                      <WFI label="Département / Service" value={post_.departement} onChange={v => setPost(p => ({ ...p, departement: v }))} />
                      <WSel label="Type d'employé" value={post_.type_employe} onChange={v => setPost(p => ({ ...p, type_employe: v }))} required
                        options={[
                          { value: 'permanent',   label: 'Permanent'   },
                          { value: 'temporaire',  label: 'Temporaire'  },
                          { value: 'prestataire', label: 'Prestataire' },
                          { value: 'formateur',   label: 'Formateur'   },
                          { value: 'consultant',  label: 'Consultant'  },
                          { value: 'stage',       label: 'Stagiaire'   },
                          { value: 'vacation',    label: 'Vacataire'   },
                        ]} />
                      <WSel label="Statut" value={post_.statut} onChange={v => setPost(p => ({ ...p, statut: v }))}
                        options={[
                          { value: 'actif',    label: 'Actif'    },
                          { value: 'suspendu', label: 'Suspendu' },
                          { value: 'conge',    label: 'En congé' },
                        ]} />
                    </div>
                  </div>

                  <div>
                    <p className={SEC}>Dates contractuelles</p>
                    <div className="grid grid-cols-3 gap-3">
                      <WFI label="Date de recrutement" value={post_.date_recrutement}   onChange={v => setPost(p => ({ ...p, date_recrutement: v }))}   type="date" />
                      <WFI label="Début contrat"        value={post_.date_debut_contrat} onChange={v => setPost(p => ({ ...p, date_debut_contrat: v }))} type="date" />
                      <WFI label="Fin contrat"          value={post_.date_fin_contrat}   onChange={v => setPost(p => ({ ...p, date_fin_contrat: v }))}   type="date" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <WFI label="Période d'essai (mois)" value={post_.periode_essai} onChange={v => setPost(p => ({ ...p, periode_essai: v }))} type="number" />
                    </div>
                  </div>

                  {isFormateur && (
                    <div>
                      <p className={SEC}>Informations formateur</p>
                      <div className="grid grid-cols-2 gap-3">
                        <WFI label="Matières enseignées (séparées par virgule)"
                          value={post_.matieres} onChange={v => setPost(p => ({ ...p, matieres: v }))}
                          placeholder="Mathématiques, Physique…" className="col-span-2" />
                        <WFI label="Filières" value={post_.filieres} onChange={v => setPost(p => ({ ...p, filieres: v }))} placeholder="Informatique, Gestion…" />
                        <WFI label="Heures prévues / semaine" value={post_.heures_prevues} onChange={v => setPost(p => ({ ...p, heures_prevues: v }))} type="number" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3 — Accès ────────────────────────────────────────────── */}
              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <p className={SEC}>Compte système</p>
                    <WFI label="Email de connexion" value={acc_.email_connexion}
                      onChange={v => setAcc(p => ({ ...p, email_connexion: v }))}
                      type="email" placeholder="nom@organisation.com" />
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1.5">Laissez vide si l'employé n'a pas accès au système.</p>
                  </div>

                  <div>
                    <p className={SEC}>Rôles dans le tableau de bord</p>
                    <div className="grid grid-cols-2 gap-2">
                      {ROLES_LIST.map(r => (
                        <div key={r.id} onClick={() => toggleRole(r.id)}
                          className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all"
                          style={acc_.roles[r.id]
                            ? { borderColor: '#2EA043', background: 'rgba(46,160,67,0.06)' }
                            : { borderColor: '#E5E7EB' }}>
                          <div className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
                            style={{ background: acc_.roles[r.id] ? '#2EA043' : '#E5E7EB' }}>
                            {acc_.roles[r.id] && <Check size={10} className="text-white" />}
                          </div>
                          <span className="text-xs" style={{ color: acc_.roles[r.id] ? '#101729' : '#6B7280' }}>{r.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className={SEC}>Permissions avancées</p>
                    <div className="grid grid-cols-2 gap-2">
                      {PERMS_LIST.map(p => (
                        <div key={p.id} onClick={() => togglePerm(p.id)}
                          className="flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all"
                          style={acc_.permissions[p.id]
                            ? { borderColor: '#00b9a7', background: 'rgba(0,185,167,0.06)' }
                            : { borderColor: '#E5E7EB' }}>
                          <div className="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 transition-all"
                            style={{ background: acc_.permissions[p.id] ? '#00b9a7' : '#E5E7EB' }}>
                            {acc_.permissions[p.id] && <Check size={9} className="text-white" />}
                          </div>
                          <span className="text-xs" style={{ color: acc_.permissions[p.id] ? '#101729' : '#6B7280' }}>{p.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4 — Salaire ──────────────────────────────────────────── */}
              {step === 4 && (
                <div className="space-y-5">
                  <div>
                    <p className={SEC}>Rémunération</p>
                    <div className="grid grid-cols-2 gap-3">
                      <WFI label="Salaire de base (FCFA)" value={sal_.salaire_base} onChange={v => setSal(p => ({ ...p, salaire_base: v }))} type="number" required />
                      {isFormateur && (
                        <WFI label="Taux horaire (FCFA/h)" value={sal_.taux_horaire} onChange={v => setSal(p => ({ ...p, taux_horaire: v }))} type="number" />
                      )}
                      <WFI label="Prime logement (FCFA)"  value={sal_.prime_logement}  onChange={v => setSal(p => ({ ...p, prime_logement: v }))}  type="number" />
                      <WFI label="Prime transport (FCFA)" value={sal_.prime_transport} onChange={v => setSal(p => ({ ...p, prime_transport: v }))} type="number" />
                      <WFI label="Prime de risque (FCFA)" value={sal_.prime_risque}    onChange={v => setSal(p => ({ ...p, prime_risque: v }))}    type="number" />
                      <WFI label="Prime rendement (FCFA)" value={sal_.prime_rendement} onChange={v => setSal(p => ({ ...p, prime_rendement: v }))} type="number" />
                    </div>
                    <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(46,160,67,0.06)', border: '1px solid rgba(46,160,67,0.15)' }}>
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Salaire brut estimé</p>
                      <p className="text-xl font-bold mt-1" style={{ color: '#2EA043' }}>
                        {fmtN(salaireBrut)} <span className="text-sm font-normal">FCFA</span>
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className={SEC}>Fiscalité & Protection sociale</p>
                    <div className="grid grid-cols-2 gap-3">
                      <WFI label="Numéro CNSS"      value={sal_.numero_cnss}   onChange={v => setSal(p => ({ ...p, numero_cnss: v }))}   placeholder="XXXXXXXXXX" />
                      <WFI label="Numéro fiscal NIF" value={sal_.numero_fiscal} onChange={v => setSal(p => ({ ...p, numero_fiscal: v }))} />
                    </div>
                  </div>

                  <div>
                    <p className={SEC}>Mode de paiement</p>
                    <div className="flex gap-2 flex-wrap mb-3">
                      {MODES_PAIE.map(m => (
                        <button key={m} type="button" onClick={() => setSal(p => ({ ...p, mode_paiement: m }))}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                          style={sal_.mode_paiement === m
                            ? { background: '#2EA043', color: '#fff' }
                            : { background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' }}>
                          {m.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                    {sal_.mode_paiement === 'banque' && (
                      <div className="grid grid-cols-2 gap-3">
                        <WSel label="Banque" value={sal_.banque} onChange={v => setSal(p => ({ ...p, banque: v }))}
                          options={BANQUES.map(b => ({ value: b, label: b }))} />
                        <WFI label="RIB / N° de compte" value={sal_.rib} onChange={v => setSal(p => ({ ...p, rib: v }))} />
                      </div>
                    )}
                    {sal_.mode_paiement === 'mobile_money' && (
                      <div className="grid grid-cols-2 gap-3">
                        <WSel label="Opérateur" value={sal_.mobile_money_type} onChange={v => setSal(p => ({ ...p, mobile_money_type: v }))}
                          options={MM_TYPES.map(t => ({ value: t, label: t }))} />
                        <WFI label="Numéro" value={sal_.mobile_money_numero} onChange={v => setSal(p => ({ ...p, mobile_money_numero: v }))} placeholder="06XXXXXXXX" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 5 — Documents ────────────────────────────────────────── */}
              {step === 5 && (
                <div className="space-y-3">
                  <p className="text-xs text-[var(--text-secondary)]">Documents attachés au dossier et stockés de manière sécurisée.</p>
                  {[
                    { label: "Pièce d'identité", hint: 'CNI, carte de séjour · PDF ou image' },
                    { label: 'Passeport',         hint: 'Format PDF ou image'                 },
                    { label: 'CV',                hint: 'Format PDF'                          },
                    { label: 'Diplôme(s)',         hint: 'PDF ou images scannées'              },
                    { label: 'Contrat signé',      hint: 'PDF signé'                          },
                    { label: 'Certificats',        hint: 'Formations, habilitations'          },
                  ].map(doc => (
                    <label key={doc.label}
                      className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] cursor-pointer hover:border-[#00b9a7]/30 transition-all group"
                      style={{ background: '#FFFFFF' }}>
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(56,139,253,0.1)' }}>
                        <FileText size={16} style={{ color: '#DC2626' }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#101729]">{doc.label}</p>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{doc.hint}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[var(--text-secondary)] group-hover:text-[#101729] transition-colors">
                        <Upload size={13} /><span className="text-xs">Choisir</span>
                      </div>
                      <input type="file" accept=".pdf,image/*" className="hidden" />
                    </label>
                  ))}
                  <p className="text-[10px] text-[var(--text-secondary)]">Stockage de documents disponible dans une prochaine mise à jour.</p>
                </div>
              )}

              {/* STEP 6 — Validation ───────────────────────────────────────── */}
              {step === 6 && (
                <div className="space-y-5">
                  {done ? (
                    <div className="flex flex-col items-center justify-center py-14 gap-4">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220 }}
                        className="w-16 h-16 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(46,160,67,0.15)' }}>
                        <CheckCircle2 size={32} style={{ color: '#2EA043' }} />
                      </motion.div>
                      <div className="text-center">
                        <p className="text-base font-bold text-[#101729]">Employé créé avec succès !</p>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">Dossier RH · Journal comptable · Direction notifiée</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className={SEC}>Récapitulatif du dossier</p>

                      <div className="rounded-xl p-4" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center">
                            {photoPreview
                              ? <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                              : <User size={18} className="text-[var(--text-secondary)]" />}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-[#101729]">
                              {[id_.prenom, id_.postnom, id_.nom].filter(Boolean).join(' ')}
                            </p>
                            <p className="text-xs text-[var(--text-secondary)]">
                              {post_.poste}{post_.departement ? ` · ${post_.departement}` : ''}
                            </p>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                            style={{ background: '#2EA04318', color: '#2EA043' }}>
                            {post_.type_employe}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2.5">
                        {[
                          { l: 'Téléphone',    v: id_.telephone || '—'                                },
                          { l: 'Email',         v: id_.email_pro || '—'                                },
                          { l: 'Statut',        v: post_.statut                                        },
                          { l: 'Salaire brut',  v: `${fmtN(salaireBrut)} FCFA`                        },
                          { l: 'Paiement',      v: sal_.mode_paiement.replace('_', ' ')               },
                          { l: 'N° CNSS',       v: sal_.numero_cnss || '—'                            },
                          { l: 'Rôles actifs',  v: `${Object.values(acc_.roles).filter(Boolean).length} rôle(s)` },
                          { l: 'Début contrat', v: post_.date_debut_contrat
                              ? new Date(post_.date_debut_contrat + 'T00:00:00').toLocaleDateString('fr-FR')
                              : '—'                                                                    },
                          { l: 'Nationalité',   v: id_.nationalite || '—'                             },
                        ].map(({ l, v }) => (
                          <div key={l} className="p-3 rounded-lg"
                            style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                            <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider">{l}</p>
                            <p className="text-xs font-semibold text-[#101729] mt-0.5 truncate capitalize">{v}</p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-xl p-4"
                        style={{ background: 'rgba(0,185,167,0.05)', border: '1px solid rgba(0,185,167,0.12)' }}>
                        <p className="text-xs font-semibold text-[#00b9a7] mb-2">Workflow automatique à la création</p>
                        <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
                          <li>✓ Dossier enregistré dans RH & Paie</li>
                          <li>✓ Compte tiers créé en Comptabilité (641 — Rémunérations du personnel)</li>
                          <li>✓ Notification envoyée à la Direction Générale</li>
                          <li style={{ color: acc_.email_connexion ? '#8B949E' : '#64748B' }}>
                            {acc_.email_connexion ? '✓ Email de connexion configuré' : '○ Aucun compte système (email non renseigné)'}
                          </li>
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        {!done && (
          <div className="shrink-0 px-6 py-4 border-t border-[var(--border)]">
            {errMsg && (
              <div className="mb-3 px-4 py-3 rounded-xl text-xs font-medium" style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.25)', color: '#DC2626' }}>
                ⚠ {errMsg}
              </div>
            )}
          <div className="flex items-center justify-between">
            <button onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs text-[var(--text-secondary)] border border-[var(--border)] hover:text-[#101729] transition-colors">
              <ChevronLeft size={13} /> {step > 1 ? 'Précédent' : 'Annuler'}
            </button>

            <span className="text-[10px] text-[var(--text-secondary)]">{step} / {STEPS.length}</span>

            {step < STEPS.length ? (
              <button onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold"
                style={{ background: '#22863a', color: '#fff' }}>
                Suivant <ChevronRight size={13} />
              </button>
            ) : (
              <button onClick={submit} disabled={saving || !id_.nom || !id_.prenom || !post_.poste}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
                style={{ background: '#22863a', color: '#fff' }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={13} />}
                {saving ? 'Création en cours…' : "Créer l'employé"}
              </button>
            )}
          </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
