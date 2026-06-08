'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Loader2, MapPin } from 'lucide-react'

interface Livraison {
  id: string; items: { nom: string; quantite: number }[]
  total: number; mode_paiement: string; numero_recu: string | null
  client_nom: string | null; client_tel: string | null; adresse_livraison: string | null
  note_client: string | null; livreur_nom: string | null
  statut_livraison: string; heure_depart_livraison: string | null
  heure_livraison_effectuee: string | null; created_at: string
}

const COLS: { key: string; label: string; color: string; bg: string; border: string }[] = [
  { key: 'en_attente',    label: 'Nouvelles',    color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
  { key: 'en_preparation',label: 'En prép.',     color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { key: 'parti',         label: 'En route',     color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { key: 'livre',         label: 'Livrées',      color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { key: 'echec',         label: 'Problèmes',    color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
]

const NEXT: Record<string, { label: string; next: string }> = {
  en_attente:    { label: 'Préparer',    next: 'en_preparation' },
  en_preparation:{ label: 'Partir',      next: 'parti' },
  parti:         { label: '✓ Livré',     next: 'livre' },
}

function fmtTime(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
function fmtNum(n: number) { return new Intl.NumberFormat('fr-FR').format(n) }

export default function LivraisonsPage() {
  const [livraisons, setLivraisons] = useState<Livraison[]>([])
  const [date,       setDate]       = useState(new Date().toISOString().split('T')[0])
  const [loading,    setLoading]    = useState(true)
  const [editLivreur, setEditLivreur] = useState<{ id: string; val: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/resto/livraisons?date=${date}`)
    if (res.ok) { const d = await res.json(); setLivraisons(d.livraisons ?? []) }
    setLoading(false)
  }, [date])

  useEffect(() => { load() }, [load])

  async function advance(id: string, next: string) {
    await fetch('/api/resto/livraisons', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, statut_livraison: next }),
    })
    load()
  }

  async function saveLivreur(id: string, livreur_nom: string) {
    await fetch('/api/resto/livraisons', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, livreur_nom }),
    })
    setEditLivreur(null); load()
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/restaurant" className="flex items-center gap-1 text-[#64748B] text-[13px]"><ArrowLeft size={14} /> Restaurant</Link>
            <span className="text-[#E2E8F0]">/</span>
            <h1 className="text-[16px] font-black text-[#0F172A]">Livraisons</h1>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-3 py-1.5 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]"><RefreshCw size={13} /></button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /> Chargement...</div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          {/* Compteurs */}
          <div className="flex gap-3 mb-5 overflow-x-auto pb-1">
            {COLS.map(c => (
              <div key={c.key} className="shrink-0 bg-white rounded-2xl px-4 py-2 border border-[#E2E8F0] text-center shadow-sm min-w-[90px]">
                <p className="text-[20px] font-black" style={{ color: c.color }}>{livraisons.filter(l => l.statut_livraison === c.key).length}</p>
                <p className="text-[9px] font-bold text-[#64748B] uppercase tracking-wide">{c.label}</p>
              </div>
            ))}
          </div>

          {livraisons.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
              <MapPin size={36} className="text-[#CBD5E1] mx-auto mb-3" />
              <p className="font-bold text-[#0F172A]">Aucune livraison ce jour</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 items-start">
              {COLS.map(col => (
                <div key={col.key}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                    <span className="text-[11px] font-black text-[#0F172A] uppercase tracking-wide">{col.label}</span>
                    <span className="ml-auto text-[11px] font-bold" style={{ color: col.color }}>
                      {livraisons.filter(l => l.statut_livraison === col.key).length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {livraisons.filter(l => l.statut_livraison === col.key).map(l => (
                      <div key={l.id} className="bg-white rounded-2xl border shadow-sm p-3" style={{ borderColor: col.border }}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md">{l.numero_recu ?? l.id.slice(0, 6)}</span>
                          <span className="text-[10px] text-[#94A3B8]">{fmtTime(l.created_at)}</span>
                        </div>
                        <p className="font-bold text-[13px] text-[#0F172A]">{l.client_nom ?? 'Client'}</p>
                        {l.client_tel && <p className="text-[11px] text-[#64748B]">{l.client_tel}</p>}
                        {l.adresse_livraison && (
                          <p className="text-[11px] text-[#475569] mt-1 flex items-start gap-1">
                            <MapPin size={10} className="mt-0.5 shrink-0" /> {l.adresse_livraison}
                          </p>
                        )}
                        <div className="mt-1.5 text-[11px] text-[#64748B]">
                          {(l.items ?? []).slice(0, 2).map((it, i) => (
                            <span key={i}>{it.nom} ×{it.quantite}{i < Math.min(l.items.length - 1, 1) ? ', ' : ''}</span>
                          ))}
                          {l.items?.length > 2 && <span className="text-[#94A3B8]"> +{l.items.length - 2}</span>}
                        </div>
                        <p className="font-bold text-[12px] text-[#0F172A] mt-1">{fmtNum(l.total)} FCFA</p>

                        {/* Livreur */}
                        <div className="mt-2">
                          {editLivreur?.id === l.id ? (
                            <div className="flex gap-1">
                              <input value={editLivreur.val} onChange={e => setEditLivreur({ id: l.id, val: e.target.value })}
                                className="flex-1 px-2 py-1 text-[11px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-300" placeholder="Nom livreur" />
                              <button onClick={() => saveLivreur(l.id, editLivreur.val)}
                                className="px-2 py-1 bg-amber-500 text-white rounded-lg text-[10px] font-bold">OK</button>
                            </div>
                          ) : (
                            <button onClick={() => setEditLivreur({ id: l.id, val: l.livreur_nom ?? '' })}
                              className="text-[10px] text-[#64748B] hover:text-amber-600">
                              {l.livreur_nom ? `🛵 ${l.livreur_nom}` : '+ Assigner livreur'}
                            </button>
                          )}
                        </div>

                        {/* Bouton action */}
                        {NEXT[l.statut_livraison] && (
                          <button onClick={() => advance(l.id, NEXT[l.statut_livraison].next)}
                            className="mt-2 w-full py-1.5 rounded-xl text-[11px] font-bold text-white hover:opacity-90"
                            style={{ background: col.color }}>
                            {NEXT[l.statut_livraison].label}
                          </button>
                        )}
                        {(l.heure_depart_livraison || l.heure_livraison_effectuee) && (
                          <p className="text-[9px] text-[#94A3B8] mt-1">
                            {l.heure_depart_livraison && `Départ: ${fmtTime(l.heure_depart_livraison)}`}
                            {l.heure_livraison_effectuee && ` · Livré: ${fmtTime(l.heure_livraison_effectuee)}`}
                          </p>
                        )}
                      </div>
                    ))}
                    {livraisons.filter(l => l.statut_livraison === col.key).length === 0 && (
                      <div className="rounded-2xl border border-dashed border-[#E2E8F0] p-6 text-center">
                        <p className="text-[11px] text-[#CBD5E1]">Aucune</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
