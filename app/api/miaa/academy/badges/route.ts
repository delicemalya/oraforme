/**
 * GET /api/miaa/academy/badges?tenant_id=
 * Récupère tous les badges + badges gagnés par l'apprenant.
 *
 * POST /api/miaa/academy/badges
 * Vérifie et attribue les badges mérités.
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

  if (!tenantId) return Response.json({ error: 'tenant_id requis' }, { status: 400 })

  const supabase = db()
  const [{ data: allBadges }, { data: earned }] = await Promise.all([
    supabase.from('academy_badges').select('*').order('created_at'),
    supabase.from('academy_learner_badges')
      .select('badge_id, obtenu_le, academy_badges(code, nom, icone, couleur)')
      .eq('tenant_id', tenantId),
  ])

  const earnedIds = new Set((earned ?? []).map((e: { badge_id: string }) => e.badge_id))

  return Response.json({
    badges: (allBadges ?? []).map(b => ({
      ...b,
      earned: earnedIds.has(b.id),
      obtenu_le: earned?.find((e: { badge_id: string; obtenu_le: string }) => e.badge_id === b.id)?.obtenu_le ?? null,
    })),
    earned_count: earnedIds.size,
  })
}

export async function POST(req: Request) {
  const body = await req.json() as {
    tenant_id:     string
    user_id?:      string
    event:         'cours' | 'quiz' | 'certificat' | 'streak'
    domaine?:      string
    score?:        number
    score_max?:    number
    streak_jours?: number
  }

  const { tenant_id, user_id, event, domaine, score, score_max, streak_jours } = body
  if (!tenant_id) return Response.json({ error: 'tenant_id requis' }, { status: 400 })

  const supabase = db()

  // Stats actuelles
  const [{ data: progress }, { data: certs }, { data: allBadges }, { data: alreadyEarned }] = await Promise.all([
    supabase.from('academy_progress').select('categorie, cours_suivis').eq('tenant_id', tenant_id),
    supabase.from('academy_certificates').select('categorie, niveau').eq('tenant_id', tenant_id),
    supabase.from('academy_badges').select('*'),
    supabase.from('academy_learner_badges').select('badge_id').eq('tenant_id', tenant_id),
  ])

  const earnedIds   = new Set((alreadyEarned ?? []).map((e: { badge_id: string }) => e.badge_id))
  const totalCours  = (progress ?? []).reduce((s: number, p: { cours_suivis: number }) => s + (p.cours_suivis ?? 0), 0)
  const domainesCount = new Set((progress ?? []).map((p: { categorie: string }) => p.categorie)).size
  const certDomains = new Set((certs ?? []).map((c: { categorie: string }) => c.categorie))

  const newBadges: string[] = []

  for (const badge of allBadges ?? []) {
    if (earnedIds.has(badge.id)) continue

    const cond = badge.condition as {
      type: string; valeur?: number; domaine?: string; domaines?: string[]; code?: string
    }
    let earned = false

    switch (cond.type) {
      case 'cours_count':
        earned = totalCours >= (cond.valeur ?? 1)
        break
      case 'domaines_count':
        earned = domainesCount >= (cond.valeur ?? 5)
        break
      case 'quiz_perfect':
        earned = event === 'quiz' && score !== undefined && score_max !== undefined && score === score_max
        break
      case 'certificat_count':
        earned = certDomains.size >= (cond.valeur ?? 3)
        break
      case 'certificat_domaine':
        earned = certDomains.has(cond.domaine ?? '')
        break
      case 'streak':
        earned = (streak_jours ?? 0) >= (cond.valeur ?? 7)
        break
      case 'multi_certificat':
        earned = (cond.domaines ?? []).every((d: string) => certDomains.has(d))
        break
    }

    if (earned) {
      await supabase.from('academy_learner_badges').insert({
        tenant_id,
        user_id: user_id ?? null,
        badge_id: badge.id,
      }).then(() => {}, () => {})
      newBadges.push(badge.nom)
    }
  }

  return Response.json({ ok: true, new_badges: newBadges })
}
