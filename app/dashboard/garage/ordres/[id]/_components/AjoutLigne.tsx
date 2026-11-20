'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { prixUnitaireHTDepuisTTC, type TypeLigne } from '@/lib/garage/ordres'
import { INPUT_CLS, LABEL_CLS } from '../../../_lib/ui'

export type Piece = { id: string; nom: string; sku: string | null; prix_vente: number | null }

const INIT = { type: 'main_oeuvre' as TypeLigne, product_id: '', description: '', quantite: '1', prix_unitaire: '' }

/** Formulaire d'ajout d'une ligne d'OR : pièce du stock ou main-d'œuvre (prix HT). */
export default function AjoutLigne({ ordreId, pieces, onAjout }: {
  ordreId: string
  pieces: Piece[]
  onAjout: () => void
}) {
  const [form,   setForm]   = useState(INIT)
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  function choisirPiece(id: string) {
    const p = pieces.find(x => x.id === id)
    setForm(f => ({
      ...f, product_id: id,
      description: p?.nom ?? '',
      prix_unitaire: p ? String(prixUnitaireHTDepuisTTC(Number(p.prix_vente ?? 0))) : '',
    }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErreur(null)
    const res = await fetch(`/api/garage/ordres/${ordreId}/lignes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, product_id: form.type === 'piece' ? form.product_id : null }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setErreur(json.error ?? 'Ajout impossible'); return }
    setForm({ ...INIT, type: form.type }); onAjout()
  }

  return (
    <form onSubmit={submit} className="mt-4 border-t border-[#F1F5F9] pt-4 space-y-3">
      <div className="flex gap-2">
        {(['main_oeuvre', 'piece'] as const).map(t => (
          <button key={t} type="button" onClick={() => setForm({ ...INIT, type: t })}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold ${form.type === t ? 'bg-amber-500 text-white' : 'bg-[#F1F5F9] text-[#475569]'}`}>
            {t === 'piece' ? 'Pièce du stock' : 'Main-d\'œuvre'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {form.type === 'piece' ? (
          <div className="sm:col-span-2">
            <label className={LABEL_CLS}>Pièce *</label>
            <select required value={form.product_id} onChange={e => choisirPiece(e.target.value)} className={INPUT_CLS}>
              <option value="">— Choisir dans le stock —</option>
              {pieces.map(p => <option key={p.id} value={p.id}>{p.nom}{p.sku ? ` (${p.sku})` : ''}</option>)}
            </select>
          </div>
        ) : (
          <div className="sm:col-span-2">
            <label className={LABEL_CLS}>Travail effectué *</label>
            <input required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Remplacement plaquettes avant" className={INPUT_CLS} />
          </div>
        )}
        <div>
          <label className={LABEL_CLS}>{form.type === 'piece' ? 'Quantité' : 'Heures'}</label>
          <input required type="number" min="0.001" step="0.001" value={form.quantite}
            onChange={e => setForm(f => ({ ...f, quantite: e.target.value }))} className={INPUT_CLS} />
        </div>
        <div>
          <label className={LABEL_CLS}>{form.type === 'piece' ? 'Prix unitaire HT' : 'Taux horaire HT'}</label>
          <input required type="number" min="0" step="1" value={form.prix_unitaire}
            onChange={e => setForm(f => ({ ...f, prix_unitaire: e.target.value }))} className={INPUT_CLS} />
        </div>
      </div>
      {erreur && <p className="text-[12px] text-[#DC2626]">{erreur}</p>}
      <button type="submit" disabled={saving}
        className="flex items-center gap-1.5 px-3 py-2 bg-[#0F172A] text-white rounded-xl text-[12px] font-bold hover:bg-[#1E293B] disabled:opacity-50">
        <Plus size={12} /> {saving ? 'Ajout...' : 'Ajouter la ligne'}
      </button>
    </form>
  )
}
