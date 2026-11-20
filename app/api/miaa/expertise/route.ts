/**
 * app/api/miaa/expertise/route.ts
 * MIAA+ Marketplace d'Expertise — API de génération de documents professionnels
 *
 * POST /api/miaa/expertise  → générer un document
 * GET  /api/miaa/expertise?tenant_id=xxx  → historique
 * GET  /api/miaa/expertise?tenant_id=xxx&categorie=ohada  → filtrer par catégorie
 */
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { chargerMemoireMIAA } from '@/lib/miaa/memory'
import { getDocById } from '@/lib/miaa/expertise-catalog'
import { getPaysConfig } from '@/lib/miaa/pays-localization'
import type { DocContext } from '@/lib/miaa/expertise-catalog'
import { checkPlanAccess, requireTenant } from '@/lib/api/require-tenant'

export const runtime     = 'nodejs'
export const maxDuration = 60

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ── POST — Génération de document ─────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const authCtx = await requireTenant()
    if (!authCtx.ok) return authCtx.error
    const tenant_id = authCtx.tid

    const body = await req.json() as {
      type_doc:  string
      pays:      string
      inputs:    Record<string, string>
    }
    const { type_doc, pays, inputs } = body

    if (!type_doc) {
      return Response.json({ error: 'type_doc requis' }, { status: 400 })
    }

    const planDenied = await checkPlanAccess(tenant_id, 'academy')
    if (planDenied) return planDenied

    const docDef = getDocById(type_doc)
    if (!docDef) {
      return Response.json({ error: `Document type inconnu: ${type_doc}` }, { status: 404 })
    }

    if (!anthropic) {
      return Response.json({ error: 'Clé API Anthropic manquante' }, { status: 503 })
    }

    const supabase   = getSupabase()
    const paysConfig = getPaysConfig(pays || 'Congo')
    const memory     = await chargerMemoireMIAA(supabase, tenant_id)

    const ctx: DocContext = {
      pays:       pays || 'Congo',
      paysConfig,
      entreprise: memory.entreprise.nom,
      secteur:    inputs.secteur || memory.entreprise.secteur,
      inputs,
      date:       new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
    }

    const prompt = docDef.buildPrompt(ctx)

    // Sélection modèle selon complexité
    const model = docDef.complexity === 'complet'
      ? 'claude-sonnet-4-6'
      : 'claude-haiku-4-5-20251001'

    const maxTokens = docDef.complexity === 'complet' ? 6000
      : docDef.complexity === 'standard' ? 3000
      : 1500

    const res = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      messages:   [{ role: 'user', content: prompt }],
    })

    const contenu     = res.content[0].type === 'text' ? res.content[0].text : ''
    const tokens_used = res.usage.input_tokens + res.usage.output_tokens
    const titre       = `${docDef.label} — ${ctx.entreprise} — ${ctx.date}`

    // Sauvegarder dans expertise_documents
    const { data: saved } = await supabase
      .from('expertise_documents')
      .insert({
        tenant_id,
        categorie:   docDef.categorie,
        type_doc,
        titre,
        contenu,
        pays:        ctx.pays,
        secteur:     ctx.secteur,
        tokens_used,
        meta:        { complexity: docDef.complexity, model, inputs },
      })
      .select('id, created_at')
      .single()

    return Response.json({
      success:     true,
      id:          saved?.id,
      titre,
      contenu,
      tokens_used,
      model,
      categorie:   docDef.categorie,
      created_at:  saved?.created_at,
    })

  } catch (err) {
    console.error('[MIAA expertise POST]', err)
    return Response.json({ error: 'Erreur génération document' }, { status: 500 })
  }
}

// ── GET — Historique des documents ────────────────────────────────────────────

export async function GET(req: Request) {
  const ctx = await requireTenant()
  if (!ctx.ok) return ctx.error
  const tenantId = ctx.tid

  const url       = new URL(req.url)
  const categorie = url.searchParams.get('categorie')
  const limit     = Math.min(Number(url.searchParams.get('limit') ?? '20'), 50)

  try {
    const supabase = getSupabase()
    let query = supabase
      .from('expertise_documents')
      .select('id, categorie, type_doc, titre, pays, secteur, tokens_used, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (categorie) {
      query = query.eq('categorie', categorie)
    }

    const { data, error } = await query
    if (error) throw error

    return Response.json({ documents: data ?? [] })

  } catch (err) {
    console.error('[MIAA expertise GET]', err)
    return Response.json({ error: 'Erreur chargement' }, { status: 500 })
  }
}
