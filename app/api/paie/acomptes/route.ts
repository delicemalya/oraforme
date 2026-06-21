import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'

// POST /api/paie/acomptes — insert acompte via service_role (bypasses RLS)
export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const body = await req.json()
  const { employe_id, montant, date_acompte, mois_impute, annee_imputee, notes } = body

  if (!employe_id || !montant || montant <= 0) {
    return NextResponse.json({ error: 'employe_id et montant requis' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('acomptes_salaires').insert({
    tenant_id:    ctx.tid,
    employe_id,
    montant,
    date_acompte: date_acompte ?? new Date().toISOString().split('T')[0],
    mois_impute:  mois_impute  ?? null,
    annee_imputee: annee_imputee ?? null,
    statut:       'en_attente',
    notes:        notes || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
