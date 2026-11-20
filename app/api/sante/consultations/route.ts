import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'
import { decomposerTTCUnifie } from '@/lib/fiscalite/engine-adapter'
import { getPaysTenant } from '@/lib/api/pays-tenant'
import { estCategorieSanteExonereeTVA } from '@/lib/fiscalite/sante-exonerations'

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
        date_facture:    dateFacture,
        montant_total:   montant,
        montant_paye:    0,
        mode_paiement:   'especes',
        statut:          'en_attente',
      })
      .select('id, numero_facture')
      .single()

    if (facErr || !facture?.id) {
      console.error('[POST /api/sante/consultations] his_factures INSERT failed', {
        consultation_id: consultation.id,
        tenant_id: ctx.tenantId,
        error: facErr?.message,
      })
      return NextResponse.json(
        { error: `Consultation créée (id: ${consultation.id}) mais échec facturation : ${facErr?.message ?? 'résultat vide'}` },
        { status: 500 },
      )
    }

    // Catégorie unique de cette ligne — même littéral utilisé pour l'insertion
    // ET pour le calcul fiscal ci-dessous, afin qu'elle ne puisse jamais
    // diverger entre la donnée persistée et l'écriture comptable émise.
    const ligneCategorie = 'consultation'

    const { error: ligneErr } = await supabaseAdmin.from('his_lignes_facture').insert({
      tenant_id:     ctx.tenantId,
      facture_id:    facture.id,
      description:   `Consultation — ${motif.trim()}`,
      quantite:      1,
      prix_unitaire: montant,
      montant_ligne: montant,
      categorie:     ligneCategorie,
    })

    if (ligneErr) {
      console.error('[POST /api/sante/consultations] his_lignes_facture INSERT failed', {
        facture_id: facture.id,
        error: ligneErr.message,
      })
      return NextResponse.json(
        { error: `Facture créée (id: ${facture.id}) mais échec ligne facturation : ${ligneErr.message}` },
        { status: 500 },
      )
    }

    // SAN-001 — Facture médicale émise (moteur comptable central, migration 140)
    // Remplace les écritures manquantes signalées dans AN-014 Plan Directeur Phase 4.
    //
    // Mission P0-FISCAL-CG-2026, exonérations confirmées (2026-09-18) :
    // 'consultation' est exonérée de TVA — Loi n°12-97, Art. 7 point 6°
    // (« examens, consultations, soins, hospitalisation, travaux d'analyse et
    // de biologie médicale, fournitures de prothèses »), vérifiée par mission
    // documentaire dédiée. Une ligne exonérée n'a pas de TVA « embarquée » à
    // décomposer : le montant facturé est intégralement du HT, tva=ca=0 — on
    // n'appelle donc PAS decomposerTTCUnifie() pour cette catégorie (l'appeler
    // inventerait une TVA qui n'existe pas). Le montant HT et le chiffre
    // d'affaires ne sont PAS réduits : seule la TVA est supprimée.
    const dateF    = dateFacture
    const fiscYear = new Date(dateF).getFullYear()
    const pays     = await getPaysTenant(ctx.tenantId)
    const { ht, tva, ca } = estCategorieSanteExonereeTVA(ligneCategorie)
      ? { ht: montant, tva: 0, ca: 0 }
      : decomposerTTCUnifie(montant, pays)
    const pieceNum = facture.numero_facture ?? `SAN-${facture.id.slice(0, 8).toUpperCase()}`
    const patNom   = `${patient.prenom} ${patient.nom}`

    await supabaseAdmin.rpc('emit_accounting_event', {
      p_tenant_id:     ctx.tenantId,
      p_event_type:    'SAN-001',
      p_source_module: 'sante',
      p_source_table:  'his_factures',
      p_source_id:     facture.id,
      p_montant_ht:    ht,
      p_montant_tva:   tva,
      p_montant_ttc:   montant,
      p_libelle:       `Consultation ${pieceNum} — ${patNom}`,
      p_date_event:    dateF,
      p_fiscal_year:   fiscYear,
      p_metadata:      { piece_number: pieceNum, patient_nom: patNom, motif: motif.trim(), ca, country_code: pays },
    })

    // Paiement immédiat : mise à jour du montant_paye (trg_his_facture_journal supprimé mig. 140)
    if (statut_paiement === 'paye') {
      const { error: payErr } = await supabaseAdmin
        .from('his_factures')
        .update({ montant_paye: montant, statut: 'payee' })
        .eq('id', facture.id)
        .eq('tenant_id', ctx.tenantId)

      if (payErr) {
        console.error('[POST /api/sante/consultations] his_factures UPDATE (paiement) failed', {
          facture_id: facture.id,
          error: payErr.message,
        })
        return NextResponse.json(
          { error: `Facture créée (id: ${facture.id}) mais échec enregistrement paiement : ${payErr.message}` },
          { status: 500 },
        )
      }

      // SAN-002 — Règlement immédiat (moteur comptable central, migration 140)
      await supabaseAdmin.rpc('emit_accounting_event', {
        p_tenant_id:     ctx.tenantId,
        p_event_type:    'SAN-002',
        p_source_module: 'sante',
        p_source_table:  'his_factures',
        p_source_id:     facture.id,
        p_montant_ht:    0,
        p_montant_tva:   0,
        p_montant_ttc:   montant,
        p_libelle:       `Règlement consultation ${pieceNum} — ${patNom}`,
        p_date_event:    dateF,
        p_fiscal_year:   fiscYear,
        p_metadata:      { piece_number: pieceNum, patient_nom: patNom, mode_paiement: 'especes' },
      })
    }
  }

  return NextResponse.json({ id: consultation.id }, { status: 201 })
}
