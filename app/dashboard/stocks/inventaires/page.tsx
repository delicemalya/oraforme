'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { fmtFCFA } from '@/lib/admin-config'
import { writeComptaEntry } from '@/lib/compta-sync-client'
import {
  ClipboardList, Plus, X, Save, Search, CheckCircle2,
  AlertTriangle, Package, Warehouse, Calculator, FileText,
  Play, CheckSquare, RefreshCw, ChevronDown, ChevronRight
} from 'lucide-react'

interface Inventaire {
  id: string
  tenant_id: string
  nom: string
  warehouse_id: string | null
  statut: 'brouillon' | 'en_cours' | 'terminé' | 'validé'
  date_debut: string | null
  date_fin: string | null
  notes: string | null
  created_at: string
  warehouse_nom?: string
  nb_lignes?: number
  ecart_valeur?: number
}

interface InventaireLigne {
  id: string
  inventaire_id: string
  product_id: string
  stock_theorique: number
  stock_physique: number | null
  ecart: number | null
  unit_cost: number
  product_nom?: string
  product_sku?: string
  product_unite?: string
}

interface Product {
  id: string
  nom: string
  sku: string
  stock_actuel: number
  prix_achat: number
  unite: string
}

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  brouillon: { label: 'Brouillon',  color: '#64748B', bg: '#F1F5F9' },
  en_cours:  { label: 'En cours',   color: '#D97706', bg: '#FFFBEB' },
  terminé:   { label: 'Terminé',    color: '#2563EB', bg: '#EFF6FF' },
  validé:    { label: 'Validé',     color: '#16A34A', bg: '#F0FDF4' },
}

export default function InventairesPage() {
  
  const { tenantId } = useTenant()

  const [inventaires, setInventaires] = useState<Inventaire[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [openInv, setOpenInv] = useState<string | null>(null)
  const [lignes, setLignes] = useState<InventaireLigne[]>([])
  const [lignesLoading, setLignesLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const [createForm, setCreateForm] = useState({ nom: '', warehouse_id: '', notes: '' })
  const [createError, setCreateError] = useState('')

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data: invs, error: e1 } = await supabase
        .from('stock_inventories')
        .select('*, warehouses(nom)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (e1?.code === '42P01') { setInventaires([]); setLoading(false); return }

      const { data: wares } = await supabase.from('warehouses').select('id, nom').eq('tenant_id', tenantId).eq('actif', true)
      setWarehouses(wares || [])

      // Compute stats per inventory
      const list = await Promise.all((invs || []).map(async (inv: Inventaire) => {
        const { data: lines, count } = await supabase
          .from('stock_inventory_items')
          .select('ecart, unit_cost', { count: 'exact' })
          .eq('inventaire_id', inv.id)

        const ecart_valeur = (lines || []).reduce((s: number, l: any) => s + (l.ecart || 0) * (l.unit_cost || 0), 0)
        return {
          ...inv,
          warehouse_nom: (inv as any).warehouses?.nom,
          nb_lignes: count || 0,
          ecart_valeur,
        }
      }))

      setInventaires(list)
    } catch { setInventaires([]) }
    setLoading(false)
  }, [tenantId, supabase])

  useEffect(() => { load() }, [load])

  const loadLignes = async (invId: string) => {
    if (!tenantId) return
    setLignesLoading(true)
    const { data } = await supabase
      .from('stock_inventory_items')
      .select('*, products(nom, sku, unite)')
      .eq('inventaire_id', invId)
      .order('created_at')

    setLignes((data || []).map((l: any) => ({
      ...l,
      product_nom: l.products?.nom,
      product_sku: l.products?.sku,
      product_unite: l.products?.unite,
    })))
    setLignesLoading(false)
  }

  const toggleOpen = async (invId: string) => {
    if (openInv === invId) { setOpenInv(null); return }
    setOpenInv(invId)
    await loadLignes(invId)
  }

  const handleCreate = async () => {
    if (!tenantId || !createForm.nom.trim()) { setCreateError('Le nom est obligatoire'); return }
    setSaving(true)
    setCreateError('')
    try {
      // Create inventory
      const { data: inv, error: e } = await supabase
        .from('stock_inventories')
        .insert({
          tenant_id: tenantId,
          nom: createForm.nom.trim(),
          warehouse_id: createForm.warehouse_id || null,
          notes: createForm.notes.trim() || null,
          statut: 'brouillon',
          date_debut: new Date().toISOString().split('T')[0],
        })
        .select().single()
      if (e) throw e

      // Load products for this warehouse and create lines
      let prodsQuery = supabase.from('products').select('id, stock_actuel, prix_achat').eq('tenant_id', tenantId)
      if (createForm.warehouse_id) prodsQuery = prodsQuery.eq('warehouse_id', createForm.warehouse_id)
      const { data: prods } = await prodsQuery

      if (prods && prods.length > 0) {
        const items = prods.map((p: any) => ({
          inventaire_id: inv.id,
          product_id: p.id,
          stock_theorique: p.stock_actuel || 0,
          stock_physique: null,
          ecart: null,
          unit_cost: p.prix_achat || 0,
        }))
        await supabase.from('stock_inventory_items').insert(items)
      }

      setShowCreate(false)
      setCreateForm({ nom: '', warehouse_id: '', notes: '' })
      await load()
    } catch (e: any) {
      setCreateError(e.message || 'Erreur')
    }
    setSaving(false)
  }

  const updateLigne = async (ligneId: string, stockPhysique: number) => {
    const ligne = lignes.find(l => l.id === ligneId)
    if (!ligne) return
    const ecart = stockPhysique - ligne.stock_theorique
    await supabase
      .from('stock_inventory_items')
      .update({ stock_physique: stockPhysique, ecart })
      .eq('id', ligneId)
    setLignes(ls => ls.map(l => l.id === ligneId ? { ...l, stock_physique: stockPhysique, ecart } : l))
  }

  const changeStatut = async (inv: Inventaire, newStatut: string) => {
    if (!tenantId) return
    setSaving(true)
    try {
      const updates: any = { statut: newStatut }
      if (newStatut === 'en_cours') updates.date_debut = new Date().toISOString().split('T')[0]
      if (newStatut === 'terminé') updates.date_fin = new Date().toISOString().split('T')[0]

      await supabase.from('stock_inventories').update(updates).eq('id', inv.id).eq('tenant_id', tenantId)

      // On validation: apply adjustments to products + compta
      if (newStatut === 'validé') {
        const { data: lines } = await supabase
          .from('stock_inventory_items')
          .select('*, products(nom)')
          .eq('inventaire_id', inv.id)
          .not('ecart', 'eq', 0)
          .not('stock_physique', 'is', null)

        for (const ligne of (lines || [])) {
          if (!ligne.ecart || ligne.ecart === 0) continue

          // Update product stock (fallback manual update)
          try {
            const { data: p } = await supabase.from('products')
              .select('stock_actuel')
              .eq('id', ligne.product_id)
              .single()
            if (p) {
              await supabase.from('products')
                .update({ stock_actuel: (p.stock_actuel || 0) + ligne.ecart })
                .eq('id', ligne.product_id)
            }
          } catch {}

          // Insert movement
          await supabase.from('stock_movements').insert({
            tenant_id: tenantId,
            product_id: ligne.product_id,
            warehouse_id: inv.warehouse_id,
            type: 'ajustement',
            quantity: Math.abs(ligne.ecart),
            unit_cost: ligne.unit_cost,
            reference: `INV-${inv.id.slice(0, 8)}`,
            notes: `Ajustement inventaire: ${inv.nom}`,
          })

          // OHADA entry for significant adjustments
          if (Math.abs(ligne.ecart * (ligne.unit_cost || 0)) >= 1000) {
            const valeur = Math.abs(ligne.ecart * (ligne.unit_cost || 0))
            const today = new Date().toISOString().split('T')[0]
            await writeComptaEntry({
              tenantId,
              date: today,
              libelle: `Ajustement inventaire ${ligne.products?.nom || ''}`,
              type: ligne.ecart > 0 ? 'recette' : 'depense',
              montant: valeur,
              categorie: 'ajustement_stock',
              debitAccount: ligne.ecart > 0 ? '310000' : '603000',
              creditAccount: ligne.ecart > 0 ? '603000' : '310000',
              source: 'inventaire',
              sourceId: inv.id,
            })
          }
        }
      }

      await load()
      if (openInv === inv.id) await loadLignes(inv.id)
    } catch (e: any) { alert(e.message) }
    setSaving(false)
  }

  const filtered = inventaires.filter(inv =>
    inv.nom.toLowerCase().includes(search.toLowerCase()) ||
    (inv.warehouse_nom || '').toLowerCase().includes(search.toLowerCase())
  )

  const enCours = inventaires.filter(i => i.statut === 'en_cours').length
  const totalEcart = inventaires.reduce((s, i) => s + Math.abs(i.ecart_valeur || 0), 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <ClipboardList size={20} className="text-[#16A34A]" />
            Inventaires Physiques
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">Comptage physique et ajustements automatiques OHADA</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] transition-colors">
          <Plus size={14} /> Nouvel inventaire
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total inventaires', value: inventaires.length, icon: ClipboardList, color: '#16A34A', bg: '#F0FDF4' },
          { label: 'En cours', value: enCours, icon: Play, color: '#D97706', bg: '#FFFBEB' },
          { label: 'Validés', value: inventaires.filter(i => i.statut === 'validé').length, icon: CheckCircle2, color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Écarts cumulés', value: fmtFCFA(totalEcart), icon: AlertTriangle, color: '#DC2626', bg: '#FEF2F2' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>
                <k.icon size={14} style={{ color: k.color }} />
              </div>
              <span className="text-[11px] text-[#64748B]">{k.label}</span>
            </div>
            <p className="text-lg font-bold text-[#0F172A]">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un inventaire…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-[#64748B]">Chargement…</div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center">
              <ClipboardList size={40} className="mx-auto text-[#CBD5E1] mb-3" />
              <p className="text-sm font-semibold text-[#0F172A]">Aucun inventaire</p>
              <button onClick={() => setShowCreate(true)}
                className="mt-4 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] transition-colors">
                Créer un inventaire
              </button>
            </div>
          ) : filtered.map(inv => {
            const cfg = STATUT_CONFIG[inv.statut]
            const isOpen = openInv === inv.id
            return (
              <div key={inv.id} className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
                {/* Header row */}
                <div className="flex items-center gap-3 p-4">
                  <button onClick={() => toggleOpen(inv.id)} className="text-[#94A3B8] hover:text-[#0F172A]">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[#0F172A]">{inv.nom}</p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: cfg.color, background: cfg.bg }}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {inv.warehouse_nom && (
                        <span className="flex items-center gap-1 text-[11px] text-[#64748B]">
                          <Warehouse size={11} /> {inv.warehouse_nom}
                        </span>
                      )}
                      <span className="text-[11px] text-[#94A3B8]">
                        {inv.nb_lignes} article(s)
                      </span>
                      {inv.date_debut && (
                        <span className="text-[11px] text-[#94A3B8]">
                          Début: {new Date(inv.date_debut).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ecart */}
                  {inv.ecart_valeur !== 0 && (
                    <div className="text-right">
                      <p className="text-xs font-bold" style={{ color: (inv.ecart_valeur || 0) >= 0 ? '#16A34A' : '#DC2626' }}>
                        {(inv.ecart_valeur || 0) >= 0 ? '+' : ''}{fmtFCFA(inv.ecart_valeur || 0)}
                      </p>
                      <p className="text-[10px] text-[#94A3B8]">Écart valeur</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-1.5">
                    {inv.statut === 'brouillon' && (
                      <button onClick={() => changeStatut(inv, 'en_cours')} disabled={saving}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-[#D97706] text-white rounded-lg text-[11px] font-semibold hover:bg-[#B45309] disabled:opacity-50">
                        <Play size={11} /> Démarrer
                      </button>
                    )}
                    {inv.statut === 'en_cours' && (
                      <button onClick={() => changeStatut(inv, 'terminé')} disabled={saving}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-[#2563EB] text-white rounded-lg text-[11px] font-semibold hover:bg-[#1D4ED8] disabled:opacity-50">
                        <CheckSquare size={11} /> Terminer
                      </button>
                    )}
                    {inv.statut === 'terminé' && (
                      <button onClick={() => changeStatut(inv, 'validé')} disabled={saving}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-[#16A34A] text-white rounded-lg text-[11px] font-semibold hover:bg-[#15803D] disabled:opacity-50">
                        <CheckCircle2 size={11} /> Valider & Appliquer
                      </button>
                    )}
                  </div>
                </div>

                {/* Lines */}
                {isOpen && (
                  <div className="border-t border-[#F1F5F9]">
                    {lignesLoading ? (
                      <div className="p-6 text-center text-sm text-[#64748B]">Chargement des lignes…</div>
                    ) : lignes.length === 0 ? (
                      <div className="p-6 text-center text-sm text-[#64748B]">Aucune ligne d'inventaire</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-[#F8FAFC]">
                              <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Produit</th>
                              <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Stock théorique</th>
                              <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Stock physique</th>
                              <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Écart</th>
                              <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Valeur écart</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lignes.map(l => (
                              <tr key={l.id} className="border-t border-[#F8FAFC] hover:bg-[#FAFAFA]">
                                <td className="px-4 py-2.5">
                                  <p className="text-xs font-semibold text-[#0F172A]">{l.product_nom}</p>
                                  <span className="text-[10px] font-mono text-[#94A3B8]">{l.product_sku}</span>
                                </td>
                                <td className="px-4 py-2.5 text-right text-xs text-[#64748B]">
                                  {l.stock_theorique} {l.product_unite}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  {inv.statut === 'en_cours' ? (
                                    <input
                                      type="number"
                                      min={0}
                                      defaultValue={l.stock_physique ?? ''}
                                      onBlur={e => updateLigne(l.id, Number(e.target.value))}
                                      className="w-24 text-right px-2 py-1 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20"
                                      placeholder="0"
                                    />
                                  ) : (
                                    <span className="text-xs text-[#0F172A]">
                                      {l.stock_physique ?? '—'} {l.product_unite}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  {l.ecart !== null ? (
                                    <span className={`text-xs font-bold ${
                                      l.ecart > 0 ? 'text-[#16A34A]' : l.ecart < 0 ? 'text-[#DC2626]' : 'text-[#64748B]'
                                    }`}>
                                      {l.ecart > 0 ? '+' : ''}{l.ecart}
                                    </span>
                                  ) : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-right text-xs font-semibold">
                                  {l.ecart !== null && l.ecart !== 0
                                    ? <span style={{ color: l.ecart > 0 ? '#16A34A' : '#DC2626' }}>
                                        {fmtFCFA(Math.abs(l.ecart * l.unit_cost))}
                                      </span>
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
              <h2 className="text-sm font-bold text-[#0F172A]">Nouvel inventaire physique</h2>
              <button onClick={() => setShowCreate(false)}><X size={16} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-4">
              {createError && (
                <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-xs p-3 rounded-xl">{createError}</div>
              )}
              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1">Nom de l'inventaire *</label>
                <input value={createForm.nom}
                  onChange={e => setCreateForm(f => ({ ...f, nom: e.target.value }))}
                  placeholder="Inventaire Annuel 2026"
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1">Entrepôt (optionnel)</label>
                <select value={createForm.warehouse_id}
                  onChange={e => setCreateForm(f => ({ ...f, warehouse_id: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
                  <option value="">Tous les entrepôts</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1">Notes</label>
                <textarea value={createForm.notes}
                  onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Informations complémentaires…"
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none resize-none focus:ring-2 focus:ring-[#16A34A]/20" />
              </div>
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3 text-xs text-[#2563EB]">
                <strong>ℹ️ Info:</strong> Les lignes d'inventaire seront créées automatiquement avec le stock théorique actuel.
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-[#E2E8F0]">
              <button onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-2 border border-[#E2E8F0] text-[#374151] text-xs font-semibold rounded-xl hover:bg-[#F8FAFC]">
                Annuler
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] disabled:opacity-50">
                <Save size={13} />
                {saving ? 'Création…' : 'Créer l\'inventaire'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
