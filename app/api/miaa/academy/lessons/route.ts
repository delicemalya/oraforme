/**
 * GET /api/miaa/academy/lessons
 * Récupère les leçons d'un domaine et niveau.
 * Query: ?domaine=&niveau=&tenant_id=
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
  const domaine  = searchParams.get('domaine')
  const niveau   = searchParams.get('niveau') ?? 'debutant'

  if (!domaine) return Response.json({ error: 'domaine requis' }, { status: 400 })

  const supabase = db()

  const { data: lessons, error } = await supabase
    .from('academy_lessons')
    .select('id, titre, objectifs, content_md, duree_min, sequence, tags')
    .eq('domaine', domaine)
    .eq('niveau', niveau)
    .eq('actif', true)
    .order('sequence', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Si pas de leçons pour ce niveau, fallback sur débutant
  if (!lessons?.length && niveau !== 'debutant') {
    const { data: fallback } = await supabase
      .from('academy_lessons')
      .select('id, titre, objectifs, content_md, duree_min, sequence, tags')
      .eq('domaine', domaine)
      .eq('niveau', 'debutant')
      .eq('actif', true)
      .order('sequence', { ascending: true })

    return Response.json({ lessons: fallback ?? [], fallback: true })
  }

  return Response.json({ lessons: lessons ?? [], fallback: false })
}
