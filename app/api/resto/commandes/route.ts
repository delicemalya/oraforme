import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { genererNumeroRecu } from '@/lib/receipts'
import { calculerTVACongo } from '@/lib/fiscalite-congo'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('tenant_id').eq('user_id', user.id).maybeSingle()
  if (!profile?.tenant_id) return NextResponse.json({ error: 'Profil introuvable' }, { status: 400 })

  const tenantId = profile.tenant_id
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
  for (const it of items) {
    const { data: menuItem } = await supabaseAdmin
      .from('resto_menu').select('id').eq('tenant_id', tenantId).eq('nom', it.nom).maybeSingle()
    if (!menuItem) continue
    const { data: recettes } = await supabaseAdmin
      .from('resto_recettes')
      .select('article_id, quantite_par_portion')
      .eq('menu_item_id', menuItem.id)
    if (!recettes?.length) continue
    for (const recette of recettes) {
      if (!recette.article_id) continue
      const { data: article } = await supabaseAdmin
        .from('stock_articles').select('quantite').eq('id', recette.article_id).single()
      if (!article) continue
      const newQty = article.quantite - recette.quantite_par_portion * it.quantite
      await supabaseAdmin
        .from('stock_articles')
        .update({ quantite: Math.max(0, newQty) })
        .eq('id', recette.article_id)
    }
  }

  // Créer une transaction en trésorerie
  await supabaseAdmin.from('transactions').insert({
    tenant_id:     tenantId,
    type:          'entree',
    categorie:     'Vente restaurant',
    description:   `Commande ${numeroRecu}${table_num ? ` — Table ${table_num}` : ''}`,
    montant:       fiscal.ttc,
    mode_paiement: mode_paiement || 'especes',
    source:        'pos',
    source_id:     commande.id,
    date:          new Date().toISOString().split('T')[0],
    reference:     reference || null,
  })

  return NextResponse.json({ commandeId: commande.id, numeroRecu, fiscal })
}
