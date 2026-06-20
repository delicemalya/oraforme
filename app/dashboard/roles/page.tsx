'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Shield, Plus, Trash2, Check, X, Loader2, Copy,
  Eye, Edit2, Lock, Download, CheckCircle, ThumbsUp,
  Search, RefreshCw, Users, ChevronDown, ChevronRight,
  History, Settings,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import type { LucideIcon } from 'lucide-react'

type ActionKey = 'can_view' | 'can_edit' | 'can_delete' | 'can_export' | 'can_validate' | 'can_approve'
type Tab = 'roles' | 'matrice' | 'membres' | 'audit'

interface Role { id: string; name: string; description: string | null; color: string; is_financial: boolean; created_at: string; nb_membres?: number; nb_permissions?: number }
interface RolePerm { module_key: string; can_view: boolean; can_edit: boolean; can_delete: boolean; can_export: boolean; can_validate: boolean; can_approve: boolean }
interface Member { id: string; user_id: string; role: string; ecole_role_name: string | null; dynamic_role_id: string | null; users: { email: string } | null }
interface AuditEntry { id: string; action: string; target_type: string | null; details: Record<string, unknown>; created_at: string }

const MODULES = [
  { key: 'direction',        label: 'Direction Générale',  group: 'Pilotage' },
  { key: 'finance',          label: 'Finance',             group: 'Pilotage' },
  { key: 'analytics',        label: 'Analytics & BI',      group: 'Pilotage' },
  { key: 'audit',            label: 'Audit & Logs',        group: 'Pilotage' },
  { key: 'notifications',    label: 'Notifications',       group: 'Pilotage' },
  { key: 'comptabilite',     label: 'Comptabilité',        group: 'Finance & Compta' },
  { key: 'tresorerie',       label: 'Trésorerie',          group: 'Finance & Compta' },
  { key: 'facturation',      label: 'Facturation',         group: 'Finance & Compta' },
  { key: 'depenses',         label: 'Dépenses',            group: 'Finance & Compta' },
  { key: 'rh',               label: 'RH & Paie',           group: 'RH & Organisation' },
  { key: 'roles',            label: 'Rôles & Droits',      group: 'RH & Organisation' },
  { key: 'crm',              label: 'CRM Clients',         group: 'Commercial' },
  { key: 'stock',            label: 'Stock & Inventaire',  group: 'Stock & Achats' },
  { key: 'achats',           label: 'Achats',              group: 'Stock & Achats' },
  { key: 'hotel',            label: 'Hôtellerie',           group: 'Métier' },
  { key: 'restaurant',       label: 'Restauration',        group: 'Métier' },
  { key: 'transport',        label: 'Transport',           group: 'Métier' },
  { key: 'scolarite',        label: 'Scolarité',           group: 'École' },
  { key: 'daac',             label: 'DAAC',                group: 'École' },
  { key: 'espace-formateur', label: 'Formateurs',          group: 'École' },
  { key: 'espace-etudiant',  label: 'Espace Étudiant',     group: 'École' },
  { key: 'espace-parent',    label: 'Espace Parent',       group: 'École' },
  { key: 'ged',              label: 'GED Documents',       group: 'Documents & IA' },
  { key: 'bizbot',           label: 'MIAA+ IA',            group: 'Documents & IA' },
]

const ACTIONS: { key: ActionKey; label: string; short: string; icon: LucideIcon; color: string }[] = [
  { key: 'can_view',     label: 'Voir',      short: 'Voir',   icon: Eye,         color: '#2563EB' },
  { key: 'can_edit',     label: 'Modifier',  short: 'Modif.', icon: Edit2,       color: '#16A34A' },
  { key: 'can_delete',   label: 'Supprimer', short: 'Suppr.', icon: Trash2,      color: '#DC2626' },
  { key: 'can_export',   label: 'Exporter',  short: 'Export', icon: Download,    color: '#7C3AED' },
  { key: 'can_validate', label: 'Valider',   short: 'Valid.', icon: CheckCircle, color: '#0891B2' },
  { key: 'can_approve',  label: 'Approuver', short: 'Approu.',icon: ThumbsUp,    color: '#F59E0B' },
]

const COLORS = ['#2563EB','#16A34A','#DC2626','#7C3AED','#F59E0B','#0891B2','#EA580C','#64748B','#059669','#DB2777']
const EP = (key = ''): RolePerm => ({ module_key: key, can_view: false, can_edit: false, can_delete: false, can_export: false, can_validate: false, can_approve: false })

export default function RolesPage() {
  const { tenantId, isOwner, role: userRole } = useTenant()
  const { t } = useLocale()
  const [tab,      setTab]      = useState<Tab>('roles')
  const [roles,    setRoles]    = useState<Role[]>([])
  const [selRole,  setSelRole]  = useState<Role | null>(null)
  const [perms,    setPerms]    = useState<Record<string, RolePerm>>({})
  const [members,  setMembers]  = useState<Member[]>([])
  const [logs,     setLogs]     = useState<AuditEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [q,        setQ]        = useState('')
  const [modal,    setModal]    = useState(false)
  const [nm,       setNm]       = useState('')
  const [nd,       setNd]       = useState('')
  const [nc,       setNc]       = useState('#2563EB')
  const [nf,       setNf]       = useState(false)
  const [openGrp,  setOpenGrp]  = useState<Set<string>>(new Set(['Pilotage','Finance & Compta','RH & Organisation','Commercial','Stock & Achats','Documents & IA']))

  const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: 'roles',   label: t('roles.tabRoles'),       icon: Shield  },
    { id: 'matrice', label: t('roles.tabPermissions'), icon: Lock    },
    { id: 'membres', label: t('roles.tabMembers'),     icon: Users   },
    { id: 'audit',   label: t('roles.tabHistory'),     icon: History },
  ]

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadRoles = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase.from('v_roles_summary').select('*').eq('tenant_id', tenantId).order('created_at').limit(200)
    setRoles((data as Role[] | null) ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { loadRoles() }, [loadRoles])

  const loadPerms = useCallback(async (rid: string) => {
    const { data } = await supabase.from('role_permissions')
      .select('module_key, can_view, can_edit, can_delete, can_export, can_validate, can_approve')
      .eq('role_id', rid)
    const m: Record<string, RolePerm> = {}
    for (const p of data ?? []) m[p.module_key] = p
    setPerms(m)
  }, [])

  const pickRole = useCallback(async (r: Role) => {
    setSelRole(r); await loadPerms(r.id); setTab('matrice')
  }, [loadPerms])

  const loadMembers = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase.from('profiles')
      .select('id, user_id, role, ecole_role_name, dynamic_role_id, users:user_id(email)')
      .eq('tenant_id', tenantId).limit(200)
    setMembers((data as Member[] | null) ?? [])
  }, [tenantId])

  const loadLogs = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase.from('rbac_audit_log')
      .select('id, action, target_type, details, created_at')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50)
    setLogs((data as AuditEntry[] | null) ?? [])
  }, [tenantId])

  useEffect(() => { if (tab === 'membres') loadMembers() }, [tab, loadMembers])
  useEffect(() => { if (tab === 'audit')   loadLogs()    }, [tab, loadLogs])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function toggle(mk: string, ak: ActionKey) {
    if (!selRole || !tenantId) return
    const cur = perms[mk] ?? EP(mk)
    const upd = { ...cur, [ak]: !cur[ak] }
    setPerms(p => ({ ...p, [mk]: upd }))
    setSaving(true)
    const { error } = await supabase.from('role_permissions').upsert(
      { role_id: selRole.id, tenant_id: tenantId, module_key: mk, can_view: upd.can_view, can_edit: upd.can_edit, can_delete: upd.can_delete, can_export: upd.can_export, can_validate: upd.can_validate, can_approve: upd.can_approve },
      { onConflict: 'role_id,module_key' }
    )
    if (error) setPerms(p => ({ ...p, [mk]: cur }))
    setSaving(false)
  }

  async function createRole() {
    if (!tenantId || !nm.trim()) return
    setSaving(true)
    await supabase.from('roles').insert({ tenant_id: tenantId, name: nm.trim(), description: nd.trim() || null, color: nc, is_financial: nf })
    setModal(false); setNm(''); setNd('')
    await loadRoles()
    setSaving(false)
  }

  async function clone(r: Role) {
    if (!tenantId) return; setSaving(true)
    const { data: nr } = await supabase.from('roles').insert({ tenant_id: tenantId, name: r.name + ' (copie)', description: r.description, color: r.color, is_financial: r.is_financial }).select().single()
    if (nr) {
      const { data: op } = await supabase.from('role_permissions').select('module_key, can_view, can_edit, can_delete, can_export, can_validate, can_approve').eq('role_id', r.id)
      if (op?.length) await supabase.from('role_permissions').insert(op.map(p => ({ ...p, role_id: nr.id, tenant_id: tenantId })))
    }
    await loadRoles(); setSaving(false)
  }

  async function del(r: Role) {
    if (!confirm(`${t('common.delete')} "${r.name}" ?`)) return
    await supabase.from('roles').delete().eq('id', r.id)
    if (selRole?.id === r.id) { setSelRole(null); setPerms({}) }
    await loadRoles()
  }

  async function assign(pid: string, rid: string | null) {
    await supabase.from('profiles').update({ dynamic_role_id: rid }).eq('id', pid).eq('tenant_id', tenantId)
    await loadMembers()
  }

  async function defaults() {
    if (!tenantId || !confirm(t('roles.createConfirm'))) return
    setSaving(true)
    await supabase.rpc('fn_create_default_roles', { p_tenant_id: tenantId })
    await loadRoles(); setSaving(false)
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const canManage = isOwner || userRole === 'admin'
  const fmtD = (d: string) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  const grped = MODULES.reduce<Record<string, typeof MODULES>>((a, m) => { if (!a[m.group]) a[m.group] = []; a[m.group].push(m); return a }, {})
  const filtered = q ? MODULES.filter(m => m.label.toLowerCase().includes(q.toLowerCase())) : null

  const AUDIT_COLORS: Record<string, string> = {
    perm_created: '#16A34A', perm_updated: '#2563EB', perm_deleted: '#DC2626',
    role_assigned: '#7C3AED', role_created: '#F59E0B', role_deleted: '#DC2626',
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#FEF2F2]">
            <Shield size={20} className="text-[#DC2626]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#0F172A]">{t('roles.title')}</h1>
            <p className="text-[11px] text-[#64748B]">{t('roles.subtitle')}</p>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button onClick={defaults} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2E8F0] text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC] transition-all">
              <Settings size={13} /> {t('roles.defaultRoles')}
            </button>
            <button onClick={() => setModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white" style={{ background: '#DC2626' }}>
              <Plus size={13} /> {t('roles.newRole')}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-[#E2E8F0] rounded-2xl p-1.5 overflow-x-auto">
        {TABS.map(t_ => {
          const Icon = t_.icon
          return (
            <button key={t_.id} onClick={() => setTab(t_.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all ${tab === t_.id ? 'bg-[#DC2626] text-white shadow-sm' : 'text-[#64748B] hover:bg-[#F1F5F9]'}`}>
              <Icon size={12} />{t_.label}
            </button>
          )
        })}
      </div>

      {/* ── TAB: RÔLES ── */}
      {tab === 'roles' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading && [...Array(3)].map((_, i) => <div key={i} className="h-36 rounded-2xl bg-[#F1F5F9] animate-pulse" />)}
          {!loading && roles.map(r => (
            <div key={r.id} onClick={() => pickRole(r)}
              className="bg-white border border-[#E2E8F0] rounded-2xl p-4 hover:shadow-md transition-all group cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[13px] font-bold" style={{ background: r.color }}>
                    {r.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[#0F172A]">{r.name}</div>
                    {r.is_financial && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#EFF6FF] text-[#2563EB]">{t('roles.financial')}</span>}
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => { e.stopPropagation(); clone(r) }} title={t('roles.cloneRole')} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B]"><Copy size={12} /></button>
                    <button onClick={e => { e.stopPropagation(); del(r) }} title={t('roles.deleteRole')} className="p-1.5 rounded-lg hover:bg-[#FEF2F2] text-[#DC2626]"><Trash2 size={12} /></button>
                  </div>
                )}
              </div>
              {r.description && <p className="text-[11px] text-[#64748B] mb-3 line-clamp-2">{r.description}</p>}
              <div className="flex items-center gap-3 pt-3 border-t border-[#F8FAFC]">
                <div className="text-center"><div className="text-[15px] font-bold text-[#0F172A]">{r.nb_membres ?? 0}</div><div className="text-[9px] text-[#94A3B8] uppercase">{t('roles.members')}</div></div>
                <div className="h-5 w-px bg-[#E2E8F0]" />
                <div className="text-center"><div className="text-[15px] font-bold text-[#0F172A]">{r.nb_permissions ?? 0}</div><div className="text-[9px] text-[#94A3B8] uppercase">{t('roles.modules')}</div></div>
                <div className="ml-auto text-[10px] text-[#94A3B8]">{t('roles.viewPermissions')}</div>
              </div>
            </div>
          ))}
          {!loading && roles.length === 0 && (
            <div className="col-span-full flex flex-col items-center py-16 gap-3">
              <Shield size={40} className="text-[#E2E8F0]" />
              <p className="text-[13px] text-[#94A3B8]">{t('roles.noRole')}</p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: MATRICE ── */}
      {tab === 'matrice' && (
        <div className="space-y-4">
          {/* Sélecteur de rôle */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {roles.map(r => (
                <button key={r.id} onClick={() => pickRole(r)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${selRole?.id === r.id ? 'text-white border-transparent' : 'text-[#64748B] border-[#E2E8F0]'}`}
                  style={selRole?.id === r.id ? { background: r.color } : {}}>
                  <div className="w-2 h-2 rounded-full" style={{ background: r.color }} />{r.name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {saving && <Loader2 size={14} className="text-[#94A3B8] animate-spin" />}
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input type="text" placeholder={t('roles.filterModules')} value={q} onChange={e => setQ(e.target.value)}
                  className="pl-7 pr-3 py-2 text-[11px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 w-40" />
              </div>
            </div>
          </div>

          {!selRole ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center">
              <Shield size={32} className="text-[#E2E8F0] mx-auto mb-3" />
              <p className="text-[13px] text-[#94A3B8]">{t('roles.selectRole')}</p>
            </div>
          ) : (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
              {/* En-tête rôle */}
              <div className="px-5 py-3.5 flex items-center gap-3" style={{ background: selRole.color + '18' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[13px] font-bold" style={{ background: selRole.color }}>
                  {selRole.name.charAt(0)}
                </div>
                <div>
                  <div className="text-[13px] font-bold text-[#0F172A]">{selRole.name}</div>
                  <div className="text-[10px] text-[#64748B]">{selRole.description ?? t('roles.customRole')}</div>
                </div>
                {saving && <Loader2 size={13} className="ml-auto text-[#94A3B8] animate-spin" />}
              </div>

              {/* Matrice */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px]">
                  <thead>
                    <tr className="border-b border-[#F1F5F9] bg-[#FAFAFA]">
                      <th className="text-left px-5 py-2.5 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider w-52">{t('nav.modules')}</th>
                      {ACTIONS.map(a => {
                        const AI = a.icon
                        return (
                          <th key={a.key} className="text-center px-2 py-2.5 text-[10px] font-bold uppercase" style={{ color: a.color }}>
                            <div className="flex flex-col items-center gap-0.5"><AI size={11} /><span>{a.short}</span></div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {(filtered
                      ? filtered.map(m => ({ _g: false, ...m }))
                      : Object.entries(grped).flatMap(([g, ms]) => [
                          { _g: true, grp: g, count: ms.length, open: openGrp.has(g), key: '', label: '' },
                          ...(openGrp.has(g) ? ms.map(m => ({ _g: false, grp: g, ...m })) : []),
                        ])
                    ).map((row: Record<string, unknown>, _i: number) => {
                      if (row._g) {
                        return (
                          <tr key={'g-' + row.grp} className="cursor-pointer"
                            onClick={() => setOpenGrp(prev => { const n = new Set(prev); if (n.has(row.grp as string)) n.delete(row.grp as string); else n.add(row.grp as string); return n })}>
                            <td colSpan={7} className="px-4 py-2 bg-[#F8FAFC] border-b border-[#F1F5F9]">
                              <div className="flex items-center gap-2">
                                {row.open ? <ChevronDown size={11} className="text-[#94A3B8]" /> : <ChevronRight size={11} className="text-[#94A3B8]" />}
                                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">{row.grp as string}</span>
                                <span className="text-[9px] text-[#94A3B8]">({row.count as number} {t('roles.modules')})</span>
                              </div>
                            </td>
                          </tr>
                        )
                      }
                      const p = perms[row.key as string] ?? EP(row.key as string)
                      return (
                        <tr key={row.key as string} className="border-b border-[#F8FAFC] hover:bg-[#FAFAFA]">
                          <td className="px-5 py-2.5 text-[12px] text-[#374151] pl-10">{row.label as string}</td>
                          {ACTIONS.map(a => {
                            const checked = p[a.key] ?? false
                            return (
                              <td key={a.key} className="text-center px-2 py-2.5">
                                {canManage ? (
                                  <button onClick={() => toggle(row.key as string, a.key)} title={a.label}
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all ${checked ? 'shadow-sm' : 'border border-[#E2E8F0] hover:border-[#CBD5E1]'}`}
                                    style={checked ? { background: a.color, color: '#fff' } : {}}>
                                    {checked ? <Check size={11} /> : <X size={10} className="text-[#CBD5E1]" />}
                                  </button>
                                ) : (
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto ${checked ? 'shadow-sm' : ''}`} style={checked ? { background: a.color, color: '#fff' } : {}}>
                                    {checked ? <Check size={11} /> : <X size={10} className="text-[#CBD5E1]" />}
                                  </div>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: MEMBRES ── */}
      {tab === 'membres' && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F8FAFC] flex items-center gap-2">
            <Users size={14} className="text-[#94A3B8]" />
            <span className="text-[13px] font-semibold text-[#0F172A]">{t('roles.tabMembers')} ({members.length})</span>
          </div>
          <div className="divide-y divide-[#F8FAFC]">
            {members.map(m => {
              const email = (m.users as { email: string } | null)?.email ?? '—'
              const ar = roles.find(r => r.id === m.dynamic_role_id)
              return (
                <div key={m.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-8 h-8 rounded-xl bg-[#F1F5F9] flex items-center justify-center text-[12px] font-bold text-[#64748B]">
                    {email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[#0F172A] truncate">{email}</div>
                    <div className="text-[10px] text-[#94A3B8]">{t('roles.baseRole')} {m.role}{m.ecole_role_name && ` · ${m.ecole_role_name}`}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ar && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg text-white" style={{ background: ar.color }}>{ar.name}</span>}
                    {canManage && (
                      <select value={m.dynamic_role_id ?? ''} onChange={e => assign(m.id, e.target.value || null)}
                        className="text-[11px] border border-[#E2E8F0] rounded-lg px-2 py-1 focus:outline-none">
                        <option value="">— {t('roles.role')} —</option>
                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              )
            })}
            {members.length === 0 && <div className="py-12 text-center text-[13px] text-[#94A3B8]">{t('roles.noMember')}</div>}
          </div>
        </div>
      )}

      {/* ── TAB: AUDIT ── */}
      {tab === 'audit' && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F8FAFC] flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#0F172A]">{t('roles.rbacJournal')}</span>
            <button onClick={loadLogs} className="flex items-center gap-1 text-[11px] text-[#64748B] hover:text-[#0F172A]">
              <RefreshCw size={12} /> {t('common.refresh')}
            </button>
          </div>
          <div className="divide-y divide-[#F8FAFC]">
            {logs.map(log => (
              <div key={log.id} className="flex items-center gap-4 px-5 py-3">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: AUDIT_COLORS[log.action] ?? '#64748B' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[#0F172A]">{log.action}</div>
                  <div className="text-[10px] text-[#94A3B8]">{JSON.stringify(log.details).slice(0, 80)}</div>
                </div>
                <div className="text-[10px] text-[#94A3B8] shrink-0">{fmtD(log.created_at)}</div>
              </div>
            ))}
            {logs.length === 0 && <div className="py-12 text-center text-[13px] text-[#94A3B8]">{t('roles.noEvent')}</div>}
          </div>
        </div>
      )}

      {/* ── MODAL: Créer rôle ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
              <h2 className="text-[14px] font-bold text-[#0F172A]">{t('roles.newRole')}</h2>
              <button onClick={() => setModal(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} className="text-[#64748B]" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5 block">{t('roles.nameLabel')}</label>
                <input type="text" value={nm} onChange={e => setNm(e.target.value)} placeholder="Ex: Responsable Logistique"
                  className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5 block">{t('common.description')}</label>
                <textarea value={nd} onChange={e => setNd(e.target.value)} rows={2}
                  className="w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none resize-none" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5 block">{t('roles.colorLabel')}</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setNc(c)}
                      className={`w-7 h-7 rounded-lg transition-all ${nc === c ? 'ring-2 ring-offset-1 ring-[#0F172A] scale-110' : ''}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={nf} onChange={e => setNf(e.target.checked)} className="w-4 h-4 rounded accent-[#DC2626]" />
                <span className="text-[12px] text-[#374151]">{t('roles.financialAccess')}</span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-[#F1F5F9] flex gap-2 justify-end">
              <button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl text-[12px] font-semibold text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC]">{t('common.cancel')}</button>
              <button onClick={createRole} disabled={!nm.trim() || saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white disabled:opacity-50" style={{ background: '#DC2626' }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} {t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
