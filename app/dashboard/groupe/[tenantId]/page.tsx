'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Globe, Building2, MapPin, Layers, TrendingUp, Users, Wallet,
  FileText, ShieldCheck, ChevronRight, RefreshCw, AlertCircle,
  ArrowLeft, ExternalLink, ChevronDown,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { useEntityHierarchy, getChildren, getAncestors, type EntityNode } from '@/lib/hooks/useEntityHierarchy'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EntityDetail {
  id:               string
  nomEntreprise:    string
  typeEntite:       string
  secteur:          string | null
  pays:             string | null
  codeGroupe:       string | null
  allowConsolidation: boolean
  ordreAffichage:   number
  depth:            number
}

interface EntityKPIs {
  caYtd:               number
  caMois:              number
  tresorerieNette:     number
  nbEmployes:          number
  nbFacturesEnAttente: number
  nbFacturesPayeesYtd: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

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

const TYPE_LABEL: Record<string, string> = {
  groupe:  'Groupe',
  societe: 'Société',
  filiale: 'Filiale',
  agence:  'Agence',
}

function formatMoney(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}G`
  if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)         return `${(v / 1_000).toFixed(0)}K`
  return v.toLocaleString('fr-FR')
}

// ── Sub-component: KPI card ───────────────────────────────────────────────────

function KPICard({
  label, value, sub, icon, color, loading,
}: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; color: string; loading?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8ECF0] p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}15`, color }}
        >
          {icon}
        </span>
        <p className="text-[11px] text-[#94A3B8] font-medium leading-tight">{label}</p>
      </div>
      {loading ? (
        <div className="h-7 w-24 rounded-lg bg-[#F1F5F9] animate-pulse" />
      ) : (
        <div>
          <p className="text-[22px] font-bold text-[#0F172A] leading-none">{value}</p>
          {sub && <p className="text-[10px] text-[#94A3B8] mt-1">{sub}</p>}
        </div>
      )}
    </div>
  )
}

// ── Sub-component: Sub-entity card ────────────────────────────────────────────

function SubEntityCard({ node, onClick }: { node: EntityNode; onClick: () => void }) {
  const color = TYPE_COLOR[node.typeEntite] ?? '#94A3B8'
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-xl border border-[#E8ECF0] bg-white hover:border-[#CBD5E1] hover:shadow-sm transition-all text-left w-full"
    >
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}15`, color }}
      >
        {TYPE_ICON[node.typeEntite] ?? <Building2 size={14} />}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[#0F172A] truncate">{node.nomEntreprise}</p>
        <p className="text-[10px] text-[#94A3B8]">{TYPE_LABEL[node.typeEntite] ?? node.typeEntite}</p>
      </div>
      <ChevronRight size={14} className="text-[#CBD5E1] shrink-0" />
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EntityDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const tenantId = params.tenantId as string

  const { tenant, reload } = useTenantContext()
  const { tree, loading: treeLoading } = useEntityHierarchy()

  const [entity,  setEntity]  = useState<EntityDetail | null>(null)
  const [kpis,    setKpis]    = useState<EntityKPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)
  const [kpiOpen, setKpiOpen] = useState(true)

  // Guard: redirect if not hierarchical
  useEffect(() => {
    if (tenant && tenant.typeEntite === 'standalone') {
      router.replace('/dashboard')
    }
  }, [tenant, router])

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      // Fetch entity info from tenants (accessible via group visibility policy)
      const { data: t, error: tErr } = await supabase
        .from('tenants')
        .select('id, nom_entreprise, type_entite, secteur_activite, pays, code_groupe, allow_consolidation, ordre_affichage')
        .eq('id', tenantId)
        .maybeSingle()

      if (tErr) throw tErr
      if (!t) throw new Error('Entité introuvable ou accès refusé')

      setEntity({
        id:               t.id,
        nomEntreprise:    t.nom_entreprise,
        typeEntite:       t.type_entite ?? 'standalone',
        secteur:          t.secteur_activite,
        pays:             t.pays,
        codeGroupe:       t.code_groupe,
        allowConsolidation: t.allow_consolidation ?? false,
        ordreAffichage:   t.ordre_affichage ?? 0,
        depth:            tree.find(n => n.tenantId === tenantId)?.depth ?? 1,
      })

      // Fetch KPIs via SECURITY DEFINER function
      const { data: kpiRows, error: kErr } = await supabase
        .rpc('get_entity_kpis', { p_tenant_id: tenantId })

      if (kErr) {
        // If function not yet deployed or access denied, show zeros
        setKpis({ caYtd: 0, caMois: 0, tresorerieNette: 0, nbEmployes: 0, nbFacturesEnAttente: 0, nbFacturesPayeesYtd: 0 })
      } else {
        const r = kpiRows?.[0]
        setKpis({
          caYtd:               Number(r?.ca_ytd               ?? 0),
          caMois:              Number(r?.ca_mois              ?? 0),
          tresorerieNette:     Number(r?.tresorerie_nette     ?? 0),
          nbEmployes:          Number(r?.nb_employes          ?? 0),
          nbFacturesEnAttente: Number(r?.nb_factures_en_attente ?? 0),
          nbFacturesPayeesYtd: Number(r?.nb_factures_payees_ytd ?? 0),
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [tenantId, tree])

   
  useEffect(() => { void loadData() }, [loadData])

  async function handleSwitchToEntity() {
    if (!entity) return
    setSwitching(true)
    localStorage.setItem('oraforme_preferred_tenant', entity.id)
    await reload()
    router.push('/dashboard')
  }

  // Breadcrumb from hierarchy tree
  const ancestors = tree.length > 0 ? getAncestors(tree, tenantId) : []
  const children  = tree.length > 0 ? getChildren(tree, tenantId)   : []
  const color     = entity ? (TYPE_COLOR[entity.typeEntite] ?? '#94A3B8') : '#94A3B8'

  if (!tenant || tenant.typeEntite === 'standalone') return null

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6 lg:p-8">

      {/* ── Breadcrumb + Back ──────────────────────────────────── */}
      <nav className="flex items-center gap-1.5 text-[11px] text-[#94A3B8] mb-5 flex-wrap">
        <button
          onClick={() => router.push('/dashboard/groupe')}
          className="flex items-center gap-1 hover:text-[#0F172A] transition-colors"
        >
          <ArrowLeft size={11} />
          Vue Groupe
        </button>
        {ancestors.map(a => (
          <span key={a.tenantId} className="flex items-center gap-1">
            <span className="text-[#E2E8F0]">/</span>
            <button
              onClick={() => router.push(`/dashboard/groupe/${a.tenantId}`)}
              className="hover:text-[#0F172A] transition-colors truncate max-w-[100px]"
            >
              {a.nomEntreprise}
            </button>
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="text-[#E2E8F0]">/</span>
          <span className="text-[#0F172A] font-semibold truncate max-w-[140px]">
            {entity?.nomEntreprise ?? '…'}
          </span>
        </span>
      </nav>

      {/* ── Error ──────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-[13px] text-red-700">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── Entity header ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#E8ECF0] p-5 mb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: `${color}15`, color }}
          >
            {loading
              ? <Building2 size={20} />
              : (TYPE_ICON[entity?.typeEntite ?? ''] ?? <Building2 size={20} />)
            }
          </span>
          <div>
            {loading ? (
              <div className="h-6 w-40 bg-[#F1F5F9] rounded-lg animate-pulse mb-2" />
            ) : (
              <h1 className="text-[18px] font-bold text-[#0F172A]">{entity?.nomEntreprise}</h1>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {entity && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                  style={{ background: `${color}15`, color }}
                >
                  {TYPE_LABEL[entity.typeEntite] ?? entity.typeEntite}
                </span>
              )}
              {entity?.pays && (
                <span className="text-[11px] text-[#64748B]">{entity.pays}</span>
              )}
              {entity?.secteur && (
                <span className="text-[11px] text-[#94A3B8]">· {entity.secteur}</span>
              )}
              {entity?.codeGroupe && (
                <span className="text-[10px] font-mono bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-0.5 rounded-lg text-[#64748B]">
                  {entity.codeGroupe}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => void loadData()}
            disabled={loading || treeLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[12px] font-medium text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={(loading || treeLoading) ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
          <button
            onClick={handleSwitchToEntity}
            disabled={switching}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-white transition-all disabled:opacity-50 hover:opacity-90"
            style={{ background: color }}
          >
            <ExternalLink size={13} />
            {switching ? 'Connexion…' : 'Ouvrir ce tableau de bord'}
          </button>
        </div>
      </div>

      {/* ── KPI Section ────────────────────────────────────────── */}
      <div className="mb-5">
        <button
          onClick={() => setKpiOpen(v => !v)}
          className="flex items-center gap-2 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-3 hover:text-[#64748B] transition-colors"
        >
          <ChevronDown
            size={12}
            style={{ transform: kpiOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}
          />
          Indicateurs clés
        </button>

        {kpiOpen && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <KPICard
              label="CA année en cours"
              value={`${formatMoney(kpis?.caYtd ?? 0)} FCFA`}
              sub={`Mois : ${formatMoney(kpis?.caMois ?? 0)} FCFA`}
              icon={<TrendingUp size={15} />}
              color="#F59E0B"
              loading={loading}
            />
            <KPICard
              label="Trésorerie nette"
              value={`${formatMoney(kpis?.tresorerieNette ?? 0)} FCFA`}
              sub="Comptes bancaires + caisses"
              icon={<Wallet size={15} />}
              color="#16A34A"
              loading={loading}
            />
            <KPICard
              label="Effectifs actifs"
              value={String(kpis?.nbEmployes ?? 0)}
              sub="Employés en poste"
              icon={<Users size={15} />}
              color="#2563EB"
              loading={loading}
            />
            <KPICard
              label="Factures en attente"
              value={String(kpis?.nbFacturesEnAttente ?? 0)}
              sub="Envoyées ou en retard"
              icon={<FileText size={15} />}
              color="#DC2626"
              loading={loading}
            />
            <KPICard
              label="Factures payées (année)"
              value={String(kpis?.nbFacturesPayeesYtd ?? 0)}
              sub="Depuis le 1er janvier"
              icon={<ShieldCheck size={15} />}
              color="#7C3AED"
              loading={loading}
            />
            {entity?.allowConsolidation && (
              <div className="bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7] rounded-2xl border border-[#FDE68A] p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-[#F59E0B]/20 flex items-center justify-center text-[#D97706]">
                    <Globe size={15} />
                  </span>
                  <p className="text-[11px] text-[#92400E] font-medium">Consolidation</p>
                </div>
                <p className="text-[12px] font-bold text-[#92400E]">Activée</p>
                <p className="text-[10px] text-[#B45309]">
                  Les données de cette entité remontent dans les rapports groupe
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Sub-entities ───────────────────────────────────────── */}
      {(treeLoading || children.length > 0) && (
        <div className="bg-white rounded-2xl border border-[#E8ECF0] overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center justify-between">
            <p className="text-[13px] font-bold text-[#0F172A]">
              {entity?.typeEntite === 'groupe' ? 'Sociétés / Filiales' : 'Agences rattachées'}
            </p>
            <span className="text-[11px] text-[#94A3B8]">{children.length} entité{children.length > 1 ? 's' : ''}</span>
          </div>

          {treeLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 border-[#F59E0B] border-t-transparent animate-spin" />
            </div>
          ) : (
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {children.map(child => (
                <SubEntityCard
                  key={child.tenantId}
                  node={child}
                  onClick={() => router.push(`/dashboard/groupe/${child.tenantId}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Empty children ─────────────────────────────────────── */}
      {!treeLoading && children.length === 0 && !loading && entity && entity.typeEntite !== 'agence' && (
        <div className="bg-white rounded-2xl border border-[#E8ECF0] p-8 flex flex-col items-center gap-3 text-center">
          <Building2 size={28} className="text-[#E2E8F0]" />
          <p className="text-[13px] font-semibold text-[#64748B]">Pas d&apos;entités enfants</p>
          <p className="text-[11px] text-[#94A3B8]">
            Cette {TYPE_LABEL[entity.typeEntite]?.toLowerCase() ?? 'entité'} n&apos;a pas encore de {entity.typeEntite === 'societe' ? 'filiales ni agences' : 'agences'} rattachées.
          </p>
        </div>
      )}

    </div>
  )
}
