import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant, assertResourceOwnership } from '@/lib/tenant-guard'

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { product_id, warehouse_id, type, quantite, reference, note, origine, purchase_item_id } = await req.json()

  if (!product_id || !type || quantite == null) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }
  // Vocabulaire de la contrainte active (migrations 050 et 051) et des
  // 96 lignes de production. L'ancien jeu IN/OUT/TRANSFER/ADJUSTMENT n'est plus
  // accepté par la base depuis la 050.
  if (!['entree', 'sortie', 'reception', 'retour', 'ajustement', 'transfert'].includes(type)) {
    return NextResponse.json({ error: 'Type de mouvement invalide' }, { status: 400 })
  }
  // BOI-010 : origine optionnelle, jamais déduite. C'est notamment le point
  // d'entrée minimal pour une entrée de production locale — pas de module de
  // production, juste ce paramètre explicite sur le mouvement générique déjà
  // existant (aucune nouvelle table, aucun nouvel écran).
  if (origine != null && !['achat_fournisseur', 'production_locale', 'import_direct'].includes(origine)) {
    return NextResponse.json({ error: 'Origine invalide' }, { status: 400 })
  }

  // Verify the product belongs to the authenticated user's tenant
  const ownershipError = await assertResourceOwnership('products', product_id, ctx.tenantId)
  if (ownershipError) return ownershipError

  // Le contrôle anti-négatif et l'insertion se font sous verrou côté base
  // (fn_stock_move, migration 173) : deux sorties simultanées ne peuvent plus
  // passer sous zéro. Depuis BOI-010, si `origine` est fourni sur un
  // mouvement qui diminue le stock, ce même verrou refuse aussi de faire
  // passer le solde de CETTE provenance sous zéro — sans jamais basculer
  // automatiquement vers une autre provenance (choix manuel, BOI-009).
  const { data: moveId, error: insertError } = await supabaseAdmin.rpc('fn_stock_move', {
    p_tenant_id:        ctx.tenantId,
    p_product_id:       product_id,
    p_type:             type,
    p_quantite:         Number(quantite),
    p_warehouse_id:     warehouse_id ?? null,
    p_reference:        reference ?? null,
    p_notes:            note ?? null,
    p_origine:          origine ?? null,
    p_purchase_item_id: purchase_item_id ?? null,
  })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 422 })

  const data = { id: moveId as string }

  // Emit STK-002 — Sortie stock consommation (601/311 HT) — fire-and-forget P-003
  // Déclenchée sur 'sortie' : la règle visait 'OUT', valeur que la contrainte
  // n'autorise plus, donc aucun STK-002 n'était jamais émis.
  if (type === 'sortie') {
    const { data: prod } = await supabaseAdmin
      .from('products')
      .select('prix_achat')
      .eq('id', product_id)
      .single()

    const montantHT = (prod?.prix_achat ?? 0) * Number(quantite)
    if (montantHT > 0) {
      await supabaseAdmin.rpc('emit_accounting_event', {
        p_tenant_id:     ctx.tenantId,
        p_event_type:    'STK-002',
        p_source_module: 'stocks',
        p_source_table:  'stock_movements',
        p_source_id:     data.id,
        p_montant_ht:    montantHT,
        p_montant_tva:   0,
        p_montant_ttc:   montantHT,
        p_libelle:       `Sortie stock — ${reference ?? data.id}`,
        p_date_event:    new Date().toISOString().split('T')[0],
        p_fiscal_year:   new Date().getFullYear(),
        p_metadata:      { product_id, warehouse_id: warehouse_id ?? null, quantite: Number(quantite), reference: reference ?? null },
      })
    }
  }

  return NextResponse.json({ success: true, data })
}
