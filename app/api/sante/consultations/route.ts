import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

// GET /api/sante/consultations
export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patient_id')
  const from      = searchParams.get('from')
  const to        = searchParams.get('to')

  let query = supabaseAdmin
    .from('clinique_consultations')
    .select('*, clinique_patients(nom, prenom, numero_dossier)', { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
    .order('date_consult', { ascending: false })
    .limit(200)

  if (patientId) query = query.eq('patient_id', patientId)
  if (from) query = query.gte('date_consult', from)
  if (to)   query = query.lte('date_consult', to)

  const { data, error: dbErr, count } = await query
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

// POST /api/sante/consultations
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const {
    patient_id, medecin_id, rdv_id, date_consult, motif,
    examen, diagnostic, traitement, ordonnance,
    pression_art, temperature, poids, taille,
    pouls, saturation_o2, frequence_resp, code_cim10,
    montant = 0, statut_paiement = 'en_attente',
  } = body

  if (!patient_id) return NextResponse.json({ error: 'patient_id requis' }, { status: 400 })
  if (!motif?.trim()) return NextResponse.json({ error: 'motif requis' }, { status: 400 })

  // Vérifier appartenance tenant
  const { data: patient } = await supabaseAdmin
    .from('clinique_patients')
    .select('id, nom, prenom')
    .eq('id', patient_id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (!patient) return NextResponse.json({ error: 'Patient introuvable' }, { status: 404 })

  // ── 1. Créer la consultation ──────────────────────────────────────────────
  const { data: consultation, error: insErr } = await supabaseAdmin
    .from('clinique_consultations')
    .insert({
      tenant_id:       ctx.tenantId,
      patient_id,
      medecin_id:      medecin_id    || null,
      rdv_id:          rdv_id        || null,
      date_consult:    date_consult  ?? new Date().toISOString(),
      motif:           motif.trim(),
      examen:          examen        || null,
      diagnostic:      diagnostic    || null,
      traitement:      traitement    || null,
      ordonnance:      ordonnance    || null,
      pression_art:    pression_art  || null,
      temperature:     temperature   ?? null,
      poids:           poids         ?? null,
      taille:          taille        ?? null,
      pouls:           pouls         ?? null,
      saturation_o2:   saturation_o2 ?? null,
      frequence_resp:  frequence_resp ?? null,
      code_cim10:      code_cim10    || null,
      montant,
      statut_paiement,
    })
    .select('id')
    .single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  // ── 2. BUG-C03 : Créer his_factures + his_lignes_facture si montant > 0 ──
  if (montant > 0) {
    const dateFacture = (date_consult ?? new Date().toISOString()).split('T')[0]

    const { data: facture, error: facErr } = await supabaseAdmin
      .from('his_factures')
      .insert({
        tenant_id:       ctx.tenantId,
        patient_id,
        consultation_id: consultation.id,
        medecin_id:      medecin_id || null,
        date_facture:    dateFacture,
        montant_total:   montant,
        montant_paye:    0,
        mode_paiement:   'especes',
        statut:          'en_attente',
      })
      .select('id')
      .single()

    if (!facErr && facture?.id) {
      await supabaseAdmin.from('his_lignes_facture').insert({
        tenant_id:     ctx.tenantId,
        facture_id:    facture.id,
        description:   `Consultation — ${motif.trim()}`,
        quantite:      1,
        prix_unitaire: montant,
        montant_ligne: montant,
        categorie:     'consultation',
      })

      // Paiement immédiat : UPDATE montant_paye → déclenche trg_his_facture_journal (OHADA)
      if (statut_paiement === 'paye') {
        await supabaseAdmin
          .from('his_factures')
          .update({ montant_paye: montant, statut: 'payee' })
          .eq('id', facture.id)
          .eq('tenant_id', ctx.tenantId)
      }
    }
  }

  // ── 3. Transaction trésorerie si paiement immédiat ────────────────────────
  // (le trigger OHADA gère journal_entries ; transactions reste manuel)
  if (statut_paiement === 'paye' && montant > 0) {
    const today = (date_consult ?? new Date().toISOString()).split('T')[0]
    await supabaseAdmin.from('transactions').insert({
      tenant_id:     ctx.tenantId,
      type:          'entree',
      categorie:     'Consultation médicale',
      description:   `Consultation — ${patient.prenom} ${patient.nom}`,
      montant,
      date:          today,
      mode_paiement: 'especes',
      source:        'sante',
      source_id:     consultation.id,
    })
  }

  return NextResponse.json({ id: consultation.id }, { status: 201 })
}
