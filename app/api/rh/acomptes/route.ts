import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hrAuth } from '../../hr/_auth'

export const dynamic = 'force-dynamic'

/* ─────────────────────────────────────────────────────────────────────────────
 * GET /api/rh/acomptes?employe_id=…&mois=5&annee=2026
 * Liste les acomptes d'un employé ou du tenant
 * ─────────────────────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const employe_id = searchParams.get('employe_id')
  const mois       = searchParams.get('mois')
  const annee      = searchParams.get('annee')

  let q = supabaseAdmin
    .from('acomptes_salaires')
    .select('*, employes(nom, matricule, poste)')
    .eq('tenant_id', auth.tenantId)
    .order('date_acompte', { ascending: false })
    .limit(200)

  if (employe_id) q = q.eq('employe_id', employe_id)
  if (mois)       q = q.eq('mois_impute', parseInt(mois))
  if (annee)      q = q.eq('annee_imputee', parseInt(annee))

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/rh/acomptes
 * Crée un acompte + écriture comptable SYSCOHADA (compte 421)
 *
 * SYSCOHADA OHADA :
 *   Débit  421 Acomptes sur salaires versés    ← décaissement côté employé
 *   Crédit 521/571/541 selon mode paiement     ← trésorerie débitée
 * ─────────────────────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const auth = await hrAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { employe_id, montant, date_acompte, mois_impute, annee_imputee, notes, mode_paiement } = body

  if (!employe_id || !montant || !date_acompte) {
    return NextResponse.json({ error: 'employe_id, montant et date_acompte requis' }, { status: 400 })
  }
  if (Number(montant) <= 0) {
    return NextResponse.json({ error: 'Le montant doit être positif' }, { status: 400 })
  }

  // Vérifier l'employé
  const { data: emp } = await supabaseAdmin
    .from('employes')
    .select('id, nom, matricule, salaire_base, statut')
    .eq('id', employe_id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()

  if (!emp) return NextResponse.json({ error: 'Employé introuvable' }, { status: 404 })
  if (emp.statut === 'licencie' || emp.statut === 'retraite') {
    return NextResponse.json({ error: `Acompte impossible pour employé ${emp.statut}` }, { status: 400 })
  }

  const numMontant   = Number(montant)
  const now          = new Date()
  const moisImpute   = mois_impute   ?? (now.getMonth() + 1)
  const anneeImputee = annee_imputee ?? now.getFullYear()

  // Insérer l'acompte
  const { data: acompte, error: aErr } = await supabaseAdmin
    .from('acomptes_salaires')
    .insert({
      tenant_id:     auth.tenantId,
      employe_id,
      montant:       numMontant,
      date_acompte,
      mois_impute:   moisImpute,
      annee_imputee: anneeImputee,
      statut:        'en_attente',
      notes:         notes || null,
      created_by:    auth.user.id,
    })
    .select()
    .single()

  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })

  const MOIS_LABELS = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const moisLabel   = MOIS_LABELS[moisImpute] ?? `M${moisImpute}`
  const libelle     = `Acompte ${moisLabel} ${anneeImputee} — ${emp.nom}`
  const fiscalYear  = new Date(date_acompte).getFullYear()

  // PAI-003 — Acompte sur salaire (moteur comptable central, migration 141)
  // Remplace les inserts directs dans journal_comptable et journal_entries
  await supabaseAdmin.rpc('emit_accounting_event', {
    p_tenant_id:     auth.tenantId,
    p_event_type:    'PAI-003',
    p_source_module: 'paie',
    p_source_table:  'acomptes_salaires',
    p_source_id:     acompte.id,
    p_montant_ht:    numMontant,
    p_montant_tva:   0,
    p_montant_ttc:   numMontant,
    p_libelle:       libelle,
    p_date_event:    date_acompte,
    p_fiscal_year:   fiscalYear,
    p_metadata: {
      employe_nom:   emp.nom,
      mois_impute:   moisImpute,
      annee_imputee: anneeImputee,
      mode_paiement: mode_paiement ?? 'virement',
    },
  })

  return NextResponse.json({ success: true, data: acompte }, { status: 201 })
}
