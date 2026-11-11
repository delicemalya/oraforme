import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'
import {
  evenementsComptablesBulletin, depuisLignePostgrest, BULLETIN_COMPTABLE_SELECT,
} from '@/lib/paie/evenements-comptables'
import { TAUX_MEDECINE_NON_MIGRE, calculerChampsFiscauxDerives } from '@/lib/paie/calcul-paie'
import type { SituationFamiliale } from '@/lib/fiscal/universal-tax-engine'

/**
 * Recalcul serveur CNSS/IRPP/net (Critical #3 — IRPP falsifiable côté client).
 *
 * app/dashboard/rh/paie/page.tsx::computeBulletin() calcule déjà correctement
 * ces montants côté client, avec le même moteur (universal-tax-engine.ts) —
 * mais le payload JSON envoyé à cette route n'était jamais revérifié : un
 * client modifié pouvait soumettre un cnss_salarie/irpp/net arbitraire. Les
 * gains bruts (salaire_base, primes, heures_sup...) restent des saisies RH
 * légitimes acceptées du client ; brut et tout ce qui en dérive (CNSS, IRPP,
 * net, coût employeur) sont recalculés ici et remplacent systématiquement ce
 * que le client a soumis.
 *
 * indemnites_non_imposables n'a pas de colonne persistée sur bulletins_paie
 * et aucun appelant actuel ne la renseigne (toujours 0 en pratique, voir
 * app/dashboard/rh/paie/page.tsx:69-152) — traitée comme 0 ici aussi, pour
 * rester strictement équivalente au comportement actuel (non-régression).
 * Si ce champ est un jour câblé à une saisie réelle, cette fonction devra
 * recevoir et appliquer sa valeur de la même façon.
 */
export function recalculerBulletin(
  b: Record<string, unknown>,
  situation: SituationFamiliale,
  nombreEnfants: number,
): Record<string, unknown> {
  const num = (v: unknown) => Number(v) || 0

  const heuresSupMontant = num(b.heures_sup) * num(b.taux_horaire)
  const brut =
    num(b.salaire_base) + heuresSupMontant +
    num(b.prime_rendement) + num(b.prime_anciennete) + num(b.prime_transport) +
    num(b.prime_logement) + num(b.prime_risque) + num(b.prime_responsabilite) +
    num(b.indemnite_deplacement) + num(b.avantages_nature) + num(b.autres_gains)

  const brutImposable = brut // indemnites_non_imposables toujours 0 — voir note ci-dessus

  const { cnss_salarie: cnssEmploye, cnss_patronal: cnssPatronal, tus_patronal: tusPatronal, irpp } =
    calculerChampsFiscauxDerives(brutImposable, situation, nombreEnfants)

  const mutuelle        = num(b.mutuelle)
  const acompte         = num(b.acompte)
  const opposition      = num(b.opposition)
  const autresRetenues  = num(b.autres_retenues)
  const totalRetenues   = cnssEmploye + irpp + mutuelle + acompte + opposition + autresRetenues
  const net             = brut - totalRetenues

  const medecineTravail     = Math.round(brutImposable * TAUX_MEDECINE_NON_MIGRE)
  const coutTotalEmployeur  = brutImposable + cnssPatronal + tusPatronal + medecineTravail

  return {
    ...b,
    brut, cnss_salarie: cnssEmploye, cnss_patronal: cnssPatronal, irpp, net,
    total_retenues: totalRetenues, tus_patronal: tusPatronal,
    medecine_travail: medecineTravail, cout_total_employeur: coutTotalEmployeur,
  }
}

/**
 * Émission comptable des bulletins écrits par cette route.
 *
 * Depuis la migration 141, aucun trigger n'écrit plus la paie en comptabilité :
 * c'est à la route qui change le statut d'un bulletin d'émettre PAI-001 à la
 * validation et PAI-002 au paiement. Cette route est la seule que l'interface
 * appelle (app/dashboard/rh/paie/page.tsx) et elle n'émettait rien.
 *
 * Le contrat des événements vit dans lib/paie/evenements-comptables.ts ; le
 * moteur ignore les doublons, donc réenregistrer un bulletin déjà validé ne
 * produit pas de seconde écriture.
 *
 * Retourne la liste des échecs d'émission, vide si tout est passé.
 */
async function emettreEvenementsPaie(tenantId: string, lignes: Record<string, unknown>[]): Promise<string[]> {
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const echecs: string[] = []

  for (const ligne of lignes) {
    const bulletin = depuisLignePostgrest(ligne)
    let evenements
    try {
      evenements = evenementsComptablesBulletin(tenantId, bulletin, aujourdhui)
    } catch (err) {
      echecs.push(`${bulletin.employe_nom ?? bulletin.id} : ${err instanceof Error ? err.message : String(err)}`)
      continue
    }
    for (const ev of evenements) {
      const { error } = await supabaseAdmin.rpc('emit_accounting_event', ev)
      if (error) echecs.push(`${ev.p_event_type} ${bulletin.employe_nom ?? bulletin.id} : ${error.message}`)
    }
  }
  return echecs
}

function reponseEmission(echecs: string[]) {
  if (echecs.length === 0) return NextResponse.json({ ok: true })
  // Les bulletins sont enregistrés ; la comptabilité, non. Le dire plutôt que
  // de renvoyer ok:true sur une chaîne rompue.
  return NextResponse.json(
    { ok: false, error: `Bulletins enregistrés, écritures comptables non émises — ${echecs.join(' ; ')}` },
    { status: 500 },
  )
}

// POST /api/paie/bulletins
// Upsert bulletins_paie via service_role — bypasses RLS issues caused by
// multi-profile users (profiles.id mismatch vs auth.uid() in RLS USING clause)
export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const body = await req.json()
  const { bulletins } = body as { bulletins: Record<string, unknown>[] }

  if (!Array.isArray(bulletins) || bulletins.length === 0) {
    return NextResponse.json({ error: 'bulletins requis' }, { status: 400 })
  }

  // Security: every row must belong to the authenticated tenant
  const foreign = bulletins.filter(b => b.tenant_id !== ctx.tid)
  if (foreign.length > 0) {
    return NextResponse.json({ error: 'tenant_id invalide' }, { status: 403 })
  }

  // Critical #3 — situation_matrimoniale/nb_enfants sont l'autorité serveur
  // pour le quotient familial IRPP, jamais une valeur transmise par le client.
  const employeIds = [...new Set(bulletins.map(b => b.employe_id as string).filter(Boolean))]
  const { data: employesData } = employeIds.length > 0
    ? await supabaseAdmin
        .from('employes')
        .select('id, situation_matrimoniale, nb_enfants')
        .eq('tenant_id', ctx.tid)
        .in('id', employeIds)
    : { data: [] as { id: string; situation_matrimoniale: string | null; nb_enfants: number }[] }

  const employesById = new Map((employesData ?? []).map(e => [e.id, e]))

  const missing = employeIds.filter(id => !employesById.has(id))
  if (missing.length > 0) {
    return NextResponse.json({ error: `Employé(s) introuvable(s) pour ce tenant : ${missing.join(', ')}` }, { status: 404 })
  }

  // cnss_salarie/cnss_patronal/irpp/net/total_retenues/cout_total_employeur
  // envoyés par le client sont systématiquement remplacés par le recalcul
  // serveur ci-dessous — jamais persistés tels que soumis.
  const bulletinsRecalcules = bulletins.map(b => {
    const emp = employesById.get(b.employe_id as string)
    const situation: SituationFamiliale = (emp?.situation_matrimoniale as SituationFamiliale) ?? 'celibataire'
    const nombreEnfants = emp?.nb_enfants ?? 0
    return recalculerBulletin(b, situation, nombreEnfants)
  })

  const { data: lignes, error } = await supabaseAdmin
    .from('bulletins_paie')
    .upsert(bulletinsRecalcules, { onConflict: 'employe_id,mois,annee' })
    .select(BULLETIN_COMPTABLE_SELECT)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return reponseEmission(await emettreEvenementsPaie(ctx.tid, (lignes ?? []) as Record<string, unknown>[]))
}

// PATCH /api/paie/bulletins — update statut only
export async function PATCH(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const { employe_id, mois, annee, statut } = await req.json()
  if (!employe_id || !mois || !annee || !statut) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  const { data: lignes, error } = await supabaseAdmin
    .from('bulletins_paie')
    .update({ statut })
    .eq('tenant_id', ctx.tid)
    .eq('employe_id', employe_id)
    .eq('mois', mois)
    .eq('annee', annee)
    .select(BULLETIN_COMPTABLE_SELECT)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return reponseEmission(await emettreEvenementsPaie(ctx.tid, (lignes ?? []) as Record<string, unknown>[]))
}
