'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Globe, Building2, MapPin, Layers, TrendingUp, Users, Wallet,
  ShieldCheck, ChevronRight, RefreshCw, AlertCircle, Plus,
  Crown, Sparkles, Settings, ChevronDown, ChevronUp,
  Briefcase, UserCheck, DollarSign,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { useTenant } from '@/lib/hooks/useTenant'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EntityKPI {
  tenantId:           string
  parentTenantId:     string | null
  nomEntreprise:      string
  typeEntite:         string
  pays:               string | null
  secteurActivite:    string | null
  ordreAffichage:     number
  allowConsolidation: boolean
  caYtd:              number
  caMois:             number
  tresorerieNette:    number
  nbEmployes:         number
  nbCandidatsActifs:  number
  nbPlacementsMois:   number
  nbOffresActives:    number
  nbContratsActifs:   number
  nbClientsActifs:    number
  scoreAudit:         number
  snapshotDate:       string | null
}

interface Consolidated {
  nbEntites:           number
  totalCaYtd:          number
  totalCaMois:         number
  totalTresorerie:     number
  totalEmployes:       number
  totalCandidats:      number
  totalPlacementsMois: number
  totalOffres:         number
  totalContrats:       number
  avgScoreAudit:       number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ElementType> = {
  groupe:  Globe,
  societe: Building2,
  filiale: Layers,
  agence:  MapPin,
}

const TYPE_COLOR: Record<string, string> = {
  groupe:  '#2563EB',
  societe: '#F59E0B',
  filiale: '#16A34A',
  agence:  '#7C3AED',
}

const TYPE_LABEL: Record<string, string> = {
  groupe:  'Groupe',
  societe: 'Pays / Société',
  filiale: 'Filiale',
  agence:  'Agence',
}

const PAYS_FLAGS: Record<string, string> = {
  'CG': '🇨🇬', 'CD': '🇨🇩', 'CM': '🇨🇲', 'GA': '🇬🇦',
  'SN': '🇸🇳', 'CI': '🇨🇮', 'ML': '🇲🇱', 'BF': '🇧🇫',
  'TG': '🇹🇬', 'BJ': '🇧🇯', 'RW': '🇷🇼', 'KE': '🇰🇪',
  'NG': '🇳🇬', 'GH': '🇬🇭', 'MG': '🇲🇬',
  'Congo': '🇨🇬', 'RDC': '🇨🇩', 'Cameroun': '🇨🇲', 'Gabon': '🇬🇦',
  'Sénégal': '🇸🇳', 'Côte d\'Ivoire': '🇨🇮', 'Kenya': '🇰🇪',
  'Nigeria': '🇳🇬', 'Ghana': '🇬🇭',
}

function formatMoney(v: number, full = false): string {
  if (!full) {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}G`
    if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000)         return `${(v / 1_000).toFixed(0)}K`
    return v.toLocaleString('fr-FR')
  }
  return v.toLocaleString('fr-FR') + ' FCFA'
}

function getFlag(pays: string | null): string {
  if (!pays) return '🌍'
  return PAYS_FLAGS[pays] ?? '🌍'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? '#16A34A' : score >= 50 ? '#D97706' : score > 0 ? '#DC2626' : '#94A3B8'
  const bg    = score >= 80 ? '#F0FDF4' : score >= 50 ? '#FFFBEB' : score > 0 ? '#FEF2F2' : '#F8FAFC'
  const label = score > 0 ? `${score}/100` : '—'
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg"
      style={{ color, background: bg }}>
      <ShieldCheck size={9} />{label}
    </span>
  )
}

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: color + '18' }}>
          <Icon size={15} style={{ color }} />
        </div>
        <p className="text-[11px] text-[#94A3B8] font-medium">{label}</p>
      </div>
      <p className="text-[22px] font-extrabold text-[#0F172A] leading-none">{value}</p>
      {sub && <p className="text-[10px] text-[#94A3B8] mt-0.5">{sub}</p>}
    </div>
  )
}

function EntityCard({ entity, children, onDrill }: {
  entity: EntityKPI
  children?: React.ReactNode
  onDrill: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const Icon = TYPE_ICON[entity.typeEntite] ?? Building2
  const color = TYPE_COLOR[entity.typeEntite] ?? '#64748B'
  const flag = getFlag(entity.pays)

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#F8FAFC]"
        style={{ background: color + '06' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[20px]"
          style={{ background: color + '15' }}>
          {entity.typeEntite === 'societe' ? flag : <Icon size={16} style={{ color }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-bold text-[#0F172A] truncate">{entity.nomEntreprise}</p>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ color, background: color + '18' }}>
              {TYPE_LABEL[entity.typeEntite]}
            </span>
          </div>
          <p className="text-[10px] text-[#94A3B8]">
            {entity.pays ?? ''}{entity.secteurActivite ? ` · ${entity.secteurActivite}` : ''}
            {entity.snapshotDate ? ` · Mis à jour ${entity.snapshotDate}` : ' · Pas de snapshot'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ScoreBadge score={entity.scoreAudit} />
          <button onClick={onDrill}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
              text-white transition-colors"
            style={{ background: color }}>
            Ouvrir <ChevronRight size={11} />
          </button>
          {children && (
            <button onClick={() => setExpanded(e => !e)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#64748B]
                hover:bg-[#F1F5F9] transition-colors">
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 divide-x divide-[#F1F5F9] px-0">
        {[
          { label: 'CA annuel',    value: formatMoney(entity.caYtd),          icon: DollarSign },
          { label: 'Trésorerie',   value: formatMoney(entity.tresorerieNette), icon: Wallet },
          { label: 'Effectifs',    value: String(entity.nbEmployes),           icon: Users },
          { label: 'Candidats',    value: String(entity.nbCandidatsActifs),    icon: UserCheck },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center justify-center py-3 gap-0.5">
            <p className="text-[10px] text-[#94A3B8] font-medium">{label}</p>
            <p className="text-[15px] font-bold text-[#0F172A]">{value}</p>
          </div>
        ))}
      </div>

      {/* Children */}
      {children && expanded && (
        <div className="border-t border-[#F8FAFC] bg-[#FAFAFA] px-3 py-2 space-y-1">
          {children}
        </div>
      )}
    </div>
  )
}

function ChildRow({ entity, onDrill }: { entity: EntityKPI; onDrill: () => void }) {
  const Icon = TYPE_ICON[entity.typeEntite] ?? Building2
  const color = TYPE_COLOR[entity.typeEntite] ?? '#64748B'
  return (
    <button onClick={onDrill}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white
        transition-colors text-left group">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: color + '15' }}>
        <Icon size={12} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-[#374151] truncate">{entity.nomEntreprise}</p>
        <p className="text-[10px] text-[#94A3B8]">
          {TYPE_LABEL[entity.typeEntite]}
          {entity.pays ? ` · ${entity.pays}` : ''}
        </p>
      </div>
      <div className="hidden sm:flex items-center gap-3 shrink-0">
        <span className="text-[11px] text-[#64748B]">
          CA: <strong>{formatMoney(entity.caYtd)}</strong>
        </span>
        <span className="text-[11px] text-[#64748B]">
          Eff: <strong>{entity.nbEmployes}</strong>
        </span>
        <ScoreBadge score={entity.scoreAudit} />
      </div>
      <ChevronRight size={12} className="text-[#CBD5E1] group-hover:text-[#94A3B8] shrink-0" />
    </button>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GroupeDashboardPage() {
  const { tenant }  = useTenantContext()
  const { tenantId } = useTenant()
  const router       = useRouter()

  const [entities, setEntities] = useState<EntityKPI[]>([])
  const [consol,   setConsol]   = useState<Consolidated | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  // Guard
  useEffect(() => {
    if (tenant && tenant.typeEntite === 'standalone') {
      router.replace('/dashboard')
    }
  }, [tenant, router])

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true); setError(null)
    try {
      const [{ data: ents, error: e1 }, { data: cons, error: e2 }] = await Promise.all([
        supabase.rpc('get_entities_with_kpis'),
        supabase.rpc('get_group_consolidated'),
      ])
      if (e1) throw e1
      if (e2) throw e2

      setEntities((ents ?? []).map((r: Record<string, unknown>) => ({
        tenantId:           r.tenant_id as string,
        parentTenantId:     r.parent_tenant_id as string | null,
        nomEntreprise:      r.nom_entreprise as string,
        typeEntite:         r.type_entite as string,
        pays:               r.pays as string | null,
        secteurActivite:    r.secteur_activite as string | null,
        ordreAffichage:     r.ordre_affichage as number,
        allowConsolidation: r.allow_consolidation as boolean,
        caYtd:              Number(r.ca_ytd) || 0,
        caMois:             Number(r.ca_mois) || 0,
        tresorerieNette:    Number(r.tresorerie_nette) || 0,
        nbEmployes:         Number(r.nb_employes) || 0,
        nbCandidatsActifs:  Number(r.nb_candidats_actifs) || 0,
        nbPlacementsMois:   Number(r.nb_placements_mois) || 0,
        nbOffresActives:    Number(r.nb_offres_actives) || 0,
        nbContratsActifs:   Number(r.nb_contrats_actifs) || 0,
        nbClientsActifs:    Number(r.nb_clients_actifs) || 0,
        scoreAudit:         Number(r.score_audit) || 0,
        snapshotDate:       r.snapshot_date as string | null,
      })))

      const c = cons?.[0]
      if (c) {
        setConsol({
          nbEntites:           Number(c.nb_entites) || 0,
          totalCaYtd:          Number(c.total_ca_ytd) || 0,
          totalCaMois:         Number(c.total_ca_mois) || 0,
          totalTresorerie:     Number(c.total_tresorerie) || 0,
          totalEmployes:       Number(c.total_employes) || 0,
          totalCandidats:      Number(c.total_candidats) || 0,
          totalPlacementsMois: Number(c.total_placements_mois) || 0,
          totalOffres:         Number(c.total_offres) || 0,
          totalContrats:       Number(c.total_contrats) || 0,
          avgScoreAudit:       Number(c.avg_score_audit) || 0,
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  const handleRefresh = useCallback(async () => {
    if (!tenantId) return
    setRefreshing(true)
    try {
      await supabase.rpc('fn_refresh_group_snapshots')
    } catch { /* ignore */ }
    setRefreshing(false)
    await loadData()
  }, [tenantId, loadData])

  useEffect(() => { void loadData() }, [loadData])

  if (!tenant || tenant.typeEntite === 'standalone') return null

  // Build hierarchy map
  const societes  = entities.filter(e => e.typeEntite === 'societe')
  const filiales  = entities.filter(e => e.typeEntite === 'filiale')
  const agences   = entities.filter(e => e.typeEntite === 'agence')
  const getChildren = (parentId: string) => entities.filter(e => e.parentTenantId === parentId)

  const paysCount    = societes.length
  const filialesCount = filiales.length
  const agencesCount  = agences.length

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] px-6 py-5">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#F59E0B]/20 flex items-center justify-center">
                <Globe size={20} className="text-[#F59E0B]" />
              </div>
              <div>
                <h1 className="text-white font-black text-[18px] leading-tight">
                  {tenant.nomEntreprise ?? 'Groupe'}
                </h1>
                <p className="text-[#94A3B8] text-[11px] flex items-center gap-2">
                  <Crown size={10} className="text-[#7C3AED]" />
                  Compagnie · Dashboard Groupe · {entities.length} entité{entities.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => router.push('/dashboard/groupe/miaa')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold
                  bg-[#7C3AED]/20 text-[#7C3AED] border border-[#7C3AED]/30 hover:bg-[#7C3AED] hover:text-white transition-colors">
                <Sparkles size={13} />MIAA+ Executive
              </button>
              <button onClick={() => router.push('/dashboard/groupe/gestion')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium
                  bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors">
                <Settings size={13} />Gérer
              </button>
              <button onClick={handleRefresh} disabled={refreshing || loading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium
                  bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors disabled:opacity-50">
                <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Calcul…' : 'Actualiser'}
              </button>
            </div>
          </div>

          {/* Structure badges */}
          <div className="flex items-center gap-2 mt-3">
            {[
              { label: `${paysCount} Pays`,     color: '#F59E0B', icon: Building2 },
              { label: `${filialesCount} Filiales`, color: '#16A34A', icon: Layers },
              { label: `${agencesCount} Agences`,  color: '#7C3AED', icon: MapPin },
            ].map(({ label, color, icon: Ic }) => (
              <div key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border"
                style={{ background: color + '18', borderColor: color + '40' }}>
                <Ic size={11} style={{ color }} />
                <span className="text-[11px] font-bold" style={{ color }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[13px] text-red-700">
            <AlertCircle size={14} />{error}
          </div>
        )}

        {/* ── Consolidated KPIs ──────────────────────────────────────────────── */}
        {consol && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-[#F59E0B]" />
              <h2 className="text-[13px] font-bold text-[#0F172A]">Consolidé Groupe</h2>
              <span className="text-[10px] text-[#94A3B8] bg-[#F1F5F9] px-2 py-0.5 rounded-full">
                {consol.nbEntites} entités
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <KpiCard icon={DollarSign}  label="CA Annuel"    value={`${formatMoney(consol.totalCaYtd)} FCFA`}    color="#F59E0B" />
              <KpiCard icon={Wallet}      label="Trésorerie"   value={`${formatMoney(consol.totalTresorerie)} FCFA`} color="#16A34A" />
              <KpiCard icon={Users}       label="Effectifs"    value={String(consol.totalEmployes)}                 color="#2563EB" />
              <KpiCard icon={UserCheck}   label="Candidats"    value={String(consol.totalCandidats)}                color="#7C3AED" />
              <KpiCard icon={Briefcase}   label="Placements/mois" value={String(consol.totalPlacementsMois)}        color="#DC2626"
                sub={`${consol.totalOffres} offres actives`} />
            </div>
          </section>
        )}

        {/* ── Empty state ── */}
        {!loading && entities.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-[#E2E8F0] p-12 text-center">
            <Globe size={40} className="mx-auto mb-4 text-[#E2E8F0]" />
            <h3 className="text-[15px] font-bold text-[#374151] mb-2">Aucune entité dans ce groupe</h3>
            <p className="text-[13px] text-[#94A3B8] mb-5">
              Commencez par ajouter des pays, filiales et agences à votre groupe.
            </p>
            <button onClick={() => router.push('/dashboard/groupe/gestion')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-[13px] text-white bg-[#F59E0B] hover:bg-[#D97706] transition-colors">
              <Plus size={15} />Créer la structure
            </button>
          </div>
        )}

        {/* ── Pays (societes) with their children ───────────────────────────── */}
        {societes.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Building2 size={14} className="text-[#F59E0B]" />
              <h2 className="text-[13px] font-bold text-[#0F172A]">Par Pays / Société</h2>
            </div>
            <div className="space-y-3">
              {societes.map(soc => {
                const filialesOfSoc = getChildren(soc.tenantId).filter(c => c.typeEntite === 'filiale')
                const agencesOfSoc  = getChildren(soc.tenantId).filter(c => c.typeEntite === 'agence')
                const hasChildren   = filialesOfSoc.length > 0 || agencesOfSoc.length > 0
                return (
                  <EntityCard key={soc.tenantId} entity={soc}
                    onDrill={() => router.push(`/dashboard/groupe/${soc.tenantId}`)}>
                    {hasChildren && (
                      <>
                        {filialesOfSoc.map(fil => {
                          const agencesOfFil = getChildren(fil.tenantId).filter(c => c.typeEntite === 'agence')
                          return (
                            <div key={fil.tenantId} className="rounded-xl overflow-hidden">
                              <ChildRow entity={fil} onDrill={() => router.push(`/dashboard/groupe/${fil.tenantId}`)} />
                              {agencesOfFil.length > 0 && (
                                <div className="ml-8 space-y-0.5 pb-1">
                                  {agencesOfFil.map(ag => (
                                    <ChildRow key={ag.tenantId} entity={ag}
                                      onDrill={() => router.push(`/dashboard/groupe/${ag.tenantId}`)} />
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                        {agencesOfSoc.map(ag => (
                          <ChildRow key={ag.tenantId} entity={ag}
                            onDrill={() => router.push(`/dashboard/groupe/${ag.tenantId}`)} />
                        ))}
                      </>
                    )}
                  </EntityCard>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Filiales & Agences sans parent pays ───────────────────────────── */}
        {filiales.filter(f => !f.parentTenantId || !societes.find(s => s.tenantId === f.parentTenantId)).length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Layers size={14} className="text-[#16A34A]" />
              <h2 className="text-[13px] font-bold text-[#0F172A]">Filiales directes</h2>
            </div>
            <div className="space-y-2">
              {filiales
                .filter(f => !f.parentTenantId || !societes.find(s => s.tenantId === f.parentTenantId))
                .map(fil => (
                  <EntityCard key={fil.tenantId} entity={fil}
                    onDrill={() => router.push(`/dashboard/groupe/${fil.tenantId}`)} />
                ))}
            </div>
          </section>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#F59E0B]/10 flex items-center justify-center">
                <RefreshCw size={18} className="text-[#F59E0B] animate-spin" />
              </div>
              <p className="text-[12px] text-[#64748B]">Chargement des données groupe…</p>
            </div>
          </div>
        )}

        {/* ── MIAA+ Executive CTA ─────────────────────────────────────────────── */}
        {entities.length > 0 && !loading && (
          <div className="bg-gradient-to-r from-[#7C3AED]/10 to-[#2563EB]/10 rounded-2xl border border-[#7C3AED]/20 p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#7C3AED]/20 flex items-center justify-center">
                  <Sparkles size={18} className="text-[#7C3AED]" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-[#0F172A]">MIAA+ Executive</p>
                  <p className="text-[12px] text-[#64748B]">
                    Comparez les pays, analysez les filiales, produisez des rapports consolidés et des prévisions IA
                  </p>
                </div>
              </div>
              <button onClick={() => router.push('/dashboard/groupe/miaa')}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[13px]
                  text-white bg-[#7C3AED] hover:bg-[#6D28D9] transition-colors">
                <Crown size={14} />Lancer MIAA+ Executive
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
