import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'

// POST /api/automation/run
// Called by cron job or on-demand to run automation checks for the caller's tenant
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  let tenantId: string | null = null

  if (user) {
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('tenant_id, role').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (profile?.tenant_id) tenantId = profile.tenant_id
  } else {
    // Allow cron calls with service-key header
    const secret = req.headers.get('x-automation-secret')
    if (secret !== process.env.AUTOMATION_SECRET) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    const body = await req.json().catch(() => ({}))
    tenantId = body.tenant_id ?? null
  }

  if (!tenantId) return NextResponse.json({ error: 'tenant_id requis' }, { status: 400 })

  const { data, error } = await supabaseAdmin.rpc('fn_run_automation_checks', {
    p_tenant_id: tenantId,
  })

  if (error) {
    console.error('automation run error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, result: data })
}
