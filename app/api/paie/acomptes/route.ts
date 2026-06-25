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

  const effectiveDate    = date_acompte ?? new Date().toISOString().split('T')[0]
  const effectiveMois    = mois_impute   ?? null
  const effectiveAnnee   = annee_imputee ?? null

  const { data: acompte, error } = await supabaseAdmin
    .from('acomptes_salaires')
    .insert({
      tenant_id:     ctx.tid,
      employe_id,
      montant,
      date_acompte:  effectiveDate,
      mois_impute:   effectiveMois,
      annee_imputee: effectiveAnnee,
      statut:        'en_attente',
      notes:         notes || null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Nom de l'employé pour libellé comptable
  const { data: emp } = await supabaseAdmin
    .from('employes')
    .select('nom')
    .eq('id', employe_id)
    .eq('tenant_id', ctx.tid)
    .maybeSingle()

  const MOIS_LABELS = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const moisLabel   = effectiveMois ? (MOIS_LABELS[effectiveMois] ?? `M${effectiveMois}`) : '—'
  const anneeLabel  = effectiveAnnee ?? new Date(effectiveDate).getFullYear()
  const employeNom  = emp?.nom ?? 'Employé'
  const fiscalYear  = new Date(effectiveDate).getFullYear()

  // PAI-003 — Acompte sur salaire (moteur comptable central, migration 141)
  await supabaseAdmin.rpc('emit_accounting_event', {
    p_tenant_id:     ctx.tid,
    p_event_type:    'PAI-003',
    p_source_module: 'paie',
    p_source_table:  'acomptes_salaires',
    p_source_id:     acompte.id,
    p_montant_ht:    Number(montant),
    p_montant_tva:   0,
    p_montant_ttc:   Number(montant),
    p_libelle:       `Acompte ${moisLabel} ${anneeLabel} — ${employeNom}`,
    p_date_event:    effectiveDate,
    p_fiscal_year:   fiscalYear,
    p_metadata: {
      employe_nom:   employeNom,
      mois_impute:   effectiveMois,
      annee_imputee: effectiveAnnee,
      mode_paiement: 'virement',
    },
  })

  return NextResponse.json({ ok: true })
}
