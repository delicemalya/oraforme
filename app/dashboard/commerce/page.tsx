'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useFmt } from '@/lib/hooks/useFmt'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { decomposerTTCUnifie } from '@/lib/fiscalite/engine-adapter'
import {
  ShoppingCart, Plus, Search, Trash2, CheckCircle, Loader2,
  RefreshCw, X, Receipt, Package,
  Minus,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Produit {
  id: string
  nom: string
  prix_vente: number
  code_barre: string | null
  categorie: string | null
  stock_actuel: number
  unite: string | null
}

interface LigneVente {
  produit: Produit
  qte: number
  sous_total: number
  // BOI-010 : provenance choisie explicitement par l'utilisateur si le
  // produit a du stock dans plusieurs provenances — jamais devinée. Reste
  // `null` si le produit n'a aucun mouvement tagué (cas normal aujourd'hui,
  // 0 mouvement réel en production) : aucune régression du comportement
  // existant dans ce cas.
  origine: string | null
}

interface OrigineDisponible { origine: string; quantite: number }

const ORIGINE_LABELS: Record<string, string> = {
  achat_fournisseur: 'Achat fournisseur',
  production_locale: 'Production locale',
  import_direct:     'Import direct',
}

interface Vente {
  id: string
  created_at: string
  total: number
  mode_paiement: string
  caissier_nom: string | null
  nb_articles: number
  statut: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MODES_PAIEMENT = [
  { id: 'especes', label: 'Espèces', icon: '💵' },
  { id: 'mobile',  label: 'Mobile Money', icon: '📱' },
  { id: 'carte',   label: 'Carte',   icon: '💳' },
  { id: 'credit',  label: 'Crédit',  icon: '📒' },
]

// ── Modal confirmation paiement ───────────────────────────────────────────────

function ModalPaiement({
  total, montantHT, montantTVA, montantCA, onClose, onConfirm, saving,
}: {
  total: number
  montantHT: number
  montantTVA: number
  montantCA: number
  onClose: () => void
  onConfirm: (mode: string, rendu: number, destinataire: string) => void
  saving: boolean
}) {
  const { fmt } = useFmt()
  const [mode, setMode] = useState('especes')
  const [recu, setRecu] = useState('')
  const [destinataire, setDestinataire] = useState('')
  const rendu = mode === 'especes' && parseFloat(recu) > total ? parseFloat(recu) - total : 0
  // D3 : une vente à crédit exige un client nommé — pas de recouvrement
  // possible sinon (C6-PRODUCT-DECISIONS §4).
  const creditSansClient = mode === 'credit' && !destinataire.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-black text-[15px]">Encaissement</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-[#F8FAFC] rounded-xl px-4 py-3 text-center">
            <p className="text-[11px] text-[#64748B] mb-0.5">Total à payer (TTC)</p>
            <p className="text-[28px] font-black text-[#0F172A]">{fmt(total)}</p>
            <p className="text-[10px] text-[#94A3B8] mt-1">
              HT {fmt(montantHT)} · TVA {fmt(montantTVA)} · CA {fmt(montantCA)}
            </p>
          </div>

          <div>
            <p className="text-[12px] font-bold text-[#374151] mb-2">Mode de paiement</p>
            <div className="grid grid-cols-2 gap-2">
              {MODES_PAIEMENT.map(m => (
                <button key={m.id} onClick={() => setMode(m.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[12px] font-semibold transition-all ${mode === m.id ? 'border-red-500 bg-red-50 text-red-700' : 'border-[#E2E8F0] text-[#374151]'}`}>
                  <span>{m.icon}</span> {m.label}
                </button>
              ))}
            </div>
          </div>

          {mode === 'especes' && (
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Montant reçu</label>
              <input type="number" value={recu} onChange={e => setRecu(e.target.value)} placeholder={total.toString()}
                className="w-full px-3 py-2.5 text-[14px] font-bold border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300" />
              {rendu > 0 && (
                <div className="mt-2 p-2.5 bg-green-50 border border-green-200 rounded-xl text-center">
                  <p className="text-[11px] text-green-700 font-semibold">Rendu monnaie</p>
                  <p className="text-[18px] font-black text-green-700">{fmt(rendu)}</p>
                </div>
              )}
            </div>
          )}

          {mode === 'credit' && (
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Client (obligatoire pour une vente à crédit)</label>
              <input type="text" value={destinataire} onChange={e => setDestinataire(e.target.value)} placeholder="Nom du client"
                className="w-full px-3 py-2.5 text-[14px] font-bold border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300" />
            </div>
          )}

          <button onClick={() => onConfirm(mode, rendu, destinataire.trim())} disabled={saving || creditSansClient}
            className="w-full py-3 bg-green-600 text-white rounded-xl text-[14px] font-black hover:bg-green-700 disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            Valider la vente
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CommercePage() {
  const { fmt } = useFmt()
  const { tenant } = useTenantContext()
  const tid = tenant?.tenantId

  const [produits,  setProduits]  = useState<Produit[]>([])
  const [ventes,    setVentes]    = useState<Vente[]>([])
  const [panier,    setPanier]    = useState<LigneVente[]>([])
  // BOI-010 : provenances disponibles par produit (somme tous entrepôts —
  // le POS n'a pas de notion d'entrepôt aujourd'hui, cohérent avec
  // v_products_stock qui ignore déjà cette dimension, BOI-007 §1).
  const [originesParProduit, setOriginesParProduit] = useState<Record<string, OrigineDisponible[]>>({})
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(true)
  const [showPay,   setShowPay]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [tab,       setTab]       = useState<'pos' | 'ventes'>('pos')
  const [stockError, setStockError] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  // Idempotence (C6) : une clé générée à l'ouverture du paiement, réutilisée
  // pour tout retry de CE paiement tant que le panier n'a pas été vidé — un
  // double-clic ou un retry réseau renvoie alors la vente déjà créée au lieu
  // d'en créer une seconde (voir app/api/sales/route.ts).
  const idempotencyKeyRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    const [{ data: p }, { data: v }, { data: origines }] = await Promise.all([
      supabase.from('v_products_stock').select('id, nom, prix_vente, code_barre, categorie, stock_actuel, unite')
        // BOI-005 : products/v_products_stock n'a pas de colonne statut
        // (migration 050 jamais appliquée) — filtre retiré, tous les
        // produits sont vendables en caisse pour l'instant.
        .eq('tenant_id', tid).order('nom').limit(200),
      supabase.from('ventes').select('id, created_at, total, mode_paiement, caissier_nom, nb_articles, statut')
        .eq('tenant_id', tid).order('created_at', { ascending: false }).limit(50),
      // BOI-010 : lecture seule de la vue dérivée (aucune seconde source de
      // vérité — stock_movements reste l'unique source, BOI-007 §10).
      supabase.from('v_products_stock_par_origine').select('product_id, origine, quantite_disponible')
        .eq('tenant_id', tid).limit(2000),
    ])
    setProduits((p ?? []) as Produit[])
    setVentes((v ?? []) as Vente[])

    const map: Record<string, OrigineDisponible[]> = {}
    for (const row of (origines ?? []) as { product_id: string; origine: string; quantite_disponible: number }[]) {
      const list = map[row.product_id] ?? (map[row.product_id] = [])
      const existing = list.find(o => o.origine === row.origine)
      if (existing) existing.quantite += row.quantite_disponible
      else list.push({ origine: row.origine, quantite: row.quantite_disponible })
    }
    setOriginesParProduit(map)
    setLoading(false)
  }, [tid])

  useEffect(() => { load() }, [load])

  const filtered = produits.filter(p => {
    const q = search.toLowerCase()
    return !q || p.nom.toLowerCase().includes(q) || p.code_barre?.includes(q) || p.categorie?.toLowerCase().includes(q)
  })

  const total = panier.reduce((s, l) => s + l.sous_total, 0)
  const nbArticles = panier.reduce((s, l) => s + l.qte, 0)
  // Affichage HT/TVA/CA uniquement — le serveur recalcule la même
  // décomposition de manière autoritaire à l'émission (app/api/sales/route.ts),
  // jamais un taux local (0.18/0.05/0.189 interdits, Phase 6).
  const decompositionFiscale = decomposerTTCUnifie(total, 'CG')

  // BOI-010 : une seule provenance disponible → pré-sélectionnée (elle reste
  // enregistrée sur le mouvement, jamais omise — la traçabilité n'est jamais
  // supprimée, seule la saisie est évitée). Plusieurs provenances → aucune
  // sélection silencieuse, `origine` reste null tant que l'utilisateur n'a
  // pas choisi. Aucune provenance connue (mouvements historiques sans
  // origine) → comportement inchangé, `origine` reste null en permanence.
  function origineParDefaut(prodId: string): string | null {
    const origines = originesParProduit[prodId] ?? []
    return origines.length === 1 ? origines[0].origine : null
  }

  function addToCart(prod: Produit) {
    setPanier(p => {
      const idx = p.findIndex(l => l.produit.id === prod.id)
      if (idx >= 0) {
        const updated = [...p]
        updated[idx] = { ...updated[idx], qte: updated[idx].qte + 1, sous_total: (updated[idx].qte + 1) * prod.prix_vente }
        return updated
      }
      return [...p, { produit: prod, qte: 1, sous_total: prod.prix_vente, origine: origineParDefaut(prod.id) }]
    })
  }

  function updateQte(prodId: string, delta: number) {
    setPanier(p => p.map(l => {
      if (l.produit.id !== prodId) return l
      const newQte = Math.max(0, l.qte + delta)
      return { ...l, qte: newQte, sous_total: newQte * l.produit.prix_vente }
    }).filter(l => l.qte > 0))
  }

  function updateOrigine(prodId: string, origine: string) {
    setPanier(p => p.map(l => l.produit.id === prodId ? { ...l, origine } : l))
  }

  // Bloque l'encaissement tant qu'une ligne à provenances multiples n'a pas
  // de choix explicite — jamais de bascule automatique (BOI-009/BOI-010).
  const origineManquante = panier.some(l => (originesParProduit[l.produit.id]?.length ?? 0) > 1 && !l.origine)

  async function handleConfirmVente(mode: string, _rendu: number, destinataire: string) {
    if (panier.length === 0 || !tid) return
    // BOI-010 : jamais d'encaissement tant qu'une provenance reste à choisir
    // — pas de sélection silencieuse (BOI-009).
    if (origineManquante) {
      setStockError('Choisissez la provenance pour chaque article concerné avant d\'encaisser.')
      return
    }
    setSaving(true)
    setStockError(null)

    // C6 : un seul point d'entrée serveur — remplace les 3 appels directs
    // (insert ventes, insert vente_lignes, rpc fn_stock_move) par un appel
    // unique qui valide le tenant, le stock, la provenance, calcule le
    // fiscal central et émet VTE-001. Voir app/api/sales/route.ts.
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotency_key: idempotencyKeyRef.current,
        mode_paiement:   mode,
        destinataire:    mode === 'credit' ? destinataire : undefined,
        lignes: panier.map(l => ({
          produit_id: l.produit.id,
          qte:        l.qte,
          origine:    l.origine,
        })),
      }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setStockError(body.error ?? 'Erreur lors de l\'encaissement')
      setSaving(false)
      return
    }
    if (body.warning) setStockError(body.warning)

    setSaving(false)
    setPanier([])
    idempotencyKeyRef.current = null
    setShowPay(false)
    load()
  }

  // Today stats
  const today = new Date().toISOString().split('T')[0]
  const ventesAujourd = ventes.filter(v => v.created_at?.startsWith(today))
  const caAujourd = ventesAujourd.reduce((s, v) => s + v.total, 0)

  const MODE_ICONS: Record<string, string> = { especes: '💵', mobile: '📱', carte: '💳', credit: '📒' }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">

      {/* Sortie de stock refusée : la vente est enregistrée, le stock non */}
      {stockError && (
        <div className="bg-red-50 border-b border-red-200 px-4 sm:px-6 py-2 text-[12px] text-red-700">
          Stock non décrémenté — {stockError}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-red-600" />
            <h1 className="text-[16px] font-black text-[#0F172A]">Point de Vente</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-[#F1F5F9] rounded-xl p-1">
              {[['pos', '🛒 Caisse'], ['ventes', '📋 Ventes']].map(([k, label]) => (
                <button key={k} onClick={() => setTab(k as 'pos' | 'ventes')}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${tab === k ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B]'}`}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]">
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </button>
          </div>
        </div>
      </div>

      {tab === 'ventes' ? (

        /* ── Historique ventes ── */
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
          {/* KPIs jour */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
              <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">CA aujourd'hui</p>
              <p className="text-[20px] font-black text-[#0F172A]">{fmt(caAujourd)}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
              <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Tickets</p>
              <p className="text-[20px] font-black text-[#0F172A]">{ventesAujourd.length}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
              <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Panier moyen</p>
              <p className="text-[20px] font-black text-[#0F172A]">{ventesAujourd.length > 0 ? fmt(caAujourd / ventesAujourd.length) : '—'}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
              <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Articles vendus</p>
              <p className="text-[20px] font-black text-[#0F172A]">{ventesAujourd.reduce((s, v) => s + (v.nb_articles ?? 0), 0)}</p>
            </div>
          </div>

          {/* Liste */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E8F0]">
              <h3 className="text-[13px] font-black text-[#0F172A]">Historique des ventes</h3>
            </div>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-[#F8FAFC] text-[#64748B] font-bold border-b border-[#E2E8F0]">
                  <tr>
                    <th className="text-left px-4 py-2.5">Heure</th>
                    <th className="text-right px-4 py-2.5">Articles</th>
                    <th className="text-right px-4 py-2.5">Total</th>
                    <th className="text-left px-4 py-2.5">Paiement</th>
                    <th className="text-left px-4 py-2.5">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {ventes.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-10 text-[#94A3B8]">Aucune vente</td></tr>
                  ) : ventes.map(v => (
                    <tr key={v.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2.5 text-[#64748B]">{new Date(v.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td className="px-4 py-2.5 text-right">{v.nb_articles}</td>
                      <td className="px-4 py-2.5 text-right font-black text-[#0F172A]">{fmt(v.total)}</td>
                      <td className="px-4 py-2.5">{MODE_ICONS[v.mode_paiement] ?? '—'} {v.mode_paiement}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-green-50 text-green-700">Validée</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="sm:hidden divide-y divide-[#F1F5F9]">
              {ventes.map(v => (
                <div key={v.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-[12px] font-bold text-[#0F172A]">{v.nb_articles} article{v.nb_articles > 1 ? 's' : ''}</p>
                    <p className="text-[11px] text-[#64748B]">{new Date(v.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} · {MODE_ICONS[v.mode_paiement]} {v.mode_paiement}</p>
                  </div>
                  <span className="text-[14px] font-black text-[#0F172A]">{fmt(v.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      ) : (

        /* ── POS ── */
        <div className="flex-1 flex flex-col lg:flex-row gap-0 max-h-[calc(100vh-65px)] overflow-hidden">

          {/* Catalogue produits */}
          <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden">
            <div className="p-4 bg-white border-b border-[#E2E8F0]">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher produit ou scanner code barre..."
                  className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-white" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-[#94A3B8]">
                  <Loader2 size={16} className="animate-spin" /> Chargement...
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-[#94A3B8] text-[13px]">
                  <Package size={32} className="mx-auto mb-2 opacity-30" />
                  Aucun produit trouvé
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                  {filtered.map(p => {
                    const inCart = panier.find(l => l.produit.id === p.id)
                    return (
                      <button key={p.id} onClick={() => addToCart(p)}
                        className={`bg-white rounded-xl border p-3 text-left hover:shadow-md transition-all active:scale-[0.97] relative ${inCart ? 'border-red-400 ring-1 ring-red-300' : 'border-[#E2E8F0]'}`}>
                        {inCart && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-red-600 rounded-full text-white text-[10px] font-black flex items-center justify-center">
                            {inCart.qte}
                          </div>
                        )}
                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-2 text-[18px]">
                          {p.categorie === 'boisson' ? '🍶' : p.categorie === 'alimentaire' ? '🛒' : '📦'}
                        </div>
                        <p className="text-[12px] font-bold text-[#0F172A] leading-tight mb-1 line-clamp-2">{p.nom}</p>
                        <p className="text-[13px] font-black text-red-600">{fmt(p.prix_vente)}</p>
                        {p.stock_actuel !== undefined && (
                          <p className={`text-[9px] font-semibold mt-0.5 ${p.stock_actuel < 5 ? 'text-red-500' : 'text-[#94A3B8]'}`}>
                            Stock: {p.stock_actuel}
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Panier */}
          <div className="w-full lg:w-80 xl:w-96 bg-white border-t lg:border-t-0 lg:border-l border-[#E2E8F0] flex flex-col max-h-[45vh] lg:max-h-none">
            <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart size={14} className="text-red-600" />
                <span className="font-black text-[14px] text-[#0F172A]">Panier</span>
                {nbArticles > 0 && <span className="text-[11px] font-bold text-[#64748B]">({nbArticles} art.)</span>}
              </div>
              {panier.length > 0 && (
                <button onClick={() => setPanier([])} className="text-[11px] text-red-500 hover:text-red-700 font-semibold flex items-center gap-0.5">
                  <Trash2 size={11} /> Vider
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {panier.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-[#94A3B8]">
                  <ShoppingCart size={28} className="mb-2 opacity-30" />
                  <p className="text-[12px]">Panier vide</p>
                </div>
              ) : (
                <div className="divide-y divide-[#F1F5F9]">
                  {panier.map(ligne => {
                    const origines = originesParProduit[ligne.produit.id] ?? []
                    return (
                    <div key={ligne.produit.id} className="px-4 py-2.5 space-y-1.5">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-[#0F172A] truncate">{ligne.produit.nom}</p>
                          <p className="text-[11px] text-[#94A3B8]">{fmt(ligne.produit.prix_vente)} × {ligne.qte}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => updateQte(ligne.produit.id, -1)}
                            className="w-6 h-6 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#64748B] hover:bg-red-50 hover:text-red-600">
                            <Minus size={11} />
                          </button>
                          <span className="text-[12px] font-black text-[#0F172A] min-w-[20px] text-center">{ligne.qte}</span>
                          <button onClick={() => updateQte(ligne.produit.id, 1)}
                            className="w-6 h-6 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#64748B] hover:bg-green-50 hover:text-green-600">
                            <Plus size={11} />
                          </button>
                        </div>
                        <span className="text-[12px] font-black text-[#0F172A] w-16 text-right">{fmt(ligne.sous_total)}</span>
                      </div>
                      {/* BOI-010 : provenance — affichée dès qu'elle est connue,
                          choix obligatoire si plusieurs provenances ont du stock. */}
                      {origines.length > 1 && (
                        <select value={ligne.origine ?? ''} onChange={e => updateOrigine(ligne.produit.id, e.target.value)}
                          className={`w-full text-[11px] rounded-lg px-2 py-1.5 border focus:outline-none ${ligne.origine ? 'border-[#E2E8F0]' : 'border-red-400 bg-red-50'}`}>
                          <option value="" disabled>Choisir la provenance…</option>
                          {origines.map(o => (
                            <option key={o.origine} value={o.origine}>
                              {ORIGINE_LABELS[o.origine] ?? o.origine} ({o.quantite} dispo.)
                            </option>
                          ))}
                        </select>
                      )}
                      {origines.length === 1 && (
                        <p className="text-[10px] text-[#94A3B8]">
                          Provenance : {ORIGINE_LABELS[origines[0].origine] ?? origines[0].origine} ({origines[0].quantite} dispo.)
                        </p>
                      )}
                    </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Total & CTA */}
            <div className="p-4 border-t border-[#E2E8F0] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#374151]">Total</span>
                <span className="text-[22px] font-black text-[#0F172A]">{fmt(total)}</span>
              </div>
              {origineManquante && (
                <p className="text-[11px] text-red-600 font-semibold">
                  Choisissez la provenance de chaque article marqué en rouge.
                </p>
              )}
              <button onClick={() => { idempotencyKeyRef.current = crypto.randomUUID(); setShowPay(true) }} disabled={panier.length === 0 || origineManquante}
                className="w-full py-3 bg-red-600 text-white rounded-xl text-[14px] font-black hover:bg-red-700 disabled:opacity-30 flex items-center justify-center gap-2">
                <Receipt size={16} /> Encaisser
              </button>
            </div>
          </div>
        </div>
      )}

      {showPay && (
        <ModalPaiement
          total={total}
          montantHT={decompositionFiscale.ht}
          montantTVA={decompositionFiscale.tva}
          montantCA={decompositionFiscale.ca}
          onClose={() => { idempotencyKeyRef.current = null; setShowPay(false) }}
          onConfirm={handleConfirmVente}
          saving={saving}
        />
      )}
    </div>
  )
}
