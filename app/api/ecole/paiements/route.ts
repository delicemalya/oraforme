import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const tenantId = ctx.tenantId
  const body = await req.json()
  const { etudiant_id, frais_id, libelle, montant, annee, methode, etudiant_nom } = body

  if (!etudiant_id || !libelle || !montant) {
    return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
  }

  const montantNum = Number(montant)
  if (isNaN(montantNum) || montantNum <= 0) {
    return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
  }

  const { data: paiement, error: err } = await supabaseAdmin
    .from('paiements_scolaires')
    .insert({
      tenant_id:   tenantId,
      etudiant_id,
      frais_id:    frais_id || null,
      libelle,
      montant:     montantNum,
      annee:       annee || new Date().getFullYear(),
      statut:      'paye',
      methode:     methode || 'especes',
    })
    .select()
    .single()

  if (err) return NextResponse.json({ error: err.message }, { status: 500 })

  // Emit ECO-001 (fire-and-forget — P-003)
  await supabaseAdmin.rpc('emit_accounting_event', {
    p_tenant_id:     tenantId,
    p_event_type:    'ECO-001',
    p_source_module: 'ecole',
    p_source_table:  'paiements_scolaires',
    p_source_id:     paiement.id,
    p_montant_ht:    montantNum,
    p_montant_tva:   0,
    p_montant_ttc:   montantNum,
    p_libelle:       `Frais scol. — ${libelle}${etudiant_nom ? ` — ${etudiant_nom}` : ''}`,
    p_date_event:    new Date().toISOString().split('T')[0],
    p_fiscal_year:   annee || new Date().getFullYear(),
    p_metadata:      {
      mode_paiement: methode || 'especes',
      libelle,
      etudiant_nom:  etudiant_nom || '',
    },
  })

  return NextResponse.json(paiement)
}
