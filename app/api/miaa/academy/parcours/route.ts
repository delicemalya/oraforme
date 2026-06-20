/**
 * GET /api/miaa/academy/parcours?tenant_id=
 * Récupère tous les parcours + progression de l'apprenant.
 *
 * POST /api/miaa/academy/parcours
 * body: { action: 'enroll'|'update_progress', tenant_id, parcours_id, domaine_courant?, progression? }
 */
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const tenantId = searchParams.get('tenant_id')

  try {
    const supabase = db()
    const [{ data: parcours }, { data: enrolled }] = await Promise.all([
      supabase.from('academy_parcours').select('*').eq('actif', true).order('created_at'),
      tenantId
        ? supabase.from('academy_learner_parcours').select('*').eq('tenant_id', tenantId)
        : Promise.resolve({ data: [] }),
    ])

    const enrolledMap = new Map(
      (enrolled ?? []).map((e: { parcours_id: string }) => [e.parcours_id, e])
    )

    return Response.json({
      parcours: (parcours ?? []).map(p => ({
        ...p,
        enrolled: enrolledMap.has(p.id),
        progression: (enrolledMap.get(p.id) as { progression?: number } | undefined)?.progression ?? 0,
        statut:     (enrolledMap.get(p.id) as { statut?: string } | undefined)?.statut ?? null,
        debut_le:   (enrolledMap.get(p.id) as { debut_le?: string } | undefined)?.debut_le ?? null,
      })),
    })
  } catch (e) {
    console.error('[miaa/academy/parcours GET]', e)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const body = await req.json() as {
    action:          'enroll' | 'update_progress'
    tenant_id:       string
    user_id?:        string
    parcours_id:     string
    domaine_courant?: string
    progression?:    number
  }

  const { action, tenant_id, user_id, parcours_id, domaine_courant, progression } = body
  if (!tenant_id || !parcours_id) {
    return Response.json({ error: 'tenant_id et parcours_id requis' }, { status: 400 })
  }

  try {
    const supabase = db()

    if (action === 'enroll') {
      const { data: existing } = await supabase
        .from('academy_learner_parcours')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('parcours_id', parcours_id)
        .maybeSingle()

      if (!existing) {
        // Récupérer le premier domaine du parcours
        const { data: parcours } = await supabase
          .from('academy_parcours')
          .select('domaines')
          .eq('id', parcours_id)
          .maybeSingle()

        await supabase.from('academy_learner_parcours').insert({
          tenant_id,
          user_id:         user_id ?? null,
          parcours_id,
          domaine_courant: parcours?.domaines?.[0] ?? '',
          progression:     0,
          statut:          'en_cours',
        })
      }
      return Response.json({ ok: true, enrolled: true })
    }

    if (action === 'update_progress') {
      const updates: Record<string, unknown> = {}
      if (domaine_courant !== undefined) updates.domaine_courant = domaine_courant
      if (progression !== undefined)     updates.progression     = progression
      if (progression === 100)          { updates.statut = 'termine'; updates.fin_le = new Date().toISOString() }

      await supabase.from('academy_learner_parcours')
        .update(updates)
        .eq('tenant_id', tenant_id)
        .eq('parcours_id', parcours_id)

      return Response.json({ ok: true })
    }

    return Response.json({ error: 'Action inconnue' }, { status: 400 })
  } catch (e) {
    console.error('[miaa/academy/parcours POST]', e)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
