import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'

export async function POST(req: NextRequest) {
  try {
    // Authenticate caller and resolve their tenant
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles').select('tenant_id').eq('user_id', user.id).maybeSingle()
    if (!callerProfile?.tenant_id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const body = await req.json()
    const { id } = body as { id?: string }

    if (!id) {
      return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 })
    }

    const { data: facture, error: fetchErr } = await supabaseAdmin
      .from('factures')
      .select('id, invoice_number, client_email, client_name, tenant_id, statut')
      .eq('id', id)
      .eq('tenant_id', callerProfile.tenant_id)
      .single()

    if (fetchErr || !facture) {
      return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
    }

    const { error: updateErr } = await supabaseAdmin
      .from('factures')
      .update({ statut: 'envoye' })
      .eq('id', id)
      .eq('tenant_id', callerProfile.tenant_id)

    if (updateErr) {
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }

    return NextResponse.json({
      success:  true,
      message:  `Facture ${facture.invoice_number} marquée comme envoyée`,
      sent_to:  facture.client_email ?? null,
    })
  } catch (err) {
    console.error('Send invoice error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
