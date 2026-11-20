import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'
import { decomposerTTCUnifie } from '@/lib/fiscalite/engine-adapter'
import { getPaysTenant } from '@/lib/api/pays-tenant'
import { estCategorieSanteExonereeTVA } from '@/lib/fiscalite/sante-exonerations'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const statut  = searchParams.get('statut')
  const from    = searchParams.get('from')
  const to      = searchParams.get('to')

  let query = supabaseAdmin
    .from('his_factures')
    .select('*, clinique_patients(nom, prenom, numero_dossier, telephone), his_lignes_facture(*)')
    .eq('tenant_id', ctx.tenantId)
    .order('date_facture', { ascending: false })
    .limit(200)

  if (statut) query = query.eq('statut', statut)
  if (from)   query = query.gte('date_facture', from)
  if (to)     query = query.lte('date_facture', to)

  const { data, error: dbError } = await query
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  const factures = data ?? []
  const stats = {
    count_total:    factures.length,
    count_attente:  factures.filter(f => f.statut === 'en_attente').length,
    count_partielle:factures.filter(f => f.statut === 'partielle').length,
    count_payee:    factures.filter(f => f.statut === 'payee').length,
    sum_total:      factures.reduce((s, f) => s + Number(f.montant_total), 0),
    sum_paye:       factures.reduce((s, f) => s + Number(f.montant_paye), 0),
    sum_impaye:     factures.filter(f => f.statut !== 'payee').reduce((s, f) => s + (Number(f.montant_total) - Number(f.montant_paye)), 0),
  }

  return NextResponse.json({ factures, stats })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  if (!body.patient_id) return NextResponse.json({ error: 'patient_id requis' }, { status: 400 })

  const lignes: Array<{description:string;quantite:number;prix_unitaire:number;categorie?:string}> = body.lignes ?? []
  const montant_total = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0)

  const factPayload: Record<string, unknown> = {
    tenant_id:      ctx.tenantId,
    patient_id:     body.patient_id,
    montant_total,
    remise:         body.remise ?? 0,
    mode_paiement:  body.mode_paiement ?? null,
    notes:          body.notes ?? null,
  }
  if (body.consultation_id) factPayload.consultation_id = body.consultation_id
  if (body.sejour_id)       factPayload.sejour_id       = body.sejour_id
  if (body.date_echeance)   factPayload.date_echeance   = body.date_echeance

  const { data: facture, error: fErr } = await supabaseAdmin
    .from('his_factures')
    .insert(factPayload)
    .select('id, numero_facture')
    .single()

  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 })

  // Résolu une seule fois ici, réutilisé tel quel pour l'insertion ET pour le
  // calcul fiscal ci-dessous — la catégorie qui atterrit dans his_lignes_facture
  // est exactement celle qui détermine l'exonération, aucune divergence possible.
  const rows = lignes.map(l => ({
    tenant_id:    ctx.tenantId,
    facture_id:   facture.id,
    description:  l.description,
    quantite:     l.quantite,
    prix_unitaire:l.prix_unitaire,
    montant_ligne: l.quantite * l.prix_unitaire,
    categorie:    l.categorie ?? 'autre',
  }))

  if (rows.length) {
    const { error: lErr } = await supabaseAdmin.from('his_lignes_facture').insert(rows)
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
  }

  // SAN-001 — Facture médicale émise (moteur comptable central, migration 140)
  //
  // Mission P0-FISCAL-CG-2026, exonérations confirmées (2026-09-18) :
  // une facture peut mélanger des lignes exonérées ('consultation',
  // 'hospitalisation', 'labo' — Loi n°12-97 Art. 7 point 6°, vérifié par
  // mission documentaire dédiée) et des lignes taxables (les autres
  // catégories, comportement inchangé). Le calcul se fait donc PAR LIGNE,
  // pas sur le total de la facture comme avant cette correction : une ligne
  // exonérée n'a pas de TVA « embarquée » à décomposer (son montant est
  // intégralement du HT, tva=ca=0) ; une ligne taxable continue d'utiliser
  // decomposerTTCUnifie() exactement comme avant. Les totaux HT/TVA/CA de
  // l'événement comptable sont la somme des lignes.
  //
  // Effet de bord assumé, pas caché : pour une facture entièrement taxable,
  // décomposer chaque ligne séparément puis sommer peut différer de ±quelques
  // francs par rapport à l'ancienne décomposition sur le total (arrondi par
  // ligne au lieu d'un arrondi unique) — écart nécessaire pour permettre le
  // mélange exonéré/taxable, pas un choix arbitraire. Sans impact aujourd'hui :
  // aucune donnée réelle n'existe sur his_lignes_facture (NO PRODUCTION DATA).
  //
  // NON DÉTERMINÉ, toujours pas traité : 'pharmacie' (dépend du médicament,
  // Art. 7-7° et non 6°), 'imagerie', 'bloc' (correspondance non confirmée
  // nommément), 'autre' — ces 4 catégories restent taxables comme avant,
  // par défaut de decomposerTTCUnifie(), sans qu'aucun choix fiscal n'ait été
  // fait pour elles ici.
  if (montant_total > 0) {
    const today    = new Date().toISOString().split('T')[0]
    const fiscYear = new Date(today).getFullYear()
    const pays     = await getPaysTenant(ctx.tenantId)

    let ht = 0, tva = 0, ca = 0
    for (const r of rows) {
      if (estCategorieSanteExonereeTVA(r.categorie)) {
        ht += r.montant_ligne
      } else {
        const d = decomposerTTCUnifie(r.montant_ligne, pays)
        ht += d.ht; tva += d.tva; ca += d.ca
      }
    }

    const pieceNum = facture.numero_facture ?? `SAN-${facture.id.slice(0, 8).toUpperCase()}`

    await supabaseAdmin.rpc('emit_accounting_event', {
      p_tenant_id:     ctx.tenantId,
      p_event_type:    'SAN-001',
      p_source_module: 'sante',
      p_source_table:  'his_factures',
      p_source_id:     facture.id,
      p_montant_ht:    ht,
      p_montant_tva:   tva,
      p_montant_ttc:   montant_total,
      p_libelle:       `Facture médicale ${pieceNum}`,
      p_date_event:    today,
      p_fiscal_year:   fiscYear,
      p_metadata:      { piece_number: pieceNum, ca, country_code: pays },
    })
  }

  return NextResponse.json({ id: facture.id, numero_facture: facture.numero_facture }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { id, ...rest } = body
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (rest.montant_paye !== undefined) update.montant_paye  = rest.montant_paye
  if (rest.mode_paiement)              update.mode_paiement = rest.mode_paiement
  if (rest.notes !== undefined)        update.notes         = rest.notes
  if (rest.statut)                     update.statut        = rest.statut

  // Lire la facture existante si montant_paye change — nécessaire pour auto-statut et SAN-002
  let existingFac: { montant_total: number; montant_paye: number | null; mode_paiement: string | null; numero_facture: string | null } | null = null
  if (rest.montant_paye !== undefined) {
    const { data } = await supabaseAdmin
      .from('his_factures')
      .select('montant_total, montant_paye, mode_paiement, numero_facture')
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle()
    existingFac = data

    if (existingFac && !rest.statut) {
      const total = Number(existingFac.montant_total)
      const paid  = Number(rest.montant_paye)
      update.statut = paid >= total ? 'payee' : paid > 0 ? 'partielle' : 'en_attente'
    }
  }

  const { error: dbError } = await supabaseAdmin
    .from('his_factures')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  // SAN-002 — Règlement facture médicale (moteur comptable central, migration 140)
  // Remplace trg_his_facture_journal supprimé dans migration 140.
  // Emit uniquement si montant_paye augmente (delta > 0).
  // Limitation connue : paiements partiels multiples → seul le premier est comptabilisé
  // (idempotence sur source_id=his_factures.id). Évolution future : table his_paiements_sante.
  if (rest.montant_paye !== undefined && existingFac) {
    const oldPaid = Number(existingFac.montant_paye ?? 0)
    const newPaid = Number(rest.montant_paye)
    const delta   = newPaid - oldPaid
    if (delta > 0) {
      const modePaie = rest.mode_paiement ?? existingFac.mode_paiement ?? 'especes'
      const pieceNum = existingFac.numero_facture ?? `SAN-${id.slice(0, 8).toUpperCase()}`
      const today    = new Date().toISOString().split('T')[0]

      await supabaseAdmin.rpc('emit_accounting_event', {
        p_tenant_id:     ctx.tenantId,
        p_event_type:    'SAN-002',
        p_source_module: 'sante',
        p_source_table:  'his_factures',
        p_source_id:     id,
        p_montant_ht:    0,
        p_montant_tva:   0,
        p_montant_ttc:   delta,
        p_libelle:       `Règlement ${pieceNum}`,
        p_date_event:    today,
        p_fiscal_year:   new Date(today).getFullYear(),
        p_metadata:      { piece_number: pieceNum, mode_paiement: modePaie },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
