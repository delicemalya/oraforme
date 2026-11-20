import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'
import { lignesModifiables, prixUnitaireHTDepuisTTC, TYPES_LIGNE, type StatutOrdre, type TypeLigne } from '@/lib/garage/ordres'

type Params = { params: Promise<{ id: string }> }

async function ordreModifiable(id: string, tid: string) {
  const { data: ordre } = await supabaseAdmin
    .from('garage_ordres').select('id, statut').eq('id', id).eq('tenant_id', tid).maybeSingle()
  if (!ordre) return { erreur: NextResponse.json({ error: 'Ordre introuvable' }, { status: 404 }) }
  if (!lignesModifiables(ordre.statut as StatutOrdre)) {
    return { erreur: NextResponse.json({ error: 'Lignes verrouillées : travaux terminés ou OR facturé' }, { status: 409 }) }
  }
  return { erreur: null }
}

// POST /api/garage/ordres/[id]/lignes — ajouter une pièce ou de la main-d'œuvre (prix HT)
export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error
  const { id } = await params

  const { erreur } = await ordreModifiable(id, ctx.tid)
  if (erreur) return erreur

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })

  const type = body.type as TypeLigne
  if (!(TYPES_LIGNE as readonly string[]).includes(type)) {
    return NextResponse.json({ error: 'type attendu : piece ou main_oeuvre' }, { status: 400 })
  }
  const quantite = Number(body.quantite)
  if (!Number.isFinite(quantite) || quantite <= 0) {
    return NextResponse.json({ error: 'Quantité > 0 requise' }, { status: 400 })
  }

  let description = typeof body.description === 'string' ? body.description.trim() : ''
  let prixUnitaire = body.prix_unitaire != null && body.prix_unitaire !== '' ? Number(body.prix_unitaire) : NaN
  let productId: string | null = null

  if (type === 'piece') {
    if (!body.product_id) return NextResponse.json({ error: 'Une pièce doit être choisie dans le stock' }, { status: 400 })
    // Produit et prix lus côté serveur, jamais acceptés du client sans contrôle.
    const { data: produit } = await supabaseAdmin
      .from('products').select('id, nom, prix_vente').eq('id', body.product_id).eq('tenant_id', ctx.tid).maybeSingle()
    if (!produit) return NextResponse.json({ error: 'Pièce introuvable pour ce tenant' }, { status: 403 })
    productId = produit.id
    if (!description) description = produit.nom
    if (!Number.isFinite(prixUnitaire)) prixUnitaire = prixUnitaireHTDepuisTTC(Number(produit.prix_vente))
  }

  if (!description) return NextResponse.json({ error: 'Description requise' }, { status: 400 })
  if (!Number.isFinite(prixUnitaire) || prixUnitaire < 0) {
    return NextResponse.json({ error: 'Prix unitaire HT invalide' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('garage_ordre_lignes')
    .insert({
      tenant_id:     ctx.tid,
      ordre_id:      id,
      type,
      product_id:    productId,
      description,
      quantite,
      prix_unitaire: prixUnitaire,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

// DELETE /api/garage/ordres/[id]/lignes?ligne_id=… — retirer une ligne
export async function DELETE(req: NextRequest, { params }: Params) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error
  const { id } = await params

  const ligneId = new URL(req.url).searchParams.get('ligne_id')
  if (!ligneId) return NextResponse.json({ error: 'ligne_id requis' }, { status: 400 })

  const { erreur } = await ordreModifiable(id, ctx.tid)
  if (erreur) return erreur

  const { error, count } = await supabaseAdmin
    .from('garage_ordre_lignes').delete({ count: 'exact' })
    .eq('id', ligneId).eq('ordre_id', id).eq('tenant_id', ctx.tid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!count) return NextResponse.json({ error: 'Ligne introuvable' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
