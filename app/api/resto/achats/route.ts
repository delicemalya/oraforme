import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

interface AchatLigne {
  article_id?: string
  article_nom: string
  quantite: number
  prix_unitaire: number
}

async function getAuth() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('tenant_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
  return profile?.tenant_id ? { tenantId: profile.tenant_id as string } : null
}

export async function GET() {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('resto_achats')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { fournisseur_nom, date_achat, mode_paiement, note, lignes } = body

  if (!fournisseur_nom?.trim()) return NextResponse.json({ error: 'Fournisseur requis' }, { status: 400 })
  if (!lignes?.length)          return NextResponse.json({ error: 'Aucune ligne' }, { status: 400 })

  const validLignes: AchatLigne[] = (lignes as AchatLigne[]).filter(l => l.article_nom?.trim() && l.quantite > 0)
  if (!validLignes.length) return NextResponse.json({ error: 'Lignes invalides' }, { status: 400 })

  const total = Math.round(validLignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0))
  const dateAchat = date_achat || new Date().toISOString().split('T')[0]

  // Créer l'achat
  const { data: achat, error: achatErr } = await supabaseAdmin
    .from('resto_achats')
    .insert({
      tenant_id:       auth.tenantId,
      fournisseur_nom: fournisseur_nom.trim(),
      date_achat:      dateAchat,
      total,
      mode_paiement:   mode_paiement || 'especes',
      note:            note || null,
      lignes:          validLignes,
    })
    .select('id')
    .single()

  if (achatErr) return NextResponse.json({ error: achatErr.message }, { status: 500 })

  // Augmenter le stock pour chaque article lié
  for (const ligne of validLignes) {
    if (!ligne.article_id) continue
    const { data: article } = await supabaseAdmin
      .from('stock_articles')
      .select('quantite')
      .eq('id', ligne.article_id)
      .eq('tenant_id', auth.tenantId)
      .single()
    if (!article) continue
    await supabaseAdmin
      .from('stock_articles')
      .update({ quantite: Number(article.quantite) + ligne.quantite })
      .eq('id', ligne.article_id)
      .eq('tenant_id', auth.tenantId)
  }

  // RES-002 — Achat matières restaurant (moteur comptable central, migration 142)
  await supabaseAdmin.rpc('emit_accounting_event', {
    p_tenant_id:     auth.tenantId,
    p_event_type:    'RES-002',
    p_source_module: 'restaurant',
    p_source_table:  'resto_achats',
    p_source_id:     achat.id,
    p_montant_ht:    total,
    p_montant_tva:   0,
    p_montant_ttc:   total,
    p_libelle:       `Achat matières — ${fournisseur_nom.trim()}${note ? ` — ${note}` : ''}`,
    p_date_event:    dateAchat,
    p_fiscal_year:   new Date(dateAchat).getFullYear(),
    p_metadata: {
      fournisseur_nom: fournisseur_nom.trim(),
      mode_paiement:   mode_paiement || 'especes',
      nb_lignes:       validLignes.length,
    },
  })

  return NextResponse.json({ success: true, data: { id: achat.id, total } }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('resto_achats')
    .delete()
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
