import { createClient } from '@supabase/supabase-js'
import { genererNotifications, sauvegarderNotifications } from '@/lib/miaa/notifications'

export const runtime = 'nodejs'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const tenantId = searchParams.get('tenant_id')
  if (!tenantId) return Response.json({ notifications: [] })

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
  const { tenant_id, notification_id, action } = await req.json()
  if (!tenant_id || !notification_id) return Response.json({ ok: false }, { status: 400 })

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
