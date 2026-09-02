import { createClient } from '@supabase/supabase-js'
import { genererNotifications, sauvegarderNotifications } from '@/lib/miaa/notifications'
import { requireTenant } from '@/lib/api/require-tenant'

export const runtime = 'nodejs'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ANO-C05 — le tenant est dérivé de la session, jamais de la query string.
// Cette route était dans AUTOMATION_PATHS (proxy.ts) et acceptait un tenant_id
// arbitraire d'un appelant anonyme : lecture ET écriture sur n'importe quel tenant.
export async function GET(_req: Request) {
  const ctx = await requireTenant()
  if (!ctx.ok) return ctx.error
  const tenantId = ctx.tid

  const supabase = getSupabase()

  // Essayer de récupérer les notifs sauvegardées
  const { data: saved } = await supabase
    .from('miaa_notifications')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('lu', false)
    .order('created_at', { ascending: false })
    .limit(20)

  // Toujours regénérer les alertes fraîches
  const fresh = await genererNotifications(supabase, tenantId)
  await sauvegarderNotifications(supabase, tenantId, fresh)

  // Fusionner : fraîches d'abord, puis les sauvegardées non-dupliquées
  const ids = new Set(fresh.map(n => n.id))
  const merged = [
    ...fresh,
    ...(saved ?? []).filter(n => !ids.has(n.id)),
  ]

  return Response.json({ notifications: merged, count: merged.length })
}

export async function POST(req: Request) {
  const ctx = await requireTenant()
  if (!ctx.ok) return ctx.error
  const tenant_id = ctx.tid

  const { notification_id, action } = await req.json()
  if (!notification_id) return Response.json({ ok: false }, { status: 400 })

  const supabase = getSupabase()

  if (action === 'marquer_lu') {
    await supabase.from('miaa_notifications')
      .update({ lu: true })
      .eq('id', notification_id)
      .eq('tenant_id', tenant_id)
  } else if (action === 'tout_lire') {
    await supabase.from('miaa_notifications')
      .update({ lu: true })
      .eq('tenant_id', tenant_id)
  }

  return Response.json({ ok: true })
}
