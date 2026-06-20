'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useFmt } from '@/lib/hooks/useFmt'
import { Plus, X, Pencil, Trash2, Settings2, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/* ─── Types ──────────────────────────────────────────────── */
type Categorie =
  | 'imposable' | 'non_imposable' | 'avantage_nature'
  | 'retenue' | 'bonus' | 'commission' | 'prime_exceptionnelle'

type ModeCalcul = 'fixe' | 'pourcentage_salaire' | 'pourcentage_ca'

interface ElementPaie {
  id: string
  code: string
  libelle: string
  categorie: Categorie
  mode_calcul: ModeCalcul
  valeur: number
  plafond: number | null
  pays: string
  actif: boolean
  created_at: string
}

/* ─── Config catégories ──────────────────────────────────── */
const CAT_CONFIG: Record<Categorie, { label: string; color: string; bg: string; desc: string }> = {
  imposable:           { label: 'Imposable',           color: '#F59E0B', bg: '#FEF3C7', desc: 'Soumis CNSS + IRPP' },
  non_imposable:       { label: 'Non-imposable',       color: '#10B981', bg: '#D1FAE5', desc: 'Exonéré (transport, repas…)' },
  avantage_nature:     { label: 'Avantage en nature',  color: '#2563EB', bg: '#DBEAFE', desc: 'Voiture, logement, téléphone' },
  retenue:             { label: 'Retenue',             color: '#DC2626', bg: '#FEE2E2', desc: 'Avance, saisie sur salaire' },
  bonus:               { label: 'Bonus',               color: '#7C3AED', bg: '#EDE9FE', desc: 'One-shot imposable' },
  commission:          { label: 'Commission',          color: '#0891B2', bg: '#CFFAFE', desc: 'Pourcentage CA' },
  prime_exceptionnelle:{ label: 'Prime exceptionnelle',color: '#D97706', bg: '#FEF3C7', desc: 'Ponctuelle non récurrente' },
}

const MODES: Record<ModeCalcul, string> = {
  fixe: 'Montant fixe (FCFA)',
  pourcentage_salaire: '% du salaire de base',
  pourcentage_ca: '% du chiffre d\'affaires',
}

const PAYS_LIST = [
  { code: 'CG', label: 'Congo-Brazzaville' },
  { code: 'CD', label: 'RD Congo' },
  { code: 'CM', label: 'Cameroun' },
  { code: 'GA', label: 'Gabon' },
  { code: 'CF', label: 'Centrafrique' },
  { code: 'TD', label: 'Tchad' },
  { code: 'GQ', label: 'Guinée Équatoriale' },
]

const iCls = 'w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[13px] text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/40 focus:border-[#F59E0B]'
const lCls = 'block text-[11px] font-bold uppercase tracking-wide text-[#64748B] mb-1'

/* ─── Composant principal ────────────────────────────────── */
export default function ElementsPaiePage() {
  const { tenantId } = useTenant()
  const { fmt } = useFmt()

  const [elements, setElements] = useState<ElementPaie[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ElementPaie | null>(null)
  const [saving, setSaving] = useState(false)
  const [filterCat, setFilterCat] = useState<Categorie | 'all'>('all')

  const emptyForm = {
    code: '', libelle: '', categorie: 'imposable' as Categorie,
    mode_calcul: 'fixe' as ModeCalcul, valeur: 0, plafond: '', pays: 'CG', actif: true,
  }
  const [form, setForm] = useState(emptyForm)

  /* ── Chargement ── */
  async function load() {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase
      .from('elements_paie')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('categorie')
      .order('libelle')
    setElements(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [tenantId])

  /* ── Ouvrir édition ── */
  function openEdit(el: ElementPaie) {
    setEditing(el)
    setForm({
      code: el.code, libelle: el.libelle, categorie: el.categorie,
      mode_calcul: el.mode_calcul, valeur: el.valeur,
      plafond: el.plafond ? String(el.plafond) : '',
      pays: el.pays, actif: el.actif,
    })
    setShowForm(true)
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  /* ── Sauvegarde ── */
  async function handleSave() {
    if (!form.code.trim() || !form.libelle.trim()) return
    setSaving(true)
    const payload = {
      tenant_id:   tenantId,
      code:        form.code.toUpperCase().replace(/\s+/g, '_'),
      libelle:     form.libelle,
      categorie:   form.categorie,
      mode_calcul: form.mode_calcul,
      valeur:      Number(form.valeur) || 0,
      plafond:     form.plafond ? Number(form.plafond) : null,
      pays:        form.pays,
      actif:       form.actif,
    }

    if (editing) {
      await supabase.from('elements_paie').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('elements_paie').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    load()
  }

  /* ── Suppression ── */
  async function handleDelete(id: string) {
    if (!confirm('Supprimer cet élément ? Il ne sera plus disponible dans les bulletins.')) return
    await supabase.from('elements_paie').delete().eq('id', id)
    load()
  }

  /* ── Toggle actif ── */
  async function toggleActif(el: ElementPaie) {
    await supabase.from('elements_paie').update({ actif: !el.actif }).eq('id', el.id)
    setElements(prev => prev.map(e => e.id === el.id ? { ...e, actif: !e.actif } : e))
  }

  const filtered = filterCat === 'all' ? elements : elements.filter(e => e.categorie === filterCat)

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings2 size={20} className="text-[#F59E0B]" />
            <h1 className="text-[18px] font-bold text-[#1E293B]">Éléments de Paie</h1>
          </div>
          <p className="text-[12px] text-[#64748B]">
            Primes, indemnités, retenues — configurez les composantes salariales de votre entreprise
          </p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-[#F59E0B] text-white text-[13px] font-bold px-4 py-2 rounded-xl hover:bg-[#D97706] transition-colors">
          <Plus size={16} /> Nouvel élément
        </button>
      </div>

      {/* Note LF2026 */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3 mb-6 text-[12px] text-blue-800">
        <AlertCircle size={15} className="mt-0.5 shrink-0 text-blue-500" />
        <div>
          <strong>Congo LF 2026 :</strong> Primes imposables soumises CNSS 4% + IRPP par tranches.
          Indemnités non-imposables (transport ≤ 30 000 F, repas ≤ 15 000 F/j) exonérées.
          TOL = 1 000 FCFA fixe. Plafond CNSS vieillesse = 1 200 000 FCFA/mois.
        </div>
      </div>

      {/* Filtres catégorie */}
      <div className="flex gap-2 flex-wrap mb-5">
        <button onClick={() => setFilterCat('all')}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${filterCat === 'all' ? 'bg-[#1E293B] text-white border-[#1E293B]' : 'bg-white text-[#64748B] border-[#E2E8F0] hover:border-[#94A3B8]'}`}>
          Tous ({elements.length})
        </button>
        {(Object.entries(CAT_CONFIG) as [Categorie, typeof CAT_CONFIG[Categorie]][]).map(([cat, cfg]) => {
          const count = elements.filter(e => e.categorie === cat).length
          if (count === 0) return null
          return (
            <button key={cat} onClick={() => setFilterCat(cat)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${filterCat === cat ? 'text-white border-transparent' : 'bg-white border-[#E2E8F0] hover:border-[#94A3B8]'}`}
              style={filterCat === cat ? { background: cfg.color, borderColor: cfg.color, color: '#fff' } : { color: cfg.color }}>
              {cfg.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-16 text-[#64748B] text-[13px]">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Settings2 size={40} className="mx-auto text-[#CBD5E1] mb-3" />
          <p className="text-[13px] text-[#64748B]">Aucun élément de paie configuré</p>
          <button onClick={openCreate}
            className="mt-4 px-4 py-2 bg-[#F59E0B] text-white text-[12px] font-bold rounded-xl hover:bg-[#D97706]">
            Créer le premier
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(el => {
            const cfg = CAT_CONFIG[el.categorie]
            return (
              <div key={el.id}
                className={`bg-white border rounded-xl p-4 flex items-center gap-4 transition-opacity ${el.actif ? 'opacity-100' : 'opacity-50'}`}
                style={{ borderColor: el.actif ? cfg.color + '40' : '#E2E8F0' }}>

                {/* Badge catégorie */}
                <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-bold text-center leading-tight"
                  style={{ background: cfg.bg, color: cfg.color }}>
                  {cfg.label.substring(0, 3).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[13px] text-[#1E293B] truncate">{el.libelle}</span>
                    <span className="text-[10px] font-mono text-[#94A3B8] bg-[#F1F5F9] px-1.5 py-0.5 rounded shrink-0">{el.code}</span>
                    {!el.actif && <span className="text-[10px] text-[#94A3B8] shrink-0">Désactivé</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px]" style={{ color: cfg.color }}>{cfg.label}</span>
                    <span className="text-[11px] text-[#64748B]">
                      {el.mode_calcul === 'fixe'
                        ? `${fmt(el.valeur)} FCFA`
                        : `${el.valeur}% ${el.mode_calcul === 'pourcentage_salaire' ? 'salaire' : 'CA'}`}
                    </span>
                    {el.plafond && (
                      <span className="text-[11px] text-[#94A3B8]">plaf. {fmt(el.plafond)} F</span>
                    )}
                    <span className="text-[11px] text-[#94A3B8]">{el.pays}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleActif(el)}
                    className={`text-[11px] font-bold px-2 py-1 rounded-lg border transition-colors ${el.actif ? 'text-[#10B981] border-[#10B981]/30 hover:bg-[#D1FAE5]' : 'text-[#94A3B8] border-[#E2E8F0] hover:bg-[#F1F5F9]'}`}>
                    {el.actif ? 'Actif' : 'Inactif'}
                  </button>
                  <button onClick={() => openEdit(el)}
                    className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B]">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(el.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-[#DC2626]">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal création/édition */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)} />
            <motion.div className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[480px] bg-white rounded-2xl shadow-2xl z-50 overflow-hidden"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>

              {/* Header modal */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
                <div>
                  <h2 className="font-bold text-[15px] text-[#1E293B]">
                    {editing ? 'Modifier l\'élément' : 'Nouvel élément de paie'}
                  </h2>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {editing ? editing.libelle : 'Configurer une prime, indemnité ou retenue'}
                  </p>
                </div>
                <button onClick={() => setShowForm(false)}><X size={18} className="text-[#64748B]" /></button>
              </div>

              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">

                {/* Catégorie — sélection visuelle */}
                <div>
                  <label className={lCls}>Catégorie</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(CAT_CONFIG) as [Categorie, typeof CAT_CONFIG[Categorie]][]).map(([cat, cfg]) => (
                      <button key={cat} type="button"
                        onClick={() => setForm(p => ({ ...p, categorie: cat }))}
                        className={`text-left px-3 py-2 rounded-xl border text-[11px] font-bold transition-all ${form.categorie === cat ? 'border-2' : 'border hover:border-[#CBD5E1]'}`}
                        style={form.categorie === cat
                          ? { borderColor: cfg.color, background: cfg.bg, color: cfg.color }
                          : { borderColor: '#E2E8F0', color: '#64748B' }}>
                        <div>{cfg.label}</div>
                        <div className="font-normal text-[10px] mt-0.5 opacity-70">{cfg.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Code + Libellé */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lCls}>Code unique</label>
                    <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                      placeholder="PRIME_ANCIENNETE" className={iCls} />
                    <p className="text-[10px] text-[#94A3B8] mt-1">Automatiquement en majuscules</p>
                  </div>
                  <div>
                    <label className={lCls}>Libellé</label>
                    <input value={form.libelle} onChange={e => setForm(p => ({ ...p, libelle: e.target.value }))}
                      placeholder="Prime d'ancienneté" className={iCls} />
                  </div>
                </div>

                {/* Mode calcul + Valeur */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lCls}>Mode de calcul</label>
                    <select value={form.mode_calcul} onChange={e => setForm(p => ({ ...p, mode_calcul: e.target.value as ModeCalcul }))}
                      className={iCls}>
                      {(Object.entries(MODES) as [ModeCalcul, string][]).map(([m, l]) => (
                        <option key={m} value={m}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={lCls}>
                      {form.mode_calcul === 'fixe' ? 'Montant (FCFA)' : 'Taux (%)'}
                    </label>
                    <input type="number" min="0" value={form.valeur}
                      onChange={e => setForm(p => ({ ...p, valeur: Number(e.target.value) }))}
                      placeholder="0" className={iCls} />
                  </div>
                </div>

                {/* Plafond + Pays */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lCls}>Plafond mensuel (optionnel)</label>
                    <input type="number" min="0" value={form.plafond}
                      onChange={e => setForm(p => ({ ...p, plafond: e.target.value }))}
                      placeholder="Sans plafond" className={iCls} />
                  </div>
                  <div>
                    <label className={lCls}>Pays applicable</label>
                    <select value={form.pays} onChange={e => setForm(p => ({ ...p, pays: e.target.value }))}
                      className={iCls}>
                      {PAYS_LIST.map(p => (
                        <option key={p.code} value={p.code}>{p.code} — {p.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Actif toggle */}
                <div className="flex items-center gap-3 pt-1">
                  <button type="button" onClick={() => setForm(p => ({ ...p, actif: !p.actif }))}
                    className={`relative w-10 h-5 rounded-full transition-colors ${form.actif ? 'bg-[#10B981]' : 'bg-[#CBD5E1]'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.actif ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-[12px] text-[#64748B]">
                    {form.actif ? 'Actif — disponible dans les bulletins' : 'Inactif — masqué dans les bulletins'}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 px-5 py-4 border-t border-[#F1F5F9]">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-xl border border-[#E2E8F0] text-[13px] text-[#64748B] hover:bg-[#F8FAFC]">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving || !form.code.trim() || !form.libelle.trim()}
                  className="flex-1 py-2 rounded-xl bg-[#F59E0B] text-white text-[13px] font-bold hover:bg-[#D97706] disabled:opacity-50 transition-colors">
                  {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer l\'élément'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
