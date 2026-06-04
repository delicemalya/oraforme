import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { supabaseAdmin } from '@/lib/supabase-server'

/**
 * GET /api/debug/db-check
 * Teste si l'utilisateur courant peut lire et écrire dans sa base.
 * Supprime l'enregistrement de test immédiatement après.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 })
  }

  // 1. Vérifier le profil
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (profileErr || !profile?.tenant_id) {
    return NextResponse.json({
      ok:     false,
      error:  'Profil ou tenant_id introuvable',
      detail: profileErr?.message,
      user_id: user.id,
    })
  }

  const tenantId = profile.tenant_id

  // 2. Test SELECT clients (table avec RLS depuis 001)
  const { data: clientsRead, error: clientsReadErr } = await supabaseAdmin
    .from('clients')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1)

  // 3. Test SELECT transactions
  const { data: txRead, error: txReadErr } = await supabaseAdmin
    .from('transactions')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1)

  // 4. Test INSERT + DELETE sur clients (via supabaseAdmin = bypass RLS)
  const testNom = `__test_${Date.now()}`
  const { data: insertTest, error: insertErr } = await supabaseAdmin
    .from('clients')
    .insert({ tenant_id: tenantId, nom: testNom })
    .select('id')
    .single()

  let deleteOk = false
  if (insertTest?.id) {
    const { error: delErr } = await supabaseAdmin
      .from('clients')
      .delete()
      .eq('id', insertTest.id)
    deleteOk = !delErr
  }

  // 5. Vérifier get_my_tenant_id() via RPC
  const { data: fnResult, error: fnErr } = await supabaseAdmin
    .rpc('get_my_tenant_id')
    .single()

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email },
    tenant: { id: tenantId, role: profile.role },
    tests: {
      clients_select:   { ok: !clientsReadErr, count: clientsRead?.length ?? 0, error: clientsReadErr?.message },
      transactions_select: { ok: !txReadErr, count: txRead?.length ?? 0, error: txReadErr?.message },
      admin_insert:     { ok: !insertErr, error: insertErr?.message },
      admin_delete:     { ok: deleteOk },
      rpc_tenant_id:    { ok: !fnErr, result: fnResult, error: fnErr?.message },
    },
    instructions: 'Si admin_insert=ok mais un formulaire ne sauvegarde pas, le problème est les RLS côté client. Exécuter 067_rls_all_tenant_tables.sql dans Supabase.',
  })
}
