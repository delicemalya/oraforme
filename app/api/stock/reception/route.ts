import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

interface ReceptionLine {
  product_id:       string
  quantite_attendue: number
  quantite_recue:   number
  prix_unitaire:    number
  conformite:       string
}

// ── POST /api/stock/reception ────────────────────────────────────────────────
// Crée une réception complète + émet STK-001 (311/401 HT SYSCOHADA)
// Remplace : writeComptaEntry() legacy dans receptions/page.tsx
// Fixe : bugs 'quantity' → 'quantite' et 'notes' → 'note' dans stock_movements
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const {
    purchase_order_id,
    supplier_id,
    warehouse_id,
    date_reception,
    notes,
    lines,
  }: {
    purchase_order_id?: string | null
    supplier_id?:       string | null
    warehouse_id?:      string | null
    date_reception?:    string
    notes?:             string | null
    lines:              ReceptionLine[]
  } = body

  const validLines = (lines || []).filter(l => l.product_id && l.quantite_recue > 0)
  if (validLines.length === 0) {
    return NextResponse.json({ error: 'Au moins un article requis' }, { status: 400 })
  }

  // Générer numéro réception côté serveur
  const { count } = await supabaseAdmin
    .from('stock_receptions')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', ctx.tenantId)

  const annee  = new Date().getFullYear()
  const numero = `REC-${annee}-${String((count ?? 0) + 1).padStart(4, '0')}`
  const dateRec = date_reception || new Date().toISOString().split('T')[0]

  // 1. Créer l'entête réception
  const { data: rec, error: recErr } = await supabaseAdmin
    .from('stock_receptions')
    .insert({
      tenant_id:        ctx.tenantId,
      numero,
      purchase_order_id: purchase_order_id || null,
      supplier_id:      supplier_id       || null,
      warehouse_id:     warehouse_id      || null,
      date_reception:   dateRec,
      statut:           'validé',
      notes:            notes             || null,
    })
    .select('id')
    .single()

  if (recErr) return NextResponse.json({ error: recErr.message }, { status: 500 })

  // 2. Créer les lignes réception
  const { error: itemsErr } = await supabaseAdmin
    .from('stock_reception_items')
    .insert(
      validLines.map(l => ({
        reception_id:       rec.id,
        product_id:         l.product_id,
        quantite_attendue:  l.quantite_attendue,
        quantite_recue:     l.quantite_recue,
        prix_unitaire:      l.prix_unitaire,
        conformite:         l.conformite || 'conforme',
      }))
    )

  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })

  // 3. Mettre à jour le stock + créer les mouvements pour chaque ligne
  for (const l of validLines) {
    const { error: mvtErr } = await supabaseAdmin.rpc('fn_stock_move', {
      p_tenant_id:    ctx.tenantId,
      p_product_id:   l.product_id,
      p_type:         'reception',
      p_quantite:     l.quantite_recue,
      p_warehouse_id: warehouse_id || null,
      p_unit_cost:    l.prix_unitaire ?? 0,
      p_reference:    numero,
      p_notes:        `Réception ${numero}`,
    })
    if (mvtErr) return NextResponse.json({ error: mvtErr.message }, { status: 500 })
  }

  // 4. Émettre STK-001 — Entrée stock (311/401 HT) — fire-and-forget P-003
  const montantHT = validLines.reduce((s, l) => s + l.quantite_recue * l.prix_unitaire, 0)

  if (montantHT > 0) {
    await supabaseAdmin.rpc('emit_accounting_event', {
      p_tenant_id:     ctx.tenantId,
      p_event_type:    'STK-001',
      p_source_module: 'stocks',
      p_source_table:  'stock_receptions',
      p_source_id:     rec.id,
      p_montant_ht:    montantHT,
      p_montant_tva:   0,
      p_montant_ttc:   montantHT,
      p_libelle:       `Réception marchandises ${numero}`,
      p_date_event:    dateRec,
      p_fiscal_year:   new Date(dateRec).getFullYear(),
      p_metadata:      {
        supplier_id:      supplier_id      || null,
        warehouse_id:     warehouse_id     || null,
        purchase_order_id: purchase_order_id || null,
        nb_lignes:        validLines.length,
        numero,
      },
    })
  }

  return NextResponse.json({ id: rec.id, numero }, { status: 201 })
}
