'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, Users, Loader2, Trash2, X, AlertCircle, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

interface Candidat {
  id: string
  nom: string | null
  prenom: string | null
  email: string | null
  score_global: number
  statut: string
  competences: string[] | null
  formation: string | null
  created_at: string
}

interface Offre {
  id: string
  titre: string
  competences_obligatoires: string[] | null
  langues: string[] | null
  experience_min: number
  diplome_requis: string | null
}

export default function CVtheque() {
  const { tenantId, loading } = useTenant()
  const [candidats, setCandidats] = useState<Candidat[]>([])
  const [offres, setOffres] = useState<Offre[]>([])
  const [selectedOffre, setSelectedOffre] = useState('all')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState('')
  const [error, setError] = useState('')
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!tenantId) return
    const [cRes, oRes] = await Promise.all([
      supabase
        .from('candidats')
        .select('id,nom,prenom,email,score_global,statut,competences,formation,created_at')
        .eq('tenant_id', tenantId)
        .order('score_global', { ascending: false }),
      supabase
        .from('offres_emploi')
        .select('id,titre,competences_obligatoires,langues,experience_min,diplome_requis')
        .eq('tenant_id', tenantId)
        .eq('statut', 'active'),
    ])
    setCandidats(cRes.data ?? [])
    setOffres(oRes.data ?? [])
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function handleFile(file: File) {
    if (!tenantId) return
    setUploading(true); setError(''); setProgress(10); setProgressText('Extraction du texte...')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const upRes = await fetch('/api/cv/upload', { method: 'POST', body: fd })
      const upData = await upRes.json()
      if (!upRes.ok) throw new Error(upData.error ?? 'Erreur upload')

      setProgress(45); setProgressText('Analyse IA en cours...')

      const offre = offres.find(o => o.id === selectedOffre)
      const criteres = offre ? {
        niveaux: offre.diplome_requis ? [offre.diplome_requis] : [],
        experience: offre.experience_min,
        langues: offre.langues ?? [],
        mots_cles: offre.competences_obligatoires ?? [],
      } : undefined

      const anaRes = await fetch('/api/cv/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cvText: upData.text,
          criteres,
          offreId: selectedOffre !== 'all' ? selectedOffre : undefined,
          offreTitre: offre?.titre,
          tenantId,
        }),
      })
      const anaData = await anaRes.json()
      if (!anaRes.ok) throw new Error(anaData.error ?? 'Erreur analyse IA')

      setProgress(100); setProgressText('Analyse terminée !')
      setTimeout(() => { setProgress(0); setProgressText('') }, 1500)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setProgress(0); setProgressText('')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce candidat ?')) return
    const { error } = await supabase.from('candidats').delete().eq('id', id)
    if (error) { alert('Erreur suppression : ' + error.message); return }
    load()
  }

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 size={28} className="text-[#F59E0B] animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-[#0F172A]">CVthèque</h1>
        <p className="text-xs text-[#64748B]">{candidats.length} candidat{candidats.length !== 1 ? 's' : ''} analysé{candidats.length !== 1 ? 's' : ''} par l&apos;IA</p>
      </div>

      {/* Upload zone */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div>
            <label className="text-xs font-semibold text-[#64748B] mb-1.5 block">Scorer contre l&apos;offre</label>
            <div className="relative">
              <select value={selectedOffre} onChange={e => setSelectedOffre(e.target.value)}
                className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] outline-none appearance-none pr-8 min-w-[200px]">
                <option value="all">Analyse générale</option>
                {offres.map(o => <option key={o.id} value={o.id}>{o.titre}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
            </div>
          </div>
        </div>

        <div
          onDragOver={e => { e.preventDefault(); !uploading && setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f && !uploading) handleFile(f) }}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all select-none ${
            uploading ? 'opacity-50 cursor-not-allowed border-[#E2E8F0]' :
            drag ? 'border-[#F59E0B] bg-[#FEF3C7]/30' :
            'border-[#E2E8F0] hover:border-[#F59E0B]/50 hover:bg-[#FEF3C7]/10'
          }`}
        >
          <Upload size={28} className={`mx-auto mb-3 ${drag ? 'text-[#F59E0B]' : 'text-[#94A3B8]'}`} />
          <p className="text-sm font-medium text-[#64748B]">
            {uploading ? 'Analyse en cours...' : 'Glissez un CV ici ou cliquez pour parcourir'}
          </p>
          <p className="text-xs text-[#94A3B8] mt-1">PDF, DOCX ou TXT — analyse IA automatique</p>
          <input ref={inputRef} type="file" accept=".pdf,.docx,.txt" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); if (inputRef.current) inputRef.current.value = '' }} />
        </div>

        {progress > 0 && (
          <div>
            <div className="flex justify-between text-xs text-[#64748B] mb-1.5">
              <span>{progressText}</span><span className="font-semibold">{progress}%</span>
            </div>
            <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#F59E0B] rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle size={13} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-600 flex-1">{error}</p>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 transition-colors">
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Candidats list */}
      {candidats.length === 0 ? (
        <div className="text-center py-12 text-[#94A3B8]">
          <Users size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucun candidat dans la CVthèque.</p>
          <p className="text-xs mt-1">Déposez des CVs ci-dessus pour démarrer l&apos;analyse IA.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  {['Candidat', 'Score IA', 'Formation', 'Compétences clés', 'Statut', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {candidats.map(c => {
                  const nom = [c.prenom, c.nom].filter(Boolean).join(' ') || c.email || 'Inconnu'
                  const sc = c.score_global ?? 0
                  const scoreColor = sc >= 70 ? '#16A34A' : sc >= 50 ? '#F59E0B' : '#DC2626'
                  return (
                    <tr key={c.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                            style={{ background: `${scoreColor}20`, color: scoreColor }}
                          >
                            {nom.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[#0F172A]">{nom}</p>
                            {c.email && <p className="text-[10px] text-[#94A3B8] truncate max-w-[140px]">{c.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full w-fit"
                            style={{ color: scoreColor, background: `${scoreColor}18` }}>
                            {sc}/100
                          </span>
                          <div className="w-16 h-1 bg-[#F1F5F9] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${sc}%`, background: scoreColor }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#64748B]">{c.formation ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.competences?.slice(0, 3).map((comp, i) => (
                            <span key={i} className="text-[10px] text-[#64748B] border border-[#E2E8F0] rounded px-1.5 py-0.5 whitespace-nowrap">{comp}</span>
                          ))}
                          {(c.competences?.length ?? 0) > 3 && (
                            <span className="text-[10px] text-[#94A3B8]">+{(c.competences?.length ?? 0) - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B]">
                          {c.statut}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(c.id)} className="text-[#CBD5E1] hover:text-[#DC2626] transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
