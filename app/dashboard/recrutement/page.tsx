'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Briefcase, Users, Calendar, CheckCircle,
  Plus, UserCheck, Target, ArrowRight, ArrowUpRight,
  ArrowDownRight, Minus, Clock, Star, Building2,
  FileText, Activity, Sparkles, AlertCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

// ── Types ─────────────────────────────────────────────────────────────────────

interface KPIs {
  candidats: number;       candidatsDelta: number
  clients: number;         clientsDelta: number
  missions: number;        missionsDelta: number
  placements: number;      placementsDelta: number
  contrats: number;        contratsDelta: number
  caMois: number;          caTotalAnnee: number
  margeAvg: number
  tauxPlacement: number
  entretiens: number;      entretiensAujourdhui: number
  offresActives: number
  candidaturesMois: number; candidaturesMoisDelta: number
  doublons: number;         nonAnalyses: number
}

interface MonthPoint { label: string; candidatures: number; placements: number; ca: number; entretiens: number }
interface PipelinePt  { label: string; value: number; color: string }
interface ContractSeg { label: string; count: number; color: string; pct: number }
interface TopOffre    { id: string; titre: string; nb: number; score: number; localisation: string | null }
interface Activity    { id: string; type: string; label: string; sub: string; date: string; color: string; icon: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOIS_LABELS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

function getLast6Months() {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    return {
      label: MOIS_LABELS[d.getMonth()],
      start: new Date(d.getFullYear(), d.getMonth(), 1),
      end:   new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
    }
  })
}

function countByMonth(data: { created_at: string }[], months: ReturnType<typeof getLast6Months>): number[] {
  return months.map(m =>
    data.filter(d => { const dt = new Date(d.created_at); return dt >= m.start && dt <= m.end }).length
  )
}

function sumByMonth(data: { created_at: string; commission_fcfa: number | null }[], months: ReturnType<typeof getLast6Months>): number[] {
  return months.map(m =>
    data
      .filter(d => { const dt = new Date(d.created_at); return dt >= m.start && dt <= m.end })
      .reduce((s, d) => s + (d.commission_fcfa ?? 0), 0)
  )
}

function formatCA(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0','') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'k'
  return String(n)
}

function delta(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0
  return Math.round(((curr - prev) / prev) * 100)
}

// ── Chart Components ──────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const W = 80; const H = 28
  const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * W, y: H - (v / max) * H * 0.9 + 2 }))
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i-1].x + pts[i].x) / 2
    d += ` C ${cx} ${pts[i-1].y} ${cx} ${pts[i].y} ${pts[i].x} ${pts[i].y}`
  }
  const fill = `${d} L ${pts[pts.length-1].x} ${H} L ${pts[0].x} ${H} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: 80, height: 28 }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#sg-${color.replace('#','')})`} />
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function AreaChart({ data, labels, color, height = 140 }: { data: number[]; labels: string[]; color: string; height?: number }) {
  const W = 480; const H = height
  const pad = { t: 14, b: 22, l: 6, r: 6 }
  const cH = H - pad.t - pad.b
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => ({
    x: pad.l + (i / (data.length - 1)) * (W - pad.l - pad.r),
    y: pad.t + cH - (v / max) * cH,
  }))
  let linePath = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i-1].x + pts[i].x) / 2
    linePath += ` C ${cx} ${pts[i-1].y} ${cx} ${pts[i].y} ${pts[i].x} ${pts[i].y}`
  }
  const areaPath = `${linePath} L ${pts[pts.length-1].x} ${pad.t + cH} L ${pts[0].x} ${pad.t + cH} Z`
  const gId = `ag-${color.replace('#','')}`
  const allZero = data.every(v => v === 0)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {!allZero && <path d={areaPath} fill={`url(#${gId})`} />}
      {!allZero && <path d={linePath} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />}
      {allZero && <line x1={pad.l} y1={pad.t + cH / 2} x2={W - pad.r} y2={pad.t + cH / 2} stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="4 4" />}
      {pts.map((p, i) => (
        <g key={i}>
          {!allZero && data[i] > 0 && <circle cx={p.x} cy={p.y} r={3} fill={color} />}
          {!allZero && data[i] > 0 && (
            <text x={p.x} y={p.y - 6} textAnchor="middle" fontSize="8" fontWeight="bold" fill={color}>
              {data[i]}
            </text>
          )}
          <text x={p.x} y={H - 4} textAnchor="middle" fontSize="9" fill="#94A3B8">{labels[i]}</text>
        </g>
      ))}
      {allZero && (
        <text x={W/2} y={H/2 + 4} textAnchor="middle" fontSize="11" fill="#CBD5E1">Aucune donnée</text>
      )}
    </svg>
  )
}

function BarChart({ data, labels, color, height = 140 }: { data: number[]; labels: string[]; color: string; height?: number }) {
  const W = 480; const H = height
  const pad = { t: 16, b: 20, l: 4, r: 4 }
  const cH = H - pad.t - pad.b
  const max = Math.max(...data, 1)
  const bW = Math.max(((W - pad.l - pad.r) / data.length) * 0.55, 14)
  const gap = ((W - pad.l - pad.r) / data.length) * 0.45
  const allZero = data.every(v => v === 0)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      {data.map((v, i) => {
        const bH = allZero ? 2 : Math.max((v / max) * cH, v > 0 ? 4 : 2)
        const x = pad.l + i * (bW + gap) + gap / 2
        const y = pad.t + cH - bH
        const isLast = i === data.length - 1
        return (
          <g key={i}>
            <rect x={x} y={y} width={bW} height={bH} rx={3}
              fill={color} opacity={isLast ? 1 : 0.5 + (i / data.length) * 0.4}
            />
            <text x={x + bW/2} y={H - 4} textAnchor="middle" fontSize="8.5" fill="#94A3B8">{labels[i]}</text>
            {v > 0 && (
              <text x={x + bW/2} y={y - 4} textAnchor="middle" fontSize="8" fontWeight="bold" fill={color}>
                {v > 999_999 ? formatCA(v) : v > 999 ? formatCA(v) : v}
              </text>
            )}
          </g>
        )
      })}
      {allZero && (
        <text x={W/2} y={H/2 + 4} textAnchor="middle" fontSize="11" fill="#CBD5E1">Aucune donnée</text>
      )}
    </svg>
  )
}

function DonutChart({ segments, total }: { segments: ContractSeg[]; total: number }) {
  const r = 34; const cx = 50; const cy = 50
  const circ = 2 * Math.PI * r
  if (total === 0) {
    return (
      <svg viewBox="0 0 100 100" className="w-full max-w-[150px]">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth="14" />
        <text x={cx} y={cy+4} textAnchor="middle" fontSize="9" fill="#CBD5E1">Aucun</text>
      </svg>
    )
  }
  const offsets: number[] = []
  let cum = 0
  for (const seg of segments) {
    offsets.push(circ * (1 - cum))
    cum += seg.count / total
  }
  return (
    <svg viewBox="0 0 100 100" className="w-full max-w-[150px]">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth="14" />
      {segments.map((seg, i) => {
        if (seg.count === 0) return null
        const pct = seg.count / total
        const dash = pct * circ
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth="14"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={offsets[i]}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )
      })}
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize="15" fontWeight="bold" fill="#0F172A">{total}</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="7" fill="#94A3B8">contrats</text>
    </svg>
  )
}

function FunnelBar({ label, value, pct, color, max }: { label: string; value: number; pct: number; color: string; max: number }) {
  const w = max > 0 ? Math.max((value / max) * 100, 3) : 3
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-[#374151] font-medium truncate mr-2">{label}</span>
        <span className="text-[11px] font-bold shrink-0" style={{ color }}>{value}</span>
      </div>
      <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${w}%`, background: color }} />
      </div>
      <p className="text-[9px] text-[#94A3B8] mt-0.5 text-right">{pct}%</p>
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sublabel, color, sparkData, delta: dlt, unit = '', onClick,
}: {
  icon: React.ElementType; label: string; value: number | string
  sublabel?: string; color: string; sparkData?: number[]
  delta?: number; unit?: string; onClick?: () => void
}) {
  const isUp   = (dlt ?? 0) > 0
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm text-left w-full hover:shadow-md hover:border-transparent transition-all group"
      style={{ boxShadow: 'var(--tw-shadow)' }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: color + '18' }}>
          <Icon size={17} style={{ color }} />
        </div>
        {sparkData && sparkData.some(v => v > 0) && (
          <div className="opacity-70 group-hover:opacity-100 transition-opacity">
            <Sparkline data={sparkData} color={color} />
          </div>
        )}
      </div>
      <p className="text-[22px] font-extrabold text-[#0F172A] leading-none mb-0.5">
        {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}{unit}
      </p>
      <p className="text-[11px] text-[#64748B] font-medium truncate">{label}</p>
      {(sublabel || dlt !== undefined) && (
        <div className="flex items-center gap-1.5 mt-1.5">
          {dlt !== undefined && dlt !== 0 && (
            <span className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isUp ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
              {isUp ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}
              {Math.abs(dlt)}%
            </span>
          )}
          {dlt === 0 && dlt !== undefined && (
            <span className="flex items-center gap-0.5 text-[10px] text-[#94A3B8] px-1.5 py-0.5 bg-[#F8FAFC] rounded-full">
              <Minus size={9} /> 0%
            </span>
          )}
          {sublabel && <span className="text-[10px] text-[#94A3B8]">{sublabel}</span>}
        </div>
      )}
    </button>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

const EMPTY_KPIS: KPIs = {
  candidats: 0, candidatsDelta: 0,
  clients: 0, clientsDelta: 0,
  missions: 0, missionsDelta: 0,
  placements: 0, placementsDelta: 0,
  contrats: 0, contratsDelta: 0,
  caMois: 0, caTotalAnnee: 0, margeAvg: 0,
  tauxPlacement: 0, entretiens: 0, entretiensAujourdhui: 0,
  offresActives: 0, candidaturesMois: 0, candidaturesMoisDelta: 0,
  doublons: 0, nonAnalyses: 0,
}

export default function RecrutementPremiumDashboard() {
  const router = useRouter()
  const { tenantId, loading: tl } = useTenant()

  const [kpis, setKpis]             = useState<KPIs>(EMPTY_KPIS)
  const [months]                    = useState(getLast6Months)
  const [monthly, setMonthly]       = useState<MonthPoint[]>([])
  const [pipeline, setPipeline]     = useState<PipelinePt[]>([])
  const [contractSegs, setContractSegs] = useState<ContractSeg[]>([])
  const [topOffres, setTopOffres]   = useState<TopOffre[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading]       = useState(true)
  const [chartTab, setChartTab]     = useState<'candidatures' | 'placements' | 'ca' | 'entretiens'>('candidatures')

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    const now = new Date()
    const moisDebut    = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const moisPrevDeb  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
    const moisPrevFin  = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()
    const anneeDebut   = new Date(now.getFullYear(), 0, 1).toISOString()
    const sixMoisAgo   = months[0].start.toISOString()
    const todayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const todayEnd     = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

    // ── COUNT queries ──────────────────────────────────────────────────────────
    const safe = async (promise: PromiseLike<{ count: number | null; data?: unknown; error: unknown }>) => {
      try { const r = await promise; return r.count ?? 0 } catch { return 0 }
    }
    const safeData = async <T,>(promise: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> => {
      try { const r = await promise; return (r.data as T[]) ?? [] } catch { return [] }
    }

    const [
      nbCandidats, nbCandidatsAvant,
      nbClients,
      nbMissions,
      nbPlacements, nbPlacementsAvant,
      nbContrats, nbContratsAvant,
      nbEntretiens, nbEntretiensAujourd,
      nbOffres,
      nbCandMois, nbCandPrevMois,
      nbDoublons, nbNonAnalyses,
    ] = await Promise.all([
      safe(supabase.from('candidats').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)),
      safe(supabase.from('candidats').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).lt('created_at', moisDebut)),
      safe(supabase.from('rh_partenaires').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('type', 'client_entreprise').eq('actif', true)),
      safe(supabase.from('rh_missions').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'en_cours')),
      safe(supabase.from('rh_placements').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('statut', ['actif', 'essai'])),
      safe(supabase.from('rh_placements').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('statut', ['actif', 'essai']).lt('created_at', moisDebut)),
      safe(supabase.from('rh_contrats').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'signe')),
      safe(supabase.from('rh_contrats').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'signe').lt('created_at', moisDebut)),
      safe(supabase.from('entretiens').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'planifie')),
      safe(supabase.from('entretiens').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('date_heure', todayStart).lte('date_heure', todayEnd)),
      safe(supabase.from('offres_emploi').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'active')),
      safe(supabase.from('candidatures').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', moisDebut)),
      safe(supabase.from('candidatures').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', moisPrevDeb).lte('created_at', moisPrevFin)),
      safe(supabase.from('candidatures').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('est_doublon', true)),
      safe(supabase.from('candidatures').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('score_ia', 0)),
    ])

    // ── CA & marge ────────────────────────────────────────────────────────────
    const [placementsMois, placementsAnnee, allPlacements, nbRetenus] = await Promise.all([
      safeData<{ commission_fcfa: number | null; created_at: string }>(
        supabase.from('rh_placements').select('commission_fcfa, created_at').eq('tenant_id', tenantId).gte('created_at', moisDebut)
      ),
      safeData<{ commission_fcfa: number | null; created_at: string }>(
        supabase.from('rh_placements').select('commission_fcfa, created_at').eq('tenant_id', tenantId).gte('created_at', anneeDebut)
      ),
      safeData<{ commission_fcfa: number | null; salaire_mensuel: number | null; type_contrat: string | null; created_at: string }>(
        supabase.from('rh_placements').select('commission_fcfa, salaire_mensuel, type_contrat, created_at').eq('tenant_id', tenantId).gte('created_at', sixMoisAgo)
      ),
      safe(supabase.from('candidatures').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'retenu')),
    ])

    const caMois = placementsMois.reduce((s, p) => s + (p.commission_fcfa ?? 0), 0)
    const caAnnee = placementsAnnee.reduce((s, p) => s + (p.commission_fcfa ?? 0), 0)

    // Marge moyenne = commission / salaire * 100
    const withSalaire = allPlacements.filter(p => (p.salaire_mensuel ?? 0) > 0 && (p.commission_fcfa ?? 0) > 0)
    const margeAvg = withSalaire.length > 0
      ? Math.round(withSalaire.reduce((s, p) => s + ((p.commission_fcfa ?? 0) / (p.salaire_mensuel ?? 1)) * 100, 0) / withSalaire.length)
      : 0

    // Taux de placement = placements / retenus * 100
    const tauxPlacement = nbRetenus > 0 ? Math.round((nbPlacements / nbRetenus) * 100) : 0

    setKpis({
      candidats: nbCandidats, candidatsDelta: delta(nbCandidats, nbCandidatsAvant),
      clients: nbClients, clientsDelta: 0,
      missions: nbMissions, missionsDelta: 0,
      placements: nbPlacements, placementsDelta: delta(nbPlacements, nbPlacementsAvant),
      contrats: nbContrats, contratsDelta: delta(nbContrats, nbContratsAvant),
      caMois, caTotalAnnee: caAnnee, margeAvg,
      tauxPlacement, entretiens: nbEntretiens, entretiensAujourdhui: nbEntretiensAujourd,
      offresActives: nbOffres,
      candidaturesMois: nbCandMois, candidaturesMoisDelta: delta(nbCandMois, nbCandPrevMois),
      doublons: nbDoublons, nonAnalyses: nbNonAnalyses,
    })

    // ── Monthly chart data ────────────────────────────────────────────────────
    const [allCandidatures6m, allEntretiens6m] = await Promise.all([
      safeData<{ created_at: string }>(
        supabase.from('candidatures').select('created_at').eq('tenant_id', tenantId).gte('created_at', sixMoisAgo)
      ),
      safeData<{ created_at: string }>(
        supabase.from('entretiens').select('created_at').eq('tenant_id', tenantId).gte('created_at', sixMoisAgo)
      ),
    ])

    const cndByM  = countByMonth(allCandidatures6m, months)
    const entByM  = countByMonth(allEntretiens6m, months)
    const plcByM  = countByMonth(allPlacements, months)
    const caByM   = sumByMonth(allPlacements.map(p => ({ created_at: p.created_at, commission_fcfa: p.commission_fcfa })), months)

    setMonthly(months.map((m, i) => ({
      label: m.label,
      candidatures: cndByM[i],
      placements:   plcByM[i],
      ca:           caByM[i],
      entretiens:   entByM[i],
    })))

    // ── Pipeline funnel ───────────────────────────────────────────────────────
    const [nbCandTotal, nbEnCours, nbEntretienStat] = await Promise.all([
      safe(supabase.from('candidatures').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)),
      safe(supabase.from('candidatures').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('statut', ['en_cours', 'entretien'])),
      safe(supabase.from('candidatures').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'entretien')),
    ])
    setPipeline([
      { label: 'Candidatures reçues',   value: nbCandTotal,      color: '#2563EB' },
      { label: 'En cours de traitement', value: nbEnCours,        color: '#7C3AED' },
      { label: 'Entretiens planifiés',   value: nbEntretienStat,  color: '#D97706' },
      { label: 'Candidats retenus',      value: nbRetenus,        color: '#16A34A' },
      { label: 'Placements actifs',      value: nbPlacements,     color: '#0EA5E9' },
    ])

    // ── Contrats by type ──────────────────────────────────────────────────────
    const allContrats = await safeData<{ type_contrat: string | null }>(
      supabase.from('rh_contrats').select('type_contrat').eq('tenant_id', tenantId)
    )
    const typeMap: Record<string, number> = {}
    allContrats.forEach(c => { const k = c.type_contrat ?? 'autre'; typeMap[k] = (typeMap[k] ?? 0) + 1 })
    const TYPE_COLORS: Record<string, { label: string; color: string }> = {
      cdi: { label: 'CDI', color: '#16A34A' }, cdd: { label: 'CDD', color: '#2563EB' },
      interim: { label: 'Intérim', color: '#F59E0B' }, stage: { label: 'Stage', color: '#7C3AED' },
      freelance: { label: 'Freelance', color: '#0EA5E9' }, autre: { label: 'Autre', color: '#94A3B8' },
    }
    const totalContrats = Object.values(typeMap).reduce((s, v) => s + v, 0)
    setContractSegs(
      Object.entries(typeMap)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => ({
          label: TYPE_COLORS[k]?.label ?? k, count: v,
          color: TYPE_COLORS[k]?.color ?? '#94A3B8',
          pct: totalContrats > 0 ? Math.round((v / totalContrats) * 100) : 0,
        }))
    )

    // ── Top offres ────────────────────────────────────────────────────────────
    const offresData = await safeData<{ id: string; titre: string; localisation: string | null; candidatures: { id: string; score_ia: number | null }[] }>(
      supabase.from('offres_emploi')
        .select('id, titre, localisation, candidatures(id, score_ia)')
        .eq('tenant_id', tenantId).eq('statut', 'active')
        .order('created_at', { ascending: false }).limit(5)
    )
    setTopOffres(offresData.map(o => {
      const cands = (o.candidatures ?? []).filter(c => (c.score_ia ?? 0) > 0)
      const score = cands.length > 0 ? Math.round(cands.reduce((s, c) => s + (c.score_ia ?? 0), 0) / cands.length) : 0
      return { id: o.id, titre: o.titre, localisation: o.localisation, nb: (o.candidatures ?? []).length, score }
    }))

    // ── Activité récente ──────────────────────────────────────────────────────
    const [recentCands, recentEnt] = await Promise.all([
      safeData<{ id: string; created_at: string; statut: string; candidats: { nom: string | null; prenom: string | null } | null; offres_emploi: { titre: string } | null }>(
        supabase.from('candidatures')
          .select('id, created_at, statut, candidats(nom, prenom), offres_emploi(titre)')
          .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(4)
      ),
      safeData<{ id: string; date_heure: string; type: string; candidats: { nom: string | null; prenom: string | null } | null }>(
        supabase.from('entretiens')
          .select('id, date_heure, type, candidats(nom, prenom)')
          .eq('tenant_id', tenantId).order('date_heure', { ascending: false }).limit(3)
      ),
    ])

    const acts: Activity[] = [
      ...recentCands.map(c => ({
        id: c.id, type: 'candidature',
        label: `${[(c.candidats as { prenom: string | null } | null)?.prenom, (c.candidats as { nom: string | null } | null)?.nom].filter(Boolean).join(' ') || 'Nouveau candidat'}`,
        sub: (c.offres_emploi as { titre: string } | null)?.titre ?? 'Candidature reçue',
        date: c.created_at, color: '#2563EB', icon: 'users',
      })),
      ...recentEnt.map(e => ({
        id: e.id, type: 'entretien',
        label: `${[(e.candidats as { prenom: string | null } | null)?.prenom, (e.candidats as { nom: string | null } | null)?.nom].filter(Boolean).join(' ') || 'Entretien'}`,
        sub: `Entretien ${e.type ?? 'planifié'}`,
        date: e.date_heure, color: '#7C3AED', icon: 'calendar',
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6)

    setActivities(acts)
    setLoading(false)
  }, [tenantId, months])

  useEffect(() => { if (tenantId) void load() }, [tenantId, load])

  const chartData = {
    candidatures: monthly.map(m => m.candidatures),
    placements:   monthly.map(m => m.placements),
    ca:           monthly.map(m => m.ca),
    entretiens:   monthly.map(m => m.entretiens),
  }
  const chartLabels = monthly.map(m => m.label)
  const pipelineMax = pipeline[0]?.value ?? 1

  const CHART_TABS: Array<{ key: typeof chartTab; label: string; color: string }> = [
    { key: 'candidatures', label: 'Candidatures', color: '#2563EB' },
    { key: 'placements',   label: 'Placements',   color: '#16A34A' },
    { key: 'ca',           label: 'CA (FCFA)',    color: '#F59E0B' },
    { key: 'entretiens',   label: 'Entretiens',   color: '#7C3AED' },
  ]
  const activeChartCfg = CHART_TABS.find(t => t.key === chartTab)!

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (tl || loading) return (
    <div className="space-y-5 animate-pulse">
      <div className="h-16 bg-gradient-to-r from-[#F8FAFC] to-[#F1F5F9] rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array(5).fill(0).map((_, i) => <div key={i} className="h-28 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0]" />)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array(4).fill(0).map((_, i) => <div key={i} className="h-24 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0]" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-56 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0]" />
        <div className="h-56 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0]" />
      </div>
    </div>
  )

  return (
    <div className="space-y-4 sm:space-y-5 pb-6">

      {/* ── Banner ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3"
        style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)' }}
      >
        <div className="min-w-0">
          <h1 className="text-[17px] sm:text-xl font-extrabold text-white leading-tight">Direction RH</h1>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">
            Recrutement & Placement —{' '}
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(kpis.doublons > 0 || kpis.nonAnalyses > 0) && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/20 border border-orange-500/30">
              <AlertCircle size={13} className="text-orange-400" />
              <span className="text-[11px] text-orange-300 font-semibold">
                {kpis.doublons > 0 ? `${kpis.doublons} doublon${kpis.doublons > 1 ? 's' : ''}` : `${kpis.nonAnalyses} non analysé${kpis.nonAnalyses > 1 ? 's' : ''}`}
              </span>
            </div>
          )}
          <button
            onClick={() => router.push('/dashboard/recrutement/offres/nouvelle')}
            className="flex items-center gap-2 px-4 py-2 bg-[#F59E0B] text-white rounded-xl text-[13px] font-bold hover:bg-[#D97706] transition-colors shadow-sm shrink-0"
          >
            <Plus size={14} /> Nouvelle offre
          </button>
        </div>
      </div>

      {/* ── KPIs ROW 1 — activité principale ─────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard icon={Users}     label="Candidats vivier"   value={kpis.candidats}   color="#2563EB" sparkData={chartData.candidatures}
          delta={kpis.candidatsDelta} sublabel="vs mois dernier" onClick={() => router.push('/dashboard/recrutement/cvtheque')} />
        <KpiCard icon={Building2} label="Clients actifs"     value={kpis.clients}     color="#7C3AED"
          delta={kpis.clientsDelta}   sublabel="entreprises" onClick={() => router.push('/dashboard/recrutement/partenaires')} />
        <KpiCard icon={Briefcase} label="Missions en cours"  value={kpis.missions}    color="#0EA5E9"
          delta={kpis.missionsDelta}  sublabel="intérim & placement" onClick={() => router.push('/dashboard/recrutement/placement')} />
        <KpiCard icon={UserCheck} label="Placements actifs"  value={kpis.placements}  color="#16A34A" sparkData={chartData.placements}
          delta={kpis.placementsDelta} sublabel="vs mois dernier" onClick={() => router.push('/dashboard/recrutement/placement')} />
        <KpiCard icon={FileText}  label="Contrats signés"    value={kpis.contrats}    color="#EC4899"
          delta={kpis.contratsDelta}  sublabel="vs mois dernier" onClick={() => router.push('/dashboard/recrutement/contrats')} />
      </div>

      {/* ── KPIs ROW 2 — performance & finance ───────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
          <p className="text-[10px] text-[#94A3B8] font-semibold uppercase tracking-wider mb-1">CA ce mois</p>
          <p className="text-[22px] font-extrabold text-[#0F172A]">{formatCA(kpis.caMois)} <span className="text-[13px] text-[#94A3B8] font-normal">FCFA</span></p>
          <p className="text-[11px] text-[#64748B] mt-0.5">Annuel : <span className="font-bold text-[#F59E0B]">{formatCA(kpis.caTotalAnnee)} FCFA</span></p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
          <p className="text-[10px] text-[#94A3B8] font-semibold uppercase tracking-wider mb-1">Marge commission</p>
          <p className="text-[22px] font-extrabold text-[#0F172A]">{kpis.margeAvg}<span className="text-[15px] text-[#94A3B8]">%</span></p>
          <p className="text-[11px] text-[#64748B] mt-0.5">Taux moyen sur placements</p>
        </div>
        <KpiCard icon={Target}   label="Taux de placement"  value={kpis.tauxPlacement} unit="%" color="#F59E0B"
          sublabel="retenus → placés" />
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
          <p className="text-[10px] text-[#94A3B8] font-semibold uppercase tracking-wider mb-1">Entretiens</p>
          <p className="text-[22px] font-extrabold text-[#0F172A]">{kpis.entretiens}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {kpis.entretiensAujourdhui > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full">
                <Clock size={9} /> {kpis.entretiensAujourdhui} auj.
              </span>
            )}
            <p className="text-[11px] text-[#64748B]">planifiés</p>
          </div>
        </div>
      </div>

      {/* ── Charts row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Area / Bar chart tendance */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-[13px] font-bold text-[#0F172A]">Tendance 6 mois</h2>
            <div className="flex items-center gap-1 bg-[#F8FAFC] rounded-xl p-1">
              {CHART_TABS.map(t => (
                <button key={t.key} onClick={() => setChartTab(t.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${chartTab === t.key ? 'text-white shadow-sm' : 'text-[#64748B] hover:bg-white'}`}
                  style={chartTab === t.key ? { background: t.color } : {}}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {chartTab === 'ca' ? (
            <BarChart
              data={chartData.ca}
              labels={chartLabels}
              color={activeChartCfg.color}
              height={140}
            />
          ) : (
            <AreaChart
              data={chartData[chartTab]}
              labels={chartLabels}
              color={activeChartCfg.color}
              height={140}
            />
          )}
        </div>

        {/* Donut contrats */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 shadow-sm">
          <h2 className="text-[13px] font-bold text-[#0F172A] mb-4">Répartition contrats</h2>
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <DonutChart segments={contractSegs} total={kpis.contrats} />
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              {contractSegs.length === 0 ? (
                <p className="text-[11px] text-[#94A3B8]">Aucun contrat enregistré</p>
              ) : (
                contractSegs.map(seg => (
                  <div key={seg.label} className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
                    <span className="text-[11px] text-[#374151] flex-1 truncate">{seg.label}</span>
                    <span className="text-[11px] font-bold text-[#0F172A] shrink-0">{seg.count}</span>
                    <span className="text-[10px] text-[#94A3B8] shrink-0">{seg.pct}%</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Pipeline funnel */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-bold text-[#0F172A]">Pipeline recrutement</h2>
            <Activity size={14} className="text-[#94A3B8]" />
          </div>
          <div className="space-y-3">
            {pipeline.map(step => (
              <FunnelBar
                key={step.label}
                label={step.label}
                value={step.value}
                pct={pipelineMax > 0 ? Math.round((step.value / pipelineMax) * 100) : 0}
                color={step.color}
                max={pipelineMax}
              />
            ))}
          </div>
          {pipeline.every(p => p.value === 0) && (
            <div className="text-center py-4">
              <p className="text-[11px] text-[#94A3B8]">Aucune candidature pour l&apos;instant</p>
              <button onClick={() => router.push('/dashboard/recrutement/offres/nouvelle')}
                className="mt-2 text-[11px] text-[#F59E0B] font-bold hover:underline">
                Créer une offre →
              </button>
            </div>
          )}
        </div>

        {/* Top offres */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-bold text-[#0F172A]">Top offres actives</h2>
            <button onClick={() => router.push('/dashboard/recrutement/offres')}
              className="text-[11px] text-[#F59E0B] font-semibold hover:text-[#D97706]">
              Voir tout →
            </button>
          </div>
          {topOffres.length === 0 ? (
            <div className="text-center py-8">
              <Briefcase size={28} className="text-[#CBD5E1] mx-auto mb-2" />
              <p className="text-[11px] text-[#94A3B8]">Aucune offre active</p>
              <button onClick={() => router.push('/dashboard/recrutement/offres/nouvelle')}
                className="mt-2 text-[11px] text-[#F59E0B] font-bold hover:underline">
                Publier votre première offre →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {topOffres.map((o, i) => (
                <button key={o.id}
                  onClick={() => router.push(`/dashboard/recrutement/candidatures?offre=${o.id}`)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#F8FAFC] transition-colors text-left group"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold"
                    style={{ background: '#FEF3C7', color: '#D97706' }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-[#0F172A] truncate">{o.titre}</p>
                    <p className="text-[10px] text-[#94A3B8]">{o.nb} candidature{o.nb !== 1 ? 's' : ''}{o.localisation ? ` · ${o.localisation}` : ''}</p>
                  </div>
                  {o.score > 0 && (
                    <span className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${o.score >= 80 ? 'bg-green-50 text-green-600' : o.score >= 60 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                      <Star size={8} /> {o.score}
                    </span>
                  )}
                  <ArrowRight size={11} className="text-[#CBD5E1] group-hover:text-[#F59E0B] transition-colors shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Activités récentes */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-bold text-[#0F172A]">Activité récente</h2>
            <Sparkles size={14} className="text-[#94A3B8]" />
          </div>
          {activities.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle size={28} className="text-[#CBD5E1] mx-auto mb-2" />
              <p className="text-[11px] text-[#94A3B8]">Aucune activité récente</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {activities.map((act, i) => {
                const AIcon = act.type === 'entretien' ? Calendar : Users
                const relTime = (() => {
                  const diff = Date.now() - new Date(act.date).getTime()
                  const h = Math.floor(diff / 3_600_000)
                  if (h < 1)  return 'À l\'instant'
                  if (h < 24) return `Il y a ${h}h`
                  const d = Math.floor(h / 24)
                  return `Il y a ${d}j`
                })()
                return (
                  <div key={act.id} className={`flex items-start gap-3 py-2.5 ${i < activities.length - 1 ? 'border-b border-[#F8FAFC]' : ''}`}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: act.color + '18' }}>
                      <AIcon size={12} style={{ color: act.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#0F172A] truncate">{act.label}</p>
                      <p className="text-[10px] text-[#94A3B8] truncate">{act.sub}</p>
                    </div>
                    <span className="text-[9px] text-[#CBD5E1] shrink-0 mt-0.5 whitespace-nowrap">{relTime}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick actions ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {[
          { label: 'Offres d\'emploi',  href: '/dashboard/recrutement/offres',       icon: Briefcase,  color: '#F59E0B' },
          { label: 'Candidatures',      href: '/dashboard/recrutement/candidatures',  icon: Users,      color: '#2563EB' },
          { label: 'Entretiens',        href: '/dashboard/recrutement/entretiens',    icon: Calendar,   color: '#7C3AED' },
          { label: 'CV-thèque',         href: '/dashboard/recrutement/cvtheque',      icon: Star,       color: '#F59E0B' },
          { label: 'Placements',        href: '/dashboard/recrutement/placement',     icon: UserCheck,  color: '#16A34A' },
          { label: 'MIAA+ Job',         href: '/dashboard/miaa?context=recrutement',  icon: Sparkles,   color: '#DC2626' },
        ].map(({ label, href, icon: Icon, color }) => (
          <button key={href} onClick={() => router.push(href)}
            className="bg-white border border-[#E2E8F0] rounded-xl p-3 flex items-center gap-2.5 hover:shadow-md hover:border-transparent transition-all group text-left"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors" style={{ background: color + '18' }}>
              <Icon size={13} style={{ color }} />
            </div>
            <span className="text-[11px] font-semibold text-[#374151] group-hover:text-[#0F172A] transition-colors leading-tight">{label}</span>
          </button>
        ))}
      </div>

    </div>
  )
}
