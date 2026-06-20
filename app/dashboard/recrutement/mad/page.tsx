'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  UserCog, Users, Building2, Calendar, FileText,
  DollarSign, Shield, AlertTriangle, CheckCircle,
  Plus, X, Search, Clock, TrendingUp,
  Sparkles, Bell, Repeat, ArrowRightLeft,
  XCircle, Loader2, Edit3,
  Calculator, CreditCard, AlertCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MadClient {
  id: string; nom: string; secteur_activite: string | null
  contact_nom: string | null; contact_email: string | null; contact_tel: string | null
  taux_facturation_defaut: number | null; mode_facturation: string; actif: boolean
  delai_paiement_jours: number; created_at: string
}

interface MadEmploye {
  id: string; nom: string; prenom: string; email: string | null; telephone: string | null
  poste_habituel: string; qualification: string | null; salaire_base: number | null
  numero_cnss: string | null; type_contrat: string; date_embauche: string | null
  statut: string; ville: string | null; created_at: string
}

interface MadAffectation {
  id: string; employe_id: string; client_id: string
  poste_client: string; date_debut: string; date_fin_prevue: string | null
  date_fin_reelle: string | null; taux_horaire_facture: number | null
  salaire_mensuel_brut: number | null; nb_heures_semaine: number
  statut: string; motif_fin: string | null; renouvellements: number
  employe_nom?: string; employe_prenom?: string; client_nom?: string
  jours_restants?: number | null
}

interface MadPresence {
  id: string; affectation_id: string; employe_id: string; mois: string
  jours_travailles: number; jours_absents: number; jours_conges: number
  heures_normales: number; heures_sup: number; valide: boolean; remarques: string | null
  employe_nom?: string; employe_prenom?: string; poste?: string | null
}

interface MadFacture {
  id: string; client_id: string; reference: string; mois: string
  date_emission: string | null; date_echeance: string | null; date_paiement: string | null
  montant_ht: number; montant_ttc: number; statut: string; client_nom?: string
}

interface MadPaie {
  id: string; employe_id: string; mois: string; salaire_base: number
  salaire_brut: number; cotisation_cnss_salarie: number; cotisation_cnss_patron: number
  irpp: number; salaire_net: number; statut: string
  employe_nom?: string; employe_prenom?: string
}

interface MadCnss {
  id: string; mois: string; nb_employes: number; salaire_brut_total: number
  cotisation_salarie: number; cotisation_patronale: number; total_cnss: number
  irpp_total: number; date_echeance: string | null; statut: string
}

interface Alert {
  id: string; type: 'fin_mission' | 'renouvellement' | 'cnss' | 'facture_retard' | 'presence'
  label: string; detail: string; urgence: 'haute' | 'moyenne' | 'info'
  jours?: number; actionLabel?: string; onAction?: () => void
}

// ── Constants ──────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'affectations' | 'employes' | 'clients' | 'presences' | 'facturation' | 'paie' | 'contrats'

const TABS: Array<{ key: Tab; label: string; icon: React.ElementType }> = [
  { key: 'overview',     label: 'Vue d\'ensemble', icon: TrendingUp   },
  { key: 'affectations', label: 'Affectations',    icon: UserCog      },
  { key: 'employes',     label: 'Employés',        icon: Users        },
  { key: 'clients',      label: 'Clients',         icon: Building2    },
  { key: 'presences',    label: 'Présences',       icon: Calendar     },
  { key: 'facturation',  label: 'Facturation',     icon: FileText     },
  { key: 'paie',         label: 'Paie & Social',   icon: Calculator   },
  { key: 'contrats',     label: 'Contrats',        icon: Shield       },
]

const STATUT_AFF: Record<string, { label: string; color: string; bg: string }> = {
  active:            { label: 'Active',            color: '#16A34A', bg: '#F0FDF4' },
  terminee:          { label: 'Terminée',          color: '#6B7280', bg: '#F1F5F9' },
  suspendue:         { label: 'Suspendue',         color: '#D97706', bg: '#FFFBEB' },
  en_renouvellement: { label: 'Renouvellement',    color: '#2563EB', bg: '#EFF6FF' },
  transfert:         { label: 'Transfert',         color: '#7C3AED', bg: '#F5F3FF' },
}

const STATUT_EMP: Record<string, { label: string; color: string; bg: string }> = {
  disponible:   { label: 'Disponible',  color: '#16A34A', bg: '#F0FDF4' },
  affecte:      { label: 'Affecté',     color: '#2563EB', bg: '#EFF6FF' },
  conge:        { label: 'Congé',       color: '#D97706', bg: '#FFFBEB' },
  maladie:      { label: 'Maladie',     color: '#DC2626', bg: '#FEF2F2' },
  fin_contrat:  { label: 'Fin contrat', color: '#6B7280', bg: '#F1F5F9' },
}

const STATUT_FACT: Record<string, { label: string; color: string; bg: string }> = {
  brouillon:  { label: 'Brouillon',   color: '#94A3B8', bg: '#F8FAFC' },
  emise:      { label: 'Émise',       color: '#2563EB', bg: '#EFF6FF' },
  payee:      { label: 'Payée',       color: '#16A34A', bg: '#F0FDF4' },
  en_retard:  { label: 'En retard',   color: '#DC2626', bg: '#FEF2F2' },
  annulee:    { label: 'Annulée',     color: '#6B7280', bg: '#F1F5F9' },
}

const MOIS_LABELS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

function formatMontant(n: number): string {
  return n.toLocaleString('fr-FR') + ' FCFA'
}

function jours(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86_400_000)
}

function moisLabel(isoDate: string): string {
  const d = new Date(isoDate)
  return `${MOIS_LABELS[d.getMonth()]} ${d.getFullYear()}`
}

// ── Composants utilitaires ─────────────────────────────────────────────────────

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color, background: bg }}>
      {label}
    </span>
  )
}

function KpiCard({ icon: Icon, label, value, sub, color, alert }: {
  icon: React.ElementType; label: string; value: string | number
  sub?: string; color: string; alert?: boolean
}) {
  return (
    <div className={`bg-white rounded-2xl border p-4 shadow-sm ${alert ? 'border-red-200' : 'border-[#E2E8F0]'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: color + '18' }}>
          <Icon size={17} style={{ color }} />
        </div>
        {alert && <AlertTriangle size={14} className="text-red-500" />}
      </div>
      <p className="text-[22px] font-extrabold text-[#0F172A] leading-none mb-0.5">{value}</p>
      <p className="text-[11px] text-[#64748B] font-medium">{label}</p>
      {sub && <p className="text-[10px] text-[#94A3B8] mt-0.5">{sub}</p>}
    </div>
  )
}

function AlertCard({ alert }: { alert: Alert }) {
  const colors = {
    haute:   { bg: '#FEF2F2', border: '#FECACA', icon: '#DC2626', iconBg: '#FEE2E2' },
    moyenne: { bg: '#FFFBEB', border: '#FDE68A', icon: '#D97706', iconBg: '#FEF3C7' },
    info:    { bg: '#EFF6FF', border: '#BFDBFE', icon: '#2563EB', iconBg: '#DBEAFE' },
  }[alert.urgence]

  const Icon = alert.urgence === 'haute' ? AlertTriangle
    : alert.urgence === 'moyenne' ? Clock : Bell

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border" style={{ background: colors.bg, borderColor: colors.border }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: colors.iconBg }}>
        <Icon size={14} style={{ color: colors.icon }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold text-[#0F172A]">{alert.label}</p>
        <p className="text-[10px] text-[#64748B]">{alert.detail}</p>
      </div>
      {alert.jours !== undefined && (
        <span className="text-[11px] font-bold shrink-0 px-2 py-0.5 rounded-full" style={{ color: colors.icon, background: colors.iconBg }}>
          J-{alert.jours}
        </span>
      )}
    </div>
  )
}

// ── Modal Affectation ─────────────────────────────────────────────────────────

function ModalAffectation({
  employes, clients, tenantId, onClose, onSaved, aff,
}: {
  employes: MadEmploye[]; clients: MadClient[]; tenantId: string
  onClose: () => void; onSaved: () => void; aff?: MadAffectation
}) {
  const [form, setForm] = useState({
    employe_id:          aff?.employe_id ?? '',
    client_id:           aff?.client_id ?? '',
    poste_client:        aff?.poste_client ?? '',
    date_debut:          aff?.date_debut?.slice(0, 10) ?? '',
    date_fin_prevue:     aff?.date_fin_prevue?.slice(0, 10) ?? '',
    taux_horaire_facture: String(aff?.taux_horaire_facture ?? ''),
    salaire_mensuel_brut: String(aff?.salaire_mensuel_brut ?? ''),
    nb_heures_semaine:   String(aff?.nb_heures_semaine ?? '40'),
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.employe_id || !form.client_id || !form.poste_client || !form.date_debut) return
    setSaving(true)
    const payload = {
      tenant_id: tenantId,
      employe_id: form.employe_id,
      client_id: form.client_id,
      poste_client: form.poste_client,
      date_debut: form.date_debut,
      date_fin_prevue: form.date_fin_prevue || null,
      taux_horaire_facture: form.taux_horaire_facture ? parseFloat(form.taux_horaire_facture) : null,
      salaire_mensuel_brut: form.salaire_mensuel_brut ? parseFloat(form.salaire_mensuel_brut) : null,
      nb_heures_semaine: parseFloat(form.nb_heures_semaine) || 40,
      statut: 'active',
    }
    if (aff) {
      await supabase.from('mad_affectations').update(payload).eq('id', aff.id)
    } else {
      await supabase.from('mad_affectations').insert(payload)
      await supabase.from('mad_employes').update({ statut: 'affecte' }).eq('id', form.employe_id)
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-[#0F172A]">{aff ? 'Modifier affectation' : 'Nouvelle affectation'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8]"><X size={15} /></button>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#374151] mb-1">Employé *</label>
          <select value={form.employe_id} onChange={e => setForm(p => ({ ...p, employe_id: e.target.value }))}
            className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30 bg-white">
            <option value="">— Sélectionner —</option>
            {employes.filter(e => e.statut === 'disponible' || e.id === aff?.employe_id).map(e => (
              <option key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.poste_habituel}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#374151] mb-1">Client *</label>
          <select value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}
            className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30 bg-white">
            <option value="">— Sélectionner —</option>
            {clients.filter(c => c.actif).map(c => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#374151] mb-1">Poste chez le client *</label>
          <input value={form.poste_client} onChange={e => setForm(p => ({ ...p, poste_client: e.target.value }))}
            placeholder="Ex. : Comptable senior"
            className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#374151] mb-1">Début *</label>
            <input type="date" value={form.date_debut} onChange={e => setForm(p => ({ ...p, date_debut: e.target.value }))}
              className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#374151] mb-1">Fin prévue</label>
            <input type="date" value={form.date_fin_prevue} onChange={e => setForm(p => ({ ...p, date_fin_prevue: e.target.value }))}
              className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#374151] mb-1">Taux horaire facturé (FCFA)</label>
            <input type="number" value={form.taux_horaire_facture} onChange={e => setForm(p => ({ ...p, taux_horaire_facture: e.target.value }))}
              placeholder="0"
              className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#374151] mb-1">Salaire brut mensuel</label>
            <input type="number" value={form.salaire_mensuel_brut} onChange={e => setForm(p => ({ ...p, salaire_mensuel_brut: e.target.value }))}
              placeholder="0"
              className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#374151] mb-1">Heures / semaine</label>
          <input type="number" value={form.nb_heures_semaine} onChange={e => setForm(p => ({ ...p, nb_heures_semaine: e.target.value }))}
            className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">Annuler</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 bg-[#F59E0B] text-white rounded-xl text-[12px] font-bold hover:bg-[#D97706] disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 size={12} className="animate-spin" />}
            {saving ? 'Enregistrement…' : aff ? 'Modifier' : 'Affecter'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Employé ─────────────────────────────────────────────────────────────

function ModalEmploye({ tenantId, onClose, onSaved }: { tenantId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nom: '', prenom: '', email: '', telephone: '', poste_habituel: '',
    qualification: '', salaire_base: '', numero_cnss: '', type_contrat: 'cdi',
    date_embauche: '', ville: '',
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.nom || !form.prenom || !form.poste_habituel) return
    setSaving(true)
    await supabase.from('mad_employes').insert({
      tenant_id: tenantId,
      nom: form.nom, prenom: form.prenom, email: form.email || null,
      telephone: form.telephone || null, poste_habituel: form.poste_habituel,
      qualification: form.qualification || null,
      salaire_base: form.salaire_base ? parseFloat(form.salaire_base) : null,
      numero_cnss: form.numero_cnss || null,
      type_contrat: form.type_contrat,
      date_embauche: form.date_embauche || null,
      ville: form.ville || null,
      statut: 'disponible',
    })
    setSaving(false)
    onSaved()
  }

  const fields = [
    { key: 'prenom', label: 'Prénom *', placeholder: 'Jean', col: 1 },
    { key: 'nom', label: 'Nom *', placeholder: 'Dupont', col: 1 },
    { key: 'email', label: 'Email', placeholder: 'jean@email.com', col: 2 },
    { key: 'telephone', label: 'Téléphone', placeholder: '+242 06…', col: 2 },
    { key: 'poste_habituel', label: 'Poste habituel *', placeholder: 'Comptable', col: 2 },
    { key: 'qualification', label: 'Qualification', placeholder: 'BTS Comptabilité', col: 2 },
    { key: 'salaire_base', label: 'Salaire de base (FCFA)', placeholder: '200000', col: 2 },
    { key: 'numero_cnss', label: 'N° CNSS', placeholder: '123456789', col: 2 },
    { key: 'ville', label: 'Ville', placeholder: 'Brazzaville', col: 2 },
  ] as const

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[15px] font-bold text-[#0F172A]">Nouvel employé</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8]"><X size={15} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {fields.filter(f => f.col === 1).map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1">{label}</label>
              <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30" />
            </div>
          ))}
        </div>
        {fields.filter(f => f.col === 2).map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-[11px] font-semibold text-[#374151] mb-1">{label}</label>
            <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              placeholder={placeholder} type={key === 'salaire_base' ? 'number' : 'text'}
              className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30" />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#374151] mb-1">Type contrat</label>
            <select value={form.type_contrat} onChange={e => setForm(p => ({ ...p, type_contrat: e.target.value }))}
              className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none bg-white">
              {['cdi','cdd','interim','vacation'].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#374151] mb-1">Date embauche</label>
            <input type="date" value={form.date_embauche} onChange={e => setForm(p => ({ ...p, date_embauche: e.target.value }))}
              className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">Annuler</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 bg-[#F59E0B] text-white rounded-xl text-[12px] font-bold hover:bg-[#D97706] disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 size={12} className="animate-spin" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Client ──────────────────────────────────────────────────────────────

function ModalClient({ tenantId, onClose, onSaved }: { tenantId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ nom: '', secteur: '', contact_nom: '', contact_email: '', contact_tel: '', ville: '', taux: '', mode_facturation: 'mensuel' })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.nom) return
    setSaving(true)
    await supabase.from('mad_clients').insert({
      tenant_id: tenantId, nom: form.nom, secteur_activite: form.secteur || null,
      contact_nom: form.contact_nom || null, contact_email: form.contact_email || null,
      contact_tel: form.contact_tel || null, ville: form.ville || null,
      taux_facturation_defaut: form.taux ? parseFloat(form.taux) : null,
      mode_facturation: form.mode_facturation, actif: true,
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[15px] font-bold text-[#0F172A]">Nouveau client</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8]"><X size={15} /></button>
        </div>
        {[
          { key: 'nom',          label: 'Raison sociale *', placeholder: 'Total Congo S.A.' },
          { key: 'secteur',      label: 'Secteur',          placeholder: 'Pétrole & Énergie' },
          { key: 'contact_nom',  label: 'Contact',          placeholder: 'Directeur RH'      },
          { key: 'contact_email',label: 'Email contact',    placeholder: 'rh@client.cg'       },
          { key: 'contact_tel',  label: 'Téléphone',        placeholder: '+242 06 123 4567'   },
          { key: 'ville',        label: 'Ville',            placeholder: 'Brazzaville'        },
          { key: 'taux',         label: 'Taux facturation défaut (FCFA/h)', placeholder: '2500' },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-[11px] font-semibold text-[#374151] mb-1">{label}</label>
            <input value={form[key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              placeholder={placeholder} type={key === 'taux' ? 'number' : 'text'}
              className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30" />
          </div>
        ))}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">Annuler</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 bg-[#F59E0B] text-white rounded-xl text-[12px] font-bold hover:bg-[#D97706] disabled:opacity-60">
            {saving ? 'Enregistrement…' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function MiseADispositionPage() {
  const { tenantId, loading: tl } = useTenant()

  const [tab, setTab]                   = useState<Tab>('overview')
  const [clients, setClients]           = useState<MadClient[]>([])
  const [employes, setEmployes]         = useState<MadEmploye[]>([])
  const [affectations, setAffectations] = useState<MadAffectation[]>([])
  const [presences, setPresences]       = useState<MadPresence[]>([])
  const [factures, setFactures]         = useState<MadFacture[]>([])
  const [paies, setPaies]               = useState<MadPaie[]>([])
  const [cnss, setCnss]                 = useState<MadCnss | null>(null)
  const [alerts, setAlerts]             = useState<Alert[]>([])
  const [loading, setLoading]           = useState(true)

  const [showModalAff, setShowModalAff]       = useState(false)
  const [showModalEmp, setShowModalEmp]       = useState(false)
  const [showModalClient, setShowModalClient] = useState(false)
  const [editAff, setEditAff]                 = useState<MadAffectation | undefined>()
  const [searchEmp, setSearchEmp]             = useState('')
  const [searchAff, setSearchAff]             = useState('')

  // Présence month selector
  const now = new Date()
  const [presenceMois, setPresenceMois] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    const sd = async <T,>(p: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> => {
      try { const r = await p; return (r.data as T[]) ?? [] } catch { return [] }
    }

    const [cls, emps, affs, facts, ps] = await Promise.all([
      sd<MadClient>(supabase.from('mad_clients').select('*').eq('tenant_id', tenantId).order('nom')),
      sd<MadEmploye>(supabase.from('mad_employes').select('*').eq('tenant_id', tenantId).order('nom')),
      sd<MadAffectation>(supabase.from('mad_affectations').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })),
      sd<MadFacture>(supabase.from('mad_factures').select('*').eq('tenant_id', tenantId).order('mois', { ascending: false }).limit(50)),
      sd<MadPaie>(supabase.from('mad_paie').select('*').eq('tenant_id', tenantId).order('mois', { ascending: false }).limit(50)),
    ])

    const [{ data: cnssData }] = await Promise.all([
      supabase.from('mad_cnss').select('*').eq('tenant_id', tenantId).order('mois', { ascending: false }).limit(1).maybeSingle(),
    ])

    const empMap  = Object.fromEntries(emps.map(e => [e.id, e]))
    const clientMap = Object.fromEntries(cls.map(c => [c.id, c]))

    const enrichedAffs: MadAffectation[] = affs.map(a => ({
      ...a,
      employe_nom:   empMap[a.employe_id]?.nom ?? null,
      employe_prenom: empMap[a.employe_id]?.prenom ?? null,
      client_nom:    clientMap[a.client_id]?.nom ?? null,
      jours_restants: jours(a.date_fin_prevue),
    }))

    const enrichedFacts: MadFacture[] = facts.map(f => ({
      ...f, client_nom: clientMap[f.client_id]?.nom ?? '—',
    }))

    const enrichedPaies: MadPaie[] = ps.map(p => ({
      ...p,
      employe_nom:    empMap[p.employe_id]?.nom ?? null,
      employe_prenom: empMap[p.employe_id]?.prenom ?? null,
    }))

    setClients(cls)
    setEmployes(emps)
    setAffectations(enrichedAffs)
    setFactures(enrichedFacts)
    setPaies(enrichedPaies)
    setCnss(cnssData as MadCnss | null)

    // ── Load presences for selected month ──
    const presMonth = await sd<MadPresence>(
      supabase.from('mad_presences').select('*')
        .eq('tenant_id', tenantId).gte('mois', presenceMois).lte('mois', presenceMois)
    )
    setPresences(presMonth.map(p => ({
      ...p,
      employe_nom:    empMap[p.employe_id]?.nom ?? null,
      employe_prenom: empMap[p.employe_id]?.prenom ?? null,
      poste:         enrichedAffs.find(a => a.id === p.affectation_id)?.poste_client ?? null,
    })))

    // ── Build MIAA+ alerts ──
    const newAlerts: Alert[] = []
    const activeAffs = enrichedAffs.filter(a => a.statut === 'active')

    activeAffs.forEach(a => {
      const j = a.jours_restants
      if (j != null && j >= 0 && j <= 30) {
        newAlerts.push({
          id: `fin-${a.id}`,
          type: 'fin_mission',
          label: `Fin de mission : ${a.employe_prenom} ${a.employe_nom}`,
          detail: `Chez ${a.client_nom} — poste ${a.poste_client}`,
          urgence: j <= 7 ? 'haute' : j <= 15 ? 'moyenne' : 'info',
          jours: j,
        })
      }
      if (a.statut === 'en_renouvellement') {
        newAlerts.push({
          id: `renouv-${a.id}`,
          type: 'renouvellement',
          label: `Renouvellement en attente : ${a.employe_prenom} ${a.employe_nom}`,
          detail: `Mission chez ${a.client_nom}`,
          urgence: 'moyenne',
        })
      }
    })

    const facturesEnRetard = enrichedFacts.filter(f => f.statut === 'en_retard')
    facturesEnRetard.forEach(f => {
      newAlerts.push({
        id: `fact-${f.id}`,
        type: 'facture_retard',
        label: `Facture en retard : ${f.client_nom}`,
        detail: `Réf. ${f.reference} — ${formatMontant(f.montant_ttc)}`,
        urgence: 'haute',
      })
    })

    if (cnssData) {
      const j = jours((cnssData as MadCnss).date_echeance)
      if (j !== null && j <= 10 && (cnssData as MadCnss).statut !== 'paye') {
        newAlerts.push({
          id: 'cnss-due',
          type: 'cnss',
          label: `Déclaration CNSS — ${moisLabel((cnssData as MadCnss).mois)}`,
          detail: `Total : ${formatMontant((cnssData as MadCnss).total_cnss)}`,
          urgence: j <= 3 ? 'haute' : 'moyenne',
          jours: j ?? undefined,
        })
      }
    }

    setAlerts(newAlerts)
    setLoading(false)
  }, [tenantId, presenceMois])

  useEffect(() => { if (tenantId) void load() }, [tenantId, load])

  // ── Actions affectation ────────────────────────────────────────────────────
  async function updateAffStatut(id: string, statut: string, motif?: string) {
    const update: Record<string, unknown> = { statut }
    if (motif) update.motif_fin = motif
    if (statut === 'terminee') update.date_fin_reelle = new Date().toISOString().slice(0, 10)
    await supabase.from('mad_affectations').update(update).eq('id', id)
    if (statut === 'terminee') {
      const aff = affectations.find(a => a.id === id)
      if (aff) await supabase.from('mad_employes').update({ statut: 'disponible' }).eq('id', aff.employe_id)
    }
    void load()
  }

  async function renouveler(id: string) {
    const aff = affectations.find(a => a.id === id)
    if (!aff) return
    const newFin = aff.date_fin_prevue
      ? new Date(new Date(aff.date_fin_prevue).getTime() + 90 * 86_400_000).toISOString().slice(0, 10)
      : null
    await supabase.from('mad_affectations').update({
      statut: 'active',
      date_fin_prevue: newFin,
      renouvellements: (aff.renouvellements ?? 0) + 1,
    }).eq('id', id)
    void load()
  }

  async function validerPresence(presId: string) {
    await supabase.from('mad_presences').update({ valide: true }).eq('id', presId)
    setPresences(prev => prev.map(p => p.id === presId ? { ...p, valide: true } : p))
  }

  async function saisirPresence(affId: string, empId: string) {
    const moisISO = presenceMois
    const { data } = await supabase.from('mad_presences')
      .select('id').eq('affectation_id', affId).eq('mois', moisISO).maybeSingle()
    if (!data) {
      await supabase.from('mad_presences').insert({
        tenant_id: tenantId, affectation_id: affId, employe_id: empId, mois: moisISO,
        jours_travailles: 22, jours_absents: 0, jours_conges: 0,
        heures_normales: 176, heures_sup: 0,
      })
      void load()
    }
  }

  // ── Filtered lists ─────────────────────────────────────────────────────────
  const filteredEmps = employes.filter(e =>
    !searchEmp || [e.prenom, e.nom, e.poste_habituel, e.ville].join(' ').toLowerCase().includes(searchEmp.toLowerCase())
  )
  const filteredAffs = affectations.filter(a =>
    !searchAff || [a.employe_nom, a.employe_prenom, a.client_nom, a.poste_client].join(' ').toLowerCase().includes(searchAff.toLowerCase())
  )
  const affActives = affectations.filter(a => a.statut === 'active')
  const caTotal = factures.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.montant_ttc ?? 0), 0)
  const caMois = factures.filter(f => f.statut !== 'annulee' && f.mois.startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)).reduce((s, f) => s + (f.montant_ttc ?? 0), 0)

  if (tl || loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-14 bg-[#F8FAFC] rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array(4).fill(0).map((_, i) => <div key={i} className="h-24 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0]" />)}
      </div>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-6">

      {/* Header */}
      <div className="rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3"
        style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)' }}>
        <div>
          <h1 className="text-[17px] sm:text-xl font-extrabold text-white">Mise à Disposition du Personnel</h1>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">
            Secondment, outsourcing RH, paie & social — {affActives.length} mission{affActives.length !== 1 ? 's' : ''} active{affActives.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {alerts.filter(a => a.urgence === 'haute').length > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-xl text-[11px] font-bold text-red-300">
              <AlertTriangle size={12} /> {alerts.filter(a => a.urgence === 'haute').length} alerte{alerts.filter(a => a.urgence === 'haute').length > 1 ? 's' : ''} urgente{alerts.filter(a => a.urgence === 'haute').length > 1 ? 's' : ''}
            </span>
          )}
          <button onClick={() => { setEditAff(undefined); setShowModalAff(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-[#F59E0B] text-white rounded-xl text-[13px] font-bold hover:bg-[#D97706] shadow-sm">
            <Plus size={14} /> Nouvelle affectation
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {TABS.map(t => {
          const Icon = t.icon
          const isActive = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap shrink-0 transition-all ${isActive ? 'bg-[#F59E0B] text-white shadow-sm' : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'}`}
            >
              <Icon size={12} /> {t.label}
              {t.key === 'overview' && alerts.length > 0 && (
                <span className={`text-[9px] font-bold px-1 rounded-full ${isActive ? 'bg-white/30 text-white' : 'bg-red-100 text-red-600'}`}>{alerts.length}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Tab: Vue d'ensemble ─── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard icon={UserCog}    label="Affectations actives"  value={affActives.length}           color="#2563EB" />
            <KpiCard icon={Users}      label="Employés disponibles"  value={employes.filter(e => e.statut === 'disponible').length}  color="#16A34A" />
            <KpiCard icon={Building2}  label="Clients actifs"        value={clients.filter(c => c.actif).length}                    color="#7C3AED" />
            <KpiCard icon={DollarSign} label={`CA ${now.getFullYear()}`} value={formatMontant(caTotal)}  color="#F59E0B" />
            <KpiCard icon={AlertTriangle} label="Alertes MIAA+"      value={alerts.length}               color="#DC2626" alert={alerts.some(a => a.urgence === 'haute')} />
          </div>

          {/* MIAA+ Alertes */}
          {alerts.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] flex items-center justify-center">
                  <Sparkles size={13} className="text-white" />
                </div>
                <p className="text-[13px] font-bold text-[#0F172A]">MIAA+ Surveillance automatique</p>
                <span className="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-semibold ml-auto">{alerts.length} alerte{alerts.length > 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {[...alerts.filter(a => a.urgence === 'haute'), ...alerts.filter(a => a.urgence === 'moyenne'), ...alerts.filter(a => a.urgence === 'info')].map(alert => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </div>
          )}

          {alerts.length === 0 && (
            <div className="bg-gradient-to-br from-[#F0FDF4] to-white rounded-2xl border border-green-200 p-5 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center">
                <Sparkles size={18} className="text-green-600" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-green-800">MIAA+ — Aucune alerte</p>
                <p className="text-[11px] text-green-600">Toutes les missions sont dans les délais. RAS.</p>
              </div>
            </div>
          )}

          {/* Affectations récentes */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-bold text-[#0F172A]">Affectations actives</p>
              <button onClick={() => setTab('affectations')} className="text-[11px] text-[#F59E0B] font-semibold hover:text-[#D97706]">Voir tout →</button>
            </div>
            {affActives.length === 0 ? (
              <p className="text-[12px] text-[#94A3B8] text-center py-4">Aucune affectation active</p>
            ) : (
              <div className="space-y-2">
                {affActives.slice(0, 5).map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#F8FAFC] transition-colors">
                    <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0">
                      <UserCog size={13} className="text-[#2563EB]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#0F172A] truncate">{a.employe_prenom} {a.employe_nom}</p>
                      <p className="text-[10px] text-[#94A3B8] truncate">{a.client_nom} · {a.poste_client}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {a.jours_restants !== null && a.jours_restants !== undefined && a.date_fin_prevue && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${a.jours_restants <= 7 ? 'bg-red-100 text-red-600' : a.jours_restants <= 30 ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                          J-{a.jours_restants}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Affectations ─── */}
      {tab === 'affectations' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input value={searchAff} onChange={e => setSearchAff(e.target.value)}
                placeholder="Rechercher employé, client…"
                className="w-full pl-8 pr-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30" />
            </div>
            <button onClick={() => { setEditAff(undefined); setShowModalAff(true) }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#F59E0B] text-white rounded-xl text-[12px] font-bold hover:bg-[#D97706]">
              <Plus size={13} /> Affecter
            </button>
          </div>

          {filteredAffs.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-10 text-center">
              <UserCog size={32} className="text-[#CBD5E1] mx-auto mb-2" />
              <p className="text-[13px] text-[#64748B]">Aucune affectation</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAffs.map(a => {
                const st = STATUT_AFF[a.statut] ?? STATUT_AFF['active']
                return (
                  <div key={a.id} className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center shrink-0">
                        <UserCog size={16} className="text-[#2563EB]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="text-[13px] font-bold text-[#0F172A]">{a.employe_prenom} {a.employe_nom}</p>
                          <Badge label={st.label} color={st.color} bg={st.bg} />
                          {a.renouvellements > 0 && (
                            <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold">{a.renouvellements} renouvellement{a.renouvellements > 1 ? 's' : ''}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#64748B]">{a.client_nom} · {a.poste_client}</p>
                        <div className="flex gap-3 mt-1 flex-wrap text-[10px] text-[#94A3B8]">
                          <span>Début: {new Date(a.date_debut).toLocaleDateString('fr-FR')}</span>
                          {a.date_fin_prevue && (
                            <span className={a.jours_restants !== null && a.jours_restants !== undefined && a.jours_restants <= 30 ? 'text-amber-600 font-semibold' : ''}>
                              Fin prévue: {new Date(a.date_fin_prevue).toLocaleDateString('fr-FR')}
                              {a.jours_restants !== null && a.jours_restants !== undefined && ` (J-${a.jours_restants})`}
                            </span>
                          )}
                          {a.salaire_mensuel_brut && <span>Salaire: {formatMontant(a.salaire_mensuel_brut)}</span>}
                          {a.taux_horaire_facture && <span>Taux: {a.taux_horaire_facture} FCFA/h</span>}
                        </div>
                      </div>
                      {/* Actions */}
                      {a.statut === 'active' && (
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button onClick={() => { setEditAff(a); setShowModalAff(true) }}
                            className="text-[10px] px-2 py-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#64748B] hover:bg-[#F1F5F9] flex items-center gap-1">
                            <Edit3 size={9} /> Modifier
                          </button>
                          <button onClick={() => renouveler(a.id)}
                            className="text-[10px] px-2 py-1 bg-[#EFF6FF] border border-blue-200 rounded-lg text-[#2563EB] hover:bg-[#DBEAFE] flex items-center gap-1">
                            <Repeat size={9} /> Renouveler
                          </button>
                          <button onClick={() => updateAffStatut(a.id, 'transfert')}
                            className="text-[10px] px-2 py-1 bg-[#F5F3FF] border border-purple-200 rounded-lg text-[#7C3AED] hover:bg-[#EDE9FE] flex items-center gap-1">
                            <ArrowRightLeft size={9} /> Transfert
                          </button>
                          <button onClick={() => updateAffStatut(a.id, 'terminee', 'terme')}
                            className="text-[10px] px-2 py-1 bg-[#FEF2F2] border border-red-200 rounded-lg text-red-500 hover:bg-[#FEE2E2] flex items-center gap-1">
                            <XCircle size={9} /> Terminer
                          </button>
                        </div>
                      )}
                      {a.statut === 'terminee' && (
                        <div className="text-[10px] text-[#94A3B8] shrink-0">
                          {a.date_fin_reelle ? new Date(a.date_fin_reelle).toLocaleDateString('fr-FR') : ''}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Employés ─── */}
      {tab === 'employes' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input value={searchEmp} onChange={e => setSearchEmp(e.target.value)}
                placeholder="Rechercher un employé…"
                className="w-full pl-8 pr-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30" />
            </div>
            <button onClick={() => setShowModalEmp(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#F59E0B] text-white rounded-xl text-[12px] font-bold hover:bg-[#D97706]">
              <Plus size={13} /> Nouvel employé
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredEmps.map(e => {
              const st = STATUT_EMP[e.statut] ?? STATUT_EMP['disponible']
              const affCourante = affectations.find(a => a.employe_id === e.id && a.statut === 'active')
              return (
                <div key={e.id} className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0"
                      style={{ background: 'linear-gradient(135deg, #1E293B, #475569)' }}>
                      {(e.prenom[0] ?? '') + (e.nom[0] ?? '')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-[13px] font-bold text-[#0F172A]">{e.prenom} {e.nom}</p>
                        <Badge label={st.label} color={st.color} bg={st.bg} />
                      </div>
                      <p className="text-[11px] text-[#64748B]">{e.poste_habituel}{e.qualification ? ` · ${e.qualification}` : ''}</p>
                      {affCourante && (
                        <p className="text-[10px] text-[#2563EB] font-semibold mt-0.5">{affCourante.client_nom} · {affCourante.poste_client}</p>
                      )}
                      <div className="flex gap-3 mt-1 text-[10px] text-[#94A3B8] flex-wrap">
                        {e.email && <span>{e.email}</span>}
                        {e.numero_cnss && <span>CNSS: {e.numero_cnss}</span>}
                        {e.salaire_base && <span>{formatMontant(e.salaire_base)}/mois</span>}
                        <span className="uppercase">{e.type_contrat}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {filteredEmps.length === 0 && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-10 text-center">
              <Users size={32} className="text-[#CBD5E1] mx-auto mb-2" />
              <p className="text-[13px] text-[#64748B]">Aucun employé enregistré</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Clients ─── */}
      {tab === 'clients' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowModalClient(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#F59E0B] text-white rounded-xl text-[12px] font-bold hover:bg-[#D97706]">
              <Plus size={13} /> Nouveau client
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {clients.map(c => {
              const nbAffs = affectations.filter(a => a.client_id === c.id && a.statut === 'active').length
              const caClient = factures.filter(f => f.client_id === c.id && f.statut === 'payee').reduce((s, f) => s + f.montant_ttc, 0)
              return (
                <div key={c.id} className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center shrink-0">
                      <Building2 size={16} className="text-[#2563EB]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-bold text-[#0F172A] truncate">{c.nom}</p>
                        {!c.actif && <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Inactif</span>}
                      </div>
                      {c.secteur_activite && <p className="text-[11px] text-[#64748B]">{c.secteur_activite}</p>}
                      <div className="flex gap-3 mt-1.5 text-[10px] text-[#94A3B8] flex-wrap">
                        {c.contact_nom && <span>{c.contact_nom}</span>}
                        {c.contact_email && <span>{c.contact_email}</span>}
                        {c.contact_tel && <span>{c.contact_tel}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-3 pt-3 border-t border-[#F1F5F9] text-center">
                    <div className="flex-1">
                      <p className="text-[16px] font-extrabold text-[#2563EB]">{nbAffs}</p>
                      <p className="text-[9px] text-[#94A3B8]">affectation{nbAffs !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-[16px] font-extrabold text-[#16A34A]">{formatMontant(caClient)}</p>
                      <p className="text-[9px] text-[#94A3B8]">CA généré</p>
                    </div>
                    {c.taux_facturation_defaut && (
                      <div className="flex-1">
                        <p className="text-[16px] font-extrabold text-[#F59E0B]">{c.taux_facturation_defaut}</p>
                        <p className="text-[9px] text-[#94A3B8]">FCFA/h</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {clients.length === 0 && (
              <div className="col-span-2 bg-white rounded-xl border border-[#E2E8F0] p-10 text-center">
                <Building2 size={32} className="text-[#CBD5E1] mx-auto mb-2" />
                <p className="text-[13px] text-[#64748B]">Aucun client enregistré</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Présences ─── */}
      {tab === 'presences' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-[12px] font-semibold text-[#374151]">Mois :</label>
              <input type="month"
                value={presenceMois.slice(0, 7)}
                onChange={e => { setPresenceMois(`${e.target.value}-01`); void load() }}
                className="px-3 py-1.5 text-[12px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none" />
            </div>
            <p className="text-[11px] text-[#64748B]">
              {presences.filter(p => p.valide).length}/{affActives.length} présences validées
            </p>
          </div>

          {affActives.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-10 text-center">
              <Calendar size={32} className="text-[#CBD5E1] mx-auto mb-2" />
              <p className="text-[13px] text-[#64748B]">Aucune affectation active</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-[#64748B]">Employé</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-[#64748B] hidden sm:table-cell">Client</th>
                    <th className="text-center py-2.5 px-2 text-[11px] font-semibold text-[#64748B]">Jours</th>
                    <th className="text-center py-2.5 px-2 text-[11px] font-semibold text-[#64748B]">Abs.</th>
                    <th className="text-center py-2.5 px-2 text-[11px] font-semibold text-[#64748B]">H.Sup</th>
                    <th className="text-center py-2.5 px-2 text-[11px] font-semibold text-[#64748B]">Statut</th>
                    <th className="py-2.5 px-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {affActives.map(a => {
                    const pres = presences.find(p => p.affectation_id === a.id)
                    return (
                      <tr key={a.id} className="hover:bg-[#FAFAFA]">
                        <td className="py-2.5 px-4">
                          <p className="font-semibold text-[#0F172A]">{a.employe_prenom} {a.employe_nom}</p>
                          <p className="text-[10px] text-[#94A3B8]">{a.poste_client}</p>
                        </td>
                        <td className="py-2.5 px-3 text-[#64748B] hidden sm:table-cell">{a.client_nom}</td>
                        <td className="py-2.5 px-2 text-center font-bold text-[#0F172A]">{pres?.jours_travailles ?? '—'}</td>
                        <td className="py-2.5 px-2 text-center text-red-500">{pres?.jours_absents ?? '—'}</td>
                        <td className="py-2.5 px-2 text-center text-amber-600">{pres?.heures_sup ?? '—'}</td>
                        <td className="py-2.5 px-2 text-center">
                          {pres ? (
                            pres.valide
                              ? <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-semibold">Validé</span>
                              : <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold">À valider</span>
                          ) : (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Non saisi</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {!pres && (
                            <button onClick={() => saisirPresence(a.id, a.employe_id)}
                              className="text-[10px] bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] px-2 py-1 rounded-lg hover:bg-[#F1F5F9]">
                              Saisir
                            </button>
                          )}
                          {pres && !pres.valide && (
                            <button onClick={() => validerPresence(pres.id)}
                              className="text-[10px] bg-green-50 border border-green-200 text-green-600 px-2 py-1 rounded-lg hover:bg-green-100 flex items-center gap-1">
                              <CheckCircle size={9} /> Valider
                            </button>
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
      )}

      {/* ── Tab: Facturation ─── */}
      {tab === 'facturation' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'CA ce mois', value: formatMontant(caMois), color: '#F59E0B', icon: DollarSign },
              { label: 'Factures émises', value: factures.filter(f => f.statut === 'emise').length, color: '#2563EB', icon: FileText },
              { label: 'En retard',   value: factures.filter(f => f.statut === 'en_retard').length, color: '#DC2626', icon: AlertCircle },
              { label: 'Payées total', value: factures.filter(f => f.statut === 'payee').length, color: '#16A34A', icon: CheckCircle },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="bg-white rounded-xl border border-[#E2E8F0] p-3 shadow-sm">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background: color + '18' }}>
                  <Icon size={13} style={{ color }} />
                </div>
                <p className="text-[18px] font-extrabold text-[#0F172A]">{value}</p>
                <p className="text-[10px] text-[#64748B]">{label}</p>
              </div>
            ))}
          </div>
          {factures.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-10 text-center">
              <FileText size={32} className="text-[#CBD5E1] mx-auto mb-2" />
              <p className="text-[13px] text-[#64748B]">Aucune facture — exécutez la migration 111 d&apos;abord</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-[#64748B]">Référence</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-[#64748B] hidden sm:table-cell">Client</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-[#64748B] hidden sm:table-cell">Mois</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-[#64748B]">Montant TTC</th>
                    <th className="text-center py-2.5 px-3 text-[11px] font-semibold text-[#64748B]">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {factures.map(f => {
                    const st = STATUT_FACT[f.statut] ?? STATUT_FACT['brouillon']
                    return (
                      <tr key={f.id} className="hover:bg-[#FAFAFA]">
                        <td className="py-2.5 px-4 font-semibold text-[#0F172A]">{f.reference}</td>
                        <td className="py-2.5 px-3 text-[#64748B] hidden sm:table-cell">{f.client_nom}</td>
                        <td className="py-2.5 px-3 text-[#64748B] hidden sm:table-cell">{moisLabel(f.mois)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#0F172A]">{formatMontant(f.montant_ttc)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge label={st.label} color={st.color} bg={st.bg} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Paie & Social ─── */}
      {tab === 'paie' && (
        <div className="space-y-4">
          {/* CNSS résumé */}
          {cnss ? (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={15} className="text-[#7C3AED]" />
                <p className="text-[13px] font-bold text-[#0F172A]">CNSS — {moisLabel(cnss.mois)}</p>
                <Badge label={cnss.statut === 'paye' ? 'Payé' : cnss.statut === 'declare' ? 'Déclaré' : 'À déclarer'}
                  color={cnss.statut === 'paye' ? '#16A34A' : cnss.statut === 'declare' ? '#2563EB' : '#D97706'}
                  bg={cnss.statut === 'paye' ? '#F0FDF4' : cnss.statut === 'declare' ? '#EFF6FF' : '#FFFBEB'} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Employés', value: cnss.nb_employes, color: '#2563EB' },
                  { label: 'Salaires bruts', value: formatMontant(cnss.salaire_brut_total), color: '#F59E0B' },
                  { label: 'Cotisation salarié (5.4%)', value: formatMontant(cnss.cotisation_salarie), color: '#7C3AED' },
                  { label: 'Cotisation patronale (19.2%)', value: formatMontant(cnss.cotisation_patronale), color: '#DC2626' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[#F8FAFC] rounded-xl p-3">
                    <p className="text-[16px] font-extrabold" style={{ color }}>{value}</p>
                    <p className="text-[10px] text-[#64748B] mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              {cnss.date_echeance && (
                <p className="text-[11px] text-[#64748B] mt-3">
                  Échéance : <span className="font-semibold text-[#0F172A]">{new Date(cnss.date_echeance).toLocaleDateString('fr-FR')}</span>
                  {cnss.irpp_total > 0 && ` · IRPP total : ${formatMontant(cnss.irpp_total)}`}
                </p>
              )}
            </div>
          ) : (
            <div className="bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] p-4 text-center">
              <p className="text-[12px] text-[#94A3B8]">Aucune déclaration CNSS. Calculez la paie pour générer la déclaration.</p>
            </div>
          )}

          {/* Fiches de paie */}
          <div>
            <p className="text-[13px] font-bold text-[#0F172A] mb-3">Fiches de paie</p>
            {paies.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-10 text-center">
                <CreditCard size={28} className="text-[#CBD5E1] mx-auto mb-2" />
                <p className="text-[12px] text-[#94A3B8]">Aucune fiche de paie</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                      <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-[#64748B]">Employé</th>
                      <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-[#64748B] hidden sm:table-cell">Mois</th>
                      <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-[#64748B]">Brut</th>
                      <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-[#64748B]">CNSS</th>
                      <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-[#64748B]">IRPP</th>
                      <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-[#64748B]">Net</th>
                      <th className="text-center py-2.5 px-3 text-[11px] font-semibold text-[#64748B]">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {paies.map(p => (
                      <tr key={p.id} className="hover:bg-[#FAFAFA]">
                        <td className="py-2.5 px-4 font-semibold text-[#0F172A]">{p.employe_prenom} {p.employe_nom}</td>
                        <td className="py-2.5 px-3 text-[#64748B] hidden sm:table-cell">{moisLabel(p.mois)}</td>
                        <td className="py-2.5 px-3 text-right text-[#0F172A]">{formatMontant(p.salaire_brut)}</td>
                        <td className="py-2.5 px-3 text-right text-[#7C3AED]">{formatMontant(p.cotisation_cnss_salarie)}</td>
                        <td className="py-2.5 px-3 text-right text-[#D97706]">{formatMontant(p.irpp)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#16A34A]">{formatMontant(p.salaire_net)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge
                            label={p.statut === 'paye' ? 'Payé' : p.statut === 'valide' ? 'Validé' : 'Calculé'}
                            color={p.statut === 'paye' ? '#16A34A' : p.statut === 'valide' ? '#2563EB' : '#D97706'}
                            bg={p.statut === 'paye' ? '#F0FDF4' : p.statut === 'valide' ? '#EFF6FF' : '#FFFBEB'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Contrats ─── */}
      {tab === 'contrats' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'CDI actifs',    value: employes.filter(e => e.type_contrat === 'cdi').length,   color: '#16A34A' },
              { label: 'CDD actifs',    value: employes.filter(e => e.type_contrat === 'cdd').length,   color: '#2563EB' },
              { label: 'Intérim',       value: employes.filter(e => e.type_contrat === 'interim').length, color: '#F59E0B' },
              { label: 'Vacataires',    value: employes.filter(e => e.type_contrat === 'vacation').length, color: '#7C3AED' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl border border-[#E2E8F0] p-3 shadow-sm text-center">
                <p className="text-[22px] font-extrabold" style={{ color }}>{value}</p>
                <p className="text-[11px] text-[#64748B]">{label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-[#F1F5F9]">
              <p className="text-[13px] font-bold text-[#0F172A]">Historique des affectations</p>
            </div>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-[#64748B]">Employé</th>
                  <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-[#64748B] hidden sm:table-cell">Client</th>
                  <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-[#64748B] hidden md:table-cell">Période</th>
                  <th className="text-center py-2.5 px-3 text-[11px] font-semibold text-[#64748B]">Renouv.</th>
                  <th className="text-center py-2.5 px-3 text-[11px] font-semibold text-[#64748B]">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {affectations.map(a => {
                  const st = STATUT_AFF[a.statut] ?? STATUT_AFF['active']
                  return (
                    <tr key={a.id} className="hover:bg-[#FAFAFA]">
                      <td className="py-2.5 px-4 font-semibold text-[#0F172A]">{a.employe_prenom} {a.employe_nom}</td>
                      <td className="py-2.5 px-3 text-[#64748B] hidden sm:table-cell">{a.client_nom}</td>
                      <td className="py-2.5 px-3 text-[#64748B] hidden md:table-cell">
                        {new Date(a.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}
                        {a.date_fin_prevue ? ` → ${new Date(a.date_fin_prevue).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}` : ' → ∞'}
                      </td>
                      <td className="py-2.5 px-3 text-center text-[#64748B]">{a.renouvellements}×</td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge label={st.label} color={st.color} bg={st.bg} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {affectations.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-[12px] text-[#94A3B8]">Aucun historique de contrat</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ─── */}
      {showModalAff && (
        <ModalAffectation
          employes={employes} clients={clients} tenantId={tenantId ?? ''}
          onClose={() => { setShowModalAff(false); setEditAff(undefined) }}
          onSaved={() => { setShowModalAff(false); setEditAff(undefined); void load() }}
          aff={editAff}
        />
      )}
      {showModalEmp && (
        <ModalEmploye tenantId={tenantId ?? ''} onClose={() => setShowModalEmp(false)}
          onSaved={() => { setShowModalEmp(false); void load() }} />
      )}
      {showModalClient && (
        <ModalClient tenantId={tenantId ?? ''} onClose={() => setShowModalClient(false)}
          onSaved={() => { setShowModalClient(false); void load() }} />
      )}
    </div>
  )
}
