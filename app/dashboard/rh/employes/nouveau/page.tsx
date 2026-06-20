'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, Save, User, MapPin, FileText, Building2,
  Briefcase, DollarSign, Gift, Star, Shield, Receipt, CreditCard,
  Folder, Heart, Sparkles, AlertCircle, CheckCircle2, Info,
} from 'lucide-react'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { getCountryConfig } from '@/lib/countries'
import type { CodePays } from '@/lib/countries/types'
import type { TailleEntreprise } from '@/lib/plans'
import {
  DOSSIER_INIT,
  AVANTAGES_CATALOGUE,
  type DossierEmploye,
  type AvantageNature,
} from '@/components/rh/EmployeeWizard/types'
import { WizardNavMobile, WizardNavDesktop } from '@/components/rh/EmployeeWizard/WizardNav'
import type { WizardStep }                   from '@/components/rh/EmployeeWizard/WizardNav'
import { LivePayPreview }  from '@/components/rh/EmployeeWizard/LivePayPreview'
import { PrimesLibrary }   from '@/components/rh/EmployeeWizard/PrimesLibrary'
import { MIAAScoring }     from '@/components/rh/EmployeeWizard/MIAAScoring'
import { ConformityBadge } from '@/components/rh/EmployeeWizard/ConformityBadge'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function planFrom(taille: string | null): TailleEntreprise {
  if (taille === 'pme' || taille === 'grande') return taille
  return 'tpe'
}

function req(val: string | number) {
  return typeof val === 'string' ? val.trim().length > 0 : val > 0
}

// ─── Step definitions ─────────────────────────────────────────────────────────

function buildSteps(plan: TailleEntreprise): WizardStep[] {
  const show = (plans: TailleEntreprise[]) => plans.includes(plan)
  return [
    { id: 1,  label: 'Identité',      icon: '👤', visible: true,              required: true  },
    { id: 2,  label: 'Coordonnées',   icon: '📍', visible: true,              required: false },
    { id: 3,  label: 'Contrat',       icon: '📄', visible: true,              required: true  },
    { id: 4,  label: 'Organisation',  icon: '🏢', visible: true,              required: false },
    { id: 5,  label: 'Poste',         icon: '💼', visible: true,              required: true  },
    { id: 6,  label: 'Salaire',       icon: '💰', visible: true,              required: true  },
    { id: 7,  label: 'Primes',        icon: '🎁', visible: true,              required: false },
    { id: 8,  label: 'Avantages',     icon: '⭐', visible: show(['pme','grande']), required: false },
    { id: 9,  label: 'CNSS',          icon: '🛡️', visible: true,              required: false },
    { id: 10, label: 'Fiscalité',     icon: '🧾', visible: true,              required: false },
    { id: 11, label: 'Banque',        icon: '💳', visible: true,              required: false },
    { id: 12, label: 'Documents',     icon: '📁', visible: show(['pme','grande']), required: false },
    { id: 13, label: 'Médical',       icon: '❤️', visible: show(['pme','grande']), required: false },
    { id: 14, label: 'MIAA+',         icon: '✨', visible: show(['pme','grande']), required: false },
  ]
}

// ─── Field helpers ────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, type = 'text', disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="input text-sm disabled:bg-slate-50 disabled:text-slate-400"
    />
  )
}

function SelectInput({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="input text-sm">
      {children}
    </select>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHead({ icon, label, desc }: { icon: React.ReactNode; label: string; desc?: string }) {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-5">
      <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-bold text-slate-800">{label}</h2>
        {desc && <p className="text-xs text-slate-400">{desc}</p>}
      </div>
    </div>
  )
}

// ─── Score MIAA state ─────────────────────────────────────────────────────────

interface ScoreData {
  score:           number
  niveau:          'vert' | 'orange' | 'rouge'
  items:           Array<{ label: string; points: number; max: number; ok: boolean; detail?: string }>
  alertes:         string[]
  recommandations: string[]
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export default function NouvelEmployePage() {
  const router            = useRouter()
  const { tenant }        = useTenantContext()
  const plan              = planFrom(tenant?.taille ?? null)
  const codePays          = (tenant?.pays ?? 'CG') as CodePays
  const cfg               = useMemo(() => getCountryConfig(codePays), [codePays])
  const smig              = useMemo(() => ({ montant: cfg.smig }), [cfg])
  const steps             = useMemo(() => buildSteps(plan), [plan])
  const visibleSteps      = useMemo(() => steps.filter(s => s.visible), [steps])

  const [dossier, setDossier]           = useState<DossierEmploye>({ ...DOSSIER_INIT, codePays })
  const [currentStep, setCurrentStep]   = useState<number>(1)
  const [completedSteps, setCompleted]  = useState<Set<number>>(new Set())
  const [submitting, setSubmitting]     = useState(false)
  const [createdId, setCreatedId]       = useState<string | null>(null)
  const [scoreData, setScoreData]       = useState<ScoreData | null>(null)
  const [submitError, setSubmitError]   = useState<string | null>(null)

  const update = useCallback(<K extends keyof DossierEmploye>(key: K, val: DossierEmploye[K]) => {
    setDossier(d => ({ ...d, [key]: val }))
  }, [])

  function markDone(id: number) {
    setCompleted(prev => { const s = new Set(prev); s.add(id); return s })
  }

  function goTo(step: number) {
    if (visibleSteps.some(s => s.id === step)) setCurrentStep(step)
  }

  function next() {
    markDone(currentStep)
    const idx  = visibleSteps.findIndex(s => s.id === currentStep)
    const next = visibleSteps[idx + 1]
    if (next) setCurrentStep(next.id)
  }

  function prev() {
    const idx  = visibleSteps.findIndex(s => s.id === currentStep)
    const prev = visibleSteps[idx - 1]
    if (prev) setCurrentStep(prev.id)
  }

  const isFirstStep = visibleSteps[0]?.id === currentStep
  const isLastStep  = visibleSteps[visibleSteps.length - 1]?.id === currentStep

  // ── Validation step 1 ──────────────────────────────────────────────────────
  function canProceed(): boolean {
    if (currentStep === 1) return req(dossier.nom)
    if (currentStep === 3) return req(dossier.contrat)
    if (currentStep === 5) return req(dossier.poste)
    if (currentStep === 6) return dossier.salaire_base > 0
    return true
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    markDone(currentStep)
    setSubmitting(true)
    setSubmitError(null)

    const body = {
      nom:                    dossier.nom,
      sexe:                   dossier.sexe || null,
      date_naissance:         dossier.date_naissance || null,
      lieu_naissance:         dossier.lieu_naissance || null,
      nationalite:            dossier.nationalite || null,
      situation_matrimoniale: dossier.situation_matrimoniale || null,
      nb_enfants:             dossier.nb_enfants,
      photo_url:              dossier.photo_url || null,
      adresse:                dossier.adresse || null,
      pays:                   dossier.pays || codePays,
      region:                 dossier.region || null,
      ville:                  dossier.ville || null,
      quartier:               dossier.quartier || null,
      telephone:              dossier.telephone || null,
      telephone2:             dossier.telephone2 || null,
      email_personnel:        dossier.email_personnel || null,
      email:                  dossier.email_pro || null,
      contact_urgence_nom:    dossier.contact_urgence_nom || null,
      contact_urgence_tel:    dossier.contact_urgence_tel || null,
      contrat:                dossier.contrat || 'cdi',
      date_embauche:          dossier.date_recrutement || null,
      date_debut_contrat:     dossier.date_debut_contrat || null,
      date_fin_contrat:       dossier.date_fin_contrat || null,
      periode_essai:          dossier.periode_essai || null,
      statut:                 dossier.statut || 'actif',
      motif_sortie:           dossier.motif_sortie || null,
      filiale:                dossier.filiale || null,
      agence:                 dossier.agence || null,
      direction:              dossier.direction || null,
      departement:            dossier.departement || null,
      service:                dossier.service || null,
      equipe:                 dossier.equipe || null,
      manager_id:             dossier.manager_id || null,
      site_travail:           dossier.site_travail || null,
      poste:                  dossier.poste,
      metier:                 dossier.metier || null,
      famille_metier:         dossier.famille_metier || null,
      niveau_hierarchique:    dossier.niveau_hierarchique || null,
      categorie_convention:   dossier.categorie_convention || null,
      echelon:                dossier.echelon || null,
      grade:                  dossier.grade || null,
      coefficient:            dossier.coefficient || null,
      code_secteur:           dossier.code_secteur || null,
      salaire_base:           dossier.salaire_base,
      salaire_conventionnel:  dossier.salaire_conventionnel || null,
      numero_cnss:            dossier.numero_cnss || null,
      numero_cnss_centre:     dossier.numero_cnss_centre || null,
      numero_fiscal:          dossier.numero_fiscal || null,
      pays_fiscal:            dossier.pays_fiscal || codePays,
      residence_fiscale:      dossier.residence_fiscale || null,
      mode_paiement:          dossier.mode_paiement || 'banque',
      banque:                 dossier.banque || null,
      rib:                    dossier.rib || null,
      iban:                   dossier.iban || null,
      swift:                  dossier.swift || null,
      mobile_money_type:      dossier.mobile_money_type || null,
      mobile_money_numero:    dossier.mobile_money_numero || null,
      groupe_sanguin:         dossier.groupe_sanguin || null,
      allergies:              dossier.allergies || null,
      handicap:               dossier.handicap,
      medecin_traitant:       dossier.medecin_traitant || null,
      date_visite_medicale:   dossier.date_visite_medicale || null,
      primes:                 dossier.primes,
      avantages:              dossier.avantages,
    }

    const res = await fetch('/api/hr/employees', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })

    setSubmitting(false)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setSubmitError(err?.error ?? err?.message ?? 'Erreur lors de la création')
      return
    }

    const data = await res.json()
    const id   = data?.id ?? data?.employe?.id
    setCreatedId(id)

    if (id && (plan === 'pme' || plan === 'grande')) {
      fetchScore(id)
    }

    if (plan === 'tpe' || !visibleSteps.find(s => s.id === 14)) {
      router.push('/dashboard/rh?tab=equipe&created=1')
      return
    }
    setCurrentStep(14)
  }

  async function fetchScore(id: string) {
    try {
      const res  = await fetch(`/api/hr/employees/${id}/conformite`)
      const data = await res.json()
      if (res.ok) setScoreData(data)
    } catch { /* score non critique */ }
  }

  // ── Conformité en temps réel (salaire vs SMIG) ─────────────────────────────
  const smigNiveau = useMemo((): 'conforme' | 'a_verifier' | 'non_conforme' | 'inconnu' => {
    if (!dossier.salaire_base) return 'inconnu'
    return dossier.salaire_base >= smig.montant ? 'conforme' : 'non_conforme'
  }, [dossier.salaire_base, smig.montant])

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Step renderers ───────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  function renderStep() {
    switch (currentStep) {

      // ── Step 1 — Identité ────────────────────────────────────────────────
      case 1: return (
        <div className="space-y-5">
          <SectionHead icon={<User className="w-5 h-5" />} label="Identité" desc="Informations personnelles de l'employé" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nom complet" required>
              <TextInput value={dossier.nom} onChange={v => update('nom', v)} placeholder="Ex: Jean-Pierre MBOUNGOU" />
            </Field>
            <Field label="Sexe">
              <SelectInput value={dossier.sexe} onChange={v => update('sexe', v)}>
                <option value="">— Sélectionner —</option>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </SelectInput>
            </Field>
            <Field label="Date de naissance">
              <TextInput type="date" value={dossier.date_naissance} onChange={v => update('date_naissance', v)} />
            </Field>
            <Field label="Lieu de naissance">
              <TextInput value={dossier.lieu_naissance} onChange={v => update('lieu_naissance', v)} placeholder="Ex: Brazzaville" />
            </Field>
            <Field label="Nationalité">
              <TextInput value={dossier.nationalite} onChange={v => update('nationalite', v)} placeholder="Ex: Congolaise" />
            </Field>
            <Field label="Situation matrimoniale">
              <SelectInput value={dossier.situation_matrimoniale} onChange={v => update('situation_matrimoniale', v)}>
                <option value="celibataire">Célibataire</option>
                <option value="marie">Marié(e)</option>
                <option value="divorce">Divorcé(e)</option>
                <option value="veuf">Veuf / Veuve</option>
              </SelectInput>
            </Field>
            <Field label="Nombre d'enfants">
              <input type="number" min={0} max={20} value={dossier.nb_enfants}
                onChange={e => update('nb_enfants', Number(e.target.value))}
                className="input text-sm w-32" />
            </Field>
          </div>
        </div>
      )

      // ── Step 2 — Coordonnées ─────────────────────────────────────────────
      case 2: return (
        <div className="space-y-5">
          <SectionHead icon={<MapPin className="w-5 h-5" />} label="Coordonnées" desc="Adresse et contacts" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Adresse">
              <TextInput value={dossier.adresse} onChange={v => update('adresse', v)} placeholder="Ex: 12 Rue Pasteur" />
            </Field>
            <Field label="Ville">
              <TextInput value={dossier.ville} onChange={v => update('ville', v)} placeholder="Ex: Brazzaville" />
            </Field>
            <Field label="Quartier">
              <TextInput value={dossier.quartier} onChange={v => update('quartier', v)} placeholder="Ex: Poto-Poto" />
            </Field>
            <Field label="Région / Province">
              <TextInput value={dossier.region} onChange={v => update('region', v)} placeholder="Ex: Pool" />
            </Field>
            <Field label="Téléphone principal">
              <TextInput type="tel" value={dossier.telephone} onChange={v => update('telephone', v)} placeholder="+242 06..." />
            </Field>
            <Field label="Téléphone secondaire">
              <TextInput type="tel" value={dossier.telephone2} onChange={v => update('telephone2', v)} placeholder="+242 05..." />
            </Field>
            <Field label="Email personnel">
              <TextInput type="email" value={dossier.email_personnel} onChange={v => update('email_personnel', v)} placeholder="prenom@gmail.com" />
            </Field>
            <Field label="Email professionnel">
              <TextInput type="email" value={dossier.email_pro} onChange={v => update('email_pro', v)} placeholder="prenom@entreprise.com" />
            </Field>
            {plan !== 'tpe' && (
              <>
                <Field label="Contact d'urgence — Nom">
                  <TextInput value={dossier.contact_urgence_nom} onChange={v => update('contact_urgence_nom', v)} placeholder="Ex: Marie MBOUNGOU" />
                </Field>
                <Field label="Contact d'urgence — Téléphone">
                  <TextInput type="tel" value={dossier.contact_urgence_tel} onChange={v => update('contact_urgence_tel', v)} placeholder="+242 06..." />
                </Field>
              </>
            )}
          </div>
        </div>
      )

      // ── Step 3 — Contrat ─────────────────────────────────────────────────
      case 3: return (
        <div className="space-y-5">
          <SectionHead icon={<FileText className="w-5 h-5" />} label="Contrat" desc="Type de contrat et dates" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Type de contrat" required>
              <SelectInput value={dossier.contrat} onChange={v => update('contrat', v)}>
                <option value="cdi">CDI — Contrat à Durée Indéterminée</option>
                <option value="cdd">CDD — Contrat à Durée Déterminée</option>
                <option value="stage">Stage</option>
                <option value="freelance">Freelance / Consultant</option>
                <option value="vacation">Vacation</option>
                <option value="prestataire">Prestataire</option>
              </SelectInput>
            </Field>
            <Field label="Statut">
              <SelectInput value={dossier.statut} onChange={v => update('statut', v)}>
                <option value="actif">Actif</option>
                <option value="conge">En congé</option>
                <option value="malade">Malade</option>
                <option value="licencie">Licencié</option>
                <option value="retraite">Retraité</option>
              </SelectInput>
            </Field>
            <Field label="Date de recrutement">
              <TextInput type="date" value={dossier.date_recrutement} onChange={v => update('date_recrutement', v)} />
            </Field>
            <Field label="Date de début de contrat">
              <TextInput type="date" value={dossier.date_debut_contrat} onChange={v => update('date_debut_contrat', v)} />
            </Field>
            {(dossier.contrat === 'cdd' || dossier.contrat === 'stage') && (
              <Field label="Date de fin de contrat">
                <TextInput type="date" value={dossier.date_fin_contrat} onChange={v => update('date_fin_contrat', v)} />
              </Field>
            )}
            <Field label="Période d'essai">
              <SelectInput value={dossier.periode_essai} onChange={v => update('periode_essai', v)}>
                <option value="">Aucune</option>
                <option value="1 mois">1 mois</option>
                <option value="2 mois">2 mois</option>
                <option value="3 mois">3 mois</option>
                <option value="6 mois">6 mois</option>
              </SelectInput>
            </Field>
          </div>
        </div>
      )

      // ── Step 4 — Organisation ────────────────────────────────────────────
      case 4: return (
        <div className="space-y-5">
          <SectionHead icon={<Building2 className="w-5 h-5" />} label="Organisation" desc="Structure hiérarchique et affectation" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plan === 'grande' && (
              <Field label="Filiale / Entité">
                <TextInput value={dossier.filiale} onChange={v => update('filiale', v)} placeholder="Ex: Filiale Sud" />
              </Field>
            )}
            {plan !== 'tpe' && (
              <Field label="Agence / Site">
                <TextInput value={dossier.agence} onChange={v => update('agence', v)} placeholder="Ex: Agence Pointe-Noire" />
              </Field>
            )}
            <Field label="Direction">
              <TextInput value={dossier.direction} onChange={v => update('direction', v)} placeholder="Ex: Direction Commerciale" />
            </Field>
            <Field label="Département">
              <TextInput value={dossier.departement} onChange={v => update('departement', v)} placeholder="Ex: Marketing" />
            </Field>
            {plan !== 'tpe' && (
              <>
                <Field label="Service">
                  <TextInput value={dossier.service} onChange={v => update('service', v)} placeholder="Ex: Service Clientèle" />
                </Field>
                <Field label="Équipe">
                  <TextInput value={dossier.equipe} onChange={v => update('equipe', v)} placeholder="Ex: Équipe Nord" />
                </Field>
              </>
            )}
            <Field label="Site de travail">
              <TextInput value={dossier.site_travail} onChange={v => update('site_travail', v)} placeholder="Ex: Siège social" />
            </Field>
          </div>
        </div>
      )

      // ── Step 5 — Poste ───────────────────────────────────────────────────
      case 5: return (
        <div className="space-y-5">
          <SectionHead icon={<Briefcase className="w-5 h-5" />} label="Poste & Convention" desc="Titre, classification et convention collective" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Intitulé du poste" required>
              <TextInput value={dossier.poste} onChange={v => update('poste', v)} placeholder="Ex: Responsable Commercial" />
            </Field>
            <Field label="Métier">
              <TextInput value={dossier.metier} onChange={v => update('metier', v)} placeholder="Ex: Commercial" />
            </Field>
            {plan !== 'tpe' && (
              <>
                <Field label="Famille de métier">
                  <TextInput value={dossier.famille_metier} onChange={v => update('famille_metier', v)} placeholder="Ex: Commerce & Vente" />
                </Field>
                <Field label="Niveau hiérarchique">
                  <SelectInput value={dossier.niveau_hierarchique} onChange={v => update('niveau_hierarchique', v)}>
                    <option value="">— Sélectionner —</option>
                    <option value="direction">Direction</option>
                    <option value="cadre_superieur">Cadre supérieur</option>
                    <option value="cadre">Cadre</option>
                    <option value="technicien">Technicien / Agent de maîtrise</option>
                    <option value="employe">Employé</option>
                    <option value="ouvrier">Ouvrier</option>
                  </SelectInput>
                </Field>
                <Field label="Catégorie convention">
                  <TextInput value={dossier.categorie_convention} onChange={v => update('categorie_convention', v)} placeholder="Ex: Catégorie 6" />
                </Field>
                <Field label="Échelon">
                  <TextInput value={dossier.echelon} onChange={v => update('echelon', v)} placeholder="Ex: A" />
                </Field>
                <Field label="Grade">
                  <TextInput value={dossier.grade} onChange={v => update('grade', v)} placeholder="Ex: Grade II" />
                </Field>
                <Field label="Coefficient">
                  <TextInput value={dossier.coefficient} onChange={v => update('coefficient', v)} placeholder="Ex: 440" />
                </Field>
                <Field label="Code secteur convention">
                  <TextInput value={dossier.code_secteur} onChange={v => update('code_secteur', v)} placeholder="Ex: COMMERCE" />
                </Field>
              </>
            )}
          </div>
        </div>
      )

      // ── Step 6 — Salaire ─────────────────────────────────────────────────
      case 6: return (
        <div className="space-y-5">
          <SectionHead icon={<DollarSign className="w-5 h-5" />} label="Salaire" desc={`Rémunération de base en ${cfg.devise} — SMIG ${smig.montant.toLocaleString('fr-FR')} ${cfg.devise}`} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={`Salaire de base (${cfg.devise})`} required>
              <input type="number" min={0} step={1000}
                value={dossier.salaire_base || ''}
                onChange={e => update('salaire_base', Number(e.target.value))}
                className="input text-sm"
                placeholder={`Min. ${smig.montant.toLocaleString('fr-FR')}`}
              />
            </Field>
            {plan !== 'tpe' && (
              <Field label={`Salaire conventionnel minimum (${cfg.devise})`}>
                <input type="number" min={0} step={1000}
                  value={dossier.salaire_conventionnel || ''}
                  onChange={e => update('salaire_conventionnel', Number(e.target.value))}
                  className="input text-sm"
                  placeholder="0"
                />
              </Field>
            )}
          </div>
          <div className="mt-3">
            <ConformityBadge
              niveau={smigNiveau}
              label={
                smigNiveau === 'conforme'      ? `Conforme SMIG ${cfg.nom_pays}`
                : smigNiveau === 'non_conforme' ? `Inférieur au SMIG (${smig.montant.toLocaleString('fr-FR')} ${cfg.devise})`
                : 'Saisissez un salaire'
              }
              detail={smigNiveau === 'non_conforme' ? 'Risque légal — le salaire doit être ≥ SMIG' : undefined}
            />
          </div>
        </div>
      )

      // ── Step 7 — Primes ──────────────────────────────────────────────────
      case 7: return (
        <div className="space-y-5">
          <SectionHead icon={<Gift className="w-5 h-5" />} label="Primes & Indemnités" desc="Bibliothèque de primes — taxabilité selon la législation du pays" />
          <PrimesLibrary
            primes={dossier.primes}
            onChange={v => update('primes', v)}
            cfg={cfg}
            plan={plan}
          />
        </div>
      )

      // ── Step 8 — Avantages en nature ─────────────────────────────────────
      case 8: return (
        <div className="space-y-5">
          <SectionHead icon={<Star className="w-5 h-5" />} label="Avantages en nature" desc="Valorisation des avantages non monétaires" />
          <div className="space-y-3">
            {AVANTAGES_CATALOGUE.map(cat => {
              const active = dossier.avantages.find(a => a.type === cat.type)
              return (
                <div key={cat.type} className={[
                  'border rounded-xl p-4 transition-all',
                  active ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white',
                ].join(' ')}>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!active}
                        onChange={e => {
                          if (e.target.checked) {
                            const newAv: AvantageNature = {
                              type:               cat.type,
                              libelle:            cat.label,
                              valeur:             0,
                              imposable:          false,
                              soumis_cotisations: false,
                            }
                            update('avantages', [...dossier.avantages, newAv])
                          } else {
                            update('avantages', dossier.avantages.filter(a => a.type !== cat.type))
                          }
                        }}
                        className="rounded accent-amber-500"
                      />
                      <span>{cat.emoji}</span> {cat.label}
                    </label>
                    {active && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={active.valeur || ''}
                          onChange={e => {
                            const newAvantages = dossier.avantages.map(a =>
                              a.type === cat.type ? { ...a, valeur: Number(e.target.value) } : a
                            )
                            update('avantages', newAvantages)
                          }}
                          className="input text-sm w-36"
                          placeholder={`Valeur (${cfg.devise})`}
                        />
                        <label className="flex items-center gap-1 text-xs text-slate-500">
                          <input
                            type="checkbox"
                            checked={active.imposable}
                            onChange={e => {
                              const newAvantages = dossier.avantages.map(a =>
                                a.type === cat.type ? { ...a, imposable: e.target.checked } : a
                              )
                              update('avantages', newAvantages)
                            }}
                            className="accent-amber-500"
                          />
                          Imposable
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )

      // ── Step 9 — CNSS ────────────────────────────────────────────────────
      case 9: return (
        <div className="space-y-5">
          <SectionHead icon={<Shield className="w-5 h-5" />} label={cfg.cnss.acronyme} desc={cfg.cnss.nom} />
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 space-y-0.5">
              {cfg.cnss.branches.slice(0, 3).map(b => (
                <p key={b.code}>
                  {b.libelle} — salarié {(b.taux_salarie * 100).toFixed(1)}%
                  {b.taux_patronal > 0 && ` · patronal ${(b.taux_patronal * 100).toFixed(1)}%`}
                  {b.plafond_mensuel !== null && ` (plaf. ${b.plafond_mensuel.toLocaleString('fr-FR')} ${cfg.devise})`}
                </p>
              ))}
              {cfg.cnss.branches.length > 3 && (
                <p className="text-blue-500">+{cfg.cnss.branches.length - 3} branche{cfg.cnss.branches.length - 3 > 1 ? 's' : ''}…</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={`Numéro ${cfg.cnss.acronyme}`}>
              <TextInput value={dossier.numero_cnss} onChange={v => update('numero_cnss', v)} placeholder="Ex: 1234567-A" />
            </Field>
            {plan !== 'tpe' && (
              <Field label="Centre / Antenne">
                <TextInput value={dossier.numero_cnss_centre} onChange={v => update('numero_cnss_centre', v)} placeholder="Ex: Centre Brazzaville Nord" />
              </Field>
            )}
          </div>
        </div>
      )

      // ── Step 10 — Fiscalité ──────────────────────────────────────────────
      case 10: return (
        <div className="space-y-5">
          <SectionHead icon={<Receipt className="w-5 h-5" />} label="Fiscalité" desc="Numéro fiscal et résidence fiscale" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Numéro fiscal / NIF">
              <TextInput value={dossier.numero_fiscal} onChange={v => update('numero_fiscal', v)} placeholder="Ex: M20120034567A" />
            </Field>
            <Field label="Pays de résidence fiscale">
              <TextInput value={dossier.pays_fiscal} onChange={v => update('pays_fiscal', v)} placeholder={cfg.nom_pays} />
            </Field>
            <Field label="Résidence fiscale">
              <SelectInput value={dossier.residence_fiscale} onChange={v => update('residence_fiscale', v)}>
                <option value="">— Sélectionner —</option>
                <option value="resident">Résident fiscal</option>
                <option value="non_resident">Non-résident</option>
                <option value="expatrie">Expatrié</option>
              </SelectInput>
            </Field>
          </div>
        </div>
      )

      // ── Step 11 — Banque ─────────────────────────────────────────────────
      case 11: return (
        <div className="space-y-5">
          <SectionHead icon={<CreditCard className="w-5 h-5" />} label="Banque & Paiement" desc="Coordonnées bancaires et mobile money" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Mode de paiement">
              <SelectInput value={dossier.mode_paiement} onChange={v => update('mode_paiement', v)}>
                <option value="banque">Virement bancaire</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="cheque">Chèque</option>
                <option value="especes">Espèces</option>
              </SelectInput>
            </Field>
            {(dossier.mode_paiement === 'banque' || dossier.mode_paiement === 'cheque') && (
              <>
                <Field label="Banque">
                  <TextInput value={dossier.banque} onChange={v => update('banque', v)} placeholder="Ex: BGFI Bank" />
                </Field>
                <Field label="RIB / Numéro de compte">
                  <TextInput value={dossier.rib} onChange={v => update('rib', v)} placeholder="Ex: 00002 03234 00000789012 56" />
                </Field>
                {plan !== 'tpe' && (
                  <>
                    <Field label="IBAN">
                      <TextInput value={dossier.iban} onChange={v => update('iban', v)} placeholder="Ex: CG86 0002 0000 0789012 56" />
                    </Field>
                    <Field label="BIC / SWIFT">
                      <TextInput value={dossier.swift} onChange={v => update('swift', v)} placeholder="Ex: BGFICGCG" />
                    </Field>
                  </>
                )}
              </>
            )}
            {dossier.mode_paiement === 'mobile_money' && (
              <>
                <Field label="Opérateur Mobile Money">
                  <SelectInput value={dossier.mobile_money_type} onChange={v => update('mobile_money_type', v)}>
                    <option value="">— Sélectionner —</option>
                    <option value="airtel_money">Airtel Money</option>
                    <option value="mtn_momo">MTN Mobile Money</option>
                    <option value="orange_money">Orange Money</option>
                    <option value="wave">Wave</option>
                    <option value="moov_money">Moov Money</option>
                    <option value="m_pesa">M-Pesa</option>
                    <option value="autre">Autre</option>
                  </SelectInput>
                </Field>
                <Field label="Numéro Mobile Money">
                  <TextInput type="tel" value={dossier.mobile_money_numero} onChange={v => update('mobile_money_numero', v)} placeholder="+242 06..." />
                </Field>
              </>
            )}
          </div>
        </div>
      )

      // ── Step 12 — Documents (PME/Grande) ─────────────────────────────────
      case 12: return (
        <div className="space-y-5">
          <SectionHead icon={<Folder className="w-5 h-5" />} label="Documents" desc="Pièces justificatives du dossier" />
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 text-center space-y-2">
            <Folder className="w-8 h-8 mx-auto text-amber-400" />
            <p className="text-sm text-slate-600">
              L&apos;upload de documents sera disponible prochainement.
              {plan === 'grande' && ' GED intégrée pour le plan Compagnie.'}
            </p>
            <p className="text-xs text-slate-400">
              Documents suggérés : CNI/Passeport, Contrat signé, Diplômes, Extrait naissance, Casier judiciaire
            </p>
          </div>
        </div>
      )

      // ── Step 13 — Médical (PME/Grande) ───────────────────────────────────
      case 13: return (
        <div className="space-y-5">
          <SectionHead icon={<Heart className="w-5 h-5" />} label="Dossier Médical" desc="Informations de santé (accès restreint)" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Groupe sanguin">
              <SelectInput value={dossier.groupe_sanguin} onChange={v => update('groupe_sanguin', v)}>
                <option value="">— Non renseigné —</option>
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Allergies connues">
              <TextInput value={dossier.allergies} onChange={v => update('allergies', v)} placeholder="Ex: Pénicilline, Arachides..." />
            </Field>
            <Field label="Médecin traitant">
              <TextInput value={dossier.medecin_traitant} onChange={v => update('medecin_traitant', v)} placeholder="Ex: Dr. MPEMBA" />
            </Field>
            {plan === 'grande' && (
              <Field label="Dernière visite médicale">
                <TextInput type="date" value={dossier.date_visite_medicale} onChange={v => update('date_visite_medicale', v)} />
              </Field>
            )}
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dossier.handicap}
                  onChange={e => update('handicap', e.target.checked)}
                  className="rounded accent-amber-500"
                />
                <span>Travailleur en situation de handicap (RQTH)</span>
              </label>
            </div>
          </div>
        </div>
      )

      // ── Step 14 — MIAA+ Score (PME/Grande) ───────────────────────────────
      case 14: return (
        <div className="space-y-5">
          <SectionHead icon={<Sparkles className="w-5 h-5" />} label="Score de Conformité MIAA+" desc="Analyse automatique du dossier employé" />
          {createdId && scoreData ? (
            <MIAAScoring
              employeId={createdId}
              score={scoreData.score}
              niveau={scoreData.niveau}
              items={scoreData.items}
              alertes={scoreData.alertes}
              recommandations={scoreData.recommandations}
              plan={plan}
              onRefresh={() => fetchScore(createdId)}
            />
          ) : createdId ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Calcul du score en cours…
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 space-y-3">
              <AlertCircle className="w-6 h-6 text-amber-500" />
              <p className="text-sm text-amber-700">
                Créez d&apos;abord le dossier pour voir le score de conformité.
              </p>
            </div>
          )}
          {createdId && (
            <div className="pt-4 border-t border-slate-100 flex gap-3">
              <Link href="/dashboard/rh?tab=equipe" className="btn-secondary text-sm flex-1 text-center">
                Retour à la liste
              </Link>
              <Link href={`/dashboard/rh/employes/${createdId}`} className="btn-primary text-sm flex-1 text-center">
                Voir le profil complet
              </Link>
            </div>
          )}
        </div>
      )

      default: return null
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Layout ───────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  const navProps = { steps, currentStep, completedSteps, onGoTo: goTo }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ─── En-tête sticky ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-20 shadow-sm">
        <Link href="/dashboard/rh" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-slate-800 truncate">
            {plan === 'tpe' ? 'Ajouter un employé' : 'Ajouter un employé premium'}
            <span className="hidden sm:inline text-slate-400 font-normal"> — {cfg.nom_pays}</span>
          </h1>
          <p className="text-xs text-slate-400 truncate">{dossier.nom || 'Nom non renseigné'}</p>
        </div>
        {/* Plan badge */}
        <span className={[
          'hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
          plan === 'tpe'    ? 'bg-slate-100 text-slate-500'
          : plan === 'pme'  ? 'bg-blue-50 text-blue-600'
          : 'bg-amber-50 text-amber-600',
        ].join(' ')}>
          {plan === 'tpe' ? 'Entrepreneur' : plan === 'pme' ? 'Business' : 'Compagnie'}
        </span>
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
          <span>{cfg.devise}</span>
          <span>·</span>
          <span>{cfg.cnss.acronyme}</span>
        </div>
      </div>

      {/* ─── Corps ──────────────────────────────────────────────────────── */}
      <div className="max-w-[1280px] mx-auto px-4 py-5">

        {/* ── Mobile/tablette : nav pastilles (caché sur lg+) ─────────── */}
        <div className="lg:hidden mb-4">
          <WizardNavMobile {...navProps} />
        </div>

        {/* ── Layout principal ─────────────────────────────────────────── */}
        <div className="flex gap-5 items-start">

          {/* Sidebar desktop (caché sur mobile) */}
          <div className="hidden lg:block shrink-0 sticky top-[61px] self-start">
            <WizardNavDesktop {...navProps} />
          </div>

          {/* Zone formulaire */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 md:p-8">

              {renderStep()}

              {/* Erreur submission */}
              {submitError && (
                <div className="mt-5 bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{submitError}</p>
                </div>
              )}

              {/* Barre de navigation Précédent / Suivant */}
              {!(currentStep === 14 && createdId) && (
                <div className="flex items-center justify-between mt-8 pt-5 border-t border-slate-100">
                  <button
                    onClick={prev}
                    disabled={isFirstStep}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Précédent</span>
                  </button>

                  <div className="text-xs text-slate-400 hidden sm:block">
                    {visibleSteps.findIndex(s => s.id === currentStep) + 1} / {visibleSteps.length}
                  </div>

                  {isLastStep ? (
                    <button
                      onClick={handleSubmit}
                      disabled={submitting || !canProceed()}
                      className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      {submitting ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {submitting ? 'Enregistrement…' : 'Créer le dossier'}
                    </button>
                  ) : (
                    <button
                      onClick={next}
                      disabled={!canProceed()}
                      className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      <span className="hidden sm:inline">Suivant</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Bannière succès */}
              {createdId && currentStep < 14 && (
                <div className="mt-5 bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  <p className="flex-1 text-sm font-semibold text-green-700">Dossier créé avec succès !</p>
                  <Link href="/dashboard/rh?tab=equipe" className="text-xs text-green-600 font-semibold hover:underline whitespace-nowrap">
                    Voir la liste →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Panneau aperçu paie — visible uniquement à xl+ */}
          <div className="hidden xl:block shrink-0 sticky top-[61px] self-start">
            <LivePayPreview
              codePays={codePays}
              salaire_base={dossier.salaire_base}
              situation={dossier.situation_matrimoniale === 'marie' ? 'marie' : 'celibataire'}
              nb_enfants={dossier.nb_enfants}
              primes={dossier.primes}
            />
          </div>

        </div>

        {/* Aperçu paie collapsible sur tablette (sm–lg) */}
        {dossier.salaire_base > 0 && (
          <div className="xl:hidden mt-4">
            <details className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <summary className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-600 cursor-pointer select-none hover:bg-slate-50">
                <span>💰</span> Aperçu paie — {dossier.salaire_base.toLocaleString('fr-FR')} {cfg.devise}
              </summary>
              <div className="px-4 pb-4">
                <LivePayPreview
                  codePays={codePays}
                  salaire_base={dossier.salaire_base}
                  situation={dossier.situation_matrimoniale === 'marie' ? 'marie' : 'celibataire'}
                  nb_enfants={dossier.nb_enfants}
                  primes={dossier.primes}
                />
              </div>
            </details>
          </div>
        )}

      </div>
    </div>
  )
}
