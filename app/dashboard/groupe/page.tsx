'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Globe, Building2, MapPin, Layers, TrendingUp, Users, Wallet,
  ShieldCheck, ChevronRight, RefreshCw, AlertCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { useEntityHierarchy } from '@/lib/hooks/useEntityHierarchy'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EntityKPI {
  tenantId:       string
  nomEntreprise:  string
  typeEntite:     string
  pays:           string | null
  secteur:        string | null
  chiffreAffaires: number
  tresorerie:     number
  effectifs:      number
  scoreAudit:     number
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  groupe:  <Globe     size={14} />,
  societe: <Building2 size={14} />,
  filiale: <Layers    size={14} />,
  agence:  <MapPin    size={14} />,
}

const TYPE_COLOR: Record<string, string> = {
  groupe:  '#2563EB',
  societe: '#F59E0B',
  filiale: '#16A34A',
  agence:  '#7C3AED',
}

function formatMoney(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return v.toLocaleString('fr-FR')
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? '#16A34A' : score >= 60 ? '#D97706' : '#DC2626'
  const bg    = score >= 80 ? '#F0FDF4' : score >= 60 ? '#FFFBEB' : '#FEF2F2'
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg"
      style={{ color, background: bg }}
    >
      <ShieldCheck size={10} />
      {score}/100
    </span>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, icon, color }: {
  label: string; value: string; icon: React.ReactNode; color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8ECF0] p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, color }}>
          {icon}
        </span>
        <p className="text-[11px] text-[#94A3B8] font-medium">{label}</p>
      </div>
      <p className="text-[22px] font-bold text-[#0F172A] leading-none">{value}</p>
    </div>
  )
}

// ── Entity Row ────────────────────────────────────────────────────────────────

function EntityRow({ kpi, onClick }: { kpi: EntityKPI; onClick: () => void }) {
  const color = TYPE_COLOR[kpi.typeEntite] ?? '#94A3B8'
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F8FAFC] transition-colors text-left rounded-xl"
    >
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}15`, color }}
      >
        {TYPE_ICON[kpi.typeEntite] ?? <Building2 size={14} />}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[#0F172A] truncate">{kpi.nomEntreprise}</p>
        <p className="text-[10px] text-[#94A3B8]">
          {kpi.pays ?? '—'}
          {kpi.secteur ? ` · ${kpi.secteur}` : ''}
        </p>
      </div>

      <div className="hidden sm:flex items-center gap-4 shrink-0">
        <div className="text-right">
          <p className="text-[11px] text-[#94A3B8]">CA</p>
          <p className="text-[12px] font-bold text-[#0F172A]">{formatMoney(kpi.chiffreAffaires)} FCFA</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-[#94A3B8]">Tréso</p>
          <p className="text-[12px] font-bold text-[#0F172A]">{formatMoney(kpi.tresorerie)} FCFA</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-[#94A3B8]">Effectifs</p>
          <p className="text-[12px] font-bold text-[#0F172A]">{kpi.effectifs}</p>
        </div>
        <ScoreBadge score={kpi.scoreAudit} />
      </div>

      <ChevronRight size={14} className="text-[#CBD5E1] shrink-0" />
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GroupeDashboardPage() {
  const { tenant }            = useTenantContext()
  const { tree, loading: treeLoading, reload: reloadTree } = useEntityHierarchy()
  const router                = useRouter()

  const [kpis,    setKpis]    = useState<EntityKPI[]>([])
  const [fetching, setFetching] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  // Guard: redirect standalone tenants
  useEffect(() => {
    if (tenant && tenant.typeEntite === 'standalone') {
      router.replace('/dashboard')
    }
  }, [tenant, router])

  const loadKPIs = useCallback(async () => {
    if (!tenant?.tenantId || tree.length === 0) return
    setFetching(true)
    setError(null)
    try {
      // Get all member tenant IDs from the tree
      const memberIds = tree.map(n => n.tenantId)

      // Fetch tenants basic info + their latest financial snapshot if any
      const { data: tenants, error: err } = await supabase
        .from('tenants')
        .select('id, nom_entreprise, type_entite, pays, secteur_activite')
        .in('id', memberIds)

      if (err) throw err

      // Build KPI stubs — real KPIs would come from aggregate views (future migration)
      const kpiList: EntityKPI[] = (tenants ?? []).map(t => ({
        tenantId:       t.id,
        nomEntreprise:  t.nom_entreprise,
        typeEntite:     t.type_entite ?? 'standalone',
        pays:           t.pays,
        secteur:        t.secteur_activite,
        chiffreAffaires: 0,
        tresorerie:     0,
        effectifs:      0,
        scoreAudit:     0,
      }))

      setKpis(kpiList)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement KPIs')
    } finally {
      setFetching(false)
    }
  }, [tenant?.tenantId, tree])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadKPIs() }, [loadKPIs])

  if (!tenant || tenant.typeEntite === 'standalone') return null

  const isLoading = treeLoading || fetching

  // Group entities by type
  const societes = tree.filter(n => n.typeEntite === 'societe')
  const filiales = tree.filter(n => n.typeEntite === 'filiale')
  const agences  = tree.filter(n => n.typeEntite === 'agence')

  // Consolidation (sum across all members when allowConsolidation)
  const totalCA      = kpis.reduce((s, k) => s + k.chiffreAffaires, 0)
  const totalTreso   = kpis.reduce((s, k) => s + k.tresorerie, 0)
  const totalEffectif = kpis.reduce((s, k) => s + k.effectifs, 0)
  const avgAudit     = kpis.length > 0
    ? Math.round(kpis.reduce((s, k) => s + k.scoreAudit, 0) / kpis.length)
    : 0

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6 lg:p-8">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-8 rounded-xl bg-[#2563EB]/10 flex items-center justify-center text-[#2563EB]">
              <Globe size={16} />
            </span>
            <h1 className="text-[20px] font-bold text-[#0F172A]">
              {tenant.nomEntreprise}
            </h1>
          </div>
          <p className="text-[13px] text-[#64748B]">
            Vue consolidée · {tree.length} entité{tree.length > 1 ? 's' : ''}
            {tenant.codeGroupe ? ` · Code ${tenant.codeGroupe}` : ''}
          </p>
        </div>

        <button
          onClick={() => { reloadTree(); loadKPIs() }}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[12px] font-medium text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-all disabled:opacity-50"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* ── Error ──────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-[13px] text-red-700">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* ── KPI summary ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KPICard label="CA Groupe" value={`${formatMoney(totalCA)} FCFA`}  icon={<TrendingUp size={16} />} color="#F59E0B" />
        <KPICard label="Trésorerie nette" value={`${formatMoney(totalTreso)} FCFA`} icon={<Wallet size={16} />}    color="#16A34A" />
        <KPICard label="Effectifs totaux" value={String(totalEffectif)}          icon={<Users size={16} />}      color="#2563EB" />
        <KPICard label="Score audit moy." value={`${avgAudit}/100`}             icon={<ShieldCheck size={16} />} color="#7C3AED" />
      </div>

      {/* ── Structure ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <InfoTile label="Sociétés"  count={societes.length} color="#F59E0B" icon={<Building2 size={14} />} />
        <InfoTile label="Filiales"  count={filiales.length} color="#16A34A" icon={<Layers    size={14} />} />
        <InfoTile label="Agences"   count={agences.length}  color="#7C3AED" icon={<MapPin    size={14} />} />
      </div>

      {/* ── Entity list ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center justify-between">
          <p className="text-[13px] font-bold text-[#0F172A]">Entités du groupe</p>
          <span className="text-[11px] text-[#94A3B8]">{tree.length} entité{tree.length > 1 ? 's' : ''}</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 rounded-full border-2 border-[#F59E0B] border-t-transparent animate-spin" />
          </div>
        ) : tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
            <Building2 size={32} className="text-[#E2E8F0]" />
            <p className="text-[13px] font-semibold text-[#64748B]">Aucune entité dans ce groupe</p>
            <p className="text-[11px] text-[#94A3B8]">Ajoutez des sociétés ou agences via les paramètres</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F8FAFC] p-2">
            {tree.map(node => {
              const kpi = kpis.find(k => k.tenantId === node.tenantId)
              if (!kpi) return (
                <div key={node.tenantId} className="px-4 py-3 flex items-center gap-3">
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${TYPE_COLOR[node.typeEntite] ?? '#94A3B8'}15`, color: TYPE_COLOR[node.typeEntite] ?? '#94A3B8' }}
                  >
                    {TYPE_ICON[node.typeEntite] ?? <Building2 size={14} />}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-[#0F172A]">{node.nomEntreprise}</p>
                    <p className="text-[10px] text-[#94A3B8]">{node.typeEntite} · profondeur {node.depth}</p>
                  </div>
                </div>
              )
              return <EntityRow key={kpi.tenantId} kpi={kpi} onClick={() => router.push('/dashboard')} />
            })}
          </div>
        )}
      </div>

    </div>
  )
}

function InfoTile({ label, count, color, icon }: {
  label: string; count: number; color: string; icon: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8ECF0] p-4 flex items-center gap-3">
      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}15`, color }}>
        {icon}
      </span>
      <div>
        <p className="text-[11px] text-[#94A3B8]">{label}</p>
        <p className="text-[20px] font-bold text-[#0F172A] leading-none">{count}</p>
      </div>
    </div>
  )
}
