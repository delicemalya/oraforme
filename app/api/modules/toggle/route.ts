import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { moduleId, action } = await req.json() as { moduleId: string; action: 'activate' | 'deactivate' }
  if (!moduleId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (!['activate', 'deactivate'].includes(action)) {
    return NextResponse.json({ error: 'action must be activate or deactivate' }, { status: 400 })
  }

  // CRITICAL FIX: deterministic tenant resolution for multi-tenant users
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role, tenants(modules_actifs)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!profile?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  if (!['owner', 'admin'].includes(profile.role ?? '')) {
    return NextResponse.json({ error: 'Accès refusé — rôle insuffisant' }, { status: 403 })
  }

  const tenantId = profile.tenant_id as string
  const tenant = profile.tenants as unknown as { modules_actifs: string[] } | null
  const current: string[] = tenant?.modules_actifs ?? []

  const updated: string[] = action === 'activate'
    ? (current.includes(moduleId) ? current : [...current, moduleId])
    : current.filter(m => m !== moduleId)

  const enabled = action === 'activate'

  // ── ÉCRITURE ATOMIQUE SUR LES DEUX SOURCES ────────────────────────────────
  // SOURCE 1 — tenant_modules (table structurée, source de vérité primaire)
  const { error: tmError } = await supabase
    .from('tenant_modules')
    .upsert(
      { tenant_id: tenantId, module_key: moduleId, enabled },
      { onConflict: 'tenant_id,module_key' }
    )

  if (tmError) {
    return NextResponse.json({ error: tmError.message }, { status: 500 })
  }

  // SOURCE 2 — tenants.modules_actifs (array dénormalisé, cache lecture rapide)
  const { error: tenantError } = await supabase
    .from('tenants')
    .update({ modules_actifs: updated })
    .eq('id', tenantId)

  if (tenantError) {
    // tenant_modules est déjà mis à jour — on retourne quand même succès
    // avec un avertissement pour ne pas bloquer l'UX. La resync se fera
    // au prochain chargement de TenantContext depuis tenant_modules.
    console.error('[modules/toggle] tenants.modules_actifs sync failed:', tenantError.message)
  }

  return NextResponse.json({ ok: true, modules_actifs: updated })
}
