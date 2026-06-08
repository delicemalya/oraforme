'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, RefreshCw, X, Loader2, BookOpen } from 'lucide-react'

interface FormuleItem { id: string; nom: string; type_item: string; obligatoire: boolean; plat_id: string | null; resto_menu: { nom: string; prix: number; emoji: string | null } | null }
interface Formule { id: string; nom: string; description: string | null; prix: number; disponible: boolean; type_service: string; resto_formule_items: FormuleItem[] }
interface Plat { id: string; nom: string; categorie: string; prix: number; emoji: string | null }

const SERVICE_LABEL: Record<string, string> = { midi: 'Déjeuner', soir: 'Dîner', weekend: 'Week-end', tout: 'Tout service' }
const SERVICE_COLOR: Record<string, string> = { midi: '#F59E0B', soir: '#7C3AED', weekend: '#2563EB', tout: '#16A34A' }
const TYPE_LABEL: Record<string, string> = { entree: 'Entrée', plat: 'Plat', dessert: 'Dessert', boisson: 'Boisson' }
const fmtNum = (n: number) => new Intl.NumberFormat('fr-FR').format(n)

const INIT_FORM = { nom: '', description: '', prix: '', type_service: 'midi', items: [] as { plat_id: string; nom: string; type_item: string; obligatoire: boolean }[] }

export default function FormulesPage() {
  const [formules, setFormules] = useState<Formule[]>([])
  const [plats,    setPlats]    = useState<Plat[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({ ...INIT_FORM })
  const [saving,   setSaving]   = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/resto/formules')
    if (res.ok) { const d = await res.json(); setFormules(d.formules ?? []); setPlats(d.plats ?? []) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await fetch('/api/resto/formules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, prix: Number(form.prix), items: form.items }),
    })
    setSaving(false); setShowForm(false); setForm({ ...INIT_FORM }); load()
  }

  async function toggleDispo(id: string, disponible: boolean) {
    await fetch('/api/resto/formules', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, disponible }),
    })
    load()
  }

  async function del(id: string) {
    await fetch(`/api/resto/formules?id=${id}`, { method: 'DELETE' })
    load()
  }

  function addItem(plat: Plat, type_item: string) {
    if (form.items.find(it => it.plat_id === plat.id)) return
    setForm(p => ({ ...p, items: [...p.items, { plat_id: plat.id, nom: plat.nom, type_item, obligatoire: true }] }))
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/restaurant" className="flex items-center gap-1 text-[#64748B] text-[13px]"><ArrowLeft size={14} /> Restaurant</Link>
            <span className="text-[#E2E8F0]">/</span>
            <h1 className="text-[16px] font-black text-[#0F172A]">Formules & Menus</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]"><RefreshCw size={13} /></button>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-xl text-[12px] font-bold hover:bg-amber-600">
              <Plus size={12} /> Nouvelle formule
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
        {loading ? (
          <div className="flex justify-center py-16 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /> Chargement...</div>
        ) : formules.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <BookOpen size={36} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A]">Aucune formule</p>
            <p className="text-[13px] text-[#64748B] mt-1">Créez des menus du jour ou formules déjeuner/dîner.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {formules.map(f => (
              <div key={f.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${!f.disponible ? 'opacity-50' : ''}`}
                style={{ borderColor: SERVICE_COLOR[f.type_service] + '40' }}>
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: SERVICE_COLOR[f.type_service] + '18', color: SERVICE_COLOR[f.type_service] }}>
                      {SERVICE_LABEL[f.type_service]}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => toggleDispo(f.id, !f.disponible)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${f.disponible ? 'bg-green-100 text-green-700' : 'bg-[#F1F5F9] text-[#94A3B8]'}`}>
                        {f.disponible ? 'Disponible' : 'Indisponible'}
                      </button>
                      <button onClick={() => del(f.id)} className="p-1 text-[#94A3B8] hover:text-[#DC2626]"><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <p className="font-black text-[16px] text-[#0F172A] mt-1">{f.nom}</p>
                  {f.description && <p className="text-[12px] text-[#64748B] mt-0.5">{f.description}</p>}
                  <p className="text-[18px] font-black text-amber-600 mt-2">{fmtNum(f.prix)} FCFA</p>
                </div>
                {f.resto_formule_items?.length > 0 && (
                  <div className="px-4 pb-4 border-t border-[#F1F5F9] pt-3">
                    <div className="space-y-1">
                      {(['entree', 'plat', 'dessert', 'boisson'] as const).map(type => {
                        const items = f.resto_formule_items.filter(it => it.type_item === type)
                        if (!items.length) return null
                        return (
                          <div key={type}>
                            <span className="text-[9px] font-black text-[#94A3B8] uppercase tracking-wide">{TYPE_LABEL[type]}</span>
                            {items.map(it => (
                              <p key={it.id} className="text-[12px] text-[#475569]">
                                {it.resto_menu?.emoji ?? '🍽'} {it.resto_menu?.nom ?? it.nom}
                              </p>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[16px] text-[#0F172A]">Nouvelle formule</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Nom *</label>
                <input required value={form.nom} onChange={e => setForm(p => ({...p, nom: e.target.value}))}
                  placeholder="Formule déjeuner, Menu du soir..."
                  className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Prix FCFA *</label>
                  <input required type="number" min={0} value={form.prix} onChange={e => setForm(p => ({...p, prix: e.target.value}))}
                    className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Service</label>
                  <select value={form.type_service} onChange={e => setForm(p => ({...p, type_service: e.target.value}))}
                    className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
                    {Object.entries(SERVICE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Description</label>
                <input value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))}
                  className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
              </div>

              {/* Plats sélectionnés */}
              {form.items.length > 0 && (
                <div className="bg-amber-50 rounded-xl p-3">
                  <p className="text-[11px] font-bold text-amber-800 mb-2">Plats inclus ({form.items.length})</p>
                  <div className="space-y-1">
                    {form.items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between text-[12px]">
                        <span className="text-[#475569]">{TYPE_LABEL[it.type_item]} — {it.nom}</span>
                        <button type="button" onClick={() => setForm(p => ({ ...p, items: p.items.filter((_, j) => j !== i) }))}
                          className="text-[#DC2626]"><X size={11} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ajouter plats */}
              <div>
                <p className="text-[11px] font-bold text-[#64748B] uppercase mb-2">Ajouter des plats</p>
                {(['entree', 'plat', 'dessert', 'boisson'] as const).map(type => (
                  <div key={type} className="mb-2">
                    <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wide mb-1">{TYPE_LABEL[type]}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {plats.filter(p => {
                        if (type === 'boisson') return p.categorie?.toLowerCase().includes('boisson') || p.categorie?.toLowerCase().includes('drink')
                        if (type === 'entree')  return p.categorie?.toLowerCase().includes('entrée') || p.categorie?.toLowerCase().includes('entree')
                        if (type === 'dessert') return p.categorie?.toLowerCase().includes('dessert')
                        return !form.items.find(it => it.plat_id === p.id)
                      }).slice(0, 8).map(p => (
                        <button type="button" key={p.id} onClick={() => addItem(p, type)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all ${form.items.find(it => it.plat_id === p.id) ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-[#475569] border-[#E2E8F0] hover:border-amber-300'}`}>
                          {p.emoji ? `${p.emoji} ` : ''}{p.nom}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B]">Annuler</button>
                <button type="submit" disabled={saving || !form.nom || !form.prix}
                  className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600 disabled:opacity-50">
                  {saving ? 'Création...' : 'Créer la formule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
