'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Briefcase, Loader2, MapPin, Clock, BarChart2, ChevronDown, Copy, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

interface Offre {
  id: string
  titre: string
  departement: string | null
  localisation: string | null
  type_contrat: string | null
  statut: string
  date_limite: string | null
  created_at: string
  nb: number
  scoreMoyen: number
  slug: string | null
}

const STATUT_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  cloturee: 'bg-gray-100 text-gray-600',
  brouillon: 'bg-amber-100 text-amber-700',
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://oraforms.com'

export default function OffresPage() {
  const router = useRouter()
  const { tenantId, loading: tl } = useTenant()
  const [offres, setOffres] = useState<Offre[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [closingId, setClosingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase
      .from('offres_emploi')
      .select('id, titre, departement, localisation, type_contrat, statut, date_limite, created_at, slug, candidatures(id, score_ia)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    setOffres((data ?? []).map(o => {
      const cands = (o.candidatures as { id: string; score_ia: number | null }[] | null) ?? []
      const scored = cands.filter(c => (c.score_ia ?? 0) > 0)
      const moy = scored.length > 0 ? Math.round(scored.reduce((s, c) => s + (c.score_ia ?? 0), 0) / scored.length) : 0
      return { ...o, nb: cands.length, scoreMoyen: moy }
    }))
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (tenantId) void load() }, [tenantId, load])

  async function cloturer(offreId: string) {
    if (!confirm('Clôturer cette offre ?')) return
    setClosingId(offreId)
    await supabase.from('offres_emploi').update({ statut: 'cloturee' }).eq('id', offreId)
    await load()
    setClosingId(null)
  }

  function copyLink(slug: string | null) {
    if (!slug) return
    const parts = slug.split('-')
    const mid = Math.ceil(parts.length / 2)
    const entreprise = parts.slice(0, mid).join('-')
    const poste = parts.slice(mid).join('-')
    navigator.clipboard.writeText(`${APP_URL}/jobs/${entreprise}/${poste}`)
    setCopiedId(slug)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (tl || loading) return <div className="flex justify-center py-24"><Loader2 size={28} className="animate-spin text-[#F59E0B]" /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0F172A]">Offres d&apos;emploi</h1>
          <p className="text-xs text-[#64748B]">{offres.length} offre{offres.length !== 1 ? 's' : ''} au total</p>
        </div>
        <button onClick={() => router.push('/dashboard/rh/recrutement/offres/nouvelle')}
          className="flex items-center gap-2 px-4 py-2 bg-[#F59E0B] text-white rounded-lg text-sm font-bold hover:bg-[#E09000] shadow-sm transition-colors">
          <Plus size={14} /> Nouvelle offre
        </button>
      </div>

      {offres.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center shadow-sm">
          <Briefcase size={32} className="text-[#CBD5E1] mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#64748B]">Aucune offre créée</p>
          <button onClick={() => router.push('/dashboard/rh/recrutement/offres/nouvelle')}
            className="mt-4 px-5 py-2 bg-[#F59E0B] text-white rounded-lg text-xs font-bold hover:bg-[#E09000] transition-colors">
            Créer ma première offre
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                <th className="text-left px-4 py-3 font-semibold text-[#64748B]">Poste</th>
                <th className="text-left px-4 py-3 font-semibold text-[#64748B] hidden md:table-cell">Type</th>
                <th className="text-center px-4 py-3 font-semibold text-[#64748B]">Statut</th>
                <th className="text-center px-4 py-3 font-semibold text-[#64748B]">Candidatures</th>
                <th className="text-center px-4 py-3 font-semibold text-[#64748B] hidden lg:table-cell">Score moy.</th>
                <th className="text-right px-4 py-3 font-semibold text-[#64748B]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {offres.map(o => (
                <tr key={o.id} className="hover:bg-[#FAFAFA] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#0F172A]">{o.titre}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {o.localisation && <span className="flex items-center gap-1 text-[#94A3B8]"><MapPin size={9} />{o.localisation}</span>}
                      {o.date_limite && <span className="flex items-center gap-1 text-[#94A3B8]"><Clock size={9} />Limite : {new Date(o.date_limite).toLocaleDateString('fr-FR')}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-[#64748B]">{o.type_contrat ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUT_COLORS[o.statut] ?? 'bg-gray-100 text-gray-600'}`}>
                      {o.statut === 'active' ? 'Active' : o.statut === 'cloturee' ? 'Clôturée' : 'Brouillon'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-bold text-[#0F172A]">{o.nb}</span>
                  </td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell">
                    {o.scoreMoyen > 0 ? (
                      <span className={`flex items-center justify-center gap-1 text-[10px] font-bold`}>
                        <BarChart2 size={10} className={o.scoreMoyen >= 70 ? 'text-green-600' : o.scoreMoyen >= 50 ? 'text-amber-500' : 'text-red-500'} />
                        {o.scoreMoyen}/100
                      </span>
                    ) : <span className="text-[#CBD5E1]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => router.push(`/dashboard/rh/recrutement/candidatures?offre=${o.id}`)}
                        className="px-2 py-1 text-[10px] font-bold text-[#2563EB] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        TOP 5
                      </button>
                      {o.slug && (
                        <button onClick={() => copyLink(o.slug)} className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors" title="Copier le lien public">
                          {copiedId === o.slug ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                        </button>
                      )}
                      {o.statut === 'active' && (
                        <button onClick={() => cloturer(o.id)} disabled={closingId === o.id}
                          className="px-2 py-1 text-[10px] font-bold text-[#DC2626] bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50">
                          {closingId === o.id ? <Loader2 size={10} className="animate-spin" /> : 'Clôturer'}
                        </button>
                      )}
                      <button onClick={() => router.push(`/dashboard/rh/recrutement/offres/${o.id}`)}
                        className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors">
                        <ChevronDown size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
