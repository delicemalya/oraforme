'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Plus, Trash2, Check, X, Loader2, Edit3,
  Eye, Edit2, Lock, TrendingUp, BookMarked,
  BarChart2, Users, Calculator, GraduationCap,
  HeartHandshake, Bot, FileText, Package, Wallet,
  ChefHat, Truck, Hotel, BookOpen,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import type { LucideIcon } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Role {
  id:           string
  name:         string
  description:  string | null
  color:        string
  is_financial: boolean
  created_at:   string
}

interface RolePerm {
  module_key: string
  can_view:   boolean
  can_edit:   boolean
  can_delete: boolean
}

// ── Définition des modules par secteur ───────────────────────────────────────

type ModuleDef = { key: string; label: string; sublabel: string; icon: LucideIcon; color: string }

const ECOLE_MODULES: ModuleDef[] = [
  { key: 'scolarite',       label: 'Scolarité',       sublabel: 'Inscriptions & notes', icon: BookMarked,    color: '#DC2626' },
  { key: 'direction',       label: 'Direction',       sublabel: 'Finances & pilotage',  icon: BarChart2,     color: '#DC2626' },
  { key: 'rh',              label: 'RH & Paie',       sublabel: 'Personnel',            icon: Users,         color: '#0F172A' },
  { key: 'comptabilite',    label: 'Comptabilité',    sublabel: 'OHADA & Trésorerie',   icon: Calculator,    color: '#7C3AED' },
  { key: 'espace-etudiant', label: 'Espace Étudiant', sublabel: 'Dossiers élèves',      icon: GraduationCap, color: '#0F172A' },
  { key: 'espace-parent',   label: 'Espace Parent',   sublabel: 'Suivi familles',       icon: HeartHandshake,color: '#7C3AED' },
  { key: 'miaa',            label: 'MIAA+',           sublabel: 'IA scolaire',          icon: Bot,           color: '#DC2626' },
]

const GENERIC_MODULES: ModuleDef[] = [
  { key: 'facturation',  label: 'Facturation',  sublabel: 'Devis & factures',  icon: FileText,  color: '#DC2626' },
  { key: 'stock',        label: 'Stock',        sublabel: 'Inventaire',        icon: Package,   color: '#0F172A' },
  { key: 'rh',           label: 'RH & Paie',   sublabel: 'Personnel',         icon: Users,     color: '#DC2626' },
  { key: 'tresorerie',   label: 'Trésorerie',   sublabel: 'Finances',          icon: Wallet,    color: '#7C3AED' },
  { key: 'comptabilite', label: 'Comptabilité', sublabel: 'OHADA',             icon: BookOpen,  color: '#7C3AED' },
  { key: 'restaurant',   label: 'Caisse POS',   sublabel: 'Ventes',            icon: ChefHat,   color: '#DC2626' },
  { key: 'transport',    label: 'Transport',    sublabel: 'Flotte',            icon: Truck,     color: '#DC2626' },
  { key: 'hotel',        label: 'Hôtel',        sublabel: 'Hébergement',       icon: Hotel,     color: '#0F172A' },
  { key: 'miaa',         label: 'MIAA+',        sublabel: 'Assistant IA',      icon: Bot,       color: '#DC2626' },
]

// Couleurs proposées pour les rôles
const ROLE_COLORS = [
  '#DC2626', '#0F172A', '#7C3AED', '#DC2626',
  '#7C3AED', '#0F172A', '#DC2626', '#DC2626', '#84CC16',
]

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative w-8 h-4 rounded-full transition-colors ${
        checked ? 'bg-[var(--surface)]' : 'bg-white/10'
      } ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${checked ? 'left-4' : 'left-0.5'}`} />
    </button>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function RolesPage() {
  const { tenantId, role: myRole, loading: tenantLoading } = useTenant()
  const isOwner = myRole === 'owner'

  const [secteur,      setSecteur]      = useState<string | null>(null)
  const [roles,        setRoles]        = useState<Role[]>([])
  const [selected,     setSelected]     = useState<Role | null>(null)
  const [rolePerms,    setRolePerms]    = useState<Record<string, RolePerm>>({})
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [showForm,     setShowForm]     = useState(false)
  const [editingRole,  setEditingRole]  = useState<Role | null>(null)
  const [form, setForm] = useState({ name: '', description: '', color: ROLE_COLORS[0], is_financial: false })

  // ── Charger les rôles ──────────────────────────────────────────────────────
  const loadRoles = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    const [{ data: rolesData }, { data: tenantData }] = await Promise.all([
      supabase.from('roles').select('*').eq('tenant_id', tenantId).order('created_at'),
      supabase.from('tenants').select('secteur_activite').eq('id', tenantId).maybeSingle(),
    ])

    setRoles(rolesData ?? [])
    setSecteur(tenantData?.secteur_activite ?? null)
    setLoading(false)
  }, [tenantId])

  useEffect(() => { loadRoles() }, [loadRoles])

  // ── Charger les permissions d'un rôle ─────────────────────────────────────
  async function selectRole(role: Role) {
    setSelected(role)
    const { data } = await supabase
      .from('role_permissions')
      .select('module_key, can_view, can_edit, can_delete')
      .eq('role_id', role.id)
    const map: Record<string, RolePerm> = {}
    for (const p of data ?? []) map[p.module_key] = p
    setRolePerms(map)
  }

  // ── Sauvegarder permissions du rôle ───────────────────────────────────────
  async function saveRolePerms() {
    if (!selected || !tenantId) return
    setSaving(true)
    const rows = Object.values(rolePerms).map(p => ({
      role_id:    selected.id,
      tenant_id:  tenantId,
      module_key: p.module_key,
      can_view:   p.can_view,
      can_edit:   p.can_edit,
      can_delete: p.can_delete,
    }))
    await supabase.from('role_permissions').delete().eq('role_id', selected.id)
    if (rows.length > 0) await supabase.from('role_permissions').insert(rows)
    setSaving(false)
  }

  // ── Créer / modifier un rôle ───────────────────────────────────────────────
  async function saveRole() {
    if (!form.name.trim() || !tenantId) return
    setSaving(true)
    if (editingRole) {
      const { data } = await supabase.from('roles')
        .update({ name: form.name, description: form.description || null, color: form.color, is_financial: form.is_financial })
        .eq('id', editingRole.id).select().maybeSingle()
      if (data) {
        setRoles(prev => prev.map(r => r.id === editingRole.id ? data as Role : r))
        if (selected?.id === editingRole.id) setSelected(data as Role)
      }
    } else {
      const { data } = await supabase.from('roles')
        .insert({ tenant_id: tenantId, name: form.name, description: form.description || null, color: form.color, is_financial: form.is_financial })
        .select().maybeSingle()
      if (data) setRoles(prev => [...prev, data as Role])
    }
    setShowForm(false); setEditingRole(null); setForm({ name: '', description: '', color: ROLE_COLORS[0], is_financial: false })
    setSaving(false)
  }

  // ── Supprimer un rôle ──────────────────────────────────────────────────────
  async function deleteRole(role: Role) {
    if (!confirm(`Supprimer le rôle "${role.name}" ?`)) return
    await supabase.from('roles').delete().eq('id', role.id)
    setRoles(prev => prev.filter(r => r.id !== role.id))
    if (selected?.id === role.id) { setSelected(null); setRolePerms({}) }
  }

  // ── Toggle permission ──────────────────────────────────────────────────────
  function setPerm(moduleKey: string, field: 'can_view' | 'can_edit' | 'can_delete', value: boolean) {
    setRolePerms(prev => {
      const cur = prev[moduleKey] ?? { module_key: moduleKey, can_view: false, can_edit: false, can_delete: false }
      const upd = { ...cur, [field]: value }
      if (field === 'can_view'   && !value) { upd.can_edit = false; upd.can_delete = false }
      if ((field === 'can_edit' || field === 'can_delete') && value) upd.can_view = true
      return { ...prev, [moduleKey]: upd }
    })
  }

  function openCreate() {
    setEditingRole(null); setForm({ name: '', description: '', color: ROLE_COLORS[0], is_financial: false }); setShowForm(true)
  }
  function openEdit(role: Role) {
    setEditingRole(role); setForm({ name: role.name, description: role.description ?? '', color: role.color, is_financial: role.is_financial }); setShowForm(true)
  }

  const moduleDefs = secteur === 'ecole' ? ECOLE_MODULES : GENERIC_MODULES

  if (tenantLoading || loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-[var(--text-secondary)]" size={28} /></div>
  }
  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Lock size={32} className="text-gray-400" />
        <p className="text-[var(--text-secondary)] text-sm">Accès réservé au propriétaire.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#101729]flex items-center gap-2">
            <Shield size={20} className="text-[#DC2626]" /> Gestion des rôles
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">Créez des rôles personnalisés et définissez leurs accès aux modules.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 text-[#DC2626] text-sm hover:bg-amber-500/30 transition"
        >
          <Plus size={14} /> Nouveau rôle
        </button>
      </div>

      {/* Modal création / édition rôle */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md space-y-4"
            >
              <h2 className="text-base font-bold text-[#101729]flex items-center gap-2">
                <Shield size={16} className="text-[#DC2626]" />
                {editingRole ? 'Modifier le rôle' : 'Nouveau rôle'}
              </h2>

              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1 block">Nom du rôle *</label>
                <input
                  value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="ex: Direction Générale, RAF, Scolarité…"
                  className="w-full bg-gray-100 border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[#101729]placeholder:text-[var(--text-secondary)] outline-none focus:border-amber-500/40"
                />
              </div>

              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1 block">Description</label>
                <input
                  value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="ex: Responsable financier de l'établissement"
                  className="w-full bg-gray-100 border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[#101729]placeholder:text-[var(--text-secondary)] outline-none focus:border-amber-500/40"
                />
              </div>

              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-2 block">Couleur</label>
                <div className="flex gap-2 flex-wrap">
                  {ROLE_COLORS.map(c => (
                    <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                      className={`w-6 h-6 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-white scale-110' : ''}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Accès financier */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-[var(--border)]">
                <div>
                  <p className="text-sm text-[#101729] font-medium flex items-center gap-2">
                    <TrendingUp size={14} className="text-[#A8C4E4]" /> Accès données financières
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Direction Générale, RAF uniquement</p>
                </div>
                <Toggle checked={form.is_financial} onChange={v => setForm(p => ({ ...p, is_financial: v }))} />
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg bg-gray-100 text-[var(--text-secondary)] text-sm hover:bg-gray-100 transition">
                  Annuler
                </button>
                <button
                  onClick={saveRole} disabled={!form.name.trim() || saving}
                  className="flex-1 py-2 rounded-lg bg-amber-500 text-black text-sm font-medium hover:bg-[#DC2626] disabled:opacity-40 transition flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {editingRole ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Layout 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Colonne 1 : liste des rôles */}
        <div className="lg:col-span-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Rôles ({roles.length})</p>
          </div>

          {roles.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Shield size={28} className="text-gray-300 mb-3" />
              <p className="text-xs text-[var(--text-secondary)]">Aucun rôle créé. Commencez par créer les rôles de votre établissement.</p>
            </div>
          )}

          <div className="divide-y divide-gray-200">
            {roles.map(role => (
              <div
                key={role.id}
                className={`flex items-center gap-3 px-4 py-3 transition cursor-pointer hover:bg-gray-100 ${
                  selected?.id === role.id ? 'bg-gray-100 border-l-2' : 'border-l-2 border-transparent'
                }`}
                style={{ borderLeftColor: selected?.id === role.id ? role.color : 'transparent' }}
                onClick={() => selectRole(role)}
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: `${role.color}22` }}>
                  <Shield size={13} style={{ color: role.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#101729]truncate">{role.name}</div>
                  <div className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1.5">
                    {role.is_financial && <span className="text-[#A8C4E4]">● Financier</span>}
                    {role.description && <span className="truncate">{role.description}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={e => { e.stopPropagation(); openEdit(role) }}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-[var(--text-secondary)] transition">
                    <Edit2 size={12} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteRole(role) }}
                    className="p-1.5 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Colonne 2 : permissions du rôle sélectionné */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-64 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-center">
              <Shield size={28} className="text-gray-300 mb-3" />
              <p className="text-sm text-[var(--text-secondary)]">Sélectionnez un rôle pour configurer ses accès.</p>
            </div>
          ) : (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${selected.color}22` }}>
                    <Shield size={15} style={{ color: selected.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{selected.name}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      {selected.is_financial
                        ? '✓ Accès aux données financières'
                        : '✗ Pas d\'accès aux données financières'}
                    </p>
                  </div>
                </div>
                <button onClick={openCreate} className="p-1.5 rounded hover:bg-gray-100 text-[var(--text-secondary)] hover:text-[var(--text-secondary)] transition">
                  <Edit3 size={14} />
                </button>
              </div>

              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Accès aux modules</p>
                  <div className="flex items-center gap-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
                    <span className="flex items-center gap-1"><Eye size={10} />Voir</span>
                    <span className="flex items-center gap-1"><Edit2 size={10} />Modifier</span>
                    <span className="flex items-center gap-1"><Trash2 size={10} />Suppr.</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {moduleDefs.map(mod => {
                    const Icon       = mod.icon
                    const perm       = rolePerms[mod.key]
                    const hasView    = perm?.can_view   ?? false
                    const hasEdit    = perm?.can_edit   ?? false
                    const hasDel     = perm?.can_delete ?? false
                    return (
                      <div key={mod.key} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition ${hasView ? 'bg-gray-50 border-[var(--border)]' : 'bg-transparent border-transparent'}`}>
                        <div className="p-1.5 rounded-lg shrink-0" style={{ background: `${mod.color}22` }}>
                          <Icon size={13} style={{ color: mod.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-[#101729]">{mod.label}</div>
                          <div className="text-[10px] text-[var(--text-secondary)]">{mod.sublabel}</div>
                        </div>
                        <div className="flex items-center gap-5 shrink-0">
                          <Toggle checked={hasView}  onChange={v => setPerm(mod.key, 'can_view', v)} />
                          <Toggle checked={hasEdit}  onChange={v => setPerm(mod.key, 'can_edit', v)}   disabled={!hasView} />
                          <Toggle checked={hasDel}   onChange={v => setPerm(mod.key, 'can_delete', v)} disabled={!hasView} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    onClick={saveRolePerms} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 text-black text-sm font-semibold hover:bg-[#DC2626] disabled:opacity-40 transition"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Enregistrer les accès
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
