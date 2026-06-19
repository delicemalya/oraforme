'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Briefcase, Plus, Search, Filter, Loader2,
  Users, Calendar, MapPin, Clock, Eye,
  CheckCircle, XCircle, PauseCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

interface Offre {
  id: string; titre: string; description: string | null; localisation: string | null
  type_contrat: string | null; statut: string; created_at: string
  date_fermeture_prevue: string | null; nombre_postes: number | null
  nb_candidatures?: number
}

const TYPE_LABELS: Record<string, string> = {
  cdi: 'CDI', cdd: 'CDD', stage: 'Stage', freelance: 'Freelance',
  interim: 'Intérim', vacation: 'Vacation', alternance: 'Alternance',
}
const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  active:    { label: 'Active',    color: '#16A34A', bg: '#F0FDF4', icon: CheckCircle  },
  suspendue: { label: 'Suspendue', color: '#D97706', bg: '#FFFBEB', icon: PauseCircle  },
  cloturee:  { label: 'Clôturée', color: '#DC2626', bg: '#FEF2F2', icon: XCircle      },
}

export default function OffresPage() {
  const router = useRouter()
  const { tenantId, loading: tl } = useTenant()
  const [offres, setOffres]     = useState<Offre[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filtreStatut, setFiltreStatut] = useState<string>('active')

  useEffect(() => { if (tenantId) void load() }, [tenantId, filtreStatut])

  async function load() {
    if (!tenantId) return
    setLoading(true)
    let q = supabase
      .from('offres_emploi')
      .select('id, titre, description, localisation, type_contrat, statut, created_at, date_fermeture_prevue, nombre_postes')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (filtreStatut !== 'all') q = q.eq('statut', filtreStatut)
    const { data } = await q.limit(50)

    if (data && data.length > 0) {
      const ids = data.map(o => o.id)
      const { data: counts } = await supabase
        .from('candidatures')
        .select('offre_id')
        .in('offre_id', ids)
        .eq('tenant_id', tenantId)
      const countMap: Record<string, number> = {}
      for (const c of counts ?? []) {
        countMap[c.offre_id] = (countMap[c.offre_id] ?? 0) + 1
      }
      setOffres(data.map(o => ({ ...o, nb_candidatures: countMap[o.id] ?? 0 })))
    } else {
      setOffres([])
    }
    setLoading(false)
  }

  const filtered = offres.filter(o =>
    !search || o.titre.toLowerCase().includes(search.toLowerCase()) ||
    (o.localisation ?? '').toLowerCase().includes(search.toLowerCase())
  )

  if (tl) return <div className="flex justify-center py-24"><Loader2 size={28} className="animate-spin text-[#F59E0B]" /></div>

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] sm:text-xl font-bold text-[#0F172A]">Offres d&apos;emploi</h1>
          <p className="text-[11px] text-[#64748B]">Postes ouverts & diffusion</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/recrutement/offres/nouvelle')}
          className="flex items-center gap-2 px-4 py-2 bg-[#F59E0B] text-white rounded-xl text-[13px] font-bold hover:bg-[#D97706] shadow-sm transition-colors shrink-0"
        >
          <Plus size={14} /> Nouvelle offre
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par poste ou ville..."
            className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
          />
        </div>
        <div className="flex items-center gap-1 bg-white border border-[#E2E8F0] rounded-xl px-1 py-1">
          <Filter size={12} className="text-[#94A3B8] ml-2" />
          {['active', 'suspendue', 'cloturee', 'all'].map(s => (
            <button
              key={s}
              onClick={() => setFiltreStatut(s)}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors ${filtreStatut === s ? 'bg-[#F59E0B] text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}
            >
              {s === 'all' ? 'Toutes' : STATUT_CONFIG[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-[#F59E0B]" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center shadow-sm">
          <Briefcase size={32} className="text-[#CBD5E1] mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#64748B]">Aucune offre {filtreStatut !== 'all' ? STATUT_CONFIG[filtreStatut]?.label.toLowerCase() : ''}</p>
          <button
            onClick={() => router.push('/dashboard/recrutement/offres/nouvelle')}
            className="mt-4 px-4 py-2 bg-[#F59E0B] text-white rounded-xl text-xs font-bold hover:bg-[#D97706]"
          >
            Créer la première offre
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => {
            const sc = STATUT_CONFIG[o.statut] ?? STATUT_CONFIG['active']
            const ScIcon = sc.icon
            return (
              <div
                key={o.id}
                className="bg-white rounded-xl border border-[#E2E8F0] p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/dashboard/recrutement/candidatures?offre=${o.id}`)}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] flex items-center justify-center shrink-0">
                    <Briefcase size={18} className="text-[#F59E0B]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-[14px] font-bold text-[#0F172A] truncate">{o.titre}</h3>
                      <span
                        className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: sc.bg, color: sc.color }}
                      >
                        <ScIcon size={9} /> {sc.label}
                      </span>
                      {o.type_contrat && (
                        <span className="text-[10px] font-semibold bg-[#F1F5F9] text-[#475569] px-2 py-0.5 rounded-full shrink-0">
                          {TYPE_LABELS[o.type_contrat] ?? o.type_contrat}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-[11px] text-[#64748B]">
                      {o.localisation && (
                        <span className="flex items-center gap-1"><MapPin size={10} /> {o.localisation}</span>
                      )}
                      {o.nombre_postes && (
                        <span className="flex items-center gap-1"><Users size={10} /> {o.nombre_postes} poste{o.nombre_postes > 1 ? 's' : ''}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {o.date_fermeture_prevue && (
                        <span className="flex items-center gap-1 text-orange-600">
                          <Clock size={10} />
                          Clôture : {new Date(o.date_fermeture_prevue).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-center">
                      <p className="text-lg font-extrabold text-[#0F172A]">{o.nb_candidatures ?? 0}</p>
                      <p className="text-[9px] text-[#94A3B8]">candidatures</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); router.push(`/dashboard/recrutement/candidatures?offre=${o.id}`) }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[11px] font-semibold text-[#475569] hover:bg-[#F59E0B]/10 hover:text-[#D97706] transition-colors"
                    >
                      <Eye size={11} /> Voir
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
