import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { moduleId, action } = await req.json() as { moduleId: string; action: 'activate' | 'deactivate' }
  if (!moduleId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role, tenants(modules_actifs)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  if (!['owner', 'admin'].includes(profile.role ?? '')) {
    return NextResponse.json({ error: 'Accès refusé — rôle insuffisant' }, { status: 403 })
  }

  const tenant = profile.tenants as unknown as { modules_actifs: string[] } | null
  const current: string[] = tenant?.modules_actifs ?? []

  let updated: string[]
  if (action === 'activate') {
    updated = current.includes(moduleId) ? current : [...current, moduleId]
  } else {
    updated = current.filter(m => m !== moduleId)
  }

  const { error } = await supabase
    .from('tenants')
    .update({ modules_actifs: updated })
    .eq('id', profile.tenant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, modules_actifs: updated })
}
