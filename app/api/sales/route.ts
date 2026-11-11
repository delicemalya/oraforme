import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'
import { decomposerTTCUnifie } from '@/lib/fiscalite/engine-adapter'

/**
 * POST /api/sales — point d'entrée canonique de la vente (C6).
 *
 * Remplace les inserts/RPC directs du POS (app/dashboard/commerce/page.tsx)
 * et de la branche type_sortie='vente' de stocks/sorties — les deux
 * convergent ici, pas de logique métier dupliquée entre les deux écrans
 * (C6-ARCHITECTURE-ARBITRATION, Option A ; C6-PRODUCT-DECISIONS D2).
 *
 * Atomicité (C6-POST-REVIEW-FIX, anomalie A1 de
 * docs/C6-PRE-PRODUCTION-REVIEW.md §5) : vente + lignes + fn_stock_move×N +
 * comptabilité s'exécutent dans UN SEUL appel RPC
 * (fn_create_vente_atomique, migration 186) — une vraie transaction
 * Postgres, pas un try/catch avec compensation applicative. Toute exception
 * interne (stock insuffisant, provenance invalide, comptabilisation non
 * aboutie) annule la totalité : plus de vente partielle, plus de mouvement
 * de stock orphelin.
 */

type LigneInput = {
  produit_id: string
  qte: number
  origine?: 'achat_fournisseur' | 'production_locale' | 'import_direct' | null
  purchase_item_id?: string | null
}

const MODES_PAIEMENT = ['especes', 'mobile', 'carte', 'credit'] as const
type ModePaiement = typeof MODES_PAIEMENT[number]

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })

  const {
    idempotency_key,
    lignes,
    mode_paiement,
    destinataire,
    warehouse_id,
  }: {
    idempotency_key?: string
    lignes?: LigneInput[]
    mode_paiement?: string
    destinataire?: string
    warehouse_id?: string
  } = body

  // ── Validation d'entrée ───────────────────────────────────────────────────
  if (!Array.isArray(lignes) || lignes.length === 0) {
    return NextResponse.json({ error: 'Au moins une ligne est requise' }, { status: 400 })
  }
  for (const l of lignes) {
    if (!l.produit_id || !Number.isFinite(l.qte) || l.qte <= 0) {
      return NextResponse.json({ error: 'Ligne invalide : produit_id et qte > 0 requis' }, { status: 400 })
    }
    if (l.origine != null && !['achat_fournisseur', 'production_locale', 'import_direct'].includes(l.origine)) {
      return NextResponse.json({ error: `Origine invalide : ${l.origine}` }, { status: 400 })
    }
  }
  if (!mode_paiement || !MODES_PAIEMENT.includes(mode_paiement as ModePaiement)) {
    return NextResponse.json({ error: `mode_paiement invalide (attendu : ${MODES_PAIEMENT.join('/')})` }, { status: 400 })
  }
  // D3 : client obligatoire pour une vente à crédit (Phase 9).
  if (mode_paiement === 'credit' && !destinataire?.trim()) {
    return NextResponse.json({ error: 'destinataire requis pour une vente à crédit' }, { status: 400 })
  }
  if (warehouse_id) {
    const { data: wh } = await supabaseAdmin
      .from('warehouses').select('id').eq('id', warehouse_id).eq('tenant_id', ctx.tid).maybeSingle()
    if (!wh) return NextResponse.json({ error: 'Entrepôt introuvable pour ce tenant' }, { status: 403 })
  }

  // ── Produits : prix/coût toujours lus serveur, jamais acceptés du client ──
  const produitIds = [...new Set(lignes.map(l => l.produit_id))]
  const { data: produits } = await supabaseAdmin
    .from('products')
    .select('id, nom, prix_vente, prix_achat')
    .eq('tenant_id', ctx.tid)
    .in('id', produitIds)

  const produitsById = new Map((produits ?? []).map(p => [p.id, p]))
  const manquants = produitIds.filter(id => !produitsById.has(id))
  if (manquants.length > 0) {
    return NextResponse.json({ error: `Produit(s) introuvable(s) pour ce tenant : ${manquants.join(', ')}` }, { status: 403 })
  }

  // ── purchase_item_id : jamais fait confiance tel que fourni par le client
  //    (C6-POST-REVIEW-FIX, anomalie B1 — IDOR cross-tenant potentielle).
  //    Revalidé aussi côté DB dans fn_stock_move (défense en profondeur).
  const purchaseItemIds = [...new Set(lignes.map(l => l.purchase_item_id).filter((v): v is string => !!v))]
  if (purchaseItemIds.length > 0) {
    const { data: items } = await supabaseAdmin
      .from('purchase_items')
      .select('id, purchases!inner(tenant_id)')
      .in('id', purchaseItemIds)
      .eq('purchases.tenant_id', ctx.tid)
    const foundIds = new Set((items ?? []).map((i: { id: string }) => i.id))
    const manquantsPI = purchaseItemIds.filter(id => !foundIds.has(id))
    if (manquantsPI.length > 0) {
      return NextResponse.json({ error: `purchase_item_id introuvable(s) pour ce tenant : ${manquantsPI.join(', ')}` }, { status: 403 })
    }
  }

  // ── Calcul fiscal central — jamais de taux local (0.18/0.05/0.189 interdits) ─
  const totalTTC = lignes.reduce((s, l) => {
    const p = produitsById.get(l.produit_id)!
    return s + l.qte * Number(p.prix_vente ?? 0)
  }, 0)
  const { ht: montantHT, tva: montantTVA, ca: montantCA } = decomposerTTCUnifie(totalTTC, 'CG')

  const coutMarchandises = lignes.reduce((s, l) => {
    const p = produitsById.get(l.produit_id)!
    return s + l.qte * Number(p.prix_achat ?? 0)
  }, 0)

  const statutPaiement = mode_paiement === 'credit' ? 'du' : 'paye'

  // ── Point transactionnel unique (C6-POST-REVIEW-FIX, anomalie A1) : vente +
  //    lignes + fn_stock_move×N + comptabilité dans UN appel RPC. Idempotence
  //    gérée À L'INTÉRIEUR de la fonction (INSERT + ON CONFLICT, jamais un
  //    SELECT préalable non protégé) — `replay` distingue une vente neuve
  //    d'un retour sur une tentative déjà aboutie, sans effet dupliqué.
  const { data: result, error: rpcErr } = await supabaseAdmin
    .rpc('fn_create_vente_atomique', {
      p_tenant_id:         ctx.tid,
      p_lignes: lignes.map(l => {
        const p = produitsById.get(l.produit_id)!
        return {
          produit_id:        l.produit_id,
          produit_nom:       p.nom,
          qte:               l.qte,
          prix:              p.prix_vente,
          sous_total:        l.qte * Number(p.prix_vente ?? 0),
          origine:           l.origine ?? null,
          purchase_item_id:  l.purchase_item_id ?? null,
        }
      }),
      p_mode_paiement:     mode_paiement,
      p_statut_paiement:   statutPaiement,
      p_destinataire:      destinataire?.trim() || null,
      p_warehouse_id:      warehouse_id ?? null,
      p_idempotency_key:   idempotency_key ?? null,
      p_total_ttc:         totalTTC,
      p_montant_ht:        montantHT,
      p_montant_tva:       montantTVA,
      p_montant_ca:        montantCA,
      p_cout_marchandises: coutMarchandises,
      p_country_code:      'CG',
      p_event_date:        new Date().toISOString().split('T')[0],
      p_fiscal_year:       new Date().getFullYear(),
    })

  if (rpcErr) {
    // Toute défaillance (stock insuffisant, origine/purchase_item_id invalide,
    // comptabilisation VTE-001 non aboutie) annule la transaction entière —
    // aucune vente, ligne, ou mouvement de stock partiel ne subsiste.
    return NextResponse.json({ error: rpcErr.message }, { status: 409 })
  }

  const row = Array.isArray(result) ? result[0] : result
  const { vente_id, replay } = row as { vente_id: string; replay: boolean }
  const { data: full } = await supabaseAdmin
    .from('ventes').select('*, vente_lignes(*)').eq('id', vente_id).single()

  return NextResponse.json({ data: full, replay }, { status: replay ? 200 : 201 })
}

// GET /api/sales — liste paginée, filtrée par tenant.
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200)

  const { data, error } = await supabaseAdmin
    .from('ventes')
    .select('*')
    .eq('tenant_id', ctx.tid)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}
