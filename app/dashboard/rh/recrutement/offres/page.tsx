'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Briefcase, Loader2, Trash2, Eye, MapPin, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

interface Offre {
  id: string
  titre: string
  departement: string | null
  localisation: string | null
  type_contrat: string | null
  nombre_postes: number
  date_limite: string | null
  statut: string
  created_at: string
}

export default function OffresPage() {
  const { tenantId, loading } = useTenant()
  const [offres, setOffres] = useState<Offre[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoadingData(true)
    const { data } = await supabase
      .from('offres_emploi')
      .select('id,titre,departement,localisation,type_contrat,nombre_postes,date_limite,statut,created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    setOffres(data ?? [])
    setLoadingData(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette offre ? Les candidatures associées seront aussi supprimées.')) return
    const { error } = await supabase.from('offres_emploi').delete().eq('id', id)
    if (error) { alert('Erreur suppression : ' + error.message); return }
    load()
  }

  async function toggleStatut(id: string, current: string) {
    const next = current === 'active' ? 'cloturee' : 'active'
    const { error } = await supabase.from('offres_emploi').update({ statut: next }).eq('id', id)
    if (error) { alert('Erreur mise à jour : ' + error.message); return }
    load()
  }

  if (loading || loadingData) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={28} className="text-[#F59E0B] animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0F172A]">Offres d&apos;emploi</h1>
          <p className="text-xs text-[#64748B]">{offres.length} offre{offres.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/dashboard/rh/recrutement/offres/nouvelle"
          className="flex items-center gap-2 px-4 py-2 bg-[#F59E0B] text-white rounded-lg text-xs font-bold hover:bg-[#E09000] transition-colors"
        >
          <Plus size={13} /> Nouvelle offre
        </Link>
      </div>

      {offres.length === 0 ? (
        <div className="text-center py-16 text-[#64748B]">
          <Briefcase size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucune offre. Créez votre première offre d&apos;emploi.</p>
          <Link
            href="/dashboard/rh/recrutement/offres/nouvelle"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-[#F59E0B] text-white rounded-lg text-xs font-bold hover:bg-[#E09000] transition-colors"
          >
            <Plus size={13} /> Créer une offre
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  {['Intitulé', 'Département', 'Lieu', 'Contrat', 'Postes', 'Limite', 'Statut', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {offres.map(o => (
                  <tr key={o.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-[#0F172A]">{o.titre}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#64748B]">{o.departement ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-[#64748B]">
                      {o.localisation
                        ? <span className="flex items-center gap-1"><MapPin size={10} />{o.localisation}</span>
                        : '—'
                      }
                    </td>
                    <td className="px-4 py-3 text-xs text-[#64748B]">{o.type_contrat ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-[#64748B] text-center">{o.nombre_postes}</td>
                    <td className="px-4 py-3 text-xs text-[#64748B] whitespace-nowrap">
                      {o.date_limite
                        ? <span className="flex items-center gap-1"><Clock size={10} />{new Date(o.date_limite).toLocaleDateString('fr-FR')}</span>
                        : '—'
                      }
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleStatut(o.id, o.statut)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors"
                        style={o.statut === 'active'
                          ? { color: '#16A34A', background: '#16A34A18' }
                          : { color: '#94A3B8', background: '#F1F5F9' }
                        }
                      >
                        {o.statut === 'active' ? 'Active' : 'Clôturée'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/rh/recrutement/candidatures?offre=${o.id}`}
                          className="text-[#94A3B8] hover:text-[#2563EB] transition-colors"
                          title="Voir les candidatures"
                        >
                          <Eye size={13} />
                        </Link>
                        <button onClick={() => handleDelete(o.id)} className="text-[#94A3B8] hover:text-[#DC2626] transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
