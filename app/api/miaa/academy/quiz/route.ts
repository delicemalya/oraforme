/**
 * GET /api/miaa/academy/quiz
 * Récupère N questions aléatoires pour quiz ou examen.
 * Query: ?domaine=&niveau=&count=5&mode=quiz|exam
 *
 * POST /api/miaa/academy/quiz
 * Sauvegarde les résultats d'un examen final.
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
  const domaine = searchParams.get('domaine')
  const niveau  = searchParams.get('niveau') ?? 'debutant'
  const count   = Math.min(parseInt(searchParams.get('count') ?? '5'), 20)
  const mode    = searchParams.get('mode') ?? 'quiz'

  if (!domaine) return Response.json({ error: 'domaine requis' }, { status: 400 })

  const supabase = db()

  // Charger plus pour permettre le mélange
  const { data: questions } = await supabase
    .from('academy_questions')
    .select('id, question, options, answer_idx, explication, points')
    .eq('domaine', domaine)
    .eq('actif', true)
    .or(`niveau.eq.${niveau},niveau.eq.debutant`)
    .limit(count * 4)

  if (!questions?.length) {
    return Response.json({ questions: [], from_db: false })
  }

  // Mélanger et prendre N questions
  const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, count)

  return Response.json({
    questions: shuffled,
    total_available: questions.length,
    mode,
    from_db: true,
  })
}

export async function POST(req: Request) {
  const body = await req.json() as {
    tenant_id: string
    user_id?:  string
    domaine:   string
    niveau:    string
    score:     number
    score_max: number
    reponses?: { question_id: string; chosen_idx: number; correct: boolean; points: number }[]
  }

  const { tenant_id, user_id, domaine, niveau, score, score_max, reponses } = body
  if (!tenant_id || !domaine) {
    return Response.json({ error: 'tenant_id et domaine requis' }, { status: 400 })
  }

  const supabase  = db()
  const pct       = Math.round((score / score_max) * 100)
  const passed    = pct >= 80

  await supabase.from('academy_exam_attempts').insert({
    tenant_id,
    user_id:     user_id ?? null,
    domaine,
    niveau,
    score,
    score_max,
    pourcentage: pct,
    reponses:    reponses ?? [],
    passed,
  })

  // Mettre à jour la mémoire apprenant
  const { data: mem } = await supabase
    .from('academy_learner_memory')
    .select('id, questions_vues')
    .eq('tenant_id', tenant_id)
    .eq('domaine', domaine)
    .maybeSingle()

  if (mem) {
    await supabase.from('academy_learner_memory').update({
      questions_vues:    (mem.questions_vues ?? 0) + score_max,
      niveau_courant:    niveau,
      derniere_activite: new Date().toISOString().slice(0, 10),
    }).eq('id', mem.id)
  } else {
    await supabase.from('academy_learner_memory').insert({
      tenant_id,
      user_id:           user_id ?? null,
      domaine,
      questions_vues:    score_max,
      niveau_courant:    niveau,
      derniere_activite: new Date().toISOString().slice(0, 10),
    })
  }

  return Response.json({ ok: true, passed, pourcentage: pct })
}
