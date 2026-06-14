'use client'

import { useState, useEffect, useCallback } from 'react'
import { useFmt } from '@/lib/hooks/useFmt'
import Link from 'next/link'
import { Zap, Plus, RefreshCw, Loader2, X, CheckCircle, TrendingUp } from 'lucide-react'

interface Site { id: string; nom: string; unite_production: string }
interface Production {
  id: string; site_id: string; date_production: string; quantite: number
  unite: string; type_hydrocarbure: string; prix_unitaire: number | null; notes: string | null
  petrole_sites?: { nom: string; unite_production: string }
}

const TYPE_HC: Record<string, { label: string; color: string }> = {
  brut:     { label: 'Pétrole brut',  color: '#0F172A' },
  gaz:      { label: 'Gaz naturel',   color: '#2563EB' },
  condensat:{ label: 'Condensat',     color: '#7C3AED' },
  raffine:  { label: 'Raffiné',       color: '#16A34A' },
  autre:    { label: 'Autre',         color: '#64748B' },
}

function ModalProduction({ sites, prod, onClose, onSaved }: { sites: Site[]; prod: Production | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    site_id:           prod?.site_id              ?? (sites[0]?.id ?? ''),
    date_production:   prod?.date_production       ?? new Date().toISOString().split('T')[0],
    quantite:          prod?.quantite?.toString()  ?? '',
    unite:             prod?.unite                 ?? 'barils',
    type_hydrocarbure: prod?.type_hydrocarbure     ?? 'brut',
    prix_unitaire:     prod?.prix_unitaire?.toString() ?? '',
    notes:             prod?.notes                 ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.site_id || !form.quantite) return
    setSaving(true)
    const payload = {
      site_id: form.site_id, date_production: form.date_production, quantite: parseFloat(form.quantite),
      unite: form.unite, type_hydrocarbure: form.type_hydrocarbure,
      prix_unitaire: form.prix_unitaire ? parseFloat(form.prix_unitaire) : null, notes: form.notes || null,
    }
    if (prod) {
      await fetch('/api/petrole/production', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: prod.id, ...payload }) })
    } else {
      await fetch('/api/petrole/production', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    }
    setSaving(false)
    onSaved()
  }

  const I = 'w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white'

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white">
          <h2 className="font-black text-[15px]">{prod ? 'Modifier production' : 'Saisir production'}</h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[11px] font-bold mb-1.5">Site *</label>
            <select value={form.site_id} onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))} className={I}>
              {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold mb-1.5">Date *</label>
              <input type="date" value={form.date_production} onChange={e => setForm(f => ({ ...f, date_production: e.target.value }))} className={I} />
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1.5">Type</label>
              <select value={form.type_hydrocarbure} onChange={e => setForm(f => ({ ...f, type_hydrocarbure: e.target.value }))} className={I}>
                {Object.entries(TYPE_HC).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold mb-1.5">Quantité *</label>
              <input type="number" value={form.quantite} onChange={e => setForm(f => ({ ...f, quantite: e.target.value }))} className={I} />
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1.5">Unité</label>
              <select value={form.unite} onChange={e => setForm(f => ({ ...f, unite: e.target.value }))} className={I}>
                {['barils', 'm³', 'tonnes', 'litres', 'Mcf'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1.5">Prix unitaire (USD)</label>
            <input type="number" value={form.prix_unitaire} onChange={e => setForm(f => ({ ...f, prix_unitaire: e.target.value }))} className={I} placeholder="Prix par unité" />
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${I} resize-none`} />
          </div>
          <button onClick={handleSave} disabled={!form.site_id || !form.quantite || saving}
            className="w-full py-2.5 bg-[#0F172A] text-white rounded-xl text-[13px] font-bold disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-[#1E293B]">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
            {prod ? 'Enregistrer' : 'Saisir la production'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PetroleProductionPage() {
  const { fmt } = useFmt()
  const [sites,      setSites]      = useState<Site[]>([])
  const [records,    setRecords]    = useState<Production[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filterSite, setFilterSite] = useState('tous')
  const [filterMois, setFilterMois] = useState('')
  const [modal,      setModal]      = useState(false)
  const [edit,       setEdit]       = useState<Production | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    let url = '/api/petrole/production'
    const params = new URLSearchParams()
    if (filterSite !== 'tous') params.set('site_id', filterSite)
    if (filterMois) params.set('mois', filterMois)
    if (params.toString()) url += '?' + params.toString()

    const [rs, rp] = await Promise.all([
      fetch('/api/petrole/sites').then(r => r.json()),
      fetch(url).then(r => r.json()),
    ])
    setSites(rs.data ?? [])
    setRecords(rp.data ?? [])
    setLoading(false)
  }, [filterSite, filterMois])

  useEffect(() => { load() }, [load])

  const totalBarils   = records.reduce((s, r) => s + r.quantite, 0)
  const valeurEstimee = records.reduce((s, r) => s + r.quantite * (r.prix_unitaire ?? 0), 0)

  const parType = Object.keys(TYPE_HC).map(k => ({
    type: k, label: TYPE_HC[k].label, color: TYPE_HC[k].color,
    total: records.filter(r => r.type_hydrocarbure === k).reduce((s, r) => s + r.quantite, 0)
  })).filter(t => t.total > 0)

  const today = new Date()
  const defaultMois = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/petrole" className="text-[#64748B] text-[13px]">← Pétrole</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-[#0F172A]" />
              <h1 className="text-[16px] font-black">Rapport de Production</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]">{loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}</button>
            <button onClick={() => { setEdit(null); setModal(true) }}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#0F172A] text-white rounded-xl text-[13px] font-bold hover:bg-[#1E293B]">
              <Plus size={14} /> Saisir production
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Production totale</p>
            <p className="text-[22px] font-black text-[#0F172A]">{totalBarils.toLocaleString('fr-FR')}</p>
            <p className="text-[11px] text-[#94A3B8]">unités cumulées</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Valeur estimée</p>
            <p className="text-[20px] font-black text-[#0F172A]">{valeurEstimee > 0 ? `$${(valeurEstimee / 1000000).toFixed(2)}M` : '—'}</p>
            <p className="text-[11px] text-[#94A3B8]">USD</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Sites actifs</p>
            <p className="text-[22px] font-black text-[#0F172A]">{sites.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Rapports</p>
            <p className="text-[22px] font-black text-[#0F172A]">{records.length}</p>
          </div>
        </div>

        {/* Répartition par type */}
        {parType.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
            <p className="text-[11px] font-black text-[#64748B] uppercase tracking-wider mb-4">Répartition par type</p>
            <div className="space-y-3">
              {parType.map(t => (
                <div key={t.type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-bold" style={{ color: t.color }}>{t.label}</span>
                    <span className="text-[12px] font-black text-[#0F172A]">{t.total.toLocaleString('fr-FR')} unités</span>
                  </div>
                  <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(t.total / totalBarils * 100).toFixed(1)}%`, background: t.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          <select value={filterSite} onChange={e => setFilterSite(e.target.value)}
            className="px-3 py-2.5 text-[12px] border border-[#E2E8F0] rounded-xl bg-white">
            <option value="tous">Tous les sites</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
          <input type="month" value={filterMois} onChange={e => setFilterMois(e.target.value)}
            className="px-3 py-2.5 text-[12px] border border-[#E2E8F0] rounded-xl bg-white"
            placeholder={defaultMois} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /></div>
        ) : records.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <TrendingUp size={40} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A] mb-1">Aucun enregistrement de production</p>
            <button onClick={() => { setEdit(null); setModal(true) }}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#0F172A] text-white rounded-xl text-[13px] font-bold">
              <Plus size={13} /> Saisir
            </button>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden sm:block bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] min-w-[700px]">
                  <thead className="bg-[#F8FAFC] text-[#64748B] font-bold border-b border-[#E2E8F0]">
                    <tr>
                      <th className="text-left px-4 py-3">Date</th>
                      <th className="text-left px-4 py-3">Site</th>
                      <th className="text-left px-4 py-3">Type</th>
                      <th className="text-right px-4 py-3">Quantité</th>
                      <th className="text-right px-4 py-3">Prix unit. (USD)</th>
                      <th className="text-right px-4 py-3">Valeur (USD)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {records.map(r => {
                      const tc = TYPE_HC[r.type_hydrocarbure]
                      const valeur = r.quantite * (r.prix_unitaire ?? 0)
                      return (
                        <tr key={r.id} className="hover:bg-[#F8FAFC] group">
                          <td className="px-4 py-3 text-[#64748B]">{new Date(r.date_production).toLocaleDateString('fr-FR')}</td>
                          <td className="px-4 py-3 font-bold text-[#0F172A]">{r.petrole_sites?.nom ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: tc.color + '15', color: tc.color }}>{tc.label}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-black text-[#0F172A]">{r.quantite.toLocaleString('fr-FR')} {r.unite}</td>
                          <td className="px-4 py-3 text-right text-[#64748B]">{r.prix_unitaire ? `$${r.prix_unitaire}` : '—'}</td>
                          <td className="px-4 py-3 text-right font-bold text-green-700">{valeur > 0 ? `$${valeur.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => { setEdit(r); setModal(true) }} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] opacity-0 group-hover:opacity-100">✏️</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-[#F8FAFC] border-t border-[#E2E8F0] font-black text-[12px]">
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-[#64748B]">TOTAL</td>
                      <td className="px-4 py-2 text-right text-[#0F172A]">{totalBarils.toLocaleString('fr-FR')}</td>
                      <td></td>
                      <td className="px-4 py-2 text-right text-green-700">{valeurEstimee > 0 ? `$${valeurEstimee.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Mobile */}
            <div className="sm:hidden space-y-3">
              {records.map(r => {
                const tc = TYPE_HC[r.type_hydrocarbure]
                return (
                  <div key={r.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4" onClick={() => { setEdit(r); setModal(true) }}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-black text-[13px] text-[#0F172A]">{r.petrole_sites?.nom ?? 'Site'}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold flex-shrink-0" style={{ background: tc.color + '15', color: tc.color }}>{tc.label}</span>
                    </div>
                    <p className="text-[11px] text-[#94A3B8] mb-2">{new Date(r.date_production).toLocaleDateString('fr-FR')}</p>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-black text-[#0F172A]">{r.quantite.toLocaleString('fr-FR')} {r.unite}</span>
                      {r.prix_unitaire && <span className="text-green-700 font-bold">${(r.quantite * r.prix_unitaire).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {modal && sites.length > 0 && <ModalProduction sites={sites} prod={edit} onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }} />}
      {modal && sites.length === 0 && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
            <p className="font-bold text-[#0F172A] mb-2">Aucun site configuré</p>
            <p className="text-[12px] text-[#64748B] mb-4">Créez d'abord un site dans <Link href="/dashboard/petrole/sites" className="text-blue-600 underline">Sites</Link></p>
            <button onClick={() => setModal(false)} className="px-4 py-2 border border-[#E2E8F0] rounded-xl text-[13px]">Fermer</button>
          </div>
        </div>
      )}
    </div>
  )
}
