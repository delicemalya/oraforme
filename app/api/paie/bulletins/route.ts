import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'
import {
  evenementsComptablesBulletin, depuisLignePostgrest, BULLETIN_COMPTABLE_SELECT,
} from '@/lib/paie/evenements-comptables'

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

  const { data: lignes, error } = await supabaseAdmin
    .from('bulletins_paie')
    .upsert(bulletins, { onConflict: 'employe_id,mois,annee' })
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
