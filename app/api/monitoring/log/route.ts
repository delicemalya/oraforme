import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'

export const runtime = 'nodejs'

/**
 * Identité de l'auteur du log, dérivée de la session — jamais du corps de requête.
 * §22.1 : la route est anonyme par conception (les error boundaries de la landing
 * doivent pouvoir écrire), mais elle acceptait un `tenant_id` et un `user_id`
 * fournis par l'appelant, avec un client service_role : n'importe qui pouvait
 * insérer des journaux d'audit attribués à n'importe quel tenant.
 * Une erreur anonyme est désormais journalisée sans tenant, pas sous un faux.
 */
async function resolveAuthor(): Promise<{ tenant_id: string | null; user_id: string | null }> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { tenant_id: null, user_id: null }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    return { tenant_id: profile?.tenant_id ?? null, user_id: user.id }
  } catch {
    return { tenant_id: null, user_id: null }
  }
}

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, RATE_LIMITS.webhook)
  if (limited) return limited

  try {
    const body = await req.json()
    const { level, message, module, data, duration_ms, timestamp } = body

    if (!level || !message) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Persiste uniquement les niveaux error et critical
    if (level !== 'error' && level !== 'critical') {
      return NextResponse.json({ ok: true })
    }

    const author = await resolveAuthor()

    await supabaseAdmin.from('error_logs').insert({
      level,
      message,
      module:      module ?? null,
      tenant_id:   author.tenant_id,
      user_id:     author.user_id,
      data:        data ?? null,
      duration_ms: duration_ms ?? null,
      occurred_at: timestamp ?? new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  } catch {
    // Ne jamais retourner d'erreur 500 pour le monitoring
    return NextResponse.json({ ok: true })
  }
}
