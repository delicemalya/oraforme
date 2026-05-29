import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { level, message, module, tenant_id, user_id, data, duration_ms, timestamp } = body

    if (!level || !message) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Persiste uniquement les niveaux error et critical
    if (level !== 'error' && level !== 'critical') {
      return NextResponse.json({ ok: true })
    }

    await supabaseAdmin.from('error_logs').insert({
      level,
      message,
      module:      module ?? null,
      tenant_id:   tenant_id ?? null,
      user_id:     user_id ?? null,
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
