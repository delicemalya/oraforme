'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UsersRound, Plus, Mail, Shield, User, Check, X,
  ChevronDown, Eye, Edit3, Trash2, Loader2,
  BookMarked, BarChart2, Users, Calculator,
  GraduationCap, HeartHandshake, Bot,
  FileText, Package, Wallet, ChefHat,
  ShoppingCart, Receipt, Truck, Hotel, BookOpen,
  Lock, ShieldAlert, Send,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import type { LucideIcon } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = 'owner' | 'admin' | 'membre'

interface Member {
  id:              string
  user_id:         string
  nom:             string
  prenom:          string
  role:            Role
  dynamic_role_id: string | null
  email?:          string
}

interface Perm {
  module_key: string
  can_view:   boolean
  can_edit:   boolean
  can_delete: boolean
}

interface DynamicRole {
  id:           string
  name:         string
  color:        string
  is_financial: boolean
}

// ── Définition des modules par secteur ───────────────────────────────────────

type ModuleDef = { id: string; label: string; sublabel: string; icon: LucideIcon; color: string }

const SECTOR_MODULE_DEFS: Record<string, ModuleDef[]> = {
  ecole: [
    { id: 'scolarite',       label: 'Scolarité',       sublabel: 'Inscriptions & notes', icon: BookMarked,     color: '#DC2626' },
    { id: 'direction',       label: 'Direction',       sublabel: 'Finances & pilotage',  icon: BarChart2,      color: '#DC2626' },
    { id: 'rh',              label: 'RH & Paie',       sublabel: 'Personnel',            icon: Users,          color: '#0F172A' },
    { id: 'comptabilite',    label: 'Comptabilité',    sublabel: 'OHADA',                icon: Calculator,     color: '#7C3AED' },
    { id: 'espace-etudiant', label: 'Espace Étudiant', sublabel: 'Dossiers élèves',      icon: GraduationCap,  color: '#0F172A' },
    { id: 'espace-parent',   label: 'Espace Parent',   sublabel: 'Suivi familles',       icon: HeartHandshake, color: '#7C3AED' },
    { id: 'miaa',            label: 'MIAA+',           sublabel: 'IA scolaire',          icon: Bot,            color: '#DC2626' },
  ],
  restaurant: [
    { id: 'pos',        label: 'Caisse POS',  sublabel: 'Ventes',     icon: ChefHat,   color: '#DC2626' },
    { id: 'stock',      label: 'Stock',       sublabel: 'Inventaire', icon: Package,   color: '#0F172A' },
    { id: 'rh',         label: 'RH & Paie',  sublabel: 'Personnel',  icon: Users,     color: '#DC2626' },
    { id: 'tresorerie', label: 'Trésorerie',  sublabel: 'Finances',   icon: Wallet,    color: '#7C3AED' },
    { id: 'miaa',       label: 'MIAA+',       sublabel: 'IA',         icon: Bot,       color: '#DC2626' },
  ],
  commerce: [
    { id: 'facturation', label: 'Facturation', sublabel: 'Devis',      icon: FileText,  color: '#DC2626' },
    { id: 'stock',       label: 'Stock',       sublabel: 'Inventaire', icon: Package,   color: '#0F172A' },
    { id: 'rh',          label: 'RH & Paie',  sublabel: 'Personnel',  icon: Users,     color: '#DC2626' },
    { id: 'tresorerie',  label: 'Trésorerie',  sublabel: 'Finances',   icon: Wallet,    color: '#7C3AED' },
    { id: 'miaa',        label: 'MIAA+',       sublabel: 'IA',         icon: Bot,       color: '#DC2626' },
  ],
  default: [
    { id: 'facturation',  label: 'Facturation',  sublabel: '',          icon: FileText,  color: '#DC2626' },
    { id: 'stock',        label: 'Stock',        sublabel: '',          icon: Package,   color: '#0F172A' },
    { id: 'rh',           label: 'RH',           sublabel: '',          icon: Users,     color: '#DC2626' },
    { id: 'tresorerie',   label: 'Trésorerie',   sublabel: '',          icon: Wallet,    color: '#7C3AED' },
    { id: 'comptabilite', label: 'Comptabilité', sublabel: '',          icon: BookOpen,  color: '#7C3AED' },
    { id: 'achats',       label: 'Achats',       sublabel: '',          icon: ShoppingCart, color: '#0F172A' },
    { id: 'depenses',     label: 'Dépenses',     sublabel: '',          icon: Receipt,   color: '#7C3AED' },
    { id: 'transport',    label: 'Transport',    sublabel: '',          icon: Truck,     color: '#DC2626' },
    { id: 'hotel',        label: 'Hôtel',        sublabel: '',          icon: Hotel,     color: '#0F172A' },
  ],
}

// ── Composants utilitaires ────────────────────────────────────────────────────

function RoleBadge({ role, t }: { role: Role; t: (key: string) => string }) {
  const cfg = {
    owner:  { label: 'Owner',                      cls: 'bg-amber-500/15 text-[#DC2626] border-amber-500/20' },
    admin:  { label: t('equipe.roleAdmin'),         cls: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
    membre: { label: t('equipe.roleMembre'),        cls: 'bg-gray-100 text-[var(--text-secondary)] border-gray-200' },
  }
  const { label, cls } = cfg[role]
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${cls}`}>
      {label}
    </span>
  )
}

function Toggle({ checked, onChange, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative w-8 h-4 rounded-full transition-colors ${
        checked ? 'bg-[var(--surface)]' : 'bg-gray-100'
      } ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
        checked ? 'left-4' : 'left-0.5'
      }`} />
    </button>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function EquipePage() {
  const { tenantId, role: myRole, loading: tenantLoading } = useTenant()
  const { t } = useLocale()

  const [secteur,      setSecteur]      = useState<string | null>(null)
  const [members,      setMembers]      = useState<Member[]>([])
  const [selected,     setSelected]     = useState<Member | null>(null)
  const [perms,        setPerms]        = useState<Record<string, Perm>>({})
  const [saving,       setSaving]       = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [dynamicRoles, setDynamicRoles] = useState<DynamicRole[]>([])
  const [inviteOpen,   setInviteOpen]   = useState(false)
  const [inviteEmail,  setInviteEmail]  = useState('')
  const [inviteRole,   setInviteRole]   = useState<'admin' | 'membre'>('membre')
  const [inviting,     setInviting]     = useState(false)
  const [inviteMsg,    setInviteMsg]    = useState<{ ok: boolean; text: string } | null>(null)

  const isOwner = myRole === 'owner'

  // ── Load membres du tenant ────────────────────────────────────────────────
  const loadMembers = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    const [{ data: profilesData }, { data: tenantData }, { data: rolesData }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, user_id, nom, prenom, role, dynamic_role_id')
        .eq('tenant_id', tenantId)
        .order('role'),
      supabase
        .from('tenants')
        .select('secteur_activite')
        .eq('id', tenantId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('roles')
        .select('id, name, color, is_financial')
        .eq('tenant_id', tenantId)
        .order('name'),
    ])

    setSecteur(tenantData?.secteur_activite ?? null)
    setDynamicRoles(rolesData ?? [])

    const list: Member[] = (profilesData ?? []).map(p => ({
      id:              p.id,
      user_id:         p.user_id,
      nom:             p.nom ?? '',
      prenom:          p.prenom ?? '',
      role:            p.role as Role,
      dynamic_role_id: p.dynamic_role_id ?? null,
    }))
    setMembers(list)
    setLoading(false)
  }, [tenantId])

  useEffect(() => { loadMembers() }, [loadMembers])

  // ── Charger les permissions d'un membre ───────────────────────────────────
  async function selectMember(member: Member) {
    setSelected(member)
    if (member.role === 'owner') { setPerms({}); return }

    const { data } = await supabase
      .from('user_permissions')
      .select('module_key, can_view, can_edit, can_delete')
      .eq('profile_id', member.id)

    const map: Record<string, Perm> = {}
    for (const p of data ?? []) map[p.module_key] = p
    setPerms(map)
  }

  // ── Sauvegarder les permissions ───────────────────────────────────────────
  async function savePerms() {
    if (!selected || !tenantId) return
    setSaving(true)

    const rows = Object.values(perms).map(p => ({
      tenant_id:  tenantId,
      profile_id: selected.id,
      module_key: p.module_key,
      can_view:   p.can_view,
      can_edit:   p.can_edit,
      can_delete: p.can_delete,
    }))

    // Supprimer les anciennes et réinsérer
    await supabase.from('user_permissions').delete().eq('profile_id', selected.id)
    if (rows.length > 0) {
      await supabase.from('user_permissions').insert(rows)
    }
    setSaving(false)
  }

  // ── Changer le rôle d'un membre ───────────────────────────────────────────
  async function changeRole(member: Member, newRole: 'admin' | 'membre') {
    await supabase.from('profiles').update({ role: newRole }).eq('id', member.id)
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, role: newRole } : m))
    if (selected?.id === member.id) setSelected(prev => prev ? { ...prev, role: newRole } : null)
  }

  // ── Assigner un rôle dynamique ────────────────────────────────────────────
  async function assignDynamicRole(member: Member, roleId: string | null) {
    await supabase.from('profiles').update({ dynamic_role_id: roleId }).eq('id', member.id)
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, dynamic_role_id: roleId } : m))
    if (selected?.id === member.id) setSelected(prev => prev ? { ...prev, dynamic_role_id: roleId } : null)
  }

  // ── Retirer un membre ─────────────────────────────────────────────────────
  async function removeMember(member: Member) {
  const { t } = useLocale()
    if (!confirm(t('equipe.removeConfirm').replace('{name}', `${member.prenom} ${member.nom}`))) return
    await supabase.from('user_permissions').delete().eq('profile_id', member.id)
    await supabase.from('profiles').update({ tenant_id: null }).eq('id', member.id)
    setMembers(prev => prev.filter(m => m.id !== member.id))
    if (selected?.id === member.id) setSelected(null)
  }

  // ── Inviter un membre ─────────────────────────────────────────────────────
  async function sendInvite() {
  const { t } = useLocale()
    if (!inviteEmail.trim() || !tenantId) return
    setInviting(true)
    setInviteMsg(null)

    // Insérer une invitation dans la table team_invites
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('role', 'owner')
      .maybeSingle()

    const { error } = await supabase.from('team_invites').insert({
      tenant_id:   tenantId,
      invited_by:  myProfile?.id,
      email:       inviteEmail.trim().toLowerCase(),
      role:        inviteRole,
    })

    if (error) {
      setInviteMsg({ ok: false, text: t('equipe.inviteError') })
    } else {
      setInviteMsg({ ok: true, text: `${t('common.sent')} → ${inviteEmail}` })
      setInviteEmail('')
    }
    setInviting(false)
  }

  // ── Modules disponibles pour ce secteur ───────────────────────────────────
  const moduleDefs = SECTOR_MODULE_DEFS[secteur ?? ''] ?? SECTOR_MODULE_DEFS.default

  function setPerm(moduleKey: string, field: 'can_view' | 'can_edit' | 'can_delete', value: boolean) {
    setPerms(prev => {
      const current = prev[moduleKey] ?? { module_key: moduleKey, can_view: false, can_edit: false, can_delete: false }
      const updated  = { ...current, [field]: value }
      // Si on désactive can_view, désactiver can_edit et can_delete aussi
      if (field === 'can_view' && !value) {
        updated.can_edit   = false
        updated.can_delete = false
      }
      // Si on active can_edit ou can_delete, activer can_view
      if ((field === 'can_edit' || field === 'can_delete') && value) {
        updated.can_view = true
      }
      return { ...prev, [moduleKey]: updated }
    })
  }

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[var(--text-secondary)]" size={28} />
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <Lock size={32} className="text-gray-400" />
        <p className="text-[var(--text-secondary)] text-sm">{t('equipe.noPermission')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#101729]flex items-center gap-2">
            <UsersRound size={20} className="text-[#DC2626]" />
            {t('equipe.title')}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {t('equipe.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 text-[#DC2626] text-sm hover:bg-amber-500/30 transition"
        >
          <Plus size={14} />
          {t('equipe.inviteMember')}
        </button>
      </div>

      {/* Modal invitation */}
      <AnimatePresence>
        {inviteOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setInviteOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-base font-bold text-[#101729]mb-4 flex items-center gap-2">
                <Send size={16} className="text-[#DC2626]" />
                {t('equipe.inviteModal')}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">{t('equipe.inviteEmail')}</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="prenom.nom@exemple.com"
                    className="w-full bg-gray-100 border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[#101729]placeholder:text-[var(--text-secondary)] outline-none focus:border-amber-500/40"
                  />
                </div>

                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">{t('equipe.inviteRole')}</label>
                  <div className="flex gap-2">
                    {(['admin', 'membre'] as const).map(r => (
                      <button
                        key={r}
                        onClick={() => setInviteRole(r)}
                        className={`flex-1 py-2 rounded-lg text-sm transition ${
                          inviteRole === r
                            ? r === 'admin'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-gray-100 text-[#101729]border border-[var(--border)]'
                            : 'bg-gray-50 text-[var(--text-secondary)] border border-[var(--border)]'
                        }`}
                      >
                        {r === 'admin' ? t('equipe.roleAdmin') : t('equipe.roleMembre')}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-2">
                    {inviteRole === 'admin'
                      ? t('equipe.adminDesc')
                      : t('equipe.membreDesc')
                    }
                  </p>
                </div>

                {inviteMsg && (
                  <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
                    inviteMsg.ok ? 'bg-[var(--surface)]/10 text-[#A8C4E4]' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {inviteMsg.ok ? <Check size={14} /> : <X size={14} />}
                    {inviteMsg.text}
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setInviteOpen(false)}
                  className="flex-1 py-2 rounded-lg bg-gray-100 text-[var(--text-secondary)] text-sm hover:bg-gray-100 transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={sendInvite}
                  disabled={!inviteEmail.trim() || inviting}
                  className="flex-1 py-2 rounded-lg bg-amber-500 text-black text-sm font-medium hover:bg-[#DC2626] disabled:opacity-40 transition flex items-center justify-center gap-2"
                >
                  {inviting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {t('equipe.inviteSend')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Layout 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Colonne 1 : liste des membres */}
        <div className="lg:col-span-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              {t('equipe.membersCount')} ({members.length})
            </p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {members.map(member => (
              <button
                key={member.id}
                onClick={() => selectMember(member)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-100 ${
                  selected?.id === member.id ? 'bg-amber-500/5 border-l-2 border-amber-500/50' : ''
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-[#DC2626]">
                    {(member.prenom?.[0] ?? member.nom?.[0] ?? '?').toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#101729]truncate">
                    {member.prenom} {member.nom}
                  </div>
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    <RoleBadge role={member.role} t={t} />
                    {member.dynamic_role_id && (() => {
                      const dr = dynamicRoles.find(r => r.id === member.dynamic_role_id)
                      return dr ? (
                        <span
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded border truncate max-w-[80px]"
                          style={{ color: dr.color, background: `${dr.color}18`, borderColor: `${dr.color}30` }}
                        >
                          {dr.name}
                        </span>
                      ) : null
                    })()}
                  </div>
                </div>
                {member.role !== 'owner' && (
                  <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform ${
                    selected?.id === member.id ? 'rotate-180' : ''
                  }`} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Colonne 2 : permissions du membre sélectionné */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-64 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-center">
              <ShieldAlert size={28} className="text-gray-300 mb-3" />
              <p className="text-sm text-[var(--text-secondary)]">{t('equipe.selectMember')}</p>
            </div>
          ) : selected.role === 'owner' ? (
            <div className="flex flex-col items-center justify-center h-64 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-center">
              <Shield size={28} className="text-[#DC2626]/40 mb-3" />
              <p className="text-sm text-[var(--text-secondary)] font-medium">
                {selected.prenom} {selected.nom}
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {t('equipe.ownerAccess')}
              </p>
            </div>
          ) : (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">

              {/* Header membre */}
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <span className="text-sm font-bold text-[#DC2626]">
                      {(selected.prenom?.[0] ?? '?').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#101729]">{selected.prenom} {selected.nom}</p>
                    <RoleBadge role={selected.role} t={t} />
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Rôle dynamique */}
                  {dynamicRoles.length > 0 && (
                    <select
                      value={selected.dynamic_role_id ?? ''}
                      onChange={e => assignDynamicRole(selected, e.target.value || null)}
                      className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs text-[#101729] outline-none"
                      title={t('equipe.roleBusiness')}
                    >
                      <option value="">{t('equipe.roleBusiness')}</option>
                      {dynamicRoles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  )}
                  {/* Changer le rôle système */}
                  <select
                    value={selected.role}
                    onChange={e => changeRole(selected, e.target.value as 'admin' | 'membre')}
                    className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs text-[#101729] outline-none"
                  >
                    <option value="admin">{t('equipe.roleAdmin')}</option>
                    <option value="membre">{t('equipe.roleMembre')}</option>
                  </select>
                  {/* Retirer */}
                  <button
                    onClick={() => removeMember(selected)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition"
                    title={t('equipe.removeConfirm').replace('{name}', '')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Grille des permissions */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    {t('equipe.moduleAccess')}
                  </p>
                  <div className="flex items-center gap-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
                    <span className="flex items-center gap-1"><Eye size={10} />{t('roles.can_view')}</span>
                    <span className="flex items-center gap-1"><Edit3 size={10} />{t('roles.can_edit')}</span>
                    <span className="flex items-center gap-1"><Trash2 size={10} />{t('roles.can_delete')}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {moduleDefs.map(mod => {
                    const Icon  = mod.icon
                    const perm  = perms[mod.id]
                    const hasView   = perm?.can_view   ?? false
                    const hasEdit   = perm?.can_edit   ?? false
                    const hasDelete = perm?.can_delete ?? false

                    return (
                      <div
                        key={mod.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition ${
                          hasView
                            ? 'bg-gray-50 border-[var(--border)]'
                            : 'bg-transparent border-transparent'
                        }`}
                      >
                        <div className="p-1.5 rounded-lg shrink-0" style={{ background: `${mod.color}22` }}>
                          <Icon size={13} style={{ color: mod.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-[#101729]">{mod.label}</div>
                          <div className="text-[10px] text-[var(--text-secondary)]">{mod.sublabel}</div>
                        </div>
                        <div className="flex items-center gap-5 shrink-0">
                          <Toggle
                            checked={hasView}
                            onChange={v => setPerm(mod.id, 'can_view', v)}
                          />
                          <Toggle
                            checked={hasEdit}
                            onChange={v => setPerm(mod.id, 'can_edit', v)}
                            disabled={!hasView}
                          />
                          <Toggle
                            checked={hasDelete}
                            onChange={v => setPerm(mod.id, 'can_delete', v)}
                            disabled={!hasView}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Bouton enregistrer */}
                <div className="mt-5 flex justify-end">
                  <button
                    onClick={savePerms}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 text-black text-sm font-semibold hover:bg-[#DC2626] disabled:opacity-40 transition"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {t('equipe.savePerms')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
