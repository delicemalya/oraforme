/**
 * /api/miaa/academy
 *
 * GET  ?tenant_id=&categorie= — récupère la progression d'un tenant
 * POST { action, tenant_id, user_id?, user_name?, categorie, niveau, score?, score_max? }
 *   actions : 'save_progress' | 'save_certificate' | 'get_stats'
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
  const tenantId  = searchParams.get('tenant_id')
  const categorie = searchParams.get('categorie')

  if (!tenantId) return Response.json({ error: 'tenant_id requis' }, { status: 400 })

  const supabase = db()

  // Progression globale
  const progressQ = supabase
    .from('academy_progress')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })

  if (categorie) progressQ.eq('categorie', categorie)

  const { data: progress } = await progressQ

  // Certificats
  const { data: certificates } = await supabase
    .from('academy_certificates')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('delivre_le', { ascending: false })
    .limit(50)

  // Stats globales
  const totalCours  = (progress ?? []).reduce((s, p) => s + (p.cours_suivis ?? 0), 0)
  const totalQuiz   = (progress ?? []).reduce((s, p) => s + (p.quiz_total  ?? 0), 0)
  const totalReussi = (progress ?? []).reduce((s, p) => s + (p.quiz_reussis ?? 0), 0)

  return Response.json({
    progress:     progress     ?? [],
    certificates: certificates ?? [],
    stats: {
      total_cours:      totalCours,
      total_quiz:       totalQuiz,
      total_reussis:    totalReussi,
      taux_reussite:    totalQuiz > 0 ? Math.round((totalReussi / totalQuiz) * 100) : 0,
      nb_certificats:   (certificates ?? []).length,
      categories_vues:  (progress ?? []).length,
    },
  })
}

export async function POST(req: Request) {
  const body = await req.json() as {
    action:     string
    tenant_id:  string
    user_id?:   string
    user_name?: string
    categorie:  string
    niveau:     string
    score?:     number
    score_max?: number
  }

  const { action, tenant_id, user_id, user_name, categorie, niveau, score, score_max } = body

  if (!tenant_id || !categorie) {
    return Response.json({ error: 'tenant_id et categorie requis' }, { status: 400 })
  }

  const supabase = db()

  if (action === 'save_progress') {
    // Upsert de la progression
    const { data: existing } = await supabase
      .from('academy_progress')
      .select('id, cours_suivis, quiz_total, quiz_reussis')
      .eq('tenant_id', tenant_id)
      .eq('categorie', categorie)
      .maybeSingle()

    if (existing) {
      await supabase.from('academy_progress').update({
        niveau,
        cours_suivis:  (existing.cours_suivis ?? 0) + 1,
        dernier_cours: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await supabase.from('academy_progress').insert({
        tenant_id,
        user_id:      user_id ?? null,
        categorie,
        niveau,
        cours_suivis: 1,
        dernier_cours: new Date().toISOString(),
      })
    }
    return Response.json({ ok: true })
  }

  if (action === 'save_quiz') {
    const quizScore  = score    ?? 0
    const quizMax    = score_max ?? 5
    const passed     = quizScore >= Math.ceil(quizMax * 0.8) // 80% pass threshold

    // Mise à jour progression
    const { data: existing } = await supabase
      .from('academy_progress')
      .select('id, quiz_total, quiz_reussis, score_moyen')
      .eq('tenant_id', tenant_id)
      .eq('categorie', categorie)
      .maybeSingle()

    if (existing) {
      const newTotal   = (existing.quiz_total   ?? 0) + 1
      const newReussis = (existing.quiz_reussis ?? 0) + (passed ? 1 : 0)
      const pct        = Math.round((quizScore / quizMax) * 100)
      const prevMoy    = Number(existing.score_moyen ?? 0)
      const newMoy     = Math.round((prevMoy * (newTotal - 1) + pct) / newTotal)
      await supabase.from('academy_progress').update({
        quiz_total:   newTotal,
        quiz_reussis: newReussis,
        score_moyen:  newMoy,
        niveau,
      }).eq('id', existing.id)
    } else {
      const pct = Math.round((quizScore / quizMax) * 100)
      await supabase.from('academy_progress').insert({
        tenant_id, user_id: user_id ?? null, categorie, niveau,
        quiz_total: 1, quiz_reussis: passed ? 1 : 0, score_moyen: pct,
      })
    }

    // Générer certificat si réussi
    if (passed) {
      await supabase.from('academy_certificates').insert({
        tenant_id,
        user_id:     user_id   ?? null,
        user_name:   user_name ?? 'Apprenant',
        categorie,
        niveau,
        score:       quizScore,
        score_max:   quizMax,
        pourcentage: Math.round((quizScore / quizMax) * 100),
        delivre_le:  new Date().toISOString(),
      })
    }

    return Response.json({ ok: true, passed, certificate_generated: passed })
  }

  if (action === 'get_stats') {
    const { data: progress } = await supabase
      .from('academy_progress')
      .select('*')
      .eq('tenant_id', tenant_id)

    const { data: certs } = await supabase
      .from('academy_certificates')
      .select('categorie, niveau, pourcentage, delivre_le')
      .eq('tenant_id', tenant_id)
      .order('delivre_le', { ascending: false })

    return Response.json({ progress: progress ?? [], certificates: certs ?? [] })
  }

  return Response.json({ error: 'Action inconnue' }, { status: 400 })
}
