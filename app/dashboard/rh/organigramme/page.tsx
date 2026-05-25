'use client'

/**
 * Organigramme RH — Visual org chart by departments & reporting lines
 * Built from employes.departement and employes.manager fields
 */

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  GitBranch, Users, ChevronDown, ChevronRight,
  User, Building2, Search, Download, ZoomIn, ZoomOut,
} from 'lucide-react'

/* ─── Types ─────────────────────────────────────────────── */
interface Employe {
  id: string
  nom: string
  poste: string
  departement: string | null
  manager: string | null        // nom du manager (string reference)
  photo_url: string | null
  statut: string
}

interface OrgNode {
  employe: Employe
  children: OrgNode[]
  level: number
}

interface DepartmentGroup {
  name: string
  employees: Employe[]
  headCount: number
}

const DEPT_COLORS: Record<string, string> = {
  'Direction':         '#F59E0B',
  'RH':                '#8B5CF6',
  'Finance':           '#2563EB',
  'Comptabilité':      '#0891B2',
  'Commercial':        '#16A34A',
  'Formation':         '#D97706',
  'Informatique':      '#6366F1',
  'Production':        '#DC2626',
  'Marketing':         '#EC4899',
  'Juridique':         '#64748B',
}

function getDeptColor(dept: string) {
  return DEPT_COLORS[dept] || '#94A3B8'
}

function getInitial(nom: string) {
  return nom.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

/* ─── Avatar ─────────────────────────────────────────────── */
function EmpAvatar({ emp, size = 36 }: { emp: Employe; size?: number }) {
  const color = getDeptColor(emp.departement || '')
  if (emp.photo_url) {
    return (
      <img
        src={emp.photo_url}
        alt={emp.nom}
        style={{ width: size, height: size }}
        className="rounded-full object-cover ring-2 ring-white shadow"
      />
    )
  }
  return (
    <div
      style={{ width: size, height: size, background: color + '22', color }}
      className="rounded-full flex items-center justify-center font-bold text-[10px] ring-2 ring-white shadow"
    >
      {getInitial(emp.nom)}
    </div>
  )
}

/* ─── Employee Card ──────────────────────────────────────── */
function EmpCard({ emp, isRoot = false }: { emp: Employe; isRoot?: boolean }) {
  const color = getDeptColor(emp.departement || '')
  return (
    <div
      className={`bg-white rounded-lg border shadow-sm p-3 min-w-[160px] max-w-[180px]
        transition-all hover:shadow-md hover:-translate-y-0.5 cursor-default
        ${isRoot ? 'border-transparent' : 'border-[#E2E8F0]'}`}
      style={isRoot ? { outline: `2px solid ${color}`, outlineOffset: '0px' } : {}}
    >
      <div className="flex flex-col items-center gap-1.5 text-center">
        <EmpAvatar emp={emp} size={44} />
        <div>
          <div className="text-[12px] font-bold text-[#0F172A] leading-tight">{emp.nom}</div>
          <div className="text-[10px] text-[#64748B] mt-0.5">{emp.poste || '—'}</div>
          {emp.departement && (
            <span
              className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold"
              style={{ background: color + '20', color }}
            >
              {emp.departement}
            </span>
          )}
        </div>
        {emp.statut !== 'actif' && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#FEE2E2] text-[#DC2626] font-semibold">
            {emp.statut}
          </span>
        )}
      </div>
    </div>
  )
}

/* ─── Org Tree Node ──────────────────────────────────────── */
function OrgTreeNode({ node }: { node: OrgNode }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0
  const color = getDeptColor(node.employe.departement || '')

  return (
    <div className="flex flex-col items-center">
      {/* Card + toggle */}
      <div className="relative">
        <EmpCard emp={node.employe} isRoot={node.level === 0} />
        {hasChildren && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white border-2 flex items-center justify-center shadow-sm z-10 hover:bg-gray-50"
            style={{ borderColor: color }}
          >
            {expanded
              ? <ChevronDown size={11} style={{ color }} />
              : <ChevronRight size={11} style={{ color }} />
            }
          </button>
        )}
      </div>

      {/* Children subtree */}
      {hasChildren && expanded && (
        <div className="mt-6">
          {/* Vertical connector */}
          <div className="flex justify-center">
            <div className="w-px h-4 bg-[#CBD5E1]" />
          </div>

          {/* Horizontal bar + children */}
          <div className="flex items-start gap-4">
            {node.children.map((child, idx) => (
              <div key={child.employe.id} className="flex flex-col items-center">
                {/* Top connector */}
                <div className="w-px h-4 bg-[#CBD5E1]" />
                <OrgTreeNode node={child} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Department Card (flat view) ────────────────────────── */
function DeptCard({ dept }: { dept: DepartmentGroup }) {
  const [open, setOpen] = useState(true)
  const color = getDeptColor(dept.name)

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: color }} />
          <span className="font-bold text-[#0F172A] text-[13px]">{dept.name}</span>
          <span
            className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: color + '18', color }}
          >
            {dept.headCount}
          </span>
        </div>
        {open ? <ChevronDown size={14} className="text-[#94A3B8]" /> : <ChevronRight size={14} className="text-[#94A3B8]" />}
      </button>

      {open && (
        <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 border-t border-[#F1F5F9] pt-3">
          {dept.employees.map(emp => (
            <div key={emp.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9]">
              <EmpAvatar emp={emp} size={28} />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-[#0F172A] truncate">{emp.nom}</div>
                <div className="text-[10px] text-[#64748B] truncate">{emp.poste || '—'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function OrganigrammePage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const [employes, setEmployes] = useState<Employe[]>([])
  const [loading, setLoading]   = useState(true)
  const [view, setView]         = useState<'tree' | 'dept'>('dept')
  const [search, setSearch]     = useState('')

  /* Load */
  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('employes')
        .select('id, nom, poste, departement, manager, photo_url, statut')
        .eq('tenant_id', tenantId)
        .eq('statut', 'actif')
        .order('nom')
      setEmployes(data || [])
      setLoading(false)
    })()
  }, [tenantId])

  /* Department groups */
  const departments = useMemo<DepartmentGroup[]>(() => {
    const map = new Map<string, Employe[]>()
    const filtered = search
      ? employes.filter(e =>
          e.nom.toLowerCase().includes(search.toLowerCase()) ||
          (e.poste || '').toLowerCase().includes(search.toLowerCase())
        )
      : employes

    for (const emp of filtered) {
      const dept = emp.departement || 'Non assigné'
      if (!map.has(dept)) map.set(dept, [])
      map.get(dept)!.push(emp)
    }
    return Array.from(map.entries())
      .map(([name, employees]) => ({ name, employees, headCount: employees.length }))
      .sort((a, b) => b.headCount - a.headCount)
  }, [employes, search])

  /* Build org tree */
  const orgTree = useMemo<OrgNode[]>(() => {
    // Find employees who have no manager (or manager not found in list)
    const nameSet = new Set(employes.map(e => e.nom))
    const roots = employes.filter(e => !e.manager || !nameSet.has(e.manager))

    function buildNode(emp: Employe, level: number, visited: Set<string>): OrgNode {
      if (visited.has(emp.id)) return { employe: emp, children: [], level }
      visited.add(emp.id)
      const children = employes
        .filter(e => e.manager === emp.nom && e.id !== emp.id)
        .map(c => buildNode(c, level + 1, visited))
      return { employe: emp, children, level }
    }

    const visited = new Set<string>()
    return roots.map(r => buildNode(r, 0, visited))
  }, [employes])

  /* KPIs */
  const totalActifs   = employes.length
  const totalDepts    = departments.length
  const withManager   = employes.filter(e => !!e.manager).length
  const managersCount = new Set(employes.map(e => e.manager).filter(Boolean)).size

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center py-24 text-[#94A3B8]">
        <div className="w-6 h-6 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin mr-2" />
        Chargement de l&apos;organigramme…
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
            <GitBranch size={22} className="text-[#F59E0B]" />
            Organigramme
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">Structure organisationnelle de l&apos;entreprise</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="pl-7 pr-3 py-1.5 text-[12px] border border-[#E2E8F0] rounded-lg w-44 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
            />
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg border border-[#E2E8F0] overflow-hidden bg-white">
            {(['dept', 'tree'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  view === v
                    ? 'bg-[#F59E0B] text-white'
                    : 'text-[#64748B] hover:bg-[#F8FAFC]'
                }`}
              >
                {v === 'dept' ? 'Départements' : 'Hiérarchie'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Effectif actif',     value: totalActifs,   icon: Users,    color: '#F59E0B' },
          { label: 'Départements',       value: totalDepts,    icon: Building2, color: '#2563EB' },
          { label: 'Managers',           value: managersCount, icon: User,     color: '#8B5CF6' },
          { label: 'Avec hiérarchie',    value: withManager,   icon: GitBranch, color: '#16A34A' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: kpi.color + '18' }}
            >
              <kpi.icon size={16} style={{ color: kpi.color }} />
            </div>
            <div>
              <div className="text-[20px] font-extrabold text-[#0F172A]">{kpi.value}</div>
              <div className="text-[11px] text-[#64748B]">{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {employes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <GitBranch size={40} className="text-[#E2E8F0] mb-3" />
          <p className="text-[14px] font-semibold text-[#64748B]">Aucun employé actif</p>
          <p className="text-[12px] text-[#94A3B8] mt-1">Ajoutez des employés dans le module Employés</p>
        </div>
      )}

      {/* Department view */}
      {view === 'dept' && employes.length > 0 && (
        <div className="space-y-3">
          {departments.map(dept => (
            <DeptCard key={dept.name} dept={dept} />
          ))}
        </div>
      )}

      {/* Tree view */}
      {view === 'tree' && employes.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6 overflow-auto">
          <p className="text-[11px] text-[#94A3B8] mb-6 text-center">
            Cliquez sur <ChevronDown size={11} className="inline" /> pour réduire/développer les branches
          </p>
          {orgTree.length === 0 ? (
            <p className="text-center text-[13px] text-[#94A3B8]">Aucune hiérarchie définie</p>
          ) : (
            <div className="flex gap-8 items-start justify-center flex-wrap">
              {orgTree.map(node => (
                <OrgTreeNode key={node.employe.id} node={node} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      {view === 'dept' && departments.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <p className="text-[11px] font-semibold text-[#64748B] mb-2">Légende des couleurs</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(DEPT_COLORS).map(([dept, color]) => (
              <span key={dept} className="flex items-center gap-1 text-[11px] text-[#64748B]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                {dept}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
