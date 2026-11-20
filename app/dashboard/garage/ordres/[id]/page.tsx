'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Trash2, FileText, Car } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { lignesModifiables, type StatutOrdre, type TypeLigne } from '@/lib/garage/ordres'
import { STATUT_CFG, fcfa, INPUT_CLS, LABEL_CLS } from '../../_lib/ui'
import AjoutLigne, { type Piece } from './_components/AjoutLigne'

interface Ligne { id: string; type: TypeLigne; description: string; quantite: number; prix_unitaire: number }
interface Ordre {
  id: string; numero: string; statut: StatutOrdre; date_entree: string; date_sortie_prevue: string | null
  kilometrage_entree: number | null; symptomes: string | null; diagnostic: string | null
  mecanicien_id: string | null; facture_id: string | null
  garage_vehicules: { immatriculation: string; marque: string | null; modele: string | null; proprietaire_nom: string; proprietaire_telephone: string | null } | null
  lignes: Ligne[]
  totaux: { ht: number; tva: number; ca: number; ttc: number }
}

/** Actions de statut proposées selon l'état (la facturation a son propre bouton). */
const ACTIONS: Partial<Record<StatutOrdre, { vers: StatutOrdre; label: string; cls: string }[]>> = {
  ouvert:   [{ vers: 'en_cours', label: 'Démarrer les travaux', cls: 'bg-amber-500 text-white hover:bg-amber-600' },
             { vers: 'annule',   label: 'Annuler l\'OR',        cls: 'bg-[#F1F5F9] text-[#64748B]' }],
  en_cours: [{ vers: 'termine',  label: 'Travaux terminés',     cls: 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]' },
             { vers: 'annule',   label: 'Annuler l\'OR',        cls: 'bg-[#F1F5F9] text-[#64748B]' }],
  termine:  [{ vers: 'en_cours', label: 'Rouvrir',              cls: 'bg-[#F1F5F9] text-[#475569]' }],
  facture:  [{ vers: 'livre',    label: 'Véhicule livré',       cls: 'bg-[#16A34A] text-white hover:bg-[#15803D]' }],
}

export default function OrdreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { tenant } = useTenantContext()
  const tid = tenant?.tenantId

  const [ordre,      setOrdre]      = useState<Ordre | null>(null)
  const [pieces,     setPieces]     = useState<Piece[]>([])
  const [mecaniciens,setMecaniciens]= useState<{ id: string; nom: string; prenom: string | null }[]>([])
  const [loading,    setLoading]    = useState(true)
  const [busy,       setBusy]       = useState(false)
  const [erreur,     setErreur]     = useState<string | null>(null)
  const [diagnostic, setDiagnostic] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/garage/ordres/${id}`)
    const json = await res.json().catch(() => ({}))
    if (res.ok) { setOrdre(json.data); setDiagnostic(json.data.diagnostic ?? '') } else setErreur(json.error ?? 'Ordre introuvable')
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!tid) return
    supabase.from('products').select('id, nom, sku, prix_vente').eq('tenant_id', tid).order('nom').limit(500)
      .then(({ data }) => setPieces((data as Piece[]) ?? []))
    supabase.from('employes').select('id, nom, prenom').eq('tenant_id', tid).order('nom').limit(200)
      .then(({ data }) => setMecaniciens(data ?? []))
  }, [tid])

  async function patch(payload: Record<string, unknown>) {
    setBusy(true); setErreur(null)
    const res = await fetch(`/api/garage/ordres/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) setErreur(json.error ?? 'Mise à jour impossible')
    load()
  }

  async function supprimerLigne(ligneId: string) {
    setBusy(true); setErreur(null)
    const res = await fetch(`/api/garage/ordres/${id}/lignes?ligne_id=${ligneId}`, { method: 'DELETE' })
    if (!res.ok) setErreur((await res.json().catch(() => ({}))).error ?? 'Suppression impossible')
    setBusy(false); load()
  }

  async function facturer() {
    if (!ordre || !confirm(`Facturer ${fcfa(ordre.totaux.ttc)} TTC ? Les pièces seront sorties du stock.`)) return
    setBusy(true); setErreur(null)
    const res = await fetch(`/api/garage/ordres/${id}/facturer`, { method: 'POST' })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) setErreur(json.error ?? 'Facturation impossible')
    load()
  }

  if (loading) return <div className="flex justify-center py-24 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /> Chargement...</div>
  if (!ordre) return <div className="max-w-3xl mx-auto p-8 text-center text-[#DC2626]">{erreur ?? 'Ordre introuvable'}</div>

  const sc = STATUT_CFG[ordre.statut]
  const v = ordre.garage_vehicules
  const modifiable = lignesModifiables(ordre.statut)

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/garage" className="flex items-center gap-1 text-[#64748B] hover:text-[#0F172A] text-[13px]"><ArrowLeft size={14} /> Atelier</Link>
            <span className="text-[#E2E8F0]">/</span>
            <h1 className="text-[16px] font-black text-[#0F172A]">{ordre.numero}</h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(ACTIONS[ordre.statut] ?? []).map(a => (
              <button key={a.vers} disabled={busy} onClick={() => patch({ statut: a.vers })}
                className={`px-3 py-2 rounded-xl text-[12px] font-bold disabled:opacity-50 ${a.cls}`}>{a.label}</button>
            ))}
            {ordre.statut === 'termine' && (
              <button disabled={busy || ordre.lignes.length === 0} onClick={facturer}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#16A34A] text-white rounded-xl text-[12px] font-bold hover:bg-[#15803D] disabled:opacity-50">
                <FileText size={12} /> Facturer
              </button>
            )}
            {ordre.facture_id && (
              <Link href={`/dashboard/factures/${ordre.facture_id}/preview`}
                className="flex items-center gap-1.5 px-3 py-2 border border-[#E2E8F0] rounded-xl text-[12px] font-bold text-[#475569] hover:bg-[#F8FAFC]">
                <FileText size={12} /> Voir la facture
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {erreur && <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-[13px] rounded-xl px-4 py-3">{erreur}</div>}

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2"><Car size={14} className="text-amber-500" /><span className={LABEL_CLS}>Véhicule</span></div>
            {v && <>
              <span className="text-[12px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg">{v.immatriculation}</span>
              <p className="mt-2 font-bold text-[14px] text-[#0F172A]">{[v.marque, v.modele].filter(Boolean).join(' ') || 'Véhicule'}</p>
              <p className="text-[12px] text-[#475569]">{v.proprietaire_nom}{v.proprietaire_telephone ? ` · ${v.proprietaire_telephone}` : ''}</p>
            </>}
            <p className="text-[11px] text-[#94A3B8] mt-2">
              Entrée le {new Date(ordre.date_entree).toLocaleDateString('fr-FR')}
              {ordre.kilometrage_entree != null ? ` · ${new Intl.NumberFormat('fr-FR').format(ordre.kilometrage_entree)} km` : ''}
              {ordre.date_sortie_prevue ? ` · sortie prévue ${new Date(ordre.date_sortie_prevue).toLocaleDateString('fr-FR')}` : ''}
            </p>
            {ordre.symptomes && <p className="text-[12px] text-[#475569] mt-2"><b>Demande :</b> {ordre.symptomes}</p>}
          </div>

          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4 space-y-3">
            <div>
              <label className={LABEL_CLS}>Mécanicien</label>
              <select value={ordre.mecanicien_id ?? ''} disabled={busy || !modifiable}
                onChange={e => patch({ mecanicien_id: e.target.value || null })} className={INPUT_CLS}>
                <option value="">— Non assigné —</option>
                {mecaniciens.map(m => <option key={m.id} value={m.id}>{[m.prenom, m.nom].filter(Boolean).join(' ')}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>Diagnostic</label>
              <textarea rows={3} value={diagnostic} disabled={!modifiable} onChange={e => setDiagnostic(e.target.value)}
                onBlur={() => diagnostic !== (ordre.diagnostic ?? '') && patch({ diagnostic })}
                className={`${INPUT_CLS} resize-none`} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4">
          <h2 className="font-bold text-[14px] text-[#0F172A] mb-3">Pièces et main-d&apos;œuvre</h2>
          {ordre.lignes.length === 0 ? (
            <p className="text-[12px] text-[#94A3B8]">Aucune ligne pour l&apos;instant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead><tr className="text-left text-[#64748B] border-b border-[#F1F5F9]">
                  <th className="py-2">Désignation</th><th className="py-2 text-right">Qté</th>
                  <th className="py-2 text-right">PU HT</th><th className="py-2 text-right">Total HT</th><th />
                </tr></thead>
                <tbody>
                  {ordre.lignes.map(l => (
                    <tr key={l.id} className="border-b border-[#F8FAFC]">
                      <td className="py-2"><span className="text-[10px] font-bold uppercase text-[#94A3B8] mr-2">{l.type === 'piece' ? 'Pièce' : 'MO'}</span>{l.description}</td>
                      <td className="py-2 text-right">{Number(l.quantite)}</td>
                      <td className="py-2 text-right">{fcfa(l.prix_unitaire)}</td>
                      <td className="py-2 text-right font-semibold">{fcfa(Number(l.quantite) * Number(l.prix_unitaire))}</td>
                      <td className="py-2 text-right">
                        {modifiable && <button aria-label="Supprimer la ligne" disabled={busy} onClick={() => supprimerLigne(l.id)}
                          className="p-1 text-[#94A3B8] hover:text-[#DC2626]"><Trash2 size={13} /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 ml-auto max-w-xs space-y-1 text-[12px]">
            <div className="flex justify-between"><span className="text-[#64748B]">Total HT</span><span>{fcfa(ordre.totaux.ht)}</span></div>
            <div className="flex justify-between"><span className="text-[#64748B]">TVA</span><span>{fcfa(ordre.totaux.tva)}</span></div>
            <div className="flex justify-between"><span className="text-[#64748B]">Centime additionnel</span><span>{fcfa(ordre.totaux.ca)}</span></div>
            <div className="flex justify-between font-black text-[14px] text-[#0F172A] pt-1 border-t border-[#F1F5F9]"><span>Total TTC</span><span>{fcfa(ordre.totaux.ttc)}</span></div>
          </div>

          {modifiable && <AjoutLigne ordreId={ordre.id} pieces={pieces} onAjout={load} />}
        </div>
      </div>
    </div>
  )
}
