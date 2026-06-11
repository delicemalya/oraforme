'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Briefcase, Users, Calendar, CheckCircle, Star,
  AlertTriangle, TrendingUp, Loader2, Plus,
} from 'lucide-react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

interface TopTalent { id: string; nom: string | null; prenom: string | null; score_global: number; competences: string[] | null }
interface OffreStats { id: string; titre: string; nb: number; scoreMoyen: number }
interface CandidatureRow {
  id: string; created_at: string; statut: string; score_ia: number; est_doublon: boolean
  candidat_prenom: string | null; candidat_nom: string | null; offre_titre: string | null
}

function scoreCls(s: number) {
  if (s >= 80) return 'bg-green-100 text-green-700'
  if (s >= 60) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}
function scoreCat(s: number) {
  if (s >= 90) return 'Exceptionnel'
  if (s >= 80) return 'Excellent'
  if (s >= 70) return 'Bon'
  if (s >= 60) return 'Moyen'
  return 'Faible'
}

const STATUT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  nouveau:    { bg: 'bg-blue-50',   text: 'text-blue-700',   label: 'Nouveau'   },
  en_cours:   { bg: 'bg-amber-50',  text: 'text-amber-700',  label: 'En cours'  },
  retenu:     { bg: 'bg-green-50',  text: 'text-green-700',  label: 'Retenu'    },
  refuse:     { bg: 'bg-red-50',    text: 'text-red-700',    label: 'Refusé'    },
  entretien:  { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Entretien' },
}

export default function RecrutementDashboard() {
  const router = useRouter()
  const { tenantId, loading: tl } = useTenant()
  const [kpis, setKpis] = useState({ offresActives: 0, candidaturesMois: 0, entretiens: 0, retenus: 0 })
  const [talents, setTalents]   = useState<TopTalent[]>([])
  const [offres, setOffres]     = useState<OffreStats[]>([])
  const [recentes, setRecentes] = useState<CandidatureRow[]>([])
  const [doublons, setDoublons]     = useState(0)
  const [nonAnalyses, setNonAnalyses] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (tenantId) void load() }, [tenantId])

  async function load() {
    if (!tenantId) return
    setLoading(true)
    const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    const [{ count: oa }, { count: cm }, { count: ent }, { count: ret }, { count: dbl }, { count: na }] = await Promise.all([
      supabase.from('offres_emploi').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'active'),
      supabase.from('candidatures').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', debutMois),
      supabase.from('entretiens').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('candidatures').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'retenu'),
      supabase.from('candidatures').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('est_doublon', true),
      supabase.from('candidatures').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('score_ia', 0),
    ])
    setKpis({ offresActives: oa ?? 0, candidaturesMois: cm ?? 0, entretiens: ent ?? 0, retenus: ret ?? 0 })
    setDoublons(dbl ?? 0); setNonAnalyses(na ?? 0)

    const { data: t } = await supabase.from('candidats').select('id, nom, prenom, score_global, competences').eq('tenant_id', tenantId).gt('score_global', 0).order('score_global', { ascending: false }).limit(3)
    setTalents(t ?? [])

    const { data: ov } = await supabase.from('offres_emploi').select('id, titre, candidatures(id, score_ia)').eq('tenant_id', tenantId).eq('statut', 'active').order('created_at', { ascending: false }).limit(5)
    setOffres((ov ?? []).map(o => {
      const cands  = (o.candidatures as { id: string; score_ia: number | null }[] | null) ?? []
      const scored = cands.filter(c => (c.score_ia ?? 0) > 0)
      const moy    = scored.length > 0 ? Math.round(scored.reduce((s, c) => s + (c.score_ia ?? 0), 0) / scored.length) : 0
      return { id: o.id, titre: o.titre, nb: cands.length, scoreMoyen: moy }
    }))

    const { data: rc } = await supabase.from('candidatures').select('id, created_at, statut, score_ia, est_doublon, candidats(nom, prenom), offres_emploi(titre)').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(6)
    setRecentes((rc ?? []).map(c => ({
      id: c.id, created_at: c.created_at, statut: c.statut, score_ia: c.score_ia ?? 0, est_doublon: c.est_doublon ?? false,
      candidat_prenom: (c.candidats as unknown as { prenom: string | null } | null)?.prenom ?? null,
      candidat_nom:    (c.candidats as unknown as { nom: string | null } | null)?.nom ?? null,
      offre_titre:     (c.offres_emploi as unknown as { titre: string } | null)?.titre ?? null,
    })))
    setLoading(false)
  }

  if (tl || loading) return (
    <div className="flex justify-center py-24">
      <Loader2 size={28} className="animate-spin text-[#F59E0B]" />
    </div>
  )

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Image
            src="/logo-miaa-job.png"
            alt="MIAA+ JOB"
            width={36}
            height={36}
            className="rounded-xl shadow-sm shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-[18px] sm:text-xl font-bold text-[#0F172A] leading-tight">Recrutement IA</h1>
            <p className="text-[11px] text-[#64748B]">Propulsé par MIAA+ JOB</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/dashboard/rh/recrutement/offres/nouvelle')}
          className="flex items-center gap-2 px-4 py-2 bg-[#F59E0B] text-white rounded-xl text-[13px] font-bold hover:bg-[#D97706] shadow-sm transition-colors shrink-0"
        >
          <Plus size={14} /> Nouvelle offre
        </button>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Briefcase,     label: 'Offres actives',       value: kpis.offresActives,    color: '#2563EB' },
          { icon: Users,         label: 'Candidatures ce mois', value: kpis.candidaturesMois, color: '#F59E0B' },
          { icon: Calendar,      label: 'Entretiens',           value: kpis.entretiens,        color: '#8B5CF6' },
          { icon: CheckCircle,   label: 'Retenus',              value: kpis.retenus,           color: '#16A34A' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: color + '18' }}>
              <Icon size={16} style={{ color }} />
            </div>
            <p className="text-2xl font-extrabold text-[#0F172A]">{value}</p>
            <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Top Talents + Offres ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">

        {/* TOP TALENTS */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Star size={14} className="text-[#F59E0B]" />
            <h2 className="text-sm font-bold text-[#0F172A]">Top Talents</h2>
          </div>
          {talents.length === 0 ? (
            <p className="text-xs text-[#94A3B8] text-center py-8">Aucun talent scoré</p>
          ) : (
            <div className="space-y-3">
              {talents.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : '#CD7F32' }}
                  >{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#0F172A] truncate">
                      {[t.prenom, t.nom].filter(Boolean).join(' ') || 'Candidat'}
                    </p>
                    <p className="text-[10px] text-[#64748B] truncate">
                      {(t.competences ?? []).slice(0, 2).join(', ') || '—'}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${scoreCls(t.score_global)}`}>
                    {t.score_global}/100
                  </span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => router.push('/dashboard/rh/recrutement/cvtheque')}
            className="mt-5 w-full text-xs text-[#F59E0B] font-semibold hover:text-[#D97706] transition-colors"
          >
            Voir tous →
          </button>
        </div>

        {/* OFFRES ACTIVES */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[#0F172A]">Offres actives</h2>
            <button
              onClick={() => router.push('/dashboard/rh/recrutement/offres')}
              className="text-xs text-[#F59E0B] font-semibold hover:text-[#D97706]"
            >
              Gérer →
            </button>
          </div>
          {offres.length === 0 ? (
            <p className="text-xs text-[#94A3B8] text-center py-8">Aucune offre active</p>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {offres.map(o => (
                <div key={o.id} className="flex items-center gap-3 py-3 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#0F172A] truncate">{o.titre}</p>
                    <p className="text-[10px] text-[#64748B]">{o.nb} candidature{o.nb !== 1 ? 's' : ''}</p>
                  </div>
                  {o.scoreMoyen > 0 && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${scoreCls(o.scoreMoyen)}`}>
                      Moy. {o.scoreMoyen}
                    </span>
                  )}
                  <button
                    onClick={() => router.push(`/dashboard/rh/recrutement/candidatures?offre=${o.id}`)}
                    className="text-[10px] text-[#2563EB] font-semibold hover:underline shrink-0"
                  >
                    TOP 5
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Candidatures récentes + Alertes ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">

        {/* CANDIDATURES RÉCENTES */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[#0F172A]">Candidatures récentes</h2>
            <button
              onClick={() => router.push('/dashboard/rh/recrutement/candidatures')}
              className="text-xs text-[#F59E0B] font-semibold hover:text-[#D97706]"
            >
              Voir tout →
            </button>
          </div>
          {recentes.length === 0 ? (
            <p className="text-xs text-[#94A3B8] text-center py-8">Aucune candidature</p>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {recentes.map(c => {
                const sc = STATUT_COLORS[c.statut] ?? STATUT_COLORS['nouveau']
                return (
                  <div key={c.id} className="flex items-center gap-3 py-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center shrink-0">
                      <Users size={12} className="text-[#64748B]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#0F172A] truncate">
                        {[c.candidat_prenom, c.candidat_nom].filter(Boolean).join(' ') || 'Candidat'}
                        {c.est_doublon && (
                          <span className="ml-1.5 text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full align-middle">Doublon</span>
                        )}
                      </p>
                      <p className="text-[10px] text-[#64748B] truncate">{c.offre_titre ?? '—'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                        {sc.label}
                      </span>
                      {c.score_ia > 0
                        ? <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${scoreCls(c.score_ia)}`}>{c.score_ia}</span>
                        : <span className="text-[10px] text-[#94A3B8]">—</span>
                      }
                      <span className="text-[10px] text-[#CBD5E1] hidden sm:inline">
                        {new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ALERTES */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={14} className="text-[#F59E0B]" />
            <h2 className="text-sm font-bold text-[#0F172A]">Alertes</h2>
          </div>
          {doublons === 0 && nonAnalyses === 0 ? (
            <div className="flex flex-col items-center py-6">
              <CheckCircle size={28} className="text-[#16A34A] mb-2" />
              <p className="text-xs text-[#64748B] text-center">Tout est en ordre</p>
            </div>
          ) : (
            <div className="space-y-3">
              {doublons > 0 && (
                <div className="rounded-xl p-3 bg-orange-50 border border-orange-100">
                  <p className="text-xs font-bold text-orange-700">
                    {doublons} doublon{doublons > 1 ? 's' : ''} détecté{doublons > 1 ? 's' : ''}
                  </p>
                  <button
                    onClick={() => router.push('/dashboard/rh/recrutement/candidatures')}
                    className="text-[10px] text-orange-600 font-semibold underline mt-1"
                  >
                    Voir →
                  </button>
                </div>
              )}
              {nonAnalyses > 0 && (
                <div className="rounded-xl p-3 bg-blue-50 border border-blue-100">
                  <p className="text-xs font-bold text-blue-700">
                    {nonAnalyses} CV non analysé{nonAnalyses > 1 ? 's' : ''}
                  </p>
                  <button
                    onClick={() => router.push('/dashboard/rh/recrutement/cvtheque')}
                    className="text-[10px] text-blue-600 font-semibold underline mt-1"
                  >
                    Analyser →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Actions ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Candidatures', href: '/dashboard/rh/recrutement/candidatures', icon: Users,    sub: 'Gérer le pipeline' },
          { label: 'CVthèque',     href: '/dashboard/rh/recrutement/cvtheque',     icon: Star,     sub: 'Tous les talents'  },
          { label: 'Entretiens',   href: '/dashboard/rh/recrutement/entretiens',   icon: Calendar, sub: 'Planifier'         },
        ].map(({ label, href, icon: Icon, sub }) => (
          <button
            key={href}
            onClick={() => router.push(href)}
            className="bg-white border border-[#E2E8F0] rounded-xl p-4 text-left hover:border-[#F59E0B]/50 hover:shadow-md transition-all group shadow-sm"
          >
            <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] flex items-center justify-center mb-3 group-hover:bg-[#F59E0B]/20 transition-colors">
              <Icon size={15} className="text-[#F59E0B]" />
            </div>
            <p className="text-xs font-bold text-[#0F172A] group-hover:text-[#F59E0B] transition-colors">{label}</p>
            <p className="text-[10px] text-[#94A3B8] mt-0.5">{sub}</p>
          </button>
        ))}

        {/* MIAA JOB — logo image */}
        <button
          onClick={() => router.push('/dashboard/miaa?context=recrutement')}
          className="bg-white border border-[#E2E8F0] rounded-xl p-4 text-left hover:border-[#F59E0B]/50 hover:shadow-md transition-all group shadow-sm"
        >
          <div className="w-8 h-8 rounded-lg mb-3 overflow-hidden shrink-0">
            <Image
              src="/logo-miaa-job.png"
              alt="MIAA JOB"
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          </div>
          <p className="text-xs font-bold text-[#0F172A] group-hover:text-[#F59E0B] transition-colors">MIAA JOB</p>
          <p className="text-[10px] text-[#94A3B8] mt-0.5">Assistant IA</p>
        </button>
      </div>
    </div>
  )
}
