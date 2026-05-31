'use client'

import { useLocale } from '@/lib/hooks/useLocale'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { fmtFCFA } from '@/lib/admin-config'
import {
  ShoppingCart, Search, Plus, X, Loader2, ChevronLeft,
  Trash2, CheckCircle, Printer, AlertTriangle, Package,
  Clock, Receipt,
} from 'lucide-react'
import Link from 'next/link'

interface Medicament {
  id:                string
  nom_commercial:    string
  dci:               string | null
  forme:             string | null
  dosage:            string | null
  prix_vente:        number
  stock_actuel:      number
  ordonnance_requise: boolean
}

interface LigneVente {
  medicament_id:   string
  nom_commercial:  string
  forme:           string | null
  dosage:          string | null
  prix_unitaire:   number
  quantite:        number
}

interface Vente {
  id:             string
  numero_ticket:  string | null
  montant_total:  number
  statut:         string
  mode_paiement:  string | null
  patient_nom:    string | null
  created_at:     string
}

const MODES_PAIEMENT = ['especes', 'mobile_money', 'carte', 'assurance', 'credit']
const MODE_LABELS: Record<string, string> = {
  especes: 'Espèces', mobile_money: 'Mobile Money',
  carte: 'Carte bancaire', assurance: 'Assurance', credit: 'Crédit',
}

export default function PharmacieVentesPage() {
  const { t } = useLocale()
  const { tenantId, loading: tenantLoading } = useTenant()
  const [medicaments, setMedicaments] = useState<Medicament[]>([])
  const [search, setSearch] = useState('')
  const [panier, setPanier] = useState<LigneVente[]>([])
  const [ventes, setVentes] = useState<Vente[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modePaiement, setModePaiement] = useState('especes')
  const [patientNom, setPatientNom] = useState('')
  const [ordonnanceRef, setOrdonnanceRef] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [view, setView] = useState<'pos' | 'historique'>('pos')
  const searchRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const [{ data: meds }, { data: v }] = await Promise.all([
      supabase.from('pharmacie_medicaments')
        .select('id, nom_commercial, dci, forme, dosage, prix_vente, stock_actuel, ordonnance_requise')
        .eq('tenant_id', tenantId).eq('actif', true).gt('stock_actuel', 0).order('nom_commercial'),
      supabase.from('pharmacie_ventes')
        .select('id, numero_ticket, montant_total, statut, mode_paiement, patient_nom, created_at')
        .eq('tenant_id', tenantId).gte('created_at', today).order('created_at', { ascending: false }).limit(50),
    ])
    setMedicaments(meds ?? [])
    setVentes(v ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (!tenantLoading) load() }, [tenantLoading, load])

  const filtered = medicaments.filter(m =>
    m.nom_commercial.toLowerCase().includes(search.toLowerCase()) ||
    (m.dci ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function addToCart(med: Medicament) {
    setPanier(prev => {
      const existing = prev.find(l => l.medicament_id === med.id)
      if (existing) {
        if (existing.quantite >= med.stock_actuel) return prev
        return prev.map(l => l.medicament_id === med.id ? { ...l, quantite: l.quantite + 1 } : l)
      }
      return [...prev, {
        medicament_id: med.id,
        nom_commercial: med.nom_commercial,
        forme: med.forme,
        dosage: med.dosage,
        prix_unitaire: med.prix_vente,
        quantite: 1,
      }]
    })
    setSearch('')
    searchRef.current?.focus()
  }

  function updateQty(id: string, qty: number) {
    const med = medicaments.find(m => m.id === id)
    if (!med) return
    if (qty <= 0) return removeFromCart(id)
    if (qty > med.stock_actuel) return
    setPanier(prev => prev.map(l => l.medicament_id === id ? { ...l, quantite: qty } : l))
  }

  function removeFromCart(id: string) {
    setPanier(prev => prev.filter(l => l.medicament_id !== id))
  }

  const total = panier.reduce((s, l) => s + l.prix_unitaire * l.quantite, 0)

  async function validerVente() {
    if (!tenantId || panier.length === 0) return
    setSaving(true); setError('')
    const { data: vente, error: ve } = await supabase.from('pharmacie_ventes').insert({
      tenant_id: tenantId,
      montant_total: total,
      statut: 'valide',
      mode_paiement: modePaiement,
      patient_nom: patientNom || null,
      ordonnance_ref: ordonnanceRef || null,
    }).select('id, numero_ticket').single()

    if (ve || !vente) { setError('Erreur lors de la vente'); setSaving(false); return }

    const lignes = panier.map(l => ({
      tenant_id: tenantId,
      vente_id: vente.id,
      medicament_id: l.medicament_id,
      quantite: l.quantite,
      prix_unitaire: l.prix_unitaire,
      sous_total: l.prix_unitaire * l.quantite,
    }))
    await supabase.from('pharmacie_vente_lignes').insert(lignes)

    setPanier([])
    setPatientNom('')
    setOrdonnanceRef('')
    setModePaiement('especes')
    setSuccess(`Vente ${vente.numero_ticket ?? ''} validée — ${fmtFCFA(total)}`)
    setTimeout(() => setSuccess(''), 4000)
    setSaving(false)
    load()
  }

  if (tenantLoading || loading) {
    return <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#DC2626]" /></div>
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/pharmacie" className="p-2 rounded-xl hover:bg-[#F1F5F9] border border-[#E5E7EB]">
            <ChevronLeft size={16} className="text-[#64748B]" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
              <ShoppingCart size={18} className="text-[#16A34A]" /> Ventes & Caisse
            </h1>
            <p className="text-xs text-[#64748B]">POS Pharmacie</p>
          </div>
        </div>
        <div className="flex gap-2">
          {(['pos', 'historique'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${view === v ? 'bg-[#0891B2] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}>
              {v === 'pos' ? 'Caisse POS' : 'Historique'}
            </button>
          ))}
        </div>
      </div>

      {success && (
        <div className="mx-6 mt-4 bg-[#F0FDF4] border border-[#86EFAC] text-[#15803D] text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <CheckCircle size={14} /> {success}
        </div>
      )}

      {view === 'pos' ? (
        <div className="flex gap-0 h-[calc(100vh-64px)]">
          {/* Catalogue */}
          <div className="flex-1 flex flex-col border-r border-[#E5E7EB]">
            <div className="p-4 border-b border-[#E5E7EB] bg-white">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un médicament (nom, DCI)…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20"
                  autoFocus
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X size={14} className="text-[#94A3B8]" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Package size={28} className="text-[#CBD5E1] mb-2" />
                  <p className="text-sm text-[#94A3B8]">Aucun médicament disponible</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filtered.map(med => {
                    const inCart = panier.find(l => l.medicament_id === med.id)
                    return (
                      <button
                        key={med.id}
                        onClick={() => addToCart(med)}
                        className={`text-left p-3 rounded-xl border transition-all hover:shadow-md ${inCart ? 'border-[#0891B2] bg-[#ECFEFF]' : 'border-[#E5E7EB] bg-white hover:border-[#0891B2]/40'}`}
                      >
                        <div className="w-8 h-8 rounded-xl bg-[#EFF6FF] flex items-center justify-center mb-2">
                          <ShoppingCart size={13} className="text-[#2563EB]" />
                        </div>
                        <p className="text-xs font-bold text-[#0F172A] line-clamp-2 leading-tight">{med.nom_commercial}</p>
                        {med.forme && <p className="text-[10px] text-[#94A3B8] mt-0.5">{med.forme}{med.dosage ? ` ${med.dosage}` : ''}</p>}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs font-bold text-[#16A34A]">{fmtFCFA(med.prix_vente)}</span>
                          <span className="text-[10px] text-[#94A3B8]">Stock: {med.stock_actuel}</span>
                        </div>
                        {med.ordonnance_requise && (
                          <span className="mt-1 block text-[9px] font-semibold text-[#D97706] bg-[#FFFBEB] px-1.5 py-0.5 rounded-full w-fit">Ordonnance</span>
                        )}
                        {inCart && (
                          <div className="mt-2 text-[10px] font-semibold text-[#0E7490]">Qté: {inCart.quantite}</div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Panier */}
          <div className="w-80 xl:w-96 flex flex-col bg-white">
            <div className="px-5 py-3 border-b border-[#E5E7EB]">
              <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <ShoppingCart size={14} className="text-[#0891B2]" /> Panier ({panier.length})
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto">
              {panier.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <ShoppingCart size={28} className="text-[#CBD5E1] mb-2" />
                  <p className="text-xs text-[#94A3B8]">Cliquez sur un médicament pour l'ajouter</p>
                </div>
              ) : (
                <div className="divide-y divide-[#F8FAFC]">
                  {panier.map(l => (
                    <div key={l.medicament_id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#0F172A] truncate">{l.nom_commercial}</p>
                        {l.forme && <p className="text-[10px] text-[#94A3B8]">{l.forme}{l.dosage ? ` ${l.dosage}` : ''}</p>}
                        <p className="text-[10px] text-[#64748B] mt-0.5">{fmtFCFA(l.prix_unitaire)} × {l.quantite} = <span className="font-bold text-[#0F172A]">{fmtFCFA(l.prix_unitaire * l.quantite)}</span></p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(l.medicament_id, l.quantite - 1)}
                          className="w-6 h-6 rounded-lg bg-[#F1F5F9] flex items-center justify-center text-[#64748B] hover:bg-[#E2E8F0] font-bold text-sm">−</button>
                        <span className="w-6 text-center text-xs font-bold text-[#0F172A]">{l.quantite}</span>
                        <button onClick={() => updateQty(l.medicament_id, l.quantite + 1)}
                          className="w-6 h-6 rounded-lg bg-[#F1F5F9] flex items-center justify-center text-[#64748B] hover:bg-[#E2E8F0] font-bold text-sm">+</button>
                        <button onClick={() => removeFromCart(l.medicament_id)}
                          className="w-6 h-6 rounded-lg bg-[#FEF2F2] flex items-center justify-center ml-1">
                          <Trash2 size={11} className="text-[#DC2626]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Options & Total */}
            <div className="border-t border-[#E5E7EB] p-4 space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-[#374151] block mb-1">Patient (optionnel)</label>
                <input value={patientNom} onChange={e => setPatientNom(e.target.value)}
                  placeholder="Nom du patient"
                  className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#374151] block mb-1">Réf. ordonnance</label>
                <input value={ordonnanceRef} onChange={e => setOrdonnanceRef(e.target.value)}
                  placeholder="N° ordonnance"
                  className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#374151] block mb-1">Mode de paiement</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {MODES_PAIEMENT.map(m => (
                    <button key={m} onClick={() => setModePaiement(m)}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-semibold border transition-all ${modePaiement === m ? 'bg-[#0891B2] text-white border-[#0891B2]' : 'bg-[#F8FAFC] text-[#64748B] border-[#E5E7EB] hover:bg-[#F1F5F9]'}`}>
                      {MODE_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-[#FEF2F2] text-[#DC2626] text-[10px] px-3 py-2 rounded-xl flex items-center gap-1.5">
                  <AlertTriangle size={11} /> {error}
                </div>
              )}

              <div className="bg-[#F8FAFC] rounded-xl p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-[#64748B]">{t('common.total')}</span>
                  <span className="text-xl font-bold text-[#0F172A]">{fmtFCFA(total)}</span>
                </div>
              </div>

              <button
                onClick={validerVente}
                disabled={saving || panier.length === 0}
                className="w-full py-3 bg-[#16A34A] text-white font-bold text-sm rounded-xl hover:bg-[#15803D] disabled:opacity-40 flex items-center justify-center gap-2 transition-all">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                {saving ? 'Traitement…' : 'Valider la vente'}
              </button>

              {panier.length > 0 && (
                <button onClick={() => setPanier([])}
                  className="w-full py-2 text-xs text-[#94A3B8] hover:text-[#DC2626] border border-[#E5E7EB] rounded-xl transition-all">
                  Vider le panier
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Historique */
        <div className="p-6">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center gap-2">
              <Clock size={14} className="text-[#64748B]" />
              <h2 className="text-sm font-semibold text-[#0F172A]">Ventes d'aujourd'hui</h2>
              <span className="ml-auto text-xs text-[#94A3B8]">{ventes.length} vente(s)</span>
            </div>
            {ventes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Receipt size={28} className="text-[#CBD5E1] mb-2" />
                <p className="text-sm text-[#94A3B8]">Aucune vente aujourd'hui</p>
              </div>
            ) : (
              <div className="divide-y divide-[#F8FAFC]">
                {ventes.map(v => (
                  <div key={v.id} className="flex items-center gap-4 px-5 py-3 hover:bg-[#F8FAFC]">
                    <div className="w-9 h-9 rounded-xl bg-[#F0FDF4] flex items-center justify-center flex-shrink-0">
                      <Receipt size={14} className="text-[#16A34A]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-[#0F172A]">
                        {v.numero_ticket ?? v.id.slice(0, 8).toUpperCase()}
                        {v.patient_nom && <span className="text-[#64748B] font-normal"> — {v.patient_nom}</span>}
                      </p>
                      <p className="text-[10px] text-[#94A3B8]">
                        {new Date(v.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        {v.mode_paiement ? ` · ${MODE_LABELS[v.mode_paiement] ?? v.mode_paiement}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#0F172A]">{fmtFCFA(v.montant_total)}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${v.statut === 'valide' ? 'bg-[#F0FDF4] text-[#16A34A]' : 'bg-[#FEF2F2] text-[#DC2626]'}`}>
                        {v.statut}
                      </span>
                    </div>
                    <button className="w-8 h-8 rounded-xl bg-[#F1F5F9] flex items-center justify-center hover:bg-[#E2E8F0]">
                      <Printer size={13} className="text-[#64748B]" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E5E7EB] flex items-center justify-between">
              <span className="text-xs text-[#64748B] font-medium">Total du jour</span>
              <span className="text-base font-bold text-[#0F172A]">
                {fmtFCFA(ventes.filter(v => v.statut === 'valide').reduce((s, v) => s + v.montant_total, 0))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
