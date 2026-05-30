import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/fiscalite/declarations/[id] — mettre à jour statut/paiement
export async function PATCH(req: NextRequest, { params }: Params) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body invalide' }, { status: 400 })

  const allowed = ['statut', 'montant_paye', 'date_depot', 'date_paiement', 'reference_depot', 'penalites', 'notes']
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  const { data, error } = await supabaseAdmin
    .from('fiscal_declarations')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', ctx.tid)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'Déclaration introuvable' }, { status: 404 })
  return NextResponse.json({ declaration: data })
}

// DELETE
export async function DELETE(req: NextRequest, { params }: Params) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const { id } = await params
  await supabaseAdmin.from('fiscal_declarations').delete().eq('id', id).eq('tenant_id', ctx.tid)
  return NextResponse.json({ ok: true })
}
