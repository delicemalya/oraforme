import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'
import { genererNumeroRecu } from '@/lib/receipts'
import { calculerTVACongo } from '@/lib/fiscalite-congo'

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const tenantId = ctx.tenantId
  const body = await req.json()
  const { items, table_num, mode, mode_paiement, reference } = body

  if (!items?.length) return NextResponse.json({ error: 'Panier vide' }, { status: 400 })

  const sousTotal = items.reduce((s: number, it: { prix: number; quantite: number }) => s + it.prix * it.quantite, 0)
  const fiscal = calculerTVACongo(sousTotal)

  // Numéro de reçu séquentiel
  const { count } = await supabaseAdmin
    .from('resto_commandes').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  const numeroRecu = genererNumeroRecu(count ?? 0)

  // Créer la commande
  const { data: commande, error: cmdErr } = await supabaseAdmin
    .from('resto_commandes')
    .insert({
      tenant_id:     tenantId,
      items,
      table_num:     table_num || null,
      mode:          mode || 'sur_place',
      total:         fiscal.ttc,
      statut:        'en_attente',
      source:        'caisse',
      paiement:      mode_paiement || 'especes',
      mode_paiement: mode_paiement || 'especes',
      numero_recu:   numeroRecu,
      reference:     reference || null,
    })
    .select('id, created_at')
    .single()

  if (cmdErr) return NextResponse.json({ error: cmdErr.message }, { status: 500 })

  // Déduire le stock via resto_recettes
  // All stock queries are filtered by tenant_id to prevent cross-tenant stock manipulation
  for (const it of items) {
    const { data: menuItem } = await supabaseAdmin
      .from('resto_menu')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('nom', it.nom)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (!menuItem) continue

    const { data: recettes } = await supabaseAdmin
      .from('resto_recettes')
      .select('article_id, quantite_par_portion')
      .eq('menu_item_id', menuItem.id)
    if (!recettes?.length) continue

    for (const recette of recettes) {
      if (!recette.article_id) continue

      // tenant_id filter is mandatory to prevent cross-tenant stock manipulation
      const { data: article } = await supabaseAdmin
        .from('stock_articles')
        .select('quantite')
        .eq('id', recette.article_id)
        .eq('tenant_id', tenantId)
        .maybeSingle()
      if (!article) continue

      const newQty = article.quantite - recette.quantite_par_portion * it.quantite
      await supabaseAdmin
        .from('stock_articles')
        .update({ quantite: Math.max(0, newQty) })
        .eq('id', recette.article_id)
        .eq('tenant_id', tenantId)
    }
  }

  // RES-001 — Vente POS restaurant (moteur comptable central, migration 142)
  await supabaseAdmin.rpc('emit_accounting_event', {
    p_tenant_id:     tenantId,
    p_event_type:    'RES-001',
    p_source_module: 'restaurant',
    p_source_table:  'resto_commandes',
    p_source_id:     commande.id,
    p_montant_ht:    fiscal.ht,
    p_montant_tva:   fiscal.tva + fiscal.ca,
    p_montant_ttc:   fiscal.ttc,
    p_libelle:       `Vente POS ${numeroRecu}${table_num ? ` — Table ${table_num}` : ''}`,
    p_date_event:    new Date().toISOString().split('T')[0],
    p_fiscal_year:   new Date().getFullYear(),
    p_metadata: {
      numero_recu:   numeroRecu,
      table_num:     table_num || null,
      mode:          mode || 'sur_place',
      mode_paiement: mode_paiement || 'especes',
      tva:           fiscal.tva,
      ca:            fiscal.ca,
    },
  })

  return NextResponse.json({ commandeId: commande.id, numeroRecu, fiscal })
}
